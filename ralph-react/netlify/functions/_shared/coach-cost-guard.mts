import { createHash } from 'node:crypto'

type GuardResult<T> = { value: T; cached: boolean }

type CacheEntry<T> = {
	expiresAt: number
	value: T
}

export class CoachRateLimitError extends Error {
	retryAfterSeconds: number

	constructor(retryAfterSeconds: number) {
		super('Coach request limit reached.')
		this.name = 'CoachRateLimitError'
		this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds))
	}
}

export function fingerprintCoachRequest(userId: string, request: unknown) {
	return createHash('sha256').update(userId).update('\0').update(JSON.stringify(request)).digest('hex')
}

/**
 * Best-effort warm-instance protection against repeated paid calls. The upstream
 * Identity gate remains the primary control; this guard catches double-clicks,
 * retries, and accidental request loops without storing any bridge position.
 */
export function createCoachCostGuard({
	minuteLimit = 12,
	hourLimit = 80,
	cacheTtlMs = 45_000,
	maximumEntries = 200,
} = {}) {
	const requestsByUser = new Map<string, number[]>()
	const cache = new Map<string, CacheEntry<unknown>>()
	const inFlight = new Map<string, Promise<unknown>>()

	function prune(now: number) {
		for (const [key, entry] of cache) {
			if (entry.expiresAt <= now) cache.delete(key)
		}
		for (const [userId, timestamps] of requestsByUser) {
			const recent = timestamps.filter((timestamp) => timestamp > now - 3_600_000)
			if (recent.length) requestsByUser.set(userId, recent)
			else requestsByUser.delete(userId)
		}
		while (cache.size > maximumEntries) {
			const oldestKey = cache.keys().next().value
			if (typeof oldestKey !== 'string') break
			cache.delete(oldestKey)
		}
	}

	function consume(userId: string, now: number) {
		const previous = requestsByUser.get(userId) || []
		const withinHour = previous.filter((timestamp) => timestamp > now - 3_600_000)
		const withinMinute = withinHour.filter((timestamp) => timestamp > now - 60_000)
		if (withinMinute.length >= minuteLimit) {
			throw new CoachRateLimitError((withinMinute[0] + 60_000 - now) / 1000)
		}
		if (withinHour.length >= hourLimit) {
			throw new CoachRateLimitError((withinHour[0] + 3_600_000 - now) / 1000)
		}
		withinHour.push(now)
		requestsByUser.set(userId, withinHour)
	}

	return {
		async run<T>(
			userId: string,
			fingerprint: string,
			producer: () => Promise<T>,
			now = Date.now(),
		): Promise<GuardResult<T>> {
			prune(now)
			const cached = cache.get(fingerprint)
			if (cached && cached.expiresAt > now) {
				return { value: cached.value as T, cached: true }
			}
			const existing = inFlight.get(fingerprint)
			if (existing) return { value: (await existing) as T, cached: true }

			consume(userId, now)
			const promise = producer()
			inFlight.set(fingerprint, promise)
			try {
				const value = await promise
				cache.set(fingerprint, { expiresAt: now + cacheTtlMs, value })
				return { value, cached: false }
			} finally {
				inFlight.delete(fingerprint)
			}
		},
	}
}
