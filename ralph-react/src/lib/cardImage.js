// Helper to resolve PNG card asset URLs with stable bundler support
// Usage: cardPngUrl('Spades', 'A') -> <img src={.../assets/cards/spades_ace.png} />

const rankKey = (r) => {
  const up = String(r).toUpperCase()
  if (up === 'T' || up === '10') return '10'
  if (up === 'J') return 'jack'
  if (up === 'Q') return 'queen'
  if (up === 'K') return 'king'
  if (up === 'A') return 'ace'
  // 2..9 (or already numeric string)
  return up.toLowerCase()
}

const suitKey = (s) => {
  const up = String(s).toLowerCase()
  // Accept singular/plural/case variants and map to asset folder naming
  if (up.startsWith('spade')) return 'spades'
  if (up.startsWith('heart')) return 'hearts'
  if (up.startsWith('diamond')) return 'diamonds'
  if (up.startsWith('club')) return 'clubs'
  return up
}

export function cardPngUrl(suit, rank) {
  const file = `${suitKey(suit)}_${rankKey(rank)}.png`
  const url = IMAGES[file]
  return url || ''
}

export default cardPngUrl

// Eagerly import all PNGs in the cards folder so lookups can be dynamic by filename
const modules = import.meta.glob('../assets/cards/*.png', { eager: true })
const IMAGES = {}
for (const [path, mod] of Object.entries(modules)) {
  const parts = path.split('/')
  const fname = parts[parts.length - 1]
  // Vite exposes the URL at mod.default
  IMAGES[fname] = mod && mod.default ? mod.default : ''
}
