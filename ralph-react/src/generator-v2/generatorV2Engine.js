export const SEATS = ['N', 'E', 'S', 'W']

export const SUITS = [
	{ key: 'S', name: 'Spades', label: 'S' },
	{ key: 'H', name: 'Hearts', label: 'H' },
	{ key: 'D', name: 'Diamonds', label: 'D' },
	{ key: 'C', name: 'Clubs', label: 'C' },
]

export const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const RANKS_LOW = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const HCP = { A: 4, K: 3, Q: 2, J: 1 }
const RANK_SORT = Object.fromEntries(RANKS.map((rank, index) => [rank, index]))

export const SYLLABUS_GROUPS = [
	{
		level: 'Beginner',
		topics: [
			{
				id: 'one_nt_mixed',
				title: '1NT Openings And Responses',
				description: '12-14 balanced openings with pass, invite and game decisions.',
			},
			{
				id: 'game_ns',
				title: 'N/S Game Hands',
				description: 'Textbook N/S game-value hands using judgement-style filters.',
			},
			{
				id: 'major_fit_game',
				title: 'Major-Suit Fits To Game',
				description: '8+ card major fits with enough values to reach game.',
			},
			{
				id: 'opening_leads',
				title: 'Opening Lead Choices',
				description: 'Hands with clear lead questions and suit-sequence clues.',
			},
		],
	},
	{
		level: 'Improver',
		topics: [
			{
				id: 'stayman',
				title: 'Stayman After 1NT',
				description: 'Responder asks for a four-card major after a 1NT opening.',
			},
			{
				id: 'transfers',
				title: 'Transfers After 1NT',
				description: 'Responder has a five-card major and transfers opener.',
			},
			{
				id: 'weak_twos',
				title: 'Weak Twos',
				description: 'Six-card major openings with limited high-card strength.',
			},
			{
				id: 'weak_threes',
				title: 'Weak Three Pre-Empts',
				description: 'Seven-card pre-emptive openings with limited high-card strength.',
			},
			{
				id: 'overcalls',
				title: 'Overcalls',
				description: 'Good five-card suits after an opponent opens.',
			},
			{
				id: 'takeout_double',
				title: 'Takeout Doubles',
				description: 'Opening bid, shortness, and support for the unbid suits.',
			},
		],
	},
	{
		level: 'Intermediate',
		topics: [
			{
				id: 'slam_teaching',
				title: 'Slam Exploration',
				description: 'Clean high-card and control hands suitable for slam teaching.',
			},
			{
				id: 'splinter',
				title: 'Splinter Raises',
				description: 'Major fit plus shortage and slam interest.',
			},
			{
				id: 'nt_judgement',
				title: 'No-Trump Judgement',
				description: 'Balanced hands around invitational and game decisions.',
			},
		],
	},
	{
		level: 'Advanced',
		topics: [
			{
				id: 'competitive',
				title: 'Competitive Auctions',
				description: 'Both sides have values and shape; judgement matters.',
			},
			{
				id: 'sacrifice',
				title: 'Sacrifice Decisions',
				description: 'Distributional hands where vulnerability and fit matter.',
			},
			{
				id: 'advanced_play',
				title: 'Advanced Play Themes',
				description: 'Hands with a likely finesse, entry or establishment question.',
			},
		],
	},
	{
		level: 'Custom',
		topics: [
			{
				id: 'custom_hcp',
				title: 'Custom HCP / Shape Constraints',
				description: 'Set point ranges per seat and optional N/S or E/W targets.',
			},
			{
				id: 'random_deal',
				title: 'Random Boards',
				description: 'Unconstrained random deals for quick physical board production.',
			},
		],
	},
]

export const DEFAULT_ACOL_SETTINGS = {
	oneNtMin: 12,
	oneNtMax: 14,
	stayman: true,
	transfers: true,
	weakTwos: true,
	weakThrees: true,
}

export function createGenerator2SessionSnapshot({
	presetId,
	count,
	startBoard,
	dealerMode,
	dealerSeat,
	auctionMode,
	dealer4Mode,
	meta,
	acolSettings,
	constraints,
	boards,
	warnings,
	status,
}) {
	return {
		presetId,
		count,
		startBoard,
		dealerMode,
		dealerSeat,
		auctionMode,
		dealer4Mode,
		meta,
		acolSettings,
		constraints,
		boards,
		warnings,
		status,
	}
}

export function dealerForBoard(boardNo) {
	return SEATS[(boardNo - 1) % 4]
}

