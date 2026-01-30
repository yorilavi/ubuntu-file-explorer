// Folder download service for recursive SFTP downloads
// Provides remote folder enumeration, progress tracking, and cancellation

import { mkdir, unlink, rm } from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';
import { getSFTPWrapper, listDirectory } from './sftp-service';
import type {
  FolderDownloadProgress,
  FolderDownloadResult,
  RemoteFileEntry,
  ConflictStrategy,
} from './types';

// Track active folder downloads by operation ID
const activeFolderDownloads = new Map<string, AbortController>();

/**
 * Generate a unique operation ID for folder downloads.
 */
export function generateFolderDownloadId(): string {
  return `folder-dl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cancel an active folder download by ID.
 */
export function cancelFolderDownload(operationId: string): boolean {
  const controller = activeFolderDownloads.get(operationId);
  if (controller) {
    controller.abort();
    activeFolderDownloads.delete(operationId);
    console.log(`[folder-download] Cancelled operation: ${operationId}`);
    return true;
  }
  return false;
}

/**
 * Enumerate all files and directories in a remote folder recursively.
 *
 * @param serverId - The server ID
 * @param remotePath - Absolute path to remote folder
 * @returns Array of file entries with relative paths and total size
 */
export async function enumerateRemoteFolder(
  serverId: string,
  remotePath: string
): Promise<{ entries: RemoteFileEntry[]; totalSize: number }> {
  const entries: RemoteFileEntry[] = [];
  let totalSize = 0;

  async function traverse(currentPath: string, basePath: string): Promise<void> {
    const listing = await listDirectory(serverId, currentPath);

    for (const entry of listing.entries) {
      const relativePath = path.posix.relative(basePath, entry.path);

      entries.push({
        remotePath: entry.path,
        relativePath,
        isDirectory: entry.isDirectory,
        size: entry.size,
      });

      if (entry.isDirectory) {
        // Recursively enumerate subdirectories
        await traverse(entry.path, basePath);
      } else {
        totalSize += entry.size;
      }
    }
  }

  await traverse(remotePath, remotePath);
  return { entries, totalSize };
}

/**
 * Generate a conflict-safe filename using Finder-style naming.
 * Example: "document.pdf" becomes "document (1).pdf"
 *
 * @param localPath - The original local file path
 * @returns A path that doesn't conflict with existing files
 */
export async function getConflictSafePath(localPath: string): Promise<string> {
  if (!existsSync(localPath)) {
    return localPath;
  }

  const dir = path.dirname(localPath);
  const ext = path.extname(localPath);
  const baseName = path.basename(localPath, ext);

  let counter = 1;
  let newPath = localPath;

  while (existsSync(newPath)) {
    newPath = path.join(dir, `${baseName} (${counter})${ext}`);
    counter++;
  }

  return newPath;
}

/**
 * Clean up a downloaded folder on cancellation.
 * Removes the entire folder structure that was created during download.
 *
 * @param localBasePath - The local folder path to remove
 */
async function cleanupDownloadedFolder(localBasePath: string): Promise<void> {
  try {
    if (existsSync(localBasePath)) {
      console.log(`[folder-download] Cleaning up cancelled download: ${localBasePath}`);
      await rm(localBasePath, { recursive: true, force: true });
      console.log(`[folder-download] Cleanup complete: ${localBasePath}`);
    }
  } catch (err) {
    // Log but don't throw - cleanup is best effort
    console.error(`[folder-download] Cleanup failed for ${localBasePath}:`, err);
  }
}

/**
 * Download a remote folder to local filesystem recursively.
 *
 * @param serverId - The server ID
 * @param remotePath - Absolute path to remote folder
 * @param localDir - Local directory to download into
 * @param conflictStrategy - How to handle existing files
 * @param operationId - Optional operation ID for cancellation
 * @param onProgress - Progress callback
 * @returns Download result with success/failure details
 */
export async function downloadFolder(
  serverId: string,
  remotePath: string,
  localDir: string,
  conflictStrategy: ConflictStrategy,
  operationId: string | undefined,
  onProgress: (progress: FolderDownloadProgress) => void
): Promise<FolderDownloadResult> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  const opId = operationId || generateFolderDownloadId();
  const controller = new AbortController();
  activeFolderDownloads.set(opId, controller);

  const failedFiles: Array<{ path: string; error: string }> = [];
  let completedFiles = 0;
  let downloadedBytes = 0;

  try {
    // 1. Enumerate remote folder
    console.log(`[folder-download] Enumerating: ${remotePath}`);
    const { entries, totalSize } = await enumerateRemoteFolder(serverId, remotePath);

    // Separate directories and files
    const directories = entries.filter(e => e.isDirectory);
    const files = entries.filter(e => !e.isDirectory);
    const totalFiles = files.length;

    // Get folder name for local path
    const folderName = path.posix.basename(remotePath);
    const localBasePath = path.join(localDir, folderName);

    console.log(`[folder-download] Found ${totalFiles} files, ${directories.length} directories`);

    // 2. Create all local directories first (sorted by depth to ensure parents first)
    directories.sort((a, b) =>
      a.relativePath.split('/').length - b.relativePath.split('/').length
    );

    // Create root directory
    await mkdir(localBasePath, { recursive: true });

    // Create subdirectories
    for (const dir of directories) {
      if (controller.signal.aborted) {
        // Clean up the entire downloaded folder on cancellation
        await cleanupDownloadedFolder(localBasePath);
        return {
          success: false,
          downloadedCount: completedFiles,
          failedFiles,
          cancelled: true,
        };
      }

      const localDirPath = path.join(localBasePath, dir.relativePath);
      await mkdir(localDirPath, { recursive: true });
    }

    // 3. Download files sequentially
    for (const file of files) {
      if (controller.signal.aborted) {
        // Clean up the entire downloaded folder on cancellation
        await cleanupDownloadedFolder(localBasePath);
        return {
          success: false,
          downloadedCount: completedFiles,
          failedFiles,
          cancelled: true,
        };
      }

      // Calculate local path
      let localFilePath = path.join(localBasePath, file.relativePath);

      // Handle conflicts
      if (existsSync(localFilePath)) {
        switch (conflictStrategy) {
          case 'skip':
            completedFiles++;
            continue;
          case 'rename':
            localFilePath = await getConflictSafePath(localFilePath);
            break;
          case 'overwrite':
            // Do nothing, will overwrite
            break;
        }
      }

      // Report progress before starting this file
      onProgress({
        totalFiles,
        completedFiles,
        currentFile: file.relativePath,
        percent: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
        totalBytes: totalSize,
        downloadedBytes,
        failedFiles,
      });

      try {
        await downloadSingleFile(sftp, file.remotePath, localFilePath, file.size, controller.signal, (bytes) => {
          // Update byte progress (intermediate updates)
          onProgress({
            totalFiles,
            completedFiles,
            currentFile: file.relativePath,
            percent: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
            totalBytes: totalSize,
            downloadedBytes: downloadedBytes + bytes,
            failedFiles,
          });
        });
        downloadedBytes += file.size;
        completedFiles++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        if (errorMsg === 'Operation cancelled') {
          // Clean up the entire downloaded folder on cancellation
          await cleanupDownloadedFolder(localBasePath);
          return {
            success: false,
            downloadedCount: completedFiles,
            failedFiles,
            cancelled: true,
          };
        }
        failedFiles.push({ path: file.relativePath, error: errorMsg });
        completedFiles++; // Count as completed (failed)
      }
    }

    // Final progress update
    onProgress({
      totalFiles,
      completedFiles,
      currentFile: '',
      percent: 100,
      totalBytes: totalSize,
      downloadedBytes,
      failedFiles,
    });

    return {
      success: failedFiles.length === 0,
      downloadedCount: completedFiles - failedFiles.length,
      failedFiles,
    };

  } finally {
    activeFolderDownloads.delete(opId);
  }
}

/**
 * Download a single file from remote server.
 * Internal helper - uses streams for efficient transfer.
 */
async function downloadSingleFile(
  sftp: Awaited<ReturnType<typeof getSFTPWrapper>>,
  remotePath: string,
  localPath: string,
  _fileSize: number,
  signal: AbortSignal,
  onByteProgress?: (downloadedBytes: number) => void
): Promise<void> {
  if (!sftp) throw new Error('Not connected');

  // Ensure parent directory exists
  await mkdir(path.dirname(localPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const readStream = sftp.createReadStream(remotePath);
    const writeStream = createWriteStream(localPath);
    let bytesDownloaded = 0;

    const onAbort = async () => {
      readStream.destroy();
      writeStream.destroy();
      // Try to clean up partial download
      try {
        await unlink(localPath);
      } catch {
        // Ignore cleanup errors
      }
      reject(new Error('Operation cancelled'));
    };

    signal.addEventListener('abort', onAbort);

    readStream.on('data', (chunk: Buffer) => {
      if (signal.aborted) return;
      bytesDownloaded += chunk.length;
      if (onByteProgress) {
        onByteProgress(bytesDownloaded);
      }
    });

    readStream.on('error', (err: Error) => {
      signal.removeEventListener('abort', onAbort);
      writeStream.destroy();
      // Clean up partial file
      unlink(localPath).catch(() => {});
      reject(err);
    });

    writeStream.on('error', (err: Error) => {
      signal.removeEventListener('abort', onAbort);
      readStream.destroy();
      // Clean up partial file
      unlink(localPath).catch(() => {});
      reject(err);
    });

    writeStream.on('finish', () => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    });

    readStream.pipe(writeStream);
  });
}

/**
 * Retry downloading specific failed files.
 *
 * @param serverId - The server ID
 * @param remoteFolderPath - Original remote folder path
 * @param localBasePath - Local base path where folder was downloaded
 * @param failedFiles - Array of relative paths that failed
 * @param conflictStrategy - How to handle existing files
 * @param onProgress - Progress callback
 * @returns Result with retry success/failure
 */
export async function retryFailedDownloads(
  serverId: string,
  remoteFolderPath: string,
  localBasePath: string,
  failedFiles: string[],
  conflictStrategy: ConflictStrategy,
  onProgress: (progress: FolderDownloadProgress) => void
): Promise<FolderDownloadResult> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  const opId = generateFolderDownloadId();
  const controller = new AbortController();
  activeFolderDownloads.set(opId, controller);

  const stillFailed: Array<{ path: string; error: string }> = [];
  let completedFiles = 0;
  const totalFiles = failedFiles.length;

  try {
    for (const relativePath of failedFiles) {
      if (controller.signal.aborted) {
        return {
          success: false,
          downloadedCount: completedFiles,
          failedFiles: stillFailed,
          cancelled: true,
        };
      }

      const remotePath = path.posix.join(remoteFolderPath, relativePath);
      let localPath = path.join(localBasePath, relativePath);

      // Handle conflicts
      if (existsSync(localPath)) {
        switch (conflictStrategy) {
          case 'skip':
            completedFiles++;
            continue;
          case 'rename':
            localPath = await getConflictSafePath(localPath);
            break;
          case 'overwrite':
            break;
        }
      }

      onProgress({
        totalFiles,
        completedFiles,
        currentFile: relativePath,
        percent: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
        totalBytes: 0, // Not tracked for retry
        downloadedBytes: 0,
        failedFiles: stillFailed,
      });

      try {
        // Get file size from remote
        const stats = await new Promise<{ size: number }>((resolve, reject) => {
          sftp.stat(remotePath, (err, stats) => {
            if (err) reject(err);
            else resolve({ size: stats.size });
          });
        });

        await downloadSingleFile(sftp, remotePath, localPath, stats.size, controller.signal);
        completedFiles++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        if (errorMsg === 'Operation cancelled') {
          return {
            success: false,
            downloadedCount: completedFiles,
            failedFiles: stillFailed,
            cancelled: true,
          };
        }
        stillFailed.push({ path: relativePath, error: errorMsg });
        completedFiles++;
      }
    }

    return {
      success: stillFailed.length === 0,
      downloadedCount: completedFiles - stillFailed.length,
      failedFiles: stillFailed,
    };

  } finally {
    activeFolderDownloads.delete(opId);
  }
}
