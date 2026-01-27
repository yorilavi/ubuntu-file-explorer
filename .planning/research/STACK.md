# Stack Research: Electron SSH File Explorer

> **Research Date:** January 26, 2026
> **Project:** Desktop file explorer for browsing remote Ubuntu servers via SSH
> **Target Experience:** macOS Finder-like with column-based navigation, favorites, and file previews

---

## Recommended Stack

### Core Framework

| Component | Version | Confidence |
|-----------|---------|------------|
| **Electron** | 40.0.0 | High |
| Node.js | 22.x LTS | High |
| TypeScript | 5.x | High |

**Rationale:**
- Electron 40.0.0 (released January 13, 2026) is the current stable version with Chromium M144
- Electron remains the proven choice for desktop apps (VS Code, Slack, Discord built with it)
- TypeScript is non-negotiable for a project of this complexity - provides type safety for SSH operations, file metadata handling, and IPC communication
- Node.js 22.x is the LTS version required by ssh2-sftp-client v12.x

**Architecture Notes:**
- Use context isolation and preload scripts (never disable `webSecurity`)
- All SSH operations happen in main process; renderer receives data via IPC
- Enable sandbox mode for added security

### Build Tooling

| Component | Version | Confidence |
|-----------|---------|------------|
| **Electron Forge** | 7.x | High |
| **Vite Plugin** | (bundled) | High |

**Rationale:**
- Electron Forge is the official Electron tooling solution with comprehensive packaging/publishing
- As of Forge v7.5.0, Vite support is integrated (marked experimental but actively developed)
- Vite provides HMR and fast rebuilds crucial for UI development
- Features from electron-vite experiments eventually get ported to Electron Forge

**Alternative Considered:**
- `electron-react-boilerplate` - Uses webpack, less frequent updates, React-only
- `vite-electron-builder` - Good but Forge is the official path forward

---

### SSH/SFTP Layer

| Component | Version | Confidence |
|-----------|---------|------------|
| **ssh2** | 1.17.0 | High |
| **ssh2-sftp-client** | 12.0.1 | High |

**Rationale:**

**Primary: ssh2-sftp-client v12.0.1**
- Promise-based API wrapping ssh2 - cleaner async/await code
- Optimized `downloadDir()`/`uploadDir()` with configurable `promiseLimit` (default 10)
- Recent v12 performance improvements for directory tree operations
- Well-maintained, tested against Node 20.x, 22.x, 23.x, 24.x

**Underlying: ssh2 v1.17.0**
- Pure JavaScript SSH2 implementation for Node.js
- Supports Ed25519 keys (requires Node 12+)
- Proven reliability - 1,744 dependent packages

**Architecture Pattern:**
```typescript
// Main process only - never expose SSH to renderer
class SSHManager {
  private connections: Map<string, SftpClient>;

  async listDirectory(connectionId: string, path: string): Promise<FileEntry[]> {
    const sftp = this.connections.get(connectionId);
    return sftp.list(path); // Returns promise
  }
}
```

**Performance Tips:**
- Use absolute paths (avoid `./` and `../`) to skip path resolution overhead
- Set `promiseLimit` appropriately for bulk operations
- ssh2-sftp-client v12 removed retry code for better performance

---

### Frontend Framework

| Component | Version | Confidence |
|-----------|---------|------------|
| **React** | 19.2.x | High |
| **Zustand** | 5.0.x | High |

**Rationale:**

**React 19.2.3 (current stable)**
- Largest ecosystem and talent pool (44.7% market share per Stack Overflow 2025)
- Extensive Electron-specific tooling and community patterns
- React 19.2 brings Activity component and useEffectEvent hooks
- Mature DevTools for debugging

**Zustand 5.0.10 for State Management**
- ~3KB bundle size vs Redux Toolkit's larger footprint
- No Provider wrapper needed - hook-based API
- Perfect for medium complexity (file tree state, connection state, UI state)
- 14M+ weekly downloads, well-maintained

**State Architecture:**
```typescript
interface FileExplorerStore {
  connections: Connection[];
  currentPath: string;
  selectedFiles: string[];
  favorites: Favorite[];
  previewFile: FileEntry | null;
}
```

