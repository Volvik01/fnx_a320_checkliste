const { app, BrowserWindow, ipcMain, globalShortcut, utilityProcess } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── File Logger ──────────────────────────────────────────────────────────────
const logFile = path.join(require('os').tmpdir(), 'fenix-bridge.log');
fs.writeFileSync(logFile, `=== START ${new Date().toISOString()} ===\n`);
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
}

// WS_EX_NOACTIVATE via Windows API setzen
// Verhindert dass das Fenster jemals den Fokus vom Sim nimmt
function setNoActivate(win) {
  try {
    const { execSync } = require('child_process');
    const hwnd = win.getNativeWindowHandle().readBigInt64LE().toString();
    const ps1  = path.join(__dirname, 'noactivate.ps1');
    execSync(`powershell -ExecutionPolicy Bypass -File "${ps1}" -hwnd ${hwnd}`, { timeout: 5000 });
    console.log('[MAIN] WS_EX_NOACTIVATE gesetzt');
  } catch(e) {
    console.log('[MAIN] WS_EX_NOACTIVATE Fehler:', e.message);
  }
}

// Letzte Position speichern
const posFile = path.join(app.getPath('userData'), 'window-pos.json');

function loadPos() {
  try {
    const p = JSON.parse(fs.readFileSync(posFile, 'utf8'));
    // Collapsed-Höhe (42px) nie wiederherstellen
    if (p.height < 100) p.height = 780;
    return p;
  } catch(e) {}
  return { x: undefined, y: undefined, width: 420, height: 780 };
}

function savePos() {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const b = mainWindow.getBounds();
    // Collapsed-Höhe nicht speichern
    if (b.height < 100) return;
    fs.writeFileSync(posFile, JSON.stringify(b));
  } catch(e) {}
}

let mainWindow;

// ── Shortcut ────────────────────────────────────────────────────────────────
const shortcutFile = path.join(app.getPath('userData'), 'shortcut.json');

function loadShortcut() {
  try { return JSON.parse(fs.readFileSync(shortcutFile, 'utf8')).shortcut; } catch(e) {}
  return 'CommandOrControl+Shift+C'; // Standard
}

function saveShortcut(sc) {
  try { fs.writeFileSync(shortcutFile, JSON.stringify({ shortcut: sc })); } catch(e) {}
}

let currentShortcut = null;

function registerShortcut(sc) {
  // Alten zuerst entfernen
  if (currentShortcut) {
    try { globalShortcut.unregister(currentShortcut); } catch(e) {}
  }
  try {
    const ok = globalShortcut.register(sc, () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        // Focus NICHT übernehmen – MSFS bleibt aktiv
        mainWindow.setFocusable(false);
      }
    });
    if (ok) {
      currentShortcut = sc;
      console.log('[MAIN] Shortcut registriert:', sc);
    } else {
      console.log('[MAIN] Shortcut konnte nicht registriert werden:', sc);
    }
    return ok;
  } catch(e) {
    console.log('[MAIN] Shortcut Fehler:', e.message);
    return false;
  }
}

// IPC: Shortcut aus Renderer setzen
ipcMain.handle('set-shortcut', (e, sc) => {
  const ok = registerShortcut(sc);
  if (ok) saveShortcut(sc);
  return ok;
});

// IPC: Aktuellen Shortcut abfragen
ipcMain.handle('get-shortcut', () => loadShortcut());

// IPC: DevTools öffnen/schließen
ipcMain.on('toggle-devtools', () => {
  if (mainWindow) mainWindow.webContents.toggleDevTools();
});

// IPC: PA Airline-Ordner aus audio/PA/ auslesen
ipcMain.handle('get-pa-airlines', () => {
  try {
    const paPath = app.isPackaged
      ? path.join(process.resourcesPath, 'audio', 'PA')
      : path.join(__dirname, '..', 'audio', 'PA');
    if (!fs.existsSync(paPath)) return [];
    return fs.readdirSync(paPath)
      .filter(f => fs.statSync(path.join(paPath, f)).isDirectory());
  } catch(e) {
    log('[MAIN] PA-Ordner Fehler: ' + e.message);
    return [];
  }
});

// ── Boarding Window ──────────────────────────────────────────────────────────
let boardingWindow = null;
let _lastBoardingState = { boarded: 0, total: 0 };
const boardingPosFile = path.join(app.getPath('userData'), 'boarding-pos.json');

function loadBoardingPos() {
  try { return JSON.parse(fs.readFileSync(boardingPosFile, 'utf8')); } catch(e) {}
  return { x: undefined, y: undefined, width: 1100, height: 220 };
}

function saveBoardingPos(win) {
  try {
    if (!win || win.isDestroyed()) return;
    fs.writeFileSync(boardingPosFile, JSON.stringify(win.getBounds()));
  } catch(e) {}
}

ipcMain.on('boarding-open', (e, state) => {
  _lastBoardingState = state || { boarded: 0, total: 180 };
  if (boardingWindow && !boardingWindow.isDestroyed()) {
    boardingWindow.webContents.send('boarding-update', _lastBoardingState);
    return;
  }
  const bpos = loadBoardingPos();
  boardingWindow = new BrowserWindow({
    width: bpos.width || 1100, height: bpos.height || 88,
    x: bpos.x, y: bpos.y,
    minWidth: 300, minHeight: 80,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: true,
    focusable: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
    backgroundColor: '#080e18',
  });
  boardingWindow.loadFile(path.join(__dirname, 'boarding.html'));
  boardingWindow.once('ready-to-show', () => {
    boardingWindow.webContents.send('boarding-update', _lastBoardingState);
  });
  boardingWindow.on('moved',   () => saveBoardingPos(boardingWindow));
  boardingWindow.on('resized', () => saveBoardingPos(boardingWindow));
  boardingWindow.on('closed', () => { saveBoardingPos(boardingWindow); boardingWindow = null; });
});

