# Project Research Summary

**Project:** Ubuntu File Explorer
**Domain:** Desktop SSH/SFTP File Management Application
**Researched:** 2026-01-26
**Confidence:** HIGH

## Executive Summary

This project builds a desktop SSH file explorer that brings macOS Finder's visual browsing experience to remote Ubuntu servers. Research shows this is best accomplished with Electron 40 (latest stable) using React 19 for the UI and ssh2-sftp-client for SSH/SFTP operations. The core differentiator is the Miller column view combined with instant file previews, a combination that competing SFTP clients (Transmit, FileZilla, Cyberduck) largely lack.

The recommended approach follows Electron's security-first architecture with strict process separation: all SSH operations run in the main process, the renderer handles only UI, and a minimal IPC bridge connects them via typed preload scripts. The stack is proven and well-documented, with ssh2-sftp-client handling over 200 languages for syntax highlighting via Shiki, and Zustand managing UI state without Redux overhead.

The primary risk is memory management during bulk operations. ssh2's JavaScript implementation consumes significantly more memory than native tools and transfers 2-3x slower. This requires deliberate streaming implementations, transfer queuing with concurrency limits, and memory monitoring. Secondary risks include SSH connection timeout handling, large directory UI freezes (requiring virtualization), and preview panel memory bloat. All are well-understood with documented mitigation strategies.

## Key Findings

### Recommended Stack

Electron 40 with React 19 provides the optimal foundation for this project. Electron remains the proven choice for desktop apps (VS Code, Slack, Discord) with Chromium M144, Node.js 22.x LTS, and TypeScript providing type safety across SSH operations and IPC communication. The build tooling uses Electron Forge 7.x with integrated Vite support for fast HMR during development.

**Core technologies:**
- **Electron 40.0.0**: Latest stable desktop framework with security defaults (context isolation, no nodeIntegration) — proven ecosystem, excellent documentation
- **React 19.2 + Zustand**: UI framework with lightweight state management — 44.7% market share, right-sized for medium complexity without Redux overhead
- **ssh2-sftp-client 12.0.1**: Promise-based SFTP operations — battle-tested, optimized directory operations with configurable concurrency
- **Tailwind CSS 4.1 + shadcn/ui**: Utility-first styling with copy-paste components — v4 is 5x faster builds, full control over component styling
- **Shiki 3.21.0**: Syntax highlighting for code previews — VS Code's TextMate engine, 200+ languages, zero runtime overhead
- **electron-store 10.x**: Settings and favorites persistence — simple JSON storage in userData directory

**Critical architecture decisions:**
- All SSH/SFTP operations execute in main process only (never expose to renderer for security)
- Context isolation with typed preload scripts creates secure IPC bridge
- Zustand preferred over Redux for state management (simpler, adequate for single-window app)
- Credentials stored via Electron safeStorage API (uses macOS Keychain), never plaintext

### Expected Features

The SSH file explorer market has well-defined table stakes that users expect from any SFTP client. Differentiation comes from UX polish, visual browsing capabilities, and native platform integration.

**Must have (table stakes):**
- SSH/SFTP connection with password and key authentication (RSA, Ed25519, ECDSA)
- Connection profiles/bookmarks with host key verification
- Browse remote directories with file operations (upload, download, create, delete, rename)
- File metadata display (size, date, permissions, hidden files toggle)
- Drag & drop file transfers with progress indicators and cancellation
- Breadcrumb navigation, path bar, back/forward history
- Keyboard shortcuts and context menus for file operations

**Should have (competitive):**
- **Miller column view** — very few SFTP clients offer cascading columns, most use dual-pane (HIGH complexity, core differentiator)
- **Preview panel** — inline preview of selected files, Cyberduck has quick-look but most don't (MEDIUM complexity)
- **Image preview** — view images without downloading, SmartFTP and ForkLift have this (MEDIUM complexity)
- **Syntax-highlighted code preview** — preview code with highlighting, Muon SSH has this but rare (MEDIUM complexity)
- **Favorites sidebar** — pin frequently-accessed remote folders beyond basic bookmarks (MEDIUM complexity)
- **Native macOS design** — looks like Finder, not a port; Transmit excels here (MEDIUM complexity)
- Connection keep-alive and auto-reconnect to prevent SSH timeout disconnects

