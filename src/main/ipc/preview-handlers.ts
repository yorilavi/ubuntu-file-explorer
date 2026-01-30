// IPC handlers for file preview operations
// Reads files from SFTP with caching and progress updates

import { ipcMain, BrowserWindow } from 'electron';
import type { Stats } from 'ssh2';
import { getSFTPWrapper } from '../ssh/sftp-service';
import { getCachedFile, cacheFile, isCacheStale } from '../cache/preview-cache';
import type { PreviewData, FileTypeInfo, CodeChunkData } from '../../shared/types';
import exifr from 'exifr';

// File size limit per CONTEXT.md
const MAX_PREVIEW_SIZE = 50 * 1024 * 1024; // 50MB

// Streaming configuration for large files
// Files over this threshold stream progressively instead of truncating
const LARGE_FILE_THRESHOLD = 500; // lines (matches previous MAX_CODE_LINES)
const INITIAL_CHUNK_BYTES = 50 * 1024; // 50KB for ~500 lines initial content
const CHUNK_BYTES = 100 * 1024; // 100KB for subsequent chunks

/**
 * Detect file type from extension.
 */
function detectFileType(filename: string): FileTypeInfo {
  const ext = filename.toLowerCase().split('.').pop() || '';

  // Image extensions
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
  if (imageExts.includes(ext)) {
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      avif: 'image/avif',
    };
    return { category: 'image', mimeType: mimeMap[ext] || 'image/unknown' };
  }

  // Code/text extensions with language mapping
  const codeExts: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', mjs: 'javascript', cjs: 'javascript',
    // Web
    html: 'html', htm: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
    // Data
    json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml', toml: 'toml',
    // Shell
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
    // Python
    py: 'python', pyw: 'python', pyi: 'python',
    // Ruby
    rb: 'ruby', erb: 'erb', rake: 'ruby',
    // Go
    go: 'go',
    // Rust
    rs: 'rust',
    // C/C++
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
    // Java/Kotlin
    java: 'java', kt: 'kotlin', kts: 'kotlin',
    // PHP
    php: 'php',
    // Swift
    swift: 'swift',
    // Markdown/Docs
    md: 'markdown', mdx: 'markdown', txt: 'text', log: 'text',
    // Config
    ini: 'ini', conf: 'ini', cfg: 'ini', env: 'bash',
    // SQL
    sql: 'sql',
    // Docker
    dockerfile: 'dockerfile',
  };

  if (codeExts[ext]) {
    return { category: 'code', language: codeExts[ext], mimeType: 'text/plain' };
  }

  // Text files without extension
  const textExts = ['txt', 'log', 'readme', 'license', 'changelog', 'authors', 'contributors'];
  if (textExts.includes(ext)) {
    return { category: 'text', language: 'text', mimeType: 'text/plain' };
  }

  // Default to binary
  return { category: 'binary', mimeType: 'application/octet-stream' };
}

/**
 * Extract EXIF metadata from image buffer.
 */
async function extractImageMetadata(
  buffer: Buffer,
  fileSize: number,
  mimeType: string
): Promise<PreviewData & { type: 'image' }> {
  let width: number | undefined;
  let height: number | undefined;
  let camera: string | undefined;
  let dateTaken: Date | undefined;
  let gps: { latitude: number; longitude: number } | undefined;

  try {
    // Parse EXIF (fast: ~2.5ms per file)
    const exif = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      ifd0: { pick: ['Make', 'Model', 'ImageWidth', 'ImageHeight'] },
    });

    if (exif) {
      width = exif.ExifImageWidth || exif.ImageWidth;
      height = exif.ExifImageHeight || exif.ImageHeight;
      camera = exif.Make && exif.Model ? `${exif.Make} ${exif.Model}`.trim() : undefined;
      dateTaken = exif.DateTimeOriginal;
      gps = exif.latitude && exif.longitude
        ? { latitude: exif.latitude, longitude: exif.longitude }
        : undefined;
    }
  } catch {
    // Not all images have EXIF, that's fine
  }

  // Create data URL for renderer
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

  return {
    type: 'image',
    dataUrl,
    metadata: { width, height, camera, dateTaken, gps },
    fileSize,
    mimeType,
  };
}

