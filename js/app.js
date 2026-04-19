/* ============================================
   TaskFlow AI — Main App
   ============================================ */

import { store } from './store.js';
import {
  renderAll, setView, setSort, openTaskModal, closeTaskModal,
  submitTaskForm, openSettingsModal, closeSettingsModal, saveSettings,
  toggleTheme, toggleChatPanel, showToast, appendSubtaskInput,
} from './uiRenderer.js';
import { toggleTask as doToggleTask, deleteTask as doDeleteTask } from './taskManager.js';
import { initChatPanel, sendMessage, clearChat } from './chatPanel.js';
import { runAISchedule, closeScheduleModal, clearSchedule } from './scheduler.js';
import { syncMoodle, testMoodleConnection, initMoodle } from './moodleService.js';
import { initNotifications, toggleNotifications } from './notificationService.js';

class App {
  constructor() {
    this.init();
  }

  async init() {
    // Wait for database to load
    await store.whenReady();

    // Apply saved theme
    const settings = store.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) themeBtn.textContent = settings.theme === 'light' ? '☀️' : '🌙';

    // Show DB location in footer if Electron
    if (window.electronAPI) {
      try {
        const dbPath = await window.electronAPI.getDbPath();
        const footerInfo = document.querySelector('.app-footer .footer-info');
        if (footerInfo) {
          footerInfo.textContent = `💾 ${dbPath}`;
        }
        console.log('📦 Data stored at:', dbPath);
      } catch (e) {}
    }

    // Initial render
    renderAll();
    initChatPanel();
    initMoodle();
    initNotifications();

    // Subscribe to data changes
    store.subscribe(() => {
      renderAll();
    });

    // Setup keyboard shortcuts
    this.setupKeyboard();

    // Save before window closes
    window.addEventListener('beforeunload', () => {
      store.flush();
    });

    console.log('🚀 TaskFlow AI initialized');
    showToast('TaskFlow AI ready!', 'info');
  }

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+N: New task
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openTaskModal();
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        closeTaskModal();
        closeSettingsModal();
        closeScheduleModal();
      }
      // Ctrl+Shift+A: AI Schedule
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        runAISchedule();
      }
    });
  }

  // ── Public API (accessible from HTML onclick) ──

  openTaskModal(id = null) { openTaskModal(id); }
  closeTaskModal() { closeTaskModal(); }
  submitTaskForm() { submitTaskForm(); }
  editTask(id) { openTaskModal(id); }

  deleteTask(id) {
    if (confirm('Delete this task?')) {
      doDeleteTask(id);
      renderAll();
      showToast('Task deleted', 'info');
    }
  }

  toggleTask(id) {
    const task = doToggleTask(id);
    renderAll();
    if (task?.completed) {
      showToast('✅ Task completed!', 'success');
    }
  }

  setView(view) { setView(view); }
  setSort(sort) { setSort(sort); }

  openSettings() { openSettingsModal(); }
  closeSettings() { closeSettingsModal(); }
  saveSettings() { saveSettings(); }
  toggleTheme() { toggleTheme(); }
  toggleChat() { toggleChatPanel(); }

  addSubtaskInput() { appendSubtaskInput(); }

  aiSchedule() { runAISchedule(); }
  closeSchedule() { closeScheduleModal(); }
  clearSchedule() { clearSchedule(); }

  // Chat
  sendChat() { sendMessage(); }
  quickChat(text) { sendMessage(text); }
  clearChat() {
    if (confirm('Clear chat history?')) {
      clearChat();
    }
  }

  // Moodle
  syncMoodle() { syncMoodle(); }

  async testMoodle() {
    const resultEl = document.getElementById('moodleTestResult');
    if (resultEl) resultEl.innerHTML = '⏳ Đang test...';

    // Temporarily set moodle settings from form for testing
    const url = document.getElementById('settingMoodleUrl')?.value?.trim();
    const token = document.getElementById('settingMoodleToken')?.value?.trim();
    if (!url || !token) {
      if (resultEl) resultEl.innerHTML = '❌ Vui lòng nhập Moodle URL và Token';
      return;
    }

    // Temporarily save for testing
    const oldSettings = store.getSettings();
    store.updateSettings({ moodleUrl: url, moodleToken: token });

    const result = await testMoodleConnection();
    if (result.success) {
      if (resultEl) resultEl.innerHTML = `✅ Kết nối thành công! Site: <strong>${result.siteName}</strong> | User: <strong>${result.userName}</strong>`;
    } else {
      if (resultEl) resultEl.innerHTML = `❌ Lỗi: ${result.error}`;
      // Restore old settings if test failed
      store.updateSettings({ moodleUrl: oldSettings.moodleUrl, moodleToken: oldSettings.moodleToken });
    }
  }

  showMoodleHelp() {
    const helpText = `📖 Hướng dẫn lấy Moodle Token:\n\n` +
      `1. Đăng nhập vào trang Moodle của trường\n` +
      `2. Vào Profile (hồ sơ) > Preferences (cài đặt)\n` +
      `3. Tìm mục "Security Keys" hoặc "Web Services"\n` +
      `4. Copy token và paste vào đây\n\n` +
      `Hoặc nhờ admin tạo token tại:\n` +
      `Site Admin > Plugins > Web Services > Manage Tokens\n\n` +
      `Moodle URL là địa chỉ trang Moodle, ví dụ:\n` +
      `https://moodle.truonghoc.edu.vn`;
    alert(helpText);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
