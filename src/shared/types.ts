// Shared TypeScript types for IPC communication

// Import the ElectronAPI type from preload
// Note: This is a type-only import, works because preload is bundled separately
import type { ElectronAPI } from '../preload/preload';

// Extend the global Window interface to include electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Generic IPC response wrapper for future use
export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Re-export for convenience
export type { ElectronAPI };

// SSH Types for renderer use
// ==========================
// These duplicate the types from main/ssh/types.ts for renderer access.
// Due to Vite's bundling, renderer cannot import directly from main process files.

/**
 * Represents a server from SSH config or custom connection.
 */
export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  source: 'ssh-config' | 'custom';
  keyPath?: string;
  authMethod: 'key' | 'password' | 'agent';
}

/**
 * Custom connection added by user.
 */
export interface CustomConnection {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  displayName?: string;
  keyPath?: string;
  authMethod: 'key' | 'password' | 'agent';
}

/**
 * File/directory entry from SFTP.
 */
export interface FileEntry {
  name: string;
  path: string;
  size: number;
  modified: Date;
  isDirectory: boolean;
  isSymlink: boolean;
  permissions: string;
  uid: number;
  gid: number;
  target?: string;
}

/**
 * Response from directory listing.
 */
export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

/**
 * Connection state machine.
 */
export type ConnectionState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'authenticating' }
  | { status: 'loading-directory' }
  | { status: 'ready' }
  | { status: 'error'; message: string };
