import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `--mode app` builds the bundle that the Capacitor and Electron shells load
// from disk: relative asset paths, its own output folder, server address from
// .env.app. The default build (served by the game server) is unchanged.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'app' ? './' : '/',
  server: { port: 5173, host: true },
  build: {
    outDir: mode === 'app' ? 'dist-app' : 'dist',
    rollupOptions: {
      // three.js in its own long-cached chunk.
      output: { manualChunks: { three: ['three'] } },
    },
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
}));
