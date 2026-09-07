import { evaluateTrick, partnerOf } from '../lib/bridgeCore.js'
import { auctionSeatAt } from './bridgeV2.js'

export const COMPUTER_PLAY_ENGINE = 'human-style-local-v1'
export const COMPUTER_PLAY_BUDGET_MS = 900

const SEATS = ['N', 'E', 'S', 'W']
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const RANKS_DESC = [...RANKS].reverse()
const SUIT_TO_DDS = { Spades: 0, Hearts: 1, Diamonds: 2, Clubs: 3 }
const DDS_TO_SUIT = SUITS
const TRUMP_TO_DDS = { Spades: 0, Hearts: 1, Diamonds: 2, Clubs: 3 }

function normalizedCard(card) {
	if (!card) return null
	const suit = SUITS.includes(card.suit) ? card.suit : null
	const rawRank = String(card.rank || '').toUpperCase()
	const rank = rawRank === 'T' ? '10' : rawRank
	return suit && RANKS.includes(rank) ? { suit, rank } : null
}

export function computerCardKey(card) {
	const normalized = normalizedCard(card)
	return normalized ? `${normalized.suit}:${normalized.rank}` : ''
}

function compareCards(a, b) {
	return (
		SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) ||
		RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank)
	)
}

function sortedCards(cards) {
	return (cards || []).map(normalizedCard).filter(Boolean).sort(compareCards)
}

function fullDeck() {
	return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })))
}

function controllerForSeat(seat, declarer, dummy) {
	return seat === dummy ? declarer : seat
}

function deriveVoids(history) {
	const voids = Object.fromEntries(SEATS.map((seat) => [seat, []]))
	for (let index = 0; index < (history || []).length; index += 4) {
		const trick = history.slice(index, index + 4)
		const leadSuit = normalizedCard(trick[0]?.card)?.suit
		if (!leadSuit) continue
		for (const item of trick.slice(1)) {
			const card = normalizedCard(item?.card)
			if (card && card.suit !== leadSuit && !voids[item.seat].includes(leadSuit)) {
				voids[item.seat].push(leadSuit)
			}
		}
	}
	for (const seat of SEATS) voids[seat].sort((a, b) => SUITS.indexOf(a) - SUITS.indexOf(b))
	return voids
}

