import type { Card, Deck } from './types'

export type Change = { id: string; name: string; qty: number }

/** Cartas que entran (+) y salen (−) de `deck` respecto a `base`, por código de carta. */
export function deckDiff(base: Deck, deck: Deck, cards: Record<string, Card>) {
  const b = new Map(base.cards.map((c) => [c.id, c.qty]))
  const d = new Map(deck.cards.map((c) => [c.id, c.qty]))
  const name = (id: string) => cards[id]?.name ?? id
  const added: Change[] = []
  const removed: Change[] = []
  for (const [id, q] of d) if (q > (b.get(id) ?? 0)) added.push({ id, name: name(id), qty: q - (b.get(id) ?? 0) })
  for (const [id, q] of b) if (q > (d.get(id) ?? 0)) removed.push({ id, name: name(id), qty: q - (d.get(id) ?? 0) })
  let shared = 0
  for (const [id, q] of d) shared += Math.min(q, b.get(id) ?? 0)
  return { added, removed, shared }
}

/**
 * Partidas y win rate de un mazo. Siempre prioriza OPBounty (la misma fuente que el resto de la app)
 * y solo cae a Car D. Kaizoku si el mazo no está en OPBounty. Las dos fuentes miden el mismo mazo con
 * resultados algo distintos, así que no se mezclan.
 */
export function deckRecord(d: Deck) {
  const o = d.sources.opbounty
  if (o && o.games > 0) return { n: o.games, wr: o.winRate, src: 'OPBounty' as const }
  const k = d.sources.kaizokuPlayed as { games?: number; winRate: number } | undefined
  if (k && (k.games ?? 0) > 0) return { n: k.games!, wr: k.winRate, src: 'Kaizoku' as const }
  return { n: d.games, wr: 0, src: 'OPBounty' as const }
}

export const SMALL_SAMPLE = 300
