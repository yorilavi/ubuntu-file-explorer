# Phase 11: Performance & Polish - Research

**Researched:** 2026-01-29
**Domain:** Large file performance optimization, UI polish (resize reset)
**Confidence:** MEDIUM-HIGH

## Summary

This phase addresses two distinct concerns: (1) performance optimization for loading and displaying large code files (10,000+ lines) without freezing the UI, and (2) adding double-click reset functionality to resize handles. The existing codebase already has `@tanstack/react-virtual` for column virtualization and `react-syntax-highlighter` for code display - the challenge is adapting these for incremental/virtualized code rendering.

The key performance insight is that the current implementation loads entire files before displaying and renders all syntax-highlighted lines at once. For large files, this blocks the main thread during both the SFTP read and the syntax highlighting. The solution involves: (1) chunked SFTP reading with early display of initial content, (2) virtualized line rendering, and (3) optionally Web Workers for syntax highlighting.

The double-click reset feature is a straightforward UI polish item - adding `onDoubleClick` handlers to existing resize handles that reset widths to stored defaults.

**Primary recommendation:** Implement chunked file loading with streaming display, virtualize code line rendering using @tanstack/react-virtual (already in project), and add double-click handlers to resize handles with stored default values.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-virtual | ^3.13.18 | Virtualize code lines | Already used for columns, proven API |
| react-syntax-highlighter | ^16.1.0 | Syntax highlighting | Already in use, supports custom renderers |
| ssh2 | ^1.17.0 | SFTP with streaming | Already in use, supports start/end ranges |

### Supporting (May Add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-syntax-highlighter-virtualized-renderer | ^1.1.0 | Virtualized syntax highlighting | If custom virtualization is too complex |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom virtualization | react-syntax-highlighter-virtualized-renderer | Uses react-virtualized (different from @tanstack/react-virtual), 8 years old, adds dependency |
| prism via react-syntax-highlighter | prism.js directly in Web Worker | More control but adds complexity, prism's built-in Web Worker has bundler compatibility issues |

**Installation (if needed):**
```bash
# Only if using the virtualized renderer helper
npm install react-syntax-highlighter-virtualized-renderer
```

## Architecture Patterns

### Recommended Approach: Three-Layer Optimization

```
Layer 1: SFTP Streaming (Main Process)
├── Stream file in chunks using ssh2 createReadStream
├── Send initial chunk (first 500 lines) immediately
├── Continue loading rest in background
└── Use IPC to stream chunks to renderer

Layer 2: Chunked Processing (Renderer)
├── Display initial content immediately
├── Use requestIdleCallback for processing additional chunks
├── Parse line boundaries, accumulate content
└── Update state in batches to avoid re-render thrashing

Layer 3: Virtualized Display (React Component)
├── Only render visible lines (viewport + overscan)
├── Use @tanstack/react-virtual with fixed line height
├── Apply syntax highlighting per-line or in batches
└── Scroll position preserved during incremental loading
```

### Pattern 1: Chunked SFTP Read with Streaming IPC

