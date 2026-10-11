import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Rutas relativas: la web funciona igual en la raíz (localhost) que en un subdirectorio (GitHub Pages).
  base: './',
})
