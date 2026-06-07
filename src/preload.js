const { ipcRenderer } = require('electron');

window.electronAPI = {
  minimize:    () => ipcRenderer.send('minimize-window'),
  close:       () => ipcRenderer.send('close-window'),
  setHeight:   (h) => ipcRenderer.send('set-height', h),
  getShortcut: () => ipcRenderer.invoke('get-shortcut'),
  setShortcut: (sc) => ipcRenderer.invoke('set-shortcut', sc),
  getPaAirlines: () => ipcRenderer.invoke('get-pa-airlines'),
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
  openBoarding:   (state) => ipcRenderer.send('boarding-open', state),
  toggleBoarding: (state) => ipcRenderer.send('boarding-toggle', state),
  updateBoarding: (state) => ipcRenderer.send('boarding-update', state),
  closeBoarding:  () => ipcRenderer.send('boarding-close'),
  onBoardingDoOpen: (cb) => ipcRenderer.on('boarding-do-open', (e, state) => cb(state)),
  startDrag: (x, y) => {
    ipcRenderer.send('drag-start', x, y);
    const onMove = (e) => ipcRenderer.send('drag-move', e.screenX, e.screenY);
    const onUp   = ()  => {
      ipcRenderer.send('drag-end');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  },
};
