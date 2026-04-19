/* ============================================
   TaskFlow AI — Task Manager
   ============================================ */

import { store } from './store.js';
import { generateId, getDeadlineStatus, isToday, isWithinDays } from './utils.js';

/**
 * Create a new task object
 */
export function createTask({
  title,
  description = '',
  deadline = '',
  estimatedMinutes = 60,
  category = 'other',
  priority = 'medium',
  subtasks = [],
}) {
  const task = {
    id: generateId(),
    title: title.trim(),
    description: description.trim(),
    deadline: deadline || null,
    estimatedMinutes: parseInt(estimatedMinutes, 10) || 60,
    category,
    priority,
    subtasks: subtasks.map(s => ({
      id: generateId(),
      title: s.trim ? s.trim() : s.title,
      completed: false,
    })).filter(s => s.title),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    aiPriority: null,
    aiStartTime: null,
    aiEndTime: null,
    aiReason: null,
  };
  return store.addTask(task);
}

/**
 * Update an existing task
 */
export function updateTask(id, updates) {
  return store.updateTask(id, updates);
}

/**
 * Delete a task
 */
export function deleteTask(id) {
  store.deleteTask(id);
}

/**
 * Toggle task completion
 */
export function toggleTask(id) {
  return store.toggleTaskComplete(id);
}

/**
 * Toggle subtask completion
 */
export function toggleSubtask(taskId, subtaskId) {
  return store.toggleSubtask(taskId, subtaskId);
}

/**
 * Add a subtask to existing task
 */
export function addSubtask(taskId, title) {
  const task = store.getTask(taskId);
  if (task) {
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({
      id: generateId(),
      title: title.trim(),
      completed: false,
    });
    store.updateTask(taskId, { subtasks: task.subtasks });
  }
  return task;
}

/**
 * Get all tasks sorted by various criteria
 */
export function getAllTasks() {
  return store.getTasks();
}

/**
 * Get filtered tasks based on current view
 */
export function getFilteredTasks(view = 'all') {
  const tasks = store.getTasks();

  switch (view) {
    case 'today':
      return tasks.filter(t =>
        !t.completed && t.deadline && isToday(t.deadline)
      );

    case 'upcoming':
      return tasks.filter(t =>
        !t.completed && t.deadline && isWithinDays(t.deadline, 7) && !isToday(t.deadline)
      );

    case 'overdue':
      return tasks.filter(t =>
        !t.completed && t.deadline && getDeadlineStatus(t.deadline) === 'overdue'
      );

    case 'completed':
      return tasks.filter(t => t.completed);

    case 'schedule':
      return tasks
        .filter(t => !t.completed && t.aiPriority !== null)
        .sort((a, b) => (a.aiPriority || 999) - (b.aiPriority || 999));

    case 'all':
    default:
      return tasks.filter(t => !t.completed);
  }
}

/**
 * Get task statistics for the footer
 */
export function getTaskStats() {
  const tasks = store.getTasks();
  const active = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  const overdue = active.filter(t =>
    t.deadline && getDeadlineStatus(t.deadline) === 'overdue'
  );
  const todayTasks = active.filter(t =>
    t.deadline && isToday(t.deadline)
  );
  const totalEstimatedMinutes = active.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 0), 0
  );

  return {
    total: tasks.length,
    active: active.length,
    completed: completed.length,
    overdue: overdue.length,
    today: todayTasks.length,
    totalEstimatedMinutes,
  };
}

/**
 * Sort tasks by a field
 */
export function sortTasks(tasks, sortBy = 'deadline') {
  const sorted = [...tasks];

  switch (sortBy) {
    case 'deadline':
      sorted.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
      break;

    case 'priority':
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      sorted.sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2));
      break;

    case 'ai':
      sorted.sort((a, b) => (a.aiPriority || 999) - (b.aiPriority || 999));
      break;

    case 'created':
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;

    case 'duration':
      sorted.sort((a, b) => (a.estimatedMinutes || 0) - (b.estimatedMinutes || 0));
      break;
  }

  return sorted;
}

/**
 * Get incomplete tasks formatted for AI context
 */
export function getTasksForAIContext() {
  const tasks = store.getTasks().filter(t => !t.completed);
  return tasks.map(t => {
    // Convert UTC ISO to local timezone string so AI reads correct times
    let deadlineLocal = 'No deadline';
    if (t.deadline) {
      const d = new Date(t.deadline);
      deadlineLocal = d.toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    }

    const createdLocal = new Date(t.createdAt).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });

    return {
      id: t.id,
      title: t.title,
      description: t.description || '',
      deadline: deadlineLocal,
      estimatedMinutes: t.estimatedMinutes,
      category: t.category,
      priority: t.priority,
      subtaskCount: (t.subtasks || []).length,
      subtasksCompleted: (t.subtasks || []).filter(s => s.completed).length,
      createdAt: createdLocal,
    };
  });
}
