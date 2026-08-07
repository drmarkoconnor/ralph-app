import { z } from 'zod'

export const COACH_MODEL = 'gpt-5.6-luna'
export const COACH_OWNER_ROLE = 'coach-owner'
export const LEGACY_SOUTH_COACH_PROFILE_ID = 'south-acol-12-14-safe-v1'
export const LEARNER_COACH_PROFILE_ID = 'learner-acol-12-14-safe-v2'

export const COACH_INTENTS = ['nudge', 'explain', 'compare', 'remember'] as const

const SEATS = ['N', 'E', 'S', 'W'] as const
const LEARNER_SEATS = ['N', 'S'] as const
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'] as const
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as const

const seatSchema = z.enum(SEATS)
const suitSchema = z.enum(SUITS)
const rankSchema = z.enum(RANKS)
const cardSchema = z.object({ rank: rankSchema, suit: suitSchema }).strict()
const cardsSchema = z.array(cardSchema).max(13)

const handSchema = z
	.object({
		seat: seatSchema,
		initial: cardsSchema.length(13),
		remaining: cardsSchema,
	})
	.strict()
	.superRefine((hand, context) => {
		const initial = new Set(hand.initial.map(cardKey))
		const remaining = new Set(hand.remaining.map(cardKey))
		if (initial.size !== hand.initial.length) {
			context.addIssue({ code: 'custom', path: ['initial'], message: 'Cards must be unique.' })
		}
		if (remaining.size !== hand.remaining.length) {
			context.addIssue({ code: 'custom', path: ['remaining'], message: 'Cards must be unique.' })
		}
		for (const key of remaining) {
			if (!initial.has(key)) {
				context.addIssue({
					code: 'custom',
					path: ['remaining'],
					message: 'Remaining cards must come from the initial hand.',
				})
				break
			}
		}
	})

const auctionCallSchema = z
	.object({
		seat: seatSchema,
		call: z.string().regex(/^(?:P|X|XX|[1-7](?:C|D|H|S|NT))$/),
	})
	.strict()

const auctionSchema = z
	.object({
		dealer: seatSchema,
		cursor: z.number().int().min(0).max(80),
		calls: z.array(auctionCallSchema).max(80),
		nextSeat: seatSchema.nullable(),
		learnerToCall: z.boolean(),
		isComplete: z.boolean(),
	})
	.strict()
	.superRefine((auction, context) => {
		if (auction.cursor !== auction.calls.length) {
			context.addIssue({ code: 'custom', path: ['cursor'], message: 'Auction cursor is inconsistent.' })
		}
		const dealerIndex = SEATS.indexOf(auction.dealer)
		auction.calls.forEach((entry, index) => {
			if (entry.seat !== SEATS[(dealerIndex + index) % SEATS.length]) {
				context.addIssue({
					code: 'custom',
					path: ['calls', index, 'seat'],
					message: 'Auction seat order is inconsistent.',
				})
			}
		})
		if (auction.isComplete && auction.nextSeat !== null) {
			context.addIssue({ code: 'custom', path: ['nextSeat'], message: 'A completed auction has no next seat.' })
		}
	})

const contractSchema = z
	.object({
		level: z.number().int().min(1).max(7),
		strain: z.enum(['C', 'D', 'H', 'S', 'NT']),
		doubled: z.enum(['', 'X', 'XX']),
		declarer: seatSchema,
		dummy: seatSchema,
		trump: suitSchema.nullable(),
	})
	.strict()
	.superRefine((contract, context) => {
		const declarerIndex = SEATS.indexOf(contract.declarer)
		if (contract.dummy !== SEATS[(declarerIndex + 2) % SEATS.length]) {
			context.addIssue({ code: 'custom', path: ['dummy'], message: 'Dummy must be declarer\'s partner.' })
		}
		const expectedTrump = {
			C: 'Clubs',
			D: 'Diamonds',
			H: 'Hearts',
			S: 'Spades',
			NT: null,
		}[contract.strain]
		if (contract.trump !== expectedTrump) {
			context.addIssue({ code: 'custom', path: ['trump'], message: 'Trump does not match the contract.' })
		}
	})

