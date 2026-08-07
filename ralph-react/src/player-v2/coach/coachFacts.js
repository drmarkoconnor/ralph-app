const SEATS = ['N', 'E', 'S', 'W']
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
const RANKS_DESCENDING = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const HCP_BY_RANK = { A: 4, K: 3, Q: 2, J: 1 }

function normalizeSuit(value) {
	const suit = String(value || '').trim().toUpperCase()
	if (suit === 'S' || suit === 'SPADE' || suit === 'SPADES') return 'Spades'
	if (suit === 'H' || suit === 'HEART' || suit === 'HEARTS') return 'Hearts'
	if (suit === 'D' || suit === 'DIAMOND' || suit === 'DIAMONDS') return 'Diamonds'
	if (suit === 'C' || suit === 'CLUB' || suit === 'CLUBS') return 'Clubs'
	return ''
}

function normalizeRank(value) {
	const rank = String(value || '').trim().toUpperCase()
	const normalized = rank === 'T' ? '10' : rank
	return RANKS_DESCENDING.includes(normalized) ? normalized : ''
}

export function normalizeCoachCard(card) {
	const suit = normalizeSuit(card?.suit || card?.suitKey)
	const rank = normalizeRank(card?.rank)
	return suit && rank ? { rank, suit } : null
}

export function normalizeCoachCards(cards) {
	return (Array.isArray(cards) ? cards : [])
		.map(normalizeCoachCard)
		.filter(Boolean)
		.sort((left, right) => {
			const suitDifference = SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit)
			if (suitDifference) return suitDifference
			return RANKS_DESCENDING.indexOf(left.rank) - RANKS_DESCENDING.indexOf(right.rank)
		})
}

export function summarizeKnownHand(cards) {
	const normalized = normalizeCoachCards(cards)
	const shape = Object.fromEntries(SUITS.map((suit) => [suit, 0]))
	for (const card of normalized) shape[card.suit] += 1
	const sortedShape = Object.values(shape).sort((left, right) => right - left)
	const shapePattern = sortedShape.join('-')
	return {
		hcp: normalized.reduce((total, card) => total + (HCP_BY_RANK[card.rank] || 0), 0),
		shape,
		shapePattern,
		commonBalancedShape: ['4-3-3-3', '4-4-3-2', '5-3-3-2'].includes(shapePattern),
		fourCardMajors: ['Spades', 'Hearts'].filter((suit) => shape[suit] >= 4),
	}
}

export function normalizePlayedCards(history) {
	return (Array.isArray(history) ? history : []).flatMap((entry, index) => {
		const card = normalizeCoachCard(entry?.card)
		if (!SEATS.includes(entry?.seat) || !card) return []
		return [{ sequence: index + 1, seat: entry.seat, card }]
	})
}

export function inferPublicVoids(playedCards) {
	const voids = Object.fromEntries(SEATS.map((seat) => [seat, []]))
	for (let start = 0; start < playedCards.length; start += 4) {
		const trick = playedCards.slice(start, start + 4)
		const leadSuit = trick[0]?.card?.suit
		if (!leadSuit) continue
		for (const play of trick.slice(1)) {
			if (play.card.suit !== leadSuit && !voids[play.seat].includes(leadSuit)) {
				voids[play.seat].push(leadSuit)
			}
		}
	}
	return voids
}

export function buildOutstandingCardFacts(playedCards, knownRemainingHands) {
	const played = playedCards.map((entry) => entry.card)
	const knownRemaining = (knownRemainingHands || []).flatMap((hand) => hand.remaining || [])
	return Object.fromEntries(
		SUITS.map((suit) => {
			const playedRanks = new Set(
				played.filter((card) => card.suit === suit).map((card) => card.rank),
			)
			const knownRemainingRanks = new Set(
				knownRemaining.filter((card) => card.suit === suit).map((card) => card.rank),
			)
			const unplayedRanks = RANKS_DESCENDING.filter((rank) => !playedRanks.has(rank))
			const unaccountedRanks = unplayedRanks.filter((rank) => !knownRemainingRanks.has(rank))
			return [
				suit,
				{
					playedCount: playedRanks.size,
					playedRanks: RANKS_DESCENDING.filter((rank) => playedRanks.has(rank)),
					knownRemainingCount: knownRemainingRanks.size,
					unaccountedCount: unaccountedRanks.length,
					highestUnplayedRank: unplayedRanks[0] || null,
					highestUnaccountedRank: unaccountedRanks[0] || null,
					unaccountedRanks,
				},
			]
		}),
	)
}

export function buildTrumpFacts(trump, playedCards, knownRemainingHands) {
	if (!SUITS.includes(trump)) return { isNoTrump: true }
	const playedCount = playedCards.filter((entry) => entry.card.suit === trump).length
	const knownRemainingBySeat = Object.fromEntries(
		(knownRemainingHands || []).map((hand) => [
			hand.seat,
			hand.remaining.filter((card) => card.suit === trump).length,
		]),
	)
	const knownRemainingCount = Object.values(knownRemainingBySeat).reduce(
		(total, count) => total + count,
		0,
	)
	return {
		isNoTrump: false,
		suit: trump,
		playedCount,
		totalUnplayedCount: Math.max(0, 13 - playedCount),
		knownRemainingBySeat,
		unaccountedCount: Math.max(0, 13 - playedCount - knownRemainingCount),
	}
}

export function buildLearnerLegalFollowFacts(
	play,
	learnerSeat = 'S',
	controlledSeats = [learnerSeat],
) {
	const seat = learnerSeat === 'N' ? 'N' : 'S'
	const allowedSeats = new Set(
		(Array.isArray(controlledSeats) ? controlledSeats : [seat]).filter((item) => SEATS.includes(item)),
	)
	const decisionSeat = SEATS.includes(play?.turnSeat) ? play.turnSeat : ''
	if (!play || !allowedSeats.has(decisionSeat)) return { learnerToPlay: false }
	const learnerCards = normalizeCoachCards(play.remaining?.[decisionSeat])
	const trick = play.trickComplete ? [] : Array.isArray(play.trick) ? play.trick : []
	const leadSuit = normalizeCoachCard(trick[0]?.card)?.suit || null
	const followingCards = leadSuit
		? learnerCards.filter((card) => card.suit === leadSuit)
		: learnerCards
	const mustFollowSuit = Boolean(leadSuit && followingCards.length)
	return {
		learnerToPlay: true,
		leadSuit,
		mustFollowSuit,
		legalCards: mustFollowSuit ? followingCards : learnerCards,
		legalCardCount: mustFollowSuit ? followingCards.length : learnerCards.length,
	}
}

export function buildSouthLegalFollowFacts(play) {
	return buildLearnerLegalFollowFacts(play, 'S')
}

export const COACH_CARD_CONSTANTS = Object.freeze({
	seats: SEATS,
	suits: SUITS,
	ranksDescending: RANKS_DESCENDING,
})
