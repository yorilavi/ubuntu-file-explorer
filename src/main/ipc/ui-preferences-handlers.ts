// IPC handlers for UI preferences
// Bridges renderer process to ui-preferences store

import { ipcMain } from 'electron';
import {
  getColumnWidths,
  setColumnWidths,
  getPreviewPanelWidth,
  setPreviewPanelWidth,
  getShowHiddenFiles,
  setShowHiddenFiles,
  getViewMode,
  setViewMode,
} from '../storage/ui-preferences-store';

/**
 * Register IPC handlers for UI preferences.
 */
export function registerUIPreferencesHandlers(): void {
  /**
   * Get saved column widths.
   */
  ipcMain.handle('ui:getColumnWidths', async (): Promise<number[]> => {
    return getColumnWidths();
  });

  /**
   * Save column widths.
   */
  ipcMain.handle('ui:setColumnWidths', async (_event, widths: number[]): Promise<void> => {
    setColumnWidths(widths);
  });

  /**
   * Get saved preview panel width.
   */
  ipcMain.handle('ui:getPreviewPanelWidth', async (): Promise<number> => {
    return getPreviewPanelWidth();
  });

  /**
   * Save preview panel width.
   */
  ipcMain.handle('ui:setPreviewPanelWidth', async (_event, width: number): Promise<void> => {
    setPreviewPanelWidth(width);
  });

  /**
   * Get show hidden files preference.
   */
  ipcMain.handle('ui:getShowHiddenFiles', async (): Promise<boolean> => {
    return getShowHiddenFiles();
  });

  /**
   * Save show hidden files preference.
   */
  ipcMain.handle('ui:setShowHiddenFiles', async (_event, show: boolean): Promise<void> => {
    setShowHiddenFiles(show);
  });

  /**
   * Get view mode preference.
   */
  ipcMain.handle('ui:getViewMode', async (): Promise<string> => {
    return getViewMode();
  });

  /**
   * Save view mode preference.
   */
  ipcMain.handle('ui:setViewMode', async (_event, mode: string): Promise<void> => {
    setViewMode(mode as 'columns' | 'list');
  });

  console.log('[ui-preferences-handlers] Registered UI preferences IPC handlers');
}
