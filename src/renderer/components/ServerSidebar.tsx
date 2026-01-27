import React, { useEffect, useState } from 'react';
import type { Server, ConnectionState } from '../../shared/types';
import ServerListItem from './ServerListItem';
import AddConnectionModal from './AddConnectionModal';

interface ServerSidebarProps {
  selectedServerId: string | null;
  onServerSelect: (serverId: string) => void;
}

/**
 * Server sidebar with grouped server list (SSH Config + Custom).
 * Handles server fetching, connection state tracking, and add connection modal.
 */
function ServerSidebar({
  selectedServerId,
  onServerSelect,
}: ServerSidebarProps): React.JSX.Element {
  const [servers, setServers] = useState<Server[]>([]);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch servers on mount
  useEffect(() => {
    async function fetchServers() {
      try {
        const serverList = await window.electronAPI.listServers();
        setServers(serverList);

        // Initialize connection states for all servers
        const states: Record<string, ConnectionState> = {};
        for (const server of serverList) {
          const state = await window.electronAPI.getConnectionState(server.id);
          states[server.id] = state;
        }
        setConnectionStates(states);
      } catch (error) {
        console.error('Failed to fetch servers:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchServers();
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

  const handleConnect = async (serverId: string) => {
    try {
      await window.electronAPI.connect(serverId);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = async (serverId: string) => {
    try {
      await window.electronAPI.disconnect(serverId);
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const handleConnectionAdded = async () => {
    // Refresh server list after adding connection
    try {
      const serverList = await window.electronAPI.listServers();
      setServers(serverList);
    } catch (error) {
      console.error('Failed to refresh servers:', error);
    }
  };

  // Group servers by source
  const sshConfigServers = servers.filter((s) => s.source === 'ssh-config');
  const customServers = servers.filter((s) => s.source === 'custom');

  if (isLoading) {
    return (
      <div className="sidebar">
        <div className="sidebar-loading">Loading servers...</div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Servers</h2>
        <button
          className="sidebar-add-btn"
          onClick={() => setShowAddModal(true)}
          title="Add Connection"
        >
          +
        </button>
      </div>

      <div className="sidebar-content">
        {sshConfigServers.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section__header">From SSH Config</div>
            <div className="sidebar-section__list">
              {sshConfigServers.map((server) => (
                <ServerListItem
                  key={server.id}
                  server={server}
                  state={connectionStates[server.id] || { status: 'idle' }}
                  onConnect={() => handleConnect(server.id)}
                  onDisconnect={() => handleDisconnect(server.id)}
                  isSelected={selectedServerId === server.id}
                  onSelect={() => onServerSelect(server.id)}
                />
              ))}
            </div>
          </div>
        )}

        {customServers.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section__header">Custom Connections</div>
            <div className="sidebar-section__list">
              {customServers.map((server) => (
                <ServerListItem
                  key={server.id}
                  server={server}
                  state={connectionStates[server.id] || { status: 'idle' }}
                  onConnect={() => handleConnect(server.id)}
                  onDisconnect={() => handleDisconnect(server.id)}
                  isSelected={selectedServerId === server.id}
                  onSelect={() => onServerSelect(server.id)}
                />
              ))}
            </div>
          </div>
        )}

        {servers.length === 0 && (
          <div className="sidebar-empty">
            <p>No servers found.</p>
            <p>Add a custom connection or configure ~/.ssh/config</p>
          </div>
        )}
      </div>

      <AddConnectionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onConnectionAdded={handleConnectionAdded}
      />
    </div>
  );
}

export default ServerSidebar;
