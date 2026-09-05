import assert from 'node:assert/strict'
import test from 'node:test'

import {
	LEARNER_COACH_PROFILE_ID,
	buildCoachInstructions,
	coachApiRequestSchema,
	coachModelRequest,
	coachRequestSchema,
	coachTrialRequestSchema,
	isCoachOwner,
	sanitizeCoachOutput,
} from '../functions/_shared/coach-core.mts'
import {
	COACH_DEAL_LIMIT,
	COACH_OWNER_HOURLY_ATTEMPT_LIMIT,
	COACH_OWNER_PERIOD_ATTEMPT_LIMIT,
	COACH_PAID_ATTEMPT_LIMIT,
	COACH_RESPONSES_PER_DEAL_LIMIT,
	CoachOwnerUsageLimitError,
	commitCoachUsage,
	consumeOwnerCoachPaidAttempt,
	failCoachUsage,
	getActiveCoachEntitlement,
	getCoachEntitlement,
	getCoachUsageSummary,
	getOwnerCoachUsageSummary,
	grantCoachEntitlement,
	markCoachUsageDispatched,
	releaseCoachUsage,
	reserveCoachUsage,
	type AtomicEntry,
	type AtomicWrite,
	type CoachAccessStore,
} from '../functions/_shared/coach-entitlements.mts'
import {
	CoachRateLimitError,
	createCoachCostGuard,
	fingerprintCoachRequest,
} from '../functions/_shared/coach-cost-guard.mts'
import { coachUsageSummary } from '../functions/_shared/coach-generation.mts'
import { buildSouthCoachContext } from '../../src/player-v2/coach/buildCoachContext.js'
import { createCoachAccessHandler } from '../functions/coach-access.mts'
import { createCoachEntitlementsHandler } from '../functions/coach-entitlements.mts'
import { createCoachHandler } from '../functions/coach.mts'

const NOW = new Date('2026-09-04T12:00:00.000Z')
const CONFIRMED_AT = '2026-01-01T00:00:00.000Z'
const DEAL_FINGERPRINT = 'a'.repeat(64)
const COMPETITION_DEAL_FINGERPRINT =
	'02ad088b3208956f24c50221e61346d67d89929e05d00a515fdaf049115d57dd'

test('usage estimate applies current Luna input, cache-write, cached-input and output prices', () => {
	assert.deepEqual(
		coachUsageSummary({
			input_tokens: 1_000,
			output_tokens: 100,
			input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 },
		}),
		{ inputTokens: 1_000, outputTokens: 100, estimatedUsd: 0.000289 },
	)
})

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

function validApiRequest(dealFingerprint = DEAL_FINGERPRINT) {
	return { ...validRequest(), dealFingerprint }
}

function coachEnv(values: Record<string, string> = {}) {
	const settings = {
		COACH_ENABLED: 'true',
		COACH_OWNER_EMAIL: 'owner@example.com',
		COACH_CONTACT_EMAIL: 'bridge@example.com',
		COACH_TRIAL_ENABLED: 'false',
		OPENAI_API_KEY: 'test-key-never-sent',
		...values,
	}
	return (name: string) => settings[name as keyof typeof settings]
}

function sameOrigin(request: Request) {
	if (request.headers.get('origin') !== new URL(request.url).origin) throw new Error('bad origin')
}

function coachPost(body: unknown) {
	return new Request('https://ralph.example/api/coach', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: 'https://ralph.example' },
		body: JSON.stringify(body),
	})
}

class MemoryCoachAccessStore implements CoachAccessStore {
	#entries = new Map<string, AtomicEntry<unknown>>()
	#version = 0
	updateFailures = 0

	async get<T>(key: string) {
		const entry = this.#entries.get(key)
		return entry ? (structuredClone(entry) as AtomicEntry<T>) : null
	}

