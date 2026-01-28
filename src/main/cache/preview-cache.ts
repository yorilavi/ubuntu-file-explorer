// Disk cache for preview files
// Uses userData directory with LRU eviction

import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { SFTPWrapper } from 'ssh2';

const CACHE_DIR = path.join(app.getPath('userData'), 'preview-cache');
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

interface CacheMetadata {
  remotePath: string;
  serverId: string;
  mtime: number;
  size: number;
  cachedAt: number;
  accessedAt: number;
}

/**
 * Generate cache key from server ID and file path.
 */
function getCacheKey(serverId: string, remotePath: string): string {
  return crypto.createHash('md5').update(`${serverId}:${remotePath}`).digest('hex');
}

/**
 * Ensure cache directory exists.
 */
async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

/**
 * Get cached file if it exists.
 * Returns null if not cached.
 */
export async function getCachedFile(
  serverId: string,
  remotePath: string
): Promise<{ data: Buffer; mtime: number; size: number } | null> {
  const key = getCacheKey(serverId, remotePath);
  const metaPath = path.join(CACHE_DIR, `${key}.meta.json`);
  const dataPath = path.join(CACHE_DIR, `${key}.data`);

  try {
    const metaRaw = await fs.readFile(metaPath, 'utf-8');
    const meta: CacheMetadata = JSON.parse(metaRaw);
    const data = await fs.readFile(dataPath);

    // Update access time for LRU
    meta.accessedAt = Date.now();
    await fs.writeFile(metaPath, JSON.stringify(meta));

    return { data, mtime: meta.mtime, size: meta.size };
  } catch {
    return null;
  }
}

/**
 * Check if cached file is stale (remote file changed).
 * Uses SFTP stat which is fast (no file transfer).
 */
export async function isCacheStale(
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
      // ssh2 returns mtime in seconds, we store in milliseconds
      const remoteMtime = stats.mtime * 1000;
      resolve(stats.size !== cachedSize || remoteMtime !== cachedMtime);
    });
  });
}

/**
 * Cache a file.
 */
export async function cacheFile(
  serverId: string,
  remotePath: string,
  data: Buffer,
  mtime: number,
  size: number
): Promise<void> {
  await ensureCacheDir();

  const key = getCacheKey(serverId, remotePath);
  const meta: CacheMetadata = {
    remotePath,
    serverId,
    mtime,
    size,
    cachedAt: Date.now(),
    accessedAt: Date.now(),
  };

  await fs.writeFile(path.join(CACHE_DIR, `${key}.data`), data);
  await fs.writeFile(path.join(CACHE_DIR, `${key}.meta.json`), JSON.stringify(meta));

  // Async eviction - don't await
  evictOldCacheEntries().catch(console.error);
}

/**
 * Evict oldest entries when cache exceeds max size.
 * LRU based on accessedAt timestamp.
 */
async function evictOldCacheEntries(): Promise<void> {
  try {
    const files = await fs.readdir(CACHE_DIR);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

    // Collect all entries with metadata
    const entries: Array<{ key: string; meta: CacheMetadata; dataSize: number }> = [];
    for (const metaFile of metaFiles) {
      try {
        const key = metaFile.replace('.meta.json', '');
        const metaPath = path.join(CACHE_DIR, metaFile);
        const dataPath = path.join(CACHE_DIR, `${key}.data`);

        const metaRaw = await fs.readFile(metaPath, 'utf-8');
        const meta: CacheMetadata = JSON.parse(metaRaw);
        const dataStat = await fs.stat(dataPath);

        entries.push({ key, meta, dataSize: dataStat.size });
      } catch {
        // Skip corrupted entries
      }
    }

    // Calculate total size
    let totalSize = entries.reduce((sum, e) => sum + e.dataSize, 0);

    if (totalSize <= MAX_CACHE_SIZE) {
      return;
    }

    // Sort by accessedAt (oldest first)
    entries.sort((a, b) => a.meta.accessedAt - b.meta.accessedAt);

    // Evict oldest entries until under limit
    for (const entry of entries) {
      if (totalSize <= MAX_CACHE_SIZE) break;

      try {
        await fs.unlink(path.join(CACHE_DIR, `${entry.key}.data`));
        await fs.unlink(path.join(CACHE_DIR, `${entry.key}.meta.json`));
        totalSize -= entry.dataSize;
        console.log(`[preview-cache] Evicted ${entry.meta.remotePath}`);
      } catch {
        // Ignore deletion errors
      }
    }
  } catch (err) {
    console.error('[preview-cache] Eviction error:', err);
  }
}

/**
 * Clear entire cache (for testing or user action).
 */
export async function clearCache(): Promise<void> {
  try {
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
    await ensureCacheDir();
  } catch {
    // Ignore errors
  }
}
