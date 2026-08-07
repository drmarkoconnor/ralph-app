import { getUser } from '@netlify/identity'
import type { Config, Context } from '@netlify/functions'

import { isCoachOwner } from './_shared/coach-core.mts'
import { coachJson } from './_shared/coach-http.mts'
import {
	COACH_TRIAL_COOKIE,
	createBlobsCoachTrialStore,
	getAnonymousTrialStatus,
	parseTrialDailyCap,
	readCookieValue,
	trialSubjectHash,
	validTrialSecret,
	verifyTrialToken,
	type CoachTrialStore,
} from './_shared/coach-trial-ledger.mts'

declare const Netlify: {
	env: { get(name: string): string | undefined }
}

type IdentityUser = Awaited<ReturnType<typeof getUser>>

type AccessHandlerDependencies = {
	env?: (name: string) => string | undefined
	store?: CoachTrialStore
	identityUser?: () => Promise<IdentityUser>
}

function netlifyEnv(name: string) {
	return Netlify.env.get(name)
}

export function createCoachAccessHandler(dependencies: AccessHandlerDependencies = {}) {
	const env = dependencies.env || netlifyEnv
	const identityUser = dependencies.identityUser || getUser
	let trialStore = dependencies.store

	return async function coachAccess(request: Request, _context: Context) {
		if (request.method !== 'GET') {
			return coachJson({ code: 'method_not_allowed', error: 'Method not allowed.' }, 405, {
				Allow: 'GET',
			})
		}

		const user = await identityUser()
		const ownerEmail = env('COACH_OWNER_EMAIL')?.trim()
		const owner = !!ownerEmail && isCoachOwner(user, ownerEmail)
		const authenticated = !!user
		const trialEnabled = env('COACH_TRIAL_ENABLED')?.trim().toLowerCase() === 'true'
		const secret = env('COACH_TRIAL_SECRET')
		const dailyCap = parseTrialDailyCap(env('COACH_TRIAL_DAILY_CAP'))

		if (!trialEnabled || !validTrialSecret(secret) || dailyCap === null) {
			return coachJson({
				authenticated,
				owner,
				access: owner ? 'owner' : 'access-required',
				trial: { enabled: false, available: false, status: 'unavailable' },
			})
		}
		if (owner) {
			return coachJson({
				authenticated: true,
				owner: true,
				access: 'owner',
				trial: { enabled: true, available: false, status: 'not-needed' },
			})
		}

		const token = readCookieValue(request.headers.get('cookie'), COACH_TRIAL_COOKIE)
		const trialId = verifyTrialToken(token, secret)
		let trialStatus: 'available' | 'in-progress' | 'used' = 'available'
		if (trialId) {
			try {
				trialStore ||= createBlobsCoachTrialStore()
				trialStatus = await getAnonymousTrialStatus(trialStore, trialSubjectHash(trialId))
			} catch {
				return coachJson(
					{ code: 'access_unavailable', error: 'Coach access status is temporarily unavailable.' },
					503,
				)
			}
		}

		const trialAvailable = trialStatus === 'available'
		return coachJson({
			authenticated,
			owner,
			access: owner ? 'owner' : trialAvailable ? 'trial' : 'access-required',
			trial: { enabled: true, available: trialAvailable, status: trialStatus },
		})
	}
}

export default createCoachAccessHandler()

export const config: Config = {
	path: '/api/coach/access',
	method: 'GET',
	rateLimit: {
		windowLimit: 30,
		windowSize: 60,
		aggregateBy: ['ip', 'domain'],
	},
}
