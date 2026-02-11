# Feature Landscape: Metadata Display, List View & Sorting (v1.3)

**Domain:** SSH/SFTP file manager (Electron desktop app)
**Milestone:** v1.3 Metadata & List View
**Researched:** 2026-02-10
**Context:** Subsequent milestone adding file metadata display, list/detail view, and sorting to existing file explorer with Miller column primary view

---

## Executive Summary

This research focuses on adding file metadata display, a list/detail view mode, and configurable sorting to the existing Miller column file explorer. Analysis is based on established desktop file manager patterns from macOS Finder, Windows Explorer, GNOME Nautilus/Files, and SFTP clients (Transmit, Cyberduck, FileZilla), plus examination of the existing codebase.

**Key findings:**
- The codebase already has most infrastructure needed: `FileEntry` includes size, modified, permissions, uid, gid; `FileRow` and `DirectoryList` components already exist but are disconnected from the main app; `@tanstack/react-virtual` is already in use; `electron-conf` already handles preference persistence.
- "Kind" column requires a new file-extension-to-kind mapping (not currently in the data model).
- View switching (Column vs List) is table stakes for any Finder-like app. Toolbar toggle with keyboard shortcut is standard.
- Sorting in column view (not just list view) is a differentiator -- Finder supports it, but many clones skip it.
- The existing `DirectoryList` component needs significant rework: it has its own navigation state, does not integrate with PathBar/preview/lightbox/context menus, and lacks keyboard navigation. Building a new `ListView` that shares infrastructure with `ColumnView` is cleaner than retrofitting `DirectoryList`.

**Confidence:** HIGH -- file manager metadata display and list views are mature, stable UX patterns. No web search needed; training data on Finder/Explorer/Nautilus behavior is well-established and hasn't changed meaningfully in years.

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

### Metadata Display in Column View

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **File size in preview panel** | Finder shows size in preview panel | Low | Already shown for image/code previews; standardize for all file types |
| **Date modified in preview panel** | Finder shows "Modified: [date]" in preview | Low | `FileEntry.modified` already available |
| **Kind label in preview panel** | Finder shows "Kind: PNG Image" etc. | Low | Derive from file extension; new utility function |
| **Permissions in preview panel** | SSH-specific; users expect this for remote files | Low | `FileEntry.permissions` already available |

### List/Detail View

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **List view as alternative to column view** | Finder, Explorer, Nautilus all have list/detail view | High | New component; must integrate with all existing features |
| **Sortable column headers (Name, Size, Date Modified, Kind)** | Click-to-sort is universal in list views | Low | Existing `DirectoryList` already has sorting logic to reference |
| **Sort direction indicator (arrow on active column)** | Visual feedback for active sort | Low | Triangle up/down on header cell |
| **Resizable column widths** | Finder, Explorer both support drag-to-resize columns | Medium | Existing column resize pattern from `ColumnView` can be adapted |
| **Folders-first grouping** | Every desktop file manager groups folders before files by default | Low | Already implemented in `ColumnView.fetchDirectory` sort |
| **Context menu on items** | Right-click operations must work in both views | Medium | Reuse existing `FileItem` context menu logic |
| **Keyboard navigation (up/down/enter/backspace)** | Accessible navigation is expected | Medium | Similar to `useColumnNavigation` but single-column |
| **File selection (click, Cmd-click, Shift-click)** | Multi-select is standard | Medium | Reuse selection patterns from `ColumnView` reducer |

### View Switching

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **View mode toggle in toolbar** | Finder has segmented control in toolbar | Low | Two buttons or segmented control: Column / List |
| **Keyboard shortcut for view toggle** | Finder uses Cmd+1/2/3/4 for view modes | Low | Cmd+1 = Column, Cmd+2 = List (match Finder) |
| **Persist view preference** | Users expect their choice to stick | Low | Add to `UIPreferencesSchema` via electron-conf |
| **Preserve navigation state when switching** | Switching views should not reset path | Medium | Share `currentPath` between views |

### Sorting in Both Views

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Sort by Name** | Default, expected everywhere | Low | Already implemented (alphabetical + folders first) |
| **Sort by Date Modified** | Second most common sort | Low | Compare `FileEntry.modified` timestamps |
| **Sort by Size** | Standard sort option | Low | Compare `FileEntry.size` |
| **Sort by Kind** | Finder has this; groups file types together | Low | Compare derived kind string |
| **Ascending/descending toggle** | Click same column header toggles direction | Low | Already implemented in `DirectoryList` |

