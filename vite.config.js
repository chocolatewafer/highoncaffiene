import { defineConfig } from 'vite';

// relative base so the build works from any folder (GitHub Pages, a sub-path, or a plain file host)
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 900 } });
