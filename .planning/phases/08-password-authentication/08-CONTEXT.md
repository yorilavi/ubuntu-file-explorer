# Phase 8: Password Authentication - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can connect to servers using password authentication as an alternative to SSH keys. Includes auth method selection in connection form, secure password storage via safeStorage, and remembering auth preference per server.

</domain>

<decisions>
## Implementation Decisions

### Auth method selection
- Dropdown/select control for choosing between SSH Key and Password
- Default to SSH Key for new connections (more secure)
- Auto-detect on failure: if selected method fails, show inline suggestion to try alternative
- Inline suggestion format: error message with "Try password auth?" link

### Password entry UX
- Eye icon toggle to show/hide password
- When editing saved connection: show placeholder dots (••••••••) indicating password exists
- First keystroke clears placeholder, user types new password (clear and replace behavior)
- No real-time validation - accept any input, let server reject bad passwords

### Password storage behavior
- Ask each time: "Save password?" checkbox when saving connection
- If user chooses not to save: show full connection form with empty password field on next connect
- Explicit "Clear saved password" button when editing connection with stored password
- No special warning when deleting connection - password deleted silently with connection

### Connection form layout
- Auth method dropdown appears after Port field: Host → Port → Auth Method → credentials
- Instant swap when auth method changes (no animation)
- No visual grouping - auth fields inline with other form fields

### Claude's Discretion
- "Save password?" checkbox placement (inline or below password field)
- Exact wording for "Try password auth?" suggestion
- Error message formatting for auth failures

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-password-authentication*
*Context gathered: 2026-01-29*
