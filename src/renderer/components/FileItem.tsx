import React from 'react';
import { createPortal } from 'react-dom';
import type { FileEntry } from '../../shared/types';
import { useFileContextMenu } from '../hooks/useFileContextMenu';
import './FileItem.css';

interface FileItemProps {
  file: FileEntry;
  isSelected: boolean;
  isFocused: boolean;
  isHidden?: boolean;
  serverId: string;
  columnIndex: number;
  showHiddenFiles: boolean;
  onRefresh: () => void;
  onRefreshChild?: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
}

/**
 * Compact file/folder item for Miller column display.
 * Shows icon, name, and chevron for folders.
 * Includes context menu for file operations.
 */
function FileItem({
  file,
  isSelected,
  isFocused,
  isHidden,
  serverId,
  columnIndex: _columnIndex,
  showHiddenFiles,
  onRefresh,
  onRefreshChild,
  onClick,
  onDoubleClick,
  onFavoritesChanged,
  onMoveToClick,
}: FileItemProps): React.JSX.Element {
  const {
    contextMenu, handleContextMenu,
    isRenaming, renameValue, setRenameValue,
    handleRenameStart, handleRenameConfirm, cancelRename,
    handleDownload, handleUpload, handleDelete,
    handleMoveTo, handleAddToFavorites,
    handleUploadFolder, handleDownloadFolder,
  } = useFileContextMenu({
    file, serverId, showHiddenFiles,
    onRefresh, onRefreshChild, onFavoritesChanged, onMoveToClick,
  });

  const itemClasses = [
    'file-item',
    isSelected && 'file-item--selected',
    isFocused && 'file-item--focused',
    file.isDirectory && 'file-item--directory',
    isHidden && 'file-item--hidden',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={itemClasses}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={handleContextMenu}
      tabIndex={isFocused ? 0 : -1}
      role="option"
      aria-selected={isSelected}
      title={file.name}
    >
      {/* Icon */}
      <span className={`file-item__icon ${file.isDirectory ? 'file-item__icon--folder' : 'file-item__icon--file'}`}>
        {file.isSymlink && <span className="file-item__symlink-badge" />}
      </span>

      {/* Name - shows input when renaming, otherwise text */}
      {isRenaming ? (
        <input
          className="file-item__rename-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameConfirm}
          onKeyDown={(e) => {
            // Stop all key events from bubbling to prevent column typeahead/navigation
            e.stopPropagation();
            if (e.key === 'Enter') handleRenameConfirm();
            if (e.key === 'Escape') cancelRename();
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="file-item__name" title={file.name}>{file.name}</span>
      )}

      {/* Chevron for folders */}
      {file.isDirectory && (
        <span className="file-item__chevron" aria-hidden="true">
          &gt;
        </span>
      )}

      {/* Context menu - rendered via portal to escape overflow:hidden containers */}
      {contextMenu && createPortal(
        <div
          className="file-item__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {file.isDirectory ? (
            <>
              <button onClick={handleAddToFavorites}>Add to Favorites</button>
              <div className="file-item__context-menu-separator" />
              <button onClick={handleUpload}>Upload file...</button>
              <button onClick={handleUploadFolder}>Upload Folder...</button>
              <button onClick={handleDownloadFolder}>Download Folder...</button>
              <button onClick={handleRenameStart}>Rename</button>
              <button onClick={handleDelete}>Delete</button>
            </>
          ) : (
            <>
              <button onClick={handleDownload}>Download...</button>
              <button onClick={handleMoveTo}>Move to...</button>
              <button onClick={handleRenameStart}>Rename</button>
              <button onClick={handleDelete}>Delete</button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default React.memo(FileItem);
