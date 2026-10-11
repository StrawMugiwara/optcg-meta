import { useMemo } from 'react'
import type { Leader } from './types'

type Mu = { games: number; winRate: number; first: number | null; second: number | null }

const games = (l: Leader) => l.opbounty?.matches ?? l.kaizoku?.matches ?? 0
const go = (a: string, b: string) => { location.hash = `#/matchups/${a}/${b}` }

/** Win rate de a contra b. Si a no tiene el dato, se deduce del espejo (b contra a). */
function versus(a: Leader, b: Leader): Mu | null {
  const m = a.matchups[b.code]
  if (m) return m
  const r = b.matchups[a.code]
  return r ? { games: r.games, winRate: +(100 - r.winRate).toFixed(1), first: r.second, second: r.first } : null
}

const heat = (wr: number) => {
  // Rojo (<50) – gris (50) – verde (>50), saturación según distancia
  const d = Math.max(-25, Math.min(25, wr - 50)) / 25
  return d >= 0 ? `rgba(40,170,100,${0.15 + d * 0.65})` : `rgba(210,60,50,${0.15 - d * 0.65})`
}

export default function Matchups({ leaders, a, b }: { leaders: Leader[]; a?: string; b?: string }) {
  const sorted = useMemo(() => [...leaders].sort((x, y) => games(y) - games(x)), [leaders])
  const A = leaders.find((l) => l.code === a) ?? sorted[0]
  const B = leaders.find((l) => l.code === b) ?? sorted[1]
  const top = sorted.slice(0, 12)
  const ab = versus(A, B)
  const ba = versus(B, A)

  return (
    <>
      <h1>Matchups</h1>
      <p className="muted">Win rate de un líder contra otro en el ladder del simulador. Solo hay dato si se jugaron al menos 100 partidas.</p>
      <div className="vs">
        <LeaderSelect leaders={sorted} value={A.code} onChange={(c) => go(c, B.code)} />
        <button onClick={() => go(B.code, A.code)} title="Intercambiar">⇄</button>
        <LeaderSelect leaders={sorted} value={B.code} onChange={(c) => go(A.code, c)} />
      </div>

      <div className="vs-cards">
        <Side l={A} />
        <div className="vs-mid">
          {ab ? (
            <>
              <div className={`big ${ab.winRate >= 50 ? 'good' : 'bad'}`}>{ab.winRate}%</div>
              <div className="muted">{A.name} gana a {B.name}</div>
              <div>{ab.games.toLocaleString('es')} partidas</div>
              {ab.first != null && ab.second != null && (
                <div className="muted">Jugando primero {ab.first}% · segundo {ab.second}%</div>
              )}
              {ba && A.code !== B.code && <div className="muted">Visto desde {B.name}: {ba.winRate}%</div>}
              <p className="verdict">{verdict(A, B, ab)}</p>
            </>
          ) : (
            <p className="muted">Sin partidas suficientes entre estos dos líderes.</p>
          )}
        </div>
        <Side l={B} />
      </div>

      <h2>Matriz de los 12 líderes más jugados</h2>
      <p className="muted">Lee la fila contra la columna: cuánto gana el líder de la fila. Pulsa una celda para ver el detalle.</p>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr><th />{top.map((c) => <th key={c.code} title={c.name}><img src={c.img} alt={c.name} /></th>)}</tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.code}>
                <th title={r.name}><img src={r.img} alt={r.name} /></th>
                {top.map((c) => {
                  const m = r.code === c.code ? null : versus(r, c)
                  return (
                    <td key={c.code} style={m ? { background: heat(m.winRate) } : undefined}
                        onClick={() => m && go(r.code, c.code)} title={m ? `${r.name} vs ${c.name}: ${m.winRate}% (${m.games}p)` : ''}>
                      {r.code === c.code ? '·' : m ? Math.round(m.winRate) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function verdict(a: Leader, b: Leader, m: Mu) {
  const d = m.winRate - 50
  if (a.code === b.code) return 'Espejo: el resultado depende del jugador y de quién empiece.'
  const who = d > 0 ? a.name : b.name
  const gap = Math.abs(d)
  const strength = gap < 3 ? 'Matchup equilibrado' : gap < 8 ? `Ligera ventaja para ${who}` : `Ventaja clara para ${who}`
  const tempo = m.first != null && m.second != null && Math.abs(m.first - m.second) >= 6
    ? ` · empezar ${m.first > m.second ? 'primero' : 'segundo'} ayuda mucho a ${a.name}`
    : ''
  return strength + tempo
}

function Side({ l }: { l: Leader }) {
  const s = l.opbounty ?? l.kaizoku
  return (
    <a className="side" href={`#/leader/${l.code}`}>
      <img src={l.img} alt={l.name} />
      <b>{l.name}</b>
      <span className="muted">{l.color}</span>
      {s && <span>{s.winRate}% global</span>}
    </a>
  )
}

function LeaderSelect({ leaders, value, onChange }: { leaders: Leader[]; value: string; onChange: (c: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {leaders.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.color})</option>)}
    </select>
  )
}
