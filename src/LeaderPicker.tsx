import { useMemo, useState } from 'react'
import type { Leader } from './types'

/** Buscador de líderes: escribe nombre, color o código (p. ej. «yamato», «rojo», «OP16»). */
export default function LeaderPicker({ leaders, value, onChange }: { leaders: Leader[]; value: string; onChange: (code: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const current = leaders.find((l) => l.code === value)

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return leaders.filter((l) => words.every((w) => `${l.name} ${l.color} ${l.code}`.toLowerCase().includes(w))).slice(0, 40)
  }, [leaders, q])

  const pick = (code: string) => { onChange(code); setOpen(false); setQ('') }

  return (
    <div className="picker">
      <input
        value={open ? q : current ? `${current.name} (${current.color})` : ''}
        placeholder="Buscar líder…"
        onFocus={(e) => { setOpen(true); setQ(''); e.target.select() }}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && list[0]) pick(list[0].code)
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <ul>
          {list.length === 0 && <li className="none">Ningún líder coincide</li>}
          {list.map((l) => (
            // onMouseDown (no onClick): se ejecuta antes de que el input pierda el foco y cierre la lista
            <li key={l.code} onMouseDown={() => pick(l.code)} className={l.code === value ? 'sel' : ''}>
              <img src={l.img} alt="" />
              <span>{l.name}<small>{l.color} · {l.code}</small></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
