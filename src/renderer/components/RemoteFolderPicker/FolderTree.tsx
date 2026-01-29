import React, { useState, useEffect, useCallback } from 'react';
import type { FileEntry } from '../../../shared/types';
import FolderTreeItem from './FolderTreeItem';

interface FolderTreeProps {
  serverId: string;
  selectedPath: string;
  sourcePath: string;
  showHiddenFiles: boolean;
  onSelect: (path: string) => void;
}

/**
 * Container component for folder tree.
 * Manages expanded state and loads root folders.
 */
function FolderTree({
  serverId,
  selectedPath,
  sourcePath,
  showHiddenFiles,
  onSelect,
}: FolderTreeProps): React.JSX.Element {
  const [rootFolders, setRootFolders] = useState<FileEntry[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load root folders on mount
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    window.electronAPI
      .listDirectory(serverId, '/')
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

          setRootFolders(folders);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load root directory');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [serverId, showHiddenFiles]);

  // Auto-expand path to source folder's parent on mount
  useEffect(() => {
    if (!sourcePath || sourcePath === '/') {
      return;
    }

    // Get all ancestor paths
    const paths = new Set<string>();
    const segments = sourcePath.split('/').filter(Boolean);

    let currentPath = '';
    for (let i = 0; i < segments.length - 1; i++) {
      currentPath += '/' + segments[i];
      paths.add(currentPath);
    }

    if (paths.size > 0) {
      setExpandedPaths(paths);
    }
  }, [sourcePath]);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Get source directory (parent of file being moved)
  const sourceDir = sourcePath
    ? sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/'
    : '/';

  if (isLoading) {
    return (
      <div className="folder-tree__loading">
        Loading folders...
      </div>
    );
  }

  if (error) {
    return (
      <div className="folder-tree__error">
        {error}
      </div>
    );
  }

  return (
    <div className="folder-tree" role="tree">
      {/* Root folder special case */}
      <div
        className={`folder-tree-item ${selectedPath === '/' ? 'folder-tree-item--selected' : ''} ${sourceDir === '/' ? 'folder-tree-item--source' : ''}`}
        onClick={() => sourceDir !== '/' && onSelect('/')}
        style={{ paddingLeft: '8px' }}
        role="treeitem"
        aria-selected={selectedPath === '/'}
      >
        <span className="folder-tree-item__chevron folder-tree-item__chevron--expanded">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M3 2l4 3-4 3V2z" />
          </svg>
        </span>
        <span className="folder-tree-item__icon" />
        <span className="folder-tree-item__name">/</span>
        {sourceDir === '/' && (
          <span className="folder-tree-item__badge">Current folder</span>
        )}
      </div>

      {/* Root level folders */}
      {rootFolders.map((folder) => (
        <FolderTreeItem
          key={folder.path}
          folder={folder}
          serverId={serverId}
          depth={1}
          isExpanded={expandedPaths.has(folder.path)}
          isSelected={selectedPath === folder.path}
          isSourceFolder={sourceDir === folder.path}
          showHiddenFiles={showHiddenFiles}
          onToggleExpand={handleToggleExpand}
          onSelect={onSelect}
        />
      ))}

      {rootFolders.length === 0 && (
        <div className="folder-tree__empty">
          No folders found
        </div>
      )}
    </div>
  );
}

export default FolderTree;