/**
 * Process text/code file for preview.
 * Returns preview data and whether the file should be streamed.
 */
function processCodeFile(
  buffer: Buffer,
  language: string
): { preview: PreviewData & { type: 'code' }; shouldStream: boolean } {
  const content = buffer.toString('utf-8');
  const lines = content.split('\n');
  const shouldStream = lines.length > LARGE_FILE_THRESHOLD;

  if (shouldStream) {
    // Return minimal preview - streaming will provide full content
    return {
      preview: {
        type: 'code',
        content: '',
        language,
        lineCount: lines.length,
        truncated: false, // Not truncated - will be streamed
      },
      shouldStream: true,
    };
  }

  return {
    preview: {
      type: 'code',
      content,
      language,
      lineCount: lines.length,
      truncated: false,
    },
    shouldStream: false,
  };
}

/**
 * Stream a large code file in chunks via IPC.
 * Handles UTF-8 boundary corruption by tracking partial lines.
 */
async function streamLargeCodeFile(
  mainWindow: BrowserWindow,
  sftp: ReturnType<typeof getSFTPWrapper> extends Promise<infer T> ? T : never,
  filePath: string,
  totalSize: number,
  language: string
): Promise<void> {
  if (!sftp) return;

  let chunkIndex = 0;
  let bytesRead = 0;
  let partialLine = '';
  const decoder = new TextDecoder('utf-8', { fatal: false });

  // Helper to send chunk via IPC
  const sendChunk = (chunk: string, isInitial: boolean, isComplete: boolean) => {
    const data: CodeChunkData = {
      filePath,
      chunk,
      chunkIndex: chunkIndex++,
      isInitial,
      isComplete,
      totalSize,
      language,
    };
    mainWindow.webContents.send('preview:code-chunk', data);
  };

  // Read file in chunks
  const readChunk = (start: number, end: number): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = sftp.createReadStream(filePath, { start, end });

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', reject);
    });
  };

  // Send initial chunk (50KB)
  const initialEnd = Math.min(INITIAL_CHUNK_BYTES - 1, totalSize - 1);
  const initialBuffer = await readChunk(0, initialEnd);
  bytesRead = initialBuffer.length;

  // Decode with potential partial character at end
  let text = decoder.decode(initialBuffer, { stream: true });

  // Handle line boundary - find last complete line
  const lastNewline = text.lastIndexOf('\n');
  if (lastNewline >= 0 && bytesRead < totalSize) {
    partialLine = text.slice(lastNewline + 1);
    text = text.slice(0, lastNewline + 1);
  }

  const isComplete = bytesRead >= totalSize;
  sendChunk(text, true, isComplete);

  if (isComplete) return;

  // Continue reading remaining chunks with delay
  while (bytesRead < totalSize) {
    // Small delay to allow UI to render
    await new Promise(resolve => setTimeout(resolve, 10));

    const start = bytesRead;
    const end = Math.min(bytesRead + CHUNK_BYTES - 1, totalSize - 1);
    const chunkBuffer = await readChunk(start, end);
    bytesRead += chunkBuffer.length;

    // Decode chunk
    let chunkText = decoder.decode(chunkBuffer, { stream: bytesRead < totalSize });

    // Prepend partial line from previous chunk
    if (partialLine) {
      chunkText = partialLine + chunkText;
      partialLine = '';
    }

    // Handle line boundary for next iteration
    const lastNl = chunkText.lastIndexOf('\n');
    if (lastNl >= 0 && bytesRead < totalSize) {
      partialLine = chunkText.slice(lastNl + 1);
      chunkText = chunkText.slice(0, lastNl + 1);
    }

    const done = bytesRead >= totalSize;

    // Include any remaining partial line in final chunk
    if (done && partialLine) {
      chunkText += partialLine;
      partialLine = '';
    }

    sendChunk(chunkText, false, done);
  }
}

/**
 * Register preview IPC handlers.
 */
