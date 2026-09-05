import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCoachDealFingerprint, canonicalCoachDeal } from './coachDealFingerprint.js'

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

function completeState() {
	const deck = SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })))
	return {
		board: { dealer: 'S', vul: 'NS' },
		hands: Object.fromEntries(
			['N', 'E', 'S', 'W'].map((seat, index) => [seat, deck.slice(index * 13, index * 13 + 13)]),
		),
	}
}

test('deal fingerprint is stable when card display order changes', async () => {
	const first = completeState()
	const reordered = completeState()
	reordered.hands.S.reverse()

	assert.equal(canonicalCoachDeal(first), canonicalCoachDeal(reordered))
	assert.equal(await buildCoachDealFingerprint(first), await buildCoachDealFingerprint(reordered))
	assert.match(await buildCoachDealFingerprint(first), /^[a-f0-9]{64}$/)
})

test('equivalent PBN vulnerability labels share a fingerprint', async () => {
	const first = completeState()
	first.board.vul = 'All'
	const second = completeState()
	second.board.vul = 'Both'

	assert.equal(await buildCoachDealFingerprint(first), await buildCoachDealFingerprint(second))
})

test('deal fingerprint changes with dealer, vulnerability, or card ownership', async () => {
	const original = completeState()
	const dealerChanged = completeState()
	dealerChanged.board.dealer = 'N'
	const vulnerabilityChanged = completeState()
	vulnerabilityChanged.board.vul = 'EW'
	const cardsChanged = completeState()
	const northCard = cardsChanged.hands.N[0]
	cardsChanged.hands.N[0] = cardsChanged.hands.E[0]
	cardsChanged.hands.E[0] = northCard

	const base = await buildCoachDealFingerprint(original)
	assert.notEqual(base, await buildCoachDealFingerprint(dealerChanged))
	assert.notEqual(base, await buildCoachDealFingerprint(vulnerabilityChanged))
	assert.notEqual(base, await buildCoachDealFingerprint(cardsChanged))
})

test('incomplete deals are rejected before a paid request', async () => {
	const state = completeState()
	state.hands.W.pop()

	assert.equal(canonicalCoachDeal(state), '')
	await assert.rejects(buildCoachDealFingerprint(state), /complete deal/i)
})

test('a duplicate card assignment is rejected before a paid request', async () => {
	const state = completeState()
	state.hands.W[0] = state.hands.N[0]

	assert.equal(canonicalCoachDeal(state), '')
	await assert.rejects(buildCoachDealFingerprint(state), /complete deal/i)
})