const learnerHandFactsSchema = z
	.object({
		hcp: z.number().int().min(0).max(40),
		shape: z
			.object({
				Spades: z.number().int().min(0).max(13),
				Hearts: z.number().int().min(0).max(13),
				Diamonds: z.number().int().min(0).max(13),
				Clubs: z.number().int().min(0).max(13),
			})
			.strict(),
		shapePattern: z.string().regex(/^\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2}$/),
		commonBalancedShape: z.boolean(),
		fourCardMajors: z.array(z.enum(['Spades', 'Hearts'])).max(2),
	})
	.strict()

const acolFactsSchema = z
	.object({
		oneNoTrumpOpeningRangeHcp: z.tuple([z.literal(12), z.literal(14)]),
		directResponseToPartnerOneNoTrump: z.boolean(),
		hasFourCardMajor: z.boolean(),
		fourCardMajors: z.array(z.enum(['Spades', 'Hearts'])).max(2),
	})
	.strict()

const playedCardSchema = z
	.object({
		sequence: z.number().int().min(1).max(52),
		seat: seatSchema,
		card: cardSchema,
	})
	.strict()

const outstandingSuitSchema = z
	.object({
		playedCount: z.number().int().min(0).max(13),
		playedRanks: z.array(rankSchema).max(13),
		knownRemainingCount: z.number().int().min(0).max(13),
		unaccountedCount: z.number().int().min(0).max(13),
		highestUnplayedRank: rankSchema.nullable(),
		highestUnaccountedRank: rankSchema.nullable(),
		unaccountedRanks: z.array(rankSchema).max(13),
	})
	.strict()

const suitMap = <T extends z.ZodTypeAny>(value: T) =>
	z.object({ Spades: value, Hearts: value, Diamonds: value, Clubs: value }).strict()

const seatSuitMapSchema = z
	.object({
		N: z.array(suitSchema).max(4),
		E: z.array(suitSchema).max(4),
		S: z.array(suitSchema).max(4),
		W: z.array(suitSchema).max(4),
	})
	.strict()

const trumpFactsSchema = z.discriminatedUnion('isNoTrump', [
	z.object({ isNoTrump: z.literal(true) }).strict(),
	z
		.object({
			isNoTrump: z.literal(false),
			suit: suitSchema,
			playedCount: z.number().int().min(0).max(13),
			totalUnplayedCount: z.number().int().min(0).max(13),
			knownRemainingBySeat: z.partialRecord(seatSchema, z.number().int().min(0).max(13)),
			unaccountedCount: z.number().int().min(0).max(13),
		})
		.strict(),
])

const legalFollowSchema = z.discriminatedUnion('learnerToPlay', [
	z.object({ learnerToPlay: z.literal(false) }).strict(),
	z
		.object({
			learnerToPlay: z.literal(true),
			leadSuit: suitSchema.nullable(),
			mustFollowSuit: z.boolean(),
			legalCards: cardsSchema,
			legalCardCount: z.number().int().min(0).max(13),
		})
		.strict(),
])

const playFactsSchema = z
	.object({
		dummyExposed: z.boolean(),
		turnSeat: z.union([seatSchema, z.literal('')]),
		playedCards: z.array(playedCardSchema).max(52),
		trickWinners: z
			.array(
				z
					.object({
						trickNumber: z.number().int().min(1).max(13),
						winner: seatSchema,
					})
					.strict(),
			)
			.max(13),
		voidsShownByPlay: seatSuitMapSchema,
		outstandingCards: suitMap(outstandingSuitSchema),
		trumps: trumpFactsSchema,
		legalFollow: legalFollowSchema,
	})
	.strict()
	.superRefine((play, context) => {
		const played = new Set<string>()
		play.playedCards.forEach((entry, index) => {
			if (entry.sequence !== index + 1) {
				context.addIssue({
					code: 'custom',
					path: ['playedCards', index, 'sequence'],
					message: 'Played-card sequence is inconsistent.',
				})
			}
			const key = cardKey(entry.card)
			if (played.has(key)) {
				context.addIssue({
					code: 'custom',
					path: ['playedCards', index, 'card'],
					message: 'A card cannot be played twice.',
				})
			}
			played.add(key)
		})
		if (play.legalFollow.learnerToPlay && play.legalFollow.legalCardCount !== play.legalFollow.legalCards.length) {
			context.addIssue({
				code: 'custom',
				path: ['legalFollow', 'legalCardCount'],
				message: 'Legal-card count is inconsistent.',
			})
		}
	})

