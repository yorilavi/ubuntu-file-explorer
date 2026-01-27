# Phase 3: Column View Navigator - Research

**Researched:** 2026-01-27
**Domain:** Miller columns file browser with virtual scrolling and keyboard navigation
**Confidence:** HIGH

## Summary

This phase implements a Finder-style Miller column browser for navigating remote directories. The implementation requires three core capabilities: (1) horizontally-scrolling resizable columns, (2) virtual scrolling within each column for large directories, and (3) keyboard navigation across and within columns using a roving tabindex pattern.

The standard approach uses **react-resizable-panels** for the column layout with resize handles, **@tanstack/react-virtual** for virtualization within columns (handling 1000+ items without UI freezing), and a custom roving tabindex implementation for keyboard navigation. The path bar combines clickable breadcrumb segments with an editable input mode.

**Primary recommendation:** Build columns using react-resizable-panels for resize handling, virtualize file lists with @tanstack/react-virtual, implement custom keyboard navigation that tracks focus per-column and uses scrollToIndex to keep focused items visible.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-virtual | 3.x | Virtualize file lists within columns | 2.7M+ weekly downloads, headless, lightweight (10-15kb), 60FPS scrolling |
| react-resizable-panels | 4.5.2 | Resizable column layout | 2.7M+ weekly downloads, built-in keyboard accessibility, WAI-ARIA compliant |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-roving-tabindex | 3.x | Focus management pattern | Only if custom implementation proves complex; note: not recommended for grids 100+ cells |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tanstack/react-virtual | react-virtuoso | react-virtuoso has variable height built-in but less flexibility for headless control |
| react-resizable-panels | Custom CSS resize | Panels library handles edge cases (min/max, persistence, keyboard) that would take days to build |
| Custom keyboard nav | react-roving-tabindex | Library doesn't support virtualized lists well; custom implementation needed regardless |

**Installation:**
```bash
npm install @tanstack/react-virtual react-resizable-panels
```

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/
├── components/
│   ├── ColumnView/
│   │   ├── ColumnView.tsx          # Main container with PanelGroup
│   │   ├── Column.tsx              # Single column with virtualized list
│   │   ├── ColumnResizeHandle.tsx  # Drag handle between columns
│   │   └── ColumnView.css          # BEM styles for column view
│   ├── PathBar/
│   │   ├── PathBar.tsx             # Breadcrumb + editable input
│   │   └── PathBar.css             # BEM styles
│   ├── FileRow.tsx                 # Existing, simplified for column view
│   └── FileItem.tsx                # Compact row for Miller column
├── hooks/
│   ├── useColumnNavigation.ts      # Keyboard navigation state machine
│   └── useVirtualizedColumn.ts     # Wrapper for @tanstack/react-virtual
└── types/
    └── columnView.ts               # Column state interfaces
```

### Pattern 1: Column State Array
**What:** Represent navigation as array of column states, each tracking path, entries, selection, and scroll position.
**When to use:** Managing Miller columns where each column is a snapshot of a directory.
**Example:**
```typescript
// Column state management
interface ColumnState {
  path: string;
  entries: FileEntry[];
  selectedIndices: Set<number>;  // Multi-select within column
  focusedIndex: number;          // For keyboard navigation
  scrollOffset: number;          // Preserve scroll position
  loading: boolean;
}

interface ColumnViewState {
  columns: ColumnState[];
  activeColumnIndex: number;     // Which column has focus
}

// Actions for state management
type ColumnAction =
  | { type: 'NAVIGATE_INTO'; path: string; entries: FileEntry[] }
  | { type: 'NAVIGATE_BACK'; toColumnIndex: number }
  | { type: 'SELECT_ITEM'; columnIndex: number; itemIndex: number; multi?: boolean; range?: boolean }
  | { type: 'FOCUS_ITEM'; columnIndex: number; itemIndex: number }
  | { type: 'FOCUS_COLUMN'; columnIndex: number };
