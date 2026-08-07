import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialManualState, playCardManual } from '../lib/manualPlayEngine.js'
import { orderHandForDisplay } from './bridgeV2.js'
import {
	getPlayerV2Derived,
	initialPlayerV2State,
	playerV2Reducer,
} from './playerV2Reducer.js'

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

test('confirmed play starts with computer-controlled seats enabled', () => {
	const state = makeAuctionState()
	const confirmed = playerV2Reducer(state, { type: 'CONFIRM_AUCTION' })
	const started = playerV2Reducer(confirmed, { type: 'START_PLAY' })

	assert.equal(confirmed.phase, 'confirmed')
	assert.deepEqual(confirmed.visibleSeats, ['S'])
	assert.equal(started.phase, 'play')
	assert.equal(started.autoPlayPaused, false)
	assert.equal(started.play.turnSeat, 'N')
	assert.match(started.status, /play automatically/)
})

test('North declarer is visible at the learner position while South dummy waits for the lead', () => {
	const state = {
		...makeAuctionState(),
		auction: {
			dealer: 'N',
			contract: '1NT',
			declarer: 'N',
			calls: ['1NT', 'P', 'P', 'P'],
		},
	}
	const confirmed = playerV2Reducer(state, { type: 'CONFIRM_AUCTION' })
	const started = playerV2Reducer(confirmed, { type: 'START_PLAY' })

	assert.deepEqual(confirmed.visibleSeats, ['N'])
	assert.equal(started.play.turnSeat, 'E')
	assert.deepEqual(started.visibleSeats, ['N'])

	const openingCard = started.play.remaining.E[0]
	const afterLead = playerV2Reducer(started, {
		type: 'PLAY_CARD',
		seat: 'E',
		cardId: openingCard.id,
	})
	assert.deepEqual(afterLead.visibleSeats.sort(), ['N', 'S'])
})

