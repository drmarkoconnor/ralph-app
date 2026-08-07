import {
	SEATS,
	auctionProgress,
	auctionSeatAt,
	legalNextAuctionCall,
	normalizeAuctionCall,
} from './bridgeV2.js'

const SUITS = ['S', 'H', 'D', 'C']
const BID_ORDER = ['C', 'D', 'H', 'S', 'NT']

function partnerOf(seat) {
	return SEATS[(SEATS.indexOf(seat) + 2) % SEATS.length]
}

function cardSuit(card) {
	const suit = String(card?.suitKey || card?.suit || card?.[0] || '').toUpperCase()
	if (suit.startsWith('S')) return 'S'
	if (suit.startsWith('H')) return 'H'
	if (suit.startsWith('D')) return 'D'
	if (suit.startsWith('C')) return 'C'
	return ''
}

function cardRank(card) {
	const rank = typeof card === 'string' ? card.slice(-1) : card?.rank
	return String(rank || '').toUpperCase() === '10'
		? 'T'
		: String(rank || '').toUpperCase()
}

export function practiceHandFacts(hand = []) {
	const lengths = { S: 0, H: 0, D: 0, C: 0 }
	let hcp = 0
	for (const card of hand || []) {
		const suit = cardSuit(card)
		if (suit) lengths[suit] += 1
		const rank = cardRank(card)
		hcp += rank === 'A' ? 4 : rank === 'K' ? 3 : rank === 'Q' ? 2 : rank === 'J' ? 1 : 0
	}
	const shape = Object.values(lengths).sort((a, b) => b - a).join('-')
	return {
		hcp,
		lengths,
		balanced: shape === '4-3-3-3' || shape === '4-4-3-2' || shape === '5-3-3-2',
	}
}

function longestSuit(lengths, excluded = []) {
	return [...SUITS]
		.filter((suit) => !excluded.includes(suit))
		.sort((a, b) => lengths[b] - lengths[a] || SUITS.indexOf(a) - SUITS.indexOf(b))[0]
}

function openingCall(facts) {
	if (facts.balanced && facts.hcp >= 23) return '2C'
	if (facts.balanced && facts.hcp >= 20 && facts.hcp <= 22) return '2NT'
	if (facts.balanced && facts.hcp >= 12 && facts.hcp <= 14) return '1NT'
	if (facts.hcp < 12) return 'P'
	const suit = longestSuit(facts.lengths)
	return facts.lengths[suit] >= 4 ? `1${suit}` : '1C'
}

function cheapestSuitBid(suit, calls) {
	const lastBid = [...calls]
		.reverse()
		.map((call) => normalizeAuctionCall(call).match(/^([1-7])(C|D|H|S|NT)$/))
		.find(Boolean)
	if (!lastBid) return `1${suit}`
	const level = Number(lastBid[1])
	const candidateLevel = BID_ORDER.indexOf(suit) > BID_ORDER.indexOf(lastBid[2])
		? level
		: level + 1
	return candidateLevel <= 7 ? `${candidateLevel}${suit}` : 'P'
}

function directPartnerBid(dealer, calls, seat) {
	const partner = partnerOf(seat)
	for (let index = calls.length - 1; index >= 0; index--) {
		const call = normalizeAuctionCall(calls[index])
		if (!/^[1-7](C|D|H|S|NT)$/.test(call)) continue
		if (auctionSeatAt(dealer, index) !== partner) return null
		if (calls.slice(index + 1).every((later) => normalizeAuctionCall(later) === 'P')) {
			return { call, index }
		}
		return null
	}
	return null
}

function responseToOneNoTrump(facts) {
	if (facts.hcp < 8) return 'P'
	if (facts.lengths.H >= 5) return '2D'
	if (facts.lengths.S >= 5) return '2H'
	if (facts.lengths.H === 4 || facts.lengths.S === 4) return '2C'
	if (facts.hcp <= 9) return '2NT'
	return '3NT'
}

