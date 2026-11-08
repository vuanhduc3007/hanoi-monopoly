import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Colyseus treats an IPC channel (process.send) as cluster mode; the default
    // `forks` pool provides one, so run in worker threads instead.
    pool: 'threads',
  },
});
