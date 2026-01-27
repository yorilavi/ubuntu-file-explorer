import React, { useState } from 'react';
import type { Server, ConnectionState } from '../../shared/types';

interface ServerListItemProps {
  server: Server;
  state: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void; // Only for custom connections
}

/**
 * Individual server row with connection status indicator.
 * Shows server name, hostname, and current connection state.
 */
function ServerListItem({
  server,
  state,
  onConnect,
  onDisconnect,
  isSelected,
  onSelect,
  onDelete,
}: ServerListItemProps): React.JSX.Element {
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const handleClick = () => {
    onSelect();
    if (state.status === 'idle') {
      onConnect();
    }
  };

  const handleDoubleClick = () => {
    if (state.status === 'error') {
      onConnect();
    }
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDisconnect();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(`Delete connection "${server.name}"?`)) {
      onDelete();
    }
  };

  const toggleErrorDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowErrorDetails(!showErrorDetails);
  };

  // Determine status indicator and text
  const getStatusIndicator = () => {
    switch (state.status) {
      case 'idle':
        return null;
      case 'resolving':
        return <span className="status-text">Resolving...</span>;
      case 'authenticating':
        return <span className="status-text">Authenticating...</span>;
      case 'loading-directory':
        return <span className="status-text">Loading...</span>;
      case 'ready':
        return <span className="status-dot status-dot--connected" title="Connected" />;
      case 'error':
        return (
          <span
            className="status-dot status-dot--error"
            title={state.message}
            onClick={toggleErrorDetails}
          />
        );
      default:
        return null;
    }
  };

  const isConnecting =
    state.status === 'resolving' ||
    state.status === 'authenticating' ||
    state.status === 'loading-directory';

  const isConnected = state.status === 'ready';
  const hasError = state.status === 'error';

  const className = [
    'server-item',
    isSelected && 'server-item--selected',
    isConnected && 'server-item--connected',
    hasError && 'server-item--error',
    isConnecting && 'server-item--connecting',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} onClick={handleClick} onDoubleClick={handleDoubleClick}>
      <div className="server-item__content">
        <div className="server-item__info">
          <span className="server-item__name">{server.name}</span>
          <span className="server-item__host">{server.host}</span>
        </div>
        <div className="server-item__status">
          {getStatusIndicator()}
          {isConnected && (
            <button
              className="server-item__disconnect"
              onClick={handleDisconnect}
              title="Disconnect"
            >
              &times;
            </button>
          )}
          {onDelete && !isConnected && !isConnecting && (
            <button
              className="server-item__delete"
              onClick={handleDelete}
              title="Delete connection"
            >
              🗑
            </button>
          )}
        </div>
      </div>
      {hasError && showErrorDetails && (
        <div className="server-item__error-details">
          {state.status === 'error' && state.message}
        </div>
      )}
    </div>
  );
}

export default ServerListItem;