test('recorded comparison cannot confirm or start the preserved practice contract', () => {
	const state = { ...makeAuctionState(), auctionView: 'recorded' }
	const blockedConfirm = playerV2Reducer(state, { type: 'CONFIRM_AUCTION' })
	assert.equal(blockedConfirm.phase, 'auction')
	assert.match(blockedConfirm.status, /Return to Play as South/)

	const confirmedPractice = playerV2Reducer(
		{ ...state, auctionView: 'practice' },
		{ type: 'CONFIRM_AUCTION' },
	)
	const blockedStart = playerV2Reducer(
		{ ...confirmedPractice, auctionView: 'recorded' },
		{ type: 'START_PLAY' },
	)
	assert.equal(blockedStart.phase, 'confirmed')
	assert.equal(blockedStart.play, null)
	assert.match(blockedStart.status, /Return to Play as South/)
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
	assert.equal(replayed.autoPlayPaused, false)
	assert.deepEqual(replayed.visibleSeats, ['S'])
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
	state = playerV2Reducer(state, {
		type: 'SET_MANUAL_CONTRACT',
		field: 'declarer',
		value: 'S',
	})
	state = playerV2Reducer(state, { type: 'CONFIRM_AUCTION' })

	const boardTwo = playerV2Reducer(state, { type: 'GO_BOARD', index: 1 })
	assert.equal(boardTwo.index, 1)
	assert.equal(boardTwo.visibleSeat, 'S')
	assert.deepEqual(boardTwo.visibleSeats, ['S'])
	assert.equal(boardTwo.manualContract.level, '')

	const restoredBoardOne = playerV2Reducer(boardTwo, { type: 'GO_BOARD', index: 0 })
	assert.equal(restoredBoardOne.phase, 'confirmed')
	assert.equal(restoredBoardOne.manualContract.level, '2')
	assert.equal(restoredBoardOne.manualContract.strain, 'H')
	assert.deepEqual(restoredBoardOne.visibleSeats, ['S'])
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

test('loading a PBN preserves an immutable reference and starts a blank South practice auction', () => {
	const recordedCalls = ['1NT', 'P', '2C', 'P', '2H', 'P', '3NT', 'P', 'P', 'P']
	const board = {
		...makeBoard(7, 'N'),
		auctionDealer: 'N',
		auction: recordedCalls,
		contract: '3NT',
		declarer: 'N',
	}
	const state = playerV2Reducer(initialPlayerV2State, {
		type: 'LOAD_DEALS',
		deals: [board],
		name: 'recorded.pbn',
	})

	assert.equal(state.auctionView, 'practice')
	assert.deepEqual(state.practiceAuction.calls, [])
	assert.strictEqual(state.auction, state.practiceAuction)
	assert.deepEqual(state.recordedAuction.calls, recordedCalls)
	assert.equal(Object.isFrozen(state.recordedAuction), true)
	assert.equal(Object.isFrozen(state.recordedAuction.calls), true)
	assert.deepEqual(state.auctionCursors, { practice: 0, recorded: 0 })
	assert.equal(state.visibleSeat, 'S')
	assert.deepEqual(state.visibleSeats, ['S'])
	assert.equal(getPlayerV2Derived(state).contract, '')
	assert.equal(getPlayerV2Derived(state).declarer, '')
})

test('only South can make learner calls and automatic calls reject stale positions', () => {
	let state = playerV2Reducer(initialPlayerV2State, {
		type: 'LOAD_DEALS',
		deals: [makeBoard(1, 'N')],
	})
	state = playerV2Reducer(state, { type: 'AUCTION_SOUTH_CALL', call: '1H' })
	assert.deepEqual(state.practiceAuction.calls, [])
	assert.match(state.status, /N must bid/)

	state = playerV2Reducer(state, {
		type: 'AUCTION_AUTO_CALL',
		call: '1NT',
		expectedSeat: 'N',
		expectedRevision: 0,
		source: 'recorded-prefix',
	})
	assert.deepEqual(state.practiceAuction.calls, ['1NT'])
	assert.equal(state.practiceAuction.revision, 1)

	const stale = playerV2Reducer(state, {
		type: 'AUCTION_AUTO_CALL',
		call: 'P',
		expectedSeat: 'E',
		expectedRevision: 0,
	})
	assert.deepEqual(stale.practiceAuction.calls, ['1NT'])
	assert.match(stale.status, /stale automatic bid/)

	state = playerV2Reducer(state, {
		type: 'AUCTION_AUTO_CALL',
		call: 'P',
		expectedSeat: 'E',
		expectedRevision: 1,
	})
	state = playerV2Reducer(state, { type: 'AUCTION_SOUTH_CALL', call: '2C' })
	assert.deepEqual(state.practiceAuction.calls, ['1NT', 'P', '2C'])
	assert.deepEqual(state.practiceAuction.callSources, [
		'recorded-prefix',
		'auto',
		'south',
	])
})

test('recorded comparison has its own cursor and never replaces practice progress', () => {
	const board = {
		...makeBoard(2, 'S'),
		auctionDealer: 'S',
		auction: ['1NT', 'P', '3NT', 'P', 'P', 'P'],
		contract: '3NT',
		declarer: 'S',
	}
	let state = playerV2Reducer(initialPlayerV2State, {
		type: 'LOAD_DEALS',
		deals: [board],
	})
	state = playerV2Reducer(state, { type: 'AUCTION_SOUTH_CALL', call: '1C' })
	const practiceBefore = state.practiceAuction
	const recordedBefore = state.recordedAuction

	state = playerV2Reducer(state, { type: 'SET_AUCTION_VIEW', view: 'recorded' })
	state = playerV2Reducer(state, { type: 'AUCTION_NEXT' })
	state = playerV2Reducer(state, { type: 'AUCTION_NEXT' })
	assert.equal(state.auctionCursors.recorded, 2)
	assert.equal(state.auctionCursors.practice, 1)
	assert.strictEqual(state.practiceAuction, practiceBefore)
	assert.strictEqual(state.recordedAuction, recordedBefore)

	state = playerV2Reducer(state, { type: 'AUCTION_RESTORE_PBN' })
	assert.deepEqual(state.practiceAuction.calls, ['1C'])
	assert.equal(state.auctionCursors.recorded, board.auction.length)

	state = playerV2Reducer(state, { type: 'RESTART_PRACTICE_AUCTION' })
	assert.deepEqual(state.practiceAuction.calls, [])
	assert.strictEqual(state.recordedAuction, recordedBefore)
	assert.equal(state.auctionView, 'practice')
	assert.equal(state.practiceAuction.revision, practiceBefore.revision + 1)
})

test('four opening passes end as passed out and cannot accept another call', () => {
	let state = playerV2Reducer(initialPlayerV2State, {
		type: 'LOAD_DEALS',
		deals: [makeBoard(3, 'N')],
	})
	for (const [expectedSeat, isSouth] of [
		['N', false],
		['E', false],
		['S', true],
		['W', false],
	]) {
		state = playerV2Reducer(
			state,
			isSouth
				? { type: 'AUCTION_SOUTH_CALL', call: 'P' }
				: {
						type: 'AUCTION_AUTO_CALL',
						call: 'P',
						expectedSeat,
						expectedRevision: state.practiceAuction.revision,
					},
		)
	}

	assert.equal(state.practiceAuction.status, 'passed-out')
	assert.equal(state.practiceAuction.terminal, true)
	assert.deepEqual(state.practiceAuction.calls, ['P', 'P', 'P', 'P'])
	assert.equal(getPlayerV2Derived(state).contract, '')
	const unchanged = playerV2Reducer(state, { type: 'AUCTION_SOUTH_CALL', call: '1C' })
	assert.deepEqual(unchanged.practiceAuction.calls, ['P', 'P', 'P', 'P'])
	assert.match(unchanged.status, /auction has ended/)
})

test('practice contract remains authoritative while the recorded auction is displayed', () => {
	const board = {
		...makeBoard(4, 'S'),
		auctionDealer: 'S',
		auction: ['4S', 'P', 'P', 'P'],
		contract: '4S',
		declarer: 'S',
	}
	let state = playerV2Reducer(initialPlayerV2State, {
		type: 'LOAD_DEALS',
		deals: [board],
	})
	assert.equal(getPlayerV2Derived(state).contract, '')
	state = playerV2Reducer(state, { type: 'AUCTION_SOUTH_CALL', call: '1NT' })
	for (const expectedSeat of ['W', 'N', 'E']) {
		state = playerV2Reducer(state, {
			type: 'AUCTION_AUTO_CALL',
			call: 'P',
			expectedSeat,
			expectedRevision: state.practiceAuction.revision,
		})
	}
	assert.equal(getPlayerV2Derived(state).contract, '1NT')
	assert.equal(getPlayerV2Derived(state).declarer, 'S')

	state = playerV2Reducer(state, { type: 'SET_AUCTION_VIEW', view: 'recorded' })
	assert.equal(getPlayerV2Derived(state).contract, '1NT')
	assert.equal(getPlayerV2Derived(state).displayedAuction.contract, '4S')
})

test('board sessions restore the independent practice auction', () => {
	let state = playerV2Reducer(initialPlayerV2State, {
		type: 'LOAD_DEALS',
		deals: [makeBoard(5, 'S'), makeBoard(6, 'E')],
	})
	state = playerV2Reducer(state, { type: 'AUCTION_SOUTH_CALL', call: '1H' })
	state = playerV2Reducer(state, { type: 'GO_BOARD', index: 1 })
	assert.deepEqual(state.practiceAuction.calls, [])
	state = playerV2Reducer(state, { type: 'GO_BOARD', index: 0 })
	assert.deepEqual(state.practiceAuction.calls, ['1H'])
	assert.strictEqual(state.auction, state.practiceAuction)
})
