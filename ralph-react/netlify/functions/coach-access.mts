import { getUser } from '@netlify/identity'
import type { Config, Context } from '@netlify/functions'

import { isCoachOwner } from './_shared/coach-core.mts'
import {
	createBlobsCoachAccessStore,
	getActiveCoachEntitlement,
	getCoachUsageSummary,
	isCoachSubscriber,
	type CoachAccessStore,
	type CoachIdentityUser,
} from './_shared/coach-entitlements.mts'
import { coachJson } from './_shared/coach-http.mts'

declare const Netlify: {
	env: { get(name: string): string | undefined }
}

type AccessHandlerDependencies = {
	env?: (name: string) => string | undefined
	accessStore?: CoachAccessStore
	identityUser?: () => Promise<CoachIdentityUser | null>
	now?: () => Date
}

function netlifyEnv(name: string) {
	return Netlify.env.get(name)
}

function publicContactEmail(env: (name: string) => string | undefined) {
	const email = env('COACH_CONTACT_EMAIL')?.trim()
	return email && email.length <= 254 ? email : undefined
}

export function createCoachAccessHandler(dependencies: AccessHandlerDependencies = {}) {
	const env = dependencies.env || netlifyEnv
	const identityUser = dependencies.identityUser || getUser
	const currentTime = dependencies.now || (() => new Date())
	let accessStore = dependencies.accessStore

	return async function coachAccess(request: Request, _context: Context) {
		if (request.method !== 'GET') {
			return coachJson({ code: 'method_not_allowed', error: 'Method not allowed.' }, 405, {
				Allow: 'GET',
			})
		}

		const user = await identityUser()
		const signedIn = !!user
		const coachEnabled = env('COACH_ENABLED')?.trim().toLowerCase() === 'true'
		const configured = coachEnabled && !!env('OPENAI_API_KEY')
		const contactEmail = publicContactEmail(env)
		const ownerEmail = env('COACH_OWNER_EMAIL')?.trim()
		const owner = !!ownerEmail && isCoachOwner(user, ownerEmail)
		let access: 'owner' | 'subscriber' | 'none' = 'none'
		let entitlementSummary: Awaited<ReturnType<typeof getCoachUsageSummary>> | undefined

		if (configured && owner) {
			access = 'owner'
		} else if (configured && user && isCoachSubscriber(user)) {
			try {
				accessStore ||= createBlobsCoachAccessStore()
				const entitlement = await getActiveCoachEntitlement(accessStore, user.id, currentTime())
				if (entitlement) {
					access = 'subscriber'
					entitlementSummary = await getCoachUsageSummary(accessStore, entitlement)
				}
			} catch {
				return coachJson(
					{
						code: 'access_unavailable',
						error: 'Coach access status is temporarily unavailable.',
						enabled: coachEnabled,
						configured,
						signedIn,
						access: 'none',
						authorized: false,
						...(contactEmail ? { contactEmail } : {}),
					},
					503,
				)
			}
		}

		return coachJson({
			enabled: coachEnabled,
			configured,
			signedIn,
			access,
			authorized: access !== 'none',
			...(entitlementSummary ? { entitlement: entitlementSummary } : {}),
			...(contactEmail ? { contactEmail } : {}),
			trial: { enabled: false, available: false, status: 'retired' },
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
