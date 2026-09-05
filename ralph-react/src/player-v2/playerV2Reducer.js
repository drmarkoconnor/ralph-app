import { createInitialManualState, playCardManual } from '../lib/manualPlayEngine.js'
import {
	SEATS,
	auctionProgress,
	computeDuplicateScore,
	deriveAuction,
	isSeatVul,
	legalNextAuctionCall,
	parseTrump,
	rightOf,
	stableDealToHands,
} from './bridgeV2.js'

export const initialPlayerV2State = {
	deals: [],
	index: 0,
	selectedName: '',
	content: null,
	board: null,
	hands: null,
	practiceAuction: null,
	recordedAuction: null,
	auctionView: 'practice',
	auctionCursors: { practice: 0, recorded: 0 },
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
	auctionIntroPending: false,
	manualContractMode: false,
	autoPlayPaused: false,
	visibilityMode: 'mimic',
	status: '',
}

const EMPTY_MANUAL_CONTRACT = Object.freeze({ declarer: '', level: '', strain: '', dbl: '' })

function emptyManualContract() {
	return { ...EMPTY_MANUAL_CONTRACT }
}

function practiceAuctionFor(state) {
	return state.practiceAuction || state.auction || null
}

function makePracticeAuction(dealer = 'N', revision = 0) {
	return {
		dealer: SEATS.includes(dealer) ? dealer : 'N',
		calls: [],
		callSources: [],
		status: 'in-progress',
		terminal: false,
		valid: true,
		legal: false,
		contract: '',
		declarer: '',
		revision,
	}
}

function makeRecordedAuction(board) {
	const derived = deriveAuction(board)
	return Object.freeze({
		...derived,
		calls: Object.freeze([...(derived.calls || [])]),
	})
}

function normalizedCursors(state) {
	return {
		practice: Math.max(
			0,
			Number(state.auctionCursors?.practice ?? practiceAuctionFor(state)?.calls?.length) || 0,
		),
		recorded: Math.max(0, Number(state.auctionCursors?.recorded) || 0),
	}
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
			practiceAuction: null,
			recordedAuction: null,
			auctionView: 'practice',
			auctionCursors: { practice: 0, recorded: 0 },
			auction: null,
			phase: deals.length ? 'auction' : 'empty',
			visibleSeat: 'S',
			visibleSeats: ['S'],
			auctionCursor: 0,
			play: null,
			history: [],
			completedTricks: [],
			auctionIntroPending: false,
			manualContractMode: false,
			autoPlayPaused: false,
			status: '',
		}
	}

	const hands = stableDealToHands(board.deal)
	const recordedAuction = makeRecordedAuction(board)
	const practiceAuction = makePracticeAuction(recordedAuction.dealer)
	return {
		board,
		hands,
		practiceAuction,
		recordedAuction,
		auctionView: 'practice',
		auctionCursors: { practice: 0, recorded: 0 },
		// Compatibility alias for existing coach/export consumers. This is always the
		// live practice auction, never whichever comparison track is being viewed.
		auction: practiceAuction,
		phase: 'auction',
		visibleSeat: 'S',
		visibleSeats: ['S'],
		auctionCursor: 0,
		contractNotice: '',
		play: null,
		history: [],
		completedTricks: [],
		auctionIntroPending: recordedAuction.calls.length === 0,
		manualContractMode: false,
		autoPlayPaused: false,
		status: '',
	}
}

function snapshotBoardSession(state) {
	return {
		practiceAuction: practiceAuctionFor(state),
		recordedAuction: state.recordedAuction,
		auctionView: state.auctionView || 'practice',
		auctionCursors: normalizedCursors(state),
		auction: practiceAuctionFor(state),
		phase: state.phase,
		visibleSeat: state.visibleSeat,
		visibleSeats: [...(state.visibleSeats || [])],
		auctionCursor: state.auctionCursor,
		manualContract: { ...state.manualContract },
		contractNotice: state.contractNotice,
		play: state.play,
		history: [...state.history],
		completedTricks: [...state.completedTricks],
		auctionIntroPending: !!state.auctionIntroPending,
		manualContractMode: !!state.manualContractMode,
		autoPlayPaused: state.autoPlayPaused,
		status: state.status,
	}
}

