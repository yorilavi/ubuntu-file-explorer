// SSH connection service with promise wrappers
// Manages SSH connections using the ssh2 library

import { Client, type ConnectConfig } from 'ssh2';
import { readFileSync } from 'fs';
import type { Server, ConnectionState } from './types';

// Active SSH connections keyed by server ID
const connections = new Map<string, Client>();

// Connection states keyed by server ID
const connectionStates = new Map<string, ConnectionState>();

// Callback for state changes (to notify renderer)
type StateCallback = (serverId: string, state: ConnectionState) => void;
let stateCallback: StateCallback | null = null;

/**
 * Set the callback for connection state changes.
 * Used to notify the renderer process of state updates.
 */
export function setStateCallback(cb: StateCallback): void {
  stateCallback = cb;
}

/**
 * Update connection state and notify callback if set.
 */
function updateState(serverId: string, state: ConnectionState): void {
  connectionStates.set(serverId, state);
  if (stateCallback) {
    stateCallback(serverId, state);
  }
  console.log(`[ssh-service] State change for ${serverId}:`, state.status);
}

/**
 * Connect to an SSH server.
 *
 * @param server - Server configuration
 * @param password - Optional password for password auth or key passphrase
 * @returns Promise that resolves when connected
 */
export function connectSSH(server: Server, password?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already connected
    const existingClient = connections.get(server.id);
    if (existingClient) {
      console.log(`[ssh-service] Already connected to ${server.id}, disconnecting first`);
      existingClient.end();
      connections.delete(server.id);
    }

    // Update state to resolving
    updateState(server.id, { status: 'resolving' });

    // Build connection config
    const config: ConnectConfig = {
      host: server.host,
      port: server.port,
      username: server.username,
    };

    // Configure authentication method
    switch (server.authMethod) {
      case 'key':
        if (server.keyPath) {
          try {
            config.privateKey = readFileSync(server.keyPath);
            if (password) {
              config.passphrase = password;
            }
          } catch (err) {
            const error = err instanceof Error ? err.message : 'Unknown error';
            updateState(server.id, { status: 'error', message: `Failed to read key file: ${error}` });
            reject(new Error(`Failed to read key file: ${error}`));
            return;
          }
        } else {
          updateState(server.id, { status: 'error', message: 'Key authentication selected but no key path provided' });
          reject(new Error('Key authentication selected but no key path provided'));
          return;
        }
        break;

      case 'agent':
        // Use SSH agent for authentication
        config.agent = process.env.SSH_AUTH_SOCK;
        break;

      case 'password':
        if (password) {
          config.password = password;
        } else {
          updateState(server.id, { status: 'error', message: 'Password authentication selected but no password provided' });
          reject(new Error('Password authentication selected but no password provided'));
          return;
        }
        break;
    }

    // Create SSH client
    const client = new Client();

    // Handle ready event - connection successful
    client.on('ready', () => {
      console.log(`[ssh-service] Connected to ${server.id}`);
      connections.set(server.id, client);
      updateState(server.id, { status: 'ready' });
      resolve();
    });

    // Handle error event
    client.on('error', (err) => {
      console.error(`[ssh-service] Connection error for ${server.id}:`, err.message);
      connections.delete(server.id);
      updateState(server.id, { status: 'error', message: err.message });
      reject(err);
    });

    // Handle close event
    client.on('close', () => {
      console.log(`[ssh-service] Connection closed for ${server.id}`);
      connections.delete(server.id);
      // Only update to idle if not already in error state
      const currentState = connectionStates.get(server.id);
      if (currentState?.status !== 'error') {
        updateState(server.id, { status: 'idle' });
      }
    });

    // Handle end event
    client.on('end', () => {
      console.log(`[ssh-service] Connection ended for ${server.id}`);
    });

    // Update state to authenticating and connect
    updateState(server.id, { status: 'authenticating' });
    client.connect(config);
  });
}

/**
 * Disconnect from an SSH server.
 *
 * @param serverId - The ID of the server to disconnect from
 */
export function disconnectSSH(serverId: string): void {
  const client = connections.get(serverId);
  if (client) {
    console.log(`[ssh-service] Disconnecting from ${serverId}`);
    client.end();
    connections.delete(serverId);
    updateState(serverId, { status: 'idle' });
  }
}

/**
 * Get the SSH client for a connected server.
 *
 * @param serverId - The ID of the server
 * @returns The SSH client if connected, undefined otherwise
 */
export function getConnection(serverId: string): Client | undefined {
  return connections.get(serverId);
}

/**
 * Get the current connection state for a server.
 *
 * @param serverId - The ID of the server
 * @returns The current connection state (defaults to idle)
 */
export function getConnectionState(serverId: string): ConnectionState {
  return connectionStates.get(serverId) || { status: 'idle' };
}