export function vulnerabilityForBoard(boardNo) {
	const cycle = [
		'None',
		'NS',
		'EW',
		'All',
		'NS',
		'EW',
		'All',
		'None',
		'EW',
		'All',
		'None',
		'NS',
		'All',
		'None',
		'NS',
		'EW',
	]
	return cycle[(boardNo - 1) % 16]
}

export function createDeck() {
	const cards = []
	let id = 1
	for (const suit of SUITS) {
		for (const rank of RANKS_LOW) {
			cards.push({
				id: id++,
				suit: suit.name,
				suitKey: suit.key,
				rank,
				label: `${rank}${suit.key}`,
			})
		}
	}
	return cards
}

export function hcp(cards) {
	return (cards || []).reduce((sum, card) => sum + (HCP[card.rank] || 0), 0)
}

export function partnershipHcp(hands, side) {
	if (side === 'NS') return hcp(hands.N) + hcp(hands.S)
	if (side === 'EW') return hcp(hands.E) + hcp(hands.W)
	return 0
}

export function suitLengths(cards) {
	const counts = { S: 0, H: 0, D: 0, C: 0 }
	for (const card of cards || []) counts[card.suitKey] += 1
	return counts
}

export function isBalanced(lengths) {
	const pattern = Object.values(lengths).sort((a, b) => b - a).join('-')
	return pattern === '5-3-3-2' || pattern === '4-4-3-2' || pattern === '4-3-3-3'
}

function hasFiveCardMajor(lengths) {
	return lengths.S >= 5 || lengths.H >= 5
}

function longestSuit(lengths) {
	return ['S', 'H', 'D', 'C'].sort((a, b) => lengths[b] - lengths[a])[0]
}

function longestOfSuits(lengths, suits) {
	return [...suits].sort((a, b) => lengths[b] - lengths[a])[0]
}

function partnerOf(seat) {
	return seat === 'N' ? 'S' : seat === 'S' ? 'N' : seat === 'E' ? 'W' : 'E'
}

function leftOf(seat) {
	return SEATS[(SEATS.indexOf(seat) + 1) % 4]
}

function rightOf(seat) {
	return SEATS[(SEATS.indexOf(seat) + 3) % 4]
}

function shuffle(items) {
	const arr = [...items]
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[arr[i], arr[j]] = [arr[j], arr[i]]
	}
	return arr
}

export function dealRandomHands() {
	const deck = shuffle(createDeck())
	const hands = { N: [], E: [], S: [], W: [] }
	SEATS.forEach((seat, index) => {
		hands[seat] = deck.slice(index * 13, index * 13 + 13)
	})
	return hands
}

function numberOrFallback(value, fallback) {
	if (value === '' || value === undefined || value === null) return fallback
	const n = Number(value)
	return Number.isFinite(n) ? n : fallback
}

function constraintRanges(constraints) {
	const ranges = constraints?.hcpRanges || {}
	return Object.fromEntries(
		SEATS.map((seat) => [
			seat,
			{
				min: numberOrFallback(ranges[seat]?.min, 0),
				max: numberOrFallback(ranges[seat]?.max, 37),
			},
		]),
	)
}

function pairRanges(constraints) {
	return {
		nsMin: numberOrFallback(constraints?.nsMin, 0),
		nsMax: numberOrFallback(constraints?.nsMax, 40),
		ewMin: numberOrFallback(constraints?.ewMin, 0),
		ewMax: numberOrFallback(constraints?.ewMax, 40),
	}
}

