const SUIT_LABELS = {
	Spades: 'spades',
	Hearts: 'hearts',
	Diamonds: 'diamonds',
	Clubs: 'clubs',
}

function learnerName(context) {
	return context?.perspective?.seat === 'N' ? 'North' : 'South'
}

export const COACH_QUICK_ACTIONS = Object.freeze([
	{ id: 'count-points', label: 'Count my points' },
	{ id: 'hand-shape', label: 'Show my shape' },
	{ id: 'count-trumps', label: 'Count the trumps' },
	{ id: 'highest-outstanding', label: 'Highest cards still out' },
	{ id: 'legal-follow', label: 'What must I follow?' },
	{ id: 'what-to-count', label: 'What should I count?' },
])

export const COACH_PAID_ACTIONS = Object.freeze([
	{ id: 'nudge', label: 'Gentle nudge', description: 'A short prompt without naming the answer' },
	{ id: 'explain', label: 'Explain why', description: 'Explain the lesson in this position' },
	{ id: 'compare', label: 'Compare choices', description: 'Discuss options without using hidden cards' },
	{ id: 'remember', label: 'What to remember', description: 'Carry the key thought into the next decision' },
])

export function coachPhaseId(phase) {
	if (phase === 'auction') return 'bidding'
	if (phase === 'opening-lead') return 'opening-lead'
	return 'card-play'
}

export function coachPositionKey(context) {
	if (!context) return ''
	return JSON.stringify({ ...context, trigger: undefined })
}

function handShapeText(hand) {
	const shape = hand?.shape || {}
	return `♠ ${shape.Spades || 0}, ♥ ${shape.Hearts || 0}, ♦ ${shape.Diamonds || 0}, ♣ ${shape.Clubs || 0}`
}

function trumpFact(context) {
	const learner = learnerName(context)
	if (!context.contract) return 'The contract and trump suit have not yet been established.'
	if (context.contract.strain === 'NT') return 'This is a no-trump contract, so there is no trump suit to count.'
	const trumps = context.facts?.play?.trumps
	if (!trumps) {
		return `${context.contract.strain} will be trumps. Start with the number in ${learner} and, after the opening lead, add dummy before counting the hidden hands.`
	}
	const suit = SUIT_LABELS[trumps.suit] || trumps.suit
	const known = Object.entries(trumps.knownRemainingBySeat || {})
		.map(([seat, count]) => `${seat}: ${count}`)
		.join(', ')
	const location =
		context.perspective?.role === 'declarer'
			? "in the defenders' two hidden hands"
			: `across the hands that are still hidden from ${learner}`
	return `${trumps.playedCount} ${suit} have been played. Known remaining ${suit}: ${known || 'none'}. ${trumps.unaccountedCount} remain unaccounted for ${location}; their exact locations are unknown.`
}

function outstandingFact(context) {
	const outstanding = context.facts?.play?.outstandingCards
	if (!outstanding) return 'Outstanding-card counting begins once play has started and public cards are available.'
	return Object.entries(outstanding)
		.map(([suit, facts]) => {
			const symbol = suit === 'Spades' ? '♠' : suit === 'Hearts' ? '♥' : suit === 'Diamonds' ? '♦' : '♣'
			return `${symbol} ${facts.highestUnaccountedRank || 'none'} (${facts.unaccountedCount} unaccounted)`
		})
		.join(' · ')
}

function legalFollowFact(context) {
	const learner = learnerName(context)
	const legal = context.facts?.play?.legalFollow
	const decisionSeat = context.facts?.play?.turnSeat
	const decisionName =
		decisionSeat && decisionSeat === context.contract?.dummy
			? 'Dummy'
			: decisionSeat === 'N'
				? 'North'
				: decisionSeat === 'S'
					? 'South'
					: learner
	if (!legal?.learnerToPlay) return `It is not currently ${learner}’s turn to play.`
	if (!legal.leadSuit) return `${decisionName} is leading and may choose from ${legal.legalCardCount} cards.`
	if (!legal.mustFollowSuit) {
		return `The trick was led in ${legal.leadSuit}. ${decisionName} has none and may play any of ${legal.legalCardCount} cards.`
	}
	return `${decisionName} must follow ${legal.leadSuit} and has ${legal.legalCardCount} legal card${legal.legalCardCount === 1 ? '' : 's'} in that suit.`
}

function countingChecklist(context) {
	const learner = learnerName(context)
	if (context.phase === 'auction') {
		const hcp = context.facts?.learnerHand?.hcp ?? 0
		return `Start with ${learner}’s ${hcp} HCP and ${context.facts?.learnerHand?.shapePattern || 'unknown'} shape. Then track what each shown bid promises, whether the auction is forcing, and the likely partnership range.`
	}
	if (context.phase === 'opening-lead') {
		return `Before the lead, review the contract, the auction, ${learner}’s partnership clues, honour sequences, and whether an active or passive lead is called for. Dummy is still unknown.`
	}
	return 'Keep a running count of trumps, the suit currently being developed, winners and losers, entries, public show-outs, and what changed in the latest completed trick.'
}

export function localCoachFact(context, actionId) {
	if (!context) return { label: 'Known fact', text: 'Load a board before asking the Coach.' }
	const hand = context.facts?.learnerHand
	const learner = learnerName(context)
	switch (actionId) {
		case 'count-points':
			return {
				label: `${learner} hand`,
				text: `${learner} has ${hand?.hcp ?? 0} high-card points. This is calculated locally and does not use AI.`,
			}
		case 'hand-shape':
			return {
				label: `${learner} shape`,
				text: `${handShapeText(hand)} — ${hand?.shapePattern || 'unknown'}${hand?.commonBalancedShape ? ', a commonly balanced pattern.' : '.'}`,
			}
		case 'count-trumps':
			return { label: 'Trump count', text: trumpFact(context) }
		case 'highest-outstanding':
			return { label: 'Outstanding honours', text: outstandingFact(context) }
		case 'legal-follow':
			return { label: 'Follow suit', text: legalFollowFact(context) }
		case 'what-to-count':
		default:
			return { label: 'Counting checklist', text: countingChecklist(context) }
	}
}

export function coachReplyText(reply) {
	if (!reply) return 'The Coach returned no teaching note.'
	if (typeof reply === 'string') return reply
	if (reply.message || reply.concept || reply.suggestedChecks) {
		const coachLines = []
		if (reply.message) coachLines.push(reply.message)
		if (reply.concept) coachLines.push(`Why it matters: ${reply.concept}`)
		for (const fact of Array.isArray(reply.factsUsed) ? reply.factsUsed : []) {
			coachLines.push(`Known: ${fact}`)
		}
		for (const check of Array.isArray(reply.suggestedChecks) ? reply.suggestedChecks : []) {
			coachLines.push(`Check: ${check}`)
		}
		return coachLines.join('\n')
	}
	const lines = []
	if (reply.headline) lines.push(reply.headline)
	for (const point of Array.isArray(reply.guidance) ? reply.guidance : []) lines.push(`• ${point}`)
	if (reply.statistic) lines.push(`Number to remember: ${reply.statistic}`)
	if (reply.questionToLearner) lines.push(`Your question: ${reply.questionToLearner}`)
	return lines.join('\n') || 'The Coach returned no teaching note.'
}

export function transcriptEntry({ phase, role = 'coach', label, text }) {
	return {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		phase: coachPhaseId(phase),
		role,
		label,
		text,
		time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
	}
}
