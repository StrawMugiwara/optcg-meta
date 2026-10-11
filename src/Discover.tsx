import { useMemo, useState } from 'react'
import { wilson, type Leader } from './types'

type Row = {
  l: Leader
  set: string
  n: number
  wr: number
  lo: number
  hi: number
  pop: number
  src: 'OPBounty' | 'Kaizoku'
}

const setOf = (code: string) => code.split('-')[0]
const SORTS = {
  adj: 'Win rate fiable (límite inferior)',
  wr: 'Win rate bruto',
  n: 'Más partidas',
} as const

export default function Discover({ leaders }: { leaders: Leader[] }) {
  const [minGames, setMinGames] = useState(300)
  const [maxPresence, setMaxPresence] = useState(5)
  const [set, setSet] = useState('')
  const [sort, setSort] = useState<keyof typeof SORTS>('adj')

  const all = useMemo<Row[]>(
    () =>
      leaders.flatMap((l) => {
        // Preferimos OPBounty; si el líder no está ahí, usamos Car D. Kaizoku (cubre más líderes)
        const s = l.opbounty ?? l.kaizoku
        if (!s || s.matches === 0) return []
        const w = wilson(s.wins, s.matches)
        return [{ l, set: setOf(l.code), n: s.matches, wr: s.winRate, lo: w.lo, hi: w.hi, pop: s.popularity ?? s.playRate ?? 0, src: l.opbounty ? 'OPBounty' as const : 'Kaizoku' as const }]
      }),
    [leaders],
  )
  const sets = useMemo(() => [...new Set(all.map((r) => r.set))].sort().reverse(), [all])

  const rows = all
    .filter((r) => r.n >= minGames && r.pop <= maxPresence && (!set || r.set === set))
    .sort((a, b) => (sort === 'adj' ? b.lo - a.lo : sort === 'wr' ? b.wr - a.wr : b.n - a.n))

  return (
    <>
      <h1>Descubre mazos fuera del meta</h1>
      <p className="muted">
        Líderes poco jugados que rinden bien. Para no fiarnos de muestras pequeñas, ordenamos por el <b>límite inferior</b> del
        intervalo de confianza al 95 %: es el win rate que el líder tiene casi seguro como mínimo. Un 65 % con 40 partidas puede ser
        suerte; un 54 % con 2.000, no.
      </p>

      <div className="filters">
        <label>Partidas mín.
          <select value={minGames} onChange={(e) => setMinGames(+e.target.value)}>
            {[100, 200, 300, 500, 1000, 2000].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>Presencia
          <select value={maxPresence} onChange={(e) => setMaxPresence(+e.target.value)}>
            <option value={2}>muy rara (≤2 %)</option>
            <option value={5}>fuera del meta (≤5 %)</option>
            <option value={10}>media (≤10 %)</option>
            <option value={100}>cualquiera</option>
          </select>
        </label>
        <label>Set
          <select value={set} onChange={(e) => setSet(e.target.value)}>
            <option value="">Todos</option>
            {sets.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Orden
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <span className="muted">{rows.length} líderes</span>
      </div>

      {rows.length === 0 && <p className="muted">Ningún líder cumple los filtros. Prueba a bajar las partidas mínimas.</p>}
      <table>
        <thead>
          <tr><th>Líder</th><th>Win rate</th><th title="Intervalo de confianza al 95 %">Rango fiable</th><th>Partidas</th><th>Presencia</th><th>Fuente</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.l.code}>
              <td>
                <a className="leader" href={`#/leader/${r.l.code}`}>
                  <img src={r.l.img} alt="" loading="lazy" />{r.l.name}<small>{r.l.color} · {r.set}</small>
                </a>
              </td>
              <td><b className={r.wr >= 50 ? 'good' : 'bad'}>{r.wr.toFixed(1)}%</b></td>
              <td>
                <span className="ci" title={`${r.lo.toFixed(1)}% – ${r.hi.toFixed(1)}%`}>
                  <i style={{ left: `${Math.max(0, (r.lo - 35) * 2)}%`, width: `${Math.max(2, (r.hi - r.lo) * 2)}%` }} />
                  <em style={{ left: '30%' }} />
                </span>
                <small>{r.lo.toFixed(1)}–{r.hi.toFixed(1)}</small>
                {r.n < 500 && <small title="Muestra pequeña: el rango es muy ancho"> ⚠</small>}
              </td>
              <td>{r.n.toLocaleString('es')}</td>
              <td>{r.pop.toFixed(1)}%</td>
              <td><small>{r.src}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">La barra va de 35 % a 85 %; la línea marca el 50 %. ⚠ = menos de 500 partidas.</p>
    </>
  )
}
