import { useCallback } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

interface UseColumnNavigationProps {
  itemCount: number;
  focusedIndex: number;
  virtualizer: Virtualizer<HTMLDivElement, Element> | null;
  onFocusChange: (index: number) => void;
  onNavigateRight: (itemIndex: number) => void;
  onNavigateLeft: () => void;
  onSelect: (index: number, multi?: boolean, range?: boolean) => void;
}

/**
 * Hook for keyboard navigation within a virtualized column.
 * Handles arrow keys, Enter, and modifier keys for selection.
 */
export function useColumnNavigation({
  itemCount,
  focusedIndex,
  virtualizer,
  onFocusChange,
  onNavigateRight,
  onNavigateLeft,
  onSelect,
}: UseColumnNavigationProps) {
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

        default:
          break;
      }
    },
    [focusedIndex, itemCount, virtualizer, onFocusChange, onNavigateRight, onNavigateLeft, onSelect]
  );

  return { handleKeyDown };
}
