// Hook for debounced preview loading
// Handles selection changes, progress tracking, and abort on navigation

import { useEffect, useRef, useState } from 'react';
import type { FileEntry, PreviewData } from '../../shared/types';

interface UsePreviewOptions {
  debounceMs?: number;  // Default 150ms per CONTEXT.md
}

interface UsePreviewResult {
  preview: PreviewData | null;
  loading: boolean;
  progress: number;
}

/**
 * Hook for loading file previews with debouncing.
 * Prevents thrashing during rapid keyboard navigation.
 */
export function usePreview(
  serverId: string | null,
  selectedFile: FileEntry | null,
  options: UsePreviewOptions = {}
): UsePreviewResult {
  const { debounceMs = 150 } = options;

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Track current request to ignore stale responses
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.onPreviewProgress(
      (filePath: string, percent: number) => {
        // Only update if this is the file we're loading
        if (selectedFile?.path === filePath) {
          setProgress(percent);
        }
      }
    );

    return () => unsubscribe();
  }, [selectedFile?.path]);

  // Load preview for selected file
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Reset state if no selection or not connected
    if (!serverId || !selectedFile) {
      setPreview(null);
      setLoading(false);
      setProgress(0);
      return;
    }

    // Handle folder selection immediately (no debounce needed)
    if (selectedFile.isDirectory) {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setProgress(0);

      window.electronAPI
        .getFolderInfo(serverId, selectedFile.path, selectedFile.name)
        .then((data) => {
          // Ignore if a newer request was made
          if (requestId === requestIdRef.current) {
            setPreview(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (requestId === requestIdRef.current) {
            setPreview({ type: 'error', message: err.message });
            setLoading(false);
          }
        });

      return;
    }

    // Debounce file preview loading
    timeoutRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setProgress(0);

      window.electronAPI
        .readFilePreview(
          serverId,
          selectedFile.path,
          selectedFile.name,
          selectedFile.size
        )
        .then((data) => {
          // Ignore if a newer request was made
          if (requestId === requestIdRef.current) {
            setPreview(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (requestId === requestIdRef.current) {
            setPreview({ type: 'error', message: err.message });
            setLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [serverId, selectedFile?.path, selectedFile?.isDirectory, selectedFile?.name, selectedFile?.size, debounceMs]);

  return { preview, loading, progress };
}
