import { verifyRequestOrigin } from '@netlify/identity'
import type { Config, Context } from '@netlify/functions'

import { COACH_MODEL, coachTrialRequestSchema } from './_shared/coach-core.mts'
import { fingerprintCoachRequest } from './_shared/coach-cost-guard.mts'
import {
	coachGenerationFailure,
	generateCoach,
	type GeneratedCoach,
} from './_shared/coach-generation.mts'
import { coachJson, readCoachRequest } from './_shared/coach-http.mts'
import {
	COACH_TRIAL_COOKIE,
	completeAnonymousTrial,
	createBlobsCoachTrialStore,
	createTrialToken,
	failAnonymousTrial,
	parseTrialDailyCap,
	readCookieValue,
	reserveAnonymousTrial,
	secondsUntilNextUtcDay,
	serializeTrialCookie,
	trialSubjectHash,
	validTrialSecret,
	verifyTrialToken,
	type CoachTrialStore,
} from './_shared/coach-trial-ledger.mts'

declare const Netlify: {
	env: { get(name: string): string | undefined }
}

type EnvReader = (name: string) => string | undefined
type GenerateCoach = typeof generateCoach

type TrialHandlerDependencies = {
	env?: EnvReader
	store?: CoachTrialStore
	verifyOrigin?: (request: Request) => void
	generate?: GenerateCoach
	now?: () => Date
	createTrialId?: () => string
}

function netlifyEnv(name: string) {
	return Netlify.env.get(name)
}

function trialSettings(env: EnvReader) {
	const enabled = env('COACH_TRIAL_ENABLED')?.trim().toLowerCase() === 'true'
	const secret = env('COACH_TRIAL_SECRET')
	const dailyCap = parseTrialDailyCap(env('COACH_TRIAL_DAILY_CAP'))
	return { enabled, secret, dailyCap }
}

function trialError(
	code: string,
	error: string,
	status: number,
	extra: Record<string, unknown> = {},
	headers: Record<string, string> = {},
) {
	return coachJson({ code, error, ...extra }, status, headers)
}

