// Descarga las estadísticas por carta de cada líder (uso, copias, win rate con la carta) y las recorta.
// Uso: npm run sync (se ejecuta después de sync-data.mjs, que genera leaders.json)
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const BASE = 'https://raw.githubusercontent.com/alexfrey317/optcg-data/main/data/latest'
const OUT = new URL('../public/data/cardstats/', import.meta.url)
const MIN_LEADER_GAMES = 200
const MIN_CARD_GAMES = 200 // descartamos cartas con muy pocas partidas
const DELAY_MS = 1000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const leaders = JSON.parse(await readFile(new URL('../public/data/leaders.json', import.meta.url), 'utf8'))
const games = (l) => l.opbounty?.matches ?? l.kaizoku?.matches ?? 0

await mkdir(OUT, { recursive: true })

for (const l of leaders.filter((x) => games(x) >= MIN_LEADER_GAMES)) {
  await sleep(DELAY_MS)
  try {
    const res = await fetch(`${BASE}/cards/${l.code}.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = await res.json()
    const cards = j.cards
      .filter((c) => c.games >= MIN_CARD_GAMES)
      .map((c) => ({
        id: c.id,
        n: c.games,
        usage: c.usage, // % de partidas del líder en las que aparece la carta
        avg: c.avgCopies,
        wr: c.winRate, // win rate de los mazos que la llevan
        q: (c.quantities ?? []).map((x) => [x.qty, x.games, x.winRate]),
      }))
    // «tech»: cartas que suben o bajan el win rate contra un líder rival concreto (por código de líder rival)
    const tech = Object.fromEntries(
      Object.entries(j.tech ?? {}).flatMap(([opp, list]) => {
        const items = list
          .filter((t) => t.gamesWith >= 150)
          .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))
          .slice(0, 12)
          .map((t) => ({ id: t.id, lift: t.lift, with: t.winRateWith, without: t.winRateWithout, n: t.gamesWith }))
        return items.length ? [[opp, items]] : []
      }),
    )
    await writeFile(new URL(`${l.code}.json`, OUT), JSON.stringify({ games: j.leaderStats?.games ?? 0, wr: j.leaderStats?.winRate ?? 0, cards, tech }))
    console.log(`ok  ${l.code} ${l.name} (${cards.length} cartas)`)
  } catch (e) {
    console.warn(`ERR ${l.code}: ${e.message}`)
  }
}
