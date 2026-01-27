// SFTP service for directory operations
// Wraps ssh2 SFTP operations with promises

import type { Client, SFTPWrapper, FileEntry as SSH2FileEntry } from 'ssh2';
import type { FileEntry, DirectoryListing } from './types';
import { getConnection } from './ssh-service';

// Track SFTP wrappers to reuse them
const sftpWrappers = new Map<string, SFTPWrapper>();

/**
 * Get or create an SFTP wrapper for a connection.
 *
 * @param serverId - The server ID
 * @param client - The SSH client
 * @returns Promise resolving to SFTP wrapper
 */
async function getSFTP(serverId: string, client: Client): Promise<SFTPWrapper> {
  // Check for cached wrapper
  const cached = sftpWrappers.get(serverId);
  if (cached) {
    return cached;
  }

  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      // Cache the wrapper
      sftpWrappers.set(serverId, sftp);
      resolve(sftp);
    });
  });
}

/**
 * Clear the cached SFTP wrapper for a server.
 * Call this when the connection is closed.
 *
 * @param serverId - The server ID
 */
export function clearSFTPCache(serverId: string): void {
  sftpWrappers.delete(serverId);
}

/**
 * Read the target of a symbolic link.
 *
 * @param sftp - The SFTP wrapper
 * @param path - Path to the symlink
 * @returns Promise resolving to the target path
 */
function readSymlinkTarget(sftp: SFTPWrapper, linkPath: string): Promise<string> {
  return new Promise((resolve) => {
    sftp.readlink(linkPath, (err, target) => {
      if (err) {
        // If we can't read the symlink, return empty string
        resolve('');
        return;
      }
      resolve(target);
    });
  });
}

/**
 * List the contents of a directory on the remote server.
 *
 * @param serverId - The ID of the connected server
 * @param path - The directory path to list
 * @returns Promise resolving to DirectoryListing
 */
export async function listDirectory(serverId: string, path: string): Promise<DirectoryListing> {
  // Get the connection
  const client = getConnection(serverId);
  if (!client) {
    throw new Error(`Not connected to server: ${serverId}`);
  }

  // Get SFTP wrapper
  const sftp = await getSFTP(serverId, client);

  // Read directory
  const entries = await new Promise<SSH2FileEntry[]>((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(list);
    });
  });

  // Map SSH2 entries to our FileEntry type
  const fileEntries: FileEntry[] = await Promise.all(
    entries.map(async (entry): Promise<FileEntry> => {
      const fullPath = path === '/' ? `/${entry.filename}` : `${path}/${entry.filename}`;

      // Parse mode bits for type detection
      // Directory: 0o40000, Symlink: 0o120000
      const mode = entry.attrs.mode || 0;
      const isDirectory = (mode & 0o170000) === 0o040000;
      const isSymlink = (mode & 0o170000) === 0o120000;

      // Get symlink target if needed
      let target: string | undefined;
      if (isSymlink) {
        target = await readSymlinkTarget(sftp, fullPath);
      }

      // Extract permission bits (lower 9 bits)
      const permBits = mode & 0o777;
      const permissions = '0' + permBits.toString(8).padStart(3, '0');

      return {
        name: entry.filename,
        path: fullPath,
        size: entry.attrs.size || 0,
        modified: new Date((entry.attrs.mtime || 0) * 1000),
        isDirectory,
        isSymlink,
        permissions,
        uid: entry.attrs.uid || 0,
        gid: entry.attrs.gid || 0,
        target,
      };
    })
  );

  // Sort entries: directories first, then by name
  fileEntries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  console.log(`[sftp-service] Listed ${fileEntries.length} entries in ${path}`);

  return {
    path,
    entries: fileEntries,
  };
}
