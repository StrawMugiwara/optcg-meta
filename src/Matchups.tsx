import { useEffect, useMemo, useState } from 'react'
import LeaderPicker from './LeaderPicker'
import { fetchJson, type Card, type Leader } from './types'

type Mu = { games: number; winRate: number; first: number | null; second: number | null }

const games = (l: Leader) => l.opbounty?.matches ?? l.kaizoku?.matches ?? 0
const go = (a: string, b?: string) => { location.hash = `#/matchups/${a}${b ? `/${b}` : ''}` }

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

const SIZES: [number, string][] = [[12, '12 más jugados'], [20, '20 más jugados'], [40, '40 más jugados'], [999, 'Todos']]

export default function Matchups({ leaders, cards, a, b }: { leaders: Leader[]; cards: Record<string, Card>; a?: string; b?: string }) {
  const sorted = useMemo(() => [...leaders].sort((x, y) => games(y) - games(x)), [leaders])
  const A = leaders.find((l) => l.code === a) ?? sorted[0]
  const B = leaders.find((l) => l.code === b && l.code !== A.code) ?? null // el segundo líder es opcional
  const [size, setSize] = useState(20)
  const rivals = useMemo(() => sorted.filter((l) => l.code !== A.code).slice(0, size), [sorted, A, size])
  const top = sorted.slice(0, 12)

  return (
    <>
      <h1>Matchups</h1>
      <p className="muted">Elige un líder y verás cómo le va contra todos los demás. Opcionalmente, compáralo con otro. Solo hay dato si se jugaron al menos 100 partidas entre los dos.</p>
      <div className="vs">
        <label className="grow">Líder
          <LeaderPicker leaders={sorted} value={A.code} onChange={(c) => go(c, B?.code)} />
        </label>
        <label className="grow">Comparar con otro (opcional)
          <span className="with-clear">
            <LeaderPicker leaders={sorted} value={B?.code ?? ''} onChange={(c) => go(A.code, c)} />
            {B && <button onClick={() => go(A.code)} title="Quitar la comparación">✕</button>}
          </span>
        </label>
      </div>

      {B ? (
        <>
          <Duel A={A} B={B} rivals={rivals} cards={cards} />
          <details className="more">
            <summary>Ver a {A.name} contra todos los rivales</summary>
            <AgainstField A={A} rivals={rivals} size={size} setSize={setSize} onPick={(code) => go(A.code, code)} selected={B.code} />
          </details>
        </>
      ) : (
        <AgainstField A={A} rivals={rivals} size={size} setSize={setSize} onPick={(code) => go(A.code, code)} />
      )}

      <h2>Matriz de los {top.length} líderes más jugados</h2>
      <p className="muted">Lee la fila contra la columna: cuánto gana el líder de la fila (en %). Pulsa una celda para ver el detalle y pasa el ratón por una carta para verla en grande.</p>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr><th />{top.map((c) => (
              <th key={c.code} title={c.name} className="col"><img src={c.img} alt={c.name} /><span>{c.name}</span></th>
            ))}</tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.code}>
                <th title={r.name} className="row-h"><img src={r.img} alt={r.name} /><span>{r.name}<small>{r.color}</small></span></th>
                {top.map((c) => {
                  const m = r.code === c.code ? null : versus(r, c)
                  return (
                    <td key={c.code} style={m ? { background: heat(m.winRate) } : undefined}
                        onClick={() => m && go(r.code, c.code)} title={m ? `${r.name} vs ${c.name}: ${m.winRate}% (${m.games} partidas)` : ''}>
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

/** Todas las estadísticas de un líder contra el resto del meta. */
function AgainstField({ A, rivals, size, setSize, onPick, selected }: {
  A: Leader; rivals: Leader[]; size: number; setSize: (n: number) => void; onPick: (code: string) => void; selected?: string
}) {
  const [sort, setSort] = useState<'best' | 'worst' | 'pres'>('best')
  const rows = useMemo(() => rivals.flatMap((r) => { const m = versus(A, r); return m ? [{ r, m }] : [] }), [A, rivals])
  const shown = useMemo(
    () => [...rows].sort((x, y) => (sort === 'best' ? y.m.winRate - x.m.winRate : sort === 'worst' ? x.m.winRate - y.m.winRate : games(y.r) - games(x.r))),
    [rows, sort],
  )

  const totW = rows.reduce((n, x) => n + games(x.r), 0)
  const avg = totW ? rows.reduce((n, x) => n + x.m.winRate * games(x.r), 0) / totW : 0
  const fav = rows.filter((x) => x.m.winRate >= 52).length
  const unf = rows.filter((x) => x.m.winRate <= 48).length
  const even = rows.length - fav - unf
  const best = rows.length ? [...rows].sort((x, y) => y.m.winRate - x.m.winRate)[0] : null
  const worst = rows.length ? [...rows].sort((x, y) => x.m.winRate - y.m.winRate)[0] : null
  const s = A.opbounty ?? A.kaizoku

  return (
    <>
      <div className="hero-vs">
        <Side l={A} />
        <div className="field-sum">
          <div className="muted">Contra los rivales de abajo, ponderado por presencia</div>
          <div className={`big ${avg >= 50 ? 'good' : 'bad'}`}>{rows.length ? `${avg.toFixed(1)}%` : '—'}</div>
          {s && <div className="muted">Win rate global del líder: {s.winRate}%</div>}
          <div className="chips">
            <span className="chip good">Favorable en {fav}</span>
            <span className="chip">Igualado en {even}</span>
            <span className="chip bad">Desfavorable en {unf}</span>
          </div>
          {best && worst && (
            <div className="muted small-row">
              Mejor contra <b className="good">{best.r.name}</b> ({best.m.winRate}%) · peor contra <b className="bad">{worst.r.name}</b> ({worst.m.winRate}%)
            </div>
          )}
        </div>
      </div>

      <div className="filters">
        <button className={sort === 'best' ? 'on' : ''} onClick={() => setSort('best')}>De mejor a peor</button>
        <button className={sort === 'worst' ? 'on' : ''} onClick={() => setSort('worst')}>De peor a mejor</button>
        <button className={sort === 'pres' ? 'on' : ''} onClick={() => setSort('pres')}>Por presencia del rival</button>
        <label className="inline">Rivales
          <select value={size} onChange={(e) => setSize(+e.target.value)}>
            {SIZES.map(([n, t]) => <option key={n} value={n}>{t}</option>)}
          </select>
        </label>
        <span className="muted">{rows.length} con datos suficientes</span>
      </div>

      <table>
        <thead><tr><th>Rival</th><th>{A.name} gana</th><th>Jugando primero</th><th>Jugando segundo</th><th>Partidas</th><th>Presencia del rival</th></tr></thead>
        <tbody>
          {shown.map(({ r, m }) => (
            <tr key={r.code} className={`clickable ${r.code === selected ? 'sel' : ''}`} onClick={() => onPick(r.code)} title="Pulsa para comparar con este líder">
              <td><span className="leader"><img src={r.img} alt="" />{r.name}<small>{r.color}</small></span></td>
              <td className="num" style={{ background: heat(m.winRate) }}>{m.winRate.toFixed(1)}%</td>
              <td className="num">{m.first != null ? `${m.first}%` : '—'}</td>
              <td className="num">{m.second != null ? `${m.second}%` : '—'}</td>
              <td>{m.games.toLocaleString('es')}{m.games < 300 ? ' ⚠' : ''}</td>
              <td>{((r.opbounty?.popularity ?? r.kaizoku?.playRate) ?? 0).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Pulsa un rival para verlo en detalle y comparar a los dos. ⚠ = menos de 300 partidas (dato poco fiable). «Jugando primero/segundo» sale de otra fuente (Car D. Kaizoku) y puede faltar.</p>
    </>
  )
}

/** Detalle de un líder contra otro: resultado, quién empieza, y qué cartas ayudan en este enfrentamiento. */
function Duel({ A, B, rivals, cards }: { A: Leader; B: Leader; rivals: Leader[]; cards: Record<string, Card> }) {
  const ab = versus(A, B)
  const ba = versus(B, A)
  const pct = (n: number | null | undefined) => (n != null ? `${n}%` : '—')
  return (
    <>
      <h2>{A.name} contra {B.name}</h2>
      <div className="vs-cards">
        <Side l={A} />
        <div className="vs-mid">
          {ab ? (
            <>
              <div className={`big ${ab.winRate >= 50 ? 'good' : 'bad'}`}>{ab.winRate}%</div>
              <div className="muted">{A.name} gana a {B.name}</div>
              <div>{ab.games.toLocaleString('es')} partidas{ab.games < 300 ? ' ⚠ muestra pequeña' : ''}</div>
              <p className="verdict">{verdict(A, B, ab)}</p>
            </>
          ) : (
            <p className="muted">Sin partidas suficientes entre estos dos líderes (menos de 100).</p>
          )}
        </div>
        <Side l={B} />
      </div>

      {ab && (
        <table className="duel-table">
          <thead><tr><th /><th>Gana</th><th>Si empieza primero</th><th>Si empieza segundo</th></tr></thead>
          <tbody>
            <tr><td><b>{A.name}</b></td><td className="num" style={{ background: heat(ab.winRate) }}>{pct(ab.winRate)}</td><td className="num">{pct(ab.first)}</td><td className="num">{pct(ab.second)}</td></tr>
            {ba && <tr><td><b>{B.name}</b></td><td className="num" style={{ background: heat(ba.winRate) }}>{pct(ba.winRate)}</td><td className="num">{pct(ba.first)}</td><td className="num">{pct(ba.second)}</td></tr>}
          </tbody>
        </table>
      )}

      <div className="tech-cols">
        <TechCards from={A} vs={B} cards={cards} total={ab?.games ?? 0} />
        <TechCards from={B} vs={A} cards={cards} total={ab?.games ?? 0} />
      </div>

      <details className="more">
        <summary>Comparar a {A.name} y {B.name} contra todo el meta</summary>
        <FieldTable A={A} B={B} rivals={rivals} />
      </details>
    </>
  )
}

type TechItem = { id: string; lift: number; with: number; without: number; n: number }

/** Cartas de `from` que suben o bajan su win rate específicamente contra `vs`. */
function TechCards({ from, vs, cards, total }: { from: Leader; vs: Leader; cards: Record<string, Card>; total: number }) {
  const [tech, setTech] = useState<TechItem[] | null | undefined>(undefined)
  useEffect(() => {
    setTech(undefined)
    fetchJson<{ tech?: Record<string, TechItem[]> }>(`cardstats/${from.code}.json`)
      .then((s) => setTech(s.tech?.[vs.code] ?? null))
      .catch(() => setTech(null))
  }, [from.code, vs.code])

  // Una carta que casi todos llevan no se puede valorar: las partidas «sin ella» son muy pocas y el porcentaje es ruido.
  const MIN_WITHOUT = 150
  const usable = tech ? tech.filter((x) => total > 0 && total - x.n >= MIN_WITHOUT) : tech

  return (
    <div className="tech">
      <h3>Cartas de {from.name} en este matchup</h3>
      {tech === undefined && <p className="muted">Cargando…</p>}
      {tech === null && <p className="muted">No hay datos de cartas para este enfrentamiento (muestra insuficiente).</p>}
      {tech && usable && usable.length === 0 && (
        <p className="muted">Ninguna carta se puede valorar con fiabilidad: las que salen en este matchup las lleva casi todo el mundo, así que apenas hay partidas «sin ella» para comparar.</p>
      )}
      {usable && usable.map((t) => (
        <div key={t.id} className="tech-row hov" data-card={t.id}>
          {cards[t.id] && <img src={cards[t.id].img} alt="" className="mini" loading="lazy" />}
          <span>{cards[t.id]?.name ?? t.id}<small>{t.id}</small></span>
          <span className="muted">con ella {t.with}% ({t.n.toLocaleString('es')}p) · sin ella {t.without}% (≈{Math.max(0, total - t.n).toLocaleString('es')}p)</span>
          <b className={t.lift > 0 ? 'good' : 'bad'}>{t.lift > 0 ? '+' : ''}{t.lift}</b>
        </div>
      ))}
      {usable && usable.length > 0 && <p className="muted">Compara los mazos que llevan la carta con los que no, solo en partidas contra {vs.name}. Los valores altos pueden ser casualidad si hay pocas partidas.</p>}
    </div>
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

/** Compara dos líderes contra todos los rivales a la vez y dice cuál rinde mejor. */
function FieldTable({ A, B, rivals }: { A: Leader; B: Leader; rivals: Leader[] }) {
  const [sort, setSort] = useState<'pres' | 'diff'>('pres')
  const rows = rivals.filter((r) => r.code !== B.code).map((r) => {
    const a = versus(A, r)
    const b = versus(B, r)
    return { r, a, b, diff: a && b ? a.winRate - b.winRate : null }
  })
  const sorted = sort === 'pres' ? rows : [...rows].sort((x, y) => (y.diff ?? -999) - (x.diff ?? -999))

  // Resumen: media ponderada por presencia del rival, solo con rivales que tienen dato para ambos
  const both = rows.filter((x) => x.a && x.b)
  const w = (x: (typeof rows)[number]) => games(x.r)
  const tot = both.reduce((n, x) => n + w(x), 0)
  const avg = (pick: (x: (typeof rows)[number]) => Mu | null) => (tot ? both.reduce((n, x) => n + pick(x)!.winRate * w(x), 0) / tot : 0)
  const avgA = avg((x) => x.a)
  const avgB = avg((x) => x.b)
  const winsA = both.filter((x) => x.a!.winRate > x.b!.winRate).length
  const winsB = both.filter((x) => x.b!.winRate > x.a!.winRate).length
  const gap = avgA - avgB
  const better = Math.abs(gap) < 1 ? null : gap > 0 ? A : B

  return (
    <>
      <h3>{A.name} frente a {B.name} contra el resto del meta</h3>
      {both.length > 0 && (
        <div className="summary">
          <div><span className="muted">{A.name}</span><b className={avgA >= 50 ? 'good' : 'bad'}>{avgA.toFixed(1)}%</b></div>
          <div className="mid">
            {better ? <>Mejor contra el meta: <b>{better.name}</b> (+{Math.abs(gap).toFixed(1)} puntos)</> : <>Prácticamente igualados contra el meta</>}
            <small>Media ponderada por presencia · {A.name} gana en {winsA} rivales, {B.name} en {winsB} (de {both.length})</small>
          </div>
          <div><span className="muted">{B.name}</span><b className={avgB >= 50 ? 'good' : 'bad'}>{avgB.toFixed(1)}%</b></div>
        </div>
      )}
      <div className="filters">
        <button className={sort === 'pres' ? 'on' : ''} onClick={() => setSort('pres')}>Por presencia del rival</button>
        <button className={sort === 'diff' ? 'on' : ''} onClick={() => setSort('diff')}>Donde más gana {A.name}</button>
      </div>
      <table>
        <thead><tr><th>Rival</th><th>{A.name}</th><th>{B.name}</th><th>Mejor</th></tr></thead>
        <tbody>
          {sorted.map(({ r, a, b, diff }) => (
            <tr key={r.code}>
              <td><a className="leader" href={`#/leader/${r.code}`}><img src={r.img} alt="" />{r.name}<small>{r.color}</small></a></td>
              <Cell m={r.code === A.code ? null : a} />
              <Cell m={b} />
              <td>
                {diff == null ? <span className="muted">—</span> : Math.abs(diff) < 2 ? <span className="muted">igual</span>
                  : <b className="good">{diff > 0 ? A.name : B.name} <small>+{Math.abs(diff).toFixed(0)}</small></b>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">«igual» = diferencia menor de 2 puntos. Pasa el ratón por una cifra para ver cuántas partidas fueron.</p>
    </>
  )
}

function Cell({ m }: { m: Mu | null }) {
  if (!m) return <td className="muted">—</td>
  return (
    <td title={`${m.games.toLocaleString('es')} partidas`} style={{ background: heat(m.winRate) }} className="num">{m.winRate.toFixed(0)}%</td>
  )
}
