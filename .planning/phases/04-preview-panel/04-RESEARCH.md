# Phase 4: Preview Panel - Research

**Researched:** 2026-01-27
**Domain:** File preview (images, code/text) with syntax highlighting, lightbox, EXIF metadata
**Confidence:** HIGH

## Summary

This phase implements a Finder-style preview panel for displaying images and syntax-highlighted code. The research identified a mature ecosystem of React libraries that address each requirement: `react-syntax-highlighter` for code with theme support, `yet-another-react-lightbox` for image lightbox with zoom/pan/gallery, and `exifr` for EXIF metadata extraction. The architecture requires extending the existing IPC bridge with file reading capabilities, implementing a disk cache with staleness checking, and adding debounced preview updates.

The existing codebase already uses `react-resizable-panels` for the column view, making it straightforward to add a preview panel. The ssh2 library's SFTP API supports both streaming (`createReadStream`) and progress-tracked downloads (`fastGet` with `step` callback). For theme switching, Electron's `nativeTheme` API integrates with CSS `prefers-color-scheme` media queries.

**Primary recommendation:** Use react-syntax-highlighter (Prism variant) for code preview with theme switching via CSS media queries, yet-another-react-lightbox with Zoom plugin for image lightbox, and exifr for EXIF extraction. Implement file caching in Electron's userData directory with mtime/size staleness checks.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-syntax-highlighter | ^15.6.1 | Syntax highlighting for 185+ languages | Most popular React syntax highlighter, supports Prism & highlight.js, inline styles avoid CSS conflicts |
| yet-another-react-lightbox | ^3.25.0 | Image lightbox with zoom, pan, gallery | Modern, plugin-based, supports all input methods (touch, mouse, keyboard), no bloat |
| exifr | ^7.1.3 | EXIF/IPTC/XMP metadata extraction | Fastest JS EXIF library (2.5ms/file), isomorphic, minimal bundle |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/react-syntax-highlighter | ^15.5.13 | TypeScript definitions | Required for TypeScript projects |
| file-type | ^19.6.0 | Magic byte file type detection | Detect binary file types when extension unreliable |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-syntax-highlighter | shiki | Shiki is faster (WASM) but larger bundle, more complex setup |
| yet-another-react-lightbox | react-spring-lightbox | More customizable but no pre-built UI, requires building everything |
| exifr | ExifReader | ExifReader has wider format support but slower performance |

**Installation:**
```bash
npm install react-syntax-highlighter yet-another-react-lightbox exifr
npm install -D @types/react-syntax-highlighter
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   ├── ipc/
│   │   └── preview-handlers.ts    # IPC handlers for file reading
│   └── cache/
│       └── preview-cache.ts       # Disk cache with staleness checking
├── renderer/
│   ├── components/
│   │   └── PreviewPanel/
│   │       ├── PreviewPanel.tsx   # Main container
│   │       ├── ImagePreview.tsx   # Image display + metadata
│   │       ├── CodePreview.tsx    # Syntax highlighted code
│   │       ├── FolderInfo.tsx     # Folder details when folder selected
│   │       ├── Lightbox.tsx       # Lightbox wrapper
│   │       └── PreviewPanel.css   # BEM styles
│   └── hooks/
│       └── usePreview.ts          # Preview loading with debounce
└── shared/
    └── types.ts                   # Add preview types
```

### Pattern 1: Debounced Preview Loading
**What:** Delay preview loading after selection change to prevent thrashing during keyboard navigation
**When to use:** Any time file selection triggers preview fetch
**Example:**
```typescript
// Source: React docs + project requirements
import { useEffect, useRef, useState } from 'react';

interface UsePreviewOptions {
  debounceMs?: number;  // Default 150ms per CONTEXT.md
  maxFileSize?: number; // Default 50MB per CONTEXT.md
}

function usePreview(
  serverId: string | null,
  selectedFile: FileEntry | null,
  options: UsePreviewOptions = {}
) {
  const { debounceMs = 150, maxFileSize = 50 * 1024 * 1024 } = options;
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Abort previous fetch
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!serverId || !selectedFile || selectedFile.isDirectory) {
      setPreview(null);
      setLoading(false);
      return;
    }

    // Skip large files
    if (selectedFile.size > maxFileSize) {
      setPreview({ type: 'too-large', file: selectedFile });
      return;
    }

    // Debounce the fetch
    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      setProgress(0);
      abortRef.current = new AbortController();

      try {
        const data = await window.electronAPI.readFilePreview(
          serverId,
          selectedFile.path,
          (percent) => setProgress(percent)
        );
        setPreview(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setPreview({ type: 'error', error: err.message });
        }
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [serverId, selectedFile?.path, debounceMs, maxFileSize]);

  return { preview, loading, progress };
}
```

