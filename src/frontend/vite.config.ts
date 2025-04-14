import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: [
      '@tanstack/react-query',
      'date-fns',
      'react-router-dom'
    ],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
    // Allow all hosts, including ngrok
    host: '0.0.0.0',
    // Disable host checking for development
    hmr: {
      // Disable host checking for HMR
      clientPort: 5173, // Use port 5173 for client connections
      host: 'localhost', // Use localhost as the HMR host
    },
    // Allow any host to connect (including ngrok domains)
    cors: true,
    strictPort: true,
    // Allow all hosts - this accepts all domains including ngrok domains
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
