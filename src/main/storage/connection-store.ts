// Connection storage using electron-conf
// Persists custom (user-added) SSH connections

import { Conf } from 'electron-conf/main';
import { randomUUID } from 'crypto';
import type { CustomConnection } from '../ssh/types';

/**
 * Stored connection data (without source field).
 * Source is always 'custom' for stored connections.
 */
interface StoredConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  displayName?: string;
  keyPath?: string;
  authMethod: 'key' | 'password' | 'agent';
}

/**
 * Schema for electron-conf storage.
 */
interface ConnectionStoreSchema {
  connections: Record<string, StoredConnection>;
}

// Initialize Conf with typed schema
const conf = new Conf<ConnectionStoreSchema>({
  defaults: {
    connections: {},
  },
});

/**
 * Generate a new unique ID for a connection.
 */
export function generateConnectionId(): string {
  return randomUUID();
}

/**
 * Save a custom connection to storage.
 * If the connection has no ID, one will be generated.
 *
 * @param connection - The connection to save
 * @returns The saved connection (with ID populated if it was generated)
 */
export function saveConnection(connection: CustomConnection): CustomConnection {
  const id = connection.id || generateConnectionId();

  const stored: StoredConnection = {
    id,
    name: connection.name,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    displayName: connection.displayName,
    keyPath: connection.keyPath,
    authMethod: connection.authMethod,
  };

  conf.set(`connections.${id}`, stored);
  console.log(`[connection-store] Saved connection: ${id}`);

  return { ...stored };
}

/**
 * Get a single connection by ID.
 *
 * @param id - The connection ID
 * @returns The connection if found, undefined otherwise
 */
export function getConnection(id: string): CustomConnection | undefined {
  const stored = conf.get(`connections.${id}`) as StoredConnection | undefined;

  if (!stored) {
    return undefined;
  }

  return { ...stored };
}

/**
 * Get all saved custom connections.
 *
 * @returns Array of all custom connections
 */
export function getAllConnections(): CustomConnection[] {
  const connections = conf.get('connections') ?? {};

  return Object.values(connections).map((stored) => ({
    ...stored,
  }));
}

/**
 * Delete a connection by ID.
 *
 * @param id - The connection ID to delete
 * @returns true if deleted, false if not found
 */
export function deleteConnection(id: string): boolean {
  const existing = conf.get(`connections.${id}`);

  if (!existing) {
    return false;
  }

  // Get all connections and remove the one with the given ID
  const connections = conf.get('connections') ?? {};
  delete connections[id];
  conf.set('connections', connections);

  console.log(`[connection-store] Deleted connection: ${id}`);
  return true;
}
