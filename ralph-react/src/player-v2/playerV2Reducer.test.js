import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialManualState, playCardManual } from '../lib/manualPlayEngine.js'
import { initialPlayerV2State, playerV2Reducer } from './playerV2Reducer.js'

function clubCard(id, owner, rank) {
	return {
		id,
		owner,
		suit: 'Clubs',
		suitKey: 'C',
		rank,
		label: `${rank}C`,
	}
}

function makeHands() {
	let id = 1
	const hands = { N: [], E: [], S: [], W: [] }
	for (let i = 0; i < 13; i++) {
		hands.N.push(clubCard(id++, 'N', 'A'))
		hands.E.push(clubCard(id++, 'E', '2'))
		hands.S.push(clubCard(id++, 'S', '3'))
		hands.W.push(clubCard(id++, 'W', '4'))
	}
	return hands
}

function buildStateOneCardFromFinished() {
	const hands = makeHands()
	let play = createInitialManualState(hands, 'N', null, 'W')
	const history = []
	const order = ['N', 'E', 'S', 'W']
	for (let trick = 0; trick < 13; trick++) {
		for (const seat of order) {
			const card = play.remaining[seat][0]
			if (trick === 12 && seat === 'W') {
				return { hands, play, history, finalSeat: seat, finalCard: card }
			}
			const result = playCardManual(play, seat, card.id)
			assert.equal(result.ok, true)
			history.push({ seat, cardId: card.id, card })
			play = result.state
		}
	}
	throw new Error('Expected to stop before final card')
}

test('finished play automatically pauses automation for review', () => {
	const { hands, play, history, finalSeat, finalCard } = buildStateOneCardFromFinished()
	const state = {
		...initialPlayerV2State,
		board: { dealer: 'N', vul: 'None' },
		hands,
		auction: { contract: '1NT', declarer: 'W', calls: ['1NT', 'P', 'P', 'P'] },
		phase: 'play',
		play,
		history,
		completedTricks: [],
		autoPlayPaused: false,
	}
	const next = playerV2Reducer(state, {
		type: 'PLAY_CARD',
		seat: finalSeat,
		cardId: finalCard.id,
	})
	assert.equal(next.history.length, 52)
	assert.equal(next.completedTricks.length, 13)
	assert.equal(next.autoPlayPaused, true)
	assert.match(next.status, /Automatic play paused/)

	const undone = playerV2Reducer(next, { type: 'UNDO_CARD' })
	assert.equal(undone.history.length, 51)
	assert.equal(undone.autoPlayPaused, true)
})

test('auto-play pause can be toggled and new play resets it', () => {
	const paused = playerV2Reducer(initialPlayerV2State, {
		type: 'SET_AUTO_PLAY_PAUSED',
		paused: true,
	})
	assert.equal(paused.autoPlayPaused, true)
	assert.match(paused.status, /paused/)

	const resumed = playerV2Reducer(paused, {
		type: 'SET_AUTO_PLAY_PAUSED',
		paused: false,
	})
	assert.equal(resumed.autoPlayPaused, false)
	assert.match(resumed.status, /resumed/)
})
