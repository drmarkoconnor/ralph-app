import { admin, getUser, verifyRequestOrigin, type User } from '@netlify/identity'
import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'

import { isCoachOwner } from './_shared/coach-core.mts'
import {
	COACH_SUBSCRIBER_ROLE,
	createBlobsCoachAccessStore,
	getCoachEntitlement,
	getCoachUsageSummary,
	grantCoachEntitlement,
	listCoachEntitlements,
	revokeCoachEntitlement,
	type CoachAccessStore,
	type CoachIdentityUser,
} from './_shared/coach-entitlements.mts'
import { coachJson, MAX_COACH_REQUEST_BYTES } from './_shared/coach-http.mts'

declare const Netlify: {
	env: { get(name: string): string | undefined }
}

const MAX_ENTITLEMENT_PERIOD_MS = 35 * 24 * 60 * 60 * 1000

const userIdSchema = z
	.string()
	.trim()
	.min(1)
	.max(200)
	.refine((value) => !/[\u0000-\u001F\u007F]/.test(value), 'User ID contains unsupported characters.')

const periodSchema = z
	.object({
		action: z.literal('grant'),
		userId: userIdSchema,
		periodStart: z.iso.datetime({ offset: true }),
		periodEnd: z.iso.datetime({ offset: true }),
		note: z.string().trim().max(200).optional(),
	})
	.strict()
	.superRefine((value, context) => {
		const start = Date.parse(value.periodStart)
		const end = Date.parse(value.periodEnd)
		if (end <= start) {
			context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Period end must be after its start.' })
		} else if (end - start > MAX_ENTITLEMENT_PERIOD_MS) {
			context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'A grant may cover at most 35 days.' })
		}
	})

const mutationSchema = z.discriminatedUnion('action', [
	periodSchema,
	z
		.object({
			action: z.literal('revoke'),
			userId: userIdSchema,
			note: z.string().trim().max(200).optional(),
		})
		.strict(),
])

type IdentityAdmin = Pick<typeof admin, 'getUser' | 'updateUser'>

type EntitlementHandlerDependencies = {
	env?: (name: string) => string | undefined
	identityUser?: () => Promise<CoachIdentityUser | null>
	identityAdmin?: IdentityAdmin
	verifyOrigin?: (request: Request) => void
	store?: CoachAccessStore
	now?: () => Date
}

function netlifyEnv(name: string) {
	return Netlify.env.get(name)
}

function rolesFor(user: User) {
	const metadataRoles = Array.isArray(user.appMetadata?.roles)
		? user.appMetadata.roles.filter((role): role is string => typeof role === 'string')
		: []
	return new Set([...(user.roles || []), ...metadataRoles])
}

async function readMutation(request: Request) {
	if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
		return { ok: false as const, response: coachJson({ code: 'unsupported_media_type', error: 'Content-Type must be application/json.' }, 415) }
	}
	const contentLength = Number(request.headers.get('content-length') || 0)
	if (contentLength > MAX_COACH_REQUEST_BYTES) {
		return { ok: false as const, response: coachJson({ code: 'request_too_large', error: 'Entitlement request is too large.' }, 413) }
	}
	let body: unknown
	try {
		const text = await request.text()
		if (!text || new TextEncoder().encode(text).byteLength > MAX_COACH_REQUEST_BYTES) {
			return { ok: false as const, response: coachJson({ code: 'invalid_request', error: 'Entitlement request is empty or too large.' }, text ? 413 : 400) }
		}
		body = JSON.parse(text)
	} catch {
		return { ok: false as const, response: coachJson({ code: 'invalid_json', error: 'Entitlement request must contain valid JSON.' }, 400) }
	}
	const parsed = mutationSchema.safeParse(body)
	if (!parsed.success) {
		return {
			ok: false as const,
			response: coachJson(
				{
					code: 'invalid_entitlement',
					error: 'Entitlement request was rejected.',
					issues: parsed.error.issues.slice(0, 6).map((issue) => ({
						path: issue.path.join('.'),
						message: issue.message,
					})),
				},
				400,
			),
		}
	}
	return { ok: true as const, data: parsed.data }
}

async function entitlementWithUsage(store: CoachAccessStore, userId: string) {
	const entitlement = await getCoachEntitlement(store, userId)
	if (!entitlement) return null
	return {
		entitlement,
		usage: await getCoachUsageSummary(store, entitlement),
	}
}

