# Ubuntu File Explorer

A macOS Finder-like file explorer for browsing remote Ubuntu/Linux servers via SSH/SFTP.

![Ubuntu File Explorer](docs/screenshot.png)

## Features

- **Miller Column Navigation** — Browse remote servers with a familiar Finder-style interface
- **SSH/SFTP Connection** — Connect using your existing `~/.ssh/config` or add custom connections
- **Key & Password Auth** — Support for SSH key authentication and encrypted password storage
- **Instant Previews** — Preview images, code, markdown, and PDF files without downloading
- **Syntax Highlighting** — Code preview with syntax highlighting for 100+ languages
- **Lightbox Viewer** — Full-screen viewing for images, markdown, and PDFs with keyboard navigation
- **File Operations** — Download, upload, rename, delete, and move files
- **Folder Transfer** — Upload and download entire folders with progress tracking
- **Per-Server Favorites** — Bookmark frequently accessed folders for each server
- **Hidden Files Toggle** — Show/hide dotfiles with `Cmd+Shift+.`
- **Large File Support** — Stream and virtualize files with 10,000+ lines

## Requirements

- macOS 12.0 (Monterey) or later
- SSH access to remote servers

## Installation

### Download

Download the latest `.dmg` from [Releases](https://github.com/yorilavi/ubuntu-file-explorer/releases).

### Build from Source

```bash
# Clone the repository
git clone https://github.com/yorilavi/ubuntu-file-explorer.git
cd ubuntu-file-explorer

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run make
```

The built app will be in the `out/` directory.

## SSH Configuration

Ubuntu File Explorer reads your `~/.ssh/config` file to list available servers. Example config:

```
Host myserver
    HostName 192.168.1.100
    User ubuntu
    IdentityFile ~/.ssh/id_rsa

Host production
    HostName prod.example.com
    User deploy
    Port 2222
```

You can also add custom connections directly in the app.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` `↓` | Navigate files |
| `←` `→` | Navigate columns |
| `Enter` | Open folder / Select file |
| `Space` | Open lightbox (images, markdown, PDF) |
| `Escape` | Close lightbox / Cancel operation |
| `Cmd+Shift+.` | Toggle hidden files |
| `Delete` | Delete selected file |

### In Lightbox

| Shortcut | Action |
|----------|--------|
| `←` `→` | Previous/next file |
| `↑` `↓` | Previous/next page (PDF) |
| `Escape` | Close lightbox |

## Tech Stack

- [Electron](https://www.electronjs.org/) — Cross-platform desktop framework
- [React 19](https://react.dev/) — UI framework
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript
- [Vite](https://vitejs.dev/) — Fast build tool with HMR
- [ssh2](https://github.com/mscdex/ssh2) — SSH/SFTP client
- [react-pdf](https://github.com/wojtekmaj/react-pdf) — PDF rendering
- [Shiki](https://shiki.style/) — Syntax highlighting

## Security

- Credentials encrypted via macOS Keychain (Electron safeStorage)
- Sandboxed renderer process
- Context isolation enabled
- No node integration in renderer

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
