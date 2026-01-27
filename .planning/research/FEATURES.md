# Features Research: SSH File Explorer

## Executive Summary

Research based on analysis of leading SFTP/SSH file management applications including Transmit 5, Cyberduck, FileZilla, WinSCP, ForkLift, Commander One, and Electerm. The SSH file explorer market has clear table stakes that users expect, with differentiation coming from UX polish, preview capabilities, and native platform integration.

---

## Table Stakes

Features users expect as baseline functionality. Without these, users will immediately look elsewhere.

### 1. Core Connection & Authentication
| Feature | Description | Complexity |
|---------|-------------|------------|
| **SSH/SFTP Protocol Support** | Connect to remote servers via SFTP | Medium |
| **Password Authentication** | Basic username/password login | Low |
| **SSH Key Authentication** | Support for RSA, Ed25519, ECDSA keys | Medium |
| **SSH Key Passphrase Support** | Decrypt password-protected private keys | Low |
| **Connection Profiles/Bookmarks** | Save and recall server connection settings | Medium |
| **Host Key Verification** | Verify and remember server fingerprints | Low |

### 2. File Operations
| Feature | Description | Complexity |
|---------|-------------|------------|
| **Browse Remote Directories** | Navigate folder hierarchies | Medium |
| **Upload Files** | Transfer local files to remote server | Medium |
| **Download Files** | Transfer remote files to local machine | Medium |
| **Create Folders** | Make new directories on remote server | Low |
| **Delete Files/Folders** | Remove items from remote server | Low |
| **Rename Files/Folders** | Change names of remote items | Low |
| **File Permissions Display** | Show unix permissions (rwx) | Low |
| **File Size/Date Display** | Show metadata for files | Low |
| **Hidden Files Toggle** | Show/hide dotfiles | Low |

### 3. Transfer Management
| Feature | Description | Complexity |
|---------|-------------|------------|
| **Drag & Drop Upload/Download** | Intuitive file transfer via drag & drop | Medium |
| **Transfer Progress Indicator** | Show upload/download progress | Low |
| **Cancel Transfers** | Abort in-progress transfers | Low |
| **Multiple File Selection** | Select and operate on multiple files | Low |

### 4. Navigation & UX
| Feature | Description | Complexity |
|---------|-------------|------------|
| **Breadcrumb Navigation** | Show current path, click to navigate | Low |
| **Path Bar / Go To** | Type path directly to navigate | Low |
| **Back/Forward Navigation** | History-based navigation | Low |
| **Keyboard Shortcuts** | Standard shortcuts (Cmd+C, Cmd+V, etc.) | Medium |
| **Context Menus** | Right-click actions on files | Low |

---

## Differentiators

Features that set the application apart from competition and provide competitive advantage.

### 1. Visual Experience (High Priority for Your App)
| Feature | Description | Complexity | Why Differentiating |
|---------|-------------|------------|---------------------|
| **Miller Column View** | macOS Finder-style cascading columns | High | Very few SFTP clients offer this; most use dual-pane |
| **Preview Panel** | Inline preview of selected files | Medium | Cyberduck has quick-look, most others don't |
| **Image Preview** | View images without downloading | Medium | SmartFTP, ForkLift have this; FileZilla doesn't |
| **Syntax-Highlighted Code Preview** | Preview code with highlighting | Medium | Muon SSH, Shell Assistant have this; rare feature |
| **Thumbnail View for Images** | Grid of image thumbnails | High | SmartFTP has this; most clients don't |
| **Native macOS Design** | Looks like Finder, not a port | Medium | Transmit excels here; most clients look dated |

### 2. Organization & Workflow
| Feature | Description | Complexity | Why Differentiating |
|---------|-------------|------------|---------------------|
| **Favorites Sidebar** | Pin frequently-accessed remote folders | Medium | Beyond basic bookmarks; folder-level favorites |
| **Recent Locations** | Quick access to recently visited paths | Low | Convenience feature most clients lack |
| **Custom Folder Icons/Colors** | Visual organization of bookmarks | Low | Polish that creates stickiness |
| **Multiple Tabs** | Work with multiple servers/paths | Medium | Transmit, WinSCP have this; adds workflow value |
| **Split View** | Compare two locations side-by-side | High | Commander-style; useful but complex |

