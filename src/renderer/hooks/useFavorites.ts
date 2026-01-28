import { useState, useEffect, useCallback } from 'react';

interface UseFavoritesResult {
  favorites: string[];
  isLoading: boolean;
  addFavorite: (path: string) => Promise<void>;
  removeFavorite: (path: string) => Promise<void>;
  reorderFavorites: (paths: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing favorites for a specific server.
 * Provides CRUD operations and loading state.
 */
export function useFavorites(serverId: string | null): UseFavoritesResult {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!serverId) {
      setFavorites([]);
      return;
    }
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getFavorites(serverId);
      setFavorites(result);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  // Load favorites when serverId changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  const addFavorite = useCallback(async (path: string) => {
    if (!serverId) return;
    await window.electronAPI.addFavorite(serverId, path);
    setFavorites(prev => prev.includes(path) ? prev : [...prev, path]);
  }, [serverId]);

  const removeFavorite = useCallback(async (path: string) => {
    if (!serverId) return;
    await window.electronAPI.removeFavorite(serverId, path);
    setFavorites(prev => prev.filter(p => p !== path));
  }, [serverId]);

  const reorderFavorites = useCallback(async (paths: string[]) => {
    if (!serverId) return;
    await window.electronAPI.reorderFavorites(serverId, paths);
    setFavorites(paths);
  }, [serverId]);

  return {
    favorites,
    isLoading,
    addFavorite,
    removeFavorite,
    reorderFavorites,
    refresh,
  };
}
