import React from 'react';
import type { FileEntry } from '../../shared/types';
import './FileItem.css';

interface FileItemProps {
  file: FileEntry;
  isSelected: boolean;
  isFocused: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

/**
 * Compact file/folder item for Miller column display.
 * Shows icon, name, and chevron for folders.
 */
function FileItem({
  file,
  isSelected,
  isFocused,
  onClick,
  onDoubleClick,
}: FileItemProps): React.JSX.Element {
  const itemClasses = [
    'file-item',
    isSelected && 'file-item--selected',
    isFocused && 'file-item--focused',
    file.isDirectory && 'file-item--directory',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={itemClasses}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      tabIndex={isFocused ? 0 : -1}
      role="option"
      aria-selected={isSelected}
      title={file.name}
    >
      {/* Icon */}
      <span className={`file-item__icon ${file.isDirectory ? 'file-item__icon--folder' : 'file-item__icon--file'}`}>
        {file.isSymlink && <span className="file-item__symlink-badge" />}
      </span>

      {/* Name - title attribute shows full name on hover */}
      <span className="file-item__name" title={file.name}>{file.name}</span>

      {/* Chevron for folders */}
      {file.isDirectory && (
        <span className="file-item__chevron" aria-hidden="true">
          &gt;
        </span>
      )}
    </div>
  );
}

export default React.memo(FileItem);