function randomDealForHcpConstraints(constraints) {
	const ranges = constraintRanges(constraints)
	const pairs = pairRanges(constraints)
	const deck = shuffle(createDeck())
	const honours = deck.filter((card) => HCP[card.rank])
	const spots = shuffle(deck.filter((card) => !HCP[card.rank]))
	const hands = { N: [], E: [], S: [], W: [] }
	const points = { N: 0, E: 0, S: 0, W: 0 }

	const canStillReachMinimums = (cardIndex) => {
		const remainingPoints = honours
			.slice(cardIndex)
			.reduce((sum, card) => sum + (HCP[card.rank] || 0), 0)
		const shortfall = SEATS.reduce(
			(sum, seat) => sum + Math.max(0, ranges[seat].min - points[seat]),
			0,
		)
		return shortfall <= remainingPoints
	}

	const assignHonour = (index) => {
		if (index >= honours.length) {
			return SEATS.every((seat) => points[seat] >= ranges[seat].min)
		}
		if (!canStillReachMinimums(index)) return false
		const card = honours[index]
		for (const seat of shuffle(SEATS)) {
			const nextPoints = points[seat] + (HCP[card.rank] || 0)
			if (hands[seat].length >= 13 || nextPoints > ranges[seat].max) continue
			hands[seat].push(card)
			points[seat] = nextPoints
			if (assignHonour(index + 1)) return true
			points[seat] -= HCP[card.rank] || 0
			hands[seat].pop()
		}
		return false
	}

	if (!assignHonour(0)) return null

	for (const card of spots) {
		const available = shuffle(SEATS.filter((seat) => hands[seat].length < 13))
		if (!available.length) return null
		hands[available[0]].push(card)
	}

	const ns = partnershipHcp(hands, 'NS')
	const ew = partnershipHcp(hands, 'EW')
	if (ns < pairs.nsMin || ns > pairs.nsMax || ew < pairs.ewMin || ew > pairs.ewMax) {
		return null
	}
	return hands
}

function handSignature(hands) {
	return SEATS.map((seat) =>
		[...hands[seat]]
			.map((card) => `${card.suitKey}${card.rank}`)
			.sort()
			.join('')
	).join('|')
}

function majorFit(hands, side) {
	const seats = side === 'NS' ? ['N', 'S'] : ['E', 'W']
	const a = suitLengths(hands[seats[0]])
	const b = suitLengths(hands[seats[1]])
	if (a.S + b.S >= 8) return 'S'
	if (a.H + b.H >= 8) return 'H'
	return ''
}

function oneNtOpenerOk(hands, dealer, settings) {
	const points = hcp(hands[dealer])
	const lengths = suitLengths(hands[dealer])
	return (
		points >= settings.oneNtMin &&
		points <= settings.oneNtMax &&
		isBalanced(lengths) &&
		!hasFiveCardMajor(lengths)
	)
}

function controls(cards) {
	return (cards || []).reduce((sum, card) => {
		if (card.rank === 'A') return sum + 2
		if (card.rank === 'K') return sum + 1
		return sum
	}, 0)
}

function hasLeadSequence(cards) {
	for (const suit of SUITS) {
		const ranks = new Set(cards.filter((card) => card.suitKey === suit.key).map((card) => card.rank))
		if (ranks.has('A') && ranks.has('K')) return true
		if (ranks.has('K') && ranks.has('Q') && ranks.has('J')) return true
		if (ranks.has('Q') && ranks.has('J') && ranks.has('10')) return true
	}
	return false
}

function customConstraintsOk(hands, constraints) {
	const ranges = constraintRanges(constraints)
	for (const seat of SEATS) {
		const points = hcp(hands[seat])
		const min = ranges[seat].min
		const max = ranges[seat].max
		if (points < min || points > max) return false
	}
	const { nsMin, nsMax, ewMin, ewMax } = pairRanges(constraints)
	const ns = partnershipHcp(hands, 'NS')
	const ew = partnershipHcp(hands, 'EW')
	return ns >= nsMin && ns <= nsMax && ew >= ewMin && ew <= ewMax
}

