// Frontend configuration for desktop mode
// This file should be imported in the main React app to configure desktop-specific behavior

export const DESKTOP_CONFIG = {
  isDesktop: typeof window !== 'undefined' && window.electronAPI,
  
  // Backend URL will be set by main process
  getBackendUrl: () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.getBackendUrl();
    }
    return 'http://localhost:5000';
  },
  
  // Window controls
  minimizeWindow: () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  },
  
  maximizeWindow: () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.maximizeWindow();
    }
  },
  
  closeWindow: () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  },
  
  // File operations
  openFile: async (filters) => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return await window.electronAPI.openFileDialog(filters);
    }
    return null;
  },
  
  saveFile: async (filters) => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return await window.electronAPI.saveFileDialog(filters);
    }
    return null;
  },
  
  // App info
  getAppVersion: async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return await window.electronAPI.getAppVersion();
    }
    return '1.0.0';
  }
};

// Event handlers for menu integration
export const setupDesktopMenuHandlers = (handlers) => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    // Menu event handlers
    window.electronAPI.onMenuNewSchedule(() => handlers.onNewSchedule?.());
    window.electronAPI.onMenuOpenSchedule((event, filePath) => handlers.onOpenSchedule?.(filePath));
    window.electronAPI.onMenuSaveSchedule(() => handlers.onSaveSchedule?.());
    window.electronAPI.onMenuExportPDF(() => handlers.onExportPDF?.());
    
    // Window state handlers
    window.electronAPI.onWindowMaximized(() => handlers.onWindowMaximized?.());
    window.electronAPI.onWindowUnmaximized(() => handlers.onWindowUnmaximized?.());
  }
};

// Clean up event listeners
export const cleanupDesktopMenuHandlers = () => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.removeAllListeners('menu-new-schedule');
    window.electronAPI.removeAllListeners('menu-open-schedule');
    window.electronAPI.removeAllListeners('menu-save-schedule');
    window.electronAPI.removeAllListeners('menu-export-pdf');
    window.electronAPI.removeAllListeners('window-maximized');
    window.electronAPI.removeAllListeners('window-unmaximized');
  }
};

// Desktop-specific API client configuration
export const createDesktopApiClient = (baseConfig) => {
  const backendUrl = DESKTOP_CONFIG.getBackendUrl();
  
  return {
    ...baseConfig,
    baseURL: backendUrl,
    timeout: 30000, // Longer timeout for desktop
    
    // Desktop-specific request interceptors
    interceptors: {
      request: (config) => {
        // Add desktop-specific headers
        config.headers = {
          ...config.headers,
          'X-Desktop-App': 'true',
          'X-App-Version': DESKTOP_CONFIG.getAppVersion()
        };
        return config;
      },
      
      response: (response) => {
        // Handle desktop-specific responses
        return response;
      },
      
      error: (error) => {
        // Handle desktop-specific errors
        if (error.code === 'ECONNREFUSED') {
          // Backend server is not running
          console.error('Desktop backend server is not running');
        }
        return Promise.reject(error);
      }
    }
  };
};

export default DESKTOP_CONFIG;
