// Simple, pure manual play engine for bridge card play
// Focus: deterministic trick building, follow-suit enforcement, winner determination
// All functions are pure (no side effects) so UI can drive them safely.

import { rightOf, isDeclarerSide, evaluateTrick } from './bridgeCore'

// Create initial manual play state from dealt hands.
// hands: {N: Card[], E: Card[], S: Card[], W: Card[]}
// leader: seat that leads first trick
// trumpSuit: e.g. 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs' | null
// declarer: seat or null
export function createInitialManualState(hands, leader, trumpSuit, declarer) {
	if (!hands) return null
	return {
		remaining: {
			N: [...(hands.N || [])],
			E: [...(hands.E || [])],
			S: [...(hands.S || [])],
			W: [...(hands.W || [])],
		},
		trick: [], // current partial trick (0..3 cards) or being filled (0 after completion)
		turnSeat: leader || 'N',
		tricksDecl: 0,
		tricksDef: 0,
		trump: trumpSuit || null,
		declarer: declarer || null,
		completed: 0, // number of completed tricks
		trickComplete: false, // whether current visible trick (length 4) is awaiting next lead
	}
}

// Attempt to play a card. Returns { ok, state, error, winner? }
export function playCardManual(state, seat, cardId) {
	if (!state) return { ok: false, error: 'No state' }
	const {
		remaining,
		trick,
		turnSeat,
		trump,
		declarer,
		tricksDecl,
		tricksDef,
		trickComplete,
	} = state
	if (!remaining || !turnSeat) return { ok: false, error: 'Play not ready' }
	if (seat !== turnSeat) return { ok: false, error: 'Not your turn' }
	// If previous trick complete & still showing, clear it before starting next (winner must lead)
	let workingTrick = trick
	if (trickComplete && trick.length === 4) {
		if (seat !== turnSeat) return { ok: false, error: 'Winner must lead next' }
		workingTrick = []
	} else if (trick.length === 4) {
		// Defensive guard (shouldn't happen without trickComplete)
		return { ok: false, error: 'Trick already complete' }
	}

	const hand = remaining[seat] || []
	const idx = hand.findIndex((c) => c.id === cardId)
	if (idx < 0) return { ok: false, error: 'Card not in hand' }
	const card = hand[idx]

	// Follow suit enforcement
	if (workingTrick.length > 0) {
		const leadSuit = workingTrick[0].card.suit
		if (card.suit !== leadSuit) {
			const canFollow = hand.some((c) => c.suit === leadSuit)
			if (canFollow) return { ok: false, error: 'Must follow suit' }
		}
	}

	// Build next trick array
	const nextTrick = [...workingTrick, { seat, card }]
	// Remove card from hand
	const nextRemaining = {
		...remaining,
		[seat]: [...hand.slice(0, idx), ...hand.slice(idx + 1)],
	}

	// If trick now complete evaluate winner and reset trick for next
	if (nextTrick.length === 4) {
		const winner = evaluateTrick(nextTrick, trump)
		let d = tricksDecl
		let f = tricksDef
		if (winner) {
			if (isDeclarerSide(winner, declarer)) d++
			else f++
		}
		return {
			ok: true,
			winner,
			state: {
				...state,
				remaining: nextRemaining,
				trick: nextTrick, // keep visible until next lead starts
				turnSeat: winner || nextTrick[0].seat,
				tricksDecl: d,
				tricksDef: f,
				completed: state.completed + 1,
				trickComplete: true,
			},
		}
	}

	// Otherwise normal advance to next seat
	return {
		ok: true,
		state: {
			...state,
			remaining: nextRemaining,
			trick: nextTrick,
			turnSeat: rightOf(seat),
			trickComplete: false,
		},
	}
}

