# Phase 17: View Mode Integration - Research

**Researched:** 2026-02-10
**Domain:** React conditional rendering, Electron IPC persistence, toolbar UI toggle, keyboard shortcuts, state synchronization across view components
**Confidence:** HIGH

## Summary

Phase 17 integrates the standalone ListView (built in Phase 16) into App.tsx alongside the existing ColumnView, enabling users to switch between Miller columns and list view. The scope covers four requirements: a toolbar toggle button (VIEW-01), a keyboard shortcut (VIEW-02), persistent view mode preference across app restarts (VIEW-03), and preservation of current directory and selected file when switching views (VIEW-04).

The architecture is straightforward because Phase 16 deliberately designed ListView with the same callback interface as ColumnView (serverId, initialPath, navigateTo, showHidden, onPathChange, onNavigationComplete, onRefreshColumn, onFavoritesChanged, onMoveToClick, onFilesLoaded). The only interface difference is `onFileSelect`: ColumnView passes `(file: FileEntry, columnIndex: number)` while ListView passes `(file: FileEntry)` without columnIndex. This must be aligned in App.tsx via a wrapper or by dropping the unused columnIndex.

The persistence layer follows the exact pattern already established by `showHiddenFiles`: add a `viewMode` field to `ui-preferences-store.ts` (electron-conf), add IPC handlers in `ui-preferences-handlers.ts`, expose get/set methods in `preload.ts`, and load/save in App.tsx. This is the most proven pattern in the codebase -- it has been done for `columnWidths`, `previewPanelWidth`, and `showHiddenFiles` already.

**Primary recommendation:** Use the same architecture pattern documented in the ARCHITECTURE.md research: conditional rendering in App.tsx with `viewMode === 'columns' ? <ColumnView .../> : <ListView .../>`, a ViewModeToggle toolbar button next to the existing HiddenFilesToggle, Cmd+1/Cmd+2 keyboard shortcuts (matching Finder), global view mode persistence via electron-conf, and `currentPath` passed as `initialPath` when switching views to preserve navigation state.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.4 | Conditional rendering, state management, useCallback/useEffect | Already in project |
| TypeScript | ^5.5.0 | Type-safe ViewMode type, component props | Already in project |
| electron-conf | ^1.3.0 | Persist viewMode preference across app restarts | Already in project, proven pattern for showHiddenFiles |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron (ipcMain/ipcRenderer) | 40.0.0 | IPC bridge for view mode persistence | Already in project, exact pattern exists |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Conditional rendering (mount/unmount) | CSS display:none (keep both mounted) | display:none preserves ColumnView state but doubles memory. Conditional rendering is simpler and ColumnView's NAVIGATE_TO action can rebuild columns from a path when switching back. |
| Global viewMode | Per-server viewMode | Added complexity with no clear user need. Start global, add per-server later if requested. |
| Cmd+1/Cmd+2 (Finder-style) | Cmd+Shift+L (custom) | Finder convention is familiar to macOS users. Cmd+1 for columns, Cmd+2 for list. |

**Installation:**
No new dependencies needed. All work uses existing project dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/
  components/
    ViewModeToggle.tsx        # NEW: Toggle button component
    ViewModeToggle.css        # NEW: Toggle button styles
    ListView/                 # EXISTS: from Phase 16
    ColumnView/               # EXISTS: unchanged
  App.tsx                     # MODIFIED: viewMode state, conditional rendering
src/main/
  storage/
    ui-preferences-store.ts   # MODIFIED: add viewMode field
  ipc/
    ui-preferences-handlers.ts # MODIFIED: add viewMode handlers
src/preload/
  preload.ts                  # MODIFIED: add viewMode get/set methods
```

### Pattern 1: View-Agnostic App.tsx Orchestration
**What:** App.tsx conditionally renders ColumnView or ListView based on viewMode state, passing the same props to both. The parent doesn't care which view is active.
**When to use:** This is the primary integration pattern for Phase 17.
**Example:**
```typescript
// Source: .planning/research/ARCHITECTURE.md lines 436-468
type ViewMode = 'columns' | 'list';

