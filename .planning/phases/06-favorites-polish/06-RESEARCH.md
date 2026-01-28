# Phase 6: Favorites & Polish - Research

**Researched:** 2026-01-28
**Domain:** Favorites persistence, drag-and-drop reordering, toast notifications, operation cancellation
**Confidence:** HIGH

## Summary

This phase implements per-server favorites bookmarking with sidebar organization, polished error handling with toast notifications, and cancellable long-running operations. The existing codebase uses electron-conf for persistence and React with TypeScript.

Research confirms the following standard approach:
1. **Favorites storage**: Extend existing `electron-conf` storage schema to include per-server favorites arrays
2. **Drag-and-drop reordering**: Use `@dnd-kit/sortable` for accessible, performant reordering within the sidebar
3. **Toast notifications**: Use `sonner` for operation feedback (lightweight, TypeScript-first, no hooks required)
4. **Operation cancellation**: Use `AbortController` pattern with stream destruction for SFTP transfers
5. **Collapsible servers**: Use CSS transitions with React state (no library needed - simple pattern)

**Primary recommendation:** Leverage existing electron-conf infrastructure. Add sonner for toast system. Add @dnd-kit/sortable for favorites reordering. Implement AbortController-based cancellation for file operations.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sonner | ^2.0 | Toast notifications | TypeScript-first, no context needed, 5KB gzipped, shadcn/ui default |
| @dnd-kit/core | ^6.0 | Drag-and-drop primitives | Modern React hooks API, accessible, 10KB, excellent performance |
| @dnd-kit/sortable | ^8.0 | Sortable list preset | Built on dnd-kit core, provides useSortable hook and arrayMove |
| electron-conf | 1.3.0 | Data persistence | Already in use; simple typed JSON storage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/utilities | ^3.0 | CSS transform utilities | For applying drag transforms to DOM elements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sonner | react-toastify | react-toastify is more full-featured but heavier (~25KB), requires more setup |
| sonner | react-hot-toast | Similar simplicity but sonner has better TypeScript support and modern defaults |
| @dnd-kit/sortable | react-dnd | react-dnd is more powerful but steeper learning curve; dnd-kit better for this use case |
| @dnd-kit/sortable | pragmatic-drag-and-drop | Newer, smaller bundle but less React-native API |

**Installation:**
```bash
npm install sonner @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   └── storage/
│       ├── connection-store.ts     # Existing - connections
│       ├── credential-store.ts     # Existing - credentials
│       └── favorites-store.ts      # NEW - per-server favorites
├── renderer/
│   ├── components/
│   │   ├── ServerSidebar.tsx       # MODIFY - collapsible servers + favorites
│   │   ├── FavoriteItem.tsx        # NEW - draggable favorite row
│   │   ├── ToastProvider.tsx       # NEW - sonner Toaster setup
│   │   └── ProgressToast.tsx       # NEW - cancellable progress toast
│   ├── hooks/
│   │   └── useFavorites.ts         # NEW - favorites CRUD hook
│   └── context/
│       └── OperationContext.tsx    # NEW - track active operations for cancellation
└── preload/
    └── preload.ts                  # MODIFY - add favorites IPC
```

### Pattern 1: Per-Server Favorites Storage
**What:** Store favorites as an array of paths per server ID in electron-conf
**When to use:** For favorites that should persist between sessions
**Example:**
```typescript
// Source: electron-conf documentation + existing connection-store.ts pattern
interface FavoritesStoreSchema {
  favorites: Record<string, string[]>; // serverId -> array of folder paths
}

const conf = new Conf<FavoritesStoreSchema>({
  defaults: { favorites: {} },
});

export function addFavorite(serverId: string, path: string): void {
  const current = conf.get(`favorites.${serverId}`) ?? [];
  if (!current.includes(path)) {
    conf.set(`favorites.${serverId}`, [...current, path]);
  }
}

export function removeFavorite(serverId: string, path: string): void {
  const current = conf.get(`favorites.${serverId}`) ?? [];
  conf.set(`favorites.${serverId}`, current.filter(p => p !== path));
}

export function reorderFavorites(serverId: string, paths: string[]): void {
  conf.set(`favorites.${serverId}`, paths);
}

export function getFavorites(serverId: string): string[] {
  return conf.get(`favorites.${serverId}`) ?? [];
}
```

