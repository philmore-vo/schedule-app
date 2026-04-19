/* ============================================
   TaskFlow AI — Notification Service
   ============================================
   Desktop notifications for:
   - New Moodle tasks imported
   - Deadline reminders: 3 days, 1 day, 8h, 1h
   ============================================ */

import { store } from './store.js';

const THRESHOLDS = [
  { label: '3 ngày', hours: 72, icon: '📅' },
  { label: '1 ngày', hours: 24, icon: '⚠️' },
  { label: '8 tiếng', hours: 8, icon: '🔔' },
  { label: '1 tiếng', hours: 1, icon: '🚨' },
];

let checkInterval = null;

/**
 * Initialize notification service
 */
export function initNotifications() {
  const settings = store.getSettings();
  if (!settings.notificationsEnabled) return;

  // Request permission
  requestPermission();

  // Start checking every 60 seconds
  startDeadlineChecker();
}

/**
 * Request notification permission
 */
async function requestPermission() {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Send a desktop notification
 */
function sendNotification(title, body, tag = '') {
  const settings = store.getSettings();
  if (!settings.notificationsEnabled) return;

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: './assets/icon.png',
      tag: tag, // Prevents duplicate notifications with same tag
      silent: false,
    });

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);

    // Focus app when clicked
    notification.onclick = () => {
      if (window.focus) window.focus();
      notification.close();
    };
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}

/**
 * Notify about new Moodle tasks
 */
export function notifyNewMoodleTasks(count) {
  if (count <= 0) return;
  sendNotification(
    '🎓 Moodle Sync',
    `Đã import ${count} task mới từ Moodle!`,
    'moodle-sync'
  );
}

/**
 * Start the deadline checker interval
 */
export function startDeadlineChecker() {
  if (checkInterval) clearInterval(checkInterval);

  // Check immediately
  checkDeadlines();

  // Then check every 60 seconds
  checkInterval = setInterval(checkDeadlines, 60 * 1000);
}

/**
 * Stop the deadline checker
 */
export function stopDeadlineChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/**
 * Check all tasks for upcoming deadlines and send notifications
 */
function checkDeadlines() {
  const settings = store.getSettings();
  if (!settings.notificationsEnabled) return;

  const tasks = store.getTasks();
  const now = new Date();
  const sentNotifications = getSentNotifications();

  for (const task of tasks) {
    if (task.completed || !task.deadline) continue;

    const deadline = new Date(task.deadline);
    const hoursUntil = (deadline - now) / (1000 * 60 * 60);

    // Skip past deadlines
    if (hoursUntil < 0) continue;

    for (const threshold of THRESHOLDS) {
      const notifKey = `${task.id}_${threshold.hours}h`;

      // Check if we should send this notification
      // Send when hours remaining is less than threshold and notification hasn't been sent
      if (hoursUntil <= threshold.hours && !sentNotifications.has(notifKey)) {
        sendNotification(
          `${threshold.icon} Deadline còn ${threshold.label}!`,
          `"${task.title}" — hạn chót: ${formatDeadline(deadline)}`,
          notifKey
        );

        // Mark as sent
        markNotificationSent(notifKey);
      }
    }
  }
}

/**
 * Get set of sent notification keys
 */
function getSentNotifications() {
  const data = store.getData();
  return new Set(data.sentNotifications || []);
}

/**
 * Mark a notification as sent
 */
function markNotificationSent(key) {
  const data = store.getData();
  if (!data.sentNotifications) data.sentNotifications = [];
  if (!data.sentNotifications.includes(key)) {
    data.sentNotifications.push(key);

    // Clean up old entries (keep only last 500)
    if (data.sentNotifications.length > 500) {
      data.sentNotifications = data.sentNotifications.slice(-300);
    }

    store.setData(data);
  }
}

/**
 * Toggle notifications on/off
 */
export async function toggleNotifications(enabled) {
  store.updateSettings({ notificationsEnabled: enabled });

  if (enabled) {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      store.updateSettings({ notificationsEnabled: false });
      return false;
    }
    startDeadlineChecker();

    // Send a test notification
    sendNotification(
      '🔔 Thông báo đã bật!',
      'Bạn sẽ nhận thông báo trước deadline 3 ngày, 1 ngày, 8 tiếng, và 1 tiếng.',
      'test-notification'
    );
  } else {
    stopDeadlineChecker();
  }

  return enabled;
}

/**
 * Format deadline for notification body
 */
function formatDeadline(date) {
  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
