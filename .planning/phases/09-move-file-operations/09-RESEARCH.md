# Phase 9: Move File Operations - Research

**Researched:** 2026-01-29
**Domain:** Remote folder picker UI, SFTP move operations, toast undo patterns
**Confidence:** HIGH

## Summary

This phase implements a "Move to..." feature allowing users to relocate files within the same remote server using a visual folder picker modal. The existing codebase already has the backend infrastructure in place - `moveRemoteFile()` in `file-operations-service.ts` and `file-ops:move` IPC handler are fully implemented using SFTP rename. The core work is building a **RemoteFolderPicker** modal component that browses the server's folder hierarchy.

The standard approach is to build a custom recursive tree component (no external library needed for this scope) that reuses the existing `listDirectory` IPC. The modal should show folders only, support keyboard navigation (arrow keys, Enter, Escape), include breadcrumb navigation, and integrate with the existing toast system for undo functionality. Name conflict handling requires checking if a file exists at destination before moving.

**Primary recommendation:** Build a `RemoteFolderPicker` modal component with a single-column expandable tree, leveraging existing IPC/SFTP infrastructure and the sonner toast library for undo actions.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sonner | ^2.0.7 | Toast notifications with undo action | Already used, supports action buttons |
| react | ^19.2.4 | UI components | Project standard |
| ssh2 | ^1.17.0 | SFTP operations | Already handles all file operations |

### Supporting (Already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dom | ^19.2.4 | createPortal for modal | Render modal above app |

### No Additional Libraries Needed
| Instead of | Don't Use | Reason |
|------------|-----------|--------|
| react-folder-tree | Custom component | Simple recursive tree is ~100 lines; library adds complexity for remote async loading |
| react-arborist | Custom component | Overkill for folders-only picker; designed for local filesystem |
| MUI Tree View | Custom component | Would require adding entire MUI dependency |

**Installation:**
```bash
# No new packages needed - all infrastructure exists
```

## Architecture Patterns

### Recommended Component Structure
```
src/renderer/components/
  RemoteFolderPicker/
    RemoteFolderPicker.tsx    # Main modal component
    FolderTree.tsx            # Recursive tree with expand/collapse
    FolderTreeItem.tsx        # Single folder row with icon, name, expand arrow
    RemoteFolderPicker.css    # Styles following existing BEM patterns
    index.ts                  # Export
```

