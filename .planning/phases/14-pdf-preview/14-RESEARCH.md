# Phase 14: PDF Preview - Research

**Researched:** 2026-01-30
**Domain:** PDF rendering in React/Electron with react-pdf
**Confidence:** HIGH

## Summary

This research investigated how to implement PDF preview functionality in an Electron + React + TypeScript application using Vite as the bundler. The project already has a well-established preview panel architecture with image, code, and markdown preview support, plus a lightbox system using `yet-another-react-lightbox`.

The standard approach for PDF rendering in React is the `react-pdf` library (by wojtekmaj), which wraps Mozilla's PDF.js. This library provides `<Document>` and `<Page>` components for rendering PDFs, with support for page navigation, zoom via the `scale` prop, and programmatic control. The library requires specific worker configuration for Vite bundler environments.

Key recommendations include: using canvas rendering mode (default, most stable), implementing page preloading manually (not built-in), following the existing codebase patterns for slides (like `MarkdownSlide` and `CodeSlide`), and handling the worker setup in the same module where PDF components are rendered.

**Primary recommendation:** Use react-pdf v10.x with canvas rendering, implement a `PDFPreview` component following the existing `ImagePreview` pattern, and create a `PDFSlide` component following the `MarkdownSlide`/`CodeSlide` pattern for lightbox support.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-pdf | ^10.0.0 | PDF rendering in React | 900K+ weekly downloads, wraps PDF.js, actively maintained, excellent React integration |
| pdfjs-dist | (peer dep) | Underlying PDF engine | Mozilla's official PDF.js, installed as dependency of react-pdf |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yet-another-react-lightbox | ^3.28.0 | Lightbox for fullscreen | Already in project, reuse for PDF lightbox |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-pdf | Chromium PDFium | Built-in to Electron, but requires opening in separate BrowserWindow, less control over UI |
| react-pdf | @pdf-viewer/react | Commercial features, but overkill for preview-only use case |
| react-pdf | raw PDF.js | More control, but react-pdf provides excellent React bindings |

**Installation:**
```bash
npm install react-pdf
```

Note: `pdfjs-dist` is a dependency of react-pdf and will be installed automatically.

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/components/PreviewPanel/
├── PDFPreview.tsx           # Preview panel PDF viewer (new)
├── PDFPreview.css           # PDF preview styling (new)
├── PDFSlide.tsx             # Lightbox PDF slide (new)
├── PDFSlide.css             # PDF slide styling (new)
├── Lightbox.tsx             # Update to support PDF slides
├── PreviewPanel.tsx         # Update to render PDFPreview
├── ImagePreview.tsx         # Existing (pattern to follow)
├── MarkdownSlide.tsx        # Existing (pattern to follow)
└── CodeSlide.tsx            # Existing (pattern to follow)

src/shared/types.ts          # Add PDF preview types
```

### Pattern 1: Worker Configuration (Vite)
**What:** Configure PDF.js worker in the same module as PDF components
**When to use:** Always required for react-pdf to function
**Example:**
```typescript
// Source: https://github.com/wojtekmaj/react-pdf
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// CRITICAL: Must be in same file as Document/Page usage
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
```

### Pattern 2: Basic PDF Document with Page Navigation
**What:** Render PDF with page state management
**When to use:** Core pattern for preview panel
**Example:**
```typescript
// Source: https://github.com/wojtekmaj/react-pdf
import { useState } from 'react';
import { Document, Page } from 'react-pdf';

interface PDFPreviewProps {
  dataUrl: string;  // base64 data URL from main process
  onPdfClick?: () => void;
}

function PDFPreview({ dataUrl, onPdfClick }: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  return (
    <div className="pdf-preview">
      <Document
        file={dataUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div>Loading PDF...</div>}
        error={<div>Failed to load PDF</div>}
      >
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={false}  // Disable for performance in preview
          renderAnnotationLayer={false}
        />
      </Document>
      <div className="pdf-preview__controls">
        <span>Page {pageNumber} of {numPages}</span>
      </div>
    </div>
  );
}
```

### Pattern 3: Fit Width Calculation
**What:** Calculate scale to fit PDF page to container width
**When to use:** Implementing "Fit Width" zoom option
**Example:**
```typescript
// Source: https://github.com/wojtekmaj/react-pdf/issues/74
import { useState, useRef, useCallback } from 'react';
import { Document, Page } from 'react-pdf';

