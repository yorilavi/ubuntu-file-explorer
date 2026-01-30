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
  cancelOperation,
  generateOperationId,
} from '../ssh/file-operations-service';
import {
  uploadFolder,
  cancelFolderUpload,
  generateFolderUploadId,
} from '../ssh/folder-upload-service';
import type { FolderUploadProgress } from '../ssh/types';

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
      const operationId = generateOperationId();

      try {
        const downloadResult = await downloadFile(serverId, remotePath, localPath, operationId, (percent) => {
          // Get file stats for bytes calculation (approximation)
          const totalBytes = 0; // Will be tracked by file-operations-service
          const bytesTransferred = 0;
          sendProgress(mainWindow, remotePath, percent, bytesTransferred, totalBytes);
        });

        // Clear progress bar on completion
        mainWindow.setProgressBar(-1);
        return { success: true, path: localPath, operationId: downloadResult.operationId };
      } catch (err) {
        mainWindow.setProgressBar(-1);
        const errorMsg = err instanceof Error ? err.message : 'Download failed';
        // Check if cancelled
        if (errorMsg === 'Operation cancelled') {
          console.log(`[file-operations-handlers] Download cancelled: ${remotePath}`);
          return { success: false, cancelled: true };
        }
        console.error(`[file-operations-handlers] Download error:`, err);
        return { success: false, error: errorMsg };
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
      const operationId = generateOperationId();

      try {
        const uploadResult = await uploadFile(serverId, localPath, remoteDir, operationId, (percent) => {
          sendProgress(mainWindow, localPath, percent, 0, 0);
        });

        // Clear progress bar on completion
        mainWindow.setProgressBar(-1);
        return { success: true, path: uploadResult.remotePath, operationId: uploadResult.operationId };
      } catch (err) {
        mainWindow.setProgressBar(-1);
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        // Check if cancelled
        if (errorMsg === 'Operation cancelled') {
          console.log(`[file-operations-handlers] Upload cancelled: ${localPath}`);
          return { success: false, cancelled: true };
        }
        console.error(`[file-operations-handlers] Upload error:`, err);
        return { success: false, error: errorMsg };
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

  // Cancel handler - cancels an active file operation
  ipcMain.handle(
    'file-ops:cancel',
    (_event, operationId: string) => {
      const cancelled = cancelOperation(operationId);
      // Clear progress bar when cancelling
      mainWindow.setProgressBar(-1);
      return { success: cancelled };
    }
  );

  // Folder upload handler - shows folder picker then uploads recursively with progress
  ipcMain.handle(
    'file-ops:upload-folder',
    async (_event, serverId: string, remoteDir: string, showHidden: boolean) => {
      // Show folder picker dialog
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select folder to upload',
        properties: ['openDirectory'],
        buttonLabel: 'Upload',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false };
      }

      const localPath = result.filePaths[0];
      const operationId = generateFolderUploadId();

      try {
        const uploadResult = await uploadFolder(
          serverId,
          localPath,
          remoteDir,
          showHidden,
          operationId,
          (progress: FolderUploadProgress) => {
            // Send progress to renderer
            mainWindow.webContents.send('file-ops:folder-progress', {
              operationId,
              ...progress,
            });
            // Update dock progress bar
            const dockProgress = progress.totalFiles > 0
              ? progress.completedFiles / progress.totalFiles
              : 0;
            mainWindow.setProgressBar(dockProgress);
          }
        );

        // Clear progress bar
        mainWindow.setProgressBar(-1);

        return {
          success: uploadResult.success,
          uploadedCount: uploadResult.uploadedCount,
          failedFiles: uploadResult.failedFiles,
          operationId,
          cancelled: uploadResult.cancelled,
        };
      } catch (err) {
        mainWindow.setProgressBar(-1);
        const errorMsg = err instanceof Error ? err.message : 'Folder upload failed';
        if (errorMsg === 'Operation cancelled') {
          return { success: false, cancelled: true, operationId };
        }
        console.error(`[file-operations-handlers] Folder upload error:`, err);
        return { success: false, error: errorMsg, operationId };
      }
    }
  );

  // Cancel folder upload handler
  ipcMain.handle(
    'file-ops:cancel-folder-upload',
    (_event, operationId: string) => {
      const cancelled = cancelFolderUpload(operationId);
      mainWindow.setProgressBar(-1);
      return { success: cancelled };
    }
  );
}
