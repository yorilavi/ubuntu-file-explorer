# GSD Handoff Document

**Created:** 2026-01-28
**Updated:** 2026-01-28 (Session 4 - Width persistence & fetch fix)
**Last Commit:** `7db8ca7` - feat(ui): persist column and preview panel widths across app restarts

---

## Current Project Status

### Milestone Progress

| Phase | Status | Plans |
|-------|--------|-------|
| 1. Foundation & Security | ✓ Complete | 2/2 |
| 2. SSH/SFTP Core | ✓ Complete | 4/4 |
| 3. Column View Navigator | ✓ Complete | 4/4 |
| 4. Preview Panel | ✓ Complete | 4/4 |
| 5. File Operations | ✓ Complete | 3/3 |
| 6. Favorites & Polish | ✓ Complete | 5/5 |

**Overall Progress:** 6/6 phases complete (100%)
**Current State:** Post-v1 bug fixing and polish

---

## Session 4 Summary (Latest)

Persistent UI preferences and bug fix:

| Feature | Description | Commit |
|---------|-------------|--------|
| Width persistence | Column widths and preview panel width now persist across app restarts using electron-conf | `7db8ca7` |
| Fetch deduplication | Fixed duplicate directory fetches by tracking pending requests in ref | `7db8ca7` |

### New Files
- `src/main/storage/ui-preferences-store.ts` - electron-conf store for UI preferences
- `src/main/ipc/ui-preferences-handlers.ts` - IPC handlers for get/set preferences

---

## Session 3 Summary

Two enhancements based on user feedback:

| Feature | Description | Commit |
|---------|-------------|--------|
| Lightbox arrow navigation | Arrow up/down keys navigate between images while lightbox is open | `b15eb7e` |
| Dynamic preview panel width | Preview panel can now expand to full width (leaving 150px for one column) | `b15eb7e` |

### How Lightbox Navigation Works
1. App.tsx intercepts arrow keys in capture phase when lightbox is open
2. Dispatches `lightbox-navigate` custom event with direction
3. ColumnView listens and navigates to prev/next file
4. PreviewPanel loads new image and calls `onImagePreviewReady`
5. App.tsx updates `lightboxSrc` to show new image in lightbox

---

## Session 2 Summary

User tested the app after Phase 6 completion and reported multiple bugs. All have been fixed.

### Bugs Fixed

| Issue | Root Cause | Fix | Commit |
|-------|-----------|-----|--------|
| Image preview not showing | CSP blocking `data:` URLs | Added `img-src 'self' data: blob:` to CSP | `c3a52b8` |
| Lightbox showing red X | Same CSP issue | Same fix | `c3a52b8` |
| Duplicate servers in sidebar | ServerSidebar rendered server name twice | Removed duplicate header div | `287044d` |
| "Add to Favorites" not updating sidebar | useFavorites instances not synced | Wired onFavoritesChanged callback through component tree | `287044d` |
| Keyboard nav not working until click | Column not focused when entries load | Added focus after entries load with double rAF | `5140748` |
| Columns resize not working | react-resizable-panels incompatible with fixed widths | Replaced with custom drag-to-resize | `fb51270` |
| Columns too narrow when many open | Percentage-based sizing | NAV-05: Fixed min widths, auto-scroll | `48d9693` |
| Last column not resizable | No resize handle after last column | Added resize handle after every column | `33f0fb2` |
| Preview panel not resizable | No resize UI | Added draggable boundary | `33f0fb2` |
| Preview panel max width too small (600px) | Hardcoded limit | Increased to 800px | `8c6c638` |

---

## Major Architectural Changes

### 1. Column Resize System (REWRITTEN)

**Before:** Used `react-resizable-panels` library with percentage-based sizing
**After:** Custom implementation with pixel-based widths

```typescript
// ColumnView.tsx now manages:
const [columnWidths, setColumnWidths] = useState<number[]>([]);  // Width per column
const [resizing, setResizing] = useState<{index, startX, startWidth} | null>(null);

// Each column has:
- Default width: 220px
- Minimum width: 150px
- Independent sizing (resizing one doesn't affect others)
```

**Why changed:** react-resizable-panels uses percentage-based sizing which conflicts with our fixed minimum widths. When you have 10 columns, it tried to fit them all in view by shrinking them below usable widths.

### 2. Preview Panel Resize (NEW)

```typescript
// App.tsx now manages:
const [previewWidth, setPreviewWidth] = useState(300);  // Default
const [previewResizing, setPreviewResizing] = useState<{startX, startWidth} | null>(null);
const browserMainRef = useRef<HTMLDivElement>(null);

// Limits: min 200px, max dynamic (containerWidth - 150px)
// This allows expanding to nearly full width while keeping one column visible
```

### 3. Lightbox Navigation (NEW - Session 3)

```typescript
// App.tsx - intercepts arrow keys in capture phase when lightbox open
window.addEventListener('keydown', handleKeyDown, true);  // capture phase
// Dispatches: window.dispatchEvent(new CustomEvent('lightbox-navigate', { detail: { direction } }));

// ColumnView.tsx - listens and navigates
window.addEventListener('lightbox-navigate', handleLightboxNavigate);

// PreviewPanel.tsx - notifies when new image ready
onImagePreviewReady?: (dataUrl: string) => void;  // New prop
// Called in useEffect when preview?.type === 'image'
```

