import { createHash, randomUUID } from 'node:crypto'

import { getStore, type Store } from '@netlify/blobs'

import type { CoachOutput } from './coach-core.mts'
import type { CoachUsageSummary as CoachGenerationUsageSummary } from './coach-generation.mts'

export const COACH_SUBSCRIBER_ROLE = 'coach-subscriber'
export const COACH_ENTITLEMENT_STORE = 'ralph-coach-access'
export const COACH_DEAL_LIMIT = 100
// The persisted entitlement field retains its original name for compatibility,
// but the limit is enforced at paid provider dispatch rather than only on success.
export const COACH_RESPONSES_PER_DEAL_LIMIT = 20
export const COACH_PAID_ATTEMPT_LIMIT = COACH_DEAL_LIMIT * COACH_RESPONSES_PER_DEAL_LIMIT
export const COACH_USAGE_RESERVATION_TTL_MS = 5 * 60 * 1000
export const COACH_OWNER_HOURLY_ATTEMPT_LIMIT = 80
export const COACH_OWNER_PERIOD_ATTEMPT_LIMIT = COACH_PAID_ATTEMPT_LIMIT

const COACH_OWNER_HOURLY_WINDOW_MS = 60 * 60 * 1000

export type CoachIdentityUser = {
	id: string
	email?: string
	confirmedAt?: string
	roles?: string[]
	appMetadata?: Record<string, unknown>
}

export type CoachEntitlement = {
	version: 1
	userId: string
	email: string
	status: 'active' | 'revoked'
	plan: 'coach-100'
	periodId: string
	periodStart: string
	periodEnd: string
	dealLimit: typeof COACH_DEAL_LIMIT
	responsesPerDealLimit: typeof COACH_RESPONSES_PER_DEAL_LIMIT
	grantedAt: string
	grantedBy: string
	updatedAt: string
	note?: string
	revokedAt?: string
	revokedBy?: string
}

type CoachUsageRequest = {
	status: 'reserved' | 'dispatched' | 'completed' | 'failed'
	attemptId: string
	reservedAt: string
	dispatchedAt?: string
	completedAt?: string
	failedAt?: string
	coach?: CoachOutput
	usage?: CoachGenerationUsageSummary
}

type CoachUsageDeal = {
	paidAttempts: number
	successfulResponses: number
	requests: Record<string, CoachUsageRequest>
}

export type CoachPeriodUsage = {
	version: 1
	userId: string
	periodId: string
	periodStart: string
	periodEnd: string
	paidAttempts: number
	successfulResponses: number
	deals: Record<string, CoachUsageDeal>
	updatedAt: string
}

export type CoachEntitlementUsageSummary = {
	dealsUsed: number
	dealLimit: typeof COACH_DEAL_LIMIT
	dealsRemaining: number
	responsesPerDealLimit: typeof COACH_RESPONSES_PER_DEAL_LIMIT
	paidAttempts: number
	paidAttemptLimit: typeof COACH_PAID_ATTEMPT_LIMIT
	paidAttemptsRemaining: number
	successfulResponses: number
	periodEnd: string
}

export type CoachOwnerUsageSummary = {
	periodId: string
	periodStart: string
	periodEnd: string
	paidAttempts: number
	paidAttemptLimit: typeof COACH_OWNER_PERIOD_ATTEMPT_LIMIT
	paidAttemptsRemaining: number
	hourlyAttempts: number
	hourlyAttemptLimit: typeof COACH_OWNER_HOURLY_ATTEMPT_LIMIT
}

type CoachOwnerUsage = {
	version: 1
	userId: string
	periodId: string
	periodStart: string
	periodEnd: string
	paidAttempts: number
	recentAttemptTimestamps: string[]
	updatedAt: string
}

export type AtomicEntry<T> = { data: T; etag: string }
export type AtomicWrite = { modified: boolean; etag?: string }

export interface CoachAccessStore {
	get<T>(key: string): Promise<AtomicEntry<T> | null>
	create(key: string, data: unknown): Promise<AtomicWrite>
	update(key: string, data: unknown, etag: string): Promise<AtomicWrite>
	list(prefix: string): Promise<string[]>
}

export class CoachEntitlementLedgerError extends Error {
	constructor(message = 'Coach entitlement records are temporarily unavailable.') {
		super(message)
		this.name = 'CoachEntitlementLedgerError'
	}
}

export class CoachUsageLedgerError extends Error {
	constructor(message = 'Coach usage records are temporarily unavailable.') {
		super(message)
		this.name = 'CoachUsageLedgerError'
	}
}

