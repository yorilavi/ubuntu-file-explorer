# Research Summary: List View, Metadata Display & Sorting

**Domain:** Electron SSH/SFTP file manager enhancement
**Researched:** 2026-02-10
**Overall confidence:** HIGH

## Executive Summary

This research covers adding file metadata display, a list/detail view mode, and configurable sorting to an existing Electron SSH file explorer that currently uses Miller columns as its primary navigation paradigm. The investigation focused on how these features integrate with the existing architecture, what new components are needed, how SFTP stat data flows through IPC, and the suggested build order.

The key finding is that **the data layer requires zero changes**. The existing SFTP `readdir` implementation in `sftp-service.ts` already extracts full file metadata (size, mtime, permissions, uid, gid, symlink target) from the ssh2 `entry.attrs` object. This data already flows through IPC via the `ssh:list-directory` channel and arrives in the renderer as complete `FileEntry` objects. The Miller column view (`FileItem.tsx`) simply ignores most of this data, displaying only name, type, and symlink status.

Furthermore, the codebase contains **orphaned list view components** (`DirectoryList.tsx`, `FileRow.tsx`) from an earlier development phase. These include working sort logic, metadata formatting utilities (`formatSize`, `formatDate`, `formatPermissions`), and CSS grid layout for tabular file display. While they cannot be used directly (they lack integration with the current PathBar, preview panel, lightbox, context menus, and keyboard navigation), they serve as concrete reference implementations.

No new dependencies are needed. The existing `@tanstack/react-virtual` (v3.13.18) handles virtualization, `electron-conf` (v1.3.0) handles preference persistence, and CSS Grid handles the tabular layout.

## Key Findings

**Stack:** Zero new dependencies. @tanstack/react-virtual for virtualization, electron-conf for persistence, CSS Grid for layout -- all already in the project.

**Architecture:** ListView as a sibling component to ColumnView (not a mode within it), sharing the same App.tsx callback interface. Context menu logic extracted from FileItem into a shared hook to prevent duplication.

**Critical pitfall:** The context menu extraction from FileItem.tsx (763 lines with complex toast/operation state) is the highest-risk refactor. If the hook boundary is drawn incorrectly, both Miller column and list view context menus break.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Shared Utilities Extraction** - Foundation
   - Addresses: Format utilities, context menu hook, FileItem refactor
   - Avoids: Code duplication between column and list view
   - Rationale: Both Phase 2 (ListView) and the existing ColumnView benefit from extracted utilities. Must happen first to prevent duplicating 600+ lines of context menu code.

2. **Phase 2: ListView Core** - Data + Rendering
   - Addresses: ListHeader, ListRow, ListView container with sort, virtualization, keyboard nav
   - Avoids: Building on unstable foundation
   - Rationale: Build bottom-up (header, row, container). Virtualization is mandatory for parity with Miller columns on large directories.

3. **Phase 3: View Mode Integration** - App Orchestration
   - Addresses: ViewModeToggle, persistence, App.tsx wiring, path synchronization
   - Avoids: Integrating before ListView works standalone
   - Rationale: Wire into app only after ListView is working and tested in isolation.

4. **Phase 4: Polish** - Keyboard, a11y, edge cases
   - Addresses: Full keyboard nav, lightbox integration, accessibility
   - Avoids: Premature polish on incomplete features
   - Rationale: Match quality level of existing Miller column implementation.

**Phase ordering rationale:**
- Phase 1 must precede Phase 2 because ListView components depend on extracted utilities
- Phase 2 must precede Phase 3 because App integration requires a working ListView
- Phase 4 is polish that requires Phase 3 complete

**Research flags for phases:**
- Phase 1: Context menu hook extraction needs careful testing -- FileItem has complex async state (toast refs, operation IDs, cancel tracking). This is the riskiest refactor.
- Phase 2: Standard patterns, unlikely to need additional research. Virtualization and sort are proven in the codebase.
- Phase 3: Standard patterns. View mode persistence follows existing showHiddenFiles preference pattern exactly.
- Phase 4: Keyboard navigation may need a new hook or generalized version of useColumnNavigation, since the existing hook assumes multi-column layout.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new deps. All technologies already in use and proven in the codebase. |
| Features | HIGH | File manager list view patterns are 20+ years mature. Finder/Explorer/Nautilus behavior is well-understood. |
| Architecture | HIGH | Based on direct codebase analysis. Sibling component approach avoids disrupting working ColumnView. |
| Pitfalls | MEDIUM-HIGH | Context menu extraction is the main risk. Sort/virtualization/persistence pitfalls are low-risk given existing patterns. |

## Gaps to Address

- **Context menu hook boundary**: Need to validate that toast state (refs, IDs) can be cleanly extracted from component-level state to hook-level state without breaking the cancel/progress flow.
- **Keyboard navigation generalization**: useColumnNavigation assumes multi-column layout. List view needs either a separate hook or a generalized version. Decision can be made during Phase 2 implementation.
- **Sort in column view**: Whether to add sort controls to Miller columns (in addition to list view) is a scope question. Research recommends deferring this to after list view is complete -- it is a differentiator, not table stakes.
