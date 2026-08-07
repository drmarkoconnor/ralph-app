import assert from 'node:assert/strict'
import test from 'node:test'

import type { User } from '@netlify/identity'

import { createCoachAccessHandler } from '../functions/coach-access.mts'
import { createCoachTrialHandler } from '../functions/coach-trial.mts'
import {
	COACH_TRIAL_COOKIE,
	createTrialToken,
	serializeTrialCookie,
	validTrialSecret,
	verifyTrialToken,
	type AtomicEntry,
	type AtomicWrite,
	type CoachTrialStore,
} from '../functions/_shared/coach-trial-ledger.mts'

const SECRET = 'test-only-trial-secret-32-characters-minimum'
const SOUTH_CARDS = [
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

function validRequest(board = '7') {
	return {
		intent: 'nudge',
		context: {
			schemaVersion: 1,
			eventKey: `${board}:auction:2`,
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
			board: { number: board, dealer: 'N', vulnerability: 'NS' },
			perspective: {
				seat: 'S',
				role: 'bidder',
				knownHands: [{ seat: 'S', initial: SOUTH_CARDS, remaining: SOUTH_CARDS }],
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

class MemoryTrialStore implements CoachTrialStore {
	#entries = new Map<string, AtomicEntry<unknown>>()
	#version = 0
	completionUpdateFailures = 0

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
		if (
			(data as { status?: unknown } | null)?.status === 'completed' &&
			this.completionUpdateFailures > 0
		) {
			this.completionUpdateFailures -= 1
			return { modified: false }
		}
		if (this.#entries.get(key)?.etag !== etag) return { modified: false }
		const nextEtag = `etag-${++this.#version}`
		this.#entries.set(key, { data: structuredClone(data), etag: nextEtag })
		return { modified: true, etag: nextEtag }
	}

	async delete(key: string) {
		this.#entries.delete(key)
	}
}

function env(values: Record<string, string> = {}) {
	const settings = {
		COACH_TRIAL_ENABLED: 'true',
		COACH_TRIAL_SECRET: SECRET,
		COACH_TRIAL_DAILY_CAP: '20',
		OPENAI_API_KEY: 'test-key-never-sent',
		...values,
	}
	return (name: string) => settings[name as keyof typeof settings]
}

function sameOrigin(request: Request) {
	if (request.headers.get('origin') !== new URL(request.url).origin) throw new Error('bad origin')
}

function post(body: unknown, cookie?: string) {
	return new Request('https://ralph.example/api/coach/trial', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Origin: 'https://ralph.example',
			...(cookie ? { Cookie: cookie } : {}),
		},
		body: JSON.stringify(body),
	})
}

function cookiePair(response: Response) {
	return response.headers.get('set-cookie')?.split(';')[0] || ''
}

function generatedCoach() {
	return {
		coach: {
			message: 'What do your point count and four-card major suggest you should investigate?',
			concept: 'Responding to 1NT',
			certainty: 'known' as const,
			factsUsed: ['South has 12 HCP.', 'South has four spades.'],
			suggestedChecks: ['Is Stayman available?'],
		},
		usage: { inputTokens: 200, outputTokens: 50, estimatedUsd: 0.0005 },
	}
}

test('trial cookie is signed, tamper-evident, and hardened', () => {
	assert.equal(validTrialSecret(SECRET), true)
	const id = 'A'.repeat(32)
	const token = createTrialToken(SECRET, id)
	assert.equal(verifyTrialToken(token, SECRET), id)
	const tamperedFinalCharacter = token.endsWith('A') ? 'B' : 'A'
	assert.equal(verifyTrialToken(`${token.slice(0, -1)}${tamperedFinalCharacter}`, SECRET), null)
	assert.equal(verifyTrialToken(token, `${SECRET}-different`), null)

	const cookie = serializeTrialCookie(token)
	assert.match(cookie, new RegExp(`^${COACH_TRIAL_COOKIE}=`))
	assert.match(cookie, /; Path=\//)
	assert.match(cookie, /; HttpOnly/)
	assert.match(cookie, /; Secure/)
	assert.match(cookie, /; SameSite=Lax/)
	assert.doesNotMatch(cookie, /Domain=/)
})

test('trial handler fails closed and rejects unsafe request shapes without generation', async () => {
	let calls = 0
	const generate = async () => {
		calls += 1
		return generatedCoach()
	}
	const disabled = createCoachTrialHandler({
		env: env({ COACH_TRIAL_ENABLED: 'false' }),
		store: new MemoryTrialStore(),
		verifyOrigin: sameOrigin,
		generate,
	})
	assert.equal((await disabled(post(validRequest()))).status, 503)

	const handler = createCoachTrialHandler({
		env: env(),
		store: new MemoryTrialStore(),
		verifyOrigin: sameOrigin,
		generate,
		createTrialId: () => 'B'.repeat(32),
	})
	assert.equal((await handler(post({ ...validRequest(), intent: 'explain' }))).status, 400)
	assert.equal(
		(await handler(post({ ...validRequest(), question: 'Which card should I play?' }))).status,
		400,
	)
	assert.equal(
		(
			await handler(
				new Request('https://ralph.example/api/coach/trial', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
					body: JSON.stringify(validRequest()),
				}),
			)
		).status,
		403,
	)
	assert.equal(calls, 0)
})

test('one real nudge is atomically consumed and an identical retry is served from the ledger', async () => {
	const store = new MemoryTrialStore()
	let calls = 0
	const handler = createCoachTrialHandler({
		env: env(),
		store,
		verifyOrigin: sameOrigin,
		generate: async () => {
			calls += 1
			return generatedCoach()
		},
		now: () => new Date('2026-08-07T10:00:00.000Z'),
		createTrialId: () => 'C'.repeat(32),
	})

	const handshake = await handler(post(validRequest()))
	assert.equal(handshake.status, 428)
	assert.equal((await handshake.json()).code, 'trial_cookie_required')
	assert.equal(calls, 0)
	const cookie = cookiePair(handshake)
	assert.match(cookie, new RegExp(`^${COACH_TRIAL_COOKIE}=`))

	const first = await handler(post(validRequest(), cookie))
	assert.equal(first.status, 200)
	const firstPayload = await first.json()
	assert.equal(firstPayload.meta.trial, true)
	assert.equal(firstPayload.meta.accessRequired, true)

	const retry = await handler(post(validRequest(), cookie))
	assert.equal(retry.status, 200)
	assert.equal((await retry.json()).meta.cached, true)
	assert.equal(calls, 1)

	const differentPosition = await handler(post(validRequest('8'), cookie))
	assert.equal(differentPosition.status, 409)
	const used = await differentPosition.json()
	assert.equal(used.code, 'trial_used')
	assert.equal(used.accessRequired, true)
	assert.equal(calls, 1)
})

test('parallel cookie-less handshakes cost nothing and a shared cookie starts at most one generation', async () => {
	const store = new MemoryTrialStore()
	let calls = 0
	let nextId = 0
	let releaseGeneration: (() => void) | undefined
	const generationGate = new Promise<void>((resolve) => {
		releaseGeneration = resolve
	})
	const handler = createCoachTrialHandler({
		env: env(),
		store,
		verifyOrigin: sameOrigin,
		generate: async () => {
			calls += 1
			await generationGate
			return generatedCoach()
		},
		now: () => new Date('2026-08-07T10:00:00.000Z'),
		createTrialId: () => ['D'.repeat(32), 'E'.repeat(32)][nextId++],
	})

	const handshakes = await Promise.all([
		handler(post(validRequest())),
		handler(post(validRequest())),
	])
	assert.deepEqual(
		handshakes.map((response) => response.status),
		[428, 428],
	)
	assert.deepEqual(
		await Promise.all(handshakes.map(async (response) => (await response.clone().json()).code)),
		['trial_cookie_required', 'trial_cookie_required'],
	)
	assert.equal(calls, 0)
	const cookie = cookiePair(handshakes[0])
	assert.match(cookie, new RegExp(`^${COACH_TRIAL_COOKIE}=`))

	const firstPromise = handler(post(validRequest(), cookie))
	const secondPromise = handler(post(validRequest(), cookie))
	await new Promise((resolve) => setTimeout(resolve, 0))
	assert.equal(calls, 1)
	releaseGeneration?.()
	const responses = await Promise.all([firstPromise, secondPromise])
	assert.deepEqual(
		responses.map((response) => response.status).sort(),
		[200, 409],
	)
})

test('durable daily cap bounds distinct anonymous browsers without consuming the blocked browser', async () => {
	const store = new MemoryTrialStore()
	let calls = 0
	let nextId = 0
	const ids = ['E'.repeat(32), 'F'.repeat(32), 'G'.repeat(32)]
	const handler = createCoachTrialHandler({
		env: env({ COACH_TRIAL_DAILY_CAP: '1' }),
		store,
		verifyOrigin: sameOrigin,
		generate: async () => {
			calls += 1
			return generatedCoach()
		},
		now: () => new Date('2026-08-07T10:00:00.000Z'),
		createTrialId: () => ids[nextId++],
	})

	const firstHandshake = await handler(post(validRequest()))
	assert.equal(firstHandshake.status, 428)
	assert.equal(
		(await handler(post(validRequest(), cookiePair(firstHandshake)))).status,
		200,
	)
	const cappedHandshake = await handler(post(validRequest('8')))
	assert.equal(cappedHandshake.status, 428)
	const capped = await handler(post(validRequest('8'), cookiePair(cappedHandshake)))
	assert.equal(capped.status, 429)
	const payload = await capped.json()
	assert.equal(payload.code, 'trial_daily_cap')
	assert.equal(payload.trialAvailable, true)
	const cappedCookie = cookiePair(capped)
	const access = createCoachAccessHandler({
		env: env({ COACH_TRIAL_DAILY_CAP: '1' }),
		store,
		identityUser: async () => null,
	})
	const stillAvailable = await access(
		new Request('https://ralph.example/api/coach/access', { headers: { Cookie: cappedCookie } }),
	)
	assert.equal((await stillAvailable.json()).access, 'trial')
	assert.equal(calls, 1)
})

test('a failed upstream attempt remains consumed to avoid accidental duplicate spend', async () => {
	const store = new MemoryTrialStore()
	const handler = createCoachTrialHandler({
		env: env(),
		store,
		verifyOrigin: sameOrigin,
		generate: async () => {
			throw new Error('stubbed upstream failure')
		},
		createTrialId: () => 'H'.repeat(32),
	})

	const handshake = await handler(post(validRequest()))
	assert.equal(handshake.status, 428)
	const cookie = cookiePair(handshake)
	const failed = await handler(post(validRequest(), cookie))
	assert.equal(failed.status, 502)
	const retry = await handler(post(validRequest(), cookie))
	assert.equal(retry.status, 409)
	assert.equal((await retry.json()).code, 'trial_used')
})

test('a persistent completion CAS failure is reported and reconciled out of reserved state', async () => {
	const store = new MemoryTrialStore()
	store.completionUpdateFailures = Number.POSITIVE_INFINITY
	let calls = 0
	const handler = createCoachTrialHandler({
		env: env(),
		store,
		verifyOrigin: sameOrigin,
		generate: async () => {
			calls += 1
			return generatedCoach()
		},
		createTrialId: () => 'J'.repeat(32),
	})

	const handshake = await handler(post(validRequest()))
	assert.equal(handshake.status, 428)
	const cookie = cookiePair(handshake)
	const failedCompletion = await handler(post(validRequest(), cookie))
	assert.equal(failedCompletion.status, 503)
	const failedPayload = await failedCompletion.json()
	assert.equal(failedPayload.code, 'trial_completion_failed')
	assert.equal(failedPayload.trialUsed, true)

	const retry = await handler(post(validRequest(), cookie))
	assert.equal(retry.status, 409)
	assert.equal((await retry.json()).code, 'trial_used')
	assert.equal(calls, 1)
})

test('access endpoint reports anonymous trial state without weakening owner authorization', async () => {
	const store = new MemoryTrialStore()
	const access = createCoachAccessHandler({ env: env(), store, identityUser: async () => null })
	const before = await access(new Request('https://ralph.example/api/coach/access'))
	assert.equal(before.status, 200)
	assert.equal((await before.json()).access, 'trial')

	const trial = createCoachTrialHandler({
		env: env(),
		store,
		verifyOrigin: sameOrigin,
		generate: async () => generatedCoach(),
		createTrialId: () => 'I'.repeat(32),
	})
	const handshake = await trial(post(validRequest()))
	assert.equal(handshake.status, 428)
	const cookie = cookiePair(handshake)
	const used = await trial(post(validRequest(), cookie))
	assert.equal(used.status, 200)
	const after = await access(
		new Request('https://ralph.example/api/coach/access', { headers: { Cookie: cookie } }),
	)
	const payload = await after.json()
	assert.equal(payload.access, 'access-required')
	assert.equal(payload.trial.status, 'used')

	const owner: User = {
		id: 'owner-id',
		email: 'owner@example.com',
		roles: ['coach-owner'],
	}
	const ownerAccess = createCoachAccessHandler({
		env: env({ COACH_OWNER_EMAIL: 'owner@example.com' }),
		store,
		identityUser: async () => owner,
	})
	const ownerPayload = await (
		await ownerAccess(new Request('https://ralph.example/api/coach/access'))
	).json()
	assert.equal(ownerPayload.access, 'owner')
	assert.equal(ownerPayload.owner, true)
	assert.equal(ownerPayload.trial.status, 'not-needed')
})