**Defer (v2+):**
- Terminal integration — significant complexity, Electerm already does this well
- Folder synchronization — complex two-way sync logic with conflict resolution
- FTP/FTPS/cloud storage protocols — scope creep, focus on SSH/SFTP
- In-app file editing — opens editor complexity rabbit hole
- Jump host/bastion support — complex SSH tunneling for enterprise users
- Resume interrupted transfers — complex but valuable for large files

### Architecture Approach

The architecture follows Electron's multi-process model with strict separation between the main process (Node.js with SSH/SFTP capabilities) and renderer process (React UI). Communication occurs through a secure IPC bridge using invoke/handle patterns with typed preload scripts that expose minimal, specific functions rather than raw IPC access.

**Major components:**
1. **Main Process Services** — SSH Connection Manager (connection pooling), SFTP Session Handler (ssh2-sftp-client wrapper), File Transfer Engine (queue management, progress tracking), Settings Store (electron-store), Window Manager
2. **Renderer UI Components** — App Shell with Sidebar (favorites/bookmarks), Column View Navigator (Miller columns with horizontal scroll), Preview Panel (image/code/metadata display), Toolbar (navigation controls, file operations), Status Bar (connection status, transfer progress)
3. **Preload Security Bridge** — Typed API surface exposed via contextBridge (connection management, directory operations, file operations, preview, favorites, event subscriptions for transfer progress and connection status)

**Key architectural patterns:**
- **Service Layer Pattern**: Main process organized into testable service classes (SFTPService, FavoritesService, etc.)
- **Typed IPC**: Shared TypeScript interfaces for request/response communication across process boundary
- **Connection Pooling**: Maintain SFTP sessions across operations to reduce authentication overhead
- **Virtual Scrolling**: Use react-window for large directory listings to prevent UI freezes
- **Debounced Preview Loading**: Prevent preview thrashing during rapid navigation with 300ms debounce
- **Optimistic UI Updates**: Update UI immediately for operations, rollback on failure for responsive feel

### Critical Pitfalls

Research identified 22 documented pitfalls across SSH/connection, performance, security, UX, and Electron-specific categories. The top 5 critical issues require architectural decisions in Phase 1-2:

1. **Memory Leaks from EventEmitter Accumulation** — ssh2 accumulates error handlers when reusing connections, causing memory leaks after 11+ connections. Prevention: properly remove event listeners on close, use connection pool with explicit cleanup, implement connection recycling after N operations.

2. **Out of Memory During Bulk File Transfers** — ssh2's fastPut consumes significantly more memory than native scp/sftp. Testing shows Node.js hits OOM copying 200+ files (1MB each) while scp uses <1% memory for 1000 files. Prevention: implement streaming transfers instead of buffered fastPut, process files in batches of 10-20, add memory monitoring and automatic throttling.

3. **Connection Timeouts and Dropped Sessions** — SSH connections timeout due to inactivity, network issues, or algorithm mismatches. Prevention: implement SSH keep-alive (null packets every 30-60 seconds), add automatic reconnection with exponential backoff, queue pending operations during reconnection.

4. **Credentials Stored Insecurely** — Electron's safeStorage falls back to hardcoded password encryption on Linux without a secret store. Prevention: use safeStorage API for all credentials, detect Linux systems without secret store and warn users, never log credentials, implement session-only storage option.

5. **nodeIntegration Enabled in Renderer** — Enabling nodeIntegration allows any XSS attack to execute arbitrary code. This is the #1 Electron security mistake. Prevention: always set nodeIntegration: false, contextIsolation: true, sandbox: true; use contextBridge for IPC; expose minimal, specific APIs via preload scripts.

