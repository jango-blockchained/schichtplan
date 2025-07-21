const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  
  // Menu events
  onMenuNewSchedule: (callback) => ipcRenderer.on('menu-new-schedule', callback),
  onMenuOpenSchedule: (callback) => ipcRenderer.on('menu-open-schedule', callback),
  onMenuSaveSchedule: (callback) => ipcRenderer.on('menu-save-schedule', callback),
  onMenuExportPDF: (callback) => ipcRenderer.on('menu-export-pdf', callback),
  
  // Window state
  onWindowMaximized: (callback) => ipcRenderer.on('window-maximized', callback),
  onWindowUnmaximized: (callback) => ipcRenderer.on('window-unmaximized', callback),
  
  // File operations
  openFileDialog: (filters) => ipcRenderer.invoke('open-file-dialog', filters),
  saveFileDialog: (filters) => ipcRenderer.invoke('save-file-dialog', filters),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  
  // Remove listeners
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose app constants
contextBridge.exposeInMainWorld('appConstants', {
  isElectron: true,
  platform: process.platform,
  version: require('../package.json').version
});
