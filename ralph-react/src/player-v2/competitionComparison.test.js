import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeCompetitionComparison } from './competitionComparison.js'

const references = (scores) => scores.map((nsScore) => ({ nsScore }))

test('reports an unambiguous win against both expert tables', () => {
	const summary = summarizeCompetitionComparison(-50, references([-140, -110]))

	assert.equal(summary.outcome, 'better')
	assert.equal(summary.headline, 'You did better than both expert tables.')
	assert.deepEqual(
		{ better: summary.better, matched: summary.matched, worse: summary.worse },
		{ better: 2, matched: 0, worse: 0 },
	)
})

test('reports an unambiguous lower result against both expert tables', () => {
	const summary = summarizeCompetitionComparison(-170, references([-140, -110]))

	assert.equal(summary.outcome, 'worse')
	assert.equal(summary.headline, 'You did not do as well as either expert table.')
})

test('reports a match and a mixed comparison in plain language', () => {
	assert.equal(
		summarizeCompetitionComparison(420, references([420, 420])).headline,
		'You matched both expert tables.',
	)

	const mixed = summarizeCompetitionComparison(100, references([50, 100, 140]))
	assert.equal(mixed.outcome, 'mixed')
	assert.equal(mixed.headline, 'A mixed result against the experts.')
	assert.match(mixed.detail, /better than 1 table/)
	assert.match(mixed.detail, /same as 1 table/)
	assert.match(mixed.detail, /lower than 1 table/)
})

test('ignores invalid references and returns null without a usable comparison', () => {
	assert.equal(summarizeCompetitionComparison(100, [{ nsScore: Number.NaN }]), null)
	assert.equal(summarizeCompetitionComparison(Number.NaN, references([100])), null)
})