**What:** Read large files in chunks from SFTP, stream to renderer progressively
**When to use:** Files over 500 lines (current truncation threshold)
**Example:**
```typescript
// Main process: preview-handlers.ts
// Instead of reading entire file, stream chunks

const INITIAL_CHUNK_SIZE = 500 * 100; // ~500 lines at ~100 bytes/line
const CHUNK_SIZE = 1000 * 100; // Subsequent chunks

async function streamCodeFile(
  sftp: SFTPWrapper,
  filePath: string,
  mainWindow: BrowserWindow
): Promise<void> {
  const stats = await sftp.stat(filePath);
  let offset = 0;
  let chunkIndex = 0;

  // Send initial chunk immediately
  const initialChunk = await readChunk(sftp, filePath, 0, INITIAL_CHUNK_SIZE);
  mainWindow.webContents.send('preview:code-chunk', {
    filePath,
    chunk: initialChunk.toString('utf-8'),
    chunkIndex: 0,
    isInitial: true,
    totalSize: stats.size,
  });
  offset = INITIAL_CHUNK_SIZE;

  // Stream remaining chunks
  while (offset < stats.size) {
    const chunk = await readChunk(sftp, filePath, offset, CHUNK_SIZE);
    mainWindow.webContents.send('preview:code-chunk', {
      filePath,
      chunk: chunk.toString('utf-8'),
      chunkIndex: ++chunkIndex,
      isInitial: false,
      isComplete: offset + CHUNK_SIZE >= stats.size,
    });
    offset += CHUNK_SIZE;
    // Small delay to not overwhelm IPC
    await new Promise(r => setTimeout(r, 10));
  }
}

function readChunk(
  sftp: SFTPWrapper,
  path: string,
  start: number,
  length: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = sftp.createReadStream(path, {
      start,
      end: start + length - 1,
    });
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
```

### Pattern 2: Virtualized Code Display with @tanstack/react-virtual

**What:** Only render visible code lines, reuse existing virtualizer pattern
**When to use:** Displaying any code file in preview panel
**Example:**
```typescript
// Renderer: VirtualizedCodePreview.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

interface VirtualizedCodePreviewProps {
  lines: string[];
  language: string;
  style: Record<string, React.CSSProperties>;
}

function VirtualizedCodePreview({
  lines,
  language,
  style,
}: VirtualizedCodePreviewProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20, // Fixed line height in pixels
    overscan: 20, // Render extra lines for smooth scroll
  });

  return (
    <div
      ref={parentRef}
      style={{ height: '100%', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <SyntaxHighlighter
              language={language}
              style={style}
              customStyle={{
                margin: 0,
                padding: 0,
                background: 'transparent',
              }}
              PreTag="span"
            >
              {lines[virtualRow.index]}
            </SyntaxHighlighter>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Pattern 3: Double-Click Reset for Resize Handles

**What:** Reset column/preview width to default on double-click
**When to use:** All resize handles in the application
**Example:**
```typescript
// ColumnView.tsx - Add to resize handle
const DEFAULT_COLUMN_WIDTH = 220;

const handleResizeDoubleClick = useCallback((e: React.MouseEvent, index: number) => {
  e.preventDefault();
  setColumnWidths(prev => {
    const updated = [...prev];
    updated[index] = DEFAULT_COLUMN_WIDTH;
    return updated;
  });
  // Save to IPC
  const newWidths = [...savedWidthsRef.current];
  newWidths[index] = DEFAULT_COLUMN_WIDTH;
  savedWidthsRef.current = newWidths;
  window.electronAPI.setColumnWidths(newWidths);
}, []);

// In JSX:
<div
  className="column-view__resize-handle"
  onMouseDown={(e) => handleResizeStart(e, index)}
  onDoubleClick={(e) => handleResizeDoubleClick(e, index)}
