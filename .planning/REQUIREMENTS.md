# Requirements: Ubuntu File Explorer

**Defined:** 2026-01-30
**Core Value:** Browse remote servers visually with instant image and code previews

## v1.2 Requirements

Requirements for v1.2 Folder Operations milestone. Each maps to roadmap phases.

### Folder Upload

- [ ] **FLDR-01**: User can upload a local folder to a remote location recursively
- [ ] **FLDR-02**: Folder structure is preserved on the remote server
- [ ] **FLDR-03**: User sees overall progress (X of Y files) during folder upload
- [ ] **FLDR-04**: User can cancel folder upload with cleanup of partial transfers
- [ ] **FLDR-05**: Empty directories are created on remote during upload
- [ ] **FLDR-06**: .DS_Store and ._ metadata files are excluded when hidden files toggle is off
- [ ] **FLDR-07**: User can see which files failed and retry failed transfers

### Folder Download

- [ ] **FLDR-08**: User can download a remote folder to local Mac recursively
- [ ] **FLDR-09**: Folder structure is preserved locally
- [ ] **FLDR-10**: User sees overall progress (X of Y files) during folder download
- [ ] **FLDR-11**: User can cancel folder download with cleanup of partial transfers
- [ ] **FLDR-12**: Empty directories are created locally during download
- [ ] **FLDR-13**: User can see which files failed and retry failed transfers

### PDF Preview

- [ ] **PDF-01**: User can preview PDF files in the preview panel
- [ ] **PDF-02**: User can navigate pages with arrow keys or prev/next buttons
- [ ] **PDF-03**: User sees page indicator (e.g., "Page 3 of 25")
- [ ] **PDF-04**: User can zoom to fit width, fit page, or actual size
- [ ] **PDF-05**: User can open PDF in fullscreen lightbox (spacebar)
- [ ] **PDF-06**: User can zoom to percentage levels (50%, 75%, 100%, 150%, 200%)

## Out of Scope

Explicitly excluded for v1.2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Folder sync | Two-way sync is complex, defer to v2+ |
| Conflict resolution UI | Start with replace-all, add granular UI based on feedback |
| PDF search within document | Can add in v1.3 if requested |
| PDF text selection/copy | Reader feature, not browser feature |
| Symlink following | Skip symlinks for safety, add option later if needed |
| Permission preservation | OS-specific complexity, use default permissions |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FLDR-01 | TBD | Pending |
| FLDR-02 | TBD | Pending |
| FLDR-03 | TBD | Pending |
| FLDR-04 | TBD | Pending |
| FLDR-05 | TBD | Pending |
| FLDR-06 | TBD | Pending |
| FLDR-07 | TBD | Pending |
| FLDR-08 | TBD | Pending |
| FLDR-09 | TBD | Pending |
| FLDR-10 | TBD | Pending |
| FLDR-11 | TBD | Pending |
| FLDR-12 | TBD | Pending |
| FLDR-13 | TBD | Pending |
| PDF-01 | TBD | Pending |
| PDF-02 | TBD | Pending |
| PDF-03 | TBD | Pending |
| PDF-04 | TBD | Pending |
| PDF-05 | TBD | Pending |
| PDF-06 | TBD | Pending |

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 (pending roadmap)

---
*Requirements defined: 2026-01-30*
