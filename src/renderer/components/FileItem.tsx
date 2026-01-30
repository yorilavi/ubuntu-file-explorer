import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import type { FileEntry } from '../../shared/types';
import './FileItem.css';

// Folder upload state tracked at component level
interface FolderUploadState {
  operationId: string | null;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  failedFiles: Array<{ path: string; error: string }>;
}

interface FileItemProps {
  file: FileEntry;
  isSelected: boolean;
  isFocused: boolean;
  isHidden?: boolean;
  serverId: string;
  columnIndex: number;
  showHiddenFiles: boolean;
  onRefresh: () => void;
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
  onClick,
  onDoubleClick,
  onFavoritesChanged,
  onMoveToClick,
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

  // Track folder upload state
  const [folderUploadState, setFolderUploadState] = useState<FolderUploadState | null>(null);

  // Ref to track if folder upload is in progress (for progress listener)
  const folderUploadActiveRef = useRef(false);

  // Escape key handler - cancel active operation or folder upload
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeOperationId) {
          window.electronAPI.cancelOperation(activeOperationId);
          setActiveOperationId(null);
          if (activeToastRef.current) {
            toast.info('Operation cancelled', { id: activeToastRef.current });
            activeToastRef.current = null;
          }
        }
        // Check both state and ref for folder upload cancellation
        if (folderUploadActiveRef.current && folderUploadState?.operationId) {
          window.electronAPI.cancelFolderUpload(folderUploadState.operationId);
          folderUploadActiveRef.current = false;
          setFolderUploadState(null);
          if (activeToastRef.current) {
            toast.info('Folder upload cancelled', { id: activeToastRef.current });
            activeToastRef.current = null;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOperationId, folderUploadState?.operationId]);

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

  const handleMoveTo = useCallback(() => {
    setContextMenu(null);
    onMoveToClick?.(file);
  }, [file, onMoveToClick]);

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

  // Ref to store cleanup function for folder upload progress listener
  const folderProgressCleanupRef = useRef<(() => void) | null>(null);

  // Retry handler for failed files - re-uploads the entire folder
  // Note: Since retry-specific API doesn't exist, we prompt user to retry full upload
  const handleRetryFailedFiles = useCallback((failedFiles: Array<{ path: string; error: string }>) => {
    // Show toast with failed files info and offer to retry full upload
    toast.error(
      `${failedFiles.length} files failed to upload`,
      {
        description: failedFiles.slice(0, 3).map(f => f.path.split('/').pop()).join(', ') +
          (failedFiles.length > 3 ? ` and ${failedFiles.length - 3} more` : ''),
        action: {
          label: 'Retry Upload',
          onClick: () => {
            // Trigger a new folder upload
            handleUploadFolder();
          },
        },
        duration: 15000,
      }
    );
  }, []);

  // Handle folder upload
  const handleUploadFolder = useCallback(async () => {
    setContextMenu(null);
    const toastId = toast.loading(`Selecting folder to upload to "${file.name}"...`);
    activeToastRef.current = toastId;

    // Mark upload as active BEFORE the IPC call
    folderUploadActiveRef.current = true;

    // Subscribe to progress updates BEFORE starting upload
    // This ensures we catch all progress events
    folderProgressCleanupRef.current = window.electronAPI.onFolderUploadProgress((progress) => {
      if (!folderUploadActiveRef.current) return;

      // Update state for UI
      setFolderUploadState({
        operationId: progress.operationId,
        totalFiles: progress.totalFiles,
        completedFiles: progress.completedFiles,
        currentFile: progress.currentFile,
        failedFiles: progress.failedFiles,
      });

      // Update toast with progress
      if (activeToastRef.current) {
        const progressText = `Uploading ${progress.completedFiles} of ${progress.totalFiles} files`;
        const currentText = progress.currentFile ? ` - ${progress.currentFile}` : '';
        toast.loading(progressText + currentText, {
          id: activeToastRef.current,
          action: {
            label: 'Cancel',
            onClick: () => {
              if (progress.operationId) {
                window.electronAPI.cancelFolderUpload(progress.operationId);
                folderUploadActiveRef.current = false;
                setFolderUploadState(null);
                if (activeToastRef.current) {
                  toast.info('Folder upload cancelled', { id: activeToastRef.current });
                  activeToastRef.current = null;
                }
              }
            },
          },
        });
      }
    });

    try {
      const result = await window.electronAPI.uploadFolder(
        serverId,
        file.path,
        showHiddenFiles
      );

      if (result.success) {
        toast.success(`Uploaded ${result.uploadedCount} files`, { id: toastId });
        onRefresh();
      } else if (result.cancelled) {
        toast.info('Folder upload cancelled', { id: toastId });
      } else if (result.failedFiles && result.failedFiles.length > 0) {
        // Partial success - some files failed, offer retry
        const successCount = (result.uploadedCount || 0);
        const failCount = result.failedFiles.length;
        toast.warning(
          `Uploaded ${successCount} files, ${failCount} failed`,
          {
            id: toastId,
            description: result.failedFiles.slice(0, 3).map(f => f.path.split('/').pop()).join(', ') +
              (failCount > 3 ? ` and ${failCount - 3} more` : ''),
            action: {
              label: 'Retry Failed',
              onClick: () => handleRetryFailedFiles(result.failedFiles!),
            },
            duration: 15000,
          }
        );
        onRefresh();
      } else if (result.error) {
        toast.error('Folder upload failed', {
          id: toastId,
          description: result.error,
        });
      } else {
        // User cancelled folder picker
        toast.dismiss(toastId);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Folder upload failed', {
        id: toastId,
        description: errorMsg,
      });
    } finally {
      // Clean up progress listener
      if (folderProgressCleanupRef.current) {
        folderProgressCleanupRef.current();
        folderProgressCleanupRef.current = null;
      }
      activeToastRef.current = null;
      folderUploadActiveRef.current = false;
      setFolderUploadState(null);
    }
  }, [serverId, file.path, file.name, showHiddenFiles, onRefresh, handleRetryFailedFiles]);

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
              <button onClick={handleUpload}>Upload file...</button>
              <button onClick={handleUploadFolder}>Upload Folder...</button>
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
