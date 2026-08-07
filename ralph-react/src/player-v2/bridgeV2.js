import {
	computeDuplicateScore,
	evaluateTrick,
	hcpValue,
	isDeclarerSide,
	isDefender,
	isSeatVul,
	partnerOf,
	parseTrump,
	rightOf,
	validateAuction,
} from '../lib/bridgeCore.js'

export const SEATS = ['N', 'E', 'S', 'W']
export const SUIT_ORDER = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
export const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const RANK_DESC = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

export {
	computeDuplicateScore,
	evaluateTrick,
	hcpValue,
	isDeclarerSide,
	isDefender,
	isSeatVul,
	partnerOf,
	parseTrump,
	rightOf,
	validateAuction,
}

export function seatName(seat) {
	return seat === 'N'
		? 'North'
		: seat === 'E'
			? 'East'
			: seat === 'S'
				? 'South'
				: 'West'
}

export function suitSymbol(suit) {
	return suit === 'Spades'
		? '♠'
		: suit === 'Hearts'
			? '♥'
			: suit === 'Diamonds'
				? '♦'
				: '♣'
}

export function shortCard(card) {
	if (!card) return ''
	return `${card.rank}${suitSymbol(card.suit)}`
}

function suitName(letter) {
	const up = String(letter || '').toUpperCase()
	if (up === 'S') return 'Spades'
	if (up === 'H') return 'Hearts'
	if (up === 'D') return 'Diamonds'
	return 'Clubs'
}

function normalizeRank(rank) {
	const up = String(rank || '').toUpperCase()
	return up === 'T' ? '10' : up
}

export function stableDealToHands(dealStr) {
	const match = String(dealStr || '').match(/^([NESW]):\s*(.+)$/)
	if (!match) throw new Error('Bad Deal string')
	const startSeat = match[1]
	const segments = match[2].trim().split(/\s+/)
	if (segments.length !== 4) throw new Error('Deal must have 4 seat segments')

	const startIndex = SEATS.indexOf(startSeat)
	const hands = {}
	for (let i = 0; i < 4; i++) {
		const seat = SEATS[(startIndex + i) % 4]
		const parts = segments[i].split('.')
		const cards = []
		for (let suitIndex = 0; suitIndex < 4; suitIndex++) {
			const suit = suitName(['S', 'H', 'D', 'C'][suitIndex])
			const rawRanks = parts[suitIndex] && parts[suitIndex] !== '-' ? parts[suitIndex] : ''
			for (const rawRank of Array.from(rawRanks)) {
				if (!/^[AKQJT2-9]$/i.test(rawRank)) continue
				const rank = normalizeRank(rawRank)
				cards.push({
					id: `${seat}-${suit}-${rank}`,
					seat,
					suit,
					rank,
				})
			}
		}
		hands[seat] = sortHand(cards)
	}
	return hands
}

export function sortHand(cards) {
	return [...(cards || [])].sort((a, b) => {
		const suitDelta = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit)
		if (suitDelta) return suitDelta
		return RANK_DESC.indexOf(a.rank) - RANK_DESC.indexOf(b.rank)
	})
}

export function handHcp(cards) {
	return (cards || []).reduce((total, card) => total + hcpValue(card.rank), 0)
}

export function groupHand(cards) {
	const grouped = Object.fromEntries(SUIT_ORDER.map((suit) => [suit, []]))
	for (const card of sortHand(cards)) grouped[card.suit].push(card)
	return grouped
}

export function orderHandForDisplay(
	cards,
	{ isDummy = false, inPlay = false, trump = null } = {},
) {
	const grouped = groupHand(cards)
	const leadSuit = isDummy && inPlay ? trump || 'Clubs' : null
	const dummySuitOrder = {
		Spades: ['Spades', 'Hearts', 'Clubs', 'Diamonds'],
		Hearts: ['Hearts', 'Spades', 'Diamonds', 'Clubs'],
		Diamonds: ['Diamonds', 'Spades', 'Hearts', 'Clubs'],
		Clubs: ['Clubs', 'Hearts', 'Spades', 'Diamonds'],
	}
	const suitOrder = leadSuit ? dummySuitOrder[leadSuit] : SUIT_ORDER
	return suitOrder.flatMap((suit) => grouped[suit] || [])
}