### Pattern 1: Recursive Tree Component
**What:** Self-referencing component that renders children of the same type
**When to use:** Hierarchical folder structures with unknown depth
**Example:**
```typescript
// Source: Codebase pattern extrapolation from existing FileItem.tsx
interface FolderTreeItemProps {
  folder: FileEntry;
  serverId: string;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  showHiddenFiles: boolean;
  onToggleExpand: (path: string) => void;
  onSelect: (path: string) => void;
}

function FolderTreeItem({ folder, serverId, depth, isExpanded, isSelected, showHiddenFiles, onToggleExpand, onSelect }: FolderTreeItemProps) {
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Lazy load children when expanded
  useEffect(() => {
    if (isExpanded && children.length === 0) {
      setIsLoading(true);
      window.electronAPI.listDirectory(serverId, folder.path)
        .then(result => {
          const folders = result.entries.filter(e => e.isDirectory);
          const filtered = showHiddenFiles ? folders : folders.filter(f => !f.name.startsWith('.'));
          setChildren(filtered);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isExpanded, serverId, folder.path, showHiddenFiles]);

  return (
    <div>
      <div
        className={`folder-tree-item ${isSelected ? 'folder-tree-item--selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(folder.path)}
      >
        <button onClick={(e) => { e.stopPropagation(); onToggleExpand(folder.path); }}>
          {isExpanded ? 'v' : '>'}
        </button>
        <span className="folder-icon" />
        <span>{folder.name}</span>
      </div>
      {isExpanded && (
        <div>
          {isLoading && <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>Loading...</div>}
          {children.map(child => (
            <FolderTreeItem
              key={child.path}
              folder={child}
              serverId={serverId}
              depth={depth + 1}
              isExpanded={false}
              isSelected={false}
              showHiddenFiles={showHiddenFiles}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Pattern 2: Toast with Undo Action
**What:** Show success toast with inline undo button that reverses the operation
**When to use:** Destructive or significant operations like move/delete
**Example:**
```typescript
// Source: sonner documentation (https://sonner.emilkowal.ski/toast)
import { toast } from 'sonner';

async function handleMoveConfirm(sourcePath: string, destDir: string) {
  const fileName = sourcePath.split('/').pop();
  const originalDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));

  const result = await window.electronAPI.moveFile(serverId, sourcePath, destDir);

  if (result.success) {
    toast.success(`Moved "${fileName}" to ${destDir}`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          // Move back to original location
          const undoResult = await window.electronAPI.moveFile(serverId, result.path!, originalDir);
          if (undoResult.success) {
            toast.success(`Moved "${fileName}" back`);
            onRefresh();
          } else {
            toast.error(`Undo failed: ${undoResult.error}`);
          }
        },
      },
    });
    onRefresh();
  } else {
    toast.error(`Move failed: ${result.error}`);
  }
}
```

### Pattern 3: Roving Tabindex for Tree Keyboard Navigation
**What:** Only one item in tree is tabbable; arrow keys move focus between items
**When to use:** Tree views, menus, any list with keyboard navigation
**Example:**
```typescript
// Source: WAI-ARIA Tree View pattern
const [focusedPath, setFocusedPath] = useState<string | null>(null);

const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      moveFocusToNextVisible();
      break;
    case 'ArrowUp':
      e.preventDefault();
      moveFocusToPrevVisible();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (isCurrentFolderCollapsed()) expandCurrentFolder();
      else moveFocusToFirstChild();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (isCurrentFolderExpanded()) collapseCurrentFolder();
      else moveFocusToParent();
      break;
    case 'Enter':
      e.preventDefault();
      selectFocusedFolder();
      break;
    case 'Escape':
      e.preventDefault();
      onClose();
      break;
  }
};
```

### Pattern 4: Managed Expanded State
**What:** Parent component tracks which folders are expanded via Set/Map
**When to use:** Tree components where expand state must be queryable
**Example:**
```typescript
// Source: Standard React state management pattern
const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

const toggleExpand = useCallback((path: string) => {
  setExpandedPaths(prev => {
    const next = new Set(prev);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return next;
  });
}, []);

// Prefetch visible folders (one level ahead)
useEffect(() => {
  expandedPaths.forEach(path => {
    // Trigger load for children of expanded folders
  });
}, [expandedPaths]);
```

### Anti-Patterns to Avoid
- **Deep prop drilling for tree state:** Use React context or lift state to modal level
- **Fetching all folders upfront:** Lazy-load children only when expanded
- **Native file dialogs for remote paths:** Electron's showOpenDialog browses local filesystem only
- **Blocking UI during folder load:** Show loading spinner, don't freeze interaction

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast component | sonner (already in project) | Handles stacking, animations, actions |
| Modal backdrop/focus trap | Custom focus management | Existing modal pattern from AddConnectionModal | Already styled, handles Escape |
| Folder icon styling | New CSS icon | Existing `.file-item__icon--folder` | Consistency with file browser |
| Hidden files filtering | New preference system | Existing `getShowHiddenFiles` IPC | Phase 7 already implemented this |
| File move operation | Custom SFTP logic | Existing `moveFile` IPC | Backend already complete |

**Key insight:** The codebase already has all backend infrastructure and UI patterns needed. This phase is primarily frontend component composition.

## Common Pitfalls

### Pitfall 1: SFTP Rename Cross-Device Failure
**What goes wrong:** `sftp.rename()` fails if source and destination are on different mounted filesystems (e.g., `/home` on one disk, `/mnt/data` on another)
**Why it happens:** SFTP rename is a filesystem rename, not copy+delete
**How to avoid:** Catch the error and show clear message: "Cannot move files across different filesystems. Use copy and delete instead."
**Warning signs:** Error message contains "Failure" or error code indicating operation not permitted

### Pitfall 2: Destination File Already Exists
**What goes wrong:** Move fails silently or overwrites existing file unexpectedly
**Why it happens:** SFTP v3 (most common) doesn't handle rename-with-overwrite; behavior varies by server
**How to avoid:** Check if destination file exists BEFORE moving. If exists, show conflict modal with options: Replace, Keep Both (auto-rename), Cancel.
**Warning signs:** User confusion about what happened to existing file

### Pitfall 3: Moving File to Its Current Location
**What goes wrong:** Error or no-op confusion
**Why it happens:** User selects same folder file is already in
**How to avoid:** Disable "Move Here" button when selected folder equals source folder. Add "Current folder" badge to source location.
**Warning signs:** Button not disabled, rename error in logs

### Pitfall 4: Modal Losing Focus to Background
**What goes wrong:** User clicks outside modal, modal closes unexpectedly
**Why it happens:** Backdrop click handler without proper state management
**How to avoid:** Use existing modal pattern from `AddConnectionModal.tsx` - it handles backdrop clicks properly
**Warning signs:** Modal closes when clicking near edges

### Pitfall 5: Race Conditions with Folder Expansion
**What goes wrong:** Expanding multiple folders quickly causes wrong children to appear
**Why it happens:** Async listDirectory calls resolve out of order
**How to avoid:** Track loading state per folder path, ignore stale responses
**Warning signs:** Folder contents don't match expected, children appear under wrong parent

### Pitfall 6: Undo After User Navigates Away
**What goes wrong:** Undo succeeds but user can't see the result
**Why it happens:** User navigated to different folder, refresh updates wrong view
**How to avoid:** Undo should still work but toast message clarifies location. Consider navigating user back to original folder on undo.
**Warning signs:** User reports "undo didn't work" when it actually did

## Code Examples

Verified patterns from official sources and existing codebase:

### Checking File Exists at Destination
```typescript
// Source: Extrapolated from existing sftp-service.ts pattern
async function checkFileExists(serverId: string, filePath: string): Promise<boolean> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) throw new Error('Not connected to server');

  return new Promise((resolve) => {
    sftp.stat(filePath, (err) => {
      // If no error, file exists; if error (file not found), doesn't exist
      resolve(!err);
    });
  });
}
```

### Auto-Rename for "Keep Both" Conflict Resolution
```typescript
// Source: Common pattern for duplicate naming (Claude's discretion item)
function generateUniqueFileName(baseName: string, existingNames: Set<string>): string {
  const ext = baseName.includes('.') ? baseName.substring(baseName.lastIndexOf('.')) : '';
  const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName;

  let counter = 1;
  let newName = baseName;

  while (existingNames.has(newName)) {
    newName = `${nameWithoutExt} (${counter})${ext}`;
    counter++;
  }

  return newName;
}
```

### Modal with Existing CSS Patterns
```typescript
// Source: Existing AddConnectionModal.tsx and index.css
function RemoteFolderPicker({ isOpen, onClose, serverId, sourcePath, onMoveComplete }: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '500px', maxHeight: '70vh' }}>
        <div className="modal__header">
          <h2 className="modal__title">Move to...</h2>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__content" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Breadcrumb navigation */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #333' }}>
            <Breadcrumbs path={selectedPath} onNavigate={handleBreadcrumbClick} />
          </div>

          {/* Folder tree */}
          <div style={{ height: '300px', overflow: 'auto' }}>
            <FolderTree
              serverId={serverId}
              selectedPath={selectedPath}
              sourcePath={sourcePath}
              onSelect={setSelectedPath}
            />
          </div>
        </div>

        {/* Confirmation footer */}
        <div className="modal__actions" style={{ padding: '1rem', borderTop: '1px solid #333' }}>
          <span style={{ flex: 1, fontSize: '0.8125rem', color: '#888' }}>
            Move to: {selectedPath}
          </span>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn--primary"
            onClick={handleMove}
            disabled={selectedPath === sourceDir}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Adding "Move to..." to Context Menu
```typescript
// Source: Existing FileItem.tsx context menu pattern
// In FileItem.tsx, add to file context menu (not folder)
{!file.isDirectory && (
  <>
    <button onClick={handleDownload}>Download...</button>
    <button onClick={() => { setContextMenu(null); onMoveToClick(); }}>Move to...</button>
    <button onClick={handleRenameStart}>Rename</button>
    <button onClick={handleDelete}>Delete</button>
  </>
)}
```

### Creating New Folder in Picker
```typescript
// Source: Extrapolated from existing patterns
async function createRemoteFolder(serverId: string, parentPath: string, folderName: string): Promise<string> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) throw new Error('Not connected to server');

  const newPath = path.posix.join(parentPath, folderName);

  return new Promise((resolve, reject) => {
    sftp.mkdir(newPath, (err) => {
      if (err) reject(err);
      else resolve(newPath);
    });
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Native folder picker | Custom remote browser | N/A for remote | Electron dialogs can't browse SFTP |
| Class components for trees | Functional with hooks | React 16.8+ | Simpler state management |
| Separate library for trees | Custom recursive component | Current best practice for simple cases | Less bundle size, full control |

**Deprecated/outdated:**
- Using `sftp.rename()` for cross-device moves: Known SFTP limitation, not a code issue

## Open Questions

Things that couldn't be fully resolved:

1. **Cross-device move error handling**
   - What we know: SFTP rename fails across different filesystems
   - What's unclear: How to detect this vs. other rename errors (both return generic "Failure")
   - Recommendation: Show generic error message with suggestion to use download+upload instead

2. **New Folder creation in picker**
   - What we know: User wants to create destination folder inline
   - What's unclear: Exact UX for inline folder creation (button position, inline rename, etc.)
   - Recommendation: Add "New Folder" button in toolbar; creates folder with default name, immediately enters rename mode

3. **Tree animation timing (Claude's discretion)**
   - What we know: Expand/collapse should animate
   - What's unclear: Exact duration values
   - Recommendation: Use 150-200ms for expand, match existing CSS transitions in codebase

## Sources

### Primary (HIGH confidence)
- Existing codebase: `file-operations-service.ts`, `file-operations-handlers.ts`, `preload.ts` - Backend is complete
- Existing codebase: `AddConnectionModal.tsx`, `index.css` - Modal patterns verified
- Existing codebase: `FileItem.tsx` - Context menu patterns verified
- Existing codebase: `ToastProvider.tsx` - sonner setup confirmed

### Secondary (MEDIUM confidence)
- [sonner documentation](https://sonner.emilkowal.ski/toast) - Toast action button API
- [WAI-ARIA Tree View pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) - Keyboard navigation standards
- [ssh2 GitHub issues](https://github.com/mscdex/ssh2/issues/200) - SFTP rename limitations

### Tertiary (LOW confidence)
- Cross-device error detection: Unable to verify exact error codes from ssh2 documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, patterns verified
- Architecture: HIGH - Follows existing codebase patterns exactly
- Pitfalls: MEDIUM - SFTP edge cases documented but error detection uncertain

**Research date:** 2026-01-29
**Valid until:** 30 days (stable domain, no fast-moving libraries)
