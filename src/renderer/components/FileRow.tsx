import React from 'react';
import type { FileEntry } from '../../shared/types';
import { formatSize, formatDate, formatPermissions } from '../utils/formatters';

interface FileRowProps {
  file: FileEntry;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
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
            {file.isSymlink && <span className="symlink-badge" title="Symlink" />}
          </span>
        ) : (
          <span className="file-icon file-icon--file">
            {file.isSymlink && <span className="symlink-badge" title="Symlink" />}
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
