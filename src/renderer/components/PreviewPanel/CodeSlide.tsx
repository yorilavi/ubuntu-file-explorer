// CodeSlide - Lightbox slide wrapper for code files
// Provides fixed header with filename and scrollable syntax-highlighted content

import React, { useEffect, useRef } from 'react';
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
  const contentRef = useRef<HTMLDivElement>(null);

  // Use capture phase to intercept wheel events before the lightbox zoom plugin
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Stop the event from reaching the lightbox zoom handler
      e.stopPropagation();
    };

    // Capture phase ensures we handle the event before the lightbox
    contentEl.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    return () => {
      contentEl.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  return (
    <div className="code-slide">
      <div className="code-slide__header">
        <span className="code-slide__filename">{filename}</span>
        <span className="code-slide__language">{language}</span>
      </div>
      <div ref={contentRef} className="code-slide__content">
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