ipcMain.on('boarding-update', (e, state) => {
  _lastBoardingState = state;
  if (boardingWindow && !boardingWindow.isDestroyed()) {
    boardingWindow.webContents.send('boarding-update', state);
  }
});

ipcMain.on('boarding-get-state', (e) => {
  e.sender.send('boarding-update', _lastBoardingState);
});

ipcMain.on('boarding-close', () => {
  if (boardingWindow && !boardingWindow.isDestroyed()) boardingWindow.close();
});

ipcMain.on('boarding-toggle', (e, state) => {
  if (boardingWindow && !boardingWindow.isDestroyed()) {
    saveBoardingPos(boardingWindow);
    boardingWindow.close();
  } else {
    _lastBoardingState = state || { boarded: 0, total: 180 };
    const bpos = loadBoardingPos();
    boardingWindow = new BrowserWindow({
      width: bpos.width || 1100, height: bpos.height || 88,
      x: bpos.x, y: bpos.y,
      minWidth: 300, minHeight: 80,
      frame: false,
      transparent: false,
      alwaysOnTop: true,
      resizable: true,
      focusable: true,
      skipTaskbar: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false },
      icon: path.join(__dirname, '../assets/icon.ico'),
      backgroundColor: '#080e18',
    });
    boardingWindow.loadFile(path.join(__dirname, 'boarding.html'));
    boardingWindow.setAlwaysOnTop(true, 'screen-saver');
    boardingWindow.once('ready-to-show', () => {
      boardingWindow.webContents.send('boarding-update', _lastBoardingState);
    });
    boardingWindow.on('moved',   () => saveBoardingPos(boardingWindow));
    boardingWindow.on('resized', () => saveBoardingPos(boardingWindow));
    boardingWindow.on('closed', () => { saveBoardingPos(boardingWindow); boardingWindow = null; });
  }
});

let bridgeWindow = null;

function startBridge() {
  try {
    const bridgePath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bridge', 'bridge.js')
      : path.join(__dirname, '..', 'bridge', 'bridge.js');

    const nodeModulesPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
      : path.join(__dirname, '..', 'node_modules');

    // NODE_PATH setzen damit require() die Module findet
    process.env.NODE_PATH = nodeModulesPath;
    require('module').Module._initPaths();

    log('[MAIN] Bridge laden: ' + bridgePath);
    log('[MAIN] NODE_PATH: ' + nodeModulesPath);
    log('[MAIN] Datei existiert: ' + fs.existsSync(bridgePath));
    log('[MAIN] node_modules existiert: ' + fs.existsSync(nodeModulesPath));
    log('[MAIN] ws existiert: ' + fs.existsSync(path.join(nodeModulesPath, 'ws')));
    log('[MAIN] node-simconnect existiert: ' + fs.existsSync(path.join(nodeModulesPath, 'node-simconnect')));
    require(bridgePath);
    log('[MAIN] Bridge geladen');
  } catch(e) {
    log('[MAIN] Bridge Fehler: ' + e.message + '\n' + e.stack);
  }
}

function stopBridge() {
  // Bridge läuft im selben Prozess, kein Kill nötig
}

function createWindow() {
  const pos = loadPos();

  mainWindow = new BrowserWindow({
    width:  pos.width  || 420,
    height: pos.height || 780,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    focusable: false,
    acceptFirstMouse: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Console für Entwicklung öffnen (optional)
  //mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // WS_EX_NOACTIVATE setzen sobald Fenster bereit ist
  mainWindow.once('ready-to-show', () => {
    setNoActivate(mainWindow);
  });



  // Position bei jedem Move/Resize speichern
  mainWindow.on('moved',   savePos);
  mainWindow.on('resized', savePos);
  mainWindow.on('close', () => { savePos(); });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Drag-Handler vom Renderer
ipcMain.on('start-drag', () => {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(`
      const mousemoveHandler = (e) => {
        window.electronAPI && window.electronAPI.moveWindow(e.screenX, e.screenY);
      };
      document.addEventListener('mousemove', mousemoveHandler, { once: false });
    `);
  }
});

ipcMain.on('move-window', (event, x, y) => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    mainWindow.setPosition(x - bounds.width / 2, y - bounds.height / 2);
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

// Manuelles Dragging für focusable=false Fenster
let dragStart = null;
let winStart  = null;

ipcMain.on('drag-start', (e, x, y) => {
  if (!mainWindow) return;
  dragStart = { x, y };
  winStart  = mainWindow.getPosition();
});

ipcMain.on('drag-move', (e, x, y) => {
  if (!mainWindow || !dragStart || !winStart) return;
  const dx = x - dragStart.x;
  const dy = y - dragStart.y;
  mainWindow.setPosition(winStart[0] + dx, winStart[1] + dy);
});

ipcMain.on('drag-end', () => {
  dragStart = null;
  winStart  = null;
  savePos();
});

ipcMain.on('set-height', (event, height) => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: height }, true);
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  log('[MAIN] App bereit');
  createWindow();
  registerShortcut(loadShortcut());
  log('[MAIN] Starte Bridge...');
  try {
    startBridge();
  } catch(e) {
    log('[MAIN] Bridge Fehler: ' + e.message + '\n' + e.stack);
  }
  log('[MAIN] Bridge-Aufruf abgeschlossen');
  log('[MAIN] Log-Datei: ' + logFile);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopBridge();
  try {
    const { execSync } = require('child_process');
    execSync('taskkill /F /IM node.exe /T', { timeout: 3000 });
  } catch(e) {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