// In App.tsx state:
const [viewMode, setViewMode] = useState<ViewMode | null>(null); // null until loaded

// In render:
<div className="browser-columns">
  {viewMode === 'columns' ? (
    <ColumnView
      key={selectedServer}
      serverId={selectedServer}
      initialPath="/"
      navigateTo={navigateToPath}
      showHidden={showHidden ?? false}
      onFileSelect={handleFileSelect}
      onPathChange={handlePathChange}
      onNavigationComplete={handleNavigationComplete}
      onFavoritesChanged={handleFavoritesChanged}
      onMoveToClick={handleMoveToClick}
      onRefreshColumn={handleRefreshColumnCallback}
      onFilesLoaded={handleFilesLoaded}
    />
  ) : (
    <ListView
      key={selectedServer}
      serverId={selectedServer}
      initialPath="/"
      navigateTo={navigateToPath}
      showHidden={showHidden ?? false}
      onFileSelect={handleListFileSelect}
      onPathChange={handlePathChange}
      onNavigationComplete={handleNavigationComplete}
      onFavoritesChanged={handleFavoritesChanged}
      onMoveToClick={handleMoveToClick}
      onRefreshColumn={handleRefreshColumnCallback}
      onFilesLoaded={handleFilesLoaded}
    />
  )}
</div>
```

### Pattern 2: Persistence via electron-conf (showHiddenFiles Pattern)
**What:** Add viewMode to the existing UIPreferencesSchema, following the exact same pattern used for showHiddenFiles.
**When to use:** VIEW-03 requirement -- persist across app restarts.
**Example:**
```typescript
// Source: src/main/storage/ui-preferences-store.ts (existing pattern)
interface UIPreferencesSchema {
  columnWidths: number[];
  previewPanelWidth: number;
  showHiddenFiles: boolean;
  viewMode: 'columns' | 'list';  // NEW
}

const conf = new Conf<UIPreferencesSchema>({
  name: 'ui-preferences',
  defaults: {
    columnWidths: [],
    previewPanelWidth: 300,
    showHiddenFiles: false,
    viewMode: 'columns',  // Default to Miller columns (existing behavior)
  },
});

export function getViewMode(): 'columns' | 'list' {
  return conf.get('viewMode') ?? 'columns';
}

export function setViewMode(mode: 'columns' | 'list'): void {
  conf.set('viewMode', mode);
}
```

### Pattern 3: View Mode Toggle Component (Follows HiddenFilesToggle)
**What:** A toggle button in the toolbar that shows the active view mode and switches between them on click.
**When to use:** VIEW-01 requirement -- toolbar button to toggle views.
**Example:**
```typescript
// Follows exact structure of HiddenFilesToggle.tsx
interface ViewModeToggleProps {
  viewMode: 'columns' | 'list';
  onToggle: () => void;
}

