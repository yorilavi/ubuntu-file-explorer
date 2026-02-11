import { useCallback, useRef } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

interface UseListNavigationProps {
  itemCount: number;
  focusedIndex: number;
  itemNames: string[];
  virtualizer: Virtualizer<HTMLDivElement, Element> | null;
  onFocusChange: (index: number) => void;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
  onNavigateUp: () => void;
}

/**
 * Hook for keyboard navigation within a virtualized list view.
 * Handles arrow keys for up/down movement, Enter to open, Backspace to go up,
 * and type-ahead search for jumping to entries by name.
 */
export function useListNavigation({
  itemCount,
  focusedIndex,
  itemNames,
  virtualizer,
  onFocusChange,
  onSelect,
  onOpen,
  onNavigateUp,
}: UseListNavigationProps) {
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
            onSelect(nextIndex);
            virtualizer?.scrollToIndex(nextIndex, { align: 'auto' });
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (focusedIndex > 0) {
            const nextIndex = focusedIndex - 1;
            onFocusChange(nextIndex);
            onSelect(nextIndex);
            virtualizer?.scrollToIndex(nextIndex, { align: 'auto' });
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0) {
            onOpen(focusedIndex);
          }
          break;

        case 'Backspace':
          e.preventDefault();
          onNavigateUp();
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
              onSelect(matchIndex);
              virtualizer?.scrollToIndex(matchIndex, { align: 'auto' });
            }

            // Reset search query after 500ms of no typing
            searchTimeoutRef.current = setTimeout(() => {
              searchQueryRef.current = '';
            }, 500);
          }
          break;
      }
    },
    [focusedIndex, itemCount, itemNames, virtualizer, onFocusChange, onSelect, onOpen, onNavigateUp]
  );

  return { handleKeyDown };
}
