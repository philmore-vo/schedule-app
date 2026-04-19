/* ============================================
   TaskFlow AI — Electron Main Process
   ============================================ */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Database file path ──
const DB_DIR = path.join(app.getPath('userData'), 'taskflow-db');
const DB_FILE = path.join(DB_DIR, 'data.json');
const DB_BACKUP = path.join(DB_DIR, 'data.backup.json');

// ── Default data structure ──
const DEFAULT_DATA = {
  tasks: [],
  settings: {
    apiKey: 'AIzaSyCxuXHPtW_4NTjQJ5Utx_mNLzEBhuFEObU',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    workStartHour: 8,
    workEndHour: 22,
    breakMinutes: 15,
    defaultDurationMinutes: 60,
    theme: 'dark',
  },
  chatHistory: [],
  lastSchedule: null,
};

let mainWindow = null;

/* ══════════════════════════════════════════════
   DATABASE OPERATIONS (JSON file)
   ══════════════════════════════════════════════ */

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function loadDatabase() {
  ensureDbDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      // Merge defaults for any missing keys
      data.settings = { ...DEFAULT_DATA.settings, ...data.settings };
      if (!data.chatHistory) data.chatHistory = [];
      if (!data.lastSchedule) data.lastSchedule = null;
      if (!data.tasks) data.tasks = [];
      return data;
    }
  } catch (err) {
    console.error('Failed to load database, trying backup:', err.message);
    // Try backup
    try {
      if (fs.existsSync(DB_BACKUP)) {
        const raw = fs.readFileSync(DB_BACKUP, 'utf-8');
        const data = JSON.parse(raw);
        data.settings = { ...DEFAULT_DATA.settings, ...data.settings };
        console.log('Restored from backup successfully');
        return data;
      }
    } catch (backupErr) {
      console.error('Backup also failed:', backupErr.message);
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveDatabase(data) {
  ensureDbDir();
  try {
    const json = JSON.stringify(data, null, 2);
    // Atomic write: write to temp file, then rename
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, json, 'utf-8');
    // Backup current file before overwriting
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, DB_BACKUP);
    }
    fs.renameSync(tmpFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save database:', err.message);
    return false;
  }
}

/* ══════════════════════════════════════════════
   IPC HANDLERS
   ══════════════════════════════════════════════ */

function setupIPC() {
  // Load all data
  ipcMain.handle('db:load', () => {
    return loadDatabase();
  });

  // Save all data
  ipcMain.handle('db:save', (event, data) => {
    return saveDatabase(data);
  });

  // Get database path (for user info)
  ipcMain.handle('db:getPath', () => {
    return DB_FILE;
  });

  // Export data
  ipcMain.handle('db:export', () => {
    const data = loadDatabase();
    return JSON.stringify(data, null, 2);
  });

  // Import data
  ipcMain.handle('db:import', (event, jsonStr) => {
    try {
      const data = JSON.parse(jsonStr);
      return saveDatabase(data);
    } catch (err) {
      console.error('Import failed:', err.message);
      return false;
    }
  });

  // Reset data
  ipcMain.handle('db:reset', () => {
    const data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    return saveDatabase(data);
  });

  /* ── Moodle API (via main process to avoid CORS) ── */

  ipcMain.handle('moodle:call', async (event, { siteUrl, token, wsfunction, params }) => {
    return new Promise((resolve) => {
      const https = require('https');
      const http = require('http');

      // Build query string
      const queryParams = new URLSearchParams({
        wstoken: token,
        wsfunction: wsfunction,
        moodlewsrestformat: 'json',
        ...flattenParams(params || {}),
      });

      const url = `${siteUrl.replace(/\/+$/, '')}/webservice/rest/server.php?${queryParams.toString()}`;
      const protocol = url.startsWith('https') ? https : http;

      const req = protocol.get(url, { timeout: 15000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.exception || parsed.errorcode) {
              resolve({ __error: parsed.message || parsed.errorcode, code: parsed.errorcode });
            } else {
              resolve(parsed);
            }
          } catch (e) {
            resolve({ __error: 'Invalid response from Moodle server' });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ __error: `Connection failed: ${err.message}` });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ __error: 'Connection timed out. Check your Moodle URL.' });
      });
    });
  });
}

/**
 * Flatten nested params for Moodle API (e.g., options[timestart] → options%5Btimestart%5D)
 */
function flattenParams(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenParams(obj[key], fullKey));
    } else if (Array.isArray(obj[key])) {
      obj[key].forEach((item, idx) => {
        if (typeof item === 'object') {
          Object.assign(result, flattenParams(item, `${fullKey}[${idx}]`));
        } else {
          result[`${fullKey}[${idx}]`] = item;
        }
      });
    } else {
      result[fullKey] = obj[key];
    }
  }
  return result;
}

/* ══════════════════════════════════════════════
   WINDOW CREATION
   ══════════════════════════════════════════════ */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'TaskFlow AI',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#07070d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'default',
    show: false,
  });

  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ══════════════════════════════════════════════
   APP LIFECYCLE
   ══════════════════════════════════════════════ */

app.whenReady().then(() => {
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Log database location on startup
app.on('ready', () => {
  console.log('📦 Database location:', DB_FILE);
});
