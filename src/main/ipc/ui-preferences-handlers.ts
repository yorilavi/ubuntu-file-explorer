// IPC handlers for UI preferences
// Bridges renderer process to ui-preferences store

import { ipcMain } from 'electron';
import {
  getColumnWidths,
  setColumnWidths,
  getPreviewPanelWidth,
  setPreviewPanelWidth,
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

  console.log('[ui-preferences-handlers] Registered UI preferences IPC handlers');
}
