import assert from 'node:assert/strict'
import test from 'node:test'

import {
	CoachRequestError,
	getBridgeCoachAccess,
	requestBridgeCoach,
	requestBridgeCoachTrial,
} from './coachClient.js'

function jsonResponse(body, status) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}

test('authenticated coach request includes the deal fingerprint outside the context', async (context) => {
	const originalFetch = globalThis.fetch
	context.after(() => {
		globalThis.fetch = originalFetch
	})
	const dealFingerprint = 'a'.repeat(64)
	let body
	globalThis.fetch = async (_path, options) => {
		body = JSON.parse(options.body)
		return jsonResponse({ coach: { message: 'Notice the public auction.' } }, 200)
	}

	await requestBridgeCoach({
		context: { schemaVersion: 1 },
		dealFingerprint,
		intent: 'nudge',
	})

	assert.equal(body.dealFingerprint, dealFingerprint)
	assert.equal(body.context.dealFingerprint, undefined)
})

test('authenticated coach request refuses a missing deal fingerprint before fetch', async (context) => {
	const originalFetch = globalThis.fetch
	context.after(() => {
		globalThis.fetch = originalFetch
	})
	let fetched = false
	globalThis.fetch = async () => {
		fetched = true
		return jsonResponse({}, 200)
	}

	await assert.rejects(
		requestBridgeCoach({ context: { schemaVersion: 1 }, intent: 'nudge' }),
		/identify this deal/i,
	)
	assert.equal(fetched, false)
})

test('access check preserves an authorized owner response from the server', async (context) => {
	const originalFetch = globalThis.fetch
	context.after(() => {
		globalThis.fetch = originalFetch
	})
	let request
	globalThis.fetch = async (path, options) => {
		request = { path, options }
		return jsonResponse(
			{ signedIn: true, configured: true, access: 'owner', authorized: true },
			200,
		)
	}

	const access = await getBridgeCoachAccess()
	assert.equal(access.access, 'owner')
	assert.equal(access.authorized, true)
	assert.equal(request.path, '/api/coach/access')
	assert.equal(request.options.method, 'GET')
	assert.equal(request.options.credentials, 'include')
})

test('anonymous trial transparently retries exactly once after the cookie handshake', async (context) => {
	const originalFetch = globalThis.fetch
	context.after(() => {
		globalThis.fetch = originalFetch
	})

	const requests = []
	globalThis.fetch = async (path, options) => {
		requests.push({ path, options })
		if (requests.length === 1) {
			return jsonResponse(
				{
					code: 'trial_cookie_required',
					error: 'The browser trial is ready. Retry this request once.',
					retry: true,
				},
				428,
			)
		}
		return jsonResponse({ coach: { message: 'Think first.' }, meta: { trialUsed: true } }, 200)
	}

	const payload = await requestBridgeCoachTrial({ context: { schemaVersion: 1 } })
	assert.equal(payload.meta.trialUsed, true)
	assert.equal(requests.length, 2)
	assert.deepEqual(
		requests.map(({ path }) => path),
		['/api/coach/trial', '/api/coach/trial'],
	)
	assert.equal(requests[0].options.credentials, 'include')
	assert.equal(requests[1].options.credentials, 'include')
	assert.equal(requests[0].options.body, requests[1].options.body)
})

test('anonymous trial does not loop if the retry also asks for a cookie', async (context) => {
	const originalFetch = globalThis.fetch
	context.after(() => {
		globalThis.fetch = originalFetch
	})

	let calls = 0
	globalThis.fetch = async () => {
		calls += 1
		return jsonResponse(
			{
				code: 'trial_cookie_required',
				error: 'The browser trial is ready. Retry this request once.',
			},
			428,
		)
	}

	await assert.rejects(
		requestBridgeCoachTrial({ context: { schemaVersion: 1 } }),
		(error) => error instanceof CoachRequestError && error.code === 'trial_cookie_required',
	)
	assert.equal(calls, 2)
})
