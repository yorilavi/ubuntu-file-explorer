import React from 'react';
import './ViewModeToggle.css';

interface ViewModeToggleProps {
  viewMode: 'columns' | 'list';
  onToggle: () => void;
}

/**
 * Toggle button for switching between column view and list view.
 * Shows icon for current mode; tooltip describes mode it will switch to.
 */
function ViewModeToggle({ viewMode, onToggle }: ViewModeToggleProps): React.JSX.Element {
  const buttonClasses = ['view-toggle', viewMode === 'list' && 'view-toggle--list']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={buttonClasses}
      onClick={onToggle}
      title={viewMode === 'columns'
        ? 'Switch to list view (Cmd+2)'
        : 'Switch to column view (Cmd+1)'}
      type="button"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        {viewMode === 'columns' ? (
          // Column icon - three vertical bars (current mode is columns)
          <path d="M3 3h5v18H3V3zm7 0h4v18h-4V3zm7 0h4v18h-4V3z" />
        ) : (
          // List icon - horizontal lines (current mode is list)
          <path d="M3 4h18v2H3V4zm0 5h18v2H3V9zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
        )}
      </svg>
    </button>
  );
}

export default ViewModeToggle;
