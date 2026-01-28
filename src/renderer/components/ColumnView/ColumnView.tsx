import React, { useReducer, useCallback, useEffect, useRef } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { FileEntry } from '../../../shared/types';
import type { ColumnViewState, ColumnAction } from '../../types/columnView';
import { createColumnState } from '../../types/columnView';
import Column from './Column';
import './ColumnView.css';

interface ColumnViewProps {
  serverId: string;
  initialPath?: string;
  showHidden?: boolean;
  onFileSelect?: (file: FileEntry, columnIndex: number) => void;
  onPathChange?: (path: string) => void;
}

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

    case 'SET_ENTRIES': {
      const columns = [...state.columns];
      if (columns[action.columnIndex]) {
        columns[action.columnIndex] = {
          ...columns[action.columnIndex],
          entries: action.entries,
          loading: false,
          error: null,
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
  showHidden = false,
  onFileSelect,
  onPathChange,
}: ColumnViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize state with root column
  const [state, dispatch] = useReducer(columnReducer, {
    columns: [createColumnState(initialPath)],
    activeColumnIndex: 0,
  });

  const { columns, activeColumnIndex } = state;

  /**
   * Fetch directory contents for a column.
   */
  const fetchDirectory = useCallback(
    async (columnIndex: number, path: string) => {
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
      }
    },
    [serverId, showHidden]
  );

  // Fetch initial directory
  useEffect(() => {
    fetchDirectory(0, initialPath);
  }, [fetchDirectory, initialPath]);

  // Fetch directory when a new column is added
  useEffect(() => {
    const lastColumn = columns[columns.length - 1];
    if (lastColumn && lastColumn.loading && lastColumn.entries.length === 0 && !lastColumn.error) {
      fetchDirectory(columns.length - 1, lastColumn.path);
    }
  }, [columns, fetchDirectory]);

  // Notify path changes
  useEffect(() => {
    const currentPath = columns[activeColumnIndex]?.path || '/';
    onPathChange?.(currentPath);
  }, [activeColumnIndex, columns, onPathChange]);

  // Auto-scroll to show new column when it appears
  useEffect(() => {
    if (containerRef.current && columns.length > 1) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [columns.length]);

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

  return (
    <div ref={containerRef} className="column-view">
      <Group
        id="miller-columns"
        orientation="horizontal"
        className="column-view__panel-group"
      >
        {columns.map((column, index) => (
          <React.Fragment key={`${column.path}-${index}`}>
            <Panel
              id={`column-${index}`}
              minSize="15%"
              defaultSize={`${Math.max(20, 100 / Math.max(columns.length, 3))}%`}
              className="column-view__panel"
            >
              <Column
                columnState={column}
                columnIndex={index}
                isActive={index === activeColumnIndex}
                onItemSelect={handleItemSelect}
                onItemFocus={handleItemFocus}
                onNavigateInto={handleNavigateInto}
                onNavigateBack={handleNavigateBack}
                onColumnFocus={handleColumnFocus}
              />
            </Panel>
            {index < columns.length - 1 && (
              <Separator className="column-view__resize-handle" />
            )}
          </React.Fragment>
        ))}
      </Group>
    </div>
  );
}

export default ColumnView;