### Pattern 2: Theme-Aware Syntax Highlighting
**What:** Switch syntax highlighting theme based on macOS dark/light mode
**When to use:** Always for code preview
**Example:**
```typescript
// Source: react-syntax-highlighter docs + Electron nativeTheme
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodePreview({ code, language }: { code: string; language: string }) {
  // Use CSS media query for theme detection (propagated from nativeTheme)
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return (
    <SyntaxHighlighter
      language={language}
      style={isDark ? oneDark : oneLight}
      showLineNumbers={false}  // Off by default per CONTEXT.md
      customStyle={{
        margin: 0,
        borderRadius: 0,
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
```

### Pattern 3: File Reading with Progress via IPC
**What:** Stream file from SFTP with progress updates to renderer
**When to use:** Downloading files for preview
**Example:**
```typescript
// Source: ssh2 SFTP.md + Electron IPC docs
// Main process: preview-handlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { getConnection } from '../ssh/ssh-service';
import { getSFTP } from '../ssh/sftp-service';
import { getCachedFile, cacheFile, isCacheStale } from '../cache/preview-cache';

export function registerPreviewHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(
    'preview:read-file',
    async (_event, serverId: string, filePath: string) => {
      const client = getConnection(serverId);
      if (!client) throw new Error('Not connected');

      const sftp = await getSFTP(serverId, client);

      // Check cache first
      const cached = await getCachedFile(serverId, filePath);
      if (cached && !await isCacheStale(sftp, filePath, cached.mtime, cached.size)) {
        return cached.data;
      }

      // Get file stats for progress tracking
      const stats = await new Promise<Stats>((resolve, reject) => {
        sftp.stat(filePath, (err, s) => err ? reject(err) : resolve(s));
      });

      // Read file with progress updates
      const chunks: Buffer[] = [];
      let bytesRead = 0;

      await new Promise<void>((resolve, reject) => {
        const stream = sftp.createReadStream(filePath);
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          bytesRead += chunk.length;
          const progress = Math.round((bytesRead / stats.size) * 100);
          mainWindow.webContents.send('preview:progress', filePath, progress);
        });
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      const data = Buffer.concat(chunks);

      // Cache the file
      await cacheFile(serverId, filePath, data, stats.mtime, stats.size);

      return data;
    }
  );
}
```

### Pattern 4: Lightbox with Gallery Navigation
**What:** Full-screen image view with zoom, pan, and prev/next navigation
**When to use:** Spacebar press on image, or click in preview panel
**Example:**
```typescript
// Source: yet-another-react-lightbox docs
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

interface LightboxViewProps {
  images: Array<{ src: string; alt?: string; width?: number; height?: number }>;
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

function LightboxView({ images, initialIndex, open, onClose }: LightboxViewProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={initialIndex}
      slides={images}
      plugins={[Zoom]}
      zoom={{
        maxZoomPixelRatio: 3,
        zoomInMultiplier: 2,
        doubleTapDelay: 300,
        doubleClickMaxStops: 2,
        keyboardMoveDistance: 50,
        wheelZoomDistanceFactor: 100,
        scrollToZoom: true,
      }}
      carousel={{
        finite: false,  // Allow wrap-around
      }}
      on={{
        view: ({ index }) => {
          // Update selection in parent when navigating
        },
      }}
    />
  );
}
```

