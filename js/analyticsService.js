/* ============================================
   TaskFlow AI — Analytics Service
   ============================================
   Productivity analytics & data visualization
   for self-assessment and performance tracking.
   ============================================ */

import { store } from './store.js';

/**
 * Compute comprehensive analytics from task data
 */
export function computeAnalytics() {
  const tasks = store.getTasks();
  const now = new Date();

  const completed = tasks.filter(t => t.completed);
  const active = tasks.filter(t => !t.completed);
  const overdue = active.filter(t => t.deadline && new Date(t.deadline) < now);

  return {
    overview: computeOverview(tasks, completed, active, overdue),
    completionTrend: computeCompletionTrend(completed, 14),
    categoryBreakdown: computeCategoryBreakdown(tasks, completed),
    priorityBreakdown: computePriorityBreakdown(tasks, completed),
    deadlineAdherence: computeDeadlineAdherence(completed),
    timeAnalysis: computeTimeAnalysis(completed),
    productivityScore: computeProductivityScore(tasks, completed, overdue),
    streaks: computeStreaks(completed),
    weekdayAnalysis: computeWeekdayAnalysis(completed),
  };
}

/* ── Overview Stats ── */

function computeOverview(tasks, completed, active, overdue) {
  const totalMinutes = completed.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
  const avgCompletionTime = completed.length > 0
    ? completed
        .filter(t => t.completedAt && t.createdAt)
        .reduce((sum, t) => {
          const hours = (new Date(t.completedAt) - new Date(t.createdAt)) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) / Math.max(completed.filter(t => t.completedAt && t.createdAt).length, 1)
    : 0;

  return {
    total: tasks.length,
    completed: completed.length,
    active: active.length,
    overdue: overdue.length,
    completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,
    totalMinutesCompleted: totalMinutes,
    avgCompletionHours: Math.round(avgCompletionTime * 10) / 10,
  };
}

/* ── Completion Trend (last N days) ── */

function computeCompletionTrend(completed, days) {
  const now = new Date();
  const trend = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = completed.filter(t => {
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d >= date && d < nextDate;
    }).length;

    trend.push({
      date: date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' }),
      dayShort: date.toLocaleDateString('vi-VN', { weekday: 'narrow' }),
      count,
      isToday: i === 0,
    });
  }

  const maxCount = Math.max(...trend.map(t => t.count), 1);
  trend.forEach(t => t.percentage = (t.count / maxCount) * 100);

  return trend;
}

/* ── Category Breakdown ── */

function computeCategoryBreakdown(tasks, completed) {
  const categories = ['work', 'personal', 'study', 'health', 'finance', 'other'];
  const colors = {
    work: '#6366f1',
    personal: '#8b5cf6',
    study: '#3b82f6',
    health: '#10b981',
    finance: '#f59e0b',
    other: '#64748b',
  };
  const emojis = {
    work: '💼', personal: '🏠', study: '📚',
    health: '🏃', finance: '💰', other: '📌',
  };

  return categories.map(cat => {
    const total = tasks.filter(t => t.category === cat).length;
    const done = completed.filter(t => t.category === cat).length;
    return {
      name: cat,
      emoji: emojis[cat] || '📌',
      color: colors[cat],
      total,
      completed: done,
      rate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }).filter(c => c.total > 0);
}

/* ── Priority Breakdown ── */

function computePriorityBreakdown(tasks, completed) {
  const priorities = ['critical', 'high', 'medium', 'low'];
  const colors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
  const labels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

  return priorities.map(pri => {
    const total = tasks.filter(t => t.priority === pri).length;
    const done = completed.filter(t => t.priority === pri).length;
    return {
      name: pri,
      label: labels[pri],
      color: colors[pri],
      total,
      completed: done,
      rate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }).filter(p => p.total > 0);
}

/* ── Deadline Adherence ── */

function computeDeadlineAdherence(completed) {
  const withDeadline = completed.filter(t => t.deadline && t.completedAt);

  let onTime = 0;
  let late = 0;
  let totalHoursEarly = 0;
  let totalHoursLate = 0;

  withDeadline.forEach(t => {
    const deadline = new Date(t.deadline);
    const completedAt = new Date(t.completedAt);
    const diffHours = (deadline - completedAt) / (1000 * 60 * 60);

    if (diffHours >= 0) {
      onTime++;
      totalHoursEarly += diffHours;
    } else {
      late++;
      totalHoursLate += Math.abs(diffHours);
    }
  });

  return {
    total: withDeadline.length,
    onTime,
    late,
    onTimeRate: withDeadline.length > 0 ? Math.round((onTime / withDeadline.length) * 100) : 100,
    avgHoursEarly: onTime > 0 ? Math.round(totalHoursEarly / onTime) : 0,
    avgHoursLate: late > 0 ? Math.round(totalHoursLate / late) : 0,
  };
}

/* ── Time Analysis ── */

function computeTimeAnalysis(completed) {
  const now = new Date();

  // Tasks completed today
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const todayTasks = completed.filter(t => t.completedAt && new Date(t.completedAt) >= today);

  // This week (Mon-Sun)
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekTasks = completed.filter(t => t.completedAt && new Date(t.completedAt) >= weekStart);

  // This month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTasks = completed.filter(t => t.completedAt && new Date(t.completedAt) >= monthStart);

  return {
    today: { count: todayTasks.length, minutes: todayTasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0) },
    week: { count: weekTasks.length, minutes: weekTasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0) },
    month: { count: monthTasks.length, minutes: monthTasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0) },
  };
}