### 4. Favorites Refresh Callback Chain

```
App.tsx
  └─ handleFavoritesChanged() → calls refreshFavoritesRef.current()
  └─ handleRefreshFavoritesCallback(fn) → stores fn in refreshFavoritesRef
  │
  ├─ ServerSidebar
  │    └─ useFavorites(serverId) → exposes refresh()
  │    └─ useEffect → calls onRefreshFavorites(refresh)
  │
  └─ ColumnView → Column → FileItem
       └─ onFavoritesChanged prop
       └─ handleAddToFavorites → calls onFavoritesChanged after adding
```

---

## Files Modified This Session

| File | Key Changes |
|------|-------------|
| `index.html` | CSP `img-src 'self' data: blob:` |
| `src/renderer/App.tsx` | Preview resize state, favorites callback wiring |
| `src/renderer/index.css` | Preview resize handle styles |
| `src/renderer/components/ServerSidebar.tsx` | Removed duplicate display, exposes refresh |
| `src/renderer/components/FileItem.tsx` | onFavoritesChanged prop, calls after add |
| `src/renderer/components/ColumnView/ColumnView.tsx` | **Complete rewrite** - custom resize, auto-scroll |
| `src/renderer/components/ColumnView/ColumnView.css` | Custom resize handle styles |
| `src/renderer/components/ColumnView/Column.tsx` | Focus timing fix |
| `.planning/REQUIREMENTS.md` | Added NAV-05 |

---

## What Was NOT Done (Future Improvements)

1. ~~**Persist column widths**~~ - **DONE** (Session 4, using electron-conf)
2. ~~**Persist preview panel width**~~ - **DONE** (Session 4, using electron-conf)
3. **FILE-05 Move UI** - backend ready, needs custom remote folder picker modal
4. **Double-click resize handle to reset to default width** - nice-to-have
5. **Markdown lightbox viewer** - spacebar on .md file opens rendered markdown in lightbox
6. **Lazy loading for large files** - files >500 lines load incrementally on scroll (500 lines at a time)

---

## Testing Checklist

Before considering session complete:

- [x] Connect to server → keyboard navigation works immediately (no click needed)
- [x] Navigate deep (8+ folders) → leftmost columns scroll away
- [x] Press left arrow → hidden columns reappear
- [x] Click breadcrumb segment → scrolls to show that column
- [x] Drag resize handle between any two columns → both resize correctly
- [x] Drag resize handle on last column → column resizes
- [x] Drag boundary between columns and preview panel → preview resizes
- [x] Preview panel can expand to nearly full width (leaving room for one column)
- [x] Right-click folder → Add to Favorites → appears in sidebar immediately
- [x] Image preview shows correctly (no red X)
- [x] Spacebar opens lightbox with actual image
- [x] Arrow up/down in lightbox navigates between images

---

## Git Log (Sessions 2, 3 & 4)

```
7db8ca7 feat(ui): persist column and preview panel widths across app restarts
b15eb7e feat(lightbox): add arrow key navigation and expand preview panel max width
8c6c638 fix(preview): increase max preview panel width to 800px
33f0fb2 feat(resize): add resize handle for last column and preview panel
fb51270 refactor(columns): replace react-resizable-panels with custom resize
48d9693 feat(columns): smart column management with auto-scroll
53f4f28 fix(columns): enable panel resizing
5140748 fix(column): auto-focus column when entries load
287044d fix(sidebar): remove duplicate servers and wire favorites refresh
c3a52b8 fix(preview): add data: and blob: to CSP img-src directive
```

---

## How to Continue

### If User Reports More Resize Issues
1. Column resize logic is in `src/renderer/components/ColumnView/ColumnView.tsx` (lines 213-250)
2. Preview resize logic is in `src/renderer/App.tsx` (lines 37-72)
3. Both use the same pattern: track `{startX, startWidth}` on mousedown, update width on mousemove

### Width Persistence (IMPLEMENTED)
Uses electron-conf via IPC:
- Store: `src/main/storage/ui-preferences-store.ts`
- Handlers: `src/main/ipc/ui-preferences-handlers.ts`
- Preload: `getColumnWidths`, `setColumnWidths`, `getPreviewPanelWidth`, `setPreviewPanelWidth`
- Renderer loads on mount, saves on resize end

### If User Wants More Polish
- Remaining items: Move UI, double-click reset, markdown lightbox, lazy loading

---

## Key Code Locations

| Feature | Primary File | Line Range |
|---------|--------------|------------|
| Column resize | `ColumnView.tsx` | 230-286 (state & handler) |
| Preview resize | `App.tsx` | 38-70 (state & handler) |
| Lightbox navigation | `App.tsx` | 194-235 (key intercept), `ColumnView.tsx` 459-490 (navigate) |
| Image preview ready | `PreviewPanel.tsx` | 135-141 (callback) |
| Favorites refresh | `ServerSidebar.tsx` | 46-55, `FileItem.tsx` 282-300 |
| Auto-scroll | `ColumnView.tsx` | 369-391 |
| Focus on load | `Column.tsx` | 87-98 |

---

*Session 4 updates: Width persistence via electron-conf, fetch deduplication fix*
*All features working and tested*
