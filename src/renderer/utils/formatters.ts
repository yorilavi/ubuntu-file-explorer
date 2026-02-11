/**
 * Shared formatting utilities for file metadata display.
 *
 * These pure functions consolidate duplicate formatting logic that was
 * previously scattered across FileRow, PreviewPanel, ImagePreview,
 * PDFPreview, and useFileContextMenu.
 */

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/**
 * Format a byte count to a human-readable size string.
 *
 * Uses threshold-based if/else (not Math.log) for clarity and
 * to avoid floating-point edge cases.
 *
 * @example
 * formatSize(0)       // "0 B"
 * formatSize(512)     // "512 B"
 * formatSize(4300)    // "4.2 KB"
 * formatSize(1363149) // "1.3 MB"
 * formatSize(2254857830) // "2.1 GB"
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(1)} GB`;
}

/**
 * Format a date to a localized human-readable string.
 *
 * Accepts both Date objects and ISO strings (IPC serializes Date to string).
 * Returns empty string for falsy/invalid inputs.
 *
 * @example
 * formatDate(new Date('2026-01-15T15:42:00')) // "Jan 15, 2026, 3:42 PM"
 * formatDate('2026-01-15T15:42:00Z')          // "Jan 15, 2026, ..."
 * formatDate(undefined)                        // ""
 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Convert an octal mode string to a Unix-style rwx permission string.
 *
 * @example
 * formatPermissions('0755') // "rwxr-xr-x"
 * formatPermissions('0644') // "rw-r--r--"
 */
export function formatPermissions(mode: string): string {
  const modeNum = parseInt(mode, 8);
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  return (
    perms[(modeNum >> 6) & 7] + perms[(modeNum >> 3) & 7] + perms[modeNum & 7]
  );
}
