import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Parser/main-process logic is plain Node; no DOM needed.
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
