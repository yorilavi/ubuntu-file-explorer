// Shared TypeScript types for IPC communication
// Extended in Plan 02 with ElectronAPI types

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
