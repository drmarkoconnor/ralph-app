import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { parsePBN, sanitizePBN } from '../lib/pbn'
import {
	SEATS,
	auctionRows,
	computeDuplicateScore,
	groupHand,
	handHcp,
	isDefender,
	isSeatVul,
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

function FilePrompt({ onPick }) {
	return (
		<div className="mx-auto mt-16 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
			<h1 className="text-xl font-semibold text-slate-900">Ralph Player</h1>
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

function SeatVisibilityToggles({ visibleSeats, dispatch }) {
	return (
		<div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
			{SEATS.map((seat) => (
				<button
					key={seat}
					onClick={() => dispatch({ type: 'TOGGLE_VISIBLE_SEAT', seat })}
					aria-pressed={(visibleSeats || []).includes(seat)}
					className={`h-8 w-8 rounded-md text-xs font-bold ${
						(visibleSeats || []).includes(seat)
							? 'bg-slate-900 text-white'
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
	playable = false,
	playableMotion = '',
}) {
	const red = card.suit === 'Hearts' || card.suit === 'Diamonds'
	return (
		<button
			disabled={disabled}
			onClick={onClick}
			className={`relative flex h-[130px] w-[92px] shrink-0 transform-gpu flex-col items-start justify-between overflow-hidden rounded-lg border-2 bg-[#fffdf7] px-2 py-2 text-[27px] font-black shadow-[0_14px_24px_rgba(0,0,0,0.44)] ring-1 ring-white/70 transition-[transform,box-shadow,filter] duration-150 will-change-transform ${
				red ? 'border-rose-300 text-rose-700' : 'border-slate-400 text-slate-950'
			} ${overlap ? '-ml-[45px] first:ml-0' : ''} ${
				stack ? '-mt-[61px] first:mt-0' : ''
			} ${
				playable
					? `z-40 scale-[1.38] cursor-pointer ring-4 ring-amber-300 shadow-[0_24px_36px_rgba(0,0,0,0.48)] hover:scale-[1.43] ${playableMotion}`
					: disabled
						? 'z-10 cursor-default brightness-[0.97] saturate-95'
						: 'z-20 cursor-pointer hover:-translate-y-2 hover:scale-105 hover:shadow-2xl'
			}`}>
			<span className="flex flex-col items-center leading-none">
				<span>{card.rank}</span>
				<span className="text-[24px] leading-none">{suitSymbol(card.suit)}</span>
			</span>
			<span className="self-end text-[20px] leading-none opacity-90">
				{suitSymbol(card.suit)}
			</span>
		</button>
	)
}

function CardBack({ overlap = false, side = false }) {
	return (
		<div
			className={`h-[130px] w-[92px] shrink-0 rounded-lg border border-slate-400 bg-[repeating-linear-gradient(135deg,#111827_0,#111827_4px,#374151_4px,#374151_8px)] shadow-[0_10px_20px_rgba(0,0,0,0.38)] ring-1 ring-white/35 ${
				overlap ? (side ? '-mt-[68px] first:mt-0' : '-ml-[45px] first:ml-0') : ''
			}`}>
			<div className="m-2 h-[112px] rounded-md border border-white/30" />
		</div>
	)
}

function HiddenHand({ count = 13, split = false }) {
	const indexes = Array.from({ length: count }, (_, index) => index)
	const rows = split ? [indexes.slice(0, 6), indexes.slice(6)] : [indexes]
	return (
		<div className={`flex items-center justify-center ${split ? 'flex-col gap-2' : ''}`}>
			{rows.map((row, rowIndex) => (
				<div key={rowIndex} className="flex justify-center">
					{row.map((index) => (
						<CardBack key={index} overlap />
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

function SeatLabel({ seat, dealer, vul, role, active }) {
	return (
		<div
			className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-black shadow-lg ${
				active ? 'bg-amber-400 text-slate-950' : 'bg-slate-950/85 text-white'
			}`}>
			<span className="rounded bg-emerald-600 px-2 py-0.5 text-white">{seat}</span>
			<span>{seatName(seat)}</span>
			<span className="text-[10px] font-bold opacity-80">{role}</span>
			{dealer === seat && <span className="rounded bg-white/20 px-1.5 text-[10px]">D</span>}
			{vul && <span className="rounded bg-rose-600 px-1.5 text-[10px] text-white">V</span>}
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
}) {
	const grouped = useMemo(() => groupHand(cards), [cards])
	const sortedCards = useMemo(
		() => Object.values(grouped).flat(),
		[grouped],
	)
	const isTurn = play?.turnSeat === seat
	const isPartnership = declarer && (seat === declarer || seat === dummy)
	const role = seat === declarer ? 'Declarer' : seat === dummy ? 'Dummy' : 'Defender'
	const isSideSeat = position === 'E' || position === 'W'
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
			className={`relative flex w-fit max-w-full flex-col items-center justify-center rounded-xl p-0.5 ${
				active || isTurn ? 'ring-4 ring-amber-300/80' : ''
			} ${isPartnership ? 'shadow-[0_0_35px_rgba(14,165,233,0.16)]' : ''}`}>
			<div className="mb-0.5 text-center">
				<SeatLabel
					seat={seat}
					dealer={dealer}
					vul={vul}
					role={role}
					active={active || isTurn}
				/>
				{openingLeader === seat && (
					<div className="mt-1 text-xs font-black uppercase tracking-wide text-amber-200">
						Opening lead
					</div>
				)}
			</div>
			<div className="flex items-center">
				{visible ? (
					<div className={`flex items-center justify-center ${isSideSeat ? 'flex-col gap-3' : ''}`}>
						{cardRows.map((row, rowIndex) => (
							<div key={rowIndex} className="flex justify-center">
								{row.map((card) => {
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
										/>
									)
								})}
							</div>
						))}
					</div>
				) : (
					<HiddenHand count={(cards || []).length || 13} split={isSideSeat} />
				)}
			</div>
			<footer className="mt-1 rounded bg-slate-950/75 px-2 py-0.5 text-[11px] font-black text-white">
				HCP {visible ? handHcp(cards) : '?'}
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

function StagePanel({ state, derived, dispatch, visualPlay }) {
	if (state.phase === 'play') {
		return <TrickPanel play={visualPlay || state.play} />
	}

	return (
		<div className="grid w-[360px] gap-1">
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
			<div className="absolute left-1/2 top-5 -translate-x-1/2">
				<TrickCardSlot seat="N" trick={trick} winner={winner} size={size} />
			</div>
			<div className="absolute right-5 top-1/2 -translate-y-1/2">
				<TrickCardSlot seat="E" trick={trick} winner={winner} size={size} />
			</div>
			<div className="absolute bottom-5 left-1/2 -translate-x-1/2">
				<TrickCardSlot seat="S" trick={trick} winner={winner} size={size} />
			</div>
			<div className="absolute left-5 top-1/2 -translate-y-1/2">
				<TrickCardSlot seat="W" trick={trick} winner={winner} size={size} />
			</div>
			{showStatus && (
				<div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/45 bg-black/24 text-center text-[9px] font-black uppercase leading-tight tracking-wide text-amber-100">
					{winner ? `Won by ${winner}` : turnSeat ? `Turn ${turnSeat}` : `${played}/4`}
				</div>
			)}
		</div>
	)
}

function TrickPanel({ play }) {
	const trick = play?.trick || []
	const winner = play?.visualWinner || null
	return (
		<section className="flex w-[328px] flex-col rounded-2xl border-2 border-amber-500/70 bg-emerald-950/62 p-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.34)]">
			<div className="mx-auto h-[306px] w-[306px]">
				<CrossTrick
					trick={trick}
					winner={winner}
					turnSeat={play?.turnSeat}
					contract={null}
					showContract={false}
				/>
			</div>
		</section>
	)
}

function LastTrickPanel({ trick }) {
	return (
		<aside className="w-[238px] rounded-2xl border-2 border-amber-400/70 bg-emerald-950/82 p-2 text-white shadow-2xl backdrop-blur">
			<div className="mb-1 flex items-center justify-between">
				<h2 className="text-xs font-black uppercase tracking-wide text-amber-100">
					Last Trick
				</h2>
				<div className="rounded-md bg-amber-300 px-2 py-0.5 text-[10px] font-black text-slate-950">
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

function PlayStatusPanel({ state, derived, settledTrickCount }) {
	const shownTricks = (state.completedTricks || []).slice(0, settledTrickCount)
	const counts = countTricksBySide(shownTricks, derived.declarer)
	const liveScore =
		derived.contract && derived.declarer
			? computeDuplicateScore(
					derived.contract,
					derived.declarer,
					isSeatVul(derived.declarer, state.board?.vul),
					counts.declarer,
				)
			: null
	return (
		<aside className="w-[238px] rounded-2xl border-2 border-amber-400/70 bg-emerald-950/82 p-3 text-white shadow-2xl backdrop-blur">
			<div className="flex items-start justify-between gap-2">
				<div>
					<div className="text-xs font-black uppercase tracking-wide text-amber-100">
						Contract
					</div>
					<div className="text-[44px] font-black leading-none text-white">
						{derived.contract || '-'}
					</div>
					<div className="mt-1 text-xs font-bold text-emerald-100">
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

			<div className="mt-2 rounded-xl bg-white/10 px-3 py-2 shadow-inner">
				<div className="text-[10px] font-black uppercase tracking-wide text-emerald-100">
					Live Result
				</div>
				<div className="text-2xl font-black leading-tight">
					{liveScore && !liveScore.partial ? liveScore.resultText : '-'}
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

function Controls({ state, derived, dispatch, onPick }) {
	const hasAuction = derived.auctionCalls.length > 0
	return (
		<aside className="mx-auto flex h-16 w-full max-w-[1420px] items-center gap-4 overflow-visible rounded-xl border border-white/50 bg-white/90 p-2 shadow-2xl backdrop-blur">
			<div className="flex w-[140px] shrink-0 items-center justify-between gap-2">
				<Link to="/player/help" className="text-xs font-semibold text-sky-700 hover:underline">
					Guide
				</Link>
				<button onClick={onPick} className="rounded-md bg-white px-2 py-1 text-xs font-semibold shadow-sm">
					Load PBN
				</button>
			</div>
			<div className="w-[150px] shrink-0">
				<div className="text-xs font-bold uppercase tracking-wide text-slate-500">Board</div>
				<div className="text-sm font-bold text-slate-900">
					{state.board?.board || state.index + 1} of {state.deals.length || 0}
				</div>
				<div className="text-xs text-slate-500">
					Dealer {state.board?.dealer || '-'} · Vul {state.board?.vul || '-'}
				</div>
			</div>
			<div className="w-[178px] shrink-0">
				<div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
					Show Hands
				</div>
				<SeatVisibilityToggles visibleSeats={state.visibleSeats} dispatch={dispatch} />
			</div>
			<div className="w-[300px] shrink-0">
				<div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
					Contract
				</div>
				<ManualContractControls manual={state.manualContract} dispatch={dispatch} />
			</div>
			{state.phase !== 'play' && (
				<div className="grid w-[156px] shrink-0 grid-cols-3 gap-1.5">
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
				<div className="grid w-[156px] shrink-0 grid-cols-2 gap-1.5">
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
				</div>
			)}
			<div className="grid w-[190px] shrink-0 grid-cols-2 gap-2">
				<button
					disabled={!derived.contract || !derived.declarer || state.phase === 'play'}
					onClick={() => dispatch({ type: 'CONFIRM_AUCTION' })}
					className="rounded-md bg-sky-700 px-2 py-2 text-xs font-bold text-white disabled:opacity-40">
					Confirm
				</button>
				<button
					disabled={!derived.contract || !derived.declarer || state.phase === 'play'}
					onClick={() => dispatch({ type: 'START_PLAY' })}
					className="rounded-md bg-emerald-700 px-2 py-2 text-xs font-bold text-white disabled:opacity-40">
					Start Play
				</button>
			</div>
			{state.status && (
				<div className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-2 text-xs font-medium text-slate-600 shadow-sm">
					{state.status}
				</div>
			)}
		</aside>
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

function TableSurface({
	state,
	derived,
	dummy,
	seatIsVisible,
	onPlay,
	dispatch,
}) {
	const completedCount = state.completedTricks.length
	const [settledTrickCount, setSettledTrickCount] = useState(0)
	useEffect(() => {
		if (state.phase !== 'play' || completedCount === 0) {
			setSettledTrickCount(0)
			return undefined
		}
		if (completedCount < settledTrickCount) {
			setSettledTrickCount(completedCount)
			return undefined
		}
		if (state.play?.trickComplete && completedCount > settledTrickCount) {
			const timer = window.setTimeout(() => {
				setSettledTrickCount(completedCount)
			}, 500)
			return () => window.clearTimeout(timer)
		}
		if (!state.play?.trickComplete && completedCount > settledTrickCount) {
			setSettledTrickCount(completedCount)
		}
		return undefined
	}, [state.phase, state.play?.trickComplete, completedCount, settledTrickCount])
	const visibleSettledTrickCount = Math.min(settledTrickCount, completedCount)
	const lastTrick =
		visibleSettledTrickCount > 0
			? state.completedTricks[visibleSettledTrickCount - 1]
			: null
	const latestWinner =
		state.play?.trickComplete && completedCount > 0
			? state.completedTricks[completedCount - 1]?.winner
			: null
	const showClearedTrick =
		state.phase === 'play' &&
		state.play?.trickComplete &&
		completedCount > 0 &&
		visibleSettledTrickCount >= completedCount
	const visualPlay =
		state.play && showClearedTrick
			? { ...state.play, trick: [], trickComplete: false, visualWinner: null }
			: state.play
				? { ...state.play, visualWinner: latestWinner }
				: null
	const common = (seat) => ({
		seat,
		position: seat,
		cards: state.play?.remaining?.[seat] || state.hands[seat],
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
	})

	return (
		<main className="mx-auto h-[calc(100vh-7.4rem)] max-w-[1420px] px-5 py-2">
			<div className="relative h-full min-h-[610px]">
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
					/>
				</div>
				{state.phase === 'play' && (
					<div className="absolute left-0 top-0 z-10">
						<LastTrickPanel trick={lastTrick} />
					</div>
				)}
				{state.phase === 'play' && (
					<div className="absolute right-0 top-0 z-10">
						<PlayStatusPanel
							state={state}
							derived={derived}
							settledTrickCount={visibleSettledTrickCount}
						/>
					</div>
				)}
			</div>
		</main>
	)
}

export default function PlayerV2() {
	const [state, dispatch] = useReducer(playerV2Reducer, initialPlayerV2State)
	const fileRef = useRef(null)
	const derived = getPlayerV2Derived(state)
	const dummy = derived.declarer ? partnerOf(derived.declarer) : ''

	const onFile = (event) => {
		const file = event.target.files?.[0]
		if (!file) return
		const reader = new FileReader()
		reader.onload = () => {
			const parsed = parsePBN(sanitizePBN(String(reader.result)))
			dispatch({ type: 'LOAD_DEALS', deals: parsed, name: file.name })
			if (fileRef.current) fileRef.current.value = ''
		}
		reader.readAsText(file)
	}

	const seatIsVisible = useCallback(
		(seat) => (state.visibleSeats || []).includes(seat),
		[state.visibleSeats],
	)

	useEffect(() => {
		if (state.phase !== 'play') return
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
		}, state.play.trickComplete ? 750 : 450)
		return () => clearTimeout(timer)
	}, [
		state.phase,
		state.play?.turnSeat,
		state.play?.trick,
		state.play?.remaining,
		state.play?.trickComplete,
		derived.declarer,
		derived.trump,
		seatIsVisible,
	])

	useEffect(() => {
		if (state.phase !== 'play') return
		const turnSeat = state.play?.turnSeat
		if (!turnSeat || !seatIsVisible(turnSeat)) return
		const legalCards = legalCardsForTurn(state.play, turnSeat)
		if (legalCards.length !== 1) return
		const [card] = legalCards
		const timer = setTimeout(() => {
			dispatch({ type: 'PLAY_CARD', seat: turnSeat, cardId: card.id })
		}, state.play.trickComplete ? 750 : 350)
		return () => clearTimeout(timer)
	}, [
		state.phase,
		state.play,
		seatIsVisible,
	])

	const onPlay = (seat, cardId) => dispatch({ type: 'PLAY_CARD', seat, cardId })

	useEffect(() => {
		const onKeyDown = (event) => {
			const tag = event.target?.tagName
			if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
			if (!state.board) return
			if (event.key === 'ArrowRight') {
				event.preventDefault()
				if (state.phase !== 'play') dispatch({ type: 'AUCTION_NEXT' })
				else {
					const turnSeat = state.play?.turnSeat
					const trickForChoice = state.play?.trickComplete ? [] : state.play?.trick
					const card = turnSeat
						? selectSimpleDefenderCard(
								state.play.remaining,
								trickForChoice,
								turnSeat,
								derived.trump,
							)
						: null
					if (turnSeat && card) {
						dispatch({ type: 'PLAY_CARD', seat: turnSeat, cardId: card.id })
					}
				}
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
				else dispatch({ type: 'START_PLAY' })
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
		dummy,
		derived.declarer,
		derived.trump,
		seatIsVisible,
	])

	return (
		<div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#11683f_0,#064329_48%,#032418_100%)] text-slate-900">
			<ContractNotice notice={state.contractNotice} dispatch={dispatch} />
			<input ref={fileRef} type="file" accept=".pbn,text/plain" onChange={onFile} className="hidden" />
			<header className="h-10 border-b border-emerald-900/40 bg-white/95">
				<div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
					<div>
						<div className="text-base font-black">Ralph Player</div>
						<div className="text-xs font-medium text-slate-500">
							{state.selectedName || 'No file loaded'}
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Link to="/" className="text-sm font-semibold text-sky-700 hover:underline">
							Home
						</Link>
						<button
							onClick={() => dispatch({ type: 'RESET' })}
							className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold">
							Reset
						</button>
					</div>
				</div>
			</header>

			{!state.board ? (
				<FilePrompt onPick={() => fileRef.current?.click()} />
			) : (
				<>
					<div className="px-6 pt-2">
						<Controls
							state={state}
							derived={derived}
							dispatch={dispatch}
							onPick={() => fileRef.current?.click()}
						/>
					</div>
					<TableSurface
						state={state}
						derived={derived}
						dummy={dummy}
						seatIsVisible={seatIsVisible}
						onPlay={onPlay}
						dispatch={dispatch}
					/>
				</>
			)}
		</div>
	)
}
