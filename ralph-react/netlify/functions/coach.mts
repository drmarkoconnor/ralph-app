import { getUser, verifyRequestOrigin } from '@netlify/identity'
import type { Config, Context } from '@netlify/functions'

import {
	COACH_MODEL,
	coachApiRequestSchema,
	coachModelRequest,
	isCoachOwner,
} from './_shared/coach-core.mts'
import {
	createBlobsCoachAccessStore,
	consumeOwnerCoachPaidAttempt,
	CoachOwnerUsageLimitError,
	CoachUsageLedgerError,
	failCoachUsage,
	getActiveCoachEntitlement,
	isCoachSubscriber,
	markCoachUsageDispatched,
	reserveCoachUsage,
	commitCoachUsage,
	releaseCoachUsage,
	type CoachAccessStore,
	type CoachIdentityUser,
} from './_shared/coach-entitlements.mts'
import {
	CoachRateLimitError,
	createCoachCostGuard,
	fingerprintCoachRequest,
} from './_shared/coach-cost-guard.mts'
import {
	coachGenerationFailure,
	generateCoach,
	type GeneratedCoach,
} from './_shared/coach-generation.mts'
import { coachJson, readCoachRequest } from './_shared/coach-http.mts'

declare const Netlify: {
	env: { get(name: string): string | undefined }
}

type EnvReader = (name: string) => string | undefined
type GenerateCoach = typeof generateCoach

type CoachHandlerDependencies = {
	env?: EnvReader
	identityUser?: () => Promise<CoachIdentityUser | null>
	verifyOrigin?: (request: Request) => void
	store?: CoachAccessStore
	generate?: GenerateCoach
	now?: () => Date
	costGuard?: ReturnType<typeof createCoachCostGuard>
}

function netlifyEnv(name: string) {
	return Netlify.env.get(name)
}

function enabled(env: EnvReader) {
	return env('COACH_ENABLED')?.trim().toLowerCase() === 'true'
}

function periodRetrySeconds(periodEnd: string, now: Date) {
	return Math.max(1, Math.ceil((Date.parse(periodEnd) - now.getTime()) / 1000))
}

