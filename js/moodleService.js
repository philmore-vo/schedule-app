/* ============================================
   TaskFlow AI — Moodle Integration Service
   ============================================
   Syncs assignments and deadlines from Moodle
   LMS into TaskFlow AI tasks.
   ============================================ */

import { store } from './store.js';
import { showToast } from './uiRenderer.js';
import { generateId } from './utils.js';
import { notifyNewMoodleTasks } from './notificationService.js';

let isSyncing = false;

/**
 * Call Moodle Web Service API via Electron main process
 */
async function moodleAPI(wsfunction, params = {}) {
  const settings = store.getSettings();
  if (!settings.moodleUrl || !settings.moodleToken) {
    throw new Error('Vui lòng cấu hình Moodle URL và Token trong Settings ⚙️');
  }

  if (!window.electronAPI) {
    throw new Error('Tính năng Moodle chỉ hoạt động trong Electron app');
  }

  const result = await window.electronAPI.moodleCall({
    siteUrl: settings.moodleUrl,
    token: settings.moodleToken,
    wsfunction,
    params,
  });

  // Check for error response (main process returns { __error } instead of rejecting)
  if (result && result.__error) {
    throw { error: result.__error, code: result.code };
  }

  return result;
}

/**
 * Test connection to Moodle
 */
export async function testMoodleConnection() {
  try {
    const info = await moodleAPI('core_webservice_get_site_info');
    return {
      success: true,
      siteName: info.sitename,
      userName: info.fullname,
      userId: info.userid,
    };
  } catch (err) {
    return {
      success: false,
      error: err.error || err.message || 'Không thể kết nối Moodle',
    };
  }
}

/**
 * Get upcoming calendar events from Moodle
 */
async function getCalendarEvents() {
  const now = Math.floor(Date.now() / 1000);
  const twoMonthsLater = now + (60 * 24 * 60 * 60); // 60 days ahead

  try {
    // Try action events first (assignment deadlines)
    const events = await moodleAPI('core_calendar_get_action_events_by_timesort', {
      timesortfrom: now,
      timesortto: twoMonthsLater,
      limitnum: 100,
    });

    if (events && events.events) {
      return events.events;
    }
  } catch (e) {
    console.warn('Action events API not available, trying calendar events...');
  }

  // Fallback: use calendar events API
  try {
    const events = await moodleAPI('core_calendar_get_calendar_events', {
      options: {
        timestart: now,
        timeend: twoMonthsLater,
        userevents: 1,
        siteevents: 1,
      },
    });

    if (events && events.events) {
      return events.events;
    }
  } catch (e) {
    console.warn('Calendar events API failed:', e);
  }

  return [];
}

/**
 * Get assignments from enrolled courses
 */
async function getAssignments() {
  try {
    // Get enrolled courses first
    const info = await moodleAPI('core_webservice_get_site_info');
    const courses = await moodleAPI('core_enrol_get_users_courses', {
      userid: info.userid,
    });

    if (!courses || courses.length === 0) return [];

    // Get assignments for all courses
    const courseIds = courses.map(c => c.id);
    const result = await moodleAPI('mod_assign_get_assignments', {
      courseids: courseIds,
    });

    if (!result || !result.courses) return [];

    const assignments = [];
    for (const course of result.courses) {
      for (const assign of (course.assignments || [])) {
        assignments.push({
          ...assign,
          courseName: course.fullname || course.shortname,
        });
      }
    }

    return assignments;
  } catch (e) {
    console.warn('Assignments API failed:', e);
    return [];
  }
}

/**
 * Convert Moodle event to TaskFlow task
 */
function moodleEventToTask(event) {
  const deadline = event.timestart
    ? new Date(event.timestart * 1000).toISOString()
    : (event.duedate ? new Date(event.duedate * 1000).toISOString() : null);

  // Skip events without deadline or already past
  if (!deadline) return null;
  const deadlineDate = new Date(deadline);
  if (deadlineDate < new Date()) return null;

  const title = event.name || event.activityname || 'Untitled Moodle Event';
  const courseName = event.course?.fullname || event.courseName || '';
  const description = courseName
    ? `📚 ${courseName}\n${stripHtml(event.description || '')}`
    : stripHtml(event.description || '');

  return {
    id: generateId(),
    title: title,
    description: description.trim().substring(0, 500),
    deadline: deadline,
    estimatedMinutes: 60, // Default estimate
    category: 'study',
    priority: determinePriority(deadlineDate),
    completed: false,
    completedAt: null,
    subtasks: [],
    createdAt: new Date().toISOString(),
    // Moodle metadata
    moodleId: event.id || event.cmid || null,
    moodleSource: true,
    moodleUrl: event.url || null,
  };
}

