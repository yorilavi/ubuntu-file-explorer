import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FileEntry } from '../../../shared/types';
import type { SortColumn, SortState } from '../../types/listView';
import { getFileKind } from '../../utils/fileKinds';
import { useListNavigation } from '../../hooks/useListNavigation';
import ListHeader from './ListHeader';
import ListRow from './ListRow';
import './ListView.css';

interface ListViewProps {
  serverId: string;
  initialPath?: string;
  navigateTo?: string | null;
  showHidden?: boolean;
  onFileSelect?: (file: FileEntry) => void;
  onPathChange?: (path: string) => void;
  onNavigationComplete?: () => void;
  onRefreshColumn?: (refreshFn: () => void) => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
  onFilesLoaded?: (files: FileEntry[]) => void;
}

/**
 * Sort entries with folders-first guarantee (SORT-03), then by the
 * active sort column and direction.
 */
function sortEntries(entries: FileEntry[], sort: SortState): FileEntry[] {
  return [...entries].sort((a, b) => {
    // SORT-03: Folders always first
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    let comparison = 0;
    switch (sort.column) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'modified': {
        const aTime = a.modified instanceof Date ? a.modified.getTime() : new Date(a.modified).getTime();
        const bTime = b.modified instanceof Date ? b.modified.getTime() : new Date(b.modified).getTime();
        comparison = aTime - bTime;
        break;
      }
      case 'kind': {
        const aKind = getFileKind(a.name, a.isDirectory);
        const bKind = getFileKind(b.name, b.isDirectory);
        comparison = aKind.localeCompare(bKind);
        break;
      }
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * List view container for directory browsing.
 *
 * Fetches directory contents, sorts with folders-first guarantee,
 * virtualizes rows for 1000+ file support, handles keyboard navigation
 * (arrows, Enter, Backspace, type-ahead), and wires context menus via ListRow.
 *
 * Designed as a drop-in alternative to ColumnView for Phase 17 integration.
 */
function ListView({
  serverId,
  initialPath = '/',
  navigateTo,
  showHidden = false,
  onFileSelect,
  onPathChange,
  onNavigationComplete,
  onRefreshColumn,
  onFavoritesChanged,
  onMoveToClick,
  onFilesLoaded,
}: ListViewProps): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SORT-04: Sort state persists across directory changes
  const [sortState, setSortState] = useState<SortState>({ column: 'name', direction: 'asc' });
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Directory fetching ---

  const fetchDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await window.electronAPI.listDirectory(serverId, path);
        // Convert date strings to Date objects (IPC serializes dates)
        let fetched = result.entries.map((entry) => ({
          ...entry,
          modified: new Date(entry.modified),
        }));

        // Filter hidden files unless showHidden is true
        if (!showHidden) {
          fetched = fetched.filter((e) => !e.name.startsWith('.'));
        }

        setEntries(fetched);
        setLoading(false);
        // Pitfall 6: lightbox navigation needs this callback
        onFilesLoaded?.(fetched);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load directory');
        setEntries([]);
        setLoading(false);
      }
    },
    [serverId, showHidden, onFilesLoaded]
  );

  // Fetch when currentPath or showHidden changes
  useEffect(() => {
    fetchDirectory(currentPath);
  }, [currentPath, showHidden, fetchDirectory]);

  // Handle external navigation (navigateTo prop from PathBar)
  useEffect(() => {
    if (navigateTo) {
      setCurrentPath(navigateTo);
      onNavigationComplete?.();
    }
  }, [navigateTo, onNavigationComplete]);

  // Expose refresh function to parent
  useEffect(() => {
    onRefreshColumn?.(() => fetchDirectory(currentPath));
  }, [onRefreshColumn, fetchDirectory, currentPath]);

  // --- Sorting ---

  const sortedEntries = useMemo(
    () => sortEntries(entries, sortState),
    [entries, sortState]
  );

  const handleSort = useCallback((column: SortColumn) => {
    setSortState((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' };
    });
  }, []);

  // --- Virtualization ---

  const virtualizer = useVirtualizer({
    count: sortedEntries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 15,
  });

  // --- Directory navigation ---

  const handleDirectoryOpen = useCallback(
    (path: string) => {
      setCurrentPath(path);
      setSelectedIndex(-1);
      setFocusedIndex(0);
      onPathChange?.(path);
    },
    [onPathChange]
  );

  const handleNavigateUp = useCallback(() => {
    if (currentPath === '/') return;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    handleDirectoryOpen(parentPath);
  }, [currentPath, handleDirectoryOpen]);

  // Notify path changes on mount and when currentPath changes
  useEffect(() => {
    onPathChange?.(currentPath);
  }, [currentPath, onPathChange]);

  // --- Keyboard navigation ---

  const itemNames = useMemo(() => sortedEntries.map((e) => e.name), [sortedEntries]);

  const { handleKeyDown } = useListNavigation({
    itemCount: sortedEntries.length,
    focusedIndex,
    itemNames,
    virtualizer,
    onFocusChange: setFocusedIndex,
    onSelect: useCallback(
      (index: number) => {
        setSelectedIndex(index);
        setFocusedIndex(index);
        const file = sortedEntries[index];
        if (file) onFileSelect?.(file);
      },
      [sortedEntries, onFileSelect]
    ),
    onOpen: useCallback(
      (index: number) => {
        const file = sortedEntries[index];
        if (!file) return;
        if (file.isDirectory) {
          handleDirectoryOpen(file.path);
        } else {
          onFileSelect?.(file);
        }
      },
      [sortedEntries, handleDirectoryOpen, onFileSelect]
    ),
    onNavigateUp: handleNavigateUp,
  });

  // --- Row click handler ---

  const handleRowClick = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      setFocusedIndex(index);
      const file = sortedEntries[index];
      if (file) onFileSelect?.(file);
    },
    [sortedEntries, onFileSelect]
  );

  // --- Render ---

  return (
    <div className="list-view" onKeyDown={handleKeyDown} tabIndex={0}>
      <ListHeader sort={sortState} onSort={handleSort} />
      <div className="list-view__scroll" ref={scrollRef}>
        {loading && <div className="list-view__loading">Loading...</div>}
        {error && <div className="list-view__empty">{error}</div>}
        {!loading && !error && sortedEntries.length === 0 && (
          <div className="list-view__empty">Empty directory</div>
        )}
        {!loading && !error && sortedEntries.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = sortedEntries[virtualRow.index];
              return (
                <div
                  key={entry.path}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ListRow
                    file={entry}
                    isSelected={virtualRow.index === selectedIndex}
                    isFocused={virtualRow.index === focusedIndex}
                    serverId={serverId}
                    showHiddenFiles={showHidden}
                    onRefresh={() => fetchDirectory(currentPath)}
                    onFavoritesChanged={onFavoritesChanged}
                    onMoveToClick={onMoveToClick}
                    onClick={() => handleRowClick(virtualRow.index)}
                    onDoubleClick={() => {
                      if (entry.isDirectory) {
                        handleDirectoryOpen(entry.path);
                      } else {
                        onFileSelect?.(entry);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ListView;
