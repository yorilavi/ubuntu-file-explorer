// IPC handlers for file preview operations
// Reads files from SFTP with caching and progress updates

import { ipcMain, BrowserWindow } from 'electron';
import type { Client, SFTPWrapper, Stats } from 'ssh2';
import { getConnection } from '../ssh/ssh-service';
import { getCachedFile, cacheFile, isCacheStale } from '../cache/preview-cache';
import type { PreviewData, FileTypeInfo } from '../../shared/types';
import exifr from 'exifr';

// File size limit per CONTEXT.md
const MAX_PREVIEW_SIZE = 50 * 1024 * 1024; // 50MB

// Max lines for code preview per CONTEXT.md
const MAX_CODE_LINES = 500;

// Track SFTP wrappers (reuse from sftp-service pattern)
const sftpWrappers = new Map<string, SFTPWrapper>();

/**
 * Get or create SFTP wrapper for a connection.
 */
async function getSFTP(serverId: string, client: Client): Promise<SFTPWrapper> {
  const cached = sftpWrappers.get(serverId);
  if (cached) return cached;

  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      sftpWrappers.set(serverId, sftp);
      resolve(sftp);
    });
  });
}

/**
 * Clear SFTP cache for a server.
 */
export function clearPreviewSFTPCache(serverId: string): void {
  sftpWrappers.delete(serverId);
}

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
 */
function processCodeFile(
  buffer: Buffer,
  language: string
): PreviewData & { type: 'code' } {
  const content = buffer.toString('utf-8');
  const lines = content.split('\n');
  const truncated = lines.length > MAX_CODE_LINES;
  const displayContent = truncated
    ? lines.slice(0, MAX_CODE_LINES).join('\n')
    : content;

  return {
    type: 'code',
    content: displayContent,
    language,
    lineCount: lines.length,
    truncated,
  };
}

/**
 * Register preview IPC handlers.
 */
export function registerPreviewHandlers(mainWindow: BrowserWindow): void {
  // Read file for preview
  ipcMain.handle(
    'preview:read-file',
    async (_event, serverId: string, filePath: string, fileName: string, fileSize: number) => {
      const client = getConnection(serverId);
      if (!client) {
        return { type: 'error', message: 'Not connected to server' } as PreviewData;
      }

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

      try {
        const sftp = await getSFTP(serverId, client);

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
              return processCodeFile(cached.data, fileType.language || 'text');
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
          return processCodeFile(buffer, fileType.language || 'text');
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
      const client = getConnection(serverId);
      if (!client) {
        return { type: 'error', message: 'Not connected to server' } as PreviewData;
      }

      try {
        const sftp = await getSFTP(serverId, client);

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
