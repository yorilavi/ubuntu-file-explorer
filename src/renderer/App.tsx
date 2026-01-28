import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import '../shared/types'; // Import for Window interface extension
import type { ConnectionState, FileEntry } from '../shared/types';
import ServerSidebar from './components/ServerSidebar';
import ColumnView from './components/ColumnView';
import PathBar from './components/PathBar';
import PreviewPanel from './components/PreviewPanel';
import LightboxView from './components/PreviewPanel/Lightbox';
import { ToastProvider } from './components/ToastProvider';

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
  const [navigateToPath, setNavigateToPath] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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

  // Reset path and selection when server changes
  useEffect(() => {
    setCurrentPath('/');
    setNavigateToPath(null);
    setSelectedFile(null);
  }, [selectedServer]);

  const handleFileSelect = useCallback((file: FileEntry, columnIndex: number) => {
    console.log('Selected file:', file.name, 'in column', columnIndex);
    setSelectedFile(file);
  }, []);

  const handlePathChange = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const handlePathNavigate = useCallback((path: string) => {
    // Trigger external navigation to ColumnView
    setNavigateToPath(path);
  }, []);

  // Track pending navigation after connection
  const pendingNavigationRef = useRef<{ serverId: string; path: string } | null>(null);

  const handleFavoriteNavigate = useCallback((serverId: string, path: string) => {
    // Check if server is connected
    const state = connectionStates[serverId];

    if (state?.status === 'ready') {
      // Server is connected, navigate directly
      if (selectedServer !== serverId) {
        setSelectedServer(serverId);
      }
      setNavigateToPath(path);
    } else {
      // Server not connected - show toast with option to connect
      const folderName = path.split('/').pop() || path;
      toast.info('Server not connected', {
        description: `Connect to navigate to "${folderName}"`,
        action: {
          label: 'Connect',
          onClick: async () => {
            try {
              // Store pending navigation for when connection completes
              pendingNavigationRef.current = { serverId, path };
              // Select the server to trigger connection
              setSelectedServer(serverId);
              await window.electronAPI.connect(serverId);
            } catch (error) {
              toast.error('Connection failed', {
                description: error instanceof Error ? error.message : 'Unknown error',
              });
              pendingNavigationRef.current = null;
            }
          },
        },
      });
    }
  }, [selectedServer, connectionStates]);

  // Clear navigateToPath after it's been processed
  const handleNavigationComplete = useCallback(() => {
    setNavigateToPath(null);
  }, []);

  // Handle pending navigation when connection completes
  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (pending) {
      const state = connectionStates[pending.serverId];
      if (state?.status === 'ready') {
        // Connection successful, navigate to the pending path
        setNavigateToPath(pending.path);
        pendingNavigationRef.current = null;
      } else if (state?.status === 'error') {
        // Connection failed, clear pending
        pendingNavigationRef.current = null;
      }
    }
  }, [connectionStates]);

  // Lightbox handlers
  const handleImageClick = useCallback((dataUrl: string) => {
    setLightboxSrc(dataUrl);
    setLightboxOpen(true);
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxOpen(false);
    setLightboxSrc(null);
  }, []);

  // Handle spacebar for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar opens lightbox if image selected and lightbox not already open
      if (e.code === 'Space' && !e.repeat && !lightboxOpen && selectedFile && !selectedFile.isDirectory) {
        const ext = selectedFile.name.toLowerCase().split('.').pop() || '';
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
        if (imageExts.includes(ext)) {
          e.preventDefault();
          // Dispatch custom event for PreviewPanel to provide the image data URL
          window.dispatchEvent(new CustomEvent('open-lightbox'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, lightboxOpen]);

  const currentState = selectedServer ? connectionStates[selectedServer] : undefined;

  return (
    <>
      <div className="app-layout">
        <ServerSidebar
          selectedServerId={selectedServer}
          onServerSelect={setSelectedServer}
          onFavoriteNavigate={handleFavoriteNavigate}
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

                {/* Column view + Preview panel */}
                <div className="browser-main">
                  <div className="browser-columns">
                    <ColumnView
                      key={selectedServer}
                      serverId={selectedServer}
                      initialPath="/"
                      navigateTo={navigateToPath}
                      showHidden={showHidden}
                      onFileSelect={handleFileSelect}
                      onPathChange={handlePathChange}
                      onNavigationComplete={handleNavigationComplete}
                    />
                  </div>
                  <div className="browser-preview">
                    <PreviewPanel
                      serverId={selectedServer}
                      selectedFile={selectedFile}
                      onImageClick={handleImageClick}
                    />
                  </div>
                </div>
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

      <ToastProvider />

      {/* Lightbox overlay */}
      {lightboxSrc && (
        <LightboxView
          src={lightboxSrc}
          open={lightboxOpen}
          onClose={handleLightboxClose}
        />
      )}
    </>
  );
}

export default App;
