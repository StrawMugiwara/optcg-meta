export type Stat = { matches: number; wins: number; winRate: number; playRate?: number; popularity?: number; firstWinRate?: number; secondWinRate?: number }
export type Leader = {
  code: string
  name: string
  color: string
  img: string
  kaizoku: Stat | null
  opbounty: Stat | null
  deckCount: number
  matchups: Record<string, { games: number; winRate: number; first: number | null; second: number | null }>
}
export type Card = { imgAlt?: string; name: string; type: string; cost: string; color: string; power: string; counter: string; rarity: string; img: string; set: string }
export type Deck = {
  hash: string
  cards: { id: string; qty: number }[]
  games: number
  sources: { opbounty?: { games: number; winRate: number }; kaizokuPlayed?: { winRate: number; pilots: number }; optcgone?: { games: number; winRate: number } }
}
export type Meta = { date: string; players: number }

export const DATA = `${import.meta.env.BASE_URL}data/`
export const fetchJson = <T,>(p: string) => fetch(DATA + p).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(p)))

export type Prices = { date: string; prices: Record<string, number> }

export type EurPrices = { date: string; eur: Record<string, number> }

// Cartas con precio real de Cardmarket (solo en modo €). El resto se convierte desde USD y se cuenta como aproximado.
let exactEur: Set<string> | null = null
export const setExactEur = (s: Set<string> | null) => { exactEur = s }

/**
 * Precios en la moneda elegida. En USD: TCGPlayer. En EUR: Cardmarket cuando existe;
 * si no, el precio en USD convertido con el cambio fijado (aproximado).
 */
export function buildPrices(usdMap: Record<string, number>, eurMap: Record<string, number>, fx: Fx) {
  if (fx.cur === 'USD') return { prices: usdMap, exact: null as Set<string> | null }
  const prices: Record<string, number> = {}
  const exact = new Set<string>()
  for (const id of Object.keys(usdMap)) prices[id] = usdMap[id] * fx.rate
  for (const [id, v] of Object.entries(eurMap)) { prices[id] = v; exact.add(id) }
  return { prices, exact }
}

/** Precio total de una lista (en la moneda de `prices`), copias sin precio y copias con precio aproximado. */
export function deckPrice(list: { id: string; qty: number }[], prices: Record<string, number>) {
  let total = 0
  let unknown = 0
  let approx = 0
  for (const { id, qty } of list) {
    if (id in prices) {
      total += prices[id] * qty
      if (exactEur && !exactEur.has(id)) approx += qty
    } else unknown += qty
  }
  return { total, unknown, approx }
}
// Moneda de visualización. Los precios vienen en USD; el cambio a EUR es aproximado y editable.
export type Fx = { cur: 'USD' | 'EUR'; rate: number }
const FX_KEY = 'optcg-fx2' // clave nueva: la app ahora solo usa euros
export const getFx = (): Fx => {
  try {
    const f = JSON.parse(localStorage.getItem(FX_KEY) ?? 'null')
    if (f && f.rate > 0) return { cur: 'EUR', rate: f.rate } // la app solo muestra euros
  } catch { /* sin almacenamiento */ }
  return { cur: 'EUR', rate: 0.63 }
}
export const setFx = (f: Fx) => {
  try { localStorage.setItem(FX_KEY, JSON.stringify(f)) } catch { /* sin almacenamiento */ }
}
/** Formatea un importe que YA está en la moneda elegida (los mapas de precios se construyen con buildPrices). */
export const money = (n: number) => {
  const s = n.toFixed(n < 10 ? 2 : 0)
  return getFx().cur === 'EUR' ? `${s} €` : `$${s}`
}
export const usd = money

/** Intervalo de Wilson al 95 % para una proporción de victorias. Devuelve porcentajes. */
export function wilson(wins: number, n: number) {
  if (n <= 0) return { lo: 0, hi: 100 }
  const z = 1.96
  const p = wins / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return { lo: ((c - m) / d) * 100, hi: ((c + m) / d) * 100 }
}
