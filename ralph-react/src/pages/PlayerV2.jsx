import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from 'react'
import { Link } from 'react-router-dom'
import PlayerCoachNudge from '../components/PlayerCoachNudge'
import { parsePBN, sanitizePBN } from '../lib/pbn'
import { BoardZ } from '../schemas/board'
import { exportBoardPBN } from '../pbn/export'
import {
	SEATS,
	SUIT_ORDER,
	auctionRows,
	computeDuplicateScore,
	groupHand,
	handHcp,
	isDefender,
	isSeatVul,
	orderHandForDisplay,
	partnerOf,
	legalNextAuctionCall,
	selectSimpleDefenderCard,
	seatName,
	suitSymbol,
} from '../player-v2/bridgeV2'
import {
	getPlayerV2Derived,
	initialPlayerV2State,
	playerV2Reducer,
} from '../player-v2/playerV2Reducer'
import { choosePracticeAutoCall } from '../player-v2/acolPracticeBidder'
import { usePlayerCoach } from '../player-v2/coach/usePlayerCoach'
import {
	exitPlayerFullscreen,
	playerAcquiredFullscreen,
	requestPlayerFullscreen,
} from '../player-v2/playerPresentation'

const PLAYER_HANDOFF_KEY = 'ralph-player-handoff-v1'
const PLAYER_FELT_KEY = 'ralph-player-felt-v1'

function learnerControlledSeats(phase, declarer) {
	if (phase !== 'play') return new Set(['S'])
	return declarer === 'N' || declarer === 'S'
		? new Set(['N', 'S'])
		: new Set(['S'])
}

function rotatedForNorthDeclarer(phase, declarer) {
	return (phase === 'confirmed' || phase === 'play') && declarer === 'N'
}

const FELT_THEMES = [
	{
		key: 'green',
		label: 'Classic green',
		swatch: '#0b6b43',
		canvas: '#03281d',
		background:
			'radial-gradient(circle at 50% 42%, #147b4c 0%, #075236 48%, #03281d 100%)',
	},
	{
		key: 'blue',
		label: 'Tournament blue',
		swatch: '#155e75',
		canvas: '#082b38',
		background:
			'radial-gradient(circle at 50% 42%, #19718a 0%, #104b61 48%, #082b38 100%)',
	},
	{
		key: 'burgundy',
		label: 'Burgundy',
		swatch: '#7f1d3b',
		canvas: '#340d20',
		background:
			'radial-gradient(circle at 50% 42%, #96304f 0%, #661c37 48%, #340d20 100%)',
	},
	{
		key: 'charcoal',
		label: 'Charcoal',
		swatch: '#334155',
		canvas: '#111827',
		background:
			'radial-gradient(circle at 50% 42%, #475569 0%, #263548 48%, #111827 100%)',
	},
]

function FeltSwatches({ value, onChange, presentationMode = false }) {
	return (
		<div
			role="group"
			aria-label="Table felt colour"
			className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
				presentationMode ? 'border-white/30 bg-white/10' : 'border-slate-200 bg-white'
			}`}>
			<span
				className={`${presentationMode ? 'text-white' : 'text-slate-600'} text-[11px] font-black uppercase tracking-wide`}>
				Felt
			</span>
			{FELT_THEMES.map((theme) => (
				<button
					key={theme.key}
					type="button"
					onClick={() => onChange(theme.key)}
					aria-label={`Use ${theme.label} felt`}
					aria-pressed={value === theme.key}
					title={theme.label}
					className={`h-6 w-6 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${
						value === theme.key
							? 'border-amber-300 ring-2 ring-amber-300/60'
							: presentationMode
								? 'border-white/55'
								: 'border-slate-300'
					}`}
					style={{ backgroundColor: theme.swatch }}
				/>
			))}
		</div>
	)
}

function todayPbnDate() {
	const now = new Date()
	const yyyy = now.getFullYear()
	const mm = String(now.getMonth() + 1).padStart(2, '0')
	const dd = String(now.getDate()).padStart(2, '0')
	return `${yyyy}.${mm}.${dd}`
}

function todayFileDate() {
	const now = new Date()
	const yyyy = now.getFullYear()
	const mm = String(now.getMonth() + 1).padStart(2, '0')
	const dd = String(now.getDate()).padStart(2, '0')
	return `${yyyy}${mm}${dd}`
}

function downloadText(content, filename, type = 'text/plain') {
	const blob = new Blob([content], { type })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

function normalizePbnDate(value) {
	const text = String(value || '').trim()
	if (/^\d{4}\.\d{2}\.\d{2}$/.test(text)) return text
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.replace(/-/g, '.')
	return todayPbnDate()
}

function suitKeyFromName(suit) {
	if (suit === 'Spades') return 'S'
	if (suit === 'Hearts') return 'H'
	if (suit === 'Diamonds') return 'D'
	return 'C'
}

function rankToPbn(rank) {
	return rank === '10' ? 'T' : String(rank || '').toUpperCase()
}

function handsToBoardShapeHands(hands) {
	const empty = { S: [], H: [], D: [], C: [] }
	const order = { A: 0, K: 1, Q: 2, J: 3, T: 4, 9: 5, 8: 6, 7: 7, 6: 8, 5: 9, 4: 10, 3: 11, 2: 12 }
	return Object.fromEntries(
		SEATS.map((seat) => {
			const bySuit = { S: [], H: [], D: [], C: [] }
			for (const card of hands?.[seat] || []) {
				bySuit[suitKeyFromName(card.suit)].push(rankToPbn(card.rank))
			}
			for (const suit of Object.keys(bySuit)) {
				bySuit[suit].sort((a, b) => order[a] - order[b])
			}
			return [seat, hands?.[seat] ? bySuit : empty]
		}),
	)
}

function contractShape(contract) {
	const match = String(contract || '').toUpperCase().match(/^([1-7])(C|D|H|S|NT)(XX|X)?$/)
	if (!match) return undefined
	return {
		level: Number(match[1]),
		strain: match[2],
		dbl: match[3] || '',
	}
}

function playerStateToBoardShape(state, derived) {
	const contract = contractShape(derived.contract)
	const declarer = SEATS.includes(derived.declarer) ? derived.declarer : undefined
	const auction = state.auction?.calls?.length
		? state.auction.calls.map((call) => String(call).toUpperCase())
		: undefined
	const ext = state.board?.ext || {}
	return {
		event: ext.Event || state.selectedName || 'Bridge Hand Player',
		site: ext.Site || 'Bristol Bridge Club',
		date: normalizePbnDate(ext.Date),
		board: Number(state.board?.board) || state.index + 1,
		dealer: state.board?.dealer || 'N',
		vul: state.board?.vul || 'None',
		dealPrefix: String(state.board?.deal || '').match(/^([NESW]):/)?.[1] || state.board?.dealer || 'N',
		hands: handsToBoardShapeHands(state.hands),
		contract,
		declarer,
		auctionStart: auction?.length ? state.auction?.dealer || state.board?.auctionDealer || state.board?.dealer || 'N' : undefined,
		auction,
		notes: ext.Note ? [ext.Note] : [],
		ext: {
			system: ext.System || '',
			theme: ext.Theme || '',
			scoring: ext.Scoring === 'IMPs' ? 'IMPs' : ext.Scoring === 'MPs' ? 'MPs' : undefined,
		},
	}
}

function FilePrompt({ onPick }) {
	return (
		<div className="mx-auto mt-16 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
			<h1 className="text-xl font-semibold text-slate-900">Bridge Hand Player</h1>
			<p className="mt-2 text-sm text-slate-600">
				Load a PBN to step through the auction, confirm the contract, then play
				the hand.
			</p>
			<button
				onClick={onPick}
				className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
				Choose PBN
			</button>
			<Link
				to="/competitions"
				className="ml-2 mt-4 inline-flex rounded-md bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-amber-200">
				Play a famous final
			</Link>
		</div>
	)
}

function competitionReferencesFor(content, boardNumber) {
	if (content?.kind !== 'competition') return []
	const key = String(boardNumber || '')
	const references =
		content.boardComparisons?.[key] ||
		content.comparisons?.[key] ||
		content.boards?.find?.((board) => String(board.board) === key)?.references ||
		[]
	return (Array.isArray(references) ? references : [])
		.map((reference) => ({
			room: String(reference.room || reference.label || 'Published table'),
			contract: String(reference.contract || ''),
			declarer: String(reference.declarer || ''),
			result: String(reference.result || ''),
			nsScore: Number(reference.nsScore),
		}))
		.filter((reference) => Number.isFinite(reference.nsScore))
}

function SeatVisibilityToggles({ visibleSeats, dispatch, presentationMode = false }) {
	return (
		<div
			className={`flex items-center gap-1 rounded-lg border p-1 shadow-sm ${
				presentationMode ? 'border-white/30 bg-white/10' : 'border-slate-200 bg-white'
			}`}>
			{SEATS.map((seat) => (
				<button
					key={seat}
					data-player-seat-toggle="true"
					onClick={(event) => {
						dispatch({ type: 'TOGGLE_VISIBLE_SEAT', seat })
						if (event.detail > 0) event.currentTarget.blur()
					}}
					aria-pressed={(visibleSeats || []).includes(seat)}
					className={`${presentationMode ? 'h-9 w-9 text-base' : 'h-8 w-8 text-xs'} rounded-md font-bold ${
						(visibleSeats || []).includes(seat)
							? presentationMode
								? 'bg-amber-300 text-slate-950'
								: 'bg-slate-900 text-white'
							: presentationMode
								? 'bg-white/10 text-white hover:bg-white/20'
								: 'bg-slate-50 text-slate-700 hover:bg-slate-100'
					}`}>
					{seat}
				</button>
			))}
		</div>
	)
}

function CardButton({
	card,
	disabled,
	onClick,
	overlap = false,
	stack = false,
	spreadHand = false,
	playable = false,
	playableMotion = '',
	presentationMode = false,
	raisePlayable = true,
	stackIndex = 0,
}) {
	const red = card.suit === 'Hearts' || card.suit === 'Diamonds'
	return (
		<button
			disabled={disabled}
			onClick={onClick}
			aria-label={`${card.rank} of ${card.suit}${playable ? ', legal play' : ''}`}
			style={{ zIndex: stackIndex + 1 }}
			className={`player-v3-card relative flex shrink-0 flex-col items-start justify-between overflow-hidden rounded-lg border-2 bg-white font-black shadow-[0_8px_14px_rgba(0,0,0,0.36)] ring-1 ring-slate-100 transition-[transform,box-shadow,background-color] duration-150 ${
				presentationMode
					? 'h-[166px] w-[118px] px-3 py-3 text-[40px]'
					: 'h-[144px] w-[102px] px-2.5 py-2.5 text-[32px]'
			} ${
				red ? 'border-rose-400 text-rose-700' : 'border-slate-500 text-slate-950'
			} ${
				overlap
					? presentationMode
						? `${spreadHand ? '-ml-[42px]' : '-ml-[62px]'} first:ml-0`
						: `${spreadHand ? '-ml-[39px]' : '-ml-[50px]'} first:ml-0`
					: ''
			} ${
				stack
					? presentationMode
						? `${spreadHand ? '-mt-[46px]' : '-mt-[82px]'} first:mt-0`
						: `${spreadHand ? '-mt-[40px]' : '-mt-[68px]'} first:mt-0`
					: ''
			} ${
				playable
					? `cursor-pointer ring-4 ring-amber-300 shadow-[0_14px_22px_rgba(0,0,0,0.42)] hover:bg-amber-50 ${
							raisePlayable ? playableMotion : ''
						}`
					: disabled
						? 'cursor-default'
						: 'cursor-pointer hover:-translate-y-1 hover:shadow-2xl'
			}`}>
			<span className="flex flex-col items-center leading-none">
				<span>{card.rank}</span>
				<span className={`${presentationMode ? 'text-[34px]' : 'text-[27px]'} leading-none`}>
					{suitSymbol(card.suit)}
				</span>
			</span>
			<span
				className={`${presentationMode ? 'text-[27px]' : 'text-[22px]'} self-end leading-none opacity-90`}>
				{suitSymbol(card.suit)}
			</span>
		</button>
	)
}

const playableMotionBySeat = {
	N: 'origin-top translate-y-4 hover:translate-y-5',
	E: 'origin-right -translate-x-4 hover:-translate-x-5',
	S: 'origin-bottom -translate-y-4 hover:-translate-y-5',
	W: 'origin-left translate-x-4 hover:translate-x-5',
}

function countTricksBySide(tricks, declarer) {
	return (tricks || []).reduce(
		(counts, trick) => {
			if (!trick?.winner || !declarer) return counts
			if (isDefender(trick.winner, declarer)) counts.defence += 1
			else counts.declarer += 1
			return counts
		},
		{ declarer: 0, defence: 0 },
	)
}

function legalCardsForTurn(play, seat) {
	if (!play || !seat || play.turnSeat !== seat) return []
	const hand = play.remaining?.[seat] || []
	if (!hand.length) return []
	const trick = play.trickComplete ? [] : play.trick || []
	const leadSuit = trick.length > 0 && trick.length < 4 ? trick[0].card.suit : null
	if (!leadSuit) return hand
	const following = hand.filter((card) => card.suit === leadSuit)
	return following.length ? following : hand
}

function rankFromKey(event) {
	const key = event.key.toUpperCase()
	if (['A', 'K', 'Q', 'J'].includes(key)) return key
	if (key === 'T' || key === '0') return '10'
	if (/^[2-9]$/.test(key)) return key
	return ''
}

let bridgeAudioContext = null
let bridgeAudioDisabled = false

function primeBridgeAudio() {
	if (typeof window === 'undefined' || bridgeAudioDisabled) return null
	try {
		const AudioContextCtor = window.AudioContext || window.webkitAudioContext
		if (!AudioContextCtor) return null
		if (!bridgeAudioContext) bridgeAudioContext = new AudioContextCtor()
		if (bridgeAudioContext.state === 'suspended') {
			bridgeAudioContext.resume().catch(() => {})
		}
		return bridgeAudioContext
	} catch (error) {
		bridgeAudioDisabled = true
		console.warn('Bridge Player audio is unavailable', error)
		return null
	}
}

function playBridgeNotes(notes, { type = 'sine', duration = 0.1, gap = 0.035, gain = 0.035 } = {}) {
	const context = primeBridgeAudio()
	if (!context) return
	try {
		const now = context.currentTime
		notes.forEach((frequency, index) => {
			const start = now + index * (duration + gap)
			const oscillator = context.createOscillator()
			const gainNode = context.createGain()
			oscillator.type = type
			oscillator.frequency.setValueAtTime(frequency, start)
			gainNode.gain.setValueAtTime(0.0001, start)
			gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.012)
			gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration)
			oscillator.connect(gainNode).connect(context.destination)
			oscillator.start(start)
			oscillator.stop(start + duration + 0.02)
		})
	} catch (error) {
		bridgeAudioDisabled = true
		console.warn('Bridge Player sound was disabled after an audio error', error)
	}
}

function playCardSound() {
	playBridgeNotes([220], { type: 'triangle', duration: 0.065, gain: 0.025 })
}

function playTrickResultSound(declarerWon) {
	if (declarerWon) {
		playBridgeNotes([523, 659, 784], { duration: 0.09, gap: 0.025, gain: 0.035 })
		return
	}
	playBridgeNotes([392, 330, 262], { type: 'sine', duration: 0.12, gap: 0.03, gain: 0.03 })
}

function SeatLabel({ seat, dealer, vul, role, active, presentationMode = false }) {
	return (
		<div
			className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-black shadow-lg ${
				presentationMode ? 'text-base' : 'text-xs'
			} ${
				active ? 'bg-amber-400 text-slate-950' : 'bg-slate-950/85 text-white'
			}`}>
			<span className="rounded bg-emerald-600 px-2 py-0.5 text-white">{seat}</span>
			<span>{seatName(seat)}</span>
			<span className={`${presentationMode ? 'text-sm' : 'text-[10px]'} font-bold opacity-80`}>
				{role}
			</span>
			{dealer === seat && (
				<span className={`${presentationMode ? 'text-sm' : 'text-[10px]'} rounded bg-white/20 px-1.5`}>
					D
				</span>
			)}
			{vul && (
				<span
					className={`${presentationMode ? 'text-sm' : 'text-[10px]'} rounded bg-rose-600 px-1.5 text-white`}>
					V
				</span>
			)}
		</div>
	)
}

