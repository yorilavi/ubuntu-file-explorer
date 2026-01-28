// IPC handlers for file operations
// Uses native Electron dialogs for file picking and confirmation

import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
  downloadFile,
  uploadFile,
  deleteRemoteFile,
  deleteRemoteFolder,
  renameRemoteFile,
  moveRemoteFile,
} from '../ssh/file-operations-service';

/**
 * Send progress update to renderer and update dock/taskbar progress bar.
 */
function sendProgress(
  mainWindow: BrowserWindow,
  filePath: string,
  percent: number,
  bytesTransferred: number,
  totalBytes: number
): void {
  mainWindow.webContents.send('file-ops:progress', {
    filePath,
    percent,
    bytesTransferred,
    totalBytes,
  });
  mainWindow.setProgressBar(percent / 100);
}

/**
 * Register file operations IPC handlers.
 */
export function registerFileOperationsHandlers(mainWindow: BrowserWindow): void {
  // Download handler - shows save dialog then downloads with progress
  ipcMain.handle(
    'file-ops:download',
    async (_event, serverId: string, remotePath: string, fileName: string) => {
      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: fileName,
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      });

      if (result.canceled || !result.filePath) {
        return { success: false };
      }

      const localPath = result.filePath;

      try {
        await downloadFile(serverId, remotePath, localPath, (percent) => {
          // Get file stats for bytes calculation (approximation)
          const totalBytes = 0; // Will be tracked by file-operations-service
          const bytesTransferred = 0;
          sendProgress(mainWindow, remotePath, percent, bytesTransferred, totalBytes);
        });

        // Clear progress bar on completion
        mainWindow.setProgressBar(-1);
        return { success: true, path: localPath };
      } catch (err) {
        mainWindow.setProgressBar(-1);
        console.error(`[file-operations-handlers] Download error:`, err);
        return { success: false, error: err instanceof Error ? err.message : 'Download failed' };
      }
    }
  );

  // Upload handler - shows open dialog then uploads with progress
  ipcMain.handle(
    'file-ops:upload',
    async (_event, serverId: string, remoteDir: string) => {
      // Show open dialog
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false };
      }

      const localPath = result.filePaths[0];

      try {
        const newRemotePath = await uploadFile(serverId, localPath, remoteDir, (percent) => {
          sendProgress(mainWindow, localPath, percent, 0, 0);
        });

        // Clear progress bar on completion
        mainWindow.setProgressBar(-1);
        return { success: true, path: newRemotePath };
      } catch (err) {
        mainWindow.setProgressBar(-1);
        console.error(`[file-operations-handlers] Upload error:`, err);
        return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
      }
    }
  );

  // Delete handler - shows confirmation dialog before deleting
  ipcMain.handle(
    'file-ops:delete',
    async (_event, serverId: string, remotePath: string, fileName: string, isDirectory: boolean) => {
      // Show confirmation dialog
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        message: `Delete ${isDirectory ? 'folder' : 'file'} "${fileName}"?`,
        detail: 'This action cannot be undone.',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        cancelId: 0,
      });

      if (result.response !== 1) {
        return { success: false };
      }

      try {
        if (isDirectory) {
          await deleteRemoteFolder(serverId, remotePath);
        } else {
          await deleteRemoteFile(serverId, remotePath);
        }
        return { success: true };
      } catch (err) {
        console.error(`[file-operations-handlers] Delete error:`, err);
        return { success: false, error: err instanceof Error ? err.message : 'Delete failed' };
      }
    }
  );

  // Rename handler - renames file and returns new path
  ipcMain.handle(
    'file-ops:rename',
    async (_event, serverId: string, remotePath: string, newName: string) => {
      try {
        const newPath = await renameRemoteFile(serverId, remotePath, newName);
        return { success: true, path: newPath };
      } catch (err) {
        console.error(`[file-operations-handlers] Rename error:`, err);
        return { success: false, error: err instanceof Error ? err.message : 'Rename failed' };
      }
    }
  );

  // Move handler - moves file to new directory
  ipcMain.handle(
    'file-ops:move',
    async (_event, serverId: string, sourcePath: string, destDir: string) => {
      try {
        const newPath = await moveRemoteFile(serverId, sourcePath, destDir);
        return { success: true, path: newPath };
      } catch (err) {
        console.error(`[file-operations-handlers] Move error:`, err);
        return { success: false, error: err instanceof Error ? err.message : 'Move failed' };
      }
    }
  );

  // Move with picker handler - shows folder picker then moves file
  ipcMain.handle(
    'file-ops:move-with-picker',
    async (_event, serverId: string, sourcePath: string, fileName: string) => {
      // Show folder picker dialog
      const result = await dialog.showOpenDialog(mainWindow, {
        title: `Move "${fileName}" to...`,
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Move Here',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false };
      }

      const destDir = result.filePaths[0];

      try {
        const newPath = await moveRemoteFile(serverId, sourcePath, destDir);
        return { success: true, path: newPath };
      } catch (err) {
        console.error(`[file-operations-handlers] Move with picker error:`, err);
        return { success: false, error: err instanceof Error ? err.message : 'Move failed' };
      }
    }
  );
}
