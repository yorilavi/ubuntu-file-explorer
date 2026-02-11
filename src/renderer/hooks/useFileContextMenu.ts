import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { FileEntry, ConflictStrategy } from '../../shared/types';
import { formatSize } from '../utils/formatters';

// Folder upload state tracked at hook level
interface FolderUploadState {
  operationId: string | null;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  failedFiles: Array<{ path: string; error: string }>;
}

// Folder download state tracked at hook level
interface FolderDownloadState {
  operationId: string | null;
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  downloadedBytes: number;
  currentFile: string;
  failedFiles: Array<{ path: string; error: string }>;
  remoteFolderPath: string;
  localBasePath: string;
}


export interface UseFileContextMenuProps {
  file: FileEntry;
  serverId: string;
  showHiddenFiles: boolean;
  onRefresh: () => void;
  onRefreshChild?: () => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
}

export interface UseFileContextMenuResult {
  // Context menu state
  contextMenu: { x: number; y: number } | null;
  handleContextMenu: (e: React.MouseEvent) => void;

  // Rename state
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (value: string) => void;
  handleRenameStart: () => void;
  handleRenameConfirm: () => Promise<void>;
  cancelRename: () => void;

  // File operation handlers (called from context menu buttons)
  handleDownload: () => Promise<void>;
  handleUpload: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleMoveTo: () => void;
  handleAddToFavorites: () => Promise<void>;
  handleUploadFolder: () => Promise<void>;
  handleDownloadFolder: () => Promise<void>;
}

/**
 * Hook that encapsulates all context menu logic, file operation handlers,
 * progress tracking, and cancellation for file/folder items.
 *
 * Extracted from FileItem.tsx to enable reuse across different view components
 * (Miller columns, list view, etc.).
 */
