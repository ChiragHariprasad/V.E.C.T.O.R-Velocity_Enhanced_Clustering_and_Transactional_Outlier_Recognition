import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true, // allow external access (important!)
    port: 5173,
    allowedHosts: ['dashboard.080405.tech'], // add your custom domain
  },
});
