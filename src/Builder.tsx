import { useEffect, useMemo, useState } from 'react'
import CardmarketExport from './CardmarketExport'
import { deckRecord, SMALL_SAMPLE } from './diff'
import { deckPrice, fetchJson, usd, type Card, type Deck, type Leader } from './types'

type Entry = Card & { id: string }
const MAX_COPIES = 4
const DECK_SIZE = 50
const storeKey = (code: string) => `optcg-builder-${code}`

const load = (code: string): Record<string, number> | null => {
  try { return JSON.parse(localStorage.getItem(storeKey(code)) ?? 'null') } catch { return null }
}
const save = (code: string, d: Record<string, number>) => {
  try { localStorage.setItem(storeKey(code), JSON.stringify(d)) } catch { /* sin almacenamiento */ }
}

export default function Builder({ leader, leaders, cards, deckHash, prices }: { leader?: Leader; leaders: Leader[]; cards: Record<string, Card>; deckHash?: string; prices: Record<string, number> }) {
  const code = leader?.code
  const [deck, setDeck] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [cost, setCost] = useState('')
  const [copied, setCopied] = useState(false)
  const [presets, setPresets] = useState<Deck[]>([])

  // Carga: mazo top elegido (deckHash) > borrador guardado > vacío
  useEffect(() => {
    if (!code) return
    fetchJson<Deck[]>(`decks/${code}.json`).then(setPresets).catch(() => setPresets([]))
  }, [code])
  useEffect(() => {
    if (!code) return
    const draft = load(code)
    if (deckHash) {
      const d = presets.find((p) => p.hash === deckHash)
      if (d) { setDeck(Object.fromEntries(d.cards.map((c) => [c.id, c.qty]))); return }
      if (presets.length === 0) return // aún cargando
    }
    setDeck(draft ?? {})
  }, [code, deckHash, presets])
  useEffect(() => { if (code && Object.keys(deck).length) save(code, deck) }, [code, deck])

  const pool = useMemo<Entry[]>(() => {
    if (!leader) return []
    const colors = leader.color.split('/')
    return Object.entries(cards)
      .filter(([, c]) => c.type !== 'LEADER' && c.color.split('/').some((x) => colors.includes(x)))
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => Number(a.cost) - Number(b.cost) || a.name.localeCompare(b.name))
  }, [leader, cards])

  if (!leader) return <p>Elige un líder en la <a href="#/">tier list</a> y pulsa «Editar en el constructor».</p>

  const copiesOfName = (name: string) => Object.entries(deck).reduce((n, [id, q]) => n + (cards[id]?.name === name ? q : 0), 0)
  const total = Object.values(deck).reduce((a, b) => a + b, 0)
  const add = (id: string) => {
    const c = cards[id]
    if (!c) return
    setDeck((d) => {
      const size = Object.values(d).reduce((a, b) => a + b, 0)
      const copies = Object.entries(d).reduce((n, [i, q]) => n + (cards[i]?.name === c.name ? q : 0), 0)
      return size >= DECK_SIZE || copies >= MAX_COPIES ? d : { ...d, [id]: (d[id] ?? 0) + 1 }
    })
  }
  const remove = (id: string) =>
    setDeck((d) => {
      const n = { ...d, [id]: (d[id] ?? 0) - 1 }
      if (n[id] <= 0) delete n[id]
      return n
    })

  const list = Object.entries(deck)
    .map(([id, qty]) => ({ id, qty, card: cards[id] }))
    .sort((a, b) => Number(a.card?.cost ?? 0) - Number(b.card?.cost ?? 0) || a.id.localeCompare(b.id))
  const byType = (t: string) => list.filter((c) => c.card?.type === t).reduce((n, c) => n + c.qty, 0)
  const curve = Array.from({ length: 11 }, (_, i) => list.filter((c) => Math.min(Number(c.card?.cost ?? 0), 10) === i).reduce((n, c) => n + c.qty, 0))
  const maxCurve = Math.max(1, ...curve)

  const problems: string[] = []
  if (total !== DECK_SIZE) problems.push(`Faltan o sobran cartas: ${total}/${DECK_SIZE}`)
  const names = new Map<string, number>()
  for (const { id, qty } of list) { const n = cards[id]?.name; if (n) names.set(n, (names.get(n) ?? 0) + qty) }
  for (const [n, k] of names) if (k > MAX_COPIES) problems.push(`${n}: ${k} copias (máx. ${MAX_COPIES})`)
  const legal = problems.length === 0
  const price = deckPrice([...list, { id: leader.code, qty: 1 }], prices)

  const shown = pool.filter((c) => (!q || (c.name + c.id).toLowerCase().includes(q.toLowerCase())) && (!type || c.type === type) && (!cost || (cost === '10' ? Number(c.cost) >= 10 : c.cost === cost)))
  const text = [`1x${leader.code}`, ...list.map((c) => `${c.qty}x${c.id}`)].join('\n')
  const copy = () => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })

  return (
    <>
      <a href={`#/leader/${leader.code}`}>← {leader.name}</a>
      <h1>Constructor · {leader.name}</h1>
      <div className="filters">
        <select value={deckHash ?? ''} onChange={(e) => (location.hash = `#/builder/${leader.code}${e.target.value ? `/${e.target.value}` : ''}`)}>
          <option value="">Mi borrador</option>
          {presets.map((p, i) => {
            const r = deckRecord(p)
            return (
              <option key={p.hash} value={p.hash}>
                Partir de la variante {i + 1}{i === 0 ? ' (la más jugada)' : ''} · {r.wr}% en {r.n}p{r.n < SMALL_SAMPLE ? ' ⚠' : ''}
              </option>
            )
          })}
        </select>
        <select value={leader.code} onChange={(e) => (location.hash = `#/builder/${e.target.value}`)}>
          {leaders.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.color})</option>)}
        </select>
        <button onClick={() => { setDeck({}); save(leader.code, {}) }}>Vaciar</button>
      </div>

      <div className={`status ${legal ? 'ok' : 'warn'}`}>
        <b>{total}/{DECK_SIZE}</b> cartas · {byType('CHARACTER')} personajes · {byType('EVENT')} eventos · {byType('STAGE')} escenarios · <b>{usd(price.total)}</b>{price.unknown > 0 && ` (parcial: ${price.unknown} sin precio)`}
        {legal ? ' · ✔ Mazo válido' : ` · ${problems.join(' · ')}`}
        <button onClick={copy}>{copied ? '¡Copiado!' : 'Copiar lista'}</button>
        <CardmarketExport leader={leader.code} cards={list.map((c) => ({ id: c.id, qty: c.qty }))} db={cards} />
      </div>
      <div className="curve" title="Curva de coste">
        {curve.map((n, i) => (
          <div key={i}><i style={{ height: `${(n / maxCurve) * 100}%` }} /><span>{i === 10 ? '10+' : i}</span><em>{n || ''}</em></div>
        ))}
      </div>

      <h2>Tu mazo</h2>
      {list.length === 0 && <p className="muted">Vacío. Añade cartas abajo o parte de un mazo top.</p>}
      <div className="grid">
        {list.map(({ id, qty, card }) => (
          <figure key={id} className="pick" onClick={() => remove(id)} title="Clic para quitar una copia">
            {card ? <img src={card.img} alt={card.name} loading="lazy" /> : <div className="ph">{id}</div>}
            <figcaption>×{qty}{id in prices && <small>{usd(prices[id])}</small>}</figcaption>
          </figure>
        ))}
      </div>

      <h2>Añadir cartas <small>{shown.length} legales para {leader.color}</small></h2>
      <div className="filters">
        <input placeholder="Nombre o código" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}><option value="">Tipo</option><option>CHARACTER</option><option>EVENT</option><option>STAGE</option></select>
        <select value={cost} onChange={(e) => setCost(e.target.value)}><option value="">Coste</option>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i === 10 ? '10+' : i}</option>)}</select>
      </div>
      <div className="grid">
        {shown.slice(0, 90).map((c) => {
          const full = total >= DECK_SIZE || copiesOfName(c.name) >= MAX_COPIES
          return (
            <figure key={c.id} className={`pick ${full ? 'dim' : ''}`} onClick={() => add(c.id)} title={`${c.name} · ${c.id} · coste ${c.cost}`}>
              <img src={c.img} alt={c.name} loading="lazy" />
              <figcaption>{deck[c.id] ? `×${deck[c.id]}` : c.id}{c.id in prices && <small>{usd(prices[c.id])}</small>}</figcaption>
            </figure>
          )
        })}
      </div>
      {shown.length > 90 && <p className="muted">Mostrando 90. Afina la búsqueda.</p>}
    </>
  )
}
