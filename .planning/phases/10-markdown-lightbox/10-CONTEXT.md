# Phase 10: Markdown Lightbox - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Preview markdown files in a rendered lightbox view. Users can press spacebar on .md files to open rendered content, close with Escape or click outside, and navigate between previewable files with arrow keys. Extends existing image lightbox functionality.

</domain>

<decisions>
## Implementation Decisions

### Rendering style
- GitHub-flavored markdown styling (familiar, clean headers, bordered code blocks, styled tables)
- Syntax highlighting for code blocks (color-coded based on language fence: ```js, ```python, etc.)
- Images render inline — fetch and display remote images embedded in markdown
- Task list checkboxes are read-only (display only, no toggling)

### Layout & sizing
- Same dimensions as existing image lightbox for consistency
- Long documents scroll within fixed-height lightbox (content scrolls, lightbox doesn't grow)
- Header with filename visible at top of lightbox
- Close button (X) in corner plus Escape key and click-outside to close

### Navigation behavior
- Arrow keys navigate through all previewable files (images and markdown together, not just .md)
- Navigation stops at ends (no wrap-around)
- Position indicator shown (e.g., "3 of 7")
- Left/right arrow buttons visible on hover for mouse navigation

### Link handling
- External links (https://...) open in system default browser
- Relative links to other files navigate to that file (if .md, open in lightbox; others navigate in file browser)
- Anchor links (#section-heading) scroll to the heading within the document
- Standard link styling (blue/underlined like typical markdown)

### Claude's Discretion
- Choice of markdown rendering library
- Exact syntax highlighting theme (should match dark app theme)
- Animation/transition details
- Error handling for broken images or invalid markdown

</decisions>

<specifics>
## Specific Ideas

- Lightbox should feel consistent with existing image lightbox (same size, same close behavior, same navigation pattern)
- GitHub-flavored markdown is the reference for styling decisions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-markdown-lightbox*
*Context gathered: 2026-01-29*
