# Technology Stack: Metadata Display, List View, and Sort Controls

**Project:** Ubuntu File Explorer
**Milestone:** File Metadata Display + List View + Sort Controls
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

This milestone requires **zero new dependencies**. The existing stack -- `@tanstack/react-virtual` (v3.13.18), React 19, and plain CSS -- provides everything needed. The primary question investigated was whether `@tanstack/react-table` should be added for the list view. The answer is **no** -- it would add complexity without benefit given this project's specific constraints.

The reasoning: This is a file explorer, not a data table. The "list view" is a flat directory listing with 6 fixed columns and a single sort dimension at a time. The project already has working sort logic in the orphaned `DirectoryList.tsx`, working virtualization in `Column.tsx`, and working file operations in `FileItem.tsx`. What's needed is wiring these together, not abstracting them behind a table library.

---

## Recommended Stack Changes

### New Dependencies: None

No new packages are required. The entire feature set can be built with existing dependencies.

### Existing Dependencies to Leverage

| Technology | Version | Role in This Milestone |
|------------|---------|----------------------|
| `@tanstack/react-virtual` | 3.13.18 | Virtualize list view rows (reuse existing pattern from `Column.tsx`) |
| `react` | 19.2.4 | Component architecture, `useMemo` for sort computation |
| `electron-conf` | 1.3.0 | Persist view mode preference, sort preferences, column widths |
| CSS Grid | native | Column layout for list view rows and header (reuse existing `.file-row` grid pattern) |

---

## The Key Decision: Custom Implementation over TanStack Table

### Why NOT Add @tanstack/react-table

**Decision: Do not install `@tanstack/react-table`.**

| Factor | TanStack Table | Custom Implementation |
|--------|---------------|----------------------|
| **Bundle size** | +52KB minified (table-core + react-table) | 0KB additional |
| **Learning curve** | Headless paradigm requires learning column defs, row model, sorting API | Uses patterns already in the codebase |
| **Sort logic** | Provides generic multi-column sort | Project needs single-column sort with folders-first -- already written in `DirectoryList.tsx` and `ColumnView.tsx` |
| **Virtualization** | Requires separate integration with @tanstack/react-virtual | Already integrated in `Column.tsx` |
| **Column resize** | Provides headless resize API | Already implemented in `ColumnView.tsx` with saved widths via IPC |
| **Row selection** | Provides selection model | Already implemented: multi-select with Cmd-click, Shift-click in `columnReducer` |
| **Context menus** | No built-in support | Already implemented in `FileItem.tsx` |
| **DnD** | No built-in support | Already using `@dnd-kit/core` |

**The core problem:** TanStack Table is designed for data-rich table UIs (admin dashboards, data grids, spreadsheet-like interfaces). A file explorer "list view" is a simpler problem -- it's a styled directory listing, not a data table. TanStack Table would require:

1. Defining column models that duplicate the existing `FileEntry` type
2. Wrapping the existing sort logic in TanStack's sorting API
3. Integrating TanStack's row model with the existing selection/focus/keyboard navigation system
4. Bridging TanStack's virtualization integration with the existing `@tanstack/react-virtual` setup

Each integration point adds abstraction without reducing code. The project already has 80% of the implementation -- sort logic, virtualization, selection, keyboard navigation, context menus, column resize -- spread across `DirectoryList.tsx`, `Column.tsx`, `ColumnView.tsx`, and `FileItem.tsx`.

### When TanStack Table WOULD make sense

- Multi-column sorting (sort by name THEN by date)
- Column reordering via drag-and-drop
- Column filtering/search within columns
- Grouped/expandable rows
- Pagination
- 10+ columns

None of these are requirements for a file explorer list view.

---

## What Exists vs What Needs Building

### Already Built (Reuse Directly)

| Component | Location | What It Does | Reuse For |
|-----------|----------|-------------|-----------|
| Sort logic | `DirectoryList.tsx` lines 78-105 | Sorts by name/size/modified, folders-first | Sort implementation for both list view and column view |
| Sort UI | `DirectoryList.tsx` lines 110-119, 155-158 | Column header click toggles sort direction | Sort header in list view |
| File metadata display | `FileRow.tsx` lines 14-45 | `formatSize()`, `formatDate()`, `formatPermissions()` | Metadata display everywhere |
| Virtualization | `Column.tsx` lines 50-55 | `useVirtualizer` with 28px row height | Virtualized list view |
| Keyboard navigation | `useColumnNavigation.ts` | Arrow keys, type-ahead, selection | List view keyboard navigation |
| Column resize + persist | `ColumnView.tsx` lines 234-335 | Mouse drag resize with IPC save | List view column width resize |
| Selection model | `columnReducer` in `ColumnView.tsx` | Multi-select with Cmd/Shift-click | List view selection |
| Context menus | `FileItem.tsx` | Download, upload, rename, delete, move | List view context menus |
| View preference persist | `electron-conf` via IPC | `getColumnWidths`/`setColumnWidths` | Persist view mode, sort prefs |

### Needs Building (New Code)