function ViewModeToggle({ viewMode, onToggle }: ViewModeToggleProps): React.JSX.Element {
  return (
    <button
      className="view-toggle"
      onClick={onToggle}
      title={`Switch to ${viewMode === 'columns' ? 'list' : 'column'} view`}
      aria-label={`Current view: ${viewMode === 'columns' ? 'columns' : 'list'}. Click to switch.`}
      type="button"
    >
      {/* SVG icons for columns/list view */}
    </button>
  );
}
```

### Pattern 4: State Preservation on View Switch (VIEW-04)
**What:** When toggling view mode, the new view must show the same directory and (where possible) the same selected file as the old view.
**When to use:** Every view mode switch.
**Example:**
```typescript
const handleViewModeToggle = useCallback(() => {
  setViewMode(prev => {
    const newMode = prev === 'columns' ? 'list' : 'columns';
    window.electronAPI.setViewMode(newMode);
    return newMode;
  });
  // currentPath state is already in App.tsx -- both views read it
  // navigateToPath can be set to currentPath to force the new view
  // to show the same directory
  setNavigateToPath(currentPath);
}, [currentPath]);
```

**Critical insight:** `currentPath` is already tracked in App.tsx state via the `onPathChange` callback from both views. When switching, set `navigateToPath = currentPath` so the newly mounted view navigates to the same location. The `selectedFile` state is also in App.tsx already -- it persists across the switch automatically since it's not reset by view changes.

### Pattern 5: Keyboard Shortcuts (Cmd+1/Cmd+2)
**What:** Register keyboard shortcuts in App.tsx for switching view modes, matching macOS Finder convention.
**When to use:** VIEW-02 requirement.
**Example:**
```typescript
// In App.tsx, alongside existing Cmd+Shift+. handler for hidden files
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Cmd+1 -> Column view, Cmd+2 -> List view
    if (e.metaKey && !e.shiftKey && !e.altKey) {
      if (e.code === 'Digit1') {
        e.preventDefault();
        handleSetViewMode('columns');
      } else if (e.code === 'Digit2') {
        e.preventDefault();
        handleSetViewMode('list');
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleSetViewMode]);
```

### Anti-Patterns to Avoid
- **Mounting both views simultaneously with display:none:** Wastes memory and causes both views to make parallel directory fetches. Use conditional rendering instead.
- **Resetting currentPath on view switch:** The whole point of VIEW-04 is that the user stays in the same location. Do NOT clear path state when viewMode changes.
- **Coupling viewMode to selectedServer:** viewMode is a global UI preference, not per-server. Changing server should not change viewMode.
- **Using useState(false) for viewMode initial state:** The initial viewMode must come from IPC (persisted preference). Use `null` as initial state and load via useEffect on mount, same pattern as showHidden.
- **Forgetting to handle onFileSelect signature difference:** ColumnView's `onFileSelect(file, columnIndex)` vs ListView's `onFileSelect(file)`. The handler in App.tsx must work with both signatures.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistence | Custom localStorage/file storage | electron-conf via existing ui-preferences-store | Proven pattern, typed schema, already handles 3 other preferences |
| IPC bridge | Custom IPC wrapper | Existing ipcMain.handle / contextBridge pattern | Exact pattern exists 6 times in preload.ts already |
| Toolbar button | Complex toggle/segmented control library | Simple button component following HiddenFilesToggle pattern | Codebase already has this exact pattern -- 43 lines including CSS |
| Path synchronization | Complex shared state management / context | Pass currentPath as initialPath + navigateToPath | Both views already accept navigateTo prop for external navigation |
| View rebuild after switch | Custom caching / state preservation | ColumnView's existing NAVIGATE_TO action | ColumnView already rebuilds its column hierarchy from a path string |

**Key insight:** This phase has no novel technical challenges. Every pattern needed already exists in the codebase. The ViewModeToggle follows HiddenFilesToggle. The persistence follows showHiddenFiles. The conditional rendering is basic React. The state preservation uses existing navigateTo/currentPath props. The keyboard shortcuts follow the existing Cmd+Shift+. pattern.

## Common Pitfalls

### Pitfall 1: onFileSelect Signature Mismatch
**What goes wrong:** ColumnView calls `onFileSelect(file, columnIndex)` but ListView calls `onFileSelect(file)`. If App.tsx uses a single handler that expects `columnIndex`, it breaks for list view.
**Why it happens:** Phase 16 intentionally dropped `columnIndex` from ListView's `onFileSelect` because list view has no column concept. App.tsx currently relies on `columnIndex` in `handleFileSelect`.
**How to avoid:** Check the current `handleFileSelect` implementation in App.tsx. It receives `(file: FileEntry, columnIndex: number)` but in practice only uses `file` -- the columnIndex is logged but not used for any logic. Two approaches: (1) Make `handleFileSelect` accept `(file: FileEntry, columnIndex?: number)` -- safe since columnIndex is unused. (2) Create a wrapper: `handleListFileSelect = (file) => handleFileSelect(file, 0)`. Approach 1 is cleaner.
**Warning signs:** TypeScript error on the `onFileSelect` prop for ListView.

### Pitfall 2: View Switch Triggers Full Directory Re-fetch Cascade
**What goes wrong:** Switching from list view back to column view causes ColumnView to fetch every directory in the path hierarchy (/, /home, /home/user, /home/user/docs), showing loading spinners in every column.
**Why it happens:** ColumnView's NAVIGATE_TO action creates empty columns that need to be fetched. When the component mounts with `navigateTo={currentPath}`, it dispatches NAVIGATE_TO which creates N empty columns.
**How to avoid:** This is an acceptable tradeoff for v1.0 of view switching. The fetches are fast (each is a single SFTP readdir) and the UX shows progressive loading left-to-right. The alternative (caching directory results or keeping ColumnView mounted but hidden) adds significant complexity. Accept the re-fetch behavior now; optimize later if users notice.
**Warning signs:** Visible loading state in all columns after switching back to column view. This is expected behavior, not a bug.

### Pitfall 3: initialPath vs navigateTo Confusion
**What goes wrong:** When switching views, the new view opens at "/" instead of the current directory.
**Why it happens:** Both views accept `initialPath` (for mount-time path) and `navigateTo` (for runtime navigation). If you only set `initialPath="/"` and forget to trigger `navigateTo`, the new view starts at root.
**How to avoid:** Use `navigateTo={currentPath}` when switching views. The navigateTo prop is already how PathBar navigates both views. When a view switch happens, set `navigateToPath = currentPath` which both views will pick up. Both views already handle this: ColumnView dispatches NAVIGATE_TO, ListView sets currentPath.
**Warning signs:** View switch drops user to root directory.

### Pitfall 4: View Mode Toggle Not Visible During Connection
**What goes wrong:** The toolbar (including the view mode toggle) only renders when `currentState?.status === 'ready'`. If the toggle is inside the toolbar, users can't switch view mode before connecting.
**Why it happens:** The browser-toolbar is inside the `currentState?.status === 'ready'` conditional in App.tsx.
**How to avoid:** This is actually correct behavior -- there's nothing to view before connecting. The toggle should be in the toolbar, which only shows when connected. The persisted preference loads on mount regardless. If a user closes the app in list view and reconnects, the persisted viewMode is loaded before the toolbar appears.
**Warning signs:** Non-issue if persistence works correctly.

### Pitfall 5: Lightbox Navigation Breaks After View Switch
**What goes wrong:** Lightbox arrow key navigation through previewable files stops working after switching views.
**Why it happens:** App.tsx tracks `previewableFiles` via the `onFilesLoaded` callback. When the view component unmounts and remounts, the new view needs to call `onFilesLoaded` with its current files. If the new view hasn't finished loading yet, the previewableFiles array is empty.
**How to avoid:** Both views already call `onFilesLoaded` after fetching directory contents. The only gap is the brief moment between mount and first fetch completing. During this window, lightbox navigation won't have files. This is acceptable -- the same gap exists on initial load.
**Warning signs:** Lightbox arrow keys don't work immediately after view switch but start working after the directory finishes loading.

### Pitfall 6: Keyboard Shortcut Conflicts
**What goes wrong:** Cmd+1 or Cmd+2 might conflict with other electron or system shortcuts.
**Why it happens:** Electron apps on macOS can have Cmd+number shortcuts used by tab switching, bookmark access, etc.
**How to avoid:** Test that Cmd+1/Cmd+2 are not already bound. The existing codebase uses Cmd+Shift+. for hidden files but no Cmd+number shortcuts. macOS Finder uses Cmd+1 (Icon), Cmd+2 (List), Cmd+3 (Column), Cmd+4 (Gallery) -- our mapping reverses 2 and 3 to put our primary view (columns) on Cmd+1, which is more intuitive for this app. Alternatively, use the same convention as Finder (Cmd+2 for list, Cmd+3 for columns), but since we only have two modes, Cmd+1/Cmd+2 is cleaner.
**Warning signs:** Pressing Cmd+1 does nothing, or triggers unexpected behavior.

## Code Examples

Verified patterns from the existing codebase:

### Persistence Pattern (from showHiddenFiles, proven in 3 layers)
```typescript
// 1. Store (src/main/storage/ui-preferences-store.ts)
export function getViewMode(): 'columns' | 'list' {
  return conf.get('viewMode') ?? 'columns';
}
export function setViewMode(mode: 'columns' | 'list'): void {
  conf.set('viewMode', mode);
}

