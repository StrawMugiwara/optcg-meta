import { useRef, useState } from 'react'
import { CARDMARKET_WANTS_URL, cardmarketList } from './cardmarket'
import { collection, useCollection } from './collection'
import { deckDiff, deckRecord, SMALL_SAMPLE } from './diff'
import MissingBar from './MissingBar'
import { deckPrice, money, wilson, type Card, type Deck } from './types'

/** Panel de una variante de mazo: datos clave, tu progreso y las cartas con su contador. */
export default function DeckPanel({ deck, base, cards, leader, prices }: {
  deck: Deck
  base?: Deck
  cards: Record<string, Card>
  leader: string
  prices: Record<string, number>
}) {
  const owned = useCollection()
  const [view, setView] = useState<'all' | 'missing'>('all')
  const [flash, setFlash] = useState('')
  const menu = useRef<HTMLDetailsElement>(null)

  const rec = deckRecord(deck)
  const diff = base && base.hash !== deck.hash ? deckDiff(base, deck, cards) : null
  const cost = deckPrice([...deck.cards, { id: leader, qty: 1 }], prices)
  const w = rec.n > 0 ? wilson(Math.round((rec.wr / 100) * rec.n), rec.n) : null
  const src = deck.sources

  // El líder va primero; después las cartas por coste
  const tiles = [
    { id: leader, qty: 1, isLeader: true },
    ...[...deck.cards]
      .sort((a, b) => Number(cards[a.id]?.cost ?? 0) - Number(cards[b.id]?.cost ?? 0) || a.id.localeCompare(b.id))
      .map((c) => ({ ...c, isLeader: false })),
  ]
  const shown = view === 'missing' ? tiles.filter((t) => (owned[t.id] ?? 0) < t.qty) : tiles

  const done = (msg: string) => {
    setFlash(msg)
    if (menu.current) menu.current.open = false
    setTimeout(() => setFlash(''), 2500)
  }
  const copyText = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); done(msg) } catch { done('No se pudo copiar') }
  }

  const sources = [
    `${rec.src} ${rec.wr}% (${rec.n}p)`,
    src.kaizokuPlayed && rec.src !== 'Kaizoku' ? `Kaizoku ${src.kaizokuPlayed.winRate}%` : '',
    src.optcgone ? `optcg.one ${src.optcgone.winRate}% (${src.optcgone.games}p)` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="dp">
      <div className="dp-top">
        <div className="dp-chips">
          <span className="chip strong" title={cost.approx > 0 ? `${cost.approx} cartas con precio convertido desde $` : 'Precio de Cardmarket, líder incluido'}>
            {money(cost.total)}{cost.unknown > 0 && ' ~'}
          </span>
          <span className="chip" title={sources}>{rec.wr}% · {rec.n} partidas{rec.n < SMALL_SAMPLE ? ' ⚠' : ''}</span>
          {w && <span className="chip muted" title="Rango en el que el win rate real está casi seguro (95 %)">real: {w.lo.toFixed(0)}–{w.hi.toFixed(0)}%</span>}
          {diff && <span className="chip muted" title="Cartas en común con la variante más jugada">{diff.shared}/50 como la más jugada</span>}
        </div>
        <details className="menu" ref={menu}>
          <summary aria-label="Más acciones">⋯</summary>
          <div className="menu-items">
            <button onClick={() => copyText(cardmarketList(leader, deck.cards, cards), 'Mazo copiado para Cardmarket')}>Copiar mazo para Cardmarket</button>
            <button onClick={() => copyText(deck.cards.map((c) => `${c.qty}x${c.id}`).join('\n'), 'Lista copiada')}>Copiar lista (códigos)</button>
            <a href={`#/builder/${leader}/${deck.hash}`}>Editar en el constructor</a>
            <a href={CARDMARKET_WANTS_URL} target="_blank" rel="noreferrer">Abrir Cardmarket ↗</a>
            <button onClick={() => { collection.ensure([{ id: leader, qty: 1 }, ...deck.cards]); done('Mazo marcado como tuyo') }}>Tengo todo el mazo</button>
          </div>
        </details>
      </div>

      {flash && <div className="flash">{flash}</div>}
      {rec.n < SMALL_SAMPLE && w && <div className="muted dp-note">⚠ Pocas partidas: diferencias de unos pocos puntos entre variantes suelen ser ruido.</div>}

      <MissingBar
        leader={leader}
        cards={deck.cards}
        db={cards}
        prices={prices}
        right={
          <span className="seg" role="group" aria-label="Qué cartas mostrar">
            <button className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>Todas</button>
            <button className={view === 'missing' ? 'on' : ''} onClick={() => setView('missing')}>Solo las que faltan</button>
          </span>
        }
      />

      {diff && (diff.added.length > 0 || diff.removed.length > 0) && (
        <div className="dp-diff">
          <span className="muted">Cambia respecto a la más jugada:</span>
          {diff.added.map((c) => <span key={'a' + c.id} className="good hov" data-card={c.id}>+{c.qty} {c.name}</span>)}
          {diff.removed.map((c) => <span key={'r' + c.id} className="bad hov" data-card={c.id}>−{c.qty} {c.name}</span>)}
        </div>
      )}

      <div className="tiles">
        {shown.map((t) => {
          const card = cards[t.id]
          const o = owned[t.id] ?? 0
          // Sin nada guardado no apagamos las cartas: solo se distingue lo que falta cuando ya has marcado algo
          const state = o >= t.qty ? 'full' : o > 0 ? 'part' : Object.keys(owned).length === 0 ? 'blank' : 'none'
          return (
            <div key={t.id} className={`tile ${state}`}>
              <div className="tile-img">
                {card ? <img src={card.img} alt={card.name} loading="lazy" /> : <div className="ph">{t.id}</div>}
                <span className="tile-need">{t.isLeader ? 'Líder' : `×${t.qty}`}</span>
                {state === 'full' && <span className="tile-ok">✔</span>}
              </div>
              <div className="tile-ctl">
                <button onClick={() => collection.set(t.id, o - 1)} disabled={o === 0} aria-label="Tengo una menos">−</button>
                <span><b>{o}</b>/{t.qty}</span>
                <button onClick={() => collection.set(t.id, o + 1)} aria-label="Tengo una más">+</button>
              </div>
              <div className="tile-price">{t.id in prices ? money(prices[t.id]) : '—'}</div>
            </div>
          )
        })}
      </div>
      {view === 'missing' && shown.length === 0 && <p className="muted">No te falta ninguna carta de este mazo.</p>}
    </div>
  )
}
