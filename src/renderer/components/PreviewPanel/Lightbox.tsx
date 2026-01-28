// Lightbox component for enlarged image view
// Uses yet-another-react-lightbox with zoom plugin

import React, { useEffect, useCallback } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

interface LightboxViewProps {
  src: string;           // Image data URL
  open: boolean;
  onClose: () => void;
}

/**
 * Lightbox wrapper for enlarged image viewing.
 * Supports zoom, pan, and keyboard controls.
 *
 * Features:
 * - Zoom via click, scroll wheel, pinch gestures
 * - Pan when zoomed in
 * - Close on backdrop click or Escape key
 * - Single image mode (no prev/next navigation)
 */
function LightboxView({ src, open, onClose }: LightboxViewProps): React.JSX.Element | null {
  // Listen for open-lightbox custom event (triggered by spacebar)
  const handleOpenLightbox = useCallback(() => {
    // The event is dispatched when we should open, but we're already handling
    // the open state via props. This hook is for the PreviewPanel to trigger.
  }, []);

  useEffect(() => {
    window.addEventListener('open-lightbox', handleOpenLightbox);
    return () => window.removeEventListener('open-lightbox', handleOpenLightbox);
  }, [handleOpenLightbox]);

  if (!open) return null;

  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={[{ src }]}
      plugins={[Zoom]}
      render={{
        buttonPrev: () => null,  // Single image, no prev/next
        buttonNext: () => null,
      }}
      zoom={{
        maxZoomPixelRatio: 3,
        zoomInMultiplier: 2,
        doubleTapDelay: 300,
        doubleClickMaxStops: 2,
        keyboardMoveDistance: 50,
        wheelZoomDistanceFactor: 100,
        scrollToZoom: true,
      }}
      carousel={{
        finite: true,
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      styles={{
        container: { backgroundColor: 'rgba(0, 0, 0, 0.9)' },
      }}
    />
  );
}

export default LightboxView;
