import { auctionProgress, parseTrump, partnerOf } from '../bridgeV2.js'
import {
	buildOutstandingCardFacts,
	buildLearnerLegalFollowFacts,
	buildTrumpFacts,
	inferPublicVoids,
	normalizeCoachCards,
	normalizePlayedCards,
	summarizeKnownHand,
} from './coachFacts.js'
import { SOUTH_LEARNER_SEAT, createCoachProfile } from './coachProfile.js'

const SEATS = ['N', 'E', 'S', 'W']
const ALLOWED_TRIGGERS = new Set([
	'manual',
	'auction-step',
	'opening-lead',
	'learner-turn',
	'explain-last-action',
])

function normalizeSeat(value, fallback = 'N') {
	const seat = String(value || '').toUpperCase()
	return SEATS.includes(seat) ? seat : fallback
}

function seatAtOffset(dealer, offset) {
	return SEATS[(SEATS.indexOf(normalizeSeat(dealer)) + offset) % SEATS.length]
}

function normalizeCall(value) {
	const call = String(value || '').trim().toUpperCase()
	if (/^P(ASS)?$/.test(call)) return 'P'
	if (call === 'X' || call === 'XX') return call
	return /^([1-7])(C|D|H|S|NT)$/.test(call) ? call : ''
}

function coachAuctionState(state) {
	return state.practiceAuction || state.auction || null
}

function coachAuctionCursor(state, auction) {
	if (state.practiceAuction) return Array.isArray(auction?.calls) ? auction.calls.length : 0
	return Number(state.auctionCursor) || 0
}

function safeAuction(state, learnerSeat) {
	const activeAuction = coachAuctionState(state)
	const dealer = normalizeSeat(
		activeAuction?.dealer || state.board?.auctionDealer || state.board?.dealer,
	)
	const sourceCalls = Array.isArray(activeAuction?.calls) ? activeAuction.calls : []
	const cursor = Math.max(0, Math.min(sourceCalls.length, coachAuctionCursor(state, activeAuction)))
	const visibleRawCalls = sourceCalls.slice(0, cursor)
	const calls = visibleRawCalls.flatMap((call, index) => {
		const normalized = normalizeCall(call)
		return normalized ? [{ seat: seatAtOffset(dealer, index), call: normalized }] : []
	})
	const normalizedVisibleCalls = visibleRawCalls.map(normalizeCall)
	const containsInvalidCall = normalizedVisibleCalls.some((call) => !call)
	const progress = containsInvalidCall
		? { status: 'invalid', terminal: false, nextSeat: null, contract: '', declarer: '' }
		: auctionProgress(dealer, normalizedVisibleCalls)
	const complete = progress.status === 'complete'
	return {
		dealer,
		cursor,
		calls,
		nextSeat: progress.terminal ? null : progress.nextSeat,
		learnerToCall: !progress.terminal && progress.nextSeat === learnerSeat,
		isComplete: !!progress.terminal,
		visibleContract: complete
			? { contract: progress.contract, declarer: progress.declarer }
			: null,
	}
}

function effectiveKnownContract(state, safeAuctionState) {
	if (safeAuctionState.visibleContract) return safeAuctionState.visibleContract
	const activeAuction = coachAuctionState(state)
	const noFutureAuction = !Array.isArray(activeAuction?.calls) || activeAuction.calls.length === 0
	if (state.phase !== 'play' && !noFutureAuction) return null
	const manual = state.manualContract || {}
	const contract =
		manual.level && manual.strain
			? `${manual.level}${manual.strain}${manual.dbl || ''}`
			: activeAuction?.contract || (!state.practiceAuction ? state.board?.contract : '') || ''
	const declarer = normalizeSeat(
		manual.declarer || activeAuction?.declarer || (!state.practiceAuction ? state.board?.declarer : ''),
		'',
	)
	return contract && declarer ? { contract, declarer } : null
}

function contractDetails(knownContract) {
	if (!knownContract) return null
	const match = String(knownContract.contract || '')
		.toUpperCase()
		.match(/^([1-7])(C|D|H|S|NT)(XX|X)?$/)
	if (!match || !SEATS.includes(knownContract.declarer)) return null
	const declarer = knownContract.declarer
	return {
		level: Number(match[1]),
		strain: match[2],
		doubled: match[3] || '',
		declarer,
		dummy: partnerOf(declarer),
		trump: parseTrump(knownContract.contract),
	}
}

function learnerRole(contract, learnerSeat) {
	if (!contract) return 'bidder'
	if (contract.declarer === learnerSeat) return 'declarer'
	if (contract.dummy === learnerSeat) return 'dummy'
	return 'defender'
}

function knownHands(state, contract, dummyExposed, learnerSeat) {
	const seats = [learnerSeat]
	if (dummyExposed && contract?.dummy && contract.dummy !== learnerSeat) {
		seats.push(contract.dummy)
	}
	return seats.map((seat) => {
		const initial = normalizeCoachCards(state.hands?.[seat])
		const remaining =
			state.phase === 'play'
				? normalizeCoachCards(state.play?.remaining?.[seat])
				: initial
		return { seat, initial, remaining }
	})
}

function normalizeBoardNumber(state) {
	const raw = Number(state.board?.board)
	if (Number.isInteger(raw) && raw >= 0 && raw <= 9999) return String(raw)
	return String(Math.max(1, Math.min(9999, (Number(state.index) || 0) + 1)))
}

