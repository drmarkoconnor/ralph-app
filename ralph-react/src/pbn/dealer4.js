const CRLF = '\r\n'
const SEATS = ['N', 'E', 'S', 'W']
const SUITS = ['S', 'H', 'D', 'C']
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const RANK_INDEX = new Map(RANKS.map((rank, index) => [rank, index]))

export function sanitizeDealer4Text(input) {
	if (!input) return ''
	return String(input)
		.replace(/[“”]/g, '"')
		.replace(/[‘’]/g, "'")
		.replace(/[–—]/g, '-')
		.replace(/…/g, '...')
		.replace(/♠/g, 'S')
		.replace(/♥/g, 'H')
		.replace(/♦/g, 'D')
		.replace(/♣/g, 'C')
		.replace(/[\r\n\t]+/g, ' ')
		.trim()
		.replace(/"/g, "'")
		.replace(/[^\x20-\x7E]/g, '')
}

function seatOrderFrom(start) {
	const index = SEATS.indexOf(start)
	if (index < 0) throw new Error(`Dealer4 PBN: invalid deal prefix "${start}".`)
	return SEATS.map((_, offset) => SEATS[(index + offset) % SEATS.length])
}

function normalizedRank(rank) {
	const value = String(rank).toUpperCase() === '10' ? 'T' : String(rank).toUpperCase()
	if (!RANK_INDEX.has(value)) {
		throw new Error(`Dealer4 PBN: invalid card rank "${rank}".`)
	}
	return value
}

function sortedSuitCards(cards) {
	return (cards || [])
		.map(normalizedRank)
		.sort((left, right) => RANK_INDEX.get(left) - RANK_INDEX.get(right))
}

export function validateDealer4Deal(hands) {
	const seen = new Set()
	for (const seat of SEATS) {
		const hand = hands?.[seat]
		if (!hand) throw new Error(`Dealer4 PBN: missing ${seat} hand.`)
		let handSize = 0
		for (const suit of SUITS) {
			const cards = sortedSuitCards(hand[suit])
			handSize += cards.length
			for (const rank of cards) {
				const card = `${suit}${rank}`
				if (seen.has(card)) throw new Error(`Dealer4 PBN: duplicate card ${card}.`)
				seen.add(card)
			}
		}
		if (handSize !== 13) {
			throw new Error(`Dealer4 PBN: ${seat} must contain 13 cards; found ${handSize}.`)
		}
	}
	if (seen.size !== 52) {
		throw new Error(`Dealer4 PBN: a complete deal must contain 52 unique cards; found ${seen.size}.`)
	}
	return true
}

export function formatDealer4Hand(hand) {
	// PBN represents a void with an empty suit field, producing consecutive dots.
	// A hyphen is not valid inside a Deal hand.
	return SUITS.map((suit) => sortedSuitCards(hand?.[suit]).join('')).join('.')
}

export function serializeDealer4Board(board) {
	validateDealer4Deal(board?.hands)
	if (!SEATS.includes(board?.dealer)) {
		throw new Error(`Dealer4 PBN: invalid dealer "${board?.dealer}".`)
	}
	if (!['None', 'NS', 'EW', 'All'].includes(board?.vul)) {
		throw new Error(`Dealer4 PBN: invalid vulnerability "${board?.vul}".`)
	}
	if (!Number.isInteger(board?.board) || board.board < 1) {
		throw new Error('Dealer4 PBN: board number must be a positive integer.')
	}

	const prefix = board.dealPrefix || board.dealer
	const order = seatOrderFrom(prefix)
	const deal = `${prefix}:${order.map((seat) => formatDealer4Hand(board.hands[seat])).join(' ')}`
	const tags = [
		`[Event "${sanitizeDealer4Text(board.event)}"]`,
		`[Site "${sanitizeDealer4Text(board.site)}"]`,
		`[Date "${sanitizeDealer4Text(board.date)}"]`,
		`[Board "${board.board}"]`,
		`[Dealer "${board.dealer}"]`,
		`[Vulnerable "${board.vul}"]`,
		`[Deal "${deal}"]`,
	]

	// Dealer4's documented interchange example uses this compact seven-tag set.
	// Keep auctions, contracts, notes and application extensions out of this path.
	return tags.join(CRLF) + CRLF + CRLF
}

