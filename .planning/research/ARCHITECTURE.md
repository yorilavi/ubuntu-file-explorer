# Architecture Research: Electron SSH File Explorer

## Executive Summary

This document defines the architecture for a macOS Finder-like SSH file explorer built with Electron. The architecture follows Electron's multi-process model with clear separation between the main process (Node.js runtime with SSH/SFTP capabilities) and renderer process (React-based UI). Communication occurs through a secure IPC bridge with strict preload script discipline.

---

## Components

### Main Process

The main process runs in Node.js and handles all system-level operations. It is the only process with access to Node APIs and native capabilities.

**Responsibilities:**
| Component | Purpose |
|-----------|---------|
| **SSH Connection Manager** | Manages SSH2 client connections, handles authentication (password, key-based), maintains connection pools |
| **SFTP Session Handler** | Wraps ssh2-sftp-client for file operations (list, read, write, delete, rename, move) |
| **File Transfer Engine** | Handles upload/download operations with progress tracking, queue management, pause/resume |
| **Window Manager** | Creates and manages BrowserWindow instances, handles window state persistence |
| **IPC Handler** | Responds to renderer requests through ipcMain.handle() for async operations |
| **Settings Store** | Persists user preferences, connection bookmarks, favorites using electron-store |

**Key Libraries:**
- `ssh2` or `ssh2-sftp-client` - SSH/SFTP protocol implementation
- `electron-store` - Persistent settings storage
- Native Node.js `fs` and `path` for local file operations

### Renderer Process

The renderer process contains the React-based user interface. It has no direct access to Node APIs (nodeIntegration: false, contextIsolation: true).

**UI Components:**

```
App Shell
├── Sidebar (Favorites)
│   ├── Bookmarked folders
│   ├── Recent connections
│   └── Quick access items
│
├── Column View Navigator
│   ├── Column Container
│   │   ├── Column (directory listing)
│   │   ├── Column (subdirectory)
│   │   └── Column (...)
│   └── Horizontal scroll management
│
├── Preview Panel
│   ├── Image Preview (native images, lazy loading)
│   ├── Code Preview (syntax highlighting via Prism.js or Monaco)
│   ├── File Info (metadata, permissions, size)
│   └── Unsupported File Placeholder
│
├── Toolbar
│   ├── Navigation controls (back, forward, up)
│   ├── View toggles
│   ├── Search
│   └── File operations (new folder, upload, download)
│
└── Status Bar
    ├── Connection status
    ├── Transfer progress
    └── Item count
```

**Component Boundaries:**

| Component | State Owned | Events Emitted |
|-----------|-------------|----------------|
| Sidebar | Selected favorite | `favorite:select`, `favorite:add`, `favorite:remove` |
| ColumnView | Current path, visible columns | `path:navigate`, `item:select`, `item:open` |
| PreviewPanel | Preview content, loading state | `preview:load`, `preview:error` |
| Toolbar | Search query | `action:upload`, `action:download`, `action:delete` |

### Preload Script (Security Bridge)

The preload script is the secure bridge between main and renderer processes. It exposes a minimal, typed API through `contextBridge.exposeInMainWorld()`.

**Exposed API Surface:**

```typescript
// preload.ts - Exposed to renderer as window.api
interface ElectronAPI {
  // Connection management
  connect(config: ConnectionConfig): Promise<ConnectionResult>;
  disconnect(connectionId: string): Promise<void>;

  // Directory operations
  listDirectory(path: string): Promise<FileEntry[]>;

  // File operations
  downloadFile(remotePath: string, localPath: string): Promise<void>;
  uploadFile(localPath: string, remotePath: string): Promise<void>;
  deleteItem(path: string): Promise<void>;
  renameItem(oldPath: string, newPath: string): Promise<void>;
  moveItem(sourcePath: string, destPath: string): Promise<void>;
  createDirectory(path: string): Promise<void>;

  // Preview
  getFilePreview(path: string, maxSize: number): Promise<PreviewData>;

  // Favorites
  getFavorites(): Promise<Favorite[]>;
  addFavorite(path: string, name: string): Promise<void>;
  removeFavorite(id: string): Promise<void>;

  // Event subscriptions (one-way main -> renderer)
  onTransferProgress(callback: (progress: TransferProgress) => void): () => void;
  onConnectionStatus(callback: (status: ConnectionStatus) => void): () => void;
}
```