export function deriveAuction(board) {
	const dealer = board?.auctionDealer || board?.dealer || 'N'
	const calls = Array.isArray(board?.auction) ? [...board.auction] : []
	const progress = auctionProgress(
		dealer,
		calls,
	)
	return {
		...progress,
		calls,
		dealer,
		contract: board?.contract || progress.contract,
		declarer: board?.declarer || progress.declarer,
	}
}

export function auctionRows(calls, dealer = 'N') {
	const startIndex = SEATS.indexOf(dealer || 'N')
	const columns = [0, 1, 2, 3].map((i) => SEATS[(startIndex + i) % 4])
	const rows = []
	for (let i = 0; i < calls.length; i += 4) {
		rows.push(calls.slice(i, i + 4))
	}
	return { columns, rows }
}

export function normalizeAuctionCall(call) {
	const up = String(call || '').trim().toUpperCase()
	if (/^(P|PASS)$/.test(up)) return 'P'
	if (up === 'X' || up === 'XX') return up
	const bid = up.match(/^([1-7])(C|D|H|S|NT)$/)
	return bid ? `${bid[1]}${bid[2]}` : ''
}

export function auctionSeatAt(dealer = 'N', callIndex = 0) {
	const startIndex = SEATS.indexOf(SEATS.includes(dealer) ? dealer : 'N')
	return SEATS[(startIndex + Math.max(0, Number(callIndex) || 0)) % SEATS.length]
}

function auctionContractDetails(dealer, calls) {
	const bidRe = /^([1-7])(C|D|H|S|NT)$/
	let lastBid = null
	let doubled = ''
	for (let index = 0; index < calls.length; index++) {
		const call = calls[index]
		const bid = call.match(bidRe)
		if (bid) {
			lastBid = {
				level: Number(bid[1]),
				strain: bid[2],
				seat: auctionSeatAt(dealer, index),
				index,
			}
			doubled = ''
		} else if (call === 'X') doubled = 'X'
		else if (call === 'XX') doubled = 'XX'
	}
	if (!lastBid) return { contract: '', declarer: '' }

	const declaringSide = SEATS.indexOf(lastBid.seat) % 2
	let declarer = ''
	for (let index = 0; index <= lastBid.index; index++) {
		const bid = calls[index].match(bidRe)
		const seat = auctionSeatAt(dealer, index)
		if (
			bid?.[2] === lastBid.strain &&
			SEATS.indexOf(seat) % 2 === declaringSide
		) {
			declarer = seat
			break
		}
	}
	return {
		contract: `${lastBid.level}${lastBid.strain}${doubled}`,
		declarer,
	}
}

export function auctionProgress(dealer = 'N', sourceCalls = []) {
	const normalizedDealer = SEATS.includes(dealer) ? dealer : 'N'
	const calls = []
	let hasBid = false
	let trailingPasses = 0

	for (let index = 0; index < (sourceCalls || []).length; index++) {
		if ((!hasBid && calls.length === 4) || (hasBid && trailingPasses >= 3)) {
			return {
				status: 'invalid',
				terminal: true,
				valid: false,
				legal: false,
				calls,
				nextSeat: null,
				contract: '',
				declarer: '',
				reason: 'The auction already ended before this call.',
				invalidIndex: index,
			}
		}

		const call = normalizeAuctionCall(sourceCalls[index])
		if (!call) {
			return {
				status: 'invalid',
				terminal: false,
				valid: false,
				legal: false,
				calls,
				nextSeat: auctionSeatAt(normalizedDealer, index),
				contract: '',
				declarer: '',
				reason: 'Unknown auction call.',
				invalidIndex: index,
			}
		}
		const legal = legalNextAuctionCall(normalizedDealer, calls, call)
		if (!legal.legal) {
			return {
				status: 'invalid',
				terminal: false,
				valid: false,
				legal: false,
				calls,
				nextSeat: auctionSeatAt(normalizedDealer, index),
				contract: '',
				declarer: '',
				reason: legal.reason || 'Illegal auction call.',
				invalidIndex: index,
			}
		}

		calls.push(legal.call)
		if (/^[1-7](C|D|H|S|NT)$/.test(legal.call)) hasBid = true
		trailingPasses = legal.call === 'P' ? trailingPasses + 1 : 0
	}

	if (!hasBid && calls.length === 4 && trailingPasses === 4) {
		return {
			status: 'passed-out',
			terminal: true,
			valid: true,
			legal: false,
			calls,
			nextSeat: null,
			contract: '',
			declarer: '',
		}
	}
	if (hasBid && trailingPasses >= 3) {
		return {
			status: 'complete',
			terminal: true,
			valid: true,
			legal: true,
			calls,
			nextSeat: null,
			...auctionContractDetails(normalizedDealer, calls),
		}
	}
	return {
		status: 'in-progress',
		terminal: false,
		valid: true,
		legal: false,
		calls,
		nextSeat: auctionSeatAt(normalizedDealer, calls.length),
		contract: '',
		declarer: '',
	}
}

