import assert from 'node:assert/strict'
import test from 'node:test'

import {
	LEARNER_COACH_PROFILE_ID,
	buildCoachInstructions,
	coachRequestSchema,
	coachTrialRequestSchema,
	isCoachOwner,
	sanitizeCoachOutput,
} from '../functions/_shared/coach-core.mts'
import {
	CoachRateLimitError,
	createCoachCostGuard,
	fingerprintCoachRequest,
} from '../functions/_shared/coach-cost-guard.mts'
import { buildSouthCoachContext } from '../../src/player-v2/coach/buildCoachContext.js'
import coach from '../functions/coach.mts'

const southCards = [
	{ rank: 'A', suit: 'Spades' },
	{ rank: '4', suit: 'Spades' },
	{ rank: '3', suit: 'Spades' },
	{ rank: '2', suit: 'Spades' },
	{ rank: 'K', suit: 'Hearts' },
	{ rank: 'Q', suit: 'Hearts' },
	{ rank: '3', suit: 'Hearts' },
	{ rank: 'J', suit: 'Diamonds' },
	{ rank: '3', suit: 'Diamonds' },
	{ rank: '2', suit: 'Diamonds' },
	{ rank: 'Q', suit: 'Clubs' },
	{ rank: '3', suit: 'Clubs' },
	{ rank: '2', suit: 'Clubs' },
]

function validRequest() {
	return {
		intent: 'nudge',
		context: {
			schemaVersion: 1,
			eventKey: '7:auction:2',
			trigger: 'auction-step',
			phase: 'auction',
			profile: {
				id: 'south-acol-12-14-safe-v1',
				learnerSeat: 'S',
				hintMode: 'safer',
				biddingSystem: {
					name: 'ACOL',
					oneNoTrump: { hcpMinimum: 12, hcpMaximum: 14, shape: 'balanced' },
					stayman: { call: '2C', asksForFourCardMajor: true },
				},
				disclosure: {
					hiddenCardLocations: false,
					futureAuctionCalls: false,
					doubleDummyAnalysis: false,
				},
			},
			board: { number: '7', dealer: 'N', vulnerability: 'NS' },
			perspective: {
				seat: 'S',
				role: 'bidder',
				knownHands: [{ seat: 'S', initial: southCards, remaining: southCards }],
			},
			auction: {
				dealer: 'N',
				cursor: 2,
				calls: [
					{ seat: 'N', call: '1NT' },
					{ seat: 'E', call: 'P' },
				],
				nextSeat: 'S',
				learnerToCall: true,
				isComplete: false,
			},
			facts: {
				learnerHand: {
					hcp: 12,
					shape: { Spades: 4, Hearts: 3, Diamonds: 3, Clubs: 3 },
					shapePattern: '4-3-3-3',
					commonBalancedShape: true,
					fourCardMajors: ['Spades'],
				},
				acol: {
					oneNoTrumpOpeningRangeHcp: [12, 14],
					directResponseToPartnerOneNoTrump: true,
					hasFourCardMajor: true,
					fourCardMajors: ['Spades'],
				},
			},
		},
	}
}

test('HTTP handler rejects unsupported methods and unsafe origins before paid work', async () => {
	const getResponse = await coach(new Request('https://ralph.example/api/coach'), {})
	assert.equal(getResponse.status, 405)

	const missingOrigin = await coach(
		new Request('https://ralph.example/api/coach', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		}),
		{},
	)
	assert.equal(missingOrigin.status, 403)

	const crossOrigin = await coach(
		new Request('https://ralph.example/api/coach', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
			body: '{}',
		}),
		{},
	)
	assert.equal(crossOrigin.status, 403)

	const unsignedOwnerRequest = await coach(
		new Request('https://ralph.example/api/coach', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: 'https://ralph.example' },
			body: '{}',
		}),
		{},
	)
	assert.equal(unsignedOwnerRequest.status, 401)
})

test('accepts the strict South-only ACOL context contract', () => {
	const parsed = coachRequestSchema.safeParse(validRequest())
	assert.equal(parsed.success, true)
})

