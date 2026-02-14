/**
 * File kind label lookup for human-readable file type display.
 *
 * Maps file extensions and well-known filenames to descriptive labels
 * (e.g., "PNG Image", "TypeScript", "Makefile"). Used by the list view
 * Kind column and anywhere a file type label is needed.
 */

/**
 * Extension-to-label map. Keys are lowercase extensions without the dot.
 */
const FILE_KIND_MAP: Record<string, string> = {
  // Images
  jpg: 'JPEG Image',
  jpeg: 'JPEG Image',
  png: 'PNG Image',
  gif: 'GIF Image',
  webp: 'WebP Image',
  svg: 'SVG Image',
  bmp: 'BMP Image',
  ico: 'Icon',
  avif: 'AVIF Image',
  tiff: 'TIFF Image',
  tif: 'TIFF Image',

  // Documents
  pdf: 'PDF Document',
  doc: 'Word Document',
  docx: 'Word Document',
  xls: 'Excel Spreadsheet',
  xlsx: 'Excel Spreadsheet',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  odt: 'OpenDocument Text',
  ods: 'OpenDocument Spreadsheet',
  odp: 'OpenDocument Presentation',

  // Code
  js: 'JavaScript',
  jsx: 'JavaScript (JSX)',
  ts: 'TypeScript',
  tsx: 'TypeScript (TSX)',
  py: 'Python Script',
  rb: 'Ruby Script',
  go: 'Go Source',
  rs: 'Rust Source',
  c: 'C Source',
  cpp: 'C++ Source',
  cc: 'C++ Source',
  h: 'C/C++ Header',
  hpp: 'C++ Header',
  java: 'Java Source',
  kt: 'Kotlin Source',
  swift: 'Swift Source',
  cs: 'C# Source',
  php: 'PHP Script',
  lua: 'Lua Script',
  r: 'R Script',
  scala: 'Scala Source',
  dart: 'Dart Source',
  ex: 'Elixir Script',
  exs: 'Elixir Script',
  erl: 'Erlang Source',
  hs: 'Haskell Source',
  vue: 'Vue Component',
  svelte: 'Svelte Component',

  // Web
  html: 'HTML Document',
  htm: 'HTML Document',
  css: 'CSS Stylesheet',
  scss: 'SCSS Stylesheet',
  sass: 'Sass Stylesheet',
  less: 'LESS Stylesheet',

  // Data / Config
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML Document',
  toml: 'TOML',
  csv: 'CSV Data',
  tsv: 'TSV Data',
  sql: 'SQL',

  // Text
  md: 'Markdown',
  mdx: 'MDX',
  txt: 'Plain Text',
  log: 'Log File',
  rtf: 'Rich Text',

  // Shell
  sh: 'Shell Script',
  bash: 'Bash Script',
  zsh: 'Zsh Script',
  fish: 'Fish Script',
  ps1: 'PowerShell Script',
  bat: 'Batch File',
  cmd: 'Command Script',

  // Archives
  zip: 'ZIP Archive',
  tar: 'TAR Archive',
  gz: 'GZip Archive',
  '7z': '7-Zip Archive',
  rar: 'RAR Archive',
  bz2: 'BZip2 Archive',
  xz: 'XZ Archive',
  dmg: 'Disk Image',
  iso: 'Disk Image',

  // Media - Audio
  mp3: 'MP3 Audio',
  wav: 'WAV Audio',
  flac: 'FLAC Audio',
  aac: 'AAC Audio',
  ogg: 'OGG Audio',
  m4a: 'M4A Audio',
  wma: 'WMA Audio',

  // Media - Video
  mp4: 'MP4 Video',
  mkv: 'MKV Video',
  avi: 'AVI Video',
  mov: 'QuickTime Movie',
  webm: 'WebM Video',
  wmv: 'WMV Video',
  flv: 'Flash Video',

  // Config files (by extension)
  ini: 'INI Config',
  conf: 'Config File',
  cfg: 'Config File',
  env: 'Environment File',
  properties: 'Properties File',

  // Fonts
  ttf: 'TrueType Font',
  otf: 'OpenType Font',
  woff: 'Web Font',
  woff2: 'Web Font',

  // Binary / Executables
  exe: 'Executable',
  dll: 'Dynamic Library',
  so: 'Shared Library',
  dylib: 'Dynamic Library',
  wasm: 'WebAssembly',

  // Lock files
  lock: 'Lock File',
};