	async create(key: string, data: unknown): Promise<AtomicWrite> {
		if (this.#entries.has(key)) return { modified: false }
		const etag = `etag-${++this.#version}`
		this.#entries.set(key, { data: structuredClone(data), etag })
		return { modified: true, etag }
	}

	async update(key: string, data: unknown, etag: string): Promise<AtomicWrite> {
		if (this.updateFailures > 0) {
			this.updateFailures -= 1
			return { modified: false }
		}
		if (this.#entries.get(key)?.etag !== etag) return { modified: false }
		const nextEtag = `etag-${++this.#version}`
		this.#entries.set(key, { data: structuredClone(data), etag: nextEtag })
		return { modified: true, etag: nextEtag }
	}

	async list(prefix: string) {
		return [...this.#entries.keys()].filter((key) => key.startsWith(prefix)).sort()
	}
}

async function activeEntitlement(store: CoachAccessStore, userId = 'subscriber-1') {
	return grantCoachEntitlement({
		store,
		userId,
		email: `${userId}@example.com`,
		periodStart: '2026-09-01T00:00:00.000Z',
		periodEnd: '2026-10-01T00:00:00.000Z',
		grantedBy: 'owner-1',
		now: NOW,
	})
}

function generatedCoach(message = 'Notice the public auction, then ask which bridge principle matters most.') {
	return {
		coach: {
			message,
			concept: 'Count first',
			certainty: 'known' as const,
			factsUsed: ['The auction is public.'],
			suggestedChecks: ['What has been shown?'],
		},
		usage: { inputTokens: 200, outputTokens: 50, estimatedUsd: 0.000096 },
	}
}

async function dispatchAndCommit(
	store: CoachAccessStore,
	entitlement: Awaited<ReturnType<typeof activeEntitlement>>,
	reservation: Extract<Awaited<ReturnType<typeof reserveCoachUsage>>, { kind: 'reserved' }>['reservation'],
) {
	await markCoachUsageDispatched({ store, entitlement, reservation, now: NOW })
	await commitCoachUsage({
		store,
		entitlement,
		reservation,
		coach: generatedCoach().coach,
		usage: generatedCoach().usage,
		now: NOW,
	})
}

test('HTTP handler rejects unsupported methods and unsafe origins before paid work', async () => {
	const coach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => null,
		verifyOrigin: sameOrigin,
	})
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

test('authenticated API envelope requires a lowercase SHA-256 deal fingerprint and strips it from model input', () => {
	const parsed = coachApiRequestSchema.safeParse(validApiRequest())
	assert.equal(parsed.success, true)
	assert.equal(coachApiRequestSchema.safeParse(validApiRequest('A'.repeat(64))).success, false)
	assert.equal(coachApiRequestSchema.safeParse(validRequest()).success, false)
	if (!parsed.success) return
	const modelRequest = coachModelRequest(parsed.data)
	assert.equal('dealFingerprint' in modelRequest, false)
	assert.equal(modelRequest.intent, 'nudge')
})

test('competition deal fingerprints use normal owner rate metering and generation', async () => {
	const store = new MemoryCoachAccessStore()
	const owner = {
		id: 'owner-competition-test',
		email: 'owner@example.com',
		roles: ['coach-owner'],
	}
	let meteringCalls = 0
	let generationCalls = 0
	const observingCostGuard = {
		async run<T>(
			_userId: string,
			_fingerprint: string,
			producer: () => Promise<T>,
		): Promise<{ value: T; cached: boolean }> {
			meteringCalls += 1
			return { value: await producer(), cached: false }
		},
	}
	const coach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => owner,
		verifyOrigin: sameOrigin,
		store,
		now: () => NOW,
		costGuard: observingCostGuard,
		generate: async () => {
			generationCalls += 1
			return generatedCoach()
		},
	})

	const allowed = await coach(coachPost(validApiRequest(COMPETITION_DEAL_FINGERPRINT)), {})
	assert.equal(allowed.status, 200)
	assert.equal((await allowed.json()).meta.access, 'owner')
	assert.equal(meteringCalls, 1)
	assert.equal(generationCalls, 1)
})

test('competition deal fingerprints use normal subscriber entitlement and usage metering', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store, 'subscriber-competition-test')
	let generationCalls = 0
	const coach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => ({
			id: entitlement.userId,
			email: entitlement.email,
			confirmedAt: CONFIRMED_AT,
			roles: ['coach-subscriber'],
		}),
		verifyOrigin: sameOrigin,
		store,
		now: () => NOW,
		generate: async () => {
			generationCalls += 1
			return generatedCoach()
		},
	})

	const allowed = await coach(coachPost(validApiRequest(COMPETITION_DEAL_FINGERPRINT)), {})
	assert.equal(allowed.status, 200)
	assert.equal((await allowed.json()).meta.access, 'subscriber')
	assert.equal(generationCalls, 1)
	assert.equal((await getCoachUsageSummary(store, entitlement)).dealsUsed, 1)
})

