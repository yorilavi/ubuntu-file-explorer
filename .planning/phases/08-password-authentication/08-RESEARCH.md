# Phase 8: Password Authentication - Research

**Researched:** 2026-01-29
**Domain:** SSH password authentication, Electron secure storage, React form patterns
**Confidence:** HIGH

## Summary

This phase extends the existing SSH connection system to fully support password authentication. The codebase already has the foundation in place: `ssh2` natively supports password auth via the `password` config option, the `credential-store.ts` already uses Electron's `safeStorage` API for secure password storage, and the `AddConnectionModal.tsx` already has auth method selection and password field.

The implementation gap is primarily in the UI layer: adding password visibility toggle, implementing "Save password?" checkbox, handling stored password indicators (placeholder dots), and adding "Clear saved password" functionality. The backend changes are minimal - mainly adding IPC handlers to check for stored credentials and delete them separately from connections.

**Primary recommendation:** Enhance the existing UI components with the decided UX patterns (eye toggle, save checkbox, placeholder dots for stored passwords) while leveraging the fully functional backend that already exists.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ssh2 | 1.17.0 | SSH connection with password auth | Already in use, native password support via `password` config property |
| electron safeStorage | built-in | Encrypt passwords using OS keychain | Already implemented in credential-store.ts |
| electron-conf | 1.3.0 | Persist connection settings | Already in use for connection-store.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React useState | built-in | Password visibility toggle state | Already the pattern used in form components |
| CSS (no library) | N/A | Eye icon button styling | Matches existing form-field styling approach |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-only eye icons | Icon library (lucide-react) | CSS is lighter, but icon library would be more consistent if app adds icons elsewhere |
| In-memory password only | Always prompt on connect | Current approach (save optional) balances convenience and security |

**Installation:**
No new packages needed - all dependencies already present.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   └── storage/
│       └── credential-store.ts    # Already exists, handles safeStorage
├── renderer/
│   └── components/
│       └── AddConnectionModal.tsx # Enhance with eye toggle, save checkbox
└── preload/
    └── preload.ts                 # Add hasCredential IPC binding
```

### Pattern 1: Password Field with Visibility Toggle
**What:** Input field that toggles between `type="password"` and `type="text"` with eye icon button
**When to use:** Any password input field
**Example:**
```typescript
// Source: React password toggle pattern (common practice)
const [showPassword, setShowPassword] = useState(false);

<div className="form-field__input-wrapper">
  <input
    type={showPassword ? 'text' : 'password'}
    value={password}
    onChange={handleChange}
    placeholder={hasStoredPassword ? '••••••••' : ''}
  />
  <button
    type="button"
    className="form-field__toggle"
    onClick={() => setShowPassword(!showPassword)}
    aria-label={showPassword ? 'Hide password' : 'Show password'}
  >
    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
  </button>
</div>
```

### Pattern 2: Conditional Password Storage with Checkbox
**What:** Checkbox that determines whether password is saved to safeStorage
**When to use:** When saving connection with password auth
**Example:**
```typescript
// Source: Common form pattern
const [savePassword, setSavePassword] = useState(true);

// In submit handler:
if (form.authMethod === 'password') {
  const passwordToSave = savePassword ? form.password : undefined;
  await window.electronAPI.addConnection(connection, passwordToSave);
}
```

### Pattern 3: Stored Password Indicator
**What:** Show placeholder dots when password exists, clear on first keystroke
**When to use:** Editing saved connection with stored password
**Example:**
```typescript
// Source: Clear-and-replace UX pattern
const [passwordModified, setPasswordModified] = useState(false);

