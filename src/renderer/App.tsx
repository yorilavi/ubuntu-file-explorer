import React, { useState, useEffect, useCallback } from 'react';
import '../shared/types'; // Import for Window interface extension
import type { ConnectionState, FileEntry } from '../shared/types';
import ServerSidebar from './components/ServerSidebar';
import ColumnView from './components/ColumnView';
import PathBar from './components/PathBar';

/**
 * Render connection status message for display during connection process.
 */
function renderConnectionStatus(state: ConnectionState | undefined): string {
  if (!state || state.status === 'idle') return 'Click server to connect';
  if (state.status === 'resolving') return 'Resolving host...';
  if (state.status === 'authenticating') return 'Authenticating...';
  if (state.status === 'loading-directory') return 'Loading directory...';
  if (state.status === 'error') return `Error: ${state.message}`;
  return 'Connected';
}

/**
 * Main application component with sidebar and column view.
 * Sidebar displays servers, main area shows Miller column file browser.
 */
function App(): React.JSX.Element {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const [currentPath, setCurrentPath] = useState('/');
  const [showHidden, setShowHidden] = useState(false);

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = window.electronAPI.onConnectionStateChange(
      (serverId: string, state: ConnectionState) => {
        setConnectionStates((prev) => ({
          ...prev,
          [serverId]: state,
        }));
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Reset path when server changes
  useEffect(() => {
    setCurrentPath('/');
  }, [selectedServer]);

  const handleFileSelect = useCallback((file: FileEntry, columnIndex: number) => {
    console.log('Selected file:', file.name, 'in column', columnIndex);
  }, []);

  const handlePathChange = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const handlePathNavigate = useCallback((path: string) => {
    // This will be handled by ColumnView through a ref or state update
    // For now, just update the displayed path
    setCurrentPath(path);
  }, []);

  const currentState = selectedServer ? connectionStates[selectedServer] : undefined;

  return (
    <div className="app-layout">
      <ServerSidebar
        selectedServerId={selectedServer}
        onServerSelect={setSelectedServer}
      />
      <main className="main-content">
        {selectedServer ? (
          currentState?.status === 'ready' ? (
            <div className="browser-container">
              {/* Toolbar with path bar and controls */}
              <div className="browser-toolbar">
                <PathBar
                  path={currentPath}
                  onNavigate={handlePathNavigate}
                />
                <div className="browser-toolbar__controls">
                  <label className="browser-toolbar__toggle">
                    <input
                      type="checkbox"
                      checked={showHidden}
                      onChange={(e) => setShowHidden(e.target.checked)}
                    />
                    Show hidden
                  </label>
                </div>
              </div>

              {/* Column view */}
              <ColumnView
                key={selectedServer}
                serverId={selectedServer}
                initialPath="/"
                navigateTo={currentPath}
                showHidden={showHidden}
                onFileSelect={handleFileSelect}
                onPathChange={handlePathChange}
              />
            </div>
          ) : (
            <div className="connection-status">
              <div className="connection-status__message">
                {renderConnectionStatus(currentState)}
              </div>
            </div>
          )
        ) : (
          <div className="placeholder">Select a server to browse</div>
        )}
      </main>
    </div>
  );
}

export default App;
