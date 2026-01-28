import { useCallback, useRef } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

interface UseColumnNavigationProps {
  itemCount: number;
  focusedIndex: number;
  itemNames: string[];  // Names of items for type-ahead search
  virtualizer: Virtualizer<HTMLDivElement, Element> | null;
  onFocusChange: (index: number) => void;
  onNavigateRight: (itemIndex: number) => void;
  onNavigateLeft: () => void;
  onSelect: (index: number, multi?: boolean, range?: boolean) => void;
}

/**
 * Hook for keyboard navigation within a virtualized column.
 * Handles arrow keys, Enter, modifier keys for selection, and type-ahead search.
 */
export function useColumnNavigation({
  itemCount,
  focusedIndex,
  itemNames,
  virtualizer,
  onFocusChange,
  onNavigateRight,
  onNavigateLeft,
  onSelect,
}: UseColumnNavigationProps) {
  // Type-ahead search state
  const searchQueryRef = useRef('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (focusedIndex < itemCount - 1) {
            const nextIndex = focusedIndex + 1;
            onFocusChange(nextIndex);
            virtualizer?.scrollToIndex(nextIndex, { align: 'auto' });
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (focusedIndex > 0) {
            const nextIndex = focusedIndex - 1;
            onFocusChange(nextIndex);
            virtualizer?.scrollToIndex(nextIndex, { align: 'auto' });
          }
          break;

        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          onNavigateRight(focusedIndex);
          break;

        case 'ArrowLeft':
          e.preventDefault();
          onNavigateLeft();
          break;

        case ' ': // Spacebar for selection toggle (preview in Phase 4)
          e.preventDefault();
          onSelect(focusedIndex, e.metaKey || e.ctrlKey, e.shiftKey);
          break;

        case 'Escape':
          // Clear search query
          searchQueryRef.current = '';
          break;

        case 'Backspace':
          // Remove last character from search query
          if (searchQueryRef.current.length > 0) {
            e.preventDefault();
            searchQueryRef.current = searchQueryRef.current.slice(0, -1);
          }
          break;

        default:
          // Type-ahead search: handle printable characters
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();

            // Clear existing timeout
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
            }

            // Append to search query
            searchQueryRef.current += e.key.toLowerCase();
            const query = searchQueryRef.current;

            // Find first item starting with the query
            const matchIndex = itemNames.findIndex(
              (name) => name.toLowerCase().startsWith(query)
            );

            if (matchIndex >= 0) {
              onFocusChange(matchIndex);
              virtualizer?.scrollToIndex(matchIndex, { align: 'auto' });
            }

            // Reset search query after 800ms of no typing
            searchTimeoutRef.current = setTimeout(() => {
              searchQueryRef.current = '';
            }, 800);
          }
          break;
      }
    },
    [focusedIndex, itemCount, itemNames, virtualizer, onFocusChange, onNavigateRight, onNavigateLeft, onSelect]
  );

  return { handleKeyDown };
}
