import React, { useEffect, useRef } from 'react';
import './HelpModal.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * In-app help modal with keyboard shortcuts, features overview, and usage tips.
 * Opened via the "?" button in the sidebar or Cmd+/ shortcut.
 */
function HelpModal({ isOpen, onClose }: HelpModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="help-overlay" onClick={handleOverlayClick}>
      <div className="help-modal" ref={modalRef} role="dialog" aria-label="Help">
        <div className="help-modal__header">
          <h2 className="help-modal__title">Ubuntu File Explorer</h2>
          <span className="help-modal__version">v1.2.0</span>
          <button className="help-modal__close" onClick={onClose} aria-label="Close help">
            &times;
          </button>
        </div>

        <div className="help-modal__body">
          {/* Getting Started */}
          <section className="help-section">
            <h3 className="help-section__title">Getting Started</h3>
            <div className="help-section__content">
              <p>
                Ubuntu File Explorer lets you browse remote Linux/Ubuntu servers via SSH/SFTP
                using a familiar Finder-style Miller Column interface.
              </p>
              <ol className="help-steps">
                <li>
                  <strong>Connect to a server</strong> &mdash; Click a server in the sidebar to connect.
                  Servers are loaded from your <code>~/.ssh/config</code> file, or add custom connections
                  with the <strong>+</strong> button.
                </li>
                <li>
                  <strong>Browse files</strong> &mdash; Click folders to navigate deeper. Each folder opens
                  in a new column to the right (Miller Column navigation).
                </li>
                <li>
                  <strong>Preview files</strong> &mdash; Select a file to see a preview in the right panel.
                  Supports images, code with syntax highlighting, markdown, and PDFs.
                </li>
                <li>
                  <strong>File operations</strong> &mdash; Right-click any file or folder to access operations
                  like download, upload, rename, delete, and move.
                </li>
              </ol>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="help-section">
            <h3 className="help-section__title">Keyboard Shortcuts</h3>
            <div className="help-section__content">
              <h4 className="help-subsection__title">Navigation</h4>
              <table className="help-shortcuts">
                <tbody>
                  <tr>
                    <td><kbd>&uarr;</kbd> <kbd>&darr;</kbd></td>
                    <td>Navigate files up/down</td>
                  </tr>
                  <tr>
                    <td><kbd>&larr;</kbd> <kbd>&rarr;</kbd></td>
                    <td>Navigate between columns</td>
                  </tr>
                  <tr>
                    <td><kbd>Enter</kbd></td>
                    <td>Open folder / Select file</td>
                  </tr>
                  <tr>
                    <td><kbd>Cmd</kbd>+<kbd>L</kbd></td>
                    <td>Edit path bar directly</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="help-subsection__title">Preview & Lightbox</h4>
              <table className="help-shortcuts">
                <tbody>
                  <tr>
                    <td><kbd>Space</kbd></td>
                    <td>Open/close lightbox (full-screen preview)</td>
                  </tr>
                  <tr>
                    <td><kbd>&uarr;</kbd> <kbd>&darr;</kbd></td>
                    <td>Previous/next file in lightbox</td>
                  </tr>
                  <tr>
                    <td><kbd>Escape</kbd></td>
                    <td>Close lightbox</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="help-subsection__title">File Operations</h4>
              <table className="help-shortcuts">
                <tbody>
                  <tr>
                    <td><kbd>Delete</kbd></td>
                    <td>Delete selected file or folder</td>
                  </tr>
                  <tr>
                    <td><kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd></td>
                    <td>Toggle hidden files (dotfiles)</td>
                  </tr>
                  <tr>
                    <td><kbd>Escape</kbd></td>
                    <td>Cancel active operation</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="help-subsection__title">General</h4>
              <table className="help-shortcuts">
                <tbody>
                  <tr>
                    <td><kbd>Cmd</kbd>+<kbd>/</kbd></td>
                    <td>Open this help dialog</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Features */}
          <section className="help-section">
            <h3 className="help-section__title">Features</h3>
            <div className="help-section__content">
              <dl className="help-features">
                <dt>Miller Column Navigation</dt>
                <dd>Browse directories in cascading columns, just like macOS Finder.</dd>

                <dt>SSH/SFTP Connections</dt>
                <dd>
                  Connects using your <code>~/.ssh/config</code> or custom connections.
                  Supports key-based and password authentication. Passwords are encrypted
                  via macOS Keychain.
                </dd>

                <dt>File Previews</dt>
                <dd>
                  Preview images (JPG, PNG, GIF, WebP, SVG), code files with syntax
                  highlighting (100+ languages), markdown with GitHub styling, and PDFs &mdash;
                  all without downloading.
                </dd>

                <dt>Lightbox Viewer</dt>
                <dd>
                  Press <kbd>Space</kbd> to open a full-screen preview. Navigate between files
                  with arrow keys.
                </dd>

                <dt>File Operations</dt>
                <dd>
                  Right-click for context menu: download, upload, rename, delete, and move files.
                  Upload and download entire folders with progress tracking.
                </dd>

                <dt>Favorites</dt>
                <dd>
                  Right-click a folder and select "Add to Favorites" for quick access.
                  Drag to reorder favorites in the sidebar.
                </dd>

                <dt>Hidden Files</dt>
                <dd>
                  Toggle dotfile visibility with the eye icon in the toolbar or
                  <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd>
                </dd>

                <dt>Large File Support</dt>
                <dd>
                  Directories with thousands of files and code files with 10,000+ lines
                  use virtualized scrolling for smooth performance.
                </dd>
              </dl>
            </div>
          </section>

          {/* Tips */}
          <section className="help-section">
            <h3 className="help-section__title">Tips</h3>
            <div className="help-section__content">
              <ul className="help-tips">
                <li>Double-click the preview panel divider to reset its width.</li>
                <li>Click any segment in the path bar to jump to that directory.</li>
                <li>Double-click a server with a connection error to retry.</li>
                <li>Press <kbd>Escape</kbd> during a file transfer to cancel it.</li>
                <li>Type a filename while browsing to jump to it (typeahead search).</li>
                <li>Drag favorites to reorder them in the sidebar.</li>
              </ul>
            </div>
          </section>
        </div>

        <div className="help-modal__footer">
          <span className="help-modal__footer-text">
            MIT License &middot; <a href="https://github.com/yorilavi/ubuntu-file-explorer" target="_blank" rel="noopener noreferrer">GitHub</a>
          </span>
        </div>
      </div>
    </div>
  );
}

export default HelpModal;
