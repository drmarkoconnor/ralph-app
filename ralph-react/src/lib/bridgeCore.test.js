import assert from 'node:assert/strict'
import test from 'node:test'

import { computeDuplicateScore } from './bridgeCore.js'

test('duplicate score result text uses standard contract outcome notation', () => {
	assert.equal(computeDuplicateScore('3H', 'W', false, 9).resultText, '3H=')
	assert.equal(computeDuplicateScore('3H', 'W', false, 11).resultText, '3H+2')
	assert.equal(computeDuplicateScore('3H', 'W', false, 7).resultText, '3H-2')
})
