// Demo mode: runs the real UI against in-memory sample data (no Firebase).
// Usage: npm run demo
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const swaps = {
  [path.resolve(__dirname, 'src/utils/api.js')]: path.resolve(__dirname, 'src/demo/mockApi.js'),
  [path.resolve(__dirname, 'src/hooks/useAuth.jsx')]: path.resolve(__dirname, 'src/demo/mockAuth.jsx'),
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vela-demo-swap',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        if (!importer || importer.includes('/src/demo/')) return null;
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (resolved && swaps[resolved.id]) return swaps[resolved.id];
        return null;
      },
    },
  ],
  server: { port: 5174 },
});
