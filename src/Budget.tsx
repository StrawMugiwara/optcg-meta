import { useEffect, useMemo, useState } from 'react'
import { deckPrice, fetchJson, getFx, money, wilson, type Deck, type Leader } from './types'

type Row = {
  l: Leader
  deck: Deck
  price: number
  unknown: number
  n: number
  wr: number
  lo: number
}

type Rec = { games: number; wins: number; winRate: number }

const games = (l: Leader) => l.opbounty?.matches ?? l.kaizoku?.matches ?? 0

/** Win rate de un mazo: OPBounty si lo tiene (como el resto de la app); si no, Kaizoku. Sin mezclar fuentes. */
function record(d: Deck) {
  const pick = [d.sources.opbounty, d.sources.kaizokuPlayed].find(
    (x): x is Rec => !!x && (x as Rec).games > 0 && (x as Rec).wins != null,
  )
  return pick ? { n: pick.games, wins: pick.wins, wr: pick.winRate } : null
}

export default function Budget({ leaders, prices }: { leaders: Leader[]; prices: Record<string, number> }) {
  const [decks, setDecks] = useState<Record<string, Deck[]>>({})
  const [loading, setLoading] = useState(true)
  const [budget, setBudget] = useState(100) // en la moneda elegida (los precios ya vienen en ella)
  const [minGames, setMinGames] = useState(150)
  const [onlyFrontier, setOnlyFrontier] = useState(false)
  const [full, setFull] = useState(true) // solo mazos con todos los precios conocidos
  const maxBudget = getFx().cur === 'EUR' ? 600 : 700

  const withDecks = useMemo(() => leaders.filter((l) => games(l) >= 200), [leaders])
  useEffect(() => {
    let alive = true
    Promise.all(
      withDecks.map((l) =>
        fetchJson<Deck[]>(`decks/${l.code}.json`).then((d) => [l.code, d] as const).catch(() => [l.code, [] as Deck[]] as const),
      ),
    ).then((e) => {
      if (alive) { setDecks(Object.fromEntries(e)); setLoading(false) }
    })
    return () => { alive = false }
  }, [withDecks])

  const all = useMemo<Row[]>(
    () =>
      withDecks.flatMap((l) =>
        (decks[l.code] ?? []).flatMap((d) => {
          const rec = record(d)
          if (!rec) return []
          const { total, unknown } = deckPrice([...d.cards, { id: l.code, qty: 1 }], prices)
          return [{ l, deck: d, price: total, unknown, n: rec.n, wr: rec.wr, lo: wilson(rec.wins, rec.n).lo }]
        }),
      ),
    [withDecks, decks, prices],
  )

  // Frontera de Pareto: ningún otro mazo es a la vez más barato y mejor (por límite inferior).
  const frontier = useMemo(() => {
    const ok = all.filter((r) => r.n >= minGames && (!full || r.unknown === 0))
    const sorted = [...ok].sort((a, b) => a.price - b.price || b.lo - a.lo)
    const set = new Set<Row>()
    let best = -Infinity
    for (const r of sorted) {
      if (r.lo > best) { set.add(r); best = r.lo }
    }
    return set
  }, [all, minGames, full])

  const rows = all
    .filter((r) => r.n >= minGames && r.price <= budget && (!full || r.unknown === 0) && (!onlyFrontier || frontier.has(r)))
    .sort((a, b) => b.lo - a.lo)
    .slice(0, 60)

  return (
    <>
      <h1>Mejores mazos por precio</h1>
      <p className="muted">
        Fija un presupuesto y verás los mazos con mejor <b>win rate fiable</b> (límite inferior al 95 %, que penaliza las muestras
        pequeñas) que caben en él. Los marcados <span className="badge">Mejor relación</span> son aquellos para los que no existe ningún
        otro mazo más barato y a la vez mejor: pagar más que eso no compra más rendimiento.
      </p>

      <div className="filters">
        <label className="range">Presupuesto máximo: <b>{money(budget)}</b>
          <input type="range" min={10} max={maxBudget} step={5} value={Math.min(budget, maxBudget)} onChange={(e) => setBudget(+e.target.value)} />
        </label>
        <label>Partidas mín. por mazo
          <select value={minGames} onChange={(e) => setMinGames(+e.target.value)}>
            {[50, 100, 150, 300, 500].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="chk"><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Solo con precio completo</label>
        <label className="chk"><input type="checkbox" checked={onlyFrontier} onChange={(e) => setOnlyFrontier(e.target.checked)} /> Solo «mejor relación»</label>
        <span className="muted">{loading ? 'Cargando mazos…' : `${rows.length} mazos`}</span>
      </div>

      {!loading && rows.length === 0 && <p className="muted">Ningún mazo cumple los filtros. Sube el presupuesto o baja las partidas mínimas.</p>}
      <table>
        <thead>
          <tr><th>Líder</th><th>Precio</th><th>Win rate</th><th>Fiable ≥</th><th>Partidas</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.l.code + r.deck.hash}>
              <td>
                <a className="leader" href={`#/leader/${r.l.code}/${r.deck.hash}`} title="Ver este mazo">
                  <img src={r.l.img} alt="" loading="lazy" />{r.l.name}<small>{r.l.color}</small>
                </a>
              </td>
              <td><b>{money(r.price)}</b>{r.unknown > 0 && <small title={`${r.unknown} cartas sin precio`}> ~</small>}</td>
              <td>{r.wr.toFixed(1)}%</td>
              <td><b className={r.lo >= 50 ? 'good' : ''}>{r.lo.toFixed(1)}%</b></td>
              <td>{r.n.toLocaleString('es')}{r.n < 300 && <small title="Muestra pequeña"> ⚠</small>}</td>
              <td>{frontier.has(r) && <span className="badge">Mejor relación</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Precio de la impresión normal de cada carta, incluido el líder. En $: TCGPlayer. En €: Cardmarket cuando hay dato; si no, el
        precio en $ convertido con el cambio de arriba. ~ = faltan precios de algunas cartas, así que el real sería algo mayor.
      </p>
    </>
  )
}
