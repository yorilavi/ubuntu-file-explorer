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

// Preview Types
// =============

/**
 * Supported preview types.
 */
export type PreviewType = 'image' | 'code' | 'folder' | 'binary' | 'too-large' | 'error' | 'loading';

/**
 * Image metadata from EXIF.
 */
export interface ImageMetadata {
  width?: number;
  height?: number;
  camera?: string;
  dateTaken?: Date;
  gps?: { latitude: number; longitude: number };
}

/**
 * Preview data returned from IPC.
 */
export type PreviewData =
  | { type: 'image'; dataUrl: string; metadata: ImageMetadata; fileSize: number; mimeType: string }
  | { type: 'code'; content: string; language: string; lineCount: number; truncated: boolean }
  | { type: 'folder'; name: string; itemCount: number; totalSize: number }
  | { type: 'binary'; name: string; fileSize: number; mimeType: string }
  | { type: 'pdf'; dataUrl: string; pageCount: number; fileSize: number; isLarge: boolean }
  | { type: 'too-large'; name: string; fileSize: number }
  | { type: 'error'; message: string }
  | { type: 'loading'; progress: number };

/**
 * File type detection result.
 */
export interface FileTypeInfo {
  category: 'image' | 'code' | 'text' | 'binary' | 'pdf';
  language?: string;  // For code files
  mimeType: string;
}

// File Operations Types
// =====================

/**
 * Progress update during file transfer.
 */
export interface TransferProgress {
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

/**
 * Result of a file operation.
 */
export interface FileOperationResult {
  success: boolean;
  path?: string;      // New path for rename/move, or local path for download
  error?: string;
}

// Streaming Code Preview Types
// ============================

/**
 * Data sent for each chunk of a large code file.
 * Used for progressive loading of files > 500 lines.
 */
export interface CodeChunkData {
  filePath: string;      // Full remote path of the file
  chunk: string;         // Text content of this chunk
  chunkIndex: number;    // 0-indexed chunk number
  isInitial: boolean;    // True for the first chunk
  isComplete: boolean;   // True for the final chunk
  totalSize: number;     // Total file size in bytes
  language: string;      // Syntax highlighting language
}

// Folder Upload Types
// ===================

/**
 * Progress update during folder upload.
 */
export interface FolderUploadProgress {
  /** Total number of files to upload */
  totalFiles: number;
  /** Number of files completed (success or fail) */
  completedFiles: number;
  /** Current file being uploaded */
  currentFile: string;
  /** Overall percentage (0-100) */
  percent: number;
  /** Files that failed with error messages */
  failedFiles: Array<{ path: string; error: string }>;
}

/**
 * Result of a folder upload operation.
 */
export interface FolderUploadResult {
  success: boolean;
  /** Total files uploaded successfully */
  uploadedCount?: number;
  /** Files that failed */
  failedFiles?: Array<{ path: string; error: string }>;
  /** Operation ID for cancellation */
  operationId?: string;
  /** Whether operation was cancelled */
  cancelled?: boolean;
  /** Error message if complete failure */
  error?: string;
}

// Folder Download Types
// =====================

/**
 * Conflict resolution strategy for downloads.
 */
export type ConflictStrategy = 'rename' | 'overwrite' | 'skip';

/**
 * Progress update during folder download.
 */
export interface FolderDownloadProgress {
  /** Total number of files to download */
  totalFiles: number;
  /** Number of files completed (success or fail) */
  completedFiles: number;
  /** Current file being downloaded */
  currentFile: string;
  /** Overall percentage (0-100) */
  percent: number;
  /** Total bytes to download */
  totalBytes: number;
  /** Bytes downloaded so far */
  downloadedBytes: number;
  /** Files that failed with error messages */
  failedFiles: Array<{ path: string; error: string }>;
}

/**
 * Result of a folder download operation.
 */
export interface FolderDownloadResult {
  success: boolean;
  /** Total files downloaded successfully */
  downloadedCount?: number;
  /** Files that failed */
  failedFiles?: Array<{ path: string; error: string }>;
  /** Operation ID for cancellation */
  operationId?: string;
  /** Whether operation was cancelled */
  cancelled?: boolean;
  /** Error message if complete failure */
  error?: string;
  /** Local path where folder was downloaded */
  localPath?: string;
}
