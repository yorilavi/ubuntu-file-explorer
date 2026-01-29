import React, { useState, useEffect, useCallback } from 'react';
import type { FileEntry } from '../../../shared/types';

interface FolderTreeItemProps {
  folder: FileEntry;
  serverId: string;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isSourceFolder: boolean;
  showHiddenFiles: boolean;
  onToggleExpand: (path: string) => void;
  onSelect: (path: string) => void;
}

/**
 * Recursive folder tree item for RemoteFolderPicker.
 * Lazy loads children when expanded via listDirectory IPC.
 */
function FolderTreeItem({
  folder,
  serverId,
  depth,
  isExpanded,
  isSelected,
  isSourceFolder,
  showHiddenFiles,
  onToggleExpand,
  onSelect,
}: FolderTreeItemProps): React.JSX.Element {
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy load children when expanded
  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    // Only load if we haven't already
    if (children.length > 0 || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    window.electronAPI
      .listDirectory(serverId, folder.path)
      .then((result) => {
        if (result.entries) {
          // Filter to directories only
          let folders = result.entries.filter((entry) => entry.isDirectory);

          // Filter hidden files if needed
          if (!showHiddenFiles) {
            folders = folders.filter((entry) => !entry.name.startsWith('.'));
          }

          // Sort alphabetically
          folders.sort((a, b) => a.name.localeCompare(b.name));

          setChildren(folders);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load folder');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isExpanded, serverId, folder.path, showHiddenFiles, children.length, isLoading]);

  // Clear children cache when showHiddenFiles changes
  useEffect(() => {
    if (children.length > 0) {
      // Re-filter existing children when hidden files toggle changes
      setChildren([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHiddenFiles]);

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isSourceFolder) {
        onSelect(folder.path);
      }
    },
    [folder.path, isSourceFolder, onSelect]
  );

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand(folder.path);
    },
    [folder.path, onToggleExpand]
  );

  const itemClasses = [
    'folder-tree-item',
    isSelected && 'folder-tree-item--selected',
    isSourceFolder && 'folder-tree-item--source',
  ]
    .filter(Boolean)
    .join(' ');

  const chevronClasses = [
    'folder-tree-item__chevron',
    isExpanded && 'folder-tree-item__chevron--expanded',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <div
        className={itemClasses}
        onClick={handleRowClick}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isExpanded}
      >
        {/* Expand/collapse chevron */}
        <button
          className={chevronClasses}
          onClick={handleChevronClick}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          type="button"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M3 2l4 3-4 3V2z" />
          </svg>
        </button>

        {/* Folder icon */}
        <span className="folder-tree-item__icon" />

        {/* Folder name */}
        <span className="folder-tree-item__name" title={folder.name}>
          {folder.name}
        </span>

        {/* Current folder badge */}
        {isSourceFolder && (
          <span className="folder-tree-item__badge">Current folder</span>
        )}
      </div>

      {/* Children (when expanded) */}
      {isExpanded && (
        <div className="folder-tree-item__children" role="group">
          {isLoading && (
            <div
              className="folder-tree-item__loading"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              Loading...
            </div>
          )}

          {error && (
            <div
              className="folder-tree-item__error"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              {error}
            </div>
          )}

          {!isLoading && !error && children.length === 0 && (
            <div
              className="folder-tree-item__empty"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              No subfolders
            </div>
          )}

          {children.map((child) => (
            <FolderTreeItem
              key={child.path}
              folder={child}
              serverId={serverId}
              depth={depth + 1}
              isExpanded={false}
              isSelected={false}
              isSourceFolder={false}
              showHiddenFiles={showHiddenFiles}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(FolderTreeItem);
