const ERROR_BY_STATUS = {
	401: 'Please sign in with your invited Coach account.',
	403: 'This signed-in account does not have active Coach access.',
	409: 'This Coach request could not be completed safely. Please try again.',
	429: 'The Coach request limit has been reached. Please wait a minute and try again.',
}

export class CoachRequestError extends Error {
	constructor(message, { status, code, accessRequired = false, trialUsed = false } = {}) {
		super(message)
		this.name = 'CoachRequestError'
		this.status = status
		this.code = code
		this.accessRequired = accessRequired
		this.trialUsed = trialUsed
	}
}

async function coachFetch(path, options) {
	const response = await fetch(path, { credentials: 'include', ...options })
	let payload = null
	try {
		payload = await response.json()
	} catch {
		// A concise fallback below is more useful than exposing an HTML error page.
	}
	if (!response.ok) {
		throw new CoachRequestError(
			(payload?.code ? payload?.error : ERROR_BY_STATUS[response.status]) ||
				payload?.error ||
				payload?.message ||
				`The Coach request failed (${response.status}).`,
			{
				status: response.status,
				code: payload?.code,
				accessRequired: !!payload?.accessRequired,
				trialUsed: !!payload?.trialUsed,
			},
		)
	}
	return payload
}

export async function requestBridgeCoach({
	context,
	dealFingerprint,
	intent,
	question = '',
	signal,
}) {
	if (!context) throw new Error('Load a board before asking the Coach.')
	if (!/^[a-f0-9]{64}$/.test(String(dealFingerprint || ''))) {
		throw new Error('The Coach could not identify this deal safely.')
	}
	return coachFetch('/api/coach', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			intent,
			...(question ? { question } : {}),
			dealFingerprint,
			context,
		}),
		signal,
	})
}

export async function requestBridgeCoachTrial({ context, signal }) {
	if (!context) throw new Error('Load a board before asking the Coach.')
	const request = () =>
		coachFetch('/api/coach/trial', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ intent: 'nudge', context }),
			signal,
		})
	try {
		return await request()
	} catch (error) {
		if (
			!(error instanceof CoachRequestError) ||
			error.status !== 428 ||
			error.code !== 'trial_cookie_required'
		) {
			throw error
		}
		return request()
	}
}

export function getBridgeCoachAccess({ signal } = {}) {
	return coachFetch('/api/coach/access', { method: 'GET', signal })
}
