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
  | { type: 'too-large'; name: string; fileSize: number }
  | { type: 'error'; message: string }
  | { type: 'loading'; progress: number };

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
};

// Expose the API to the renderer as window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Export the type for use in type declarations
export type ElectronAPI = typeof electronAPI;
