const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs   = require('fs');

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

let bridgeProcess = null;

function startBridge() {
  const { spawn } = require('child_process');
  const bridgePath = path.join(__dirname, '..', 'bridge', 'bridge.js');
  bridgeProcess = spawn(process.execPath, [bridgePath], {
    detached: false,
    stdio: 'ignore'
  });
  bridgeProcess.on('exit', () => { bridgeProcess = null; });
  console.log('[MAIN] Bridge gestartet');
}

function stopBridge() {
  if (bridgeProcess) {
    try { bridgeProcess.kill(); } catch(e) {}
    bridgeProcess = null;
    console.log('[MAIN] Bridge beendet');
  }
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
  createWindow();
  registerShortcut(loadShortcut());
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopBridge();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
