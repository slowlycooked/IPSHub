import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    middlewares: [
      // Direct middleware approach
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        credentials: 'include',
        ws: true,
        onProxyRes: (proxyRes, req, res) => {
          // Explicitly forward Set-Cookie headers
          const setCookieHeaders = proxyRes.headers['set-cookie'];
          if (setCookieHeaders) {
            // Ensure array
            const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
            res.setHeader('set-cookie', cookies);
          }
        },
      },
      '/sub': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        credentials: 'include',
        ws: true,
      },
    },
  },
});
