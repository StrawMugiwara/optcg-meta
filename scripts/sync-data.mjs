// Descarga los datos diarios de alexfrey317/optcg-data y los recorta para la app.
// Uso: npm run sync
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://raw.githubusercontent.com/alexfrey317/optcg-data/main/data/latest'
const OUT = new URL('../public/data/', import.meta.url)
const MIN_LEADER_GAMES = 200 // un líder recibe su fichero de mazos si tiene al menos estas partidas
const DECKS_PER_LEADER = 8
const DELAY_MS = 1000 // pausa entre peticiones para ser amables con el servidor

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (path) => {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json()
}
// Imagen principal: optcgapi.com (responde mejor). Si falla, main.tsx cae al CDN original.
const imgUrl = (id) => `https://optcgapi.com/media/static/Card_Images/${id}.jpg`
const save = (name, data) => writeFile(new URL(name, OUT), JSON.stringify(data))

await mkdir(new URL('decks/', OUT), { recursive: true })

const [leadersRaw, cards, meta] = await Promise.all([
  get('leaders.json'),
  get('cards.json'),
  get('meta.json'),
])

// Leaders: nos quedamos con los campos que usa la interfaz (sin la tabla completa de matchups por fuente).
const leaders = Object.values(leadersRaw).map((l) => ({
  code: l.code,
  name: l.name,
  color: l.color,
  img: imgUrl(l.code),
  imgAlt: l.img,
  kaizoku: l.sources?.kaizoku ?? null,
  opbounty: l.sources?.opbounty ?? null,
  deckCount: l.deckCount,
  matchups: Object.fromEntries(
    Object.entries(l.matchups ?? {}).flatMap(([opp, m]) => {
      const s = m.opbounty ?? m.kaizoku
      const k = m.kaizoku
      return s && s.games >= 100
        ? [[opp, { games: s.games, winRate: s.winRate, first: k?.firstWinRate ?? null, second: k?.secondWinRate ?? null }]]
        : []
    }),
  ),
}))

const games = (l) => l.opbounty?.matches ?? l.kaizoku?.matches ?? 0
leaders.sort((a, b) => games(b) - games(a))

await save('leaders.json', leaders)
await save('cards.json', Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, { ...c, img: imgUrl(id), imgAlt: c.img }])))
await save('meta.json', {
  date: meta.date,
  generatedAt: meta.generatedAt,
  players: meta.players,
  windows: meta.windows,
})

// Precios (USD, TCGPlayer market) de optcgapi.com: una entrada por impresión; usamos la normal.
async function syncPrices() {
  const prices = {}
  let date = ''
  for (const ep of ['allSetCards', 'allSTCards']) {
    await sleep(DELAY_MS)
    const res = await fetch(`https://optcgapi.com/api/${ep}/`)
    if (!res.ok) throw new Error(`${ep}: HTTP ${res.status}`)
    const rows = await res.json()
    for (const r of rows) {
      const id = r.card_set_id
      const price = r.market_price ?? r.inventory_price
      if (!id || price == null) continue
      date = r.date_scraped > date ? r.date_scraped : date
      const base = r.card_image_id === id
      // La impresión base manda; si no existe, el precio más bajo de las variantes.
      if (base || !(id in prices) || (!prices[id].base && price < prices[id].p)) prices[id] = { p: price, base }
    }
  }
  const out = Object.fromEntries(Object.entries(prices).map(([id, v]) => [id, v.p]))
  await save('prices.json', { date, prices: out })
  console.log(`ok  precios: ${Object.keys(out).length} cartas (${date})`)
}
try { await syncPrices() } catch (e) { console.warn(`ERR precios: ${e.message}`) }

for (const l of leaders.filter((l) => games(l) >= MIN_LEADER_GAMES)) {
  await sleep(DELAY_MS)
  try {
    const { decks } = await get(`decks/${l.code}.json`)
    const best = decks
      .map((d) => ({
        hash: d.hash,
        cards: d.cards,
        sources: d.sources,
        games: d.sources?.opbounty?.games ?? d.sources?.kaizokuPlayed?.games ?? 0,
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, DECKS_PER_LEADER)
    await save(`decks/${l.code}.json`, best)
    console.log(`ok  ${l.code} ${l.name} (${best.length} mazos)`)
  } catch (e) {
    console.warn(`ERR ${l.code}: ${e.message}`)
  }
}
console.log('Sincronizado:', meta.date)