| Component | Purpose | Estimated Complexity |
|-----------|---------|---------------------|
| `ListView.tsx` | List view container with header + virtualized rows | Medium -- combines `DirectoryList` header pattern with `Column` virtualization |
| `ListRow.tsx` | Single row showing icon + name + size + date + perms + owner | Low -- adapts `FileRow.tsx` + `FileItem.tsx` context menu |
| View mode toggle | Toolbar button to switch between column view and list view | Low -- state in `App.tsx`, conditional render |
| Sort controls in column view | Sort dropdown/buttons in column view toolbar | Low -- reuse sort logic from `DirectoryList.tsx` |
| Column width resize for list view | Draggable column borders in list header | Medium -- adapt `ColumnView.tsx` resize pattern |
| Sort preference persistence | Save sort column + direction per server | Low -- extend `electron-conf` IPC |

---

## Implementation Strategy: Merge Existing Patterns

### Step 1: Extract Shared Utilities

The sort logic and format functions exist in orphaned code. Extract to shared utilities:

```typescript
// src/renderer/utils/fileFormatters.ts
export function formatSize(bytes: number): string { ... }
export function formatDate(date: Date): string { ... }
export function formatPermissions(mode: string): string { ... }

// src/renderer/utils/fileSorting.ts
export type SortColumn = 'name' | 'size' | 'modified' | 'permissions' | 'owner';
export type SortDirection = 'asc' | 'desc';

export function sortFileEntries(
  entries: FileEntry[],
  column: SortColumn,
  direction: SortDirection,
  foldersFirst: boolean = true,
): FileEntry[] { ... }
```

### Step 2: Build ListView Using Existing Patterns

The `ListView` component combines:
- Header from `DirectoryList.tsx` (grid layout with sortable columns)
- Virtualized body from `Column.tsx` (`useVirtualizer`)
- Row rendering from `FileRow.tsx` (grid cells with metadata)
- Context menus from `FileItem.tsx` (right-click operations)

### Step 3: Add Sort to Column View

The Miller column view currently sorts "folders first, then alphabetically" (hardcoded in `ColumnView.tsx` line 363). Adding sort controls means:
- Lifting the sort function to use the extracted `sortFileEntries()`
- Adding sort state to `ColumnViewState` or `App.tsx`
- Rendering a sort dropdown in the toolbar

---

## CSS Architecture for List View

### Existing Pattern: CSS Grid

Both the header and rows already use CSS Grid with matching template columns:

```css
/* Already exists in index.css */
.directory-header {
  display: grid;
  grid-template-columns: 40px 1fr 80px 150px 100px 80px;
}
.file-row {
  display: grid;
  grid-template-columns: 40px 1fr 80px 150px 100px 80px;
}
```

**Recommendation:** Keep this approach. CSS Grid handles column alignment between header and body rows without JavaScript measurement. For resizable columns, switch to `grid-template-columns` with pixel values stored in state (same pattern as `ColumnView.tsx` column widths).

### Fixed Row Height for Virtualization

The existing column view uses 28px fixed row height. The list view can use the same or slightly taller (32px) to accommodate metadata text. `@tanstack/react-virtual` requires consistent row height for optimal performance.

---

## Persistence Strategy

### What to Persist via electron-conf (IPC)

| Preference | Key | Default | Notes |
|-----------|-----|---------|-------|
| View mode | `viewMode` | `'columns'` | `'columns'` or `'list'` |
| Sort column | `sortColumn` | `'name'` | `'name'`, `'size'`, `'modified'`, `'permissions'`, `'owner'` |
| Sort direction | `sortDirection` | `'asc'` | `'asc'` or `'desc'` |
| List view column widths | `listColumnWidths` | `[40, 250, 80, 150, 100, 80]` | Pixel widths per column |

**Pattern:** Follow existing `getColumnWidths`/`setColumnWidths` and `getPreviewPanelWidth`/`setPreviewPanelWidth` IPC handlers. Add equivalent handlers for the new preferences.

---

## What NOT to Add

| Library | Why NOT |
|---------|---------|
| **@tanstack/react-table** | Overkill for 6-column file listing. Adds abstraction layer over patterns already implemented. See detailed analysis above. |
| **ag-grid-react** | Commercial license needed for column resize/sort. Enormous bundle (~300KB). Enterprise data grid, not a file explorer component. |
| **react-data-grid** | Better fit than ag-grid but still overkill. Optimized for spreadsheet-like editing, not file browsing. |
| **react-window** | Inferior to @tanstack/react-virtual (already installed). react-window is maintenance mode; TanStack Virtual is its successor. |
| **Any CSS framework** | Project uses hand-written CSS with BEM convention. Adding Tailwind/Chakra/etc. for one milestone would create style inconsistency. |
| **date-fns / dayjs** | `formatDate()` already implemented with `Date.toLocaleDateString()`. No date math needed. |
| **filesize (npm)** | `formatSize()` already implemented in both `FileRow.tsx` and `FileItem.tsx`. No need for a library. |

---

## Integration Points with Existing Code

### IPC Layer (Main Process)

New handlers needed:

