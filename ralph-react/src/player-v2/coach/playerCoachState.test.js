import assert from 'node:assert/strict'
import test from 'node:test'

import {
	coachDecisionForState,
	coachOfferWasSeen,
	compactCoachReply,
	rememberCoachOffer,
} from './playerCoachState.js'

function baseState(overrides = {}) {
	return {
		board: { board: 1 },
		phase: 'auction',
		auctionIntroPending: false,
		manualContractMode: false,
		practiceAuction: { status: 'in-progress' },
		history: [],
		...overrides,
	}
}

test('Coach appears only for South live-practice bidding decisions', () => {
	const derived = { auctionView: 'practice', nextAuctionSeat: 'S' }
	assert.deepEqual(coachDecisionForState(baseState(), derived), {
		learnerSeat: 'S',
		decisionSeat: 'S',
		focusName: 'South',
		phase: 'auction',
	})
	assert.equal(
		coachDecisionForState(baseState(), { ...derived, auctionView: 'recorded' }),
		null,
	)
	assert.equal(
		coachDecisionForState(baseState(), { ...derived, nextAuctionSeat: 'E' }),
		null,
	)
	assert.equal(coachDecisionForState(baseState({ auctionIntroPending: true }), derived), null)
})

test('competition replay uses the same decision-time Coach eligibility', () => {
	const state = baseState({
		content: {
			kind: 'competition',
			packId: 'usbf-2026-open-final-segment-1',
		},
	})

	assert.deepEqual(
		coachDecisionForState(state, { auctionView: 'practice', nextAuctionSeat: 'S' }),
		{
			learnerSeat: 'S',
			decisionSeat: 'S',
			focusName: 'South',
			phase: 'auction',
		},
	)
})

test('Coach follows the learner-facing North hand after North-declarer rotation', () => {
	const state = baseState({
		phase: 'play',
		play: { turnSeat: 'S', trickComplete: false },
		history: [{ seat: 'E', card: { rank: '2', suit: 'Clubs' } }],
	})
	assert.deepEqual(
		coachDecisionForState(state, { declarer: 'N' }, new Set(['N', 'S'])),
		{
			learnerSeat: 'N',
			decisionSeat: 'S',
			focusName: 'North · play from dummy',
			phase: 'play',
		},
	)
})

test('Coach stays hidden while a computer acts or a completed trick is settling', () => {
	const state = baseState({ phase: 'play', play: { turnSeat: 'E', trickComplete: false } })
	assert.equal(coachDecisionForState(state, { declarer: 'E' }, new Set(['S'])), null)
	assert.equal(
		coachDecisionForState(
			{ ...state, play: { turnSeat: 'S', trickComplete: true } },
			{ declarer: 'E' },
			new Set(['S']),
		),
		null,
	)
})

test('compact reply shows the short nudge and only expands the principle on request', () => {
	const reply = { message: 'Notice: both defenders followed suit.', concept: 'Keep a running count.' }
	assert.equal(compactCoachReply(reply, 'nudge'), reply.message)
	assert.equal(
		compactCoachReply(reply, 'explain'),
		'Notice: both defenders followed suit.\n\nPrinciple: Keep a running count.',
	)
})

test('the sales prompt can be remembered without affecting Coach authorization', () => {
	const values = new Map()
	const storage = {
		getItem: (key) => values.get(key) || null,
		setItem: (key, value) => values.set(key, value),
	}
	assert.equal(coachOfferWasSeen(storage), false)
	rememberCoachOffer(storage)
	assert.equal(coachOfferWasSeen(storage), true)
})
