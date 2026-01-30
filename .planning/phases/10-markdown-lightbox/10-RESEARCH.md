# Phase 10: Markdown Lightbox - Research

**Researched:** 2026-01-29
**Domain:** React markdown rendering, syntax highlighting, lightbox integration
**Confidence:** HIGH

## Summary

This phase extends the existing image lightbox to support markdown file preview. The project already uses `yet-another-react-lightbox` for images and `react-syntax-highlighter` with the `oneDark` theme for code preview, providing a solid foundation to build upon.

The recommended approach is to use `react-markdown` with `remark-gfm` plugin for GitHub-flavored markdown rendering, integrate with the existing `react-syntax-highlighter` for code blocks, and use `github-markdown-css` for consistent GFM styling. The existing lightbox supports custom slides through its render prop, enabling markdown content to be displayed in the same lightbox infrastructure.

For link handling, a custom anchor component intercepts clicks to route external links to `shell.openExternal()`, relative links to file navigation, and anchor links to in-document scrolling via `scrollIntoView()`.

**Primary recommendation:** Use react-markdown@10 with remark-gfm, integrate existing react-syntax-highlighter (oneDark theme), apply github-markdown-css dark theme, and extend the existing lightbox with a custom slide type.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^10.1.0 | Parse and render markdown as React components | Most popular React markdown renderer, safe by default (no dangerouslySetInnerHTML), 100% GFM compliant with plugin, active maintenance |
| remark-gfm | ^4.0.0 | GitHub-flavored markdown extension | Adds tables, task lists, strikethrough, autolinks - required for GFM compliance |
| github-markdown-css | ^5.8.1 | GFM-matching CSS styles | Official GitHub styling, includes dark theme variant |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-syntax-highlighter | ^16.1.0 | Code block syntax highlighting | Already in project - reuse for markdown code blocks |
| yet-another-react-lightbox | ^3.28.0 | Lightbox component | Already in project - extend with custom slide type |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | marked | Faster but outputs HTML string requiring dangerouslySetInnerHTML - less React-native, XSS concerns |
| react-markdown | markdown-it | More configurable but same HTML output concerns as marked |
| github-markdown-css | Custom CSS | More control but significant effort to match GFM styling |

**Installation:**
```bash
npm install react-markdown remark-gfm github-markdown-css
```

Note: `react-syntax-highlighter` and `yet-another-react-lightbox` already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/components/PreviewPanel/
├── Lightbox.tsx           # Existing - extend to handle markdown slides
├── MarkdownLightbox.tsx   # NEW - markdown content renderer for lightbox
├── MarkdownRenderer.tsx   # NEW - shared markdown rendering component
├── ImagePreview.tsx       # Existing
├── CodePreview.tsx        # Existing - reference for syntax highlighting
└── PreviewPanel.tsx       # Existing - add markdown preview type
```

### Pattern 1: Custom Slide Type in yet-another-react-lightbox
**What:** Extend the lightbox to render markdown content alongside images using custom slide types
**When to use:** When you need non-image content in the lightbox
**Example:**
```typescript
// Source: https://yet-another-react-lightbox.com/examples/custom-slides

// TypeScript module augmentation for custom slide type
declare module "yet-another-react-lightbox" {
  interface GenericSlide {
    type?: "markdown";
    content?: string;
    filename?: string;
  }
}

// Lightbox with custom render function
<Lightbox
  open={open}
  close={onClose}
  slides={slides}  // Can include { type: "markdown", content: "...", filename: "README.md" }
  render={{
    slide: ({ slide }) => {
      if (slide.type === "markdown") {
        return <MarkdownSlide content={slide.content} filename={slide.filename} />;
      }
      return undefined;  // Fall back to default image rendering
    },
  }}
/>
```

### Pattern 2: react-markdown with Syntax Highlighting
**What:** Integrate react-syntax-highlighter with react-markdown via custom code component
**When to use:** Always for markdown with code blocks
**Example:**
```typescript
// Source: https://github.com/remarkjs/react-markdown, verified with project's CodePreview.tsx

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </Markdown>
  );
}
```

### Pattern 3: Custom Link Handler for Electron
**What:** Intercept link clicks to route appropriately (external, relative, anchor)
**When to use:** In any Electron app rendering user-provided markdown
**Example:**
```typescript
// Source: Combined from WebSearch results and Electron best practices

import { shell } from 'electron';  // In preload/main
// Or via IPC: window.electronAPI.openExternal(url)

interface CustomLinkProps {
  href?: string;
  children?: React.ReactNode;
  node?: unknown;
}