### Pattern 2: dnd-kit Sortable Favorites List
**What:** Use dnd-kit sortable preset for drag-to-reorder within a server's favorites
**When to use:** For the favorites list under each server in sidebar
**Example:**
```typescript
// Source: https://docs.dndkit.com/presets/sortable
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableFavoriteItem({ id, path, onRemove, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span onClick={onClick}>{path.split('/').pop()}</span>
      {/* Remove button or drag-out detection */}
    </div>
  );
}
```

### Pattern 3: Sonner Toast with Action Buttons
**What:** Use sonner for operation errors with actionable recovery
**When to use:** Upload/download/delete failures, or progress notifications
**Example:**
```typescript
// Source: https://sonner.emilkowal.ski/
import { toast } from 'sonner';

// Error toast with retry action
toast.error('Upload failed', {
  description: 'Connection timed out',
  action: {
    label: 'Retry',
    onClick: () => retryUpload(),
  },
  duration: 10000, // Persistent for errors
});

// Progress toast with cancel
const toastId = toast.loading('Uploading file.txt...', {
  description: '45% complete',
});

// Update progress
toast.loading('Uploading file.txt...', {
  id: toastId,
  description: '67% complete',
});

// Complete
toast.success('Upload complete', { id: toastId });
```

### Pattern 4: AbortController for File Operations
**What:** Enable cancellation of SFTP transfers via AbortController
**When to use:** Long-running uploads/downloads that user wants to cancel
**Example:**
```typescript
// Source: MDN AbortController, ssh2 streams
let activeController: AbortController | null = null;

async function downloadWithCancel(
  serverId: string,
  remotePath: string,
  localPath: string,
  onProgress: (percent: number) => void,
  signal: AbortSignal
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  const readStream = sftp.createReadStream(remotePath);
  const writeStream = createWriteStream(localPath);

  // Handle abort signal
  signal.addEventListener('abort', () => {
    readStream.destroy();
    writeStream.destroy();
  });

  return new Promise((resolve, reject) => {
    signal.throwIfAborted(); // Check before starting

    readStream.on('data', (chunk) => {
      if (signal.aborted) {
        readStream.destroy();
        writeStream.destroy();
        reject(new DOMException('Download cancelled', 'AbortError'));
        return;
      }
      // ... progress tracking
    });

    writeStream.on('finish', resolve);
    readStream.on('error', reject);
    writeStream.on('error', reject);

    readStream.pipe(writeStream);
  });
}

// In renderer - cancel via Escape or X button
function cancelOperation() {
  if (activeController) {
    activeController.abort();
    toast.info('Operation cancelled');
  }
}
```

### Pattern 5: Collapsible Server Sections
**What:** Simple CSS-based collapse with React state
**When to use:** Server sections in sidebar that expand to show favorites
**Example:**
```typescript
// Source: Standard React pattern
function CollapsibleServer({ server, favorites }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="server-section">
      <button
        className="server-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className={`chevron ${isExpanded ? 'chevron--open' : ''}`}>
          &#9656;
        </span>
        <span>{server.name}</span>
      </button>

      <div
        className="server-content"
        style={{
          height: isExpanded ? 'auto' : 0,
          overflow: 'hidden',
          transition: 'height 0.2s ease-out',
        }}
      >
        {/* Favorites list */}
      </div>
    </div>
  );
}
```

### Pattern 6: Poof Animation for Drag-Out Removal
**What:** CSS keyframe animation when dragging favorite out of sidebar
**When to use:** When user drags a favorite outside the valid drop zone
**Example:**
```css
/* Source: https://codepen.io/carlcamera/pen/KmEPJZ adapted */
@keyframes poof {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.favorite-item--poofing {
  animation: poof 0.3s ease-out forwards;
  pointer-events: none;
}
```

### Anti-Patterns to Avoid
- **Global favorites array**: Don't store all favorites in one flat array. Must be per-server for correct organization.
- **Blocking UI during operations**: Don't block the entire UI. Use toast for progress with background operations.
- **Uncancellable operations**: Don't start long operations without AbortController integration.
- **Missing favorites silently hidden**: Don't hide missing favorites. Show them grayed out so user knows they exist but are unavailable.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom div-based popups | sonner | Handles stacking, animations, accessibility, touch gestures |
| Drag reorder list | mousedown/mousemove handlers | @dnd-kit/sortable | Keyboard accessibility, touch support, collision detection |
| Array reordering | splice operations | arrayMove from @dnd-kit | Immutable, tested, handles edge cases |
| Collapsible animation | Complex height calculations | CSS max-height transition or details/summary | Browser-native, performant |

