import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Build Audit Plugin - Proves this config is being loaded
    {
      name: 'build-audit',
      configResolved(config) {
        console.log('-------------------------------------------');
        console.log('🔒 VITE ISOLATION LOCK: ACTIVE');
        console.log(`📂 Root: ${config.root}`);
        console.log(`🚀 OutDir: ${config.build.outDir}`);
        console.log(`📍 Source: desktop-app/src/vite.config.ts`);
        console.log('-------------------------------------------');
      }
    }
  ],
  base: './', // Use relative paths for Electron
  build: {
    outDir: '../dist-react', // Output to desktop-app/dist-react
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
