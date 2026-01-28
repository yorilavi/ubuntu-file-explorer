# Phase 6: Favorites & Polish - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Bookmark folders for quick access and deliver polished error handling with operation cancellation. Users can add/remove favorites, see them organized by server in the sidebar, and experience user-friendly errors with actionable recovery options. Long-running operations show progress and can be cancelled.

</domain>

<decisions>
## Implementation Decisions

### Favorites interaction
- Add via context menu OR drag folder to favorites section in sidebar
- Remove via context menu OR drag out of sidebar (poof animation like macOS Dock)
- Clicking a favorite navigates directly to that folder (auto-connect if disconnected)
- Favorites displayed as flat list under their server, indented

### Error presentation
- Connection errors shown inline (in context where failure occurred)
- Operation errors (upload/download/delete) shown as toast notifications
- Error messages show user-friendly text with "Show details" to reveal technical info
- Errors include actionable buttons (e.g., [Retry] [Edit Server])

### Operation cancellation
- Progress shown as toast with file name + progress bar + percentage
- All long operations cancellable (transfers, large directory listings, any op over ~2 seconds)
- Cancel via X button in progress toast AND Escape key as shortcut
- Cancellation confirmed with brief toast (e.g., "Upload cancelled")

### Sidebar organization
- Servers are collapsible - click to expand/collapse
- Favorites nested under server, shown when server expanded
- Users can drag to reorder favorites within a server
- Visual distinction: favorites indented under server with folder icon
- Missing favorites (folder deleted on server) shown grayed out with indicator, click to remove

### Claude's Discretion
- Toast duration based on error severity (brief for info, persistent for critical)
- Exact threshold for "long operation" (suggested ~2 seconds)
- Poof animation implementation details
- Specific expand/collapse arrow styling

</decisions>

<specifics>
## Specific Ideas

- Drag-out removal with poof animation like macOS Dock
- Auto-connect when clicking favorite on disconnected server
- Grayed out favorites for missing folders (like Finder shows missing aliases)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-favorites-polish*
*Context gathered: 2026-01-27*
