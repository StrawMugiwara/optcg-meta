import type { Card } from './types'

export const CARDMARKET_WANTS_URL = 'https://www.cardmarket.com/en/OnePiece/Wants'

// Cardmarket escribe los nombres con punto y espacio ("Monkey. D. Luffy"), como en su guía de importación.
const cmName = (name: string) => name.replace(/\.(?=\S)/g, '. ')

/**
 * Lista para pegar en una lista de deseos de Cardmarket (una carta por línea: cantidad, nombre y número).
 * Formato: «3x Perona OP01-077». Sin versión: Cardmarket acepta cualquiera.
 */
export function cardmarketList(leaderId: string, cards: { id: string; qty: number }[], db: Record<string, Card>) {
  const line = (id: string, qty: number) => `${qty}x ${cmName(db[id]?.name ?? id)} ${id}`
  return [line(leaderId, 1), ...cards.map((c) => line(c.id, c.qty))].join('\n')
}
