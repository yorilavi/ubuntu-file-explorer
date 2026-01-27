# Phase 3: Column View Navigator - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Finder-style Miller column navigation for browsing remote directories. Users can navigate with keyboard and mouse, see their current path, and browse large directories smoothly. Preview panel and file operations are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Column behavior
- Columns are user-resizable (drag column edges to adjust width)
- Horizontal scroll to show all columns — keep all columns in memory, don't remove older ones
- Clicking a different folder clears all columns to the right, then shows that folder's contents
- Auto-scroll to show new column only when it would be off-screen (not always)
- When navigating backward (left arrow), restore selection to the folder you came from

### Selection & focus
- Multi-select supported via Cmd-click (toggle) and Shift-click (range)
- Enter key behaves same as Right arrow — opens folder in new column
- No cross-column multi-select (selection resets when navigating to different column)

### Path bar interaction
- Clicking a path segment navigates to that folder, clears columns to the right
- Path bar is editable — click or keyboard shortcut to type a path directly and press Enter

### Visual feedback
- Subtle hover effect on items (light background change)

### Claude's Discretion
- File selection behavior (whether selecting a file clears columns to its right)
- Minimum column width constraint
- Whether column widths persist across sessions
- Auto-select first item when navigating into a folder with Right arrow
- Multi-select scope (single column recommended)
- Path bar visual style (breadcrumb vs full path)
- Path bar position (top vs bottom)
- Loading state indicator (spinner vs skeleton)
- Selection highlight style
- Folder chevron/expansion indicator

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants Finder-like behavior as the reference point.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-column-view-navigator*
*Context gathered: 2026-01-27*