### Anti-Patterns to Avoid
- **Loading entire large files into memory:** Skip preview for files > 50MB, show file info only
- **Synchronous file reads:** Always use async streams with progress callbacks
- **Re-fetching on every selection change:** Use debounce (150ms) and disk cache with staleness checks
- **Building custom lightbox:** Use yet-another-react-lightbox, handles all edge cases (touch, mouse, keyboard)
- **Ignoring SFTP session reuse:** The project already caches SFTP wrappers; extend, don't duplicate

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Syntax highlighting | Custom tokenizer | react-syntax-highlighter | 185+ languages, themes, edge cases handled |
| Image zoom/pan | Touch event handlers | yet-another-react-lightbox Zoom plugin | Pinch zoom, mouse wheel, double-tap all handled |
| EXIF parsing | Buffer byte parsing | exifr | Format detection, GPS conversion, thumbnail extraction |
| File type detection | Extension mapping | file-type (if needed) | Magic bytes are reliable, extensions lie |
| Theme detection | Manual system calls | CSS prefers-color-scheme + nativeTheme | Electron propagates nativeTheme to CSS media queries |

**Key insight:** Image handling and syntax highlighting have countless edge cases (malformed files, encoding issues, touch gesture conflicts). Mature libraries have solved these through years of bug reports.

## Common Pitfalls

### Pitfall 1: IPC Serialization of Binary Data
**What goes wrong:** Buffer/Uint8Array sent via IPC may serialize incorrectly or hit size limits
**Why it happens:** Electron IPC has structured clone limitations
**How to avoid:** Use base64 encoding for smaller files, or write to temp file and send path for larger files. For images, create data URLs: `data:image/jpeg;base64,${buffer.toString('base64')}`
**Warning signs:** Corrupted images, truncated files, IPC timeout errors

### Pitfall 2: Memory Pressure from Large Previews
**What goes wrong:** Opening many large images causes renderer process memory issues
**Why it happens:** Images decoded into memory, not released when off-screen
**How to avoid:**
- Limit preview panel to current selection only
- Revoke Object URLs when switching previews: `URL.revokeObjectURL(oldUrl)`
- Set max file size limit (50MB per CONTEXT.md)
**Warning signs:** Slow scrolling, app becomes unresponsive, Electron memory warnings

### Pitfall 3: Race Conditions in Preview Loading
**What goes wrong:** Fast navigation shows wrong preview (older request completes after newer one)
**Why it happens:** Async fetches complete out of order
**How to avoid:**
- Use AbortController to cancel pending requests on new selection
- Track request ID and ignore stale responses
- Debounce selection changes (150ms)
**Warning signs:** Preview flickers, shows wrong file momentarily

### Pitfall 4: Cache Serving Stale Content
**What goes wrong:** Remote file changed but cache serves old version
**Why it happens:** Cache only checks existence, not freshness
**How to avoid:** Store mtime and size with cached file, verify against current stats before serving. Use `sftp.stat()` which is fast (no file transfer).
**Warning signs:** Preview doesn't match actual file, user confusion after remote edits

### Pitfall 5: Blocking Navigation with Preview Loading
**What goes wrong:** User can't navigate while preview loads
**Why it happens:** Loading state blocks interaction, or heavy rendering freezes UI
**How to avoid:**
- Never await preview load in navigation handler
- Use React Suspense or loading skeleton
- Keep loading indicator lightweight (simple progress bar)
**Warning signs:** Arrow keys feel laggy, can't escape from slow-loading preview

### Pitfall 6: GIF Autoplay Battery/Performance Drain
**What goes wrong:** Multiple GIFs playing simultaneously drain battery and CPU
**Why it happens:** Animated GIFs continue playing even when not visible
**How to avoid:** Per CONTEXT.md: GIFs play on hover only, static thumbnail otherwise. Use `<img>` with separate static first frame, swap to animated on mouseenter.
**Warning signs:** High CPU usage with directory of GIFs, fan noise

## Code Examples

Verified patterns from official sources:

### Syntax Highlighter with Line Numbers Toggle
```typescript
// Source: react-syntax-highlighter GitHub README
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodePreviewProps {
  code: string;
  language: string;
  showLineNumbers: boolean;
  maxLines?: number;  // 500 per CONTEXT.md
}

function CodePreview({ code, language, showLineNumbers, maxLines = 500 }: CodePreviewProps) {
  const lines = code.split('\n');
  const truncated = lines.length > maxLines;
  const displayCode = truncated ? lines.slice(0, maxLines).join('\n') : code;

  return (
    <div className="code-preview">
      {truncated && (
        <div className="code-preview__truncation-notice">
          Showing first {maxLines} of {lines.length} lines
        </div>
      )}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        wrapLongLines={true}
      >
        {displayCode}
      </SyntaxHighlighter>
    </div>
  );
}
```