function presetOk(presetId, hands, dealer, settings, constraints) {
	const dealerHcp = hcp(hands[dealer])
	const partner = partnerOf(dealer)
	const partnerHcp = hcp(hands[partner])
	const dealerLengths = suitLengths(hands[dealer])
	const partnerLengths = suitLengths(hands[partner])
	const nsHcp = partnershipHcp(hands, 'NS')
	const ewHcp = partnershipHcp(hands, 'EW')
	const nsMajorFit = majorFit(hands, 'NS')

	if (presetId === 'custom_hcp') return customConstraintsOk(hands, constraints)
	if (presetId === 'one_nt_mixed') {
		return oneNtOpenerOk(hands, dealer, settings) && partnerHcp <= 14
	}
	if (presetId === 'stayman') {
		return (
			settings.stayman &&
			oneNtOpenerOk(hands, dealer, settings) &&
			partnerHcp >= 8 &&
			(partnerLengths.S === 4 || partnerLengths.H === 4)
		)
	}
	if (presetId === 'transfers') {
		return (
			settings.transfers &&
			oneNtOpenerOk(hands, dealer, settings) &&
			partnerHcp >= 6 &&
			(partnerLengths.S >= 5 || partnerLengths.H >= 5)
		)
	}
	if (presetId === 'game_ns') {
		return nsHcp >= 25 && (nsMajorFit || nsHcp >= 26)
	}
	if (presetId === 'major_fit_game') {
		return nsHcp >= 25 && !!nsMajorFit
	}
	if (presetId === 'opening_leads') {
		return hasLeadSequence(hands[leftOf(dealer)]) || hasLeadSequence(hands[rightOf(dealer)])
	}
	if (presetId === 'weak_twos') {
		const major = dealerLengths.S >= 6 || dealerLengths.H >= 6
		return settings.weakTwos && major && dealerHcp >= 6 && dealerHcp <= 10
	}
	if (presetId === 'weak_threes') {
		return (
			settings.weakThrees &&
			Object.values(dealerLengths).some((len) => len >= 7) &&
			dealerHcp >= 5 &&
			dealerHcp <= 10
		)
	}
	if (presetId === 'overcalls') {
		const overcaller = leftOf(dealer)
		const overHcp = hcp(hands[overcaller])
		const overLens = suitLengths(hands[overcaller])
		return dealerHcp >= 12 && overHcp >= 8 && overHcp <= 16 && longestSuit(overLens) && overLens[longestSuit(overLens)] >= 5
	}
	if (presetId === 'takeout_double') {
		const doubler = leftOf(dealer)
		const openerSuit = longestSuit(dealerLengths)
		const doublerLens = suitLengths(hands[doubler])
		const otherSuits = ['S', 'H', 'D', 'C'].filter((suit) => suit !== openerSuit)
		return (
			dealerHcp >= 12 &&
			hcp(hands[doubler]) >= 12 &&
			doublerLens[openerSuit] <= 2 &&
			otherSuits.filter((suit) => doublerLens[suit] >= 3).length >= 3
		)
	}
	if (presetId === 'slam_teaching') {
		const side = nsHcp >= ewHcp ? 'NS' : 'EW'
		const seats = side === 'NS' ? ['N', 'S'] : ['E', 'W']
		return (
			partnershipHcp(hands, side) >= 32 &&
			controls(hands[seats[0]]) + controls(hands[seats[1]]) >= 8
		)
	}
	if (presetId === 'splinter') {
		const fit = majorFit(hands, 'NS')
		const short = ['N', 'S'].some((seat) => {
			const lengths = suitLengths(hands[seat])
			return ['S', 'H', 'D', 'C'].some((suit) => suit !== fit && lengths[suit] <= 1)
		})
		return !!fit && nsHcp >= 27 && short
	}
	if (presetId === 'nt_judgement') {
		return nsHcp >= 23 && nsHcp <= 27 && (isBalanced(suitLengths(hands.N)) || isBalanced(suitLengths(hands.S)))
	}
	if (presetId === 'competitive') {
		return nsHcp >= 18 && ewHcp >= 18 && !!majorFit(hands, 'NS') && !!majorFit(hands, 'EW')
	}
	if (presetId === 'sacrifice') {
		return (
			(nsHcp >= 17 || ewHcp >= 17) &&
			['N', 'E', 'S', 'W'].some((seat) => {
				const lengths = suitLengths(hands[seat])
				return Object.values(lengths).some((len) => len >= 7)
			})
		)
	}
	if (presetId === 'advanced_play') {
		return SEATS.some((seat) => {
			const lengths = suitLengths(hands[seat])
			return hcp(hands[seat]) >= 12 && Object.values(lengths).some((len) => len >= 6)
		})
	}
	return true
}

function openingBidForHand(cards, settings) {
	const points = hcp(cards)
	const lengths = suitLengths(cards)
	if (points < 12) return 'P'
	if (isBalanced(lengths) && !hasFiveCardMajor(lengths) && points >= settings.oneNtMin && points <= settings.oneNtMax) {
		return '1NT'
	}
	if (lengths.S >= 5 || lengths.H >= 5) return lengths.S >= lengths.H ? '1S' : '1H'
	if (lengths.D >= 4 && lengths.D >= lengths.C) return '1D'
	return '1C'
}

function finishAuction(calls) {
	const result = [...calls]
	let trailingPasses = 0
	for (let i = result.length - 1; i >= 0; i--) {
		if (result[i] === 'P') trailingPasses += 1
		else break
	}
	if (!result.some((call) => call !== 'P')) {
		while (result.length < 4) result.push('P')
		return result
	}
	while (trailingPasses < 3) {
		result.push('P')
		trailingPasses += 1
	}
	return result
}

