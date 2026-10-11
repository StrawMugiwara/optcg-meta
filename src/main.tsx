import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Si la imagen principal (optcgapi.com) falla, probamos con el CDN de Car D. Kaizoku (mismo código de carta).
addEventListener(
  'error',
  (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback) return
    const id = img.src.match(/Card_Images\/([A-Za-z0-9]+-\d+)\.jpg$/)?.[1]
    if (!id) return
    img.dataset.fallback = '1'
    img.src = `https://cdn.cardkaizoku.com/cards_en/${id.split('-')[0]}/${id}.png`
  },
  true,
)
