/* ============================================
   TaskFlow AI — Data Store (Electron File DB)
   ============================================
   Uses IPC to communicate with main process
   which manages a JSON file database on disk.
   Falls back to localStorage for web mode.
   ============================================ */

const IS_ELECTRON = typeof window !== 'undefined' && window.electronAPI;

const DEFAULT_SETTINGS = {
  apiKey: 'AIzaSyCxuXHPtW_4NTjQJ5Utx_mNLzEBhuFEObU',
  apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
  model: 'gemini-2.0-flash',
  workStartHour: 8,
  workEndHour: 22,
  breakMinutes: 15,
  defaultDurationMinutes: 60,
  theme: 'dark',
  // Moodle integration
  moodleUrl: '',
  moodleToken: '',
  moodleAutoSync: false,
  moodleLastSync: null,
  // Notifications
  notificationsEnabled: false,
};

function getDefaultData() {
  return {
    tasks: [],
    settings: { ...DEFAULT_SETTINGS },
    chatHistory: [],
    lastSchedule: null,
    sentNotifications: [],
  };
}

class Store {
  constructor() {
    this._data = getDefaultData();
    this._listeners = [];
    this._saveTimer = null;
    this._ready = false;
    this._readyPromise = this._init();
  }

  async _init() {
    if (IS_ELECTRON) {
      // Load from Electron file database
      try {
        const data = await window.electronAPI.loadData();
        if (data) {
          this._data = data;
          this._data.settings = { ...DEFAULT_SETTINGS, ...this._data.settings };
          if (!this._data.chatHistory) this._data.chatHistory = [];
          if (!this._data.lastSchedule) this._data.lastSchedule = null;
          if (!this._data.tasks) this._data.tasks = [];
        }
        // Always write back to ensure DB file exists on disk
        await window.electronAPI.saveData(this._data);
        const dbPath = await window.electronAPI.getDbPath();
        console.log('📦 Database loaded from:', dbPath);
      } catch (err) {
        console.error('Failed to load from Electron DB:', err);
      }
    } else {
      // Fallback: load from localStorage (web mode)
      try {
        const raw = localStorage.getItem('taskflow_ai_data');
        if (raw) {
          this._data = JSON.parse(raw);
          this._data.settings = { ...DEFAULT_SETTINGS, ...this._data.settings };
          if (!this._data.chatHistory) this._data.chatHistory = [];
          if (!this._data.lastSchedule) this._data.lastSchedule = null;
        }
        console.log('📦 Database loaded from localStorage');
      } catch (err) {
        console.error('Failed to load from localStorage:', err);
      }
    }
    this._ready = true;
    this._notify();
  }

  /**
   * Wait until the store is initialized (async DB load complete)
   */
  whenReady() {
    return this._readyPromise;
  }

  /**
   * Save data - debounced to avoid excessive disk writes
   */
  _save() {
    // Debounce saves — write at most once every 300ms
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persistData(), 300);
    this._notify();
  }

  async _persistData() {
    if (IS_ELECTRON) {
      try {
        await window.electronAPI.saveData(this._data);
      } catch (err) {
        console.error('Failed to save to Electron DB:', err);
      }
    } else {
      try {
        localStorage.setItem('taskflow_ai_data', JSON.stringify(this._data));
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
    }
  }

  /**
   * Force immediate save (call before app close, etc.)
   */
  async flush() {
    clearTimeout(this._saveTimer);
    await this._persistData();
  }

  /**
   * Subscribe to data changes
   */
  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  _notify() {
    this._listeners.forEach(fn => fn(this._data));
  }

  /* ── Raw Data Access (for notification service) ── */

  getData() {
    return this._data;
  }

  setData(data) {
    this._data = data;
    this._save();
  }

  /* ── Tasks ── */

  getTasks() {
    return this._data.tasks;
  }

  getTask(id) {
    return this._data.tasks.find(t => t.id === id) || null;
  }

  addTask(task) {
    this._data.tasks.unshift(task);
    this._save();
    return task;
  }

  updateTask(id, updates) {
    const idx = this._data.tasks.findIndex(t => t.id === id);
    if (idx >= 0) {
      this._data.tasks[idx] = { ...this._data.tasks[idx], ...updates };
      this._save();
      return this._data.tasks[idx];
    }
    return null;
  }

  deleteTask(id) {
    this._data.tasks = this._data.tasks.filter(t => t.id !== id);
    this._save();
  }

  toggleTaskComplete(id) {
    const task = this.getTask(id);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      this._save();
    }
    return task;
  }

  toggleSubtask(taskId, subtaskId) {
    const task = this.getTask(taskId);
    if (task && task.subtasks) {
      const sub = task.subtasks.find(s => s.id === subtaskId);
      if (sub) {
        sub.completed = !sub.completed;
        this._save();
      }
    }
    return task;
  }

  reorderTasks(orderedIds) {
    const map = new Map(this._data.tasks.map(t => [t.id, t]));
    this._data.tasks = orderedIds.map(id => map.get(id)).filter(Boolean);
    const remaining = this._data.tasks.filter(t => !orderedIds.includes(t.id));
    this._data.tasks.push(...remaining);
    this._save();
  }

  applyAISchedule(schedule) {
    schedule.forEach(item => {
      this.updateTask(item.id, {
        aiPriority: item.aiPriority,
        aiStartTime: item.aiStartTime,
        aiEndTime: item.aiEndTime,
        aiReason: item.aiReason,
      });
    });
    this._data.lastSchedule = {
      generatedAt: new Date().toISOString(),
      items: schedule,
    };
    this._save();
  }

  clearAISchedule() {
    this._data.tasks.forEach(t => {
      t.aiPriority = null;
      t.aiStartTime = null;
      t.aiEndTime = null;
      t.aiReason = null;
    });
    this._data.lastSchedule = null;
    this._save();
  }

  /* ── Settings ── */

  getSettings() {
    return this._data.settings;
  }

  updateSettings(updates) {
    this._data.settings = { ...this._data.settings, ...updates };
    this._save();
    return this._data.settings;
  }

  /* ── Chat ── */

  getChatHistory() {
    return this._data.chatHistory;
  }

  addChatMessage(message) {
    this._data.chatHistory.push(message);
    if (this._data.chatHistory.length > 100) {
      this._data.chatHistory = this._data.chatHistory.slice(-100);
    }
    this._save();
  }

  clearChatHistory() {
    this._data.chatHistory = [];
    this._save();
  }

  getLastSchedule() {
    return this._data.lastSchedule;
  }
}

// Singleton
export const store = new Store();
