/* ============================================
   TaskFlow AI — Preload Script (IPC Bridge)
   ============================================ */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  loadData: () => ipcRenderer.invoke('db:load'),
  saveData: (data) => ipcRenderer.invoke('db:save', data),
  getDbPath: () => ipcRenderer.invoke('db:getPath'),
  exportData: () => ipcRenderer.invoke('db:export'),
  importData: (json) => ipcRenderer.invoke('db:import', json),
  resetData: () => ipcRenderer.invoke('db:reset'),

  // Moodle API (via main process to avoid CORS)
  moodleCall: (opts) => ipcRenderer.invoke('moodle:call', opts),
});
