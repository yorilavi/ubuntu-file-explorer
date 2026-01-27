# Phase 1: Foundation & Security - Research

**Researched:** 2026-01-26
**Domain:** Electron application scaffolding with secure IPC patterns
**Confidence:** HIGH

## Summary

This phase establishes the Electron + React + TypeScript foundation with security-first IPC patterns. Research confirms Electron Forge 7.x with the Vite plugin is the recommended build tooling, providing integrated HMR and fast development builds. The critical security baseline requires `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true` (all defaults since Electron 20+).

The typed IPC pattern uses `contextBridge.exposeInMainWorld()` to expose a minimal, specific API surface rather than raw `ipcRenderer` methods. The invoke/handle pattern (`ipcRenderer.invoke()` + `ipcMain.handle()`) provides clean async request-response communication with proper error propagation.

**Primary recommendation:** Use `npm init electron-app@latest -- --template=vite-typescript` as the starting point, then add React with `@vitejs/plugin-react` for HMR support. Organize code into `src/main/`, `src/preload/`, and `src/renderer/` directories with corresponding Vite configs.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 40.0.0 | Desktop app framework | Latest stable (Jan 2026), Chromium M144, Node 24.x, security defaults built-in |
| Electron Forge | 7.x | Build tooling & packaging | Official Electron tooling, integrated Vite support |
| @electron-forge/plugin-vite | 7.x | Vite integration | Enables HMR, fast builds, modern ESM support |
| React | 19.2.x | UI framework | Ecosystem, tooling, 44.7% market share |
| TypeScript | 5.x | Type safety | Non-negotiable for IPC type safety across process boundary |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | 4.x | React HMR | Required for React Fast Refresh in development |
| @types/react | 19.x | React types | TypeScript support for React |
| @types/react-dom | 19.x | ReactDOM types | TypeScript support for ReactDOM |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Electron Forge + Vite | electron-vite | electron-vite is more mature for Vite but Forge is official path |
| Electron Forge + Vite | Electron Forge + Webpack | Webpack is more stable but Vite is faster for development |
| React | Vue/Svelte | Smaller ecosystem, fewer Electron-specific resources |

**Installation:**
```bash
# Create project with Electron Forge + Vite + TypeScript
npm init electron-app@latest my-app -- --template=vite-typescript

# Add React
npm install react react-dom
npm install -D @types/react @types/react-dom @vitejs/plugin-react
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main/
│   └── main.ts           # Main process entry
├── preload/
│   └── preload.ts        # Preload script with contextBridge
├── renderer/
│   ├── App.tsx           # React root component
│   ├── main.tsx          # React entry point
│   └── index.css         # Styles
├── shared/
│   └── types.ts          # Shared TypeScript interfaces for IPC
index.html                # HTML template
forge.config.ts           # Electron Forge configuration
vite.main.config.ts       # Vite config for main process
vite.preload.config.ts    # Vite config for preload script
vite.renderer.config.ts   # Vite config for renderer
```

### Pattern 1: Secure BrowserWindow Configuration

**What:** Configure BrowserWindow with security defaults explicitly set
**When to use:** Always when creating BrowserWindow instances

```typescript
// src/main/main.ts
// Source: https://www.electronjs.org/docs/latest/tutorial/security
import { app, BrowserWindow } from 'electron';
import path from 'path';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security defaults (explicit for documentation)
      nodeIntegration: false,     // Default since Electron 5
      contextIsolation: true,     // Default since Electron 12
      sandbox: true,              // Default since Electron 20
      webSecurity: true,          // Default
      allowRunningInsecureContent: false, // Default
    },
  });

  // Load renderer using Vite plugin globals
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

app.whenReady().then(createWindow);
```

### Pattern 2: Typed Preload Script with contextBridge

**What:** Expose minimal, typed API surface to renderer via contextBridge
**When to use:** Always for IPC communication

```typescript
// src/preload/preload.ts
// Source: https://www.electronjs.org/docs/latest/tutorial/context-isolation
import { contextBridge, ipcRenderer } from 'electron';

// Define the API surface exposed to renderer
const electronAPI = {
  // One-way: renderer -> main (fire-and-forget)
  setTitle: (title: string) => ipcRenderer.send('set-title', title),

  // Two-way: renderer -> main -> renderer (request-response)
  ping: (data: string): Promise<string> => ipcRenderer.invoke('ping', data),

  // One-way: main -> renderer (subscriptions)
  onUpdateCounter: (callback: (value: number) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, value: number) => callback(value);
    ipcRenderer.on('update-counter', subscription);
    // Return cleanup function
    return () => ipcRenderer.removeListener('update-counter', subscription);
  },
};

// Expose to renderer as window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Export type for TypeScript
export type ElectronAPI = typeof electronAPI;
```

