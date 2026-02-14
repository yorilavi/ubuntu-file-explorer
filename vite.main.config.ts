import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        'cpu-features',  // Optional native module for ssh2 (loaded in try/catch)
        /\.node$/,       // Skip native binary addons (ssh2 loads them optionally)
      ],
    },
  },
});
