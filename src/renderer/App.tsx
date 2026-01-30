import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import '../shared/types'; // Import for Window interface extension
import type { ConnectionState, FileEntry } from '../shared/types';
import ServerSidebar from './components/ServerSidebar';
import ColumnView from './components/ColumnView';
import PathBar from './components/PathBar';
import PreviewPanel from './components/PreviewPanel';
import LightboxView, { LightboxSlide } from './components/PreviewPanel/Lightbox';
import HiddenFilesToggle from './components/HiddenFilesToggle';
import { ToastProvider } from './components/ToastProvider';
import { RemoteFolderPicker } from './components/RemoteFolderPicker';

// Default preview panel width for reset
const DEFAULT_PREVIEW_WIDTH = 300;

// File extension categories for lightbox preview
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const MARKDOWN_EXTS = ['md', 'mdx'];
const CODE_EXTS = [
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',  // JavaScript/TypeScript
  'py', 'pyw',                               // Python
  'rb', 'rake',                              // Ruby
  'go',                                      // Go
  'rs',                                      // Rust
  'java', 'kt', 'kts', 'scala',             // JVM languages
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',      // C/C++
  'cs',                                      // C#
  'swift',                                   // Swift
  'php',                                     // PHP
  'sh', 'bash', 'zsh', 'fish',              // Shell
  'sql',                                     // SQL
  'css', 'scss', 'sass', 'less',            // Stylesheets
  'html', 'htm', 'xml', 'xhtml',            // Markup
  'json', 'yaml', 'yml', 'toml',            // Config
  'lua', 'vim', 'dockerfile',               // Other
];

/**
 * Check if a file is previewable in lightbox (image, markdown, or code).
 */
