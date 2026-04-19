/* ============================================
   TaskFlow AI — UI Renderer
   ============================================ */

import { store } from './store.js';
import {
  formatRelativeTime, getDeadlineStatus, formatDuration,
  formatDate, getCategoryEmoji, getPriorityLabel, getLocalISOString,
} from './utils.js';
import { renderAnalyticsDashboard } from './analyticsService.js';
import {
  getFilteredTasks, getTaskStats, sortTasks,
  createTask, updateTask, deleteTask, toggleTask,
  toggleSubtask, addSubtask,
} from './taskManager.js';
import { toggleNotifications } from './notificationService.js';

let currentView = 'all';
let currentSort = 'deadline';

export function getCurrentView() { return currentView; }

/**
 * Switch the task list view
 */
export function setView(view) {
  currentView = view;
  updateSidebarActive(view);
  renderMainContent();
}

export function setSort(sort) {
  currentSort = sort;
  // Update sort tab visual
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.sort === sort);
  });
  renderTaskList();
}

/**
 * Render the main content area (header + task list)
 */
export function renderMainContent() {
  const viewTitles = {
    all: '📋 All Tasks',
    today: '☀️ Today',
    upcoming: '📅 Upcoming',
    overdue: '🔥 Overdue',
    completed: '✅ Completed',
    schedule: '🤖 AI Schedule',
    timeline: '📈 Timeline',
    analytics: '📊 Analytics',
  };

  const mainHeader = document.getElementById('mainHeaderTitle');
  if (mainHeader) {
    mainHeader.textContent = viewTitles[currentView] || '📋 All Tasks';
  }

  // Analytics view renders its own dashboard
  if (currentView === 'analytics') {
    renderAnalyticsDashboard();
    return;
  }

  if (currentView === 'timeline') {
    renderTimelineView();
    return;
  }

  renderTaskList();
}

/**
 * Render the list of task cards
 */
export function renderTaskList() {
  const container = document.getElementById('taskListContainer');
  if (!container) return;

  let tasks = getFilteredTasks(currentView);

  if (currentView === 'schedule') {
    tasks = sortTasks(tasks, 'ai');
  } else {
    tasks = sortTasks(tasks, currentSort);
  }

  if (tasks.length === 0) {
    container.innerHTML = renderEmptyState(currentView);
    return;
  }

  const cardsHtml = tasks.map(t => renderTaskCard(t)).join('');
  container.innerHTML = `
    <div class="task-list stagger-children">
      ${cardsHtml}
    </div>
    ${currentView !== 'completed' ? `
      <div class="add-task-inline" id="addTaskInline" onclick="window.app.openTaskModal()">
        <span>＋</span>
        <span>Add a task...</span>
      </div>
    ` : ''}
  `;
}

/* ══════════════════════════════════════════════
   TIMELINE VIEW (Gantt-style)
   ══════════════════════════════════════════════ */

/**
 * Compute the time window each task should occupy on the timeline.
 *   - AI-scheduled → [aiStartTime, aiEndTime]
 *   - Has deadline → [deadline - estimatedMinutes, deadline]
 *   - Only estimated duration → [now, now + estimatedMinutes]
 */
function computeTimelineItems() {
  const now = Date.now();
  const tasks = store.getTasks().filter(t => !t.completed);

  const items = tasks.map(t => {
    const hasSchedule = !!(t.aiStartTime && t.aiEndTime);
    let start, end;

    if (hasSchedule) {
      start = new Date(t.aiStartTime).getTime();
      end = new Date(t.aiEndTime).getTime();
    } else if (t.deadline) {
      const dl = new Date(t.deadline).getTime();
      const dur = Math.max((t.estimatedMinutes || 60) * 60000, 15 * 60000);
      start = dl - dur;
      end = dl;
    } else {
      start = now;
      end = now + Math.max((t.estimatedMinutes || 60) * 60000, 15 * 60000);
    }

    return {
      task: t,
      start,
      end,
      deadline: t.deadline ? new Date(t.deadline).getTime() : null,
      hasSchedule,
    };
  });

  // AI-scheduled first (by aiPriority asc), then unscheduled by deadline asc
  items.sort((a, b) => {
    if (a.hasSchedule && b.hasSchedule) {
      return (a.task.aiPriority || 999) - (b.task.aiPriority || 999);
    }
    if (a.hasSchedule) return -1;
    if (b.hasSchedule) return 1;
    const ad = a.deadline ?? Infinity;
    const bd = b.deadline ?? Infinity;
    return ad - bd;
  });

  return items;
}

