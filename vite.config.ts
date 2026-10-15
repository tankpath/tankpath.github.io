import { defineConfig } from 'vite'

export default defineConfig({
  // tankpath.github.io is an organization site, so it is served from the domain root.
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] }
      }
    }
  }
})
