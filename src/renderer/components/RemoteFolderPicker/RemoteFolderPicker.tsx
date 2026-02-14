import React, { useState, useEffect, useCallback } from 'react';
import FolderTree from './FolderTree';
import './RemoteFolderPicker.css';

interface RemoteFolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  sourcePath: string;
  sourceFileName: string;
  onMoveConfirm: (destDir: string) => void;
}

/**
 * Modal component for selecting a remote folder destination.
 * Used for "Move to..." file operation.
 */
function RemoteFolderPicker({
  isOpen,
  onClose,
  serverId,
  sourcePath,
  sourceFileName,
  onMoveConfirm,
}: RemoteFolderPickerProps): React.JSX.Element | null {
  // Extract source directory from sourcePath
  const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';

  const [selectedPath, setSelectedPath] = useState<string>(sourceDir);
  const [showHiddenFiles, setShowHiddenFiles] = useState<boolean>(false);

  // Load hidden files preference on mount
  useEffect(() => {
    if (isOpen) {
      window.electronAPI.getShowHiddenFiles().then(setShowHiddenFiles);
      // Reset selected path to source directory when modal opens
      setSelectedPath(sourceDir);
    }
  }, [isOpen, sourceDir]);

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && selectedPath !== sourceDir) {
        onMoveConfirm(selectedPath);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onMoveConfirm, selectedPath, sourceDir]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  const handleMoveClick = useCallback(() => {
    if (selectedPath !== sourceDir) {
      onMoveConfirm(selectedPath);
    }
  }, [selectedPath, sourceDir, onMoveConfirm]);

  // Parse selectedPath into breadcrumb segments
  const breadcrumbSegments = selectedPath === '/'
    ? [{ name: '/', path: '/' }]
    : [
        { name: '/', path: '/' },
        ...selectedPath
          .split('/')
          .filter(Boolean)
          .map((segment, index, arr) => ({
            name: segment,
            path: '/' + arr.slice(0, index + 1).join('/'),
          })),
      ];

  const handleBreadcrumbClick = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  // Truncate destination path for display
  const displayPath = selectedPath.length > 40
    ? '...' + selectedPath.slice(-37)
    : selectedPath;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal folder-picker">
        {/* Header */}
        <div className="modal__header">
          <h2 className="modal__title">Move to...</h2>
          <button className="modal__close" onClick={onClose} data-tooltip="Close">
            &times;
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="folder-picker__breadcrumb">
          {breadcrumbSegments.map((segment, index) => (
            <React.Fragment key={segment.path}>
              {index > 0 && <span className="folder-picker__breadcrumb-separator">/</span>}
              <button
                className={`folder-picker__breadcrumb-item ${
                  segment.path === selectedPath ? 'folder-picker__breadcrumb-item--active' : ''
                }`}
                onClick={() => handleBreadcrumbClick(segment.path)}
              >
                {segment.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Tree container */}
        <div className="folder-picker__tree-container">
          <FolderTree
            serverId={serverId}
            selectedPath={selectedPath}
            sourcePath={sourcePath}
            showHiddenFiles={showHiddenFiles}
            onSelect={handleSelect}
          />
        </div>

        {/* Footer */}
        <div className="folder-picker__footer">
          <div className="folder-picker__destination">
            Move <strong>{sourceFileName}</strong> to: <code>{displayPath}</code>
          </div>
          <div className="modal__actions">
            <button className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleMoveClick}
              disabled={selectedPath === sourceDir}
            >
              Move Here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RemoteFolderPicker;