**Additional high-priority pitfalls:**
- **Large Directory UI Freeze** — directories with 1000+ files freeze UI; requires virtual scrolling
- **Preview Panel Memory Bloat** — Electron image handling consumes 10x file size; requires size limits and explicit resource cleanup
- **Slow Transfer Speeds** — ssh2 is 2-3x slower than native tools; accept as JavaScript tradeoff but optimize perceived performance
- **Overly Permissive IPC Exposure** — exposing generic functions allows compromised renderer to execute arbitrary operations; expose one method per specific action with validation

## Implications for Roadmap

Based on research, the project should follow a 6-phase structure prioritizing security foundations, core SSH functionality, and differentiating features (column view + preview) before file operations and polish.

### Phase 1: Foundation & Security
**Rationale:** Electron security patterns established early are cheaper to maintain. The IPC bridge must be solid before any feature work. Wrong decisions here cascade throughout the project.

**Delivers:**
- Electron + React + TypeScript project scaffold with Vite build pipeline
- Main process shell with window creation and menu
- Preload script with contextBridge skeleton and typed API stubs
- Basic IPC invoke/handle pattern working end-to-end
- Security defaults configured (nodeIntegration: false, contextIsolation: true, sandbox: true)

**Addresses:**
- Pitfall #11 (nodeIntegration security)
- Pitfall #12 (overly permissive IPC)
- Pitfall #21 (context isolation bypass)

**Research flag:** Standard patterns, skip research-phase (well-documented Electron setup)

### Phase 2: SSH/SFTP Core
**Rationale:** SSH/SFTP is the core value proposition. A working connection with directory listing proves the architecture before investing in UI polish. Connection management must handle keep-alive and auto-reconnect from the start to avoid refactoring later.

**Delivers:**
- SSH Connection Manager with password/key authentication
- SFTP session establishment via ssh2-sftp-client
- Directory listing returning typed FileEntry[] with metadata
- Connection UI (simple connect form, status display)
- Connection keep-alive and auto-reconnect logic
- Credential storage via safeStorage API

**Addresses:**
- Table stakes: SSH/SFTP protocol support, password/key auth, connection profiles
- Pitfall #4 (connection timeouts) — build in keep-alive from start
- Pitfall #5 (SSH key passphrase handling) — integrate with system keychain
- Pitfall #10 (credentials stored insecurely) — use safeStorage

**Research flag:** Possible research-phase for SSH key agent integration patterns (macOS Keychain specifics)

### Phase 3: Column View Navigator
**Rationale:** Column view is the primary interaction pattern and core differentiator. Building it against real SFTP data ensures correct assumptions about async loading and error states. This phase validates the fundamental UX before adding file operations.

**Delivers:**
- Column component rendering file list with virtualization (react-window)
- Multi-column layout with horizontal scroll management
- Click-to-navigate with breadcrumb tracking
- Keyboard navigation (arrow keys, enter to open)
- Hidden files toggle (Cmd+Shift+.)

**Addresses:**
- Core differentiator: Miller column view (high complexity)
- Table stakes: breadcrumb navigation, path bar, back/forward history
- Pitfall #6 (large directory UI freeze) — virtual scrolling from start
- Pitfall #17 (hidden files inconsistency) — match Finder behavior

**Research flag:** Possible research-phase for virtual scrolling performance optimization with large remote directories

### Phase 4: Preview Panel
**Rationale:** Preview can be built in parallel with file operations since it's read-only. Image and code preview can be developed simultaneously. This delivers the second core differentiator (instant previews) that sets the app apart from FileZilla and WinSCP.

**Delivers:**
- Preview panel layout with file type detection
- Image preview with lazy loading and memory limits
- Code preview with Shiki syntax highlighting (200+ languages)
- File metadata display (size, date, permissions)
- Debounced preview loading (300ms) to prevent thrashing

**Addresses:**
- Core differentiators: preview panel, image preview, syntax-highlighted code preview
- Pitfall #7 (preview memory bloat) — set 10MB file size limits, explicit cleanup
- Pitfall #8 (syntax highlighting performance) — use Shiki, limit to 100KB files

