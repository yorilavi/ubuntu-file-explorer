// MarkdownSlide - Lightbox slide wrapper for markdown content
// Provides fixed header with filename and scrollable content area

import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import './MarkdownSlide.css';

interface MarkdownSlideProps {
  content: string;
  filename: string;
  basePath: string;
  onNavigate?: (path: string) => void;
}

/**
 * Lightbox slide for markdown content.
 * Matches existing image lightbox styling with:
 * - Fixed header showing filename
 * - Scrollable content area for long documents
 * - 80vh max-height to match image lightbox
 */
export function MarkdownSlide({
  content,
  filename,
  basePath,
  onNavigate,
}: MarkdownSlideProps): React.JSX.Element {
  return (
    <div className="markdown-slide">
      <div className="markdown-slide__header">
        <span className="markdown-slide__filename">{filename}</span>
      </div>
      <div className="markdown-slide__content">
        <MarkdownRenderer
          content={content}
          basePath={basePath}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

export default MarkdownSlide;
