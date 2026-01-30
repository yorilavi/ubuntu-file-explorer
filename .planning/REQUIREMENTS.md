# Requirements: Ubuntu File Explorer

**Defined:** 2026-01-30
**Core Value:** Browse remote servers visually with instant image and code previews

## v1.2 Requirements

Requirements for v1.2 Folder Operations milestone. Each maps to roadmap phases.

### Folder Upload

- [x] **FLDR-01**: User can upload a local folder to a remote location recursively
- [x] **FLDR-02**: Folder structure is preserved on the remote server
- [x] **FLDR-03**: User sees overall progress (X of Y files) during folder upload
- [x] **FLDR-04**: User can cancel folder upload with cleanup of partial transfers
- [x] **FLDR-05**: Empty directories are created on remote during upload
- [x] **FLDR-06**: .DS_Store and ._ metadata files are excluded when hidden files toggle is off
- [x] **FLDR-07**: User can see which files failed and retry failed transfers

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
| FLDR-01 | 12 | Complete |
| FLDR-02 | 12 | Complete |
| FLDR-03 | 12 | Complete |
| FLDR-04 | 12 | Complete |
| FLDR-05 | 12 | Complete |
| FLDR-06 | 12 | Complete |
| FLDR-07 | 12 | Complete |
| FLDR-08 | 13 | Pending |
| FLDR-09 | 13 | Pending |
| FLDR-10 | 13 | Pending |
| FLDR-11 | 13 | Pending |
| FLDR-12 | 13 | Pending |
| FLDR-13 | 13 | Pending |
| PDF-01 | 14 | Pending |
| PDF-02 | 14 | Pending |
| PDF-03 | 14 | Pending |
| PDF-04 | 14 | Pending |
| PDF-05 | 14 | Pending |
| PDF-06 | 14 | Pending |

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 19 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-01-30*
*Traceability updated: 2026-01-30*
