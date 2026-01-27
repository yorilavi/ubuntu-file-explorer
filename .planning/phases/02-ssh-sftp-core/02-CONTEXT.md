# Phase 2: SSH/SFTP Core - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

User can connect to remote servers and browse directory contents. This includes parsing ~/.ssh/config, adding custom connections with persistence, authenticating via SSH keys/password/agent, and displaying directory listings with metadata. Miller column navigation and file operations are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Server List UI
- Grouped by source: "From SSH Config" and "Custom Connections" as separate sections
- Each server shows name + hostname underneath
- Scrollable list with search/filter box at top
- Left sidebar, always visible while browsing

### Connection Flow
- Inline status on server row showing stages: "Resolving...", "Authenticating...", "Loading directory..."
- Non-blocking: rest of UI stays interactive during connection
- On failure: inline error on server row with button to expand troubleshooting suggestions
- No auto-retry: fail immediately, user decides when to retry
- Multiple simultaneous connections supported

### Custom Connection Form
- Modal dialog for adding connections
- Fields: host, port, username, auth method, optional display name
- SSH key selection: auto-detect keys from ~/.ssh as suggestions + manual file picker option
- Auth methods supported: SSH keys, password, SSH agent forwarding

### Directory Listing
- Full details per file: name, size, modified date, permissions, owner
- Hidden files (dotfiles) hidden by default, toggle to show
- User-sortable columns (click headers) with option to keep folders first
- Symlinks show arrow badge overlay on icon (Finder-style)

### Claude's Discretion
- Visual treatment for connected vs disconnected servers in sidebar
- Loading states and skeleton designs
- Exact spacing, typography, and color choices
- Error message wording and troubleshooting suggestions

</decisions>

<specifics>
## Specific Ideas

- Connection status should feel like Finder's sidebar — ambient indicators, not blocking modals
- Stages during connect (Resolving, Authenticating, Loading) provide useful feedback without being intrusive
- Full file metadata is important since this is for server administration use cases

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-ssh-sftp-core*
*Context gathered: 2026-01-27*
