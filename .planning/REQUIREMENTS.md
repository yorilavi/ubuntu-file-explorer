# Requirements: Ubuntu File Explorer

**Defined:** 2026-01-26
**Core Value:** Browse remote servers visually with instant image and code previews

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Connection

- [ ] **CONN-01**: App parses ~/.ssh/config to display available servers
- [ ] **CONN-02**: User can add and save custom SSH connections
- [ ] **CONN-03**: User can connect to server using SSH key authentication

### Navigation

- [ ] **NAV-01**: User can browse directories in Miller column view (Finder-style)
- [ ] **NAV-02**: User can navigate files/folders using arrow keys
- [ ] **NAV-03**: User can see and navigate via path bar

### File Operations

- [ ] **FILE-01**: User can download files from server to local Mac
- [ ] **FILE-02**: User can upload files from local Mac to server
- [ ] **FILE-03**: User can delete files/folders on remote server
- [ ] **FILE-04**: User can rename files on remote server
- [ ] **FILE-05**: User can move files to different folder on server

### Preview

- [ ] **PREV-01**: User sees image preview in right panel when image file is selected
- [ ] **PREV-02**: User sees code/text preview with syntax highlighting when text file is selected
- [ ] **PREV-03**: User can press spacebar to open enlarged lightbox view of image
- [ ] **PREV-04**: Preview updates automatically when navigating with keyboard

### Organization

- [ ] **ORG-01**: User can add folders to per-server favorites sidebar
- [ ] **ORG-02**: Favorites persist between app sessions

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Performance

- **PERF-01**: Virtual scrolling for directories with 1000+ files
- **PERF-02**: Transfer progress indicators with cancel option

### Connection

- **CONN-04**: Password authentication support
- **CONN-05**: Auto-reconnect on connection drop
- **CONN-06**: Keep-alive to prevent session timeouts

### Navigation

- **NAV-04**: Hidden files toggle (show/hide dotfiles)

### File Operations

- **FILE-06**: Drag-and-drop file transfers
- **FILE-07**: Create new folders

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Video playback | Streaming over SSH is complex, low priority |
| PDF preview | Can add later if needed, not core to vision |
| Terminal integration | Use dedicated terminal app |
| Folder synchronization | Two-way sync logic is complex |
| Cloud storage (S3, GCS) | Different auth models, scope creep |
| In-app file editing | This is a browser, not an editor |
| OAuth/SSO | SSH keys are sufficient for personal use |
| Mobile app | Desktop only for v1 |
| Windows/Linux builds | macOS focus for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | — | Pending |
| CONN-02 | — | Pending |
| CONN-03 | — | Pending |
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| FILE-01 | — | Pending |
| FILE-02 | — | Pending |
| FILE-03 | — | Pending |
| FILE-04 | — | Pending |
| FILE-05 | — | Pending |
| PREV-01 | — | Pending |
| PREV-02 | — | Pending |
| PREV-03 | — | Pending |
| PREV-04 | — | Pending |
| ORG-01 | — | Pending |
| ORG-02 | — | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 ⚠️

---
*Requirements defined: 2026-01-26*
*Last updated: 2026-01-26 after initial definition*