test('accepts a strict North learner perspective for rotated declarer control', () => {
	const request = structuredClone(validRequest())
	request.context.eventKey = '7:auction:0'
	request.context.profile.id = LEARNER_COACH_PROFILE_ID
	request.context.profile.learnerSeat = 'N'
	request.context.perspective.seat = 'N'
	request.context.perspective.knownHands[0].seat = 'N'
	request.context.auction = {
		dealer: 'N',
		cursor: 0,
		calls: [],
		nextSeat: 'N',
		learnerToCall: true,
		isComplete: false,
	}
	request.context.facts.acol.directResponseToPartnerOneNoTrump = false

	const parsed = coachRequestSchema.safeParse(request)
	assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues))

	const mismatched = structuredClone(request)
	mismatched.context.perspective.seat = 'S'
	assert.equal(coachRequestSchema.safeParse(mismatched).success, false)

	const legacyMismatch = structuredClone(request)
	legacyMismatch.context.profile.id = 'south-acol-12-14-safe-v1'
	assert.equal(coachRequestSchema.safeParse(legacyMismatch).success, false)
})

test('anonymous trial schema permits only a nudge with no free-form question', () => {
	assert.equal(coachTrialRequestSchema.safeParse(validRequest()).success, true)
	assert.equal(
		coachTrialRequestSchema.safeParse({ ...validRequest(), intent: 'explain' }).success,
		false,
	)
	assert.equal(
		coachTrialRequestSchema.safeParse({ ...validRequest(), question: 'Tell me the answer.' }).success,
		false,
	)
})

test('accepts card-play context produced by the real client redaction layer', () => {
	const allCards = ['Spades', 'Hearts', 'Diamonds', 'Clubs'].flatMap((suit) =>
		['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map((rank) => ({
			rank,
			suit,
		})),
	)
	const hands = {
		S: allCards.slice(0, 13),
		W: allCards.slice(13, 26),
		N: allCards.slice(26, 39),
		E: allCards.slice(39, 52),
	}
	const openingCard = hands.W[0]
	const remaining = { ...hands, W: hands.W.slice(1) }
	const context = buildSouthCoachContext({
		index: 0,
		board: { board: '1', dealer: 'S', vul: 'None', contract: '4H', declarer: 'S' },
		hands,
		auction: {
			dealer: 'S',
			calls: ['1H', 'P', '4H', 'P', 'P', 'P'],
			contract: '4H',
			declarer: 'S',
		},
		auctionCursor: 6,
		manualContract: { declarer: '', level: '', strain: '', dbl: '' },
		phase: 'play',
		history: [{ seat: 'W', card: openingCard }],
		completedTricks: [],
		play: {
			turnSeat: 'N',
			remaining,
			trick: [{ seat: 'W', card: openingCard }],
			trickComplete: false,
		},
	})

	assert.ok(context)
	const parsed = coachRequestSchema.safeParse({ intent: 'remember', context })
	assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues))
})

test('accepts the real client context while waiting for the opening lead', () => {
	const allCards = ['Spades', 'Hearts', 'Diamonds', 'Clubs'].flatMap((suit) =>
		['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map((rank) => ({
			rank,
			suit,
		})),
	)
	const hands = {
		S: allCards.slice(0, 13),
		W: allCards.slice(13, 26),
		N: allCards.slice(26, 39),
		E: allCards.slice(39, 52),
	}
	const context = buildSouthCoachContext({
		index: 0,
		board: { board: '1', dealer: 'S', vul: 'None', contract: '4H', declarer: 'S' },
		hands,
		auction: {
			dealer: 'S',
			calls: ['1H', 'P', '4H', 'P', 'P', 'P'],
			contract: '4H',
			declarer: 'S',
		},
		auctionCursor: 6,
		manualContract: { declarer: '', level: '', strain: '', dbl: '' },
		phase: 'play',
		history: [],
		completedTricks: [],
		play: { turnSeat: 'W', remaining: hands, trick: [], trickComplete: false },
	})

	assert.equal(context?.phase, 'opening-lead')
	assert.equal(context?.facts.play, undefined)
	const parsed = coachRequestSchema.safeParse({ intent: 'nudge', context })
	assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues))
})