**Security Rules:**
- Never expose raw `ipcRenderer` or its methods
- Each IPC channel maps to one specific action
- All inputs validated in main process before execution
- Event callbacks wrapped to strip IPC event objects

---

## IPC Communication

### Channel Architecture

All IPC uses the invoke/handle pattern for request-response communication:

```
Renderer                    Preload                     Main Process
   │                           │                            │
   │  api.listDirectory()      │                            │
   │ ─────────────────────────>│                            │
   │                           │  ipcRenderer.invoke()      │
   │                           │ ──────────────────────────>│
   │                           │                            │ SFTP.list()
   │                           │                            │<──────────
   │                           │     Promise<FileEntry[]>   │
   │                           │<───────────────────────────│
   │    Promise<FileEntry[]>   │                            │
   │<──────────────────────────│                            │
```

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `ssh:connect` | Renderer → Main | Establish SSH connection |
| `ssh:disconnect` | Renderer → Main | Close connection |
| `sftp:list` | Renderer → Main | List directory contents |
| `sftp:download` | Renderer → Main | Download file/folder |
| `sftp:upload` | Renderer → Main | Upload file/folder |
| `sftp:delete` | Renderer → Main | Delete file/folder |
| `sftp:rename` | Renderer → Main | Rename item |
| `sftp:move` | Renderer → Main | Move item |
| `sftp:mkdir` | Renderer → Main | Create directory |
| `sftp:preview` | Renderer → Main | Get file preview data |
| `favorites:get` | Renderer → Main | Get favorites list |
| `favorites:add` | Renderer → Main | Add favorite |
| `favorites:remove` | Renderer → Main | Remove favorite |
| `transfer:progress` | Main → Renderer | Transfer progress updates |
| `connection:status` | Main → Renderer | Connection state changes |

### Error Handling Pattern

All IPC handlers follow consistent error propagation:

```typescript
// Main process handler
ipcMain.handle('sftp:list', async (event, path: string) => {
  try {
    validatePath(path);  // Input validation first
    const files = await sftpClient.list(path);
    return { success: true, data: files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

---

## Data Flow

### Directory Navigation Flow

```
User clicks folder in Column View
         │
         ▼
ColumnView component calls api.listDirectory(path)
         │
         ▼
Preload invokes 'sftp:list' channel
         │
         ▼
Main process SFTP handler executes list operation
         │
         ▼
Results returned through IPC
         │
         ▼
ColumnView updates state, renders new column
         │
         ▼
If file selected, PreviewPanel loads preview via api.getFilePreview()
```

### File Transfer Flow

```
User initiates download
         │
         ▼
Toolbar calls api.downloadFile(remotePath, localPath)
         │
         ▼
Main process starts transfer, returns transfer ID
         │
         ▼
Main process emits 'transfer:progress' events
         │
         ▼
Renderer receives progress via onTransferProgress callback
         │
         ▼
StatusBar displays progress
         │
         ▼
Transfer complete, final event emitted
```

### State Management Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Context Store                      │
├─────────────────────────────────────────────────────────────┤
│  connectionState: { connected, host, user }                 │
│  navigationState: { currentPath, columns[], selectedItem }  │
│  favoritesState: { favorites[] }                            │
│  transferState: { transfers[], currentTransfer }            │
│  previewState: { content, loading, error }                  │
│  uiState: { sidebarWidth, previewVisible, columnWidths }    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │                               │
     UI Components                   IPC Sync Layer
     (read state)                  (persist to main)
```

**Recommendation:** Use React Context with useReducer for UI state. Avoid Redux unless multi-window support is needed. For a single-window app, Context provides simpler debugging and adequate performance.

---

## Suggested Build Order

The build order is structured to enable incremental testing and minimize blocked dependencies.

