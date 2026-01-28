// Favorites storage using electron-conf
// Persists per-server favorite folder paths

import { Conf } from 'electron-conf/main';

/**
 * Schema for electron-conf storage.
 * Key is serverId, value is array of folder paths in display order.
 */
interface FavoritesStoreSchema {
  favorites: Record<string, string[]>;
}

// Initialize Conf with typed schema (separate instance from connection-store)
const conf = new Conf<FavoritesStoreSchema>({
  name: 'favorites', // Creates separate config file
  defaults: {
    favorites: {},
  },
});

/**
 * Get all favorites for a server.
 *
 * @param serverId - The server ID
 * @returns Array of folder paths in display order
 */
export function getFavorites(serverId: string): string[] {
  const serverFavorites = conf.get(`favorites.${serverId}`) as string[] | undefined;
  console.log(`[favorites-store] Get favorites for ${serverId}: ${serverFavorites?.length ?? 0} items`);
  return serverFavorites ?? [];
}

/**
 * Add a folder to favorites for a server.
 * Does nothing if path already exists.
 *
 * @param serverId - The server ID
 * @param path - The folder path to add
 */
export function addFavorite(serverId: string, path: string): void {
  const current = getFavorites(serverId);

  if (current.includes(path)) {
    console.log(`[favorites-store] Path already in favorites: ${path}`);
    return;
  }

  const updated = [...current, path];
  conf.set(`favorites.${serverId}`, updated);
  console.log(`[favorites-store] Added favorite for ${serverId}: ${path}`);
}

/**
 * Remove a folder from favorites for a server.
 *
 * @param serverId - The server ID
 * @param path - The folder path to remove
 */
export function removeFavorite(serverId: string, path: string): void {
  const current = getFavorites(serverId);
  const updated = current.filter((p) => p !== path);

  if (updated.length === current.length) {
    console.log(`[favorites-store] Path not in favorites: ${path}`);
    return;
  }

  conf.set(`favorites.${serverId}`, updated);
  console.log(`[favorites-store] Removed favorite for ${serverId}: ${path}`);
}

/**
 * Replace the entire favorites array for a server.
 * Used for drag-and-drop reordering.
 *
 * @param serverId - The server ID
 * @param paths - The new ordered array of folder paths
 */
export function reorderFavorites(serverId: string, paths: string[]): void {
  conf.set(`favorites.${serverId}`, paths);
  console.log(`[favorites-store] Reordered favorites for ${serverId}: ${paths.length} items`);
}
