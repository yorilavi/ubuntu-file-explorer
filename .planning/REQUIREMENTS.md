# Requirements: Ubuntu File Explorer v1.3

**Defined:** 2026-02-10
**Core Value:** Browse remote servers visually with instant image and code previews

## v1.3 Requirements

Requirements for Metadata & List View milestone. Each maps to roadmap phases.

### Metadata

- [ ] **META-01**: User can see file size in list view (human-readable: KB, MB, GB)
- [ ] **META-02**: User can see date modified in list view (human-readable format)
- [ ] **META-03**: User can see file kind/type in list view (folder, image, code, PDF, etc.)

### List View

- [ ] **LIST-01**: User can view current directory as a full-width list with columns (Name, Size, Date Modified, Kind)
- [ ] **LIST-02**: List view supports virtualized scrolling for large directories (1000+ files)
- [ ] **LIST-03**: User can navigate files with keyboard in list view (up/down arrows, Enter to open)
- [ ] **LIST-04**: User can right-click files in list view for context menu (same operations as Miller columns)
- [ ] **LIST-05**: User can select a file in list view to see its preview in the preview panel

### Sorting

- [ ] **SORT-01**: User can sort files by clicking column headers in list view
- [ ] **SORT-02**: User can toggle sort direction (ascending/descending) by clicking the same header again
- [ ] **SORT-03**: Folders always sort before files regardless of sort field
- [ ] **SORT-04**: Sort preference persists across directory navigation within a session

### View Toggle

- [ ] **VIEW-01**: User can toggle between Miller column view and list view via toolbar button
- [ ] **VIEW-02**: User can toggle view mode with a keyboard shortcut
- [ ] **VIEW-03**: View mode preference persists across app restarts
- [ ] **VIEW-04**: Switching views preserves the current directory and selected file

## Future Requirements

### Miller Column Sorting

- **MSORT-01**: User can sort files in Miller columns via dropdown menu
- **MSORT-02**: Sort applies to all columns simultaneously

### List View Enhancements

- **LEXT-01**: User can resize list view columns
- **LEXT-02**: User can reorder list view columns
- **LEXT-03**: User can see permissions column in list view

## Out of Scope

| Feature | Reason |
|---------|--------|
| Icon/gallery view mode | Additional complexity, not requested |
| Column customization (show/hide) | Over-engineering for 4 columns |
| Multi-file selection | Different interaction model, defer |
| Search/filter within directory | Separate feature, not part of metadata |
| Per-server sort/view preferences | Global preference sufficient for v1.3 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| META-01 | — | Pending |
| META-02 | — | Pending |
| META-03 | — | Pending |
| LIST-01 | — | Pending |
| LIST-02 | — | Pending |
| LIST-03 | — | Pending |
| LIST-04 | — | Pending |
| LIST-05 | — | Pending |
| SORT-01 | — | Pending |
| SORT-02 | — | Pending |
| SORT-03 | — | Pending |
| SORT-04 | — | Pending |
| VIEW-01 | — | Pending |
| VIEW-02 | — | Pending |
| VIEW-03 | — | Pending |
| VIEW-04 | — | Pending |

**Coverage:**
- v1.3 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14 ⚠️

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after initial definition*
