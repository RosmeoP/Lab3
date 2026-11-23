const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readStore: () => ipcRenderer.invoke('storage:read'),
  writeStore: (data) => ipcRenderer.invoke('storage:write', data),
  revealDataFile: () => ipcRenderer.invoke('storage:reveal'),
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
});

