// Folder upload service for recursive SFTP uploads
// Provides folder enumeration, progress tracking, and cancellation

import { readdir, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { getSFTPWrapper, mkdirRecursive } from './sftp-service';
import type { FolderUploadProgress, FolderUploadResult, LocalFileEntry } from './types';

// Track active folder uploads by operation ID
const activeFolderUploads = new Map<string, AbortController>();

/**
 * Generate a unique operation ID for folder uploads.
 */
export function generateFolderUploadId(): string {
  return `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cancel an active folder upload by ID.
 */
export function cancelFolderUpload(operationId: string): boolean {
  const controller = activeFolderUploads.get(operationId);
  if (controller) {
    controller.abort();
    activeFolderUploads.delete(operationId);
    console.log(`[folder-upload] Cancelled operation: ${operationId}`);
    return true;
  }
  return false;
}

/**
 * Enumerate all files and directories in a local folder.
 * Filters .DS_Store and ._ files based on showHidden flag.
 *
 * @param sourcePath - Absolute path to local folder
 * @param showHidden - Whether to include hidden/metadata files
 * @returns Array of file entries with relative paths
 */
export async function enumerateLocalFolder(
  sourcePath: string,
  showHidden: boolean
): Promise<LocalFileEntry[]> {
  const entries: LocalFileEntry[] = [];

  // Use recursive readdir (Node 18.17.0+)
  const files = await readdir(sourcePath, { recursive: true, withFileTypes: true });

  for (const file of files) {
    // Construct full path - file.parentPath is the directory containing this entry
    const parentPath = (file as any).parentPath || (file as any).path || sourcePath;
    const fullPath = path.join(parentPath, file.name);
    const relativePath = path.relative(sourcePath, fullPath);

    // Filter hidden/metadata files if needed
    if (!showHidden) {
      const segments = relativePath.split(path.sep);
      const hasHidden = segments.some(seg =>
        seg.startsWith('.') || seg === '.DS_Store' || seg.startsWith('._')
      );
      if (hasHidden) continue;
    }

    const fileStat = file.isDirectory() ? null : await stat(fullPath);

    entries.push({
      localPath: fullPath,
      relativePath,
      isDirectory: file.isDirectory(),
      size: fileStat ? fileStat.size : 0,
    });
  }

  return entries;
}

/**
 * Upload a local folder to remote server recursively.
 *
 * @param serverId - The server ID
 * @param localPath - Absolute path to local folder
 * @param remoteDir - Remote directory to upload into
 * @param showHidden - Whether to include hidden files
 * @param operationId - Optional operation ID for cancellation
 * @param onProgress - Progress callback
 * @returns Upload result with success/failure details
 */
export async function uploadFolder(
  serverId: string,
  localPath: string,
  remoteDir: string,
  showHidden: boolean,
  operationId: string | undefined,
  onProgress: (progress: FolderUploadProgress) => void
): Promise<FolderUploadResult> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  const opId = operationId || generateFolderUploadId();
  const controller = new AbortController();
  activeFolderUploads.set(opId, controller);

  const failedFiles: Array<{ path: string; error: string }> = [];
  let completedFiles = 0;

  try {
    // 1. Enumerate local folder
    const entries = await enumerateLocalFolder(localPath, showHidden);

    // Separate directories and files
    const directories = entries.filter(e => e.isDirectory);
    const files = entries.filter(e => !e.isDirectory);
    const totalFiles = files.length;

    // Get folder name for remote path
    const folderName = path.basename(localPath);
    const remoteBasePath = path.posix.join(remoteDir, folderName);

    // 2. Create all directories first (sorted by depth to ensure parents first)
    directories.sort((a, b) =>
      a.relativePath.split(path.sep).length - b.relativePath.split(path.sep).length
    );

    // Create root directory
    await mkdirRecursive(serverId, remoteBasePath);

    // Create subdirectories
    for (const dir of directories) {
      if (controller.signal.aborted) {
        return {
          success: false,
          uploadedCount: completedFiles,
          failedFiles,
          cancelled: true,
        };
      }

      const remoteDirPath = path.posix.join(remoteBasePath, dir.relativePath.split(path.sep).join('/'));
      await mkdirRecursive(serverId, remoteDirPath);
    }

    // 3. Upload files sequentially
    for (const file of files) {
      if (controller.signal.aborted) {
        return {
          success: false,
          uploadedCount: completedFiles,
          failedFiles,
          cancelled: true,
        };
      }

      const remoteFilePath = path.posix.join(
        remoteBasePath,
        file.relativePath.split(path.sep).join('/')
      );

      // Report progress before starting this file
      onProgress({
        totalFiles,
        completedFiles,
        currentFile: file.relativePath,
        percent: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
        failedFiles,
      });

      try {
        await uploadSingleFile(sftp, file.localPath, remoteFilePath, controller.signal);
        completedFiles++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        if (errorMsg === 'Operation cancelled') {
          return {
            success: false,
            uploadedCount: completedFiles,
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
      failedFiles,
    });

    return {
      success: failedFiles.length === 0,
      uploadedCount: completedFiles - failedFiles.length,
      failedFiles,
    };

  } finally {
    activeFolderUploads.delete(opId);
  }
}

/**
 * Upload a single file to remote server.
 * Internal helper - uses streams for efficient transfer.
 */
async function uploadSingleFile(
  sftp: Awaited<ReturnType<typeof getSFTPWrapper>>,
  localPath: string,
  remotePath: string,
  signal: AbortSignal
): Promise<void> {
  if (!sftp) throw new Error('Not connected');

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);

    const onAbort = () => {
      readStream.destroy();
      writeStream.destroy();
      // Try to clean up partial upload
      sftp.unlink(remotePath, () => {});
      reject(new Error('Operation cancelled'));
    };

    signal.addEventListener('abort', onAbort);

    readStream.on('error', (err: Error) => {
      signal.removeEventListener('abort', onAbort);
      reject(err);
    });

    writeStream.on('error', (err: Error) => {
      signal.removeEventListener('abort', onAbort);
      reject(err);
    });

    // Note: ssh2 SFTP WriteStream emits 'close' but not always 'finish'
    // We resolve on 'close' to ensure upload completed
    writeStream.on('close', () => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    });

    readStream.pipe(writeStream);
  });
}