function responseToSuitOpening(opening, facts, calls) {
	if (facts.hcp < 6) return 'P'
	const openedSuit = opening[1]
	const support = facts.lengths[openedSuit]
	if (support >= 3) {
		if (facts.hcp <= 9) return `2${openedSuit}`
		if (facts.hcp <= 12) return `3${openedSuit}`
		return openedSuit === 'H' || openedSuit === 'S' ? `4${openedSuit}` : '3NT'
	}

	const suit = longestSuit(facts.lengths, [openedSuit])
	if (facts.lengths[suit] >= 4) {
		const candidate = cheapestSuitBid(suit, calls)
		if (candidate.startsWith('1') || facts.hcp >= 10) return candidate
	}
	return facts.hcp <= 9 ? '1NT' : '2NT'
}

function bidsBefore(dealer, calls, endIndex) {
	return calls.slice(0, endIndex).flatMap((call, index) => {
		const normalized = normalizeAuctionCall(call)
		return /^[1-7](C|D|H|S|NT)$/.test(normalized)
			? [{ call: normalized, seat: auctionSeatAt(dealer, index) }]
			: []
	})
}

function localAcolCall({ seat, hand, dealer, calls }) {
	const facts = practiceHandFacts(hand)
	const hasBid = calls.some((call) => /^[1-7](C|D|H|S|NT)$/.test(normalizeAuctionCall(call)))
	if (!hasBid) return { call: openingCall(facts), reason: 'Conservative ACOL opening rule.' }

	const partnerBid = directPartnerBid(dealer, calls, seat)
	if (!partnerBid) return { call: 'P', reason: 'No supported local continuation; pass safely.' }
	if (partnerBid.call === '1NT') {
		return { call: responseToOneNoTrump(facts), reason: 'ACOL response to a 12-14 1NT opening.' }
	}
	const earlierBids = bidsBefore(dealer, calls, partnerBid.index)
	const actingSeatOpenedOneNoTrump =
		earlierBids.length === 1 &&
		earlierBids[0].seat === seat &&
		earlierBids[0].call === '1NT'
	if (partnerBid.call === '2C' && earlierBids.length === 0) {
		return { call: '2D', reason: 'Conservative waiting response to a strong 2C opening.' }
	}
	if (partnerBid.call === '2C' && actingSeatOpenedOneNoTrump) {
		return {
			call: facts.lengths.H >= 4 ? '2H' : facts.lengths.S >= 4 ? '2S' : '2D',
			reason: 'ACOL Stayman response using only the acting hand.',
		}
	}
	if (partnerBid.call === '2D' && actingSeatOpenedOneNoTrump) {
		return { call: '2H', reason: 'Complete the public heart transfer.' }
	}
	if (partnerBid.call === '2H' && actingSeatOpenedOneNoTrump) {
		return { call: '2S', reason: 'Complete the public spade transfer.' }
	}
	if (/^1[CDHS]$/.test(partnerBid.call)) {
		return {
			call: responseToSuitOpening(partnerBid.call, facts, calls),
			reason: 'Conservative natural response to partner opening.',
		}
	}
	return { call: 'P', reason: 'No supported local continuation; pass safely.' }
}

function normalizedCalls(calls) {
	return (calls || []).map(normalizeAuctionCall)
}

export function choosePracticeAutoCall({
	seat,
	hand = [],
	dealer = 'N',
	calls = [],
	recordedCalls = [],
} = {}) {
	const progress = auctionProgress(dealer, calls)
	if (progress.terminal || progress.status === 'invalid') return null
	if (!SEATS.includes(seat) || progress.nextSeat !== seat) return null

	const practice = normalizedCalls(calls)
	const recorded = normalizedCalls(recordedCalls)
	const followsRecordedPrefix =
		practice.length < recorded.length &&
		practice.every((call, index) => call && call === recorded[index])
	if (followsRecordedPrefix) {
		const recordedCall = recorded[practice.length]
		const legal = legalNextAuctionCall(dealer, practice, recordedCall)
		if (legal.legal) {
			return {
				call: legal.call,
				source: 'recorded-prefix',
				reason: 'Matches the recorded PBN auction while the practice prefix agrees.',
			}
		}
	}

	const fallback = localAcolCall({ seat, hand, dealer, calls: practice })
	const legal = legalNextAuctionCall(dealer, practice, fallback.call)
	if (legal.legal) return { ...fallback, call: legal.call, source: 'local-acol' }
	return {
		call: 'P',
		source: 'local-acol',
		reason: 'The conservative candidate was not legal, so the seat passes.',
	}
}