export function legalNextAuctionCall(dealer, calls, nextCall) {
	const call = normalizeAuctionCall(nextCall)
	if (!call) return { legal: false, reason: 'Unknown call.' }
	if (call === 'P') return { legal: true, call }

	const draft = [...(calls || [])]
	const bidRe = /^([1-7])(C|D|H|S|NT)$/
	const seats = SEATS
	const startIndex = seats.indexOf(dealer || 'N')
	const seatFor = (index) => seats[(startIndex + index) % 4]
	const teamOf = (seat) => seats.indexOf(seat) % 2

	let lastBid = null
	let lastBidder = null
	let doubledBy = null
	let redoubledBy = null
	for (let i = 0; i < draft.length; i++) {
		const existing = normalizeAuctionCall(draft[i])
		const seat = seatFor(i)
		const bid = existing.match(bidRe)
		if (bid) {
			lastBid = [Number(bid[1]), bid[2]]
			lastBidder = seat
			doubledBy = null
			redoubledBy = null
			continue
		}
		if (existing === 'X') doubledBy = seat
		if (existing === 'XX') redoubledBy = seat
	}

	const nextSeat = seatFor(draft.length)
	if (bidRe.test(call)) {
		const bid = call.match(bidRe)
		const level = Number(bid[1])
		const strain = bid[2]
		if (!lastBid) return { legal: true, call }
		const order = ['C', 'D', 'H', 'S', 'NT']
		const higher =
			level > lastBid[0] ||
			(level === lastBid[0] && order.indexOf(strain) > order.indexOf(lastBid[1]))
		return higher ? { legal: true, call } : { legal: false, reason: 'Bid must be higher than the current contract.' }
	}

	if (call === 'X') {
		if (!lastBidder) return { legal: false, reason: 'There is no bid to double.' }
		if (doubledBy || redoubledBy) return { legal: false, reason: 'That contract is already doubled/redoubled.' }
		if (teamOf(nextSeat) === teamOf(lastBidder)) return { legal: false, reason: 'You cannot double your partnership.' }
		return { legal: true, call }
	}

	if (call === 'XX') {
		if (!doubledBy || redoubledBy || !lastBidder) return { legal: false, reason: 'There is no double to redouble.' }
		if (teamOf(nextSeat) !== teamOf(lastBidder)) return { legal: false, reason: 'Only the declaring side can redouble.' }
		return { legal: true, call }
	}

	return { legal: false, reason: 'Illegal call.' }
}

export function selectSimpleDefenderCard(remaining, trick, seat, trump) {
	const hand = remaining?.[seat] || []
	if (!hand.length) return null
	const leadSuit = trick?.length ? trick[0].card.suit : null
	let playable = hand
	if (leadSuit) {
		const following = hand.filter((card) => card.suit === leadSuit)
		if (following.length) playable = following
	}
	return [...playable].sort((a, b) => {
		const aTrump = trump && a.suit === trump ? 1 : 0
		const bTrump = trump && b.suit === trump ? 1 : 0
		if (aTrump !== bTrump && !leadSuit) return aTrump - bTrump
		return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
	})[0]
}
