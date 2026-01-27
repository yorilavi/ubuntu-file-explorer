# Phase 2: SSH/SFTP Core - Research

**Researched:** 2026-01-27
**Domain:** SSH/SFTP connectivity, secure credential storage, Electron IPC patterns
**Confidence:** HIGH

## Summary

This phase implements SSH/SFTP connectivity in an Electron app with security-first architecture. The research identified a clear standard stack: `ssh2` (v1.17.0) for SSH/SFTP operations, `ssh-config` (v5.0.4) for parsing ~/.ssh/config, Electron's built-in `safeStorage` API for macOS Keychain integration, and `electron-conf` for persisting custom connections.

The established pattern for Electron apps is to keep all SSH operations in the main process (never renderer), expose a minimal typed IPC API via contextBridge, and use promise-based wrappers around the event-driven ssh2 library. The project already has the correct security foundation (contextIsolation: true, sandbox: true, nodeIntegration: false).

Key decisions include using `electron-conf` over `electron-store` due to better CommonJS/ESM compatibility with Electron Forge Vite, using ssh2's built-in agent support for SSH agent authentication, and leveraging ssh2's Stats class methods for file type detection.

**Primary recommendation:** Use ssh2 in main process with promise wrappers, expose minimal IPC surface, store connections in electron-conf with passwords/passphrases in safeStorage.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ssh2 | ^1.17.0 | SSH/SFTP client | Pure JS, 5.4M weekly downloads, supports all auth methods, built-in SFTP |
| ssh-config | ^5.0.4 | Parse ~/.ssh/config | 93K weekly downloads, TypeScript, preserves comments/whitespace |
| electron-conf | ^1.2.x | Persist custom connections | CommonJS + ESM support, works with Electron Forge Vite |
| safeStorage | (Electron built-in) | Secure credential storage | macOS Keychain integration, no external deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/ssh2 | ^1.15.x | TypeScript types for ssh2 | Always (TypeScript project) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-conf | electron-store | electron-store is ESM-only, can cause issues with Electron Forge Vite; electron-conf supports both |
| ssh2 | ssh2-sftp-client | ssh2-sftp-client is higher-level but removed retry logic in v12; ssh2 gives more control |
| ssh2 | node-ssh | node-ssh is simpler API but fewer features; ssh2 is more mature |

**Installation:**
```bash
npm install ssh2 ssh-config electron-conf
npm install --save-dev @types/ssh2
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   ├── main.ts              # Entry point, window creation
│   ├── ssh/
│   │   ├── ssh-service.ts   # SSH connection management
│   │   ├── sftp-service.ts  # SFTP operations
│   │   ├── config-parser.ts # ~/.ssh/config parsing
│   │   └── types.ts         # SSH-specific types
│   ├── storage/
│   │   ├── connection-store.ts  # electron-conf wrapper
│   │   └── credential-store.ts  # safeStorage wrapper
│   └── ipc/
│       └── ssh-handlers.ts  # IPC handlers for SSH operations
├── preload/
│   └── preload.ts           # Expose minimal SSH API
├── renderer/
│   └── ...                  # React components
└── shared/
    └── types.ts             # Shared IPC types
```

### Pattern 1: Promise-Wrapped SSH Client
**What:** Wrap ssh2's event-based API in promises for cleaner async/await code
**When to use:** All SSH operations
**Example:**
```typescript
// Source: https://github.com/mscdex/ssh2
import { Client, type ConnectConfig } from 'ssh2';

interface ConnectionResult {
  success: boolean;
  error?: string;
}

export function connectSSH(config: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(err));

    conn.connect(config);
  });
}
```

### Pattern 2: Connection State Machine
**What:** Track connection lifecycle stages (idle -> connecting -> authenticating -> ready -> error)
**When to use:** Providing user feedback during connection
**Example:**
```typescript
// Source: Based on CONTEXT.md requirements
type ConnectionState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'authenticating' }
  | { status: 'loading-directory' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

// Emit state changes via IPC for UI updates
```

