const SEATS = ['N', 'E', 'S', 'W']

const SUIT_CODES = Object.freeze({
	Spades: 'S',
	Hearts: 'H',
	Diamonds: 'D',
	Clubs: 'C',
})

function normalizedRank(rank) {
	const value = String(rank || '').trim().toUpperCase()
	return value === 'T' ? '10' : value
}

function normalizedCard(card) {
	const suit = SUIT_CODES[card?.suit] || String(card?.suitKey || '').trim().toUpperCase()
	const rank = normalizedRank(card?.rank)
	if (!/^[SHDC]$/.test(suit) || !/^(?:A|K|Q|J|10|[2-9])$/.test(rank)) return ''
	return `${suit}${rank}`
}

function normalizedVulnerability(value) {
	const vulnerability = String(value || '').trim().toUpperCase()
	if (vulnerability === 'NS') return 'NS'
	if (vulnerability === 'EW') return 'EW'
	if (vulnerability === 'ALL' || vulnerability === 'BOTH') return 'All'
	return 'None'
}

export function canonicalCoachDeal(state) {
	if (!state?.board || !state?.hands) return ''
	const hands = Object.fromEntries(
		SEATS.map((seat) => [
			seat,
			(state.hands[seat] || [])
				.map(normalizedCard)
				.filter(Boolean)
				.sort(),
		]),
	)
	if (Object.values(hands).some((cards) => cards.length !== 13)) return ''
	const completeDeck = Object.values(hands).flat()
	if (new Set(completeDeck).size !== 52) return ''
	return JSON.stringify({
		version: 1,
		dealer: SEATS.includes(String(state.board.dealer || '').toUpperCase())
			? String(state.board.dealer).toUpperCase()
			: 'N',
		vulnerability: normalizedVulnerability(state.board.vul),
		hands,
	})
}

export async function buildCoachDealFingerprint(state, cryptoApi = globalThis.crypto) {
	const canonical = canonicalCoachDeal(state)
	if (!canonical) throw new Error('The complete deal is required before asking the Coach.')
	if (!cryptoApi?.subtle) throw new Error('Secure deal identification is unavailable in this browser.')
	const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
}
