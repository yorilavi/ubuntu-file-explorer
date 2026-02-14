/**
 * Type definitions for the list view component.
 *
 * Defines the sort state model used by ListHeader and ListView
 * to track which column is sorted and in which direction.
 */

/** Columns available for sorting in the list view. */
export type SortColumn = 'name' | 'size' | 'modified' | 'kind';

/** Sort direction for a column. */
export type SortDirection = 'asc' | 'desc';

/** Current sort state: which column and which direction. */
export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}
