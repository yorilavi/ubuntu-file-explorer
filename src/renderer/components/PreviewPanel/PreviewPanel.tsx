// Main preview panel container
// Renders appropriate preview based on file type

import React, { useEffect, useCallback, useRef } from 'react';
import type { FileEntry, PreviewData } from '../../../shared/types';
import { usePreview } from '../../hooks/usePreview';
import ImagePreview from './ImagePreview';
import CodePreview from './CodePreview';
import PDFPreview from './PDFPreview';
import './PreviewPanel.css';

interface PreviewPanelProps {
  serverId: string | null;
  selectedFile: FileEntry | null;
  lightboxOpen?: boolean;  // Whether lightbox is currently open (for navigation updates)
  onImageClick?: (dataUrl: string) => void;  // For lightbox
  onImagePreviewReady?: (dataUrl: string) => void;  // Called when new image preview loads
  onMarkdownPreviewReady?: (content: string) => void;  // Called when markdown preview loads
  onCodePreviewReady?: (content: string, language: string) => void;  // Called when code preview loads
  onPDFPreviewReady?: (dataUrl: string, numPages: number, currentPage: number, scale: number) => void;  // Called when PDF preview loads
}

// PDF state for spacebar/lightbox handling
interface PDFState {
  dataUrl: string;
  numPages: number;
  currentPage: number;
  scale: number;
}

/**
 * Format file size for display.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Render content based on preview type.
 */
function renderPreviewContent(
  preview: PreviewData,
  onImageClick?: (dataUrl: string) => void,
  filePath?: string,
  onStreamedContentReady?: (content: string, language: string) => void,
  onPDFClick?: () => void,
  onPDFLoadSuccess?: (numPages: number, currentPage: number, scale: number) => void
): React.JSX.Element {
  switch (preview.type) {
    case 'image':
      return (
        <ImagePreview
          dataUrl={preview.dataUrl}
          metadata={preview.metadata}
          fileSize={preview.fileSize}
          mimeType={preview.mimeType}
          onImageClick={() => onImageClick?.(preview.dataUrl)}
        />
      );

    case 'pdf':
      return (
        <PDFPreview
          dataUrl={preview.dataUrl}
          fileSize={preview.fileSize}
          onPDFClick={onPDFClick}
          onPDFLoadSuccess={onPDFLoadSuccess}
        />
      );

    case 'code':
      return (
        <CodePreview
          content={preview.content}
          language={preview.language}
          lineCount={preview.lineCount}
          truncated={preview.truncated}
          filePath={filePath}
          onStreamedContentReady={onStreamedContentReady}
        />
      );

    case 'folder':
      return (
        <div className="preview-panel__folder">
          <div className="preview-panel__folder-icon">📁</div>
          <div className="preview-panel__folder-name">{preview.name}</div>
          <div className="preview-panel__folder-info">
            <span>{preview.itemCount} items</span>
            <span>{formatSize(preview.totalSize)}</span>
          </div>
        </div>
      );

    case 'binary':
      return (
        <div className="preview-panel__info">
          <div className="preview-panel__info-icon">📄</div>
          <div className="preview-panel__info-name">{preview.name}</div>
          <div className="preview-panel__info-details">
            <span>{preview.mimeType}</span>
            <span>{formatSize(preview.fileSize)}</span>
          </div>
          <div className="preview-panel__info-notice">Binary file - no preview available</div>
        </div>
      );

    case 'too-large':
      return (
        <div className="preview-panel__info">
          <div className="preview-panel__info-icon">⚠️</div>
          <div className="preview-panel__info-name">{preview.name}</div>
          <div className="preview-panel__info-details">
            <span>{formatSize(preview.fileSize)}</span>
          </div>
          <div className="preview-panel__info-notice">
            File too large for preview (max 50 MB)
          </div>
        </div>
      );

    case 'error':
      return (
        <div className="preview-panel__error">
          <div className="preview-panel__error-icon">❌</div>
          <div className="preview-panel__error-message">{preview.message}</div>
        </div>
      );

    case 'loading':
      return (
        <div className="preview-panel__loading">
          <div className="preview-panel__loading-text">Loading preview...</div>
          <div className="preview-panel__progress">
            <div
              className="preview-panel__progress-bar"
              style={{ width: `${preview.progress}%` }}
            />
          </div>
          <div className="preview-panel__progress-text">{preview.progress}%</div>
        </div>
      );

    default:
      return <div className="preview-panel__empty">Select a file to preview</div>;
  }
}

/**
 * Preview panel component.
 * Shows preview for selected file with loading states.
 */
