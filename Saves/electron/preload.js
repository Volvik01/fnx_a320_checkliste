/**
 * Preload — sichere IPC-Brücke zwischen Renderer und Main
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: ()             => ipcRenderer.send('window-minimize'),
  maximize: ()             => ipcRenderer.send('window-maximize'),
  close:    ()             => ipcRenderer.send('window-close'),
  notify:   (title, body)  => ipcRenderer.send('notify', { title, body }),
  isElectron: true,
});
