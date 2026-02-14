// PDF preview with page navigation and zoom controls
// Uses react-pdf for rendering with pdfjs-dist worker

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { formatSize } from '../../utils/formatters';
import './PDFPreview.css';

// CRITICAL: Worker config must be in same file as Document/Page usage (per RESEARCH.md)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PDFPreviewProps {
  dataUrl: string;
  fileSize: number;
  onPDFClick?: () => void;  // For lightbox trigger
  onPDFLoadSuccess?: (numPages: number, currentPage: number, scale: number) => void;  // Notify parent of PDF state
}

type ZoomMode = 'fit-width' | 'fit-page' | 'actual' | number;

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.5, 2.0] as const;
const LARGE_PDF_THRESHOLD = 100;

function PDFPreview({
  dataUrl,
  fileSize,
  onPDFClick,
  onPDFLoadSuccess,
}: PDFPreviewProps): React.JSX.Element {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-width');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isLarge = numPages > LARGE_PDF_THRESHOLD;

  // Calculate scale based on zoom mode
  const calculateScale = useCallback((mode: ZoomMode, width: number, height: number) => {
    if (!containerRef.current || !width || !height) return 1.0;

    const containerWidth = containerRef.current.clientWidth - 32; // padding
    const containerHeight = containerRef.current.clientHeight - 120; // controls + padding

    if (mode === 'fit-width') {
      return containerWidth / width;
    } else if (mode === 'fit-page') {
      const scaleW = containerWidth / width;
      const scaleH = containerHeight / height;
      return Math.min(scaleW, scaleH);
    } else if (mode === 'actual') {
      return 1.0;
    } else {
      return mode; // Numeric zoom level
    }
  }, []);

  // Handle document load success
  const onDocumentLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    setPageNumber(1);
    setLoading(false);
    setError(null);
  }, []);

  // Handle page load success - get dimensions for fit calculations
  const onPageLoadSuccess = useCallback(({ originalWidth, originalHeight }: { originalWidth: number; originalHeight: number }) => {
    setPageWidth(originalWidth);
    setPageHeight(originalHeight);

    // Calculate initial scale
    const newScale = calculateScale(zoomMode, originalWidth, originalHeight);
    setScale(newScale);
  }, [zoomMode, calculateScale]);

  // Recalculate scale when zoom mode or container size changes
  useEffect(() => {
    if (pageWidth && pageHeight) {
      const newScale = calculateScale(zoomMode, pageWidth, pageHeight);
      setScale(newScale);
    }
  }, [zoomMode, pageWidth, pageHeight, calculateScale]);

  // Notify parent of PDF state changes
  useEffect(() => {
    if (numPages > 0 && onPDFLoadSuccess) {
      onPDFLoadSuccess(numPages, pageNumber, scale);
    }
  }, [numPages, pageNumber, scale, onPDFLoadSuccess]);

  // Handle document load error
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevPage, goToNextPage]);

  // Zoom handlers
  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'fit-width' || value === 'fit-page' || value === 'actual') {
      setZoomMode(value);
    } else {
      const numericZoom = parseFloat(value);
      setZoomMode(numericZoom);
      setScale(numericZoom);
    }
  }, []);

  // Get current zoom display value
  const getZoomDisplayValue = useCallback((): string => {
    if (zoomMode === 'fit-width' || zoomMode === 'fit-page' || zoomMode === 'actual') {
      return zoomMode;
    }
    return zoomMode.toString();
  }, [zoomMode]);

  if (error) {
    return (
      <div className="pdf-preview pdf-preview--error">
        <div className="pdf-preview__error-icon">!</div>
        <div className="pdf-preview__error-message">Failed to load PDF: {error}</div>
      </div>
    );
  }

  return (
    <div className="pdf-preview" ref={containerRef}>
      {/* Controls */}
      <div className="pdf-preview__controls">
        {/* Page navigation */}
        <div className="pdf-preview__nav">
          <button
            className="pdf-preview__nav-btn"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            data-tooltip="Previous page (Up/Left arrow)"
          >
            <span>Prev</span>
          </button>
          <span className="pdf-preview__page-indicator">
            Page {pageNumber} of {numPages}
          </span>
          <button
            className="pdf-preview__nav-btn"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            data-tooltip="Next page (Down/Right arrow)"
          >
            <span>Next</span>
          </button>
        </div>

        {/* Zoom controls */}
        <div className="pdf-preview__zoom">
          <select
            className="pdf-preview__zoom-select"
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
      </div>

      {/* Large PDF warning */}
      {isLarge && (
        <div className="pdf-preview__warning">
          Large PDF ({numPages} pages) - performance may vary
        </div>
      )}

      {/* PDF container */}
      <div
        className="pdf-preview__container"
        onClick={onPDFClick}
        style={{ cursor: onPDFClick ? 'zoom-in' : 'default' }}
      >
        {loading && (
          <div className="pdf-preview__loading">Loading PDF...</div>
        )}

        <Document
          file={dataUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
        >
          {/* Render current page + adjacent for preloading */}
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

      {/* Metadata */}
      <div className="pdf-preview__metadata">
        <div className="pdf-preview__metadata-row">
          <span className="pdf-preview__metadata-label">Size</span>
          <span className="pdf-preview__metadata-value">{formatSize(fileSize)}</span>
        </div>
        <div className="pdf-preview__metadata-row">
          <span className="pdf-preview__metadata-label">Pages</span>
          <span className="pdf-preview__metadata-value">{numPages}</span>
        </div>
      </div>
    </div>
  );
}

export default PDFPreview;
