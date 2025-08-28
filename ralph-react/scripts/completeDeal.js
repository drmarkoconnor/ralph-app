#!/usr/bin/env node
/* eslint-env node */
/* global require, module, process */
/**
 * Complete a partial PBN-style deal string used in this project into a full 52-card deal.
 * Usage: node scripts/completeDeal.js "S:KQ7.QJ4.KJ3.9754 -.-.-.- -.-.-.- -.-.-.-"
 * Prints the completed deal to stdout.
 */
function complete(dealStr) {
  const m = String(dealStr || '').trim().match(/^([NESW]):\s*(.+)$/)
  if (!m) throw new Error('Bad deal string')
  const dealer = m[1]
  const body = m[2]
  const segs = body.split(/\s+/)
  if (segs.length !== 4) throw new Error('Deal must have 4 seat segments')
  const seats = ['N', 'E', 'S', 'W']
  const startIdx = seats.indexOf(dealer)
  const seatOrder = [
    seats[startIdx],
    seats[(startIdx + 1) % 4],
    seats[(startIdx + 2) % 4],
    seats[(startIdx + 3) % 4],
  ]
  const SUITS = ['S', 'H', 'D', 'C']
  const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
  const allCards = []
  for (const s of SUITS) for (const r of RANKS) allCards.push(`${s}${r}`)
  const used = new Set()
  const seatHands = {
    N: { S: [], H: [], D: [], C: [] },
    E: { S: [], H: [], D: [], C: [] },
    S: { S: [], H: [], D: [], C: [] },
    W: { S: [], H: [], D: [], C: [] },
  }
  for (let i = 0; i < 4; i++) {
    const seat = seatOrder[i]
    const parts = (segs[i] || '').split('.')
    for (let si = 0; si < 4; si++) {
      const p = parts[si] || ''
      if (p === '-' || p === '') continue
      const suit = SUITS[si]
      for (const ch of p) {
        const rank = ch.toUpperCase()
        if (!RANKS.includes(rank)) continue
        const card = `${suit}${rank}`
        if (used.has(card)) continue
        used.add(card)
        seatHands[seat][suit].push(rank)
      }
    }
  }
  const remaining = allCards.filter((c) => !used.has(c))
  // Distribute round-robin highest-first to keep nice pips
  remaining.sort((a,b) => {
    const si = SUITS.indexOf(a[0]) - SUITS.indexOf(b[0])
    if (si !== 0) return si
    return RANKS.indexOf(a[1]) - RANKS.indexOf(b[1])
  })
  while (remaining.length) {
    for (const seat of seatOrder) {
      const count = seatHands[seat].S.length + seatHands[seat].H.length + seatHands[seat].D.length + seatHands[seat].C.length
      if (count >= 13) continue
      const card = remaining.shift()
      if (!card) break
      const suit = card[0]
      const rank = card[1]
      seatHands[seat][suit].push(rank)
    }
  }
  const segOut = []
  for (let i = 0; i < 4; i++) {
    const seat = seatOrder[i]
    const parts = SUITS.map((s) => seatHands[seat][s].join('') || '-')
    segOut.push(parts.join('.'))
  }
  return `${dealer}:${segOut.join(' ')}`
}

if (require.main === module) {
  const arg = process.argv.slice(2).join(' ').trim()
  if (!arg) {
    console.error('Provide a deal string.')
    process.exit(1)
  }
  console.log(complete(arg))
}

module.exports = { complete }