**Why Not Vue/Svelte:**
- Vue: Smaller ecosystem, fewer Electron-specific resources
- Svelte: Smallest bundle but limited enterprise adoption and tooling
- React's ecosystem wins for a desktop app requiring SSH clients, preview renderers, and complex state

---

### UI Component Library

| Component | Version | Confidence |
|-----------|---------|------------|
| **Tailwind CSS** | 4.1.x | High |
| **shadcn/ui** | latest | High |
| **Radix UI** | (via shadcn) | Medium |

**Rationale:**

**Tailwind CSS v4.1.18**
- Utility-first CSS, perfect for custom Finder-like UI
- v4.0 is 5x faster full builds, 100x faster incremental builds
- Zero runtime overhead - CSS-only
- First-party Vite plugin for tight integration

**shadcn/ui**
- Copy-paste components built on Radix UI primitives
- Full control over styling - not a dependency, code lives in your project
- 100k+ GitHub stars, used by Vercel
- Now supports Base UI as Radix alternative (future-proofing)

**Component Usage:**
- Dialog: Connection manager modal
- ContextMenu: Right-click file operations
- ScrollArea: File list scrolling
- Tooltip: File metadata preview
- Separator: Column dividers

**Note on Radix UI:**
- Radix UI is reportedly not actively maintained as of late 2025
- shadcn/ui now supports Base UI (v1 released December 2025) as alternative
- Recommend starting with Radix (via shadcn) but monitor Base UI maturity

---

### File Preview

| Component | Version | Purpose | Confidence |
|-----------|---------|---------|------------|
| **Shiki** | 3.21.0 | Syntax highlighting | High |
| **Native `<img>`** | - | Image preview | High |
| **react-pdf** | latest | PDF preview (optional) | Medium |

**Rationale:**

**Shiki v3.21.0 for Code Highlighting**
- Uses VS Code's TextMate grammar engine - accurate highlighting
- Supports 200+ languages out of the box
- Zero JavaScript runtime in output (pre-renders to HTML)
- Theming via VS Code themes (One Dark Pro, GitHub, etc.)

**Why Shiki over alternatives:**
- PrismJS: Faster but seemingly unmaintained (v2 stalled since 2022)
- Highlight.js: Good but auto-detection is slower; Shiki more accurate
- Monaco Editor: Overkill (5-10MB) for read-only preview; Shiki is ~300KB

**Image Preview Strategy:**
- Use native `<img>` with lazy loading for thumbnails
- Implement `IntersectionObserver` for viewport-based loading
- Cache thumbnails locally for performance
- Support: JPEG, PNG, GIF, WebP, SVG

**Code Preview Pattern:**
```typescript
import { codeToHtml } from 'shiki';

async function renderCodePreview(code: string, lang: string): Promise<string> {
  return codeToHtml(code, {
    lang,
    theme: 'github-dark'
  });
}
```

---

### Data Persistence

| Component | Version | Purpose | Confidence |
|-----------|---------|---------|------------|
| **electron-store** | 10.x | Settings/favorites | Medium |
| **Electron safeStorage** | (built-in) | SSH credentials | High |

**Rationale:**

**electron-store for Preferences**
- Simple JSON file storage in `app.getPath('userData')`
- Perfect for: favorites, recent connections, UI preferences, window state
- Requires Electron 30+ and ESM (matches our stack)

**Caveats:**
- Not a database - avoid storing large data
- Maintenance appears slower lately; evaluate alternatives if issues arise
- For large file metadata caching, consider SQLite instead

**safeStorage for Credentials**
- Built-in Electron API for OS-level encryption
- Uses macOS Keychain on Mac
- Never store SSH private keys or passwords in plain text

**Storage Architecture:**
```typescript
// Settings (electron-store)
{
  "favorites": [
    { "path": "/home/user/projects", "name": "Projects" }
  ],
  "recentConnections": ["server1", "server2"],
  "theme": "dark",
  "columnWidths": [200, 300, 400]
}

// Credentials (safeStorage - encrypted)
{
  "server1": { "host": "...", "encryptedPassword": "..." }
}
```