### 3. Performance & Reliability
| Feature | Description | Complexity | Why Differentiating |
|---------|-------------|------------|---------------------|
| **Connection Keep-Alive** | Prevent SSH timeout disconnects | Low | Critical UX improvement |
| **Auto-Reconnect** | Seamlessly reconnect on network change | Medium | Reduces friction significantly |
| **Resume Interrupted Transfers** | Continue failed transfers | High | FileZilla has this; enterprise-grade feature |
| **Parallel Transfers** | Multiple simultaneous file transfers | High | WinSCP does up to 9; speeds large operations |

### 4. Search & Discovery
| Feature | Description | Complexity | Why Differentiating |
|---------|-------------|------------|---------------------|
| **Quick Filter** | Filter visible files by name | Low | Instant feedback while typing |
| **Remote File Search** | Search files on server (via find command) | High | HippoEDIT FTP Explorer has this; rare |
| **Content Search (grep)** | Search within file contents | Very High | WinSCP scripting supports this; complex |

---

## Anti-Features for v1

Features to deliberately skip in first version, with rationale.

### 1. Terminal Integration
| Feature | Why Skip | Reconsider When |
|---------|----------|-----------------|
| **Built-in Terminal Emulator** | Significant complexity; Electerm already does this well | v2+ if users request; consider linking to external terminal |
| **Shell Command Execution** | Security implications; scope creep | Never for this app (different product category) |

### 2. Sync & Automation
| Feature | Why Skip | Reconsider When |
|---------|----------|-----------------|
| **Folder Synchronization** | Complex two-way sync logic; edge cases | v2+ with simple one-way sync first |
| **Watch Directory Auto-Upload** | Background service complexity | v3+ after core is solid |
| **Scheduled Transfers** | Requires background process/daemon | Not aligned with visual explorer focus |
| **Scripting/Automation API** | Developer feature; different audience | v2+ if developer adoption grows |

### 3. Cloud & Multi-Protocol
| Feature | Why Skip | Reconsider When |
|---------|----------|-----------------|
| **FTP/FTPS Support** | Legacy protocols; focus on SSH/SFTP | v2 if significant demand |
| **Cloud Storage (S3, GCS, etc.)** | Different auth models; scope creep | Separate product or v3+ |
| **WebDAV Support** | Niche use case | Only if users request |
| **Mount as Local Drive** | OS-level integration complexity | Never (CloudMounter/Mountain Duck do this) |

### 4. Advanced File Features
| Feature | Why Skip | Reconsider When |
|---------|----------|-----------------|
| **In-App File Editing** | Opens up editor complexity rabbit hole | v2 with simple text editor only |
| **File Comparison/Diff** | Beyond explorer scope | Never (use dedicated diff tools) |
| **Archive Handling (zip/tar)** | Complex extraction on remote | v2 for viewing; extraction is tricky |
| **Batch Rename** | Power user feature; low priority | v2+ |

### 5. Enterprise Features
| Feature | Why Skip | Reconsider When |
|---------|----------|-----------------|
| **Jump Host / Bastion Support** | Complex SSH tunneling | v2 if enterprise users adopt |
| **SOCKS/HTTP Proxy Support** | Corporate environment feature | v2+ based on demand |
| **FIDO2/Hardware Key Support** | Requires native modules | v2 if security-focused users adopt |
| **2FA/OTP Integration** | Server-side dependent | v2+ |
| **Team Credential Sharing** | Requires backend service | Not aligned with desktop-first focus |

---

## Feature Dependencies

Understanding which features must be built before others.

```
Connection & Auth (Foundation)
├── SSH/SFTP Protocol Support
│   ├── Password Auth
│   ├── SSH Key Auth
│   │   └── Key Passphrase Support
│   └── Host Key Verification
└── Connection Profiles
    └── Favorites Sidebar

File Operations (Requires Connection)
├── Browse Directories
│   ├── Miller Column View
│   ├── Preview Panel
│   │   ├── Image Preview
│   │   └── Syntax Highlighting
│   └── Thumbnail View
├── Upload/Download
│   ├── Drag & Drop
│   ├── Transfer Progress
│   ├── Resume Transfers
│   └── Parallel Transfers
└── CRUD Operations (Create/Delete/Rename)

Navigation (Requires Browse)
├── Breadcrumb Navigation
├── Path Bar
├── Back/Forward History
└── Quick Filter
    └── Remote File Search

UX Polish (Layered On Top)
├── Keyboard Shortcuts
├── Context Menus
├── Recent Locations
└── Connection Keep-Alive
    └── Auto-Reconnect
```

