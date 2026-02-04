import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy TokiToki assets
      '/qrTemplate': {
        target: 'https://order.tokitoki.love',
        changeOrigin: true,
        secure: true,
      },
      '/static': {
        target: 'https://order.tokitoki.love',
        changeOrigin: true,
        secure: true,
      },
      '/logo-vpbank.webp': {
        target: 'https://order.tokitoki.love',
        changeOrigin: true,
        secure: true,
      },
      // Proxy template images from backend
      '/backend-templates': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend-templates/, '/templates'),
      },
    },
  },
})

