// Code preview with syntax highlighting
// Theme follows macOS dark/light mode
// Supports streaming for large files (>500 lines)

import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import VirtualizedCodePreview from './VirtualizedCodePreview';

interface CodePreviewProps {
  content: string;
  language: string;
  lineCount: number;
  truncated: boolean;
  filePath?: string; // Remote file path for streaming
  onStreamedContentReady?: (content: string, language: string) => void; // Called when streamed content is available
}

/**
 * Code preview with syntax highlighting.
 * Theme automatically switches based on macOS dark/light mode.
 * Large files (>500 lines) use virtualized rendering with streaming.
 */
function CodePreview({
  content,
  language,
  lineCount,
  truncated,
  filePath,
  onStreamedContentReady,
}: CodePreviewProps): React.JSX.Element {
  // Track system dark mode preference
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Line numbers off by default per CONTEXT.md
  const [showLineNumbers, setShowLineNumbers] = useState(false);

  // Streaming state for large files
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [streamComplete, setStreamComplete] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLanguage, setStreamLanguage] = useState(language);

  // Track current file path for stream filtering
  const currentFilePathRef = useRef(filePath);
  currentFilePathRef.current = filePath;

  // Listen for theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Subscribe to code chunk streaming
  useEffect(() => {
    // Reset streaming state when file changes
    setStreamLines([]);
    setStreamComplete(false);
    setIsStreaming(false);

    // Subscribe to code chunks
    const unsubscribe = window.electronAPI.onCodeChunk((data) => {
      // Only process chunks for current file
      if (data.filePath !== currentFilePathRef.current) {
        return;
      }

      if (data.isInitial) {
        // First chunk - initialize streaming
        setIsStreaming(true);
        setStreamLanguage(data.language);
        // Split chunk into lines, filtering empty trailing line from split
        const lines = data.chunk.split('\n');
        setStreamLines(lines);
      } else {
        // Subsequent chunks - append lines
        setStreamLines((prev) => {
          const newLines = data.chunk.split('\n');
          // Handle potential partial line from previous chunk
          // The last line of prev might be incomplete if chunk didn't end with \n
          return [...prev, ...newLines];
        });
      }

      if (data.isComplete) {
        setStreamComplete(true);
      }
    });

    return unsubscribe;
  }, [filePath]);

  // Notify parent when streamed content is ready for lightbox
  useEffect(() => {
    if (isStreaming && streamLines.length > 0 && onStreamedContentReady) {
      // Join lines back into content string for lightbox use
      const streamedContent = streamLines.join('\n');
      onStreamedContentReady(streamedContent, streamLanguage);
    }
  }, [isStreaming, streamLines, streamLanguage, onStreamedContentReady]);

  // Determine what to display
  const displayLineCount = isStreaming ? streamLines.length : lineCount;
  const displayTruncated = truncated && !isStreaming;
  const showVirtualized = isStreaming && streamLines.length > 0;

  // Large file waiting for streaming (empty content, high line count)
  const isWaitingForStream = !isStreaming && !content && lineCount > 500;

  return (
    <div className="preview-panel__code">
      {/* Toolbar */}
      <div className="preview-panel__code-toolbar">
        <span className="preview-panel__code-info">
          {isStreaming ? streamLanguage : language} - {displayLineCount.toLocaleString()} lines
          {displayTruncated && ' (truncated)'}
          {isStreaming && !streamComplete && ' (loading...)'}
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

      {/* Truncation notice - only for non-streamed files */}
      {displayTruncated && (
        <div className="preview-panel__code-notice">
          Showing first 500 of {lineCount.toLocaleString()} lines
        </div>
      )}

      {/* Code content - virtualized for large files, regular for small */}
      <div className="preview-panel__code-content">
        {showVirtualized ? (
          <VirtualizedCodePreview
            lines={streamLines}
            language={streamLanguage}
            totalLines={displayLineCount}
            loadingComplete={streamComplete}
            showLineNumbers={showLineNumbers}
          />
        ) : isWaitingForStream ? (
          <div className="preview-panel__code-waiting">
            Loading large file ({lineCount.toLocaleString()} lines)...
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default CodePreview;