/**
 * Auto-determine priority based on deadline proximity
 */
function determinePriority(deadline) {
  const now = new Date();
  const hoursUntil = (deadline - now) / (1000 * 60 * 60);

  if (hoursUntil <= 24) return 'critical';
  if (hoursUntil <= 72) return 'high';
  if (hoursUntil <= 168) return 'medium'; // 7 days
  return 'low';
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

/**
 * Sync Moodle events into TaskFlow tasks
 */
export async function syncMoodle() {
  if (isSyncing) {
    showToast('Đang sync... vui lòng chờ', 'info');
    return;
  }

  const settings = store.getSettings();
  if (!settings.moodleUrl || !settings.moodleToken) {
    showToast('⚠️ Cấu hình Moodle URL và Token trong Settings trước', 'error');
    return;
  }

  isSyncing = true;
  showToast('🔄 Đang sync từ Moodle...', 'info');

  // Update sync button UI
  const syncBtn = document.getElementById('moodleSyncBtn');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '⏳ Đang sync...';
  }

  try {
    // Fetch both calendar events and assignments
    const [calEvents, assignments] = await Promise.all([
      getCalendarEvents(),
      getAssignments(),
    ]);

    // Combine and deduplicate
    const allEvents = [...calEvents];

    // Add assignments that aren't already in calendar events
    for (const assign of assignments) {
      const exists = allEvents.some(e =>
        (e.name === assign.name) ||
        (e.instance === assign.id && e.modulename === 'assign')
      );
      if (!exists && assign.duedate) {
        allEvents.push({
          id: `assign_${assign.id}`,
          name: assign.name,
          description: assign.intro || '',
          timestart: assign.duedate,
          courseName: assign.courseName,
          url: null,
        });
      }
    }

    // Get existing moodle tasks to avoid duplicates
    const existingTasks = store.getTasks();
    const existingMoodleIds = new Set(
      existingTasks
        .filter(t => t.moodleSource)
        .map(t => String(t.moodleId))
    );
    const existingTitles = new Set(
      existingTasks.map(t => t.title.toLowerCase())
    );

    // Convert to tasks
    let imported = 0;
    let skipped = 0;

    for (const event of allEvents) {
      const task = moodleEventToTask(event);
      if (!task) {
        skipped++;
        continue;
      }

      // Check for duplicates
      const moodleIdStr = String(task.moodleId);
      if (existingMoodleIds.has(moodleIdStr) || existingTitles.has(task.title.toLowerCase())) {
        skipped++;
        continue;
      }

      store.addTask(task);
      existingMoodleIds.add(moodleIdStr);
      existingTitles.add(task.title.toLowerCase());
      imported++;
    }

    if (imported > 0) {
      showToast(`✅ Đã import ${imported} task từ Moodle! (${skipped} bỏ qua)`, 'success');
      notifyNewMoodleTasks(imported);
    } else if (allEvents.length > 0) {
      showToast(`ℹ️ Không có task mới (${skipped} đã tồn tại)`, 'info');
    } else {
      showToast('ℹ️ Không tìm thấy deadline nào trên Moodle', 'info');
    }

    // Save last sync time
    store.updateSettings({ moodleLastSync: new Date().toISOString() });

  } catch (err) {
    console.error('Moodle sync error:', err);
    showToast(`❌ Sync lỗi: ${err.error || err.message}`, 'error');
  } finally {
    isSyncing = false;
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '🔄 Sync Moodle';
    }
  }
}

/**
 * Initialize Moodle sync button and auto-sync
 */
export function initMoodle() {
  const settings = store.getSettings();

  // Show/hide Moodle section based on config
  updateMoodleUI(settings);

  // Auto-sync on startup if configured
  if (settings.moodleUrl && settings.moodleToken && settings.moodleAutoSync) {
    setTimeout(() => syncMoodle(), 3000); // Delay 3s after app load
  }
}

/**
 * Update Moodle UI visibility
 */
export function updateMoodleUI(settings) {
  const section = document.getElementById('moodleSection');
  if (section) {
    section.style.display = (settings?.moodleUrl && settings?.moodleToken) ? 'block' : 'none';
  }

  // Update last sync time
  const lastSyncEl = document.getElementById('moodleLastSync');
  if (lastSyncEl && settings?.moodleLastSync) {
    const ago = getTimeAgo(new Date(settings.moodleLastSync));
    lastSyncEl.textContent = `Sync lần cuối: ${ago}`;
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86400)} ngày trước`;
}