/>
```

### Anti-Patterns to Avoid

- **Loading entire large file before display:** Blocks main thread, delays initial render. Always stream and display incrementally.
- **Re-rendering entire syntax highlighter on scroll:** Causes jank. Virtualize line rendering.
- **Synchronous IPC for file reading:** Blocks renderer. Always use async IPC.
- **Processing all chunks immediately:** Causes UI freeze. Use requestIdleCallback for background processing.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtualized lists | Custom scroll position tracking | @tanstack/react-virtual | Already in project, handles edge cases |
| Syntax highlighting | Manual regex tokenization | react-syntax-highlighter | Handles 100+ languages, themes |
| Chunked iteration | for loop blocking main thread | requestIdleCallback | Browser-native idle scheduling |
| SFTP range reads | Manual buffer slicing | ssh2 createReadStream with start/end | Native support, efficient |

**Key insight:** The existing stack (@tanstack/react-virtual + react-syntax-highlighter + ssh2 streaming) provides all the building blocks. The implementation is about composition, not new dependencies.

## Common Pitfalls

### Pitfall 1: Line Boundary Corruption in Chunked Reads

**What goes wrong:** Reading fixed byte chunks can split UTF-8 characters or cut lines mid-way
**Why it happens:** Byte offsets don't align with line boundaries or character boundaries
**How to avoid:**
- Read slightly more than needed
- Find last complete line boundary in chunk
- Track partial line for next chunk
- Use text decoder with `stream: true` option
**Warning signs:** Garbled characters, missing line content, off-by-one line numbers

### Pitfall 2: State Update Thrashing

**What goes wrong:** Each chunk triggers a re-render, causing visual stutter
**Why it happens:** Calling setState for every small chunk
**How to avoid:**
- Batch multiple chunks before setState
- Use requestIdleCallback to defer non-urgent updates
- Debounce updates with a minimum interval (e.g., 50ms)
**Warning signs:** UI visibly refreshing rapidly, high CPU during load

### Pitfall 3: Scroll Position Jump During Incremental Load

**What goes wrong:** Scroll position resets when content is appended
**Why it happens:** Total content height changes, virtualizer recalculates
**How to avoid:**
- Lock scroll position before update
- Restore scroll position after content append
- Use virtualizer's scrollToOffset to maintain position
**Warning signs:** Content jumping while scrolling during load

### Pitfall 4: Memory Bloat from Highlighted Lines Cache

**What goes wrong:** Caching all 10,000+ highlighted lines consumes excessive memory
**Why it happens:** Each line produces complex React elements/styles
**How to avoid:**
- Only highlight visible lines on-demand
- Don't memoize line highlighting beyond small LRU cache
- Let virtualized lines be garbage collected
**Warning signs:** Renderer memory growing unbounded, eventual slowdown

### Pitfall 5: Web Worker Bundler Incompatibility

**What goes wrong:** Prism.js Web Worker async highlighting crashes or fails
**Why it happens:** Prism's built-in Web Worker approach assumes unbundled script files
**How to avoid:**
- If using Web Workers, create custom worker with explicit prism import
- Or skip Web Workers and use requestIdleCallback + virtualization instead
**Warning signs:** Worker initialization errors, empty highlighted output

## Code Examples

Verified patterns for implementation:

### Incremental Content Accumulation with Line Tracking
```typescript
// Track content and handle line boundaries
interface StreamState {
  lines: string[];
  partialLine: string;
  totalLines: number;
  loadingComplete: boolean;
}

function processChunk(
  prevState: StreamState,
  chunk: string
): StreamState {
  // Combine partial line from previous chunk
  const combined = prevState.partialLine + chunk;
  const newLines = combined.split('\n');

  // Last element may be partial (no trailing newline)
  const partialLine = newLines.pop() || '';

  return {
    lines: [...prevState.lines, ...newLines],
    partialLine,
    totalLines: prevState.totalLines + newLines.length,
    loadingComplete: false,
  };
}
```

### requestIdleCallback for Background Processing
```typescript
// Process chunks without blocking UI
function processChunksIdle(
  chunks: string[],
  onChunkProcessed: (lines: string[]) => void,
  onComplete: () => void
) {
  let index = 0;

  function processNext(deadline: IdleDeadline) {
    while (index < chunks.length && deadline.timeRemaining() > 5) {
      const lines = chunks[index].split('\n');
      onChunkProcessed(lines);
      index++;
    }

    if (index < chunks.length) {
      requestIdleCallback(processNext);
    } else {
      onComplete();
    }
  }

  requestIdleCallback(processNext);
}
```

### IPC Listener Setup for Streaming
```typescript
// preload.ts - expose streaming listener
contextBridge.exposeInMainWorld('electronAPI', {
  // ...existing methods
  onCodeChunk: (callback: (data: CodeChunkData) => void) => {
    const handler = (_event: IpcRendererEvent, data: CodeChunkData) => {
      callback(data);
    };
    ipcRenderer.on('preview:code-chunk', handler);
    return () => ipcRenderer.removeListener('preview:code-chunk', handler);
  },
});

