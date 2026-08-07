import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { getStore, type Store } from '@netlify/blobs'

import type { CoachOutput } from './coach-core.mts'
import type { CoachUsageSummary } from './coach-generation.mts'

export const COACH_TRIAL_COOKIE = '__Host-ralph-coach-trial'
export const COACH_TRIAL_STORE = 'ralph-coach-trials'
export const COACH_TRIAL_COOKIE_MAX_AGE_SECONDS = 31_536_000
export const DEFAULT_COACH_TRIAL_DAILY_CAP = 20
export const MAX_COACH_TRIAL_DAILY_CAP = 250

export type TrialRecord = {
	version: 1
	status: 'reserved' | 'completed' | 'failed'
	fingerprint: string
	reservedAt: string
	completedAt?: string
	coach?: CoachOutput
	usage?: CoachUsageSummary
}

type DailyRecord = {
	version: 1
	day: string
	count: number
	updatedAt: string
}

export type AtomicEntry<T> = { data: T; etag: string }
export type AtomicWrite = { modified: boolean; etag?: string }

export interface CoachTrialStore {
	get<T>(key: string): Promise<AtomicEntry<T> | null>
	create(key: string, data: unknown): Promise<AtomicWrite>
	update(key: string, data: unknown, etag: string): Promise<AtomicWrite>
	delete(key: string): Promise<void>
}

export class CoachTrialLedgerError extends Error {
	constructor(message = 'The trial ledger is temporarily unavailable.') {
		super(message)
		this.name = 'CoachTrialLedgerError'
	}
}

function blobStoreAdapter(store: Store): CoachTrialStore {
	return {
		async get<T>(key: string) {
			const result = await store.getWithMetadata(key, { type: 'json' })
			if (!result) return null
			if (!result.etag) throw new CoachTrialLedgerError()
			return { data: result.data as T, etag: result.etag }
		},
		create(key, data) {
			return store.setJSON(key, data, { onlyIfNew: true })
		},
		update(key, data, etag) {
			return store.setJSON(key, data, { onlyIfMatch: etag })
		},
		delete(key) {
			return store.delete(key)
		},
	}
}

export function createBlobsCoachTrialStore() {
	return blobStoreAdapter(
		getStore({
			name: COACH_TRIAL_STORE,
			consistency: 'strong',
		}),
	)
}

export function validTrialSecret(secret: string | undefined): secret is string {
	return typeof secret === 'string' && secret.length >= 32
}

export function parseTrialDailyCap(value: string | undefined) {
	const trimmed = value?.trim()
	const dailyCap = trimmed === undefined || trimmed === '' ? DEFAULT_COACH_TRIAL_DAILY_CAP : Number(trimmed)
	return Number.isInteger(dailyCap) && dailyCap >= 1 && dailyCap <= MAX_COACH_TRIAL_DAILY_CAP
		? dailyCap
		: null
}

function trialSignature(payload: string, secret: string) {
	return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createTrialToken(
	secret: string,
	id = randomBytes(24).toString('base64url'),
) {
	if (!validTrialSecret(secret)) throw new Error('COACH_TRIAL_SECRET must contain at least 32 characters.')
	if (!/^[A-Za-z0-9_-]{32}$/.test(id)) throw new Error('Trial identifier is invalid.')
	const payload = `v1.${id}`
	return `${payload}.${trialSignature(payload, secret)}`
}

export function verifyTrialToken(token: string | undefined, secret: string) {
	if (!token || !validTrialSecret(secret)) return null
	const match = token.match(/^v1\.([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})$/)
	if (!match) return null
	const payload = `v1.${match[1]}`
	const supplied = Buffer.from(match[2], 'base64url')
	const expected = Buffer.from(trialSignature(payload, secret), 'base64url')
	if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
	return match[1]
}

export function readCookieValue(cookieHeader: string | null, name: string) {
	if (!cookieHeader) return undefined
	for (const part of cookieHeader.split(';')) {
		const separator = part.indexOf('=')
		if (separator < 0 || part.slice(0, separator).trim() !== name) continue
		return part.slice(separator + 1).trim()
	}
	return undefined
}

export function serializeTrialCookie(token: string) {
	return `${COACH_TRIAL_COOKIE}=${token}; Path=/; Max-Age=${COACH_TRIAL_COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`
}

export function trialSubjectHash(trialId: string) {
	return createHash('sha256').update(trialId).digest('hex')
}

function trialKey(subjectHash: string) {
	return `trial/v1/${subjectHash}`
}

function dailyKey(day: string) {
	return `daily/v1/${day}`
}

export function utcDay(now: Date) {
	return now.toISOString().slice(0, 10)
}

export function secondsUntilNextUtcDay(now: Date) {
	const next = new Date(`${utcDay(new Date(now.getTime() + 86_400_000))}T00:00:00.000Z`)
	return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000))
}

function isTrialRecord(value: unknown): value is TrialRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false
	const record = value as Partial<TrialRecord>
	return (
		record.version === 1 &&
		['reserved', 'completed', 'failed'].includes(String(record.status)) &&
		typeof record.fingerprint === 'string' &&
		typeof record.reservedAt === 'string'
	)
}

