# Pitfalls Research: Electron SSH File Explorer

## SSH/Connection Pitfalls

### 1. Memory Leaks from EventEmitter Accumulation

**The Problem:** When reusing ssh2/ssh2-sftp-client connection objects for subsequent connections (especially with Windows SFTP servers), additional error handlers accumulate. After 11+ connections, Node.js warns about possible memory leaks.

**Warning Signs:**
- Node warning: "MaxListenersExceededWarning: Possible EventEmitter memory leak detected"
- Memory usage grows with each file operation
- App becomes sluggish after extended use

**Prevention Strategy:**
- Properly remove event listeners when closing connections
- Use a connection pool with explicit cleanup
- Set `emitter.setMaxListeners()` appropriately if many legitimate listeners are needed
- Implement connection recycling after N operations

**Phase to Address:** Architecture/Core Infrastructure (Phase 1-2)

---

### 2. Out of Memory During Bulk File Transfers

**The Problem:** ssh2's `fastPut` method consumes significantly more memory than native scp/sftp tools. Testing shows Node.js can hit OOM when copying 200+ files (1MB each) while command-line scp uses <1% memory for 1000 files.

**Warning Signs:**
- Process receives SIGKILL during bulk operations
- Memory usage spikes during uploads/downloads
- App freezes during large directory transfers

**Prevention Strategy:**
- Implement streaming transfers instead of buffered `fastPut`
- Process files in controlled batches (10-20 at a time)
- Add memory monitoring and automatic throttling
- Use transfer queues with concurrency limits

**Phase to Address:** File Operations Implementation (Phase 3-4)

---

### 3. Slow Transfer Speeds Compared to Native Tools

**The Problem:** ssh2 transfer times are 2-3x slower than native sftp/scp clients. Both `fastPut` and `createWriteStream` show similar slowness.

**Warning Signs:**
- Users complain transfers feel slow
- Progress bars move noticeably slower than other SFTP apps
- Large file transfers take unexpectedly long

**Prevention Strategy:**
- Accept this as a tradeoff of pure JavaScript implementation
- Implement visual progress feedback to manage expectations
- Consider optional integration with native SSH binaries for power users
- Optimize for perceived performance (start previewing before download completes)

**Phase to Address:** File Operations (Phase 3-4), with UI polish in later phases

---

### 4. Connection Timeouts and Dropped Sessions

**The Problem:** SSH connections timeout due to inactivity, network issues, or algorithm mismatches. Users lose work or see confusing errors mid-operation.

**Warning Signs:**
- Random "connection lost" errors during idle periods
- Operations fail with timeout errors
- Users must manually reconnect frequently

**Prevention Strategy:**
- Implement SSH keep-alive (send null packets every 30-60 seconds)
- Add automatic reconnection with exponential backoff
- Queue pending operations during reconnection
- Store connection state to resume transparently
- Handle 'close' and 'error' events explicitly

**Phase to Address:** Core Infrastructure (Phase 1-2)

---

### 5. SSH Key Passphrase Handling

**The Problem:** Users expect seamless authentication but managing passphrases, key agents, and various auth methods is complex. Poor implementations either store passphrases insecurely or require repeated entry.

**Warning Signs:**
- Users complain about entering passphrase repeatedly
- Credentials stored in plaintext config files
- SSH agent forwarding not working

**Prevention Strategy:**
- Integrate with system SSH agent (ssh-agent on macOS/Linux)
- Use macOS Keychain integration via `--apple-use-keychain` equivalent
- Support multiple auth methods: key, key+passphrase, password, agent
- Never store passphrases in plaintext; use Electron's safeStorage API

**Phase to Address:** Authentication/Connection (Phase 2)

---

## Performance Pitfalls

### 6. Large Directory Listing Causes UI Freeze

**The Problem:** Directories with 1000+ files cause the UI to freeze while rendering. Some Electron file managers limit listings to 100 files to avoid this.

**Warning Signs:**
- UI becomes unresponsive when opening large directories
- Scrolling stutters in file lists
- Users report "app hangs" on specific folders

