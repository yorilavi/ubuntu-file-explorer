// Main preview panel container
// Renders appropriate preview based on file type

import React, { useEffect, useCallback, useRef } from 'react';
import type { FileEntry, PreviewData } from '../../../shared/types';
import { usePreview } from '../../hooks/usePreview';
import ImagePreview from './ImagePreview';
import CodePreview from './CodePreview';
import './PreviewPanel.css';

interface PreviewPanelProps {
  serverId: string | null;
  selectedFile: FileEntry | null;
  onImageClick?: (dataUrl: string) => void;  // For lightbox
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
  onImageClick?: (dataUrl: string) => void
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

    case 'code':
      return (
        <CodePreview
          content={preview.content}
          language={preview.language}
          lineCount={preview.lineCount}
          truncated={preview.truncated}
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
  onImageClick,
}: PreviewPanelProps): React.JSX.Element {
  const { preview, loading, progress } = usePreview(serverId, selectedFile);

  // Store preview ref for spacebar handler
  const previewRef = useRef(preview);
  previewRef.current = preview;

  // Handle spacebar event to open lightbox
  const handleOpenLightbox = useCallback(() => {
    const currentPreview = previewRef.current;
    if (currentPreview?.type === 'image' && onImageClick) {
      onImageClick(currentPreview.dataUrl);
    }
  }, [onImageClick]);

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
        {preview ? renderPreviewContent(preview, onImageClick) : null}
      </div>
    </div>
  );
}

export default PreviewPanel;