```

### Pattern 2: Roving Tabindex for Virtualized Lists
**What:** Track focused index in state, only one item has tabIndex=0, use scrollToIndex when focus changes.
**When to use:** Keyboard navigation in virtualized lists where not all items are in DOM.
**Example:**
```typescript
// Custom hook for keyboard navigation with virtualization
function useKeyboardNavigation(
  columnIndex: number,
  itemCount: number,
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  onNavigateRight: (itemIndex: number) => void,
  onNavigateLeft: () => void
) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, itemCount - 1);
          virtualizer.scrollToIndex(next, { align: 'auto' });
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          virtualizer.scrollToIndex(next, { align: 'auto' });
          return next;
        });
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
    }
  }, [focusedIndex, itemCount, virtualizer, onNavigateRight, onNavigateLeft]);

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}
```

### Pattern 3: Panel Group with Dynamic Columns
**What:** Use react-resizable-panels with dynamic panel count, horizontal layout, overflow scroll.
**When to use:** Creating resizable Miller columns that persist all columns in DOM.
**Example:**
```typescript
// ColumnView with react-resizable-panels
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

function ColumnView({ columns, onResize }: ColumnViewProps) {
  return (
    <div className="column-view">
      <PanelGroup direction="horizontal" autoSaveId="column-widths">
        {columns.map((col, index) => (
          <React.Fragment key={col.path}>
            <Panel
              minSize={15}  // Minimum ~150px at 1000px container
              defaultSize={25}
            >
              <Column
                columnState={col}
                columnIndex={index}
                isActive={index === activeColumnIndex}
              />
            </Panel>
            {index < columns.length - 1 && (
              <PanelResizeHandle className="column-view__resize-handle" />
            )}
          </React.Fragment>
        ))}
      </PanelGroup>
    </div>
  );
}
```

### Pattern 4: Editable Path Bar
**What:** Path bar that displays breadcrumbs by default, switches to text input on click or keyboard shortcut.
**When to use:** Allowing users to navigate by clicking segments or typing paths directly.
**Example:**
```typescript
function PathBar({ path, onNavigate }: PathBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  const segments = path.split('/').filter(Boolean);

  const handleSegmentClick = (segmentIndex: number) => {
    const newPath = '/' + segments.slice(0, segmentIndex + 1).join('/');
    onNavigate(newPath);
  };

  const handleSubmit = () => {
    setIsEditing(false);
    if (editValue !== path) {
      onNavigate(editValue);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className="path-bar__input"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        autoFocus
      />
    );
  }

  return (
    <nav className="path-bar" onClick={() => setIsEditing(true)}>
      <button className="path-bar__segment path-bar__segment--root" onClick={() => onNavigate('/')}>
        /
      </button>
      {segments.map((segment, i) => (
        <React.Fragment key={i}>
          <span className="path-bar__separator">/</span>
          <button
            className="path-bar__segment"
            onClick={(e) => { e.stopPropagation(); handleSegmentClick(i); }}
          >
            {segment}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
```

### Anti-Patterns to Avoid
- **Removing columns from DOM on navigate back:** Keep all columns in memory; only clear columns to the right when navigating into a different folder
- **Global focus state:** Each column should track its own focused index; only one column is "active" for keyboard events
- **Re-rendering all columns on selection change:** Use React.memo and isolate state per column
- **Synchronous directory fetching:** Always fetch asynchronously, show loading state per column

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scrolling | Custom scroll virtualization | @tanstack/react-virtual | Edge cases: variable heights, scroll anchoring, overscan, smooth scroll |
| Resizable columns | CSS resize or custom drag | react-resizable-panels | Edge cases: min/max constraints, persistence, keyboard a11y, cursor states |
| Scroll-to-item | scrollIntoView | virtualizer.scrollToIndex | Must work with virtualized list; built-in alignment options |
| Focus management | Manual tabIndex juggling | Roving tabindex pattern | Requires proper memory of last-focused item per group |

**Key insight:** Virtual scrolling and resize handling have many edge cases (boundary conditions, performance throttling, accessibility) that libraries have already solved. Focus on the Miller column coordination logic, which is app-specific.

## Common Pitfalls

### Pitfall 1: Virtualized List Loses Focus on Scroll
**What goes wrong:** User presses ArrowDown, item scrolls into view, but focus is lost because the previously focused DOM element was removed.
**Why it happens:** Virtualized lists remove DOM nodes outside the viewport; tabIndex state gets lost.
**How to avoid:** Track focused index in React state, not DOM focus. After scroll, explicitly call focus() on the newly-rendered focused element using a ref and useEffect.
**Warning signs:** Arrow keys work visually but Tab key jumps out of the list unexpectedly.

### Pitfall 2: Column Widths Reset on Navigation
**What goes wrong:** User resizes columns, navigates into a folder, and column widths reset to defaults.
**Why it happens:** Columns are re-rendered as state changes; panel sizes aren't persisted.
**How to avoid:** Use react-resizable-panels' autoSaveId prop to persist layout to localStorage, or manage widths in parent state.
**Warning signs:** Manual resize works but doesn't survive navigation.

### Pitfall 3: Slow Render with Many Columns
**What goes wrong:** Navigating 10+ levels deep causes sluggish UI.
**Why it happens:** All columns are kept in memory; each column has its own virtualized list instance.
**How to avoid:** Profile with React DevTools. Consider lazy initialization of virtualizers. Each column's list should be memoized.
**Warning signs:** FPS drops when navigating deep, React DevTools shows many re-renders.

### Pitfall 4: Multi-Select State Lost on Column Change
**What goes wrong:** User multi-selects files in column A, clicks folder in column B, selection in column A is lost.
**Why it happens:** Decision says "selection resets when navigating to different column" but implementation clears on any click.
**How to avoid:** Only clear selection in a column when navigating INTO that column from the left, not when focus moves to adjacent columns.
**Warning signs:** Cmd-click multi-select disappears unexpectedly.

### Pitfall 5: Horizontal Scroll Jumps Unexpectedly
**What goes wrong:** New column appears, scroll jumps to show it even when user was looking at an earlier column.
**Why it happens:** Auto-scroll logic triggers on every new column, not just when column would be off-screen.
**How to avoid:** Check if new column's left edge is beyond container's visible right edge before scrolling. Use scrollIntoView with `behavior: 'smooth'` and `block: 'nearest'`.
**Warning signs:** User loses their place when navigating deep, especially on smaller screens.

### Pitfall 6: Left Arrow Doesn't Restore Previous Selection
**What goes wrong:** User navigates right into folder, presses left arrow, but cursor doesn't return to the folder they came from.
**Why it happens:** Implementation doesn't track "where we came from" when navigating right.
**How to avoid:** When navigating into a folder, record the source item's index. When navigating back with left arrow, restore focus to that index.
**Warning signs:** Left arrow always focuses first item or last-focused item, not the folder user came from.

## Code Examples

Verified patterns from official sources:

### TanStack Virtual Basic List
```typescript
// Source: TanStack Virtual documentation
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedColumn({ entries, onSelect, focusedIndex }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,  // Row height in pixels
    overscan: 5,             // Render 5 items above/below viewport
  });

  return (
    <div ref={parentRef} className="column__scroll-container">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <FileItem
              file={entries[virtualRow.index]}
              isFocused={virtualRow.index === focusedIndex}
              onSelect={() => onSelect(virtualRow.index)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### react-resizable-panels Horizontal Group
```typescript
// Source: react-resizable-panels documentation
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

// Horizontal panel group with resize handles
<PanelGroup direction="horizontal" autoSaveId="miller-columns">
  <Panel defaultSize={25} minSize={15}>
    <Column data={column1} />
  </Panel>
  <PanelResizeHandle className="resize-handle" />
  <Panel defaultSize={25} minSize={15}>
    <Column data={column2} />
  </Panel>
</PanelGroup>
```

### Resize Handle CSS
```css
/* BEM naming for resize handle */
.column-view__resize-handle {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  transition: background 0.15s;
}

.column-view__resize-handle:hover,
.column-view__resize-handle[data-resize-handle-active] {
  background: #3b82f6;
}
```

### Multi-Select with Cmd/Shift Click
```typescript
function handleItemClick(
  e: React.MouseEvent,
  index: number,
  currentSelection: Set<number>
): Set<number> {
  if (e.metaKey || e.ctrlKey) {
    // Toggle selection (Cmd-click)
    const newSelection = new Set(currentSelection);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    return newSelection;
  }

  if (e.shiftKey && currentSelection.size > 0) {
    // Range selection (Shift-click)
    const anchor = Math.min(...currentSelection);
    const newSelection = new Set<number>();
    const start = Math.min(anchor, index);
    const end = Math.max(anchor, index);
    for (let i = start; i <= end; i++) {
      newSelection.add(i);
    }
    return newSelection;
  }

  // Single selection
  return new Set([index]);
}
```

## Recommendations for Claude's Discretion Items

Based on research and Finder behavior, here are recommendations for items marked as Claude's discretion:

| Item | Recommendation | Rationale |
|------|----------------|-----------|
| File selection clears columns to right | **Yes, clear columns when selecting a file** | Consistent with Finder; keeps focus on selected item |
| Minimum column width | **120px** | Enough for ~15 characters, readable file names |
| Column widths persist | **Yes, use autoSaveId** | react-resizable-panels supports this natively |
| Auto-select first item on Right arrow | **Yes** | Finder behavior; allows immediate further navigation |
| Multi-select scope | **Single column only** | Already decided; reset on column change |
| Path bar visual style | **Breadcrumb with segments** | More intuitive click targets than full path string |
| Path bar position | **Top** | Standard file browser convention |
| Loading state indicator | **Spinner** | Simple, clear; skeleton is overengineered for simple list |
| Selection highlight style | **Blue background (#2563eb30)** | Matches existing .file-row--selected style |
| Folder chevron indicator | **Right-pointing chevron (>)** | Standard Miller column indicator that item has children |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-virtualized | @tanstack/react-virtual | 2022 | Lighter, headless, better API |
| Custom resize logic | react-resizable-panels | 2023 | Built-in a11y, persistence |
| tabIndex on every item | Roving tabindex pattern | Ongoing | Single tab stop per column, better UX |

**Deprecated/outdated:**
- react-virtualized: Still works but @tanstack/react-virtual is the spiritual successor, smaller and more flexible
- Manual scrollIntoView: Use virtualizer.scrollToIndex for virtualized lists

## Open Questions

Things that couldn't be fully resolved:

1. **Keyboard shortcut for edit mode in path bar**
   - What we know: Finder uses Cmd+Shift+G for "Go to Folder" dialog
   - What's unclear: Whether to match Finder or use simpler shortcut
   - Recommendation: Use Cmd+L (common browser address bar shortcut) or click anywhere on path bar

2. **Performance threshold for virtualization**
   - What we know: 1000+ items is listed requirement; virtualization helps at ~100+ items
   - What's unclear: Should virtualization always be on, or only for large directories?
   - Recommendation: Always use virtualization; overhead is minimal with TanStack Virtual

3. **Handling directory read errors per column**
   - What we know: Phase 2 has error handling for single directory view
   - What's unclear: UX for partial failures (some columns work, one fails)
   - Recommendation: Show error message within the failing column, keep other columns functional

## Sources

### Primary (HIGH confidence)
- [TanStack Virtual](https://tanstack.com/virtual/latest) - Official documentation for virtualization
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - v4.5.2 documentation and examples
- Existing codebase: DirectoryList.tsx, FileRow.tsx, index.css

### Secondary (MEDIUM confidence)
- [Miller columns Wikipedia](https://en.wikipedia.org/wiki/Miller_columns) - Pattern definition and keyboard behavior
- [react-roving-tabindex GitHub](https://github.com/stevejay/react-roving-tabindex) - v3.x API for focus management
- [Resizable Tables with CSS Grid](https://www.letsbuildui.dev/articles/resizable-tables-with-react-and-css-grid/) - Resize handle best practices
- [React roving tabindex](https://www.joshuawootonn.com/react-roving-tabindex) - Implementation patterns

### Tertiary (LOW confidence)
- [react-miller-columns npm](https://www.npmjs.com/package/react-miller-columns) - Existing React implementation (not actively maintained, not recommended for use)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Virtual and react-resizable-panels are industry standard with millions of downloads
- Architecture: HIGH - Patterns derived from official documentation and established React patterns
- Pitfalls: MEDIUM - Based on common issues documented in library discussions and general virtualization challenges

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable domain, libraries are mature)