**Key insight:** Drag-and-drop appears simple but has many edge cases: keyboard accessibility, touch devices, scroll containers, collision detection. dnd-kit handles all these.

## Common Pitfalls

### Pitfall 1: Favorites Pointing to Deleted Folders
**What goes wrong:** User adds favorite, folder is deleted on server, app crashes or shows confusing errors
**Why it happens:** App assumes path always exists
**How to avoid:** Validate favorites on load. Use SFTP stat to check existence. Mark missing as "unavailable" (grayed out).
**Warning signs:** Error when clicking favorite on a path that doesn't exist

### Pitfall 2: Race Condition on Cancellation
**What goes wrong:** User cancels, operation continues, state becomes inconsistent
**Why it happens:** Abort signal not checked frequently enough, or cleanup not complete
**How to avoid:** Check `signal.aborted` at every async checkpoint. Destroy streams immediately on abort. Update UI state immediately when abort requested.
**Warning signs:** Progress toast shows 100% but file is incomplete

### Pitfall 3: Toast Overload
**What goes wrong:** Many operations create many toasts, UI becomes cluttered
**Why it happens:** Each operation spawns its own toast
**How to avoid:** Use single progress toast per operation type. Update existing toast via `id` rather than creating new ones. Auto-dismiss success toasts quickly (2-3s). Keep error toasts longer (8-10s).
**Warning signs:** Multiple overlapping toasts obscuring content

### Pitfall 4: Drag-Out Without Visual Feedback
**What goes wrong:** User drags favorite out, nothing happens, unclear if removed
**Why it happens:** No visual indicator when item leaves valid drop zone
**How to avoid:** Track drag position relative to sidebar bounds. Show "poof" animation when released outside. Confirm removal before actually deleting.
**Warning signs:** Users unsure if drag-out worked

### Pitfall 5: Collapsible State Not Persisted
**What goes wrong:** User collapses servers, refreshes app, all expanded again
**Why it happens:** Only stored in component state
**How to avoid:** Persist collapsed server IDs in electron-conf or localStorage
**Warning signs:** Users repeatedly re-collapse servers

### Pitfall 6: Auto-Connect Loops on Favorite Click
**What goes wrong:** Click favorite on disconnected server, connection fails, retry loops
**Why it happens:** Auto-connect on click without error state check
**How to avoid:** Check connection state before auto-connect. If error state, show reconnect prompt instead of auto-retry. Add cooldown between connection attempts.
**Warning signs:** Rapid connection attempts after clicking favorite

## Code Examples

Verified patterns from official sources:

### Toast Toaster Setup
```typescript
// Source: https://sonner.emilkowal.ski/
// In App.tsx or a ToastProvider wrapper
import { Toaster } from 'sonner';

function App() {
  return (
    <>
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
      {/* Rest of app */}
    </>
  );
}
```

### Cancellable Progress Toast
```typescript
// Source: sonner docs + AbortController MDN
import { toast } from 'sonner';

export function showProgressToast(
  fileName: string,
  onCancel: () => void
): { update: (percent: number) => void; complete: () => void; error: (msg: string) => void } {
  const toastId = toast.loading(`Uploading ${fileName}...`, {
    description: '0%',
    action: {
      label: 'Cancel',
      onClick: onCancel,
    },
    duration: Infinity, // Don't auto-dismiss while in progress
  });

  return {
    update: (percent: number) => {
      toast.loading(`Uploading ${fileName}...`, {
        id: toastId,
        description: `${percent}%`,
        action: {
          label: 'Cancel',
          onClick: onCancel,
        },
      });
    },
    complete: () => {
      toast.success(`${fileName} uploaded`, { id: toastId, duration: 3000 });
    },
    error: (msg: string) => {
      toast.error(`Upload failed: ${fileName}`, {
        id: toastId,
        description: msg,
        action: {
          label: 'Show details',
          onClick: () => {/* Show full error */},
        },
        duration: 8000,
      });
    },
  };
}
```

### dnd-kit Sortable Favorites Complete Example
```typescript
// Source: https://docs.dndkit.com/presets/sortable
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableFavoriteItem } from './SortableFavoriteItem';

interface FavoritesListProps {
  serverId: string;
  favorites: string[];
  onReorder: (serverId: string, newOrder: string[]) => void;
  onNavigate: (path: string) => void;
  onRemove: (path: string) => void;
}

function FavoritesList({ serverId, favorites, onReorder, onNavigate, onRemove }: FavoritesListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = favorites.indexOf(active.id as string);
      const newIndex = favorites.indexOf(over.id as string);
      onReorder(serverId, arrayMove(favorites, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={favorites} strategy={verticalListSortingStrategy}>
        {favorites.map((path) => (
          <SortableFavoriteItem
            key={path}
            id={path}
            path={path}
            onNavigate={() => onNavigate(path)}
            onRemove={() => onRemove(path)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### IPC for Favorites (Main + Preload)
```typescript
// Main process handler (ipc/favorites-handlers.ts)
import { ipcMain } from 'electron';
import * as favoritesStore from '../storage/favorites-store';