const profileSchema = z
	.object({
		id: z.enum([LEGACY_SOUTH_COACH_PROFILE_ID, LEARNER_COACH_PROFILE_ID]),
		learnerSeat: z.enum(LEARNER_SEATS),
		hintMode: z.literal('safer'),
		biddingSystem: z
			.object({
				name: z.literal('ACOL'),
				oneNoTrump: z
					.object({
						hcpMinimum: z.literal(12),
						hcpMaximum: z.literal(14),
						shape: z.literal('balanced'),
					})
					.strict(),
				stayman: z
					.object({ call: z.literal('2C'), asksForFourCardMajor: z.literal(true) })
					.strict(),
			})
			.strict(),
		disclosure: z
			.object({
				hiddenCardLocations: z.literal(false),
				futureAuctionCalls: z.literal(false),
				doubleDummyAnalysis: z.literal(false),
			})
			.strict(),
	})
	.strict()
	.superRefine((profile, context) => {
		if (profile.id === LEGACY_SOUTH_COACH_PROFILE_ID && profile.learnerSeat !== 'S') {
			context.addIssue({
				code: 'custom',
				path: ['learnerSeat'],
				message: 'The legacy South profile is restricted to South.',
			})
		}
	})

export const coachContextSchema = z
	.object({
		schemaVersion: z.literal(1),
		eventKey: z
			.string()
			.max(64)
			.regex(/^\d{1,4}:(?:auction:\d{1,2}|play:\d{1,2}:[NESW-])$/),
		trigger: z.enum(['manual', 'auction-step', 'opening-lead', 'learner-turn', 'explain-last-action']),
		phase: z.enum(['auction', 'opening-lead', 'play']),
		profile: profileSchema,
		board: z
			.object({
				number: z.string().regex(/^\d{1,4}$/),
				dealer: seatSchema,
				vulnerability: z.enum(['None', 'NS', 'EW', 'All']),
			})
			.strict(),
		perspective: z
			.object({
				seat: z.enum(LEARNER_SEATS),
				role: z.enum(['bidder', 'declarer', 'dummy', 'defender']),
				knownHands: z.array(handSchema).min(1).max(2),
			})
			.strict(),
		auction: auctionSchema,
		contract: contractSchema.optional(),
		facts: z
			.object({
				learnerHand: learnerHandFactsSchema,
				acol: acolFactsSchema,
				play: playFactsSchema.optional(),
			})
			.strict(),
	})
	.strict()
	.superRefine((coachContext, context) => {
		const { phase, profile, perspective, auction, contract, facts } = coachContext
		const learnerSeat = profile.learnerSeat
		if (perspective.seat !== learnerSeat) {
			context.addIssue({
				code: 'custom',
				path: ['perspective', 'seat'],
				message: 'Perspective seat must match the selected learner seat.',
			})
		}
		if (perspective.knownHands[0]?.seat !== learnerSeat) {
			context.addIssue({
				code: 'custom',
				path: ['perspective', 'knownHands', 0, 'seat'],
				message: 'The first known hand must belong to the selected learner seat.',
			})
		}
		if (auction.learnerToCall !== (auction.nextSeat === learnerSeat)) {
			context.addIssue({
				code: 'custom',
				path: ['auction', 'learnerToCall'],
				message: 'Learner turn marker is inconsistent with the selected learner seat.',
			})
		}
		if (new Set(perspective.knownHands.map((hand) => hand.seat)).size !== perspective.knownHands.length) {
			context.addIssue({
				code: 'custom',
				path: ['perspective', 'knownHands'],
				message: 'Known-hand seats must be unique.',
			})
		}

		if (phase !== 'play' && perspective.knownHands.length !== 1) {
			context.addIssue({
				code: 'custom',
				path: ['perspective', 'knownHands'],
				message: 'Only the selected learner hand may be known before card play.',
			})
		}
		if (phase === 'play') {
			if (!contract || !facts.play) {
				context.addIssue({ code: 'custom', path: ['facts'], message: 'Play requires a contract and public play facts.' })
			}
			if (perspective.knownHands.length === 2 && perspective.knownHands[1]?.seat !== contract?.dummy) {
				context.addIssue({
					code: 'custom',
					path: ['perspective', 'knownHands', 1, 'seat'],
					message: 'The only additional known hand may be dummy.',
				})
			}
			if (perspective.knownHands.length === 2 && !facts.play?.dummyExposed) {
				context.addIssue({
					code: 'custom',
					path: ['facts', 'play', 'dummyExposed'],
					message: 'Dummy must be exposed before its cards are included.',
				})
			}
		} else if (facts.play) {
			context.addIssue({ code: 'custom', path: ['facts', 'play'], message: 'Play facts are not allowed yet.' })
		}

		const expectedRole = !contract
			? 'bidder'
			: learnerSeat === contract.declarer
				? 'declarer'
				: learnerSeat === contract.dummy
					? 'dummy'
					: 'defender'
		if (perspective.role !== expectedRole) {
			context.addIssue({
				code: 'custom',
				path: ['perspective', 'role'],
				message: 'Learner role is inconsistent with the visible contract.',
			})
		}

		if (phase === 'opening-lead' && !contract) {
			context.addIssue({ code: 'custom', path: ['contract'], message: 'Opening-lead coaching requires a contract.' })
		}
	})

