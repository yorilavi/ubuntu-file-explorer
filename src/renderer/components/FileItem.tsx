import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FileEntry } from '../../shared/types';
import './FileItem.css';

interface FileItemProps {
  file: FileEntry;
  isSelected: boolean;
  isFocused: boolean;
  serverId: string;
  columnIndex: number;
  onRefresh: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
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
  serverId,
  columnIndex: _columnIndex,
  onRefresh,
  onClick,
  onDoubleClick,
}: FileItemProps): React.JSX.Element {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Close context menu when clicking elsewhere
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickAway = () => {
      setContextMenu(null);
    };

    // Use setTimeout to avoid closing immediately on the same event loop
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickAway);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [contextMenu]);

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // File operation handlers
  const handleDownload = useCallback(async () => {
    setContextMenu(null);
    const result = await window.electronAPI.downloadFile(serverId, file.path, file.name);
    if (result.success) {
      console.log(`[FileItem] Downloaded to: ${result.path}`);
    } else if (result.error) {
      console.error(`[FileItem] Download failed: ${result.error}`);
    }
  }, [serverId, file.path, file.name]);

  const handleUpload = useCallback(async () => {
    setContextMenu(null);
    // Upload to this folder (entry is directory)
    const result = await window.electronAPI.uploadFile(serverId, file.path);
    if (result.success) {
      onRefresh();
    } else if (result.error) {
      console.error(`[FileItem] Upload failed: ${result.error}`);
    }
  }, [serverId, file.path, onRefresh]);

  const handleDelete = useCallback(async () => {
    setContextMenu(null);
    const result = await window.electronAPI.deleteFile(
      serverId,
      file.path,
      file.name,
      file.isDirectory
    );
    if (result.success) {
      onRefresh();
    } else if (result.error) {
      console.error(`[FileItem] Delete failed: ${result.error}`);
    }
  }, [serverId, file.path, file.name, file.isDirectory, onRefresh]);

  const handleRenameStart = useCallback(() => {
    setContextMenu(null);
    setRenameValue(file.name);
    setIsRenaming(true);
  }, [file.name]);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameValue.trim() || renameValue === file.name) {
      setIsRenaming(false);
      return;
    }
    const result = await window.electronAPI.renameFile(serverId, file.path, renameValue.trim());
    if (result.success) {
      onRefresh();
    } else if (result.error) {
      console.error(`[FileItem] Rename failed: ${result.error}`);
    }
    setIsRenaming(false);
  }, [serverId, file.path, file.name, renameValue, onRefresh]);

  // Note: "Move to" is not implemented because it requires a remote folder picker.
  // Native Electron dialogs can only browse local file systems, not remote SSH servers.
  // This would require a custom folder picker modal showing the remote directory structure.

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
            if (e.key === 'Escape') setIsRenaming(false);
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
              <button onClick={handleUpload}>Upload to folder...</button>
              <button onClick={handleRenameStart}>Rename</button>
              <button onClick={handleDelete}>Delete</button>
            </>
          ) : (
            <>
              <button onClick={handleDownload}>Download...</button>
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
