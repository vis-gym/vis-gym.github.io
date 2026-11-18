import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Paper data is served from public/papers (run `npm run sync` to refresh it from ../standardized-papers).
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