function hashString(value) {
	let hash = 2166136261
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

function knowledgeFingerprintPayload(knowledge) {
	return {
		version: COMPUTER_PLAY_ENGINE,
		seat: knowledge.seat,
		controller: knowledge.controller,
		declarer: knowledge.declarer,
		dummy: knowledge.dummy,
		trump: knowledge.trump,
		vulnerability: knowledge.vulnerability,
		remainingCounts: knowledge.remainingCounts,
		knownHands: knowledge.knownHands,
		played: knowledge.played,
		currentTrick: knowledge.currentTrick,
		voids: knowledge.voids,
		auction: knowledge.auction,
	}
}

export function fingerprintComputerKnowledge(knowledge) {
	return JSON.stringify(knowledgeFingerprintPayload(knowledge))
}

/**
 * Construct the only view that may cross the worker boundary. Although the
 * reducer owns all four hands, this function deliberately reads cards from
 * known seats only and strips card ids (which encode the original owner).
 */
export function buildComputerKnowledge({
	seat,
	remaining,
	history = [],
	trick = [],
	trickComplete = false,
	declarer,
	dummy,
	trump = null,
	vulnerability = 'None',
	auctionDealer = 'N',
	auctionCalls = [],
	auctionSources = [],
} = {}) {
	if (!SEATS.includes(seat) || !SEATS.includes(declarer) || !SEATS.includes(dummy)) return null
	const normalizedHistory = (history || []).flatMap((item) => {
		const card = normalizedCard(item?.card)
		return SEATS.includes(item?.seat) && card ? [{ seat: item.seat, card }] : []
	})
	const dummyExposed = normalizedHistory.length > 0
	const controller = controllerForSeat(seat, declarer, dummy)
	const knownSeatSet = new Set([controller])
	if (dummyExposed) knownSeatSet.add(dummy)
	const knownSeats = SEATS.filter((candidate) => knownSeatSet.has(candidate))
	const knownHands = Object.fromEntries(
		knownSeats.map((knownSeat) => [knownSeat, sortedCards(remaining?.[knownSeat] || [])]),
	)
	const playsBySeat = Object.fromEntries(SEATS.map((candidate) => [candidate, 0]))
	for (const item of normalizedHistory) playsBySeat[item.seat] += 1
	const remainingCounts = Object.fromEntries(
		SEATS.map((candidate) => [candidate, 13 - playsBySeat[candidate]]),
	)
	const currentTrick = trickComplete
		? []
		: (trick || []).flatMap((item) => {
				const card = normalizedCard(item?.card)
				return SEATS.includes(item?.seat) && card ? [{ seat: item.seat, card }] : []
			})
	const knowledge = {
		version: COMPUTER_PLAY_ENGINE,
		seat,
		controller,
		declarer,
		dummy,
		trump: SUITS.includes(trump) ? trump : null,
		vulnerability,
		knownSeats,
		knownHands,
		remainingCounts,
		played: normalizedHistory,
		currentTrick,
		voids: deriveVoids(normalizedHistory),
		auction: {
			dealer: SEATS.includes(auctionDealer) ? auctionDealer : 'N',
			calls: (auctionCalls || []).map((call) => String(call || '').toUpperCase()),
			sources: (auctionSources || []).map((source) => String(source || '')),
		},
	}
	knowledge.fingerprint = fingerprintComputerKnowledge(knowledge)
	knowledge.seed = hashString(knowledge.fingerprint)
	return knowledge
}

function makeRng(seed) {
	let value = (seed >>> 0) || 0x9e3779b9
	return () => {
		value += 0x6d2b79f5
		let next = value
		next = Math.imul(next ^ (next >>> 15), next | 1)
		next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
		return ((next ^ (next >>> 14)) >>> 0) / 4294967296
	}
}

function shuffle(values, rng) {
	const copy = [...values]
	for (let index = copy.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(rng() * (index + 1))
		;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
	}
	return copy
}

function playedBySeat(knowledge) {
	const result = Object.fromEntries(SEATS.map((seat) => [seat, []]))
	for (const item of knowledge.played || []) result[item.seat].push(item.card)
	return result
}

function hcp(cards) {
	return (cards || []).reduce(
		(total, card) => total + (card.rank === 'A' ? 4 : card.rank === 'K' ? 3 : card.rank === 'Q' ? 2 : card.rank === 'J' ? 1 : 0),
		0,
	)
}

function isBalanced(cards) {
	const lengths = SUITS.map((suit) => cards.filter((card) => card.suit === suit).length).sort((a, b) => b - a)
	return ['4-3-3-3', '4-4-3-2', '5-3-3-2'].includes(lengths.join('-'))
}

function auctionFitScore(knowledge, hands) {
	const original = playedBySeat(knowledge)
	for (const seat of SEATS) original[seat].push(...(hands[seat] || []))
	let score = 0
	for (let index = 0; index < knowledge.auction.calls.length; index++) {
		// Only the deterministic local ACOL bidder is conventionally reliable.
		// In particular, recorded-prefix calls may originate in any system.
		if (knowledge.auction.sources[index] !== 'local-acol') continue
		const call = knowledge.auction.calls[index]
		const seat = auctionSeatAt(knowledge.auction.dealer, index)
		const cards = original[seat]
		if (call === '1NT') {
			const points = hcp(cards)
			const distance = points < 12 ? 12 - points : points > 14 ? points - 14 : 0
			score += (isBalanced(cards) ? 12 : -8) - distance * 5
			continue
		}
		const natural = call.match(/^1([SHDC])$/)
		if (!natural) continue
		const suit = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }[natural[1]]
		const length = cards.filter((card) => card.suit === suit).length
		score += Math.min(length, 7) * 2 - Math.max(0, 4 - length) * 6
	}
	return score
}

function canStillFill(assignments, capacities, cards, index, voids) {
	for (const seat of SEATS) {
		if (capacities[seat] <= 0) continue
		let eligible = 0
		for (let cursor = index; cursor < cards.length; cursor++) {
			if (!(voids[seat] || []).includes(cards[cursor].suit)) eligible += 1
		}
		if (eligible < capacities[seat]) return false
		if ((assignments[seat] || []).length + capacities[seat] > 13) return false
	}
	return true
}

