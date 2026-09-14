// ESLint 9 flat config. Replaces the former .eslintrc.json with equivalent rules:
// eslint recommended + typescript-eslint recommended + eslint-plugin-import
// (recommended, electron, typescript) + react-hooks.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'out/**', 'dist/**', '.vite/**', '.planning/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.electron,
  importPlugin.flatConfigs.typescript,
  {
    files: ['**/*.{ts,tsx,mjs,js}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Injected by @electron-forge/plugin-vite at build time
        MAIN_WINDOW_VITE_DEV_SERVER_URL: 'readonly',
        MAIN_WINDOW_VITE_NAME: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Classic hooks rules only. The React Compiler rules in the plugin's
      // "recommended-latest" preset are intentionally not enabled yet.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Allow intentionally unused params/vars when prefixed with an underscore
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
    settings: {
      'import/resolver': {
        // Understands package.json "exports" maps (electron-conf/main, yet-another-react-lightbox/plugins/zoom)
        typescript: { alwaysTryTypes: true },
        node: true,
      },
    },
  },
);
