// Lightbox component for enlarged image and markdown view
// Uses yet-another-react-lightbox with zoom plugin and custom slide types

import React, { useEffect, useCallback, useMemo } from 'react';
import Lightbox, { Slide } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { MarkdownSlide } from './MarkdownSlide';

// Slide types for the lightbox
export interface LightboxSlide {
  type: 'image' | 'markdown';
  src?: string;           // For image slides
  content?: string;       // For markdown slides
  filename?: string;      // For markdown header
  basePath?: string;      // For markdown relative links
}

// Props interface supporting both legacy single-image and new slides array
interface LightboxViewProps {
  // Legacy single-image props (for backward compatibility)
  src?: string;

  // New slides array props
  slides?: LightboxSlide[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  onNavigate?: (path: string) => void;

  // Position indicator props (for previewable files navigation)
  totalPreviewable?: number;  // Total previewable files in directory
  currentPreviewPosition?: number;  // Current position (1-based for display)

  // Common props
  open: boolean;
  onClose: () => void;
}

// Extended slide type that includes our custom markdown properties
interface ExtendedSlide extends Slide {
  customType?: 'markdown';
  content?: string;
  filename?: string;
  basePath?: string;
}

/**
 * Lightbox wrapper for enlarged image viewing and markdown preview.
 * Supports zoom, pan, and keyboard controls for images.
 * Supports scrollable content for markdown files.
 *
 * Features:
 * - Image slides: Zoom via click, scroll wheel, pinch gestures
 * - Markdown slides: Scrollable content with GFM rendering
 * - Navigation between slides with arrow keys/buttons
 * - Close on backdrop click or Escape key
 *
 * Usage (legacy single image):
 *   <LightboxView src={imageDataUrl} open={open} onClose={onClose} />
 *
 * Usage (slides array):
 *   <LightboxView
 *     slides={[{ type: 'image', src: '...' }, { type: 'markdown', content: '...', filename: 'README.md', basePath: '/path' }]}
 *     currentIndex={0}
 *     open={open}
 *     onClose={onClose}
 *     onIndexChange={setIndex}
 *     onNavigate={handleNavigate}
 *   />
 */
function LightboxView({
  src,
  slides,
  currentIndex = 0,
  open,
  onClose,
  onNavigate,
  onIndexChange,
  totalPreviewable,
  currentPreviewPosition,
}: LightboxViewProps): React.JSX.Element | null {
  // Listen for open-lightbox custom event (triggered by spacebar)
  const handleOpenLightbox = useCallback(() => {
    // The event is dispatched when we should open, but we're already handling
    // the open state via props. This hook is for the PreviewPanel to trigger.
  }, []);

  useEffect(() => {
    window.addEventListener('open-lightbox', handleOpenLightbox);
    return () => window.removeEventListener('open-lightbox', handleOpenLightbox);
  }, [handleOpenLightbox]);

  // Convert slides to yet-another-react-lightbox format
  // Support both legacy single-image (src prop) and new slides array
  const lightboxSlides: ExtendedSlide[] = useMemo(() => {
    // Legacy mode: single image from src prop
    if (src && !slides) {
      return [{ src }];
    }

    // New mode: slides array
    if (slides && slides.length > 0) {
      return slides.map((slide): ExtendedSlide => {
        if (slide.type === 'image') {
          return { src: slide.src || '' };
        }
        // For markdown slides, we use custom properties that we'll handle in render.slide
        return {
          src: '',  // Required by the library but unused for markdown
          customType: 'markdown',
          content: slide.content,
          filename: slide.filename,
          basePath: slide.basePath,
        };
      });
    }

    return [];
  }, [src, slides]);

  // Determine if we should show navigation buttons
  const showNavigation = lightboxSlides.length > 1;

  // Position indicator - show when total > 1
  const showPositionIndicator = totalPreviewable && totalPreviewable > 1 && currentPreviewPosition;

  if (!open || lightboxSlides.length === 0) return null;

  return (
    <>
      <Lightbox
        open={open}
        close={onClose}
        slides={lightboxSlides}
        index={currentIndex}
        on={{
          view: ({ index }) => {
            if (onIndexChange && index !== currentIndex) {
              onIndexChange(index);
            }
          },
        }}
        plugins={[Zoom]}
        render={{
          slide: ({ slide }) => {
            // Handle custom markdown slides
            const extendedSlide = slide as ExtendedSlide;
            if (extendedSlide.customType === 'markdown') {
              return (
                <MarkdownSlide
                  content={extendedSlide.content || ''}
                  filename={extendedSlide.filename || 'Markdown'}
                  basePath={extendedSlide.basePath || '/'}
                  onNavigate={onNavigate}
                />
              );
            }
            // Return undefined for default image rendering
            return undefined;
          },
          // Show prev/next buttons only when multiple slides
          buttonPrev: showNavigation ? undefined : () => null,
          buttonNext: showNavigation ? undefined : () => null,
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
      {/* Position indicator - displayed outside lightbox at bottom center */}
      {showPositionIndicator && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 500,
            zIndex: 10001,  // Above lightbox
            pointerEvents: 'none',
          }}
        >
          {currentPreviewPosition} of {totalPreviewable}
        </div>
      )}
    </>
  );
}

export default LightboxView;