export function createCoachTrialHandler(dependencies: TrialHandlerDependencies = {}) {
	const env = dependencies.env || netlifyEnv
	const checkOrigin = dependencies.verifyOrigin || verifyRequestOrigin
	const generate = dependencies.generate || generateCoach
	const currentTime = dependencies.now || (() => new Date())
	let trialStore = dependencies.store

	return async function coachTrial(request: Request, _context: Context) {
		if (request.method !== 'POST') {
			return trialError('method_not_allowed', 'Method not allowed.', 405, {}, { Allow: 'POST' })
		}
		try {
			checkOrigin(request)
		} catch {
			return trialError('origin_not_allowed', 'Request origin is not allowed.', 403)
		}

		const settings = trialSettings(env)
		if (!settings.enabled) {
			return trialError('trial_disabled', 'The free AI nudge is not currently available.', 503, {
				trialAvailable: false,
			})
		}
		if (!validTrialSecret(settings.secret) || settings.dailyCap === null) {
			return trialError('trial_not_configured', 'The free AI nudge is not configured.', 503, {
				trialAvailable: false,
			})
		}

		const apiKey = env('OPENAI_API_KEY')
		if (!apiKey) {
			return trialError('trial_not_configured', 'The free AI nudge is not configured.', 503, {
				trialAvailable: false,
			})
		}

		const parsed = await readCoachRequest(request, coachTrialRequestSchema)
		if (!parsed.ok) return parsed.response

		const suppliedToken = readCookieValue(request.headers.get('cookie'), COACH_TRIAL_COOKIE)
		const trialId = verifyTrialToken(suppliedToken, settings.secret)
		if (!trialId || !suppliedToken) {
			let freshToken: string
			try {
				freshToken = createTrialToken(settings.secret, dependencies.createTrialId?.())
			} catch {
				return trialError('trial_not_configured', 'The free AI nudge is not configured.', 503, {
					trialAvailable: false,
				})
			}
			return trialError(
				'trial_cookie_required',
				'The browser trial is ready. Retry this request once.',
				428,
				{ retry: true, trialAvailable: true, accessRequired: false },
				{ 'Set-Cookie': serializeTrialCookie(freshToken) },
			)
		}

		const cookieHeader = serializeTrialCookie(suppliedToken)
		const withCookie = (headers: Record<string, string> = {}) => ({
			'Set-Cookie': cookieHeader,
			...headers,
		})
		const subjectHash = trialSubjectHash(trialId)
		const fingerprint = fingerprintCoachRequest(`trial:${subjectHash}`, parsed.data)
		const now = currentTime()
		trialStore ||= createBlobsCoachTrialStore()

		let reservation: Awaited<ReturnType<typeof reserveAnonymousTrial>>
		try {
			reservation = await reserveAnonymousTrial({
				store: trialStore,
				subjectHash,
				fingerprint,
				dailyCap: settings.dailyCap,
				now,
			})
		} catch {
			return trialError(
				'trial_ledger_unavailable',
				'The free AI nudge is temporarily unavailable.',
				503,
				{ trialAvailable: true },
				withCookie(),
			)
		}

		if (reservation.kind === 'cached') {
			return coachJson(
				{
					coach: reservation.record.coach,
					meta: {
						model: COACH_MODEL,
						cached: true,
						trial: true,
						trialUsed: true,
						accessRequired: true,
						usage: { inputTokens: 0, outputTokens: 0, estimatedUsd: 0 },
					},
				},
				200,
				withCookie(),
			)
		}
		if (reservation.kind === 'used') {
			const inProgress = reservation.status === 'reserved'
			return trialError(
				inProgress ? 'trial_in_progress' : 'trial_used',
				inProgress
					? 'Your free AI nudge is already being prepared.'
					: 'This browser has already used its free AI nudge. Sign in for further coaching.',
				409,
				{
					trialAvailable: false,
					trialUsed: !inProgress,
					accessRequired: !inProgress,
				},
				withCookie(inProgress ? { 'Retry-After': '3' } : {}),
			)
		}
		if (reservation.kind === 'daily-cap') {
			return trialError(
				'trial_daily_cap',
				'Today\'s free-nudge allowance has been reached. Please try again tomorrow.',
				429,
				{ trialAvailable: true, accessRequired: false },
				withCookie({ 'Retry-After': String(secondsUntilNextUtcDay(now)) }),
			)
		}

		let generated: GeneratedCoach
		try {
			generated = await generate(
				apiKey,
				parsed.data,
				`anonymous-trial:${subjectHash}`,
				request.signal,
				{ maxOutputTokens: 240 },
			)
		} catch (error) {
			try {
				await failAnonymousTrial({
					store: trialStore,
					subjectHash,
					reservation: reservation.entry,
					now: currentTime(),
				})
			} catch {
				// A retained reservation is intentionally treated as used to avoid duplicate spend.
			}
			const failure = coachGenerationFailure(error)
			return trialError(
				'trial_generation_failed',
				failure.message,
				failure.status,
				{ trialAvailable: false, trialUsed: true, accessRequired: true },
				withCookie(),
			)
		}

		let completionSaved = false
		try {
			const completion = await completeAnonymousTrial({
				store: trialStore,
				subjectHash,
				reservation: reservation.entry,
				coach: generated.coach,
				usage: generated.usage,
				now: currentTime(),
			})
			completionSaved = completion.modified
		} catch {
			// Reconcile to a consumed state below; never report an unsaved completion as success.
		}
		if (!completionSaved) {
			try {
				await failAnonymousTrial({
					store: trialStore,
					subjectHash,
					reservation: reservation.entry,
					now: currentTime(),
				})
			} catch {
				// A retained reservation is intentionally treated as used to avoid duplicate spend.
			}
			return trialError(
				'trial_completion_failed',
				'The free AI nudge was generated but its one-use receipt could not be saved safely.',
				503,
				{ trialAvailable: false, trialUsed: true, accessRequired: true },
				withCookie(),
			)
		}

		return coachJson(
			{
				coach: generated.coach,
				meta: {
					model: COACH_MODEL,
					cached: false,
					trial: true,
					trialUsed: true,
					accessRequired: true,
					...(generated.usage ? { usage: generated.usage } : {}),
				},
			},
			200,
			withCookie(),
		)
	}
}

export default createCoachTrialHandler()

export const config: Config = {
	path: '/api/coach/trial',
	method: 'POST',
	rateLimit: {
		windowLimit: 4,
		windowSize: 60,
		aggregateBy: ['ip', 'domain'],
	},
}
