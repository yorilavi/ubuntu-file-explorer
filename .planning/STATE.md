# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** Browse remote servers visually with instant image and code previews
**Current focus:** Phase 5 - File Operations

## Current Position

Phase: 5 of 6 (File Operations)
Plan: 2 of 3
Status: In progress
Last activity: 2026-01-28 - Completed 05-02-PLAN.md (IPC handlers)

Progress: [█████████░] 89%

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 4 min
- Total execution time: 1 hour

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-security | 2 | 10 min 8 sec | 5 min 4 sec |
| 02-ssh-sftp-core | 4 | 20 min 11 sec | 5 min 3 sec |
| 03-column-view-navigator | 4 | 19 min 22 sec | 4 min 51 sec |
| 04-preview-panel | 4 | 12 min | 3 min |
| 05-file-operations | 2 | 2 min 52 sec | 1 min 26 sec |

**Recent Trend:**
- Last 5 plans: ~4m, 3m, 3m, 1m
- Trend: Stable/Fast

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Decision | Rationale | Plan |
|----------|-----------|------|
| @vitejs/plugin-react@4.7.0 | Version 5.x ESM-only, incompatible with Electron Forge Vite plugin | 01-01 |
| TypeScript 5.5.0 | Template 4.5.4 incompatible with modern @types/node | 01-01 |
| Explicit security options | Documents security posture, prevents accidental disable | 01-01 |
| Import shared/types.ts for Window augmentation | Ensures TypeScript sees extended Window interface | 01-02 |
| electron-conf over electron-store | CommonJS/ESM compatibility with Electron Forge Vite | 02-01 |
| Separate credentials config file | Isolates sensitive data from general connection metadata | 02-01 |
| Mark ssh2/ssh-config/electron-conf as Vite externals | Native modules cannot be bundled by Vite | 02-02 |
| Cache SFTP wrappers per connection | SFTP session creation is expensive, reuse for performance | 02-02 |
| Duplicate types in preload and shared | Vite bundler isolation prevents importing from main | 02-02 |
| BEM CSS naming for component styles | Consistent naming convention for all UI components | 02-03 |
| Status text for transient states, dots for persistent | Clear visual distinction between connecting and connected/error | 02-03 |
| Folders always sorted first in directory listing | Expected UX behavior, regardless of sort column | 02-04 |
| Explicit Date conversion for IPC serialization | IPC serializes Date objects as strings, must convert | 02-04 |
| Custom keyboard navigation over react-roving-tabindex | Better control for virtual scrolling integration | 03-01 |
| Set-based selectedIndices for multi-select | O(1) lookup for efficient Cmd-click, Shift-click | 03-01 |
| CSS-only icons using pseudo-elements | Lightweight folder/file icons without SVG overhead | 03-02 |
| Fixed 28px row height for virtualization | Required for @tanstack/react-virtual scroll calculations | 03-02 |
| Group/Panel/Separator (react-resizable-panels v4) | Correct API for v4, not older PanelGroup/PanelResizeHandle | 03-03 |
| Key prop excludes path | Prevents ColumnView remount on every navigation | 03-04 |
| Focus on loading complete | Ensures keyboard nav works without manual click | 03-04 |
| 500MB cache limit for preview files | Reasonable default balancing disk usage with performance | 04-01 |
| MD5 hash for cache keys | Fast, deterministic, collision-resistant for file paths | 04-01 |
| Separate metadata files for staleness | Quick staleness checks without reading full cached data | 04-01 |
| Async LRU eviction | Cache operations don't block on cleanup | 04-01 |
| File type detection by extension only | Content sniffing requires reading file, extension is instant | 04-02 |
| Base64 data URLs for images | Electron IPC handles base64 safely, blob transfer more complex | 04-02 |
| 50MB file size limit for previews | Balance between capability and memory safety | 04-02 |
| 500 line truncation for code previews | Keep preview fast and responsive | 04-02 |
| 150ms debounce for preview loading | Per CONTEXT.md specification for file preview | 04-03 |
| Request ID tracking for stale responses | Prevents race conditions when rapidly changing selection | 04-03 |
| Line numbers off by default for code | Per CONTEXT.md, users can toggle on if desired | 04-03 |
| System theme preference for code highlighting | Uses prefers-color-scheme for dark/light mode | 04-03 |
| Custom event for cross-component communication | 'open-lightbox' event bridges App and PreviewPanel | 04-04 |
| useRef for async state in event handlers | Captures current preview state for spacebar handler | 04-04 |
| Single image mode in lightbox | Simple first approach, no prev/next navigation | 04-04 |
| path.posix for remote paths | POSIX format required for SFTP operations | 05-01 |
| Stream-based file transfers | Progress callbacks via data event tracking | 05-01 |
| Empty folder delete only | MVP limitation per RESEARCH.md recommendation | 05-01 |
| showSaveDialog for download destination | Native overwrite confirmation handling | 05-02 |
| showMessageBox with warning for delete | Clear confirmation before destructive action | 05-02 |
| showOpenDialog with openDirectory for move-with-picker | Native folder picker for destination selection | 05-02 |

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-28 03:15 UTC
Stopped at: Completed 05-02-PLAN.md (IPC handlers)
Resume file: None

**Recent Activity:**
1. Added TransferProgress and FileOperationResult types to shared/types.ts
2. Created file-operations-handlers.ts with 6 IPC handlers
3. Integrated native Electron dialogs (save, open, confirm, folder picker)
4. Extended preload.ts with 7 file operation methods

**Next Action:** Execute 05-03-PLAN.md (context menu and toolbar)

---
*Last updated: 2026-01-28*
