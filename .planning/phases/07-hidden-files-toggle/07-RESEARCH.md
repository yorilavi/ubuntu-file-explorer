# Phase 7: Hidden Files Toggle - Research

**Researched:** 2026-01-29
**Domain:** React state management, Electron persistence, CSS animations, keyboard shortcuts
**Confidence:** HIGH

## Summary

This phase implements a hidden files toggle feature that follows macOS Finder conventions. The research found that the existing codebase already has:
1. A `showHidden` state in App.tsx with a basic checkbox toggle
2. Filtering logic in ColumnView.tsx that checks `showHidden` prop
3. A well-established pattern for persistent UI preferences using `electron-conf`
4. Existing patterns for keyboard event handling in App.tsx

The implementation requires enhancing the existing toggle with: (1) proper Cmd+Shift+. keyboard shortcut, (2) persistence via electron-conf, (3) improved UI with a toolbar button, (4) CSS fade animation for smooth appearance transitions, and (5) dimmed styling for hidden files when visible.

**Primary recommendation:** Extend the existing `ui-preferences-store.ts` pattern to persist `showHiddenFiles`, replace the checkbox with a toolbar button, and add keyboard shortcut handling in App.tsx following the existing lightbox keyboard pattern.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-conf | ^1.3.0 | Persistent storage | Already used for UI preferences |
| React | ^19.2.4 | UI framework | Project standard |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS transitions | N/A | Fade animations | Native browser support, performant |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS transitions | Framer Motion | Overkill for simple opacity fades; adds 50KB+ |
| Raw useEffect | react-hotkeys-hook | Library adds overhead for single shortcut |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Integration Points
```
src/
  main/
    storage/
      ui-preferences-store.ts  # ADD: showHiddenFiles getter/setter
    ipc/
      ui-preferences-handlers.ts  # ADD: IPC handlers for showHiddenFiles
  preload/
    preload.ts  # ADD: getShowHiddenFiles, setShowHiddenFiles API
  renderer/
    App.tsx  # MODIFY: keyboard shortcut, load/save preference
    components/
      HiddenFilesToggle.tsx  # NEW: toolbar toggle button component
      FileItem.tsx  # MODIFY: add dimmed class for hidden files
      FileItem.css  # MODIFY: add .file-item--hidden styles
      ColumnView/
        ColumnView.tsx  # MODIFY: pass isHidden flag to FileItem
```

### Pattern 1: Persistent UI Preference
**What:** Store preference in electron-conf, expose via IPC, load on app mount
**When to use:** Any user preference that should persist across sessions
**Example:**
```typescript
// ui-preferences-store.ts
export function getShowHiddenFiles(): boolean {
  return conf.get('showHiddenFiles') ?? false; // Default: hidden
}

export function setShowHiddenFiles(show: boolean): void {
  conf.set('showHiddenFiles', show);
}
```

### Pattern 2: Keyboard Shortcut with useEffect
**What:** Global keyboard listener in App.tsx
**When to use:** App-wide shortcuts that work regardless of focus
**Example:**
```typescript
// App.tsx - following existing lightbox pattern
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Shift+. (Period) - Toggle hidden files
    if (e.metaKey && e.shiftKey && e.code === 'Period') {
      e.preventDefault();
      setShowHidden(prev => !prev);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Pattern 3: CSS Opacity Transition for Fade
**What:** GPU-accelerated opacity animation
**When to use:** Smooth appearance/disappearance of elements
**Example:**
```css
/* FileItem.css */
.file-item {
  transition: opacity 150ms ease-out;
}

.file-item--hidden {
  opacity: 0.5;
}