// Renderer hook
function useCodeStreaming(filePath: string | null) {
  const [state, dispatch] = useReducer(streamReducer, initialState);

  useEffect(() => {
    if (!filePath) return;

    const unsubscribe = window.electronAPI.onCodeChunk((data) => {
      if (data.filePath === filePath) {
        dispatch({ type: 'CHUNK_RECEIVED', chunk: data.chunk });
        if (data.isComplete) {
          dispatch({ type: 'LOADING_COMPLETE' });
        }
      }
    });

    return unsubscribe;
  }, [filePath]);

  return state;
}
```

### Preview Panel Double-Click Reset
```typescript
// App.tsx - Preview panel resize with double-click reset
const DEFAULT_PREVIEW_WIDTH = 300;

const handlePreviewDoubleClick = useCallback((e: React.MouseEvent) => {
  e.preventDefault();
  setPreviewWidth(DEFAULT_PREVIEW_WIDTH);
  window.electronAPI.setPreviewPanelWidth(DEFAULT_PREVIEW_WIDTH);
}, []);

// In JSX:
<div
  className="browser-main__resize-handle"
  onMouseDown={handlePreviewResizeStart}
  onDoubleClick={handlePreviewDoubleClick}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Load full file, render all lines | Virtualize with @tanstack/react-virtual | 2022+ | 100x+ performance for large files |
| Block main thread | requestIdleCallback + Web Workers | Standard since 2018 | UI stays responsive |
| react-virtualized | @tanstack/react-virtual | 2021+ | Smaller, headless, framework-agnostic |

**Deprecated/outdated:**
- `react-syntax-highlighter-virtualized-renderer` uses older react-virtualized (not @tanstack), 8 years unmaintained
- Prism.js built-in Web Worker async mode has bundler compatibility issues with Webpack/Vite

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal chunk size for SFTP reads**
   - What we know: 32KB default is too small, 252KB can cause corruption
   - What's unclear: Optimal size for code files (mostly text, highly compressible)
   - Recommendation: Start with 50KB (50 * 1024), measure and adjust

2. **Line height consistency across fonts/themes**
   - What we know: Virtualizer needs accurate line heights
   - What's unclear: Whether syntax highlighter themes affect line height
   - Recommendation: Use fixed font-size and line-height in CSS, measure once on mount

3. **react-syntax-highlighter memory with per-line highlighting**
   - What we know: Full file highlighting is slow
   - What's unclear: Per-line highlighting overhead vs. batch
   - Recommendation: Implement and profile both approaches

## Sources

### Primary (HIGH confidence)
- @tanstack/react-virtual - https://tanstack.com/virtual/latest (variable size, dynamic sizing)
- Electron Performance Docs - https://www.electronjs.org/docs/latest/tutorial/performance
- ssh2 SFTP.md - https://github.com/mscdex/ssh2/blob/master/SFTP.md (createReadStream with start/end)

### Secondary (MEDIUM confidence)
- react-syntax-highlighter-virtualized-renderer - https://github.com/conorhastings/react-syntax-highlighter-virtualized-renderer (concept verified, library outdated)
- Prism.js Web Worker docs - https://prismjs.com/ (async mode exists but bundler issues)
- Web Workers MDN - https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

### Tertiary (LOW confidence)
- WebSearch findings on SFTP chunk sizes - multiple sources cite issues with large chunks, need testing
- WebSearch findings on Prism bundler issues - may be resolved in newer versions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing project dependencies
- Architecture patterns: MEDIUM-HIGH - Based on documented patterns, needs validation
- Pitfalls: MEDIUM - Based on experience and issues reports, some may not apply

**Research date:** 2026-01-29
**Valid until:** 60 days (stable patterns, no rapid changes expected)
