import { createInitialManualState, playCardManual } from '../lib/manualPlayEngine.js'
import {
	SEATS,
	computeDuplicateScore,
	deriveAuction,
	isSeatVul,
	legalNextAuctionCall,
	parseTrump,
	rightOf,
	stableDealToHands,
	validateAuction,
} from './bridgeV2.js'

export const initialPlayerV2State = {
	deals: [],
	index: 0,
	selectedName: '',
	board: null,
	hands: null,
	auction: null,
	phase: 'empty',
	visibleSeat: 'S',
	visibleSeats: [],
	auctionCursor: 0,
	manualContract: { declarer: '', level: '', strain: '', dbl: '' },
	contractNotice: '',
	play: null,
	history: [],
	completedTricks: [],
	boardSessions: {},
	autoPlayPaused: false,
	visibilityMode: 'mimic',
	status: '',
}

function partnerSeat(seat) {
	return seat === 'N' ? 'S' : seat === 'S' ? 'N' : seat === 'E' ? 'W' : 'E'
}

function normalizeVisibleSeats(value, fallbackSeat = 'N') {
	const seats = Array.isArray(value) ? value : value ? [value] : [fallbackSeat]
	return [...new Set(seats.filter((seat) => SEATS.includes(seat)))]
}

function toggleVisibleSeat(state, seat) {
	const visible = new Set(state.visibleSeats || [])
	if (visible.has(seat)) visible.delete(seat)
	else visible.add(seat)
	const visibleSeats = [...visible]
	return {
		...state,
		visibleSeat: visible.has(seat) ? seat : visibleSeats[0] || state.visibleSeat,
		visibleSeats,
	}
}

function normalizeBoard(raw) {
	return {
		board: raw.board || '',
		dealer: raw.dealer || 'N',
		vul: raw.vul || 'None',
		deal: raw.deal,
		auction: Array.isArray(raw.auction) ? raw.auction : [],
		auctionDealer: raw.auctionDealer || raw.dealer || 'N',
		play: raw.play || [],
		playLeader: raw.playLeader || raw.dealer || 'N',
		contract: raw.contract || '',
		declarer: raw.declarer || '',
		ext: raw.ext || {},
	}
}

function hydrateBoard(deals, index) {
	const board = deals[index] || null
	if (!board) {
		return {
			board: null,
			hands: null,
			auction: null,
			phase: deals.length ? 'auction' : 'empty',
			visibleSeat: 'S',
			visibleSeats: ['S'],
			auctionCursor: 0,
			play: null,
			history: [],
			completedTricks: [],
			autoPlayPaused: false,
			status: '',
		}
	}

	const hands = stableDealToHands(board.deal)
	const auction = deriveAuction(board)
	const visibleSeat = board.dealer || 'N'
	return {
		board,
		hands,
		auction,
		phase: 'auction',
		visibleSeat,
		visibleSeats: normalizeVisibleSeats(visibleSeat, board.dealer || 'N'),
		auctionCursor: auction.calls.length,
		contractNotice: '',
		play: null,
		history: [],
		completedTricks: [],
		autoPlayPaused: false,
		status: '',
	}
}

function snapshotBoardSession(state) {
	return {
		auction: state.auction,
		phase: state.phase,
		visibleSeat: state.visibleSeat,
		visibleSeats: [...(state.visibleSeats || [])],
		auctionCursor: state.auctionCursor,
		manualContract: { ...state.manualContract },
		contractNotice: state.contractNotice,
		play: state.play,
		history: [...state.history],
		completedTricks: [...state.completedTricks],
		autoPlayPaused: state.autoPlayPaused,
		status: state.status,
	}
}

function effectiveContract(state) {
	const manual = state.manualContract
	if (manual.level && manual.strain) {
		return {
			contract: `${manual.level}${manual.strain}${manual.dbl}`,
			declarer: manual.declarer || state.auction?.declarer || state.board?.declarer || '',
		}
	}
	return {
		contract: state.auction?.contract || state.board?.contract || '',
		declarer: manual.declarer || state.auction?.declarer || state.board?.declarer || '',
	}
}

function buildCompletedTricks(history, hands, leader, trump, declarer) {
	let play = createInitialManualState(hands, leader, trump, declarer)
	const completed = []
	for (const event of history) {
		const before = play.trick
		const result = playCardManual(play, event.seat, event.cardId)
		if (!result.ok) break
		if (result.winner) {
			completed.push({
				no: completed.length + 1,
				winner: result.winner,
				cards: [...before, { seat: event.seat, card: event.card }],
			})
		}
		play = result.state
	}
	return { play, completed }
}