const handlePasswordChange = (e) => {
  if (!passwordModified) {
    // First keystroke clears placeholder
    setPasswordModified(true);
    setPassword(e.target.value);
  } else {
    setPassword(e.target.value);
  }
};
```

### Anti-Patterns to Avoid
- **Storing plaintext passwords:** Use safeStorage, never store unencrypted
- **Exposing password in URL/logs:** Never log password values, use redacted placeholders
- **Missing encryption check:** Always call `isEncryptionAvailable()` before storing, warn user if unavailable

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password encryption | Custom encryption | Electron safeStorage API | Uses OS keychain (macOS Keychain, Windows DPAPI), handles key management |
| SSH password auth | Custom auth flow | ssh2 `password` option | Native protocol support, handles authentication handshake |
| Secure storage backend | File-based encryption | electron-conf + safeStorage | Tested, maintained, handles edge cases |

**Key insight:** Password storage security is handled entirely by the OS keychain through safeStorage. The app only calls encrypt/decrypt - no cryptographic code needed.

## Common Pitfalls

### Pitfall 1: Calling safeStorage Before App Ready
**What goes wrong:** `safeStorage.encryptString()` throws if called before `app.whenReady()` resolves
**Why it happens:** Keychain integration requires app to be fully initialized
**How to avoid:** All credential-store.ts functions already call `ensureReady()` - this is handled
**Warning signs:** "Cannot access secure storage before app is ready" error

### Pitfall 2: Storing Password When User Didn't Consent
**What goes wrong:** User expects password forgotten, but it persists
**Why it happens:** No "save password" checkbox, defaults to always save
**How to avoid:** Add explicit checkbox (per CONTEXT.md decision), default to checked but respect user choice
**Warning signs:** User complains password "remembered" without permission

### Pitfall 3: Password Field Not Clearing on Auth Method Switch
**What goes wrong:** Password from password auth leaks to key auth (as passphrase)
**Why it happens:** Form state not reset when switching auth methods
**How to avoid:** Clear password field when `authMethod` changes
**Warning signs:** Key auth attempts with password value

### Pitfall 4: Missing Stored Password Indicator When Editing
**What goes wrong:** User doesn't know password is saved, re-enters unnecessarily
**Why it happens:** Edit form shows empty password field despite stored password
**How to avoid:** Show placeholder dots ("••••••••") when `hasCredential()` is true
**Warning signs:** User confusion about whether password is saved

### Pitfall 5: No Way to Clear Stored Password
**What goes wrong:** User cannot remove stored password without deleting connection
**Why it happens:** No explicit "Clear saved password" functionality
**How to avoid:** Add clear button visible when editing connection with stored password
**Warning signs:** User complaints about password persistence

## Code Examples

Verified patterns from official sources:

### ssh2 Password Authentication
```typescript
// Source: https://github.com/mscdex/ssh2#readme
import { Client, type ConnectConfig } from 'ssh2';

const config: ConnectConfig = {
  host: server.host,
  port: server.port,
  username: server.username,
  password: 'user_password_here',  // Direct password config
};

const client = new Client();
client.connect(config);
```

### Electron safeStorage Encrypt/Decrypt
```typescript
// Source: https://www.electronjs.org/docs/latest/api/safe-storage
import { safeStorage } from 'electron';

// Check availability
if (!safeStorage.isEncryptionAvailable()) {
  throw new Error('Encryption not available');
}

// Encrypt
const encrypted = safeStorage.encryptString('password');
const base64 = encrypted.toString('base64');

// Decrypt
const buffer = Buffer.from(base64, 'base64');
const decrypted = safeStorage.decryptString(buffer);
```

### Eye Icon SVG (CSS-only approach)
```css
/* Source: Common CSS pattern for password toggle */
.form-field__input-wrapper {
  position: relative;
  display: flex;
}

.form-field__toggle {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
}

.form-field__toggle:hover {
  color: #ccc;
}
```

```typescript
// Eye icon components (inline SVG)
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
```

### IPC Handler for hasCredential
```typescript
// Source: Extending existing pattern in ssh-handlers.ts
ipcMain.handle(
  'ssh:has-credential',
  async (_event, connectionId: string): Promise<boolean> => {
    return hasCredential(connectionId);
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-keytar | Electron safeStorage | Electron 13 (2021) | Built-in, no native module compilation needed |
| Always prompt for password | Store with user consent | Current best practice | Balance convenience with user control |

**Deprecated/outdated:**
- node-keytar: Replaced by Electron's built-in safeStorage API

## Open Questions

Things that couldn't be fully resolved:

1. **Edit Connection Modal**
   - What we know: CONTEXT.md mentions editing saved connections with password placeholder
   - What's unclear: Is there an existing edit modal, or is this phase adding it?
   - Recommendation: Check if edit modal exists; if not, plan may need to include it

2. **SSH Config Servers with Password**
   - What we know: SSH config servers are read-only from ~/.ssh/config
   - What's unclear: Should password auth be supported for SSH config servers too?
   - Recommendation: For now, password auth only for custom connections; SSH config typically uses keys

## Sources

### Primary (HIGH confidence)
- ssh2 GitHub README - Password authentication via `password` config option
- Electron safeStorage docs - `encryptString`, `decryptString`, `isEncryptionAvailable` APIs
- Existing codebase - credential-store.ts, ssh-service.ts already implement foundation

### Secondary (MEDIUM confidence)
- React password toggle patterns - Multiple sources agree on useState + type toggle approach
- Password UX patterns - Clear-on-first-keystroke, placeholder dots are common patterns

### Tertiary (LOW confidence)
- Eye icon specific styling - Common patterns but implementation varies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already implemented in codebase
- Architecture: HIGH - Extends existing patterns directly
- Pitfalls: HIGH - Based on actual safeStorage docs and common form pitfalls

**Research date:** 2026-01-29
**Valid until:** 60 days (stable APIs, no expected breaking changes)
