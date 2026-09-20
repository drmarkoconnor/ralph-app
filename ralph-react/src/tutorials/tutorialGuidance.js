const SEAT_NAMES = { N: 'North', E: 'East', S: 'South', W: 'West' }
const SUIT_ORDER = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
const SUIT_SYMBOLS = { Spades: '♠', Hearts: '♥', Diamonds: '♦', Clubs: '♣' }
const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

function cardKey(card) {
	if (!card) return ''
	if (typeof card === 'string') {
		const suit = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }[card[0]]
		const rank = card.slice(1) === 'T' ? '10' : card.slice(1)
		return suit && rank ? `${suit}:${rank}` : ''
	}
	return `${card.suit}:${card.rank}`
}

export function visibleTutorialHolding({ hands = {}, visibleSeats = [], focusCards = [] } = {}) {
	const visible = new Set(visibleSeats)
	const focus = new Set(focusCards.map(cardKey).filter(Boolean))
	return ['N', 'E', 'S', 'W']
		.filter((seat) => visible.has(seat))
		.map((seat) => {
			const focused = (hands[seat] || []).filter((card) => focus.has(cardKey(card)))
			if (!focused.length) return ''
			const suits = SUIT_ORDER.map((suit) => {
				const ranks = focused
					.filter((card) => card.suit === suit)
					.map((card) => String(card.rank))
					.sort((left, right) => RANK_ORDER.indexOf(left) - RANK_ORDER.indexOf(right))
				return ranks.length ? `${SUIT_SYMBOLS[suit]}${ranks.join(' ')}` : ''
			}).filter(Boolean)
			return suits.length ? `${SEAT_NAMES[seat]} ${suits.join('  ')}` : ''
		})
		.filter(Boolean)
		.join(' · ')
}