export class CoachOwnerUsageLimitError extends Error {
	kind: 'hour' | 'period'
	retryAfterSeconds: number

	constructor(kind: 'hour' | 'period', retryAfterSeconds: number) {
		super(kind === 'hour' ? 'The owner hourly Coach limit has been reached.' : 'The owner period Coach limit has been reached.')
		this.name = 'CoachOwnerUsageLimitError'
		this.kind = kind
		this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds))
	}
}

function blobStoreAdapter(store: Store): CoachAccessStore {
	return {
		async get<T>(key: string) {
			const result = await store.getWithMetadata(key, { type: 'json' })
			if (!result) return null
			if (!result.etag) throw new CoachEntitlementLedgerError()
			return { data: result.data as T, etag: result.etag }
		},
		create(key, data) {
			return store.setJSON(key, data, { onlyIfNew: true })
		},
		update(key, data, etag) {
			return store.setJSON(key, data, { onlyIfMatch: etag })
		},
		async list(prefix) {
			const keys: string[] = []
			for await (const page of store.list({ prefix, paginate: true })) {
				keys.push(...page.blobs.map((blob) => blob.key))
			}
			return keys
		},
	}
}

export function createBlobsCoachAccessStore() {
	return blobStoreAdapter(
		getStore({
			name: COACH_ENTITLEMENT_STORE,
			consistency: 'strong',
		}),
	)
}

function identityRoles(user: CoachIdentityUser | null) {
	const appMetadataRoles = Array.isArray(user?.appMetadata?.roles)
		? user.appMetadata.roles.filter((role): role is string => typeof role === 'string')
		: []
	return new Set([...(user?.roles || []), ...appMetadataRoles])
}

export function hasCoachIdentitySubject(user: CoachIdentityUser | null): user is CoachIdentityUser {
	return typeof user?.id === 'string' && !!user.id.trim()
}

export function isCoachSubscriber(user: CoachIdentityUser | null) {
	// Subscriber confirmation is checked against the full admin user before an
	// entitlement is granted. At request time getUser() may return a verified
	// JWT fallback without confirmedAt, so use the stable subject plus the
	// server-managed role and let the caller require the durable entitlement.
	return hasCoachIdentitySubject(user) && identityRoles(user).has(COACH_SUBSCRIBER_ROLE)
}

export function coachUserSubjectHash(userId: string) {
	return createHash('sha256').update(userId).digest('hex')
}

function entitlementKey(userId: string) {
	return `entitlement/v1/${coachUserSubjectHash(userId)}`
}

function usageKey(userId: string, periodId: string) {
	return `usage/v1/${coachUserSubjectHash(userId)}/${periodId}`
}