---

## What NOT to Use

### Avoid These Libraries

| Library | Reason |
|---------|--------|
| **Redux/Redux Toolkit** | Overkill for this project's state complexity; Zustand is simpler with same capabilities |
| **Monaco Editor** | 5-10MB bundle for read-only preview; Shiki achieves same highlighting at fraction of size |
| **PrismJS** | Development stalled (v2 inactive since 2022); Shiki is actively maintained |
| **electron-remote** | Deprecated; use IPC with preload scripts instead |
| **lowdb/nedb** | electron-store sufficient for our needs; SQLite if more is needed |
| **Material UI (MUI)** | Heavy, opinionated styling conflicts with Finder-like custom UI |
| **Styled Components** | Runtime CSS-in-JS overhead; Tailwind is zero-runtime |
| **node-ssh** | Wrapper over ssh2 with less community; prefer ssh2-sftp-client directly |

### Avoid These Patterns

| Pattern | Why | Instead |
|---------|-----|---------|
| Disabling `webSecurity` | Major security vulnerability | Use proper IPC and preload scripts |
| SSH in renderer process | Security risk, exposes credentials | All SSH in main process only |
| Synchronous IPC | Blocks UI thread | Always use async `ipcRenderer.invoke` |
| localStorage for credentials | Not encrypted | Use Electron safeStorage API |
| CommonJS modules | electron-store v10+ requires ESM | Use ESM throughout |

---

## Confidence Levels Summary

| Decision | Confidence | Notes |
|----------|------------|-------|
| Electron 40 | **High** | Current stable, well-documented |
| Electron Forge + Vite | **High** | Official tooling path |
| React 19 | **High** | Ecosystem, tooling, hiring |
| Zustand | **High** | Right-sized for this app |
| ssh2-sftp-client | **High** | Battle-tested, promise-based |
| Tailwind CSS v4 | **High** | Performance, flexibility |
| shadcn/ui | **High** | Ownership, customization |
| Shiki | **High** | Best accuracy/size ratio |
| electron-store | **Medium** | Maintenance concerns; works but monitor |
| Radix UI (via shadcn) | **Medium** | Maintenance concerns; Base UI as backup |

---

## Version Summary (Install Commands)

```bash
# Core
npm create electron-app@latest ubunto-file-explorer -- --template=vite-typescript

# Frontend
npm install react@^19.2.0 react-dom@^19.2.0
npm install zustand@^5.0.0
npm install tailwindcss@^4.1.0 @tailwindcss/vite

# SSH
npm install ssh2-sftp-client@^12.0.0

# UI Components (shadcn/ui)
npx shadcn@latest init
npx shadcn@latest add dialog context-menu scroll-area tooltip

# Code Preview
npm install shiki@^3.21.0

# Persistence
npm install electron-store@^10.0.0

# TypeScript Types
npm install -D @types/react @types/react-dom @types/ssh2-sftp-client
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ SSHManager  │  │ FileStore   │  │ CredentialManager   │  │
│  │ (ssh2-sftp) │  │ (electron-  │  │ (safeStorage)       │  │
│  │             │  │  store)     │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┴─────────────────────┘             │
│                          │                                   │
│                    ┌─────┴─────┐                             │
│                    │    IPC    │                             │
│                    └─────┬─────┘                             │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    Renderer Process                          │
├──────────────────────────┴───────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    React App                             │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐│ │
│  │  │ Zustand   │  │ shadcn/ui │  │ Shiki Code Preview    ││ │
│  │  │ Store     │  │ + Tailwind│  │                       ││ │
│  │  └───────────┘  └───────────┘  └───────────────────────┘│ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## References

- [Electron Releases](https://releases.electronjs.org/)
- [ssh2-sftp-client npm](https://www.npmjs.com/package/ssh2-sftp-client)
- [React 19.2 Release](https://react.dev/blog/2025/10/01/react-19-2)
- [Zustand Documentation](https://zustand.docs.pmnd.rs/)
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui](https://ui.shadcn.com/)
- [Shiki Syntax Highlighter](https://shiki.style/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