### EXIF Metadata Extraction
```typescript
// Source: exifr GitHub README
import exifr from 'exifr';

interface ImageMetadata {
  width?: number;
  height?: number;
  fileSize: number;
  mimeType: string;
  camera?: string;
  dateTaken?: Date;
  gps?: { latitude: number; longitude: number };
}

async function extractImageMetadata(buffer: Buffer, fileSize: number): Promise<ImageMetadata> {
  try {
    // Parse EXIF (fast: ~2.5ms per file)
    const exif = await exifr.parse(buffer, {
      // Only parse what we need for performance
      tiff: true,
      exif: true,
      gps: true,
      ifd0: ['Make', 'Model', 'ImageWidth', 'ImageHeight'],
      exif: ['DateTimeOriginal', 'ExifImageWidth', 'ExifImageHeight'],
    });

    return {
      width: exif?.ExifImageWidth || exif?.ImageWidth,
      height: exif?.ExifImageHeight || exif?.ImageHeight,
      fileSize,
      mimeType: 'image/jpeg', // Detect from magic bytes if needed
      camera: exif?.Make && exif?.Model ? `${exif.Make} ${exif.Model}`.trim() : undefined,
      dateTaken: exif?.DateTimeOriginal,
      gps: exif?.latitude && exif?.longitude
        ? { latitude: exif.latitude, longitude: exif.longitude }
        : undefined,
    };
  } catch {
    // Not all images have EXIF
    return { fileSize, mimeType: 'image/unknown' };
  }
}
```

### Disk Cache with Staleness Check
```typescript
// Source: Project requirements + Node.js fs
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const CACHE_DIR = path.join(app.getPath('userData'), 'preview-cache');
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

interface CacheMetadata {
  remotePath: string;
  serverId: string;
  mtime: number;
  size: number;
  cachedAt: number;
}

function getCacheKey(serverId: string, remotePath: string): string {
  return crypto.createHash('md5').update(`${serverId}:${remotePath}`).digest('hex');
}

async function getCachedFile(serverId: string, remotePath: string): Promise<{
  data: Buffer;
  mtime: number;
  size: number;
} | null> {
  const key = getCacheKey(serverId, remotePath);
  const metaPath = path.join(CACHE_DIR, `${key}.meta.json`);
  const dataPath = path.join(CACHE_DIR, `${key}.data`);

  try {
    const metaRaw = await fs.readFile(metaPath, 'utf-8');
    const meta: CacheMetadata = JSON.parse(metaRaw);
    const data = await fs.readFile(dataPath);
    return { data, mtime: meta.mtime, size: meta.size };
  } catch {
    return null;
  }
}

async function isCacheStale(
  sftp: SFTPWrapper,
  remotePath: string,
  cachedMtime: number,
  cachedSize: number
): Promise<boolean> {
  return new Promise((resolve) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) {
        resolve(true); // Can't verify, treat as stale
        return;
      }
      const remoteMtime = stats.mtime * 1000; // ssh2 returns seconds
      resolve(stats.size !== cachedSize || remoteMtime !== cachedMtime);
    });
  });
}

async function cacheFile(
  serverId: string,
  remotePath: string,
  data: Buffer,
  mtime: number,
  size: number
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const key = getCacheKey(serverId, remotePath);
  const meta: CacheMetadata = {
    remotePath,
    serverId,
    mtime,
    size,
    cachedAt: Date.now(),
  };

  await fs.writeFile(path.join(CACHE_DIR, `${key}.data`), data);
  await fs.writeFile(path.join(CACHE_DIR, `${key}.meta.json`), JSON.stringify(meta));

  // Evict old entries if cache too large (async, don't await)
  evictOldCacheEntries().catch(console.error);
}
```

