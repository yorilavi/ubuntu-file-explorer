---
phase: 06-favorites-polish
plan: 01
completed: 2026-01-28
duration: 4 min

subsystem: storage
tags: [electron-conf, ipc, favorites, dnd-kit, sonner]

dependency-graph:
  requires: [02-01]  # electron-conf pattern from connection-store
  provides: [favorites-store, favorites-ipc-handlers, favorites-preload-api]
  affects: [06-02, 06-03, 06-04, 06-05]  # all subsequent favorites plans use this

tech-stack:
  added:
    - sonner@2.0.7
    - "@dnd-kit/core@6.3.1"
    - "@dnd-kit/sortable@10.0.0"
    - "@dnd-kit/utilities@3.2.2"
  patterns: [per-server-storage, ipc-crud-bridge]

key-files:
  created:
    - src/main/storage/favorites-store.ts
    - src/main/ipc/favorites-handlers.ts
  modified:
    - package.json
    - src/main/main.ts
    - src/preload/preload.ts
    - src/renderer/components/FileItem.tsx

decisions:
  - id: separate-favorites-config
    choice: "name: 'favorites' for separate electron-conf file"
    rationale: "Isolates favorites data from connection metadata"
  - id: sync-functions-async-handlers
    choice: "Store functions sync, IPC handlers async"
    rationale: "Consistent async IPC pattern, store ops are fast enough"

metrics:
  tasks: 2
  commits: 2
  files-changed: 6
---

# Phase 6 Plan 1: Favorites Storage with IPC Bridge Summary

Per-server favorites persistence using electron-conf with full IPC bridge to renderer.

## What Was Built

### Favorites Store (`src/main/storage/favorites-store.ts`)
- **Schema:** `Record<string, string[]>` - serverId maps to ordered array of folder paths
- **Separate config file:** Uses `name: 'favorites'` to create distinct storage from connections
- **Exported functions:**
  - `getFavorites(serverId)` - returns favorites array for server
  - `addFavorite(serverId, path)` - adds path if not exists
  - `removeFavorite(serverId, path)` - removes path from array
  - `reorderFavorites(serverId, paths)` - replaces entire array for drag-drop

### IPC Handlers (`src/main/ipc/favorites-handlers.ts`)
- Registered 4 IPC channels: `favorites:get`, `favorites:add`, `favorites:remove`, `favorites:reorder`
- Async handlers wrapping sync store functions for IPC consistency
- Console logging for debugging

### Preload API Extensions
- Added 4 methods to `window.electronAPI`:
  - `getFavorites(serverId): Promise<string[]>`
  - `addFavorite(serverId, path): Promise<void>`
  - `removeFavorite(serverId, path): Promise<void>`
  - `reorderFavorites(serverId, paths): Promise<void>`

### UI Dependencies Installed
- **sonner@2.0.7** - Toast notifications for favorites actions
- **@dnd-kit/core@6.3.1** - Core drag-and-drop primitives
- **@dnd-kit/sortable@10.0.0** - Sortable list functionality
- **@dnd-kit/utilities@3.2.2** - Utility functions for transforms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed unused columnIndex parameter**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `columnIndex` destructured but never used in FileItem.tsx
- **Fix:** Renamed to `_columnIndex` to indicate intentionally unused
- **Files modified:** src/renderer/components/FileItem.tsx
- **Commit:** 549fc51

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 549fc51 | feat | Add favorites store and install UI dependencies |
| 933f344 | feat | Create IPC handlers and extend preload for favorites |

## Verification

- [x] npm install completed without errors
- [x] TypeScript compiles without errors
- [x] App starts and renders correctly
- [x] Console shows `[favorites-handlers] Registered favorites IPC handlers`
- [x] Favorites operations available on window.electronAPI

## Next Phase Readiness

**Ready for Plan 06-02:** FavoritesPanel UI component can now call:
- `window.electronAPI.getFavorites(serverId)` to load favorites
- `window.electronAPI.addFavorite(serverId, path)` to save new favorites
- `window.electronAPI.removeFavorite(serverId, path)` to delete
- `window.electronAPI.reorderFavorites(serverId, paths)` for drag-drop

No blockers. Storage layer complete.