test('competition deal fingerprints do not bypass ordinary sign-in and entitlement checks', async () => {
	let generationCalls = 0
	const generate = async () => {
		generationCalls += 1
		return generatedCoach()
	}
	const anonymousCoach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => null,
		verifyOrigin: sameOrigin,
		generate,
	})
	const anonymous = await anonymousCoach(
		coachPost(validApiRequest(COMPETITION_DEAL_FINGERPRINT)),
		{},
	)
	assert.equal(anonymous.status, 401)
	assert.equal((await anonymous.json()).code, 'sign_in_required')

	const unentitledCoach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => ({
			id: 'subscriber-without-entitlement',
			email: 'subscriber-without-entitlement@example.com',
			confirmedAt: CONFIRMED_AT,
			roles: ['coach-subscriber'],
		}),
		verifyOrigin: sameOrigin,
		store: new MemoryCoachAccessStore(),
		now: () => NOW,
		generate,
	})
	const unentitled = await unentitledCoach(
		coachPost(validApiRequest(COMPETITION_DEAL_FINGERPRINT)),
		{},
	)
	assert.equal(unentitled.status, 403)
	assert.equal((await unentitled.json()).code, 'coach_entitlement_required')
	assert.equal(generationCalls, 0)
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

test('requires an authenticated subject, server-controlled coach-owner role, and exact email match', () => {
	assert.equal(isCoachOwner(null), false)
	assert.equal(isCoachOwner({ id: 'owner-1', email: 'owner@example.com', roles: ['member'] }), false)
	assert.equal(isCoachOwner({ email: 'owner@example.com', roles: ['coach-owner'] }, 'owner@example.com'), false)
	assert.equal(
		isCoachOwner(
			{ id: 'owner-1', email: 'owner@example.com', roles: ['coach-owner'] },
			'owner@example.com',
		),
		true,
	)
	assert.equal(
		isCoachOwner(
			{ id: 'owner-1', email: 'owner@example.com', appMetadata: { roles: ['coach-owner'] } },
			'OWNER@example.com',
		),
		true,
	)
	assert.equal(
		isCoachOwner(
			{ id: 'owner-1', email: 'someone@example.com', roles: ['coach-owner'] },
			'owner@example.com',
		),
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
	assert.match(instructions, /35-45 words/i)
	assert.match(instructions, /one public observation/i)
	assert.match(instructions, /Never name the final bid or card/i)
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

test('owner paid attempts have durable rolling-hour and UTC-month ceilings', async () => {
	const store = new MemoryCoachAccessStore()
	const ownerId = 'owner-durable-limits'
	assert.equal(
		COACH_OWNER_PERIOD_ATTEMPT_LIMIT,
		COACH_DEAL_LIMIT * COACH_RESPONSES_PER_DEAL_LIMIT,
	)
	for (let index = 0; index < COACH_OWNER_HOURLY_ATTEMPT_LIMIT; index += 1) {
		await consumeOwnerCoachPaidAttempt({ store, userId: ownerId, now: NOW })
	}
	await assert.rejects(
		consumeOwnerCoachPaidAttempt({ store, userId: ownerId, now: NOW }),
		(error: unknown) =>
			error instanceof CoachOwnerUsageLimitError && error.kind === 'hour' && error.retryAfterSeconds > 0,
	)

	await consumeOwnerCoachPaidAttempt({
		store,
		userId: ownerId,
		now: new Date(NOW.getTime() + 61 * 60 * 1000),
	})
	for (
		let index = COACH_OWNER_HOURLY_ATTEMPT_LIMIT + 1;
		index < COACH_OWNER_PERIOD_ATTEMPT_LIMIT;
		index += 1
	) {
		await consumeOwnerCoachPaidAttempt({
			store,
			userId: ownerId,
			now: new Date(NOW.getTime() + 2 * 60 * 60 * 1000 + index * 60 * 1000),
		})
	}
	const finalAttemptTime = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000)
	await assert.rejects(
		consumeOwnerCoachPaidAttempt({ store, userId: ownerId, now: finalAttemptTime }),
		(error: unknown) =>
			error instanceof CoachOwnerUsageLimitError && error.kind === 'period' && error.retryAfterSeconds > 0,
	)
	const summary = await getOwnerCoachUsageSummary(store, ownerId, finalAttemptTime)
	assert.equal(summary.paidAttempts, COACH_OWNER_PERIOD_ATTEMPT_LIMIT)
	assert.equal(summary.paidAttemptsRemaining, 0)
})

test('pre-dispatch reservations can be released and dispatched successes remain deduplicated', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store)
	const requestOne = '1'.repeat(64)
	const first = await reserveCoachUsage({
		store,
		entitlement,
		dealFingerprint: DEAL_FINGERPRINT,
		requestFingerprint: requestOne,
		now: NOW,
	})
	assert.equal(first.kind, 'reserved')
	assert.equal((await getCoachUsageSummary(store, entitlement)).dealsUsed, 0)
	if (first.kind !== 'reserved') return
	await releaseCoachUsage({ store, entitlement, reservation: first.reservation, now: NOW })
	assert.equal((await getCoachUsageSummary(store, entitlement)).dealsUsed, 0)

	const retried = await reserveCoachUsage({
		store,
		entitlement,
		dealFingerprint: DEAL_FINGERPRINT,
		requestFingerprint: requestOne,
		now: NOW,
	})
	assert.equal(retried.kind, 'reserved')
	if (retried.kind !== 'reserved') return
	await dispatchAndCommit(store, entitlement, retried.reservation)

	const second = await reserveCoachUsage({
		store,
		entitlement,
		dealFingerprint: DEAL_FINGERPRINT,
		requestFingerprint: '2'.repeat(64),
		now: NOW,
	})
	assert.equal(second.kind, 'reserved')
	if (second.kind !== 'reserved') return
	await dispatchAndCommit(store, entitlement, second.reservation)
	const summary = await getCoachUsageSummary(store, entitlement)
	assert.equal(summary.dealsUsed, 1)
	assert.equal(summary.dealsRemaining, 99)
	assert.equal(summary.paidAttempts, 2)
	assert.equal(summary.successfulResponses, 2)

	const cached = await reserveCoachUsage({
		store,
		entitlement,
		dealFingerprint: DEAL_FINGERPRINT,
		requestFingerprint: '2'.repeat(64),
		now: NOW,
	})
	assert.equal(cached.kind, 'cached')
})