function PreviewPanel({
  serverId,
  selectedFile,
  lightboxOpen,
  onImageClick,
  onImagePreviewReady,
  onMarkdownPreviewReady,
  onCodePreviewReady,
  onPDFPreviewReady,
}: PreviewPanelProps): React.JSX.Element {
  const { preview, loading, progress } = usePreview(serverId, selectedFile);

  // Store preview ref for spacebar handler
  const previewRef = useRef(preview);
  previewRef.current = preview;

  // Store streamed content for large files (used by lightbox)
  const streamedContentRef = useRef<{ content: string; language: string } | null>(null);

  // Store PDF state for spacebar handling
  const pdfStateRef = useRef<PDFState | null>(null);

  // Reset streamed content and PDF state when file changes
  useEffect(() => {
    streamedContentRef.current = null;
    pdfStateRef.current = null;
  }, [selectedFile?.path]);

  // Handle streamed content ready from CodePreview
  const handleStreamedContentReady = useCallback((content: string, language: string) => {
    streamedContentRef.current = { content, language };
  }, []);

  // Handle PDF click for lightbox
  const handlePDFClick = useCallback(() => {
    const currentPreview = previewRef.current;
    if (currentPreview?.type === 'pdf' && onPDFPreviewReady) {
      const state = pdfStateRef.current;
      onPDFPreviewReady(
        currentPreview.dataUrl,
        state?.numPages || 0,
        state?.currentPage || 1,
        state?.scale || 1
      );
    }
  }, [onPDFPreviewReady]);

  // Handle PDF load success to track state
  const handlePDFLoadSuccess = useCallback((numPages: number, currentPage: number, scale: number) => {
    const currentPreview = previewRef.current;
    if (currentPreview?.type === 'pdf') {
      pdfStateRef.current = {
        dataUrl: currentPreview.dataUrl,
        numPages,
        currentPage,
        scale,
      };
    }
  }, []);

  // Notify parent when a new image preview is ready
  useEffect(() => {
    if (preview?.type === 'image' && onImagePreviewReady) {
      onImagePreviewReady(preview.dataUrl);
    }
  }, [preview, onImagePreviewReady]);

  // Helper to check if file is markdown
  const isMarkdownFile = useCallback((filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'md' || ext === 'mdx';
  }, []);

  // Update markdown/code content when navigating while lightbox is already open
  // (Spacebar opening is handled separately by handleOpenLightbox)
  useEffect(() => {
    if (lightboxOpen && preview?.type === 'code' && selectedFile) {
      // For large files, preview.content is empty - use streamed content instead
      const contentToUse = preview.content || streamedContentRef.current?.content || '';
      const languageToUse = preview.content ? preview.language : (streamedContentRef.current?.language || preview.language);

      if (isMarkdownFile(selectedFile.name) && onMarkdownPreviewReady) {
        onMarkdownPreviewReady(contentToUse);
      } else if (onCodePreviewReady) {
        onCodePreviewReady(contentToUse, languageToUse);
      }
    }
  }, [lightboxOpen, preview, selectedFile, isMarkdownFile, onMarkdownPreviewReady, onCodePreviewReady]);

  // Handle spacebar event to open lightbox
  const handleOpenLightbox = useCallback(() => {
    const currentPreview = previewRef.current;
    // Image
    if (currentPreview?.type === 'image' && onImageClick) {
      onImageClick(currentPreview.dataUrl);
      return;
    }
    // PDF
    if (currentPreview?.type === 'pdf' && onPDFPreviewReady) {
      const state = pdfStateRef.current;
      onPDFPreviewReady(
        currentPreview.dataUrl,
        state?.numPages || 0,
        state?.currentPage || 1,
        state?.scale || 1
      );
      return;
    }
    // Code files (including markdown)
    if (currentPreview?.type === 'code' && selectedFile) {
      // For large files, preview.content is empty - use streamed content instead
      const contentToUse = currentPreview.content || streamedContentRef.current?.content || '';
      const languageToUse = currentPreview.content ? currentPreview.language : (streamedContentRef.current?.language || currentPreview.language);

      if (isMarkdownFile(selectedFile.name) && onMarkdownPreviewReady) {
        onMarkdownPreviewReady(contentToUse);
      } else if (onCodePreviewReady) {
        onCodePreviewReady(contentToUse, languageToUse);
      }
    }
  }, [onImageClick, onPDFPreviewReady, onMarkdownPreviewReady, onCodePreviewReady, selectedFile, isMarkdownFile]);

  useEffect(() => {
    window.addEventListener('open-lightbox', handleOpenLightbox);
    return () => window.removeEventListener('open-lightbox', handleOpenLightbox);
  }, [handleOpenLightbox]);

  // Empty state
  if (!selectedFile) {
    return (
      <div className="preview-panel preview-panel--empty">
        <div className="preview-panel__placeholder">Select a file to preview</div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="preview-panel preview-panel--loading">
        <div className="preview-panel__loading">
          <div className="preview-panel__loading-text">Loading preview...</div>
          <div className="preview-panel__progress">
            <div
              className="preview-panel__progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="preview-panel__progress-text">{progress}%</div>
        </div>
      </div>
    );
  }

  // Preview content
  return (
    <div className="preview-panel">
      <div className="preview-panel__header">
        <span className="preview-panel__filename" title={selectedFile.name}>
          {selectedFile.name}
        </span>
      </div>
      <div className="preview-panel__content">
        {preview ? renderPreviewContent(
          preview,
          onImageClick,
          selectedFile?.path,
          handleStreamedContentReady,
          handlePDFClick,
          handlePDFLoadSuccess
        ) : null}
      </div>
    </div>
  );
}

export default PreviewPanel;
