// UI preferences storage using electron-conf
// Persists user UI preferences like column widths and panel sizes

import { Conf } from 'electron-conf/main';

/**
 * Schema for UI preferences storage.
 */
interface UIPreferencesSchema {
  columnWidths: number[];      // Saved column widths by index
  previewPanelWidth: number;   // Preview panel width in pixels
  showHiddenFiles: boolean;    // Whether to show dotfiles/hidden files
}

// Initialize Conf with typed schema
const conf = new Conf<UIPreferencesSchema>({
  name: 'ui-preferences',
  defaults: {
    columnWidths: [],
    previewPanelWidth: 300,
    showHiddenFiles: false,  // Hidden by default (matches macOS Finder behavior)
  },
});

/**
 * Get saved column widths.
 */
export function getColumnWidths(): number[] {
  return conf.get('columnWidths') ?? [];
}

/**
 * Save column widths.
 */
export function setColumnWidths(widths: number[]): void {
  conf.set('columnWidths', widths);
}

/**
 * Get saved preview panel width.
 */
export function getPreviewPanelWidth(): number {
  return conf.get('previewPanelWidth') ?? 300;
}

/**
 * Save preview panel width.
 */
export function setPreviewPanelWidth(width: number): void {
  conf.set('previewPanelWidth', width);
}

/**
 * Get show hidden files preference.
 */
export function getShowHiddenFiles(): boolean {
  return conf.get('showHiddenFiles') ?? false;
}

/**
 * Save show hidden files preference.
 */
export function setShowHiddenFiles(show: boolean): void {
  conf.set('showHiddenFiles', show);
}
