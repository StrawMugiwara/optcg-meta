// Precios en euros (Cardmarket) de las cartas que aparecen en los mazos, leídos de las páginas de carta de Limitless.
// Es incremental: guarda lo ya descargado y solo pide lo que falta o tiene más de MAX_AGE_DAYS.
// Uso: npm run sync:eur   (tarda unos 15 minutos la primera vez; ~1 petición por segundo)
import { readdir, readFile, writeFile } from 'node:fs/promises'

const DATA = new URL('../public/data/', import.meta.url)
const FILE = new URL('prices-eur.json', DATA)
const DELAY_MS = 1000
const MAX_AGE_DAYS = 3
const today = new Date().toISOString().slice(0, 10)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const readJson = async (u, fallback) => {
  try { return JSON.parse(await readFile(u, 'utf8')) } catch { return fallback }
}

// Cartas que nos interesan: las de los mazos descargados + los líderes
const ids = new Set()
for (const f of await readdir(new URL('decks/', DATA))) {
  const decks = await readJson(new URL(`decks/${f}`, DATA), [])
  ids.add(f.replace('.json', ''))
  for (const d of decks) for (const c of d.cards) ids.add(c.id)
}

const store = await readJson(FILE, { date: today, eur: {}, fetched: {} })
const age = (id) => (store.fetched[id] ? (Date.parse(today) - Date.parse(store.fetched[id])) / 864e5 : Infinity)
const todo = [...ids].filter((id) => age(id) > MAX_AGE_DAYS)
console.log(`${ids.size} cartas, ${todo.length} por descargar`)

// Precio de la impresión normal: fila "current" de la tabla de versiones.
function parseEur(html) {
  const row = html.match(/<tr[^>]*class="current"[^>]*>([\s\S]*?)<\/tr>/)?.[1]
  const m = row?.match(/card-price eur"[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)\s*€/)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

let done = 0
for (const id of todo) {
  await sleep(DELAY_MS)
  try {
    const res = await fetch(`https://onepiece.limitlesstcg.com/cards/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const eur = parseEur(await res.text())
    if (eur != null) store.eur[id] = eur
    else delete store.eur[id]
    store.fetched[id] = today
  } catch (e) {
    console.warn(`ERR ${id}: ${e.message}`)
  }
  if (++done % 50 === 0) {
    store.date = today
    await writeFile(FILE, JSON.stringify(store))
    console.log(`  ${done}/${todo.length}`)
  }
}
store.date = today
await writeFile(FILE, JSON.stringify(store))
console.log(`Listo: ${Object.keys(store.eur).length} precios en € (${today})`)