### Phase 1: Foundation (Week 1)

**Goal:** Establish project structure and basic Electron shell

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 1.1 | Project Setup | Electron + React + TypeScript scaffold, build pipeline | All |
| 1.2 | Main Process Shell | Basic window creation, menu setup | 1.3 |
| 1.3 | Preload Script | contextBridge skeleton with typed API stubs | 1.4 |
| 1.4 | IPC Foundation | Basic invoke/handle pattern working end-to-end | Phase 2 |

**Rationale:** The IPC bridge must be solid before any feature work. Security patterns established early are cheaper to maintain.

### Phase 2: SSH/SFTP Core (Week 2)

**Goal:** Working SSH connection and basic directory listing

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 2.1 | SSH Connection | Connect with password/key auth, connection state | 2.2 |
| 2.2 | SFTP Session | Establish SFTP subsystem from SSH connection | 2.3 |
| 2.3 | Directory Listing | List directory contents, return typed FileEntry[] | Phase 3 |
| 2.4 | Connection UI | Simple connect form, connection status display | Phase 3 |

**Rationale:** SSH/SFTP is the core value proposition. A working connection with directory listing proves the architecture before investing in UI polish.

### Phase 3: Column View Navigator (Week 3)

**Goal:** Finder-style column navigation working with real data

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 3.1 | Column Component | Single column rendering file list | 3.2 |
| 3.2 | Column Container | Multi-column layout with horizontal scroll | 3.3 |
| 3.3 | Navigation Logic | Click-to-navigate, breadcrumb tracking | 3.4 |
| 3.4 | Keyboard Navigation | Arrow keys, enter to open | Phase 4 |

**Rationale:** Column view is the primary interaction pattern. Building it against real SFTP data ensures correct assumptions about async loading and error states.

### Phase 4: Preview Panel (Week 4)

**Goal:** Preview images and code files with syntax highlighting

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 4.1 | Preview Architecture | Panel layout, file type detection | 4.2, 4.3 |
| 4.2 | Image Preview | Display images with lazy loading | - |
| 4.3 | Code Preview | Syntax highlighting with Prism.js or Monaco | - |
| 4.4 | File Info | Metadata display for all file types | Phase 5 |

**Rationale:** Preview can be built in parallel with file operations since it's read-only. Image and code preview can be developed simultaneously.

### Phase 5: File Operations (Week 5)

**Goal:** Full CRUD operations on remote files

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 5.1 | Download | Single file download with progress | 5.3 |
| 5.2 | Upload | Single file upload with progress | 5.3 |
| 5.3 | Transfer Queue | Queue management, concurrent transfers | - |
| 5.4 | Delete/Rename/Move | Destructive operations with confirmation | Phase 6 |
| 5.5 | Create Directory | New folder creation | Phase 6 |

**Rationale:** File operations depend on stable navigation and IPC. Transfer queue management is complex enough to warrant dedicated focus.

### Phase 6: Favorites & Polish (Week 6)

**Goal:** Bookmarking and UX refinement

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 6.1 | Favorites Sidebar | Display favorites, click to navigate | 6.2 |
| 6.2 | Add/Remove Favorites | Context menu and shortcut support | - |
| 6.3 | Persistence | Save favorites, recent connections, window state | - |
| 6.4 | Error Handling | User-friendly error messages, retry logic | - |
| 6.5 | Drag and Drop | Drag files for upload/download | - |

---

## Key Patterns

### 1. Service Layer Pattern (Main Process)

Organize main process code into service classes:

```typescript
// services/SFTPService.ts
class SFTPService {
  private client: SftpClient;

  async connect(config: ConnectionConfig): Promise<void> { }
  async list(path: string): Promise<FileEntry[]> { }
  async download(remotePath: string, localPath: string): Promise<void> { }
  // ...
}

// services/FavoritesService.ts
class FavoritesService {
  private store: ElectronStore;

  getAll(): Favorite[] { }
  add(path: string, name: string): void { }
  remove(id: string): void { }
}
```

**Benefit:** Testable units, clear responsibilities, easy to mock for renderer testing.