export function getPlayerV2Derived(state) {
	const { contract, declarer } = effectiveContract(state)
	const trump = parseTrump(contract)
	const openingLeader = declarer ? rightOf(declarer) : state.board?.dealer || 'N'
	const score =
		contract && declarer && state.play
			? computeDuplicateScore(
					contract,
					declarer,
					isSeatVul(declarer, state.board?.vul),
					state.play.tricksDecl,
				)
			: null

	return {
		contract,
		declarer,
		trump,
		openingLeader,
		score,
		dummy: declarer ? (declarer === 'N' ? 'S' : declarer === 'S' ? 'N' : declarer === 'E' ? 'W' : 'E') : '',
		auctionCalls: state.auction?.calls || [],
	}
}

function withAuctionValidation(state, calls, notice = '') {
	const dealer = state.auction?.dealer || state.board?.auctionDealer || state.board?.dealer || 'N'
	const validation = calls.length ? validateAuction(dealer, calls) : { legal: false }
	const prior = getPlayerV2Derived(state)
	const nextAuction = {
		...(state.auction || {}),
		calls,
		dealer,
		legal: validation.legal,
		contract: validation.legal ? validation.contract : '',
		declarer: validation.legal ? validation.declarer : '',
	}
	const nextState = {
		...state,
		auction: nextAuction,
		auctionCursor: calls.length,
		manualContract: { declarer: '', level: '', strain: '', dbl: '' },
		phase: state.phase === 'confirmed' ? 'auction' : state.phase,
		status: notice,
	}
	const next = getPlayerV2Derived(nextState)
	const changed =
		next.contract &&
		next.declarer &&
		(next.contract !== prior.contract || next.declarer !== prior.declarer)
	return {
		...nextState,
		contractNotice: changed
			? `Auction change updated the contract to ${next.contract} by ${next.declarer}; play will use that contract, trump suit, declarer, and opening leader.`
			: state.contractNotice,
	}
}

