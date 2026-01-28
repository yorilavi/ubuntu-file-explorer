// IPC handlers for favorites operations
// Bridges renderer process to favorites store

import { ipcMain } from 'electron';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  reorderFavorites,
} from '../storage/favorites-store';

/**
 * Register IPC handlers for favorites operations.
 * Unlike file-ops, favorites don't need mainWindow reference.
 */
export function registerFavoritesHandlers(): void {
  /**
   * Get all favorites for a server.
   */
  ipcMain.handle(
    'favorites:get',
    async (_event, serverId: string): Promise<string[]> => {
      return getFavorites(serverId);
    }
  );

  /**
   * Add a folder to favorites for a server.
   */
  ipcMain.handle(
    'favorites:add',
    async (_event, serverId: string, path: string): Promise<void> => {
      addFavorite(serverId, path);
    }
  );

  /**
   * Remove a folder from favorites for a server.
   */
  ipcMain.handle(
    'favorites:remove',
    async (_event, serverId: string, path: string): Promise<void> => {
      removeFavorite(serverId, path);
    }
  );

  /**
   * Reorder favorites for a server (for drag-and-drop).
   */
  ipcMain.handle(
    'favorites:reorder',
    async (_event, serverId: string, paths: string[]): Promise<void> => {
      reorderFavorites(serverId, paths);
    }
  );

  console.log('[favorites-handlers] Registered favorites IPC handlers');
}