function effectiveContract(state) {
	const manual = state.manualContract
	const practiceAuction = practiceAuctionFor(state)
	if (manual.level && manual.strain) {
		return {
			contract: `${manual.level}${manual.strain}${manual.dbl}`,
			declarer: manual.declarer || practiceAuction?.declarer || '',
		}
	}
	return {
		contract: practiceAuction?.contract || '',
		declarer: manual.declarer || practiceAuction?.declarer || '',
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
	const practiceAuction = practiceAuctionFor(state)
	const recordedAuction = state.recordedAuction || null
	const auctionView = state.auctionView === 'recorded' ? 'recorded' : 'practice'
	const cursors = normalizedCursors(state)
	const displayedAuction =
		auctionView === 'recorded' ? recordedAuction : practiceAuction
	const { contract, declarer } = effectiveContract(state)
	const trump = parseTrump(contract)
	const openingLeader = declarer ? rightOf(declarer) : ''
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
		auctionCalls: practiceAuction?.calls || [],
		practiceAuction,
		recordedAuction,
		auctionView,
		displayedAuction,
		displayedAuctionCalls: displayedAuction?.calls || [],
		displayedAuctionCursor: cursors[auctionView],
		nextAuctionSeat:
			practiceAuction?.status === 'in-progress'
				? auctionProgress(practiceAuction.dealer, practiceAuction.calls).nextSeat
				: null,
	}
}

