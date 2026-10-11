import { useState, type ReactNode } from 'react'
import { cardmarketLines } from './cardmarket'
import { missing, useCollection } from './collection'
import { deckPrice, money, type Card } from './types'

/** Barra de progreso de un mazo frente a tu colección, con un único botón: copiar lo que falta para Cardmarket. */
export default function MissingBar({ leader, cards, db, prices, right }: {
  leader: string
  cards: { id: string; qty: number }[]
  db: Record<string, Card>
  prices: Record<string, number>
  right?: ReactNode
}) {
  const owned = useCollection()
  const [copied, setCopied] = useState(false)

  const list = [{ id: leader, qty: 1 }, ...cards]
  const miss = missing(list, owned).map((m) => ({ id: m.id, qty: m.need }))
  const total = list.reduce((n, c) => n + c.qty, 0)
  const need = miss.reduce((n, m) => n + m.qty, 0)
  const have = total - need
  const cost = deckPrice(miss, prices)
  const nothing = Object.keys(owned).length === 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cardmarketLines(miss, db))
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch { /* sin permiso de portapapeles */ }
  }

  return (
    <div className={`mbar ${need === 0 ? 'done' : ''}`}>
      <div className="bar" aria-hidden><i style={{ width: `${(have / total) * 100}%` }} /></div>
      <div className="mbar-row">
        <span className="mbar-text">
          {need === 0 ? (
            <b className="good">✔ Mazo completo</b>
          ) : (
            <>
              <b>{have}/{total}</b> cartas · te faltan <b>{need}</b> por <b>{money(cost.total)}</b>
              {cost.unknown > 0 && <small title={`${cost.unknown} copias sin precio`}> ~</small>}
            </>
          )}
        </span>
        {need > 0 && <button className="primary" onClick={copy}>{copied ? '¡Copiado! Pégalo en Cardmarket' : 'Copiar lo que falta para Cardmarket'}</button>}
        {right}
      </div>
      {nothing && <div className="muted mbar-hint">Aún no tienes nada guardado: pulsa + en las cartas que ya tengas y aquí verás lo que te falta.</div>}
    </div>
  )
}
