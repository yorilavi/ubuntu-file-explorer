import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnState } from '../../types/columnView';
import type { FileEntry } from '../../../shared/types';
import { useColumnNavigation } from '../../hooks/useColumnNavigation';
import FileItem from '../FileItem';
import './Column.css';

interface ColumnProps {
  columnState: ColumnState;
  columnIndex: number;
  isActive: boolean;
  serverId: string;
  showHiddenFiles: boolean;
  onRefresh: () => void;
  onRefreshChild?: () => void;
  onItemSelect: (columnIndex: number, itemIndex: number, multi?: boolean, range?: boolean) => void;
  onItemFocus: (columnIndex: number, itemIndex: number) => void;
  onNavigateInto: (columnIndex: number, itemIndex: number) => void;
  onNavigateBack: (columnIndex: number) => void;
  onColumnFocus: (columnIndex: number) => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
}

/**
 * Single column in the Miller column view.
 * Displays a virtualized list of files/folders with keyboard navigation.
 */
function Column({
  columnState,
  columnIndex,
  isActive,
  serverId,
  showHiddenFiles,
  onRefresh,
  onRefreshChild,
  onItemSelect,
  onItemFocus,
  onNavigateInto,
  onNavigateBack,
  onColumnFocus,
  onFavoritesChanged,
  onMoveToClick,
}: ColumnProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const { path, entries, selectedIndices, focusedIndex, loading, error } = columnState;

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // Fixed row height
    overscan: 10, // Render extra items for smooth scrolling
  });

  // Extract item names for type-ahead search
  const itemNames = useMemo(() => entries.map((e) => e.name), [entries]);

  // Keyboard navigation with type-ahead search
  const { handleKeyDown } = useColumnNavigation({
    itemCount: entries.length,
    focusedIndex,
    itemNames,
    virtualizer,
    onFocusChange: (index) => onItemFocus(columnIndex, index),
    onNavigateRight: (index) => onNavigateInto(columnIndex, index),
    onNavigateLeft: () => onNavigateBack(columnIndex),
    onSelect: (index, multi, range) => onItemSelect(columnIndex, index, multi, range),
  });

  // Handle click on item
  const handleItemClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      const multi = e.metaKey || e.ctrlKey;
      const range = e.shiftKey;
      onItemSelect(columnIndex, index, multi, range);
      onItemFocus(columnIndex, index);
    },
    [columnIndex, onItemSelect, onItemFocus]
  );

  // Handle double-click on item
  const handleItemDoubleClick = useCallback(
    (index: number) => {
      const entry = entries[index];
      if (entry?.isDirectory) {
        onNavigateInto(columnIndex, index);
      }
    },
    [columnIndex, entries, onNavigateInto]
  );

  // Focus column container when it becomes active and has entries
  useEffect(() => {
    if (isActive && !loading && entries.length > 0 && parentRef.current) {
      // Use double requestAnimationFrame to ensure DOM is fully settled
      // (first frame for React render, second frame for browser paint)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          parentRef.current?.focus();
        });
      });
    }
  }, [isActive, loading, entries.length]);

  // Scroll to focused item when focus changes
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < entries.length) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, entries.length, virtualizer]);

  const columnClasses = [
    'column',
    isActive && 'column--active',
    loading && 'column--loading',
    error && 'column--error',
  ]
    .filter(Boolean)
    .join(' ');

  // Loading state
  if (loading) {
    return (
      <div className={columnClasses}>
        <div className="column__loading">
          <span className="column__spinner" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={columnClasses}>
        <div className="column__error">{error}</div>
      </div>
    );
  }

  // Empty directory
  if (entries.length === 0) {
    return (
      <div className={columnClasses}>
        <div className="column__empty">Empty folder</div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={columnClasses}
      tabIndex={0}
      role="listbox"
      aria-label={`Directory ${path}`}
      aria-activedescendant={`item-${columnIndex}-${focusedIndex}`}
      onKeyDown={handleKeyDown}
      onFocus={() => onColumnFocus(columnIndex)}
    >
      <div
        className="column__virtual-container"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const entry = entries[virtualRow.index];
          const isSelected = selectedIndices.has(virtualRow.index);
          const isFocused = virtualRow.index === focusedIndex;

          return (
            <div
              key={virtualRow.key}
              id={`item-${columnIndex}-${virtualRow.index}`}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <FileItem
                file={entry}
                isSelected={isSelected}
                isFocused={isActive && isFocused}
                isHidden={entry.name.startsWith('.')}
                serverId={serverId}
                columnIndex={columnIndex}
                showHiddenFiles={showHiddenFiles}
                onRefresh={onRefresh}
                onRefreshChild={onRefreshChild}
                onClick={(e) => handleItemClick(e, virtualRow.index)}
                onDoubleClick={() => handleItemDoubleClick(virtualRow.index)}
                onFavoritesChanged={onFavoritesChanged}
                onMoveToClick={onMoveToClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(Column);
