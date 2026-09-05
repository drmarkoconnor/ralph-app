const COACH_OFFER_KEY = 'ralph-coach-offer-seen-v1'

export function coachDecisionForState(state, derived, controlledSeats = new Set()) {
	if (!state?.board) return null
	if (
		state.phase === 'auction' &&
		derived?.auctionView === 'practice' &&
		!state.auctionIntroPending &&
		!state.manualContractMode &&
		state.practiceAuction?.status === 'in-progress' &&
		derived.nextAuctionSeat === 'S'
	) {
		return { learnerSeat: 'S', decisionSeat: 'S', focusName: 'South', phase: 'auction' }
	}
	if (
		state.phase !== 'play' ||
		state.play?.trickComplete ||
		!state.play?.turnSeat ||
		!controlledSeats.has(state.play.turnSeat)
	) {
		return null
	}

	const learnerSeat = derived?.declarer === 'N' ? 'N' : 'S'
	const decisionSeat = state.play.turnSeat
	const learnerName = learnerSeat === 'N' ? 'North' : 'South'
	return {
		learnerSeat,
		decisionSeat,
		focusName: decisionSeat === learnerSeat ? learnerName : `${learnerName} · play from dummy`,
		phase: state.history?.length ? 'play' : 'opening-lead',
	}
}

export function compactCoachReply(reply, intent = 'nudge') {
	if (!reply) return 'Pause and review the public auction and cards already played.'
	if (typeof reply === 'string') return reply.trim()
	const message = String(reply.message || '').trim()
	const concept = String(reply.concept || '').trim()
	if (intent === 'explain' && concept) {
		return `${message}${message ? '\n\n' : ''}Principle: ${concept}`
	}
	return message || concept || 'Pause and review the public auction and cards already played.'
}

export function coachOfferWasSeen(storage) {
	try {
		return (storage || globalThis.localStorage)?.getItem(COACH_OFFER_KEY) === 'seen'
	} catch {
		return false
	}
}

export function rememberCoachOffer(storage) {
	try {
		const target = storage || globalThis.localStorage
		target?.setItem(COACH_OFFER_KEY, 'seen')
	} catch {
		// The access pill still works when browser storage is unavailable.
	}
}

export const PLAYER_COACH_STORAGE_KEYS = Object.freeze({ offerSeen: COACH_OFFER_KEY })
