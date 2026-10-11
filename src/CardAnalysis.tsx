import { useEffect, useState } from 'react'
import { fetchJson, type Card } from './types'

type CardStat = { id: string; n: number; usage: number; avg: number; wr: number; q: [number, number, number][] }
type Stats = { games: number; wr: number; cards: CardStat[] }

const CORE = 85 // % de uso a partir del cual una carta se considera del "núcleo"
const FLEX_MIN_USAGE = 8
const FLEX_MIN_GAMES = 1000

/** Margen de error (±puntos, 95 %) de un win rate `wr` medido en `n` partidas. */
const margin = (wr: number, n: number) => 1.96 * Math.sqrt(((wr / 100) * (1 - wr / 100)) / n) * 100

export default function CardAnalysis({ code, cards }: { code: string; cards: Record<string, Card> }) {
  const [s, setS] = useState<Stats | null | undefined>(undefined)
  useEffect(() => {
    setS(undefined)
    fetchJson<Stats>(`cardstats/${code}.json`).then(setS).catch(() => setS(null))
  }, [code])

  if (s === undefined) return <p className="muted">Cargando análisis de cartas…</p>
  if (s === null || s.cards.length === 0) return null

  const core = s.cards.filter((c) => c.usage >= CORE).sort((a, b) => b.usage - a.usage)
  const flex = s.cards
    .filter((c) => c.usage >= FLEX_MIN_USAGE && c.usage < CORE && c.n >= FLEX_MIN_GAMES)
    .map((c) => ({ ...c, delta: c.wr - s.wr, err: margin(c.wr, c.n) }))
    .sort((a, b) => b.delta - a.delta)

  // Cartas del núcleo donde llevar menos copias que la mayoría rinde claramente peor (o mejor).
  const copies = core
    .flatMap((c) => {
      const sorted = [...c.q].sort((a, b) => b[1] - a[1])
      const main = sorted[0]
      const other = sorted.slice(1).find((x) => x[1] >= 150)
      if (!main || !other) return []
      const diff = other[2] - main[2]
      const err = margin(main[2], main[1]) + margin(other[2], other[1])
      return Math.abs(diff) > err ? [{ c, main, other, diff }] : []
    })
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 6)

  const name = (id: string) => cards[id]?.name ?? id

  return (
    <>
      <h2>Análisis de cartas</h2>
      <details>
        <summary>¿Cómo se lee esto?</summary>
        <p className="muted">
          <b>Núcleo</b>: cartas que casi todos los jugadores de este líder llevan. No hay mucho que decidir con ellas.<br />
          <b>Cartas que cambian</b>: unos mazos las llevan y otros no. Para cada una se compara el win rate de los mazos que la
          llevan con el win rate medio del líder: si es claramente mayor, la carta suele ir en mazos que ganan más.<br />
          <b>Ojo</b>: eso no prueba que la carta sea la causa. Puede que la lleven jugadores mejores. Y las diferencias de menos
          de un punto casi siempre son ruido: por eso solo marco ▲ o ▼ cuando la diferencia supera el margen de error.
        </p>
      </details>

      <h3>Núcleo · {core.length} cartas que casi todos llevan</h3>
      <div className="grid small">
        {core.map((c) => (
          <figure key={c.id} title={`${name(c.id)} · la llevan el ${c.usage}% · ${c.avg} copias de media`}>
            {cards[c.id] ? <img src={cards[c.id].img} alt={name(c.id)} loading="lazy" /> : <div className="ph">{c.id}</div>}
            <figcaption>×{Math.round(c.avg)}<small>{c.usage.toFixed(0)}%</small></figcaption>
          </figure>
        ))}
      </div>

      {flex.length > 0 && (
        <>
          <h3>Cartas que cambian de un mazo a otro</h3>
          <table>
            <thead><tr><th>Carta</th><th>La llevan</th><th>Copias</th><th>Win rate con ella</th><th>vs. media del líder ({s.wr}%)</th><th>Partidas</th></tr></thead>
            <tbody>
              {flex.map((c) => {
                const sig = Math.abs(c.delta) > c.err
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="leader hov" data-card={c.id}>
                        {cards[c.id] && <img src={cards[c.id].img} alt="" loading="lazy" />}{name(c.id)}<small>{c.id}</small>
                      </span>
                    </td>
                    <td>{c.usage.toFixed(0)}%</td>
                    <td>{c.avg.toFixed(1)}</td>
                    <td>{c.wr.toFixed(1)}%</td>
                    <td>
                      <b className={sig ? (c.delta > 0 ? 'good' : 'bad') : ''}>
                        {c.delta > 0 ? '+' : ''}{c.delta.toFixed(1)}{sig ? (c.delta > 0 ? ' ▲' : ' ▼') : ''}
                      </b>
                      <small> ±{c.err.toFixed(1)}</small>
                    </td>
                    <td>{c.n.toLocaleString('es')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="muted">▲/▼ = la diferencia es mayor que el margen de error (±). Sin flecha = no se puede distinguir del ruido.</p>
        </>
      )}

      {copies.length > 0 && (
        <>
          <h3>Número de copias</h3>
          <p className="muted">Cartas del núcleo en las que llevar menos copias que la mayoría se asocia a un win rate claramente distinto:</p>
          {copies.map(({ c, main, other, diff }) => (
            <div key={c.id} className="row hov" data-card={c.id}>
              {cards[c.id] && <img src={cards[c.id].img} alt="" loading="lazy" className="mini" />}
              {name(c.id)}<small>{c.id}</small>
              <span className="muted">&nbsp;·{main[0]} copias: {main[2]}% ({main[1].toLocaleString('es')}p) · {other[0]} copias: {other[2]}% ({other[1].toLocaleString('es')}p)</span>
              <b className={diff < 0 ? 'bad' : 'good'}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}</b>
            </div>
          ))}
        </>
      )}
    </>
  )
}