### Pattern 3: Minimal IPC Surface
**What:** Expose only specific operations, never raw modules
**When to use:** All preload/renderer communication
**Example:**
```typescript
// Source: https://www.electronjs.org/docs/latest/tutorial/security
// CORRECT: Specific operations
const sshAPI = {
  listServers: (): Promise<Server[]> => ipcRenderer.invoke('ssh:list-servers'),
  connect: (serverId: string): Promise<ConnectionResult> => ipcRenderer.invoke('ssh:connect', serverId),
  disconnect: (serverId: string): Promise<void> => ipcRenderer.invoke('ssh:disconnect', serverId),
  listDirectory: (serverId: string, path: string): Promise<FileEntry[]> => ipcRenderer.invoke('ssh:list-directory', serverId, path),
};

// WRONG: Exposing raw capabilities
// ipcRenderer.invoke('ssh:execute', { any: 'config' }) // Don't do this
```

### Pattern 4: Secure Credential Handling
**What:** Store passwords/passphrases encrypted via safeStorage, connection metadata in electron-conf
**When to use:** Persisting custom connections
**Example:**
```typescript
// Source: https://www.electronjs.org/docs/latest/api/safe-storage
import { safeStorage } from 'electron';
import { Conf } from 'electron-conf/main';

const conf = new Conf();

function saveConnection(conn: CustomConnection): void {
  // Store non-sensitive data in electron-conf
  conf.set(`connections.${conn.id}`, {
    host: conn.host,
    port: conn.port,
    username: conn.username,
    authMethod: conn.authMethod,
    keyPath: conn.keyPath,  // Path only, not content
    displayName: conn.displayName,
  });

  // Store password/passphrase in safeStorage
  if (conn.password && safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(conn.password);
    conf.set(`credentials.${conn.id}`, encrypted.toString('base64'));
  }
}
```

### Anti-Patterns to Avoid
- **Exposing ssh2 Client to renderer:** Never pass the connection object to renderer; keep in main process
- **Storing passwords in plain JSON:** Always use safeStorage for sensitive data
- **Blocking main process:** SSH operations are async; don't use synchronous patterns
- **Missing sender validation:** Always validate IPC message senders for security
- **Using try/catch for event errors:** ssh2 is event-based; use error event handlers

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH config parsing | Custom regex parser | ssh-config | Handles all edge cases: wildcards, includes, comments, Match blocks |
| File mode to permissions | Bitwise operations | ssh2 Stats.isDirectory(), etc. | ssh2 provides helper methods on Stats object |
| Keychain access | Native bindings | safeStorage | Built into Electron, cross-platform, no native deps |
| Connection persistence | fs.writeFileSync | electron-conf | Handles atomic writes, migrations, app paths |
| SSH authentication | Custom key loading | ssh2 agent option | Built-in support for OpenSSHAgent and Pageant |

**Key insight:** SSH has decades of edge cases (config parsing, key formats, auth methods). Libraries like ssh2 and ssh-config have solved these. Custom implementations will miss edge cases and create security risks.

## Common Pitfalls

### Pitfall 1: Not Handling SSH Connection Events
**What goes wrong:** Connection hangs or app crashes on connection failure
**Why it happens:** ssh2 is event-based; errors are emitted, not thrown
**How to avoid:** Always listen for 'error', 'close', 'end' events
**Warning signs:** Promise never resolves, no error messages
```typescript
// CORRECT
conn.on('ready', () => resolve(conn));
conn.on('error', (err) => reject(err));
conn.on('close', () => { /* cleanup */ });

// WRONG - no error handling
conn.connect(config);
// Promise hangs if connection fails
```

### Pitfall 2: SSH Config First Match Semantics
**What goes wrong:** Configuration values not working as expected
**Why it happens:** SSH config uses first-match semantics; later entries don't override
**How to avoid:** Use ssh-config's `.compute(host)` to get effective settings
**Warning signs:** User's custom settings seem ignored
```typescript
// Source: https://github.com/cyjake/ssh-config
// CORRECT: Use compute() to get merged settings
const config = SSHConfig.parse(fileContent);
const settings = config.compute('my-server');

// WRONG: Using first match only
const host = config.find({ Host: 'my-server' });
```

### Pitfall 3: Blocking Main Thread with Keychain Access
**What goes wrong:** App freezes during connection
**Why it happens:** macOS Keychain access can block while waiting for user input
**How to avoid:** Check safeStorage.isEncryptionAvailable() first; use async patterns
**Warning signs:** App unresponsive when connecting