---

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sorting in column view** | Finder supports sorting within Miller columns; most clones skip this | Medium | Apply sort to each column's entries; dropdown or menu to select sort field |
| **Natural sort order** | "file2" before "file10" (Finder behavior) | Low | Use `localeCompare` with `{numeric: true, sensitivity: 'base'}` -- already close but not using numeric option |
| **Inline metadata in column view** | Show small file size/date below filename in column items (like Finder's "Calculate All Sizes") | Medium | Optional; adds info density without switching views |
| **Column auto-fit on double-click header** | Double-click a list view column header resizes to fit content | Low | Quality-of-life feature matching Finder/Explorer |
| **Status bar with item count and selection info** | "45 items, 3 selected -- 12.4 MB" at bottom | Low | Simple footer, standard in Finder and Explorer |
| **"Get Info" panel or popover** | Cmd+I to see full file metadata (size, permissions, owner, modified, created) | Medium | Matches Finder Cmd+I; uses existing preview panel area |
| **Relative date formatting** | "Today at 3:42 PM", "Yesterday", "Jan 5" for recent dates; full date for older | Low | More readable than always showing full timestamp |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Icon/Grid view** | Three view modes is enough scope for v1.3; icon view requires thumbnail generation and grid layout | Defer to v1.4+; Column + List covers 90% of use cases |
| **Column reordering in list view** | Drag-to-reorder columns adds complexity without clear value for 4-5 columns | Fixed column order: Name, Size, Date Modified, Kind |
| **Custom date format settings** | Overengineered; locale-aware default formatting handles this | Use `Intl.DateTimeFormat` with sensible defaults |
| **Grouping/sectioning by attribute** | Finder's "Use Groups" (by kind, date, size, tags) is complex and niche | Simple flat list with sort is sufficient |
| **File tags/labels** | macOS-specific concept that does not translate to SFTP remote files | Rely on favorites for bookmarking |
| **Calculated folder sizes** | Requires recursive stat of every subdirectory; slow over SFTP, expensive | Show "--" for folders (standard SFTP client behavior) |
| **"Created" date column** | SFTP/POSIX does not expose creation time (only mtime, atime, ctime); showing misleading data is worse than showing nothing | Only show "Date Modified" which maps to mtime |
| **Owner name resolution (uid -> username)** | Requires reading /etc/passwd over SFTP; fragile and slow | Show numeric uid:gid (already present) in detail view only |

---

## Feature Dependencies

```
Metadata Display:
- Preview panel (ALREADY EXISTS) -> Metadata display in preview
- FileEntry type (ALREADY EXISTS - has size, modified, permissions, uid, gid) -> No data model changes needed
- Kind utility (NEW) -> Derive kind string from file extension

List View:
- FileEntry type (ALREADY EXISTS) -> Render rows with metadata columns
- @tanstack/react-virtual (ALREADY EXISTS) -> Virtualized list for performance
- Context menu (ALREADY EXISTS in FileItem) -> Extract and reuse in list view
- File operations (ALREADY EXISTS) -> Same download/upload/rename/delete/move
- PathBar integration (ALREADY EXISTS) -> Share path state between views
- Preview panel (ALREADY EXISTS) -> File selection triggers preview in either view
- Lightbox (ALREADY EXISTS) -> Spacebar preview works in either view
- Hidden files toggle (ALREADY EXISTS) -> Applied consistently in both views

View Switching:
- UI preferences store (ALREADY EXISTS) -> Persist view mode preference
- Toolbar (ALREADY EXISTS) -> Add view mode toggle buttons

Sorting:
- Sort state (PARTIALLY EXISTS in DirectoryList) -> Lift to shared state
- Column view entries (ALREADY EXISTS) -> Apply sort before render
- List view headers (NEW) -> Clickable headers with sort indicators
```

---

## MVP Recommendation (v1.3)

### Must Have (Table Stakes)

**List View:**
1. **ListView component** - Full-width table with Name, Size, Date Modified, Kind columns
2. **Sortable column headers** - Click to sort, click again to reverse direction
3. **Sort direction indicator** - Triangle arrow on active sort column header
4. **Folders-first grouping** - Folders always sort above files regardless of sort column
5. **Keyboard navigation** - Up/Down arrows, Enter to open, Backspace to go up
6. **File selection** - Click, Cmd-click (toggle), Shift-click (range)
7. **Context menu** - Right-click with all existing file operations
8. **Virtualized rendering** - Handle directories with thousands of entries
9. **Hidden files filtering** - Respect existing showHiddenFiles preference

**View Switching:**
10. **Toolbar toggle** - Segmented control or icon buttons for Column/List
11. **Keyboard shortcuts** - Cmd+1 (Column), Cmd+2 (List)
12. **Persist view preference** - Remember across sessions via electron-conf
13. **Preserve path on switch** - Switching views keeps current directory

**Sorting:**
14. **Sort by Name, Size, Date Modified, Kind** - Four sort fields
15. **Apply sorting in column view** - Not just list view; sort menu or context in toolbar

**Metadata:**
16. **Kind utility function** - Map file extensions to human-readable kind strings
17. **Metadata in preview panel** - Show Kind, Size, Date Modified for all file types

### Nice to Have (Differentiators)

18. **Natural sort order** - "file2" before "file10" (LOW complexity, high polish)
19. **Status bar** - Item count and selection info at bottom of window (LOW complexity)
20. **Relative date formatting** - "Today", "Yesterday" for recent files (LOW complexity)
21. **Resizable list columns** - Drag column borders to resize (MEDIUM complexity)
22. **Column auto-fit** - Double-click header border to fit content (LOW complexity)

### Defer to Post-v1.3

- **Icon/Grid view**: High complexity, requires thumbnail generation. Column + List covers primary use cases.
- **"Get Info" panel (Cmd+I)**: Medium complexity, overlaps with preview panel metadata. Evaluate after preview panel metadata is complete.
- **Inline metadata in column view items**: Requires careful layout work; evaluate after list view is complete.
- **Grouping by attribute**: Complex UI, niche use case. Sort is sufficient.

---

## Implementation Notes

### Kind Mapping Strategy

Derive "Kind" from file extension using a mapping table. This is purely a display concern -- no data model changes needed.

```typescript
// Example kind mapping (not exhaustive)
const KIND_MAP: Record<string, string> = {
  // Images
  jpg: 'JPEG Image', jpeg: 'JPEG Image', png: 'PNG Image',
  gif: 'GIF Image', webp: 'WebP Image', svg: 'SVG Image',
  // Documents
  pdf: 'PDF Document', md: 'Markdown Document',
  doc: 'Word Document', docx: 'Word Document',
  // Code
  js: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript JSX',
  py: 'Python Script', rb: 'Ruby Script', go: 'Go Source',
  rs: 'Rust Source', java: 'Java Source',
  // Config
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
  // Archives
  zip: 'ZIP Archive', tar: 'TAR Archive', gz: 'GZip Archive',
  // Fallback
};

function getFileKind(entry: FileEntry): string {
  if (entry.isDirectory) return 'Folder';
  if (entry.isSymlink) return 'Symbolic Link';
  const ext = entry.name.split('.').pop()?.toLowerCase() || '';
  return KIND_MAP[ext] || (ext ? `${ext.toUpperCase()} File` : 'Document');
}
```

### View Architecture

The key architectural decision is how ListView integrates with the existing App component. Two approaches:

**Recommended: Sibling component with shared state.** ListView and ColumnView are siblings within `browser-main`. App passes shared state (currentPath, selectedFile, sort config) to whichever view is active. Only one view is mounted at a time.

```
App
  +-- browser-toolbar (PathBar + ViewToggle + HiddenFilesToggle + SortMenu)
  +-- browser-main
  |     +-- ColumnView (if viewMode === 'column')
  |     +-- ListView (if viewMode === 'list')
  |     +-- PreviewPanel (always present)
```

**Why not retrofit DirectoryList?** The existing `DirectoryList` component was an early prototype that manages its own path state, uses its own hidden files toggle, does not integrate with PathBar/preview/lightbox, lacks keyboard navigation matching ColumnView, and has no context menu. Building a new `ListView` that properly integrates with the existing infrastructure is cleaner and more maintainable.

### Sort State Management

Sort configuration should live in App state (not inside view components) so it persists across view switches and can be controlled from the toolbar.

```typescript
interface SortConfig {
  field: 'name' | 'size' | 'modified' | 'kind';
  direction: 'asc' | 'desc';
}
```

Both ColumnView and ListView receive `sortConfig` as a prop and sort entries accordingly. The toolbar provides UI to change sort (list view also allows clicking column headers).

Persist sort config via electron-conf alongside other UI preferences.

### Natural Sort

The existing sort uses `a.name.localeCompare(b.name)`. Switching to natural sort is a one-line change:

```typescript
// Before
a.name.localeCompare(b.name)

// After (natural sort - "file2" before "file10")
a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
```

This is locale-aware and handles the common case without a third-party library.

### Relative Date Formatting

For the "Date Modified" column, use relative formatting for recent dates:

```typescript
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (days === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  }
  // For older dates, show date without time
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
```

### What Existing Components Need Changes

| Component | Change Required | Effort |
|-----------|----------------|--------|
| `App.tsx` | Add viewMode state, view toggle, sort state, conditionally render ColumnView or ListView | Medium |
| `ColumnView.tsx` | Accept `sortConfig` prop, apply sort to fetched entries | Low |
| `ui-preferences-store.ts` | Add `viewMode` and `sortConfig` to schema | Low |
| `ui-preferences-handlers.ts` | Add IPC handlers for new preferences | Low |
| `preload.ts` | Expose new IPC methods | Low |
| `PreviewPanel.tsx` | Add Kind, Size, Date Modified display for all file types | Low |
| `FileItem.tsx` | No changes (reused by ColumnView as-is) | None |
| `FileRow.tsx` | Rework: add Kind column, remove Permissions/Owner (move to detail), add context menu, support selection states matching FileItem | Medium |
| `DirectoryList.tsx` | **Deprecate** -- replace with new `ListView` component | N/A |

---

## Complexity Assessment

| Feature | Complexity | Estimated Effort | Dependencies |
|---------|------------|------------------|--------------|
| Kind utility function | Low | 0.5 day | None |
| Preview panel metadata display | Low | 0.5 day | Kind utility |
| View mode toggle UI | Low | 0.5 day | None |
| View mode persistence | Low | 0.5 day | electron-conf (exists) |
| Sort state management | Low | 0.5 day | None |
| Sort in column view | Medium | 1 day | Sort state |
| Natural sort order | Low | 0.25 day | None |
| ListView component | High | 3-4 days | Sort state, Kind utility, virtualization |
| ListView keyboard navigation | Medium | 1 day | ListView component |
| ListView context menu | Medium | 1 day | Extract from FileItem |
| ListView column resize | Medium | 1-2 days | ListView component |
| Status bar | Low | 0.5 day | View components |
| Relative date formatting | Low | 0.25 day | None |
| Keyboard shortcuts (Cmd+1/2) | Low | 0.25 day | View mode state |
| Path preservation on view switch | Medium | 0.5 day | Shared state |

**Total estimated effort:** 10-14 days (2-3 weeks)

---

## Confidence Assessment

| Area | Confidence | Source | Notes |
|------|------------|--------|-------|
| List view UX patterns | **HIGH** | Established desktop file manager conventions (Finder, Explorer, Nautilus) | These patterns have been stable for 20+ years |
| Sorting behavior | **HIGH** | Universal file manager convention | Folders-first + click-to-sort is universal |
| Kind mapping | **HIGH** | Finder's kind labels are well-known; MIME type databases are stable | Extension-to-kind mapping is straightforward |
| View switching | **HIGH** | Finder's Cmd+1/2/3/4 pattern is well-established | Standard UX pattern |
| Natural sort | **HIGH** | `localeCompare` with `{numeric: true}` is well-documented | Built into JavaScript, no library needed |
| Codebase integration points | **HIGH** | Direct code examination | Read all relevant source files |
| Effort estimates | **MEDIUM** | Based on codebase complexity analysis | ListView is the largest unknown |

---

## Prior Research Reference

This document extends the v1.2 FEATURES.md research (2026-01-29) which covered folder transfer and PDF preview. Key established patterns that carry forward:

- **Preview panel**: Already displays metadata for images/code; extend to all file types
- **Virtualization**: `@tanstack/react-virtual` proven at scale in ColumnView
- **Preference persistence**: `electron-conf` pattern well-established
- **Context menu**: `FileItem` component has comprehensive right-click operations
- **Keyboard navigation**: `useColumnNavigation` hook provides proven patterns

**Connection to v1.3:** Metadata display, list view, and sorting build on the established navigation and preview infrastructure. The primary work is a new ListView component and lifting sort state to the app level. No new dependencies are needed.