function withPracticeCalls(state, calls, notice = '', source = 'manual') {
	const currentAuction = practiceAuctionFor(state) || makePracticeAuction(
		state.board?.auctionDealer || state.board?.dealer || 'N',
	)
	const dealer = currentAuction.dealer || state.board?.auctionDealer || state.board?.dealer || 'N'
	const progress = auctionProgress(dealer, calls)
	if (progress.status === 'invalid') {
		return { ...state, status: progress.reason || 'Illegal auction.' }
	}
	const prior = getPlayerV2Derived(state)
	const nextAuction = {
		...currentAuction,
		...progress,
		calls: [...progress.calls],
		callSources: [
			...(currentAuction.callSources || []).slice(0, Math.max(0, progress.calls.length - 1)),
			...(progress.calls.length ? [source] : []),
		],
		dealer,
		revision: (Number(currentAuction.revision) || 0) + 1,
	}
	const auctionCursors = {
		...normalizedCursors(state),
		practice: nextAuction.calls.length,
	}
	const nextState = {
		...state,
		practiceAuction: nextAuction,
		auction: nextAuction,
		auctionCursors,
		auctionCursor: nextAuction.calls.length,
		manualContract: emptyManualContract(),
		phase: state.phase === 'confirmed' ? 'auction' : state.phase,
		status:
			progress.status === 'passed-out'
				? 'The hand was passed out. Restart the auction or move to another board.'
				: notice,
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

function appendSouthCall(state, call) {
	if (state.phase === 'play') return { ...state, status: 'Restart before changing the auction.' }
	if (state.auctionIntroPending) {
		return { ...state, status: 'Start the bidding exercise before making South\'s call.' }
	}
	if (state.manualContractMode) {
		return { ...state, status: 'Close manual contract entry before bidding.' }
	}
	const practiceAuction = practiceAuctionFor(state)
	if (!practiceAuction) return { ...state, status: 'Load a board before bidding.' }
	const progress = auctionProgress(practiceAuction.dealer, practiceAuction.calls)
	if (progress.terminal) {
		return { ...state, status: 'The auction has ended. Restart it to bid again.' }
	}
	if (progress.status === 'invalid') {
		return { ...state, status: progress.reason || 'The practice auction is invalid.' }
	}
	if (progress.nextSeat !== 'S') {
		return { ...state, status: `${progress.nextSeat} must bid before South.` }
	}
	const legal = legalNextAuctionCall(practiceAuction.dealer, practiceAuction.calls, call)
	if (!legal.legal) return { ...state, status: legal.reason || 'Illegal call.' }
	return withPracticeCalls(
		state,
		[...practiceAuction.calls, legal.call],
		`South called ${legal.call}.`,
		'south',
	)
}

function appendAutomaticCall(state, action) {
	if (state.phase !== 'auction') return state
	if (state.auctionIntroPending || state.manualContractMode) return state
	const practiceAuction = practiceAuctionFor(state)
	if (!practiceAuction) return state
	const progress = auctionProgress(practiceAuction.dealer, practiceAuction.calls)
	if (progress.terminal || progress.status === 'invalid') return state
	if (
		action.expectedSeat !== progress.nextSeat ||
		progress.nextSeat === 'S' ||
		Number(action.expectedRevision) !== Number(practiceAuction.revision)
	) {
		return {
			...state,
			status: 'Ignored a stale automatic bid; the auction position has changed.',
		}
	}
	const legal = legalNextAuctionCall(
		practiceAuction.dealer,
		practiceAuction.calls,
		action.call,
	)
	if (!legal.legal) {
		return { ...state, status: legal.reason || 'The automatic call was illegal.' }
	}
	return withPracticeCalls(
		state,
		[...practiceAuction.calls, legal.call],
		`${action.expectedSeat} called ${legal.call}.`,
		action.source || 'auto',
	)
}

function updateAuctionViewCursor(state, operation) {
	const view = state.auctionView === 'recorded' ? 'recorded' : 'practice'
	const cursors = normalizedCursors(state)
	const auction = view === 'recorded' ? state.recordedAuction : practiceAuctionFor(state)
	const maximum = auction?.calls?.length || 0
	const current = Math.min(maximum, cursors[view])
	const next =
		operation === 'next'
			? Math.min(maximum, current + 1)
			: operation === 'previous'
				? Math.max(0, current - 1)
				: operation === 'all'
					? maximum
					: 0
	return {
		...state,
		auctionCursors: { ...cursors, [view]: next },
		// Keep this compatibility cursor tied to the live public practice history so
		// the existing spoiler-safe Coach never consumes recorded future calls.
		auctionCursor: practiceAuctionFor(state)?.calls?.length || 0,
	}
}

function restartPracticeAuction(state) {
	const current = practiceAuctionFor(state)
	const dealer = current?.dealer || state.board?.auctionDealer || state.board?.dealer || 'N'
	const practiceAuction = makePracticeAuction(dealer, (Number(current?.revision) || 0) + 1)
	return {
		...state,
		practiceAuction,
		auction: practiceAuction,
		auctionView: 'practice',
		auctionCursors: { ...normalizedCursors(state), practice: 0 },
		auctionCursor: 0,
		manualContract: emptyManualContract(),
		manualContractMode: false,
		contractNotice: '',
		phase: 'auction',
		visibleSeat: 'S',
		visibleSeats: ['S'],
		play: null,
		history: [],
		completedTricks: [],
		autoPlayPaused: false,
		status: 'Practice auction restarted. South remains the learner seat.',
	}
}

export function playerV2Reducer(state, action) {
	switch (action.type) {
		case 'LOAD_DEALS': {
			const deals = action.deals.map(normalizeBoard).filter((board) => board.deal)
			const requestedIndex = Number(action.startIndex)
			const index = Number.isInteger(requestedIndex)
				? Math.max(0, Math.min(deals.length - 1, requestedIndex))
				: 0
			return {
				...state,
				deals,
				index,
				selectedName: action.name || '',
				content: action.content || null,
				boardSessions: {},
				manualContract: emptyManualContract(),
				contractNotice: '',
				...hydrateBoard(deals, index),
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
				manualContract: emptyManualContract(),
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
			if (state.phase === 'play') {
				return { ...state, status: 'Replay or unload the hand before changing its contract.' }
			}
			return {
				...state,
				manualContract: { ...state.manualContract, [action.field]: action.value },
				auctionIntroPending: false,
				manualContractMode: true,
				phase: state.phase === 'confirmed' ? 'auction' : state.phase,
				status:
					state.phase === 'confirmed'
						? 'Contract changed. Confirm it again before starting play.'
						: state.status,
			}
		case 'SET_AUCTION_VIEW':
		case 'AUCTION_SET_VIEW': {
			const view = action.view === 'recorded' ? 'recorded' : 'practice'
			return {
				...state,
				auctionView: view,
				status:
					view === 'recorded'
						? 'Showing the recorded PBN for comparison; your practice auction is preserved.'
						: 'Returned to your practice auction.',
			}
		}
		case 'AUCTION_NEXT':
			return updateAuctionViewCursor(state, 'next')
		case 'AUCTION_PREV':
			return updateAuctionViewCursor(state, 'previous')
		case 'AUCTION_REPLAY':
			return updateAuctionViewCursor(state, 'replay')
		case 'AUCTION_ALL':
			return updateAuctionViewCursor(state, 'all')
		case 'AUCTION_SOUTH_CALL':
		case 'AUCTION_APPEND_CALL':
			return appendSouthCall(state, action.call)
		case 'AUCTION_AUTO_CALL':
			return appendAutomaticCall(state, action)
		case 'START_PRACTICE_BIDDING': {
			if (state.phase === 'play') {
				return { ...state, status: 'Replay or unload the hand before restarting the auction.' }
			}
			const next = {
				...state,
				auctionIntroPending: false,
				manualContractMode: false,
				manualContract: emptyManualContract(),
				contractNotice: '',
				auctionView: 'practice',
				phase: 'auction',
				status: 'Bidding started. South is the learner seat; the other seats bid automatically.',
			}
			if (!practiceAuctionFor(next)?.terminal) return next
			return {
				...restartPracticeAuction(next),
				auctionIntroPending: false,
				status: 'Auction restarted. South is the learner seat; the other seats bid automatically.',
			}
		}
		case 'OPEN_MANUAL_CONTRACT':
			if (state.phase === 'play') {
				return { ...state, status: 'Replay or unload the hand before changing its contract.' }
			}
			return {
				...state,
				auctionIntroPending: false,
				manualContractMode: true,
				auctionView: 'practice',
				phase: 'auction',
				status: 'Manual contract entry opened. Check the contract and declarer before play.',
			}
		case 'RESTART_PRACTICE_AUCTION':
		case 'AUCTION_RESTART_PRACTICE':
			return restartPracticeAuction(state)
		case 'AUCTION_RESTORE_PBN':
			return {
				...updateAuctionViewCursor({ ...state, auctionView: 'recorded' }, 'all'),
				status: 'Showing the original PBN without replacing your practice auction.',
			}
		case 'CONFIRM_AUCTION': {
			if (state.auctionView === 'recorded') {
				return {
					...state,
					status: 'Return to Play as South before confirming your practice contract.',
				}
			}
			if (practiceAuctionFor(state)?.status === 'passed-out' && !state.manualContractMode) {
				return { ...state, status: 'This hand was passed out, so there is no contract to play.' }
			}
			const derived = getPlayerV2Derived(state)
			if (!derived.contract || !derived.declarer) {
				return { ...state, status: 'Set a contract and declarer before play.' }
			}
			const learnerSeat = derived.declarer === 'N' ? 'N' : 'S'
			return {
				...state,
				phase: 'confirmed',
				manualContractMode: false,
				visibleSeat: learnerSeat,
				visibleSeats: [learnerSeat],
				status: `Contract confirmed: ${derived.contract} by ${derived.declarer}. Opening lead ${derived.openingLeader}.`,
			}
		}
		case 'START_PLAY': {
			if (state.auctionView === 'recorded') {
				return {
					...state,
					status: 'Return to Play as South before starting the practice contract.',
				}
			}
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
				visibleSeat: derived.declarer === 'N' ? 'N' : 'S',
				// Keep dummy face down until the opening lead, even when the whole
				// table is rotated to put a North declarer in the learner position.
				visibleSeats: [derived.declarer === 'N' ? 'N' : 'S'],
				play: createInitialManualState(
					state.hands,
					derived.openingLeader,
					derived.trump,
					derived.declarer,
				),
				history: [],
				completedTricks: [],
				autoPlayPaused: false,
				status: `Opening lead: ${derived.openingLeader}. Computer-controlled seats will play automatically.`,
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
				visibleSeat:
					history.length === 0 ? (derived.declarer === 'N' ? 'N' : 'S') : state.visibleSeat,
				visibleSeats:
					history.length === 0
						? [derived.declarer === 'N' ? 'N' : 'S']
						: state.visibleSeats,
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
				visibleSeat:
					history.length === 0 ? (derived.declarer === 'N' ? 'N' : 'S') : state.visibleSeat,
				visibleSeats:
					history.length === 0
						? [derived.declarer === 'N' ? 'N' : 'S']
						: state.visibleSeats,
				status: 'Undid one trick.',
			}
		}
		default:
			return state
	}
}
