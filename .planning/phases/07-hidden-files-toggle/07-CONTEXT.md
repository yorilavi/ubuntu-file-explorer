# Phase 7: Hidden Files Toggle - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Toggle visibility of dotfiles (hidden files) with Cmd+Shift+. keyboard shortcut. Preference persists across sessions. Users can see current toggle state in UI.

</domain>

<decisions>
## Implementation Decisions

### Toggle UI location
- Claude decides placement (toolbar or status bar based on existing UI patterns)
- Clickable button — user can click to toggle in addition to keyboard shortcut
- Button only appears when connected to a server (not on connection screen)
- Tooltip on hover showing "Toggle hidden files (⌘⇧.)"

### Default state
- Hidden files are hidden by default on first launch (matches Finder behavior)
- Global preference — one setting applies to all servers
- Auto-refresh when toggling — immediately shows/hides files in all visible columns

### Visual feedback
- Filled/highlighted icon when hidden files are visible (button looks "active")
- Subtle fade animation when hidden files appear/disappear
- Hidden files render dimmed/faded (~50% opacity) to distinguish from regular files

### Filtering behavior
- Hidden files = dotfiles (files/folders starting with .) plus common system files
- Hardcoded system file list: .DS_Store, Thumbs.db, desktop.ini, etc.
- Hidden folders completely hidden when toggle is off — can't navigate into them

### Claude's Discretion
- Exact icon design for the toggle button
- Specific animation timing for fade effect
- Exact opacity value for dimmed files
- Exact list of hardcoded system files to filter

</decisions>

<specifics>
## Specific Ideas

- Matches macOS Finder behavior: Cmd+Shift+. shortcut, hidden by default, dimmed appearance
- Toggle should feel immediate and responsive

</specifics>

<deferred>
## Deferred Ideas

- Configurable ignore patterns (user-editable list of files to hide) — future phase/backlog

</deferred>

---

*Phase: 07-hidden-files-toggle*
*Context gathered: 2026-01-29*