function CustomLink({ href, children }: CustomLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!href) return;

    // Anchor links - scroll within document
    if (href.startsWith('#')) {
      e.preventDefault();
      const id = href.slice(1);
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // External links - open in system browser
    if (href.startsWith('http://') || href.startsWith('https://')) {
      e.preventDefault();
      window.electronAPI.openExternal(href);
      return;
    }

    // Relative links - handle file navigation
    if (!href.startsWith('/')) {
      e.preventDefault();
      // Resolve relative to current markdown file's directory
      // Then navigate or open in lightbox if .md
      onNavigateToFile(href);
      return;
    }
  };

  return (
    <a href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
```

### Pattern 4: Scrollable Content in Fixed Lightbox
**What:** CSS pattern for scrollable markdown content within fixed-size lightbox
**When to use:** When content can exceed lightbox height
**Example:**
```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-y */

.markdown-lightbox {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 80vh;  /* Match image lightbox sizing */
}

.markdown-lightbox__header {
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.markdown-lightbox__content {
  flex: 1;
  overflow-y: auto;  /* Scroll when content exceeds height */
  padding: 24px 32px;
}
```

### Anti-Patterns to Avoid
- **Using dangerouslySetInnerHTML:** react-markdown renders to React components safely; don't bypass this with raw HTML output from marked/markdown-it
- **Processing markdown on every render:** Memoize the parsed result if content doesn't change
- **Blocking the main thread for large files:** Consider async rendering with MarkdownAsync for very large files
- **Inline styles in markdown-body:** Use github-markdown-css classes consistently

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom regex/string parsing | react-markdown | Edge cases in markdown spec are numerous (nested lists, code in lists, etc.) |
| GFM extensions | Manual table/checkbox parsing | remark-gfm plugin | Tables, task lists, strikethrough all have subtle rules |
| GFM styling | Custom CSS from scratch | github-markdown-css | Headers, code blocks, tables, blockquotes all need coordinated styling |
| Syntax highlighting | Custom tokenizer | react-syntax-highlighter | Language support, theme consistency, edge cases |
| URL sanitization | Custom filter | react-markdown's defaultUrlTransform | XSS prevention requires expertise |

**Key insight:** Markdown parsing has decades of edge cases. Even "simple" markdown like nested lists with code blocks requires careful handling. Libraries have solved this; hand-rolling will miss cases.

## Common Pitfalls

### Pitfall 1: Code Block Language Detection Mismatch
**What goes wrong:** Syntax highlighting doesn't apply because language class format differs
**Why it happens:** react-markdown adds `language-xxx` class, but your code component expects different format
**How to avoid:** Use regex to extract language: `/language-(\w+)/.exec(className || '')`
**Warning signs:** Code blocks render but without highlighting

### Pitfall 2: External Links Opening In-App
**What goes wrong:** Clicking http links navigates the Electron webview instead of opening browser
**Why it happens:** Default anchor behavior in Electron stays in-app
**How to avoid:** Custom link component that calls `shell.openExternal()` for http(s) URLs
**Warning signs:** App navigates away from file browser when clicking docs links

### Pitfall 3: Images in Markdown Not Loading
**What goes wrong:** Remote images referenced in markdown (e.g., `![](https://...)`) don't display
**Why it happens:** Content Security Policy blocks external images, or relative paths don't resolve
**How to avoid:**
- For external images: Ensure CSP allows image sources or fetch through main process
- For relative images: Resolve paths relative to markdown file's directory, fetch via SSH
**Warning signs:** Broken image icons in rendered markdown

### Pitfall 4: Anchor Links Not Working
**What goes wrong:** Clicking `#heading` links does nothing
**Why it happens:** Need to generate IDs for headings and handle scroll manually
**How to avoid:** Use custom heading components that add IDs (slugified from heading text), custom link handler for anchor scrolls
**Warning signs:** Hash links visible in rendered markdown but non-functional

### Pitfall 5: Lightbox Navigation Includes Non-Previewable Files
**What goes wrong:** Arrow keys navigate to files that can't be previewed
**Why it happens:** Navigation filters not updated for new previewable types
**How to avoid:** Update previewable file filter to include `.md` alongside image extensions
**Warning signs:** Navigate to .md file, lightbox shows error or empty

### Pitfall 6: Dark Theme Not Applying to Markdown Body
**What goes wrong:** Markdown renders with light background despite dark app theme
**Why it happens:** github-markdown-css requires explicit dark mode class or CSS variable
**How to avoid:** Import `github-markdown-dark.css` or apply `data-theme="dark"` attribute
**Warning signs:** White background in markdown area clashing with dark app

## Code Examples

Verified patterns from official sources:

### GitHub-Markdown-CSS Dark Theme Integration
```typescript
// Source: https://github.com/sindresorhus/github-markdown-css

// Option 1: Import dark-only CSS
import 'github-markdown-css/github-markdown-dark.css';

// Option 2: Use auto-switching CSS with prefers-color-scheme
import 'github-markdown-css/github-markdown.css';

// Apply class to container
<div className="markdown-body">
  <Markdown>{content}</Markdown>
</div>
```

### Complete Markdown Component with All Features
```typescript
// Combines: react-markdown, remark-gfm, syntax highlighting, custom links

import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'github-markdown-css/github-markdown-dark.css';

interface MarkdownRendererProps {
  content: string;
  basePath: string;  // Directory of the markdown file for relative links
  onNavigate: (path: string) => void;
  onOpenExternal: (url: string) => void;
}

export function MarkdownRenderer({
  content,
  basePath,
  onNavigate,
  onOpenExternal
}: MarkdownRendererProps) {

  const components = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    a({ href, children }: { href?: string; children?: React.ReactNode }) {
      const handleClick = (e: React.MouseEvent) => {
        if (!href) return;

        if (href.startsWith('#')) {
          e.preventDefault();
          const element = document.getElementById(href.slice(1));
          element?.scrollIntoView({ behavior: 'smooth' });
          return;
        }

        if (href.startsWith('http://') || href.startsWith('https://')) {
          e.preventDefault();
          onOpenExternal(href);
          return;
        }

        // Relative link
        e.preventDefault();
        const resolvedPath = resolvePath(basePath, href);
        onNavigate(resolvedPath);
      };

      return <a href={href} onClick={handleClick}>{children}</a>;
    },

    // Add IDs to headings for anchor links
    h1: ({ children, ...props }: any) => (
      <h1 id={slugify(children)} {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 id={slugify(children)} {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 id={slugify(children)} {...props}>{children}</h3>
    ),
  }), [basePath, onNavigate, onOpenExternal]);

  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}

function slugify(text: any): string {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

function resolvePath(base: string, relative: string): string {
  if (relative.startsWith('/')) return relative;
  const baseParts = base.split('/').slice(0, -1);  // Remove filename
  const relParts = relative.split('/');
  for (const part of relParts) {
    if (part === '..') baseParts.pop();
    else if (part !== '.') baseParts.push(part);
  }
  return baseParts.join('/') || '/';
}
```

### Lightbox Custom Slide Type Declaration
```typescript
// Source: https://yet-another-react-lightbox.com/examples/custom-slides

// Add to a .d.ts file or at top of Lightbox.tsx
declare module "yet-another-react-lightbox" {
  interface GenericSlide {
    type?: "image" | "markdown";
  }

  interface MarkdownSlide {
    type: "markdown";
    content: string;
    filename: string;
    basePath: string;
  }

  interface SlideTypes {
    markdown: MarkdownSlide;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| marked + dangerouslySetInnerHTML | react-markdown (React components) | 2019+ | Safer, more React-native, easier customization |
| highlight.js | Prism via react-syntax-highlighter | 2020+ | Better JSX/TSX support, more themes |
| Manual GFM implementation | remark-gfm plugin | 2021+ | Standard, maintained, spec-compliant |
| @types/react-markdown | Built-in TypeScript | v9+ | No separate types package needed |

**Deprecated/outdated:**
- `rehype-raw`: Only needed if you have raw HTML in markdown that must be preserved (security risk)
- `@types/react-markdown`: Types now included in react-markdown package
- `remark-footnotes`: Merged into remark-gfm

## Open Questions

Things that couldn't be fully resolved:

1. **Remote images in markdown over SSH**
   - What we know: Markdown may contain relative image paths or external URLs
   - What's unclear: How to efficiently fetch relative images via existing SSH connection
   - Recommendation: Start with external URLs working (CSP permitting), add relative image resolution as enhancement. Could proxy through main process or convert to data URLs.

2. **Very large markdown files**
   - What we know: react-markdown has sync and async variants
   - What's unclear: Performance threshold where async matters
   - Recommendation: Use sync rendering initially (matching existing code preview), add async if performance issues arise with large files.

3. **Table of contents / document outline**
   - What we know: Not in requirements, but related to anchor navigation
   - What's unclear: Whether users would want a TOC sidebar
   - Recommendation: Out of scope for this phase, but heading IDs enable future TOC feature.

## Sources

### Primary (HIGH confidence)
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - API, usage, components prop
- [yet-another-react-lightbox custom slides](https://yet-another-react-lightbox.com/examples/custom-slides) - Custom slide rendering pattern
- [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) - v5.8.1, dark theme, usage
- Project codebase: CodePreview.tsx confirms oneDark theme usage, Lightbox.tsx confirms lightbox patterns

### Secondary (MEDIUM confidence)
- [react-syntax-highlighter available styles](https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_STYLES_PRISM.MD) - Theme list verified
- [Syntax highlighting integration](https://hannadrehman.com/blog/enhancing-your-react-markdown-experience-with-syntax-highlighting) - Code component pattern
- [MDN overflow-y](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-y) - Scroll container pattern

### Tertiary (LOW confidence)
- WebSearch results on Electron external link handling - Pattern known but specific API should be verified against Electron 40 docs
- WebSearch results on anchor scrolling - scrollIntoView is standard but behavior options should be tested

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-markdown and remark-gfm are clearly the standard, verified via multiple sources
- Architecture: HIGH - Custom slide pattern from official docs, matches existing codebase patterns
- Pitfalls: MEDIUM - Based on common issues reported, but specific project context may vary

**Research date:** 2026-01-29
**Valid until:** 60 days (stable libraries, no major changes expected)
