# Roadmap: Ubuntu File Explorer

## Milestones

- v1.0 MVP - Phases 1-6 (shipped 2026-01-28)
- v1.1 Feature Completion - Phases 7-11 (shipped 2026-01-30)
- v1.2 Folder Operations - Phases 12-14 (shipped 2026-01-30)
- **v1.3 Metadata & List View** - Phases 15-17 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) - SHIPPED 2026-01-28</summary>

Phases 1-6, 22 plans. See .planning/milestones/ for details.

</details>

<details>
<summary>v1.1 Feature Completion (Phases 7-11) - SHIPPED 2026-01-30</summary>

Phases 7-11, 10 plans. See .planning/milestones/ for details.

</details>

<details>
<summary>v1.2 Folder Operations (Phases 12-14) - SHIPPED 2026-01-30</summary>

Phases 12-14, 9 plans. See .planning/milestones/ for details.

</details>

### v1.3 Metadata & List View (In Progress)

**Milestone Goal:** Add file metadata display with a toggleable list view and sorting capabilities, giving users a detail-oriented alternative to Miller column navigation.

- [x] **Phase 15: Shared Utilities & Metadata** - Extract shared code from FileItem and prove metadata formatting (completed 2026-02-10)
- [x] **Phase 16: List View Core** - Build the complete list view with columns, sorting, virtualization, and interaction (completed 2026-02-10)
- [ ] **Phase 17: View Mode Integration** - Wire list view into the app with toggle, persistence, and state preservation

## Phase Details

### Phase 15: Shared Utilities & Metadata
**Goal**: Users can see formatted file metadata, and the codebase is ready for a second view to share context menu and formatting logic without duplication
**Depends on**: Phase 14 (v1.2 complete)
**Requirements**: META-01, META-02, META-03
**Success Criteria** (what must be TRUE):
  1. Format utilities produce human-readable file sizes (e.g., "4.2 KB", "1.3 MB", "2.1 GB") from raw byte counts
  2. Format utilities produce human-readable dates from SFTP mtime timestamps
  3. Format utilities map file extensions to kind labels (e.g., "Folder", "PNG Image", "TypeScript", "PDF Document")
  4. Context menu logic extracted into a reusable hook that FileItem.tsx consumes without behavior change (rename, delete, move, download, upload all still work identically)
**Plans:** 2 plans

Plans:
- [x] 15-01-PLAN.md -- Extract context menu hook from FileItem.tsx
- [x] 15-02-PLAN.md -- Metadata format utilities and kind mapping

### Phase 16: List View Core
**Goal**: Users can browse any directory in a full-width list view with sortable columns, fast scrolling through large directories, keyboard navigation, context menus, and preview panel integration
**Depends on**: Phase 15 (shared utilities available)
**Requirements**: LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, SORT-01, SORT-02, SORT-03, SORT-04
**Success Criteria** (what must be TRUE):
  1. User sees a tabular list with Name, Size, Date Modified, and Kind columns displaying formatted metadata for every file in the current directory
  2. User can click any column header to sort by that field, and click again to reverse sort direction, with a visible sort indicator on the active column
  3. Folders always appear above files in any sort order
  4. User can navigate files with up/down arrow keys and open folders/files with Enter, matching the responsiveness of Miller column navigation
  5. User can right-click any file row for the full context menu (rename, delete, move, download, upload) and selecting a file shows its preview in the preview panel
**Plans:** 2 plans

Plans:
- [x] 16-01-PLAN.md -- ListHeader and ListRow components with CSS Grid layout, sort types, and context menu integration
- [x] 16-02-PLAN.md -- ListView container with sorting, virtualization, keyboard navigation, and full callback wiring

### Phase 17: View Mode Integration
**Goal**: Users can switch between Miller column view and list view at will, with their preference remembered and their navigation state preserved across switches
**Depends on**: Phase 16 (ListView works standalone)
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04
**Success Criteria** (what must be TRUE):
  1. User can click a toolbar button to toggle between Miller columns and list view, and the toggle clearly indicates which mode is active
  2. User can press a keyboard shortcut to toggle view mode without reaching for the mouse
  3. View mode preference persists across app restarts (close app in list view, reopen in list view)
  4. Switching views preserves the current directory and selected file -- the user sees the same location and selection in the new view
**Plans:** 2 plans

Plans:
- [ ] 17-01-PLAN.md -- ViewModeToggle component and viewMode persistence layer (store, IPC handlers, preload)
- [ ] 17-02-PLAN.md -- App.tsx wiring with conditional rendering, keyboard shortcuts, and state preservation

## Progress

**Execution Order:** 15 -> 16 -> 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 15. Shared Utilities & Metadata | v1.3 | 2/2 | ✓ Complete | 2026-02-10 |
| 16. List View Core | v1.3 | 2/2 | ✓ Complete | 2026-02-10 |
| 17. View Mode Integration | v1.3 | 0/2 | Not started | - |

---
*Created: 2026-02-10*
*Last updated: 2026-02-11*
