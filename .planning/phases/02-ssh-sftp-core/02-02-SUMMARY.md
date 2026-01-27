---
phase: 02-ssh-sftp-core
plan: 02
subsystem: ssh
tags: [ssh2, sftp, ipc, electron, preload]

# Dependency graph
requires:
  - phase: 02-01
    provides: SSH dependencies (ssh2, ssh-config), type definitions, storage services
provides:
  - SSH connection service with promise wrappers
  - SFTP directory listing service
  - IPC handlers for all SSH operations
  - Preload API exposing SSH to renderer
affects: [03-ui-shell, 04-file-browser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Promise wrapping for ssh2 callbacks
    - State machine for connection lifecycle
    - IPC handler pattern for Electron main/renderer communication
    - Type duplication for preload isolation

key-files:
  created:
    - src/main/ssh/ssh-service.ts
    - src/main/ssh/sftp-service.ts
    - src/main/ipc/ssh-handlers.ts
  modified:
    - src/main/main.ts
    - src/preload/preload.ts
    - src/shared/types.ts
    - vite.main.config.ts

key-decisions:
  - "Mark ssh2, ssh-config, electron-conf as Vite externals to avoid native module bundling"
  - "Cache SFTP wrappers per connection for reuse"
  - "Duplicate types in preload/shared due to Vite bundler isolation"

patterns-established:
  - "Promise wrappers for ssh2 callback APIs"
  - "State callback for broadcasting connection state to renderer"
  - "IPC handler registration in createWindow"
  - "Preload API pattern for SSH operations"

# Metrics
duration: 3min 54sec
completed: 2026-01-27
---

# Phase 02 Plan 02: SSH Service & IPC Integration Summary

**SSH connection service with key/agent/password auth, SFTP directory listing, and IPC bridge to renderer**

## Performance

- **Duration:** 3 min 54 sec
- **Started:** 2026-01-27T18:46:47Z
- **Completed:** 2026-01-27T18:50:41Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Created SSHService managing connections via Map with promise-wrapped ssh2 API
- Created SFTPService for directory listing with proper mode bit parsing
- Wired up all IPC handlers bridging SSH operations to renderer process
- Exposed typed SSH API in preload for renderer consumption
- Fixed Vite bundling issue by marking native modules as external

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SSH connection service** - `28a601a` (feat)
2. **Task 2: Create SFTP service for directory listing** - `3f0f0e6` (feat)
3. **Task 3: Create IPC handlers and update preload** - `97bd4c2` (feat)

## Files Created/Modified

- `src/main/ssh/ssh-service.ts` - SSH connection management with promise wrappers
- `src/main/ssh/sftp-service.ts` - SFTP directory listing with FileEntry mapping
- `src/main/ipc/ssh-handlers.ts` - IPC handlers for all SSH operations
- `src/main/main.ts` - Registers SSH handlers in createWindow
- `src/preload/preload.ts` - Exposes SSH API to renderer (listServers, connect, etc.)
- `src/shared/types.ts` - SSH types for renderer access
- `vite.main.config.ts` - External modules configuration

## Decisions Made

1. **Mark native modules as Vite externals:** ssh2 has native bindings (.node files) that cannot be bundled by Vite. Marked ssh2, ssh-config, and electron-conf as external in vite.main.config.ts.

2. **Cache SFTP wrappers:** SFTP session creation is expensive, so we cache the wrapper per connection and reuse it for subsequent operations.

3. **Duplicate types for preload:** Due to Vite's bundler isolation, the preload script cannot import types from main process files. Types are duplicated in preload.ts and shared/types.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Vite bundling of native modules**
- **Found during:** Task 3 (app startup verification)
- **Issue:** Vite attempted to bundle ssh2's native .node files, causing "Unexpected character" error
- **Fix:** Added ssh2, ssh-config, electron-conf to external array in vite.main.config.ts
- **Files modified:** vite.main.config.ts
- **Verification:** App starts successfully, SSH handlers register correctly
- **Committed in:** 97bd4c2 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Essential fix for app to start. No scope creep.

## Issues Encountered

None beyond the deviation noted above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SSH connection and SFTP directory listing ready for UI consumption
- All IPC channels registered and exposed via preload
- Connection state changes broadcast to renderer via ssh:state-change
- Ready for Phase 3: UI Shell with server list and connection management

---
*Phase: 02-ssh-sftp-core*
*Completed: 2026-01-27*
