import test from 'node:test'
import assert from 'node:assert/strict'
import {
	DEFAULT_ACOL_SETTINGS,
	SEATS,
	createGenerator2SessionSnapshot,
	generateGenerator2Boards,
	hcp,
	suitLengths,
} from './generatorV2Engine.js'
import { validateAuction } from '../lib/bridgeCore.js'

function isLegalAuction(dealer, calls) {
	if (calls.length === 4 && calls.every((call) => call === 'P')) return true
	return validateAuction(dealer, calls).legal
}

function leftOf(seat) {
	return SEATS[(SEATS.indexOf(seat) + 1) % 4]
}

function partnerOf(seat) {
	return seat === 'N' ? 'S' : seat === 'S' ? 'N' : seat === 'E' ? 'W' : 'E'
}

function balanced(cards) {
	const pattern = Object.values(suitLengths(cards)).sort((a, b) => b - a).join('-')
	return pattern === '5-3-3-2' || pattern === '4-4-3-2' || pattern === '4-3-3-3'
}

function aceCount(cards) {
	return (cards || []).filter((card) => card.rank === 'A').length
}

function gerberResponse(cards) {
	const aces = aceCount(cards)
	if (aces === 1) return '4H'
	if (aces === 2) return '4S'
	if (aces === 3) return '4NT'
	return '4D'
}