### Pitfall 4: Exposing IPC Event Objects
**What goes wrong:** Security vulnerability
**Why it happens:** Renderer can access sender metadata
**How to avoid:** Wrap callbacks to only pass data, not event objects
**Warning signs:** Renderer code accessing `event.sender`
```typescript
// Source: https://www.electronjs.org/docs/latest/tutorial/security
// CORRECT
onConnectionStateChange: (callback) =>
  ipcRenderer.on('ssh:state-change', (_event, state) => callback(state))

// WRONG - exposes event object
onConnectionStateChange: (callback) =>
  ipcRenderer.on('ssh:state-change', callback)
```

### Pitfall 5: Missing File Attributes in readdir
**What goes wrong:** Need to call stat() for each file, very slow
**Why it happens:** Not using attrs already returned by readdir
**How to avoid:** Use attrs.mode and Stats helpers directly
**Warning signs:** N+1 stat calls per directory
```typescript
// Source: https://github.com/mscdex/ssh2/blob/master/SFTP.md
// readdir returns: { filename, longname, attrs }
// attrs includes: mode, uid, gid, size, atime, mtime
// Use Stats methods: isDirectory(), isFile(), isSymbolicLink()
```

### Pitfall 6: Not Handling Symlinks Correctly
**What goes wrong:** Symlinks appear as regular files or directories
**Why it happens:** stat() follows symlinks; need lstat() for link metadata
**How to avoid:** Use lstat() and readlink() for proper symlink handling
**Warning signs:** User can't tell what's a symlink
```typescript
// Source: https://github.com/mscdex/ssh2/blob/master/SFTP.md
// For symlinks, readdir gives attrs of the link itself
// Use lstat() if you need to stat a path and preserve symlink info
// Use readlink() to get the target path
```

## Code Examples

Verified patterns from official sources:

### SSH Key Authentication
```typescript
// Source: https://github.com/mscdex/ssh2
import { Client } from 'ssh2';
import { readFileSync } from 'fs';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    // Use sftp for file operations
  });
}).connect({
  host: '192.168.100.100',
  port: 22,
  username: 'user',
  privateKey: readFileSync('/path/to/key'),
  // Optional: passphrase for encrypted key
  passphrase: 'key-passphrase',
});
```

### SSH Agent Authentication (macOS)
```typescript
// Source: https://github.com/mscdex/ssh2
conn.connect({
  host: 'server.example.com',
  port: 22,
  username: 'user',
  agent: process.env.SSH_AUTH_SOCK,  // macOS/Linux
  // agentForward: true  // Enable agent forwarding if needed
});
```

### Password Authentication
```typescript
// Source: https://github.com/mscdex/ssh2
conn.connect({
  host: 'server.example.com',
  port: 22,
  username: 'user',
  password: 'secret',  // Retrieved from safeStorage
});
```

### SFTP Directory Listing with Metadata
```typescript
// Source: https://github.com/mscdex/ssh2/blob/master/SFTP.md
sftp.readdir('/path/to/dir', (err, list) => {
  if (err) throw err;

  // list is: Array<{ filename, longname, attrs }>
  // attrs: { mode, uid, gid, size, atime, mtime }

  const files = list.map(item => ({
    name: item.filename,
    size: item.attrs.size,
    modified: new Date(item.attrs.mtime * 1000),
    isDirectory: (item.attrs.mode & 0o40000) !== 0,  // S_IFDIR
    isSymlink: (item.attrs.mode & 0o120000) === 0o120000,  // S_IFLNK
    permissions: '0' + (item.attrs.mode & 0o777).toString(8),
    uid: item.attrs.uid,
    gid: item.attrs.gid,
  }));
});
```

### Parse SSH Config
```typescript
// Source: https://github.com/cyjake/ssh-config
import SSHConfig from 'ssh-config';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const configPath = join(homedir(), '.ssh', 'config');
const configContent = readFileSync(configPath, 'utf-8');
const config = SSHConfig.parse(configContent);

// Get all hosts
const hosts = config
  .filter(entry => entry.param === 'Host' && entry.value !== '*')
  .map(entry => ({
    name: entry.value as string,
    ...config.compute(entry.value as string),  // Merged settings
  }));
```