```typescript
// Persistence handlers (following existing pattern)
ipcMain.handle('get-view-mode', () => store.get('viewMode', 'columns'));
ipcMain.handle('set-view-mode', (_, mode) => store.set('viewMode', mode));
ipcMain.handle('get-sort-preferences', () => store.get('sortPreferences', { column: 'name', direction: 'asc' }));
ipcMain.handle('set-sort-preferences', (_, prefs) => store.set('sortPreferences', prefs));
ipcMain.handle('get-list-column-widths', () => store.get('listColumnWidths', []));
ipcMain.handle('set-list-column-widths', (_, widths) => store.set('listColumnWidths', widths));
```

### Preload Bridge

Extend `ElectronAPI` interface with corresponding methods (follows existing pattern exactly).

### Renderer (App.tsx)

The view mode toggle lives in `App.tsx` toolbar. When mode is `'list'`, render `<ListView>` instead of `<ColumnView>`. Both receive the same `serverId`, `showHidden`, `onFileSelect`, `onPathChange` props.

**Critical:** The list view needs its own navigation model (single directory, breadcrumb/back navigation) vs column view (multi-column drill-down). The `DirectoryList.tsx` already has this pattern with `currentPath`, `handleNavigateUp`, and `handleFileDoubleClick`.

---

## Performance Considerations

### Virtualization Reuse

The list view with metadata columns renders more DOM per row than the column view (6 cells vs 1 name). With `@tanstack/react-virtual`, only visible rows render. For 10,000-file directories, this means ~30-50 DOM rows regardless of total count.

**Row height:** Use fixed 32px. Variable row heights cause performance issues with `@tanstack/react-virtual` (requires dynamic measurement).

### Sort Performance

`Array.sort()` on 10,000 `FileEntry` objects with `localeCompare` takes <10ms on modern hardware. No need for Web Workers or debouncing. Use `useMemo` keyed on `[entries, sortColumn, sortDirection]` to avoid re-sorting on unrelated re-renders.

### Column View Sort

Adding sort to column view means re-sorting per-column entries. Since each column is an independent directory listing (typically <1000 entries), sort performance is trivial.

---

## Dead Code Identification

### Files to Refactor or Remove

The codebase contains orphaned list view code from an earlier iteration:

| File | Status | Action |
|------|--------|--------|
| `DirectoryList.tsx` | Orphaned (not imported by any component) | Refactor into new `ListView.tsx` -- reuse sort logic, discard standalone navigation |
| `FileRow.tsx` | Only imported by `DirectoryList.tsx` | Refactor into new `ListRow.tsx` -- add context menu integration from `FileItem.tsx` |
| CSS in `index.css` (lines 498-648) | Styles for orphaned components | Keep and adapt for new list view components |

**Recommendation:** Do not delete the orphaned code. Instead, extract the reusable patterns (sort logic, format functions, grid layout) into the new components and shared utilities, then remove the dead files once the new implementation is complete.

---

## Confidence Assessment

| Area | Level | Rationale |
|------|-------|-----------|
| **No new deps needed** | HIGH | Thorough codebase analysis confirms all patterns exist. Sort logic, virtualization, selection, context menus, persistence, resize -- all implemented. |
| **TanStack Table rejection** | HIGH | Based on detailed analysis of project requirements vs library capabilities. The project's existing code coverage of needed features makes the library redundant. |
| **CSS Grid for layout** | HIGH | Already used in the existing orphaned list view code. Proven pattern for header/row alignment. |
| **Virtualization approach** | HIGH | `@tanstack/react-virtual` v3.13.18 installed and working in `Column.tsx`. Same API applies to list view rows. |
| **Persistence via electron-conf** | HIGH | Existing pattern used for column widths, preview panel width, hidden files toggle. Extending with 3 more preferences is trivial. |

**Overall confidence:** HIGH -- This is a UI assembly milestone, not a technology research milestone. All building blocks exist.

---

## Installation Summary

```bash
# No new packages to install.
# The entire milestone uses existing dependencies:
#   @tanstack/react-virtual  3.13.18  (virtualization)
#   electron-conf             1.3.0   (persistence)
#   react                    19.2.4   (components)
```

---

## Sources

- **Codebase analysis (PRIMARY):** Direct inspection of `DirectoryList.tsx`, `FileRow.tsx`, `Column.tsx`, `ColumnView.tsx`, `FileItem.tsx`, `useColumnNavigation.ts`, `App.tsx`, `index.css`, `package.json`, and shared types
- **@tanstack/react-virtual:** Verified v3.13.18 installed in `node_modules/@tanstack/react-virtual/package.json`
- **@tanstack/react-table:** Training data knowledge (v8.x headless table library, ~52KB bundle, supports sorting/filtering/pagination). Confidence: MEDIUM -- version may have updated since May 2025 training cutoff, but core API and design philosophy stable since v8.0 (2022)
- **CSS Grid:** Web standard, no version concerns
- **electron-conf:** Verified v1.3.0 in `package.json`, existing usage pattern confirmed in `ColumnView.tsx` and `App.tsx`