function blackwoodResponse(cards) {
	const aces = aceCount(cards)
	if (aces === 1) return '5D'
	if (aces === 2) return '5H'
	if (aces === 3) return '5S'
	return '5C'
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
		'two_nt_opening',
		'strong_two_club',
		'two_nt_stayman',
		'two_nt_transfers',
		'weak_twos',
		'weak_threes',
		'overcalls',
		'takeout_double',
		'negative_double',
		'gerber_ace_asking',
		'blackwood_ace_asking',
		'fourth_suit_forcing',
		'game_ns',
		'major_fit_game',
		'slam_teaching',
	]) {
		for (const board of generatePreset(presetId, 8)) {
			const calls = board.auctionText.split(/\s+/).filter(Boolean)
			assert.ok(isLegalAuction(board.dealer, calls), `${presetId} made illegal auction ${board.auctionText}`)
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

test('strong notrump opening topics satisfy their point and shape promises', () => {
	for (const board of generatePreset('two_nt_opening', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		assert.equal(calls[0], '2NT')
		assert.ok(hcp(board.hands[board.dealer]) >= 20)
		assert.ok(hcp(board.hands[board.dealer]) <= 22)
		assert.ok(balanced(board.hands[board.dealer]))
	}
	for (const board of generatePreset('strong_two_club', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		assert.deepEqual(calls.slice(0, 5), ['2C', 'P', '2D', 'P', '2NT'])
		assert.ok(hcp(board.hands[board.dealer]) >= 23)
		assert.ok(balanced(board.hands[board.dealer]))
	}
})

test('2NT convention topics match Stayman and transfer requirements', () => {
	for (const board of generatePreset('two_nt_stayman', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		const dealerLengths = suitLengths(board.hands[board.dealer])
		const responderLengths = suitLengths(board.hands[partnerOf(board.dealer)])
		const expectedResponse = dealerLengths.H >= 4 ? '3H' : dealerLengths.S >= 4 ? '3S' : '3D'
		assert.deepEqual(calls.slice(0, 4), ['2NT', 'P', '3C', 'P'])
		assert.equal(calls[4], expectedResponse)
		assert.ok(hcp(board.hands[board.dealer]) >= 20)
		assert.ok(hcp(board.hands[board.dealer]) <= 22)
		assert.ok(balanced(board.hands[board.dealer]))
		assert.ok(responderLengths.H === 4 || responderLengths.S === 4)
		assert.ok(responderLengths.H <= 4)
		assert.ok(responderLengths.S <= 4)
	}
	for (const board of generatePreset('two_nt_transfers', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		const responderLengths = suitLengths(board.hands[partnerOf(board.dealer)])
		const target = responderLengths.H >= 5 ? 'H' : 'S'
		assert.equal(calls[0], '2NT')
		assert.equal(calls[2], target === 'H' ? '3D' : '3H')
		assert.equal(calls[4], `3${target}`)
		assert.ok(hcp(board.hands[board.dealer]) >= 20)
		assert.ok(hcp(board.hands[board.dealer]) <= 22)
		assert.ok(balanced(board.hands[board.dealer]))
		assert.ok(responderLengths[target] >= 5)
	}
})

test('overcall boards include an immediate overcall in a five-card suit', () => {
	for (const board of generatePreset('overcalls', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		const overcaller = leftOf(board.dealer)
		const openerSuit = calls[0].slice(1)
		const overcallSuit = calls[1].replace(/^[1-7]/, '')
		const overcallLevel = Number(calls[1][0])
		assert.match(calls[0], /^1[CDHS]$/)
		assert.match(calls[1], /^[12](C|D|H|S)$/)
		assert.notEqual(overcallSuit, openerSuit)
		assert.ok(suitLengths(board.hands[overcaller])[overcallSuit] >= 5)
		assert.ok(hcp(board.hands[overcaller]) >= (overcallLevel === 2 ? 10 : 8))
		assert.ok(hcp(board.hands[overcaller]) <= 16)
	}
})

test('negative double boards include the double and promised hearts', () => {
	for (const board of generatePreset('negative_double', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		const overcaller = leftOf(board.dealer)
		const responder = partnerOf(board.dealer)
		const dealerLengths = suitLengths(board.hands[board.dealer])
		const overcallerLengths = suitLengths(board.hands[overcaller])
		const responderLengths = suitLengths(board.hands[responder])
		assert.match(calls[0], /^1[CD]$/)
		assert.equal(calls[1], '1S')
		assert.equal(calls[2], 'X')
		assert.equal(calls[4], '2H')
		assert.ok(hcp(board.hands[board.dealer]) >= 12)
		assert.ok(dealerLengths.H >= 3)
		assert.ok(hcp(board.hands[overcaller]) >= 8)
		assert.ok(overcallerLengths.S >= 5)
		assert.ok(hcp(board.hands[responder]) >= 6)
		assert.ok(responderLengths.H >= 4)
	}
})

test('takeout double boards include the double and supporting takeout shape', () => {
	for (const board of generatePreset('takeout_double', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		const doubler = leftOf(board.dealer)
		const advancer = partnerOf(doubler)
		const openerSuit = calls[0].slice(1)
		const doublerLengths = suitLengths(board.hands[doubler])
		const advancerLengths = suitLengths(board.hands[advancer])
		const otherSuits = ['S', 'H', 'D', 'C'].filter((suit) => suit !== openerSuit)
		const advanceSuit = calls[3].replace(/^[1-7]/, '')
		assert.match(calls[0], /^1[CDHS]$/)
		assert.equal(calls[1], 'X')
		assert.match(calls[3], /^[12](C|D|H|S)$/)
		assert.ok(otherSuits.includes(advanceSuit))
		assert.ok(hcp(board.hands[doubler]) >= 12)
		assert.ok(doublerLengths[openerSuit] <= 2)
		assert.equal(otherSuits.filter((suit) => doublerLengths[suit] >= 3).length, 3)
		assert.ok(advancerLengths[advanceSuit] >= 4)
	}
})

test('ace-asking topics match Gerber and Blackwood response scales', () => {
	for (const board of generatePreset('gerber_ace_asking', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		const responder = partnerOf(board.dealer)
		assert.deepEqual(calls.slice(0, 4), ['1NT', 'P', '4C', 'P'])
		assert.equal(calls[4], gerberResponse(board.hands[board.dealer]))
		assert.ok(hcp(board.hands[board.dealer]) >= DEFAULT_ACOL_SETTINGS.oneNtMin)
		assert.ok(hcp(board.hands[board.dealer]) <= DEFAULT_ACOL_SETTINGS.oneNtMax)
		assert.ok(balanced(board.hands[board.dealer]))
		assert.ok(hcp(board.hands[responder]) >= 18)
		assert.ok(hcp(board.hands[board.dealer]) + hcp(board.hands[responder]) >= 31)
	}
	for (const board of generatePreset('blackwood_ace_asking', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		const responder = partnerOf(board.dealer)
		const trump = calls[0].slice(1)
		assert.match(calls[0], /^1[HS]$/)
		assert.equal(calls[2], `3${trump}`)
		assert.equal(calls[4], '4NT')
		assert.equal(calls[6], blackwoodResponse(board.hands[responder]))
		assert.equal(calls[8], `6${trump}`)
		assert.ok(suitLengths(board.hands[board.dealer])[trump] >= 5)
		assert.ok(suitLengths(board.hands[responder])[trump] >= 4)
		assert.ok(hcp(board.hands[board.dealer]) >= 16)
		assert.ok(hcp(board.hands[responder]) >= 12)
		assert.ok(aceCount(board.hands[board.dealer]) + aceCount(board.hands[responder]) >= 3)
	}
})

test('fourth-suit forcing boards follow the 1D-1H-1S-2C structure', () => {
	for (const board of generatePreset('fourth_suit_forcing', 16)) {
		const calls = board.auctionText.split(/\s+/).filter(Boolean)
		const responder = partnerOf(board.dealer)
		const dealerLengths = suitLengths(board.hands[board.dealer])
		const responderLengths = suitLengths(board.hands[responder])
		assert.deepEqual(calls.slice(0, 7), ['1D', 'P', '1H', 'P', '1S', 'P', '2C'])
		assert.equal(calls[8], '2NT')
		assert.equal(calls[10], '3NT')
		assert.ok(hcp(board.hands[board.dealer]) >= 15)
		assert.ok(hcp(board.hands[board.dealer]) <= 19)
		assert.ok(hcp(board.hands[responder]) >= 10)
		assert.ok(dealerLengths.D >= 4)
		assert.ok(dealerLengths.S >= 4)
		assert.ok(dealerLengths.H <= 3)
		assert.ok(responderLengths.H >= 4)
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
