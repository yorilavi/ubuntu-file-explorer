// MarkdownRenderer - Renders GFM markdown with syntax highlighting
// Uses react-markdown with remark-gfm plugin

import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'github-markdown-css/github-markdown-dark.css';

interface MarkdownRendererProps {
  content: string;
  basePath: string;  // Directory of the markdown file
  onNavigate?: (path: string) => void;  // For relative file links
}

/**
 * Slugify text for heading IDs (anchor navigation).
 * Converts "My Heading" to "my-heading"
 */
function slugify(text: React.ReactNode): string {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

/**
 * Resolve a relative path against a base path.
 * resolvePath('/home/user/docs/README.md', '../images/pic.png')
 *   -> '/home/user/images/pic.png'
 */
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

/**
 * Renders GitHub-flavored markdown with:
 * - Syntax highlighting for code blocks (oneDark theme)
 * - External links open in system browser
 * - Anchor links scroll to heading
 * - Relative links call onNavigate callback
 */
export function MarkdownRenderer({
  content,
  basePath,
  onNavigate,
}: MarkdownRendererProps): React.JSX.Element {
  const components = useMemo(() => ({
    // Code block rendering with syntax highlighting
    code({
      className,
      children,
      ...props
    }: {
      className?: string;
      children?: React.ReactNode;
      node?: unknown;
    }) {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;

      return !isInline && match ? (
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

    // Link handling: external, anchor, or relative
    a({
      href,
      children,
    }: {
      href?: string;
      children?: React.ReactNode;
      node?: unknown;
    }) {
      const handleClick = (e: React.MouseEvent) => {
        if (!href) return;

        // Anchor links - scroll within document
        if (href.startsWith('#')) {
          e.preventDefault();
          const element = document.getElementById(href.slice(1));
          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        // External links - open in system browser
        if (href.startsWith('http://') || href.startsWith('https://')) {
          e.preventDefault();
          window.electronAPI.openExternal(href);
          return;
        }

        // Relative links - navigate to file
        if (onNavigate) {
          e.preventDefault();
          const resolvedPath = resolvePath(basePath, href);
          onNavigate(resolvedPath);
        }
      };

      return (
        <a href={href} onClick={handleClick}>
          {children}
        </a>
      );
    },

    // Headings with IDs for anchor navigation
    h1: ({ children, ...props }: { children?: React.ReactNode; node?: unknown }) => (
      <h1 id={slugify(children)} {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: { children?: React.ReactNode; node?: unknown }) => (
      <h2 id={slugify(children)} {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: { children?: React.ReactNode; node?: unknown }) => (
      <h3 id={slugify(children)} {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }: { children?: React.ReactNode; node?: unknown }) => (
      <h4 id={slugify(children)} {...props}>{children}</h4>
    ),
    h5: ({ children, ...props }: { children?: React.ReactNode; node?: unknown }) => (
      <h5 id={slugify(children)} {...props}>{children}</h5>
    ),
    h6: ({ children, ...props }: { children?: React.ReactNode; node?: unknown }) => (
      <h6 id={slugify(children)} {...props}>{children}</h6>
    ),
  }), [basePath, onNavigate]);

  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}

export default MarkdownRenderer;