function assignUnknownCards(knowledge, pool, rng) {
	const assignments = Object.fromEntries(SEATS.map((seat) => [seat, []]))
	const capacities = Object.fromEntries(
		SEATS.map((seat) => [
			seat,
			knowledge.knownSeats.includes(seat) ? 0 : knowledge.remainingCounts[seat],
		]),
	)
	const unknownSeats = SEATS.filter((seat) => capacities[seat] > 0)
	const randomTie = new Map(pool.map((card) => [computerCardKey(card), rng()]))
	const cards = [...pool].sort((a, b) => {
		const aEligible = unknownSeats.filter((seat) => !(knowledge.voids[seat] || []).includes(a.suit)).length
		const bEligible = unknownSeats.filter((seat) => !(knowledge.voids[seat] || []).includes(b.suit)).length
		return aEligible - bEligible || randomTie.get(computerCardKey(a)) - randomTie.get(computerCardKey(b))
	})
	let visits = 0
	const place = (index) => {
		visits += 1
		if (visits > 50000) return false
		if (index >= cards.length) return unknownSeats.every((seat) => capacities[seat] === 0)
		const card = cards[index]
		const eligible = shuffle(
			unknownSeats.filter(
				(seat) => capacities[seat] > 0 && !(knowledge.voids[seat] || []).includes(card.suit),
			),
			rng,
		).sort((a, b) => capacities[b] - capacities[a])
		for (const seat of eligible) {
			assignments[seat].push(card)
			capacities[seat] -= 1
			if (canStillFill(assignments, capacities, cards, index + 1, knowledge.voids) && place(index + 1)) return true
			capacities[seat] += 1
			assignments[seat].pop()
		}
		return false
	}
	return place(0) ? assignments : null
}

function makeOneSample(knowledge, seed) {
	const knownKeys = new Set()
	for (const cards of Object.values(knowledge.knownHands)) {
		for (const card of cards) knownKeys.add(computerCardKey(card))
	}
	for (const item of knowledge.played) knownKeys.add(computerCardKey(item.card))
	const pool = fullDeck().filter((card) => !knownKeys.has(computerCardKey(card)))
	const expectedUnknown = SEATS.reduce(
		(total, seat) => total + (knowledge.knownSeats.includes(seat) ? 0 : knowledge.remainingCounts[seat]),
		0,
	)
	if (pool.length !== expectedUnknown) return null
	const rng = makeRng(seed)
	const assigned = assignUnknownCards(knowledge, pool, rng)
	if (!assigned) return null
	return Object.fromEntries(
		SEATS.map((seat) => [
			seat,
			sortedCards(knowledge.knownHands[seat] || assigned[seat] || []),
		]),
	)
}

export function validateSampleDeal(knowledge, hands) {
	if (!hands) return false
	const keys = []
	for (const seat of SEATS) {
		if ((hands[seat] || []).length !== knowledge.remainingCounts[seat]) return false
		for (const card of hands[seat] || []) {
			if ((knowledge.voids[seat] || []).includes(card.suit)) return false
			keys.push(computerCardKey(card))
		}
	}
	for (const item of knowledge.played) keys.push(computerCardKey(item.card))
	return keys.length === 52 && new Set(keys).size === 52
}

export function generateSampleDeals(knowledge, count = 16) {
	const samples = []
	for (let index = 0; index < count; index++) {
		let best = null
		let bestScore = -Infinity
		for (let candidate = 0; candidate < 3; candidate++) {
			const seed = hashString(`${knowledge.seed}:${index}:${candidate}`)
			const hands = makeOneSample(knowledge, seed)
			if (!validateSampleDeal(knowledge, hands)) continue
			const fit = auctionFitScore(knowledge, hands)
			if (!best || fit > bestScore) {
				best = hands
				bestScore = fit
			}
		}
		if (best) samples.push(best)
	}
	return samples
}

function rankValue(card) {
	return RANKS.indexOf(card?.rank)
}

export function legalComputerCards(knowledge) {
	const hand = knowledge?.knownHands?.[knowledge.seat] || []
	const leadSuit = knowledge?.currentTrick?.[0]?.card?.suit
	if (!leadSuit) return [...hand]
	const followers = hand.filter((card) => card.suit === leadSuit)
	return followers.length ? followers : [...hand]
}

function lowest(cards) {
	return [...cards].sort((a, b) => rankValue(a) - rankValue(b) || compareCards(a, b))[0] || null
}

function currentWinner(trick, trump) {
	const seat = evaluateTrick(trick, trump)
	return trick.find((item) => item.seat === seat) || null
}

function winsSoFar(knowledge, card) {
	return evaluateTrick(
		[...(knowledge.currentTrick || []), { seat: knowledge.seat, card }],
		knowledge.trump,
	) === knowledge.seat
}

