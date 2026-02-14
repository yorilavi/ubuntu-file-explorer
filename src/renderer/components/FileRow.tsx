import React from 'react';
import type { FileEntry } from '../../shared/types';

interface FileRowProps {
  file: FileEntry;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

/**
 * Format file size to human-readable string.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format date to localized string.
 */
function formatDate(date: Date): string {
  // Handle serialized dates from IPC (come as strings)
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Convert octal mode string to permission string (e.g., '0755' -> 'rwxr-xr-x').
 */
function formatPermissions(mode: string): string {
  const modeNum = parseInt(mode, 8);
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  return (
    perms[(modeNum >> 6) & 7] + perms[(modeNum >> 3) & 7] + perms[modeNum & 7]
  );
}

/**
 * Single file/folder row with metadata columns.
 * Displays icon, name, size, modified date, permissions, and owner.
 * Symlinks show arrow indicator and target path.
 */
function FileRow({
  file,
  isSelected,
  onClick,
  onDoubleClick,
}: FileRowProps): React.JSX.Element {
  const rowClasses = [
    'file-row',
    isSelected && 'file-row--selected',
    file.isDirectory && 'file-row--directory',
    file.isSymlink && 'file-row--symlink',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClasses}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Icon column */}
      <div className="file-row__icon">
        {file.isDirectory ? (
          <span className="file-icon file-icon--folder">
            {file.isSymlink && <span className="symlink-badge" data-tooltip="Symlink" />}
          </span>
        ) : (
          <span className="file-icon file-icon--file">
            {file.isSymlink && <span className="symlink-badge" data-tooltip="Symlink" />}
          </span>
        )}
      </div>

      {/* Name column */}
      <div className="file-row__name">
        <span className="file-name">{file.name}</span>
        {file.isSymlink && file.target && (
          <span className="file-symlink-target"> -&gt; {file.target}</span>
        )}
      </div>

      {/* Size column */}
      <div className="file-row__size">
        {file.isDirectory ? '--' : formatSize(file.size)}
      </div>

      {/* Modified column */}
      <div className="file-row__modified">{formatDate(file.modified)}</div>

      {/* Permissions column */}
      <div className="file-row__permissions">{formatPermissions(file.permissions)}</div>

      {/* Owner column */}
      <div className="file-row__owner">
        {file.uid}:{file.gid}
      </div>
    </div>
  );
}

export default FileRow;
