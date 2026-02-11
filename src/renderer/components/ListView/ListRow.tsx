import React from 'react';
import { createPortal } from 'react-dom';
import type { FileEntry } from '../../../shared/types';
import { useFileContextMenu } from '../../hooks/useFileContextMenu';
import { formatSize, formatDate } from '../../utils/formatters';
import { getFileKind } from '../../utils/fileKinds';

interface ListRowProps {
  file: FileEntry;
  isSelected: boolean;
  isFocused: boolean;
  serverId: string;
  showHiddenFiles: boolean;
  onRefresh: () => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

/**
 * Single file/folder row for the list view.
 *
 * Renders a CSS Grid row with five columns matching ListHeader:
 * icon | name | size | date modified | kind.
 *
 * Integrates useFileContextMenu for right-click context menu with
 * all file operations (rename, delete, move, download, upload).
 * Supports inline rename via input field.
 */
function ListRow({
  file,
  isSelected,
  isFocused,
  serverId,
  showHiddenFiles,
  onRefresh,
  onFavoritesChanged,
  onMoveToClick,
  onClick,
  onDoubleClick,
}: ListRowProps): React.JSX.Element {
  const {
    contextMenu, handleContextMenu,
    isRenaming, renameValue, setRenameValue,
    handleRenameStart, handleRenameConfirm, cancelRename,
    handleDownload, handleUpload, handleDelete,
    handleMoveTo, handleAddToFavorites,
    handleUploadFolder, handleDownloadFolder,
  } = useFileContextMenu({
    file, serverId, showHiddenFiles,
    onRefresh, onFavoritesChanged, onMoveToClick,
  });

  const rowClasses = [
    'list-row',
    isSelected && 'list-row--selected',
    isFocused && 'list-row--focused',
    file.isDirectory && 'list-row--directory',
    file.name.startsWith('.') && 'list-row--hidden',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClasses}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={handleContextMenu}
      tabIndex={isFocused ? 0 : -1}
      role="option"
      aria-selected={isSelected}
      title={file.name}
    >
      {/* Icon column */}
      <div className="list-row__icon">
        <span className={`file-item__icon ${file.isDirectory ? 'file-item__icon--folder' : 'file-item__icon--file'}`}>
          {file.isSymlink && <span className="file-item__symlink-badge" />}
        </span>
      </div>

      {/* Name column */}
      <div className="list-row__name">
        {isRenaming ? (
          <input
            className="list-row__rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleRenameConfirm();
              if (e.key === 'Escape') cancelRename();
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span title={file.name}>{file.name}</span>
        )}
      </div>

      {/* Size column */}
      <div className="list-row__size">
        {file.isDirectory ? '--' : formatSize(file.size)}
      </div>

      {/* Date Modified column */}
      <div className="list-row__modified">
        {formatDate(file.modified)}
      </div>

      {/* Kind column */}
      <div className="list-row__kind">
        {getFileKind(file.name, file.isDirectory)}
      </div>

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

export default React.memo(ListRow);