function safeDiscard(cards, trump) {
	const nonTrumps = cards.filter((card) => card.suit !== trump)
	const source = nonTrumps.length ? nonTrumps : cards
	const suitLengths = Object.fromEntries(SUITS.map((suit) => [suit, source.filter((card) => card.suit === suit).length]))
	return [...source].sort(
		(a, b) =>
			rankValue(a) - rankValue(b) ||
			suitLengths[b.suit] - suitLengths[a.suit] ||
			compareCards(a, b),
	)[0] || null
}

function leadPreference(cards, trump) {
	const nonTrumps = cards.filter((card) => card.suit !== trump)
	const source = nonTrumps.length ? nonTrumps : cards
	const suits = SUITS.map((suit) => source.filter((card) => card.suit === suit))
		.filter((holding) => holding.length)
		.sort((a, b) => b.length - a.length || SUITS.indexOf(a[0].suit) - SUITS.indexOf(b[0].suit))
	for (const holding of suits) {
		const desc = [...holding].sort((a, b) => rankValue(b) - rankValue(a))
		if (desc.length >= 2 && rankValue(desc[0]) - rankValue(desc[1]) === 1 && rankValue(desc[0]) >= RANKS.indexOf('J')) {
			return desc[0]
		}
	}
	const longest = suits[0] || source
	const desc = [...longest].sort((a, b) => rankValue(b) - rankValue(a))
	return desc.length >= 4 ? desc[3] : desc[desc.length - 1] || null
}

function partnerSuitToReturn(knowledge, legal) {
	const partner = partnerOf(knowledge.seat)
	for (let index = (knowledge.played || []).length - 4; index >= 0; index -= 4) {
		const priorTrick = knowledge.played.slice(index, index + 4)
		if (priorTrick.length !== 4 || priorTrick[0]?.seat !== partner) continue
		const suit = priorTrick[0].card.suit
		if (suit === knowledge.trump) continue
		const holding = legal.filter((card) => card.suit === suit)
		if (holding.length) return leadPreference(holding, knowledge.trump)
	}
	return null
}

export function selectHumanFallbackCard(knowledge, allowedCards = null) {
	let legal = legalComputerCards(knowledge)
	if (allowedCards) {
		const allowed = new Set(allowedCards.map(computerCardKey))
		legal = legal.filter((card) => allowed.has(computerCardKey(card)))
	}
	if (!legal.length) return null
	const trick = knowledge.currentTrick || []
	if (!trick.length) {
		return partnerSuitToReturn(knowledge, legal) || leadPreference(legal, knowledge.trump)
	}
	const winner = currentWinner(trick, knowledge.trump)
	if (winner?.seat === partnerOf(knowledge.seat)) return safeDiscard(legal, knowledge.trump)
	const winners = legal.filter((card) => winsSoFar(knowledge, card))
	if (winners.length) return lowest(winners)
	const leadSuit = trick[0].card.suit
	const isVoid = !legal.some((card) => card.suit === leadSuit)
	if (isVoid && knowledge.trump) {
		const ruffs = legal.filter((card) => card.suit === knowledge.trump && winsSoFar(knowledge, card))
		if (ruffs.length) return lowest(ruffs)
	}
	return safeDiscard(legal, knowledge.trump)
}

function pbnHand(cards) {
	return SUITS.map((suit) => {
		const ranks = cards
			.filter((card) => card.suit === suit)
			.sort((a, b) => RANKS_DESC.indexOf(a.rank) - RANKS_DESC.indexOf(b.rank))
			.map((card) => (card.rank === '10' ? 'T' : card.rank))
			.join('')
		return ranks || '-'
	}).join('.')
}

export function sampleToDdsDeal(knowledge, hands) {
	const trick = knowledge.currentTrick || []
	const firstSeat = trick[0]?.seat || knowledge.seat
	return {
		trump: knowledge.trump ? TRUMP_TO_DDS[knowledge.trump] : 4,
		first: SEATS.indexOf(firstSeat),
		currentTrickSuit: trick.map((item) => SUIT_TO_DDS[item.card.suit]),
		currentTrickRank: trick.map((item) => RANKS.indexOf(item.card.rank) + 2),
		remainCards: `N:${pbnHand(hands.N)} ${pbnHand(hands.E)} ${pbnHand(hands.S)} ${pbnHand(hands.W)}`,
	}
}

