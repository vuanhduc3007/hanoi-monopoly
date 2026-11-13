import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `--mode itch` builds the bundle uploaded to itch.io, which serves it from its
// own domain inside a frame: relative asset paths, its own output folder,
// server address from .env.itch. The default build (served by the game
// server) is unchanged.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'itch' ? './' : '/',
  server: { port: 5173, host: true },
  build: {
    outDir: mode === 'itch' ? 'dist-itch' : 'dist',
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