/* For fade-in effect when hidden files appear */
.file-item--appearing {
  animation: fadeIn 150ms ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 0.5; }
}
```

### Anti-Patterns to Avoid
- **Storing preference only in React state:** Lost on refresh/restart
- **Using transform: scale(0) for hiding:** Breaks layout, poor animation
- **Multiple keyboard listeners across components:** Creates conflicts, use centralized handler
- **Filtering on every keystroke:** Use memoization or filter only when preference changes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persisting preferences | localStorage | electron-conf | Electron apps should use app.getPath('userData'); localStorage can lose data |
| Hidden file detection | Complex regex | Simple `.startsWith('.')` + array lookup | Dotfiles are consistent; system files are finite list |
| Keyboard shortcuts | Custom keybinding system | useEffect with event listener | Single shortcut doesn't need a library |

**Key insight:** This feature is self-contained and straightforward. The existing patterns in the codebase are sufficient; no external libraries needed.

## Common Pitfalls

### Pitfall 1: Keyboard Shortcut Not Working
**What goes wrong:** Cmd+Shift+. doesn't trigger toggle
**Why it happens:**
- Input field has focus (shortcut should be global)
- Wrong key code used (`'.'` vs `'Period'`)
- Event not prevented, browser intercepts
**How to avoid:**
- Use `e.code === 'Period'` not `e.key === '.'`
- Always call `e.preventDefault()` when handling
- Skip shortcut when focus is in input/textarea (check `e.target`)
**Warning signs:** Shortcut works sometimes but not always

### Pitfall 2: Flash of Hidden Files on Load
**What goes wrong:** Hidden files briefly appear then disappear on app start
**Why it happens:** React state defaults to `false`, loads preference async
**How to avoid:**
- Load preference before first render (use loading state)
- Or default to `null` and only render columns after preference loaded
**Warning signs:** Brief flicker of dotfiles in column view on startup

### Pitfall 3: Columns Not Refreshing
**What goes wrong:** Toggle state changes but columns show stale data
**Why it happens:** ColumnView filtering happens on fetch, not on state change
**How to avoid:**
- Re-filter entries when showHidden changes (already implemented)
- Ensure ColumnView re-renders when prop changes
**Warning signs:** Need to navigate away and back for toggle to take effect

### Pitfall 4: Opacity Animation Janky
**What goes wrong:** Fade animation stutters or doesn't animate
**Why it happens:**
- Animating `display` or `visibility` instead of `opacity`
- Layout thrashing from changing height/width
**How to avoid:**
- Only animate `opacity` and `transform` (GPU accelerated)
- Don't remove elements from DOM, just fade them
**Warning signs:** Animation skips frames or elements pop in/out

### Pitfall 5: System File List Incomplete
**What goes wrong:** Some system files still visible (or hidden when shouldn't be)
**Why it happens:** Different platforms have different system files
**How to avoid:**
- Start with well-known list: `.DS_Store`, `Thumbs.db`, `desktop.ini`, `.Spotlight-V100`, `.Trashes`, `.fseventsd`, `._*`
- Log any unexpected files users report
**Warning signs:** Users report seeing `.DS_Store` or similar in their listings

## Code Examples

Verified patterns from official sources and existing codebase:

### Loading Preference on Mount
```typescript
// App.tsx
const [showHidden, setShowHidden] = useState<boolean | null>(null);

useEffect(() => {
  window.electronAPI.getShowHiddenFiles().then(setShowHidden);
}, []);

// Save when changed
const handleToggleHidden = useCallback(() => {
  setShowHidden(prev => {
    const newValue = !prev;
    window.electronAPI.setShowHiddenFiles(newValue);
    return newValue;
  });
}, []);
```

### Keyboard Shortcut Handler
```typescript
// App.tsx - add to existing keydown effect or create new one
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Skip if typing in input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Cmd+Shift+. (Period)
    if (e.metaKey && e.shiftKey && e.code === 'Period') {
      e.preventDefault();
      handleToggleHidden();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleToggleHidden]);
```

### Hidden File Detection
```typescript
// ColumnView.tsx or utility function
const SYSTEM_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '.Spotlight-V100',
  '.Trashes',
  '.fseventsd',
  '.TemporaryItems',
  '.VolumeIcon.icns',
  '.AppleDouble',
  '.LSOverride',
]);