/**
 * Well-known filenames (exact match) mapped to labels.
 * Handles extensionless files and dotfiles.
 */
const KNOWN_FILENAMES: Record<string, string> = {
  // Build / project files (case-insensitive lookup)
  makefile: 'Makefile',
  dockerfile: 'Dockerfile',
  vagrantfile: 'Vagrantfile',
  procfile: 'Procfile',
  gemfile: 'Gemfile',
  rakefile: 'Rakefile',
  cmakelists: 'CMake File',
  license: 'License',
  licence: 'License',
  readme: 'README',
  changelog: 'Changelog',

  // Dotfiles (exact match with dot)
  '.gitignore': 'Git Ignore',
  '.gitattributes': 'Git Attributes',
  '.gitmodules': 'Git Modules',
  '.editorconfig': 'EditorConfig',
  '.prettierrc': 'Prettier Config',
  '.prettierignore': 'Prettier Ignore',
  '.eslintrc': 'ESLint Config',
  '.eslintignore': 'ESLint Ignore',
  '.babelrc': 'Babel Config',
  '.dockerignore': 'Docker Ignore',
  '.env': 'Environment File',
  '.env.local': 'Environment File',
  '.env.development': 'Environment File',
  '.env.production': 'Environment File',
  '.npmrc': 'NPM Config',
  '.nvmrc': 'Node Version',
  '.yarnrc': 'Yarn Config',
  '.browserslistrc': 'Browserslist',
  '.stylelintrc': 'Stylelint Config',
};

/**
 * Determine a human-readable "kind" label for a file.
 *
 * Priority:
 * 1. Directories -> "Folder"
 * 2. Known filenames (dotfiles exact, extensionless case-insensitive)
 * 3. Extension lookup in FILE_KIND_MAP
 * 4. Fallback -> "Document"
 *
 * @example
 * getFileKind('photo.png', false)   // "PNG Image"
 * getFileKind('src', true)          // "Folder"
 * getFileKind('Makefile', false)    // "Makefile"
 * getFileKind('.gitignore', false)  // "Git Ignore"
 * getFileKind('unknown.xyz', false) // "Document"
 */
export function getFileKind(fileName: string, isDirectory: boolean): string {
  if (isDirectory) return 'Folder';

  // Check dotfiles first (exact match including the dot)
  if (fileName.startsWith('.')) {
    const dotfileMatch = KNOWN_FILENAMES[fileName];
    if (dotfileMatch) return dotfileMatch;

    // For dotfiles with extensions (e.g. ".env.local"), also check
    const dotfileLower = fileName.toLowerCase();
    if (dotfileLower !== fileName) {
      const lowerMatch = KNOWN_FILENAMES[dotfileLower];
      if (lowerMatch) return lowerMatch;
    }
  }

  // Check known extensionless filenames (case-insensitive)
  const lowerName = fileName.toLowerCase();
  const knownMatch = KNOWN_FILENAMES[lowerName];
  if (knownMatch) return knownMatch;

  // Extract extension using lastIndexOf (handles "archive.tar.gz" -> "gz")
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex > 0 && dotIndex < fileName.length - 1) {
    const ext = fileName.slice(dotIndex + 1).toLowerCase();
    const kindMatch = FILE_KIND_MAP[ext];
    if (kindMatch) return kindMatch;
  }

  return 'Document';
}