function PDFPreview({ dataUrl }: { dataUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(1.0);

  // Get original page dimensions when page loads
  const onPageLoadSuccess = useCallback(({ originalWidth }: { originalWidth: number }) => {
    setPageWidth(originalWidth);
  }, []);

  // Calculate fit-width scale
  const fitWidth = useCallback(() => {
    if (containerRef.current && pageWidth) {
      const containerWidth = containerRef.current.clientWidth - 32; // padding
      const newScale = containerWidth / pageWidth;
      setScale(newScale);
    }
  }, [pageWidth]);

  return (
    <div ref={containerRef} className="pdf-preview">
      <Document file={dataUrl}>
        <Page
          pageNumber={1}
          scale={scale}
          onLoadSuccess={onPageLoadSuccess}
        />
      </Document>
    </div>
  );
}
```

### Pattern 4: Zoom Levels with Dropdown
**What:** Predefined zoom percentages matching requirements
**When to use:** PDF-04 and PDF-06 requirements
**Example:**
```typescript
type ZoomMode = 'fit-width' | 'fit-page' | 'actual' | number;

const ZOOM_PERCENTAGES = [50, 75, 100, 150, 200] as const;

interface ZoomControlsProps {
  currentZoom: ZoomMode;
  onZoomChange: (zoom: ZoomMode) => void;
}

function ZoomControls({ currentZoom, onZoomChange }: ZoomControlsProps) {
  return (
    <select
      value={typeof currentZoom === 'number' ? currentZoom : currentZoom}
      onChange={(e) => {
        const val = e.target.value;
        if (val === 'fit-width' || val === 'fit-page' || val === 'actual') {
          onZoomChange(val);
        } else {
          onZoomChange(Number(val));
        }
      }}
    >
      <option value="fit-width">Fit Width</option>
      <option value="fit-page">Fit Page</option>
      <option value="actual">Actual Size</option>
      <optgroup label="Percentage">
        {ZOOM_PERCENTAGES.map(p => (
          <option key={p} value={p}>{p}%</option>
        ))}
      </optgroup>
    </select>
  );
}
```

### Pattern 5: Page Preloading (Manual Implementation)
**What:** Preload adjacent pages for smooth navigation
**When to use:** Per CONTEXT.md requirement for preloading 1-2 pages ahead
**Example:**
```typescript
// Source: https://github.com/wojtekmaj/react-pdf/issues/1816
// Note: react-pdf does NOT have built-in preloading; must implement manually

function PDFPreviewWithPreload({ dataUrl }: { dataUrl: string }) {
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);

  // Render current page + adjacent pages (hidden) for preloading
  const pagesToRender = [
    pageNumber - 1,  // previous
    pageNumber,      // current
    pageNumber + 1,  // next
    pageNumber + 2,  // next+1
  ].filter(p => p >= 1 && p <= numPages);

  return (
    <Document file={dataUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
      {pagesToRender.map(p => (
        <div
          key={p}
          style={{
            display: p === pageNumber ? 'block' : 'none',
            // Hidden pages still render to canvas (preloaded)
          }}
        >
          <Page pageNumber={p} scale={1.0} />
        </div>
      ))}
    </Document>
  );
}
```

### Anti-Patterns to Avoid
- **Setting workerSrc in separate file:** Always configure in the same module as `<Document>` usage. Import order can cause overwrites.
- **Rendering all pages at once:** For large PDFs, only render visible + adjacent pages. PDF.js recommends max 25 pages at a time.
- **Using SVG rendering mode:** SVG mode is experimental, poorly maintained, and has known performance issues when scaling.
- **Forgetting CSS imports:** Must import TextLayer.css and AnnotationLayer.css if using those features (can disable them for preview panel).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF parsing | Custom PDF parser | react-pdf (PDF.js) | PDF spec is 750+ pages, edge cases everywhere |
| Page rendering | Canvas drawing | react-pdf `<Page>` | Font embedding, image decoding, text positioning |
| Worker management | Manual Web Worker | pdfjs-dist worker | Complex message passing, memory management |
| Zoom calculation | Manual scaling | react-pdf `scale` prop + container measurement | Aspect ratio, resolution handling |

**Key insight:** PDF rendering is extraordinarily complex. PDF.js is the result of years of Mozilla engineering. Even "simple" features like text selection or annotation display have hundreds of edge cases.

## Common Pitfalls

### Pitfall 1: Worker Version Mismatch
**What goes wrong:** Error: "The API version 'X' does not match the Worker version 'Y'"
**Why it happens:** Worker file from different pdfjs-dist version than react-pdf expects
**How to avoid:** Let npm handle versions; don't manually copy worker files. Use `import.meta.url` pattern for Vite.
**Warning signs:** Console errors about version mismatch, "Setting up fake worker" message

### Pitfall 2: Worker Configuration in Wrong Module
**What goes wrong:** PDF loads in development but fails in production, or loads sometimes but not others
**Why it happens:** workerSrc set in one file, but module execution order causes default to overwrite
**How to avoid:** Always set `pdfjs.GlobalWorkerOptions.workerSrc` in the SAME file where `<Document>` is used
**Warning signs:** Works in one environment but not another, intermittent failures

### Pitfall 3: Memory Issues with Large PDFs
**What goes wrong:** Browser/Electron becomes slow or crashes with large PDFs
**Why it happens:** Rendering too many pages simultaneously, no virtualization
**How to avoid:** Only render current page + small buffer (2-3 pages). Per CONTEXT.md: warn on 100+ page PDFs.
**Warning signs:** Increasing memory usage when scrolling, UI lag

### Pitfall 4: CSS Import Path Changes Between Versions
**What goes wrong:** "Can't resolve 'react-pdf/dist/esm/Page/TextLayer.css'"
**Why it happens:** CSS paths changed between react-pdf versions (v5-9 vs v10+)
**How to avoid:** For v10+, use `'react-pdf/dist/Page/TextLayer.css'` (no `/esm/`)
**Warning signs:** Build errors referencing CSS files

### Pitfall 5: Scale Prop Not Updating Display
**What goes wrong:** Changing scale prop doesn't re-render the page
**Why it happens:** React key not forcing re-render when scale changes
**How to avoid:** Add key that includes scale: `<Page key={`${pageNumber}_${scale}`} ... />`
**Warning signs:** Zoom controls change state but display doesn't update

### Pitfall 6: Data URL Size Limits
**What goes wrong:** Large PDFs fail to load when passed as base64 data URL
**Why it happens:** Some environments have limits on data URL sizes
**How to avoid:** For large PDFs, use file:// URLs or Blob URLs instead of base64 data URLs
**Warning signs:** Small PDFs work, large ones fail; truncated content

## Code Examples

Verified patterns from official sources:

### Complete PDFPreview Component (following existing codebase patterns)
```typescript
// Source: Adapted from https://github.com/wojtekmaj/react-pdf + project patterns
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './PDFPreview.css';

// Worker setup - MUST be in same file
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type ZoomMode = 'fit-width' | 'fit-page' | 'actual' | number;

interface PDFPreviewProps {
  dataUrl: string;
  onPdfClick?: () => void;
}

function PDFPreview({ dataUrl, onPdfClick }: PDFPreviewProps): React.JSX.Element {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-width');
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  }, []);

  const onPageLoadSuccess = useCallback(({ originalWidth, originalHeight }: {
    originalWidth: number;
    originalHeight: number;
  }) => {
    setPageWidth(originalWidth);
    setPageHeight(originalHeight);
  }, []);

  // Recalculate scale when zoom mode or dimensions change
  useEffect(() => {
    if (!containerRef.current || !pageWidth || !pageHeight) return;

    const containerWidth = containerRef.current.clientWidth - 32;
    const containerHeight = containerRef.current.clientHeight - 80; // account for controls

    switch (zoomMode) {
      case 'fit-width':
        setScale(containerWidth / pageWidth);
        break;
      case 'fit-page':
        const widthScale = containerWidth / pageWidth;
        const heightScale = containerHeight / pageHeight;
        setScale(Math.min(widthScale, heightScale));
        break;
      case 'actual':
        setScale(1.0);
        break;
      default:
        if (typeof zoomMode === 'number') {
          setScale(zoomMode / 100);
        }
    }
  }, [zoomMode, pageWidth, pageHeight]);

  const goToPage = useCallback((page: number) => {
    setPageNumber(Math.max(1, Math.min(page, numPages)));
  }, [numPages]);

  // Pages to preload (current + adjacent)
  const pagesToRender = [
    pageNumber - 1,
    pageNumber,
    pageNumber + 1,
    pageNumber + 2,
  ].filter(p => p >= 1 && p <= numPages);

  return (
    <div ref={containerRef} className="pdf-preview" onClick={onPdfClick}>
      <Document
        file={dataUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div className="pdf-preview__loading">Loading PDF...</div>}
        error={<div className="pdf-preview__error">Failed to load PDF</div>}
      >
        {pagesToRender.map(p => (
          <div
            key={`${p}_${scale}`}
            style={{ display: p === pageNumber ? 'block' : 'none' }}
          >
            <Page
              pageNumber={p}
              scale={scale}
              onLoadSuccess={p === pageNumber ? onPageLoadSuccess : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        ))}
      </Document>

      <div className="pdf-preview__controls">
        <button onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1}>
          Prev
        </button>
        <span className="pdf-preview__page-indicator">
          Page {pageNumber} of {numPages}
        </span>
        <button onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= numPages}>
          Next
        </button>
      </div>
    </div>
  );
}

