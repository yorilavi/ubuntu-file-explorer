import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
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
  onFavoritesChanged?: () => void;
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
  onFavoritesChanged,
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

  // Track active toasts for progress updates
  const activeToastRef = useRef<string | number | null>(null);

  // Track active operation for cancellation
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);

  // Escape key handler - cancel active operation
  useEffect(() => {
    if (!activeOperationId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeOperationId) {
        window.electronAPI.cancelOperation(activeOperationId);
        setActiveOperationId(null);
        if (activeToastRef.current) {
          toast.info('Operation cancelled', { id: activeToastRef.current });
          activeToastRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOperationId]);

  // Cancel the current active operation
  const handleCancelOperation = useCallback(() => {
    if (activeOperationId) {
      window.electronAPI.cancelOperation(activeOperationId);
      setActiveOperationId(null);
      if (activeToastRef.current) {
        toast.info('Operation cancelled', { id: activeToastRef.current });
        activeToastRef.current = null;
      }
    }
  }, [activeOperationId]);

  // File operation handlers
  const handleDownload = useCallback(async () => {
    setContextMenu(null);
    const toastId = toast.loading(`Downloading "${file.name}"...`, {
      action: {
        label: 'Cancel',
        onClick: handleCancelOperation,
      },
    });
    activeToastRef.current = toastId;

    // Subscribe to progress updates
    const cleanup = window.electronAPI.onFileOperationProgress((progress) => {
      if (progress.filePath === file.path && activeToastRef.current === toastId) {
        toast.loading(`Downloading "${file.name}"... ${progress.percent}%`, {
          id: toastId,
          action: {
            label: 'Cancel',
            onClick: handleCancelOperation,
          },
        });
      }
    });

    try {
      const result = await window.electronAPI.downloadFile(serverId, file.path, file.name);
      // Track operation ID for cancellation
      if (result.operationId) {
        setActiveOperationId(result.operationId);
      }
      if (result.success) {
        toast.success(`Downloaded "${file.name}"`, { id: toastId });
      } else if (result.cancelled) {
        // Already cancelled via Cancel button or Escape
        toast.info(`Download cancelled: ${file.name}`, { id: toastId });
      } else if (result.error) {
        toast.error(`Download failed: ${file.name}`, {
          id: toastId,
          description: result.error,
        });
      } else {
        // User cancelled save dialog
        toast.dismiss(toastId);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg === 'Operation cancelled') {
        toast.info(`Download cancelled: ${file.name}`, { id: toastId });
      } else {
        toast.error(`Download failed: ${file.name}`, {
          id: toastId,
          description: errorMsg,
        });
      }
    } finally {
      cleanup();
      activeToastRef.current = null;
      setActiveOperationId(null);
    }
  }, [serverId, file.path, file.name, handleCancelOperation]);

  const handleUpload = useCallback(async () => {
    setContextMenu(null);
    const toastId = toast.loading(`Uploading to "${file.name}"...`, {
      action: {
        label: 'Cancel',
        onClick: handleCancelOperation,
      },
    });
    activeToastRef.current = toastId;

    // Subscribe to progress updates
    const cleanup = window.electronAPI.onFileOperationProgress((progress) => {
      // For upload, the filePath will be the local file being uploaded
      if (activeToastRef.current === toastId) {
        toast.loading(`Uploading... ${progress.percent}%`, {
          id: toastId,
          action: {
            label: 'Cancel',
            onClick: handleCancelOperation,
          },
        });
      }
    });

    try {
      const result = await window.electronAPI.uploadFile(serverId, file.path);
      // Track operation ID for cancellation
      if (result.operationId) {
        setActiveOperationId(result.operationId);
      }
      if (result.success) {
        toast.success(`Upload complete`, { id: toastId });
        onRefresh();
      } else if (result.cancelled) {
        // Already cancelled via Cancel button or Escape
        toast.info(`Upload cancelled`, { id: toastId });
      } else if (result.error) {
        toast.error(`Upload failed`, {
          id: toastId,
          description: result.error,
        });
      } else {
        // User cancelled file picker
        toast.dismiss(toastId);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg === 'Operation cancelled') {
        toast.info(`Upload cancelled`, { id: toastId });
      } else {
        toast.error(`Upload failed`, {
          id: toastId,
          description: errorMsg,
        });
      }
    } finally {
      cleanup();
      activeToastRef.current = null;
      setActiveOperationId(null);
    }
  }, [serverId, file.path, onRefresh, handleCancelOperation]);

  const handleDelete = useCallback(async () => {
    setContextMenu(null);
    try {
      const result = await window.electronAPI.deleteFile(
        serverId,
        file.path,
        file.name,
        file.isDirectory
      );
      if (result.success) {
        toast.success(`Deleted "${file.name}"`);
        onRefresh();
      } else if (result.error) {
        toast.error(`Delete failed: ${file.name}`, {
          description: result.error,
        });
      }
      // No toast if user cancelled (result.success is false but no error)
    } catch (error) {
      toast.error(`Delete failed: ${file.name}`, {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
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
    try {
      const result = await window.electronAPI.renameFile(serverId, file.path, renameValue.trim());
      if (result.success) {
        toast.success(`Renamed to "${renameValue.trim()}"`);
        onRefresh();
      } else if (result.error) {
        toast.error(`Rename failed`, {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error(`Rename failed`, {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    setIsRenaming(false);
  }, [serverId, file.path, file.name, renameValue, onRefresh]);

  // Note: "Move to" is not implemented because it requires a remote folder picker.
  // Native Electron dialogs can only browse local file systems, not remote SSH servers.
  // This would require a custom folder picker modal showing the remote directory structure.

  const handleAddToFavorites = useCallback(async () => {
    setContextMenu(null);
    try {
      await window.electronAPI.addFavorite(serverId, file.path);
      toast.success(`Added "${file.name}" to favorites`);
      // Notify sidebar to refresh favorites
      if (onFavoritesChanged) {
        onFavoritesChanged();
      }
    } catch (error) {
      toast.error('Failed to add favorite', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [serverId, file.path, file.name, onFavoritesChanged]);

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
              <button onClick={handleAddToFavorites}>Add to Favorites</button>
              <div className="file-item__context-menu-separator" />
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
