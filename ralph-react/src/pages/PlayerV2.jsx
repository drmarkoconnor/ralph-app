import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { parsePBN, sanitizePBN } from '../lib/pbn'
import { BoardZ } from '../schemas/board'
import { exportBoardPBN } from '../pbn/export'
import {
	SEATS,
	auctionRows,
	computeDuplicateScore,
	handHcp,
	isDefender,
	isSeatVul,
	orderHandForDisplay,
	partnerOf,
	selectSimpleDefenderCard,
	seatName,
	suitSymbol,
} from '../player-v2/bridgeV2'
import {
	getPlayerV2Derived,
	initialPlayerV2State,
	playerV2Reducer,
} from '../player-v2/playerV2Reducer'

const PLAYER_HANDOFF_KEY = 'ralph-player-handoff-v1'
const PLAYER_FELT_KEY = 'ralph-player-felt-v1'
const FELT_THEMES = [
	{
		key: 'green',
		label: 'Classic green',
		swatch: '#0b6b43',
		background:
			'radial-gradient(circle at 50% 42%, #147b4c 0%, #075236 48%, #03281d 100%)',
	},
	{
		key: 'blue',
		label: 'Tournament blue',
		swatch: '#155e75',
		background:
			'radial-gradient(circle at 50% 42%, #19718a 0%, #104b61 48%, #082b38 100%)',
	},
	{
		key: 'burgundy',
		label: 'Burgundy',
		swatch: '#7f1d3b',
		background:
			'radial-gradient(circle at 50% 42%, #96304f 0%, #661c37 48%, #340d20 100%)',
	},
	{
		key: 'charcoal',
		label: 'Charcoal',
		swatch: '#334155',
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
		</div>
	)
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
			className={`player-v3-card relative flex shrink-0 flex-col items-start justify-between overflow-hidden rounded-lg border-2 bg-white font-black shadow-[0_12px_20px_rgba(0,0,0,0.4)] ring-1 ring-slate-100 transition-[transform,box-shadow,filter] duration-150 ${
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
					? `cursor-pointer ring-4 ring-amber-300 shadow-[0_20px_30px_rgba(0,0,0,0.46)] hover:brightness-105 ${
							raisePlayable ? playableMotion : ''
						}`
					: disabled
						? 'cursor-default brightness-[0.98] saturate-95'
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

function CardBack({ overlap = false, side = false, presentationMode = false }) {
	return (
		<div
			className={`player-v3-card-back shrink-0 rounded-lg border border-slate-400 bg-[repeating-linear-gradient(135deg,#111827_0,#111827_4px,#374151_4px,#374151_8px)] shadow-[0_10px_20px_rgba(0,0,0,0.38)] ring-1 ring-white/35 ${
				presentationMode ? 'h-[166px] w-[118px]' : 'h-[144px] w-[102px]'
			} ${
				overlap
					? presentationMode
						? side
							? '-mt-[88px] first:mt-0'
							: '-ml-[62px] first:ml-0'
						: side
							? '-mt-[75px] first:mt-0'
							: '-ml-[50px] first:ml-0'
					: ''
			}`}>
			<div
				className={`player-v3-card-back-inner ${presentationMode ? 'h-[146px]' : 'h-[124px]'} m-2 rounded-md border border-white/30`}
			/>
		</div>
	)
}

function HiddenHand({ count = 13, split = false, presentationMode = false }) {
	const indexes = Array.from({ length: count }, (_, index) => index)
	const rows = split ? [indexes.slice(0, 6), indexes.slice(6)] : [indexes]
	return (
		<div className={`flex items-center justify-center ${split ? 'flex-col gap-2' : ''}`}>
			{rows.map((row, rowIndex) => (
				<div key={rowIndex} className="flex justify-center">
					{row.map((index) => (
						<CardBack key={index} overlap presentationMode={presentationMode} />
					))}
				</div>
			))}
		</div>
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

function primeBridgeAudio() {
	if (typeof window === 'undefined') return null
	const AudioContextCtor = window.AudioContext || window.webkitAudioContext
	if (!AudioContextCtor) return null
	if (!bridgeAudioContext) bridgeAudioContext = new AudioContextCtor()
	if (bridgeAudioContext.state === 'suspended') {
		bridgeAudioContext.resume().catch(() => {})
	}
	return bridgeAudioContext
}

function playBridgeNotes(notes, { type = 'sine', duration = 0.1, gap = 0.035, gain = 0.035 } = {}) {
	const context = primeBridgeAudio()
	if (!context) return
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
	const playableMotion = playableMotionBySeat[seat] || ''
	const legalCardIds = useMemo(
		() => new Set(legalCardsForTurn(play, seat).map((card) => card.id)),
		[play, seat],
	)

	return (
		<section
			className={`relative flex w-fit max-w-full flex-col items-center justify-center rounded-2xl transition-[background-color,box-shadow,padding,transform] duration-150 ${
				isTurn
					? presentationMode
						? 'z-30 scale-[1.015] bg-amber-200/22 p-2.5 ring-4 ring-amber-300 shadow-[0_0_46px_rgba(251,191,36,0.34)]'
						: 'z-30 scale-[1.015] bg-amber-200/24 p-2 ring-4 ring-amber-300 shadow-[0_0_40px_rgba(251,191,36,0.32)]'
					: presentationMode
						? 'p-1'
						: 'p-0.5'
			} ${
				active && !isTurn ? 'ring-4 ring-amber-300/80' : ''
			} ${isPartnership ? 'shadow-[0_0_35px_rgba(14,165,233,0.16)]' : ''}`}>
			<div className="mb-0.5 text-center">
				<SeatLabel
					seat={seat}
					dealer={dealer}
					vul={vul}
					role={role}
					active={active || isTurn}
					presentationMode={presentationMode}
				/>
				{isTurn && (
					<div
						role="status"
						aria-live="polite"
						className={`${presentationMode ? 'text-base' : 'text-sm'} mt-1 rounded-full bg-amber-300 px-4 py-1 font-black uppercase tracking-wide text-slate-950 shadow-lg`}>
						{seatName(seat)} to play
					</div>
				)}
				{openingLeader === seat && (
					<div
						className={`${presentationMode ? 'text-base' : 'text-xs'} mt-1 font-black uppercase tracking-wide text-amber-200`}>
						Opening lead
					</div>
				)}
			</div>
			<div className="flex items-center">
				{visible ? (
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
				) : (
					<HiddenHand
						count={(cards || []).length}
						split={isSideSeat}
						presentationMode={presentationMode}
					/>
				)}
			</div>
			<footer
				className={`${presentationMode ? 'text-sm' : 'text-[11px]'} mt-1 rounded bg-slate-950 px-2 py-0.5 font-black text-white`}>
				HCP {visible ? handHcp(originalCards || cards) : '?'}
			</footer>
		</section>
	)
}

function AuctionPanel({ auction, cursor, dealer, contract, declarer }) {
	const shown = (auction || []).slice(0, cursor)
	const { columns, rows } = auctionRows(shown, dealer)
	return (
		<section className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
			<div className="mb-1 flex items-center justify-between">
				<div>
					<h2 className="text-sm font-bold text-slate-900">Auction</h2>
					<p className="text-[11px] font-medium text-slate-500">Dealer {dealer}</p>
				</div>
				<div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
					{contract || 'No contract'} {declarer ? `by ${declarer}` : ''}
				</div>
			</div>
			<table className="w-full table-fixed text-center text-sm">
				<thead>
					<tr>
						{columns.map((seat) => (
							<th key={seat} className="border-b border-slate-100 py-0.5 text-xs text-slate-500">
								{seat}
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
										<td key={seat} className="py-0.5">
											<span
												className={`inline-flex min-h-6 min-w-10 items-center justify-center rounded-md px-2 text-sm font-bold ${
													isLast
														? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-300'
														: /^(P|PASS)$/i.test(call)
															? 'bg-slate-50 text-slate-500'
															: 'bg-sky-50 text-sky-900'
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
							<td colSpan={4} className="py-5 text-sm text-slate-400">
								No calls shown yet
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</section>
	)
}

function BiddingEditor({ dispatch }) {
	const [level, setLevel] = useState('1')
	const [strain, setStrain] = useState('S')
	return (
		<section className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
			<div className="mb-1 flex items-center justify-between">
				<h2 className="text-sm font-bold text-slate-900">Change Auction</h2>
				<button
					onClick={() => dispatch({ type: 'AUCTION_RESTORE_PBN' })}
					className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
					Restore PBN
				</button>
			</div>
			<div className="grid grid-cols-[1fr_1fr_1fr_0.8fr_1fr_auto] gap-1">
				{['P', 'X', 'XX'].map((call) => (
					<button
						key={call}
						onClick={() => dispatch({ type: 'AUCTION_APPEND_CALL', call })}
						className="rounded-md bg-slate-900 px-2 py-1.5 text-xs font-black text-white hover:bg-slate-800">
						{call === 'P' ? 'Pass' : call}
					</button>
				))}
				<select
					value={level}
					onChange={(event) => setLevel(event.target.value)}
					className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-xs font-black">
					{['1', '2', '3', '4', '5', '6', '7'].map((item) => (
						<option key={item}>{item}</option>
					))}
				</select>
				<select
					value={strain}
					onChange={(event) => setStrain(event.target.value)}
					className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-xs font-black">
					{['C', 'D', 'H', 'S', 'NT'].map((item) => (
						<option key={item}>{item}</option>
					))}
				</select>
				<button
					onClick={() => dispatch({ type: 'AUCTION_APPEND_CALL', call: `${level}${strain}` })}
					className="rounded-md bg-sky-700 px-2.5 py-1.5 text-xs font-black text-white hover:bg-sky-800">
					Bid
				</button>
			</div>
		</section>
	)
}

function StagePanel({ state, derived, dispatch, visualPlay, presentationMode = false }) {
	if (state.phase === 'play') {
		return <TrickPanel play={visualPlay || state.play} presentationMode={presentationMode} />
	}

	return (
		<div
			className={`player-v3-auction grid gap-1 ${presentationMode ? 'w-[410px]' : 'w-[360px]'}`}>
			<div className="rounded-lg border border-sky-200 bg-sky-50 p-1.5">
				<div className="flex items-center justify-between gap-2">
					<div>
						<h2 className="text-sm font-black text-slate-900">Bidding Layer</h2>
						<p className="mt-0.5 text-[11px] font-medium leading-tight text-slate-600">
							Step, reveal, then confirm.
						</p>
					</div>
					<div className="rounded-md bg-white px-2 py-1 text-xs font-bold text-sky-900 shadow-sm">
						{state.auctionCursor}/{derived.auctionCalls.length || 0} calls
					</div>
				</div>
				<div className="mt-1 grid grid-cols-3 gap-1">
					<button
						disabled={!derived.auctionCalls.length}
						onClick={() => dispatch({ type: 'AUCTION_REPLAY' })}
						className="rounded-md border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-sky-900 disabled:opacity-40">
						Replay
					</button>
					<button
						disabled={
							!derived.auctionCalls.length ||
							state.auctionCursor >= derived.auctionCalls.length
						}
						onClick={() => dispatch({ type: 'AUCTION_NEXT' })}
						className="rounded-md border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-sky-900 disabled:opacity-40">
						Next
					</button>
					<button
						disabled={!derived.auctionCalls.length}
						onClick={() => dispatch({ type: 'AUCTION_ALL' })}
						className="rounded-md border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-sky-900 disabled:opacity-40">
						Show All
					</button>
				</div>
			</div>
			<AuctionPanel
				auction={derived.auctionCalls}
				cursor={state.auctionCursor}
				dealer={state.auction?.dealer || state.board.dealer}
				contract={derived.contract}
				declarer={derived.declarer}
			/>
			<BiddingEditor dispatch={dispatch} />
		</div>
	)
}

function TrickCardSlot({ seat, trick, winner, size = 'md' }) {
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
	const rotateClass = seat === 'E' ? 'rotate-6' : seat === 'W' ? '-rotate-6' : ''
	if (!item) {
		return (
			<div
				className={`${dims.card} ${dims.radius} border-2 border-dashed border-white/28 bg-white/8 shadow-inner`}
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
			className={`relative ${dims.card} ${dims.radius} ${rotateClass} ${borderClass} flex items-center justify-center overflow-hidden border-2 bg-white ${suitClass} ${
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
			<div className={`absolute left-1.5 top-1 ${dims.suit} font-black`}>
				{suitSymbol(item.card.suit)}
			</div>
			<div className={`absolute bottom-1 right-1.5 ${dims.suit} rotate-180 font-black`}>
				{suitSymbol(item.card.suit)}
			</div>
			<div className={`${dims.rank} font-black leading-none drop-shadow-sm`}>
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
}) {
	const played = (trick || []).length
	const large = size === 'lg'
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
				<TrickCardSlot seat="N" trick={trick} winner={winner} size={size} />
			</div>
			<div className={`absolute top-1/2 -translate-y-1/2 ${large ? 'right-6' : 'right-5'}`}>
				<TrickCardSlot seat="E" trick={trick} winner={winner} size={size} />
			</div>
			<div className={`absolute left-1/2 -translate-x-1/2 ${large ? 'bottom-6' : 'bottom-5'}`}>
				<TrickCardSlot seat="S" trick={trick} winner={winner} size={size} />
			</div>
			<div className={`absolute top-1/2 -translate-y-1/2 ${large ? 'left-6' : 'left-5'}`}>
				<TrickCardSlot seat="W" trick={trick} winner={winner} size={size} />
			</div>
			{showStatus && (
				<div
					className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-300 bg-slate-950 text-center font-black uppercase leading-tight tracking-wide text-amber-100 ${
						large ? 'h-24 w-24 px-2 text-sm' : 'h-16 w-16 text-[9px]'
					}`}>
					{winner ? `Won by ${winner}` : turnSeat ? `Turn ${turnSeat}` : `${played}/4`}
				</div>
			)}
		</div>
	)
}

function TrickPanel({ play, presentationMode = false }) {
	const trick = play?.trick || []
	const winner = play?.visualWinner || null
	return (
		<section
			className={`player-v3-trick-panel flex flex-col rounded-2xl border-2 border-amber-400 bg-emerald-950 p-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.34)] ${
				presentationMode ? 'w-[390px]' : 'w-[328px]'
			}`}>
			<div
				className={`player-v3-trick-cross mx-auto ${presentationMode ? 'h-[368px] w-[368px]' : 'h-[306px] w-[306px]'}`}>
				<CrossTrick
					trick={trick}
					winner={winner}
					turnSeat={play?.turnSeat}
					contract={null}
					showContract={false}
					size={presentationMode ? 'lg' : 'md'}
				/>
			</div>
		</section>
	)
}

function LastTrickPanel({ trick, presentationMode = false }) {
	return (
		<aside
			className={`rounded-2xl border-2 border-amber-400 bg-emerald-950 p-2 text-white shadow-2xl ${
				presentationMode ? 'w-[254px]' : 'w-[238px]'
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
			<div className="h-[198px] w-full">
				{trick ? (
					<CrossTrick
						trick={trick.cards}
						winner={trick.winner}
						turnSeat={null}
						size="sm"
						showStatus={false}
					/>
				) : (
					<div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-white/28 bg-white/8 text-center text-xs font-bold text-emerald-100">
						No previous trick
					</div>
				)}
			</div>
		</aside>
	)
}

function PlayStatusPanel({ state, derived, settledTrickCount, presentationMode = false }) {
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
			className={`rounded-2xl border-2 border-amber-400 bg-emerald-950 p-3 text-white shadow-2xl ${
				presentationMode ? 'w-[254px]' : 'w-[238px]'
			}`}>
			<div className="flex items-start justify-between gap-2">
				<div>
					<div
						className={`${presentationMode ? 'text-base' : 'text-xs'} font-black uppercase tracking-wide text-amber-100`}>
						Contract
					</div>
					<div className="text-[44px] font-black leading-none text-white">
						{derived.contract || '-'}
					</div>
					<div className={`${presentationMode ? 'text-base' : 'text-xs'} mt-1 font-bold text-emerald-100`}>
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
		</aside>
	)
}

function ManualContractControls({ manual, dispatch }) {
	return (
		<div className="grid grid-cols-4 gap-2.5">
			<select
				value={manual.declarer}
				onChange={(event) =>
					dispatch({ type: 'SET_MANUAL_CONTRACT', field: 'declarer', value: event.target.value })
				}
				className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold">
				<option value="">Dec</option>
				{SEATS.map((seat) => (
					<option key={seat}>{seat}</option>
				))}
			</select>
			<select
				value={manual.level}
				onChange={(event) =>
					dispatch({ type: 'SET_MANUAL_CONTRACT', field: 'level', value: event.target.value })
				}
				className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold">
				<option value="">Lvl</option>
				{['1', '2', '3', '4', '5', '6', '7'].map((level) => (
					<option key={level}>{level}</option>
				))}
			</select>
			<select
				value={manual.strain}
				onChange={(event) =>
					dispatch({ type: 'SET_MANUAL_CONTRACT', field: 'strain', value: event.target.value })
				}
				className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold">
				<option value="">Str</option>
				{['C', 'D', 'H', 'S', 'NT'].map((strain) => (
					<option key={strain}>{strain}</option>
				))}
			</select>
			<select
				value={manual.dbl}
				onChange={(event) =>
					dispatch({ type: 'SET_MANUAL_CONTRACT', field: 'dbl', value: event.target.value })
				}
				className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold">
				<option value="">Dbl</option>
				<option value="X">X</option>
				<option value="XX">XX</option>
			</select>
		</div>
	)
}

function Controls({
	state,
	derived,
	dispatch,
	onPick,
	onSavePbn,
	returnPath,
	onPreviousBoard,
	onNextBoard,
	onAdvanceHidden,
	canAdvanceHidden,
	onReplayHand,
	raiseLegalChoices,
	onToggleLegalChoices,
}) {
	const hasAuction = derived.auctionCalls.length > 0
	return (
		<aside className="mx-auto flex h-16 w-full max-w-[1420px] items-center gap-3 overflow-visible rounded-xl border border-white/50 bg-white/90 p-2 shadow-2xl backdrop-blur">
			<div className="flex w-[210px] shrink-0 items-center justify-between gap-1.5">
				<Link to="/player/help" className="text-xs font-semibold text-sky-700 hover:underline">
					Guide
				</Link>
				{returnPath && (
					<Link to={returnPath} className="rounded-md bg-white px-2 py-1 text-xs font-semibold shadow-sm">
						Back
					</Link>
				)}
				<button onClick={onPick} className="rounded-md bg-white px-2 py-1 text-xs font-semibold shadow-sm">
					Load PBN
				</button>
				<button
					onClick={onSavePbn}
					disabled={!state.board}
					className="rounded-md bg-white px-2 py-1 text-xs font-semibold shadow-sm disabled:opacity-40">
					Save PBN
				</button>
			</div>
			<div className="w-[175px] shrink-0">
				<div className="text-xs font-bold uppercase tracking-wide text-slate-500">Board</div>
				<div className="flex items-center gap-1">
					<button
						onClick={onPreviousBoard}
						disabled={state.index <= 0}
						aria-label="Previous board"
						className="h-7 w-7 rounded-md border border-slate-200 bg-white text-sm font-black disabled:opacity-30">
						‹
					</button>
					<div className="min-w-0 flex-1 text-center text-sm font-bold text-slate-900">
						{state.board?.board || state.index + 1} of {state.deals.length || 0}
					</div>
					<button
						onClick={onNextBoard}
						disabled={state.index >= state.deals.length - 1}
						aria-label="Next board"
						className="h-7 w-7 rounded-md border border-slate-200 bg-white text-sm font-black disabled:opacity-30">
						›
					</button>
				</div>
				<div className="text-xs text-slate-500">
					Dealer {state.board?.dealer || '-'} · Vul {state.board?.vul || '-'}
				</div>
			</div>
			<div className="w-[170px] shrink-0">
				<div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
					Show Hands
				</div>
				<SeatVisibilityToggles visibleSeats={state.visibleSeats} dispatch={dispatch} />
			</div>
			{state.phase !== 'play' ? (
				<div className="w-[270px] shrink-0">
					<div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
						Contract
					</div>
					<ManualContractControls manual={state.manualContract} dispatch={dispatch} />
				</div>
			) : (
				<div className="w-[140px] shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-white">
					<div className="text-[10px] font-black uppercase tracking-wide text-slate-300">Contract</div>
					<div className="text-lg font-black leading-none">
						{derived.contract} by {derived.declarer}
					</div>
				</div>
			)}
			{state.phase !== 'play' && (
				<div className="grid w-[150px] shrink-0 grid-cols-3 gap-1.5">
					<button
						disabled={!hasAuction || state.auctionCursor <= 0}
						onClick={() => dispatch({ type: 'AUCTION_PREV' })}
						className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold disabled:opacity-40">
						Back
					</button>
					<button
						disabled={!hasAuction || state.auctionCursor >= derived.auctionCalls.length}
						onClick={() => dispatch({ type: 'AUCTION_NEXT' })}
						className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold disabled:opacity-40">
						Next
					</button>
					<button
						disabled={!hasAuction}
						onClick={() => dispatch({ type: 'AUCTION_ALL' })}
						className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold disabled:opacity-40">
						All
					</button>
				</div>
			)}
			{state.phase === 'play' && (
				<div className="grid w-[400px] shrink-0 grid-cols-6 gap-1.5">
					<button
						onClick={() => dispatch({ type: 'UNDO_CARD' })}
						disabled={!state.history.length}
						className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold disabled:opacity-40">
						Undo
					</button>
					<button
						onClick={() => dispatch({ type: 'UNDO_TRICK' })}
						disabled={!state.history.length}
						className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold disabled:opacity-40">
						Trick
					</button>
					<button
						onClick={() => dispatch({ type: 'SET_AUTO_PLAY_PAUSED', paused: !state.autoPlayPaused })}
						className={`rounded-md border px-2 py-2 text-xs font-semibold ${
							state.autoPlayPaused
								? 'border-amber-200 bg-amber-50 text-amber-900'
								: 'border-slate-200 bg-white text-slate-800'
						}`}>
						{state.autoPlayPaused ? 'Start auto' : 'Stop auto'}
					</button>
					<button
						onClick={onAdvanceHidden}
						disabled={!canAdvanceHidden}
						title="Play the lowest legal card from the hidden hand"
						className="rounded-md border border-amber-300 bg-amber-50 px-1 py-2 text-xs font-semibold text-amber-950 disabled:opacity-40">
						Hidden card
					</button>
					<button
						onClick={onReplayHand}
						className="rounded-md border border-sky-200 bg-sky-50 px-1 py-2 text-xs font-semibold text-sky-900">
						Replay hand
					</button>
					<button
						onClick={onToggleLegalChoices}
						aria-pressed={raiseLegalChoices}
						title="Raise or lower the legal cards without playing one"
						className="rounded-md border border-amber-300 bg-amber-50 px-1 py-2 text-xs font-semibold text-amber-950">
						{raiseLegalChoices ? 'Lower choices' : 'Raise choices'}
					</button>
				</div>
			)}
			{state.phase !== 'play' && (
				<div className="grid w-[180px] shrink-0 grid-cols-2 gap-2">
					<button
					disabled={
						!derived.contract ||
						!derived.declarer ||
						state.phase === 'play' ||
						state.phase === 'confirmed'
					}
					onClick={() => dispatch({ type: 'CONFIRM_AUCTION' })}
					className="rounded-md bg-sky-700 px-2 py-2 text-xs font-bold text-white disabled:opacity-40">
					Confirm
					</button>
					<button
					disabled={!derived.contract || !derived.declarer || state.phase !== 'confirmed'}
					onClick={() => {
						primeBridgeAudio()
						dispatch({ type: 'START_PLAY' })
					}}
					className="rounded-md bg-emerald-700 px-2 py-2 text-xs font-bold text-white disabled:opacity-40">
					Start Play
					</button>
				</div>
			)}
			{state.status && (
				<div
					role="status"
					aria-live="polite"
					className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-2 text-xs font-medium text-slate-600 shadow-sm">
					{state.status}
				</div>
			)}
		</aside>
	)
}

function PresentationBar({
	state,
	derived,
	isFullscreen,
	onExitPresentation,
	onToggleFullscreen,
	onPreviousBoard,
	onNextBoard,
	onAdvanceHidden,
	canAdvanceHidden,
	onReplayHand,
	raiseLegalChoices,
	onToggleLegalChoices,
	feltTheme,
	onFeltThemeChange,
	dispatch,
}) {
	const latestTrick = state.completedTricks[state.completedTricks.length - 1]
	const status =
		state.phase === 'play'
			? state.play?.trickComplete && latestTrick
				? `Trick ${state.completedTricks.length} won by ${latestTrick.winner} — held for discussion`
				: `${seatName(state.play?.turnSeat)} (${state.play?.turnSeat || '-'}) to play${
						state.autoPlayPaused ? ' · teacher control' : ' · automatic defenders on'
					}`
			: state.phase === 'confirmed'
				? `${derived.contract} by ${derived.declarer} confirmed — ready to start play`
				: `Auction ${state.auctionCursor} of ${derived.auctionCalls.length} calls`

	return (
		<div className="mx-auto flex h-[72px] w-full max-w-[1880px] items-center gap-3 border-b-2 border-amber-300 bg-slate-950 px-4 text-white shadow-2xl">
			<button
				onClick={onExitPresentation}
				className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-black hover:bg-white/20">
				Exit presentation
			</button>
			<div className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
				<button
					onClick={onPreviousBoard}
					disabled={state.index <= 0}
					aria-label="Previous board"
					className="h-10 w-10 rounded-lg bg-white text-xl font-black text-slate-950 disabled:opacity-25">
					‹
				</button>
				<div className="min-w-[112px] px-2 text-center">
					<div className="text-[11px] font-black uppercase tracking-widest text-amber-200">Board</div>
					<div className="text-xl font-black leading-none">
						{state.board?.board || state.index + 1} / {state.deals.length}
					</div>
				</div>
				<button
					onClick={onNextBoard}
					disabled={state.index >= state.deals.length - 1}
					aria-label="Next board"
					className="h-10 w-10 rounded-lg bg-white text-xl font-black text-slate-950 disabled:opacity-25">
					›
				</button>
			</div>
			<div
				role="status"
				aria-live="polite"
				className="min-w-0 flex-1 rounded-xl bg-emerald-900 px-4 py-2 text-center ring-1 ring-emerald-500">
				<div className="truncate text-xl font-black">{status}</div>
				<div className="text-sm font-bold text-emerald-100">
					{derived.contract || 'No contract'} {derived.declarer ? `by ${derived.declarer}` : ''} · Dealer{' '}
					{state.board?.dealer || '-'} · Vul {state.board?.vul || '-'}
				</div>
			</div>
			{state.phase === 'auction' && (
				<button
					disabled={!derived.contract || !derived.declarer}
					onClick={() => dispatch({ type: 'CONFIRM_AUCTION' })}
					className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white disabled:opacity-35">
					Confirm contract
				</button>
			)}
			{state.phase === 'confirmed' && (
				<button
					onClick={() => {
						primeBridgeAudio()
						dispatch({ type: 'START_PLAY' })
					}}
					className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-black text-emerald-950">
					Start play
				</button>
			)}
			{state.phase === 'play' && (
				<>
					<div className="flex items-center gap-1">
						<button
							onClick={() => dispatch({ type: 'UNDO_CARD' })}
							disabled={!state.history.length}
							aria-label="Undo one card"
							title="Undo one card"
							className="h-10 w-10 rounded-lg border border-white/30 bg-white/10 text-xl font-black disabled:opacity-25">
							↶
						</button>
						<button
							onClick={() => dispatch({ type: 'UNDO_TRICK' })}
							disabled={!state.history.length}
							aria-label="Undo current trick"
							title="Undo current trick"
							className="h-10 w-10 rounded-lg border border-white/30 bg-white/10 text-sm font-black disabled:opacity-25">
							↶4
						</button>
					</div>
					<button
						onClick={onAdvanceHidden}
						disabled={!canAdvanceHidden}
						title="Play the lowest legal card from the hidden hand"
						className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-black text-slate-950 disabled:opacity-35">
						Play hidden hand
					</button>
					<button
						onClick={onReplayHand}
						className="rounded-lg border border-sky-200/60 bg-sky-500/20 px-3 py-2 text-sm font-black text-sky-50">
						Replay hand
					</button>
					<button
						onClick={onToggleLegalChoices}
						aria-pressed={raiseLegalChoices}
						title="Raise or lower the legal cards without playing one"
						className="rounded-lg border border-amber-300/70 bg-amber-300/15 px-3 py-2 text-sm font-black text-amber-100">
						{raiseLegalChoices ? 'Lower choices' : 'Raise choices'}
					</button>
					<button
						onClick={() =>
							dispatch({ type: 'SET_AUTO_PLAY_PAUSED', paused: !state.autoPlayPaused })
						}
						className={`rounded-lg px-3 py-2 text-sm font-black ${
							state.autoPlayPaused
								? 'bg-white text-slate-950'
								: 'bg-rose-500 text-white'
						}`}>
						{state.autoPlayPaused ? 'Start auto defenders' : 'Stop auto defenders'}
					</button>
				</>
			)}
			<FeltSwatches
				value={feltTheme}
				onChange={onFeltThemeChange}
				presentationMode
			/>
			<SeatVisibilityToggles
				visibleSeats={state.visibleSeats}
				dispatch={dispatch}
				presentationMode
			/>
			<button
				onClick={onToggleFullscreen}
				className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-black hover:bg-white/20">
				{isFullscreen ? 'Window' : 'Fullscreen'}
			</button>
		</div>
	)
}

function ContractNotice({ notice, dispatch }) {
	if (!notice) return null
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
			<div className="w-full max-w-lg rounded-xl border border-amber-200 bg-white p-5 shadow-2xl">
				<h2 className="text-lg font-black text-slate-900">Contract Updated</h2>
				<p className="mt-2 text-sm font-medium leading-6 text-slate-700">{notice}</p>
				<button
					onClick={() => dispatch({ type: 'DISMISS_CONTRACT_NOTICE' })}
					className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white">
					OK
				</button>
			</div>
		</div>
	)
}

function EndResultModal({ result, onBack, onPick, onReplay }) {
	if (!result) return null
	const positive = result.score >= 0
	const signedScore = result.score > 0 ? `+${result.score}` : String(result.score)
	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/72 p-6">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="player-hand-complete-title"
				className="w-full max-w-2xl rounded-3xl border-4 border-amber-300 bg-emerald-950 p-7 text-center text-white shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
				<div className="text-sm font-black uppercase tracking-[0.24em] text-amber-200">
					Hand Complete
				</div>
				<h2 id="player-hand-complete-title" className="mt-2 text-5xl font-black leading-tight">
					{positive ? 'Congratulations' : 'Commiserations'}
				</h2>
				<div
					className={`mx-auto mt-5 w-fit rounded-2xl px-8 py-4 text-6xl font-black shadow-inner ${
						positive ? 'bg-emerald-300 text-emerald-950' : 'bg-rose-200 text-rose-950'
					}`}>
					{signedScore}
				</div>
				<p className="mt-4 text-lg font-bold text-emerald-50">
					{positive ? 'Declarer side scores' : 'Declarer side is deducted'}{' '}
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
				<div className="mt-7 flex flex-wrap justify-center gap-3">
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
	seatIsVisible,
	onPlay,
	dispatch,
	presentationMode = false,
	raiseLegalChoices = true,
}) {
	const completedCount = state.completedTricks.length
	const lastTrickIndex = completedCount - (state.play?.trickComplete ? 2 : 1)
	const lastTrick = lastTrickIndex >= 0 ? state.completedTricks[lastTrickIndex] : null
	const latestWinner =
		state.play?.trickComplete && completedCount > 0
			? state.completedTricks[completedCount - 1]?.winner
			: null
	const visualPlay =
		state.play ? { ...state.play, visualWinner: latestWinner } : null
	const common = (seat) => ({
		seat,
		position: seat,
		cards: state.play?.remaining?.[seat] || state.hands[seat],
		originalCards: state.hands[seat],
		visible: seatIsVisible(seat),
		active: (state.visibleSeats || []).includes(seat) && state.phase !== 'play',
		dealer: state.board.dealer,
		vul:
			seat === 'N' || seat === 'S'
				? state.board.vul === 'NS' || state.board.vul === 'All'
				: state.board.vul === 'EW' || state.board.vul === 'All',
		onPlay: state.phase === 'play' ? onPlay : null,
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
					? 'h-[calc(100vh-72px)] max-w-[1880px] px-12 py-3'
					: 'h-[calc(100vh-7.4rem)] max-w-[1420px] px-5 py-2'
			}`}>
			<div
				className={`player-v3-stage relative h-full ${
					presentationMode ? 'min-h-[650px]' : 'min-h-[610px]'
				}`}>
				<div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
					<HandPanel {...common('N')} />
				</div>
				<div className="absolute left-0 top-1/2 z-20 -translate-y-1/2">
					<HandPanel {...common('W')} />
				</div>
				<div className="absolute right-0 top-1/2 z-20 -translate-y-1/2">
					<HandPanel {...common('E')} />
				</div>
				<div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2">
					<HandPanel {...common('S')} />
				</div>
				<div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
					<StagePanel
						state={state}
						derived={derived}
						dispatch={dispatch}
						visualPlay={visualPlay}
						presentationMode={presentationMode}
					/>
				</div>
				{state.phase === 'play' && (
					<div className="absolute left-0 top-0 z-10">
						<LastTrickPanel trick={lastTrick} presentationMode={presentationMode} />
					</div>
				)}
				{state.phase === 'play' && (
					<div className="absolute right-0 top-0 z-10">
						<PlayStatusPanel
							state={state}
							derived={derived}
							settledTrickCount={completedCount}
							presentationMode={presentationMode}
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
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [presentationMode, setPresentationMode] = useState(false)
	const [raiseLegalChoices, setRaiseLegalChoices] = useState(true)
	const [feltTheme, setFeltTheme] = useState(() => {
		if (typeof window === 'undefined') return 'green'
		const saved = window.localStorage.getItem(PLAYER_FELT_KEY)
		return FELT_THEMES.some((theme) => theme.key === saved) ? saved : 'green'
	})
	const fileRef = useRef(null)
	const audioProgressRef = useRef({ boardIndex: -1, historyLength: 0, completedLength: 0 })
	const derived = getPlayerV2Derived(state)
	const dummy = derived.declarer ? partnerOf(derived.declarer) : ''
	const endResult =
		state.phase === 'play' &&
		state.completedTricks.length >= 13 &&
		derived.score &&
		!derived.score.partial
			? {
					score: derived.score.score,
					resultText: derived.score.resultText,
					contract: derived.contract,
					declarer: derived.declarer,
				}
			: null
	const endResultKey = endResult
		? `${state.index}:${state.history.length}:${endResult.contract}:${endResult.declarer}:${endResult.score}:${endResult.resultText}`
		: ''
	const showEndResult =
		!!endResult && visibleEndKey === endResultKey && dismissedEndKey !== endResultKey
	const selectedFelt = FELT_THEMES.find((theme) => theme.key === feltTheme) || FELT_THEMES[0]

	const onFile = (event) => {
		const file = event.target.files?.[0]
		if (!file) return
		const reader = new FileReader()
		reader.onload = () => {
			const parsed = parsePBN(sanitizePBN(String(reader.result)))
			dispatch({ type: 'LOAD_DEALS', deals: parsed, name: file.name })
			setRaiseLegalChoices(true)
			setReturnPath('')
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

	const toggleFullscreen = async () => {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen()
				return
			}
			await document.documentElement.requestFullscreen()
		} catch (error) {
			console.error('Fullscreen request failed', error)
			dispatch({ type: 'SET_STATUS', status: 'Fullscreen is not available in this browser window.' })
		}
	}

	const seatIsVisible = useCallback(
		(seat) => (state.visibleSeats || []).includes(seat),
		[state.visibleSeats],
	)
	const turnSeat = state.play?.turnSeat || ''
	const canAdvanceHidden =
		state.phase === 'play' &&
		!!turnSeat &&
		!!derived.declarer &&
		isDefender(turnSeat, derived.declarer) &&
		!seatIsVisible(turnSeat) &&
		(state.play?.remaining?.[turnSeat] || []).length > 0

	const advanceHiddenHand = useCallback(() => {
		const currentSeat = state.play?.turnSeat
		if (
			state.phase !== 'play' ||
			!currentSeat ||
			!derived.declarer ||
			!isDefender(currentSeat, derived.declarer) ||
			seatIsVisible(currentSeat)
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
	}, [state.phase, state.play, derived.declarer, derived.trump, seatIsVisible])

	const goToBoard = useCallback(
		(index) => {
			if (index < 0 || index >= state.deals.length || index === state.index) return
			dispatch({ type: 'GO_BOARD', index })
			setRaiseLegalChoices(true)
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
		setPresentationMode(false)
		setReturnPath('')
	}, [state.board])

	useEffect(() => {
		window.localStorage.setItem(PLAYER_FELT_KEY, feltTheme)
	}, [feltTheme])

	useEffect(() => {
		const raw = window.sessionStorage.getItem(PLAYER_HANDOFF_KEY)
		if (!raw) return
		try {
			const payload = JSON.parse(raw)
			const parsed = parsePBN(sanitizePBN(payload.pbn || ''))
			if (parsed.length) {
				dispatch({ type: 'LOAD_DEALS', deals: parsed, name: payload.name || 'Generator handoff' })
				setRaiseLegalChoices(true)
				setReturnPath(payload.sourcePath || '')
			}
		} catch (error) {
			console.error('Player handoff failed', error)
		} finally {
		window.sessionStorage.removeItem(PLAYER_HANDOFF_KEY)
		}
	}, [])

	useEffect(() => {
		const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
		onFullscreenChange()
		document.addEventListener('fullscreenchange', onFullscreenChange)
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
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
		if (!turnSeat || !derived.declarer || !isDefender(turnSeat, derived.declarer)) return
		if (seatIsVisible(turnSeat)) return
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
		seatIsVisible,
	])

	const onPlay = (seat, cardId) => {
		primeBridgeAudio()
		dispatch({ type: 'PLAY_CARD', seat, cardId })
	}

	useEffect(() => {
		const onKeyDown = (event) => {
			const interactiveTarget = event.target?.closest?.(
				'button, a, input, select, textarea, [contenteditable="true"]',
			)
			if (interactiveTarget) return
			if (!state.board) return
			if (event.key === 'Enter' && state.phase !== 'play') {
				event.preventDefault()
				dispatch({ type: 'AUCTION_NEXT' })
				return
			}
			if (event.key === 'ArrowRight') {
				event.preventDefault()
				if (state.phase !== 'play') dispatch({ type: 'AUCTION_NEXT' })
				else advanceHiddenHand()
			}
			const rank = rankFromKey(event)
			if (state.phase === 'play' && rank) {
				const turnSeat = state.play?.turnSeat
				const legalCards =
					turnSeat && seatIsVisible(turnSeat)
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
				event.preventDefault()
				if (state.phase !== 'play') dispatch({ type: 'AUCTION_PREV' })
				else dispatch({ type: 'UNDO_CARD' })
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault()
				dispatch({ type: 'REVEAL_PARTNER' })
			}
			if (event.key === ' ') {
				event.preventDefault()
				if (state.phase !== 'play') dispatch({ type: 'AUCTION_ALL' })
				else {
					const allVisible = SEATS.every((seat) => state.visibleSeats.includes(seat))
					const defaultVisible = [derived.declarer, state.history.length ? dummy : ''].filter(Boolean)
					dispatch({ type: 'SET_VISIBLE_SEATS', seats: allVisible ? defaultVisible : SEATS })
				}
			}
			if (event.key.toLowerCase() === 'r') {
				event.preventDefault()
				if (state.phase !== 'play') dispatch({ type: 'AUCTION_REPLAY' })
				else replayCurrentHand()
			}
			if (event.key.toLowerCase() === 'p') {
				event.preventDefault()
				setPresentationMode((current) => !current)
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
		state.phase,
		state.play,
		state.visibleSeats,
		state.history.length,
		state.index,
		dummy,
		derived.declarer,
		seatIsVisible,
		advanceHiddenHand,
		goToBoard,
		replayCurrentHand,
	])

	return (
		<div
			style={{ background: selectedFelt.background }}
			className={`h-screen overflow-hidden text-slate-900 ${
				presentationMode ? 'player-v3-present' : ''
			}`}>
			<ContractNotice notice={state.contractNotice} dispatch={dispatch} />
			<EndResultModal
				result={showEndResult ? endResult : null}
				onBack={() => setDismissedEndKey(endResultKey)}
				onPick={() => fileRef.current?.click()}
				onReplay={() => replayCurrentHand({ confirm: false })}
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
							<div className="text-xs font-medium text-slate-500">
								{state.selectedName || 'No file loaded'}
							</div>
						</div>
						<div className="flex items-center gap-2">
							{returnPath && (
								<Link to={returnPath} className="text-sm font-semibold text-sky-700 hover:underline">
									Back to Generator
								</Link>
							)}
							<Link to="/" className="text-sm font-semibold text-sky-700 hover:underline">
								Home
							</Link>
							<button
								onClick={() => setPresentationMode(true)}
								disabled={!state.board}
								className="rounded-md bg-amber-300 px-3 py-1.5 text-sm font-black text-slate-950 disabled:opacity-40">
								Presentation mode
							</button>
							<button
								onClick={toggleFullscreen}
								className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold">
								{isFullscreen ? 'Window' : 'Fullscreen'}
							</button>
							<FeltSwatches value={feltTheme} onChange={setFeltTheme} />
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
				<PresentationBar
					state={state}
					derived={derived}
					isFullscreen={isFullscreen}
					onExitPresentation={() => setPresentationMode(false)}
					onToggleFullscreen={toggleFullscreen}
					onPreviousBoard={() => goToBoard(state.index - 1)}
					onNextBoard={() => goToBoard(state.index + 1)}
						onAdvanceHidden={advanceHiddenHand}
						canAdvanceHidden={canAdvanceHidden}
						onReplayHand={() => replayCurrentHand()}
						raiseLegalChoices={raiseLegalChoices}
						onToggleLegalChoices={() => setRaiseLegalChoices((current) => !current)}
						feltTheme={feltTheme}
						onFeltThemeChange={setFeltTheme}
						dispatch={dispatch}
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
								onPreviousBoard={() => goToBoard(state.index - 1)}
								onNextBoard={() => goToBoard(state.index + 1)}
								onAdvanceHidden={advanceHiddenHand}
								canAdvanceHidden={canAdvanceHidden}
								onReplayHand={() => replayCurrentHand()}
								raiseLegalChoices={raiseLegalChoices}
								onToggleLegalChoices={() =>
									setRaiseLegalChoices((current) => !current)
								}
							/>
						</div>
					)}
					<TableSurface
						state={state}
						derived={derived}
						dummy={dummy}
						seatIsVisible={seatIsVisible}
						onPlay={onPlay}
							dispatch={dispatch}
							presentationMode={presentationMode}
							raiseLegalChoices={raiseLegalChoices}
						/>
				</>
			)}
		</div>
	)
}