export function createCoachEntitlementsHandler(
	dependencies: EntitlementHandlerDependencies = {},
) {
	const env = dependencies.env || netlifyEnv
	const identityUser = dependencies.identityUser || getUser
	const identityAdmin = dependencies.identityAdmin || admin
	const checkOrigin = dependencies.verifyOrigin || verifyRequestOrigin
	const currentTime = dependencies.now || (() => new Date())
	let accessStore = dependencies.store

	return async function coachEntitlements(request: Request, _context: Context) {
		if (request.method !== 'GET' && request.method !== 'POST') {
			return coachJson({ code: 'method_not_allowed', error: 'Method not allowed.' }, 405, {
				Allow: 'GET, POST',
			})
		}
		if (request.method === 'POST') {
			try {
				checkOrigin(request)
			} catch {
				return coachJson({ code: 'origin_not_allowed', error: 'Request origin is not allowed.' }, 403)
			}
		}

		const owner = await identityUser()
		const ownerEmail = env('COACH_OWNER_EMAIL')?.trim()
		if (!owner) return coachJson({ code: 'sign_in_required', error: 'Owner sign-in required.' }, 401)
		if (!ownerEmail) {
			return coachJson({ code: 'owner_not_configured', error: 'Coach owner access is not configured.' }, 503)
		}
		if (!isCoachOwner(owner, ownerEmail)) {
			return coachJson({ code: 'owner_access_required', error: 'Coach owner access is required.' }, 403)
		}

		accessStore ||= createBlobsCoachAccessStore()
		if (request.method === 'GET') {
			try {
				const requestedUserId = new URL(request.url).searchParams.get('userId')?.trim()
				if (requestedUserId) {
					const parsedUserId = userIdSchema.safeParse(requestedUserId)
					if (!parsedUserId.success) {
						return coachJson({ code: 'invalid_user_id', error: 'Identity user ID is invalid.' }, 400)
					}
					const record = await entitlementWithUsage(accessStore, parsedUserId.data)
					return record
						? coachJson(record)
						: coachJson({ code: 'entitlement_not_found', error: 'No entitlement was found.' }, 404)
				}
				const entitlements = await listCoachEntitlements(accessStore)
				const records = await Promise.all(
					entitlements.map(async (entitlement) => ({
						entitlement,
						usage: await getCoachUsageSummary(accessStore!, entitlement),
					})),
				)
				return coachJson({ records })
			} catch {
				return coachJson({ code: 'entitlement_store_unavailable', error: 'Coach entitlements are temporarily unavailable.' }, 503)
			}
		}

		const parsed = await readMutation(request)
		if (!parsed.ok) return parsed.response
		const mutation = parsed.data
		if (mutation.action === 'grant') {
			let target: User
			try {
				target = await identityAdmin.getUser(mutation.userId)
			} catch {
				return coachJson({ code: 'identity_user_not_found', error: 'The Identity user could not be loaded.' }, 404)
			}
			if (!target.email || !target.confirmedAt) {
				return coachJson({ code: 'identity_user_unconfirmed', error: 'The Identity user must have a confirmed email.' }, 400)
			}

			const roles = rolesFor(target)
			roles.add(COACH_SUBSCRIBER_ROLE)
			try {
				await identityAdmin.updateUser(target.id, {
					app_metadata: { ...(target.appMetadata || {}), roles: [...roles].sort() },
				})
			} catch {
				return coachJson({ code: 'identity_role_update_failed', error: 'The subscriber role could not be assigned.' }, 502)
			}

			try {
				const entitlement = await grantCoachEntitlement({
					store: accessStore,
					userId: target.id,
					email: target.email,
					periodStart: mutation.periodStart,
					periodEnd: mutation.periodEnd,
					grantedBy: owner.id,
					note: mutation.note,
					now: currentTime(),
				})
				return coachJson({ entitlement, usage: await getCoachUsageSummary(accessStore, entitlement) })
			} catch {
				return coachJson({ code: 'entitlement_store_unavailable', error: 'The entitlement could not be saved safely.' }, 503)
			}
		}

		let entitlement = null
		try {
			entitlement = await revokeCoachEntitlement({
				store: accessStore,
				userId: mutation.userId,
				revokedBy: owner.id,
				note: mutation.note,
				now: currentTime(),
			})
		} catch {
			return coachJson({ code: 'entitlement_store_unavailable', error: 'The entitlement could not be revoked safely.' }, 503)
		}

		let roleUpdated = false
		try {
			const target = await identityAdmin.getUser(mutation.userId)
			const roles = rolesFor(target)
			roles.delete(COACH_SUBSCRIBER_ROLE)
			await identityAdmin.updateUser(target.id, {
				app_metadata: { ...(target.appMetadata || {}), roles: [...roles].sort() },
			})
			roleUpdated = true
		} catch {
			// A revoked or absent durable entitlement denies access even if role cleanup must be retried.
		}
		return coachJson({ revoked: !!entitlement, roleUpdated, entitlement })
	}
}

export default createCoachEntitlementsHandler()

export const config: Config = {
	path: '/api/coach/entitlements',
	rateLimit: {
		windowLimit: 20,
		windowSize: 60,
		aggregateBy: ['ip', 'domain'],
	},
}
