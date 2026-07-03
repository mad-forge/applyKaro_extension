import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
        content: 'src/content.js',
        background: 'src/background.js'
      },
      output: {
        entryFileNames: '[name].js',
      }
    }
  }
})