/* ── Productivity Score (0-100) ── */

function computeProductivityScore(tasks, completed, overdue) {
  if (tasks.length === 0) return { score: 0, grade: '—', color: '#64748b' };

  // Factors:
  // 1. Completion rate (40%)
  const completionRate = completed.length / tasks.length;

  // 2. Deadline adherence (30%)
  const withDeadline = completed.filter(t => t.deadline && t.completedAt);
  const onTimeRate = withDeadline.length > 0
    ? withDeadline.filter(t => new Date(t.completedAt) <= new Date(t.deadline)).length / withDeadline.length
    : 1;

  // 3. Overdue penalty (20%)
  const active = tasks.filter(t => !t.completed);
  const overdueRate = active.length > 0 ? 1 - (overdue.length / active.length) : 1;

  // 4. Consistency bonus (10%) — based on recent activity
  const recentDays = 7;
  const now = new Date();
  const recentCompleted = completed.filter(t => {
    if (!t.completedAt) return false;
    const d = new Date(t.completedAt);
    return (now - d) / (1000 * 60 * 60 * 24) <= recentDays;
  });
  const daysWithActivity = new Set(recentCompleted.map(t =>
    new Date(t.completedAt).toDateString()
  )).size;
  const consistencyRate = Math.min(daysWithActivity / recentDays, 1);

  const score = Math.round(
    (completionRate * 40) +
    (onTimeRate * 30) +
    (overdueRate * 20) +
    (consistencyRate * 10)
  );

  const { grade, color } = getGrade(score);

  return { score, grade, color };
}

function getGrade(score) {
  if (score >= 90) return { grade: 'A+', color: '#10b981' };
  if (score >= 80) return { grade: 'A', color: '#22c55e' };
  if (score >= 70) return { grade: 'B+', color: '#84cc16' };
  if (score >= 60) return { grade: 'B', color: '#eab308' };
  if (score >= 50) return { grade: 'C', color: '#f97316' };
  if (score >= 40) return { grade: 'D', color: '#ef4444' };
  return { grade: 'F', color: '#dc2626' };
}

/* ── Streaks ── */

function computeStreaks(completed) {
  if (completed.length === 0) return { current: 0, best: 0 };

  // Get unique days with completions
  const days = [...new Set(
    completed
      .filter(t => t.completedAt)
      .map(t => new Date(t.completedAt).toDateString())
  )].sort((a, b) => new Date(a) - new Date(b));

  if (days.length === 0) return { current: 0, best: 0 };

  let currentStreak = 1;
  let bestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  // Check if current streak is active (includes today or yesterday)
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const lastDay = days[days.length - 1];

  if (lastDay === today || lastDay === yesterday) {
    currentStreak = tempStreak;
  } else {
    currentStreak = 0;
  }

  return { current: currentStreak, best: bestStreak };
}

