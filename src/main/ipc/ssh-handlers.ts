// IPC handlers for SSH operations
// Bridges SSH services with renderer process via IPC

import { ipcMain, BrowserWindow } from 'electron';
import { getSSHConfigServers } from '../ssh/config-parser';
import { getAllConnections, saveConnection, deleteConnection, getConnection as getStoredConnection } from '../storage/connection-store';
import { saveCredential, getCredential, deleteCredential, hasCredential } from '../storage/credential-store';
import { connectSSH, disconnectSSH, getConnectionState, setStateCallback } from '../ssh/ssh-service';
import { listDirectory, clearSFTPCache } from '../ssh/sftp-service';
import type { Server, CustomConnection, DirectoryListing, ConnectionState } from '../ssh/types';

/**
 * Convert a CustomConnection to a Server for use with ssh-service.
 */
function customToServer(custom: CustomConnection): Server {
  return {
    id: custom.id,
    name: custom.displayName || custom.name,
    host: custom.host,
    port: custom.port,
    username: custom.username,
    source: 'custom',
    keyPath: custom.keyPath,
    authMethod: custom.authMethod,
  };
}

/**
 * Find a server by ID from the combined list of SSH config and custom connections.
 */
function findServer(serverId: string): Server | undefined {
  // Check SSH config servers first
  const sshConfigServers = getSSHConfigServers();
  const fromConfig = sshConfigServers.find((s) => s.id === serverId);
  if (fromConfig) {
    return fromConfig;
  }

  // Check custom connections
  const customConnection = getStoredConnection(serverId);
  if (customConnection) {
    return customToServer(customConnection);
  }

  return undefined;
}

/**
 * Register all SSH-related IPC handlers.
 *
 * @param mainWindow - The main browser window (for sending state updates)
 */
export function registerSSHHandlers(mainWindow: BrowserWindow): void {
  console.log('[ssh-handlers] Registering SSH IPC handlers');

  // Set up state callback to send updates to renderer
  setStateCallback((serverId: string, state: ConnectionState) => {
    mainWindow.webContents.send('ssh:state-change', serverId, state);
  });

  /**
   * List all available servers (SSH config + custom connections).
   */
  ipcMain.handle('ssh:list-servers', async (): Promise<Server[]> => {
    console.log('[ssh-handlers] Listing servers');

    // Get servers from SSH config
    const sshConfigServers = getSSHConfigServers();

    // Get custom connections and convert to Server type
    const customConnections = getAllConnections();
    const customServers: Server[] = customConnections.map(customToServer);

    // Combine lists
    return [...sshConfigServers, ...customServers];
  });

  /**
   * Add a new custom connection.
   */
  ipcMain.handle(
    'ssh:add-connection',
    async (
      _event,
      connection: Omit<CustomConnection, 'id'>,
      password?: string
    ): Promise<{ success: boolean; id?: string; error?: string }> => {
      try {
        console.log('[ssh-handlers] Adding connection:', connection.name);

        // Save the connection (generates ID if not provided)
        const saved = saveConnection(connection as CustomConnection);

        // If password provided and authMethod is password, save credential
        if (password && connection.authMethod === 'password') {
          saveCredential(saved.id, password);
        }

        return { success: true, id: saved.id };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        console.error('[ssh-handlers] Failed to add connection:', error);
        return { success: false, error };
      }
    }
  );

  /**
   * Remove a custom connection.
   */
  ipcMain.handle('ssh:remove-connection', async (_event, id: string): Promise<void> => {
    console.log('[ssh-handlers] Removing connection:', id);

    // Delete connection and credential
    deleteConnection(id);
    deleteCredential(id);

    // Also disconnect if connected
    disconnectSSH(id);
    clearSFTPCache(id);
  });

  /**
   * Check if a stored credential exists for a connection.
   */
  ipcMain.handle('ssh:has-credential', async (_event, connectionId: string): Promise<boolean> => {
    console.log('[ssh-handlers] Checking credential for:', connectionId);
    return hasCredential(connectionId);
  });

  /**
   * Clear (delete) a stored credential without deleting the connection.
   */
  ipcMain.handle('ssh:clear-credential', async (_event, connectionId: string): Promise<void> => {
    console.log('[ssh-handlers] Clearing credential for:', connectionId);
    deleteCredential(connectionId);
  });

  /**
   * Connect to a server.
   */
  ipcMain.handle(
    'ssh:connect',
    async (_event, serverId: string, password?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        console.log('[ssh-handlers] Connecting to:', serverId);

        // Find the server
        const server = findServer(serverId);
        if (!server) {
          return { success: false, error: `Server not found: ${serverId}` };
        }

        // For password auth without password param, try to get stored credential
        let actualPassword = password;
        if (server.authMethod === 'password' && !actualPassword) {
          actualPassword = getCredential(serverId);
        }

        // Connect
        await connectSSH(server, actualPassword);

        return { success: true };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        console.error('[ssh-handlers] Connection failed:', error);
        return { success: false, error };
      }
    }
  );

  /**
   * Disconnect from a server.
   */
  ipcMain.handle('ssh:disconnect', async (_event, serverId: string): Promise<void> => {
    console.log('[ssh-handlers] Disconnecting from:', serverId);
    disconnectSSH(serverId);
    clearSFTPCache(serverId);
  });

  /**
   * List directory contents on a connected server.
   */
  ipcMain.handle(
    'ssh:list-directory',
    async (_event, serverId: string, path: string): Promise<DirectoryListing> => {
      console.log('[ssh-handlers] Listing directory:', serverId, path);
      return listDirectory(serverId, path);
    }
  );

  /**
   * Get the current connection state for a server.
   */
  ipcMain.handle(
    'ssh:get-connection-state',
    async (_event, serverId: string): Promise<ConnectionState> => {
      return getConnectionState(serverId);
    }
  );

  console.log('[ssh-handlers] SSH IPC handlers registered');
}