function isHiddenFile(name: string): boolean {
  // Dotfiles
  if (name.startsWith('.')) return true;
  // System files
  if (SYSTEM_FILES.has(name)) return true;
  // macOS resource forks
  if (name.startsWith('._')) return true;
  return false;
}
```

### CSS Fade Animation
```css
/* FileItem.css */
.file-item {
  /* Existing styles... */
  transition: opacity 150ms ease-out;
}

.file-item--hidden {
  opacity: 0.5;
}

/* Fade-in when appearing */
.file-item--fade-in {
  animation: fileItemFadeIn 200ms ease-out forwards;
}

@keyframes fileItemFadeIn {
  from {
    opacity: 0;
    transform: translateX(-4px);
  }
  to {
    opacity: 0.5;
    transform: translateX(0);
  }
}
```

### Toolbar Toggle Button
```typescript
// HiddenFilesToggle.tsx
interface Props {
  showHidden: boolean;
  onToggle: () => void;
}

function HiddenFilesToggle({ showHidden, onToggle }: Props): React.JSX.Element {
  return (
    <button
      className={`hidden-toggle ${showHidden ? 'hidden-toggle--active' : ''}`}
      onClick={onToggle}
      title="Toggle hidden files (Cmd+Shift+.)"
      aria-pressed={showHidden}
    >
      {/* Eye icon - filled when active */}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        {showHidden ? (
          // Eye open icon
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        ) : (
          // Eye closed icon
          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
        )}
      </svg>
    </button>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for preferences | electron-conf/electron-store | 2020+ | More reliable, platform-native location |
| jQuery keydown | useEffect with cleanup | React 16.8+ | Proper lifecycle management |
| CSS display:none for hiding | opacity transitions | CSS3+ | Smooth animations, GPU accelerated |

**Deprecated/outdated:**
- Using `e.keyCode` instead of `e.code` or `e.key` (keyCode is deprecated)
- Storing preferences in app bundle (gets wiped on update)

## Open Questions

Things that couldn't be fully resolved:

1. **Exact animation timing**
   - What we know: 150-200ms is standard for micro-interactions
   - What's unclear: User preference for "snappier" vs "smoother" feel
   - Recommendation: Start with 150ms, easy to adjust

2. **Icon choice for toggle button**
   - What we know: Eye icon is standard for visibility toggles
   - What's unclear: Exact icon style that matches app aesthetic
   - Recommendation: Use simple eye icon (open/closed states), style to match existing toolbar

3. **Filter behavior for symlinks to hidden targets**
   - What we know: Symlinks have their own visibility
   - What's unclear: Should a visible symlink to a hidden file be filtered?
   - Recommendation: Filter based on the symlink's own name, not target

## Sources

### Primary (HIGH confidence)
- Existing codebase: `ui-preferences-store.ts`, `App.tsx`, `ColumnView.tsx` patterns
- MDN Web Docs: [Using CSS transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transitions/Using)

### Secondary (MEDIUM confidence)
- [How-To Geek: What Are thumbs.db, desktop.ini, and .DS_Store Files?](https://www.howtogeek.com/237091/what-are-the-thumbs.db-desktop-ini-and-.ds_store-files/)
- [macOS Keyboard Shortcut to Show Hidden Files](https://velvetshark.com/til/macos-keyboard-shortcut-show-hidden-files)
- [electron-conf GitHub](https://github.com/alex8088/electron-conf)
- [Ten tips for better CSS transitions and animations](https://joshcollinsworth.com/blog/great-transitions)

### Tertiary (LOW confidence)
- Various React keyboard shortcut tutorials (patterns verified against existing codebase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project patterns, no new dependencies
- Architecture: HIGH - Clear integration points, follows established patterns
- Pitfalls: HIGH - Common issues well-documented, mitigations clear
- Animation timing: MEDIUM - Standard values, may need user feedback adjustment

**Research date:** 2026-01-29
**Valid until:** 60 days (stable domain, no fast-moving dependencies)