**Prevention Strategy:**
- Implement virtual scrolling (only render visible items)
- Load directory contents incrementally/paginated
- Show immediate partial results while loading continues
- Add loading indicators for large directories
- Consider lazy-loading file metadata (size, permissions)

**Phase to Address:** Core UI Components (Phase 2-3)

---

### 7. Preview Panel Memory Bloat

**The Problem:** Electron's image handling can consume 10x the actual file size in memory. Memory is not released when closing preview. GIF files with many frames cause continuous memory growth.

**Warning Signs:**
- Memory grows when cycling through image previews
- App crashes with large images (>100MB)
- Memory never decreases after viewing images

**Prevention Strategy:**
- Set maximum file size limits for preview (e.g., 10MB for images)
- Generate thumbnails instead of loading full images
- Explicitly release image resources when switching files
- Use `URL.revokeObjectURL()` for blob URLs
- Consider off-main-process image processing

**Phase to Address:** Preview Panel Implementation (Phase 4-5)

---

### 8. Syntax Highlighting Performance on Large Files

**The Problem:** Syntax highlighting libraries like Prism can be extremely slow on large files (500KB+). Some libraries aren't designed for files over a few KB.

**Warning Signs:**
- Code preview takes seconds to appear for large files
- UI freezes during syntax highlighting
- Browser becomes unresponsive

**Prevention Strategy:**
- Use efficient libraries (highlight.js outperforms Prism for large files)
- Implement viewport-only highlighting (like VS Code)
- Set file size limits for syntax highlighting (e.g., 100KB)
- Show plain text immediately, highlight progressively
- Consider Web Workers for highlighting

**Phase to Address:** Preview Panel Implementation (Phase 4-5)

---

### 9. require() Overhead at Startup

**The Problem:** Each `require()` call is expensive, especially on Windows. Apps with many modules have noticeably slow startup times.

**Warning Signs:**
- App takes 3+ seconds to show first window
- Startup time increases as codebase grows
- Windows users report much slower startup than macOS

**Prevention Strategy:**
- Bundle code into fewer files (webpack/rollup)
- Lazy-load modules only when needed
- Defer non-critical module loading
- Profile startup time regularly

**Phase to Address:** Build/Packaging (throughout, but especially Phase 6+)

---

## Security Pitfalls

### 10. Credentials Stored Insecurely

**The Problem:** Many Electron apps store sensitive data in plaintext files. On Linux without a secret store, Electron's safeStorage falls back to hardcoded password encryption.

**Warning Signs:**
- Credentials visible in config files
- Security audits flag credential storage
- Users report credentials exposed after disk access

**Prevention Strategy:**
- Use Electron's `safeStorage` API for all credentials
- Detect Linux systems without secret store and warn users
- Never log credentials or connection strings
- Implement session-only credential storage option
- Clear sensitive data from memory when not needed

**Phase to Address:** Architecture/Core Infrastructure (Phase 1-2)

---

### 11. nodeIntegration Enabled in Renderer

**The Problem:** Enabling `nodeIntegration` in renderer processes allows any XSS attack to execute arbitrary code on the user's system. This is the #1 Electron security mistake.

**Warning Signs:**
- `nodeIntegration: true` in BrowserWindow options
- Direct Node.js API calls from renderer code
- Security tools flag the application

**Prevention Strategy:**
- Always set `nodeIntegration: false`
- Always set `contextIsolation: true`
- Always set `sandbox: true`
- Use contextBridge for IPC communication
- Expose minimal, specific APIs via preload scripts

**Phase to Address:** Project Setup (Phase 1) - non-negotiable from start

---

### 12. Overly Permissive IPC Exposure

**The Problem:** Exposing powerful functions via contextBridge (e.g., `exec(cmd)`, generic `send()`) allows compromised renderer to execute arbitrary operations.

**Warning Signs:**
- Preload exposes generic `ipcRenderer.send()` directly
- Functions accept arbitrary command strings
- No validation/sanitization of IPC arguments

**Prevention Strategy:**
- Expose one method per specific action (not generic send)
- Validate all arguments in main process
- Implement allowlists for valid operations
- Never pass raw user input to shell commands
- Log IPC traffic for anomaly detection

