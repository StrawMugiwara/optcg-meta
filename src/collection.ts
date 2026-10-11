import { useSyncExternalStore } from 'react'

/** Cartas que el usuario ya tiene: código de carta → copias. Se guarda en el navegador (localStorage). */
export type Owned = Record<string, number>

const KEY = 'optcg-collection'
const MAX = 99

function read(): Owned {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const out: Owned = {}
    for (const [id, q] of Object.entries(o)) if (typeof q === 'number' && q > 0) out[id] = Math.min(Math.floor(q), MAX)
    return out
  } catch {
    return {}
  }
}

let state: Owned = read()
const subs = new Set<() => void>()

function commit(next: Owned) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* sin almacenamiento: queda solo en memoria */ }
  subs.forEach((f) => f())
}

export const collection = {
  /** Fija las copias de una carta (0 la quita). */
  set(id: string, qty: number) {
    const next = { ...state }
    if (qty <= 0) delete next[id]
    else next[id] = Math.min(Math.floor(qty), MAX)
    commit(next)
  },
  /** Suma las copias indicadas a lo que ya hay. */
  add(items: Owned) {
    const next = { ...state }
    for (const [id, q] of Object.entries(items)) next[id] = Math.min((next[id] ?? 0) + q, MAX)
    commit(next)
  },
  /** Reemplaza toda la colección. */
  replace(items: Owned) {
    commit({ ...items })
  },
  /** Garantiza al menos esas copias de cada carta (idempotente: no suma dos veces). */
  ensure(list: { id: string; qty: number }[]) {
    const next = { ...state }
    for (const { id, qty } of list) next[id] = Math.min(Math.max(next[id] ?? 0, qty), MAX)
    commit(next)
  },
  clear() {
    commit({})
  },
}

export const useCollection = (): Owned =>
  useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb) } },
    () => state,
  )

/** Lo que falta para completar `list` dado lo que se tiene: solo cartas con copias pendientes. */
export function missing(list: { id: string; qty: number }[], owned: Owned) {
  return list.flatMap(({ id, qty }) => {
    const need = qty - (owned[id] ?? 0)
    return need > 0 ? [{ id, qty, need }] : []
  })
}

const ID = /\b([A-Z]{1,4}\d{0,2}-\d{3})\b/

/**
 * Lee una lista pegada. Acepta «3x Perona OP01-077», «3 OP01-077», «OP01-077 x3», «OP01-077»
 * y las líneas del Wizard de Cardmarket («3 Charlotte Linlin (OP17-049) (V.1)»). Sin cantidad = 1.
 */
export function parseList(text: string, validIds: Set<string>) {
  const found: Owned = {}
  const unknown: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const id = line.match(ID)?.[1]
    if (!id || !validIds.has(id)) {
      unknown.push(line.slice(0, 60))
      continue
    }
    const lead = line.match(/^(\d+)\s*x?\s+/i)?.[1]
    const trail = line.match(/\bx\s*(\d+)\s*$/i)?.[1]
    const qty = Number(lead ?? trail ?? 1)
    found[id] = Math.min((found[id] ?? 0) + (qty > 0 ? qty : 1), MAX)
  }
  return { found, unknown }
}
