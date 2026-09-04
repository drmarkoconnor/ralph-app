import test from 'node:test'
import assert from 'node:assert/strict'
import {
	exitPlayerFullscreen,
	playerAcquiredFullscreen,
	requestPlayerFullscreen,
} from './playerPresentation.js'

test('playerAcquiredFullscreen distinguishes a new fullscreen surface from an existing one', () => {
	const requestedElement = {}
	assert.equal(
		playerAcquiredFullscreen({ ok: true, outcome: 'success' }, requestedElement, requestedElement),
		true,
	)
	assert.equal(
		playerAcquiredFullscreen({ ok: true, outcome: 'success' }, null, requestedElement),
		false,
	)
	assert.equal(
		playerAcquiredFullscreen({ ok: true, outcome: 'success' }, {}, requestedElement),
		false,
	)
	assert.equal(
		playerAcquiredFullscreen(
			{ ok: true, outcome: 'already-active' },
			requestedElement,
			requestedElement,
		),
		false,
	)
	assert.equal(
		playerAcquiredFullscreen({ ok: false, outcome: 'denied' }, null, requestedElement),
		false,
	)
	assert.equal(playerAcquiredFullscreen(null, null, requestedElement), false)
})

test('requestPlayerFullscreen requests fullscreen on the document element', async () => {
	let receiver = null
	const documentElement = {
		async requestFullscreen() {
			receiver = this
		},
	}
	const outcome = await requestPlayerFullscreen({
		fullscreenElement: null,
		documentElement,
	})

	assert.deepEqual(outcome, { ok: true, outcome: 'success' })
	assert.strictEqual(receiver, documentElement)
})

test('requestPlayerFullscreen is a successful no-op when fullscreen is already active', async () => {
	let called = false
	const fullscreenElement = {}
	const outcome = await requestPlayerFullscreen({
		fullscreenElement,
		documentElement: {
			requestFullscreen() {
				called = true
			},
		},
	})

	assert.deepEqual(outcome, { ok: true, outcome: 'already-active' })
	assert.equal(called, false)
})

test('requestPlayerFullscreen reports unsupported documents', async () => {
	assert.deepEqual(await requestPlayerFullscreen(null), {
		ok: false,
		outcome: 'unsupported',
	})
	assert.deepEqual(await requestPlayerFullscreen({ documentElement: {} }), {
		ok: false,
		outcome: 'unsupported',
	})
})

test('requestPlayerFullscreen reports a denied request without throwing', async () => {
	const error = new Error('Fullscreen permission denied')
	const outcome = await requestPlayerFullscreen({
		fullscreenElement: null,
		documentElement: {
			requestFullscreen() {
				throw error
			},
		},
	})

	assert.deepEqual(outcome, { ok: false, outcome: 'denied', error })
})

test('exitPlayerFullscreen exits an active fullscreen document', async () => {
	let receiver = null
	const documentRef = {
		fullscreenElement: {},
		async exitFullscreen() {
			receiver = this
		},
	}
	const outcome = await exitPlayerFullscreen(documentRef)

	assert.deepEqual(outcome, { ok: true, outcome: 'success' })
	assert.strictEqual(receiver, documentRef)
})

test('exitPlayerFullscreen is a successful no-op when already windowed', async () => {
	let called = false
	const outcome = await exitPlayerFullscreen({
		fullscreenElement: null,
		exitFullscreen() {
			called = true
		},
	})

	assert.deepEqual(outcome, { ok: true, outcome: 'already-inactive' })
	assert.equal(called, false)
})

test('exitPlayerFullscreen reports unsupported active documents', async () => {
	assert.deepEqual(await exitPlayerFullscreen(null), {
		ok: false,
		outcome: 'unsupported',
	})
	assert.deepEqual(await exitPlayerFullscreen({ fullscreenElement: {} }), {
		ok: false,
		outcome: 'unsupported',
	})
})

test('exitPlayerFullscreen reports exit failure without throwing', async () => {
	const error = new Error('Fullscreen exit failed')
	const outcome = await exitPlayerFullscreen({
		fullscreenElement: {},
		exitFullscreen() {
			return Promise.reject(error)
		},
	})

	assert.deepEqual(outcome, { ok: false, outcome: 'exit-failure', error })
})