/* ── Weekday Analysis ── */

function computeWeekdayAnalysis(completed) {
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const counts = new Array(7).fill(0);

  completed
    .filter(t => t.completedAt)
    .forEach(t => {
      const day = new Date(t.completedAt).getDay();
      counts[day]++;
    });

  const maxCount = Math.max(...counts, 1);
  const bestDay = counts.indexOf(Math.max(...counts));

  return days.map((name, i) => ({
    name,
    count: counts[i],
    percentage: (counts[i] / maxCount) * 100,
    isBest: i === bestDay && counts[i] > 0,
  }));
}

/* ── Render Analytics Dashboard ── */

export function renderAnalyticsDashboard() {
  const container = document.getElementById('taskListContainer');
  if (!container) return;

  const data = computeAnalytics();
  const { overview, productivityScore, streaks, completionTrend, categoryBreakdown,
          priorityBreakdown, deadlineAdherence, timeAnalysis, weekdayAnalysis } = data;

  container.innerHTML = `
    <div class="analytics-dashboard">

      <!-- Productivity Score Hero -->
      <div class="analytics-hero">
        <div class="score-circle" style="--score-color: ${productivityScore.color}; --score-pct: ${productivityScore.score}%">
          <div class="score-inner">
            <span class="score-value">${productivityScore.score}</span>
            <span class="score-grade">${productivityScore.grade}</span>
          </div>
        </div>
        <div class="score-info">
          <h3>Điểm năng suất</h3>
          <p>Dựa trên: hoàn thành (40%), đúng hạn (30%), không trễ (20%), đều đặn (10%)</p>
        </div>
      </div>

      <!-- Key Metrics Row -->
      <div class="analytics-metrics-row">
        <div class="metric-card">
          <div class="metric-icon">📊</div>
          <div class="metric-value">${overview.completionRate}%</div>
          <div class="metric-label">Tỷ lệ hoàn thành</div>
          <div class="metric-sub">${overview.completed}/${overview.total} tasks</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">🔥</div>
          <div class="metric-value">${streaks.current}</div>
          <div class="metric-label">Chuỗi ngày liên tiếp</div>
          <div class="metric-sub">Kỷ lục: ${streaks.best} ngày</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">⏱</div>
          <div class="metric-value">${formatDuration(overview.totalMinutesCompleted)}</div>
          <div class="metric-label">Tổng thời gian</div>
          <div class="metric-sub">TB: ${overview.avgCompletionHours}h/task</div>
        </div>
        <div class="metric-card ${overview.overdue > 0 ? 'warning' : ''}">
          <div class="metric-icon">${overview.overdue > 0 ? '⚠️' : '✅'}</div>
          <div class="metric-value">${overview.overdue}</div>
          <div class="metric-label">Quá hạn</div>
          <div class="metric-sub">${overview.active} đang làm</div>
        </div>
      </div>

      <!-- Time Period Stats -->
      <div class="analytics-card">
        <h3>📅 Thống kê theo thời gian</h3>
        <div class="time-stats-row">
          <div class="time-stat">
            <div class="time-stat-count">${timeAnalysis.today.count}</div>
            <div class="time-stat-label">Hôm nay</div>
            <div class="time-stat-sub">${formatDuration(timeAnalysis.today.minutes)}</div>
          </div>
          <div class="time-stat-divider"></div>
          <div class="time-stat">
            <div class="time-stat-count">${timeAnalysis.week.count}</div>
            <div class="time-stat-label">Tuần này</div>
            <div class="time-stat-sub">${formatDuration(timeAnalysis.week.minutes)}</div>
          </div>
          <div class="time-stat-divider"></div>
          <div class="time-stat">
            <div class="time-stat-count">${timeAnalysis.month.count}</div>
            <div class="time-stat-label">Tháng này</div>
            <div class="time-stat-sub">${formatDuration(timeAnalysis.month.minutes)}</div>
          </div>
        </div>
      </div>

      <!-- Completion Trend Chart -->
      <div class="analytics-card">
        <h3>📈 Xu hướng hoàn thành (14 ngày)</h3>
        <div class="trend-chart">
          ${completionTrend.map(d => `
            <div class="trend-bar-wrapper">
              <div class="trend-count">${d.count || ''}</div>
              <div class="trend-bar ${d.isToday ? 'today' : ''}" style="height: ${Math.max(d.percentage, 4)}%"></div>
              <div class="trend-label ${d.isToday ? 'today' : ''}">${d.dayShort}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Weekday Analysis -->
      <div class="analytics-card">
        <h3>📊 Phân tích theo ngày trong tuần</h3>
        <div class="weekday-chart">
          ${weekdayAnalysis.map(d => `
            <div class="weekday-bar-wrapper">
              <div class="weekday-label ${d.isBest ? 'best' : ''}">${d.name}</div>
              <div class="weekday-track">
                <div class="weekday-fill ${d.isBest ? 'best' : ''}" style="width: ${Math.max(d.percentage, 2)}%"></div>
              </div>
              <div class="weekday-count">${d.count}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Two column: Category + Priority -->
      <div class="analytics-two-col">
        <div class="analytics-card">
          <h3>🏷️ Phân loại</h3>
          <div class="breakdown-list">
            ${categoryBreakdown.length > 0 ? categoryBreakdown.map(c => `
              <div class="breakdown-item">
                <div class="breakdown-header">
                  <span>${c.emoji} ${c.name}</span>
                  <span class="breakdown-rate">${c.rate}%</span>
                </div>
                <div class="breakdown-bar-track">
                  <div class="breakdown-bar-fill" style="width: ${c.rate}%; background: ${c.color}"></div>
                </div>
                <div class="breakdown-detail">${c.completed}/${c.total} hoàn thành</div>
              </div>
            `).join('') : '<div class="empty-state-text">Chưa có dữ liệu</div>'}
          </div>
        </div>

        <div class="analytics-card">
          <h3>🚦 Mức ưu tiên</h3>
          <div class="breakdown-list">
            ${priorityBreakdown.length > 0 ? priorityBreakdown.map(p => `
              <div class="breakdown-item">
                <div class="breakdown-header">
                  <span style="color:${p.color}">● ${p.label}</span>
                  <span class="breakdown-rate">${p.rate}%</span>
                </div>
                <div class="breakdown-bar-track">
                  <div class="breakdown-bar-fill" style="width: ${p.rate}%; background: ${p.color}"></div>
                </div>
                <div class="breakdown-detail">${p.completed}/${p.total} hoàn thành</div>
              </div>
            `).join('') : '<div class="empty-state-text">Chưa có dữ liệu</div>'}
          </div>
        </div>
      </div>

      <!-- Deadline Adherence -->
      <div class="analytics-card">
        <h3>⏰ Deadline Performance</h3>
        <div class="deadline-stats">
          <div class="deadline-donut">
            <svg viewBox="0 0 36 36" class="donut-svg">
              <path class="donut-ring" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="donut-segment" stroke="#10b981" stroke-dasharray="${deadlineAdherence.onTimeRate}, 100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <text x="18" y="19.5" class="donut-text">${deadlineAdherence.onTimeRate}%</text>
            </svg>
            <div class="donut-label">Đúng hạn</div>
          </div>
          <div class="deadline-details">
            <div class="deadline-detail-item">
              <span class="dot green"></span>
              <span>Đúng hạn: <strong>${deadlineAdherence.onTime}</strong></span>
              ${deadlineAdherence.avgHoursEarly > 0 ? `<span class="sub">TB sớm ${deadlineAdherence.avgHoursEarly}h</span>` : ''}
            </div>
            <div class="deadline-detail-item">
              <span class="dot red"></span>
              <span>Trễ hạn: <strong>${deadlineAdherence.late}</strong></span>
              ${deadlineAdherence.avgHoursLate > 0 ? `<span class="sub">TB trễ ${deadlineAdherence.avgHoursLate}h</span>` : ''}
            </div>
            <div class="deadline-detail-item total">
              <span>Tổng có deadline: <strong>${deadlineAdherence.total}</strong></span>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;
}

function formatDuration(mins) {
  if (!mins || mins === 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}
