import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerSSHHandlers } from './ipc/ssh-handlers';
import { registerPreviewHandlers } from './ipc/preview-handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security defaults (explicit for documentation)
      nodeIntegration: false,     // Default since Electron 5
      contextIsolation: true,     // Default since Electron 12
      sandbox: true,              // Default since Electron 20
      webSecurity: true,          // Default
      allowRunningInsecureContent: false, // Default
    },
  });

  // Load the renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  // Register SSH IPC handlers
  registerSSHHandlers(mainWindow);

  // Register Preview IPC handlers
  registerPreviewHandlers(mainWindow);
};

// IPC Handlers
// ============

/**
 * Ping handler - echoes back with "pong: " prefix.
 * Used to verify IPC bridge is working.
 */
ipcMain.handle('ping', async (_event, message: string): Promise<string> => {
  console.log(`[main] Received ping: ${message}`);
  return `pong: ${message}`;
});

/**
 * Get app version from package.json.
 * Demonstrates accessing Node APIs from main process.
 */
ipcMain.handle('get-app-version', async (): Promise<string> => {
  return app.getVersion();
});

// App lifecycle
// =============

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
