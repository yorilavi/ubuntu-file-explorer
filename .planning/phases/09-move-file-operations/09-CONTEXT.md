# Phase 9: Move File Operations - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Move files to different folders on the **same server** using a visual folder picker modal. User right-clicks or uses toolbar to trigger "Move to...", browses folders in modal, confirms destination. True move operation — file disappears from source, appears at destination.

Cross-server transfers are explicitly out of scope (that's a copy operation, not move).

</domain>

<decisions>
## Implementation Decisions

### Folder Picker Layout
- Single-column expandable tree (like VS Code sidebar or Finder sidebar)
- Opens starting at current folder (where the file being moved lives)
- Shows folders only — no files displayed in picker
- Icons + labels: folder icons, plus "Current folder" badge on source location

### Navigation Behavior
- Both breadcrumb trail AND back button for going up hierarchy
- Breadcrumb for jumping to any ancestor, back button for quick up-one-level
- Full keyboard support: arrow keys navigate, Enter expands/selects, Escape closes
- Prefetch visible folders (load one level ahead for smoother UX)
- "New Folder" button allows creating folder inline within picker

### Move Confirmation
- Explicit confirm button required — select folder, then click "Move Here"
- Confirmation shows both source and destination paths: "Move config.json to /home/user/backup"
- Name conflict handling: Modal asks user to choose — Replace, Keep Both (auto-rename), or Cancel
- Toast shows "Undo" button after move completes — clicking moves file back to original location

### Context Menu & Toolbar
- "Move to..." accessible via both right-click context menu AND toolbar button (when file selected)
- Icon: Folder with arrow pointing into it
- No keyboard shortcut

### Claude's Discretion
- Exact position of "Move to..." in context menu (grouped logically with existing file actions)
- Loading spinner/skeleton while folders load
- Exact "Keep Both" rename pattern (e.g., "file (1).txt" vs "file-copy.txt")
- Tree expand/collapse animation timing

</decisions>

<specifics>
## Specific Ideas

- Same-server moves only — this is a true move, not copy
- Undo in toast is important for user confidence

</specifics>

<deferred>
## Deferred Ideas

- **Cross-server copy/transfer** — Copying files between different connected servers. This is inherently a copy operation (file exists in both places). Should be its own phase with distinct UI for selecting source and destination servers.

</deferred>

---

*Phase: 09-move-file-operations*
*Context gathered: 2026-01-29*