// 2. IPC Handler (src/main/ipc/ui-preferences-handlers.ts)
ipcMain.handle('ui:getViewMode', async (): Promise<string> => {
  return getViewMode();
});
ipcMain.handle('ui:setViewMode', async (_event, mode: string): Promise<void> => {
  setViewMode(mode as 'columns' | 'list');
});

// 3. Preload (src/preload/preload.ts)
getViewMode: (): Promise<string> =>
  ipcRenderer.invoke('ui:getViewMode'),
setViewMode: (mode: string): Promise<void> =>
  ipcRenderer.invoke('ui:setViewMode', mode),

// 4. App.tsx (load on mount)
useEffect(() => {
  window.electronAPI.getViewMode().then((mode) => {
    setViewMode(mode as ViewMode);
  });
}, []);
```

### Toggle Button Pattern (from HiddenFilesToggle.tsx, proven)
```typescript
// Source: src/renderer/components/HiddenFilesToggle.tsx
// Same structure: button + CSS class toggling + SVG icon
function ViewModeToggle({ viewMode, onToggle }: ViewModeToggleProps): React.JSX.Element {
  return (
    <button
      className="view-toggle"
      onClick={onToggle}
      title={viewMode === 'columns'
        ? 'Switch to list view (Cmd+2)'
        : 'Switch to column view (Cmd+1)'}
      type="button"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {viewMode === 'columns' ? (
          // Column view icon (vertical bars)
          <path d="M3 3h7v18H3V3zm11 0h7v18h-7V3z" />
        ) : (
          // List view icon (horizontal lines)
          <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
        )}
      </svg>
    </button>
  );
}
```

### Keyboard Shortcut Pattern (from hidden files toggle, proven)
```typescript
// Source: src/renderer/App.tsx lines 429-450
// Existing pattern: useEffect with window.addEventListener('keydown', handler)
// Skip if typing in input/textarea/contenteditable
// e.preventDefault() then call handler
```

### View Switch with Path Preservation
```typescript
// In App.tsx
const handleSetViewMode = useCallback((mode: ViewMode) => {
  setViewMode(mode);
  window.electronAPI.setViewMode(mode);
  // Force new view to navigate to current location
  setNavigateToPath(currentPath);
}, [currentPath]);
```

### handleFileSelect Alignment
```typescript
// Current signature:
const handleFileSelect = useCallback((file: FileEntry, columnIndex: number) => {
  console.log('Selected file:', file.name, 'in column', columnIndex);
  setSelectedFile(file);
}, []);

