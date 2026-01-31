// PDFSlide - Lightbox slide wrapper for PDF content
// Provides fullscreen PDF viewing with navigation and zoom controls

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './PDFSlide.css';

// CRITICAL: Worker config must be in same file as Document/Page usage
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

type ZoomMode = 'fit-width' | 'fit-page' | 'actual' | number;

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.5, 2.0] as const;

export function PDFSlide({
  dataUrl,
  filename,
  initialPage = 1,
  initialScale = 1.0,
}: PDFSlideProps): React.JSX.Element {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);
  const [scale, setScale] = useState<number>(initialScale);
  const [zoomMode, setZoomMode] = useState<ZoomMode>(initialScale);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Use capture phase to intercept wheel events before the lightbox zoom plugin
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Stop the event from reaching the lightbox zoom handler
      e.stopPropagation();
    };

    contentEl.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    return () => {
      contentEl.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  // Calculate scale based on zoom mode
  const calculateScale = useCallback((mode: ZoomMode, width: number, height: number) => {
    if (!containerRef.current || !width || !height) return initialScale;

    // Use viewport dimensions for lightbox (80vh max per existing patterns)
    const containerWidth = Math.min(window.innerWidth * 0.9, 1200);
    const containerHeight = window.innerHeight * 0.75;

    if (mode === 'fit-width') {
      return containerWidth / width;
    } else if (mode === 'fit-page') {
      const scaleW = containerWidth / width;
      const scaleH = containerHeight / height;
      return Math.min(scaleW, scaleH);
    } else if (mode === 'actual') {
      return 1.0;
    } else {
      return mode;
    }
  }, [initialScale]);

  const onDocumentLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    // Clamp initial page to valid range
    setPageNumber(Math.min(Math.max(1, initialPage), pages));
    setLoading(false);
    setError(null);
  }, [initialPage]);

  const onPageLoadSuccess = useCallback(({ originalWidth, originalHeight }: { originalWidth: number; originalHeight: number }) => {
    setPageWidth(originalWidth);
    setPageHeight(originalHeight);

    // Only recalculate if using fit modes
    if (zoomMode === 'fit-width' || zoomMode === 'fit-page') {
      const newScale = calculateScale(zoomMode, originalWidth, originalHeight);
      setScale(newScale);
    }
  }, [zoomMode, calculateScale]);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setLoading(false);
  }, []);

  // Page navigation
  const goToPrevPage = useCallback(() => {
    setPageNumber(prev => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber(prev => Math.min(numPages, prev + 1));
  }, [numPages]);

  // Keyboard navigation (lightbox-specific - arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        goToPrevPage();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [goToPrevPage, goToNextPage]);

  // Zoom handlers
  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'fit-width' || value === 'fit-page' || value === 'actual') {
      setZoomMode(value);
      if (pageWidth && pageHeight) {
        setScale(calculateScale(value, pageWidth, pageHeight));
      }
    } else {
      const numericZoom = parseFloat(value);
      setZoomMode(numericZoom);
      setScale(numericZoom);
    }
  }, [pageWidth, pageHeight, calculateScale]);

  const getZoomDisplayValue = useCallback((): string => {
    if (zoomMode === 'fit-width' || zoomMode === 'fit-page' || zoomMode === 'actual') {
      return zoomMode;
    }
    return zoomMode.toString();
  }, [zoomMode]);

  if (error) {
    return (
      <div className="pdf-slide pdf-slide--error">
        <div className="pdf-slide__error-message">Failed to load PDF: {error}</div>
      </div>
    );
  }

  return (
    <div className="pdf-slide" ref={containerRef}>
      <div className="pdf-slide__header">
        <span className="pdf-slide__filename">{filename}</span>

        {/* Page navigation */}
        <div className="pdf-slide__nav">
          <button
            className="pdf-slide__nav-btn"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            Prev
          </button>
          <span className="pdf-slide__page-indicator">
            Page {pageNumber} of {numPages}
          </span>
          <button
            className="pdf-slide__nav-btn"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            Next
          </button>
        </div>

        {/* Zoom controls */}
        <select
          className="pdf-slide__zoom-select"
          value={getZoomDisplayValue()}
          onChange={handleZoomChange}
        >
          <option value="fit-width">Fit Width</option>
          <option value="fit-page">Fit Page</option>
          <option value="actual">Actual Size</option>
          <optgroup label="Zoom">
            {ZOOM_LEVELS.map(level => (
              <option key={level} value={level}>
                {Math.round(level * 100)}%
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div ref={contentRef} className="pdf-slide__content">
        {loading && (
          <div className="pdf-slide__loading">Loading PDF...</div>
        )}

        <Document
          file={dataUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
        >
          {[pageNumber - 1, pageNumber, pageNumber + 1, pageNumber + 2]
            .filter(p => p >= 1 && p <= numPages)
            .map(p => (
              <div
                key={`${p}_${scale}`}
                style={{ display: p === pageNumber ? 'block' : 'none' }}
              >
                <Page
                  pageNumber={p}
                  scale={scale}
                  onLoadSuccess={p === pageNumber ? onPageLoadSuccess : undefined}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
        </Document>
      </div>
    </div>
  );
}

export default PDFSlide;
