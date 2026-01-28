// Code preview with syntax highlighting
// Theme follows macOS dark/light mode

import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodePreviewProps {
  content: string;
  language: string;
  lineCount: number;
  truncated: boolean;
}

/**
 * Code preview with syntax highlighting.
 * Theme automatically switches based on macOS dark/light mode.
 */
function CodePreview({
  content,
  language,
  lineCount,
  truncated,
}: CodePreviewProps): React.JSX.Element {
  // Track system dark mode preference
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Line numbers off by default per CONTEXT.md
  const [showLineNumbers, setShowLineNumbers] = useState(false);

  // Listen for theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return (
    <div className="preview-panel__code">
      {/* Toolbar */}
      <div className="preview-panel__code-toolbar">
        <span className="preview-panel__code-info">
          {language} - {lineCount.toLocaleString()} lines
          {truncated && ' (truncated)'}
        </span>
        <label className="preview-panel__code-toggle">
          <input
            type="checkbox"
            checked={showLineNumbers}
            onChange={(e) => setShowLineNumbers(e.target.checked)}
          />
          Line numbers
        </label>
      </div>

      {/* Truncation notice */}
      {truncated && (
        <div className="preview-panel__code-notice">
          Showing first 500 of {lineCount.toLocaleString()} lines
        </div>
      )}

      {/* Syntax highlighted code */}
      <div className="preview-panel__code-content">
        <SyntaxHighlighter
          language={language}
          style={isDark ? oneDark : oneLight}
          showLineNumbers={showLineNumbers}
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '13px',
            lineHeight: 1.5,
            background: 'transparent',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export default CodePreview;
