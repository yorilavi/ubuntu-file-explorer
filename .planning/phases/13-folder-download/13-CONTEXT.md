# Phase 13: Folder Download - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Download remote folders to local Mac recursively with progress tracking and error recovery. Users right-click a remote folder, pick a local destination, and download all contents. Structure is preserved, progress is visible, failed files can be retried. This is the download counterpart to Phase 12's upload.

</domain>

<decisions>
## Implementation Decisions

### Conflict handling
- Default behavior: Rename with suffix when file exists locally
- Naming pattern: Suffix before extension — "document (1).pdf" (Finder style)
- When to check: Per-file during download, not pre-scan
- "Apply to all" checkbox in conflict dialog — user can choose overwrite/skip/rename once for remaining conflicts

### Progress display
- Toast with progress bar (bottom-right, matching upload style)
- Show: File count + size — "23 of 85 files • 45 MB of 120 MB"
- Dock progress bar enabled (visible when app minimized)
- Cancellation: Both cancel button on toast and ESC key supported

### Retry behavior
- Toast with retry button when files fail — "3 files failed" with Retry button
- Failed files list viewable on hover/click before retrying
- Partial files deleted on cancel — no corrupt files left behind
- Retry toast stays 15 seconds (matches upload pattern)

### Download trigger
- Context menu: "Download Folder" label, grouped near existing Download File
- No keyboard shortcut — context menu only
- Multi-select supported: All selected folders download to same chosen destination

### Claude's Discretion
- Conflict dialog styling and layout
- Current file name display during download (if shown)
- Error message wording in failed files list
- Order of download (depth-first vs breadth-first)

</decisions>

<specifics>
## Specific Ideas

- Conflict dialog should have "Apply to all" checkbox that remembers choice for rest of download
- Progress shows both file count AND byte size for data volume awareness
- Match Phase 12 patterns where applicable (toast style, dock progress, 15-second retry)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-folder-download*
*Context gathered: 2026-01-30*