### Critical Path for MVP
1. **SSH Connection** (password + key auth)
2. **Directory Browsing** (list files, navigate)
3. **Miller Column View** (core differentiator)
4. **File Upload/Download** (core utility)
5. **Preview Panel** (core differentiator)
6. **Connection Profiles** (essential UX)
7. **Favorites Sidebar** (core differentiator)

---

## Complexity Notes

Relative effort estimates for key features.

### Low Complexity (1-2 days each)
- Password authentication
- Show/hide hidden files
- File metadata display (size, date, permissions)
- Breadcrumb navigation
- Path bar input
- Cancel transfers
- Quick filter (client-side)
- Context menus
- Back/forward navigation
- Connection keep-alive

### Medium Complexity (3-5 days each)
- SSH key authentication (file reading, passphrase handling)
- Directory browsing with proper error handling
- Drag & drop implementation in Electron
- Transfer progress with accurate percentages
- Connection profiles (save/load/edit)
- Preview panel (image display)
- Favorites sidebar with persistence
- Multiple file selection + operations
- Keyboard shortcuts (comprehensive)
- Auto-reconnect logic
- Multiple tabs

### High Complexity (1-2 weeks each)
- **Miller column view**: Custom component, scroll synchronization, performance with large directories, proper selection state across columns
- **Syntax highlighting preview**: Integrate highlighting library, handle large files, multiple language detection
- **Thumbnail generation**: Download file content, resize images, caching strategy
- **Resume interrupted transfers**: Track partial transfers, checksum verification
- **Parallel transfers**: Connection pooling, queue management, UI coordination
- **Remote file search**: Execute find command, stream results, handle permissions
- **Split view**: Layout management, synchronized operations

### Very High Complexity (2+ weeks each)
- Content search (grep on remote): Security sandboxing, output parsing, huge result handling
- Folder synchronization: Conflict resolution, bidirectional sync, delete handling
- Jump host support: SSH tunneling, connection chaining

---

## Competitive Landscape Summary

| App | Platform | Price | Key Strengths | Key Weaknesses |
|-----|----------|-------|---------------|----------------|
| **Transmit 5** | macOS | $45 | Beautiful UI, fast, 11 protocols | No terminal, macOS only |
| **Cyberduck** | Win/Mac | Free | Wide protocol support, cloud integration | Clunky UI, single-window |
| **FileZilla** | Cross-platform | Free | Reliable, open-source, resume transfers | No preview, dated UI |
| **WinSCP** | Windows | Free | Powerful scripting, Explorer view | Windows only, complex |
| **ForkLift** | macOS | $30 | Preview panel, dual-pane | Less polished than Transmit |
| **Electerm** | Cross-platform | Free | Terminal + SFTP combo | Jack of all trades |
| **Commander One** | macOS | Free/$30 | Dual-pane, Finder integration | Overwhelming for simple tasks |

### Your Positioning
- **Gap in Market**: No cross-platform Electron app offers Miller columns + preview panel + native feel
- **Closest Competitor**: Transmit 5 (macOS only, no column view, but beautiful UX)
- **Differentiation**: Column view navigation + instant previews + favorites = visual browsing optimized

---

## Sources

- [Best SFTP Clients of 2025](https://sftptogo.com/blog/best-sftp-clients-of-2025-secure-fast-file-transfers/)
- [Comparitech SFTP Client Comparison](https://www.comparitech.com/net-admin/best-ftp-sftp-clients-windows-linux/)
- [Transmit 5 Official](https://panic.com/transmit/)
- [Cyberduck vs FileZilla](https://www.dreamhost.com/blog/cyberduck-vs-filezilla/)
- [Miller Columns - Wikipedia](https://en.wikipedia.org/wiki/Miller_columns)
- [Electerm](https://electerm.html5beta.com)
- [ssh2-sftp-client npm](https://www.npmjs.com/package/ssh2-sftp-client)
- [SmartFTP Thumbnails](https://www.smartftp.com/en-us/client/features/thumbnails)
- [WinSCP Synchronization Guide](https://winscp.net/eng/docs/guide_synchronize)
- [SSH Client Connection Managers Comparison](https://www.comparitech.com/net-admin/best-ssh-client-and-connection-managers/)