test('rejects unknown hidden-state fields instead of forwarding them', () => {
	const request = validRequest()
	request.context.hiddenHands = { E: southCards }
	const parsed = coachRequestSchema.safeParse(request)
	assert.equal(parsed.success, false)
})

test('rejects a changed profile or an additional pre-play hand', () => {
	const changedSystem = structuredClone(validRequest())
	changedSystem.context.profile.biddingSystem.oneNoTrump.hcpMaximum = 15
	assert.equal(coachRequestSchema.safeParse(changedSystem).success, false)

	const leakedHand = structuredClone(validRequest())
	leakedHand.context.perspective.knownHands.push({
		seat: 'N',
		initial: southCards,
		remaining: southCards,
	})
	assert.equal(coachRequestSchema.safeParse(leakedHand).success, false)
})

test('requires the server-controlled coach-owner role and exact email match', () => {
	assert.equal(isCoachOwner(null), false)
	assert.equal(isCoachOwner({ email: 'owner@example.com', roles: ['member'] }), false)
	assert.equal(isCoachOwner({ email: 'owner@example.com', roles: ['coach-owner'] }), false)
	assert.equal(
		isCoachOwner({ email: 'owner@example.com', roles: ['coach-owner'] }, 'owner@example.com'),
		true,
	)
	assert.equal(
		isCoachOwner(
			{ email: 'owner@example.com', appMetadata: { roles: ['coach-owner'] } },
			'OWNER@example.com',
		),
		true,
	)
	assert.equal(
		isCoachOwner({ email: 'someone@example.com', roles: ['coach-owner'] }, 'owner@example.com'),
		false,
	)
})

test('replaces unsupported hidden-card ownership claims with a safe count prompt', () => {
	for (const message of [
		'West has the ace of hearts, so return a heart.',
		'The ace of hearts is with West, so return a heart.',
		'Expect West to hold the ace of hearts.',
		'Both defenders are out of trumps, so cash your winners.',
	]) {
		const output = sanitizeCoachOutput({
			message,
			concept: 'Defence',
			certainty: 'known',
			factsUsed: [],
			suggestedChecks: [],
		})
		assert.equal(output.certainty, 'unknown', message)
		assert.match(output.message, /cannot safely place an unseen card/i)
	}

	const safe = sanitizeCoachOutput({
		message: 'Partner has led a heart. Count the hearts that have appeared before deciding what to return.',
		concept: 'Returning partner’s suit',
		certainty: 'known',
		factsUsed: ['Partner’s heart lead is in the public play history.'],
		suggestedChecks: ['How many hearts have been played?'],
	})
	assert.match(safe.message, /Partner has led a heart/)
})

test('prompt fixes ACOL 12-14 and prohibits hidden-hand and double-dummy claims', () => {
	const instructions = buildCoachInstructions()
	assert.match(instructions, /ACOL with a 12-14 balanced 1NT/i)
	assert.match(instructions, /Never guess or claim the exact location/i)
	assert.match(instructions, /Never use double-dummy knowledge/i)
})

test('deduplicates a repeated request before consuming another paid call', async () => {
	const guard = createCoachCostGuard({ minuteLimit: 1, hourLimit: 2, cacheTtlMs: 10_000 })
	let calls = 0
	const request = validRequest()
	const fingerprint = fingerprintCoachRequest('owner-1', request)
	const first = await guard.run('owner-1', fingerprint, async () => ({ value: ++calls }), 1_000)
	const duplicate = await guard.run('owner-1', fingerprint, async () => ({ value: ++calls }), 1_001)

	assert.equal(first.cached, false)
	assert.equal(duplicate.cached, true)
	assert.equal(duplicate.value.value, 1)
	assert.equal(calls, 1)

	await assert.rejects(
		guard.run('owner-1', `${fingerprint}-different`, async () => ({ value: ++calls }), 1_002),
		CoachRateLimitError,
	)
})