const safeQuestionSchema = z
	.string()
	.trim()
	.min(1)
	.max(500)
	.refine((question) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(question), {
		message: 'Question contains unsupported control characters.',
	})

export const coachRequestSchema = z
	.object({
		intent: z.enum(COACH_INTENTS),
		question: safeQuestionSchema.optional(),
		context: coachContextSchema,
	})
	.strict()

export const coachTrialRequestSchema = z
	.object({
		intent: z.literal('nudge'),
		context: coachContextSchema,
	})
	.strict()

export type CoachRequest = z.infer<typeof coachRequestSchema>
export type CoachTrialRequest = z.infer<typeof coachTrialRequestSchema>

export type CoachOutput = {
	message: string
	concept: string
	certainty: 'known' | 'certain-deduction' | 'likely' | 'unknown'
	factsUsed: string[]
	suggestedChecks: string[]
}

export const COACH_OUTPUT_JSON_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		message: { type: 'string' },
		concept: { type: 'string' },
		certainty: { type: 'string', enum: ['known', 'certain-deduction', 'likely', 'unknown'] },
		factsUsed: { type: 'array', items: { type: 'string' } },
		suggestedChecks: { type: 'array', items: { type: 'string' } },
	},
	required: ['message', 'concept', 'certainty', 'factsUsed', 'suggestedChecks'],
} as const

const certaintySchema = z.enum(['known', 'certain-deduction', 'likely', 'unknown'])

const HIDDEN_ACTOR =
	'(?:north|south|east|west|partner|declarer|dummy|both defenders|defenders|both opponents|opponents|opponent|left-hand opponent|right-hand opponent)'
const HIDDEN_SUIT = '(?:trumps?|spades?|hearts?|diamonds?|clubs?)'
const HIDDEN_CARD_OR_COUNT =
	`(?:(?:ace|king|queen|jack|ten|[2-9])(?:\\s+of\\s+${HIDDEN_SUIT})?|\\d+\\s+${HIDDEN_SUIT})`

const UNSUPPORTED_HIDDEN_CLAIMS = [
	new RegExp(
		`\\b${HIDDEN_ACTOR}\\b[^.!?\\n]{0,55}\\b(?:(?:(?:may|might|must|will|likely|probably|possibly|certainly|apparently|expected)\\s+)?(?:holds?|hold|has|have|to hold|to have)\\s+(?:exactly\\s+|the\\s+|an?\\s+)?${HIDDEN_CARD_OR_COUNT}|(?:is|are|may be|might be|must be|will be|likely|probably)\\s+(?:void|out of)\\s+${HIDDEN_SUIT}|(?:has|have)\\s+no\\s+${HIDDEN_SUIT}|(?:does not|do not|doesn't|don't)\\s+have\\s+any\\s+${HIDDEN_SUIT})\\b`,
		'i',
	),
	new RegExp(
		`\\b${HIDDEN_CARD_OR_COUNT}\\b[^.!?\\n]{0,55}\\b(?:is|are|sits?|lies?|must be|will be|may be|might be|is likely|are likely)\\s+(?:with|in)\\s+(?:the\\s+)?${HIDDEN_ACTOR}\\b`,
		'i',
	),
]

const SAFE_FALLBACK: CoachOutput = {
	message:
		'I cannot safely place an unseen card from the information available. Separate what has been shown from what is only possible, then update your count from the auction and cards already played.',
	concept: 'Known information versus inference',
	certainty: 'unknown',
	factsUsed: [],
	suggestedChecks: ['Count the cards already played in the relevant suit.'],
}

function boundedText(value: unknown, maximum: number) {
	if (typeof value !== 'string') return ''
	const text = value.replace(/\s+/g, ' ').trim()
	return text.length <= maximum ? text : `${text.slice(0, maximum - 1).trimEnd()}…`
}