### Pattern 3: IPC Handler Registration in Main Process

**What:** Register ipcMain handlers with proper error handling
**When to use:** For each IPC channel that requires main process logic

```typescript
// src/main/main.ts (continued)
// Source: https://www.electronjs.org/docs/latest/tutorial/ipc
import { ipcMain, BrowserWindow } from 'electron';

// One-way handler (no response)
ipcMain.on('set-title', (event, title: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setTitle(title);
  }
});

// Two-way handler (with response)
ipcMain.handle('ping', async (_event, data: string): Promise<string> => {
  // Validate input
  if (typeof data !== 'string') {
    throw new Error('Invalid input: expected string');
  }
  return `pong: ${data}`;
});
```

### Pattern 4: TypeScript Declaration for Window API

**What:** Extend Window interface with exposed API types
**When to use:** Required for TypeScript to recognize window.electronAPI

```typescript
// src/shared/types.ts
// Source: https://www.electronjs.org/docs/latest/tutorial/context-isolation

// Import the type from preload
import type { ElectronAPI } from '../preload/preload';

// Extend the Window interface globally
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Additional shared types for IPC payloads
export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Pattern 5: React Entry Point

**What:** Initialize React with createRoot
**When to use:** Standard React 19 entry point pattern

```typescript
// src/renderer/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Anti-Patterns to Avoid

- **Exposing raw ipcRenderer:** Never do `contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer)`. This allows arbitrary IPC messages.
- **Using nodeIntegration: true:** Never enable this for any window loading untrusted content.
- **Synchronous IPC:** Avoid `ipcRenderer.sendSync()`. It blocks the renderer thread.
- **Storing credentials in renderer:** Never access credentials directly in renderer. Use safeStorage in main process.
- **Direct DOM manipulation for root:** Use React's createRoot, not document.body directly.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IPC type safety | Manual channel string matching | Shared TypeScript interfaces | Type errors at compile time, not runtime |
| Preload bundling | Multiple require() calls | Vite bundler (single file output) | Sandbox restricts multi-file requires |
| HMR for React | Custom reload logic | @vitejs/plugin-react | Battle-tested Fast Refresh implementation |
| Window state persistence | Custom position tracking | electron-window-state (Phase 6) | Edge cases: multi-monitor, screen resize |
| Build & packaging | Custom scripts | Electron Forge | Handles code signing, auto-update, installers |

**Key insight:** Electron Forge + Vite plugin handles the complex build orchestration (main, preload, renderer configs, HMR injection, production builds). Don't try to replicate this manually.

## Common Pitfalls

### Pitfall 1: Exposing Powerful APIs via contextBridge

**What goes wrong:** Renderer can send arbitrary IPC messages, execute any main process code
**Why it happens:** Developer exposes entire ipcRenderer or generic send/invoke methods
**How to avoid:** Expose one method per specific action. Wrap ipcRenderer calls in named functions.
**Warning signs:** `contextBridge.exposeInMainWorld('ipc', { send: ipcRenderer.send, invoke: ipcRenderer.invoke })`

### Pitfall 2: Missing Window Type Declaration

**What goes wrong:** TypeScript errors when accessing window.electronAPI, or using `any` types
**Why it happens:** TypeScript doesn't know about contextBridge-exposed APIs
**How to avoid:** Create declaration file extending Window interface with ElectronAPI type
**Warning signs:** `(window as any).electronAPI` casts or TypeScript errors on window access

### Pitfall 3: Vite Plugin Global Variables Not Declared

**What goes wrong:** TypeScript errors on MAIN_WINDOW_VITE_DEV_SERVER_URL
**Why it happens:** Vite plugin injects globals at runtime, but TypeScript doesn't know about them
**How to avoid:** Declare globals in vite-env.d.ts or a dedicated declaration file
**Warning signs:** `Cannot find name 'MAIN_WINDOW_VITE_DEV_SERVER_URL'` TypeScript error

```typescript
// vite-env.d.ts
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
```

### Pitfall 4: Preload Script Requires Not Working in Sandbox

**What goes wrong:** `require is not defined` or module not found errors in preload
**Why it happens:** Sandboxed preload scripts have limited require (only specific Electron/Node modules)
**How to avoid:** Bundle all preload dependencies with Vite. Use only allowed modules.
**Warning signs:** Adding npm dependencies directly used in preload without bundling

### Pitfall 5: React HMR Not Working

