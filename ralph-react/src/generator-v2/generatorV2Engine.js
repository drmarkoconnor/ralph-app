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
const VALID_PBN_AUCTION_TOKEN = /^(P|X|XX|[1-7](C|D|H|S|NT))$/

export const PBN_AUCTION_TOKEN_HELP = 'Use P for Pass, X for Double, XX for Redouble, or bids like 1C, 1D, 1H, 1S, 1NT.'

export function normalizeAuctionToken(token) {
	const upper = String(token || '').trim().toUpperCase()
	if (upper === 'PASS') return 'P'
	return upper
}

export function normalizeAuctionText(text) {
	return String(text || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map(normalizeAuctionToken)
}

export function invalidAuctionTokens(text) {
	return String(text || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((raw) => ({ raw, normalized: normalizeAuctionToken(raw) }))
		.filter((token) => !VALID_PBN_AUCTION_TOKEN.test(token.normalized))
}

export function validateBoardAuctionTokens(boards = []) {
	return boards
		.map((board) => {
			const invalid = invalidAuctionTokens(board.auctionText)
			if (!invalid.length) return null
			return {
				boardId: board.id,
				boardNumber: board.number,
				tokens: [...new Set(invalid.map((token) => token.raw))],
			}
		})
		.filter(Boolean)
}

export function formatAuctionTokenIssue(issue) {
	const tokens = issue.tokens.map((token) => `"${token}"`).join(', ')
	return `Board ${issue.boardNumber} has invalid auction token${issue.tokens.length === 1 ? '' : 's'}: ${tokens}. ${PBN_AUCTION_TOKEN_HELP}`
}

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
				id: 'two_nt_opening',
				title: '2NT Openings',
				description: 'Balanced 20-22 HCP openings with simple game decisions.',
			},
			{
				id: 'strong_two_club',
				title: 'Strong 2C Openings',
				description: 'Strong 23+ HCP openings starting with the artificial 2C bid.',
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
			{
				id: 'negative_double',
				title: 'Negative Doubles',
				description: 'Responder doubles after an overcall to show the unbid major.',
			},
		],
	},
	{
		level: 'Intermediate',
		topics: [
			{
				id: 'two_nt_stayman',
				title: 'Stayman After 2NT',
				description: 'Responder uses 3C to ask for a four-card major after 2NT.',
			},
			{
				id: 'two_nt_transfers',
				title: 'Transfers After 2NT',
				description: 'Responder transfers to a five-card major after a strong 2NT.',
			},
			{
				id: 'slam_teaching',
				title: 'Slam Exploration',
				description: 'Clean high-card and control hands suitable for slam teaching.',
			},
			{
				id: 'gerber_ace_asking',
				title: 'Gerber Ace Asking',
				description: '4C ace asking after 1NT, with responses matched to opener aces.',
			},
			{
				id: 'blackwood_ace_asking',
				title: 'Blackwood Ace Asking',
				description: '4NT ace asking after a major fit and slam values.',
			},
			{
				id: 'fourth_suit_forcing',
				title: 'Fourth-Suit Forcing',
				description: 'Responder bids the fourth suit to force and find the best game.',
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
	profile: 'standard',
	oneNtMin: 12,
	oneNtMax: 14,
	twoNtMin: 20,
	twoNtMax: 22,
	strongTwoClubMin: 23,
	strongTwoStyle: 'strong_2c',
	majorStyle: 'five_card',
	oneNtStayman: true,
	oneNtTransfers: true,
	twoNtStayman: true,
	twoNtTransfers: true,
	weakTwos: true,
	weakTwoMin: 6,
	weakTwoMax: 10,
	weakThrees: true,
	weakThreeMin: 5,
	weakThreeMax: 10,
	overcalls: true,
	takeoutDoubles: true,
	negativeDoubles: true,
	gerber: true,
	blackwood: true,
	fourthSuitForcing: true,
	stayman: true,
	transfers: true,
}

export const ACOL_PROFILE_OPTIONS = [
	{ id: 'standard', label: 'Standard ACOL' },
	{ id: 'benjaminised', label: 'Benjaminised ACOL' },
	{ id: 'custom', label: 'Custom' },
]

const PROFILE_SETTINGS = {
	standard: { ...DEFAULT_ACOL_SETTINGS },
	benjaminised: {
		...DEFAULT_ACOL_SETTINGS,
		profile: 'benjaminised',
		strongTwoStyle: 'benjaminised',
	},
	custom: {
		...DEFAULT_ACOL_SETTINGS,
		profile: 'custom',
	},
}

function numberInRange(value, fallback, min, max) {
	const n = Number(value)
	if (!Number.isFinite(n)) return fallback
	return Math.max(min, Math.min(max, Math.round(n)))
}

function normalizeRange(minValue, maxValue, fallbackMin, fallbackMax, hardMin, hardMax) {
	let min = numberInRange(minValue, fallbackMin, hardMin, hardMax)
	let max = numberInRange(maxValue, fallbackMax, hardMin, hardMax)
	if (min > max) [min, max] = [max, min]
	return [min, max]
}

function boolOrFallback(value, fallback) {
	return typeof value === 'boolean' ? value : fallback
}

export function settingsForAcolProfile(profile) {
	return { ...(PROFILE_SETTINGS[profile] || PROFILE_SETTINGS.standard) }
}

export function normalizeAcolSettings(input = {}) {
	const requestedProfile = ['standard', 'benjaminised', 'custom'].includes(input?.profile)
		? input.profile
		: 'standard'
	const base = requestedProfile === 'custom'
		? DEFAULT_ACOL_SETTINGS
		: settingsForAcolProfile(requestedProfile)
	const merged = { ...base, ...input }
	const [oneNtMin, oneNtMax] = normalizeRange(merged.oneNtMin, merged.oneNtMax, 12, 14, 10, 18)
	const [twoNtMin, twoNtMax] = normalizeRange(merged.twoNtMin, merged.twoNtMax, 20, 22, 18, 24)
	const [weakTwoMin, weakTwoMax] = normalizeRange(merged.weakTwoMin, merged.weakTwoMax, 6, 10, 0, 15)
	const [weakThreeMin, weakThreeMax] = normalizeRange(merged.weakThreeMin, merged.weakThreeMax, 5, 10, 0, 15)
	const oneNtStayman = boolOrFallback(
		input.oneNtStayman !== undefined ? input.oneNtStayman : input.stayman !== undefined ? input.stayman : merged.oneNtStayman,
		true,
	)
	const oneNtTransfers = boolOrFallback(
		input.oneNtTransfers !== undefined ? input.oneNtTransfers : input.transfers !== undefined ? input.transfers : merged.oneNtTransfers,
		true,
	)
	const normalized = {
		...merged,
		profile: requestedProfile,
		oneNtMin,
		oneNtMax,
		twoNtMin,
		twoNtMax,
		strongTwoClubMin: numberInRange(merged.strongTwoClubMin, 23, 16, 30),
		strongTwoStyle: ['strong_2c', 'benjaminised', 'off'].includes(merged.strongTwoStyle)
			? merged.strongTwoStyle
			: 'strong_2c',
		majorStyle: merged.majorStyle === 'four_card' ? 'four_card' : 'five_card',
		oneNtStayman,
		oneNtTransfers,
		twoNtStayman: boolOrFallback(merged.twoNtStayman, true),
		twoNtTransfers: boolOrFallback(merged.twoNtTransfers, true),
		weakTwos: boolOrFallback(merged.weakTwos, true),
		weakTwoMin,
		weakTwoMax,
		weakThrees: boolOrFallback(merged.weakThrees, true),
		weakThreeMin,
		weakThreeMax,
		overcalls: boolOrFallback(merged.overcalls, true),
		takeoutDoubles: boolOrFallback(merged.takeoutDoubles, true),
		negativeDoubles: boolOrFallback(merged.negativeDoubles, true),
		gerber: boolOrFallback(merged.gerber, true),
		blackwood: boolOrFallback(merged.blackwood, true),
		fourthSuitForcing: boolOrFallback(merged.fourthSuitForcing, true),
	}
	return {
		...normalized,
		stayman: normalized.oneNtStayman,
		transfers: normalized.oneNtTransfers,
	}
}

function profileLabel(profile) {
	return ACOL_PROFILE_OPTIONS.find((item) => item.id === profile)?.label || 'Standard ACOL'
}

function onOff(value) {
	return value ? 'on' : 'off'
}

export function acolSettingsSummary(input = {}) {
	const settings = normalizeAcolSettings(input)
	const strongTwo =
		settings.strongTwoStyle === 'strong_2c'
			? `Strong 2C ${settings.strongTwoClubMin}+`
			: settings.strongTwoStyle === 'benjaminised'
				? 'Benjaminised twos'
				: 'Strong twos off'
	return [
		`Profile: ${profileLabel(settings.profile)}`,
		`1NT ${settings.oneNtMin}-${settings.oneNtMax}; 2NT ${settings.twoNtMin}-${settings.twoNtMax}`,
		`Majors: ${settings.majorStyle === 'four_card' ? '4-card' : '5-card'}; ${strongTwo}`,
		`Weak twos ${onOff(settings.weakTwos)} ${settings.weakTwoMin}-${settings.weakTwoMax}; weak threes ${onOff(settings.weakThrees)} ${settings.weakThreeMin}-${settings.weakThreeMax}`,
		`1NT Stayman ${onOff(settings.oneNtStayman)}, transfers ${onOff(settings.oneNtTransfers)}; 2NT Stayman ${onOff(settings.twoNtStayman)}, transfers ${onOff(settings.twoNtTransfers)}`,
		`Overcalls ${onOff(settings.overcalls)}; takeout X ${onOff(settings.takeoutDoubles)}; negative X ${onOff(settings.negativeDoubles)}`,
		`Gerber ${onOff(settings.gerber)}; Blackwood ${onOff(settings.blackwood)}; 4SF ${onOff(settings.fourthSuitForcing)}`,
	]
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
	showHints,
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
		showHints,
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

const BID_STRAIN_ORDER = { C: 0, D: 1, H: 2, S: 3, NT: 4 }

function bidParts(call) {
	const match = String(call || '').match(/^([1-7])(C|D|H|S|NT)$/)
	if (!match) return null
	return { level: Number(match[1]), strain: match[2] }
}

function bidValue(call) {
	const parts = bidParts(call)
	if (!parts) return null
	return parts.level * 5 + BID_STRAIN_ORDER[parts.strain]
}

function cheapestBidForSuit(suit, overBid) {
	const overValue = bidValue(overBid)
	if (overValue === null) return `1${suit}`
	for (let level = 1; level <= 7; level++) {
		const bid = `${level}${suit}`
		if (bidValue(bid) > overValue) return bid
	}
	return null
}

function oneLevelSuitOpening(cards, settings) {
	const opener = openingBidForHand(cards, settings)
	return /^1[CDHS]$/.test(opener) ? opener : null
}

function bestSuit(lengths, suits, options = {}) {
	const { requireLength = 0, preferMajors = true } = options
	const candidates = suits.filter((suit) => lengths[suit] >= requireLength)
	if (!candidates.length) return ''
	const rankSuit = (suit) => {
		if (!preferMajors) return 0
		if (suit === 'S') return 3
		if (suit === 'H') return 2
		if (suit === 'D') return 1
		return 0
	}
	return [...candidates].sort((a, b) => {
		if (lengths[b] !== lengths[a]) return lengths[b] - lengths[a]
		return rankSuit(b) - rankSuit(a)
	})[0]
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

function disabledConventionReason(presetId, settings) {
	if (presetId === 'stayman' && !settings.oneNtStayman) return 'Stayman after 1NT is off'
	if (presetId === 'transfers' && !settings.oneNtTransfers) return 'Transfers after 1NT are off'
	if (presetId === 'two_nt_stayman' && !settings.twoNtStayman) return 'Stayman after 2NT is off'
	if (presetId === 'two_nt_transfers' && !settings.twoNtTransfers) return 'Transfers after 2NT are off'
	if (presetId === 'strong_two_club' && settings.strongTwoStyle !== 'strong_2c') {
		return settings.strongTwoStyle === 'benjaminised'
			? 'Benjaminised ACOL gives 2C/2D different meanings'
			: 'Strong 2C openings are off'
	}
	if (presetId === 'weak_twos' && !settings.weakTwos) return 'Weak twos are off'
	if (presetId === 'weak_threes' && !settings.weakThrees) return 'Weak threes are off'
	if (presetId === 'overcalls' && !settings.overcalls) return 'Overcalls are off'
	if (presetId === 'takeout_double' && !settings.takeoutDoubles) return 'Takeout doubles are off'
	if (presetId === 'negative_double' && !settings.negativeDoubles) return 'Negative doubles are off'
	if (presetId === 'gerber_ace_asking' && !settings.gerber) return 'Gerber is off'
	if (presetId === 'blackwood_ace_asking' && !settings.blackwood) return 'Blackwood is off'
	if (presetId === 'fourth_suit_forcing' && !settings.fourthSuitForcing) return 'Fourth-suit forcing is off'
	return ''
}

export function acolTopicAvailability(presetId, settingsInput = DEFAULT_ACOL_SETTINGS) {
	const settings = normalizeAcolSettings(settingsInput)
	const reason = disabledConventionReason(presetId, settings)
	return {
		enabled: !reason,
		reason,
		settings,
	}
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

export function completePartialHandsRandomly(partialHands = {}, availableCards = []) {
	const hands = { N: [], E: [], S: [], W: [] }
	const usedIds = new Set()
	for (const seat of SEATS) {
		const cards = [...(partialHands[seat] || [])]
		if (cards.length > 13) return null
		for (const card of cards) {
			if (!card || usedIds.has(card.id)) return null
			usedIds.add(card.id)
		}
		hands[seat] = cards
	}

	const needed = SEATS.reduce((sum, seat) => sum + Math.max(0, 13 - hands[seat].length), 0)
	const available = shuffle((availableCards || []).filter((card) => card && !usedIds.has(card.id)))
	if (available.length !== needed) return null

	let cursor = 0
	for (const seat of SEATS) {
		const slots = 13 - hands[seat].length
		if (slots > 0) {
			hands[seat] = [...hands[seat], ...available.slice(cursor, cursor + slots)]
			cursor += slots
		}
	}
	return { hands, deck: [], filledCount: cursor }
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
			settings.oneNtStayman &&
			oneNtOpenerOk(hands, dealer, settings) &&
			partnerHcp >= 8 &&
			(partnerLengths.S === 4 || partnerLengths.H === 4)
		)
	}
	if (presetId === 'transfers') {
		return (
			settings.oneNtTransfers &&
			oneNtOpenerOk(hands, dealer, settings) &&
			partnerHcp >= 6 &&
			(partnerLengths.S >= 5 || partnerLengths.H >= 5)
		)
	}
	if (presetId === 'two_nt_opening') {
		return dealerHcp >= settings.twoNtMin && dealerHcp <= settings.twoNtMax && isBalanced(dealerLengths)
	}
	if (presetId === 'strong_two_club') {
		return settings.strongTwoStyle === 'strong_2c' && dealerHcp >= settings.strongTwoClubMin && isBalanced(dealerLengths)
	}
	if (presetId === 'two_nt_stayman') {
		return (
			settings.twoNtStayman &&
			dealerHcp >= settings.twoNtMin &&
			dealerHcp <= settings.twoNtMax &&
			isBalanced(dealerLengths) &&
			partnerHcp >= 4 &&
			(partnerLengths.S === 4 || partnerLengths.H === 4) &&
			partnerLengths.S <= 4 &&
			partnerLengths.H <= 4
		)
	}
	if (presetId === 'two_nt_transfers') {
		return (
			settings.twoNtTransfers &&
			dealerHcp >= settings.twoNtMin &&
			dealerHcp <= settings.twoNtMax &&
			isBalanced(dealerLengths) &&
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
		return settings.weakTwos && major && dealerHcp >= settings.weakTwoMin && dealerHcp <= settings.weakTwoMax
	}
	if (presetId === 'weak_threes') {
		return (
			settings.weakThrees &&
			Object.values(dealerLengths).some((len) => len >= 7) &&
			dealerHcp >= settings.weakThreeMin &&
			dealerHcp <= settings.weakThreeMax
		)
	}
	if (presetId === 'overcalls') {
		if (!settings.overcalls) return false
		const opener = oneLevelSuitOpening(hands[dealer], settings)
		if (!opener) return false
		const openerSuit = opener.slice(1)
		const overcaller = leftOf(dealer)
		const overHcp = hcp(hands[overcaller])
		const overLens = suitLengths(hands[overcaller])
		const overSuit = bestSuit(overLens, ['S', 'H', 'D', 'C'].filter((suit) => suit !== openerSuit), { requireLength: 5 })
		const overcall = overSuit ? cheapestBidForSuit(overSuit, opener) : null
		const minHcp = overcall && overcall[0] === '2' ? 10 : 8
		return (
			dealerHcp >= 12 &&
			!!overcall &&
			Number(overcall[0]) <= 2 &&
			overHcp >= minHcp &&
			overHcp <= 16
		)
	}
	if (presetId === 'takeout_double') {
		if (!settings.takeoutDoubles) return false
		const opener = oneLevelSuitOpening(hands[dealer], settings)
		if (!opener) return false
		const doubler = leftOf(dealer)
		const advancer = partnerOf(doubler)
		const openerSuit = opener.slice(1)
		const doublerLens = suitLengths(hands[doubler])
		const otherSuits = ['S', 'H', 'D', 'C'].filter((suit) => suit !== openerSuit)
		const advancerLens = suitLengths(hands[advancer])
		return (
			dealerHcp >= 12 &&
			hcp(hands[doubler]) >= 12 &&
			doublerLens[openerSuit] <= 2 &&
			otherSuits.filter((suit) => doublerLens[suit] >= 3).length >= 3 &&
			otherSuits.some((suit) => advancerLens[suit] >= 4)
		)
	}
	if (presetId === 'negative_double') {
		if (!settings.negativeDoubles) return false
		const opener = oneLevelSuitOpening(hands[dealer], settings)
		if (opener !== '1C' && opener !== '1D') return false
		const overcaller = leftOf(dealer)
		const responder = partnerOf(dealer)
		const overLens = suitLengths(hands[overcaller])
		const responderLens = suitLengths(hands[responder])
		return (
			dealerHcp >= 12 &&
			dealerHcp <= 19 &&
			dealerLengths.H >= 3 &&
			hcp(hands[overcaller]) >= 8 &&
			hcp(hands[overcaller]) <= 16 &&
			overLens.S >= 5 &&
			hcp(hands[responder]) >= 6 &&
			responderLens.H >= 4
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
	if (presetId === 'gerber_ace_asking') {
		return (
			settings.gerber &&
			oneNtOpenerOk(hands, dealer, settings) &&
			partnerHcp >= 18 &&
			dealerHcp + partnerHcp >= 31 &&
			aceCount(hands[dealer]) >= 1
		)
	}
	if (presetId === 'blackwood_ace_asking') {
		const trump = dealerLengths.S >= 5 ? 'S' : dealerLengths.H >= 5 ? 'H' : ''
		return (
			settings.blackwood &&
			!!trump &&
			dealerHcp >= 16 &&
			partnerHcp >= 12 &&
			dealerHcp + partnerHcp >= 30 &&
			partnerLengths[trump] >= 4 &&
			aceCount(hands[dealer]) + aceCount(hands[partner]) >= 3
		)
	}
	if (presetId === 'fourth_suit_forcing') {
		return (
			settings.fourthSuitForcing &&
			dealerHcp >= 15 &&
			dealerHcp <= 19 &&
			partnerHcp >= 10 &&
			dealerHcp + partnerHcp >= 25 &&
			dealerLengths.D >= 4 &&
			dealerLengths.S >= 4 &&
			dealerLengths.H <= 3 &&
			partnerLengths.H >= 4
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

export function openingBidForHand(cards, settingsInput = DEFAULT_ACOL_SETTINGS) {
	const settings = normalizeAcolSettings(settingsInput)
	const points = hcp(cards)
	const lengths = suitLengths(cards)
	if (points < 12) return 'P'
	if (isBalanced(lengths) && !hasFiveCardMajor(lengths) && points >= settings.oneNtMin && points <= settings.oneNtMax) {
		return '1NT'
	}
	const majorMin = settings.majorStyle === 'four_card' ? 4 : 5
	if (lengths.S >= majorMin || lengths.H >= majorMin) return lengths.S >= lengths.H ? '1S' : '1H'
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

function twoNtOpeningAuction(hands, dealer) {
	const partnerPoints = hcp(hands[partnerOf(dealer)])
	if (partnerPoints >= 12) return finishAuction(['2NT', 'P', '6NT'])
	if (partnerPoints >= 5) return finishAuction(['2NT', 'P', '3NT'])
	return finishAuction(['2NT'])
}

function strongTwoClubAuction(hands, dealer) {
	const partnerPoints = hcp(hands[partnerOf(dealer)])
	const finalBid = partnerPoints >= 9 ? '6NT' : partnerPoints >= 2 ? '3NT' : ''
	const start = ['2C', 'P', '2D', 'P', '2NT']
	return finalBid ? finishAuction([...start, 'P', finalBid]) : finishAuction(start)
}

function twoNtStaymanAuction(hands, dealer) {
	const openerLens = suitLengths(hands[dealer])
	const responderLens = suitLengths(hands[partnerOf(dealer)])
	const response = openerLens.H >= 4 ? '3H' : openerLens.S >= 4 ? '3S' : '3D'
	const fit =
		response === '3H' && responderLens.H >= 4
			? 'H'
			: response === '3S' && responderLens.S >= 4
				? 'S'
				: ''
	const finalBid = fit ? `4${fit}` : '3NT'
	return finishAuction(['2NT', 'P', '3C', 'P', response, 'P', finalBid])
}

function twoNtTransferAuction(hands, dealer) {
	const responder = partnerOf(dealer)
	const openerLens = suitLengths(hands[dealer])
	const responderLens = suitLengths(hands[responder])
	const target = responderLens.H >= 5 ? 'H' : 'S'
	const transfer = target === 'H' ? '3D' : '3H'
	const partnerPoints = hcp(hands[responder])
	const fit = responderLens[target] >= 6 || openerLens[target] >= 3
	const finalBid = partnerPoints >= 4 ? (fit ? `4${target}` : '3NT') : ''
	const start = ['2NT', 'P', transfer, 'P', `3${target}`]
	return finalBid ? finishAuction([...start, 'P', finalBid]) : finishAuction(start)
}

function overcallAuction(hands, dealer, settings) {
	const opener = oneLevelSuitOpening(hands[dealer], settings)
	if (!opener) return null
	const openerSuit = opener.slice(1)
	const overcaller = leftOf(dealer)
	const overLens = suitLengths(hands[overcaller])
	const overSuit = bestSuit(overLens, ['S', 'H', 'D', 'C'].filter((suit) => suit !== openerSuit), { requireLength: 5 })
	const overcall = overSuit ? cheapestBidForSuit(overSuit, opener) : null
	return overcall ? finishAuction([opener, overcall]) : null
}

function takeoutDoubleAuction(hands, dealer, settings) {
	const opener = oneLevelSuitOpening(hands[dealer], settings)
	if (!opener) return null
	const openerSuit = opener.slice(1)
	const doubler = leftOf(dealer)
	const advancer = partnerOf(doubler)
	const advancerLens = suitLengths(hands[advancer])
	const advanceSuit = bestSuit(
		advancerLens,
		['S', 'H', 'D', 'C'].filter((suit) => suit !== openerSuit),
		{ requireLength: 4 },
	)
	const advanceBid = advanceSuit ? cheapestBidForSuit(advanceSuit, opener) : null
	return advanceBid ? finishAuction([opener, 'X', 'P', advanceBid]) : null
}

function negativeDoubleAuction(hands, dealer, settings) {
	const opener = oneLevelSuitOpening(hands[dealer], settings)
	if (opener !== '1C' && opener !== '1D') return null
	return finishAuction([opener, '1S', 'X', 'P', '2H'])
}

function gerberAuction(hands, dealer) {
	const response = gerberResponse(hands[dealer])
	return finishAuction(['1NT', 'P', '4C', 'P', response, 'P', '6NT'])
}

function blackwoodAuction(hands, dealer) {
	const partner = partnerOf(dealer)
	const dealerLens = suitLengths(hands[dealer])
	const trump = dealerLens.S >= 5 ? 'S' : 'H'
	const response = blackwoodResponse(hands[partner])
	return finishAuction([`1${trump}`, 'P', `3${trump}`, 'P', '4NT', 'P', response, 'P', `6${trump}`])
}

function fourthSuitForcingAuction() {
	return finishAuction(['1D', 'P', '1H', 'P', '1S', 'P', '2C', 'P', '2NT', 'P', '3NT'])
}

function basicAuction(presetId, hands, dealer, settings) {
	const partner = partnerOf(dealer)
	const partnerPoints = hcp(hands[partner])
	const partnerLens = suitLengths(hands[partner])
	const dealerLens = suitLengths(hands[dealer])

	if (presetId === 'two_nt_opening') return twoNtOpeningAuction(hands, dealer)
	if (presetId === 'strong_two_club') return strongTwoClubAuction(hands, dealer)
	if (presetId === 'two_nt_stayman') return twoNtStaymanAuction(hands, dealer)
	if (presetId === 'two_nt_transfers') return twoNtTransferAuction(hands, dealer)
	if (presetId === 'overcalls') {
		const auction = overcallAuction(hands, dealer, settings)
		if (auction) return auction
	}
	if (presetId === 'takeout_double') {
		const auction = takeoutDoubleAuction(hands, dealer, settings)
		if (auction) return auction
	}
	if (presetId === 'negative_double') {
		const auction = negativeDoubleAuction(hands, dealer, settings)
		if (auction) return auction
	}
	if (presetId === 'gerber_ace_asking') return gerberAuction(hands, dealer)
	if (presetId === 'blackwood_ace_asking') return blackwoodAuction(hands, dealer)
	if (presetId === 'fourth_suit_forcing') return fourthSuitForcingAuction()

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
	if (presetId === 'two_nt_opening') {
		return `${topic.title}: ${dealer} has ${dealerPoints} HCP and a balanced ${settings.twoNtMin}-${settings.twoNtMax} 2NT opening. Partner ${partner} has ${hcp(hands[partner])} HCP.`
	}
	if (presetId === 'strong_two_club') {
		return `${topic.title}: ${dealer} has ${dealerPoints} HCP and opens 2C (${settings.strongTwoClubMin}+ style), then rebids 2NT after the 2D response. Partner ${partner} has ${hcp(hands[partner])} HCP.`
	}
	if (presetId === 'two_nt_stayman') {
		return `${topic.title}: ${dealer} has a balanced ${settings.twoNtMin}-${settings.twoNtMax} HCP 2NT opening. ${partner} uses 3C Stayman with a four-card major.`
	}
	if (presetId === 'two_nt_transfers') {
		return `${topic.title}: ${dealer} has a balanced ${settings.twoNtMin}-${settings.twoNtMax} HCP 2NT opening. ${partner} transfers to a five-card major.`
	}
	if (presetId === 'game_ns') {
		return `N/S game-values hand. N/S have ${ns} combined HCP; review whether the class reaches a sensible game.`
	}
	if (presetId === 'overcalls') {
		return `${topic.title}: ${leftOf(dealer)} has a good five-card suit to overcall after ${dealer} opens. HCP: N/S ${ns}, E/W ${ew}.`
	}
	if (presetId === 'takeout_double') {
		return `${topic.title}: ${leftOf(dealer)} has opening values, shortness in opener's suit and support for the other suits. HCP: N/S ${ns}, E/W ${ew}.`
	}
	if (presetId === 'negative_double') {
		return `${topic.title}: ${partner} shows hearts with a negative double after ${leftOf(dealer)} overcalls 1S. HCP: N/S ${ns}, E/W ${ew}.`
	}
	if (presetId === 'slam_teaching') {
		return `Slam exploration hand. N/S ${ns} HCP, E/W ${ew} HCP; focus on controls, fit and whether slam is sensible.`
	}
	if (presetId === 'gerber_ace_asking') {
		return `${topic.title}: ${dealer} opens 1NT and ${partner} uses 4C Gerber. The response matches opener's ace count.`
	}
	if (presetId === 'blackwood_ace_asking') {
		return `${topic.title}: ${dealer} opens a major, the partnership finds a fit, then uses 4NT Blackwood before bidding slam.`
	}
	if (presetId === 'fourth_suit_forcing') {
		return `${topic.title}: ${partner} bids the fourth suit after 1D-1H-1S to force and investigate the best game.`
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
	const settings = normalizeAcolSettings(acolSettings)
	const requested = Math.max(1, Math.min(48, Number(count) || 1))
	const firstBoard = Math.max(1, Number(startBoard) || 1)
	let totalAttempts = 0
	const topic = topicById(presetId)
	const availability = acolTopicAvailability(presetId, settings)
	if (!availability.enabled) {
		return {
			boards,
			warnings: [
				`${topic.title}: ${availability.reason}. Change ACOL Defaults or choose a different topic.`,
			],
			attempts: 0,
		}
	}

	for (let index = 0; index < requested; index++) {
		const boardNo = firstBoard + index
		const dealer = dealerMode === 'fixed' ? dealerSeat : dealerForBoard(boardNo)
		let accepted = null
		const maxAttempts =
			presetId === 'custom_hcp'
				? 400
				: [
						'two_nt_opening',
						'strong_two_club',
						'two_nt_stayman',
						'two_nt_transfers',
						'takeout_double',
						'negative_double',
						'gerber_ace_asking',
						'blackwood_ace_asking',
						'fourth_suit_forcing',
					].includes(presetId)
					? 40000
					: 10000
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
