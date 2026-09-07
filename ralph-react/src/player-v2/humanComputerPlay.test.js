import assert from 'node:assert/strict'
import test from 'node:test'
import {
	analyseHumanComputerPlay,
	buildComputerKnowledge,
	computerCardKey,
	generateSampleDeals,
	selectHumanFallbackCard,
	validateSampleDeal,
} from './humanComputerPlay.js'
import { createComputerDecisionGate } from './computerDecisionGate.js'

const SEATS = ['N', 'E', 'S', 'W']
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

function card(suit, rank, seat = '') {
	return { id: `${seat}-${suit}-${rank}`, seat, suit, rank }
}

function completeHands() {
	const hands = Object.fromEntries(SEATS.map((seat) => [seat, []]))
	SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))).forEach((item, index) => {
		const seat = SEATS[index % 4]
		hands[seat].push(card(item.suit, item.rank, seat))
	})
	return hands
}

function knowledgeFor({
	seat = 'W',
	declarer = 'S',
	dummy = 'N',
	trump = 'Hearts',
	remaining = completeHands(),
	history = [],
	trick = [],
	trickComplete = false,
} = {}) {
	return buildComputerKnowledge({
		seat,
		remaining,
		history,
		trick,
		trickComplete,
		declarer,
		dummy,
		trump,
		vulnerability: 'None',
		auctionDealer: 'S',
		auctionCalls: ['1NT', 'P', '3NT', 'P', 'P', 'P'],
		auctionSources: ['local-acol', 'local-acol', 'south', 'local-acol', 'local-acol', 'local-acol'],
	})
}

test('concealed hands cannot alter the computer knowledge, seed or samples', () => {
	const first = completeHands()
	const second = completeHands()
	const concealed = [...second.N, ...second.E, ...second.S].reverse()
	second.N = concealed.slice(0, 13).map((item) => ({ ...item, id: `changed-N-${computerCardKey(item)}` }))
	second.E = concealed.slice(13, 26).map((item) => ({ ...item, id: `changed-E-${computerCardKey(item)}` }))
	second.S = concealed.slice(26).map((item) => ({ ...item, id: `changed-S-${computerCardKey(item)}` }))
	const a = knowledgeFor({ remaining: first })
	const b = knowledgeFor({ remaining: second })
	assert.equal(a.fingerprint, b.fingerprint)
	assert.equal(a.seed, b.seed)
	assert.deepEqual(a.knownSeats, ['W'])
	assert.deepEqual(generateSampleDeals(a, 4), generateSampleDeals(b, 4))
})

test('sampled deals retain 52 unique cards, remaining counts and shown voids', () => {
	const remaining = completeHands()
	const lead = remaining.N.find((item) => item.suit === 'Spades')
	const discard = remaining.E.find((item) => item.suit === 'Hearts')
	remaining.N = remaining.N.filter((item) => item !== lead)
	remaining.E = remaining.E.filter((item) => item !== discard)
	const history = [
		{ seat: 'N', card: lead },
		{ seat: 'E', card: discard },
	]
	const knowledge = knowledgeFor({
		seat: 'S',
		declarer: 'E',
		dummy: 'W',
		remaining,
		history,
		trick: history,
	})
	assert.deepEqual(knowledge.voids.E, ['Spades'])
	const samples = generateSampleDeals(knowledge, 12)
	assert.equal(samples.length, 12)
	for (const sample of samples) {
		assert.equal(validateSampleDeal(knowledge, sample), true)
		assert.equal(sample.E.some((item) => item.suit === 'Spades'), false)
	}
})

test('dummy decisions include declarer and exposed dummy but no defender hand', () => {
	const remaining = completeHands()
	const openingLead = remaining.W[0]
	remaining.W = remaining.W.slice(1)
	const history = [{ seat: 'W', card: openingLead }]
	const knowledge = knowledgeFor({
		seat: 'N',
		declarer: 'S',
		dummy: 'N',
		remaining,
		history,
		trick: history,
	})
	assert.deepEqual(knowledge.knownSeats, ['N', 'S'])
	assert.deepEqual(Object.keys(knowledge.knownHands), ['N', 'S'])
})

test('fallback plays low when partner is winning', () => {
	const knowledge = {
		seat: 'E',
		trump: null,
		knownHands: { E: [card('Spades', 'A'), card('Spades', '2')] },
		currentTrick: [
			{ seat: 'N', card: card('Spades', 'K') },
			{ seat: 'W', card: card('Spades', 'A') },
		],
	}
	assert.equal(computerCardKey(selectHumanFallbackCard(knowledge)), 'Spades:2')
})

test('fallback wins as cheaply as possible', () => {
	const knowledge = {
		seat: 'E',
		trump: null,
		knownHands: { E: [card('Spades', 'A'), card('Spades', 'Q'), card('Spades', '2')] },
		currentTrick: [
			{ seat: 'S', card: card('Spades', 'J') },
			{ seat: 'W', card: card('Spades', '3') },
		],
	}
	assert.equal(computerCardKey(selectHumanFallbackCard(knowledge)), 'Spades:Q')
})