**Research flag:** Standard patterns, skip research-phase (Shiki is well-documented)

### Phase 5: File Operations
**Rationale:** File operations depend on stable navigation and IPC. Transfer queue management is complex enough to warrant dedicated focus. Streaming implementations and memory monitoring prevent the bulk transfer OOM pitfall.

**Delivers:**
- Download single files with progress tracking
- Upload single files with progress tracking
- Transfer queue with concurrency limits (10-20 simultaneous)
- Delete/rename/move operations with confirmation dialogs
- Create directory functionality
- Drag & drop file transfer support

**Addresses:**
- Table stakes: upload, download, delete, rename, create folder, drag & drop
- Pitfall #2 (out of memory bulk transfers) — streaming, batching, memory monitoring
- Pitfall #3 (slow transfer speeds) — manage expectations with progress UI
- Pitfall #14 (no feedback during long operations) — comprehensive progress indicators
- Pitfall #18 (interrupted transfer handling) — use .filepart extension, verify integrity

**Research flag:** Possible research-phase for transfer queue optimization and memory profiling

### Phase 6: Favorites & Polish
**Rationale:** Favorites add organizational value after core functionality works. This phase focuses on UX refinement, error handling, and persistence to create a polished v1.

**Delivers:**
- Favorites sidebar displaying pinned folders
- Add/remove favorites via context menu and shortcuts
- Settings persistence (favorites, recent connections, window state) via electron-store
- User-friendly error messages with suggested actions
- Operation cancellation and retry logic

**Addresses:**
- Core differentiator: favorites sidebar (organizational value)
- Table stakes: context menus, keyboard shortcuts
- Pitfall #15 (poor error message quality) — map common errors to friendly messages
- Pitfall #1 (EventEmitter memory leaks) — implement connection recycling

**Research flag:** Standard patterns, skip research-phase

### Phase Ordering Rationale

- **Security first (Phase 1):** Wrong security patterns are expensive to fix later; establish IPC discipline before any features
- **Prove core value (Phase 2):** SSH connection must work before building UI on top of it
- **Differentiators before table stakes (Phase 3-4):** Column view + preview panel are unique selling points; validate UX early before investing in file operations
- **Operations last (Phase 5):** CRUD operations are table stakes but depend on navigation/preview working; complexity of transfer queuing warrants dedicated phase
- **Polish separately (Phase 6):** Favorites and error handling add stickiness but aren't blocking for testing core functionality

**Dependency flow:**
- Phase 1 blocks all (IPC foundation required)
- Phase 2 blocks Phases 3-6 (need SSH connection to browse)
- Phase 3 enables Phase 4 (preview needs navigation context)
- Phase 5 can start after Phase 2 (only needs SSH, not UI)
- Phase 6 adds value to all (polish layer)

