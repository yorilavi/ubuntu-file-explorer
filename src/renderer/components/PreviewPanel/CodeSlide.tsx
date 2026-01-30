// CodeSlide - Lightbox slide wrapper for code files
// Provides fixed header with filename and scrollable syntax-highlighted content

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CodeSlide.css';

interface CodeSlideProps {
  content: string;
  filename: string;
  language: string;
}

/**
 * Lightbox slide for code content.
 * Matches markdown lightbox styling with:
 * - Fixed header showing filename
 * - Scrollable content area with syntax highlighting
 * - 80vh max-height to match other lightbox slides
 */
export function CodeSlide({
  content,
  filename,
  language,
}: CodeSlideProps): React.JSX.Element {
  // Stop wheel event propagation to prevent lightbox zoom from intercepting scroll
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="code-slide" onWheel={handleWheel}>
      <div className="code-slide__header">
        <span className="code-slide__filename">{filename}</span>
        <span className="code-slide__language">{language}</span>
      </div>
      <div className="code-slide__content">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          showLineNumbers
          wrapLongLines
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.5',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export default CodeSlide;
