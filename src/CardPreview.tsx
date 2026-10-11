import { useEffect, useState } from 'react'

const W = 360 // ancho de la vista ampliada
const H = Math.round((W * 7) / 5)
const IMG = (id: string) => `https://optcgapi.com/media/static/Card_Images/${id}.jpg`

/** URL de la carta bajo el cursor: una imagen de carta, o cualquier elemento con data-card="CÓDIGO". */
const cardUnder = (t: EventTarget | null): string | null => {
  if (!(t instanceof Element)) return null
  if (t instanceof HTMLImageElement && /Card_Images\/|cardkaizoku\.com/.test(t.src)) return t.src
  const id = t.closest('[data-card]')?.getAttribute('data-card')
  return id ? IMG(id) : null
}

/** Al pasar el ratón sobre cualquier carta de la app, muestra una copia grande para poder leerla. */
export default function CardPreview() {
  const [p, setP] = useState<{ src: string; x: number; y: number } | null>(null)

  useEffect(() => {
    // En pantallas táctiles no hay hover.
    if (!matchMedia('(hover: hover)').matches) return
    const over = (e: MouseEvent) => {
      const src = cardUnder(e.target)
      setP(src ? { src, x: e.clientX, y: e.clientY } : null)
    }
    // Se reevalúa en cada movimiento: el contenido puede cambiar bajo el cursor sin que este salga del elemento.
    const move = (e: MouseEvent) => {
      const src = cardUnder(e.target)
      setP(src ? { src, x: e.clientX, y: e.clientY } : null)
    }
    const leave = () => setP(null)
    addEventListener('mouseover', over)
    addEventListener('mousemove', move)
    document.addEventListener('mouseleave', leave)
    addEventListener('scroll', leave, true)
    return () => {
      removeEventListener('mouseover', over)
      removeEventListener('mousemove', move)
      document.removeEventListener('mouseleave', leave)
      removeEventListener('scroll', leave, true)
    }
  }, [])

  if (!p) return null
  const right = p.x + 24 + W <= innerWidth
  const left = right ? p.x + 24 : Math.max(8, p.x - 24 - W)
  const top = Math.min(Math.max(8, p.y - H / 2), Math.max(8, innerHeight - H - 8))
  return <img className="preview" src={p.src} alt="" style={{ left, top, width: W }} />
}
