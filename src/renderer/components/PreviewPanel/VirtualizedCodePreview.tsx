// Virtualized code preview for large files
// Renders only visible lines using @tanstack/react-virtual

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface VirtualizedCodePreviewProps {
  lines: string[];
  language: string;
  totalLines: number;
  loadingComplete: boolean;
  showLineNumbers: boolean;
}

// Fixed line height for consistent virtualization
const LINE_HEIGHT = 20; // 13px font * 1.5 line-height ~= 20px

/**
 * Virtualized code preview component.
 * Only renders visible lines for performance with large files.
 */
function VirtualizedCodePreview({
  lines,
  language,
  totalLines,
  loadingComplete,
  showLineNumbers,
}: VirtualizedCodePreviewProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);

  // Track system dark mode preference
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Listen for theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Calculate line number width based on total lines
  const lineNumberWidth = useMemo(() => {
    const digits = String(totalLines).length;
    return digits * 10 + 16; // 10px per digit + padding
  }, [totalLines]);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 20, // Render extra lines for smooth scrolling
  });

  const style = isDark ? oneDark : oneLight;

  return (
    <div className="virtualized-code-preview">
      {/* Scrollable container */}
      <div
        ref={parentRef}
        className="virtualized-code-preview__container"
        style={{
          height: '100%',
          overflow: 'auto',
        }}
      >
        {/* Virtual list wrapper */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const lineNumber = virtualRow.index + 1;
            const lineContent = lines[virtualRow.index] || '';

            return (
              <div
                key={virtualRow.index}
                className="virtualized-code-preview__line"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${LINE_HEIGHT}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'flex',
                }}
              >
                {/* Line number gutter */}
                {showLineNumbers && (
                  <span
                    className="virtualized-code-preview__line-number"
                    style={{
                      width: `${lineNumberWidth}px`,
                      minWidth: `${lineNumberWidth}px`,
                      textAlign: 'right',
                      paddingRight: '12px',
                      color: isDark ? '#636d83' : '#999',
                      userSelect: 'none',
                      fontSize: '13px',
                      lineHeight: `${LINE_HEIGHT}px`,
                    }}
                  >
                    {lineNumber}
                  </span>
                )}
                {/* Syntax highlighted line */}
                <div
                  className="virtualized-code-preview__code"
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    whiteSpace: 'pre',
                    fontSize: '13px',
                    lineHeight: `${LINE_HEIGHT}px`,
                    paddingLeft: showLineNumbers ? 0 : '12px',
                  }}
                >
                  <SyntaxHighlighter
                    language={language}
                    style={style}
                    PreTag="span"
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: 'transparent',
                      display: 'inline',
                      fontSize: '13px',
                      lineHeight: `${LINE_HEIGHT}px`,
                    }}
                    codeTagProps={{
                      style: {
                        fontSize: '13px',
                        lineHeight: `${LINE_HEIGHT}px`,
                      },
                    }}
                  >
                    {lineContent || ' '} {/* Space for empty lines */}
                  </SyntaxHighlighter>
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading indicator */}
        {!loadingComplete && (
          <div
            className="virtualized-code-preview__loading"
            style={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '8px 12px',
              background: isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
              color: isDark ? '#888' : '#666',
              fontSize: '12px',
              textAlign: 'center',
            }}
          >
            Loading more content... ({lines.length.toLocaleString()} lines loaded)
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualizedCodePreview;