function normalizeVulnerability(value) {
	const vulnerability = String(value || '').trim().toUpperCase()
	if (vulnerability === 'NS') return 'NS'
	if (vulnerability === 'EW') return 'EW'
	if (vulnerability === 'ALL' || vulnerability === 'BOTH') return 'All'
	return 'None'
}

function playPhase(state) {
	if (state.phase === 'play') return state.history?.length ? 'play' : 'opening-lead'
	if (state.phase === 'confirmed') return 'opening-lead'
	return 'auction'
}

function acolResponseFacts(auction, learnerHandFacts, learnerSeat) {
	const partner = partnerOf(learnerSeat)
	const partnerOneNoTrumpIndex = auction.calls.findIndex(
		(entry, index) =>
			entry.seat === partner &&
			entry.call === '1NT' &&
			auction.calls.slice(0, index).every((previous) => previous.call === 'P'),
	)
	const learnerHasCalled = auction.calls.some(
		(entry, index) => index > partnerOneNoTrumpIndex && entry.seat === learnerSeat,
	)
	const opponentInterfered = auction.calls.some(
		(entry, index) =>
			index > partnerOneNoTrumpIndex &&
			entry.seat !== partner &&
			entry.seat !== learnerSeat &&
			entry.call !== 'P',
	)
	const directResponseToPartnerOneNoTrump =
		partnerOneNoTrumpIndex >= 0 &&
		auction.learnerToCall &&
		!learnerHasCalled &&
		!opponentInterfered
	return {
		oneNoTrumpOpeningRangeHcp: [12, 14],
		directResponseToPartnerOneNoTrump,
		hasFourCardMajor: learnerHandFacts.fourCardMajors.length > 0,
		fourCardMajors: learnerHandFacts.fourCardMajors,
	}
}

function safeTrickWinners(completedTricks) {
	return (Array.isArray(completedTricks) ? completedTricks : []).flatMap((trick, index) =>
		SEATS.includes(trick?.winner)
			? [{ trickNumber: Number(trick.no) || index + 1, winner: trick.winner }]
			: [],
	)
}

export function buildLearnerCoachContext(
	state,
	{ trigger = 'manual', learnerSeat = SOUTH_LEARNER_SEAT, controlledSeats } = {},
) {
	const safeLearnerSeat = learnerSeat === 'N' ? 'N' : SOUTH_LEARNER_SEAT
	const safeControlledSeats = Array.isArray(controlledSeats)
		? controlledSeats.filter((seat) => SEATS.includes(seat))
		: [safeLearnerSeat]
	if (!state?.board || !Array.isArray(state.hands?.[safeLearnerSeat])) return null
	const auction = safeAuction(state, safeLearnerSeat)
	const contract = contractDetails(effectiveKnownContract(state, auction))
	const playedCards = normalizePlayedCards(state.history)
	const dummyExposed = state.phase === 'play' && playedCards.length > 0
	const safeKnownHands = knownHands(state, contract, dummyExposed, safeLearnerSeat)
	const learnerHandFacts = summarizeKnownHand(state.hands[safeLearnerSeat])
	const phase = playPhase(state)
	const safeTrigger = ALLOWED_TRIGGERS.has(trigger) ? trigger : 'manual'
	const playFacts =
		phase === 'play' && contract
			? {
					dummyExposed,
					turnSeat: normalizeSeat(state.play?.turnSeat, ''),
					playedCards,
					trickWinners: safeTrickWinners(state.completedTricks),
					voidsShownByPlay: inferPublicVoids(playedCards),
					outstandingCards: buildOutstandingCardFacts(playedCards, safeKnownHands),
					trumps: buildTrumpFacts(contract.trump, playedCards, safeKnownHands),
					legalFollow: buildLearnerLegalFollowFacts(
						state.play,
						safeLearnerSeat,
						safeControlledSeats,
					),
				}
			: null

	return {
		schemaVersion: 1,
		eventKey:
			state.phase === 'play'
				? `${normalizeBoardNumber(state)}:play:${playedCards.length}:${state.play?.turnSeat || '-'}`
				: `${normalizeBoardNumber(state)}:auction:${auction.cursor}`,
		trigger: safeTrigger,
		phase,
		profile: createCoachProfile(safeLearnerSeat),
		board: {
			number: normalizeBoardNumber(state),
			dealer: normalizeSeat(state.board.dealer),
			vulnerability: normalizeVulnerability(state.board.vul),
		},
		perspective: {
			seat: safeLearnerSeat,
			role: learnerRole(contract, safeLearnerSeat),
			knownHands: safeKnownHands,
		},
		auction: {
			dealer: auction.dealer,
			cursor: auction.cursor,
			calls: auction.calls,
			nextSeat: auction.nextSeat,
			learnerToCall: auction.learnerToCall,
			isComplete: auction.isComplete,
		},
		...(contract ? { contract } : {}),
		facts: {
			learnerHand: learnerHandFacts,
			acol: acolResponseFacts(auction, learnerHandFacts, safeLearnerSeat),
			...(playFacts ? { play: playFacts } : {}),
		},
	}
}

export function buildSouthCoachContext(state, options = {}) {
	return buildLearnerCoachContext(state, { ...options, learnerSeat: SOUTH_LEARNER_SEAT })
}
