import test from 'node:test'
import assert from 'node:assert/strict'
import {
	DEFAULT_ACOL_SETTINGS,
	createGenerator2SessionSnapshot,
	generateGenerator2Boards,
	hcp,
	suitLengths,
} from './generatorV2Engine.js'

const BID_RE = /^([1-7])(C|D|H|S|NT)$/
const STRAIN_ORDER = { C: 0, D: 1, H: 2, S: 3, NT: 4 }

function bidValue(call) {
	const match = String(call).match(BID_RE)
	if (!match) return null
	return Number(match[1]) * 5 + STRAIN_ORDER[match[2]]
}

function isClosed(calls) {
	if (calls.length === 4 && calls.every((call) => call === 'P')) return true
	if (!calls.some((call) => BID_RE.test(call))) return false
	return calls.length >= 4 && calls.slice(-3).every((call) => call === 'P')
}

function isLegalAuction(calls) {
	let lastBid = null
	for (const call of calls) {
		if (call === 'P') continue
		const value = bidValue(call)
		if (value === null) return false
		if (lastBid !== null && value <= lastBid) return false
		lastBid = value
	}
	return isClosed(calls)
}

function generatePreset(presetId, count = 12) {
	const result = generateGenerator2Boards({
		presetId,
		count,
		auctionMode: 'auto',
		acolSettings: DEFAULT_ACOL_SETTINGS,
		seen: new Set(),
	})
	assert.equal(result.warnings.length, 0, `${presetId} should not fall back`)
	assert.equal(result.boards.length, count)
	return result.boards
}

test('automatic auctions are legally ascending and closed for core teaching presets', () => {
	for (const presetId of [
		'one_nt_mixed',
		'stayman',
		'transfers',
		'weak_twos',
		'weak_threes',
		'game_ns',
		'major_fit_game',
		'slam_teaching',
	]) {
		for (const board of generatePreset(presetId, 8)) {
			const calls = board.auctionText.split(/\s+/).filter(Boolean)
			assert.ok(isLegalAuction(calls), `${presetId} made illegal auction ${board.auctionText}`)
		}
	}
})

test('weak-two boards open at the two level in a six-card major', () => {
	for (const board of generatePreset('weak_twos', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		assert.match(calls[0], /^2[HS]$/)
		assert.notEqual(calls.join(' '), 'P P P P')
		const lengths = suitLengths(board.hands[board.dealer])
		const suit = calls[0].slice(1)
		assert.ok(lengths[suit] >= 6, `dealer should have six-card ${suit}`)
		assert.ok(hcp(board.hands[board.dealer]) >= 6)
		assert.ok(hcp(board.hands[board.dealer]) <= 10)
	}
})

test('weak-three boards open at the three level in a seven-card suit', () => {
	for (const board of generatePreset('weak_threes', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		assert.match(calls[0], /^3[CDHS]$/)
		const lengths = suitLengths(board.hands[board.dealer])
		const suit = calls[0].slice(1)
		assert.ok(lengths[suit] >= 7, `dealer should have seven-card ${suit}`)
		assert.ok(hcp(board.hands[board.dealer]) >= 5)
		assert.ok(hcp(board.hands[board.dealer]) <= 10)
	}
})

test('1NT response topics start from the expected ACOL structure', () => {
	for (const board of generatePreset('one_nt_mixed', 8)) {
		assert.equal(board.auction[0], '1NT')
	}
	for (const board of generatePreset('stayman', 8)) {
		assert.deepEqual(board.auction.slice(0, 3), ['1NT', 'P', '2C'])
	}
	for (const board of generatePreset('transfers', 8)) {
		assert.equal(board.auction[0], '1NT')
		assert.match(board.auction[2], /^2[DH]$/)
	}
})

test('string start board values are treated as numbers', () => {
	const result = generateGenerator2Boards({
		presetId: 'random_deal',
		count: 3,
		startBoard: '10',
		auctionMode: 'blank',
		acolSettings: DEFAULT_ACOL_SETTINGS,
		seen: new Set(),
	})
	assert.deepEqual(result.boards.map((board) => board.number), [10, 11, 12])
	assert.deepEqual(result.boards.map((board) => board.dealer), ['E', 'S', 'W'])
})

test('suggest mode offers an auction without forcing export auction text', () => {
	const result = generateGenerator2Boards({
		presetId: 'stayman',
		count: 1,
		auctionMode: 'suggest',
		acolSettings: DEFAULT_ACOL_SETTINGS,
		seen: new Set(),
	})
	const [board] = result.boards
	assert.equal(board.auctionText, '')
	assert.deepEqual(board.auction, [])
	assert.deepEqual(board.suggestedAuction.slice(0, 3), ['1NT', 'P', '2C'])
	assert.match(board.suggestedAuctionText, /^1NT P 2C/)
})

test('generator session snapshot preserves accepted auction edits for back navigation', () => {
	const result = generateGenerator2Boards({
		presetId: 'one_nt_mixed',
		count: 1,
		auctionMode: 'suggest',
		acolSettings: DEFAULT_ACOL_SETTINGS,
		seen: new Set(),
	})
	const editedBoard = {
		...result.boards[0],
		auctionText: '1NT P 3NT P P P',
	}
	const snapshot = createGenerator2SessionSnapshot({
		presetId: 'one_nt_mixed',
		count: 1,
		startBoard: 1,
		dealerMode: 'cycle',
		dealerSeat: 'N',
		auctionMode: 'suggest',
		dealer4Mode: true,
		meta: { event: 'Lesson', site: 'Club', date: '2026.05.10' },
		acolSettings: DEFAULT_ACOL_SETTINGS,
		constraints: {},
		boards: [editedBoard],
		warnings: [],
		status: 'Ready',
	})
	const restored = JSON.parse(JSON.stringify(snapshot))
	assert.equal(restored.boards[0].auctionText, '1NT P 3NT P P P')
	assert.equal(restored.boards[0].suggestedAuctionText, result.boards[0].suggestedAuctionText)
	assert.equal(restored.auctionMode, 'suggest')
})