**Pitfall mitigation:**
- Phases 1-2 address security pitfalls (#10, #11, #12, #21) and connection management (#4, #5)
- Phase 3 addresses performance pitfalls (#6 large directories)
- Phase 4 addresses preview pitfalls (#7, #8 memory/performance)
- Phase 5 addresses transfer pitfalls (#2, #3, #18 memory/speed/interruption)
- Phase 6 addresses UX pitfalls (#1, #15 memory leaks, error messages)

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** SSH key agent integration patterns — macOS Keychain integration via `--apple-use-keychain` equivalent, system SSH agent forwarding
- **Phase 3:** Virtual scrolling performance — specific patterns for react-window with remote directory data, handling 10,000+ file directories
- **Phase 5:** Transfer queue optimization — memory profiling for bulk operations, optimal batch sizes for different file sizes/counts

Phases with standard patterns (skip research-phase):
- **Phase 1:** Electron + React + TypeScript setup with Electron Forge is well-documented
- **Phase 4:** Shiki integration has excellent documentation, image preview is standard web APIs
- **Phase 6:** electron-store usage is straightforward, error message mapping is product work not research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All recommended technologies are current stable versions with excellent documentation. Electron 40 released Jan 2026, React 19.2 widely adopted, ssh2-sftp-client v12 battle-tested. |
| Features | **HIGH** | Feature research based on analysis of 7 leading SFTP clients (Transmit, Cyberduck, FileZilla, WinSCP, ForkLift, Commander One, Electerm). Clear table stakes identified. |
| Architecture | **HIGH** | Electron multi-process architecture is well-documented. Patterns drawn from Electron security best practices and Electerm source code reference. IPC patterns standard. |
| Pitfalls | **HIGH** | 22 documented pitfalls sourced from ssh2/ssh2-sftp-client GitHub issues, Electron security documentation, and performance guides. Memory issues confirmed in testing. |

**Overall confidence:** HIGH

### Gaps to Address

While research confidence is high, several areas require validation during implementation:

- **SSH key agent integration specifics**: macOS Keychain integration requires native module or command-line invocation of ssh-add. Research identifies the requirement but implementation details need validation during Phase 2.

- **Virtual scrolling performance with remote data**: react-window documentation covers local data well but remote SFTP directory listings have latency and pagination considerations. May need experimentation during Phase 3.

- **Optimal transfer batch sizes**: Research identifies that batching 10-20 concurrent transfers prevents OOM, but optimal values likely depend on file sizes, connection speed, and available memory. Requires profiling during Phase 5.

- **electron-store maintenance concerns**: Research notes slower maintenance lately. If issues arise, evaluate alternatives (SQLite for large metadata caching, custom JSON file storage).

- **Radix UI maintenance concerns**: shadcn/ui now supports Base UI as alternative to Radix. Monitor during Phase 1 setup; Radix is fine to start but have migration path if needed.

- **Transfer speed perception**: ssh2 is 2-3x slower than native tools. Research recommends accepting this tradeoff but perceived performance optimization (start previewing before download completes, chunked progress updates) needs UX testing.

## Sources

### Primary (HIGH confidence)
- [Electron Official Documentation](https://www.electronjs.org/docs/latest/) — process model, IPC, security, performance
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security) — security checklist, contextIsolation patterns
- [ssh2-sftp-client npm](https://www.npmjs.com/package/ssh2-sftp-client) — v12 API documentation, performance notes
- [ssh2 GitHub Issues](https://github.com/mscdex/ssh2/issues) — memory usage patterns, performance comparisons
- [React 19 Release Notes](https://react.dev/blog/2025/10/01/react-19-2) — Activity component, useEffectEvent hooks
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — performance improvements, Vite plugin
- [Shiki Documentation](https://shiki.style/) — syntax highlighting API, language support
- [Electron Forge Documentation](https://www.electronforge.io/) — Vite integration, packaging

### Secondary (MEDIUM confidence)
- [Best SFTP Clients of 2025](https://sftptogo.com/blog/best-sftp-clients-of-2025-secure-fast-file-transfers/) — competitive landscape
- [Comparitech SFTP Client Comparison](https://www.comparitech.com/net-admin/best-ftp-sftp-clients-windows-linux/) — feature comparison
- [Electerm Source Code](https://github.com/electerm/electerm) — reference implementation for Electron SSH client
- [LogRocket: Advanced Electron Architecture](https://blog.logrocket.com/advanced-electron-js-architecture/) — architecture patterns
- [LogRocket: Handling IPC in Electron](https://blog.logrocket.com/handling-interprocess-communications-in-electron-applications-like-a-pro/) — IPC patterns
- [VS Code Syntax Highlighting Optimizations](https://code.visualstudio.com/blogs/2017/02/08/syntax-highlighting-optimizations) — viewport-only highlighting patterns
- [Brainhub: Electron App Performance](https://brainhub.eu/library/electron-app-performance) — require() overhead, bundling strategies

### Tertiary (LOW confidence)
- [Common Misconfigurations in Electron Apps](https://www.cobalt.io/blog/common-misconfigurations-electron-apps-part-1) — security pitfalls
- Community reports on Radix UI maintenance concerns — warrants monitoring but not blocking

---
*Research completed: 2026-01-26*
*Ready for roadmap: yes*