function paidCoachResponse(generated: GeneratedCoach, cached: boolean, access: 'owner' | 'subscriber') {
	const usage = cached
		? { inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
		: generated.usage
	return coachJson({
		coach: generated.coach,
		meta: {
			model: COACH_MODEL,
			cached,
			access,
			...(usage ? { usage } : {}),
		},
	})
}

export function createCoachHandler(dependencies: CoachHandlerDependencies = {}) {
	const env = dependencies.env || netlifyEnv
	const identityUser = dependencies.identityUser || getUser
	const checkOrigin = dependencies.verifyOrigin || verifyRequestOrigin
	const generate = dependencies.generate || generateCoach
	const currentTime = dependencies.now || (() => new Date())
	const costGuard = dependencies.costGuard || createCoachCostGuard()
	let accessStore = dependencies.store

	return async function coach(request: Request, _context: Context) {
		if (request.method !== 'POST') {
			return coachJson({ code: 'method_not_allowed', error: 'Method not allowed.' }, 405, {
				Allow: 'POST',
			})
		}
		try {
			checkOrigin(request)
		} catch {
			return coachJson({ code: 'origin_not_allowed', error: 'Request origin is not allowed.' }, 403)
		}

		if (!enabled(env)) {
			return coachJson({ code: 'coach_disabled', error: 'AI Coach is not currently available.' }, 503)
		}

		const user = await identityUser()
		if (!user) {
			return coachJson({ code: 'sign_in_required', error: 'Coach sign-in required.' }, 401)
		}
		const ownerEmail = env('COACH_OWNER_EMAIL')?.trim()
		const owner = !!ownerEmail && isCoachOwner(user, ownerEmail)
		const subscriber = !owner && isCoachSubscriber(user)
		if (!owner && !subscriber) {
			return coachJson({ code: 'coach_access_required', error: 'This account cannot use AI Coach.' }, 403)
		}

		const apiKey = env('OPENAI_API_KEY')
		if (!apiKey) {
			return coachJson({ code: 'coach_not_configured', error: 'AI Coach is not configured.' }, 503)
		}

		const now = currentTime()
		let entitlement = null
		if (subscriber) {
			try {
				accessStore ||= createBlobsCoachAccessStore()
				entitlement = await getActiveCoachEntitlement(accessStore, user.id, now)
			} catch {
				return coachJson(
					{ code: 'coach_access_unavailable', error: 'Coach access is temporarily unavailable.' },
					503,
				)
			}
			if (!entitlement) {
				return coachJson(
					{ code: 'coach_entitlement_required', error: 'An active Coach subscription is required.' },
					403,
				)
			}
		}

		const parsed = await readCoachRequest(request, coachApiRequestSchema)
		if (!parsed.ok) return parsed.response
		if (subscriber && !['nudge', 'explain'].includes(parsed.data.intent)) {
			return coachJson(
				{
					code: 'subscriber_intent_not_allowed',
					error: 'The subscriber plan currently provides decision nudges and explanations only.',
				},
				403,
			)
		}

		const modelRequest = coachModelRequest(parsed.data)
		const requestFingerprint = fingerprintCoachRequest(user.id, parsed.data)

		if (owner) {
			try {
				const guarded = await costGuard.run(user.id, requestFingerprint, () =>
					(async () => {
						try {
							accessStore ||= createBlobsCoachAccessStore()
							await consumeOwnerCoachPaidAttempt({
								store: accessStore,
								userId: user.id,
								now: currentTime(),
							})
						} catch (error) {
							if (error instanceof CoachOwnerUsageLimitError) throw error
							throw new CoachUsageLedgerError('Owner Coach usage could not be reserved safely.')
						}
						return generate(apiKey, modelRequest, `owner:${user.id}`, request.signal)
					})(),
				)
				return paidCoachResponse(guarded.value, guarded.cached, 'owner')
			} catch (error) {
				if (error instanceof CoachRateLimitError) {
					return coachJson(
						{ code: 'coach_rate_limit', error: 'Coach request limit reached. Please wait briefly.' },
						429,
						{ 'Retry-After': String(error.retryAfterSeconds) },
					)
				}
				if (error instanceof CoachOwnerUsageLimitError) {
					return coachJson(
						{
							code: error.kind === 'hour' ? 'coach_owner_hour_limit' : 'coach_owner_period_limit',
							error:
								error.kind === 'hour'
									? 'The private Coach hourly paid-call limit has been reached.'
									: 'The private Coach monthly paid-call limit has been reached.',
						},
						429,
						{ 'Retry-After': String(error.retryAfterSeconds) },
					)
				}
				if (error instanceof CoachUsageLedgerError) {
					return coachJson(
						{ code: 'coach_usage_unavailable', error: 'Coach usage is temporarily unavailable.' },
						503,
					)
				}
				const failure = coachGenerationFailure(error)
				return coachJson({ code: 'coach_generation_failed', error: failure.message }, failure.status)
			}
		}

		if (!entitlement || !accessStore) {
			return coachJson({ code: 'coach_access_unavailable', error: 'Coach access is temporarily unavailable.' }, 503)
		}

		let usageReservation: Awaited<ReturnType<typeof reserveCoachUsage>>
		try {
			usageReservation = await reserveCoachUsage({
				store: accessStore,
				entitlement,
				dealFingerprint: parsed.data.dealFingerprint,
				requestFingerprint,
				now,
			})
		} catch {
			return coachJson({ code: 'coach_usage_unavailable', error: 'Coach usage is temporarily unavailable.' }, 503)
		}

		if (usageReservation.kind === 'cached') {
			return paidCoachResponse(
				{ coach: usageReservation.coach, usage: usageReservation.usage },
				true,
				'subscriber',
			)
		}
		if (usageReservation.kind === 'in-progress') {
			return coachJson(
				{ code: 'coach_request_in_progress', error: 'This Coach nudge is already being prepared.' },
				409,
				{ 'Retry-After': String(usageReservation.retryAfterSeconds) },
			)
		}
		if (usageReservation.kind === 'deal-limit') {
			return coachJson(
				{ code: 'coach_deal_limit', error: 'The 100-deal allowance for this period has been used.' },
				429,
				{ 'Retry-After': String(periodRetrySeconds(entitlement.periodEnd, now)) },
			)
		}
		if (usageReservation.kind === 'response-limit') {
			return coachJson(
				{ code: 'coach_deal_response_limit', error: 'This deal has reached its 20 paid-call allowance.' },
				429,
			)
		}
		if (usageReservation.kind === 'attempt-limit') {
			return coachJson(
				{ code: 'coach_paid_attempt_limit', error: 'The 2,000 paid-call allowance for this period has been used.' },
				429,
				{ 'Retry-After': String(periodRetrySeconds(entitlement.periodEnd, now)) },
			)
		}

		try {
			await markCoachUsageDispatched({
				store: accessStore,
				entitlement,
				reservation: usageReservation.reservation,
				now: currentTime(),
			})
		} catch {
			try {
				await releaseCoachUsage({
					store: accessStore,
					entitlement,
					reservation: usageReservation.reservation,
					now: currentTime(),
				})
			} catch {
				// A successful dispatch marker cannot be released; a pre-dispatch reservation expires safely.
			}
			return coachJson(
				{ code: 'coach_usage_unavailable', error: 'Coach usage could not be reserved safely.' },
				503,
			)
		}

		let generated: GeneratedCoach
		try {
			generated = await generate(
				apiKey,
				modelRequest,
				`subscriber:${user.id}`,
				request.signal,
				{ maxOutputTokens: 240 },
			)
		} catch (error) {
			try {
				await failCoachUsage({
					store: accessStore,
					entitlement,
					reservation: usageReservation.reservation,
					now: currentTime(),
				})
			} catch {
				// The durable dispatch marker still counts the paid attempt if failure annotation cannot be saved.
			}
			const failure = coachGenerationFailure(error)
			return coachJson({ code: 'coach_generation_failed', error: failure.message }, failure.status)
		}

		try {
			await commitCoachUsage({
				store: accessStore,
				entitlement,
				reservation: usageReservation.reservation,
				coach: generated.coach,
				usage: generated.usage,
				now: currentTime(),
			})
		} catch {
			return coachJson(
				{
					code: 'coach_usage_completion_failed',
					error: 'The nudge was generated but its usage receipt could not be saved safely.',
				},
				503,
			)
		}
		return paidCoachResponse(generated, false, 'subscriber')
	}
}

export default createCoachHandler()

export const config: Config = {
	path: '/api/coach',
	method: 'POST',
	rateLimit: {
		windowLimit: 12,
		windowSize: 60,
		aggregateBy: ['ip', 'domain'],
	},
}
