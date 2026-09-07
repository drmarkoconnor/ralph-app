function plural(count, singular, pluralForm = `${singular}s`) {
	return count === 1 ? singular : pluralForm
}

export function summarizeCompetitionComparison(nsScore, references = []) {
	if (!Number.isFinite(nsScore)) return null

	const validReferences = references.filter((reference) => Number.isFinite(reference?.nsScore))
	if (!validReferences.length) return null

	const differences = validReferences.map((reference) => nsScore - reference.nsScore)
	const better = differences.filter((difference) => difference > 0).length
	const matched = differences.filter((difference) => difference === 0).length
	const worse = differences.filter((difference) => difference < 0).length
	const total = validReferences.length

	if (better === total) {
		return {
			outcome: 'better',
			headline:
				total === 1
					? 'You did better than the expert result.'
					: total === 2
						? 'You did better than both expert tables.'
						: `You did better than all ${total} expert tables.`,
			detail: 'A higher North–South score is better. See the exact differences below.',
			better,
			matched,
			worse,
		}
	}

	if (worse === total) {
		return {
			outcome: 'worse',
			headline:
				total === 1
					? 'You did not do as well as the expert result.'
					: total === 2
						? 'You did not do as well as either expert table.'
						: `You did not do as well as the ${total} expert tables.`,
			detail: 'Your North–South score was lower. See the exact differences below.',
			better,
			matched,
			worse,
		}
	}

	if (matched === total) {
		return {
			outcome: 'matched',
			headline:
				total === 1
					? 'You matched the expert result.'
					: total === 2
						? 'You matched both expert tables.'
						: `You matched all ${total} expert tables.`,
			detail: 'Your North–South score was exactly the same.',
			better,
			matched,
			worse,
		}
	}

	const parts = []
	if (better) parts.push(`better than ${better} ${plural(better, 'table')}`)
	if (matched) parts.push(`the same as ${matched} ${plural(matched, 'table')}`)
	if (worse) parts.push(`lower than ${worse} ${plural(worse, 'table')}`)

	return {
		outcome: better > 0 && worse === 0 ? 'better' : worse > 0 && better === 0 ? 'worse' : 'mixed',
		headline:
			better > 0 && worse === 0
				? 'You did better overall.'
				: worse > 0 && better === 0
					? 'You did not do as well overall.'
					: 'A mixed result against the experts.',
		detail: `Your North–South score was ${parts.join(', ')}.`,
		better,
		matched,
		worse,
	}
}