export function useFileContextMenu({
  file,
  serverId,
  showHiddenFiles,
  onRefresh,
  onRefreshChild,
  onFavoritesChanged,
  onMoveToClick,
}: UseFileContextMenuProps): UseFileContextMenuResult {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Track active operation for cancellation
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);

  // Track folder upload state
  const [folderUploadState, setFolderUploadState] = useState<FolderUploadState | null>(null);

  // Track folder download state
  const [folderDownloadState, setFolderDownloadState] = useState<FolderDownloadState | null>(null);

  // Track active toasts for progress updates
  const activeToastRef = useRef<string | number | null>(null);

  // Ref to track if folder upload is in progress (for progress listener)
  const folderUploadActiveRef = useRef(false);

  // Ref to track if folder download is in progress (for progress listener)
  const folderDownloadActiveRef = useRef(false);

  // Ref to store cleanup function for folder upload progress listener
  const folderProgressCleanupRef = useRef<(() => void) | null>(null);

  // Ref to store cleanup function for folder download progress listener
  const folderDownloadProgressCleanupRef = useRef<(() => void) | null>(null);

  // Clean up progress listeners on unmount
  useEffect(() => {
    return () => {
      if (folderProgressCleanupRef.current) {
        folderProgressCleanupRef.current();
        folderProgressCleanupRef.current = null;
      }
      if (folderDownloadProgressCleanupRef.current) {
        folderDownloadProgressCleanupRef.current();
        folderDownloadProgressCleanupRef.current = null;
      }
    };
  }, []);

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

  // Escape key handler - cancel active operation, folder upload, or folder download
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
        // Check both state and ref for folder download cancellation
        if (folderDownloadActiveRef.current && folderDownloadState?.operationId) {
          window.electronAPI.cancelFolderDownload(folderDownloadState.operationId);
          folderDownloadActiveRef.current = false;
          setFolderDownloadState(null);
          if (activeToastRef.current) {
            toast.info('Folder download cancelled', { id: activeToastRef.current });
            activeToastRef.current = null;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOperationId, folderUploadState?.operationId, folderDownloadState?.operationId]);

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

  // Retry handler for failed files - re-uploads the entire folder
  // Note: Since retry-specific API doesn't exist, we prompt user to retry full upload
  // Using a ref to break the circular dependency with handleUploadFolder
  const handleUploadFolderRef = useRef<(() => Promise<void>) | undefined>(undefined);

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
            // Trigger a new folder upload via ref to avoid circular dependency
            handleUploadFolderRef.current?.();
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
        onRefreshChild?.(); // Refresh child column to show new folder contents
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
        onRefreshChild?.(); // Refresh child column to show new folder contents
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
  }, [serverId, file.path, file.name, showHiddenFiles, onRefresh, onRefreshChild, handleRetryFailedFiles]);

  // Keep the ref in sync with the latest handleUploadFolder
  handleUploadFolderRef.current = handleUploadFolder;

  // Retry handler for failed downloads
  // Using a ref to break circular dependency with handleDownloadFolder via retry
  const handleRetryFailedDownloadsRef = useRef<((
    remoteFolderPath: string,
    localBasePath: string,
    failedFiles: Array<{ path: string; error: string }>
  ) => Promise<void>) | undefined>(undefined);

  const handleRetryFailedDownloads = useCallback(async (
    remoteFolderPath: string,
    localBasePath: string,
    failedFiles: Array<{ path: string; error: string }>
  ) => {
    const toastId = toast.loading(`Retrying ${failedFiles.length} failed files...`);
    activeToastRef.current = toastId;

    try {
      const result = await window.electronAPI.retryFailedDownloads(
        serverId,
        remoteFolderPath,
        localBasePath,
        failedFiles.map(f => f.path),
        'rename' as ConflictStrategy // Default to rename for retries
      );

      if (result.success) {
        toast.success(`Retry complete: ${result.downloadedCount} files downloaded`, { id: toastId });
      } else if (result.failedFiles && result.failedFiles.length > 0) {
        toast.error(
          `${result.failedFiles.length} files still failed`,
          {
            id: toastId,
            description: result.failedFiles.slice(0, 3).map(f => f.path).join(', ') +
              (result.failedFiles.length > 3 ? ` and ${result.failedFiles.length - 3} more` : ''),
            action: {
              label: 'Retry Again',
              onClick: () => handleRetryFailedDownloadsRef.current?.(remoteFolderPath, localBasePath, result.failedFiles!),
            },
            duration: 15000,
          }
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Retry failed', { id: toastId, description: errorMsg });
    } finally {
      activeToastRef.current = null;
    }
  }, [serverId]);

  // Keep the ref in sync
  handleRetryFailedDownloadsRef.current = handleRetryFailedDownloads;

  // Handle folder download
  const handleDownloadFolder = useCallback(async () => {
    setContextMenu(null);

    // Default to 'rename' strategy for conflicts (Finder-style)
    const conflictStrategy: ConflictStrategy = 'rename';

    const toastId = toast.loading(`Downloading folder "${file.name}"...`);
    activeToastRef.current = toastId;

    // Mark download as active BEFORE the IPC call
    folderDownloadActiveRef.current = true;

    // Subscribe to progress updates BEFORE starting download
    // This ensures we catch all progress events
    folderDownloadProgressCleanupRef.current = window.electronAPI.onFolderDownloadProgress((progress) => {
      if (!folderDownloadActiveRef.current) return;

      // Update state for UI and cancellation
      setFolderDownloadState(prev => ({
        operationId: progress.operationId,
        totalFiles: progress.totalFiles,
        completedFiles: progress.completedFiles,
        totalBytes: progress.totalBytes,
        downloadedBytes: progress.downloadedBytes,
        currentFile: progress.currentFile,
        failedFiles: progress.failedFiles,
        remoteFolderPath: prev?.remoteFolderPath || file.path,
        localBasePath: prev?.localBasePath || '',
      }));

      // Update toast with progress - show both file count and size
      if (activeToastRef.current) {
        const fileProgress = `Downloading ${progress.completedFiles} of ${progress.totalFiles} files`;
        const sizeProgress = progress.totalBytes > 0
          ? ` • ${formatSize(progress.downloadedBytes)} of ${formatSize(progress.totalBytes)}`
          : '';
        const currentText = progress.currentFile ? `\n${progress.currentFile}` : '';
        toast.loading(fileProgress + sizeProgress + currentText, {
          id: activeToastRef.current,
          action: {
            label: 'Cancel',
            onClick: () => {
              if (progress.operationId) {
                window.electronAPI.cancelFolderDownload(progress.operationId);
                folderDownloadActiveRef.current = false;
                setFolderDownloadState(null);
                if (activeToastRef.current) {
                  toast.info('Folder download cancelled', { id: activeToastRef.current });
                  activeToastRef.current = null;
                }
              }
            },
          },
        });
      }
    });

    try {
      const result = await window.electronAPI.downloadFolder(
        serverId,
        file.path,
        conflictStrategy
      );

      // Update state with localPath for potential retry
      if (result.operationId && result.localPath) {
        setFolderDownloadState(prev => prev ? {
          ...prev,
          operationId: result.operationId!,
          localBasePath: result.localPath!,
        } : null);
      }

      if (result.success) {
        toast.success(`Downloaded ${result.downloadedCount} files`, { id: toastId });
      } else if (result.cancelled) {
        toast.info('Folder download cancelled', { id: toastId });
      } else if (result.failedFiles && result.failedFiles.length > 0) {
        // Partial success - some files failed, offer retry
        const successCount = result.downloadedCount || 0;
        const failCount = result.failedFiles.length;
        toast.warning(
          `Downloaded ${successCount} files, ${failCount} failed`,
          {
            id: toastId,
            description: result.failedFiles.slice(0, 3).map(f => f.path).join(', ') +
              (failCount > 3 ? ` and ${failCount - 3} more` : ''),
            action: {
              label: 'Retry Failed',
              onClick: () => handleRetryFailedDownloads(
                file.path,
                result.localPath || '',
                result.failedFiles!
              ),
            },
            duration: 15000, // Longer duration for retry option
          }
        );
      } else if (result.error) {
        toast.error('Folder download failed', {
          id: toastId,
          description: result.error,
        });
      } else {
        // User cancelled folder picker
        toast.dismiss(toastId);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Folder download failed', {
        id: toastId,
        description: errorMsg,
      });
    } finally {
      // Clean up progress listener
      if (folderDownloadProgressCleanupRef.current) {
        folderDownloadProgressCleanupRef.current();
        folderDownloadProgressCleanupRef.current = null;
      }
      activeToastRef.current = null;
      folderDownloadActiveRef.current = false;
      setFolderDownloadState(null);
    }
  }, [serverId, file.path, file.name, handleRetryFailedDownloads]);

  const cancelRename = useCallback(() => {
    setIsRenaming(false);
  }, []);

  return {
    // Context menu state
    contextMenu,
    handleContextMenu,

    // Rename state
    isRenaming,
    renameValue,
    setRenameValue,
    handleRenameStart,
    handleRenameConfirm,
    cancelRename,

    // File operation handlers
    handleDownload,
    handleUpload,
    handleDelete,
    handleMoveTo,
    handleAddToFavorites,
    handleUploadFolder,
    handleDownloadFolder,
  };
}
