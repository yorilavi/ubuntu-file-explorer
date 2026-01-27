import React, { useState, useRef, useEffect } from 'react';
import './PathBar.css';

interface PathBarProps {
  path: string;
  onNavigate: (path: string) => void;
}

/**
 * Path bar with clickable breadcrumb segments and edit mode.
 * Click a segment to navigate to that folder.
 * Click the bar or press Cmd+L to enter edit mode.
 */
function PathBar({ path, onNavigate }: PathBarProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when path changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(path);
    }
  }, [path, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle keyboard shortcut for edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+L or Ctrl+L to enter edit mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        setIsEditing(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Parse path into segments
  const segments = path.split('/').filter(Boolean);

  /**
   * Handle clicking a path segment.
   */
  const handleSegmentClick = (e: React.MouseEvent, segmentIndex: number) => {
    e.stopPropagation();
    const newPath = '/' + segments.slice(0, segmentIndex + 1).join('/');
    onNavigate(newPath);
  };

  /**
   * Handle clicking root segment.
   */
  const handleRootClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate('/');
  };

  /**
   * Handle submitting edited path.
   */
  const handleSubmit = () => {
    setIsEditing(false);
    const trimmedPath = editValue.trim();
    if (trimmedPath && trimmedPath !== path) {
      // Normalize path
      const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : '/' + trimmedPath;
      onNavigate(normalizedPath);
    } else {
      // Reset to current path if empty or unchanged
      setEditValue(path);
    }
  };

  /**
   * Handle key events in edit mode.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setEditValue(path);
    }
  };

  // Edit mode
  if (isEditing) {
    return (
      <div className="path-bar path-bar--editing">
        <input
          ref={inputRef}
          type="text"
          className="path-bar__input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          placeholder="Enter path..."
        />
      </div>
    );
  }

  // Breadcrumb mode
  return (
    <nav
      className="path-bar"
      onClick={() => setIsEditing(true)}
      title="Click to edit path (Cmd+L)"
    >
      <button
        type="button"
        className="path-bar__segment path-bar__segment--root"
        onClick={handleRootClick}
      >
        /
      </button>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          <span className="path-bar__separator">/</span>
          <button
            type="button"
            className="path-bar__segment"
            onClick={(e) => handleSegmentClick(e, index)}
          >
            {segment}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}

export default PathBar;