**Phase to Address:** Architecture (Phase 1-2)

---

### 13. Debug Mode Left Enabled in Production

**The Problem:** Electron apps with debug mode enabled can be inspected and manipulated by attackers. CVE-2024-36287 is a classic example.

**Warning Signs:**
- DevTools accessible in production builds
- Debug flags visible in packaged app
- Remote debugging port exposed

**Prevention Strategy:**
- Disable DevTools in production builds
- Remove all debug flags before release
- Implement build pipeline that enforces production settings
- Test production builds specifically

**Phase to Address:** Build/Packaging (Phase 6+)

---

## UX Pitfalls

### 14. No Feedback During Long Operations

**The Problem:** Remote file operations take time. Without feedback, users think the app is frozen and may force-quit, corrupting transfers.

**Warning Signs:**
- Users report "app freezes" during file operations
- Support requests about stuck transfers
- Users force-quit during long operations

**Prevention Strategy:**
- Show progress indicators for all remote operations
- Implement operation cancellation
- Display current operation status in status bar
- Use optimistic UI updates with rollback on failure
- Add timeout handling with user notification

**Phase to Address:** Core UI (Phase 2-3), File Operations (Phase 3-4)

---

### 15. Poor Error Message Quality

**The Problem:** SSH/SFTP errors are often cryptic. Showing raw error messages confuses users and generates support requests.

**Warning Signs:**
- Error messages contain technical jargon
- Users screenshot errors asking "what does this mean?"
- Same error appears in different scenarios

**Prevention Strategy:**
- Map common errors to user-friendly messages
- Include suggested actions in error dialogs
- Add "Copy Error Details" for technical users
- Log full error details for debugging
- Test error scenarios explicitly

**Phase to Address:** Throughout, but systematize in Phase 5+

---

### 16. Symlink Handling Pitfalls

**The Problem:** Circular symlinks can cause infinite loops. File browsers that follow symlinks naively may freeze or crash. Different handling needed vs. regular files.

**Warning Signs:**
- App hangs when entering certain directories
- Recursive operations never complete
- Symlinked directories show inconsistent behavior

**Prevention Strategy:**
- Track visited paths to detect cycles
- Set maximum recursion depth
- Display symlinks with distinct visual indicator
- Show symlink target in preview/info panel
- Offer choice: follow symlinks or treat as files

**Phase to Address:** File Operations (Phase 3-4)

---

### 17. Hidden Files (.dotfiles) Inconsistency

**The Problem:** Users expect to toggle hidden file visibility like in Finder. Hiding files shouldn't prevent direct access via path. Permission handling varies.

**Warning Signs:**
- Users can't find config files
- Hidden files inaccessible even when URL entered directly
- Inconsistent behavior vs. Finder/Explorer

**Prevention Strategy:**
- Implement "Show Hidden Files" toggle (Cmd+Shift+.)
- Allow direct path navigation regardless of visibility setting
- Match macOS Finder behavior for consistency
- Handle permission errors gracefully for hidden system files

**Phase to Address:** Core UI (Phase 2-3)

---

### 18. Interrupted Transfer Handling

**The Problem:** Network interruptions leave partial files. Without resume support, users must restart large transfers from scratch. Partial files may appear complete.

**Warning Signs:**
- Transferred files have wrong size
- Users report "corrupted" downloads
- Large transfers fail completely on brief network hiccups

**Prevention Strategy:**
- Use .filepart extension for in-progress transfers
- Implement automatic resume on reconnection
- Verify file integrity after transfer (size, optional checksum)
- Offer manual resume option for interrupted transfers
- Don't rename partial files to final name until complete

**Phase to Address:** File Operations (Phase 3-4)

---

## Electron-Specific Pitfalls

### 19. Blocking Main Process with Heavy Operations

**The Problem:** Heavy computation in main process freezes entire app including all windows. Remote file operations are inherently slow.

**Warning Signs:**
- Entire app freezes during operations
- Window chrome becomes unresponsive
- macOS shows "app not responding"

