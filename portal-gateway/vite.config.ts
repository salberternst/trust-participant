import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api/onboarding': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
