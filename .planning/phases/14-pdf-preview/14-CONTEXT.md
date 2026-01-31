# Phase 14: PDF Preview - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Preview PDF files in the preview panel with page navigation and zoom controls. Users can view PDFs inline, navigate pages, adjust zoom, and open in fullscreen lightbox. PDF editing, annotation, and form filling are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Preview Panel Layout
- Navigation controls placement: Claude's discretion (based on existing codebase patterns)
- Default zoom level: Claude's discretion (based on panel size and common patterns)
- Zoom persistence between PDFs: Claude's discretion (based on UX patterns)
- Zoom control UI style: Claude's discretion (based on space constraints)

### Lightbox Experience
- Controls always visible in lightbox (no auto-hide)
- Keyboard shortcuts identical between panel and lightbox (arrow keys for pages, same zoom shortcuts)
- Lightbox opens to current page (if viewing page 5 in panel, lightbox shows page 5)
- Zoom level preserved when opening lightbox (150% in panel = 150% in lightbox)

### Loading & Performance
- Loading indicator: Claude's discretion (based on existing preview patterns)
- Error handling: Claude's discretion (appropriate error display)
- Page loading strategy: Preload adjacent pages (current + 1-2 pages ahead for smoother navigation)
- Large PDF handling: Warn on 100+ page PDFs, offer to open externally

### Claude's Discretion
- Navigation controls position (top vs bottom toolbar)
- Default zoom level (fit width vs fit page)
- Whether to persist zoom preference across sessions
- Zoom control style (dropdown vs plus/minus buttons)
- Loading indicator style (skeleton vs spinner)
- Error state presentation

</decisions>

<specifics>
## Specific Ideas

- Lightbox should preserve reading context — same page, same zoom as panel
- Large PDFs (100+ pages) should warn user and offer external open option
- Adjacent page preloading for smooth navigation experience

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-pdf-preview*
*Context gathered: 2026-01-30*