### 2. Typed IPC Pattern

Define shared types for IPC communication:

```typescript
// shared/types.ts
interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: Date;
  permissions: string;
}

interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Benefit:** Type safety across process boundary, self-documenting API.

### 3. Optimistic UI Pattern

For responsive feel, update UI optimistically:

```typescript
// When user renames a file
const handleRename = async (oldName: string, newName: string) => {
  // 1. Update UI immediately (optimistic)
  updateFileInState(oldName, { name: newName, pending: true });

  try {
    // 2. Perform actual operation
    await api.renameItem(oldPath, newPath);
    // 3. Confirm success
    updateFileInState(newName, { pending: false });
  } catch (error) {
    // 4. Rollback on failure
    updateFileInState(newName, { name: oldName, pending: false });
    showError(error);
  }
};
```

### 4. Lazy Loading with Virtualization

For large directories, virtualize the file list:

```typescript
// Use react-window or similar for column contents
<FixedSizeList
  height={columnHeight}
  itemCount={files.length}
  itemSize={ROW_HEIGHT}
>
  {({ index, style }) => (
    <FileRow file={files[index]} style={style} />
  )}
</FixedSizeList>
```

**Benefit:** Smooth scrolling regardless of directory size.

### 5. Connection Pooling and Reuse

Maintain SFTP session across operations:

```typescript
class ConnectionPool {
  private connections: Map<string, SftpClient> = new Map();

  async getConnection(config: ConnectionConfig): Promise<SftpClient> {
    const key = `${config.host}:${config.port}:${config.username}`;

    if (this.connections.has(key)) {
      return this.connections.get(key)!;
    }

    const client = new SftpClient();
    await client.connect(config);
    this.connections.set(key, client);
    return client;
  }
}
```

**Benefit:** Faster subsequent operations, reduced authentication overhead.

### 6. Debounced Preview Loading

Prevent preview thrashing during rapid navigation:

```typescript
const loadPreview = useDebouncedCallback(
  async (file: FileEntry) => {
    if (isPreviewable(file)) {
      const preview = await api.getFilePreview(file.path, MAX_PREVIEW_SIZE);
      setPreviewContent(preview);
    }
  },
  300 // Wait 300ms after selection stops changing
);
```

---

## Technology Recommendations

| Layer | Recommended | Alternatives | Notes |
|-------|-------------|--------------|-------|
| Framework | Electron 28+ | - | Latest stable with security defaults |
| Frontend | React 18+ | Vue 3, Svelte | Best ecosystem, typing support |
| State | React Context + useReducer | Zustand, Jotai | Keep simple unless multi-window |
| SSH/SFTP | ssh2-sftp-client | ssh2 (lower-level) | Promise-based, well-maintained |
| Syntax Highlighting | Prism.js | Monaco, Shiki | Lightweight, extensible |
| Styling | Tailwind CSS | CSS Modules, styled-components | Rapid prototyping |
| Build | Vite + electron-builder | Webpack | Faster HMR, simpler config |
| Testing | Vitest + Playwright | Jest + Spectron | Modern, faster test runs |

---

## Security Checklist

- [ ] `nodeIntegration: false` (default in Electron 28+)
- [ ] `contextIsolation: true` (default in Electron 28+)
- [ ] Preload exposes minimal, specific functions only
- [ ] All IPC inputs validated in main process
- [ ] SSH keys stored securely (keychain integration on macOS)
- [ ] No `shell.openExternal()` with untrusted URLs
- [ ] CSP headers configured for renderer
- [ ] Credentials never logged or stored in plain text

---

## References

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [ssh2-sftp-client Documentation](https://www.npmjs.com/package/ssh2-sftp-client)
- [Electerm Source Code](https://github.com/electerm/electerm) - Reference implementation
- [Advanced Electron Architecture (LogRocket)](https://blog.logrocket.com/advanced-electron-js-architecture/)
- [Handling IPC in Electron (LogRocket)](https://blog.logrocket.com/handling-interprocess-communications-in-electron-applications-like-a-pro/)