function ConcealedSeat({
	seat,
	count,
	dealer,
	vul,
	role,
	isTurn,
	openingLeader,
	presentationMode = false,
}) {
	const cardLabel = count === 1 ? 'card' : 'cards'
	return (
		<section
			aria-label={`${seatName(seat)}, ${role}, concealed, ${count} ${cardLabel} remaining${
				isTurn ? ', to play' : ''
			}`}
			className={`player-v3-concealed-seat relative flex items-center gap-3 rounded-2xl border-2 transition-[background-color,border-color,box-shadow] duration-150 ${
				presentationMode ? 'min-h-[76px] min-w-[174px] px-4 py-3' : 'min-h-[64px] min-w-[148px] px-3 py-2'
			} ${
				isTurn
					? 'z-30 border-amber-300 bg-amber-200 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.34)]'
					: 'border-white/25 bg-slate-950/90 text-white shadow-[0_10px_20px_rgba(0,0,0,0.26)]'
			}`}>
			<div
				className={`flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 font-black text-white shadow-inner ${
					presentationMode ? 'h-12 w-12 text-2xl' : 'h-10 w-10 text-xl'
				}`}>
				{seat}
			</div>
			<div className="min-w-0 leading-tight">
				<div className={`${presentationMode ? 'text-lg' : 'text-sm'} font-black`}>
					{seatName(seat)}
				</div>
				<div className={`${presentationMode ? 'text-base' : 'text-[11px]'} font-bold opacity-75`}>
					{role} · {count} {cardLabel}
				</div>
				<div className="mt-1 flex flex-wrap items-center gap-1">
					{isTurn && (
						<span
							role="status"
							aria-live="polite"
							className={`${presentationMode ? 'text-xs' : 'text-[10px]'} rounded bg-slate-950 px-1.5 py-0.5 font-black uppercase tracking-wide text-amber-200`}>
							To play
						</span>
					)}
					{openingLeader && (
						<span className={`${presentationMode ? 'text-xs' : 'text-[10px]'} rounded bg-amber-300 px-1.5 py-0.5 font-black uppercase tracking-wide text-slate-950`}>
							Opening lead
						</span>
					)}
					{dealer === seat && (
						<span className={`${presentationMode ? 'text-xs' : 'text-[10px]'} rounded bg-white/20 px-1.5 py-0.5 font-black`}>D</span>
					)}
					{vul && (
						<span className={`${presentationMode ? 'text-xs' : 'text-[10px]'} rounded bg-rose-600 px-1.5 py-0.5 font-black text-white`}>V</span>
					)}
				</div>
			</div>
		</section>
	)
}

function HandPanel({
	seat,
	cards,
	visible,
	active,
	dealer,
	vul,
	onPlay,
	play,
	declarer,
	dummy,
	openingLeader,
	position,
	originalCards,
	presentationMode = false,
	trump,
	raiseLegalChoices = true,
}) {
	const sortedCards = useMemo(
		() =>
			orderHandForDisplay(cards, {
				isDummy: seat === dummy,
				inPlay: !!play,
				trump,
			}),
		[cards, dummy, play, seat, trump],
	)
	const isTurn = play?.turnSeat === seat
	const isPartnership = declarer && (seat === declarer || seat === dummy)
	const role = seat === declarer ? 'Declarer' : seat === dummy ? 'Dummy' : 'Defender'
	const isSideSeat = position === 'E' || position === 'W'
	const spreadHand = visible && isTurn && !presentationMode
	const cardRows = isSideSeat
		? [sortedCards.slice(0, 6), sortedCards.slice(6)]
		: [sortedCards]
	const playableMotion = playableMotionBySeat[position] || ''
	const legalCardIds = useMemo(
		() => new Set(legalCardsForTurn(play, seat).map((card) => card.id)),
		[play, seat],
	)
	if (!visible) {
		return (
			<ConcealedSeat
				seat={seat}
				count={(cards || []).length}
				dealer={dealer}
				vul={vul}
				role={role}
				isTurn={isTurn}
				openingLeader={openingLeader === seat}
				presentationMode={presentationMode}
			/>
		)
	}

	return (
		<section
			className={`player-v3-visible-hand ${isSideSeat ? 'player-v3-side-hand' : ''} relative flex w-fit max-w-full flex-col items-center justify-center rounded-2xl p-1 transition-[background-color,box-shadow] duration-150 ${
				isTurn
					? presentationMode
						? 'z-30 bg-amber-200/25 ring-4 ring-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.3)]'
						: 'z-30 bg-amber-200/30 ring-4 ring-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.28)]'
					: ''
			} ${
				active && !isTurn ? 'ring-4 ring-amber-300/80' : ''
			} ${isPartnership ? 'shadow-[0_0_18px_rgba(14,165,233,0.14)]' : ''}`}>
			<div className="mb-0.5 flex flex-wrap items-center justify-center gap-1.5 text-center">
				<SeatLabel
					seat={seat}
					dealer={dealer}
					vul={vul}
					role={role}
					active={active || isTurn}
					presentationMode={presentationMode}
				/>
				{isTurn && (
					<span
						role="status"
						aria-live="polite"
						className={`${presentationMode ? 'text-sm' : 'text-[11px]'} rounded-full bg-amber-300 px-3 py-1 font-black uppercase tracking-wide text-slate-950 shadow-lg`}>
						To play
					</span>
				)}
				{openingLeader === seat && (
					<span
						className={`${presentationMode ? 'text-sm' : 'text-[11px]'} rounded-full bg-slate-950/80 px-3 py-1 font-black uppercase tracking-wide text-amber-200`}>
						Opening lead
					</span>
				)}
			</div>
			<div className="flex items-center">
				<div className={`flex items-center justify-center ${isSideSeat ? 'flex-col gap-3' : ''}`}>
					{cardRows.map((row, rowIndex) => (
						<div key={rowIndex} className="flex justify-center">
							{row.map((card, cardIndex) => {
								const legal = !!onPlay && isTurn && legalCardIds.has(card.id)
								return (
									<CardButton
										key={card.id}
										card={card}
										disabled={!legal}
										onClick={() => onPlay(seat, card.id)}
										overlap
										playable={legal}
										playableMotion={playableMotion}
										spreadHand={spreadHand}
										presentationMode={presentationMode}
										raisePlayable={raiseLegalChoices}
										stackIndex={cardIndex}
									/>
								)
							})}
						</div>
					))}
				</div>
			</div>
			<footer
				className={`player-v3-hand-hcp ${presentationMode ? 'text-sm' : 'text-[11px]'} mt-1 rounded bg-slate-950 px-2 py-0.5 font-black text-white`}>
				HCP {handHcp(originalCards || cards)}
			</footer>
		</section>
	)
}

