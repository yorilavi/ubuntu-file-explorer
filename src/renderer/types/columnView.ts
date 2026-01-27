import type { FileEntry } from '../../shared/types';

/**
 * State for a single column in the Miller column view.
 * Each column represents one directory level.
 */
export interface ColumnState {
  path: string;                    // Absolute path this column displays
  entries: FileEntry[];            // Directory contents
  selectedIndices: Set<number>;    // Multi-select support (Cmd-click, Shift-click)
  focusedIndex: number;            // Current keyboard focus position
  scrollOffset: number;            // Preserve scroll position
  loading: boolean;                // Loading state for async fetch
  error: string | null;            // Error state for failed fetch
}

/**
 * Overall column view state.
 */
export interface ColumnViewState {
  columns: ColumnState[];          // Array of column states (left to right)
  activeColumnIndex: number;       // Which column has keyboard focus
}

/**
 * Actions for column state reducer.
 */
export type ColumnAction =
  | { type: 'NAVIGATE_INTO'; path: string; fromIndex: number }
  | { type: 'NAVIGATE_BACK'; toColumnIndex: number }
  | { type: 'SET_ENTRIES'; columnIndex: number; entries: FileEntry[] }
  | { type: 'SET_LOADING'; columnIndex: number; loading: boolean }
  | { type: 'SET_ERROR'; columnIndex: number; error: string | null }
  | { type: 'SELECT_ITEM'; columnIndex: number; itemIndex: number; multi?: boolean; range?: boolean }
  | { type: 'FOCUS_ITEM'; columnIndex: number; itemIndex: number }
  | { type: 'FOCUS_COLUMN'; columnIndex: number }
  | { type: 'CLEAR_COLUMNS_AFTER'; columnIndex: number };

/**
 * Create initial state for a column.
 */
export function createColumnState(path: string): ColumnState {
  return {
    path,
    entries: [],
    selectedIndices: new Set(),
    focusedIndex: 0,
    scrollOffset: 0,
    loading: true,
    error: null,
  };
}