/**
 * Choose a sensible axis tick interval for the given span.
 */
function buildAxisMarks(rangeStart, rangeEnd) {
  const span = rangeEnd - rangeStart;
  const DAY = 24 * 3600 * 1000;
  let stepMs;
  let fmt;

  if (span <= 2 * DAY) {
    stepMs = 6 * 3600 * 1000;
    fmt = d => d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
  } else if (span <= 14 * DAY) {
    stepMs = DAY;
    fmt = d => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else if (span <= 60 * DAY) {
    stepMs = 7 * DAY;
    fmt = d => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else {
    stepMs = 30 * DAY;
    fmt = d => d.toLocaleDateString([], { month: 'short', year: 'numeric' });
  }

  // Round up the first tick to the next whole stepMs boundary (aligned at UTC midnight for daily+).
  const marks = [];
  const first = new Date(rangeStart);
  first.setMinutes(0, 0, 0);
  let t = Math.ceil(first.getTime() / stepMs) * stepMs;
  const safetyMax = 200;
  let count = 0;
  while (t <= rangeEnd && count < safetyMax) {
    marks.push({ time: t, label: fmt(new Date(t)) });
    t += stepMs;
    count++;
  }
  return marks;
}

export function renderTimelineView() {
  const container = document.getElementById('taskListContainer');
  if (!container) return;

  const items = computeTimelineItems();

  if (items.length === 0) {
    container.innerHTML = renderEmptyState('timeline');
    return;
  }

  const now = Date.now();
  const minStart = Math.min(now, ...items.map(i => i.start));
  const maxEnd = Math.max(
    now + 60 * 60000,
    ...items.map(i => Math.max(i.end, i.deadline ?? 0))
  );
  const padding = Math.max((maxEnd - minStart) * 0.05, 30 * 60000);
  const rangeStart = minStart - padding;
  const rangeEnd = maxEnd + padding;
  const totalMs = rangeEnd - rangeStart;

  const marks = buildAxisMarks(rangeStart, rangeEnd);
  const pct = t => ((t - rangeStart) / totalMs) * 100;

  const axisHtml = marks.map(m => `
    <div class="tl-axis-mark" style="left:${pct(m.time).toFixed(2)}%">
      <div class="tl-axis-label">${escHtml(m.label)}</div>
    </div>
  `).join('');

  const gridlinesHtml = marks.map(m => `
    <div class="tl-gridline" style="left:${pct(m.time).toFixed(2)}%"></div>
  `).join('');

  const rowsHtml = items.map(item => {
    const { task } = item;
    const leftPct = pct(item.start);
    const widthPct = Math.max(pct(item.end) - leftPct, 0.6);
    const deadlinePct = item.deadline !== null ? pct(item.deadline) : null;
    const isOverdue = item.deadline !== null && item.deadline < now;
    const deadlineStatus = item.deadline !== null ? getDeadlineStatus(new Date(item.deadline).toISOString()) : '';

    const barClasses = ['tl-bar'];
    if (item.hasSchedule) {
      barClasses.push('ai-scheduled');
    } else {
      barClasses.push('pending', `priority-${task.priority}`);
    }
    if (isOverdue) barClasses.push('overdue');

    const startStr = new Date(item.start).toLocaleString();
    const endStr = new Date(item.end).toLocaleString();
    const barTooltip = escAttr(`${task.title}\n${startStr} → ${endStr}${task.aiReason ? `\n\nAI: ${task.aiReason}` : ''}`);

    const rankBadge = item.hasSchedule
      ? `<span class="tl-ai-num" title="AI priority #${task.aiPriority}">#${task.aiPriority}</span>`
      : `<span class="tl-ai-num pending" title="Not scheduled by AI">—</span>`;

    const deadlineLabel = item.deadline !== null ? formatRelativeTime(new Date(item.deadline).toISOString()) : '';

    return `
      <div class="tl-row">
        <div class="tl-label" onclick="window.app.editTask('${task.id}')" title="Click to edit">
          ${rankBadge}
          <div class="tl-label-text">
            <div class="tl-title">${escHtml(task.title)}</div>
            <div class="tl-meta">
              <span class="priority-badge ${task.priority}">${getPriorityLabel(task.priority)}</span>
              ${item.deadline !== null ? `<span class="${deadlineStatus}">📅 ${escHtml(deadlineLabel)}</span>` : ''}
              <span>⏱ ${escHtml(formatDuration(task.estimatedMinutes))}</span>
            </div>
          </div>
        </div>
        <div class="tl-track">
          ${gridlinesHtml}
          <div class="${barClasses.join(' ')}"
               style="left:${leftPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%"
               title="${barTooltip}"
               onclick="window.app.editTask('${task.id}')">
            <span class="tl-bar-label">${escHtml(task.title)}</span>
          </div>
          ${deadlinePct !== null ? `
            <div class="tl-deadline-marker ${deadlineStatus === 'urgent' ? 'urgent' : ''}"
                 style="left:${deadlinePct.toFixed(2)}%"
                 title="Deadline: ${escAttr(formatDate(new Date(item.deadline).toISOString()))}"></div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  const nowPct = pct(now);
  const nowWithinRange = nowPct >= 0 && nowPct <= 100;

  container.innerHTML = `
    <div class="timeline-view">
      <div class="tl-header">
        <div class="tl-label-header">Task</div>
        <div class="tl-axis">${axisHtml}</div>
      </div>
      <div class="tl-body">
        ${nowWithinRange ? `
          <div class="tl-now-line" style="left:calc(var(--tl-label-w) + (100% - var(--tl-label-w)) * ${nowPct.toFixed(2)} / 100)"></div>
        ` : ''}
        ${rowsHtml}
      </div>
      <div class="tl-legend">
        <span class="tl-legend-item"><span class="tl-legend-swatch ai"></span>AI-scheduled (bar width = planned duration)</span>
        <span class="tl-legend-item"><span class="tl-legend-swatch pending"></span>Not scheduled (bar ends at deadline)</span>
        <span class="tl-legend-item"><span class="tl-legend-swatch overdue"></span>Overdue</span>
        <span class="tl-legend-item">🚩 Deadline</span>
      </div>
    </div>
  `;
}

/**
 * Render a single task card
 */
function renderTaskCard(task) {
  const deadlineStatus = task.deadline ? getDeadlineStatus(task.deadline) : '';
  const relTime = formatRelativeTime(task.deadline);
  const subtaskProgress = task.subtasks && task.subtasks.length > 0
    ? `${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length}`
    : '';

  return `
    <div class="task-card ${task.completed ? 'completed' : ''} ${deadlineStatus === 'overdue' && !task.completed ? 'overdue' : ''}"
         data-id="${task.id}"
         data-priority="${task.priority}"
         id="task-${task.id}">
      <div class="task-card-header">
        <div class="task-checkbox ${task.completed ? 'checked' : ''}"
             onclick="event.stopPropagation(); window.app.toggleTask('${task.id}')">
          ${task.completed ? '✓' : ''}
        </div>
        <span class="task-title">${escHtml(task.title)}</span>
        <div class="task-card-actions">
          <button class="btn-ghost" onclick="event.stopPropagation(); window.app.editTask('${task.id}')" title="Edit">✏️</button>
          <button class="btn-ghost" onclick="event.stopPropagation(); window.app.deleteTask('${task.id}')" title="Delete">🗑️</button>
        </div>
      </div>
      ${task.description ? `<div class="task-card-body"><p class="task-description">${escHtml(task.description)}</p></div>` : ''}
      <div class="task-card-body">
        <div class="task-meta">
          <span class="priority-badge ${task.priority}">${getPriorityLabel(task.priority)}</span>
          <span class="category-badge">${getCategoryEmoji(task.category)} ${task.category}</span>
          ${task.deadline ? `<span class="task-meta-item deadline ${deadlineStatus}">📅 ${relTime}</span>` : ''}
          <span class="task-meta-item duration">⏱ ${formatDuration(task.estimatedMinutes)}</span>
          ${subtaskProgress ? `<span class="task-meta-item">📝 ${subtaskProgress}</span>` : ''}
          ${task.aiPriority !== null ? `<span class="ai-priority-badge">🤖 #${task.aiPriority}</span>` : ''}
          ${task.moodleSource ? `<span class="task-meta-item" style="color:var(--accent-warning);">🎓 Moodle</span>` : ''}
        </div>
        ${task.aiReason && currentView === 'schedule' ? `<p class="timeline-task-reason">💡 ${escHtml(task.aiReason)}</p>` : ''}
        ${task.aiStartTime && currentView === 'schedule' ? `
          <p class="timeline-task-meta" style="margin-top:6px;">
            <span>🕐 ${formatDate(task.aiStartTime)}</span>
            <span>→</span>
            <span>${formatDate(task.aiEndTime)}</span>
          </p>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render empty state message
 */
function renderEmptyState(view) {
  const messages = {
    all: { icon: '🎯', title: 'No tasks yet', text: 'Add your first task to get started. Click "+ Add a task" below.' },
    today: { icon: '☀️', title: 'Nothing due today', text: 'Enjoy your day or add some tasks with today\'s deadline.' },
    upcoming: { icon: '📅', title: 'No upcoming tasks', text: 'No tasks due in the next 7 days.' },
    overdue: { icon: '🎉', title: 'No overdue tasks!', text: 'Great job staying on top of your deadlines!' },
    completed: { icon: '📭', title: 'No completed tasks', text: 'Complete some tasks to see them here.' },
    schedule: { icon: '🤖', title: 'No AI schedule yet', text: 'Click "AI Schedule" to let AI prioritize your tasks.' },
    timeline: { icon: '📈', title: 'Nothing to plot yet', text: 'Add tasks with deadlines to see them on the timeline.' },
  };
  const m = messages[view] || messages.all;
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${m.icon}</div>
      <div class="empty-state-title">${m.title}</div>
      <div class="empty-state-text">${m.text}</div>
    </div>
  `;
}

/**
 * Update sidebar active item
 */
function updateSidebarActive(view) {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
}

/**
 * Update sidebar counts
 */
export function updateSidebarCounts() {
  const stats = getTaskStats();
  setText('countAll', stats.active);
  setText('countToday', stats.today);
  setText('countUpcoming', getFilteredTasks('upcoming').length);
  setText('countOverdue', stats.overdue);
  setText('countCompleted', stats.completed);
  const schedule = getFilteredTasks('schedule');
  setText('countSchedule', schedule.length);
  setText('countTimeline', stats.active);
}

/**
 * Update footer stats
 */
export function updateFooterStats() {
  const stats = getTaskStats();
  setText('footerTotal', `${stats.active} tasks`);
  setText('footerEstimated', formatDuration(stats.totalEstimatedMinutes));
  setText('footerCompleted', `${stats.completed} done`);
  setText('footerOverdue', stats.overdue > 0 ? `${stats.overdue} overdue` : '');
}

/**
 * Open the add/edit task modal
 */
export function openTaskModal(taskId = null) {
  const modal = document.getElementById('taskModal');
  const overlay = document.getElementById('taskModalOverlay');
  if (!modal || !overlay) return;

  const isEdit = taskId !== null;
  const task = isEdit ? store.getTask(taskId) : null;

  document.getElementById('taskModalTitle').textContent = isEdit ? 'Edit Task' : 'New Task';
  document.getElementById('taskFormId').value = isEdit ? taskId : '';
  document.getElementById('taskFormTitle').value = task ? task.title : '';
  document.getElementById('taskFormDescription').value = task ? task.description || '' : '';
  document.getElementById('taskFormDeadline').value = task && task.deadline
    ? getLocalISOString(new Date(task.deadline))
    : getLocalISOString(new Date(Date.now() + 86400000)); // default: tomorrow
  document.getElementById('taskFormDuration').value = task ? task.estimatedMinutes : 60;
  document.getElementById('taskFormCategory').value = task ? task.category : 'other';
  document.getElementById('taskFormPriority').value = task ? task.priority : 'medium';

  // Subtasks
  const subtasksContainer = document.getElementById('taskFormSubtasks');
  subtasksContainer.innerHTML = '';
  if (task && task.subtasks) {
    task.subtasks.forEach(s => {
      appendSubtaskInput(subtasksContainer, s.title);
    });
  }

  overlay.classList.add('active');
}

/**
 * Close the task modal
 */
export function closeTaskModal() {
  const overlay = document.getElementById('taskModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

/**
 * Handle task form submission
 */
export function submitTaskForm() {
  const id = document.getElementById('taskFormId').value;
  const title = document.getElementById('taskFormTitle').value.trim();
  if (!title) {
    document.getElementById('taskFormTitle').classList.add('animate-shake');
    setTimeout(() => document.getElementById('taskFormTitle').classList.remove('animate-shake'), 400);
    return;
  }

  const data = {
    title,
    description: document.getElementById('taskFormDescription').value,
    deadline: document.getElementById('taskFormDeadline').value
      ? new Date(document.getElementById('taskFormDeadline').value).toISOString()
      : null,
    estimatedMinutes: parseInt(document.getElementById('taskFormDuration').value, 10) || 60,
    category: document.getElementById('taskFormCategory').value,
    priority: document.getElementById('taskFormPriority').value,
  };

  // Gather subtasks
  const subtaskInputs = document.querySelectorAll('.subtask-input-field');
  const subtasks = Array.from(subtaskInputs)
    .map(input => input.value.trim())
    .filter(v => v);

  if (id) {
    // Edit existing
    updateTask(id, {
      ...data,
      subtasks: subtasks.map((title, i) => {
        const existing = store.getTask(id)?.subtasks?.[i];
        return {
          id: existing?.id || (Date.now().toString(36) + Math.random().toString(36).substring(2, 5)),
          title,
          completed: existing?.completed || false,
        };
      }),
    });
    showToast('Task updated ✓', 'success');
  } else {
    // Create new
    data.subtasks = subtasks;
    createTask(data);
    showToast('Task created ✓', 'success');
  }

  closeTaskModal();
  renderAll();
}

/**
 * Append a subtask input field to the form
 */
export function appendSubtaskInput(container, value = '') {
  if (!container) container = document.getElementById('taskFormSubtasks');
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
  wrapper.innerHTML = `
    <input type="text" class="form-input subtask-input-field" value="${escHtml(value)}" placeholder="Subtask title..." style="flex:1">
    <button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()" style="color:var(--accent-danger);font-size:16px;">✕</button>
  `;
  container.appendChild(wrapper);
  wrapper.querySelector('input').focus();
}

/**
 * Open settings modal
 */
export function openSettingsModal() {
  const overlay = document.getElementById('settingsModalOverlay');
  if (!overlay) return;

  const settings = store.getSettings();
  document.getElementById('settingApiKey').value = settings.apiKey;
  document.getElementById('settingApiEndpoint').value = settings.apiEndpoint;
  document.getElementById('settingModel').value = settings.model;
  document.getElementById('settingWorkStart').value = settings.workStartHour;
  document.getElementById('settingWorkEnd').value = settings.workEndHour;
  document.getElementById('settingBreak').value = settings.breakMinutes;
  document.getElementById('settingDefaultDuration').value = settings.defaultDurationMinutes;

  // Moodle fields
  const moodleUrl = document.getElementById('settingMoodleUrl');
  const moodleToken = document.getElementById('settingMoodleToken');
  const moodleAutoSync = document.getElementById('settingMoodleAutoSync');
  if (moodleUrl) moodleUrl.value = settings.moodleUrl || '';
  if (moodleToken) moodleToken.value = settings.moodleToken || '';
  if (moodleAutoSync) moodleAutoSync.checked = settings.moodleAutoSync || false;

  // Clear test result
  const testResult = document.getElementById('moodleTestResult');
  if (testResult) testResult.innerHTML = '';

  // Notification setting
  const notifCheckbox = document.getElementById('settingNotifications');
  if (notifCheckbox) notifCheckbox.checked = settings.notificationsEnabled || false;
  const notifStatus = document.getElementById('notificationStatus');
  if (notifStatus) {
    if ('Notification' in window) {
      notifStatus.textContent = `Quyền thông báo: ${Notification.permission === 'granted' ? '✅ Đã cấp' : Notification.permission === 'denied' ? '❌ Bị chặn' : '⏳ Chưa cấp'}`;
    } else {
      notifStatus.textContent = 'Trình duyệt không hỗ trợ thông báo';
    }
  }

  overlay.classList.add('active');
}

/**
 * Close settings modal
 */
export function closeSettingsModal() {
  const overlay = document.getElementById('settingsModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

/**
 * Save settings
 */
export function saveSettings() {
  const moodleUrl = (document.getElementById('settingMoodleUrl')?.value || '').trim().replace(/\/+$/, '');
  const moodleToken = (document.getElementById('settingMoodleToken')?.value || '').trim();
  const moodleAutoSync = document.getElementById('settingMoodleAutoSync')?.checked || false;
  const notificationsEnabled = document.getElementById('settingNotifications')?.checked || false;

  store.updateSettings({
    apiKey: document.getElementById('settingApiKey').value.trim(),
    apiEndpoint: document.getElementById('settingApiEndpoint').value.trim() || 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: document.getElementById('settingModel').value.trim() || 'gemini-2.0-flash',
    workStartHour: parseInt(document.getElementById('settingWorkStart').value, 10) || 8,
    workEndHour: parseInt(document.getElementById('settingWorkEnd').value, 10) || 22,
    breakMinutes: parseInt(document.getElementById('settingBreak').value, 10) || 15,
    defaultDurationMinutes: parseInt(document.getElementById('settingDefaultDuration').value, 10) || 60,
    moodleUrl,
    moodleToken,
    moodleAutoSync,
    notificationsEnabled,
  });

  // Show/hide Moodle sidebar section
  const moodleSection = document.getElementById('moodleSection');
  if (moodleSection) {
    moodleSection.style.display = (moodleUrl && moodleToken) ? 'block' : 'none';
  }

  // Handle notifications toggle
  toggleNotifications(notificationsEnabled);

  closeSettingsModal();
  showToast('Settings saved ✓', 'success');
}

/**
 * Toggle theme
 */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  store.updateSettings({ theme: next });

  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = next === 'dark' ? '🌙' : '☀️';
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Toggle chat panel
 */
export function toggleChatPanel() {
  document.querySelector('.app-shell').classList.toggle('chat-collapsed');
}

/**
 * Render all UI elements
 */
export function renderAll() {
  renderMainContent();
  updateSidebarCounts();
  updateFooterStats();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? '';
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