### Secure Credential Storage
```typescript
// Source: https://www.electronjs.org/docs/latest/api/safe-storage
import { safeStorage } from 'electron';

// Check availability (required after app.ready)
if (!safeStorage.isEncryptionAvailable()) {
  throw new Error('Secure storage not available');
}

// Encrypt
const encrypted = safeStorage.encryptString('my-password');
// Store encrypted.toString('base64') in electron-conf

// Decrypt
const encryptedBuffer = Buffer.from(storedBase64, 'base64');
const password = safeStorage.decryptString(encryptedBuffer);
```

### electron-conf Usage
```typescript
// Source: https://github.com/alex8088/electron-conf
import { Conf } from 'electron-conf/main';

interface ConnectionConfig {
  host: string;
  port: number;
  username: string;
  authMethod: 'key' | 'password' | 'agent';
  keyPath?: string;
  displayName?: string;
}

const conf = new Conf<{
  connections: Record<string, ConnectionConfig>;
  credentials: Record<string, string>;  // Base64 encrypted
}>();

// In main process, register for renderer access
conf.registerRendererListener();

// Save
conf.set('connections.server-1', { host: 'example.com', port: 22, ... });

// Read
const connection = conf.get('connections.server-1');

// List all
const allConnections = conf.get('connections') ?? {};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-keytar for credentials | safeStorage | Electron 15 (Sept 2021) | No native dependency, simpler |
| electron-store for persistence | electron-conf (preferred) | 2024 | Better ESM/CJS compatibility |
| ssh2-sftp-client with retry | ssh2 direct + custom retry | v12 (2024) | Retry removed from sftp-client; implement if needed |
| CommonJS modules | ESM modules | Electron 28 + Forge 7.5 | Now supported in Electron Forge Vite |

**Deprecated/outdated:**
- **node-keytar**: Replaced by Electron's built-in safeStorage; no need for native deps
- **electron-store in CommonJS projects**: ESM-only since recent versions; use electron-conf
- **ssh2-sftp-client automatic retry**: Removed in v12; implement custom retry if needed

## Open Questions

Things that couldn't be fully resolved:

1. **SSH key passphrase prompting**
   - What we know: ssh2 accepts passphrase in config; safeStorage can store it
   - What's unclear: Best UX for prompting user for passphrase on encrypted keys
   - Recommendation: Detect encrypted key, prompt via IPC dialog, store passphrase in safeStorage

2. **Host key verification**
   - What we know: ssh2 has hostVerifier callback; can compare fingerprints
   - What's unclear: Where to store known_hosts equivalent, how to prompt user
   - Recommendation: Store accepted fingerprints in electron-conf, prompt on first connect

3. **Connection pooling for multiple sessions**
   - What we know: Multiple simultaneous connections supported per CONTEXT.md
   - What's unclear: Best pattern for managing connection lifecycle across tabs
   - Recommendation: Map of serverId -> Client instance in main process; cleanup on disconnect

## Sources

### Primary (HIGH confidence)
- [ssh2 GitHub README](https://github.com/mscdex/ssh2) - Connection examples, auth methods, agent support
- [ssh2 SFTP.md](https://github.com/mscdex/ssh2/blob/master/SFTP.md) - readdir, attrs, file type detection
- [ssh-config GitHub](https://github.com/cyjake/ssh-config) - v5.0.4, TypeScript, API
- [Electron safeStorage docs](https://www.electronjs.org/docs/latest/api/safe-storage) - Full API, platform behavior
- [Electron Security docs](https://www.electronjs.org/docs/latest/tutorial/security) - IPC best practices
- [electron-conf GitHub](https://github.com/alex8088/electron-conf) - API, renderer usage

### Secondary (MEDIUM confidence)
- [ssh2-sftp-client npm](https://www.npmjs.com/package/ssh2-sftp-client) - v12 breaking changes, retry removal
- [Electron Forge ESM issue #3439](https://github.com/electron/forge/issues/3439) - ESM support status

### Tertiary (LOW confidence)
- Various blog posts about electron-store ESM issues - used to identify electron-conf as alternative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs verified, npm stats confirm popularity
- Architecture: HIGH - Patterns verified from official Electron security docs
- Pitfalls: HIGH - Documented in library issues and official docs

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable libraries)
