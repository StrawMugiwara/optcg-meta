import type { Card } from './types'

export const CARDMARKET_WANTS_URL = 'https://www.cardmarket.com/en/OnePiece/Wants'

// Cardmarket escribe los nombres con punto y espacio ("Monkey. D. Luffy"), como en su guía de importación.
const cmName = (name: string) => name.replace(/\.(?=\S)/g, '. ')

/** Líneas para pegar en una lista de deseos de Cardmarket: «3x Perona OP01-077». Sin versión: acepta cualquiera. */
export function cardmarketLines(items: { id: string; qty: number }[], db: Record<string, Card>) {
  return items.map(({ id, qty }) => `${qty}x ${cmName(db[id]?.name ?? id)} ${id}`).join('\n')
}

/** Mazo completo (líder + cartas) en formato Cardmarket. */
export function cardmarketList(leaderId: string, cards: { id: string; qty: number }[], db: Record<string, Card>) {
  return cardmarketLines([{ id: leaderId, qty: 1 }, ...cards], db)
}
