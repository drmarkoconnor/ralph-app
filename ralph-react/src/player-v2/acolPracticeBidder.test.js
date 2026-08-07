import test from 'node:test'
import assert from 'node:assert/strict'
import { auctionProgress } from './bridgeV2.js'
import {
	choosePracticeAutoCall,
	practiceHandFacts,
} from './acolPracticeBidder.js'

function cards(specification) {
	return Object.entries(specification).flatMap(([suit, ranks]) =>
		Array.from(ranks).map((rank) => ({ suit, rank: rank === 'T' ? '10' : rank })),
	)
}

test('recorded calls are preferred while the practice prefix still agrees', () => {
	const choice = choosePracticeAutoCall({
		seat: 'N',
		dealer: 'N',
		hand: [],
		calls: [],
		recordedCalls: ['1H', 'P', '2H', 'P', 'P', 'P'],
	})
	assert.deepEqual(choice, {
		call: '1H',
		source: 'recorded-prefix',
		reason: 'Matches the recorded PBN auction while the practice prefix agrees.',
	})
})

test('local ACOL opens a balanced 12 point hand with 1NT', () => {
	const hand = cards({
		Spades: 'AK43',
		Hearts: 'QJ2',
		Diamonds: 'Q32',
		Clubs: '432',
	})
	assert.deepEqual(practiceHandFacts(hand), {
		hcp: 12,
		lengths: { S: 4, H: 3, D: 3, C: 3 },
		balanced: true,
	})
	const choice = choosePracticeAutoCall({ seat: 'N', dealer: 'N', hand, calls: [] })
	assert.equal(choice.call, '1NT')
	assert.equal(choice.source, 'local-acol')
})

test('local ACOL uses Stayman with response values and a four-card major', () => {
	const hand = cards({
		Spades: 'A432',
		Hearts: 'K32',
		Diamonds: 'J32',
		Clubs: '432',
	})
	const choice = choosePracticeAutoCall({
		seat: 'S',
		dealer: 'N',
		hand,
		calls: ['1NT', 'P'],
	})
	assert.equal(practiceHandFacts(hand).hcp, 8)
	assert.equal(choice.call, '2C')
	assert.equal(choice.source, 'local-acol')
})

test('after South diverges the local fallback does not force a recorded future call', () => {
	const choice = choosePracticeAutoCall({
		seat: 'W',
		dealer: 'N',
		hand: [],
		calls: ['1NT', 'P', '3NT'],
		recordedCalls: ['1NT', 'P', '2C', 'P', '2H', 'P', '3NT', 'P', 'P', 'P'],
	})
	assert.equal(choice.call, 'P')
	assert.equal(choice.source, 'local-acol')
})

test('strict auction progress handles passed-out, doubled, and post-terminal calls', () => {
	assert.deepEqual(auctionProgress('N', ['P', 'P', 'P', 'P']), {
		status: 'passed-out',
		terminal: true,
		valid: true,
		legal: false,
		calls: ['P', 'P', 'P', 'P'],
		nextSeat: null,
		contract: '',
		declarer: '',
	})
	const doubled = auctionProgress('N', ['1H', 'X', 'P', 'P', 'P'])
	assert.equal(doubled.status, 'complete')
	assert.equal(doubled.contract, '1HX')
	assert.equal(doubled.declarer, 'N')
	const afterTerminal = auctionProgress('N', ['1H', 'P', 'P', 'P', '2H'])
	assert.equal(afterTerminal.status, 'invalid')
	assert.equal(afterTerminal.invalidIndex, 4)
})

test('the bidder returns no call for the wrong seat or a finished auction', () => {
	assert.equal(
		choosePracticeAutoCall({ seat: 'E', dealer: 'N', hand: [], calls: [] }),
		null,
	)
	assert.equal(
		choosePracticeAutoCall({
			seat: 'N',
			dealer: 'N',
			hand: [],
			calls: ['1C', 'P', 'P', 'P'],
		}),
		null,
	)
})