test('usage ledger enforces 20 paid attempts per client-identified deal', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store)
	for (let index = 1; index <= COACH_RESPONSES_PER_DEAL_LIMIT; index += 1) {
		const requestFingerprint = index.toString(16).padStart(64, '0')
		const reserved = await reserveCoachUsage({
			store,
			entitlement,
			dealFingerprint: DEAL_FINGERPRINT,
			requestFingerprint,
			now: NOW,
		})
		assert.equal(reserved.kind, 'reserved')
		if (reserved.kind !== 'reserved') continue
		await markCoachUsageDispatched({ store, entitlement, reservation: reserved.reservation, now: NOW })
		await failCoachUsage({ store, entitlement, reservation: reserved.reservation, now: NOW })
	}
	const blocked = await reserveCoachUsage({
		store,
		entitlement,
		dealFingerprint: DEAL_FINGERPRINT,
		requestFingerprint: 'f'.repeat(64),
		now: NOW,
	})
	assert.equal(blocked.kind, 'response-limit')
	const summary = await getCoachUsageSummary(store, entitlement)
	assert.equal(summary.paidAttempts, COACH_RESPONSES_PER_DEAL_LIMIT)
	assert.equal(summary.successfulResponses, 0)
})

test('usage ledger admits at most 20 concurrent reservations for one deal', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store)
	const reservations = await Promise.all(
		Array.from({ length: COACH_RESPONSES_PER_DEAL_LIMIT + 1 }, (_, index) =>
			reserveCoachUsage({
				store,
				entitlement,
				dealFingerprint: DEAL_FINGERPRINT,
				requestFingerprint: (index + 1).toString(16).padStart(64, '0'),
				now: NOW,
			}),
		),
	)
	assert.equal(reservations.filter((result) => result.kind === 'reserved').length, 20)
	assert.equal(reservations.filter((result) => result.kind === 'response-limit').length, 1)
})

