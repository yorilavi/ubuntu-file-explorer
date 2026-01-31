# Contributing to Ubuntu File Explorer

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- macOS (for testing Electron features)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yorilavi/ubuntu-file-explorer.git
cd ubuntu-file-explorer

# Install dependencies
npm install

# Start development server
npm start
```

The app will launch with hot module replacement enabled.

### Project Structure

```
src/
├── main/           # Electron main process
│   ├── ssh/        # SSH/SFTP services
│   ├── storage/    # Persistence (electron-conf)
│   └── main.ts     # Entry point
├── preload/        # Preload scripts (IPC bridge)
├── renderer/       # React application
│   ├── components/ # React components
│   └── App.tsx     # Root component
└── shared/         # Shared types
```

## Code Style

- **TypeScript** — All code must be typed
- **React** — Functional components with hooks
- **ESLint** — Run `npm run lint` before committing

### Naming Conventions

- Components: `PascalCase` (e.g., `FileItem.tsx`)
- Utilities: `camelCase` (e.g., `formatBytes.ts`)
- Types: `PascalCase` (e.g., `FileEntry`)
- CSS: Component-scoped (e.g., `FileItem.css`)

## Making Changes

### Branch Naming

- `feat/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation
- `refactor/description` — Code refactoring

### Commit Messages

Follow conventional commits:

```
feat: add folder download progress indicator
fix: resolve SSH connection timeout issue
docs: update README with new shortcuts
refactor: extract file preview logic
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run `npm run lint` and fix any issues
5. Test your changes manually
6. Submit a pull request

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Changes are tested manually
- [ ] Documentation updated if needed
- [ ] No console.log debugging statements
- [ ] TypeScript compiles without errors

## Testing

Currently, testing is manual. When testing changes:

1. Test with multiple SSH servers if possible
2. Test with both key and password authentication
3. Test file operations (upload, download, rename, delete)
4. Test with large directories (1000+ files)
5. Test keyboard navigation

## Reporting Issues

### Bug Reports

Include:
- macOS version
- App version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

### Feature Requests

Describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Questions?

Open a [GitHub Discussion](https://github.com/yorilavi/ubuntu-file-explorer/discussions) for questions or ideas.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
