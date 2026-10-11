import { useMemo, useState } from 'react'
import { cardmarketLines } from './cardmarket'
import { collection, parseList, useCollection } from './collection'
import { money, type Card } from './types'

/** Mi colección: las cartas que ya tengo. Sirve para que cada mazo muestre solo lo que me falta. */
export default function CollectionPage({ cards, prices }: { cards: Record<string, Card>; prices: Record<string, number> }) {
  const owned = useCollection()
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const validIds = useMemo(() => new Set(Object.keys(cards)), [cards])
  const entries = useMemo(
    () => Object.entries(owned)
      .map(([id, qty]) => ({ id, qty, c: cards[id] }))
      .sort((a, b) => (a.c?.name ?? a.id).localeCompare(b.c?.name ?? b.id)),
    [owned, cards],
  )
  const copies = entries.reduce((n, e) => n + e.qty, 0)
  const value = entries.reduce((n, e) => n + (prices[e.id] ?? 0) * e.qty, 0)

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length || q.length < 2) return []
    return Object.entries(cards)
      .filter(([id, c]) => words.every((w) => `${c.name} ${id}`.toLowerCase().includes(w)))
      .slice(0, 36)
  }, [q, cards])

  const doImport = (replace: boolean) => {
    const { found, unknown } = parseList(text, validIds)
    const n = Object.keys(found).length
    if (n === 0) { setMsg('No he reconocido ninguna carta. Cada línea necesita el código (por ejemplo «3x Perona OP01-077»).'); return }
    if (replace) collection.replace(found)
    else collection.add(found)
    setMsg(`${replace ? 'Colección reemplazada' : 'Añadidas'}: ${n} cartas distintas.${unknown.length ? ` No reconocidas (${unknown.length}): ${unknown.slice(0, 3).join(' · ')}${unknown.length > 3 ? '…' : ''}` : ''}`)
    setText('')
  }

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(cardmarketLines(entries.map((e) => ({ id: e.id, qty: e.qty })), cards))
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch { /* sin permiso de portapapeles */ }
  }

  return (
    <>
      <h1>Mi colección</h1>
      <p className="muted">
        Guarda las cartas que ya tienes. En cada mazo verás solo lo que te falta, con su precio, y podrás copiar esa lista a Cardmarket.
        <b> Se guarda solo en este navegador de este dispositivo</b>: para llevarla al móvil usa «Copiar mi colección» y pégala allí en «Importar».
      </p>

      <div className="summary col-sum">
        <div><span className="muted">Cartas distintas</span><b>{entries.length}</b></div>
        <div><span className="muted">Copias en total</span><b>{copies}</b></div>
        <div><span className="muted">Valor aproximado</span><b>{money(value)}</b></div>
      </div>

      <h2>Añadir cartas</h2>
      <div className="filters">
        <input placeholder="Busca una carta por nombre o código y pulsa + (mín. 2 letras)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {results.length > 0 && (
        <div className="grid">
          {results.map(([id, c]) => (
            <figure key={id} className="pick" onClick={() => collection.set(id, (owned[id] ?? 0) + 1)} title={`${c.name} · ${id}`}>
              <img src={c.img} alt={c.name} loading="lazy" />
              <figcaption>{owned[id] ? `tienes ×${owned[id]}` : id}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {q.length >= 2 && results.length === 0 && <p className="muted">No hay cartas con ese nombre.</p>}

      <h2>Importar</h2>
      <p className="muted">Pega una lista con una carta por línea: «3x Perona OP01-077», «3 OP01-077» o lo que copies del Wizard de Cardmarket.</p>
      <textarea className="import" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'3x Perona OP01-077\n4 Kin\'emon OP16-082'} />
      <div className="filters">
        <button onClick={() => doImport(false)} disabled={!text.trim()}>Añadir a mi colección</button>
        <button onClick={() => doImport(true)} disabled={!text.trim()} title="Borra lo que tengas guardado y deja solo esta lista">Reemplazar todo</button>
        {msg && <span className="muted">{msg}</span>}
      </div>

      <h2>Mis cartas <small>{entries.length} distintas</small></h2>
      {entries.length === 0 ? (
        <p className="muted">Aún no hay nada guardado.</p>
      ) : (
        <>
          <div className="filters">
            <button onClick={copyAll}>{copied ? '¡Copiado!' : 'Copiar mi colección'}</button>
            <button onClick={() => { if (confirm('¿Borrar toda tu colección guardada?')) collection.clear() }}>Vaciar</button>
          </div>
          <table>
            <thead><tr><th>Carta</th><th>Copias</th><th>Precio</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="leader hov" data-card={e.id}>
                      {e.c && <img src={e.c.img} alt="" loading="lazy" />}{e.c?.name ?? e.id}<small>{e.id}</small>
                    </span>
                  </td>
                  <td>
                    <span className="qty">
                      <button onClick={() => collection.set(e.id, e.qty - 1)} aria-label="Quitar una copia">−</button>
                      <b>{e.qty}</b>
                      <button onClick={() => collection.set(e.id, e.qty + 1)} aria-label="Añadir una copia">+</button>
                    </span>
                  </td>
                  <td>{e.id in prices ? money(prices[e.id] * e.qty) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
