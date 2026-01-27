import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Mark native modules as external - they should be loaded by Electron, not bundled
      external: [
        'electron',
        'ssh2',           // Native bindings for SSH
        'ssh-config',     // SSH config parser (pure JS, but keep with ssh2)
        'electron-conf',  // Config storage (uses Node APIs)
      ],
    },
  },
});