function AuctionPanel({ auction, cursor, dealer, contract, declarer, presentationMode = false }) {
	const shown = (auction || []).slice(0, cursor)
	const { columns, rows } = auctionRows(shown, dealer)
	return (
		<section className="min-h-0 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xl">
			<div className="mb-3 flex items-center justify-between gap-4">
				<div>
					<h2 className={`${presentationMode ? 'text-3xl' : 'text-2xl'} font-black text-slate-950`}>
						Auction
					</h2>
					<p className={`${presentationMode ? 'text-lg' : 'text-sm'} font-bold text-slate-600`}>
						Dealer {seatName(dealer)}
					</p>
				</div>
				<div
					className={`${presentationMode ? 'px-5 py-3 text-2xl' : 'px-4 py-2 text-lg'} rounded-xl bg-slate-950 font-black text-white`}>
					{contract || 'No contract'} {declarer ? `by ${declarer}` : ''}
				</div>
			</div>
			<div className={`${presentationMode ? 'max-h-[360px]' : 'max-h-[300px]'} overflow-y-auto`}>
				<table className="w-full table-fixed text-center">
					<thead>
						<tr>
							{columns.map((seat) => (
								<th
									key={seat}
									className={`${presentationMode ? 'pb-3 text-xl' : 'pb-2 text-base'} border-b-2 border-slate-200 font-black text-slate-700`}>
									{seatName(seat)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.length ? (
							rows.map((row, rowIndex) => (
								<tr key={rowIndex}>
									{columns.map((seat, columnIndex) => {
										const call = row[columnIndex] || ''
										const callIndex = rowIndex * 4 + columnIndex
										const isLast = call && callIndex === shown.length - 1
										return (
											<td key={seat} className={`${presentationMode ? 'py-2' : 'py-1.5'}`}>
												<span
													className={`inline-flex items-center justify-center rounded-xl px-3 font-black ${
														presentationMode
															? 'min-h-12 min-w-20 text-2xl'
															: 'min-h-10 min-w-16 text-xl'
													} ${
														isLast
															? 'bg-emerald-100 text-emerald-950 ring-4 ring-emerald-400'
															: /^(P|PASS)$/i.test(call)
																? 'bg-slate-100 text-slate-600'
																: 'bg-sky-100 text-sky-950'
													}`}>
													{call || ''}
												</span>
											</td>
										)
									})}
								</tr>
							))
						) : (
							<tr>
								<td
									colSpan={4}
									className={`${presentationMode ? 'py-12 text-2xl' : 'py-10 text-xl'} font-bold text-slate-400`}>
									No calls yet
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</section>
	)
}

function AuctionModeSwitch({ state, derived, dispatch, presentationMode = false }) {
	const recordedAvailable = (derived.recordedAuction?.calls || []).length > 0
	if (!recordedAvailable) {
		return (
			<section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-amber-300 bg-slate-950 px-4 py-3 text-white shadow-lg">
				<strong className={presentationMode ? 'text-xl' : 'text-base'}>Live South practice</strong>
				<span className={`${presentationMode ? 'text-base' : 'text-sm'} font-bold text-slate-200`}>
					No reference auction in this PBN
				</span>
			</section>
		)
	}
	return (
		<section className="rounded-xl border-2 border-amber-300 bg-slate-950 p-2 text-white shadow-lg">
			<div className="grid grid-cols-2 gap-2" role="group" aria-label="Auction experience">
				<button
					type="button"
					aria-pressed={derived.auctionView === 'practice'}
					onClick={() => dispatch({ type: 'SET_AUCTION_VIEW', view: 'practice' })}
					className={`rounded-lg px-3 py-2.5 font-black ${
						presentationMode ? 'text-lg' : 'text-base'
					} ${
						derived.auctionView === 'practice'
							? 'bg-amber-300 text-slate-950'
							: 'bg-white/10 text-white hover:bg-white/20'
					}`}>
					Bid as South
				</button>
				<button
					type="button"
					aria-pressed={derived.auctionView === 'recorded'}
					onClick={() => dispatch({ type: 'SET_AUCTION_VIEW', view: 'recorded' })}
					className={`rounded-lg px-3 py-2.5 font-black ${
						presentationMode ? 'text-lg' : 'text-base'
					} ${
						derived.auctionView === 'recorded'
							? 'bg-sky-300 text-slate-950'
							: 'bg-white/10 text-white hover:bg-white/20'
					}`}>
					Compare recorded auction
				</button>
			</div>
			<p className={`${presentationMode ? 'text-sm' : 'text-xs'} mt-1.5 text-center font-bold leading-tight text-slate-200`}>
				{derived.auctionView === 'recorded'
					? 'Comparison only — your practice auction and contract remain safely preserved.'
					: state.practiceAuction?.calls?.length
						? 'Your live auction is saved automatically.'
						: 'You are South. The other seats bid automatically until your turn.'}
			</p>
		</section>
	)
}

function biddingStrainLabel(strain) {
	if (strain === 'NT') return 'NT'
	return suitSymbol(
		strain === 'S'
			? 'Spades'
			: strain === 'H'
				? 'Hearts'
				: strain === 'D'
					? 'Diamonds'
					: 'Clubs',
	)
}

function BiddingEditor({ state, derived, dispatch, presentationMode = false }) {
	const [level, setLevel] = useState('1')
	const [strain, setStrain] = useState('S')
	const auction = state.practiceAuction
	const calls = auction?.calls || []
	const dealer = auction?.dealer || state.board?.auctionDealer || state.board?.dealer || 'N'
	const canBid =
		state.phase === 'auction' &&
		derived.auctionView === 'practice' &&
		auction?.status === 'in-progress' &&
		derived.nextAuctionSeat === 'S'
	const legal = (call) => canBid && legalNextAuctionCall(dealer, calls, call).legal
	const restart = () => {
		if (calls.length && !window.confirm('Restart your practice auction from the first call?')) return
		dispatch({ type: 'RESTART_PRACTICE_AUCTION' })
	}
	const statusMessage =
		auction?.status === 'passed-out'
			? 'The hand was passed out. Restart to try another auction.'
			: auction?.status === 'complete'
				? `Auction complete: ${derived.contract} by ${derived.declarer}. Confirm when ready.`
				: canBid
					? 'South to bid — choose your call.'
					: derived.nextAuctionSeat
						? `${seatName(derived.nextAuctionSeat)} is bidding…`
						: 'Waiting for the auction to begin.'
	return (
		<section className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xl">
			<div className="mb-4 flex items-start justify-between gap-4">
				<div>
					<h2 className={`${presentationMode ? 'text-3xl' : 'text-2xl'} font-black text-slate-950`}>
						Your call — South
					</h2>
					<p
						className={`${presentationMode ? 'text-xl' : 'text-base'} mt-1 font-bold ${canBid ? 'text-emerald-700' : 'text-slate-600'}`}>
						{statusMessage}
					</p>
				</div>
				<button
					type="button"
					onClick={restart}
					className={`${presentationMode ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm'} rounded-lg border-2 border-rose-200 bg-rose-50 font-black text-rose-900`}>
					Restart auction
				</button>
			</div>
			<div className="grid gap-3">
				<div className="grid grid-cols-3 gap-3" aria-label="Special calls">
				{[
					['P', 'Pass'],
					['X', 'Double'],
					['XX', 'Redouble'],
				].map(([call, label]) => (
					<button
						key={call}
						type="button"
						disabled={!legal(call)}
						onClick={() => dispatch({ type: 'AUCTION_APPEND_CALL', call })}
						className={`${presentationMode ? 'min-h-14 text-xl' : 'min-h-12 text-base'} rounded-xl bg-slate-950 px-3 py-2 font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30`}>
						{label}
					</button>
				))}
				</div>
				<div>
					<div className={`${presentationMode ? 'text-base' : 'text-sm'} mb-2 font-black uppercase tracking-wide text-slate-600`}>
						Choose level
					</div>
					<div className="grid grid-cols-7 gap-2" role="group" aria-label="Bid level">
					{['1', '2', '3', '4', '5', '6', '7'].map((item) => (
						<button
							key={item}
							type="button"
							disabled={!canBid}
							aria-pressed={level === item}
							onClick={() => setLevel(item)}
							className={`${presentationMode ? 'min-h-14 text-2xl' : 'min-h-12 text-xl'} rounded-xl border-2 font-black ${
								level === item
									? 'border-sky-700 bg-sky-700 text-white'
									: 'border-slate-200 bg-slate-50 text-slate-800'
							} disabled:opacity-35`}>
							{item}
						</button>
					))}
					</div>
				</div>
				<div>
					<div className={`${presentationMode ? 'text-base' : 'text-sm'} mb-2 font-black uppercase tracking-wide text-slate-600`}>
						Choose suit or no-trumps
					</div>
					<div className="grid grid-cols-5 gap-2" role="group" aria-label="Bid suit or no-trumps">
						{['C', 'D', 'H', 'S', 'NT'].map((item) => {
							const redSuit = item === 'D' || item === 'H'
							const selected = strain === item
							return (
								<button
									key={item}
									type="button"
									disabled={!canBid}
									aria-label={item === 'NT' ? 'No-trumps' : item === 'C' ? 'Clubs' : item === 'D' ? 'Diamonds' : item === 'H' ? 'Hearts' : 'Spades'}
									aria-pressed={selected}
									onClick={() => setStrain(item)}
									className={`${presentationMode ? 'min-h-14 text-3xl' : 'min-h-12 text-2xl'} rounded-xl border-2 font-black ${
										selected
											? redSuit
												? 'border-sky-700 bg-sky-700 text-rose-100'
												: 'border-sky-700 bg-sky-700 text-white'
											: redSuit
												? 'border-slate-200 bg-slate-50 text-rose-700'
												: 'border-slate-200 bg-slate-50 text-slate-800'
									} disabled:opacity-35`}>
									{biddingStrainLabel(item)}
								</button>
							)
						})}
					</div>
				</div>
				<button
					type="button"
					disabled={!legal(`${level}${strain}`)}
					onClick={() => dispatch({ type: 'AUCTION_APPEND_CALL', call: `${level}${strain}` })}
					aria-label={`Bid ${level} ${strain === 'NT' ? 'no-trumps' : strain}`}
					className={`${presentationMode ? 'min-h-16 text-2xl' : 'min-h-14 text-xl'} rounded-xl bg-emerald-700 px-5 py-3 font-black text-white shadow-lg hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-30`}>
					Bid {level}{biddingStrainLabel(strain)}
				</button>
			</div>
		</section>
	)
}

function PlayerProgress({ state, presentationMode = false }) {
	const auctionFinished = !!state.practiceAuction?.terminal
	const currentStep =
		state.phase === 'play'
			? 3
			: state.phase === 'confirmed' || auctionFinished || state.manualContractMode
				? 2
				: 1
	const steps = [
		[1, 'Bid as South'],
		[2, 'Check contract'],
		[3, 'Play the hand'],
	]
	return (
		<nav aria-label="Board progress" className="rounded-2xl border border-white/40 bg-slate-950/90 p-2 shadow-xl">
			<ol className="grid grid-cols-3 gap-2">
				{steps.map(([number, label]) => {
					const complete = number < currentStep
					const active = number === currentStep
					return (
						<li
							key={number}
							aria-current={active ? 'step' : undefined}
							className={`${presentationMode ? 'min-h-14 text-lg' : 'min-h-11 text-sm'} flex items-center justify-center gap-2 rounded-xl px-3 font-black ${
								active
									? 'bg-amber-300 text-slate-950 ring-2 ring-amber-100'
									: complete
										? 'bg-emerald-700 text-white'
										: 'bg-white/10 text-slate-300'
							}`}>
							<span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
								{complete ? '✓' : number}
							</span>
							<span>{label}</span>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

function CompactSouthHand({ cards, dealer, vul, presentationMode = false }) {
	const grouped = groupHand(cards || [])
	const shape = SUIT_ORDER.map((suit) => grouped[suit]?.length || 0).join('–')
	return (
		<section className="rounded-2xl border-4 border-amber-300 bg-slate-950 p-4 text-white shadow-2xl">
			<div className="flex items-start justify-between gap-3 border-b border-white/20 pb-3">
				<div>
					<div className={`${presentationMode ? 'text-lg' : 'text-sm'} font-black uppercase tracking-[0.18em] text-amber-200`}>
						Your hand
					</div>
					<h2 className={`${presentationMode ? 'text-4xl' : 'text-3xl'} font-black`}>South</h2>
				</div>
				<div className="text-right font-bold text-slate-200">
					<div className={presentationMode ? 'text-xl' : 'text-base'}>HCP {handHcp(cards || [])}</div>
					<div className={presentationMode ? 'text-lg' : 'text-sm'}>Shape {shape}</div>
				</div>
			</div>
			<div className="mt-3 grid gap-2">
				{SUIT_ORDER.map((suit) => {
					const red = suit === 'Hearts' || suit === 'Diamonds'
					return (
						<div
							key={suit}
							className={`${presentationMode ? 'min-h-16 text-3xl' : 'min-h-14 text-2xl'} grid grid-cols-[44px_1fr] items-center rounded-xl bg-white px-3 font-black text-slate-950 shadow-inner`}>
							<span className={red ? 'text-rose-700' : 'text-slate-950'}>{suitSymbol(suit)}</span>
							<span className="tracking-[0.12em]">
								{(grouped[suit] || []).map((card) => card.rank).join(' ') || '—'}
							</span>
						</div>
					)
				})}
			</div>
			<div className={`${presentationMode ? 'text-base' : 'text-sm'} mt-3 flex flex-wrap gap-x-4 gap-y-1 font-bold text-slate-200`}>
				<span>{dealer === 'S' ? 'South deals' : `${seatName(dealer)} deals`}</span>
				<span>Vulnerability: {vul || 'None'}</span>
			</div>
		</section>
	)
}

function learnerRoleSummary(declarer) {
	if (declarer === 'N') return 'You will play North as declarer; South becomes dummy.'
	if (declarer === 'S') return 'You are declarer; North becomes dummy.'
	if (declarer === 'E' || declarer === 'W') return 'You remain South and defend; North plays automatically.'
	return 'Confirm the declarer before play.'
}

function ContractFacts({ derived, presentationMode = false }) {
	const facts = [
		['Final contract', derived.contract || 'Not set'],
		['Declarer', derived.declarer ? seatName(derived.declarer) : 'Not set'],
		['Opening leader', derived.openingLeader ? seatName(derived.openingLeader) : 'Not set'],
	]
	return (
		<div className="grid grid-cols-3 gap-2">
			{facts.map(([label, value]) => (
				<div key={label} className="rounded-xl bg-slate-100 p-3 text-center">
					<div className={`${presentationMode ? 'text-sm' : 'text-xs'} font-black uppercase tracking-wide text-slate-500`}>
						{label}
					</div>
					<div className={`${presentationMode ? 'text-3xl' : 'text-2xl'} mt-1 font-black text-slate-950`}>
						{value}
					</div>
				</div>
			))}
		</div>
	)
}

function ContractCheckpoint({ state, derived, dispatch, presentationMode = false }) {
	const confirmed = state.phase === 'confirmed'
	const restart = () => {
		if (!window.confirm('Restart your practice auction from the first call?')) return
		dispatch({ type: 'RESTART_PRACTICE_AUCTION' })
	}
	return (
		<section className="rounded-2xl border-4 border-amber-300 bg-white p-5 shadow-2xl">
			<div className={`${presentationMode ? 'text-base' : 'text-sm'} font-black uppercase tracking-[0.18em] text-emerald-700`}>
				Step 2 · Check before play
			</div>
			<h2 className={`${presentationMode ? 'text-4xl' : 'text-3xl'} mt-1 font-black text-slate-950`}>
				{confirmed ? 'Contract confirmed' : 'Auction complete'}
			</h2>
			<p className={`${presentationMode ? 'text-xl' : 'text-base'} mt-2 font-semibold text-slate-700`}>
				{confirmed
					? 'The table is ready. Start play when the room is ready for the opening lead.'
					: 'Check the contract, declarer and opening leader before setting the table.'}
			</p>
			<div className="mt-4">
				<ContractFacts derived={derived} presentationMode={presentationMode} />
			</div>
			<p className={`${presentationMode ? 'text-xl' : 'text-base'} mt-4 rounded-xl bg-amber-50 p-3 font-black text-amber-950`}>
				{learnerRoleSummary(derived.declarer)}
			</p>
			<div className="mt-4 grid gap-2">
				{confirmed ? (
					<button
						type="button"
						onClick={() => {
							primeBridgeAudio()
							dispatch({ type: 'START_PLAY' })
						}}
						className={`${presentationMode ? 'min-h-16 text-2xl' : 'min-h-14 text-xl'} rounded-xl bg-emerald-700 px-5 py-3 font-black text-white shadow-lg hover:bg-emerald-800`}>
						Start play
					</button>
				) : (
					<button
						type="button"
						disabled={!derived.contract || !derived.declarer}
						onClick={() => dispatch({ type: 'CONFIRM_AUCTION' })}
						className={`${presentationMode ? 'min-h-16 text-2xl' : 'min-h-14 text-xl'} rounded-xl bg-sky-700 px-5 py-3 font-black text-white shadow-lg hover:bg-sky-800 disabled:opacity-35`}>
						Confirm contract
					</button>
				)}
				<button
					type="button"
					onClick={restart}
					className={`${presentationMode ? 'text-lg' : 'text-base'} rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-2.5 font-black text-rose-900`}>
					Restart auction
				</button>
			</div>
		</section>
	)
}

function PassedOutPanel({ state, dispatch, onNextBoard, presentationMode = false }) {
	return (
		<section className="rounded-2xl border-4 border-amber-300 bg-white p-5 text-center shadow-2xl">
			<div className={`${presentationMode ? 'text-base' : 'text-sm'} font-black uppercase tracking-[0.18em] text-amber-800`}>
				Auction complete
			</div>
			<h2 className={`${presentationMode ? 'text-4xl' : 'text-3xl'} mt-2 font-black text-slate-950`}>
				This hand was passed out
			</h2>
			<p className={`${presentationMode ? 'text-xl' : 'text-base'} mt-3 font-semibold text-slate-700`}>
				There is no contract, so there is no card play for this auction.
			</p>
			<div className="mt-5 grid gap-2">
				<button
					type="button"
					onClick={() => dispatch({ type: 'RESTART_PRACTICE_AUCTION' })}
					className={`${presentationMode ? 'min-h-16 text-xl' : 'min-h-14 text-lg'} rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950`}>
					Restart auction
				</button>
				<button
					type="button"
					disabled={state.index >= state.deals.length - 1}
					onClick={onNextBoard}
					className={`${presentationMode ? 'min-h-14 text-lg' : 'min-h-12 text-base'} rounded-xl border-2 border-sky-200 bg-sky-50 px-5 py-3 font-black text-sky-900 disabled:opacity-35`}>
					Next board
				</button>
			</div>
		</section>
	)
}

function ManualContractEntry({ state, derived, dispatch, presentationMode = false }) {
	return (
		<section className="rounded-2xl border-4 border-sky-300 bg-white p-5 shadow-2xl">
			<div className={`${presentationMode ? 'text-base' : 'text-sm'} font-black uppercase tracking-[0.18em] text-sky-800`}>
				Teacher option
			</div>
			<h2 className={`${presentationMode ? 'text-3xl' : 'text-2xl'} mt-1 font-black text-slate-950`}>
				Set a contract instead
			</h2>
			<p className={`${presentationMode ? 'text-lg' : 'text-sm'} mt-2 font-semibold text-slate-600`}>
				Use this only when the lesson is about card play rather than bidding.
			</p>
			<div className="mt-4 rounded-xl bg-slate-100 p-3">
				<ManualContractControls manual={state.manualContract} dispatch={dispatch} />
			</div>
			<div className="mt-4">
				<ContractFacts derived={derived} presentationMode={presentationMode} />
			</div>
			<div className="mt-4 grid gap-2">
				<button
					type="button"
					disabled={!derived.contract || !derived.declarer}
					onClick={() => dispatch({ type: 'CONFIRM_AUCTION' })}
					className={`${presentationMode ? 'min-h-16 text-xl' : 'min-h-14 text-lg'} rounded-xl bg-sky-700 px-5 py-3 font-black text-white disabled:opacity-35`}>
					Confirm contract
				</button>
				<button
					type="button"
					onClick={() => dispatch({ type: 'START_PRACTICE_BIDDING' })}
					className={`${presentationMode ? 'text-lg' : 'text-base'} rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 font-black text-slate-800`}>
					Return to bidding
				</button>
			</div>
		</section>
	)
}

function RecordedAuctionControls({ derived, dispatch, presentationMode = false }) {
	const calls = derived.displayedAuctionCalls
	const cursor = derived.displayedAuctionCursor
	return (
		<section className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-4 shadow-xl">
			<h2 className={`${presentationMode ? 'text-3xl' : 'text-2xl'} font-black text-sky-950`}>
				Recorded auction
			</h2>
			<p className={`${presentationMode ? 'text-lg' : 'text-sm'} mt-1 font-semibold text-sky-900`}>
				Comparison only. Your South practice auction is preserved.
			</p>
			<div className="mt-4 grid grid-cols-3 gap-2">
				<button
					disabled={!calls.length}
					onClick={() => dispatch({ type: 'AUCTION_REPLAY' })}
					className="rounded-xl border-2 border-sky-200 bg-white px-3 py-3 font-black text-sky-950 disabled:opacity-35">
					Replay
				</button>
				<button
					disabled={!calls.length || cursor >= calls.length}
					onClick={() => dispatch({ type: 'AUCTION_NEXT' })}
					className="rounded-xl border-2 border-sky-200 bg-white px-3 py-3 font-black text-sky-950 disabled:opacity-35">
					Next call
				</button>
				<button
					disabled={!calls.length}
					onClick={() => dispatch({ type: 'AUCTION_ALL' })}
					className="rounded-xl border-2 border-sky-200 bg-white px-3 py-3 font-black text-sky-950 disabled:opacity-35">
					Show all
				</button>
			</div>
			<button
				type="button"
				onClick={() => dispatch({ type: 'SET_AUCTION_VIEW', view: 'practice' })}
				className={`${presentationMode ? 'min-h-16 text-xl' : 'min-h-14 text-lg'} mt-4 w-full rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950`}>
				Return to your auction
			</button>
		</section>
	)
}

function AuctionWorkspace({
	state,
	derived,
	dispatch,
	coach,
	presentationMode = false,
	onNextBoard,
}) {
	const recordedView = derived.auctionView === 'recorded'
	const shownAuction = derived.displayedAuction
	const shownCalls = derived.displayedAuctionCalls
	const shownCursor = recordedView ? derived.displayedAuctionCursor : shownCalls.length
	const passedOut = !recordedView && state.practiceAuction?.status === 'passed-out'
	const completed = !recordedView && state.practiceAuction?.status === 'complete'
	return (
		<main
			className={`mx-auto overflow-y-auto ${
				presentationMode
					? 'h-[100vh] max-w-[1880px] px-8 py-3'
					: 'h-[calc(100dvh-7.4rem)] max-w-[1420px] px-5 py-3'
			}`}>
			<PlayerProgress state={state} presentationMode={presentationMode} />
			<div className="mt-3 grid items-start gap-4 xl:grid-cols-[minmax(250px,0.75fr)_minmax(370px,1fr)_minmax(430px,1.18fr)]">
				<CompactSouthHand
					cards={state.hands?.S || []}
					dealer={state.board?.dealer}
					vul={state.board?.vul}
					presentationMode={presentationMode}
				/>
				<div className="grid min-h-0 gap-3">
					<AuctionModeSwitch
						state={state}
						derived={derived}
						dispatch={dispatch}
						presentationMode={presentationMode}
					/>
					<AuctionPanel
						auction={shownCalls}
						cursor={shownCursor}
						dealer={shownAuction?.dealer || state.board?.dealer}
						contract={
							recordedView && shownCursor < shownCalls.length
								? ''
								: recordedView
									? shownAuction?.contract
									: derived.contract
						}
						declarer={
							recordedView && shownCursor < shownCalls.length
								? ''
								: recordedView
									? shownAuction?.declarer
									: derived.declarer
						}
						presentationMode={presentationMode}
					/>
					<PlayerCoachNudge coach={coach} presentationMode={presentationMode} />
				</div>
				{recordedView ? (
					<RecordedAuctionControls
						derived={derived}
						dispatch={dispatch}
						presentationMode={presentationMode}
					/>
				) : state.manualContractMode ? (
					<ManualContractEntry
						state={state}
						derived={derived}
						dispatch={dispatch}
						presentationMode={presentationMode}
					/>
				) : passedOut ? (
					<PassedOutPanel
						state={state}
						dispatch={dispatch}
						onNextBoard={onNextBoard}
						presentationMode={presentationMode}
					/>
				) : completed || state.phase === 'confirmed' ? (
					<ContractCheckpoint
						state={state}
						derived={derived}
						dispatch={dispatch}
						presentationMode={presentationMode}
					/>
				) : (
					<BiddingEditor
						state={state}
						derived={derived}
						dispatch={dispatch}
						presentationMode={presentationMode}
					/>
				)}
			</div>
		</main>
	)
}

function NoAuctionIntro({ state, dispatch, onOpenManualContract }) {
	if (!state.auctionIntroPending) return null
	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 p-5">
			<section
				role="dialog"
				aria-modal="true"
				aria-labelledby="no-auction-title"
				className="w-full max-w-3xl rounded-3xl border-4 border-amber-300 bg-white p-7 text-center shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
				<div className="text-sm font-black uppercase tracking-[0.22em] text-emerald-700">First task</div>
				<h1 id="no-auction-title" className="mt-2 text-4xl font-black text-slate-950 sm:text-5xl">
					Bid Board {state.board?.board || state.index + 1}
				</h1>
				<p className="mx-auto mt-4 max-w-2xl text-xl font-semibold leading-relaxed text-slate-700">
					No auction is recorded for this board. You are South. North, East and West will bid
					automatically using guided ACOL after you start.
				</p>
				<div className="mx-auto mt-5 grid max-w-2xl grid-cols-3 gap-2 text-sm font-black text-slate-700">
					<div className="rounded-xl bg-amber-100 p-3">1 · Bid</div>
					<div className="rounded-xl bg-slate-100 p-3">2 · Check contract</div>
					<div className="rounded-xl bg-slate-100 p-3">3 · Play</div>
				</div>
				<div className="mx-auto mt-6 grid max-w-xl gap-3">
					<button
						type="button"
						autoFocus
						onClick={() => dispatch({ type: 'START_PRACTICE_BIDDING' })}
						className="min-h-16 rounded-xl bg-emerald-700 px-6 py-3 text-2xl font-black text-white shadow-lg hover:bg-emerald-800">
						Start bidding
					</button>
					<button
						type="button"
						onClick={onOpenManualContract}
						className="min-h-12 rounded-xl border-2 border-sky-200 bg-sky-50 px-5 py-3 text-base font-black text-sky-950">
						Set a contract instead
					</button>
				</div>
				<p className="mt-4 text-sm font-semibold text-slate-500">
					Use the second option only for a card-play lesson that deliberately skips bidding.
				</p>
			</section>
		</div>
	)
}

function StagePanel({ state, visualPlay, presentationMode = false, rotated = false }) {
	return (
		<TrickPanel
			play={visualPlay || state.play}
			presentationMode={presentationMode}
			rotated={rotated}
		/>
	)
}

function TrickCardSlot({ seat, position = seat, trick, winner, size = 'md' }) {
	const item = (trick || []).find((entry) => entry.seat === seat)
	const dims =
		size === 'sm'
			? {
					card: 'h-[78px] w-[54px]',
					rank: 'text-2xl',
					suit: 'text-[11px]',
					radius: 'rounded-lg',
				}
			: size === 'lg'
				? {
						card: 'h-[126px] w-[86px]',
						rank: 'text-[44px]',
						suit: 'text-base',
						radius: 'rounded-xl',
					}
			: {
					card: 'h-[108px] w-[74px]',
					rank: 'text-4xl',
					suit: 'text-xs',
					radius: 'rounded-xl',
				}
	const rotateClass = position === 'E' ? 'rotate-6' : position === 'W' ? '-rotate-6' : ''
	if (!item) {
		return (
			<div
				aria-label={`${seatName(seat)} trick position empty`}
				className={`player-v3-trick-card ${dims.card} ${dims.radius} border-2 border-dashed border-white/28 bg-white/8 shadow-inner`}
			/>
		)
	}

	const red = item.card.suit === 'Hearts' || item.card.suit === 'Diamonds'
	const isWinner = winner === item.seat
	const isDimmed = winner && !isWinner
	const suitClass = red ? 'text-rose-600' : 'text-slate-950'
	const borderClass = red ? 'border-rose-200' : 'border-slate-200'
	return (
		<div
			aria-label={`${seatName(item.seat)} played ${item.card.rank} of ${item.card.suit}${isWinner ? ', trick winner' : ''}`}
			className={`player-v3-trick-card relative ${dims.card} ${dims.radius} ${rotateClass} ${borderClass} flex items-center justify-center overflow-hidden border-2 bg-white ${suitClass} ${
				isWinner ? 'z-20 scale-105 ring-4 ring-amber-300' : ''
			} ${isDimmed ? 'opacity-55' : ''}`}
			style={{
				boxShadow:
					'0 14px 22px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.96), inset 0 -5px 16px rgba(0,0,0,0.10)',
			}}>
			<div
				className="absolute inset-0 opacity-[0.045]"
				style={{
					backgroundImage:
						'repeating-linear-gradient(135deg, #000 0, #000 1px, transparent 1px, transparent 6px)',
				}}
			/>
			<div className={`player-v3-trick-suit absolute left-1.5 top-1 ${dims.suit} font-black`}>
				{suitSymbol(item.card.suit)}
			</div>
			<div className={`player-v3-trick-suit absolute bottom-1 right-1.5 ${dims.suit} rotate-180 font-black`}>
				{suitSymbol(item.card.suit)}
			</div>
			<div className={`player-v3-trick-rank ${dims.rank} font-black leading-none drop-shadow-sm`}>
				{item.card.rank}
				<span className="ml-0.5">{suitSymbol(item.card.suit)}</span>
			</div>
		</div>
	)
}

function CrossTrick({
	trick,
	winner,
	turnSeat,
	contract,
	size = 'md',
	showStatus = true,
	showContract = true,
	rotated = false,
}) {
	const played = (trick || []).length
	const large = size === 'lg'
	const visualSeats = rotated
		? { top: 'S', right: 'W', bottom: 'N', left: 'E' }
		: { top: 'N', right: 'E', bottom: 'S', left: 'W' }
	return (
		<div
			className="relative h-full w-full overflow-hidden rounded-2xl border-2 border-amber-400/80 shadow-[inset_0_0_30px_rgba(0,0,0,0.34),0_18px_38px_rgba(0,0,0,0.32)]"
			style={{
				background:
					'radial-gradient(circle at 28% 18%, rgba(41,199,132,0.42), rgba(6,78,59,0.92) 56%), radial-gradient(circle at 76% 80%, rgba(8,64,45,0.8), rgba(3,35,24,0.96) 58%)',
			}}>
			<div
				className="absolute inset-0 opacity-[0.07]"
				style={{
					backgroundImage:
						'repeating-linear-gradient(145deg, rgba(255,255,255,0.65) 0px, rgba(255,255,255,0.65) 1px, transparent 1px, transparent 8px)',
				}}
			/>
			{showContract && contract && (
				<div className="absolute right-2 top-2 rounded-md bg-white/14 px-2 py-0.5 text-xs font-black text-white">
					{contract}
				</div>
			)}
			<div className={`absolute left-1/2 -translate-x-1/2 ${large ? 'top-6' : 'top-5'}`}>
				<TrickCardSlot seat={visualSeats.top} position="N" trick={trick} winner={winner} size={size} />
			</div>
			<div className={`absolute top-1/2 -translate-y-1/2 ${large ? 'right-6' : 'right-5'}`}>
				<TrickCardSlot seat={visualSeats.right} position="E" trick={trick} winner={winner} size={size} />
			</div>
			<div className={`absolute left-1/2 -translate-x-1/2 ${large ? 'bottom-6' : 'bottom-5'}`}>
				<TrickCardSlot seat={visualSeats.bottom} position="S" trick={trick} winner={winner} size={size} />
			</div>
			<div className={`absolute top-1/2 -translate-y-1/2 ${large ? 'left-6' : 'left-5'}`}>
				<TrickCardSlot seat={visualSeats.left} position="W" trick={trick} winner={winner} size={size} />
			</div>
			{showStatus && (
				<div
					className={`player-v3-trick-status absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-300 bg-slate-950 text-center font-black uppercase leading-tight tracking-wide text-amber-100 ${
						large ? 'h-24 w-24 px-2 text-sm' : 'h-16 w-16 text-[9px]'
					}`}>
					{winner ? `Won by ${winner}` : turnSeat ? `Turn ${turnSeat}` : `${played}/4`}
				</div>
			)}
		</div>
	)
}

function TrickPanel({ play, presentationMode = false, rotated = false }) {
	const trick = play?.trick || []
	const winner = play?.visualWinner || null
	return (
		<section
			className={`player-v3-trick-panel flex flex-col rounded-2xl border-2 border-amber-400 bg-emerald-950 p-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.34)] ${
				presentationMode
					? 'w-[clamp(460px,40vw,580px)]'
					: 'w-[clamp(420px,36vw,560px)]'
			}`}>
			<div
				className={`player-v3-trick-cross mx-auto w-full ${
					presentationMode
					? 'h-[clamp(300px,38vh,400px)]'
						: 'h-[clamp(260px,35vh,380px)]'
				}`}>
				<CrossTrick
					trick={trick}
					winner={winner}
					turnSeat={play?.turnSeat}
					contract={null}
					showContract={false}
					size={presentationMode ? 'lg' : 'md'}
					rotated={rotated}
				/>
			</div>
		</section>
	)
}

function LastTrickPanel({ trick, presentationMode = false, rotated = false, compact = false }) {
	return (
		<aside
			className={`player-v3-last-trick player-v3-table-info ${compact ? 'player-v3-table-info-compact' : ''} rounded-2xl border-2 border-amber-400 bg-emerald-950 p-2 text-white shadow-2xl ${
				presentationMode ? 'w-[clamp(210px,14vw,254px)]' : 'w-[238px]'
			}`}>
			<div className="mb-1 flex items-center justify-between">
				<h2
					className={`${presentationMode ? 'text-base' : 'text-xs'} font-black uppercase tracking-wide text-amber-100`}>
					Last Trick
				</h2>
				<div
					className={`${presentationMode ? 'text-sm' : 'text-[10px]'} rounded-md bg-amber-300 px-2 py-0.5 font-black text-slate-950`}>
					{trick?.winner ? `To ${trick.winner}` : '-'}
				</div>
			</div>
			<div className="player-v3-last-trick-detail h-[198px] w-full">
				{trick ? (
					<CrossTrick
						trick={trick.cards}
						winner={trick.winner}
						turnSeat={null}
						size="sm"
						showStatus={false}
						rotated={rotated}
					/>
				) : (
					<div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-white/28 bg-white/8 text-center text-xs font-bold text-emerald-100">
						No previous trick
					</div>
				)}
			</div>
			<div className="player-v3-last-trick-summary hidden min-h-9 items-center gap-1.5 overflow-hidden rounded-xl border border-white/20 bg-white/8 px-2 py-1.5 text-sm font-black">
				{trick ? (
					trick.cards.map((item) => (
						<span
							key={`${item.seat}-${item.card.id}`}
							className={`rounded-md bg-white px-2 py-1 ${
								item.card.suit === 'Hearts' || item.card.suit === 'Diamonds'
									? 'text-rose-700'
									: 'text-slate-950'
							}`}>
							{item.seat} {item.card.rank}
							{suitSymbol(item.card.suit)}
						</span>
					))
				) : (
					<span className="text-emerald-100">No previous trick</span>
				)}
			</div>
		</aside>
	)
}

function PlayStatusPanel({
	state,
	derived,
	settledTrickCount,
	presentationMode = false,
	compact = false,
}) {
	const shownTricks = (state.completedTricks || []).slice(0, settledTrickCount)
	const counts = countTricksBySide(shownTricks, derived.declarer)
	const level = Number(String(derived.contract || '').match(/^([1-7])/)?.[1] || 0)
	const target = level ? level + 6 : 0
	const tricksNeeded = target ? Math.max(0, target - counts.declarer) : 0
	const isComplete = settledTrickCount >= 13
	const finalScore =
		isComplete && derived.contract && derived.declarer
			? computeDuplicateScore(
					derived.contract,
					derived.declarer,
					isSeatVul(derived.declarer, state.board?.vul),
					counts.declarer,
				)
			: null
	return (
		<aside
			className={`player-v3-play-status player-v3-table-info ${compact ? 'player-v3-table-info-compact' : ''} rounded-2xl border-2 border-amber-400 bg-emerald-950 p-3 text-white shadow-2xl ${
				presentationMode ? 'w-[clamp(210px,14vw,254px)]' : 'w-[238px]'
			}`}>
			<div className="player-v3-play-status-compact hidden items-center justify-between gap-3">
				<div>
					<div className="text-[10px] font-black uppercase tracking-wide text-amber-100">
						Contract
					</div>
					<div className="text-2xl font-black leading-none">
						{derived.contract || '-'} <span className="text-sm text-emerald-100">by {derived.declarer || '-'}</span>
					</div>
				</div>
				<div className="text-right">
					<div className="text-[10px] font-black uppercase tracking-wide text-emerald-100">
						Decl–Def · Done
					</div>
					<div className="text-xl font-black leading-none">
						{counts.declarer}–{counts.defence} · {settledTrickCount}/13
					</div>
				</div>
			</div>
			<div className="player-v3-play-status-detail">
				<div className="flex items-start justify-between gap-2">
					<div>
						<div
							className={`${presentationMode ? 'text-base' : 'text-xs'} font-black uppercase tracking-wide text-amber-100`}>
							Contract
						</div>
						<div className="text-[44px] font-black leading-none text-white">
							{derived.contract || '-'}
						</div>
						<div
							className={`${presentationMode ? 'text-base' : 'text-xs'} mt-1 font-bold text-emerald-100`}>
							Declarer {derived.declarer || '-'}
						</div>
					</div>
					<div className="rounded-xl bg-amber-300 px-2 py-1 text-center text-slate-950">
						<div className="text-[10px] font-black uppercase tracking-wide">Done</div>
						<div className="text-2xl font-black leading-none">{settledTrickCount}</div>
					</div>
				</div>

				<div className="mt-3 grid grid-cols-2 gap-2 text-center">
					<div className="rounded-xl bg-white/10 p-2 shadow-inner">
						<div className="text-[10px] font-black uppercase tracking-wide text-emerald-100">
							Decl
						</div>
						<div className="text-3xl font-black leading-none">{counts.declarer}</div>
					</div>
					<div className="rounded-xl bg-white/10 p-2 shadow-inner">
						<div className="text-[10px] font-black uppercase tracking-wide text-emerald-100">
							Def
						</div>
						<div className="text-3xl font-black leading-none">{counts.defence}</div>
					</div>
				</div>

				<div className="mt-2 rounded-xl bg-slate-950 px-3 py-2 shadow-inner">
					<div
						className={`${presentationMode ? 'text-sm' : 'text-[10px]'} font-black uppercase tracking-wide text-emerald-100`}>
						{isComplete ? 'Final Result' : `Target ${target || '-'}`}
					</div>
					<div className={`${presentationMode ? 'text-3xl' : 'text-2xl'} font-black leading-tight`}>
						{isComplete && finalScore && !finalScore.partial
							? finalScore.resultText
							: tricksNeeded > 0
								? `Needs ${tricksNeeded}`
								: target
									? 'Contract made'
									: '-'}
					</div>
				</div>
			</div>
		</aside>
	)
}

function ManualContractControls({ manual, dispatch }) {
	return (
		<div className="grid grid-cols-2 gap-2.5">
			<select
				aria-label="Declarer"
				value={manual.declarer}
				onChange={(event) =>
					dispatch({ type: 'SET_MANUAL_CONTRACT', field: 'declarer', value: event.target.value })
				}
				className="min-h-12 min-w-0 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-base font-bold">
				<option value="">Declarer</option>
				{SEATS.map((seat) => (
					<option key={seat}>{seat}</option>
				))}
			</select>
			<select
				aria-label="Contract level"
				value={manual.level}
				onChange={(event) =>
					dispatch({ type: 'SET_MANUAL_CONTRACT', field: 'level', value: event.target.value })
				}
				className="min-h-12 min-w-0 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-base font-bold">
				<option value="">Level</option>
				{['1', '2', '3', '4', '5', '6', '7'].map((level) => (
					<option key={level}>{level}</option>
				))}
			</select>
			<select
				aria-label="Contract strain"
				value={manual.strain}
				onChange={(event) =>
					dispatch({ type: 'SET_MANUAL_CONTRACT', field: 'strain', value: event.target.value })
				}
				className="min-h-12 min-w-0 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-base font-bold">
				<option value="">Suit / NT</option>
				{['C', 'D', 'H', 'S', 'NT'].map((strain) => (
					<option key={strain}>{strain}</option>
				))}
			</select>
			<select
				aria-label="Contract double status"
				value={manual.dbl}
				onChange={(event) =>
					dispatch({ type: 'SET_MANUAL_CONTRACT', field: 'dbl', value: event.target.value })
				}
				className="min-h-12 min-w-0 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-base font-bold">
				<option value="">Not doubled</option>
				<option value="X">X</option>
				<option value="XX">XX</option>
			</select>
		</div>
	)
}

function TeacherToolsDrawer({
	open,
	onClose,
	state,
	dispatch,
	feltTheme,
	onFeltThemeChange,
	raiseLegalChoices,
	onToggleLegalChoices,
	presentationMode = false,
}) {
	if (!open) return null
	return (
		<aside
			aria-label="Teacher tools"
			className={`fixed right-4 z-[65] w-[330px] rounded-2xl border-4 border-amber-300 bg-white p-4 text-slate-950 shadow-[0_24px_70px_rgba(0,0,0,0.45)] ${
				presentationMode ? 'top-[82px]' : 'top-12'
			}`}>
			<div className="flex items-center justify-between gap-3">
				<div>
					<div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Optional</div>
					<h2 className="text-2xl font-black">Teacher tools</h2>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-2 font-black">
					Close
				</button>
			</div>
			<div className="mt-4 grid gap-4">
				<div>
					<div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Table colour</div>
					<FeltSwatches value={feltTheme} onChange={onFeltThemeChange} />
				</div>
				{state.phase === 'play' && (
					<>
						<div>
							<div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Show hands</div>
							<SeatVisibilityToggles visibleSeats={state.visibleSeats} dispatch={dispatch} />
						</div>
						<button
							type="button"
							onClick={onToggleLegalChoices}
							aria-pressed={raiseLegalChoices}
							className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 font-black text-amber-950">
							{raiseLegalChoices ? 'Lower legal choices' : 'Raise legal choices'}
						</button>
					</>
				)}
				{state.phase !== 'play' && (
					<button
						type="button"
						onClick={() => {
							dispatch({ type: 'OPEN_MANUAL_CONTRACT' })
							onClose()
						}}
						className="rounded-xl border-2 border-sky-200 bg-sky-50 px-4 py-3 font-black text-sky-950">
						Set a contract instead
					</button>
				)}
			</div>
		</aside>
	)
}

function Controls({
	state,
	derived,
	dispatch,
	onPick,
	onSavePbn,
	returnPath,
	returnLabel = 'Back',
	onPreviousBoard,
	onNextBoard,
	onAdvanceHidden,
	canAdvanceHidden,
	onReplayHand,
	onToggleTeacherTools,
}) {
	const status =
		state.phase === 'play'
			? `${seatName(state.play?.turnSeat)} to play · ${derived.contract} by ${derived.declarer}`
			: state.auctionIntroPending
				? 'First task: start the bidding exercise'
				: state.manualContractMode
					? 'Teacher route: set the contract and declarer, then confirm'
				: state.phase === 'confirmed'
					? `${derived.contract} by ${derived.declarer} confirmed · ready to start play`
					: derived.auctionView === 'recorded'
						? 'Comparing the recorded auction · your practice is preserved'
						: derived.nextAuctionSeat === 'S'
							? 'South to bid'
							: derived.nextAuctionSeat
								? `${seatName(derived.nextAuctionSeat)} is bidding…`
								: state.practiceAuction?.status === 'passed-out'
									? 'Passed out · choose what to do next'
									: 'Auction complete · check the contract'
	return (
		<aside className="mx-auto flex min-h-16 w-full max-w-[1420px] items-center gap-3 rounded-xl border border-white/50 bg-white p-2 shadow-xl">
			<div className="flex shrink-0 items-center gap-1.5">
				<Link to="/player/help" className="rounded-md bg-white px-2 py-1.5 text-xs font-bold text-sky-800 shadow-sm">
					Guide
				</Link>
				{returnPath && (
					<Link to={returnPath} className="rounded-md bg-white px-2 py-1.5 text-xs font-bold shadow-sm">
						{returnLabel}
					</Link>
				)}
				<button onClick={onPick} className="rounded-md bg-white px-2 py-1.5 text-xs font-bold shadow-sm">
					Load PBN
				</button>
				<button
					onClick={onSavePbn}
					disabled={!state.board}
					className="rounded-md bg-white px-2 py-1.5 text-xs font-bold shadow-sm disabled:opacity-40">
					Save PBN
				</button>
			</div>
			<div className="w-[160px] shrink-0">
				<div className="flex items-center gap-1">
					<button
						onClick={onPreviousBoard}
						disabled={state.index <= 0}
						aria-label="Previous board"
						className="h-9 w-9 rounded-md border border-slate-200 bg-white text-lg font-black disabled:opacity-30">
						‹
					</button>
					<div className="min-w-0 flex-1 text-center">
						<div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
							Board {state.board?.board || state.index + 1}
						</div>
						<div className="text-base font-black text-slate-950">
							{state.index + 1} of {state.deals.length || 0}
						</div>
					</div>
					<button
						onClick={onNextBoard}
						disabled={state.index >= state.deals.length - 1}
						aria-label="Next board"
						className="h-9 w-9 rounded-md border border-slate-200 bg-white text-lg font-black disabled:opacity-30">
						›
					</button>
				</div>
			</div>
			<div role="status" aria-live="polite" className="min-w-[170px] flex-1 rounded-xl bg-slate-950 px-4 py-2 text-center text-base font-black text-white">
				{status}
			</div>
			{state.phase === 'play' && (
				<div className="grid w-[510px] shrink-0 grid-cols-5 gap-1.5">
					<button
						onClick={() => dispatch({ type: 'UNDO_CARD' })}
						disabled={!state.history.length}
						className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black disabled:opacity-35">
						Undo card
					</button>
					<button
						onClick={() => dispatch({ type: 'UNDO_TRICK' })}
						disabled={!state.history.length}
						className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black disabled:opacity-35">
						Undo trick
					</button>
					<button
						onClick={() => dispatch({ type: 'SET_AUTO_PLAY_PAUSED', paused: !state.autoPlayPaused })}
						className={`rounded-lg border px-2 py-2 text-xs font-black ${
							state.autoPlayPaused
								? 'border-amber-300 bg-amber-50 text-amber-950'
								: 'border-rose-300 bg-rose-50 text-rose-950'
						}`}>
						{state.autoPlayPaused ? 'Start computers' : 'Pause computers'}
					</button>
					<button
						onClick={onAdvanceHidden}
						disabled={!canAdvanceHidden}
						className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-2 text-xs font-black text-amber-950 disabled:opacity-35">
						Computer card
					</button>
					<button
						onClick={onReplayHand}
						className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-2 text-xs font-black text-sky-950">
						Replay hand
					</button>
				</div>
			)}
			<button
				type="button"
				onClick={onToggleTeacherTools}
				className="shrink-0 rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-950">
				Teacher tools
			</button>
		</aside>
	)
}

function PresentationRestore({ onRestore, notice, buttonRef, restoring = false }) {
	return (
		<div className="fixed bottom-4 right-4 z-[70] flex max-w-md flex-col items-end gap-2">
			{notice && (
				<div
					role="status"
					aria-live="polite"
					className="rounded-xl border border-amber-300/70 bg-slate-950 px-4 py-2 text-right text-sm font-bold text-amber-100 shadow-xl">
					{notice}
				</div>
			)}
			<button
				ref={buttonRef}
				type="button"
				onClick={onRestore}
				disabled={restoring}
				aria-label="Restore normal view; Escape"
				title="Restore normal view (Esc)"
				className="min-h-12 rounded-xl border-2 border-amber-300 bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(0,0,0,0.38)] transition-colors hover:bg-slate-900 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-80">
				{restoring ? 'Restoring…' : 'Restore normal view'}
				<span className="ml-2 rounded-md bg-white/14 px-2 py-1 text-xs text-amber-100">Esc</span>
			</button>
		</div>
	)
}

function EndResultModal({
	result,
	onBack,
	onNext,
	onPick,
	onReplay,
	hasNextBoard,
	dialogRef,
}) {
	if (!result) return null
	const positive = result.score >= 0
	const signedScore = result.score > 0 ? `+${result.score}` : String(result.score)
	const signed = (score) => (score > 0 ? `+${score}` : String(score))
	const competitionReferences = result.competitionReferences || []
	const keepFocusInDialog = (event) => {
		if (event.key !== 'Tab') return
		const controls = [...event.currentTarget.querySelectorAll('button:not([disabled])')]
		if (!controls.length) return
		const first = controls[0]
		const last = controls[controls.length - 1]
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault()
			last.focus()
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault()
			first.focus()
		}
	}
	return (
		<div
			onKeyDown={keepFocusInDialog}
			className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/72 p-3 sm:items-center sm:p-6">
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-labelledby="player-hand-complete-title"
				className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border-4 border-amber-300 bg-emerald-950 p-4 text-center text-white shadow-[0_30px_80px_rgba(0,0,0,0.5)] outline-none sm:max-h-[calc(100dvh-3rem)] sm:p-7">
				<div className="text-sm font-black uppercase tracking-[0.24em] text-amber-200">
					Hand Complete
				</div>
				<h2
					id="player-hand-complete-title"
					className="mt-2 text-3xl font-black leading-tight sm:text-5xl">
					{positive ? 'Congratulations' : 'Commiserations'}
				</h2>
				<div
					className={`mx-auto mt-4 w-fit rounded-2xl px-8 py-3 text-4xl font-black shadow-inner sm:mt-5 sm:py-4 sm:text-6xl ${
						positive ? 'bg-emerald-300 text-emerald-950' : 'bg-rose-200 text-rose-950'
					}`}>
					{signedScore}
				</div>
				<p className="mt-4 text-lg font-bold text-emerald-50">
					{positive ? 'Your North–South side scores' : 'Your North–South side is deducted'}{' '}
					{Math.abs(result.score)} points.
				</p>
				<div className="mx-auto mt-4 grid max-w-lg grid-cols-3 gap-2 text-sm font-black">
					<div className="rounded-xl bg-white/10 p-3">
						<div className="text-[10px] uppercase tracking-wide text-emerald-100">Contract</div>
						<div className="text-xl">{result.contract}</div>
					</div>
					<div className="rounded-xl bg-white/10 p-3">
						<div className="text-[10px] uppercase tracking-wide text-emerald-100">Declarer</div>
						<div className="text-xl">{result.declarer}</div>
					</div>
					<div className="rounded-xl bg-white/10 p-3">
						<div className="text-[10px] uppercase tracking-wide text-emerald-100">Result</div>
						<div className="text-xl">{result.resultText}</div>
					</div>
				</div>
				{competitionReferences.length > 0 && (
					<section className="mx-auto mt-5 max-w-xl rounded-2xl border border-sky-300/50 bg-sky-950/70 p-4 text-left">
						<div className="flex items-center justify-between gap-3">
							<div>
								<div className="text-xs font-black uppercase tracking-[0.16em] text-sky-200">
									Published expert comparison
								</div>
								<div className="mt-1 text-sm font-semibold text-sky-50">
									All scores are shown from North–South’s point of view.
								</div>
							</div>
							<div className="shrink-0 rounded-xl bg-amber-300 px-3 py-2 text-center text-slate-950">
								<div className="text-[10px] font-black uppercase tracking-wide">You</div>
								<div className="text-2xl font-black">{signed(result.nsScore)}</div>
							</div>
						</div>
						<div className="mt-3 grid gap-2 sm:grid-cols-2">
							{competitionReferences.map((reference, index) => {
								const difference = result.nsScore - reference.nsScore
								return (
									<div key={`${reference.room}-${index}`} className="rounded-xl bg-white/10 p-3">
										<div className="flex items-center justify-between gap-2">
											<strong className="text-sm text-white">{reference.room}</strong>
											<span className="text-xl font-black text-sky-100">{signed(reference.nsScore)}</span>
										</div>
										<div className="mt-1 text-xs font-semibold text-sky-100">
											{[reference.contract, reference.declarer, reference.result]
												.filter(Boolean)
												.join(' · ') || 'Published table result'}
										</div>
										<div className="mt-1 text-xs font-black text-amber-200">
											{difference === 0
												? 'Same N–S score'
												: `${Math.abs(difference)} ${difference > 0 ? 'better' : 'lower'} for N–S`}
										</div>
									</div>
								)
							})}
						</div>
					</section>
				)}
				<div className="mt-5 flex flex-wrap justify-center gap-3 sm:mt-7">
					{hasNextBoard && (
						<button
							onClick={onNext}
							className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg hover:bg-amber-200">
							Next Board
						</button>
					)}
					<button
						onClick={onReplay}
						className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg hover:bg-amber-200">
						Replay Hand
					</button>
					<button
						onClick={onBack}
						className="rounded-xl bg-white px-5 py-3 text-sm font-black text-emerald-950 shadow-lg hover:bg-emerald-50">
						Back To Board
					</button>
					<button
						onClick={() => {
							onBack()
							onPick()
						}}
						className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-white/20">
						Choose New PBN
					</button>
				</div>
			</div>
		</div>
	)
}

function TableSurface({
	state,
	derived,
	dummy,
	coach,
	seatIsVisible,
	onPlay,
	dispatch,
	onNextBoard,
	presentationMode = false,
	raiseLegalChoices = true,
}) {
	if (state.phase !== 'play') {
		return (
			<AuctionWorkspace
				state={state}
				derived={derived}
				dispatch={dispatch}
				coach={coach}
				presentationMode={presentationMode}
				onNextBoard={onNextBoard}
			/>
		)
	}
	const rotated = rotatedForNorthDeclarer(state.phase, derived.declarer)
	const visualSeats = rotated
		? { top: 'S', left: 'E', right: 'W', bottom: 'N' }
		: { top: 'N', left: 'W', right: 'E', bottom: 'S' }
	const controlledSeats = learnerControlledSeats(state.phase, derived.declarer)
	const completedCount = state.completedTricks.length
	const lastTrickIndex = completedCount - (state.play?.trickComplete ? 2 : 1)
	const lastTrick = lastTrickIndex >= 0 ? state.completedTricks[lastTrickIndex] : null
	const latestWinner =
		state.play?.trickComplete && completedCount > 0
			? state.completedTricks[completedCount - 1]?.winner
			: null
	const visualPlay =
		state.play ? { ...state.play, visualWinner: latestWinner } : null
	const leftSeatVisible = seatIsVisible(visualSeats.left)
	const rightSeatVisible = seatIsVisible(visualSeats.right)
	const opposingHandsVisible =
		seatIsVisible(visualSeats.top) && seatIsVisible(visualSeats.bottom)
	const centreWidth = presentationMode
		? 'clamp(460px, 40vw, 580px)'
		: 'clamp(420px, 36vw, 560px)'
	const sideHandWidth = presentationMode ? '454px' : '414px'
	const concealedWidth = presentationMode ? '174px' : '148px'
	const stageColumns = leftSeatVisible
		? `minmax(${sideHandWidth}, 1.15fr) ${centreWidth} minmax(${concealedWidth}, 0.7fr)`
		: rightSeatVisible
			? `minmax(${concealedWidth}, 0.7fr) ${centreWidth} minmax(${sideHandWidth}, 1.15fr)`
			: `minmax(${concealedWidth}, 1fr) ${centreWidth} minmax(${concealedWidth}, 1fr)`
	const common = (seat, position) => ({
		seat,
		position,
		cards: state.play?.remaining?.[seat] || state.hands[seat],
		originalCards: state.hands[seat],
		visible: seatIsVisible(seat),
		active: (state.visibleSeats || []).includes(seat) && state.phase !== 'play',
		dealer: state.board.dealer,
		vul:
			seat === 'N' || seat === 'S'
				? state.board.vul === 'NS' || state.board.vul === 'All'
				: state.board.vul === 'EW' || state.board.vul === 'All',
		onPlay: state.phase === 'play' && controlledSeats.has(seat) ? onPlay : null,
		play: state.play,
		declarer: derived.declarer,
		dummy,
		openingLeader:
			state.phase === 'play' && state.history.length === 0
				? derived.openingLeader
				: '',
		presentationMode,
		trump: derived.trump,
		raiseLegalChoices,
	})

	return (
		<main
			className={`mx-auto ${
				presentationMode
					? 'h-[100vh] max-w-[1880px] px-8 py-2'
					: 'h-[calc(100dvh-8.125rem)] max-w-[1420px] px-5 py-2'
			}`}>
			<div
				style={{ gridTemplateColumns: stageColumns }}
				className={`player-v3-stage ${opposingHandsVisible ? 'player-v3-opposing-hands' : ''} relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] items-center gap-x-3`}>
				<div className="col-start-2 row-start-1 z-20 self-start justify-self-center">
					<HandPanel {...common(visualSeats.top, 'N')} />
				</div>
				<div className="col-start-1 row-start-2 z-20 self-center justify-self-start">
					<HandPanel {...common(visualSeats.left, 'W')} />
				</div>
				<div className="col-start-3 row-start-2 z-20 self-center justify-self-end">
					<HandPanel {...common(visualSeats.right, 'E')} />
				</div>
				<div className="col-start-2 row-start-3 z-40 flex flex-col items-center gap-1 self-end justify-self-center">
					<HandPanel {...common(visualSeats.bottom, 'S')} />
				</div>
				<div className="col-start-1 row-start-3 z-40 self-end justify-self-start pb-2">
					<PlayerCoachNudge
						coach={coach}
						presentationMode={presentationMode}
						className="player-v3-table-coach"
					/>
				</div>
				<div className="col-start-2 row-start-2 z-10 self-center justify-self-center">
					<StagePanel
						state={state}
						derived={derived}
						dispatch={dispatch}
						visualPlay={visualPlay}
						presentationMode={presentationMode}
						rotated={rotated}
					/>
				</div>
				{state.phase === 'play' && (
					<div className="absolute left-0 top-0 z-10">
						<LastTrickPanel
							trick={lastTrick}
							presentationMode={presentationMode}
							rotated={rotated}
							compact={leftSeatVisible}
						/>
					</div>
				)}
				{state.phase === 'play' && (
					<div className="absolute right-0 top-0 z-10">
						<PlayStatusPanel
							state={state}
							derived={derived}
							settledTrickCount={completedCount}
							presentationMode={presentationMode}
							compact={rightSeatVisible}
						/>
					</div>
				)}
			</div>
		</main>
	)
}

export default function PlayerV2() {
	const [state, dispatch] = useReducer(playerV2Reducer, initialPlayerV2State)
	const [dismissedEndKey, setDismissedEndKey] = useState('')
	const [visibleEndKey, setVisibleEndKey] = useState('')
	const [returnPath, setReturnPath] = useState('')
	const [returnLabel, setReturnLabel] = useState('Back')
	const [presentationMode, setPresentationMode] = useState(false)
	const [presentationNotice, setPresentationNotice] = useState('')
	const [presentationRestoring, setPresentationRestoring] = useState(false)
	const [raiseLegalChoices, setRaiseLegalChoices] = useState(true)
	const [teacherToolsOpen, setTeacherToolsOpen] = useState(false)
	const [feltTheme, setFeltTheme] = useState(() => {
		if (typeof window === 'undefined') return 'green'
		const saved = window.localStorage.getItem(PLAYER_FELT_KEY)
		return FELT_THEMES.some((theme) => theme.key === saved) ? saved : 'green'
	})
	const fileRef = useRef(null)
	const presentButtonRef = useRef(null)
	const presentationSurfaceRef = useRef(null)
	const restorePresentationButtonRef = useRef(null)
	const endResultDialogRef = useRef(null)
	const playerMountedRef = useRef(true)
	const presentationSessionRef = useRef(0)
	const presentationOwnsFullscreenRef = useRef(false)
	const presentationEnterPendingRef = useRef(false)
	const presentationExitPendingRef = useRef(false)
	const audioProgressRef = useRef({ boardIndex: -1, historyLength: 0, completedLength: 0 })
	const derived = getPlayerV2Derived(state)
	const controlledSeats = useMemo(
		() => learnerControlledSeats(state.phase, derived.declarer),
		[state.phase, derived.declarer],
	)
	const coach = usePlayerCoach({
		state,
		derived,
		controlledSeats,
		enabled: !!state.board,
	})
	const dummy = derived.declarer ? partnerOf(derived.declarer) : ''
	const competitionReferences = competitionReferencesFor(state.content, state.board?.board)
	const completedNsScore = derived.score
		? ['N', 'S'].includes(derived.declarer)
			? derived.score.score
			: -derived.score.score
		: null
	const endResult =
		state.phase === 'play' &&
		state.completedTricks.length >= 13 &&
		derived.score &&
		!derived.score.partial
			? {
					score: completedNsScore,
					nsScore: completedNsScore,
					declarerScore: derived.score.score,
					resultText: derived.score.resultText,
					contract: derived.contract,
					declarer: derived.declarer,
					competitionReferences,
				}
			: null
	const endResultKey = endResult
		? `${state.index}:${state.history.length}:${endResult.contract}:${endResult.declarer}:${endResult.score}:${endResult.resultText}`
		: ''
	const showEndResult =
		!!endResult && visibleEndKey === endResultKey && dismissedEndKey !== endResultKey
	const selectedFelt = FELT_THEMES.find((theme) => theme.key === feltTheme) || FELT_THEMES[0]

	useLayoutEffect(() => {
		const documentElement = document.documentElement
		documentElement.classList.add('player-display-active')
		return () => {
			documentElement.classList.remove('player-display-active')
			documentElement.style.removeProperty('--player-display-canvas')
		}
	}, [])

	useLayoutEffect(() => {
		document.documentElement.style.setProperty('--player-display-canvas', selectedFelt.canvas)
	}, [selectedFelt.canvas])

	const onFile = (event) => {
		const file = event.target.files?.[0]
		if (!file) return
		const reader = new FileReader()
		reader.onload = () => {
			const parsed = parsePBN(sanitizePBN(String(reader.result)))
			dispatch({ type: 'LOAD_DEALS', deals: parsed, name: file.name, content: null })
			setRaiseLegalChoices(true)
			setTeacherToolsOpen(false)
			setReturnPath('')
			setReturnLabel('Back')
			if (fileRef.current) fileRef.current.value = ''
		}
		reader.readAsText(file)
	}

	const saveCurrentBoardPbn = async () => {
		if (!state.board || !state.hands) return
		try {
			const parsed = BoardZ.parse(playerStateToBoardShape(state, derived))
			const pbn = await exportBoardPBN(parsed, { dealer4Mode: false })
			const boardNo = parsed.board || state.index + 1
			downloadText(pbn, `ralph-player-board-${boardNo}-${todayFileDate()}.pbn`)
			dispatch({ type: 'SET_STATUS', status: `Downloaded board ${boardNo} as PBN.` })
		} catch (error) {
			console.error('Player PBN export failed', error)
			dispatch({ type: 'SET_STATUS', status: 'PBN export failed. Check the current auction and contract.' })
		}
	}

	const exitPresentation = useCallback(async ({ restoreFocus = true } = {}) => {
		if (presentationExitPendingRef.current) return
		const ownsFullscreen = presentationOwnsFullscreenRef.current
		presentationExitPendingRef.current = true
		presentationSessionRef.current += 1
		setPresentationRestoring(true)
		setPresentationNotice(document.fullscreenElement ? 'Restoring normal view…' : '')
		setTeacherToolsOpen(false)
		const fullscreenResult = ownsFullscreen
			? await exitPlayerFullscreen(document)
			: { ok: true, outcome: 'not-owned' }
		if (!playerMountedRef.current) return
		presentationExitPendingRef.current = false
		setPresentationRestoring(false)
		if (ownsFullscreen && !fullscreenResult.ok && document.fullscreenElement) {
			presentationOwnsFullscreenRef.current = true
			setPresentationMode(true)
			setPresentationNotice('Press Escape to leave browser fullscreen, then restore the normal view.')
			window.setTimeout(() => restorePresentationButtonRef.current?.focus(), 0)
			return
		}
		presentationOwnsFullscreenRef.current = false
		setPresentationMode(false)
		setPresentationNotice('')
		if (restoreFocus) {
			window.setTimeout(() => presentButtonRef.current?.focus(), 0)
		}
	}, [])

	const enterPresentation = useCallback(async () => {
		if (
			!state.board ||
			presentationEnterPendingRef.current ||
			presentationExitPendingRef.current
		) {
			return
		}
		presentationEnterPendingRef.current = true
		const session = presentationSessionRef.current + 1
		presentationSessionRef.current = session
		presentationOwnsFullscreenRef.current = false
		setTeacherToolsOpen(false)
		setPresentationRestoring(false)
		setPresentationNotice('')

		const fullscreenResult = await requestPlayerFullscreen(document)
		if (!playerMountedRef.current || presentationSessionRef.current !== session) {
			presentationEnterPendingRef.current = false
			if (fullscreenResult.ok && fullscreenResult.outcome === 'success') {
				await exitPlayerFullscreen(document)
			}
			return
		}

		const fullscreenWasAcquired = fullscreenResult.ok && fullscreenResult.outcome === 'success'
		presentationOwnsFullscreenRef.current = playerAcquiredFullscreen(
			fullscreenResult,
			document.fullscreenElement,
			document.documentElement,
		)
		if (fullscreenWasAcquired && !presentationOwnsFullscreenRef.current) {
			presentationEnterPendingRef.current = false
			setPresentationMode(false)
			setPresentationNotice('')
			return
		}
		if (presentationOwnsFullscreenRef.current) {
			await new Promise((resolve) => window.requestAnimationFrame(resolve))
			if (!playerMountedRef.current || presentationSessionRef.current !== session) {
				presentationEnterPendingRef.current = false
				return
			}
		}
		presentationEnterPendingRef.current = false
		setPresentationMode(true)
		if (!fullscreenResult.ok) {
			setPresentationNotice(
				'Browser controls could not be hidden; the clean table view is still active.',
			)
		} else if (fullscreenResult.outcome === 'already-active') {
			setPresentationNotice(
				'Fullscreen was already active. Restore changes the table layout; use Escape to leave browser fullscreen.',
			)
		}
		window.setTimeout(() => presentationSurfaceRef.current?.focus({ preventScroll: true }), 0)
	}, [state.board])

	const seatIsVisible = useCallback(
		(seat) => (state.visibleSeats || []).includes(seat),
		[state.visibleSeats],
	)
	const turnSeat = state.play?.turnSeat || ''
	const canAdvanceHidden =
		state.phase === 'play' &&
		!!turnSeat &&
		!!derived.declarer &&
		!controlledSeats.has(turnSeat) &&
		(state.play?.remaining?.[turnSeat] || []).length > 0

	const advanceHiddenHand = useCallback(() => {
		const currentSeat = state.play?.turnSeat
		if (
			state.phase !== 'play' ||
			!currentSeat ||
			!derived.declarer ||
			controlledSeats.has(currentSeat)
		) {
			return
		}
		const trickForChoice = state.play.trickComplete ? [] : state.play.trick
		const card = selectSimpleDefenderCard(
			state.play.remaining,
			trickForChoice,
			currentSeat,
			derived.trump,
		)
		if (!card) return
		primeBridgeAudio()
		dispatch({ type: 'PLAY_CARD', seat: currentSeat, cardId: card.id })
	}, [state.phase, state.play, derived.declarer, derived.trump, controlledSeats])

	const goToBoard = useCallback(
		(index) => {
			if (index < 0 || index >= state.deals.length || index === state.index) return
			dispatch({ type: 'GO_BOARD', index })
			setRaiseLegalChoices(true)
			setTeacherToolsOpen(false)
		},
		[state.deals.length, state.index],
	)

	const replayCurrentHand = useCallback(
		({ confirm = true } = {}) => {
			if (state.phase !== 'play') return
			if (
				confirm &&
				state.history.length > 0 &&
				!window.confirm('Replay this hand from the opening lead?')
			) {
				return
			}
			primeBridgeAudio()
			dispatch({ type: 'START_PLAY' })
			setRaiseLegalChoices(true)
			setTeacherToolsOpen(false)
			setDismissedEndKey('')
			setVisibleEndKey('')
		},
		[state.phase, state.history.length],
	)

	const resetPlayer = useCallback(() => {
		if (
			state.board &&
			!window.confirm('Unload the current PBN and clear the player? Your saved file will not be changed.')
		) {
			return
		}
		dispatch({ type: 'RESET' })
		setTeacherToolsOpen(false)
		void exitPresentation({ restoreFocus: false })
		setReturnPath('')
		setReturnLabel('Back')
	}, [state.board, exitPresentation])

	useEffect(() => {
		window.localStorage.setItem(PLAYER_FELT_KEY, feltTheme)
	}, [feltTheme])

	useEffect(() => {
		if (
			state.phase !== 'auction' ||
			derived.auctionView !== 'practice' ||
			state.auctionIntroPending ||
			state.manualContractMode
		) {
			return undefined
		}
		const seat = derived.nextAuctionSeat
		if (!seat || seat === 'S' || state.practiceAuction?.terminal) return undefined
		const revision = Number(state.practiceAuction?.revision) || 0
		const choice = choosePracticeAutoCall({
			seat,
			hand: state.hands?.[seat] || [],
			dealer: state.practiceAuction?.dealer || state.board?.dealer || 'N',
			calls: state.practiceAuction?.calls || [],
			recordedCalls: state.recordedAuction?.calls || [],
		})
		if (!choice) return undefined
		const timer = window.setTimeout(() => {
			dispatch({
				type: 'AUCTION_AUTO_CALL',
				call: choice.call,
				expectedSeat: seat,
				expectedRevision: revision,
				source: choice.source,
			})
		}, presentationMode ? 900 : 600)
		return () => window.clearTimeout(timer)
	}, [
		state.phase,
		state.practiceAuction,
		state.recordedAuction,
		state.hands,
		state.board,
		state.auctionIntroPending,
		state.manualContractMode,
		derived.auctionView,
		derived.nextAuctionSeat,
		presentationMode,
	])

	useEffect(() => {
		const raw = window.sessionStorage.getItem(PLAYER_HANDOFF_KEY)
		if (!raw) return
		try {
			const payload = JSON.parse(raw)
			const parsed = parsePBN(sanitizePBN(payload.pbn || ''))
			if (parsed.length) {
				dispatch({
					type: 'LOAD_DEALS',
					deals: parsed,
					name: payload.name || 'Generator handoff',
					startIndex: payload.startIndex,
					content: payload.content || null,
				})
				setRaiseLegalChoices(true)
				setTeacherToolsOpen(false)
				setReturnPath(payload.sourcePath || '')
				setReturnLabel(payload.returnLabel || 'Back')
			}
		} catch (error) {
			console.error('Player handoff failed', error)
		} finally {
		window.sessionStorage.removeItem(PLAYER_HANDOFF_KEY)
		}
	}, [])

	useEffect(() => {
		const onFullscreenChange = () => {
			if (document.fullscreenElement) return
			if (presentationEnterPendingRef.current) {
				presentationEnterPendingRef.current = false
				presentationOwnsFullscreenRef.current = false
				presentationSessionRef.current += 1
				setPresentationMode(false)
				setPresentationNotice('')
				setPresentationRestoring(false)
				setTeacherToolsOpen(false)
				return
			}
			if (!presentationOwnsFullscreenRef.current) return
			presentationOwnsFullscreenRef.current = false
			presentationSessionRef.current += 1
			setPresentationMode(false)
			setPresentationNotice('')
			setPresentationRestoring(false)
			setTeacherToolsOpen(false)
			window.setTimeout(() => presentButtonRef.current?.focus(), 0)
		}
		document.addEventListener('fullscreenchange', onFullscreenChange)
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
	}, [])

	useEffect(() => {
		playerMountedRef.current = true
		return () => {
			playerMountedRef.current = false
			presentationSessionRef.current += 1
			const ownsDocumentFullscreen = presentationOwnsFullscreenRef.current
			presentationOwnsFullscreenRef.current = false
			if (ownsDocumentFullscreen) void exitPlayerFullscreen(document)
		}
	}, [])

	useEffect(() => {
		if (!endResultKey) {
			setVisibleEndKey('')
			setDismissedEndKey('')
			return undefined
		}
		setVisibleEndKey('')
		const timer = window.setTimeout(() => setVisibleEndKey(endResultKey), 900)
		return () => window.clearTimeout(timer)
	}, [endResultKey])

	useEffect(() => {
		if (!showEndResult) return undefined
		const timer = window.setTimeout(() => {
			endResultDialogRef.current?.focus({ preventScroll: true })
			endResultDialogRef.current?.scrollTo({ top: 0 })
		}, 0)
		return () => window.clearTimeout(timer)
	}, [showEndResult])

	useEffect(() => {
		const progress = audioProgressRef.current
		const historyLength = state.history.length
		const completedLength = state.completedTricks.length
		if (progress.boardIndex !== state.index) {
			audioProgressRef.current = {
				boardIndex: state.index,
				historyLength,
				completedLength,
			}
			return undefined
		}
		if (state.phase !== 'play') {
			audioProgressRef.current = {
				boardIndex: state.index,
				historyLength,
				completedLength,
			}
			return undefined
		}

		let resultTimer
		if (historyLength > progress.historyLength) playCardSound()
		if (completedLength > progress.completedLength) {
			const trick = state.completedTricks[completedLength - 1]
			const declarerWon =
				!!trick?.winner && !!derived.declarer && !isDefender(trick.winner, derived.declarer)
			resultTimer = window.setTimeout(() => {
				playTrickResultSound(declarerWon)
			}, 180)
		}
		audioProgressRef.current = {
			boardIndex: state.index,
			historyLength,
			completedLength,
		}
		return () => {
			if (resultTimer) window.clearTimeout(resultTimer)
		}
	}, [
		state.index,
		state.phase,
		state.history.length,
		state.completedTricks,
		derived.declarer,
	])

	useEffect(() => {
		if (state.phase !== 'play') return
		if (state.autoPlayPaused) return
		const turnSeat = state.play?.turnSeat
		if (!turnSeat || !derived.declarer || controlledSeats.has(turnSeat)) return
		const trickForChoice = state.play.trickComplete ? [] : state.play.trick
		const card = selectSimpleDefenderCard(
			state.play.remaining,
			trickForChoice,
			turnSeat,
			derived.trump,
		)
		if (!card) return
		const timer = setTimeout(() => {
			dispatch({ type: 'PLAY_CARD', seat: turnSeat, cardId: card.id })
		}, state.play.trickComplete ? 1600 : 700)
		return () => clearTimeout(timer)
	}, [
		state.phase,
		state.autoPlayPaused,
		state.play?.turnSeat,
		state.play?.trick,
		state.play?.remaining,
		state.play?.trickComplete,
		derived.declarer,
		derived.trump,
		controlledSeats,
	])

	const onPlay = (seat, cardId) => {
		primeBridgeAudio()
		dispatch({ type: 'PLAY_CARD', seat, cardId })
	}

	useEffect(() => {
		const onKeyDown = (event) => {
			if (event.repeat && (event.key === 'Escape' || event.key.toLowerCase() === 'p')) return
			if (showEndResult) {
				if (event.key === 'Escape') {
					event.preventDefault()
					setDismissedEndKey(endResultKey)
				}
				return
			}
			if (event.key === 'Escape' && presentationMode) {
				event.preventDefault()
				void exitPresentation()
				return
			}
			const interactiveTarget = event.target?.closest?.(
				'button, a, input, select, textarea, [contenteditable="true"]',
			)
			if (interactiveTarget) return
			if (!state.board) return
			if (state.auctionIntroPending) return
			if (
				event.key === 'Enter' &&
				state.phase !== 'play' &&
				derived.auctionView === 'recorded'
			) {
				event.preventDefault()
				dispatch({ type: 'AUCTION_NEXT' })
				return
			}
			if (event.key === 'ArrowRight') {
				if (state.phase === 'play') {
					event.preventDefault()
					advanceHiddenHand()
				} else if (derived.auctionView === 'recorded') {
					event.preventDefault()
					dispatch({ type: 'AUCTION_NEXT' })
				}
			}
			const rank = rankFromKey(event)
			if (state.phase === 'play' && rank) {
				const turnSeat = state.play?.turnSeat
				const legalCards =
					turnSeat && controlledSeats.has(turnSeat)
						? legalCardsForTurn(state.play, turnSeat)
						: []
				const matchingCards = legalCards.filter((card) => card.rank === rank)
				if (turnSeat && matchingCards.length === 1) {
					event.preventDefault()
					primeBridgeAudio()
					dispatch({ type: 'PLAY_CARD', seat: turnSeat, cardId: matchingCards[0].id })
				}
			}
			if (event.key === 'ArrowLeft') {
				if (state.phase === 'play') {
					event.preventDefault()
					dispatch({ type: 'UNDO_CARD' })
				} else if (derived.auctionView === 'recorded') {
					event.preventDefault()
					dispatch({ type: 'AUCTION_PREV' })
				}
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault()
				dispatch({ type: 'REVEAL_PARTNER' })
			}
			if (event.key === ' ') {
				if (state.phase !== 'play' && derived.auctionView === 'recorded') {
					event.preventDefault()
					dispatch({ type: 'AUCTION_ALL' })
				} else if (state.phase === 'play') {
					event.preventDefault()
					const allVisible = SEATS.every((seat) => state.visibleSeats.includes(seat))
					const defaultVisible = [
						'S',
						derived.declarer === 'N' ? 'N' : '',
						state.history.length ? dummy : '',
					].filter(Boolean)
					dispatch({ type: 'SET_VISIBLE_SEATS', seats: allVisible ? defaultVisible : SEATS })
				}
			}
			if (event.key.toLowerCase() === 'r') {
				if (state.phase === 'play') {
					event.preventDefault()
					replayCurrentHand()
				} else if (derived.auctionView === 'recorded') {
					event.preventDefault()
					dispatch({ type: 'AUCTION_REPLAY' })
				}
			}
			if (event.key.toLowerCase() === 'p') {
				event.preventDefault()
				if (presentationMode) void exitPresentation()
				else void enterPresentation()
			}
			if (event.key === 'PageUp' || event.key === '[') {
				event.preventDefault()
				goToBoard(state.index - 1)
			}
			if (event.key === 'PageDown' || event.key === ']') {
				event.preventDefault()
				goToBoard(state.index + 1)
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [
		state.board,
		state.auctionIntroPending,
		state.phase,
		state.play,
		state.visibleSeats,
		state.history.length,
		state.index,
		dummy,
		derived.declarer,
		derived.auctionView,
		controlledSeats,
		advanceHiddenHand,
		goToBoard,
		replayCurrentHand,
		presentationMode,
		enterPresentation,
		exitPresentation,
		showEndResult,
		endResultKey,
	])

	return (
		<div
			ref={presentationSurfaceRef}
			tabIndex={-1}
			style={{ backgroundColor: selectedFelt.canvas, backgroundImage: selectedFelt.background }}
			className={`${presentationMode ? 'h-[100vh]' : 'h-[100dvh]'} overflow-hidden text-slate-900 outline-none ${
				presentationMode ? 'player-v3-present' : ''
			}`}>
			<EndResultModal
				result={showEndResult ? endResult : null}
				onBack={() => setDismissedEndKey(endResultKey)}
				onNext={() => {
					setDismissedEndKey(endResultKey)
					goToBoard(state.index + 1)
				}}
				onPick={() => fileRef.current?.click()}
				onReplay={() => replayCurrentHand({ confirm: false })}
				hasNextBoard={state.index < state.deals.length - 1}
				dialogRef={endResultDialogRef}
			/>
			<NoAuctionIntro
				state={state}
				dispatch={dispatch}
				onOpenManualContract={() => dispatch({ type: 'OPEN_MANUAL_CONTRACT' })}
			/>
			<TeacherToolsDrawer
				open={teacherToolsOpen && !presentationMode}
				onClose={() => setTeacherToolsOpen(false)}
				state={state}
				dispatch={dispatch}
				feltTheme={feltTheme}
				onFeltThemeChange={setFeltTheme}
				raiseLegalChoices={raiseLegalChoices}
				onToggleLegalChoices={() => setRaiseLegalChoices((current) => !current)}
				presentationMode={presentationMode}
			/>
			<input ref={fileRef} type="file" accept=".pbn,text/plain" onChange={onFile} className="hidden" />
			{!presentationMode && (
				<header className="h-10 border-b border-emerald-900/40 bg-white/95">
					<div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
						<div>
							<div className="flex items-center gap-2 text-base font-black">
								Bridge Hand Player
								<span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-900">
									V3 preview
								</span>
							</div>
							<div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
								<span>{state.selectedName || 'No file loaded'}</span>
								{state.content?.kind === 'competition' && (
									<>
										<span aria-hidden="true">·</span>
										<span className="font-black text-sky-800">Free competition replay</span>
										{state.content.sourcePageUrl && (
											<a
												href={state.content.sourcePageUrl}
												target="_blank"
												rel="noreferrer"
												className="text-sky-700 underline underline-offset-2">
												Source
											</a>
										)}
									</>
								)}
							</div>
						</div>
						<div className="flex items-center gap-2">
							{returnPath && (
								<Link to={returnPath} className="text-sm font-semibold text-sky-700 hover:underline">
									{returnLabel}
								</Link>
							)}
							<Link to="/" className="text-sm font-semibold text-sky-700 hover:underline">
								Home
							</Link>
							<button
								ref={presentButtonRef}
								onClick={enterPresentation}
								disabled={!state.board}
								title="Hide controls and present the table fullscreen"
								className="rounded-md bg-amber-300 px-3 py-1.5 text-sm font-black text-slate-950 disabled:opacity-40">
								Present table
							</button>
							<button
								onClick={resetPlayer}
								className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-800">
								Unload PBN
							</button>
						</div>
					</div>
				</header>
			)}
			{presentationMode && state.board && (
				<PresentationRestore
					onRestore={() => void exitPresentation()}
					notice={presentationNotice}
					buttonRef={restorePresentationButtonRef}
					restoring={presentationRestoring}
				/>
			)}

			{!state.board ? (
				<FilePrompt onPick={() => fileRef.current?.click()} />
			) : (
				<>
					{!presentationMode && (
						<div className="px-6 pt-2">
							<Controls
								state={state}
								derived={derived}
								dispatch={dispatch}
								onPick={() => fileRef.current?.click()}
								onSavePbn={saveCurrentBoardPbn}
								returnPath={returnPath}
								returnLabel={returnLabel}
								onPreviousBoard={() => goToBoard(state.index - 1)}
								onNextBoard={() => goToBoard(state.index + 1)}
								onAdvanceHidden={advanceHiddenHand}
								canAdvanceHidden={canAdvanceHidden}
								onReplayHand={() => replayCurrentHand()}
								onToggleTeacherTools={() => setTeacherToolsOpen((current) => !current)}
							/>
						</div>
					)}
					<TableSurface
						state={state}
						derived={derived}
						dummy={dummy}
						coach={coach}
						seatIsVisible={seatIsVisible}
						onPlay={onPlay}
						dispatch={dispatch}
						onNextBoard={() => goToBoard(state.index + 1)}
						presentationMode={presentationMode}
						raiseLegalChoices={raiseLegalChoices}
					/>
				</>
			)}
		</div>
	)
}
