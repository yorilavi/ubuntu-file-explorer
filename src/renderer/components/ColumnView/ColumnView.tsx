import React, { useReducer, useCallback, useEffect, useRef, useState } from 'react';
import type { FileEntry } from '../../../shared/types';
import type { ColumnViewState, ColumnAction } from '../../types/columnView';
import { createColumnState } from '../../types/columnView';
import Column from './Column';
import './ColumnView.css';

interface ColumnViewProps {
  serverId: string;
  initialPath?: string;
  navigateTo?: string | null;  // External navigation trigger (e.g., from PathBar)
  showHidden?: boolean;
  onFileSelect?: (file: FileEntry, columnIndex: number) => void;
  onPathChange?: (path: string) => void;
  onNavigationComplete?: () => void;  // Called after external navigation is processed
  onRefreshColumn?: (refreshFn: () => void) => void;  // Callback to expose refresh function
  onFavoritesChanged?: () => void;  // Called when favorites are modified
  onMoveToClick?: (file: FileEntry) => void;  // Called when "Move to..." is clicked on a file
}

const DEFAULT_COLUMN_WIDTH = 220;
const MIN_COLUMN_WIDTH = 150;

/**
 * Reducer for column view state management.
 * Handles navigation, selection, and column lifecycle.
 */
function columnReducer(state: ColumnViewState, action: ColumnAction): ColumnViewState {
  switch (action.type) {
    case 'NAVIGATE_INTO': {
      // Clear columns after current, add new column
      const newColumns = state.columns.slice(0, state.activeColumnIndex + 1);
      const newColumn = createColumnState(action.path);
      // Store the source item index for back navigation
      if (newColumns.length > 0) {
        const currentColumn = newColumns[newColumns.length - 1];
        newColumns[newColumns.length - 1] = {
          ...currentColumn,
          focusedIndex: action.fromIndex,
          selectedIndices: new Set([action.fromIndex]),
        };
      }
      newColumns.push(newColumn);
      return {
        columns: newColumns,
        activeColumnIndex: newColumns.length - 1,
      };
    }

    case 'NAVIGATE_BACK': {
      if (action.toColumnIndex < 0 || action.toColumnIndex >= state.columns.length) {
        return state;
      }
      return {
        ...state,
        activeColumnIndex: action.toColumnIndex,
      };
    }

    case 'NAVIGATE_TO': {
      // External navigation - build columns for the target path
      const segments = action.path.split('/').filter(Boolean);
      const newColumns: typeof state.columns = [createColumnState('/')];

      // Add a column for each path segment
      let currentPath = '';
      for (const segment of segments) {
        currentPath = `${currentPath}/${segment}`;
        newColumns.push(createColumnState(currentPath));
      }

      return {
        columns: newColumns,
        activeColumnIndex: newColumns.length - 1,
      };
    }

    case 'SET_ENTRIES': {
      const columns = [...state.columns];
      if (columns[action.columnIndex]) {
        const column = columns[action.columnIndex];
        let focusedIndex = column.focusedIndex;
        let selectedIndices = column.selectedIndices;

        // If there's a next column, find and select the entry that leads to it
        const nextColumn = columns[action.columnIndex + 1];
        if (nextColumn) {
          // Find the entry whose name matches the next path segment
          const nextSegment = nextColumn.path.split('/').pop();
          const matchIndex = action.entries.findIndex(
            (e) => e.name === nextSegment && e.isDirectory
          );
          if (matchIndex >= 0) {
            focusedIndex = matchIndex;
            selectedIndices = new Set([matchIndex]);
          }
        }

        columns[action.columnIndex] = {
          ...column,
          entries: action.entries,
          loading: false,
          error: null,
          focusedIndex,
          selectedIndices,
        };
      }
      return { ...state, columns };
    }

    case 'SET_LOADING': {
      const columns = [...state.columns];
      if (columns[action.columnIndex]) {
        columns[action.columnIndex] = {
          ...columns[action.columnIndex],
          loading: action.loading,
        };
      }
      return { ...state, columns };
    }

    case 'SET_ERROR': {
      const columns = [...state.columns];
      if (columns[action.columnIndex]) {
        columns[action.columnIndex] = {
          ...columns[action.columnIndex],
          error: action.error,
          loading: false,
        };
      }
      return { ...state, columns };
    }

    case 'SELECT_ITEM': {
      const columns = [...state.columns];
      const column = columns[action.columnIndex];
      if (!column) return state;

      let newSelection: Set<number>;
      if (action.multi) {
        // Cmd-click: toggle selection
        newSelection = new Set(column.selectedIndices);
        if (newSelection.has(action.itemIndex)) {
          newSelection.delete(action.itemIndex);
        } else {
          newSelection.add(action.itemIndex);
        }
      } else if (action.range && column.selectedIndices.size > 0) {
        // Shift-click: range selection
        const anchor = Math.min(...column.selectedIndices);
        newSelection = new Set<number>();
        const start = Math.min(anchor, action.itemIndex);
        const end = Math.max(anchor, action.itemIndex);
        for (let i = start; i <= end; i++) {
          newSelection.add(i);
        }
      } else {
        // Single selection
        newSelection = new Set([action.itemIndex]);
      }

      columns[action.columnIndex] = {
        ...column,
        selectedIndices: newSelection,
      };

      // Clear columns to the right when selecting (file or folder)
      const trimmedColumns = columns.slice(0, action.columnIndex + 1);

      return {
        columns: trimmedColumns,
        activeColumnIndex: action.columnIndex,
      };
    }

    case 'FOCUS_ITEM': {
      const columns = [...state.columns];
      if (columns[action.columnIndex]) {
        columns[action.columnIndex] = {
          ...columns[action.columnIndex],
          focusedIndex: action.itemIndex,
        };
      }
      return { ...state, columns };
    }

    case 'FOCUS_COLUMN': {
      return {
        ...state,
        activeColumnIndex: action.columnIndex,
      };
    }

    case 'CLEAR_COLUMNS_AFTER': {
      return {
        ...state,
        columns: state.columns.slice(0, action.columnIndex + 1),
      };
    }

    default:
      return state;
  }
}

