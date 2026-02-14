// Image preview with EXIF metadata display

import React from 'react';
import type { ImageMetadata } from '../../../shared/types';
import { formatSize, formatDate } from '../../utils/formatters';

interface ImagePreviewProps {
  dataUrl: string;
  metadata: ImageMetadata;
  fileSize: number;
  mimeType: string;
  onImageClick?: () => void;  // For lightbox trigger
}

/**
 * Image preview component with EXIF metadata.
 */
function ImagePreview({
  dataUrl,
  metadata,
  fileSize,
  mimeType,
  onImageClick,
}: ImagePreviewProps): React.JSX.Element {
  return (
    <div className="preview-panel__image">
      <div className="preview-panel__image-container">
        <img
          src={dataUrl}
          alt="Preview"
          className="preview-panel__image-img"
          onClick={onImageClick}
          style={{ cursor: onImageClick ? 'zoom-in' : 'default' }}
        />
      </div>
      <div className="preview-panel__metadata">
        <div className="preview-panel__metadata-row">
          <span className="preview-panel__metadata-label">Size</span>
          <span className="preview-panel__metadata-value">{formatSize(fileSize)}</span>
        </div>
        {metadata.width && metadata.height && (
          <div className="preview-panel__metadata-row">
            <span className="preview-panel__metadata-label">Dimensions</span>
            <span className="preview-panel__metadata-value">
              {metadata.width} x {metadata.height}
            </span>
          </div>
        )}
        <div className="preview-panel__metadata-row">
          <span className="preview-panel__metadata-label">Type</span>
          <span className="preview-panel__metadata-value">{mimeType}</span>
        </div>
        {metadata.camera && (
          <div className="preview-panel__metadata-row">
            <span className="preview-panel__metadata-label">Camera</span>
            <span className="preview-panel__metadata-value">{metadata.camera}</span>
          </div>
        )}
        {metadata.dateTaken && (
          <div className="preview-panel__metadata-row">
            <span className="preview-panel__metadata-label">Date Taken</span>
            <span className="preview-panel__metadata-value">
              {formatDate(metadata.dateTaken)}
            </span>
          </div>
        )}
        {metadata.gps && (
          <div className="preview-panel__metadata-row">
            <span className="preview-panel__metadata-label">GPS</span>
            <span className="preview-panel__metadata-value">
              {metadata.gps.latitude.toFixed(4)}, {metadata.gps.longitude.toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImagePreview;
