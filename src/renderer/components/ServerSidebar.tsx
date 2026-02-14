import React, { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Server, ConnectionState } from '../../shared/types';
import ServerListItem from './ServerListItem';
import AddConnectionModal from './AddConnectionModal';
import { useFavorites } from '../hooks/useFavorites';
import { FavoriteItem } from './FavoriteItem';

interface ServerSidebarProps {
  selectedServerId: string | null;
  onServerSelect: (serverId: string) => void;
  onFavoriteNavigate: (serverId: string, path: string) => void;
  onRefreshFavorites?: (refreshFn: () => Promise<void>) => void;
  onHelpClick?: () => void;
}

/**
 * Server sidebar with collapsible server sections and favorites.
 * Handles server fetching, connection state tracking, favorites display,
 * and drag-to-reorder favorites.
 */
function ServerSidebar({
  selectedServerId,
  onServerSelect,
  onFavoriteNavigate,
  onRefreshFavorites,
  onHelpClick,
}: ServerSidebarProps): React.JSX.Element {
  const [servers, setServers] = useState<Server[]>([]);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [collapsedServers, setCollapsedServers] = useState<Set<string>>(new Set());

  // Load favorites for selected server
  const { favorites, reorderFavorites, removeFavorite, refresh: refreshFavorites } = useFavorites(selectedServerId);

  // Expose refresh function to parent for external favorite adds
  useEffect(() => {
    if (onRefreshFavorites) {
      onRefreshFavorites(refreshFavorites);
    }
  }, [onRefreshFavorites, refreshFavorites]);

  // DnD sensors with activation constraint to allow clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  const handleDelete = async (serverId: string) => {
    try {
      await window.electronAPI.removeConnection(serverId);
      // Refresh server list after deletion
      const serverList = await window.electronAPI.listServers();
      setServers(serverList);
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  const toggleCollapse = (serverId: string) => {
    setCollapsedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = favorites.indexOf(active.id as string);
      const newIndex = favorites.indexOf(over.id as string);
      reorderFavorites(arrayMove(favorites, oldIndex, newIndex));
    }
  };

  const handleFavoriteNavigate = (path: string) => {
    if (selectedServerId) {
      onFavoriteNavigate(selectedServerId, path);
    }
  };

  // Group servers by source
  const sshConfigServers = servers.filter((s) => s.source === 'ssh-config');
  const customServers = servers.filter((s) => s.source === 'custom');

  // Render a collapsible server section with optional favorites
  const renderServerSection = (server: Server, showDelete: boolean) => {
    const state = connectionStates[server.id] || { status: 'idle' };
    const isConnected = state.status === 'ready';
    const isCollapsed = collapsedServers.has(server.id);
    const isSelected = selectedServerId === server.id;
    const showFavorites = isSelected && isConnected;

    return (
      <div key={server.id} className="sidebar-server">
        <div className="sidebar-server__item-row">
          <button
            className={`sidebar-server__chevron ${!isCollapsed ? 'sidebar-server__chevron--open' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleCollapse(server.id); }}
            data-tooltip={isCollapsed ? 'Expand favorites' : 'Collapse favorites'}
            data-tooltip-pos="right"
          >
            ▶
          </button>
          <ServerListItem
            server={server}
            state={state}
            onConnect={() => handleConnect(server.id)}
            onDisconnect={() => handleDisconnect(server.id)}
            isSelected={isSelected}
            onSelect={() => onServerSelect(server.id)}
            onDelete={showDelete ? () => handleDelete(server.id) : undefined}
          />
        </div>

        {showFavorites && (
          <div className={`sidebar-server__content ${isCollapsed ? 'sidebar-server__content--collapsed' : ''}`}>
            <div className="favorites-list">
              {favorites.length === 0 ? (
                <div className="favorites-list__empty">No favorites</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={favorites}
                    strategy={verticalListSortingStrategy}
                  >
                    {favorites.map((path) => (
                      <FavoriteItem
                        key={path}
                        id={path}
                        path={path}
                        onNavigate={() => handleFavoriteNavigate(path)}
                        onRemove={() => removeFavorite(path)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
        <div className="sidebar-header__actions">
          <button
            className="sidebar-help-btn"
            onClick={onHelpClick}
            data-tooltip="Help (Cmd+/)"
          >
            ?
          </button>
          <button
            className="sidebar-add-btn"
            onClick={() => setShowAddModal(true)}
            data-tooltip="Add Connection"
          >
            +
          </button>
        </div>
      </div>

      <div className="sidebar-content">
        {sshConfigServers.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section__header">From SSH Config</div>
            <div className="sidebar-section__list">
              {sshConfigServers.map((server) => renderServerSection(server, false))}
            </div>
          </div>
        )}

        {customServers.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section__header">Custom Connections</div>
            <div className="sidebar-section__list">
              {customServers.map((server) => renderServerSection(server, true))}
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
