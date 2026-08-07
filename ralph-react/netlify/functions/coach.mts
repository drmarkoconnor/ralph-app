import { getUser, verifyRequestOrigin } from '@netlify/identity'
import type { Config, Context } from '@netlify/functions'

import { COACH_MODEL, isCoachOwner } from './_shared/coach-core.mts'
import {
	CoachRateLimitError,
	createCoachCostGuard,
	fingerprintCoachRequest,
} from './_shared/coach-cost-guard.mts'
import { coachGenerationFailure, generateCoach } from './_shared/coach-generation.mts'
import { coachJson, readCoachRequest } from './_shared/coach-http.mts'

declare const Netlify: {
	env: { get(name: string): string | undefined }
}

const costGuard = createCoachCostGuard()

export default async function coach(request: Request, _context: Context) {
	if (request.method !== 'POST') {
		return coachJson({ error: 'Method not allowed.' }, 405, { Allow: 'POST' })
	}
	try {
		verifyRequestOrigin(request)
	} catch {
		return coachJson({ error: 'Request origin is not allowed.' }, 403)
	}

	const user = await getUser()
	if (!user) return coachJson({ error: 'Owner sign-in required.' }, 401)
	const ownerEmail = Netlify.env.get('COACH_OWNER_EMAIL')?.trim()
	if (!ownerEmail) return coachJson({ error: 'AI Coach owner access is not configured.' }, 503)
	if (!isCoachOwner(user, ownerEmail)) {
		return coachJson({ error: 'This account cannot use the private AI Coach.' }, 403)
	}

	const parsed = await readCoachRequest(request)
	if (!parsed.ok) return parsed.response

	const apiKey = Netlify.env.get('OPENAI_API_KEY')
	if (!apiKey) return coachJson({ error: 'AI Coach is not configured.' }, 503)

	const fingerprint = fingerprintCoachRequest(user.id, parsed.data)
	try {
		const guarded = await costGuard.run(user.id, fingerprint, () =>
			generateCoach(apiKey, parsed.data, `owner:${user.id}`, request.signal),
		)
		const usage = guarded.cached
			? { inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
			: guarded.value.usage
		return coachJson({
			coach: guarded.value.coach,
			meta: {
				model: COACH_MODEL,
				cached: guarded.cached,
				...(usage ? { usage } : {}),
			},
		})
	} catch (error) {
		if (error instanceof CoachRateLimitError) {
			return coachJson(
				{ error: 'Coach request limit reached. Please wait briefly.' },
				429,
				{ 'Retry-After': String(error.retryAfterSeconds) },
			)
		}
		const failure = coachGenerationFailure(error)
		return coachJson({ error: failure.message }, failure.status)
	}
}

export const config: Config = {
	path: '/api/coach',
	method: 'POST',
	rateLimit: {
		windowLimit: 12,
		windowSize: 60,
		aggregateBy: ['ip', 'domain'],
	},
}
