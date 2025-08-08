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
    port: 3000, // Nuevo valor
    proxy: {
      '/api': {
        target: 'http://localhost:3031', // CAMBIAR a 3031 (nuevo puerto de Sebo)
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
