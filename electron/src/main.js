const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const findFreePort = require('find-free-port');
const { autoUpdater } = require('electron-updater');
const kill = require('tree-kill');

class SchichtplanApp {
  constructor() {
    this.mainWindow = null;
    this.backendProcess = null;
    this.backendPort = null;
    this.isDev = process.env.NODE_ENV === 'development';
    this.appDataPath = app.getPath('userData');
    this.databasePath = path.join(this.appDataPath, 'database');
    
    this.initializeApp();
  }

  initializeApp() {
    // Set up app event listeners
    app.whenReady().then(() => this.onReady());
    app.on('window-all-closed', () => this.onWindowAllClosed());
    app.on('activate', () => this.onActivate());
    app.on('before-quit', () => this.cleanup());
  }

  async onReady() {
    // Create database directory if it doesn't exist
    if (!fs.existsSync(this.databasePath)) {
      fs.mkdirSync(this.databasePath, { recursive: true });
    }

    // Find free port for backend
    this.backendPort = await this.findFreePort();
    
    // Start backend server
    await this.startBackendServer();
    
    // Create main window
    this.createMainWindow();
    
    // Set up menu
    this.createMenu();
    
    // Set up auto-updater
    this.setupAutoUpdater();
  }

  async findFreePort() {
    try {
      const [port] = await findFreePort(5000, 5010);
      return port;
    } catch (error) {
      console.error('Failed to find free port:', error);
      return 5000;
    }
  }

  async startBackendServer() {
    return new Promise((resolve, reject) => {
      const projectRoot = path.join(__dirname, '..', '..');
      const pythonPath = path.join(projectRoot, 'src', 'backend', '.venv', 'bin', 'python');
      
      const env = {
        ...process.env,
        FLASK_ENV: 'development',
        FLASK_HOST: '127.0.0.1',
        FLASK_PORT: this.backendPort.toString(),
        DATABASE_PATH: this.databasePath,
        PYTHONPATH: projectRoot,
        FLASK_APP: 'src.backend.app:create_app'
      };

      // Always use development mode for now - use Python virtual environment
      this.backendProcess = spawn(pythonPath, ['-m', 'src.backend.run', 'runserver', '--port', this.backendPort], {
        cwd: projectRoot,
        env,
        stdio: 'inherit'
      });

      this.backendProcess.on('error', (error) => {
        console.error('Backend process error:', error);
        reject(error);
      });

      // Wait for server to start
      setTimeout(() => {
        if (this.backendProcess && !this.backendProcess.killed) {
          console.log(`Backend server started on port ${this.backendPort}`);
          resolve();
        } else {
          reject(new Error('Backend server failed to start'));
        }
      }, 3000);
    });
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'resources', 'icon.png'),
      show: false
    });

    // Load frontend - use dev server for now
    const frontendUrl = 'http://localhost:5173';
    
    this.mainWindow.loadURL(frontendUrl);

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      if (this.isDev) {
        this.mainWindow.webContents.openDevTools();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window controls
    this.mainWindow.on('maximize', () => {
      this.mainWindow.webContents.send('window-maximized');
    });

    this.mainWindow.on('unmaximize', () => {
      this.mainWindow.webContents.send('window-unmaximized');
    });
  }

  createMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Schedule',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.mainWindow.webContents.send('menu-new-schedule')
          },
          {
            label: 'Open Schedule',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.openScheduleDialog()
          },
          {
            label: 'Save Schedule',
            accelerator: 'CmdOrCtrl+S',
            click: () => this.mainWindow.webContents.send('menu-save-schedule')
          },
          { type: 'separator' },
          {
            label: 'Export PDF',
            accelerator: 'CmdOrCtrl+E',
            click: () => this.mainWindow.webContents.send('menu-export-pdf')
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => app.quit()
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => this.showAboutDialog()
          },
          {
            label: 'Check for Updates',
            click: () => autoUpdater.checkForUpdatesAndNotify()
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  setupAutoUpdater() {
    autoUpdater.checkForUpdatesAndNotify();
    
    autoUpdater.on('update-available', () => {
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: 'A new version is available. It will be downloaded in the background.',
        buttons: ['OK']
      });
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The application will restart to apply the update.',
        buttons: ['Restart Now', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }

  async openScheduleDialog() {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Schedule Files', extensions: ['schedule'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      this.mainWindow.webContents.send('menu-open-schedule', result.filePaths[0]);
    }
  }

  showAboutDialog() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'About Schichtplan',
      message: 'Schichtplan Desktop Application',
      detail: 'Version 1.0.0\nSchedule management system for efficient workforce planning.',
      buttons: ['OK']
    });
  }

  cleanup() {
    if (this.backendProcess) {
      console.log('Stopping backend server...');
      kill(this.backendProcess.pid, 'SIGTERM', (err) => {
        if (err) {
          console.error('Error stopping backend:', err);
        } else {
          console.log('Backend server stopped');
        }
      });
    }
  }

  onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  onActivate() {
    if (this.mainWindow === null) {
      this.createMainWindow();
    }
  }
}

// Initialize the application
new SchichtplanApp();
