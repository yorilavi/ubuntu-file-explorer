import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { FileEntry, ConnectionState } from '../../shared/types';
import FileRow from './FileRow';

interface DirectoryListProps {
  serverId: string;
  connectionState: ConnectionState;
  onFileSelect: (file: FileEntry) => void;
  onDirectoryOpen: (path: string) => void;
}

type SortColumn = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';

/**
 * Directory listing component with sortable columns and hidden file toggle.
 * Fetches directory contents from connected server and displays as file rows.
 */
function DirectoryList({
  serverId,
  connectionState,
  onFileSelect,
  onDirectoryOpen,
}: DirectoryListProps): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showHidden, setShowHidden] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

  /**
   * Fetch directory contents from server.
   */
  const fetchDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await window.electronAPI.listDirectory(serverId, path);
        // Convert date strings to Date objects (IPC serializes dates)
        const entriesWithDates = result.entries.map((entry) => ({
          ...entry,
          modified: new Date(entry.modified),
        }));
        setEntries(entriesWithDates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to list directory');
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [serverId]
  );

  // Fetch root directory when connection becomes ready
  useEffect(() => {
    if (connectionState.status === 'ready') {
      fetchDirectory('/');
      setCurrentPath('/');
    }
  }, [connectionState.status, fetchDirectory]);

  // Fetch directory when path changes
  useEffect(() => {
    if (connectionState.status === 'ready' && currentPath) {
      fetchDirectory(currentPath);
    }
  }, [currentPath, connectionState.status, fetchDirectory]);

  /**
   * Sort and filter entries.
   * Folders are kept first (default behavior).
   */
  const sortedEntries = useMemo(() => {
    // Filter hidden files based on toggle
    const filtered = showHidden
      ? entries
      : entries.filter((e) => !e.name.startsWith('.'));

    return [...filtered].sort((a, b) => {
      // Always keep folders first
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }

      let comparison = 0;
      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'modified':
          comparison = a.modified.getTime() - b.modified.getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [entries, sortColumn, sortDirection, showHidden]);

  /**
   * Handle column header click for sorting.
   */
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  /**
   * Handle file selection.
   */
  const handleFileClick = (file: FileEntry) => {
    setSelectedFile(file);
    onFileSelect(file);
  };

  /**
   * Handle double-click on entry.
   * Navigate into directories, select files.
   */
  const handleFileDoubleClick = (file: FileEntry) => {
    if (file.isDirectory) {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      setCurrentPath(newPath);
      setSelectedFile(null);
      onDirectoryOpen(newPath);
    }
  };

  /**
   * Navigate to parent directory.
   */
  const handleNavigateUp = () => {
    if (currentPath === '/') return;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    setCurrentPath(parentPath);
    setSelectedFile(null);
  };

  /**
   * Render sort indicator arrow.
   */
  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  return (
    <div className="directory-list">
      {/* Toolbar */}
      <div className="directory-toolbar">
        <div className="directory-toolbar__path">
          <button
            className="directory-toolbar__back"
            onClick={handleNavigateUp}
            disabled={currentPath === '/'}
            data-tooltip="Go to parent directory"
          >
            ..
          </button>
          <span className="directory-toolbar__current-path">{currentPath}</span>
        </div>

        <label className="directory-toolbar__hidden-toggle">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden files
        </label>
      </div>

      {/* Error message */}
      {error && <div className="directory-error">{error}</div>}

      {/* Loading state */}
      {loading && <div className="directory-loading">Loading...</div>}

      {/* Directory contents */}
      {!loading && !error && (
        <>
          {/* Column headers */}
          <div className="directory-header">
            <div className="directory-header__icon" />
            <button
              className="directory-header__cell directory-header__cell--sortable"
              onClick={() => handleSort('name')}
            >
              Name{renderSortIndicator('name')}
            </button>
            <button
              className="directory-header__cell directory-header__cell--sortable"
              onClick={() => handleSort('size')}
            >
              Size{renderSortIndicator('size')}
            </button>
            <button
              className="directory-header__cell directory-header__cell--sortable"
              onClick={() => handleSort('modified')}
            >
              Modified{renderSortIndicator('modified')}
            </button>
            <span className="directory-header__cell">Permissions</span>
            <span className="directory-header__cell">Owner</span>
          </div>

          {/* File rows */}
          <div className="directory-content">
            {sortedEntries.length === 0 ? (
              <div className="directory-empty">
                {entries.length === 0
                  ? 'Empty directory'
                  : 'No files to show (toggle hidden files to see more)'}
              </div>
            ) : (
              sortedEntries.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  isSelected={selectedFile?.path === file.path}
                  onClick={() => handleFileClick(file)}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DirectoryList;
