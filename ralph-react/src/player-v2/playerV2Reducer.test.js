import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialManualState, playCardManual } from '../lib/manualPlayEngine.js'
import { orderHandForDisplay } from './bridgeV2.js'
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

function makeAuctionState() {
	return {
		...initialPlayerV2State,
		board: { dealer: 'N', vul: 'None' },
		hands: makeHands(),
		auction: {
			dealer: 'N',
			contract: '1NT',
			declarer: 'W',
			calls: ['1NT', 'P', 'P', 'P'],
		},
		phase: 'auction',
	}
}

function makeBoard(board, dealer) {
	return {
		board,
		dealer,
		vul: 'None',
		deal: `${dealer}:A... K... Q... J...`,
		contract: '1NT',
		declarer: 'S',
	}
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

test('start play is blocked until the auction is confirmed', () => {
	const state = makeAuctionState()
	const next = playerV2Reducer(state, { type: 'START_PLAY' })

	assert.equal(next.phase, 'auction')
	assert.equal(next.play, null)
	assert.match(next.status, /Confirm the auction/)
})

test('confirmed play starts with automation paused for teacher pacing', () => {
	const state = makeAuctionState()
	const confirmed = playerV2Reducer(state, { type: 'CONFIRM_AUCTION' })
	const started = playerV2Reducer(confirmed, { type: 'START_PLAY' })

	assert.equal(confirmed.phase, 'confirmed')
	assert.equal(started.phase, 'play')
	assert.equal(started.autoPlayPaused, true)
	assert.equal(started.play.turnSeat, 'N')
	assert.match(started.status, /Automatic play paused/)
})

test('replay hand restores the original deal and opening leader', () => {
	const confirmed = playerV2Reducer(makeAuctionState(), { type: 'CONFIRM_AUCTION' })
	const started = playerV2Reducer(confirmed, { type: 'START_PLAY' })
	const openingCard = started.play.remaining.N[0]
	const progressed = playerV2Reducer(started, {
		type: 'PLAY_CARD',
		seat: 'N',
		cardId: openingCard.id,
	})
	const replayed = playerV2Reducer(progressed, { type: 'START_PLAY' })

	assert.equal(progressed.history.length, 1)
	assert.equal(replayed.phase, 'play')
	assert.equal(replayed.history.length, 0)
	assert.equal(replayed.completedTricks.length, 0)
	assert.equal(replayed.play.turnSeat, 'N')
	assert.equal(replayed.autoPlayPaused, true)
	assert.deepEqual(replayed.visibleSeats, ['W'])
	for (const seat of ['N', 'E', 'S', 'W']) {
		assert.equal(replayed.play.remaining[seat].length, 13)
	}
})

test('dummy display starts with trumps, or clubs in no-trumps', () => {
	const cards = [
		{ id: 'S2', suit: 'Spades', rank: '2' },
		{ id: 'SA', suit: 'Spades', rank: 'A' },
		{ id: 'H3', suit: 'Hearts', rank: '3' },
		{ id: 'D4', suit: 'Diamonds', rank: '4' },
		{ id: 'C5', suit: 'Clubs', rank: '5' },
	]
	const expected = {
		Spades: ['Spades', 'Spades', 'Hearts', 'Clubs', 'Diamonds'],
		Hearts: ['Hearts', 'Spades', 'Spades', 'Diamonds', 'Clubs'],
		Diamonds: ['Diamonds', 'Spades', 'Spades', 'Hearts', 'Clubs'],
		Clubs: ['Clubs', 'Hearts', 'Spades', 'Spades', 'Diamonds'],
		null: ['Clubs', 'Hearts', 'Spades', 'Spades', 'Diamonds'],
	}

	for (const trump of ['Spades', 'Hearts', 'Diamonds', 'Clubs', null]) {
		const ordered = orderHandForDisplay(cards, { isDummy: true, inPlay: true, trump })
		assert.deepEqual(
			ordered.map((card) => card.suit),
			expected[String(trump)],
		)
	}

	assert.deepEqual(
		orderHandForDisplay(cards, { isDummy: false, inPlay: true, trump: 'Hearts' }).map(
			(card) => card.suit,
		),
		['Spades', 'Spades', 'Hearts', 'Diamonds', 'Clubs'],
	)
	assert.deepEqual(
		orderHandForDisplay(cards, { isDummy: true, inPlay: false, trump: 'Hearts' }).map(
			(card) => card.suit,
		),
		['Spades', 'Spades', 'Hearts', 'Diamonds', 'Clubs'],
	)
	assert.deepEqual(
		orderHandForDisplay(cards, { isDummy: true, inPlay: true, trump: 'Spades' })
			.filter((card) => card.suit === 'Spades')
			.map((card) => card.rank),
		['A', '2'],
	)
})

test('editing a confirmed contract requires confirmation again', () => {
	const state = makeAuctionState()
	const confirmed = playerV2Reducer(state, { type: 'CONFIRM_AUCTION' })
	const edited = playerV2Reducer(confirmed, {
		type: 'SET_MANUAL_CONTRACT',
		field: 'level',
		value: '2',
	})

	assert.equal(edited.phase, 'auction')
	assert.match(edited.status, /Confirm it again/)
	assert.equal(playerV2Reducer(edited, { type: 'START_PLAY' }).play, null)
})

test('board navigation restores each board session without leaking hand reveals', () => {
	let state = playerV2Reducer(initialPlayerV2State, {
		type: 'LOAD_DEALS',
		deals: [makeBoard(1, 'N'), makeBoard(2, 'E')],
		name: 'lesson.pbn',
	})
	state = playerV2Reducer(state, { type: 'SET_VISIBLE_SEAT', seat: 'W' })
	state = playerV2Reducer(state, {
		type: 'SET_MANUAL_CONTRACT',
		field: 'level',
		value: '2',
	})
	state = playerV2Reducer(state, {
		type: 'SET_MANUAL_CONTRACT',
		field: 'strain',
		value: 'H',
	})
	state = playerV2Reducer(state, { type: 'CONFIRM_AUCTION' })

	const boardTwo = playerV2Reducer(state, { type: 'GO_BOARD', index: 1 })
	assert.equal(boardTwo.index, 1)
	assert.equal(boardTwo.visibleSeat, 'E')
	assert.deepEqual(boardTwo.visibleSeats, ['E'])
	assert.equal(boardTwo.manualContract.level, '')

	const restoredBoardOne = playerV2Reducer(boardTwo, { type: 'GO_BOARD', index: 0 })
	assert.equal(restoredBoardOne.phase, 'confirmed')
	assert.equal(restoredBoardOne.manualContract.level, '2')
	assert.equal(restoredBoardOne.manualContract.strain, 'H')
	assert.deepEqual(restoredBoardOne.visibleSeats, ['W'])
})

test('auto-play pause can be toggled', () => {
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