function basicAuction(presetId, hands, dealer, settings) {
	const partner = partnerOf(dealer)
	const partnerPoints = hcp(hands[partner])
	const partnerLens = suitLengths(hands[partner])
	const dealerLens = suitLengths(hands[dealer])

	if (presetId === 'weak_twos') {
		const suit = longestOfSuits(dealerLens, ['S', 'H'])
		if (dealerLens[suit] >= 6) return finishAuction([`2${suit}`])
	}

	if (presetId === 'weak_threes') {
		const suit = longestSuit(dealerLens)
		if (dealerLens[suit] >= 7) return finishAuction([`3${suit}`])
	}

	const opener = openingBidForHand(hands[dealer], settings)
	if (opener === 'P') return ['P', 'P', 'P', 'P']

	if (opener === '1NT') {
		if (presetId === 'stayman') {
			const response =
				dealerLens.H >= 4 ? '2H' : dealerLens.S >= 4 ? '2S' : '2D'
			const finalBid =
				(response === '2H' && partnerLens.H >= 4) ||
				(response === '2S' && partnerLens.S >= 4)
					? '4' + response[1]
					: partnerPoints >= 10
						? '3NT'
						: '2NT'
			return finishAuction(['1NT', 'P', '2C', 'P', response, 'P', finalBid])
		}
		if (presetId === 'transfers') {
			const target = partnerLens.H >= 5 ? 'H' : 'S'
			const transfer = target === 'H' ? '2D' : '2H'
			const finalBid = partnerPoints >= 10 ? (partnerLens[target] >= 6 ? `4${target}` : '3NT') : 'P'
			return finalBid === 'P'
				? finishAuction(['1NT', 'P', transfer, 'P', `2${target}`])
				: finishAuction(['1NT', 'P', transfer, 'P', `2${target}`, 'P', finalBid])
		}
		if (partnerPoints >= 10) return finishAuction(['1NT', 'P', '3NT'])
		if (partnerPoints >= 8) return finishAuction(['1NT', 'P', '2NT'])
		return finishAuction(['1NT'])
	}

	if (presetId === 'slam_teaching') {
		const fit = majorFit(hands, dealer === 'N' || dealer === 'S' ? 'NS' : 'EW')
		return finishAuction([opener, 'P', fit ? `4${fit}` : '3NT', 'P', fit ? `6${fit}` : '6NT'])
	}

	const fit = majorFit(hands, dealer === 'N' || dealer === 'S' ? 'NS' : 'EW')
	if (fit && partnerPoints >= 10) return finishAuction([opener, 'P', `4${fit}`])
	if (partnerPoints >= 10) return finishAuction([opener, 'P', '3NT'])
	if (partnerPoints >= 6) return finishAuction([opener, 'P', '2NT'])
	return finishAuction([opener])
}

function topicById(id) {
	for (const group of SYLLABUS_GROUPS) {
		const topic = group.topics.find((item) => item.id === id)
		if (topic) return topic
	}
	return SYLLABUS_GROUPS[0].topics[0]
}

function lessonNote(presetId, hands, dealer, settings) {
	const topic = topicById(presetId)
	const dealerPoints = hcp(hands[dealer])
	const partner = partnerOf(dealer)
	const ns = partnershipHcp(hands, 'NS')
	const ew = partnershipHcp(hands, 'EW')
	if (presetId === 'custom_hcp') {
		return `Custom constraints. HCP: N ${hcp(hands.N)}, E ${hcp(hands.E)}, S ${hcp(hands.S)}, W ${hcp(hands.W)}.`
	}
	if (presetId.includes('one_nt') || presetId === 'stayman' || presetId === 'transfers') {
		return `${topic.title}: ${dealer} has ${dealerPoints} HCP and a balanced ${settings.oneNtMin}-${settings.oneNtMax} 1NT opening. Partner ${partner} has ${hcp(hands[partner])} HCP.`
	}
	if (presetId === 'game_ns') {
		return `N/S game-values hand. N/S have ${ns} combined HCP; review whether the class reaches a sensible game.`
	}
	if (presetId === 'slam_teaching') {
		return `Slam exploration hand. N/S ${ns} HCP, E/W ${ew} HCP; focus on controls, fit and whether slam is sensible.`
	}
	if (presetId === 'weak_twos' || presetId === 'weak_threes') {
		return `${topic.title}. ${dealer} has ${dealerPoints} HCP and the long suit for the pre-empt. HCP: N/S ${ns}, E/W ${ew}.`
	}
	return `${topic.title}. HCP: N/S ${ns}, E/W ${ew}. Use the auction and play to test the teaching point.`
}

