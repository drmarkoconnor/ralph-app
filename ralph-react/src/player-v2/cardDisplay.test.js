import assert from 'node:assert/strict'
import test from 'node:test'

import {
	buildPartnershipSuitLayout,
	isRedSuitBoundary,
	normalizeCardTheme,
} from './cardDisplay.js'
import { CARD_THEMES } from '../components/playerCardThemeConfig.js'

function cards(suit, count) {
	return Array.from({ length: count }, (_, index) => ({
		id: `${suit}-${index}`,
		suit,
		rank: String(index + 2),
	}))
}

test('partnership suit lanes share a trump-first order and widths based on both hands', () => {
	const layout = buildPartnershipSuitLayout({
		hands: {
			N: [...cards('Hearts', 5), ...cards('Spades', 2), ...cards('Diamonds', 3), ...cards('Clubs', 3)],
			S: [...cards('Hearts', 2), ...cards('Spades', 5), ...cards('Diamonds', 4), ...cards('Clubs', 2)],
		},
		seats: ['N', 'S'],
		trump: 'Hearts',
	})

	assert.deepEqual(layout.order, ['Hearts', 'Spades', 'Diamonds', 'Clubs'])
	assert.deepEqual(layout.counts, { Spades: 5, Hearts: 5, Diamonds: 4, Clubs: 3 })
	assert.ok(layout.widths.Hearts > layout.widths.Diamonds)
	assert.equal(layout.widths.Hearts, layout.widths.Spades)
})

test('no-trumps uses clubs first and marks the adjacent red-suit divider', () => {
	const layout = buildPartnershipSuitLayout({ hands: {}, seats: ['N', 'S'], trump: null })
	assert.deepEqual(layout.order, ['Clubs', 'Spades', 'Hearts', 'Diamonds'])
	assert.equal(isRedSuitBoundary('Hearts', 'Diamonds'), true)
	assert.equal(isRedSuitBoundary('Spades', 'Hearts'), false)
})

test('unknown saved card themes safely return to the projection-first default', () => {
	assert.equal(normalizeCardTheme('classic'), 'classic')
	assert.equal(normalizeCardTheme('not-a-theme'), 'broadcast')
	assert.equal(normalizeCardTheme(null), 'broadcast')
	assert.deepEqual(
		CARD_THEMES.map((theme) => theme.key),
		['broadcast', 'classic', 'jumbo', 'heritage', 'four-colour'],
	)
})