export function registerFavoritesHandlers() {
  ipcMain.handle('favorites:get', (_event, serverId: string) => {
    return favoritesStore.getFavorites(serverId);
  });

  ipcMain.handle('favorites:add', (_event, serverId: string, path: string) => {
    favoritesStore.addFavorite(serverId, path);
  });

  ipcMain.handle('favorites:remove', (_event, serverId: string, path: string) => {
    favoritesStore.removeFavorite(serverId, path);
  });

  ipcMain.handle('favorites:reorder', (_event, serverId: string, paths: string[]) => {
    favoritesStore.reorderFavorites(serverId, paths);
  });
}

// Preload addition
getFavorites: (serverId: string): Promise<string[]> =>
  ipcRenderer.invoke('favorites:get', serverId),

addFavorite: (serverId: string, path: string): Promise<void> =>
  ipcRenderer.invoke('favorites:add', serverId, path),

removeFavorite: (serverId: string, path: string): Promise<void> =>
  ipcRenderer.invoke('favorites:remove', serverId, path),

reorderFavorites: (serverId: string, paths: string[]): Promise<void> =>
  ipcRenderer.invoke('favorites:reorder', serverId, paths),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit | 2022 | react-beautiful-dnd deprecated; dnd-kit is maintained |
| Custom toast divs | sonner/react-hot-toast | 2023 | Better accessibility, animations, API |
| Promises without cancellation | AbortController | 2020+ | Now widely supported in all modern APIs |
| electron-store | electron-conf (fork) | 2023 | Lighter weight for Electron-only use |

**Deprecated/outdated:**
- react-beautiful-dnd: No longer maintained, use dnd-kit instead
- Custom toast implementations: Use a library for accessibility compliance

## Open Questions

Things that couldn't be fully resolved:

1. **Stream destruction timing for SFTP cancellation**
   - What we know: Calling `stream.destroy()` stops the transfer
   - What's unclear: Whether ssh2 handles partial file cleanup or if we need to delete incomplete files manually
   - Recommendation: Test with actual transfers; may need to add cleanup logic for partially written files

2. **Escape key conflict with context menus**
   - What we know: Escape should cancel operations; context menus may also use Escape to close
   - What's unclear: Whether both handlers will fire
   - Recommendation: Use event.stopPropagation() in context menu Escape handler; operation cancel should be document-level listener

## Sources

### Primary (HIGH confidence)
- [sonner.emilkowal.ski](https://sonner.emilkowal.ski/) - Official Sonner documentation
- [docs.dndkit.com](https://docs.dndkit.com/presets/sortable) - Official dnd-kit sortable documentation
- [github.com/alex8088/electron-conf](https://github.com/alex8088/electron-conf) - electron-conf repository and types
- [developer.mozilla.org/AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) - AbortController MDN documentation

### Secondary (MEDIUM confidence)
- [Knock blog: Top notification libraries](https://knock.app/blog/the-top-notification-libraries-for-react) - Library comparison
- [LogRocket: Toast libraries compared](https://blog.logrocket.com/react-toast-libraries-compared-2025/) - Feature comparison
- [Puck: Top drag-and-drop libraries](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) - DnD library comparison
- [DEV.to: AbortController in React](https://dev.to/bil/using-abortcontroller-with-react-hooks-and-typescript-to-cancel-window-fetch-requests-1md4) - Implementation patterns

### Tertiary (LOW confidence)
- [CodePen: CSS Poof Animation](https://codepen.io/carlcamera/pen/KmEPJZ) - Animation reference
- [DEV.to: Poof element effect](https://dev.to/alishata128/poof-make-web-elements-disappear-like-magic-with-this-code-technique-33db) - Animation technique

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries verified via official docs and npm downloads
- Architecture: HIGH - Patterns match existing codebase (electron-conf) and React best practices
- Pitfalls: MEDIUM - Based on general knowledge and community articles; specific SFTP cancellation behavior needs testing

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable domain, established libraries)
