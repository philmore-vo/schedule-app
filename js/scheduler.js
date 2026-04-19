/* ============================================
   TaskFlow AI — Scheduler Display
   ============================================ */

import { store } from './store.js';
import { scheduleTasksWithAI } from './aiService.js';
import { showToast, renderAll, setView } from './uiRenderer.js';
import { formatDate, formatDuration } from './utils.js';

let isScheduling = false;

/**
 * Run AI scheduling
 */
export async function runAISchedule() {
  if (isScheduling) return;

  const settings = store.getSettings();
  if (!settings.apiKey) {
    showToast('Please set your API key in Settings first', 'error');
    return;
  }

  const activeTasks = store.getTasks().filter(t => !t.completed);
  if (activeTasks.length === 0) {
    showToast('No tasks to schedule', 'error');
    return;
  }

  isScheduling = true;
  const btn = document.getElementById('aiScheduleBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div> Thinking...';
  }

  try {
    const schedule = await scheduleTasksWithAI();

    // Apply to store
    store.applyAISchedule(schedule);

    // Show schedule view
    setView('schedule');
    showToast(`✨ Scheduled ${schedule.length} tasks!`, 'success');

    // Open schedule modal
    openScheduleModal(schedule);
  } catch (error) {
    showToast(error.message, 'error');
    console.error('AI Schedule error:', error);
  } finally {
    isScheduling = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🤖 AI Schedule';
    }
  }
}

/**
 * Open the schedule results modal with timeline view
 */
function openScheduleModal(schedule) {
  const overlay = document.getElementById('scheduleModalOverlay');
  if (!overlay) return;

  const content = document.getElementById('scheduleTimelineContent');
  if (!content) return;

  if (schedule.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤷</div><div class="empty-state-title">No schedule generated</div></div>';
    overlay.classList.add('active');
    return;
  }

  // Build timeline
  const timelineHtml = schedule.map((item, idx) => {
    const task = store.getTask(item.id);
    if (!task) return '';

    return `
      <div class="timeline-item animate-fade-slide-up" style="animation-delay: ${idx * 0.08}s">
        <div class="timeline-time">${formatDate(item.aiStartTime)}</div>
        <div class="timeline-dot-col">
          <div class="timeline-dot" style="background: ${getPriorityColor(task.priority)}; box-shadow: 0 0 0 2px ${getPriorityColor(task.priority)};"></div>
          ${idx < schedule.length - 1 ? '<div class="timeline-line"></div>' : ''}
        </div>
        <div class="timeline-content">
          <div class="timeline-task-title">${escHtml(task.title)}</div>
          <div class="timeline-task-meta">
            <span>⏱ ${formatDuration(task.estimatedMinutes)}</span>
            <span>→ ${formatDate(item.aiEndTime)}</span>
            <span class="priority-badge ${task.priority}" style="font-size:10px;padding:1px 8px;">${task.priority}</span>
          </div>
          <div class="timeline-task-reason">💡 ${escHtml(item.aiReason || '')}</div>
        </div>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <div class="timeline">
      ${timelineHtml}
    </div>
  `;

  overlay.classList.add('active');
}

/**
 * Close schedule modal
 */
export function closeScheduleModal() {
  const overlay = document.getElementById('scheduleModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

/**
 * Clear AI schedule
 */
export function clearSchedule() {
  store.clearAISchedule();
  renderAll();
  showToast('AI schedule cleared', 'info');
}

function getPriorityColor(priority) {
  const map = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#7c3aed',
    low: '#10b981',
  };
  return map[priority] || '#7c3aed';
}

function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