test('fallback ruffs economically when unable to follow', () => {
	const knowledge = {
		seat: 'E',
		trump: 'Hearts',
		knownHands: {
			E: [card('Hearts', 'K'), card('Hearts', '2'), card('Clubs', '2')],
		},
		currentTrick: [
			{ seat: 'S', card: card('Spades', 'A') },
			{ seat: 'W', card: card('Spades', '3') },
		],
	}
	assert.equal(computerCardKey(selectHumanFallbackCard(knowledge)), 'Hearts:2')
})

test('fallback leads an honour sequence and otherwise from length', () => {
	const sequence = {
		seat: 'E',
		trump: 'Hearts',
		knownHands: { E: [card('Spades', 'K'), card('Spades', 'Q'), card('Spades', '4'), card('Clubs', '2')] },
		currentTrick: [],
	}
	assert.equal(computerCardKey(selectHumanFallbackCard(sequence)), 'Spades:K')
	const length = {
		...sequence,
		knownHands: {
			E: [card('Spades', 'A'), card('Spades', '9'), card('Spades', '7'), card('Spades', '3'), card('Clubs', '2')],
		},
	}
	assert.equal(computerCardKey(selectHumanFallbackCard(length)), 'Spades:3')
})

test('fallback returns partner suit and makes a safe low discard', () => {
	const returnSuit = {
		seat: 'E',
		trump: 'Hearts',
		knownHands: {
			E: [card('Spades', 'A'), card('Spades', '9'), card('Clubs', '2')],
		},
		currentTrick: [],
		played: [
			{ seat: 'W', card: card('Clubs', 'A') },
			{ seat: 'N', card: card('Clubs', '3') },
			{ seat: 'E', card: card('Clubs', '4') },
			{ seat: 'S', card: card('Clubs', 'K') },
		],
	}
	assert.equal(computerCardKey(selectHumanFallbackCard(returnSuit)), 'Clubs:2')
	const discard = {
		...returnSuit,
		currentTrick: [{ seat: 'S', card: card('Diamonds', 'A') }],
		knownHands: {
			E: [card('Spades', 'K'), card('Spades', '2'), card('Clubs', '3')],
		},
	}
	assert.equal(computerCardKey(selectHumanFallbackCard(discard)), 'Spades:2')
})

test('sample analysis is deterministic and uses natural tie-breaking', async () => {
	const knowledge = knowledgeFor()
	const legal = knowledge.knownHands.W
	assert.ok(legal.length > 1)
	const solve = async () => ({
		cards: legal.length,
		suit: legal.map((item) => SUITS.indexOf(item.suit)),
		rank: legal.map((item) => RANKS.indexOf(item.rank) + 2),
		equals: legal.map(() => 0),
		score: legal.map(() => 7),
	})
	const first = await analyseHumanComputerPlay(knowledge, solve, { now: () => 0 })
	let replayClock = 0
	const second = await analyseHumanComputerPlay(knowledge, solve, {
		now: () => {
			replayClock += 25
			return replayClock
		},
		hardBudgetMs: 100000,
	})
	assert.equal(first.engine, 'human-style-local-v1')
	assert.deepEqual(first.card, second.card)
	assert.equal(first.samples, 8)
})

test('solver failure and time overrun return legal fallback play', async () => {
	const knowledge = knowledgeFor()
	const failed = await analyseHumanComputerPlay(knowledge, async () => {
		throw new Error('WASM unavailable')
	})
	assert.equal(failed.engine, 'fallback')
	assert.equal(failed.solverFailed, true)
	assert.ok(knowledge.knownHands.W.some((item) => computerCardKey(item) === computerCardKey(failed.card)))

	let clock = 0
	const timedCard = knowledge.knownHands.W[0]
	const timed = await analyseHumanComputerPlay(
		knowledge,
		async () => {
			clock += 1000
			return {
				cards: 1,
				suit: [SUITS.indexOf(timedCard.suit)],
				rank: [RANKS.indexOf(timedCard.rank) + 2],
				equals: [0],
				score: [1],
			}
		},
		{ now: () => clock, hardBudgetMs: 900 },
	)
	assert.equal(timed.engine, 'fallback')
	assert.equal(timed.reason, 'time_budget')
	assert.ok(timed.card)
})

test('decision gate rejects responses after undo, pause, replay or navigation', () => {
	const gate = createComputerDecisionGate()
	const first = gate.issue('position-a')
	assert.equal(gate.isCurrent(first, 'position-a'), true)
	gate.cancel()
	assert.equal(gate.isCurrent(first, 'position-a'), false)
	const second = gate.issue('position-b')
	assert.equal(gate.isCurrent(second, 'position-a'), false)
	assert.equal(gate.isCurrent(second, 'position-b'), true)
})