function futureTrickScores(result, legal) {
	const scores = new Map()
	for (let index = 0; index < Number(result?.cards || 0); index++) {
		const suit = DDS_TO_SUIT[result.suit[index]]
		const rank = RANKS[result.rank[index] - 2]
		if (!suit || !rank) continue
		const score = Number(result.score[index])
		scores.set(`${suit}:${rank}`, score)
		const equals = Number(result.equals[index] || 0)
		for (let rankNumber = 2; rankNumber <= 14; rankNumber++) {
			if ((equals & (1 << rankNumber)) !== 0) {
				scores.set(`${suit}:${RANKS[rankNumber - 2]}`, score)
			}
		}
	}
	return new Map(legal.flatMap((card) => {
		const key = computerCardKey(card)
		return scores.has(key) ? [[key, scores.get(key)]] : []
	}))
}

function adaptiveSampleCount(knowledge, minimumSamples, targetSamples, maximumSamples) {
	const unknownCards = SEATS.reduce(
		(total, seat) =>
			total + (knowledge.knownSeats.includes(seat) ? 0 : knowledge.remainingCounts[seat]),
		0,
	)
	if (unknownCards >= 30) return minimumSamples
	if (unknownCards >= 18) return Math.max(minimumSamples, targetSamples - 4)
	if (unknownCards >= 8) return targetSamples
	return maximumSamples
}

export async function analyseHumanComputerPlay(
	knowledge,
	solveBoard,
	{
		budgetMs = COMPUTER_PLAY_BUDGET_MS,
		hardBudgetMs = Math.max(2200, budgetMs * 2.4),
		minimumSamples = 8,
		targetSamples = 16,
		maximumSamples = 24,
		now = () => Date.now(),
	} = {},
) {
	const legal = legalComputerCards(knowledge)
	const fallback = selectHumanFallbackCard(knowledge)
	if (!legal.length || !fallback) return { engine: 'fallback', card: null, samples: 0, reason: 'no_legal_card' }
	if (legal.length === 1) return { engine: COMPUTER_PLAY_ENGINE, card: legal[0], samples: 0, reason: 'forced' }
	if (typeof solveBoard !== 'function') {
		return { engine: 'fallback', card: fallback, samples: 0, reason: 'solver_unavailable', solverFailed: true }
	}
	const desiredSamples = Math.min(
		maximumSamples,
		Math.max(
			minimumSamples,
			adaptiveSampleCount(knowledge, minimumSamples, targetSamples, maximumSamples),
		),
	)
	const samples = generateSampleDeals(knowledge, desiredSamples)
	if (samples.length < minimumSamples) {
		return { engine: 'fallback', card: fallback, samples: 0, reason: 'sampling_failed', solverFailed: true }
	}
	const totals = new Map(legal.map((card) => [computerCardKey(card), { total: 0, count: 0 }]))
	const startedAt = now()
	let solved = 0
	try {
		for (const hands of samples) {
			const future = await solveBoard(sampleToDdsDeal(knowledge, hands))
			const scores = futureTrickScores(future, legal)
			if (!scores.size) throw new Error('DDS returned no legal-card scores')
			for (const [key, score] of scores) {
				const aggregate = totals.get(key)
				aggregate.total += score
				aggregate.count += 1
			}
			solved += 1
			if (solved < minimumSamples && now() - startedAt >= hardBudgetMs) {
				return {
					engine: 'fallback',
					card: fallback,
					samples: solved,
					elapsedMs: now() - startedAt,
					reason: 'time_budget',
					solverFailed: true,
				}
			}
		}
	} catch (error) {
		return {
			engine: 'fallback',
			card: fallback,
			samples: solved,
			reason: String(error?.message || error || 'solver_failed'),
			solverFailed: true,
		}
	}
	const elapsedMs = now() - startedAt
	if (solved < minimumSamples) {
		return { engine: 'fallback', card: fallback, samples: solved, elapsedMs, reason: 'time_budget', solverFailed: true }
	}
	let bestAverage = -Infinity
	for (const aggregate of totals.values()) {
		if (aggregate.count) bestAverage = Math.max(bestAverage, aggregate.total / aggregate.count)
	}
	const bestCards = legal.filter((card) => {
		const aggregate = totals.get(computerCardKey(card))
		return aggregate?.count && Math.abs(aggregate.total / aggregate.count - bestAverage) < 1e-9
	})
	const chosen = selectHumanFallbackCard(knowledge, bestCards) || bestCards[0] || fallback
	return {
		engine: COMPUTER_PLAY_ENGINE,
		card: chosen,
		samples: solved,
		elapsedMs,
		expectedTricks: bestAverage,
		reason: 'sampled_hidden_deals',
	}
}
