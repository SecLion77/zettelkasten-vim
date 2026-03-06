import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Bouw de CSS-bundle naar de static map
    outDir: '../static',
    emptyOutDir: false,   // Verwijder NIET app.js en index.html!
    rollupOptions: {
      input: { styles: path.resolve(__dirname, 'src/main.jsx') },
      output: {
        assetFileNames: 'wombat.[ext]',
        entryFileNames: '_vite_stub.js',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
