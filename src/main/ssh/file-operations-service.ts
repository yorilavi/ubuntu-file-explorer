// File operations service for SFTP transfers and management
// Provides download, upload, delete, rename, move operations

import { createReadStream, createWriteStream, statSync } from 'fs';
import path from 'path';
import type { Stats } from 'ssh2';
import { getSFTPWrapper } from './sftp-service';

/**
 * Download a file from remote server to local path.
 *
 * @param serverId - The server ID
 * @param remotePath - Full path to remote file
 * @param localPath - Full path to local destination
 * @param onProgress - Progress callback (0-100)
 */
export async function downloadFile(
  serverId: string,
  remotePath: string,
  localPath: string,
  onProgress: (percent: number) => void
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  // Get remote file stats for progress calculation
  const stats = await new Promise<Stats>((resolve, reject) => {
    sftp.stat(remotePath, (err, s) => (err ? reject(err) : resolve(s)));
  });

  return new Promise((resolve, reject) => {
    const readStream = sftp.createReadStream(remotePath);
    const writeStream = createWriteStream(localPath);

    let bytesTransferred = 0;

    readStream.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
      const percent = Math.round((bytesTransferred / stats.size) * 100);
      onProgress(percent);
    });

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => {
      console.log(`[file-operations] Downloaded: ${remotePath} -> ${localPath}`);
      resolve();
    });

    readStream.pipe(writeStream);
  });
}

/**
 * Upload a file from local path to remote directory.
 *
 * @param serverId - The server ID
 * @param localPath - Full path to local file
 * @param remoteDir - Remote directory to upload into
 * @param onProgress - Progress callback (0-100)
 * @returns Full remote path of uploaded file
 */
export async function uploadFile(
  serverId: string,
  localPath: string,
  remoteDir: string,
  onProgress: (percent: number) => void
): Promise<string> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  // Get local file size for progress calculation
  const fileStats = statSync(localPath);
  const fileName = path.basename(localPath);
  // Use POSIX paths for remote (always forward slashes)
  const remotePath = path.posix.join(remoteDir, fileName);

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);

    let bytesTransferred = 0;

    readStream.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
      const percent = Math.round((bytesTransferred / fileStats.size) * 100);
      onProgress(percent);
    });

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => {
      console.log(`[file-operations] Uploaded: ${localPath} -> ${remotePath}`);
      resolve(remotePath);
    });

    readStream.pipe(writeStream);
  });
}
