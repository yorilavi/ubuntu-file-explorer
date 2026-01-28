---
phase: 06-favorites-polish
plan: 03
completed: 2026-01-28
duration: 2 min 20 sec

subsystem: ui
tags: [react, dnd-kit, sidebar, favorites, hooks]

dependency-graph:
  requires: [06-01]  # favorites storage and IPC bridge
  provides: [useFavorites-hook, FavoriteItem-component, collapsible-sidebar]
  affects: [06-04, 06-05]  # add to favorites and drag reorder plans

tech-stack:
  added: []  # dnd-kit already installed in 06-01
  patterns: [custom-hook-crud, sortable-dnd-list, collapsible-sections]

key-files:
  created:
    - src/renderer/hooks/useFavorites.ts
    - src/renderer/components/FavoriteItem.tsx
  modified:
    - src/renderer/components/ServerSidebar.tsx
    - src/renderer/index.css
    - src/renderer/App.tsx

decisions:
  - id: favorites-under-selected-server
    choice: "Show favorites only under selected and connected server"
    rationale: "Reduces visual clutter, focuses on active connection"
  - id: separate-drag-handle
    choice: "Drag handle separate from click target"
    rationale: "Prevents accidental navigation while dragging"
  - id: optimistic-ui-updates
    choice: "Update local state immediately, persist in background"
    rationale: "Responsive UX, API call latency hidden from user"

metrics:
  tasks: 3
  commits: 3
  files-changed: 5
---

# Phase 6 Plan 3: Collapsible Sidebar with Draggable Favorites Summary

Collapsible server sections with drag-to-reorder favorites list using @dnd-kit sortable.

## What Was Built

### useFavorites Hook (`src/renderer/hooks/useFavorites.ts`)
- **CRUD operations:** getFavorites, addFavorite, removeFavorite, reorderFavorites
- **Loading state:** isLoading boolean for UI feedback
- **Automatic refresh:** Reloads favorites when serverId changes
- **Optimistic updates:** Local state updates immediately before API call completes
- **Null safety:** Graceful handling when no server selected

### FavoriteItem Component (`src/renderer/components/FavoriteItem.tsx`)
- **Draggable:** Uses @dnd-kit/sortable useSortable hook
- **Separate drag handle:** Prevents accidental navigation during drag
- **Folder name extraction:** Parses path to show only folder name
- **Full path tooltip:** Hover to see complete path
- **Remove button:** Appears on hover, stops propagation

### ServerSidebar Refactor (`src/renderer/components/ServerSidebar.tsx`)
- **Collapsible sections:** Click chevron to expand/collapse server
- **Visual indicator:** Chevron rotates 90deg when open
- **Favorites display:** Shows under selected + connected server
- **DnD context:** Wraps favorites list with DndContext and SortableContext
- **Navigation callback:** onFavoriteNavigate prop wired through App.tsx

### CSS Styles (`src/renderer/index.css`)
- **sidebar-server:** Border-bottom separator between servers
- **sidebar-server__header:** Flex layout with chevron and name
- **sidebar-server__chevron:** 90deg rotation animation for open state
- **sidebar-server__content:** max-height transition for collapse effect
- **favorites-list:** Left padding to indent under server
- **favorite-item:** Hover states, drag handle, remove button visibility

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 71addf9 | feat | Create useFavorites hook for favorites CRUD |
| 90aa786 | feat | Create FavoriteItem component with drag support |
| b3efeaf | feat | Add collapsible server sections with draggable favorites |

## Verification

- [x] TypeScript compiles without errors
- [x] App starts and renders correctly
- [x] Server sections have expand/collapse chevron
- [x] Clicking chevron toggles visibility
- [x] Favorites list appears under connected server
- [x] useFavorites hook exports all CRUD operations
- [x] FavoriteItem integrates with @dnd-kit/sortable

## Next Phase Readiness

**Ready for Plan 06-04:** Add to Favorites button in context menu can now call:
- `useFavorites(serverId).addFavorite(path)` to save new favorites

**Ready for Plan 06-05:** Drag reorder is already working:
- Favorites can be dragged within the list
- Order persists via reorderFavorites API call

No blockers. UI infrastructure for favorites complete.