async function consumeDailySlot(
	store: CoachTrialStore,
	day: string,
	dailyCap: number,
	nowIso: string,
) {
	const key = dailyKey(day)
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const current = await store.get<DailyRecord>(key)
		if (!current) {
			const created = await store.create(key, {
				version: 1,
				day,
				count: 1,
				updatedAt: nowIso,
			} satisfies DailyRecord)
			if (created.modified) return { allowed: true, count: 1 }
			continue
		}

		const count = Number(current.data?.count)
		if (
			current.data?.version !== 1 ||
			current.data?.day !== day ||
			!Number.isInteger(count) ||
			count < 0
		) {
			throw new CoachTrialLedgerError('The daily trial counter is invalid.')
		}
		if (count >= dailyCap) return { allowed: false, count }

		const updated = await store.update(
			key,
			{ ...current.data, count: count + 1, updatedAt: nowIso } satisfies DailyRecord,
			current.etag,
		)
		if (updated.modified) return { allowed: true, count: count + 1 }
	}
	throw new CoachTrialLedgerError('The daily trial counter is busy.')
}

type ReserveTrialResult =
	| { kind: 'reserved'; entry: AtomicEntry<TrialRecord>; dailyCount: number }
	| { kind: 'cached'; record: TrialRecord }
	| { kind: 'used'; status: TrialRecord['status'] | 'invalid' }
	| { kind: 'daily-cap'; dailyCount: number }

function existingTrialResult(
	entry: AtomicEntry<TrialRecord> | null,
	fingerprint: string,
): Exclude<ReserveTrialResult, { kind: 'reserved' } | { kind: 'daily-cap' }> | null {
	if (!entry) return null
	if (!isTrialRecord(entry.data)) return { kind: 'used', status: 'invalid' }
	if (entry.data.status === 'completed' && entry.data.fingerprint === fingerprint && entry.data.coach) {
		return { kind: 'cached', record: entry.data }
	}
	return { kind: 'used', status: entry.data.status }
}

export async function reserveAnonymousTrial({
	store,
	subjectHash,
	fingerprint,
	dailyCap,
	now,
}: {
	store: CoachTrialStore
	subjectHash: string
	fingerprint: string
	dailyCap: number
	now: Date
}): Promise<ReserveTrialResult> {
	const key = trialKey(subjectHash)
	const existing = existingTrialResult(await store.get<TrialRecord>(key), fingerprint)
	if (existing) return existing

	const record: TrialRecord = {
		version: 1,
		status: 'reserved',
		fingerprint,
		reservedAt: now.toISOString(),
	}
	const created = await store.create(key, record)
	if (!created.modified || !created.etag) {
		const raced = existingTrialResult(await store.get<TrialRecord>(key), fingerprint)
		return raced || { kind: 'used', status: 'invalid' }
	}

	try {
		const daily = await consumeDailySlot(store, utcDay(now), dailyCap, now.toISOString())
		if (!daily.allowed) {
			await store.delete(key)
			return { kind: 'daily-cap', dailyCount: daily.count }
		}
		return { kind: 'reserved', entry: { data: record, etag: created.etag }, dailyCount: daily.count }
	} catch (error) {
		try {
			await store.delete(key)
		} catch {
			// A remaining reservation fails closed and prevents accidental duplicate spend.
		}
		throw error
	}
}

export async function completeAnonymousTrial({
	store,
	subjectHash,
	reservation,
	coach,
	usage,
	now,
}: {
	store: CoachTrialStore
	subjectHash: string
	reservation: AtomicEntry<TrialRecord>
	coach: CoachOutput
	usage?: CoachUsageSummary
	now: Date
}) {
	const key = trialKey(subjectHash)
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const current = attempt === 0 ? reservation : await store.get<TrialRecord>(key)
		if (
			!current ||
			!isTrialRecord(current.data) ||
			current.data.fingerprint !== reservation.data.fingerprint ||
			current.data.reservedAt !== reservation.data.reservedAt
		) {
			return { modified: false } satisfies AtomicWrite
		}
		if (current.data.status === 'completed') {
			return { modified: true, etag: current.etag } satisfies AtomicWrite
		}
		if (current.data.status !== 'reserved') {
			return { modified: false } satisfies AtomicWrite
		}

		const record: TrialRecord = {
			...current.data,
			status: 'completed',
			completedAt: now.toISOString(),
			coach,
			...(usage ? { usage } : {}),
		}
		const completed = await store.update(key, record, current.etag)
		if (completed.modified) return completed
	}
	return { modified: false } satisfies AtomicWrite
}

export async function failAnonymousTrial({
	store,
	subjectHash,
	reservation,
	now,
}: {
	store: CoachTrialStore
	subjectHash: string
	reservation: AtomicEntry<TrialRecord>
	now: Date
}) {
	const key = trialKey(subjectHash)
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const current = attempt === 0 ? reservation : await store.get<TrialRecord>(key)
		if (
			!current ||
			!isTrialRecord(current.data) ||
			current.data.fingerprint !== reservation.data.fingerprint ||
			current.data.reservedAt !== reservation.data.reservedAt
		) {
			return { modified: false } satisfies AtomicWrite
		}
		if (current.data.status === 'failed') {
			return { modified: true, etag: current.etag } satisfies AtomicWrite
		}
		if (current.data.status !== 'reserved') {
			return { modified: false } satisfies AtomicWrite
		}

		const failed = await store.update(
			key,
			{ ...current.data, status: 'failed', completedAt: now.toISOString() } satisfies TrialRecord,
			current.etag,
		)
		if (failed.modified) return failed
	}
	return { modified: false } satisfies AtomicWrite
}

export async function getAnonymousTrialStatus(store: CoachTrialStore, subjectHash: string) {
	const entry = await store.get<TrialRecord>(trialKey(subjectHash))
	if (!entry) return 'available' as const
	if (!isTrialRecord(entry.data)) return 'used' as const
	return entry.data.status === 'reserved' ? ('in-progress' as const) : ('used' as const)
}
