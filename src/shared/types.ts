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
