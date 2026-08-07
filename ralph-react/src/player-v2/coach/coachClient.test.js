import assert from 'node:assert/strict'
import test from 'node:test'

import { CoachRequestError, requestBridgeCoachTrial } from './coachClient.js'

function jsonResponse(body, status) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}

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