function periodIdFor(userId: string, periodStart: string, periodEnd: string) {
	return createHash('sha256')
		.update(userId)
		.update('\0')
		.update(periodStart)
		.update('\0')
		.update(periodEnd)
		.digest('hex')
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isIsoTimestamp(value: unknown): value is string {
	return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isCoachEntitlement(value: unknown): value is CoachEntitlement {
	if (!isRecord(value)) return false
	return (
		value.version === 1 &&
		typeof value.userId === 'string' &&
		typeof value.email === 'string' &&
		(value.status === 'active' || value.status === 'revoked') &&
		value.plan === 'coach-100' &&
		typeof value.periodId === 'string' &&
		isIsoTimestamp(value.periodStart) &&
		isIsoTimestamp(value.periodEnd) &&
		value.dealLimit === COACH_DEAL_LIMIT &&
		value.responsesPerDealLimit === COACH_RESPONSES_PER_DEAL_LIMIT &&
		isIsoTimestamp(value.grantedAt) &&
		typeof value.grantedBy === 'string' &&
		isIsoTimestamp(value.updatedAt)
	)
}

function assertEntitlement(value: unknown, expectedUserId?: string) {
	if (!isCoachEntitlement(value) || (expectedUserId && value.userId !== expectedUserId)) {
		throw new CoachEntitlementLedgerError('A Coach entitlement record is invalid.')
	}
	return value
}

export function entitlementIsActive(
	entitlement: CoachEntitlement | null,
	userId: string,
	now = new Date(),
) {
	if (!entitlement || entitlement.userId !== userId || entitlement.status !== 'active') return false
	const timestamp = now.getTime()
	return timestamp >= Date.parse(entitlement.periodStart) && timestamp < Date.parse(entitlement.periodEnd)
}

export async function getCoachEntitlement(store: CoachAccessStore, userId: string) {
	const entry = await store.get<CoachEntitlement>(entitlementKey(userId))
	return entry ? assertEntitlement(entry.data, userId) : null
}

export async function getActiveCoachEntitlement(
	store: CoachAccessStore,
	userId: string,
	now = new Date(),
) {
	const entitlement = await getCoachEntitlement(store, userId)
	return entitlementIsActive(entitlement, userId, now) ? entitlement : null
}

export async function grantCoachEntitlement({
	store,
	userId,
	email,
	periodStart,
	periodEnd,
	grantedBy,
	note,
	now = new Date(),
}: {
	store: CoachAccessStore
	userId: string
	email: string
	periodStart: string
	periodEnd: string
	grantedBy: string
	note?: string
	now?: Date
}) {
	const normalizedStart = new Date(periodStart).toISOString()
	const normalizedEnd = new Date(periodEnd).toISOString()
	if (Date.parse(normalizedEnd) <= Date.parse(normalizedStart)) {
		throw new CoachEntitlementLedgerError('The entitlement period is invalid.')
	}
	const key = entitlementKey(userId)
	const periodId = periodIdFor(userId, normalizedStart, normalizedEnd)
	const nowIso = now.toISOString()

	for (let attempt = 0; attempt < 16; attempt += 1) {
		const current = await store.get<CoachEntitlement>(key)
		if (current) {
			const existing = assertEntitlement(current.data, userId)
			if (existing.status === 'active' && existing.periodId === periodId) return existing
		}
		const record: CoachEntitlement = {
			version: 1,
			userId,
			email: email.trim().toLowerCase(),
			status: 'active',
			plan: 'coach-100',
			periodId,
			periodStart: normalizedStart,
			periodEnd: normalizedEnd,
			dealLimit: COACH_DEAL_LIMIT,
			responsesPerDealLimit: COACH_RESPONSES_PER_DEAL_LIMIT,
			grantedAt: nowIso,
			grantedBy,
			updatedAt: nowIso,
			...(note ? { note } : {}),
		}
		const written = current
			? await store.update(key, record, current.etag)
			: await store.create(key, record)
		if (written.modified) return record
	}
	throw new CoachEntitlementLedgerError('The Coach entitlement record is busy.')
}

export async function revokeCoachEntitlement({
	store,
	userId,
	revokedBy,
	note,
	now = new Date(),
}: {
	store: CoachAccessStore
	userId: string
	revokedBy: string
	note?: string
	now?: Date
}) {
	const key = entitlementKey(userId)
	const nowIso = now.toISOString()
	for (let attempt = 0; attempt < 16; attempt += 1) {
		const current = await store.get<CoachEntitlement>(key)
		if (!current) return null
		const existing = assertEntitlement(current.data, userId)
		if (existing.status === 'revoked') return existing
		const record: CoachEntitlement = {
			...existing,
			status: 'revoked',
			updatedAt: nowIso,
			revokedAt: nowIso,
			revokedBy,
			...(note ? { note } : {}),
		}
		const written = await store.update(key, record, current.etag)
		if (written.modified) return record
	}
	throw new CoachEntitlementLedgerError('The Coach entitlement record is busy.')
}

export async function listCoachEntitlements(store: CoachAccessStore) {
	const keys = await store.list('entitlement/v1/')
	const records = await Promise.all(
		keys.map(async (key) => {
			const entry = await store.get<CoachEntitlement>(key)
			return entry ? assertEntitlement(entry.data) : null
		}),
	)
	return records
		.filter((record): record is CoachEntitlement => !!record)
		.sort((left, right) => left.email.localeCompare(right.email))
}

function nonnegativeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function usageAttemptId(value: unknown, requestFingerprint: string) {
	if (typeof value === 'string' && value.length >= 8 && value.length <= 128) return value
	return `legacy-${requestFingerprint}`
}

function normalizeCoachUsageRequest(value: unknown, requestFingerprint: string): CoachUsageRequest {
	if (
		!isRecord(value) ||
		!['reserved', 'dispatched', 'completed', 'failed'].includes(String(value.status)) ||
		!isIsoTimestamp(value.reservedAt)
	) {
		throw new CoachUsageLedgerError('A Coach request usage record is invalid.')
	}
	const attemptId = usageAttemptId(value.attemptId, requestFingerprint)
	if (value.status === 'reserved') {
		return { status: 'reserved', attemptId, reservedAt: value.reservedAt }
	}
	const dispatchedAt = isIsoTimestamp(value.dispatchedAt)
		? value.dispatchedAt
		: isIsoTimestamp(value.completedAt)
			? value.completedAt
			: isIsoTimestamp(value.failedAt)
				? value.failedAt
				: null
	if (!dispatchedAt) throw new CoachUsageLedgerError('A dispatched Coach attempt is invalid.')
	if (value.status === 'dispatched') {
		return { status: 'dispatched', attemptId, reservedAt: value.reservedAt, dispatchedAt }
	}
	if (value.status === 'failed') {
		if (!isIsoTimestamp(value.failedAt)) throw new CoachUsageLedgerError('A failed Coach attempt is invalid.')
		return {
			status: 'failed',
			attemptId,
			reservedAt: value.reservedAt,
			dispatchedAt,
			failedAt: value.failedAt,
		}
	}
	if (!isIsoTimestamp(value.completedAt) || !isRecord(value.coach)) {
		throw new CoachUsageLedgerError('A completed Coach attempt is invalid.')
	}
	return {
		status: 'completed',
		attemptId,
		reservedAt: value.reservedAt,
		dispatchedAt,
		completedAt: value.completedAt,
		coach: value.coach as CoachOutput,
		...(isRecord(value.usage) ? { usage: value.usage as CoachGenerationUsageSummary } : {}),
	}
}

function assertUsageRecord(value: unknown, entitlement: CoachEntitlement) {
	if (
		!isRecord(value) ||
		value.version !== 1 ||
		value.userId !== entitlement.userId ||
		value.periodId !== entitlement.periodId ||
		value.periodStart !== entitlement.periodStart ||
		value.periodEnd !== entitlement.periodEnd ||
		!isRecord(value.deals) ||
		!isIsoTimestamp(value.updatedAt)
	) {
		throw new CoachUsageLedgerError('A Coach usage record is invalid.')
	}
	const deals: Record<string, CoachUsageDeal> = {}
	let derivedPaidAttempts = 0
	let derivedSuccessfulResponses = 0
	for (const [dealFingerprint, valueDeal] of Object.entries(value.deals)) {
		if (!/^[a-f0-9]{64}$/.test(dealFingerprint) || !isRecord(valueDeal) || !isRecord(valueDeal.requests)) {
			throw new CoachUsageLedgerError('A Coach deal usage record is invalid.')
		}
		const requests: Record<string, CoachUsageRequest> = {}
		for (const [requestFingerprint, request] of Object.entries(valueDeal.requests)) {
			if (!/^[a-f0-9]{64}$/.test(requestFingerprint)) {
				throw new CoachUsageLedgerError('A Coach request usage record is invalid.')
			}
			requests[requestFingerprint] = normalizeCoachUsageRequest(request, requestFingerprint)
		}
		const visiblePaidAttempts = Object.values(requests).filter(
			(request) => request.status !== 'reserved',
		).length
		const visibleSuccessfulResponses = Object.values(requests).filter(
			(request) => request.status === 'completed',
		).length
		const paidAttempts = nonnegativeInteger(valueDeal.paidAttempts)
			? valueDeal.paidAttempts
			: visiblePaidAttempts
		const successfulResponses = nonnegativeInteger(valueDeal.successfulResponses)
			? valueDeal.successfulResponses
			: visibleSuccessfulResponses
		if (paidAttempts < visiblePaidAttempts || successfulResponses < visibleSuccessfulResponses) {
			throw new CoachUsageLedgerError('A Coach deal usage counter is invalid.')
		}
		deals[dealFingerprint] = { paidAttempts, successfulResponses, requests }
		derivedPaidAttempts += paidAttempts
		derivedSuccessfulResponses += successfulResponses
	}
	const paidAttempts = nonnegativeInteger(value.paidAttempts) ? value.paidAttempts : derivedPaidAttempts
	const successfulResponses = nonnegativeInteger(value.successfulResponses)
		? value.successfulResponses
		: derivedSuccessfulResponses
	if (paidAttempts !== derivedPaidAttempts || successfulResponses !== derivedSuccessfulResponses) {
		throw new CoachUsageLedgerError('A Coach period usage counter is invalid.')
	}
	return {
		version: 1,
		userId: entitlement.userId,
		periodId: entitlement.periodId,
		periodStart: entitlement.periodStart,
		periodEnd: entitlement.periodEnd,
		paidAttempts,
		successfulResponses,
		deals,
		updatedAt: value.updatedAt,
	} satisfies CoachPeriodUsage
}

function emptyUsage(entitlement: CoachEntitlement, now: Date): CoachPeriodUsage {
	return {
		version: 1,
		userId: entitlement.userId,
		periodId: entitlement.periodId,
		periodStart: entitlement.periodStart,
		periodEnd: entitlement.periodEnd,
		paidAttempts: 0,
		successfulResponses: 0,
		deals: {},
		updatedAt: now.toISOString(),
	}
}

function pruneStaleReservations(record: CoachPeriodUsage, now: Date) {
	const next = structuredClone(record)
	const staleBefore = now.getTime() - COACH_USAGE_RESERVATION_TTL_MS
	for (const [dealFingerprint, deal] of Object.entries(next.deals)) {
		for (const [requestFingerprint, request] of Object.entries(deal.requests)) {
			if (request.status === 'reserved' && Date.parse(request.reservedAt) <= staleBefore) {
				delete deal.requests[requestFingerprint]
			} else if (
				request.status === 'dispatched' &&
				Date.parse(request.dispatchedAt || request.reservedAt) <= staleBefore
			) {
				deal.requests[requestFingerprint] = {
					...request,
					status: 'failed',
					failedAt: now.toISOString(),
				}
			}
		}
		if (deal.paidAttempts === 0 && !Object.keys(deal.requests).length) delete next.deals[dealFingerprint]
	}
	return next
}

function pendingReservationCount(deal: CoachUsageDeal) {
	return Object.values(deal.requests).filter((request) => request.status === 'reserved').length
}

function pendingPeriodReservationCount(record: CoachPeriodUsage) {
	return Object.values(record.deals).reduce((total, deal) => total + pendingReservationCount(deal), 0)
}

function occupiedDealCount(record: CoachPeriodUsage) {
	return Object.values(record.deals).filter(
		(deal) => deal.paidAttempts > 0 || Object.keys(deal.requests).length > 0,
	).length
}

function assertReservationMatches(reservation: CoachUsageReservation, entitlement: CoachEntitlement) {
	if (reservation.userId !== entitlement.userId || reservation.periodId !== entitlement.periodId) {
		throw new CoachUsageLedgerError('The Coach usage reservation does not match the entitlement.')
	}
}

export type CoachUsageReservation = {
	userId: string
	periodId: string
	dealFingerprint: string
	requestFingerprint: string
	attemptId: string
}

export type ReserveCoachUsageResult =
	| { kind: 'reserved'; reservation: CoachUsageReservation }
	| { kind: 'cached'; coach: CoachOutput; usage?: CoachGenerationUsageSummary }
	| { kind: 'in-progress'; retryAfterSeconds: number }
	| { kind: 'deal-limit' }
	| { kind: 'response-limit' }
	| { kind: 'attempt-limit' }

export async function reserveCoachUsage({
	store,
	entitlement,
	dealFingerprint,
	requestFingerprint,
	now = new Date(),
}: {
	store: CoachAccessStore
	entitlement: CoachEntitlement
	dealFingerprint: string
	requestFingerprint: string
	now?: Date
}): Promise<ReserveCoachUsageResult> {
	if (!/^[a-f0-9]{64}$/.test(dealFingerprint) || !/^[a-f0-9]{64}$/.test(requestFingerprint)) {
		throw new CoachUsageLedgerError('A Coach usage fingerprint is invalid.')
	}
	const key = usageKey(entitlement.userId, entitlement.periodId)
	const attemptId = randomUUID()
	for (let attempt = 0; attempt < 64; attempt += 1) {
		const current = await store.get<CoachPeriodUsage>(key)
		const record = current
			? pruneStaleReservations(assertUsageRecord(current.data, entitlement), now)
			: emptyUsage(entitlement, now)
		const deal = record.deals[dealFingerprint]
		const existing = deal?.requests[requestFingerprint]
		if (existing?.status === 'completed' && existing.coach) {
			return { kind: 'cached', coach: existing.coach, ...(existing.usage ? { usage: existing.usage } : {}) }
		}
		if (existing?.status === 'reserved' || existing?.status === 'dispatched') {
			const startedAt = existing.dispatchedAt || existing.reservedAt
			const ageSeconds = Math.max(0, (now.getTime() - Date.parse(startedAt)) / 1000)
			return {
				kind: 'in-progress',
				retryAfterSeconds: Math.max(1, Math.ceil(COACH_USAGE_RESERVATION_TTL_MS / 1000 - ageSeconds)),
			}
		}
		if (record.paidAttempts + pendingPeriodReservationCount(record) >= COACH_PAID_ATTEMPT_LIMIT) {
			return { kind: 'attempt-limit' }
		}
		if (!deal && occupiedDealCount(record) >= COACH_DEAL_LIMIT) return { kind: 'deal-limit' }
		if (
			deal &&
			deal.paidAttempts + pendingReservationCount(deal) >= COACH_RESPONSES_PER_DEAL_LIMIT
		) {
			return { kind: 'response-limit' }
		}

		const next = structuredClone(record)
		next.deals[dealFingerprint] ||= { paidAttempts: 0, successfulResponses: 0, requests: {} }
		next.deals[dealFingerprint].requests[requestFingerprint] = {
			status: 'reserved',
			attemptId,
			reservedAt: now.toISOString(),
		}
		next.updatedAt = now.toISOString()
		const written = current
			? await store.update(key, next, current.etag)
			: await store.create(key, next)
		if (written.modified) {
			return {
				kind: 'reserved',
				reservation: {
					userId: entitlement.userId,
					periodId: entitlement.periodId,
					dealFingerprint,
					requestFingerprint,
					attemptId,
				},
			}
		}
	}
	throw new CoachUsageLedgerError('The Coach usage record is busy.')
}

export async function markCoachUsageDispatched({
	store,
	entitlement,
	reservation,
	now = new Date(),
}: {
	store: CoachAccessStore
	entitlement: CoachEntitlement
	reservation: CoachUsageReservation
	now?: Date
}) {
	assertReservationMatches(reservation, entitlement)
	const key = usageKey(entitlement.userId, entitlement.periodId)
	for (let attempt = 0; attempt < 32; attempt += 1) {
		const current = await store.get<CoachPeriodUsage>(key)
		if (!current) throw new CoachUsageLedgerError('The Coach usage reservation is missing.')
		const record = assertUsageRecord(current.data, entitlement)
		const deal = record.deals[reservation.dealFingerprint]
		const request = deal?.requests[reservation.requestFingerprint]
		if (request?.status !== 'reserved' || request.attemptId !== reservation.attemptId) {
			throw new CoachUsageLedgerError('The Coach usage reservation is missing.')
		}
		if (
			record.paidAttempts >= COACH_PAID_ATTEMPT_LIMIT ||
			deal.paidAttempts >= COACH_RESPONSES_PER_DEAL_LIMIT
		) {
			throw new CoachUsageLedgerError('The Coach paid-attempt allowance is exhausted.')
		}
		const next = structuredClone(record)
		next.paidAttempts += 1
		next.deals[reservation.dealFingerprint].paidAttempts += 1
		next.deals[reservation.dealFingerprint].requests[reservation.requestFingerprint] = {
			...request,
			status: 'dispatched',
			dispatchedAt: now.toISOString(),
		}
		next.updatedAt = now.toISOString()
		const written = await store.update(key, next, current.etag)
		if (written.modified) {
			return next.deals[reservation.dealFingerprint].requests[reservation.requestFingerprint]
		}
	}
	throw new CoachUsageLedgerError('The Coach dispatch receipt is busy.')
}

export async function commitCoachUsage({
	store,
	entitlement,
	reservation,
	coach,
	usage,
	now = new Date(),
}: {
	store: CoachAccessStore
	entitlement: CoachEntitlement
	reservation: CoachUsageReservation
	coach: CoachOutput
	usage?: CoachGenerationUsageSummary
	now?: Date
}) {
	assertReservationMatches(reservation, entitlement)
	const key = usageKey(entitlement.userId, entitlement.periodId)
	for (let attempt = 0; attempt < 32; attempt += 1) {
		const current = await store.get<CoachPeriodUsage>(key)
		if (!current) throw new CoachUsageLedgerError('The Coach usage reservation is missing.')
		const record = assertUsageRecord(current.data, entitlement)
		const request = record.deals[reservation.dealFingerprint]?.requests[reservation.requestFingerprint]
		if (
			request?.status === 'completed' &&
			request.attemptId === reservation.attemptId &&
			request.coach
		) {
			return request
		}
		if (request?.status !== 'dispatched' || request.attemptId !== reservation.attemptId) {
			throw new CoachUsageLedgerError('The dispatched Coach attempt is missing.')
		}
		const next = structuredClone(record)
		next.successfulResponses += 1
		next.deals[reservation.dealFingerprint].successfulResponses += 1
		next.deals[reservation.dealFingerprint].requests[reservation.requestFingerprint] = {
			...request,
			status: 'completed',
			completedAt: now.toISOString(),
			coach,
			...(usage ? { usage } : {}),
		}
		next.updatedAt = now.toISOString()
		const written = await store.update(key, next, current.etag)
		if (written.modified) {
			return next.deals[reservation.dealFingerprint].requests[reservation.requestFingerprint]
		}
	}
	throw new CoachUsageLedgerError('The Coach usage completion is busy.')
}

export async function failCoachUsage({
	store,
	entitlement,
	reservation,
	now = new Date(),
}: {
	store: CoachAccessStore
	entitlement: CoachEntitlement
	reservation: CoachUsageReservation
	now?: Date
}) {
	assertReservationMatches(reservation, entitlement)
	const key = usageKey(entitlement.userId, entitlement.periodId)
	for (let attempt = 0; attempt < 32; attempt += 1) {
		const current = await store.get<CoachPeriodUsage>(key)
		if (!current) return { modified: false }
		const record = assertUsageRecord(current.data, entitlement)
		const request = record.deals[reservation.dealFingerprint]?.requests[reservation.requestFingerprint]
		if (!request || request.attemptId !== reservation.attemptId) return { modified: false }
		if (request.status === 'completed' || request.status === 'failed') return { modified: false }
		if (request.status !== 'dispatched') return { modified: false }
		const next = structuredClone(record)
		next.deals[reservation.dealFingerprint].requests[reservation.requestFingerprint] = {
			...request,
			status: 'failed',
			failedAt: now.toISOString(),
		}
		next.updatedAt = now.toISOString()
		const written = await store.update(key, next, current.etag)
		if (written.modified) return written
	}
	throw new CoachUsageLedgerError('The Coach failure receipt is busy.')
}

export async function releaseCoachUsage({
	store,
	entitlement,
	reservation,
	now = new Date(),
}: {
	store: CoachAccessStore
	entitlement: CoachEntitlement
	reservation: CoachUsageReservation
	now?: Date
}) {
	assertReservationMatches(reservation, entitlement)
	const key = usageKey(entitlement.userId, entitlement.periodId)
	for (let attempt = 0; attempt < 32; attempt += 1) {
		const current = await store.get<CoachPeriodUsage>(key)
		if (!current) return { modified: false }
		const record = assertUsageRecord(current.data, entitlement)
		const request = record.deals[reservation.dealFingerprint]?.requests[reservation.requestFingerprint]
		if (
			!request ||
			request.status !== 'reserved' ||
			request.attemptId !== reservation.attemptId
		) {
			return { modified: false }
		}
		const next = structuredClone(record)
		delete next.deals[reservation.dealFingerprint].requests[reservation.requestFingerprint]
		if (
			next.deals[reservation.dealFingerprint].paidAttempts === 0 &&
			!Object.keys(next.deals[reservation.dealFingerprint].requests).length
		) {
			delete next.deals[reservation.dealFingerprint]
		}
		next.updatedAt = now.toISOString()
		const written = await store.update(key, next, current.etag)
		if (written.modified) return written
	}
	throw new CoachUsageLedgerError('The Coach usage release is busy.')
}

export async function getCoachUsageSummary(
	store: CoachAccessStore,
	entitlement: CoachEntitlement,
) {
	const entry = await store.get<CoachPeriodUsage>(usageKey(entitlement.userId, entitlement.periodId))
	const record = entry ? assertUsageRecord(entry.data, entitlement) : null
	const dealsUsed = record
		? Object.values(record.deals).filter((deal) => deal.paidAttempts > 0).length
		: 0
	const paidAttempts = record?.paidAttempts || 0
	return {
		dealsUsed,
		dealLimit: COACH_DEAL_LIMIT,
		dealsRemaining: Math.max(0, COACH_DEAL_LIMIT - dealsUsed),
		responsesPerDealLimit: COACH_RESPONSES_PER_DEAL_LIMIT,
		paidAttempts,
		paidAttemptLimit: COACH_PAID_ATTEMPT_LIMIT,
		paidAttemptsRemaining: Math.max(0, COACH_PAID_ATTEMPT_LIMIT - paidAttempts),
		successfulResponses: record?.successfulResponses || 0,
		periodEnd: entitlement.periodEnd,
	} satisfies CoachEntitlementUsageSummary
}

function ownerUsageKey(userId: string) {
	return `owner-usage/v1/${coachUserSubjectHash(userId)}`
}

function ownerPeriod(now: Date) {
	const year = now.getUTCFullYear()
	const month = now.getUTCMonth()
	const periodStart = new Date(Date.UTC(year, month, 1))
	const periodEnd = new Date(Date.UTC(year, month + 1, 1))
	return {
		periodId: `${year}-${String(month + 1).padStart(2, '0')}`,
		periodStart: periodStart.toISOString(),
		periodEnd: periodEnd.toISOString(),
	}
}

function assertOwnerUsage(value: unknown, userId: string) {
	if (
		!isRecord(value) ||
		value.version !== 1 ||
		value.userId !== userId ||
		typeof value.periodId !== 'string' ||
		!isIsoTimestamp(value.periodStart) ||
		!isIsoTimestamp(value.periodEnd) ||
		!nonnegativeInteger(value.paidAttempts) ||
		!Array.isArray(value.recentAttemptTimestamps) ||
		!value.recentAttemptTimestamps.every(isIsoTimestamp) ||
		!isIsoTimestamp(value.updatedAt)
	) {
		throw new CoachUsageLedgerError('The owner Coach usage record is invalid.')
	}
	return value as CoachOwnerUsage
}

function currentOwnerUsage(value: CoachOwnerUsage | null, userId: string, now: Date) {
	const period = ownerPeriod(now)
	const recentAttemptTimestamps = (value?.recentAttemptTimestamps || []).filter(
		(timestamp) => Date.parse(timestamp) > now.getTime() - COACH_OWNER_HOURLY_WINDOW_MS,
	)
	return {
		version: 1,
		userId,
		...period,
		paidAttempts: value?.periodId === period.periodId ? value.paidAttempts : 0,
		recentAttemptTimestamps,
		updatedAt: now.toISOString(),
	} satisfies CoachOwnerUsage
}

export async function consumeOwnerCoachPaidAttempt({
	store,
	userId,
	now = new Date(),
}: {
	store: CoachAccessStore
	userId: string
	now?: Date
}) {
	const key = ownerUsageKey(userId)
	for (let attempt = 0; attempt < 64; attempt += 1) {
		const current = await store.get<CoachOwnerUsage>(key)
		const record = currentOwnerUsage(current ? assertOwnerUsage(current.data, userId) : null, userId, now)
		if (record.paidAttempts >= COACH_OWNER_PERIOD_ATTEMPT_LIMIT) {
			throw new CoachOwnerUsageLimitError(
				'period',
				(Date.parse(record.periodEnd) - now.getTime()) / 1000,
			)
		}
		if (record.recentAttemptTimestamps.length >= COACH_OWNER_HOURLY_ATTEMPT_LIMIT) {
			throw new CoachOwnerUsageLimitError(
				'hour',
				(Date.parse(record.recentAttemptTimestamps[0]) + COACH_OWNER_HOURLY_WINDOW_MS - now.getTime()) /
					1000,
			)
		}
		const next: CoachOwnerUsage = {
			...record,
			paidAttempts: record.paidAttempts + 1,
			recentAttemptTimestamps: [...record.recentAttemptTimestamps, now.toISOString()],
			updatedAt: now.toISOString(),
		}
		const written = current
			? await store.update(key, next, current.etag)
			: await store.create(key, next)
		if (written.modified) return next
	}
	throw new CoachUsageLedgerError('The owner Coach usage record is busy.')
}

export async function getOwnerCoachUsageSummary(
	store: CoachAccessStore,
	userId: string,
	now = new Date(),
): Promise<CoachOwnerUsageSummary> {
	const entry = await store.get<CoachOwnerUsage>(ownerUsageKey(userId))
	const record = currentOwnerUsage(entry ? assertOwnerUsage(entry.data, userId) : null, userId, now)
	return {
		periodId: record.periodId,
		periodStart: record.periodStart,
		periodEnd: record.periodEnd,
		paidAttempts: record.paidAttempts,
		paidAttemptLimit: COACH_OWNER_PERIOD_ATTEMPT_LIMIT,
		paidAttemptsRemaining: Math.max(0, COACH_OWNER_PERIOD_ATTEMPT_LIMIT - record.paidAttempts),
		hourlyAttempts: record.recentAttemptTimestamps.length,
		hourlyAttemptLimit: COACH_OWNER_HOURLY_ATTEMPT_LIMIT,
	}
}