test('usage ledger enforces 100 client-identified deals with durable paid attempts', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store)
	for (let index = 1; index <= COACH_DEAL_LIMIT; index += 1) {
		const reserved = await reserveCoachUsage({
			store,
			entitlement,
			dealFingerprint: index.toString(16).padStart(64, '0'),
			requestFingerprint: '1'.repeat(64),
			now: NOW,
		})
		assert.equal(reserved.kind, 'reserved')
		if (reserved.kind !== 'reserved') continue
		await markCoachUsageDispatched({ store, entitlement, reservation: reserved.reservation, now: NOW })
		await failCoachUsage({ store, entitlement, reservation: reserved.reservation, now: NOW })
	}
	const blocked = await reserveCoachUsage({
		store,
		entitlement,
		dealFingerprint: 'e'.repeat(64),
		requestFingerprint: '2'.repeat(64),
		now: NOW,
	})
	assert.equal(blocked.kind, 'deal-limit')
	assert.equal((await getCoachUsageSummary(store, entitlement)).dealsUsed, 100)
})

test('subscriber provider failure remains a paid attempt and a successful retry is counted separately', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store)
	const subscriber = {
		id: entitlement.userId,
		email: entitlement.email,
		confirmedAt: CONFIRMED_AT,
		roles: ['coach-subscriber'],
	}
	let generationCalls = 0
	let fail = true
	let receivedModelRequest: Record<string, unknown> | undefined
	const coach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => subscriber,
		verifyOrigin: sameOrigin,
		store,
		now: () => NOW,
		generate: async (_key, request) => {
			generationCalls += 1
			receivedModelRequest = request as unknown as Record<string, unknown>
			if (fail) throw new Error('stubbed provider failure')
			return generatedCoach()
		},
	})

	const failed = await coach(coachPost(validApiRequest()), {})
	assert.equal(failed.status, 502)
	const failedSummary = await getCoachUsageSummary(store, entitlement)
	assert.equal(failedSummary.dealsUsed, 1)
	assert.equal(failedSummary.paidAttempts, 1)
	assert.equal(failedSummary.successfulResponses, 0)
	assert.equal('dealFingerprint' in (receivedModelRequest || {}), false)

	fail = false
	const succeeded = await coach(coachPost(validApiRequest()), {})
	assert.equal(succeeded.status, 200)
	assert.equal((await succeeded.json()).meta.access, 'subscriber')
	const successfulSummary = await getCoachUsageSummary(store, entitlement)
	assert.equal(successfulSummary.dealsUsed, 1)
	assert.equal(successfulSummary.paidAttempts, 2)
	assert.equal(successfulSummary.successfulResponses, 1)
	const cached = await coach(coachPost(validApiRequest()), {})
	assert.equal(cached.status, 200)
	assert.equal((await cached.json()).meta.cached, true)
	assert.equal(generationCalls, 2)
})