**What goes wrong:** Full page reloads instead of component hot updates
**Why it happens:** Missing @vitejs/plugin-react in vite.renderer.config.ts
**How to avoid:** Add React plugin to renderer Vite config with correct configuration
**Warning signs:** "Full reload" messages in console instead of "hmr update"

### Pitfall 6: ESM/CommonJS Confusion

**What goes wrong:** `ReferenceError: require is not defined` or `Cannot use import statement`
**Why it happens:** Mixing ESM and CommonJS, or incorrect Vite target configuration
**How to avoid:** Use ESM throughout (`"type": "module"` in package.json). Ensure Vite configs target correct environments.
**Warning signs:** Mix of `import` and `require` statements, .cjs extension issues

## Code Examples

Verified patterns from official sources:

### Forge Configuration with Vite Plugin

```typescript
// forge.config.ts
// Source: https://www.electronforge.io/config/plugins/vite
import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    // Add makers as needed (deb, rpm, squirrel, zip, dmg)
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
```

### Vite Renderer Config with React

```typescript
// vite.renderer.config.ts
// Source: https://www.electronforge.io/config/plugins/vite
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
});
```

### Vite Main Config

```typescript
// vite.main.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
});
```

### Vite Preload Config

```typescript
// vite.preload.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
});
```

### HTML Template

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
  <title>Ubuntu File Explorer</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/renderer/main.tsx"></script>
</body>
</html>
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*", "*.config.ts"],
  "exclude": ["node_modules"]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `nodeIntegration: true` | `nodeIntegration: false` (default) | Electron 5 (2019) | Security baseline |
| `contextIsolation: false` | `contextIsolation: true` (default) | Electron 12 (2021) | Required for secure preload |
| `sandbox: false` | `sandbox: true` (default) | Electron 20 (2022) | Renderer restrictions |
| Webpack + electron-builder | Electron Forge + Vite | Forge 7.5 (2024) | Faster builds, unified tooling |
| react-hot-loader | @vitejs/plugin-react (Fast Refresh) | 2020-2021 | Better HMR, less configuration |
| ipcRenderer.sendSync | ipcRenderer.invoke | Electron 7 (2019) | Async by default, cleaner API |

**Deprecated/outdated:**
- `remote` module: Removed in Electron 14. Use IPC instead.
- `electron-remote` package: Use contextBridge + IPC.
- `react-hot-loader`: Superseded by React Fast Refresh via @vitejs/plugin-react.
- Clipboard in renderer: Deprecated in Electron 40. Move to preload script.

## Open Questions

Things that couldn't be fully resolved:

1. **Electron Forge Vite Plugin Stability**
   - What we know: Marked experimental as of v7.5.0, breaking changes possible in minor releases
   - What's unclear: Timeline for stable release, specific breaking changes to expect
   - Recommendation: Pin to specific minor version, check release notes before upgrading

2. **Optimal Vite Config for Electron Main Process**
   - What we know: Needs `external: ['electron']` to avoid bundling Electron
   - What's unclear: Best practices for native modules in main process
   - Recommendation: Start simple, add externals as needed when adding ssh2-sftp-client in Phase 2

3. **Content Security Policy for Development**
   - What we know: CSP should be restrictive, but HMR may need adjustments
   - What's unclear: Exact CSP needed for Vite HMR in development vs production
   - Recommendation: Use permissive CSP in dev, strict in production (conditional in index.html)

## Sources

### Primary (HIGH confidence)
- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security) - Security checklist, webPreferences defaults
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - invoke/handle pattern, channel architecture
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) - contextBridge usage, typed APIs
- [Electron Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox) - Sandbox behavior, available modules
- [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite) - Plugin configuration, HMR globals
- [Electron Forge Vite+TypeScript Template](https://www.electronforge.io/templates/vite-+-typescript) - Project creation command
- [Electron Forge React Integration](https://www.electronforge.io/guides/framework-integration/react-with-typescript) - React setup guide
- [Electron 40.0.0 Release Notes](https://www.electronjs.org/blog/electron-40-0) - Breaking changes, new features

### Secondary (MEDIUM confidence)
- [vite-electron-builder](https://github.com/cawa-93/vite-electron-builder) - Typed IPC pattern via preload imports
- [template-electron-forge-vite-react-ts](https://github.com/julillermo/template-electron-forge-vite-react-ts) - Project structure reference
- [Electron Forge GitHub Issues](https://github.com/electron/forge/issues) - Common problems and solutions

### Tertiary (LOW confidence)
- Community blog posts on React + Electron + Vite setup - Patterns verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Electron tooling with documented setup
- Architecture: HIGH - Patterns from official Electron security docs
- Pitfalls: HIGH - Well-documented security issues with official mitigations

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable Electron ecosystem)