export default PDFPreview;
```

### PDFSlide Component (for Lightbox)
```typescript
// Source: Following existing MarkdownSlide/CodeSlide patterns
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './PDFSlide.css';

// Worker setup - MUST be in same file
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PDFSlideProps {
  dataUrl: string;
  filename: string;
  initialPage?: number;
  initialScale?: number;
}

export function PDFSlide({
  dataUrl,
  filename,
  initialPage = 1,
  initialScale = 1.0,
}: PDFSlideProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(initialScale);

  // Intercept wheel events to prevent lightbox zoom interference
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    contentEl.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    return () => {
      contentEl.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  return (
    <div className="pdf-slide">
      <div className="pdf-slide__header">
        <span className="pdf-slide__filename">{filename}</span>
        <span className="pdf-slide__page-info">Page {pageNumber} of {numPages}</span>
      </div>
      <div ref={contentRef} className="pdf-slide__content">
        <Document
          file={dataUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        >
          <Page
            key={`${pageNumber}_${scale}`}
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
      <div className="pdf-slide__controls">
        {/* Navigation and zoom controls - always visible per CONTEXT.md */}
      </div>
    </div>
  );
}
```

### Adding PDF Type to PreviewData
```typescript
// Source: Project pattern from src/shared/types.ts
export type PreviewData =
  | { type: 'image'; dataUrl: string; metadata: ImageMetadata; fileSize: number; mimeType: string }
  | { type: 'code'; content: string; language: string; lineCount: number; truncated: boolean }
  | { type: 'pdf'; dataUrl: string; pageCount: number; fileSize: number }  // NEW
  | { type: 'folder'; name: string; itemCount: number; totalSize: number }
  | { type: 'binary'; name: string; fileSize: number; mimeType: string }
  | { type: 'too-large'; name: string; fileSize: number }
  | { type: 'error'; message: string }
  | { type: 'loading'; progress: number };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-pdf v5-9 CSS paths (`/esm/`) | v10 CSS paths (`/dist/Page/`) | react-pdf v10 (2024) | Update import paths |
| `entry.webpack` import | Direct import with worker config | react-pdf v7+ | Simpler setup, works with all bundlers |
| SVG rendering option | Canvas only (SVG deprecated) | PDF.js decision | Don't use renderMode='svg' |

**Deprecated/outdated:**
- `react-pdf/dist/esm/entry.webpack`: Use direct import with manual worker configuration
- SVG rendering mode: Experimental, buggy, not maintained
- Automatic page preloading: Never existed; must implement manually

## Open Questions

Things that couldn't be fully resolved:

1. **Exact worker file handling in Electron production build**
   - What we know: Vite `import.meta.url` pattern works in development
   - What's unclear: May need vite-plugin-static-copy for production builds
   - Recommendation: Test in packaged Electron app early; may need to copy worker to assets

2. **Optimal preload buffer size**
   - What we know: CONTEXT.md specifies 1-2 pages ahead
   - What's unclear: Memory impact of preloading in Electron environment
   - Recommendation: Start with 2 pages ahead, monitor memory in testing

3. **Large PDF warning threshold**
   - What we know: CONTEXT.md specifies 100+ pages should warn
   - What's unclear: Should warning be blocking or dismissable?
   - Recommendation: Claude's discretion per CONTEXT.md - make it dismissable

## Sources

### Primary (HIGH confidence)
- [wojtekmaj/react-pdf GitHub](https://github.com/wojtekmaj/react-pdf) - Official repository, README, version info
- [react-pdf npm page](https://www.npmjs.com/package/react-pdf) - Current version confirmation

### Secondary (MEDIUM confidence)
- [GitHub Issue #74](https://github.com/wojtekmaj/react-pdf/issues/74) - Dynamic scaling based on width
- [GitHub Issue #1816](https://github.com/wojtekmaj/react-pdf/issues/1816) - Page preloading discussion (confirmed not built-in)
- [GitHub Discussion #1691](https://github.com/wojtekmaj/react-pdf/discussions/1691) - Large PDF performance
- [GitHub Discussion #1222](https://github.com/wojtekmaj/react-pdf/discussions/1222) - Canvas vs SVG rendering
- [DEV.to Article](https://dev.to/mfts/building-a-beautiful-document-viewer-with-react-pdf-666) - Implementation patterns

### Tertiary (LOW confidence)
- WebSearch results for Electron PDF best practices - General guidance only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-pdf is the clear standard, verified via npm, GitHub
- Architecture: HIGH - Based on existing codebase patterns + official react-pdf docs
- Pitfalls: HIGH - Multiple GitHub issues document these problems with solutions

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (react-pdf is stable, 30 days reasonable)
