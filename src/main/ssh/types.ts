// SSH/SFTP type definitions for the file explorer

/**
 * Represents a server from SSH config or custom connection.
 * This is the unified type used throughout the app for server representation.
 */
export interface Server {
  /** Unique identifier - slugified host for SSH config, UUID for custom */
  id: string;
  /** Display name - Host alias from config or user-provided name */
  name: string;
  /** HostName or IP address */
  host: string;
  /** SSH port (default 22) */
  port: number;
  /** Username for authentication */
  username: string;
  /** Whether this came from ~/.ssh/config or was manually added */
  source: 'ssh-config' | 'custom';
  /** Path to IdentityFile (SSH key) if using key auth */
  keyPath?: string;
  /** Authentication method to use */
  authMethod: 'key' | 'password' | 'agent';
}

/**
 * Custom connection added by user.
 * Stored in electron-conf with passwords in safeStorage.
 */
export interface CustomConnection {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name shown in UI */
  name: string;
  /** HostName or IP address */
  host: string;
  /** SSH port (default 22) */
  port: number;
  /** Username for authentication */
  username: string;
  /** Optional display name (alternative to name) */
  displayName?: string;
  /** Path to IdentityFile (SSH key) if using key auth */
  keyPath?: string;
  /** Authentication method to use */
  authMethod: 'key' | 'password' | 'agent';
}

/**
 * State machine for connection lifecycle.
 * Provides granular status for UI feedback during connection process.
 */
export type ConnectionState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'authenticating' }
  | { status: 'loading-directory' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

/**
 * File/directory entry from SFTP readdir.
 * Contains all metadata needed for file browser display.
 */
export interface FileEntry {
  /** File or directory name */
  name: string;
  /** Full absolute path */
  path: string;
  /** Size in bytes */
  size: number;
  /** Last modification time */
  modified: Date;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Whether this is a symbolic link */
  isSymlink: boolean;
  /** Unix permissions as octal string (e.g., '0755') */
  permissions: string;
  /** Owner user ID */
  uid: number;
  /** Owner group ID */
  gid: number;
  /** Symlink target path (only if isSymlink is true) */
  target?: string;
}

/**
 * Response from directory listing operation.
 * Contains the path and all entries in that directory.
 */
export interface DirectoryListing {
  /** The path that was listed */
  path: string;
  /** Array of file/directory entries */
  entries: FileEntry[];
}
