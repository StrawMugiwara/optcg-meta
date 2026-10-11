import { useState } from 'react'
import { CARDMARKET_WANTS_URL, cardmarketList } from './cardmarket'
import type { Card } from './types'

/** Copia la lista del mazo en el formato de Cardmarket y abre sus listas de deseos para pegarla. */
export default function CardmarketExport({ leader, cards, db }: { leader: string; cards: { id: string; qty: number }[]; db: Record<string, Card> }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cardmarketList(leader, cards, db))
      setState('copied')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 4000)
  }
  return (
    <span className="cm">
      <button onClick={copy} title="Copia el mazo en el formato de Cardmarket">
        {state === 'copied' ? '¡Copiado! Pégalo en Cardmarket' : state === 'error' ? 'No se pudo copiar' : 'Copiar para Cardmarket'}
      </button>{' '}
      <a className="btn" href={CARDMARKET_WANTS_URL} target="_blank" rel="noreferrer" title="Crea una lista de deseos y pega el texto">Abrir listas de deseos ↗</a>
    </span>
  )
}
