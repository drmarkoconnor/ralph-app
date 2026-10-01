import assert from 'node:assert/strict'
import test from 'node:test'

import {
	formatDealer4Hand,
	serializeDealer4Board,
	validateDealer4Deal,
} from './dealer4.js'

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

function monoSuitHands() {
	return {
		N: { S: [...RANKS], H: [], D: [], C: [] },
		E: { S: [], H: [...RANKS], D: [], C: [] },
		S: { S: [], H: [], D: [...RANKS], C: [] },
		W: { S: [], H: [], D: [], C: [...RANKS] },
	}
}

function board(overrides = {}) {
	return {
		event: 'Club “Teaching” ♥',
		site: 'Bristol Bridge Club',
		date: '2026.10.01',
		board: 2,
		dealer: 'E',
		vul: 'NS',
		dealPrefix: 'E',
		hands: monoSuitHands(),
		contract: { level: 7, strain: 'NT', dbl: '' },
		declarer: 'E',
		auctionStart: 'E',
		auction: ['7NT', 'P', 'P', 'P'],
		notes: ['This must not enter a Dealer4 file.'],
		ext: { system: 'ACOL', theme: 'Test' },
		...overrides,
	}
}

test('Dealer4 export uses the documented compact ASCII tag set', () => {
	const pbn = serializeDealer4Board(board())
	const lines = pbn.split('\r\n').filter(Boolean)

	assert.deepEqual(
		lines.map((line) => line.match(/^\[([^ ]+)/)?.[1]),
		['Event', 'Site', 'Date', 'Board', 'Dealer', 'Vulnerable', 'Deal'],
	)
	assert.match(pbn, /^\[Event "Club 'Teaching' H"\]\r\n/)
	assert.doesNotMatch(pbn, /\[(?:Note|Auction|Contract|Declarer|TagSpec)\b/)
	assert.ok(pbn.endsWith('\r\n\r\n'))
	assert.doesNotMatch(pbn.replaceAll('\r\n', ''), /\n/)
})

test('Dealer4 export writes voids as empty PBN suit fields and rotates from the prefix', () => {
	const pbn = serializeDealer4Board(board())

	assert.equal(formatDealer4Hand(monoSuitHands().N), 'AKQJT98765432...')
	assert.match(
		pbn,
		/\[Deal "E:\.AKQJT98765432\.\. \.\.AKQJT98765432\. \.\.\.AKQJT98765432 AKQJT98765432\.\.\."\]/,
	)
	assert.doesNotMatch(pbn, /-/)
})

test('Dealer4 export rejects incomplete and duplicate deals before download', () => {
	const incomplete = monoSuitHands()
	incomplete.N.S.pop()
	assert.throws(() => validateDealer4Deal(incomplete), /N must contain 13 cards/)

	const duplicate = monoSuitHands()
	duplicate.N.S[0] = 'K'
	assert.throws(() => validateDealer4Deal(duplicate), /duplicate card SK/)
})

test('consecutive Dealer4 boards remain separated by one blank CRLF line', () => {
	const pbn = serializeDealer4Board(board({ board: 1, dealer: 'N', dealPrefix: 'N' }))
		+ serializeDealer4Board(board({ board: 2 }))

	assert.equal((pbn.match(/\[Board /g) || []).length, 2)
	assert.match(pbn, /\]\r\n\r\n\[Event /)
})

