import { defineConfig } from 'vite'

export default defineConfig({
  root: './main',
  publicDir: './main',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          vendor: ['mathjs']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5173,
    open: true,
    // Optimizacije za brže učitavanje
    hmr: {
      overlay: false
    },
    // Ubrzava učitavanje velikih fajlova
    fs: {
      strict: false
    }
  },
  // Optimizacije za development
  optimizeDeps: {
    include: ['three', 'mathjs'],
    exclude: []
  },
  // Ubrzava build proces
  esbuild: {
    target: 'es2020'
  },
  // Resolve configuration for better module resolution
  resolve: {
    alias: {
      'three': 'three',
      'mathjs': 'mathjs'
    }
  }
}) 