**Prevention Strategy:**
- Move heavy operations to renderer or worker processes
- Use ipcRenderer.invoke for async operations
- Never use synchronous IPC for long operations
- Consider utility processes for file operations

**Phase to Address:** Architecture (Phase 1-2)

---

### 20. Race Conditions in File Operations

**The Problem:** Concurrent file operations (rename while delete, move during listing) cause errors or data loss. Electron's async nature makes this easy to introduce.

**Warning Signs:**
- Intermittent "file not found" errors
- Operations succeed sometimes, fail others
- Files end up in wrong state

**Prevention Strategy:**
- Implement operation queuing for same-directory operations
- Use locks/mutexes for critical file operations
- Handle "DELETE_PENDING" and similar OS states
- Make operations idempotent where possible
- Add retry logic with backoff

**Phase to Address:** File Operations (Phase 3-4)

---

### 21. Context Isolation Bypass Vulnerabilities

**The Problem:** Even with nodeIntegration disabled, improper contextIsolation allows renderer to access privileged APIs. Multiple CVEs exist for this.

**Warning Signs:**
- Using older Electron versions (<20.0.0)
- Custom prototype modifications in preload
- Passing functions through contextBridge

**Prevention Strategy:**
- Use Electron 20+ (contextIsolation default: true)
- Never expose functions that return functions
- Only pass serializable data through contextBridge
- Audit preload scripts for prototype pollution
- Keep Electron updated

**Phase to Address:** Project Setup and Maintenance (ongoing)

---

### 22. asar Archive Tampering

**The Problem:** Electron apps package code in asar archives that can be extracted and modified. Secrets in code are easily exposed.

**Warning Signs:**
- API keys visible in unpacked asar
- Users modifying app behavior
- Pirated/modified versions appearing

**Prevention Strategy:**
- Never embed secrets in application code
- Use code signing to detect tampering
- Fetch sensitive config from secure backend
- Consider asar integrity checking
- Accept that client-side code is not secret

**Phase to Address:** Build/Packaging (Phase 6+)

---

## Prevention Strategies Summary

### Phase 1 (Project Setup)
- [ ] Configure Electron with security defaults (nodeIntegration: false, contextIsolation: true, sandbox: true)
- [ ] Set up safeStorage for credentials
- [ ] Design IPC architecture with minimal API surface
- [ ] Establish connection pooling pattern

### Phase 2 (Core Infrastructure)
- [ ] Implement SSH keep-alive and auto-reconnect
- [ ] Design operation queue to prevent race conditions
- [ ] Set up virtual scrolling foundation
- [ ] Create error mapping system for user-friendly messages

### Phase 3-4 (File Operations)
- [ ] Implement streaming transfers with memory limits
- [ ] Add batch processing for bulk operations
- [ ] Build symlink cycle detection
- [ ] Create partial transfer resume system
- [ ] Add progress tracking for all remote operations

### Phase 5 (Preview/Polish)
- [ ] Set file size limits for preview
- [ ] Implement efficient syntax highlighting
- [ ] Add memory management for image preview
- [ ] Systematize error handling

### Phase 6+ (Build/Release)
- [ ] Disable debug mode in production
- [ ] Bundle code for faster startup
- [ ] Implement code signing
- [ ] Test security configurations

---

## Sources

- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [ssh2-sftp-client GitHub Issues](https://github.com/theophilusx/ssh2-sftp-client/issues)
- [mscdex/ssh2 GitHub Issues](https://github.com/mscdex/ssh2/issues)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Common Misconfigurations in Electron Apps](https://www.cobalt.io/blog/common-misconfigurations-electron-apps-part-1)
- [Electron App Performance Optimization](https://brainhub.eu/library/electron-app-performance)
- [VS Code Syntax Highlighting Optimizations](https://code.visualstudio.com/blogs/2017/02/08/syntax-highlighting-optimizations)
- [SSH Agent Best Practices](https://goteleport.com/blog/how-to-use-ssh-agent-safely/)
- [WinSCP File Transfer Resume](https://winscp.net/eng/docs/resume)