export function playerV2Reducer(state, action) {
	switch (action.type) {
		case 'LOAD_DEALS': {
			const deals = action.deals.map(normalizeBoard).filter((board) => board.deal)
			return {
				...state,
				deals,
				index: 0,
				selectedName: action.name || '',
				boardSessions: {},
				manualContract: { declarer: '', level: '', strain: '', dbl: '' },
				contractNotice: '',
				...hydrateBoard(deals, 0),
			}
		}
		case 'RESET':
			return initialPlayerV2State
		case 'SET_STATUS':
			return { ...state, status: action.status || '' }
		case 'GO_BOARD': {
			const index = Math.max(0, Math.min(state.deals.length - 1, action.index))
			if (index === state.index) return state
			const boardSessions = {
				...state.boardSessions,
				[state.index]: snapshotBoardSession(state),
			}
			const savedSession = boardSessions[index]
			return {
				...state,
				index,
				boardSessions,
				manualContract: { declarer: '', level: '', strain: '', dbl: '' },
				...hydrateBoard(state.deals, index),
				...(savedSession || {}),
			}
		}
		case 'SET_VISIBLE_SEAT':
			return { ...state, visibleSeat: action.seat, visibleSeats: [action.seat] }
		case 'TOGGLE_VISIBLE_SEAT':
		case 'TOGGLE_REVEAL_SEAT':
			return toggleVisibleSeat(state, action.seat)
		case 'SET_VISIBLE_SEATS':
			return {
				...state,
				visibleSeat: action.seats?.[0] || state.visibleSeat,
				visibleSeats: normalizeVisibleSeats(action.seats || [], ''),
			}
		case 'REVEAL_PARTNER':
			return toggleVisibleSeat(state, partnerSeat(state.visibleSeat))
		case 'REVEAL_ALL':
			return {
				...state,
				visibleSeat: state.visibleSeat || state.board?.dealer || 'N',
				visibleSeats: [...SEATS],
			}
		case 'CLEAR_REVEALS':
			return { ...state, visibleSeats: [] }
		case 'DISMISS_CONTRACT_NOTICE':
			return { ...state, contractNotice: '' }
		case 'SET_VISIBILITY_MODE':
			return { ...state, visibilityMode: action.mode }
		case 'SET_AUTO_PLAY_PAUSED':
			return {
				...state,
				autoPlayPaused: !!action.paused,
				status: action.paused
					? 'Automatic play paused.'
					: 'Automatic play resumed.',
			}
		case 'SET_MANUAL_CONTRACT':
			return {
				...state,
				manualContract: { ...state.manualContract, [action.field]: action.value },
				phase: state.phase === 'confirmed' ? 'auction' : state.phase,
				status:
					state.phase === 'confirmed'
						? 'Contract changed. Confirm it again before starting play.'
						: state.status,
			}
		case 'AUCTION_NEXT':
			return {
				...state,
				auctionCursor: Math.min((state.auction?.calls || []).length, state.auctionCursor + 1),
			}
		case 'AUCTION_PREV':
			return { ...state, auctionCursor: Math.max(0, state.auctionCursor - 1) }
		case 'AUCTION_REPLAY':
			return { ...state, auctionCursor: 0, phase: 'auction' }
		case 'AUCTION_ALL':
			return { ...state, auctionCursor: (state.auction?.calls || []).length }
		case 'AUCTION_APPEND_CALL': {
			const base = (state.auction?.calls || []).slice(0, state.auctionCursor)
			const dealer = state.auction?.dealer || state.board?.dealer || 'N'
			if (base.length === (state.auction?.calls || []).length && validateAuction(dealer, base).legal) {
				return {
					...state,
					status: 'Rewind to the call you want to change, then choose a different next call.',
				}
			}
			const legal = legalNextAuctionCall(dealer, base, action.call)
			if (!legal.legal) return { ...state, status: legal.reason || 'Illegal call.' }
			return withAuctionValidation(
				state,
				[...base, legal.call],
				`Added ${legal.call}; later calls were replaced from this point.`,
			)
		}
		case 'AUCTION_RESTORE_PBN':
			return withAuctionValidation(
				state,
				state.board?.auction || [],
				'Restored the original PBN auction.',
			)
		case 'CONFIRM_AUCTION': {
			const derived = getPlayerV2Derived(state)
			if (!derived.contract || !derived.declarer) {
				return { ...state, status: 'Set a contract and declarer before play.' }
			}
			return {
				...state,
				phase: 'confirmed',
				visibleSeat: derived.declarer,
				visibleSeats: normalizeVisibleSeats(state.visibleSeats, derived.declarer),
				status: `Contract confirmed: ${derived.contract} by ${derived.declarer}. Opening lead ${derived.openingLeader}.`,
			}
		}
		case 'START_PLAY': {
			const derived = getPlayerV2Derived(state)
			if (!state.hands || !derived.contract || !derived.declarer) {
				return { ...state, status: 'Play needs a known contract and declarer.' }
			}
			const isRestartingCurrentPlay = state.phase === 'play' && !!state.play
			if (state.phase !== 'confirmed' && !isRestartingCurrentPlay) {
				return { ...state, status: 'Confirm the auction before starting play.' }
			}
			return {
				...state,
				phase: 'play',
				visibleSeat: derived.declarer,
				visibleSeats: [derived.declarer],
				play: createInitialManualState(
					state.hands,
					derived.openingLeader,
					derived.trump,
					derived.declarer,
				),
				history: [],
				completedTricks: [],
				autoPlayPaused: true,
				status: `Opening lead: ${derived.openingLeader}. Automatic play paused.`,
			}
		}
		case 'PLAY_CARD': {
			if (!state.play || state.phase !== 'play') return state
			const result = playCardManual(state.play, action.seat, action.cardId)
			if (!result.ok) return { ...state, status: result.error || 'Illegal play.' }
			const card = state.play.remaining[action.seat]?.find((item) => item.id === action.cardId)
			const history = [...state.history, { seat: action.seat, cardId: action.cardId, card }]
			const derived = getPlayerV2Derived(state)
			const visibleSeats =
				history.length === 1 && derived.dummy
					? [...new Set([...state.visibleSeats, derived.dummy])]
					: state.visibleSeats
			const { completed } = buildCompletedTricks(
				history,
				state.hands,
				derived.openingLeader,
				derived.trump,
				derived.declarer,
			)
			const status = result.winner
				? completed.length >= 13
					? 'Play complete. Automatic play paused for review.'
					: `Trick ${completed.length} to ${result.winner}.`
				: `${result.state.turnSeat} to play.`
			return {
				...state,
				play: result.state,
				history,
				completedTricks: completed,
				visibleSeats,
				autoPlayPaused: completed.length >= 13 ? true : state.autoPlayPaused,
				status,
			}
		}
		case 'UNDO_CARD': {
			if (!state.history.length) return state
			const derived = getPlayerV2Derived(state)
			const history = state.history.slice(0, -1)
			const rebuilt = buildCompletedTricks(
				history,
				state.hands,
				derived.openingLeader,
				derived.trump,
				derived.declarer,
			)
			return {
				...state,
				history,
				play: rebuilt.play,
				completedTricks: rebuilt.completed,
				status: 'Undid one card.',
			}
		}
		case 'UNDO_TRICK': {
			if (!state.history.length) return state
			const trim = state.history.length % 4 || 4
			const derived = getPlayerV2Derived(state)
			const history = state.history.slice(0, -trim)
			const rebuilt = buildCompletedTricks(
				history,
				state.hands,
				derived.openingLeader,
				derived.trump,
				derived.declarer,
			)
			return {
				...state,
				history,
				play: rebuilt.play,
				completedTricks: rebuilt.completed,
				status: 'Undid one trick.',
			}
		}
		default:
			return state
	}
}
