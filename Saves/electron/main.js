/**
 * Electron Main Process — Condor Cabin Manager
 * Startet den Express-Server und öffnet das App-Fenster
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, Notification } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow = null;
let tray       = null;
let server     = null;
const PORT     = 3000;

// Server starten
function startServer() {
  return new Promise((resolve) => {
    server = fork(path.join(__dirname, '..', 'src', 'app.js'), [], {
      env: { ...process.env, PORT, ELECTRON: '1' },
      silent: false,
    });
    server.on('message', (msg) => {
      if (msg === 'ready') resolve();
    });
    // Nach 2s trotzdem fortfahren
    setTimeout(resolve, 2500);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1440,
    height:          900,
    minWidth:        1100,
    minHeight:       700,
    frame:           false,        // Eigene Titelleiste
    transparent:     false,
    backgroundColor: '#080c14',
    icon:            path.join(__dirname, '..', 'src', 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);


  // Navigation innerhalb der App erlauben (settings → dashboard)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // DevTools nur in Entwicklung
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'src', 'public', 'icon.ico');
  try {
    tray = new Tray(iconPath);
  } catch(e) {
    return; // Icon nicht gefunden — kein Tray
  }

  const menu = Menu.buildFromTemplate([
    { label: 'Condor Cabin Manager', enabled: false },
    { type: 'separator' },
    { label: 'Öffnen',    click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Dashboard', click: () => shell.openExternal(`http://localhost:${PORT}`) },
    { type: 'separator' },
    { label: 'Beenden',   click: () => { app.isQuiting = true; app.quit(); } },
  ]);

  tray.setToolTip('Condor Cabin Manager');
  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// IPC: Fenster-Steuerung von der Titelleiste
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => {
  if (process.platform !== 'darwin') {
    mainWindow?.hide();
  }
});

// Desktop-Benachrichtigungen
ipcMain.on('notify', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: true }).show();
  }
});

app.whenReady().then(async () => {
  await startServer();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Nicht beenden — im Tray weiterlaufen
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  if (server) server.kill();
});