// Updated to support both views:
const handleFileSelect = useCallback((file: FileEntry, _columnIndex?: number) => {
  setSelectedFile(file);
}, []);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single view only (ColumnView) | Conditional rendering of ColumnView/ListView | Phase 17 | Users choose preferred browsing style |
| No view persistence | electron-conf viewMode field | Phase 17 | Choice survives app restarts |
| No keyboard view switching | Cmd+1/Cmd+2 shortcuts | Phase 17 | Power user workflow preserved |

**No deprecated APIs or patterns are involved.** All technology used is stable and currently maintained.

## Open Questions

1. **Should the SVG icons for the toggle show the CURRENT mode or the mode it WILL switch to?**
   - What we know: macOS Finder shows the current mode as the highlighted/active button in a segmented control. The toggle shows what you ARE in, not what you'll switch to.
   - Recommendation: Show the current mode's icon as active. The tooltip should say "Switch to [other] view". This matches the HiddenFilesToggle pattern where the icon shows the current state.

2. **Should switching back to ColumnView use navigateTo to deep-link, or use initialPath?**
   - What we know: ColumnView's `navigateTo` triggers `NAVIGATE_TO` which builds the full column hierarchy. Using `initialPath` only sets the root column.
   - Recommendation: Use `navigateTo` (not `initialPath`) to preserve the full path. Set `navigateToPath = currentPath` in the toggle handler. The ColumnView will rebuild its columns from the path.