function boundedList(value: unknown, maximumItems: number, maximumLength: number) {
	if (!Array.isArray(value)) return []
	return value
		.map((item) => boundedText(item, maximumLength))
		.filter(Boolean)
		.slice(0, maximumItems)
}

export function sanitizeCoachOutput(value: unknown): CoachOutput {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return SAFE_FALLBACK
	const record = value as Record<string, unknown>
	const message = boundedText(record.message, 620)
	const concept = boundedText(record.concept, 80)
	const certainty = certaintySchema.safeParse(record.certainty)
	const factsUsed = boundedList(record.factsUsed, 3, 140)
	const suggestedChecks = boundedList(record.suggestedChecks, 3, 120)
	const combined = [message, concept, ...factsUsed, ...suggestedChecks].join(' ')

	if (
		!message ||
		!concept ||
		!certainty.success ||
		UNSUPPORTED_HIDDEN_CLAIMS.some((pattern) => pattern.test(combined))
	) {
		return SAFE_FALLBACK
	}
	return { message, concept, certainty: certainty.data, factsUsed, suggestedChecks }
}

export function parseCoachModelOutput(outputText: string): CoachOutput {
	if (!outputText || outputText.length > 10_000) return SAFE_FALLBACK
	try {
		return sanitizeCoachOutput(JSON.parse(outputText))
	} catch {
		return SAFE_FALLBACK
	}
}

export function isCoachOwner(
	user: { email?: string; roles?: string[]; appMetadata?: Record<string, unknown> } | null,
	ownerEmailSetting = '',
) {
	if (!user) return false
	const appMetadataRoles = Array.isArray(user.appMetadata?.roles)
		? user.appMetadata.roles.filter((role): role is string => typeof role === 'string')
		: []
	const roles = new Set([...(user.roles || []), ...appMetadataRoles])
	if (!roles.has(COACH_OWNER_ROLE)) return false

	const allowedEmails = ownerEmailSetting
		.split(/[\s,;]+/)
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean)
	if (!allowedEmails.length) return false
	return typeof user.email === 'string' && allowedEmails.includes(user.email.trim().toLowerCase())
}

export function validationIssues(error: z.ZodError) {
	return error.issues.slice(0, 6).map((issue) => ({
		path: issue.path.join('.'),
		message: issue.message,
	}))
}

export function buildCoachInstructions() {
	return `You are Ralph's bridge teaching coach for the selected learner seat. The selected seat is supplied in profile.learnerSeat and must exactly match perspective.seat.

Teaching system: traditional ACOL with a 12-14 balanced 1NT opening. That range applies only when 1NT is the opening bid, not an overcall or rebid. Stayman is 2C asking for a four-card major. Do not silently substitute another bidding system.

Use only the supplied learner-perspective JSON. It has already removed hidden hands and future auction calls. Never guess or claim the exact location, length, void, honour, or remaining holding of an unseen hand. Never use double-dummy knowledge. Treat a card location as known only when it appears in perspective.knownHands or public playedCards. Distinguish a fact, a certain deduction, a likelihood, and something unknown. Auction inferences remain likelihoods unless the ACOL agreement logically promises them.

Do not give the game away. For nudge, ask a short thinking question and do not name the final bid or card. For explain, teach the relevant idea using the current public facts. For compare, compare only choices actually visible in the learner's hand/legalCards or legal ACOL calls; do not guarantee an outcome. For remember, give a brief memory/counting checklist. If the teacher asks for hidden information, explain that it is unknown and suggest a safe count instead.

At bidding consider HCP, shape, partnership range, forcing status, fit and rebid plan. At opening lead use only the learner's hand, contract and visible auction; dummy is not yet visible. During play consider follow-suit legality, winners or losers, entries, the current trick, partner's publicly observed lead, trumps and cards already played. Statistical statements must be framed as prior odds, not certainty.

Write for a learner: calm, specific, plain English, and no more than about 90 words. Return only the required structured fields. factsUsed must cite at most three supplied facts. suggestedChecks must contain at most three short questions or counting actions.`
}

export function buildCoachInput(request: CoachRequest) {
	return JSON.stringify({
		intent: request.intent,
		teacherQuestion: request.question || null,
		learnerPerspective: request.context,
	})
}

function cardKey(card: { rank: string; suit: string }) {
	return `${card.rank}:${card.suit}`
}
