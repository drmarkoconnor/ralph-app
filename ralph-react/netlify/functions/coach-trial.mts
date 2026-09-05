import { verifyRequestOrigin } from '@netlify/identity'
import type { Config, Context } from '@netlify/functions'

import { coachJson } from './_shared/coach-http.mts'

type TrialHandlerDependencies = {
	verifyOrigin?: (request: Request) => void
}

/**
 * The anonymous paid trial is retired. Keeping a permanent server-side tombstone
 * prevents a stale COACH_TRIAL_ENABLED environment value from reopening it.
 */
export function createCoachTrialHandler(dependencies: TrialHandlerDependencies = {}) {
	const checkOrigin = dependencies.verifyOrigin || verifyRequestOrigin
	return async function coachTrial(request: Request, _context: Context) {
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
		return coachJson(
			{
				code: 'trial_retired',
				error: 'Anonymous AI Coach trials have been retired. Sign in with an authorized account.',
				trialAvailable: false,
				accessRequired: true,
			},
			410,
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
