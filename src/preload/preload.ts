import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script - exposes a minimal, typed API to the renderer process.
 *
 * SECURITY: Never expose raw ipcRenderer. Each method wraps a specific IPC channel.
 * Pattern: contextBridge.exposeInMainWorld() with invoke/handle for async operations.
 */

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
};

// Expose the API to the renderer as window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Export the type for use in type declarations
export type ElectronAPI = typeof electronAPI;
