/* ============================================
   TaskFlow AI — Utility Functions
   ============================================ */

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Format a date relative to now.
 * "in 2 hours", "overdue 3 days", "tomorrow", etc.
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date - now;
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < -1440) return `Overdue ${Math.abs(diffDays)}d`;
  if (diffMins < -60) return `Overdue ${Math.abs(diffHours)}h`;
  if (diffMins < 0) return `Overdue ${Math.abs(diffMins)}m`;
  if (diffMins < 1) return 'Due now';
  if (diffMins < 60) return `${diffMins}m left`;
  if (diffHours < 24) return `${diffHours}h left`;
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `${diffDays} days left`;
  return formatDate(dateString);
}

/**
 * Get deadline status class
 */
export function getDeadlineStatus(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date - now;
  const diffHours = diffMs / 3600000;

  if (diffHours < 0) return 'overdue';
  if (diffHours < 24) return 'urgent';
  return '';
}

/**
 * Format date to readable string: "Apr 19, 2:30 PM"
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date to short: "Apr 19"
 */
export function formatDateShort(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time: "2:30 PM"
 */
export function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format duration in minutes to readable: "1h 30m"
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Get start of today (midnight)
 */
export function getStartOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of today (23:59:59)
 */
export function getEndOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Check if a date is today
 */
export function isToday(dateString) {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/**
 * Check if a date is within the next N days
 */
export function isWithinDays(dateString, days) {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + days);
  return d >= now && d <= target;
}

/**
 * Simple markdown to HTML converter (for AI responses)
 */
export function markdownToHtml(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline code: `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Headers: ### text
  html = html.replace(/^### (.*$)/gm, '<strong>$1</strong>');
  html = html.replace(/^## (.*$)/gm, '<strong>$1</strong>');
  html = html.replace(/^# (.*$)/gm, '<strong>$1</strong>');

  // Unordered lists: - item
  html = html.replace(/^[\-\*] (.*$)/gm, '• $1');

  // Numbered lists: 1. item (keep as-is, just add structure)
  html = html.replace(/^\d+\. (.*$)/gm, '  $1');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Get category emoji
 */
export function getCategoryEmoji(category) {
  const map = {
    work: '💼',
    personal: '🏠',
    study: '📚',
    health: '💪',
    finance: '💰',
    other: '📌',
  };
  return map[category] || '📌';
}

/**
 * Get priority label
 */
export function getPriorityLabel(priority) {
  const map = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return map[priority] || 'Medium';
}

/**
 * Get current ISO datetime string for local timezone (for input default)
 */
export function getLocalISOString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