export function registerPreviewHandlers(mainWindow: BrowserWindow): void {
  // Read file for preview
  ipcMain.handle(
    'preview:read-file',
    async (_event, serverId: string, filePath: string, fileName: string, fileSize: number) => {
      // Check file size limit
      if (fileSize > MAX_PREVIEW_SIZE) {
        return {
          type: 'too-large',
          name: fileName,
          fileSize,
        } as PreviewData;
      }

      // Detect file type
      const fileType = detectFileType(fileName);

      // Skip binary files (except images)
      if (fileType.category === 'binary') {
        return {
          type: 'binary',
          name: fileName,
          fileSize,
          mimeType: fileType.mimeType,
        } as PreviewData;
      }

      // Get shared SFTP wrapper (reuses existing connection)
      const sftp = await getSFTPWrapper(serverId);
      if (!sftp) {
        return { type: 'error', message: 'Not connected to server' } as PreviewData;
      }

      try {

        // Check cache first
        const cached = await getCachedFile(serverId, filePath);
        if (cached) {
          const isStale = await isCacheStale(sftp, filePath, cached.mtime, cached.size);
          if (!isStale) {
            console.log(`[preview-handlers] Cache hit: ${filePath}`);
            // Process cached data
            if (fileType.category === 'image') {
              return extractImageMetadata(cached.data, cached.size, fileType.mimeType);
            } else {
              const { preview, shouldStream } = processCodeFile(cached.data, fileType.language || 'text');
              if (shouldStream) {
                // Start streaming in background, return preview with line count
                streamLargeCodeFile(mainWindow, sftp, filePath, cached.size, fileType.language || 'text')
                  .catch(err => console.error(`[preview-handlers] Streaming error:`, err));
              }
              return preview;
            }
          }
        }

        // Get file stats
        const stats = await new Promise<Stats>((resolve, reject) => {
          sftp.stat(filePath, (err, s) => (err ? reject(err) : resolve(s)));
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

        const buffer = Buffer.concat(chunks);

        // Cache the file (mtime in milliseconds)
        const mtime = stats.mtime * 1000;
        await cacheFile(serverId, filePath, buffer, mtime, stats.size);

        console.log(`[preview-handlers] Fetched and cached: ${filePath} (${stats.size} bytes)`);

        // Process based on file type
        if (fileType.category === 'image') {
          return extractImageMetadata(buffer, stats.size, fileType.mimeType);
        } else {
          const { preview, shouldStream } = processCodeFile(buffer, fileType.language || 'text');
          if (shouldStream) {
            // Start streaming in background, return preview with line count
            console.log(`[preview-handlers] Large file detected (${preview.lineCount} lines), streaming: ${filePath}`);
            streamLargeCodeFile(mainWindow, sftp, filePath, stats.size, fileType.language || 'text')
              .catch(err => console.error(`[preview-handlers] Streaming error:`, err));
          }
          return preview;
        }
      } catch (err) {
        console.error(`[preview-handlers] Error reading ${filePath}:`, err);
        return {
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to read file',
        } as PreviewData;
      }
    }
  );

  // Get folder info
  ipcMain.handle(
    'preview:folder-info',
    async (_event, serverId: string, folderPath: string, folderName: string) => {
      // Get shared SFTP wrapper (reuses existing connection)
      const sftp = await getSFTPWrapper(serverId);
      if (!sftp) {
        return { type: 'error', message: 'Not connected to server' } as PreviewData;
      }

      try {

        // List directory to count items and calculate size
        const entries = await new Promise<Array<{ attrs: { size?: number } }>>((resolve, reject) => {
          sftp.readdir(folderPath, (err, list) => (err ? reject(err) : resolve(list)));
        });

        const itemCount = entries.length;
        const totalSize = entries.reduce((sum, e) => sum + (e.attrs.size || 0), 0);

        return {
          type: 'folder',
          name: folderName,
          itemCount,
          totalSize,
        } as PreviewData;
      } catch (err) {
        return {
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to read folder',
        } as PreviewData;
      }
    }
  );
}
