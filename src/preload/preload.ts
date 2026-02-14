import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script - exposes a minimal, typed API to the renderer process.
 *
 * SECURITY: Never expose raw ipcRenderer. Each method wraps a specific IPC channel.
 * Pattern: contextBridge.exposeInMainWorld() with invoke/handle for async operations.
 */

// Type definitions for SSH operations (must be duplicated here for preload isolation)
interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  source: 'ssh-config' | 'custom';
  keyPath?: string;
  authMethod: 'key' | 'password' | 'agent';
}

interface CustomConnection {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  displayName?: string;
  keyPath?: string;
  authMethod: 'key' | 'password' | 'agent';
}

interface FileEntry {
  name: string;
  path: string;
  size: number;
  modified: Date;
  isDirectory: boolean;
  isSymlink: boolean;
  permissions: string;
  uid: number;
  gid: number;
  target?: string;
}

interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

type ConnectionState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'authenticating' }
  | { status: 'loading-directory' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

// Preview types (duplicated for preload isolation)
interface ImageMetadata {
  width?: number;
  height?: number;
  camera?: string;
  dateTaken?: Date;
  gps?: { latitude: number; longitude: number };
}

type PreviewData =
  | { type: 'image'; dataUrl: string; metadata: ImageMetadata; fileSize: number; mimeType: string }
  | { type: 'code'; content: string; language: string; lineCount: number; truncated: boolean }
  | { type: 'folder'; name: string; itemCount: number; totalSize: number }
  | { type: 'binary'; name: string; fileSize: number; mimeType: string }
  | { type: 'pdf'; dataUrl: string; pageCount: number; fileSize: number; isLarge: boolean }
  | { type: 'too-large'; name: string; fileSize: number }
  | { type: 'error'; message: string }
  | { type: 'loading'; progress: number };

// File operations types (duplicated for preload isolation)
interface TransferProgress {
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

interface FileOperationResult {
  success: boolean;
  path?: string;
  error?: string;
  operationId?: string;
  cancelled?: boolean;
}

// Code chunk data for streaming large files (duplicated for preload isolation)
interface CodeChunkData {
  filePath: string;
  chunk: string;
  chunkIndex: number;
  isInitial: boolean;
  isComplete: boolean;
  totalSize: number;
  language: string;
}

// Folder upload types (duplicated for preload isolation)
interface FolderUploadProgress {
  operationId: string;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  percent: number;
  failedFiles: Array<{ path: string; error: string }>;
}

interface FolderUploadResult {
  success: boolean;
  uploadedCount?: number;
  failedFiles?: Array<{ path: string; error: string }>;
  operationId?: string;
  cancelled?: boolean;
  error?: string;
}

// Conflict strategy type
type ConflictStrategy = 'rename' | 'overwrite' | 'skip';

// Folder download types (duplicated for preload isolation)
interface FolderDownloadProgress {
  operationId: string;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  percent: number;
  totalBytes: number;
  downloadedBytes: number;
  failedFiles: Array<{ path: string; error: string }>;
}

interface FolderDownloadResult {
  success: boolean;
  downloadedCount?: number;
  failedFiles?: Array<{ path: string; error: string }>;
  operationId?: string;
  cancelled?: boolean;
  error?: string;
  localPath?: string;
}

const electronAPI = {
  /**
   * Ping the main process to verify IPC is working.
   * Used during development to confirm the IPC bridge is functional.
   */
  ping: (message: string): Promise<string> =>
    ipcRenderer.invoke('ping', message),

  /**
   * Get app version from main process.
   * Demonstrates reading data from main process.
   */
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('get-app-version'),

  // SSH Operations
  // ==============

  /**
   * List all available servers (SSH config + custom connections).
   */
  listServers: (): Promise<Server[]> =>
    ipcRenderer.invoke('ssh:list-servers'),

  /**
   * Add a new custom SSH connection.
   */
  addConnection: (
    connection: Omit<CustomConnection, 'id'>,
    password?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> =>
    ipcRenderer.invoke('ssh:add-connection', connection, password),

  /**
   * Remove a custom SSH connection.
   */
  removeConnection: (id: string): Promise<void> =>
    ipcRenderer.invoke('ssh:remove-connection', id),

  /**
   * Check if a stored credential exists for a connection.
   */
  hasCredential: (connectionId: string): Promise<boolean> =>
    ipcRenderer.invoke('ssh:has-credential', connectionId),

  /**
   * Clear (delete) a stored credential without deleting the connection.
   */
  clearCredential: (connectionId: string): Promise<void> =>
    ipcRenderer.invoke('ssh:clear-credential', connectionId),

  /**
   * Connect to a server.
   */
  connect: (serverId: string, password?: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('ssh:connect', serverId, password),

  /**
   * Disconnect from a server.
   */
  disconnect: (serverId: string): Promise<void> =>
    ipcRenderer.invoke('ssh:disconnect', serverId),

  /**
   * List directory contents on a connected server.
   */
  listDirectory: (serverId: string, path: string): Promise<DirectoryListing> =>
    ipcRenderer.invoke('ssh:list-directory', serverId, path),

  /**
   * Get the current connection state for a server.
   */
  getConnectionState: (serverId: string): Promise<ConnectionState> =>
    ipcRenderer.invoke('ssh:get-connection-state', serverId),

  /**
   * Subscribe to connection state changes.
   * Returns an unsubscribe function.
   */
  onConnectionStateChange: (
    callback: (serverId: string, state: ConnectionState) => void
  ): (() => void) => {
    const handler = (_event: unknown, serverId: string, state: ConnectionState) => {
      callback(serverId, state);
    };
    ipcRenderer.on('ssh:state-change', handler);
    return () => {
      ipcRenderer.removeListener('ssh:state-change', handler);
    };
  },

  // Preview Operations
  // ==================

  /**
   * Read a file for preview.
   * Returns preview data (image data URL, code content, or error).
   */
  readFilePreview: (
    serverId: string,
    filePath: string,
    fileName: string,
    fileSize: number
  ): Promise<PreviewData> =>
    ipcRenderer.invoke('preview:read-file', serverId, filePath, fileName, fileSize),

  /**
   * Get folder info for preview.
   */
  getFolderInfo: (
    serverId: string,
    folderPath: string,
    folderName: string
  ): Promise<PreviewData> =>
    ipcRenderer.invoke('preview:folder-info', serverId, folderPath, folderName),

  /**
   * Subscribe to preview progress updates.
   * Returns an unsubscribe function.
   */
  onPreviewProgress: (
    callback: (filePath: string, progress: number) => void
  ): (() => void) => {
    const handler = (_event: unknown, filePath: string, progress: number) => {
      callback(filePath, progress);
    };
    ipcRenderer.on('preview:progress', handler);
    return () => {
      ipcRenderer.removeListener('preview:progress', handler);
    };
  },

  /**
   * Subscribe to code chunk updates for large file streaming.
   * Returns an unsubscribe function.
   */
  onCodeChunk: (
    callback: (data: CodeChunkData) => void
  ): (() => void) => {
    const handler = (_event: unknown, data: CodeChunkData) => callback(data);
    ipcRenderer.on('preview:code-chunk', handler);
    return () => {
      ipcRenderer.removeListener('preview:code-chunk', handler);
    };
  },

  // File Operations
  // ===============

  /**
   * Download a file from server to local Mac.
   * Shows save dialog to choose destination.
   */
  downloadFile: (
    serverId: string,
    remotePath: string,
    fileName: string
  ): Promise<FileOperationResult> =>
    ipcRenderer.invoke('file-ops:download', serverId, remotePath, fileName),

  /**
   * Upload a file from local Mac to server.
   * Shows open dialog to choose file.
   */
  uploadFile: (
    serverId: string,
    remoteDir: string
  ): Promise<FileOperationResult> =>
    ipcRenderer.invoke('file-ops:upload', serverId, remoteDir),

  /**
   * Delete a file or folder on server.
   * Shows confirmation dialog before deleting.
   */
  deleteFile: (
    serverId: string,
    remotePath: string,
    fileName: string,
    isDirectory: boolean
  ): Promise<FileOperationResult> =>
    ipcRenderer.invoke('file-ops:delete', serverId, remotePath, fileName, isDirectory),

  /**
   * Rename a file on server.
   */
  renameFile: (
    serverId: string,
    remotePath: string,
    newName: string
  ): Promise<FileOperationResult> =>
    ipcRenderer.invoke('file-ops:rename', serverId, remotePath, newName),

  /**
   * Move a file to a different folder on server.
   */
  moveFile: (
    serverId: string,
    sourcePath: string,
    destDir: string
  ): Promise<FileOperationResult> =>
    ipcRenderer.invoke('file-ops:move', serverId, sourcePath, destDir),

  /**
   * Move a file with folder picker dialog.
   * Shows native folder picker to select destination, then moves the file.
   */
  moveFileWithPicker: (
    serverId: string,
    sourcePath: string,
    fileName: string
  ): Promise<FileOperationResult> =>
    ipcRenderer.invoke('file-ops:move-with-picker', serverId, sourcePath, fileName),

  /**
   * Subscribe to file operation progress updates.
   */
  onFileOperationProgress: (
    callback: (progress: TransferProgress & { filePath: string }) => void
  ): (() => void) => {
    const handler = (_event: unknown, progress: TransferProgress & { filePath: string }) => {
      callback(progress);
    };
    ipcRenderer.on('file-ops:progress', handler);
    return () => {
      ipcRenderer.removeListener('file-ops:progress', handler);
    };
  },

  /**
   * Cancel an active file operation.
   */
  cancelOperation: (operationId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('file-ops:cancel', operationId),

  /**
   * Upload a local folder to remote server.
   * Shows folder picker dialog to choose folder.
   */
  uploadFolder: (
    serverId: string,
    remoteDir: string,
    showHidden: boolean
  ): Promise<FolderUploadResult> =>
    ipcRenderer.invoke('file-ops:upload-folder', serverId, remoteDir, showHidden),

  /**
   * Subscribe to folder upload progress updates.
   */
  onFolderUploadProgress: (
    callback: (progress: FolderUploadProgress) => void
  ): (() => void) => {
    const handler = (_event: unknown, progress: FolderUploadProgress) => {
      callback(progress);
    };
    ipcRenderer.on('file-ops:folder-progress', handler);
    return () => {
      ipcRenderer.removeListener('file-ops:folder-progress', handler);
    };
  },

  /**
   * Cancel an active folder upload operation.
   */
  cancelFolderUpload: (operationId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('file-ops:cancel-folder-upload', operationId),

  /**
   * Download a remote folder to local filesystem.
   * Shows folder picker dialog to choose destination.
   */
  downloadFolder: (
    serverId: string,
    remotePath: string,
    conflictStrategy: ConflictStrategy
  ): Promise<FolderDownloadResult> =>
    ipcRenderer.invoke('file-ops:download-folder', serverId, remotePath, conflictStrategy),

  /**
   * Subscribe to folder download progress updates.
   */
  onFolderDownloadProgress: (
    callback: (progress: FolderDownloadProgress) => void
  ): (() => void) => {
    const handler = (_event: unknown, progress: FolderDownloadProgress) => {
      callback(progress);
    };
    ipcRenderer.on('file-ops:folder-download-progress', handler);
    return () => {
      ipcRenderer.removeListener('file-ops:folder-download-progress', handler);
    };
  },

  /**
   * Cancel an active folder download operation.
   */
  cancelFolderDownload: (operationId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('file-ops:cancel-folder-download', operationId),

  /**
   * Retry downloading specific failed files.
   */
  retryFailedDownloads: (
    serverId: string,
    remoteFolderPath: string,
    localBasePath: string,
    failedFiles: string[],
    conflictStrategy: ConflictStrategy
  ): Promise<FolderDownloadResult> =>
    ipcRenderer.invoke(
      'file-ops:retry-failed-downloads',
      serverId,
      remoteFolderPath,
      localBasePath,
      failedFiles,
      conflictStrategy
    ),

  // Favorites Operations
  // ====================

  /**
   * Get all favorites for a server.
   */
  getFavorites: (serverId: string): Promise<string[]> =>
    ipcRenderer.invoke('favorites:get', serverId),

  /**
   * Add a folder to favorites for a server.
   */
  addFavorite: (serverId: string, path: string): Promise<void> =>
    ipcRenderer.invoke('favorites:add', serverId, path),

  /**
   * Remove a folder from favorites for a server.
   */
  removeFavorite: (serverId: string, path: string): Promise<void> =>
    ipcRenderer.invoke('favorites:remove', serverId, path),

  /**
   * Reorder favorites for a server (for drag-and-drop).
   */
  reorderFavorites: (serverId: string, paths: string[]): Promise<void> =>
    ipcRenderer.invoke('favorites:reorder', serverId, paths),

  // UI Preferences
  // ==============

  /**
   * Get saved column widths.
   */
  getColumnWidths: (): Promise<number[]> =>
    ipcRenderer.invoke('ui:getColumnWidths'),

  /**
   * Save column widths.
   */
  setColumnWidths: (widths: number[]): Promise<void> =>
    ipcRenderer.invoke('ui:setColumnWidths', widths),

  /**
   * Get saved preview panel width.
   */
  getPreviewPanelWidth: (): Promise<number> =>
    ipcRenderer.invoke('ui:getPreviewPanelWidth'),

  /**
   * Save preview panel width.
   */
  setPreviewPanelWidth: (width: number): Promise<void> =>
    ipcRenderer.invoke('ui:setPreviewPanelWidth', width),

  /**
   * Get show hidden files preference.
   */
  getShowHiddenFiles: (): Promise<boolean> =>
    ipcRenderer.invoke('ui:getShowHiddenFiles'),

  /**
   * Save show hidden files preference.
   */
  setShowHiddenFiles: (show: boolean): Promise<void> =>
    ipcRenderer.invoke('ui:setShowHiddenFiles', show),

  /**
   * Get view mode preference.
   */
  getViewMode: (): Promise<string> =>
    ipcRenderer.invoke('ui:getViewMode'),

  /**
   * Save view mode preference.
   */
  setViewMode: (mode: string): Promise<void> =>
    ipcRenderer.invoke('ui:setViewMode', mode),

  // Shell Operations
  // ================

  /**
   * Open a URL in the system default browser.
   * Only http:// and https:// URLs are allowed for security.
   */
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:open-external', url),
};

// Expose the API to the renderer as window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Export the type for use in type declarations
export type ElectronAPI = typeof electronAPI;
