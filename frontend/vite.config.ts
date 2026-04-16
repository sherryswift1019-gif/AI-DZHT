import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/v1/workflow': 'http://localhost:8000',
      '/api/v1/projects': 'http://localhost:8000',
      '/api/v1/llm-config': 'http://localhost:8000',
      '/api/v1/steps': 'http://localhost:8000',
      '/api/v1/artifacts': 'http://localhost:8000',
      '/api/v1/agents': 'http://localhost:8000',
      '/api/v1/commands': 'http://localhost:8000',
    },
  },
})
