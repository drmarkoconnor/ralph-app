// Player rebuilt cleanly with balanced JSX and required features
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
	createInitialManualState,
	playCardManual,
} from '../lib/manualPlayEngine'
import {
	computeDuplicateScore,
	dealToHands,
	evaluateTrick,
	hcpValue,
	isDefender,
	isDeclarerSide,
	isSeatVul,
	parsePlayMoves,
	parsePlayScript,
	parseTrump,
	partnerOf,
	rightOf,
	validateAuction,
	neededToSet,
} from '../lib/bridgeCore'
import { parsePBN, sanitizePBN } from '../lib/pbn'

// small helpers
const seatName = (s) =>
	s === 'N' ? 'North' : s === 'E' ? 'East' : s === 'S' ? 'South' : 'West'
const suitSymbol = (s) =>
	s === 'Spades' ? '♠' : s === 'Hearts' ? '♥' : s === 'Diamonds' ? '♦' : '♣'

function SeatPanel({
	id,
	remaining,
	turnSeat,
	trick,
	onPlay,
	visible,
	dealer,
	vul,
	declarer,
	showHCP,
	lastAutoSeat,
	highlight,
	openingLeader,
	playStarted,
	openingLeadPulse,
}) {
	const hand = remaining?.[id] || []
	const hcp = hand.reduce((s, c) => s + hcpValue(c.rank), 0)
	const suitOrder = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
	const grouped = Object.fromEntries(
		suitOrder.map((s) => [
			s,
			hand
				.filter((c) => c.suit === s)
				.sort(
					(a, b) =>
						'2345678910JQKA'.indexOf(a.rank) - '2345678910JQKA'.indexOf(b.rank)
				),
		])
	)
	const leadSuit =
		trick.length > 0 && trick.length < 4 ? trick[0].card.suit : null
	const mustFollow = leadSuit && hand.some((c) => c.suit === leadSuit)
	const isTurn = turnSeat === id
	return (
		<div
			className={`rounded-xl border w-60 overflow-hidden bg-white flex flex-col ${
				isTurn ? 'border-red-500' : 'border-gray-300'
			} ${lastAutoSeat === id ? 'ring-2 ring-sky-300 animate-pulse' : ''} ${
				highlight
					? 'relative z-20 shadow-xl shadow-yellow-200/30 ring-2 ring-yellow-300'
					: ''
			}`}>
			<div
				className={`px-2 py-1 text-[11px] font-semibold flex items-center justify-between ${
					isTurn
						? 'bg-red-50'
						: id === 'N' || id === 'S'
						? 'bg-indigo-50'
						: 'bg-gray-50'
				}`}>
				<span className="flex items-center gap-1">
					{seatName(id)}
					{openingLeader && (
						<span className="text-[8px] px-1 rounded bg-yellow-400 text-black font-bold">
							LEAD
						</span>
					)}
					{dealer === id && (
						<span className="ml-1 text-[9px] bg-amber-500 text-white px-1 rounded">
							D
						</span>
					)}
				</span>
				<span className="flex items-center gap-1">
					{isSeatVul(vul, id) && (
						<span className="text-[8px] px-1 rounded bg-rose-600 text-white">
							V
						</span>
					)}
					{(visible || showHCP) && (
						<span className="text-[10px] opacity-70">HCP {hcp}</span>
					)}
				</span>
			</div>
			<div className="p-2 flex flex-col gap-2">
				{suitOrder.map((s) => (
					<div key={s} className="flex items-center gap-2">
						<div
							className={`w-6 text-center text-xl ${
								s === 'Hearts' || s === 'Diamonds'
									? 'text-red-600'
									: 'text-black'
							}`}>
							{suitSymbol(s)}
						</div>
						<div className="flex flex-wrap gap-1 flex-1">
							{visible ? (
								grouped[s].map((c) => {
									const legal =
										!isTurn || !leadSuit || !mustFollow || c.suit === leadSuit
									const isRedSuit = c.suit === 'Hearts' || c.suit === 'Diamonds'
									return (
										<button
											key={c.id}
											disabled={!playStarted || !legal || !isTurn}
											onClick={() => onPlay(id, c.id)}
											className={`px-1.5 py-0.5 text-base rounded-md font-bold shadow-sm border bg-white ${
												isRedSuit
													? 'text-rose-600 border-rose-300'
													: 'text-slate-800 border-slate-300'
											} ${
												legal && isTurn && playStarted ? 'ring-2 ring-yellow-300' : ''
											} ${
												openingLeadPulse && isTurn && playStarted ? 'animate-pulse' : ''
											} ${!playStarted || !legal || !isTurn ? 'opacity-40' : ''} ${
												highlight ? 'outline outline-white/70' : ''
											}`}>
											<span className="font-extrabold tracking-tight">{c.rank}</span>
											<span className="ml-0.5">{suitSymbol(c.suit)}</span>
										</button>
									)
								})
							) : (
								<span className="italic text-gray-400 text-sm">hidden</span>
							)}
							{visible && grouped[s].length === 0 && (
								<span className="text-gray-300">-</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function CompletedTricks({ tricks }) {
	if (!tricks || !tricks.length) return null
	return (
		<div className="rounded border bg-white p-2 max-h-48 overflow-auto w-60">
			<div className="text-[11px] text-gray-600 mb-1">Completed Tricks</div>
			<table className="w-full text-[10px]">
				<thead>
					<tr className="text-gray-600">
						<th className="text-left">#</th>
						<th className="text-left">Winner</th>
						<th className="text-left">Cards (N E S W)</th>
					</tr>
				</thead>
				<tbody>
					{tricks.map((t) => {
						const order = ['N', 'E', 'S', 'W']
						const cards = order.map((s) => {
							const it = t.cards.find((c) => c.seat === s)
							return it ? `${it.card.rank}${it.card.suit[0]}` : '—'
						})
						return (
							<tr key={t.no} className="border-t">
								<td className="py-0.5 pr-1">{t.no}</td>
								<td className="py-0.5 pr-1 font-semibold">{t.winner}</td>
								<td className="py-0.5 font-mono">{cards.join(' ')}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

function PreUpload({ onChooseFile }) {
	return (
		<div className="max-w-lg mx-auto mt-10 text-center rounded border bg-white p-6">
			<h2 className="text-lg font-semibold mb-2">Load a PBN file</h2>
			<p className="text-sm text-gray-600 mb-4">
				Choose a PBN tournament file to begin exploring deals.
			</p>
			<button
				onClick={onChooseFile}
				className="px-3 py-1.5 rounded bg-sky-600 text-white text-sm">
				Choose PBN…
			</button>
		</div>
	)
}

function ScorePanel({
	tricksDecl,
	tricksDef,
	needed,
	contract,
	declarer,
	result,
}) {
	return (
		<div className="rounded border bg-white p-2 text-[11px] space-y-1">
			<div className="font-semibold text-gray-700">Score</div>
			<div>
				Contract: <span className="font-semibold">{contract || '-'}</span>
			</div>
			<div>
				Tricks:{' '}
				<span className="font-semibold">
					{tricksDecl} for, {tricksDef} against
				</span>
			</div>
			{typeof needed === 'number' && (
				<div>
					Needed to set: <span className="font-semibold">{needed}</span>
				</div>
			)}
			{result && (
				<div>
					Score: <span className="font-semibold">{result.score}</span>{' '}
					<span className="text-gray-600">({result.label})</span>
				</div>
			)}
		</div>
	)
}

function CardSlot({ seat, trick, size = 'lg', isWinner = false, dim = false, tilt = true }) {
	const it = trick.find((t) => t.seat === seat)
	const dims =
		size === 'lg'
			? { w: 'w-24', h: 'h-36', text: 'text-4xl', corner: 'text-sm' }
			: size === 'sm'
			? { w: 'w-14', h: 'h-20', text: 'text-xl', corner: 'text-[9px]' }
			: { w: 'w-16', h: 'h-24', text: 'text-2xl', corner: 'text-[10px]' }
	if (!it)
		return (
			<div className={`${dims.w} ${dims.h} rounded-xl border bg-white/90 shadow-inner`} />
		)
	const isRed = it.card.suit === 'Hearts' || it.card.suit === 'Diamonds'
	const suitColor = isRed ? 'text-rose-600' : 'text-slate-800'
	const isFace = ['J', 'Q', 'K'].includes(it.card.rank)
	const rotateClass = tilt ? (seat === 'E' ? 'rotate-6' : seat === 'W' ? '-rotate-6' : '') : ''
	const borderClass = isRed ? 'border-rose-200' : 'border-slate-200'
	return (
		<div
			className={`relative ${dims.w} ${dims.h} rounded-[14px] ${borderClass} bg-white flex items-center justify-center overflow-hidden ${rotateClass} ${isWinner ? 'winner-gold animate-spin-once' : ''} ${dim ? 'animate-fade-dim' : ''}`}
			style={{
				boxShadow:
					'0 8px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -3px 10px rgba(0,0,0,0.10)'
			}}
		>
			{/* faint paper texture */}
			<div
				className="absolute inset-0 opacity-[0.04] pointer-events-none"
				style={{
					backgroundImage:
						'repeating-linear-gradient(135deg, #000 0, #000 1px, transparent 1px, transparent 6px)'
				}}
			/>
			{/* gloss highlight */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						'radial-gradient(circle at 20% 0%, rgba(255,255,255,0.55), rgba(255,255,255,0.05) 40%, rgba(255,255,255,0) 60%)'
				}}
			/>
			{/* subtle suit watermark for face cards */}
			{isFace && (
				<div className="absolute inset-0 opacity-10 pointer-events-none select-none">
					<div className={`absolute -rotate-12 ${dims.text} ${suitColor} right-2 bottom-2`}>{suitSymbol(it.card.suit)}</div>
					<div className={`absolute rotate-12 ${dims.text} ${suitColor} left-2 top-2`}>{suitSymbol(it.card.suit)}</div>
				</div>
			)}
			{/* face-card icon overlays */}
			{isFace && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					{it.card.rank === 'K' || it.card.rank === 'Q' ? (
						<svg width="72" height="72" viewBox="0 0 64 64" className="opacity-15" aria-hidden>
							<path d="M8 40 L20 12 L32 28 L44 12 L56 40 L8 40 Z" fill={isRed ? '#dc2626' : '#1f2937'} />
							<circle cx="32" cy="36" r="6" fill="white" opacity="0.5" />
						</svg>
					) : (
						<svg width="72" height="72" viewBox="0 0 64 64" className="opacity-15" aria-hidden>
							<path d="M10 44 C20 28, 44 28, 54 44 L48 46 C42 36, 22 36, 16 46 Z" fill={isRed ? '#dc2626' : '#1f2937'} />
							<circle cx="24" cy="30" r="5" fill="white" opacity="0.45" />
							<circle cx="40" cy="30" r="5" fill="white" opacity="0.45" />
						</svg>
					)}
				</div>
			)}
			{/* top-left small suit */}
			<div className={`absolute top-1 left-1 ${dims.corner} ${suitColor}`}>
				{suitSymbol(it.card.suit)}
			</div>
			{/* bottom-right small suit (rotated) */}
			<div className={`absolute bottom-1 right-1 ${dims.corner} ${suitColor} rotate-180`}>
				{suitSymbol(it.card.suit)}
			</div>
			{/* center rank + suit */}
			<div className={`${dims.text} font-extrabold ${suitColor} drop-shadow-sm`}>
				{it.card.rank}
				<span className="ml-0.5">{suitSymbol(it.card.suit)}</span>
			</div>
		</div>
	)
}

function CrossTrick({ trick, winner, turnSeat, lastAutoPlay, highlight, openingLeader }) {
	return (
		<div
			className={`relative rounded-3xl border-2 w-[560px] h-[340px] shadow-inner overflow-hidden ${
				highlight ? 'ring-2 ring-yellow-300' : ''
			}`}
			style={{ background: '#0b5d27' }}
		>
			{/* felt texture overlays */}
			<div className="absolute inset-0 pointer-events-none" style={{
				background:
					'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12), rgba(255,255,255,0) 40%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.10), rgba(0,0,0,0) 55%)'
			}} />
			<div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
				backgroundImage: 'repeating-linear-gradient(145deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 7px)'
			}} />
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
				<div className="text-[11px] text-gray-500">
					{winner ? (
						<span className="text-green-700 font-semibold">
							Trick to {winner}
						</span>
					) : turnSeat ? (
						<span>Turn: {turnSeat}</span>
					) : (
						<span>&nbsp;</span>
					)}
				</div>
			</div>
			{openingLeader && (
				<div className="absolute top-2 right-2 text-[10px] bg-yellow-300 text-black px-2 py-0.5 rounded shadow">
					Opening lead: {openingLeader}
				</div>
			)}
			<div className="absolute left-1/2 -translate-x-1/2 top-3">
				<CardSlot seat="N" trick={trick} size="lg" isWinner={winner==='N'} dim={!!winner && winner!=='N'} />
			</div>
			<div className="absolute right-4 top-1/2 -translate-y-1/2">
				<CardSlot seat="E" trick={trick} size="lg" isWinner={winner==='E'} dim={!!winner && winner!=='E'} />
			</div>
			<div className="absolute left-4 top-1/2 -translate-y-1/2">
				<CardSlot seat="W" trick={trick} size="lg" isWinner={winner==='W'} dim={!!winner && winner!=='W'} />
			</div>
			<div className="absolute left-1/2 -translate-x-1/2 bottom-3">
				<CardSlot seat="S" trick={trick} size="lg" isWinner={winner==='S'} dim={!!winner && winner!=='S'} />
			</div>
			{/* Auto-play details hidden from central panel to keep visuals clean */}
		</div>
	)
}

function ContractBadge({ contract, declarer }) {
	if (!contract) return null
	const m = contract.match(/^(\d)([CDHSN]{1,2})(X{0,2})$/i)
	if (!m)
		return (
			<div className="rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-sky-50 to-indigo-50 px-5 py-3 text-xl font-bold tracking-wide">
				{contract}
			</div>
		)
	const level = m[1]
	let strain = m[2].toUpperCase()
	const dbl = m[3]
	const suitMap = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT', N: 'NT' }
	if (strain === 'N') strain = 'NT'
	const sym = suitMap[strain] || strain
	const isRed = strain === 'H' || strain === 'D'
	const colorClass = isRed
		? 'text-rose-600 drop-shadow-sm'
		: 'text-slate-800 drop-shadow-sm'
	const bgGrad = isRed
		? 'from-rose-100 via-amber-50 to-rose-50'
		: 'from-emerald-100 via-sky-50 to-indigo-100'
	return (
		<div
			className={`relative rounded-2xl border-4 border-indigo-300/70 bg-gradient-to-br ${bgGrad} shadow-lg px-6 py-4 flex flex-col items-center justify-center min-w-[120px]`}>
			<div className="text-[11px] tracking-wider text-indigo-700 font-semibold mb-1">
				FINAL CONTRACT
			</div>
			<div className={`text-5xl font-extrabold leading-none ${colorClass}`}>
				{level}
				{sym}
				{dbl && <span className="text-indigo-700 text-3xl ml-1">{dbl}</span>}
			</div>
			{declarer && (
				<div className="mt-2 text-[12px] font-semibold text-indigo-700 bg-white/60 px-2 py-0.5 rounded-full shadow-inner">
					Declarer {declarer}
				</div>
			)}
		</div>
	)
}

function AuctionGraphic({ auction = [], dealer = 'N', contract, declarer }) {
	if (!auction.length && !contract) return null
	const seats = ['N', 'E', 'S', 'W']
	const startIdx = seats.indexOf(dealer || 'N')
	const orderedSeats = [0, 1, 2, 3].map((i) => seats[(startIdx + i) % 4])
	const rounds = []
	for (let i = 0; i < auction.length; i += 4)
		rounds.push(auction.slice(i, i + 4))
	while (rounds.length && rounds[rounds.length - 1].length < 4)
		rounds[rounds.length - 1].push('')
	const callClass = (c) =>
		c === ''
			? 'text-gray-300'
			: /^(P|Pass)$/i.test(c)
			? 'text-gray-500'
			: /^(X|XX)$/.test(c)
			? 'text-indigo-700 font-semibold'
			: 'font-semibold'
	return (
		<div className="flex items-center gap-6">
			<div className="rounded-2xl border-2 border-indigo-200 bg-white/80 backdrop-blur px-4 py-3 shadow-inner">
				<div className="text-[11px] font-semibold tracking-wide text-indigo-600 mb-1">
					AUCTION (Dealer {dealer})
				</div>
				<table className="text-sm font-medium">
					<thead>
						<tr>
							{orderedSeats.map((s) => (
								<th key={s} className="px-2 py-1 text-indigo-700 font-semibold">
									{s}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rounds.map((r, i) => (
							<tr key={i}>
								{orderedSeats.map((seat, idx) => {
									const call = r[idx] || ''
									const final = call && i * 4 + idx === auction.length - 1
									const base = `px-2 py-0.5 text-center rounded transition-colors ${callClass(
										call
									)}`
									return (
										<td key={seat} className="p-0">
											<span
												className={`${base} ${
													final
														? 'bg-yellow-200/70 ring-2 ring-yellow-400 shadow font-bold'
														: ''
												}`}>
												{call || '—'}
											</span>
										</td>
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
				{!auction.length && (
					<div className="text-[11px] italic text-gray-500">
						No auction provided (manual contract)
					</div>
				)}
			</div>
			<ContractBadge contract={contract} declarer={declarer} />
		</div>
	)
}

export default function Player() {
	const [deals, setDeals] = useState([])
	const [index, setIndex] = useState(0)
	const [selectedName, setSelectedName] = useState('')
	const current = deals[index]

	const [manualDeclarer, setManualDeclarer] = useState('')
	const [manualLevel, setManualLevel] = useState('')
	const [manualStrain, setManualStrain] = useState('')
	const [manualDbl, setManualDbl] = useState('')

	const [visibilityMode, setVisibilityMode] = useState('hidden')
	const [hideDefenders, setHideDefenders] = useState(true)
	const [fastAutoDef, setFastAutoDef] = useState(false)
	const [aiDifficulty, setAiDifficulty] = useState('Intermediate')
	const [signalMode, setSignalMode] = useState('Standard')
	const [showAiLog, setShowAiLog] = useState(true)
	const [pauseAtTrickEnd, setPauseAtTrickEnd] = useState(false)

	const [remaining, setRemaining] = useState(null)
	const [trick, setTrick] = useState([])
	const [turnSeat, setTurnSeat] = useState(null)
	const [tricksDecl, setTricksDecl] = useState(0)
	const [tricksDef, setTricksDef] = useState(0)
	const [completedTricks, setCompletedTricks] = useState(0)
	const [trickComplete, setTrickComplete] = useState(false)
	const [history, setHistory] = useState([])
	const [manualMoves, setManualMoves] = useState([])
	const [playIdx, setPlayIdx] = useState(0)
	const [flashWinner, setFlashWinner] = useState(null)
	const [completedTrickList, setCompletedTrickList] = useState([])
	const [lastTrickPreview, setLastTrickPreview] = useState(null)
	const [lastAutoSeat, setLastAutoSeat] = useState(null)
	const [lastAutoPlay, setLastAutoPlay] = useState(null)
	const [aiLogs, setAiLogs] = useState([])
	const [showCompletedTricks, setShowCompletedTricks] = useState(true)
	const [teacherFocus, setTeacherFocus] = useState(false)
	const [actualWinners, setActualWinners] = useState(null)
	const [actualLosers, setActualLosers] = useState(null)
	const [preAnalysis, setPreAnalysis] = useState(null)
	const [showAuctionModal, setShowAuctionModal] = useState(false)
	const [handInfoOpen, setHandInfoOpen] = useState(false)
	const [playStarted, setPlayStarted] = useState(false)
    const [soundOn, setSoundOn] = useState(true)
    const [showCelebration, setShowCelebration] = useState(false)

	const playIdxRef = useRef(0)
	const pauseRef = useRef(false)
	const fileRef = useRef(null)
	const initialTrumpRef = useRef(null)
	const audioCtxRef = useRef(null)

	// --- Audio helpers ---
	const ensureAudio = useCallback(() => {
		if (!soundOn) return null
		try {
			if (!audioCtxRef.current) {
				const Ctx = window.AudioContext || window.webkitAudioContext
				audioCtxRef.current = new Ctx()
			}
			if (audioCtxRef.current.state === 'suspended') {
				audioCtxRef.current.resume()
			}
			return audioCtxRef.current
		} catch {
			return null
		}
	}, [soundOn])

	const playSwish = useCallback(() => {
		const ctx = ensureAudio()
		if (!ctx) return
		const dur = 0.18
		const sampleRate = ctx.sampleRate
		const length = Math.floor(sampleRate * dur)
		const buffer = ctx.createBuffer(1, length, sampleRate)
		const data = buffer.getChannelData(0)
		for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.6
		const src = ctx.createBufferSource()
		src.buffer = buffer
		const filter = ctx.createBiquadFilter()
		filter.type = 'lowpass'
		filter.frequency.setValueAtTime(900, ctx.currentTime)
		filter.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + dur)
		const gain = ctx.createGain()
		gain.gain.setValueAtTime(0.0001, ctx.currentTime)
		gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.04)
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
		src.connect(filter)
		filter.connect(gain)
		gain.connect(ctx.destination)
		src.start()
	}, [ensureAudio])

	const playTing = useCallback(() => {
		const ctx = ensureAudio()
		if (!ctx) return
		const now = ctx.currentTime
		const osc = ctx.createOscillator()
		osc.type = 'triangle'
		osc.frequency.setValueAtTime(880, now)
		osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05)
		const gain = ctx.createGain()
		gain.gain.setValueAtTime(0.0001, now)
		gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02)
		gain.gain.exponentialRampToValueAtTime(0.002, now + 0.35)
		osc.connect(gain)
		gain.connect(ctx.destination)
		osc.start(now)
		osc.stop(now + 0.4)
	}, [ensureAudio])

	const playKlaxon = useCallback(() => {
		const ctx = ensureAudio()
		if (!ctx) return
		const now = ctx.currentTime
		const osc = ctx.createOscillator()
		osc.type = 'sawtooth'
		osc.frequency.setValueAtTime(220, now)
		const lfo = ctx.createOscillator()
		lfo.frequency.setValueAtTime(6, now)
		const lfoGain = ctx.createGain()
		lfoGain.gain.setValueAtTime(20, now)
		lfo.connect(lfoGain)
		lfoGain.connect(osc.frequency)
		const gain = ctx.createGain()
		gain.gain.setValueAtTime(0.0001, now)
		gain.gain.exponentialRampToValueAtTime(0.5, now + 0.03)
		gain.gain.exponentialRampToValueAtTime(0.005, now + 0.5)
		osc.connect(gain)
		gain.connect(ctx.destination)
		osc.start(now)
		lfo.start(now)
		osc.stop(now + 0.5)
		lfo.stop(now + 0.5)
	}, [ensureAudio])

	const validatedAuction = useMemo(() => {
		if (!current) return { legal: false }
		const calls = Array.isArray(current.auction) ? current.auction : []
		if (!calls.length) return { legal: false }
		return validateAuction(
			current.auctionDealer || current.dealer || 'N',
			calls
		)
	}, [current])

	useEffect(() => {
		if (!current) return
		const hasManual = !!(manualLevel && manualStrain)
		const hasAuction = current.auction && current.auction.length
		if (hasAuction && validatedAuction.legal && !hasManual) {
			// Auto-adopt validated auction's contract/declarer into derived state by ensuring current has these fields
			if (!current.contract || !current.declarer) {
				current.contract = validatedAuction.contract
				current.declarer = validatedAuction.declarer
			}
			setShowAuctionModal(false)
			return
		}
		// otherwise, show modal only if nothing to derive and no manual
		if (!hasAuction && !current.contract && !hasManual) setShowAuctionModal(true)
		else setShowAuctionModal(false)
	}, [current, manualLevel, manualStrain, validatedAuction])

	const effDeclarer =
		manualDeclarer ||
		current?.declarer ||
		(validatedAuction.legal ? validatedAuction.declarer : '') ||
		''
	const effContract = useMemo(() => {
		if (manualLevel && manualStrain)
			return `${manualLevel}${manualStrain}${manualDbl}`
		return (
			current?.contract ||
			(validatedAuction.legal ? validatedAuction.contract : '') ||
			''
		)
	}, [
		manualLevel,
		manualStrain,
		manualDbl,
		current?.contract,
		validatedAuction,
	])

	const effTrump = parseTrump(effContract)

	const hands = useMemo(() => {
		if (!current?.deal) return null
		try {
			return dealToHands(current.deal)
		} catch {
			return null
		}
	}, [current?.deal])

	const playMoves = useMemo(() => {
		if (current?.play?.length) {
			try {
				return parsePlayMoves(current.playLeader, current.play, effContract)
			} catch {
				return []
			}
		}
		if (current?.playScript) {
			try {
				return parsePlayScript(current.playScript)
			} catch {
				return []
			}
		}
		return []
	}, [current?.play, current?.playLeader, current?.playScript, effContract])

	const usingManual = playMoves.length === 0

	// Opening leader is right of declarer if contract is set; otherwise dealer
	const openingLeader = useMemo(() => {
		if (effDeclarer) return rightOf(effDeclarer)
		return current?.dealer || 'N'
	}, [effDeclarer, current?.dealer])

	// Pulse the opening leader's playable cards before the very first lead
	const openingLeadPulse = useMemo(() => history.length === 0, [history.length])

	useEffect(() => {
		if (!hands) {
			setRemaining(null)
			setTrick([])
			setTurnSeat(null)
			setTricksDecl(0)
			setTricksDef(0)
			setCompletedTricks(0)
			setHistory([])
			setManualMoves([])
			setCompletedTrickList([])
			setPlayIdx(0)
			setPlayStarted(false)
			return
		}
		const leader = openingLeader
		const init = createInitialManualState(
			hands,
			leader,
			effTrump,
			effDeclarer
		)
		setRemaining(init.remaining)
		setTrick(init.trick)
		setTurnSeat(init.turnSeat)
		setTricksDecl(init.tricksDecl)
		setTricksDef(init.tricksDef)
		setCompletedTricks(init.completed)
		setTrickComplete(init.trickComplete)
		setHistory([])
		setManualMoves([])
		setCompletedTrickList([])
		setPlayIdx(0)
		setFlashWinner(null)
		setVisibilityMode('hidden')
		setHideDefenders(true)
		setPlayStarted(false)
	}, [hands, effTrump, effDeclarer, current?.playLeader, current?.dealer, openingLeader])

	useEffect(() => {
		if (!hands || !effTrump || !effDeclarer) {
			initialTrumpRef.current = null
			return
		}
		try {
			const partner = partnerOf(effDeclarer)
			const declCount = hands[effDeclarer].filter(
				(c) => c.suit === effTrump
			).length
			const dummyCount = hands[partner].filter(
				(c) => c.suit === effTrump
			).length
			const defCount = ['N', 'E', 'S', 'W']
				.filter((s) => s !== effDeclarer && s !== partner)
				.reduce(
					(acc, s) => acc + hands[s].filter((c) => c.suit === effTrump).length,
					0
				)
			initialTrumpRef.current = {
				decl: declCount,
				dummy: dummyCount,
				def: defCount,
				total: declCount + dummyCount + defCount,
			}
		} catch {
			initialTrumpRef.current = null
		}
	}, [hands, effTrump, effDeclarer])

	useEffect(() => {
		if (!hands || !effDeclarer) {
			setActualWinners(null)
			setActualLosers(null)
			setPreAnalysis(null)
			return
		}
		try {
			const seats = ['N', 'E', 'S', 'W']
			const p = partnerOf(effDeclarer)
			const suitList = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
			const perSuit = { Spades: {}, Hearts: {}, Diamonds: {}, Clubs: {} }
			let winners = 0,
				losers = 0
			for (const suit of suitList) {
				const cards = [...hands[effDeclarer], ...hands[p]]
					.filter((c) => c.suit === suit)
					.sort(
						(a, b) =>
							'AKQJ1098765432'.indexOf(a.rank) -
							'AKQJ1098765432'.indexOf(b.rank)
					)
					.reverse()
				let w = 0
				if (cards.find((c) => c.rank === 'A')) w++
				if (cards.length >= 2 && cards.find((c) => c.rank === 'K')) w++
				if (
					cards.length >= 3 &&
					cards.find((c) => c.rank === 'Q') &&
					(cards.find((c) => c.rank === 'A') ||
						cards.find((c) => c.rank === 'K'))
				)
					w++
				const top3 = cards.slice(0, 3)
				const honors = top3.filter((c) =>
					['A', 'K', 'Q'].includes(c.rank)
				).length
				const l = Math.min(top3.length, 3 - honors)
				winners += w
				losers += l
				perSuit[suit] = { winners: w, losers: l, length: cards.length }
			}
			setActualWinners(winners)
			setActualLosers(losers)
			// HCP + shapes
			const hcpMap = { A: 4, K: 3, Q: 2, J: 1 }
			const countHcp = (hand) =>
				hand.reduce((s, c) => s + (hcpMap[c.rank] || 0), 0)
			const declHand = hands[effDeclarer]
			const dummyHand = hands[p]
			const hcpDecl = countHcp(declHand)
			const hcpDummy = countHcp(dummyHand)
			const partnershipHcp = hcpDecl + hcpDummy
			const shapeOf = (hand) => {
				const counts = suitList.map(
					(s) => hand.filter((c) => c.suit === s).length
				)
				return counts.join('-')
			}
			const shapeDecl = shapeOf(declHand)
			const shapeDummy = shapeOf(dummyHand)
			const trumpSuit = effTrump || 'NT'
			const trumpLens =
				trumpSuit === 'NT'
					? { decl: 0, dummy: 0, total: 0 }
					: {
							decl: declHand.filter((c) => c.suit === effTrump).length,
							dummy: dummyHand.filter((c) => c.suit === effTrump).length,
					  }
			trumpLens.total = trumpLens.decl + trumpLens.dummy
			// Longest side suits (exclude trump if any)
			const sideLengths = suitList
				.filter((s) => s !== effTrump)
				.map((s) => ({ s, length: perSuit[s].length }))
			const maxLen = Math.max(...sideLengths.map((x) => x.length), 0)
			const longestSides = sideLengths
				.filter((x) => x.length === maxLen && maxLen > 0)
				.map((x) => x.s[0])
			// Sure winner suits list
			const sureWinnerSuits = suitList
				.filter((s) => perSuit[s].winners > 0)
				.map((s) => `${perSuit[s].winners}${suitSymbol(s)}`)
			// Problem suits = losers > winners
			const problemSuits = suitList
				.filter((s) => perSuit[s].losers > perSuit[s].winners)
				.map((s) => `${s[0]}(${perSuit[s].losers})`)
			// Entry estimate: count A/K outside trump
			const entryCount = seats.reduce(
				(acc, seat) =>
					acc +
					hands[seat].filter(
						(c) => (c.rank === 'A' || c.rank === 'K') && c.suit !== effTrump
					).length,
				0
			)
			setPreAnalysis({
				partnershipHcp,
				hcpDecl,
				hcpDummy,
				shapeDecl,
				shapeDummy,
				trumpSuit,
				trumpLens,
				longestSides,
				sureWinnerSuits,
				problemSuits,
				entryCount,
				perSuit,
			})
		} catch {
			setActualWinners(null)
			setActualLosers(null)
			setPreAnalysis(null)
		}
	}, [hands, effDeclarer, effTrump])

	// --- UI ---
	const onPlayCard = useCallback(
		(seat, cardId) => {
			// Must have started, be manual mode, and be that seat's turn
			if (!usingManual || !turnSeat || !playStarted) return
			// Enforce opening lead must be the computed openingLeader
			if (history.length === 0 && seat !== openingLeader) return
			const preRemaining = remaining
			const trickBefore = trick
			const engine = {
				remaining,
				trick,
				turnSeat,
				tricksDecl,
				tricksDef,
				trump: effTrump,
				declarer: effDeclarer,
				completed: completedTricks,
				trickComplete,
			}
			const r = playCardManual(engine, seat, cardId)
			if (!r.ok) return
            playSwish()
			const next = r.state
			setRemaining(next.remaining)
			setTrick(next.trick)
			setTurnSeat(next.turnSeat)
			setTricksDecl(next.tricksDecl)
			setTricksDef(next.tricksDef)
			setCompletedTricks(next.completed)
			setTrickComplete(next.trickComplete || false)
			const [_, suit, rank] = cardId.split('-')
			setHistory((h) => [...h, { seat, cardId, suit, rank }])
			setManualMoves((m) => [...m, { seat, suit, rank }])
			setPlayIdx((k) => {
				const v = k + 1
				playIdxRef.current = v
				return v
			})
			if (r.winner) {
				// Always trigger a brief winner flash for animation; if pause is enabled, keep it until user proceeds
				setFlashWinner(r.winner)
				if (!pauseRef.current) {
					setTimeout(() => setFlashWinner(null), 800)
				}
                if (effDeclarer) {
                    if (isDeclarerSide(r.winner, effDeclarer)) playTing()
                    else playKlaxon()
                }
				setCompletedTrickList((lst) => {
					const entry = { no: lst.length + 1, winner: r.winner, cards: next.trick }
					// update last trick preview
					setLastTrickPreview(entry)
					return [...lst, entry]
				})
			}
			if (hideDefenders && isDefender(seat, effDeclarer)) {
				setLastAutoSeat(seat)
				setTimeout(() => setLastAutoSeat(null), 800)
			}
		},
		[
			usingManual,
			turnSeat,
			remaining,
			trick,
			tricksDecl,
			tricksDef,
			effTrump,
			effDeclarer,
			completedTricks,
			trickComplete,
			hideDefenders,
			playStarted,
			openingLeader,
		]
	)

	// Simple auto-play for hidden defenders
	const rankOrder = [
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'10',
		'J',
		'Q',
		'K',
		'A',
	]
	const rankWeight = (r) => rankOrder.indexOf(r)
	const selectDefenderCard = useCallback(
		(seat) => {
			const hand = remaining?.[seat]
			if (!hand?.length) return null
			const cur = trick
			const leadSuit =
				cur.length > 0 && cur.length < 4 ? cur[0].card.suit : null
			let playable = hand
			if (leadSuit) {
				const follow = hand.filter((c) => c.suit === leadSuit)
				if (follow.length) playable = follow
			}
			if (!leadSuit) {
				const groups = {}
				hand.forEach((c) => {
					;(groups[c.suit] ||= []).push(c)
				})
				let entries = Object.entries(groups).sort(
					(a, b) => b[1].length - a[1].length
				)
				if (effTrump) {
					const non = entries.filter((e) => e[0] !== effTrump)
					if (non.length)
						entries = [...non, ...entries.filter((e) => e[0] === effTrump)]
				}
				const low = entries[0][1]
					.slice()
					.sort((a, b) => rankWeight(a.rank) - rankWeight(b.rank))
				return { card: low[0], reason: `Lead ${entries[0][0][0]} low` }
			}
			if (leadSuit) {
				const partner = partnerOf(seat)
				const currentWinner = evaluateTrick(cur, effTrump)
				const asc = playable
					.slice()
					.sort((a, b) => rankWeight(a.rank) - rankWeight(b.rank))
				if (currentWinner === partner)
					return { card: asc[0], reason: 'Partner winning' }
				for (const c of asc) {
					const w = evaluateTrick([...cur, { seat, card: c }], effTrump)
					if (w === seat) return { card: c, reason: 'Win cheaply' }
				}
				return { card: asc[0], reason: 'Cannot win' }
			}
			return { card: playable[0], reason: 'Random' }
		},
		[remaining, trick, effTrump]
	)

	const autoPlayRef = useRef(false)
	useEffect(() => {
		const defendersHidden =
			visibilityMode === 'mimic' ||
			visibilityMode === 'hidden' ||
			(visibilityMode === 'all' && hideDefenders)
		if (
			!usingManual ||
			!playStarted ||
			!defendersHidden ||
			!turnSeat ||
			!isDefender(turnSeat, effDeclarer) ||
			autoPlayRef.current
		)
			return
		autoPlayRef.current = true
		const timer = setTimeout(
			() => {
				const sel = selectDefenderCard(turnSeat)
				if (sel?.card) {
					onPlayCard(turnSeat, sel.card.id)
					setLastAutoPlay({
						seat: turnSeat,
						cardId: sel.card.id,
						reason: sel.reason,
						ts: Date.now(),
					})
					setAiLogs((l) =>
						[
							...l,
							{
								id: Date.now() + Math.random().toString(36).slice(2, 6),
								seat: turnSeat,
								text: `${turnSeat} ${sel.card.rank}${sel.card.suit[0]} – ${sel.reason}`,
							},
						].slice(-40)
					)
				}
				autoPlayRef.current = false
			},
			fastAutoDef ? 120 : 420
		)
		return () => {
			clearTimeout(timer)
			autoPlayRef.current = false
		}
	}, [
		usingManual,
		hideDefenders,
		visibilityMode,
		turnSeat,
		effDeclarer,
		fastAutoDef,
		selectDefenderCard,
		onPlayCard,
		playStarted,
	])

	const result = useMemo(() => {
		if (!effContract || !effDeclarer) return null
		return computeDuplicateScore(
			effContract,
			effDeclarer,
			isSeatVul(effDeclarer, current?.vul),
			tricksDecl
		)
	}, [effContract, effDeclarer, tricksDecl, current?.vul])

	// Reset Start button (playStarted) once 13 tricks are completed
	useEffect(() => {
		if (completedTricks >= 13) setPlayStarted(false)
	}, [completedTricks])

	// Celebration when contract is made at end of hand
	useEffect(() => {
		if (completedTricks < 13 || !effContract) return
		const m = String(effContract).toUpperCase().match(/^(\d)(C|D|H|S|NT)/)
		if (!m) return
		const target = 6 + parseInt(m[1], 10)
		if (tricksDecl >= target) {
			setShowCelebration(true)
			const t = setTimeout(() => setShowCelebration(false), 5000)
			return () => clearTimeout(t)
		}
	}, [completedTricks, effContract, tricksDecl])

	const needed = useMemo(() => neededToSet(effContract), [effContract])

	// Visibility resolution helper per seat
	const seatVisible = useCallback(
		(seat) => {
			if (!effDeclarer) return visibilityMode === 'all'
			if (visibilityMode === 'hidden') return false
			if (visibilityMode === 'all') {
				// Show all, but allow independent defenders toggle to hide defenders only
				const isDef = isDefender(seat, effDeclarer)
				return isDef ? !hideDefenders : true
			}
			// mimic: before opening lead, controller can see declarer's hand; after first card, dummy becomes visible; defenders stay hidden
			if (visibilityMode === 'mimic') {
				const dummy = partnerOf(effDeclarer)
				const openingLeadPlayed = history.length > 0
				if (seat === effDeclarer) return true
				if (seat === dummy) return openingLeadPlayed
				return false // defenders hidden in mimic mode
			}
			return false
		},
		[visibilityMode, effDeclarer, history.length, hideDefenders]
	)

	const onFile = (e) => {
		const f = e.target.files?.[0]
		if (!f) return
		setSelectedName(f.name)
		const r = new FileReader()
		r.onload = () => {
			try {
				const text = sanitizePBN(String(r.result))
				const parsed = parsePBN(text) || []
				// Map to the shape Player expects; keep known fields and defaults
				const boards = parsed
					.filter((b) => b.deal)
					.map((b) => ({
						board: b.board || '',
						dealer: b.dealer || 'N',
						vul: b.vul || 'None',
						deal: b.deal,
						auction: Array.isArray(b.auction) ? b.auction : [],
						auctionDealer: b.auctionDealer || b.dealer || 'N',
						play: b.play || [],
						playLeader: b.playLeader || b.dealer || 'N',
						contract: b.contract || '',
						declarer: b.declarer || '',
						ext: b.ext || {},
					}))
				setDeals(boards)
				setIndex(0)
				// Reset any manual overrides so the badge reflects imported PBN
				setManualDeclarer('')
				setManualLevel('')
				setManualStrain('')
				setManualDbl('')
			} catch (err) {
				console.error(err)
			}
		}
		r.readAsText(f)
	}

	const rebuildFromHistory = useCallback(
		(to) => {
			if (!hands) return
			const leader = openingLeader
			let st = createInitialManualState(
				hands,
				leader,
				effTrump,
				effDeclarer
			)
			for (const mv of history.slice(0, to)) {
				const r = playCardManual(st, mv.seat, mv.cardId)
				if (!r.ok) break
				st = r.state
			}
			setRemaining(st.remaining)
			setTrick(st.trick)
			setTurnSeat(st.turnSeat)
			setTricksDecl(st.tricksDecl)
			setTricksDef(st.tricksDef)
			setCompletedTricks(st.completed)
			setTrickComplete(st.trickComplete)
			setPlayIdx(to)
			playIdxRef.current = to
		},
		[
			history,
			hands,
			effDeclarer,
			effTrump,
			current?.playLeader,
			current?.dealer,
			openingLeader,
		]
	)
	const onPrevStep = () =>
		rebuildFromHistory(Math.max(0, playIdxRef.current - 1))
	const onNextStep = () =>
		rebuildFromHistory(Math.min(history.length, playIdxRef.current + 1))
	const prev = () => setIndex((i) => Math.max(0, i - 1))
	const next = () => setIndex((i) => Math.min(deals.length - 1, i + 1))
	const reset = () => {
		setDeals([])
		setIndex(0)
		setSelectedName('')
		setVisibilityMode('hidden')
		setHideDefenders(true)
	}

	// Escape key exits teacher focus mode
	useEffect(() => {
		if (!teacherFocus) return
		const handler = (e) => {
			if (e.key === 'Escape') setTeacherFocus(false)
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [teacherFocus])

	return (
		<div className="min-h-screen bg-gray-100 flex relative">
			{showAuctionModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
					<div className="relative bg-white rounded-xl shadow-lg w-full max-w-md p-5 space-y-4">
						<h2 className="text-lg font-semibold text-indigo-700">
							No Auction Found
						</h2>
						<p className="text-sm text-gray-700">
							This PBN has no auction lines. Please set the contract manually in
							the sidebar (Declarer, Level, Strain, Doubles) before you begin
							planning.
						</p>
						<button
							onClick={() => setShowAuctionModal(false)}
							className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">
							Got it
						</button>
					</div>
				</div>
			)}

			{teacherFocus && (
				<>
					<div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-10 pointer-events-none" />
					<button
						onClick={() => setTeacherFocus(false)}
						className="fixed top-2 left-2 z-30 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold px-3 py-1 rounded shadow">
						Exit Focus (Esc)
					</button>
				</>
			)}

			<div
				className={`w-72 p-3 border-r bg-gray-50 flex flex-col gap-3 text-[11px] transition-all duration-300 ${
					teacherFocus ? 'opacity-0 -translate-x-full pointer-events-none' : ''
				}`}>
				<div className="flex items-center justify-between">
					<Link to="/" className="text-sky-600 hover:underline text-[12px]">
						← Home
					</Link>
					<Link
						to="/player/help"
						className="text-sky-600 hover:underline text-[12px]">
						Help
					</Link>
					<button
						onClick={reset}
						className="px-2 py-0.5 rounded border bg-white">
						Start over
					</button>
				</div>
				<div>
					<input
						ref={fileRef}
						type="file"
						accept=".pbn,text/plain"
						onChange={onFile}
						className="hidden"
					/>
					<button
						onClick={() => fileRef.current?.click()}
						className="w-full px-2 py-1 rounded bg-sky-600 text-white text-[12px]">
						Choose PBN…
					</button>
					<div className="mt-1 text-gray-600 truncate">
						{selectedName || 'No file chosen'}
					</div>
					<div className="text-gray-700 mt-0.5">
						{deals.length
							? `Board ${current?.board || index + 1} — ${index + 1}/${
									deals.length
							  }`
							: 'No file loaded'}
					</div>
					{effContract ? (
						<div className="text-gray-700">
							Contract:{' '}
							<span className="font-semibold">
								{effContract}
								{effDeclarer ? ` (${effDeclarer})` : ''}
							</span>
						</div>
					) : (
						<div className="text-gray-500">No bidding found</div>
					)}
					<div className="flex gap-1 mt-1">
						<button
							disabled={!deals.length}
							onClick={prev}
							className="flex-1 px-2 py-0.5 rounded border disabled:opacity-40">
							Prev
						</button>
						<button
							disabled={!deals.length}
							onClick={next}
							className="flex-1 px-2 py-0.5 rounded border disabled:opacity-40">
							Next
						</button>
					</div>
				</div>

				<div className="space-y-1 border-t pt-2">
					<div className="font-semibold text-[11px] text-gray-700">
						Visibility
					</div>
					<label className="flex items-center gap-1">
						<input
							type="checkbox"
							checked={visibilityMode === 'mimic'}
							onChange={(e) => {
								if (e.target.checked) setVisibilityMode('mimic')
								else if (visibilityMode === 'mimic') setVisibilityMode('hidden')
							}}
						/>{' '}
						<span>Mimic table</span>
					</label>
					<label className="flex items-center gap-1">
						<input
							type="checkbox"
							checked={visibilityMode === 'all'}
							onChange={(e) => {
								if (e.target.checked) setVisibilityMode('all')
								else if (visibilityMode === 'all') setVisibilityMode('hidden')
							}}
						/>{' '}
						<span>Show all hands</span>
					</label>
					<label className="flex items-center gap-1">
						<input
							type="checkbox"
							checked={hideDefenders}
							onChange={(e) => setHideDefenders(e.target.checked)}
						/>{' '}
						<span>Hide defenders</span>
					</label>
					{hideDefenders && (
						<div className="ml-4 flex flex-col gap-1">
							<label className="flex items-center gap-1">
								<input
									type="checkbox"
									checked={fastAutoDef}
									onChange={(e) => setFastAutoDef(e.target.checked)}
								/>{' '}
								<span>Fast auto-play</span>
							</label>
							<label className="flex items-center gap-1">
								<span>AI</span>
								<select
									value={aiDifficulty}
									onChange={(e) => setAiDifficulty(e.target.value)}
									className="border rounded px-1 py-0.5">
									<option>Basic</option>
									<option>Intermediate</option>
									<option>Advanced</option>
								</select>
							</label>
							<label className="flex items-center gap-1">
								<span>Signals</span>
								<select
									value={signalMode}
									onChange={(e) => setSignalMode(e.target.value)}
									className="border rounded px-1 py-0.5">
									<option value="Standard">Standard</option>
									<option value="LowEnc">LowEnc</option>
								</select>
							</label>
							<label className="flex items-center gap-1">
								<input
									type="checkbox"
									checked={showAiLog}
									onChange={(e) => setShowAiLog(e.target.checked)}
								/>{' '}
								<span>Show AI log</span>
							</label>
						</div>
					)}
					<label className="flex items-center gap-1">
						<input
							type="checkbox"
							checked={pauseAtTrickEnd}
							onChange={(e) => {
								setPauseAtTrickEnd(e.target.checked)
								pauseRef.current = e.target.checked
							}}
						/>{' '}
						<span>Pause at trick end</span>
					</label>
					<label className="flex items-center gap-1">
						<input
							type="checkbox"
							checked={showCompletedTricks}
							onChange={(e) => setShowCompletedTricks(e.target.checked)}
						/>{' '}
						<span>Show completed tricks</span>
					</label>
					<div className="mt-1 border-t pt-2">
						<div className="font-semibold text-[11px] text-gray-700 mb-1">Audio</div>
						<label className="flex items-center gap-1">
							<input
								type="checkbox"
								checked={soundOn}
								onChange={(e) => setSoundOn(e.target.checked)}
							/>{' '}
							<span>Enable sounds</span>
						</label>
					</div>
					{!teacherFocus && (
						<button
							onClick={() => setTeacherFocus(true)}
							className="mt-1 w-full px-2 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-white font-semibold shadow">
							Teacher focus
						</button>
					)}
				</div>

				{!current?.contract && (
					<div className="space-y-1 border-t pt-2">
						<div className="font-semibold">Set contract</div>
						<label className="flex items-center justify-between gap-1">
							<span>Declarer</span>
							<select
								className="border rounded px-1 py-0.5"
								value={manualDeclarer}
								onChange={(e) => setManualDeclarer(e.target.value)}>
								<option value="">—</option>
								<option value="N">N</option>
								<option value="E">E</option>
								<option value="S">S</option>
								<option value="W">W</option>
							</select>
						</label>
						<label className="flex items-center justify-between gap-1">
							<span>Level</span>
							<select
								className="border rounded px-1 py-0.5"
								value={manualLevel}
								onChange={(e) => setManualLevel(e.target.value)}>
								<option value="">—</option>
								{['1', '2', '3', '4', '5', '6', '7'].map((l) => (
									<option key={l}>{l}</option>
								))}
							</select>
						</label>
						<label className="flex items-center justify-between gap-1">
							<span>Strain</span>
							<select
								className="border rounded px-1 py-0.5"
								value={manualStrain}
								onChange={(e) => setManualStrain(e.target.value)}>
								<option value="">—</option>
								<option value="C">C</option>
								<option value="D">D</option>
								<option value="H">H</option>
								<option value="S">S</option>
								<option value="NT">NT</option>
							</select>
						</label>
						<label className="flex items-center justify-between gap-1">
							<span>Dbl</span>
							<select
								className="border rounded px-1 py-0.5"
								value={manualDbl}
								onChange={(e) => setManualDbl(e.target.value)}>
								<option value="">—</option>
								<option value="X">X</option>
								<option value="XX">XX</option>
							</select>
						</label>
					</div>
				)}

				<ScorePanel
					tricksDecl={tricksDecl}
					tricksDef={tricksDef}
					needed={needed}
					contract={effContract}
					declarer={effDeclarer}
					result={result}
				/>

				<div className="flex flex-wrap gap-1 text-[11px]">
					<button
						onClick={() => rebuildFromHistory(0)}
						disabled={history.length === 0}
						className="px-2 py-0.5 border rounded disabled:opacity-40">
						⏮
					</button>
					<button
						onClick={onPrevStep}
						disabled={playIdx <= 0}
						className="px-2 py-0.5 border rounded disabled:opacity-40">
						◀
					</button>
					<button
						onClick={onNextStep}
						disabled={playIdx >= history.length}
						className="px-2 py-0.5 border rounded disabled:opacity-40">
						▶
					</button>
					<button
						onClick={() => {
							const mod = playIdx % 4
							const back = mod === 0 ? 4 : mod
							const target = Math.max(0, playIdx - back)
							rebuildFromHistory(target)
						}}
						disabled={playIdx <= 0}
						className="px-2 py-0.5 border rounded disabled:opacity-40">
						Undo Trick
					</button>
				</div>

				{showCompletedTricks && (
					<div className="rounded border bg-white p-1 text-[10px] max-h-60 overflow-auto">
						<CompletedTricks tricks={completedTrickList} />
					</div>
				)}
				{showAiLog && hideDefenders && (
					<div className="flex-1 overflow-auto rounded border bg-white p-1 text-[10px]">
						<div className="font-semibold mb-1">AI Log</div>
						<div className="space-y-0.5">
							{aiLogs
								.slice()
								.reverse()
								.map((l) => (
									<div key={l.id} className="truncate">
										<span className="font-mono text-[9px] text-gray-500 mr-1">
											{l.seat}
										</span>
										{l.text}
									</div>
								))}
						</div>
					</div>
				)}
			</div>

			<div className="flex-1 p-4 flex flex-col gap-4 relative">
				{/* Last trick mini preview - pinned to main area */}
				{lastTrickPreview && (
					<div className="absolute top-2 left-2 z-10">
						<div className="text-[10px] text-gray-600 mb-1">Last trick</div>
						<div className="relative rounded-2xl border bg-emerald-900/30 backdrop-blur-sm p-2">
							<div className="relative w-[320px] h-[200px] bg-[#0b5d27] rounded-xl border overflow-hidden">
								<div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage:'repeating-linear-gradient(145deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 7px)'}} />
								<div className="absolute left-1/2 -translate-x-1/2 top-3">
									<CardSlot seat="N" trick={lastTrickPreview.cards} size="md" tilt={false} />
									<div className="text-[10px] text-white/80 text-center mt-0.5">N</div>
								</div>
								<div className="absolute right-3 top-1/2 -translate-y-1/2">
									<CardSlot seat="E" trick={lastTrickPreview.cards} size="md" tilt={false} />
									<div className="text-[10px] text-white/80 text-center mt-0.5">E</div>
								</div>
								<div className="absolute left-3 top-1/2 -translate-y-1/2">
									<CardSlot seat="W" trick={lastTrickPreview.cards} size="md" tilt={false} />
									<div className="text-[10px] text-white/80 text-center mt-0.5">W</div>
								</div>
								<div className="absolute left-1/2 -translate-x-1/2 bottom-3">
									<CardSlot seat="S" trick={lastTrickPreview.cards} size="md" tilt={false} />
									<div className="text-[10px] text-white/80 text-center mt-0.5">S</div>
								</div>
								<div className="absolute bottom-2 right-2 text-[11px] bg-yellow-300/90 text-black px-1.5 py-0.5 rounded">
									Winner: {lastTrickPreview.winner}
								</div>
							</div>
						</div>
					</div>
				)}
				{!current && deals.length === 0 && (
					<PreUpload onChooseFile={() => fileRef.current?.click()} />
				)}
				{current && hands && (
					<div className="flex flex-col gap-6 items-center">
						<div className="w-full max-w-3xl mx-auto -mt-2">
							<div className="flex items-center justify-end gap-2 mb-1">
								<button
									disabled={!effContract || !effDeclarer}
									onClick={() => setPlayStarted((v) => !v)}
									className={`px-2 py-1 rounded text-white text-[12px] disabled:opacity-50 ${
										playStarted ? 'bg-rose-600' : 'bg-emerald-600'
									}`}
								>
									{playStarted ? 'Stop' : 'Start Play'}
								</button>
								<button
									onClick={() => setHandInfoOpen((v) => !v)}
									className="px-2 py-1 rounded border bg-white text-[12px]">
									{handInfoOpen ? 'Hide Hand Info' : 'Show Hand Info'}
								</button>
							</div>
							{handInfoOpen && (
								<div className="rounded-lg border bg-white/80 backdrop-blur p-3 text-[12px] shadow-sm">
									<div className="flex items-center justify-between mb-2">
										<h3 className="font-semibold text-indigo-700">
											Hand Information
										</h3>
										<div className="text-[10px] text-gray-500">
											Declarer:{' '}
											<span className="font-semibold">
												{effDeclarer || '—'}
											</span>{' '}
											· Contract:{' '}
											<span className="font-semibold">
												{effContract || '—'}
											</span>
										</div>
									</div>
									<div className="mb-2 grid grid-cols-1 md:grid-cols-2 gap-3">
										<div className="border rounded bg-white/70 p-2">
											<div className="font-semibold text-indigo-700 mb-1">Declarer snapshot</div>
											{preAnalysis ? (
												<ul className="list-disc ml-4 space-y-0.5">
													<li>Partnership HCP: <span className="font-semibold">{preAnalysis.partnershipHcp}</span> (You: {preAnalysis.hcpDecl}, Dummy: {preAnalysis.hcpDummy})</li>
													<li>Shapes: <span className="font-semibold">{preAnalysis.shapeDecl}</span> (You), <span className="font-semibold">{preAnalysis.shapeDummy}</span> (Dummy)</li>
													<li>Trump: <span className="font-semibold">{preAnalysis.trumpSuit || 'NT'}</span> — length You/Dummy: <span className="font-semibold">{preAnalysis.trumpLens.decl}/{preAnalysis.trumpLens.dummy}</span> (Total {preAnalysis.trumpLens.total})</li>
													<li>Sure winners: <span className="font-semibold">{preAnalysis.sureWinnerSuits.join(', ') || '—'}</span></li>
													<li>Problem suits: <span className="font-semibold">{preAnalysis.problemSuits.join(', ') || '—'}</span></li>
													<li>Likely entries (A/K outside trump): <span className="font-semibold">{preAnalysis.entryCount}</span></li>
												</ul>
											) : (
												<div className="text-gray-500 italic">Load a deal and set the contract to see planning hints.</div>
											)}
										</div>
										<div className="border rounded bg-white/70 p-2">
											<div className="font-semibold text-indigo-700 mb-1">Teacher prompts</div>
											<ul className="list-disc ml-4 space-y-0.5">
												<li>What are the sure tricks? Where will extra tricks come from?</li>
												<li>Which suit(s) to develop? Where are the entries?</li>
												<li>What could defenders hold in long suits? Who guards trumps?</li>
												<li>If dummy is short in trump, plan ruffs; if long, consider drawing trumps early.</li>
												<li>Consider the lead: does it suggest a specific holding or sequence?</li>
											</ul>
										</div>
									</div>
								</div>
							)}
						</div>

						<div className="flex items-start gap-6">
							<div
								className={`grid grid-cols-3 grid-rows-3 relative ${
									teacherFocus ? 'z-20' : ''
								} gap-4 -ml-4`}>
								<div className="col-start-2 row-start-1 flex justify-center">
									<SeatPanel
										id="N"
										highlight={teacherFocus}
										remaining={remaining}
										turnSeat={turnSeat}
										trick={trick}
										onPlay={onPlayCard}
										visible={seatVisible('N')}
										dealer={current?.dealer}
										vul={current?.vul}
										declarer={effDeclarer}
										showHCP={
											hideDefenders &&
											(effDeclarer === 'N' || partnerOf(effDeclarer) === 'N')
										}
										lastAutoSeat={lastAutoSeat}
										openingLeader={history.length === 0 && openingLeader === 'N'}
										playStarted={playStarted}
										openingLeadPulse={openingLeadPulse && openingLeader === 'N'}
									/>
								</div>
								{(effContract || current?.auction?.length) && (
									<div className="col-start-3 row-start-1 flex justify-start items-start">
										<AuctionGraphic
											auction={current?.auction || []}
											dealer={current?.auctionDealer || current?.dealer}
											contract={effContract}
											declarer={effDeclarer}
										/>
									</div>
								)}
								<div className="col-start-1 row-start-2 flex justify-center items-center">
									<SeatPanel
										id="W"
										highlight={teacherFocus}
										remaining={remaining}
										turnSeat={turnSeat}
										trick={trick}
										onPlay={onPlayCard}
										visible={seatVisible('W')}
										dealer={current?.dealer}
										vul={current?.vul}
										declarer={effDeclarer}
										showHCP={
											hideDefenders &&
											(effDeclarer === 'W' || partnerOf(effDeclarer) === 'W')
										}
										lastAutoSeat={lastAutoSeat}
										openingLeader={history.length === 0 && openingLeader === 'W'}
										playStarted={playStarted}
										openingLeadPulse={openingLeadPulse && openingLeader === 'W'}
									/>
								</div>
								<div className="col-start-3 row-start-2 flex justify-center items-center">
									<SeatPanel
										id="E"
										highlight={teacherFocus}
										remaining={remaining}
										turnSeat={turnSeat}
										trick={trick}
										onPlay={onPlayCard}
										visible={seatVisible('E')}
										dealer={current?.dealer}
										vul={current?.vul}
										declarer={effDeclarer}
										showHCP={
											hideDefenders &&
											(effDeclarer === 'E' || partnerOf(effDeclarer) === 'E')
										}
										lastAutoSeat={lastAutoSeat}
										openingLeader={history.length === 0 && openingLeader === 'E'}
										playStarted={playStarted}
										openingLeadPulse={openingLeadPulse && openingLeader === 'E'}
									/>
								</div>
								<div className="col-start-2 row-start-3 flex justify-center">
									<SeatPanel
										id="S"
										highlight={teacherFocus}
										remaining={remaining}
										turnSeat={turnSeat}
										trick={trick}
										onPlay={onPlayCard}
										visible={seatVisible('S')}
										dealer={current?.dealer}
										vul={current?.vul}
										declarer={effDeclarer}
										showHCP={
											hideDefenders &&
											(effDeclarer === 'S' || partnerOf(effDeclarer) === 'S')
										}
										lastAutoSeat={lastAutoSeat}
										openingLeader={history.length === 0 && openingLeader === 'S'}
										playStarted={playStarted}
										openingLeadPulse={openingLeadPulse && openingLeader === 'S'}
									/>
								</div>
								<div className="col-start-2 row-start-2 flex items-center justify-center">
									<CrossTrick
										trick={trick}
										winner={flashWinner}
										turnSeat={turnSeat}
										lastAutoPlay={lastAutoPlay}
										highlight={teacherFocus}
										openingLeader={history.length === 0 ? openingLeader : null}
									/>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

