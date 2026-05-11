import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const workspaceRoot = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, workspaceRoot, '');
  const backendPort = env.SERVER_PORT || '8080';
  const backendTarget = `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      // Exposes the direct backend URL so subscription URLs bypass the Vite proxy.
      // In production builds, import.meta.env.DEV is false so this is dead code.
      __BACKEND_ORIGIN__: JSON.stringify(backendTarget),
    },
    server: {
      port: 5173,
      middlewares: [
        // Direct middleware approach
      ],
      proxy: {
        '/api': {
          target: backendTarget,
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
          target: backendTarget,
          changeOrigin: true,
          credentials: 'include',
          ws: true,
        },
      },
    },
  };
});
