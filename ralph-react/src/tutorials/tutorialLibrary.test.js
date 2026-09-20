import test from 'node:test'
import assert from 'node:assert/strict'

import { parsePBN } from '../lib/pbn.js'
import { stableDealToHands } from '../player-v2/bridgeV2.js'
import {
	tutorialCardKey,
	tutorialCurriculum,
	tutorialLessons,
	tutorialPbn,
	validateTutorialLibrary,
} from './tutorialLibrary.js'
import { visibleTutorialHolding } from './tutorialGuidance.js'

test('tutorial course contains a broad original curriculum', () => {
	assert.ok(tutorialLessons.length >= 40)
	assert.equal(new Set(tutorialLessons.map((lesson) => lesson.id)).size, tutorialLessons.length)
	for (const group of tutorialCurriculum) {
		assert.ok(
			tutorialLessons.some((lesson) => group.categories.includes(lesson.category)),
			`missing curriculum group ${group.id}`,
		)
	}
	assert.ok(tutorialLessons.some((lesson) => lesson.levelName === 'Expert'))
	assert.ok(tutorialLessons.some((lesson) => lesson.kind === 'defence'))
	assert.ok(tutorialLessons.some((lesson) => lesson.kind === 'bidding'))
})

test('every generated tutorial deal has 52 unique cards and parses as PBN', () => {
	assert.ok(validateTutorialLibrary().every((result) => result.valid))
	const boards = parsePBN(tutorialPbn)
	assert.equal(boards.length, tutorialLessons.length)
	for (const board of boards) {
		const hands = stableDealToHands(board.deal)
		assert.deepEqual(Object.values(hands).map((hand) => hand.length), [13, 13, 13, 13])
		assert.equal(new Set(Object.values(hands).flat().map(tutorialCardKey)).size, 52)
	}
})

test('lesson focus and scripted cards exist in their generated deals', () => {
	for (const lesson of tutorialLessons) {
		const hands = stableDealToHands(lesson.deal)
		const cards = new Set(Object.values(hands).flat().map(tutorialCardKey))
		for (const focusCard of lesson.focusCards || []) {
			assert.ok(cards.has(tutorialCardKey(focusCard)), `${lesson.id} missing ${focusCard}`)
		}
		for (const script of Object.values(lesson.scriptedCards || {})) {
			const seatCards = new Set(hands[script.seat].map(tutorialCardKey))
			assert.ok(seatCards.has(tutorialCardKey(script.card)), `${lesson.id} script is impossible`)
		}
	}
})

test('every teaching prompt has a valid answer and original explanatory fields', () => {
	for (const lesson of tutorialLessons) {
		assert.ok(lesson.choices.length >= 3)
		assert.ok(Number.isInteger(lesson.correctChoice))
		assert.ok(lesson.correctChoice >= 0 && lesson.correctChoice < lesson.choices.length)
		assert.ok(lesson.trigger.length > 20)
		assert.ok(lesson.explanation.length > 35)
		assert.ok(lesson.principle.length > 20)
	}
})

test('declarer-play lessons distinguish the current trick from a later plan', () => {
	for (const lesson of tutorialLessons.filter((entry) => entry.kind === 'play')) {
		assert.ok(['this-trick', 'plan-ahead'].includes(lesson.decisionTiming), `${lesson.id} missing decision timing`)
		assert.ok(lesson.decisionCue.length > 35, `${lesson.id} missing a clear timing cue`)
	}
})

test('entry lessons align the opening lead, explanation and outlined cards', () => {
	const unblock = tutorialLessons.find((lesson) => lesson.id === 'unblock-suit')
	const unblockHands = stableDealToHands(unblock.deal)
	assert.equal(unblock.lead, 'D2')
	assert.equal(unblock.decisionTiming, 'this-trick')
	assert.deepEqual(unblock.focusCards, ['DA', 'DK', 'DQ', 'D5', 'D4', 'DJ', 'D3'])
	assert.equal(unblockHands.N.filter((card) => card.suit === 'Diamonds').length, 5)
	assert.equal(unblockHands.S.filter((card) => card.suit === 'Diamonds').length, 2)

	const duck = tutorialLessons.find((lesson) => lesson.id === 'duck-for-entry')
	const duckHands = stableDealToHands(duck.deal)
	assert.equal(duck.lead, 'C5')
	assert.equal(duck.decisionTiming, 'this-trick')
	assert.match(duck.explanation, /♣6.*♣J.*♣2.*♣3/)
	assert.ok(duck.focusCards.every((card) => card.startsWith('C')))
	assert.equal(duckHands.N.filter((card) => card.suit === 'Clubs').length, 6)
	assert.equal(duckHands.S.filter((card) => card.suit === 'Clubs').length, 3)
	assert.deepEqual(duck.scriptedCards[2], { seat: 'E', card: 'CJ' })
})

test('visible focus summary names only the outlined cards the learner can see', () => {
	const lesson = tutorialLessons.find((entry) => entry.id === 'unblock-suit')
	const hands = stableDealToHands(lesson.deal)
	assert.equal(
		visibleTutorialHolding({ hands, visibleSeats: ['N', 'S'], focusCards: lesson.focusCards }),
		'North ♦A K Q 5 4 · South ♦J 3',
	)
	assert.equal(
		visibleTutorialHolding({ hands, visibleSeats: ['S'], focusCards: lesson.focusCards }),
		'South ♦J 3',
	)
})
