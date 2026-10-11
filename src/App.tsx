import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Builder from './Builder'
import Matchups from './Matchups'
import Discover from './Discover'
import Budget from './Budget'
import CardPreview from './CardPreview'
import CardAnalysis from './CardAnalysis'
import CardmarketExport from './CardmarketExport'
import { deckDiff, deckRecord, SMALL_SAMPLE } from './diff'
import { buildPrices, deckPrice, fetchJson, getFx, setExactEur, setFx, usd, wilson, type EurPrices, type Card, type Deck, type Leader, type Meta, type Prices } from './types'

const fmtDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const daysOld = (iso: string) => (iso ? Math.floor((Date.now() - Date.parse(iso.slice(0, 10))) / 864e5) : 0)
const stat = (l: Leader) => l.opbounty ?? l.kaizoku
const tierOf = (wr: number) => (wr >= 54 ? 'S' : wr >= 52 ? 'A' : wr >= 50 ? 'B' : wr >= 48 ? 'C' : 'D')
const MIN_GAMES = 1000

function useHash() {
  const [h, setH] = useState(location.hash || '#/')
  useEffect(() => {
    const f = () => setH(location.hash || '#/')
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return h
}

export default function App() {
  const hash = useHash()
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [cards, setCards] = useState<Record<string, Card>>({})
  const [meta, setMeta] = useState<Meta | null>(null)
  const [prices, setPrices] = useState<Prices>({ date: '', prices: {} })
  const [error, setError] = useState('')
  const [fx, setFxState] = useState(getFx)
  const changeFx = (f: typeof fx) => { setFx(f); setFxState(f) }
  const [eur, setEur] = useState<EurPrices>({ date: '', eur: {} })
  // Precios en la moneda elegida: TCGPlayer en $, o Cardmarket en € (con conversión desde $ para lo que falte)
  const display = useMemo(() => {
    const b = buildPrices(prices.prices, eur.eur, fx)
    setExactEur(b.exact)
    return b
  }, [prices, eur, fx])

  useEffect(() => {
    Promise.all([fetchJson<Leader[]>('leaders.json'), fetchJson<Record<string, Card>>('cards.json'), fetchJson<Meta>('meta.json')])
      .then(([l, c, m]) => { setLeaders(l); setCards(c); setMeta(m) })
      .catch((e) => setError(`No se pudo cargar ${e}. Ejecuta "npm run sync".`))
    fetchJson<Prices>('prices.json').then(setPrices).catch(() => { /* los precios son opcionales */ })
    fetchJson<EurPrices>('prices-eur.json').then(setEur).catch(() => { /* sin precios Cardmarket: se convierte desde $ */ })
  }, [])

  const route = hash.replace(/^#\/?/, '').split('/')
  const leaderCode = route[0] === 'leader' ? route[1] : null

  return (
    <>
      <header>
        <a href="#/" className="brand">OPTCG Meta</a>
        <nav>
          <a href="#/" className={route[0] === '' ? 'on' : ''}>Tier list</a>
          <a href="#/budget" className={route[0] === 'budget' ? 'on' : ''}>Baratos</a>
          <a href="#/discover" className={route[0] === 'discover' ? 'on' : ''}>Descubre</a>
          <a href="#/matchups" className={route[0] === 'matchups' ? 'on' : ''}>Matchups</a>
          <a href="#/builder" className={route[0] === 'builder' ? 'on' : ''}>Constructor</a>
          <a href="#/cards" className={route[0] === 'cards' ? 'on' : ''}>Cartas</a>
        </nav>
        <span className="fx" title="Precios en € de Cardmarket. Solo se usa para las pocas cartas sin precio en Cardmarket (€ por cada $).">
          € · cambio de reserva
          <input type="number" step="0.01" min="0.1" max="3" value={fx.rate}
            onChange={(e) => +e.target.value > 0 && changeFx({ ...fx, rate: +e.target.value })} />
        </span>
        {meta && (
          <span className="muted dates">
            Win rates: <span className={daysOld(meta.date) > 3 ? 'bad' : ''} title="Partidas del ladder (OPBounty y Car D. Kaizoku)">
              {fmtDate(meta.date)}{daysOld(meta.date) > 3 ? ' ⚠ antiguos' : ''}
            </span>
            {(eur.date || prices.date) && (
              <> · Precios: <span className={daysOld(eur.date || prices.date) > 3 ? 'bad' : ''} title={eur.date ? 'Cardmarket (€)' : 'TCGPlayer ($, convertido)'}>
                {fmtDate(eur.date || prices.date)}{daysOld(eur.date || prices.date) > 3 ? ' ⚠ antiguos' : ''}
              </span></>
            )}
          </span>
        )}
      </header>
      <main>
        {error && <p className="error">{error}</p>}
        {!error && leaders.length === 0 && <p className="muted">Cargando…</p>}
        {leaders.length > 0 && (leaderCode ? (
          <LeaderPage leader={leaders.find((l) => l.code === leaderCode)} leaders={leaders} cards={cards} prices={display.prices} deckHash={route[2]} />
        ) : route[0] === 'budget' ? (
          <Budget leaders={leaders} prices={display.prices} />
        ) : route[0] === 'discover' ? (
          <Discover leaders={leaders} />
        ) : route[0] === 'matchups' ? (
          <Matchups leaders={leaders} cards={cards} a={route[1]} b={route[2]} />
        ) : route[0] === 'builder' ? (
          <Builder leader={leaders.find((l) => l.code === (route[1] || leaders[0].code))} leaders={leaders} cards={cards} deckHash={route[2]} prices={display.prices} />
        ) : route[0] === 'cards' ? (
          <CardSearch cards={cards} />
        ) : (
          <TierList leaders={leaders} />
        ))}
      </main>
      <CardPreview />
    </>
  )
}

function TierList({ leaders }: { leaders: Leader[] }) {
  const rows = useMemo(
    () => leaders.filter((l) => (stat(l)?.matches ?? 0) >= MIN_GAMES).sort((a, b) => stat(b)!.winRate - stat(a)!.winRate),
    [leaders],
  )
  return (
    <>
      <h1>Meta de líderes</h1>
      <p className="muted">Ladder del simulador (OPBounty), ordenado por win rate. Solo líderes con ≥{MIN_GAMES} partidas.</p>
      <table>
        <thead><tr><th>Tier</th><th>Líder</th><th>Win rate</th><th>Presencia</th><th>Partidas</th><th>Mazos</th></tr></thead>
        <tbody>
          {rows.map((l) => {
            const s = stat(l)!
            const t = tierOf(s.winRate)
            return (
              <tr key={l.code}>
                <td><span className={`tier t${t}`}>{t}</span></td>
                <td><a className="leader" href={`#/leader/${l.code}`}><img src={l.img} alt="" loading="lazy" />{l.name}<small>{l.color}</small></a></td>
                <td><b>{s.winRate.toFixed(1)}%</b></td>
                <td>{(s.popularity ?? s.playRate ?? 0).toFixed(1)}%</td>
                <td>{s.matches.toLocaleString('es')}</td>
                <td>{l.deckCount}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function LeaderPage({ leader, leaders, cards, prices, deckHash }: { leader?: Leader; leaders: Leader[]; cards: Record<string, Card>; prices: Record<string, number>; deckHash?: string }) {
  const [raw, setRaw] = useState<Deck[] | null>(null)
  const [open, setOpen] = useState(0)
  const [sort, setSort] = useState<'games' | 'wr'>('games')
  const code = leader?.code
  useEffect(() => {
    if (!code) return
    setRaw(null); setOpen(0)
    fetchJson<Deck[]>(`decks/${code}.json`).then(setRaw).catch(() => setRaw([]))
  }, [code])
  const wrOf = (d: Deck) => d.sources.opbounty?.winRate ?? d.sources.kaizokuPlayed?.winRate ?? 0
  const decks = useMemo(() => {
    if (!raw) return null
    if (sort === 'games') return raw
    // Por win rate, ignorando mazos con muestra muy pequeña (<100 partidas)
    return raw.filter((d) => d.games >= 100).sort((a, b) => wrOf(b) - wrOf(a))
  }, [raw, sort])
  // Si llegamos con un mazo concreto (#/leader/CÓDIGO/HASH, p. ej. desde «Baratos»), lo dejamos seleccionado
  useEffect(() => {
    if (!raw || !deckHash) return
    const i = raw.findIndex((d) => d.hash === deckHash)
    if (i >= 0) { setSort('games'); setOpen(i) }
  }, [raw, deckHash])

  if (!leader) return <p>Líder no encontrado. <a href="#/">Volver</a></p>
  const s = stat(leader)
  const byCode = new Map(leaders.map((l) => [l.code, l]))
  const mu = Object.entries(leader.matchups)
    .map(([c, m]) => ({ c, ...m, leader: byCode.get(c) }))
    .filter((m) => m.leader && m.games >= 300)
    .sort((a, b) => b.winRate - a.winRate)
  const deck = decks?.[open]

  return (
    <>
      <a href="#/" onClick={(e) => { if (history.length > 1) { e.preventDefault(); history.back() } }}>← Volver</a>
      <div className="hero">
        <img src={leader.img} alt={leader.name} />
        <div>
          <h1>{leader.name}</h1>
          <p className="muted">{leader.code} · {leader.color}</p>
          {s && <p><b>{s.winRate.toFixed(1)}%</b> win rate · {s.matches.toLocaleString('es')} partidas</p>}
          {leader.kaizoku?.firstWinRate != null && (
            <p className="muted">Jugando primero {leader.kaizoku.firstWinRate}% · segundo {leader.kaizoku.secondWinRate}%</p>
          )}
        </div>
      </div>

      <h2>Mazos del ladder</h2>
      <div className="filters">
        <button className={sort === 'games' ? 'on' : ''} onClick={() => { setSort('games'); setOpen(0) }}>Más jugados</button>
        <button className={sort === 'wr' ? 'on' : ''} onClick={() => { setSort('wr'); setOpen(0) }}>Mejor win rate (≥100 partidas)</button>
      </div>
      {decks === null && <p className="muted">Cargando mazos…</p>}
      {decks?.length === 0 && <p className="muted">Sin mazos descargados para este líder (solo se guardan los líderes con al menos 200 partidas).</p>}
      {decks && decks.length > 0 && (
        <>
          <div className="tabs">
            {decks.map((d, i) => (
              <button key={d.hash} className={i === open ? 'on' : ''} onClick={() => setOpen(i)}>
                Variante {(raw?.indexOf(d) ?? i) + 1}<small>{deckRecord(d).wr}% · {deckRecord(d).n}p{deckRecord(d).n < SMALL_SAMPLE ? ' ⚠' : ''} · {usd(deckPrice([...d.cards, { id: leader.code, qty: 1 }], prices).total)}</small>
              </button>
            ))}
          </div>
          {deck && <DeckView deck={deck} base={raw?.[0]} cards={cards} leader={leader.code} prices={prices} />}
        </>
      )}

      <CardAnalysis code={leader.code} cards={cards} />

      <h2>Matchups</h2>
      <div className="mu">
        <MuList title="Mejores" from={leader.code} rows={mu.slice(0, 6)} />
        <MuList title="Peores" from={leader.code} rows={mu.slice(-6).reverse()} />
      </div>
    </>
  )
}

function MuList({ title, from, rows }: { title: string; from: string; rows: { c: string; winRate: number; games: number; leader?: Leader }[] }) {
  return (
    <div>
      <h3>{title}</h3>
      {rows.map((m) => (
        <a key={m.c} className="leader row" href={`#/matchups/${from}/${m.c}`}>
          <img src={m.leader!.img} alt="" loading="lazy" />{m.leader!.name}
          <b className={m.winRate >= 50 ? 'good' : 'bad'}>{m.winRate}%</b><small>{m.games}p</small>
        </a>
      ))}
    </div>
  )
}

function DeckView({ deck, base, cards, leader, prices }: { deck: Deck; base?: Deck; cards: Record<string, Card>; leader: string; prices: Record<string, number> }) {
  const diff = base && base.hash !== deck.hash ? deckDiff(base, deck, cards) : null
  const rec = deckRecord(deck)
  const cost = deckPrice([...deck.cards, { id: leader, qty: 1 }], prices)
  const list = deck.cards
    .map((c) => ({ ...c, card: cards[c.id] }))
    .sort((a, b) => Number(a.card?.cost ?? 0) - Number(b.card?.cost ?? 0) || a.id.localeCompare(b.id))
  const total = list.reduce((n, c) => n + c.qty, 0)
  const src = deck.sources
  const copy = () => navigator.clipboard?.writeText(deck.cards.map((c) => `${c.qty}x${c.id}`).join('\n'))
  return (
    <div className="deck">
      <p className="muted">
        {total} cartas (+ líder, incluido en el precio) · <b>{usd(cost.total)}</b>{cost.unknown > 0 && ` (parcial: ${cost.unknown} sin precio)`}
        {` · ${rec.src} ${rec.wr}% (${rec.n}p)`}
        {src.kaizokuPlayed && rec.src !== 'Kaizoku' && ` · Kaizoku ${src.kaizokuPlayed.winRate}%`}
        {src.optcgone && ` · optcg.one ${src.optcgone.winRate}% (${src.optcgone.games}p)`}
        {' '}<button onClick={copy}>Copiar lista</button>{' '}
        <a className="btn" href={`#/builder/${leader}/${deck.hash}`}>Editar en el constructor</a>{' '}
        <CardmarketExport leader={leader} cards={deck.cards} db={cards} />
      </p>
      {cost.approx > 0 && <p className="muted">~ {cost.approx} cartas con precio convertido desde $ (sin dato de Cardmarket).</p>}
      {rec.n > 0 && (() => {
        const w = wilson(Math.round((rec.wr / 100) * rec.n), rec.n)
        return (
          <p className={rec.n < SMALL_SAMPLE ? 'warnbox' : 'muted'}>
            {rec.n < SMALL_SAMPLE && '⚠ Muestra pequeña. '}
            Con {rec.n} partidas, el win rate real está probablemente entre <b>{w.lo.toFixed(0)}%</b> y <b>{w.hi.toFixed(0)}%</b>:
            diferencias de unos pocos puntos entre variantes suelen ser ruido.
          </p>
        )
      })()}
      {diff && (
        <div className="diff">
          <b>Qué cambia respecto a la variante más jugada</b>{' '}
          <span className="muted">({diff.shared}/50 cartas en común)</span>
          {diff.added.length + diff.removed.length === 0 && <p className="muted">Mismas cartas con distinto reparto de copias.</p>}
          <div className="diff-cols">
            <div>{diff.added.map((c) => <div key={c.id} className="good hov" data-card={c.id}>+{c.qty} {c.name}</div>)}</div>
            <div>{diff.removed.map((c) => <div key={c.id} className="bad hov" data-card={c.id}>−{c.qty} {c.name}</div>)}</div>
          </div>
        </div>
      )}
      <div className="grid">
        {list.map((c) => (
          <figure key={c.id} title={c.card?.name}>
            {c.card ? <img src={c.card.img} alt={c.card.name} loading="lazy" /> : <div className="ph">{c.id}</div>}
            <figcaption>×{c.qty}{c.id in prices && <small>{usd(prices[c.id])}</small>}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function CardSearch({ cards }: { cards: Record<string, Card> }) {
  const [q, setQ] = useState('')
  const [color, setColor] = useState('')
  const [type, setType] = useState('')
  const all = useMemo(() => Object.entries(cards).map(([id, c]) => ({ id, ...c })), [cards])
  const colors = useMemo(() => [...new Set(all.flatMap((c) => c.color.split('/')))].sort(), [all])
  const types = useMemo(() => [...new Set(all.map((c) => c.type))].sort(), [all])
  const shown = all
    .filter((c) => (!q || (c.name + c.id).toLowerCase().includes(q.toLowerCase())) && (!color || c.color.includes(color)) && (!type || c.type === type))
  return (
    <>
      <h1>Cartas</h1>
      <div className="filters">
        <input placeholder="Nombre o código (OP01-001)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={color} onChange={(e) => setColor(e.target.value)}><option value="">Color</option>{colors.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value)}><option value="">Tipo</option>{types.map((c) => <option key={c}>{c}</option>)}</select>
        <span className="muted">{shown.length} cartas</span>
      </div>
      <div className="grid">
        {shown.slice(0, 120).map((c) => (
          <figure key={c.id} title={`${c.name} · ${c.id}`}>
            <img src={c.img} alt={c.name} loading="lazy" />
            <figcaption>{c.id}</figcaption>
          </figure>
        ))}
      </div>
      {shown.length > 120 && <p className="muted">Mostrando 120. Afina la búsqueda.</p>}
    </>
  )
}