/**
 * Miller column view container.
 * Manages column state and renders resizable panels.
 */
function ColumnView({
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
}: ColumnViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize state with root column
  const [state, dispatch] = useReducer(columnReducer, {
    columns: [createColumnState(initialPath)],
    activeColumnIndex: 0,
  });

  const { columns, activeColumnIndex } = state;

  // Track column widths for resizing - keep saved widths in ref for reuse
  const savedWidthsRef = useRef<number[]>([]);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [savedWidthsLoaded, setSavedWidthsLoaded] = useState(false);

  // Track pending fetches to prevent duplicate requests
  const pendingFetchesRef = useRef<Set<string>>(new Set());

  // Resize state
  const [resizing, setResizing] = useState<{ index: number; startX: number; startWidth: number } | null>(null);

  // Load saved widths from IPC on mount
  useEffect(() => {
    window.electronAPI.getColumnWidths().then((widths) => {
      savedWidthsRef.current = widths;
      setSavedWidthsLoaded(true);
    });
  }, []);

  // Initialize column widths when columns change - use saved widths where available
  useEffect(() => {
    if (!savedWidthsLoaded) return;
    setColumnWidths(prev => {
      const newWidths = [...prev];
      // Add width for any new columns - prefer saved width at that index
      while (newWidths.length < columns.length) {
        const index = newWidths.length;
        newWidths.push(savedWidthsRef.current[index] || DEFAULT_COLUMN_WIDTH);
      }
      // Trim if columns were removed
      if (newWidths.length > columns.length) {
        return newWidths.slice(0, columns.length);
      }
      return newWidths;
    });
  }, [columns.length, savedWidthsLoaded]);

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setResizing({
      index,
      startX: e.clientX,
      startWidth: columnWidths[index] || DEFAULT_COLUMN_WIDTH,
    });
  }, [columnWidths]);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizing.startWidth + delta);

      setColumnWidths(prev => {
        const updated = [...prev];
        updated[resizing.index] = newWidth;
        return updated;
      });
    };

    const handleMouseUp = () => {
      setResizing(null);
      // Save via IPC and update ref - merge with saved to preserve widths at each depth
      setColumnWidths(current => {
        const merged = [...savedWidthsRef.current];
        current.forEach((width, index) => {
          merged[index] = width;
        });
        savedWidthsRef.current = merged;
        window.electronAPI.setColumnWidths(merged);
        return current;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  /**
   * Fetch directory contents for a column.
   */
  const fetchDirectory = useCallback(
    async (columnIndex: number, path: string) => {
      // Skip if already fetching this path
      if (pendingFetchesRef.current.has(path)) {
        return;
      }
      pendingFetchesRef.current.add(path);

      dispatch({ type: 'SET_LOADING', columnIndex, loading: true });
      try {
        const result = await window.electronAPI.listDirectory(serverId, path);
        // Convert date strings and filter hidden files
        let entries = result.entries.map((entry) => ({
          ...entry,
          modified: new Date(entry.modified),
        }));

        // Filter hidden files unless showHidden is true
        if (!showHidden) {
          entries = entries.filter((e) => !e.name.startsWith('.'));
        }

        // Sort: folders first, then alphabetically
        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        dispatch({ type: 'SET_ENTRIES', columnIndex, entries });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          columnIndex,
          error: err instanceof Error ? err.message : 'Failed to load directory',
        });
      } finally {
        pendingFetchesRef.current.delete(path);
      }
    },
    [serverId, showHidden]
  );

  /**
   * Refresh a column's directory listing.
   * Called after file operations to update the display.
   */
  const refreshColumn = useCallback(
    (columnIndex: number) => {
      const column = columns[columnIndex];
      if (column) {
        fetchDirectory(columnIndex, column.path);
      }
    },
    [columns, fetchDirectory]
  );

  /**
   * Refresh the active column. Used by parent for post-move refresh.
   */
  const refreshActiveColumn = useCallback(() => {
    refreshColumn(activeColumnIndex);
  }, [refreshColumn, activeColumnIndex]);

  // Expose refresh function to parent
  useEffect(() => {
    onRefreshColumn?.(refreshActiveColumn);
  }, [onRefreshColumn, refreshActiveColumn]);

  // Fetch initial directory
  useEffect(() => {
    fetchDirectory(0, initialPath);
  }, [fetchDirectory, initialPath]);

  // Handle external navigation (e.g., from PathBar)
  useEffect(() => {
    if (navigateTo) {
      // Clear pending fetches since we're navigating to a new path
      pendingFetchesRef.current.clear();
      dispatch({ type: 'NAVIGATE_TO', path: navigateTo });
      onNavigationComplete?.();
    }
  }, [navigateTo, onNavigationComplete]);

  // Fetch directory for any column that needs loading
  useEffect(() => {
    columns.forEach((column, index) => {
      if (column.loading && column.entries.length === 0 && !column.error) {
        fetchDirectory(index, column.path);
      }
    });
  }, [columns, fetchDirectory]);

  // Notify path changes
  useEffect(() => {
    const currentPath = columns[activeColumnIndex]?.path || '/';
    onPathChange?.(currentPath);
  }, [activeColumnIndex, columns, onPathChange]);

  // Auto-scroll to keep active column visible
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Find the actual position of the active column
    const columnElements = container.querySelectorAll('.column-view__column-wrapper');
    const activeElement = columnElements[activeColumnIndex] as HTMLElement;

    if (!activeElement) return;

    const activeLeft = activeElement.offsetLeft;
    const activeRight = activeLeft + activeElement.offsetWidth;
    const containerLeft = container.scrollLeft;
    const containerRight = containerLeft + container.clientWidth;

    if (activeLeft < containerLeft) {
      container.scrollLeft = activeLeft;
    } else if (activeRight > containerRight) {
      container.scrollLeft = activeRight - container.clientWidth;
    }
  }, [activeColumnIndex, columns.length, columnWidths]);

  /**
   * Handle navigation into a folder.
   */
  const handleNavigateInto = useCallback(
    (columnIndex: number, itemIndex: number) => {
      const column = columns[columnIndex];
      const entry = column?.entries[itemIndex];
      if (!entry?.isDirectory) return;

      const newPath = column.path === '/'
        ? `/${entry.name}`
        : `${column.path}/${entry.name}`;

      dispatch({ type: 'NAVIGATE_INTO', path: newPath, fromIndex: itemIndex });
    },
    [columns]
  );

  /**
   * Handle navigation back (left arrow).
   */
  const handleNavigateBack = useCallback(
    (columnIndex: number) => {
      if (columnIndex > 0) {
        dispatch({ type: 'NAVIGATE_BACK', toColumnIndex: columnIndex - 1 });
      }
    },
    []
  );

  /**
   * Handle item selection.
   */
  const handleItemSelect = useCallback(
    (columnIndex: number, itemIndex: number, multi?: boolean, range?: boolean) => {
      dispatch({ type: 'SELECT_ITEM', columnIndex, itemIndex, multi, range });

      const column = columns[columnIndex];
      const entry = column?.entries[itemIndex];
      if (entry) {
        onFileSelect?.(entry, columnIndex);
      }
    },
    [columns, onFileSelect]
  );

  /**
   * Handle item focus change.
   */
  const handleItemFocus = useCallback(
    (columnIndex: number, itemIndex: number) => {
      dispatch({ type: 'FOCUS_ITEM', columnIndex, itemIndex });
    },
    []
  );

  /**
   * Handle column focus.
   */
  const handleColumnFocus = useCallback(
    (columnIndex: number) => {
      dispatch({ type: 'FOCUS_COLUMN', columnIndex });
    },
    []
  );

  // Handle lightbox navigation (arrow keys while lightbox is open)
  useEffect(() => {
    const handleLightboxNavigate = (e: Event) => {
      const direction = (e as CustomEvent).detail?.direction;
      const column = columns[activeColumnIndex];
      if (!column || column.entries.length === 0) return;

      const currentIndex = column.focusedIndex;
      let newIndex: number;

      if (direction === 'up') {
        newIndex = Math.max(0, currentIndex - 1);
      } else {
        newIndex = Math.min(column.entries.length - 1, currentIndex + 1);
      }

      if (newIndex !== currentIndex) {
        // Update focus and selection
        dispatch({ type: 'FOCUS_ITEM', columnIndex: activeColumnIndex, itemIndex: newIndex });
        dispatch({ type: 'SELECT_ITEM', columnIndex: activeColumnIndex, itemIndex: newIndex });

        // Notify parent of selection change
        const entry = column.entries[newIndex];
        if (entry) {
          onFileSelect?.(entry, activeColumnIndex);
        }
      }
    };

    window.addEventListener('lightbox-navigate', handleLightboxNavigate);
    return () => window.removeEventListener('lightbox-navigate', handleLightboxNavigate);
  }, [columns, activeColumnIndex, onFileSelect]);

  return (
    <div ref={containerRef} className={`column-view ${resizing ? 'column-view--resizing' : ''}`}>
      <div className="column-view__columns">
        {columns.map((column, index) => (
          <React.Fragment key={`${column.path}-${index}`}>
            <div
              className="column-view__column-wrapper"
              style={{ width: columnWidths[index] || DEFAULT_COLUMN_WIDTH }}
            >
              <Column
                columnState={column}
                columnIndex={index}
                isActive={index === activeColumnIndex}
                serverId={serverId}
                onRefresh={() => refreshColumn(index)}
                onItemSelect={handleItemSelect}
                onItemFocus={handleItemFocus}
                onNavigateInto={handleNavigateInto}
                onNavigateBack={handleNavigateBack}
                onColumnFocus={handleColumnFocus}
                onFavoritesChanged={onFavoritesChanged}
                onMoveToClick={onMoveToClick}
              />
            </div>
            {/* Resize handle after each column (including the last one) */}
            <div
              className={`column-view__resize-handle ${resizing?.index === index ? 'column-view__resize-handle--active' : ''}`}
              onMouseDown={(e) => handleResizeStart(e, index)}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default ColumnView;
