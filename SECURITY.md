# Security Policy

## Security Model

Ubuntu File Explorer is designed with security in mind:

### Credential Storage

- Passwords are encrypted using Electron's `safeStorage` API
- On macOS, this uses the system Keychain
- Credentials are never logged or exposed in plaintext
- SSH keys are read directly from disk (not stored by the app)

### Electron Security

- `nodeIntegration: false` — No Node.js in renderer
- `contextIsolation: true` — Isolated JavaScript contexts
- `sandbox: true` — Sandboxed renderer process
- Minimal IPC surface via `contextBridge`

### Electron Fuses

The app uses Electron Fuses for additional hardening:
- `RunAsNode` disabled
- `EnableCookieEncryption` enabled
- `EnableNodeOptionsEnvironmentVariable` disabled
- `EnableNodeCliInspectArguments` disabled
- `EnableEmbeddedAsarIntegrityValidation` enabled
- `OnlyLoadAppFromAsar` enabled

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly (see package.json for contact)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release

### Disclosure Policy

- We will coordinate disclosure timing with you
- Credit will be given in release notes (unless you prefer anonymity)
- We follow responsible disclosure practices

## Known Security Considerations

### SSH Connections

- The app trusts your `~/.ssh/config` settings
- Host key verification follows ssh2 library defaults
- Be cautious when connecting to untrusted servers

### File Operations

- File operations execute on the remote server with your SSH user's permissions
- The app does not perform additional permission checks
- Be careful with delete operations (no recycle bin)

### Local Storage

- Connection history stored in `~/Library/Application Support/ubuntu-file-explorer/`
- Encrypted credentials in separate storage file
- Clear app data to remove all stored information