function isPreviewable(file: FileEntry): boolean {
  if (file.isDirectory) return false;
  const ext = file.name.toLowerCase().split('.').pop() || '';
  return IMAGE_EXTS.includes(ext) || MARKDOWN_EXTS.includes(ext) || CODE_EXTS.includes(ext);
}

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
  const [showHidden, setShowHidden] = useState<boolean | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Previewable files navigation state
  const [previewableFiles, setPreviewableFiles] = useState<FileEntry[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [codeLanguage, setCodeLanguage] = useState<string>('text');

  // Move file state
  const [moveTarget, setMoveTarget] = useState<FileEntry | null>(null);

  // Ref to refresh current directory (set by ColumnView)
  const refreshColumnRef = useRef<(() => void) | null>(null);

  // Preview panel resize state - persist via IPC
  const [previewWidth, setPreviewWidth] = useState(300);
  const previewWidthRef = useRef(previewWidth); // Track current width for save
  const [previewResizing, setPreviewResizing] = useState<{ startX: number; startWidth: number } | null>(null);
  const browserMainRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync with state
  useEffect(() => {
    previewWidthRef.current = previewWidth;
  }, [previewWidth]);

  // Load saved preview width on mount
  useEffect(() => {
    window.electronAPI.getPreviewPanelWidth().then(setPreviewWidth);
  }, []);

  // Load saved hidden files preference on mount
  useEffect(() => {
    window.electronAPI.getShowHiddenFiles().then(setShowHidden);
  }, []);

  // Handle preview panel resize
  useEffect(() => {
    if (!previewResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate max width dynamically - leave at least 150px for one column
      const containerWidth = browserMainRef.current?.clientWidth || 1200;
      const maxWidth = containerWidth - 150;

      // Moving left increases preview width, moving right decreases it
      const delta = previewResizing.startX - e.clientX;
      const newWidth = Math.max(200, Math.min(maxWidth, previewResizing.startWidth + delta));
      setPreviewWidth(newWidth);
    };

    const handleMouseUp = () => {
      setPreviewResizing(null);
      // Save via IPC - use ref to get current value, not stale closure
      window.electronAPI.setPreviewPanelWidth(previewWidthRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [previewResizing]);

  const handlePreviewResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPreviewResizing({ startX: e.clientX, startWidth: previewWidth });
  }, [previewWidth]);

  // Handle double-click on preview resize handle to reset panel width
  const handlePreviewDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent interference with drag

    // Reset to default width and persist
    setPreviewWidth(DEFAULT_PREVIEW_WIDTH);
    window.electronAPI.setPreviewPanelWidth(DEFAULT_PREVIEW_WIDTH);
  }, []);

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

  // Store favorites refresh function from ServerSidebar for FileItem to call
  const refreshFavoritesRef = useRef<(() => Promise<void>) | null>(null);

  const handleRefreshFavoritesCallback = useCallback((refreshFn: () => Promise<void>) => {
    refreshFavoritesRef.current = refreshFn;
  }, []);

  const handleFavoritesChanged = useCallback(async () => {
    if (refreshFavoritesRef.current) {
      await refreshFavoritesRef.current();
    }
  }, []);

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
    setMarkdownContent(null);
    setCodeContent(null);
  }, []);

  // Update lightbox when navigating to a new image while lightbox is open
  const handleImagePreviewReady = useCallback((dataUrl: string) => {
    if (lightboxOpen) {
      setLightboxSrc(dataUrl);
      setMarkdownContent(null);
      setCodeContent(null);
    }
  }, [lightboxOpen]);

  // Handle markdown preview ready - open lightbox with markdown content
  const handleMarkdownPreviewReady = useCallback((content: string) => {
    if (lightboxOpen) {
      setMarkdownContent(content);
      setLightboxSrc(null);
      setCodeContent(null);
    } else {
      // Opening lightbox for markdown
      setMarkdownContent(content);
      setLightboxSrc(null);
      setCodeContent(null);
      setLightboxOpen(true);
    }
  }, [lightboxOpen]);

  // Handle code preview ready - open lightbox with code content
  const handleCodePreviewReady = useCallback((content: string, language: string) => {
    if (lightboxOpen) {
      setCodeContent(content);
      setCodeLanguage(language);
      setLightboxSrc(null);
      setMarkdownContent(null);
    } else {
      // Opening lightbox for code
      setCodeContent(content);
      setCodeLanguage(language);
      setLightboxSrc(null);
      setMarkdownContent(null);
      setLightboxOpen(true);
    }
  }, [lightboxOpen]);

  // Move file handlers
  const handleMoveToClick = useCallback((file: FileEntry) => {
    setMoveTarget(file);
  }, []);

  const handleMoveConfirm = useCallback(async (destDir: string) => {
    if (!moveTarget || !selectedServer) return;

    const file = moveTarget;
    const sourceDir = file.path.substring(0, file.path.lastIndexOf('/')) || '/';

    setMoveTarget(null); // Close modal immediately

    try {
      const result = await window.electronAPI.moveFile(selectedServer, file.path, destDir);

      if (result.success) {
        toast.success(`Moved "${file.name}" to ${destDir}`, {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: async () => {
              // Move back to original location
              const undoResult = await window.electronAPI.moveFile(
                selectedServer,
                result.path!, // new path after move
                sourceDir
              );
              if (undoResult.success) {
                toast.success(`Moved "${file.name}" back`);
                // Refresh current directory
                refreshColumnRef.current?.();
              } else {
                toast.error(`Undo failed: ${undoResult.error}`);
              }
            },
          },
        });
        // Refresh current directory to show file is gone
        refreshColumnRef.current?.();
      } else {
        toast.error(`Move failed: ${file.name}`, {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error(`Move failed: ${file.name}`, {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [moveTarget, selectedServer]);

  const handleRefreshColumnCallback = useCallback((refreshFn: () => void) => {
    refreshColumnRef.current = refreshFn;
  }, []);

  // Handle files loaded from ColumnView to track previewable files
  const handleFilesLoaded = useCallback((files: FileEntry[]) => {
    const previewable = files.filter(isPreviewable);
    setPreviewableFiles(previewable);
  }, []);

  // Update currentPreviewIndex when selectedFile changes
  useEffect(() => {
    if (selectedFile && previewableFiles.length > 0) {
      const index = previewableFiles.findIndex(f => f.path === selectedFile.path);
      if (index !== -1) {
        setCurrentPreviewIndex(index);
      }
    }
  }, [selectedFile, previewableFiles]);

  // Toggle hidden files visibility and persist preference
  const handleToggleHidden = useCallback(() => {
    setShowHidden((prev) => {
      const newValue = !prev;
      window.electronAPI.setShowHiddenFiles(newValue);
      return newValue;
    });
  }, []);

  // Keyboard shortcut: Cmd+Shift+. to toggle hidden files
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd+Shift+. (Period) toggles hidden files
      if (e.metaKey && e.shiftKey && e.code === 'Period') {
        e.preventDefault();
        handleToggleHidden();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleHidden]);

  // Handle spacebar for lightbox and arrow keys when lightbox is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar toggles lightbox (open/close)
      if (e.code === 'Space' && !e.repeat) {
        if (lightboxOpen) {
          // Close lightbox
          e.preventDefault();
          handleLightboxClose();
        } else if (selectedFile && !selectedFile.isDirectory) {
          // Open lightbox if previewable file selected
          const ext = selectedFile.name.toLowerCase().split('.').pop() || '';
          if (IMAGE_EXTS.includes(ext) || MARKDOWN_EXTS.includes(ext) || CODE_EXTS.includes(ext)) {
            e.preventDefault();
            // Dispatch custom event for PreviewPanel to provide the content
            window.dispatchEvent(new CustomEvent('open-lightbox'));
          }
        }
      }

      // When lightbox is open, intercept arrow keys for previewable file navigation
      if (lightboxOpen && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault();
        e.stopPropagation();
        // Dispatch custom event for ColumnView to navigate
        window.dispatchEvent(new CustomEvent('lightbox-navigate', {
          detail: { direction: e.code === 'ArrowUp' ? 'up' : 'down' }
        }));
      }
    };

    // Use capture phase to intercept before lightbox
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedFile, lightboxOpen, handleLightboxClose]);

  const currentState = selectedServer ? connectionStates[selectedServer] : undefined;

  // Build slides array for lightbox - supports images, markdown, and code
  const lightboxSlides = useMemo((): LightboxSlide[] => {
    if (!selectedFile) return [];

    const ext = selectedFile.name.toLowerCase().split('.').pop() || '';
    const isMarkdown = MARKDOWN_EXTS.includes(ext);

    if (isMarkdown && markdownContent) {
      return [{
        type: 'markdown' as const,
        content: markdownContent,
        filename: selectedFile.name,
        basePath: selectedFile.path,
      }];
    } else if (codeContent) {
      return [{
        type: 'code' as const,
        content: codeContent,
        filename: selectedFile.name,
        language: codeLanguage,
      }];
    } else if (lightboxSrc) {
      return [{
        type: 'image' as const,
        src: lightboxSrc,
      }];
    }
    return [];
  }, [selectedFile, markdownContent, codeContent, codeLanguage, lightboxSrc]);

  return (
    <>
      <div className="app-layout">
        <ServerSidebar
          selectedServerId={selectedServer}
          onServerSelect={setSelectedServer}
          onFavoriteNavigate={handleFavoriteNavigate}
          onRefreshFavorites={handleRefreshFavoritesCallback}
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
                    <HiddenFilesToggle
                      showHidden={showHidden ?? false}
                      onToggle={handleToggleHidden}
                    />
                  </div>
                </div>

                {/* Column view + Preview panel */}
                <div ref={browserMainRef} className={`browser-main ${previewResizing ? 'browser-main--resizing' : ''}`}>
                  <div className="browser-columns">
                    <ColumnView
                      key={selectedServer}
                      serverId={selectedServer}
                      initialPath="/"
                      navigateTo={navigateToPath}
                      showHidden={showHidden ?? false}
                      onFileSelect={handleFileSelect}
                      onPathChange={handlePathChange}
                      onNavigationComplete={handleNavigationComplete}
                      onFavoritesChanged={handleFavoritesChanged}
                      onMoveToClick={handleMoveToClick}
                      onRefreshColumn={handleRefreshColumnCallback}
                      onFilesLoaded={handleFilesLoaded}
                    />
                  </div>
                  <div
                    className={`browser-main__resize-handle ${previewResizing ? 'browser-main__resize-handle--active' : ''}`}
                    onMouseDown={handlePreviewResizeStart}
                    onDoubleClick={handlePreviewDoubleClick}
                  />
                  <div className="browser-preview" style={{ width: previewWidth }}>
                    <PreviewPanel
                      serverId={selectedServer}
                      selectedFile={selectedFile}
                      lightboxOpen={lightboxOpen}
                      onImageClick={handleImageClick}
                      onImagePreviewReady={handleImagePreviewReady}
                      onMarkdownPreviewReady={handleMarkdownPreviewReady}
                      onCodePreviewReady={handleCodePreviewReady}
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
      {lightboxOpen && lightboxSlides.length > 0 && (
        <LightboxView
          slides={lightboxSlides}
          currentIndex={0}
          open={lightboxOpen}
          onClose={handleLightboxClose}
          totalPreviewable={previewableFiles.length}
          currentPreviewPosition={currentPreviewIndex + 1}
        />
      )}

      {/* Move file folder picker modal */}
      {moveTarget && selectedServer && (
        <RemoteFolderPicker
          isOpen={true}
          onClose={() => setMoveTarget(null)}
          serverId={selectedServer}
          sourcePath={moveTarget.path}
          sourceFileName={moveTarget.name}
          onMoveConfirm={handleMoveConfirm}
        />
      )}
    </>
  );
}

export default App;
