// File operations service for SFTP transfers and management
// Provides download, upload, delete, rename, move operations
// Supports AbortController for cancellation

import { createReadStream, createWriteStream, statSync, unlinkSync } from 'fs';
import path from 'path';
import type { Stats } from 'ssh2';
import { getSFTPWrapper } from './sftp-service';

// Track active operations by unique ID for cancellation
const activeOperations = new Map<string, AbortController>();

/**
 * Generate a unique operation ID for tracking.
 */
export function generateOperationId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cancel an active operation by ID.
 *
 * @param operationId - The operation ID to cancel
 * @returns true if operation was found and cancelled, false otherwise
 */
export function cancelOperation(operationId: string): boolean {
  const controller = activeOperations.get(operationId);
  if (controller) {
    controller.abort();
    activeOperations.delete(operationId);
    console.log(`[file-operations] Cancelled operation: ${operationId}`);
    return true;
  }
  return false;
}

/**
 * Download a file from remote server to local path.
 * Supports cancellation via operationId.
 *
 * @param serverId - The server ID
 * @param remotePath - Full path to remote file
 * @param localPath - Full path to local destination
 * @param operationId - Optional operation ID for cancellation tracking
 * @param onProgress - Progress callback (0-100)
 * @returns Operation ID for cancellation
 */
export async function downloadFile(
  serverId: string,
  remotePath: string,
  localPath: string,
  operationId: string | undefined,
  onProgress: (percent: number) => void
): Promise<{ operationId: string }> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  const opId = operationId || generateOperationId();
  const controller = new AbortController();
  activeOperations.set(opId, controller);

  // Get remote file stats for progress calculation
  const stats = await new Promise<Stats>((resolve, reject) => {
    sftp.stat(remotePath, (err, s) => (err ? reject(err) : resolve(s)));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const readStream = sftp.createReadStream(remotePath);
      const writeStream = createWriteStream(localPath);

      let bytesTransferred = 0;

      // Handle abort signal
      const onAbort = () => {
        readStream.destroy();
        writeStream.destroy();
        // Clean up partial file
        try {
          unlinkSync(localPath);
        } catch {
          // Ignore cleanup errors
        }
        reject(new Error('Operation cancelled'));
      };

      controller.signal.addEventListener('abort', onAbort);

      readStream.on('data', (chunk: Buffer) => {
        if (controller.signal.aborted) {
          return;
        }
        bytesTransferred += chunk.length;
        const percent = Math.round((bytesTransferred / stats.size) * 100);
        onProgress(percent);
      });

      readStream.on('error', (err: Error) => {
        controller.signal.removeEventListener('abort', onAbort);
        reject(err);
      });
      writeStream.on('error', (err: Error) => {
        controller.signal.removeEventListener('abort', onAbort);
        reject(err);
      });
      writeStream.on('finish', () => {
        controller.signal.removeEventListener('abort', onAbort);
        console.log(`[file-operations] Downloaded: ${remotePath} -> ${localPath}`);
        resolve();
      });

      readStream.pipe(writeStream);
    });

    return { operationId: opId };
  } finally {
    activeOperations.delete(opId);
  }
}

/**
 * Upload a file from local path to remote directory.
 * Supports cancellation via operationId.
 *
 * @param serverId - The server ID
 * @param localPath - Full path to local file
 * @param remoteDir - Remote directory to upload into
 * @param operationId - Optional operation ID for cancellation tracking
 * @param onProgress - Progress callback (0-100)
 * @returns Full remote path of uploaded file and operation ID
 */
export async function uploadFile(
  serverId: string,
  localPath: string,
  remoteDir: string,
  operationId: string | undefined,
  onProgress: (percent: number) => void
): Promise<{ remotePath: string; operationId: string }> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  const opId = operationId || generateOperationId();
  const controller = new AbortController();
  activeOperations.set(opId, controller);

  // Get local file size for progress calculation
  const fileStats = statSync(localPath);
  const fileName = path.basename(localPath);
  // Use POSIX paths for remote (always forward slashes)
  const remotePath = path.posix.join(remoteDir, fileName);

  try {
    await new Promise<void>((resolve, reject) => {
      const readStream = createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);

      let bytesTransferred = 0;

      // Handle abort signal
      const onAbort = () => {
        readStream.destroy();
        writeStream.destroy();
        // Try to clean up partial upload
        sftp.unlink(remotePath, () => {
          // Ignore cleanup errors
        });
        reject(new Error('Operation cancelled'));
      };

      controller.signal.addEventListener('abort', onAbort);

      readStream.on('data', (chunk: Buffer) => {
        if (controller.signal.aborted) {
          return;
        }
        bytesTransferred += chunk.length;
        const percent = Math.round((bytesTransferred / fileStats.size) * 100);
        onProgress(percent);
      });

      readStream.on('error', (err: Error) => {
        controller.signal.removeEventListener('abort', onAbort);
        reject(err);
      });
      writeStream.on('error', (err: Error) => {
        controller.signal.removeEventListener('abort', onAbort);
        reject(err);
      });
      writeStream.on('finish', () => {
        controller.signal.removeEventListener('abort', onAbort);
        console.log(`[file-operations] Uploaded: ${localPath} -> ${remotePath}`);
        resolve();
      });

      readStream.pipe(writeStream);
    });

    return { remotePath, operationId: opId };
  } finally {
    activeOperations.delete(opId);
  }
}

/**
 * Delete a file on the remote server.
 *
 * @param serverId - The server ID
 * @param remotePath - Full path to remote file
 */
export async function deleteRemoteFile(
  serverId: string,
  remotePath: string
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`[file-operations] Deleted file: ${remotePath}`);
        resolve();
      }
    });
  });
}

/**
 * Delete an empty folder on the remote server.
 * Note: Only works on empty directories (MVP limitation).
 *
 * @param serverId - The server ID
 * @param remotePath - Full path to remote folder
 */
export async function deleteRemoteFolder(
  serverId: string,
  remotePath: string
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`[file-operations] Deleted folder: ${remotePath}`);
        resolve();
      }
    });
  });
}

/**
 * Rename a file on the remote server.
 *
 * @param serverId - The server ID
 * @param oldPath - Current full path to file
 * @param newName - New filename (not full path)
 * @returns New full path after rename
 */
export async function renameRemoteFile(
  serverId: string,
  oldPath: string,
  newName: string
): Promise<string> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  // Calculate new path by replacing filename
  const dir = path.posix.dirname(oldPath);
  const newPath = path.posix.join(dir, newName);

  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`[file-operations] Renamed: ${oldPath} -> ${newPath}`);
        resolve(newPath);
      }
    });
  });
}

/**
 * Move a file to a different directory on the remote server.
 *
 * @param serverId - The server ID
 * @param sourcePath - Current full path to file
 * @param destDir - Destination directory
 * @returns New full path after move
 */
export async function moveRemoteFile(
  serverId: string,
  sourcePath: string,
  destDir: string
): Promise<string> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  // Extract filename and construct destination path
  const fileName = path.posix.basename(sourcePath);
  const destPath = path.posix.join(destDir, fileName);

  return new Promise((resolve, reject) => {
    // SFTP rename works for moving files
    sftp.rename(sourcePath, destPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`[file-operations] Moved: ${sourcePath} -> ${destPath}`);
        resolve(destPath);
      }
    });
  });
}
