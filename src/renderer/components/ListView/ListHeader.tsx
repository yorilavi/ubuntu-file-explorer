import React from 'react';
import type { SortColumn, SortState } from '../../types/listView';

interface ListHeaderProps {
  sort: SortState;
  onSort: (column: SortColumn) => void;
}

/** Column definitions for the header row. */
const COLUMNS: Array<{ key: SortColumn; label: string; className?: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size', className: 'list-header__cell--size' },
  { key: 'modified', label: 'Date Modified' },
  { key: 'kind', label: 'Kind' },
];

/**
 * Sortable column header row for the list view.
 *
 * Renders five CSS Grid columns matching the ListRow layout:
 * icon spacer | Name | Size | Date Modified | Kind.
 * Clicking a column header calls onSort with the column identifier.
 * The active sort column shows an ascending or descending arrow.
 */
function ListHeader({ sort, onSort }: ListHeaderProps): React.JSX.Element {
  return (
    <div className="list-header" role="row">
      {/* Icon spacer column (not sortable) */}
      <div className="list-header__cell" role="columnheader" />

      {COLUMNS.map(({ key, label, className }) => {
        const isActive = sort.column === key;
        const cellClasses = [
          'list-header__cell',
          'list-header__cell--sortable',
          className,
          isActive && 'list-header__cell--active',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={key}
            className={cellClasses}
            onClick={() => onSort(key)}
            role="columnheader"
            aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            {label}
            {isActive && (
              <span aria-hidden="true">
                {' '}{sort.direction === 'asc' ? '\u25B2' : '\u25BC'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default React.memo(ListHeader);