3. **Should we clean up the orphaned DirectoryList.tsx and FileRow.tsx in this phase?**
   - What we know: Phase 16 research flagged these for removal. They are no longer used by any component.
   - Recommendation: Include as a final task in this phase. Low risk, reduces codebase noise. But make it a separate plan item, not mixed with the main integration work.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/renderer/App.tsx` - Complete current App.tsx with toolbar structure, conditional rendering, showHidden pattern, handleFileSelect signature, currentPath state, navigateToPath state
- Codebase analysis: `src/renderer/components/ColumnView/ColumnView.tsx` - ColumnView props interface, NAVIGATE_TO action for path reconstruction
- Codebase analysis: `src/renderer/components/ListView/ListView.tsx` - ListView props interface (Phase 16 output), callback compatibility
- Codebase analysis: `src/renderer/components/HiddenFilesToggle.tsx` - Toggle button pattern (43 lines, BEM CSS, SVG icon)
- Codebase analysis: `src/renderer/components/HiddenFilesToggle.css` - Toggle button CSS pattern
- Codebase analysis: `src/main/storage/ui-preferences-store.ts` - electron-conf schema, get/set pattern for showHiddenFiles
- Codebase analysis: `src/main/ipc/ui-preferences-handlers.ts` - IPC handler registration pattern
- Codebase analysis: `src/preload/preload.ts` - contextBridge exposure pattern, all existing IPC methods
- Codebase analysis: `src/shared/types.ts` - ElectronAPI type extension, Window interface
- Codebase analysis: `.planning/research/ARCHITECTURE.md` - View mode toggle architecture, conditional rendering pattern, App.tsx orchestration
- Codebase analysis: `.planning/research/PITFALLS.md` - State divergence pitfall, column rebuild on switch, preference scoping
- Codebase analysis: `.planning/research/FEATURES.md` - Keyboard shortcut convention (Cmd+1/Cmd+2), toolbar toggle expectation
- Codebase analysis: `.planning/phases/16-list-view-core/16-RESEARCH.md` - ListView interface design, Phase 17 compatibility notes
- Codebase analysis: `.planning/phases/16-list-view-core/16-02-SUMMARY.md` - Confirmed ListView callback interface

### Secondary (MEDIUM confidence)
- macOS Finder view mode conventions - Cmd+1/2/3/4 shortcuts, segmented control in toolbar, view mode persistence. Based on general macOS knowledge, not verified against current Finder documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all patterns directly derived from existing codebase
- Architecture: HIGH - Conditional rendering pattern documented in ARCHITECTURE.md and validated against current App.tsx structure
- Persistence: HIGH - Exact electron-conf pattern already implemented 3 times (columnWidths, previewPanelWidth, showHiddenFiles)
- Pitfalls: HIGH - All pitfalls identified from concrete codebase analysis (signature mismatch, re-fetch cascade, path preservation)
- Keyboard shortcuts: MEDIUM - Cmd+1/Cmd+2 convention based on Finder analogy, not verified against current Electron key bindings

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, no external dependencies changing)