### SVG Preview with Source Toggle
```typescript
// Source: Project CONTEXT.md requirement
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SVGPreviewProps {
  svgContent: string;
  dataUrl: string;
}

function SVGPreview({ svgContent, dataUrl }: SVGPreviewProps) {
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="svg-preview">
      <div className="svg-preview__toolbar">
        <button
          className={`svg-preview__toggle ${showSource ? 'svg-preview__toggle--active' : ''}`}
          onClick={() => setShowSource(!showSource)}
        >
          {showSource ? 'View Rendered' : 'View Source'}
        </button>
      </div>
      {showSource ? (
        <SyntaxHighlighter language="xml" style={oneDark}>
          {svgContent}
        </SyntaxHighlighter>
      ) : (
        <img src={dataUrl} alt="SVG preview" className="svg-preview__image" />
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| highlight.js alone | react-syntax-highlighter with Prism | 2020+ | Better JSX/TSX support, tree-shaking |
| Custom modal + CSS transforms | yet-another-react-lightbox | 2023+ | Native-feeling gestures, accessibility |
| exif-js | exifr | 2021+ | 30x faster, smaller bundle, more formats |
| electron-store for cache | Custom fs-based cache | N/A | electron-store not suited for large binary files |

**Deprecated/outdated:**
- `react-image-lightbox`: Archived, use yet-another-react-lightbox instead
- `exif-js`: Less maintained, slower, fewer formats than exifr
- Prism.js v2: Development stalled since 2022, but react-syntax-highlighter wraps it well

## Open Questions

Things that couldn't be fully resolved:

1. **Lightbox gallery scope**
   - What we know: Can show all images in folder or just selected
   - What's unclear: User preference not specified, CONTEXT.md defers to Claude's discretion
   - Recommendation: Default to all images in current folder for gallery mode, with keyboard navigation updating ColumnView selection

2. **Binary/non-text file handling**
   - What we know: Images and code are specified; binary files (executables, archives) are not
   - What's unclear: Show hex dump? Just file info?
   - Recommendation: Show file info only (name, size, type, permissions) for unrecognized binary files

3. **Cache eviction policy**
   - What we know: Need a max size limit; CONTEXT.md defers to Claude
   - What's unclear: LRU vs time-based vs size-based
   - Recommendation: LRU eviction when cache exceeds 500MB, track access time in metadata

4. **HEIC support**
   - What we know: Chromium/Electron don't support HEIC rendering (~14% browser support)
   - What's unclear: Should we convert HEIC or just show "unsupported"?
   - Recommendation: Show "HEIC preview not supported" message with file info; conversion libraries add significant bundle size

## Sources

### Primary (HIGH confidence)
- [react-syntax-highlighter GitHub](https://github.com/react-syntax-highlighter/react-syntax-highlighter) - Props, usage, light build
- [yet-another-react-lightbox docs](https://yet-another-react-lightbox.com/documentation) - Core props, plugins, customization
- [yet-another-react-lightbox Zoom plugin](https://yet-another-react-lightbox.com/plugins/zoom) - Zoom configuration
- [exifr GitHub](https://github.com/MikeKovarik/exifr) - API, performance, bundle sizes
- [ssh2 SFTP.md](https://github.com/mscdex/ssh2/blob/master/SFTP.md) - createReadStream, fastGet, stat methods
- [Electron nativeTheme docs](https://www.electronjs.org/docs/latest/api/native-theme) - Dark mode detection, CSS integration

### Secondary (MEDIUM confidence)
- [npm react-syntax-highlighter](https://www.npmjs.com/package/react-syntax-highlighter) - Version 15.6.1, npm stats
- [npm yet-another-react-lightbox](https://www.npmjs.com/package/yet-another-react-lightbox) - Version 3.25.0
- [npm exifr](https://www.npmjs.com/package/exifr) - Version 7.1.3
- [Electron IPC tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - IPC patterns
- [MDN Image formats guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types) - Browser support for WebP, AVIF

### Tertiary (LOW confidence)
- WebSearch results for lightbox comparisons - Community preferences may vary
- WebSearch results for HEIC browser support - Stats may change with new browser releases

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and npm
- Architecture: HIGH - Patterns derived from official library docs and existing codebase patterns
- Pitfalls: MEDIUM - Based on general React/Electron knowledge and library docs, some from community reports

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - libraries are stable, no major releases expected)
