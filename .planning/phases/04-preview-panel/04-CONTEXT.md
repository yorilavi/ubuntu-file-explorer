# Phase 4: Preview Panel - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Display instant previews of images and code files when selecting items in the column view. Includes a lightbox mode for enlarged image viewing. File editing and external app integration are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Image Preview Behavior
- Fit to panel: scale image to fit bounds while maintaining aspect ratio
- Lightbox combines interactive zoom (click-to-zoom, pan, scroll wheel) AND gallery mode (arrow keys navigate prev/next images)
- Show full EXIF metadata when available: dimensions, file size, type, camera, date taken, GPS
- Instant swap between images (no crossfade animation)
- Support all formats Chromium can render (JPG, PNG, GIF, WebP, SVG, etc.)
- GIFs: play on hover, static thumbnail otherwise
- SVG files: render visually by default, toggle button to view XML source

### Code Preview Styling
- Syntax highlighting theme follows macOS dark/light mode setting
- Line numbers: off by default, toggle button to show/hide
- Preview first 500 lines of large files (scroll to see, indicates truncation)

### Panel Layout
- Position: right side of column view (Finder-style)
- Width: resizable by dragging, persists user preference
- Collapsible: both toggle button in UI and keyboard shortcut (e.g., Cmd+Shift+P)
- When folder selected or nothing selected: show folder info (name, item count, total size)

### Loading & Performance
- Loading indicator: progress bar showing download progress
- Skip preview for files larger than 50 MB (show file info only)
- Debounce: 150ms delay after selection change before loading preview
- Disk cache with staleness checking: cache previewed files, verify file hasn't changed (mtime/size) before serving from cache
- Prefetch adjacent files (next/prev in list) for smoother arrow-key navigation

### Claude's Discretion
- Lightbox gallery scope (all images in folder vs selected only)
- Binary/non-text file handling approach
- Specific keyboard shortcut for panel toggle
- Cache eviction policy and max cache size
- Loading state skeleton/placeholder design

</decisions>

<specifics>
## Specific Ideas

- Lightbox should feel like a proper image viewer: zoom, pan, and navigate through folder
- Progress bar for loading gives user sense of download progress over network
- SVG toggle mirrors "view source" mental model developers expect

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-preview-panel*
*Context gathered: 2026-01-27*
