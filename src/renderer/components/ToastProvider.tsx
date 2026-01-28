import { Toaster } from 'sonner';

/**
 * Toast notification provider using sonner.
 * Configured for bottom-right positioning with app styling.
 *
 * Position: bottom-right (doesn't overlap sidebar or preview)
 * Expand: false (compact, doesn't take over screen)
 * Rich colors: true (success=green, error=red)
 * Close button: true (allows manual dismissal)
 * Duration: 4000ms default (errors will override to longer)
 */
export function ToastProvider(): React.JSX.Element {
  return (
    <Toaster
      position="bottom-right"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        duration: 4000,
        className: 'app-toast',
      }}
    />
  );
}