test('subscriber provider success remains metered when completion storage fails', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store, 'subscriber-commit-failure')
	const subscriber = {
		id: entitlement.userId,
		email: entitlement.email,
		confirmedAt: CONFIRMED_AT,
		roles: ['coach-subscriber'],
	}
	let now = NOW
	let generationCalls = 0
	const coach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => subscriber,
		verifyOrigin: sameOrigin,
		store,
		now: () => now,
		generate: async () => {
			generationCalls += 1
			if (generationCalls === 1) store.updateFailures = 32
			return generatedCoach()
		},
	})

	const receiptFailure = await coach(coachPost(validApiRequest()), {})
	assert.equal(receiptFailure.status, 503)
	assert.equal((await receiptFailure.json()).code, 'coach_usage_completion_failed')
	const afterFailure = await getCoachUsageSummary(store, entitlement)
	assert.equal(afterFailure.dealsUsed, 1)
	assert.equal(afterFailure.paidAttempts, 1)
	assert.equal(afterFailure.successfulResponses, 0)

	const immediateRetry = await coach(coachPost(validApiRequest()), {})
	assert.equal(immediateRetry.status, 409)
	assert.equal(generationCalls, 1)

	now = new Date(NOW.getTime() + 6 * 60 * 1000)
	const laterRetry = await coach(coachPost(validApiRequest()), {})
	assert.equal(laterRetry.status, 200)
	const afterRetry = await getCoachUsageSummary(store, entitlement)
	assert.equal(afterRetry.paidAttempts, 2)
	assert.equal(afterRetry.successfulResponses, 1)
	assert.equal(generationCalls, 2)
})

test('subscriber JWT fallback requires a stable subject, role, active entitlement, and an enabled Coach', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store)
	const baseUser = {
		id: entitlement.userId,
		email: entitlement.email,
		roles: ['coach-subscriber'],
	}
	let calls = 0
	const handlerFor = (user: typeof baseUser, env = coachEnv()) =>
		createCoachHandler({
			env,
			identityUser: async () => user,
			verifyOrigin: sameOrigin,
			store,
			now: () => NOW,
			generate: async () => {
				calls += 1
				return generatedCoach()
			},
		})

	const claimsFallback = await handlerFor(baseUser)(coachPost(validApiRequest()), {})
	assert.equal(claimsFallback.status, 200)
	const missingSubject = await handlerFor({ ...baseUser, id: '' })(coachPost(validApiRequest()), {})
	assert.equal(missingSubject.status, 403)
	const wrongRole = await handlerFor({ ...baseUser, roles: ['member'] })(coachPost(validApiRequest()), {})
	assert.equal(wrongRole.status, 403)
	const disabled = await handlerFor(baseUser, coachEnv({ COACH_ENABLED: 'false' }))(coachPost(validApiRequest()), {})
	assert.equal(disabled.status, 503)
	const expired = await createCoachHandler({
		env: coachEnv(),
		identityUser: async () => baseUser,
		verifyOrigin: sameOrigin,
		store,
		now: () => new Date('2026-10-02T00:00:00.000Z'),
		generate: async () => generatedCoach(),
	})(coachPost(validApiRequest()), {})
	assert.equal(expired.status, 403)
	assert.equal(calls, 1)
})

test('subscriber plan allows nudge and explain but keeps broader owner intents private', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store)
	const coach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => ({
			id: entitlement.userId,
			email: entitlement.email,
			confirmedAt: CONFIRMED_AT,
			roles: ['coach-subscriber'],
		}),
		verifyOrigin: sameOrigin,
		store,
		now: () => NOW,
		generate: async () => generatedCoach(),
	})
	assert.equal((await coach(coachPost(validApiRequest()), {})).status, 200)
	assert.equal(
		(await coach(coachPost({ ...validApiRequest('b'.repeat(64)), intent: 'explain' }), {})).status,
		200,
	)
	assert.equal(
		(await coach(coachPost({ ...validApiRequest('c'.repeat(64)), intent: 'compare' }), {})).status,
		403,
	)
})

test('owner JWT fallback uses durable paid-attempt accounting and COACH_ENABLED fails closed', async () => {
	const store = new MemoryCoachAccessStore()
	const owner = {
		id: 'owner-1',
		email: 'owner@example.com',
		roles: ['coach-owner'],
	}
	let calls = 0
	let modelRequest: Record<string, unknown> | undefined
	const enabledCoach = createCoachHandler({
		env: coachEnv(),
		identityUser: async () => owner,
		verifyOrigin: sameOrigin,
		store,
		now: () => NOW,
		generate: async (_key, request) => {
			calls += 1
			modelRequest = request as unknown as Record<string, unknown>
			return generatedCoach()
		},
	})
	const response = await enabledCoach(coachPost(validApiRequest()), {})
	assert.equal(response.status, 200)
	assert.equal((await response.json()).meta.access, 'owner')
	assert.equal('dealFingerprint' in (modelRequest || {}), false)
	assert.equal((await getOwnerCoachUsageSummary(store, owner.id, NOW)).paidAttempts, 1)

	const disabledCoach = createCoachHandler({
		env: coachEnv({ COACH_ENABLED: 'false' }),
		identityUser: async () => owner,
		verifyOrigin: sameOrigin,
		store,
		now: () => NOW,
		generate: async () => {
			calls += 1
			return generatedCoach()
		},
	})
	assert.equal((await disabledCoach(coachPost(validApiRequest()), {})).status, 503)
	assert.equal(calls, 1)
})

