const { ipcRenderer } = require('electron');

window.electronAPI = {
  minimize:    () => ipcRenderer.send('minimize-window'),
  close:       () => ipcRenderer.send('close-window'),
  setHeight:   (h) => ipcRenderer.send('set-height', h),
  getShortcut: () => ipcRenderer.invoke('get-shortcut'),
  setShortcut: (sc) => ipcRenderer.invoke('set-shortcut', sc),
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