export function generateGenerator2Boards({
	presetId,
	count,
	startBoard = 1,
	dealerMode = 'cycle',
	dealerSeat = 'N',
	auctionMode = 'auto',
	acolSettings = DEFAULT_ACOL_SETTINGS,
	constraints = {},
	seen = new Set(),
}) {
	const boards = []
	const warnings = []
	const settings = { ...DEFAULT_ACOL_SETTINGS, ...acolSettings }
	const requested = Math.max(1, Math.min(48, Number(count) || 1))
	const firstBoard = Math.max(1, Number(startBoard) || 1)
	let totalAttempts = 0

	for (let index = 0; index < requested; index++) {
		const boardNo = firstBoard + index
		const dealer = dealerMode === 'fixed' ? dealerSeat : dealerForBoard(boardNo)
		let accepted = null
		const maxAttempts = presetId === 'custom_hcp' ? 400 : 10000
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			totalAttempts += 1
			const hands =
				presetId === 'custom_hcp'
					? randomDealForHcpConstraints(constraints) || dealRandomHands()
					: dealRandomHands()
			const signature = handSignature(hands)
			if (seen.has(signature)) continue
			if (!presetOk(presetId, hands, dealer, settings, constraints)) continue
			accepted = { hands, signature }
			break
		}
		if (!accepted) {
			warnings.push(`Board ${boardNo}: could not satisfy the exact preset after ${maxAttempts.toLocaleString()} attempts; used a fallback random deal.`)
			let fallback = dealRandomHands()
			while (seen.has(handSignature(fallback))) fallback = dealRandomHands()
			accepted = { hands: fallback, signature: handSignature(fallback) }
		}
		seen.add(accepted.signature)
		const topic = topicById(presetId)
			const suggestedAuction = auctionMode === 'blank'
				? []
				: basicAuction(presetId, accepted.hands, dealer, settings)
			const auction = auctionMode === 'auto' ? suggestedAuction : []
			boards.push({
				id: `${Date.now()}-${boardNo}-${index}-${Math.random().toString(16).slice(2)}`,
				keep: true,
			number: boardNo,
			dealer,
			vul: vulnerabilityForBoard(boardNo),
			topicId: presetId,
			topicTitle: topic.title,
				hands: accepted.hands,
				auction,
				auctionText: auction.join(' '),
				suggestedAuction,
				suggestedAuctionText: suggestedAuction.join(' '),
				notes: lessonNote(presetId, accepted.hands, dealer, settings),
				quality: presetOk(presetId, accepted.hands, dealer, settings, constraints) ? 'matched' : 'fallback',
			})
	}

	return { boards, warnings, attempts: totalAttempts }
}

export function toPbnRank(rank) {
	return rank === '10' ? 'T' : rank
}

export function cardsToPbnHand(cards) {
	const bySuit = { S: [], H: [], D: [], C: [] }
	for (const suit of SUITS) {
		bySuit[suit.key] = (cards || [])
			.filter((card) => card.suitKey === suit.key)
			.map((card) => toPbnRank(card.rank))
			.sort((a, b) => RANK_SORT[a === 'T' ? '10' : a] - RANK_SORT[b === 'T' ? '10' : b])
	}
	return bySuit
}

export function boardToExportShape(board, meta) {
	return {
		event: meta.event || 'Club Teaching session',
		site: meta.site || 'Bristol Bridge Club',
		date: meta.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
		board: board.number,
		dealer: board.dealer,
		vul: board.vul,
		dealPrefix: board.dealer,
		hands: {
			N: cardsToPbnHand(board.hands.N),
			E: cardsToPbnHand(board.hands.E),
			S: cardsToPbnHand(board.hands.S),
			W: cardsToPbnHand(board.hands.W),
		},
		auctionStart: board.auctionText.trim() ? board.dealer : undefined,
		auction: board.auctionText.trim()
			? board.auctionText.trim().split(/\s+/).map((call) => (call.toUpperCase() === 'P' ? 'P' : call.toUpperCase()))
			: undefined,
		notes: board.notes ? [board.notes] : [],
		ext: {
			system: meta.system || 'ACOL 12-14 1NT',
			theme: board.topicTitle,
			scoring: meta.scoring || 'MPs',
		},
	}
}