test('access endpoint reports only enabled, authorization, contact, and subscriber allowance state', async () => {
	const store = new MemoryCoachAccessStore()
	const entitlement = await activeEntitlement(store)
	const access = createCoachAccessHandler({
		env: coachEnv(),
		accessStore: store,
		identityUser: async () => ({
			id: entitlement.userId,
			email: entitlement.email,
			roles: ['coach-subscriber'],
		}),
		now: () => NOW,
	})
	const payload = await (await access(new Request('https://ralph.example/api/coach/access'), {})).json()
	assert.equal(payload.enabled, true)
	assert.equal(payload.configured, true)
	assert.equal(payload.signedIn, true)
	assert.equal(payload.access, 'subscriber')
	assert.equal(payload.authorized, true)
	assert.equal(payload.entitlement.dealLimit, 100)
	assert.equal(payload.entitlement.dealsUsed, 0)
	assert.equal(payload.entitlement.responsesPerDealLimit, 20)
	assert.equal(payload.entitlement.paidAttemptLimit, COACH_PAID_ATTEMPT_LIMIT)
	assert.equal(payload.entitlement.paidAttempts, 0)
	assert.equal(payload.entitlement.successfulResponses, 0)
	assert.equal(payload.entitlement.periodEnd, entitlement.periodEnd)
	assert.equal(payload.contactEmail, 'bridge@example.com')
	assert.equal(JSON.stringify(payload).includes('test-key-never-sent'), false)
})

test('access endpoint recognizes an owner from verified JWT fallback claims', async () => {
	const access = createCoachAccessHandler({
		env: coachEnv(),
		identityUser: async () => ({
			id: 'owner-claims-1',
			email: 'owner@example.com',
			roles: ['coach-owner'],
			appMetadata: { provider: 'email', roles: ['coach-owner'] },
		}),
		now: () => NOW,
	})
	const payload = await (await access(new Request('https://ralph.example/api/coach/access'), {})).json()
	assert.equal(payload.signedIn, true)
	assert.equal(payload.configured, true)
	assert.equal(payload.access, 'owner')
	assert.equal(payload.authorized, true)
	assert.equal('entitlement' in payload, false)
})

