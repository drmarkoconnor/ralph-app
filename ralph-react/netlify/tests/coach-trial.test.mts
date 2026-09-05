import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachAccessHandler } from '../functions/coach-access.mts'
import { createCoachTrialHandler } from '../functions/coach-trial.mts'
import {
	COACH_TRIAL_COOKIE,
	createTrialToken,
	serializeTrialCookie,
	validTrialSecret,
	verifyTrialToken,
} from '../functions/_shared/coach-trial-ledger.mts'

const SECRET = 'test-only-trial-secret-32-characters-minimum'

function sameOrigin(request: Request) {
	if (request.headers.get('origin') !== new URL(request.url).origin) throw new Error('bad origin')
}

function post(origin = 'https://ralph.example') {
	return new Request('https://ralph.example/api/coach/trial', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: origin },
		body: JSON.stringify({ intent: 'nudge', context: {} }),
	})
}

test('historical trial cookie remains signed, tamper-evident, and hardened', () => {
	assert.equal(validTrialSecret(SECRET), true)
	const id = 'A'.repeat(32)
	const token = createTrialToken(SECRET, id)
	assert.equal(verifyTrialToken(token, SECRET), id)
	const tamperedFinalCharacter = token.endsWith('A') ? 'B' : 'A'
	assert.equal(verifyTrialToken(`${token.slice(0, -1)}${tamperedFinalCharacter}`, SECRET), null)

	const cookie = serializeTrialCookie(token)
	assert.match(cookie, new RegExp(`^${COACH_TRIAL_COOKIE}=`))
	assert.match(cookie, /; Path=\//)
	assert.match(cookie, /; HttpOnly/)
	assert.match(cookie, /; Secure/)
	assert.match(cookie, /; SameSite=Lax/)
	assert.doesNotMatch(cookie, /Domain=/)
})

test('anonymous trial endpoint is permanently retired after method and origin checks', async () => {
	const trial = createCoachTrialHandler({ verifyOrigin: sameOrigin })
	assert.equal((await trial(new Request('https://ralph.example/api/coach/trial'), {})).status, 405)
	assert.equal((await trial(post('https://attacker.example'), {})).status, 403)

	const retired = await trial(post(), {})
	assert.equal(retired.status, 410)
	const payload = await retired.json()
	assert.equal(payload.code, 'trial_retired')
	assert.equal(payload.trialAvailable, false)
	assert.equal(payload.accessRequired, true)
})

test('access endpoint reports the trial retired even when stale trial environment values remain', async () => {
	const settings: Record<string, string> = {
		COACH_ENABLED: 'true',
		OPENAI_API_KEY: 'test-key-never-sent',
		COACH_TRIAL_ENABLED: 'true',
		COACH_TRIAL_SECRET: SECRET,
		COACH_TRIAL_DAILY_CAP: '250',
	}
	const access = createCoachAccessHandler({
		env: (name) => settings[name],
		identityUser: async () => null,
	})
	const response = await access(new Request('https://ralph.example/api/coach/access'), {})
	assert.equal(response.status, 200)
	const payload = await response.json()
	assert.equal(payload.access, 'none')
	assert.equal(payload.authorized, false)
	assert.deepEqual(payload.trial, { enabled: false, available: false, status: 'retired' })
})
