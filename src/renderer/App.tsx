import React, { useState, useEffect } from 'react';
import '../shared/types'; // Import for Window interface extension
import type { ConnectionState, FileEntry } from '../shared/types';
import ServerSidebar from './components/ServerSidebar';
import DirectoryList from './components/DirectoryList';

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
 * Main application component with sidebar and content area.
 * Sidebar displays servers, content area shows directory listing when connected.
 */
function App(): React.JSX.Element {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});

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

  const handleFileSelect = (file: FileEntry) => {
    console.log('Selected file:', file.name, file.path);
  };

  const handleDirectoryOpen = (path: string) => {
    console.log('Opened directory:', path);
  };

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
            <DirectoryList
              serverId={selectedServer}
              connectionState={currentState}
              onFileSelect={handleFileSelect}
              onDirectoryOpen={handleDirectoryOpen}
            />
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