test('owner entitlement endpoint grants, reads, lists, and revokes a confirmed Identity user', async () => {
	const store = new MemoryCoachAccessStore()
	const owner = {
		id: 'owner-1',
		email: 'owner@example.com',
		roles: ['coach-owner'],
	}
	let target = {
		id: 'subscriber-2',
		email: 'subscriber-2@example.com',
		confirmedAt: CONFIRMED_AT,
		roles: ['member'],
		appMetadata: { provider: 'email', roles: ['member'] },
	}
	const identityAdmin = {
		async getUser(userId: string) {
			if (userId !== target.id) throw new Error('not found')
			return structuredClone(target)
		},
		async updateUser(userId: string, updates: { app_metadata?: Record<string, unknown> }) {
			if (userId !== target.id) throw new Error('not found')
			target = {
				...target,
				roles: (updates.app_metadata?.roles as string[]) || target.roles,
				appMetadata: updates.app_metadata || target.appMetadata,
			}
			return structuredClone(target)
		},
	}
	const entitlements = createCoachEntitlementsHandler({
		env: coachEnv(),
		identityUser: async () => owner,
		identityAdmin,
		verifyOrigin: sameOrigin,
		store,
		now: () => NOW,
	})
	const post = (body: unknown) =>
		new Request('https://ralph.example/api/coach/entitlements', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: 'https://ralph.example' },
			body: JSON.stringify(body),
		})

	const grant = await entitlements(
		post({
			action: 'grant',
			userId: target.id,
			periodStart: '2026-09-01T00:00:00.000Z',
			periodEnd: '2026-10-01T00:00:00.000Z',
			note: 'Manual GBP 10 subscription',
		}),
		{},
	)
	assert.equal(grant.status, 200)
	assert.equal(target.roles.includes('coach-subscriber'), true)
	assert.equal((await getActiveCoachEntitlement(store, target.id, NOW))?.dealLimit, 100)

	const read = await entitlements(
		new Request(`https://ralph.example/api/coach/entitlements?userId=${target.id}`),
		{},
	)
	assert.equal(read.status, 200)
	assert.equal((await read.json()).entitlement.email, target.email)
	const list = await entitlements(new Request('https://ralph.example/api/coach/entitlements'), {})
	assert.equal((await list.json()).records.length, 1)

	const revoke = await entitlements(post({ action: 'revoke', userId: target.id }), {})
	assert.equal(revoke.status, 200)
	assert.equal((await revoke.json()).roleUpdated, true)
	assert.equal(target.roles.includes('coach-subscriber'), false)
	assert.equal((await getCoachEntitlement(store, target.id))?.status, 'revoked')
})

test('entitlement administration rejects a user without the owner role before touching Identity or storage', async () => {
	const store = new MemoryCoachAccessStore()
	let adminCalls = 0
	const entitlements = createCoachEntitlementsHandler({
		env: coachEnv(),
		identityUser: async () => ({
			id: 'owner-1',
			email: 'owner@example.com',
			roles: ['member'],
		}),
		identityAdmin: {
			async getUser() {
				adminCalls += 1
				throw new Error('must not run')
			},
			async updateUser() {
				adminCalls += 1
				throw new Error('must not run')
			},
		},
		verifyOrigin: sameOrigin,
		store,
		now: () => NOW,
	})
	const response = await entitlements(new Request('https://ralph.example/api/coach/entitlements'), {})
	assert.equal(response.status, 403)
	assert.equal(adminCalls, 0)
	assert.equal((await store.list('entitlement/v1/')).length, 0)
})

test('entitlement grants require a confirmed target and cap one period at 35 days', async () => {
	const owner = {
		id: 'owner-1',
		email: 'owner@example.com',
		confirmedAt: CONFIRMED_AT,
		roles: ['coach-owner'],
	}
	let targetConfirmedAt: string | undefined
	let roleUpdates = 0
	const entitlements = createCoachEntitlementsHandler({
		env: coachEnv(),
		identityUser: async () => owner,
		identityAdmin: {
			async getUser(userId: string) {
				return {
					id: userId,
					email: 'learner@example.com',
					confirmedAt: targetConfirmedAt,
					roles: [],
					appMetadata: {},
				}
			},
			async updateUser(userId: string) {
				roleUpdates += 1
				return { id: userId }
			},
		},
		verifyOrigin: sameOrigin,
		store: new MemoryCoachAccessStore(),
		now: () => NOW,
	})
	const post = (body: unknown) =>
		new Request('https://ralph.example/api/coach/entitlements', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: 'https://ralph.example' },
			body: JSON.stringify(body),
		})
	const grant = (periodEnd: string) => ({
		action: 'grant',
		userId: 'learner-1',
		periodStart: '2026-09-01T00:00:00.000Z',
		periodEnd,
	})

	const unconfirmed = await entitlements(post(grant('2026-10-01T00:00:00.000Z')), {})
	assert.equal(unconfirmed.status, 400)
	assert.equal((await unconfirmed.json()).code, 'identity_user_unconfirmed')

	targetConfirmedAt = CONFIRMED_AT
	const tooLong = await entitlements(post(grant('2026-10-07T00:00:00.000Z')), {})
	assert.equal(tooLong.status, 400)
	assert.equal((await tooLong.json()).code, 'invalid_entitlement')
	assert.equal(roleUpdates, 0)
})
