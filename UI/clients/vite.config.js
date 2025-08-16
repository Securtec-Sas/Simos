
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Simple plugin to log server URL on start
const logServerUrl = () => ({
  name: 'log-server-url',
  configureServer(server) {
    server.httpServer.on('listening', () => {
      const { address, port } = server.httpServer.address();
      const url = `http://${address === '::' ? 'localhost' : address}:${port}`;
      console.log(`  > App running at: ${url}`);
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), logServerUrl()],
  server: {
    port: 3000,
    proxy: {
      // Sebo microservice proxy
      '/api/sebo': {
        target: 'http://localhost:3031',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/sebo/, '/api'),
      },
      // V3 microservice proxy
      '/api/v3': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/v3/, '/api'),
      },
      // Additional services proxy
      '/api/service3': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/service3/, '/api'),
      },
      // Legacy proxy for backward compatibility (should be last)
      '/api': {
        target: 'http://localhost:3031',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
