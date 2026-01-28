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

- [x] **NAV-01**: User can browse directories in Miller column view (Finder-style)
- [x] **NAV-02**: User can navigate files/folders using arrow keys
- [x] **NAV-03**: User can see and navigate via path bar

### File Operations

- [x] **FILE-01**: User can download files from server to local Mac
- [x] **FILE-02**: User can upload files from local Mac to server
- [x] **FILE-03**: User can delete files/folders on remote server
- [x] **FILE-04**: User can rename files on remote server
- [ ] **FILE-05**: User can move files to different folder on server (backend ready, UI deferred - needs remote folder picker)

### Preview

- [x] **PREV-01**: User sees image preview in right panel when image file is selected
- [x] **PREV-02**: User sees code/text preview with syntax highlighting when text file is selected
- [x] **PREV-03**: User can press spacebar to open enlarged lightbox view of image
- [x] **PREV-04**: Preview updates automatically when navigating with keyboard

### Organization

- [x] **ORG-01**: User can add folders to per-server favorites sidebar
- [x] **ORG-02**: Favorites persist between app sessions

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
| CONN-01 | Phase 2 | Complete |
| CONN-02 | Phase 2 | Complete |
| CONN-03 | Phase 2 | Complete |
| NAV-01 | Phase 3 | Complete |
| NAV-02 | Phase 3 | Complete |
| NAV-03 | Phase 3 | Complete |
| FILE-01 | Phase 5 | Complete |
| FILE-02 | Phase 5 | Complete |
| FILE-03 | Phase 5 | Complete |
| FILE-04 | Phase 5 | Complete |
| FILE-05 | Phase 5 | Partial (backend ready, UI deferred) |
| PREV-01 | Phase 4 | Complete |
| PREV-02 | Phase 4 | Complete |
| PREV-03 | Phase 4 | Complete |
| PREV-04 | Phase 4 | Complete |
| ORG-01 | Phase 6 | Complete |
| ORG-02 | Phase 6 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-01-26*
*Last updated: 2026-01-28 after Phase 6 completion*
