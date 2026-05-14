import { Fragment, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BoardZ } from '../schemas/board'
import { exportBoardPBN } from '../pbn/export'
import ManualBoardBuilder from '../generator-v2/ManualBoardBuilder'
import {
	ACOL_PROFILE_OPTIONS,
	DEFAULT_ACOL_SETTINGS,
	SEATS,
	SUITS,
	SYLLABUS_GROUPS,
	acolSettingsSummary,
	boardToExportShape,
	createGenerator2SessionSnapshot,
	generateGenerator2Boards,
	hcp,
	normalizeAcolSettings,
	partnershipHcp,
	settingsForAcolProfile,
	suitLengths,
} from '../generator-v2/generatorV2Engine'

const DEFAULT_COUNT = 8
const DEFAULT_META = {
	event: 'Club Teaching session',
	site: 'Bristol Bridge Club',
	system: 'ACOL 12-14 1NT',
	scoring: 'MPs',
}
const PLAYER_HANDOFF_KEY = 'ralph-player-handoff-v1'
const GENERATOR_STATE_KEY = 'ralph-generator2-state-v1'

const suitTone = {
	S: 'text-slate-950',
	H: 'text-rose-700',
	D: 'text-rose-700',
	C: 'text-slate-950',
}

function vulnerabilityTone(vul, seat) {
	if (vul === 'All') return 'border-rose-200 bg-rose-50'
	if (vul === 'None') return 'border-emerald-100 bg-emerald-50'
	if (vul === 'NS' && (seat === 'N' || seat === 'S')) return 'border-rose-200 bg-rose-50'
	if (vul === 'EW' && (seat === 'E' || seat === 'W')) return 'border-rose-200 bg-rose-50'
	return 'border-slate-200 bg-white'
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

function normalizeAuctionText(text) {
	return String(text || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((call) => {
			const upper = call.toUpperCase()
			if (upper === 'PASS') return 'P'
			return upper
		})
}

function topicFromId(id) {
	for (const group of SYLLABUS_GROUPS) {
		const topic = group.topics.find((item) => item.id === id)
		if (topic) return topic
	}
	return SYLLABUS_GROUPS[0].topics[0]
}

function readGeneratorState() {
	if (typeof window === 'undefined') return {}
	try {
		return JSON.parse(window.sessionStorage.getItem(GENERATOR_STATE_KEY) || '{}')
	} catch {
		return {}
	}
}

function rankOrder(rank) {
	const order = { A: 14, K: 13, Q: 12, J: 11, 10: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 }
	return order[rank] || 0
}

function SeatHand({ seat, cards, vul }) {
	const lengths = suitLengths(cards)
	return (
		<div className={`rounded-lg border p-3 shadow-sm ${vulnerabilityTone(vul, seat)}`}>
			<div className="mb-2 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-sm font-black text-white">
						{seat}
					</span>
					<span className="text-sm font-bold text-slate-900">HCP {hcp(cards)}</span>
				</div>
					<span className="text-xs font-semibold text-slate-600">
					{lengths.S}-{lengths.H}-{lengths.D}-{lengths.C}
				</span>
			</div>
			<div className="space-y-1.5">
				{SUITS.map((suit) => {
					const ranks = [...cards]
						.filter((card) => card.suitKey === suit.key)
						.sort((a, b) => rankOrder(b.rank) - rankOrder(a.rank))
					return (
						<div key={suit.key} className="grid grid-cols-[1.5rem_1fr] items-center gap-2">
							<span className={`text-sm font-black ${suitTone[suit.key]}`}>{suit.label}</span>
							<div className="min-h-7 rounded-md bg-slate-50 px-2 py-1 font-mono text-lg font-bold leading-tight text-slate-900">
								{ranks.length ? ranks.map((card) => card.rank).join(' ') : '-'}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function BoardDiagram({ board }) {
	return (
		<div className="grid gap-3 lg:grid-cols-[1fr_1.08fr_1fr]">
				<div className="lg:col-start-2">
				<SeatHand seat="N" cards={board.hands.N} vul={board.vul} />
			</div>
			<div className="lg:col-start-1">
				<SeatHand seat="W" cards={board.hands.W} vul={board.vul} />
			</div>
			<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<div className="grid grid-cols-2 gap-3 text-center">
					<div className="rounded-md bg-white p-3 shadow-sm">
						<div className="text-xs font-bold uppercase tracking-wide text-slate-500">N/S</div>
						<div className="text-2xl font-black text-slate-900">{partnershipHcp(board.hands, 'NS')}</div>
					</div>
					<div className="rounded-md bg-white p-3 shadow-sm">
						<div className="text-xs font-bold uppercase tracking-wide text-slate-500">E/W</div>
						<div className="text-2xl font-black text-slate-900">{partnershipHcp(board.hands, 'EW')}</div>
					</div>
					<div className="rounded-md bg-white p-3 shadow-sm">
						<div className="text-xs font-bold uppercase tracking-wide text-slate-500">Dealer</div>
						<div className="text-2xl font-black text-emerald-700">{board.dealer}</div>
					</div>
					<div className="rounded-md bg-white p-3 shadow-sm">
						<div className="text-xs font-bold uppercase tracking-wide text-slate-500">Vul</div>
						<div className="text-2xl font-black text-rose-700">{board.vul}</div>
					</div>
				</div>
			</div>
			<div className="lg:col-start-3 lg:row-start-2">
				<SeatHand seat="E" cards={board.hands.E} vul={board.vul} />
			</div>
			<div className="lg:col-start-2">
				<SeatHand seat="S" cards={board.hands.S} vul={board.vul} />
			</div>
		</div>
	)
}

function BoardReviewCard({ board, onUpdate, onRegenerate, onPlay }) {
	const callCount = normalizeAuctionText(board.auctionText).length
	const suggestedAuction = String(board.suggestedAuctionText || '').trim()
	return (
		<article className="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-lg font-black text-slate-950">Board {board.number}</h2>
						<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
							{board.topicTitle}
						</span>
						{board.quality === 'fallback' && (
							<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
								Fallback
							</span>
						)}
					</div>
					<p className="mt-1 text-sm font-medium text-slate-500">
						Dealer {board.dealer} - Vul {board.vul} - {callCount || 'No'} auction calls
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
						<input
							type="checkbox"
							checked={board.keep}
							onChange={(event) => onUpdate({ keep: event.target.checked })}
						/>
						Keep
					</label>
					<button
						type="button"
						onClick={onRegenerate}
						className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">
						Regenerate
					</button>
					<button
						type="button"
						onClick={onPlay}
						className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800">
						Play
					</button>
				</div>
			</header>
			<div className="grid gap-4 p-4 xl:grid-cols-[1.35fr_0.85fr]">
				<BoardDiagram board={board} />
				<div className="space-y-4">
					<label className="block">
						<span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
							Auction For Export
						</span>
						<textarea
							value={board.auctionText}
							onChange={(event) => onUpdate({ auctionText: event.target.value })}
							rows={4}
							placeholder="Optional - leave blank and adjust in the Player"
							className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-semibold text-slate-900 shadow-inner outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
						/>
					</label>
					{suggestedAuction && (
						<div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
							<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
								<span className="text-xs font-black uppercase tracking-wide text-sky-800">
									Suggested Auction
								</span>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => onUpdate({ auctionText: suggestedAuction })}
										className="rounded-md bg-sky-700 px-2.5 py-1.5 text-xs font-black text-white hover:bg-sky-800">
										Use
									</button>
									<button
										type="button"
										onClick={() => onUpdate({ auctionText: '', suggestedAuctionText: '', suggestedAuction: [] })}
										className="rounded-md border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-black text-sky-800 hover:bg-sky-100">
										Clear
									</button>
								</div>
							</div>
							<div className="rounded-md bg-white px-2 py-1 font-mono text-sm font-bold text-slate-900">
								{suggestedAuction}
							</div>
						</div>
					)}
					<label className="block">
						<span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
							Teacher Notes
						</span>
						<textarea
							value={board.notes}
							onChange={(event) => onUpdate({ notes: event.target.value })}
							rows={7}
							className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium leading-relaxed text-slate-900 shadow-inner outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
						/>
					</label>
				</div>
			</div>
		</article>
	)
}

function Field({ label, children }) {
	return (
		<label className="block">
			<span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
				{label}
			</span>
			{children}
		</label>
	)
}

function NumberInput(props) {
	return (
		<input
			type="number"
			className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
			{...props}
		/>
	)
}

function TextInput(props) {
	return (
		<input
			type="text"
			className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
			{...props}
		/>
	)
}

function Select(props) {
	return (
		<select
			className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
			{...props}
		/>
	)
}

function MiniField({ label, children }) {
	return (
		<label className="block">
			<span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
				{label}
			</span>
			{children}
		</label>
	)
}

function MiniNumberInput(props) {
	return (
		<input
			type="number"
			className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
			{...props}
		/>
	)
}

function MiniSelect(props) {
	return (
		<select
			className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
			{...props}
		/>
	)
}

function MiniToggle({ label, checked, onChange, disabled = false }) {
	return (
		<label className={`flex h-7 items-center justify-between gap-2 rounded-md bg-slate-50 px-2 text-xs font-black text-slate-800 ${
			disabled ? 'opacity-45' : ''
		}`}>
			<span className="truncate">{label}</span>
			<input
				type="checkbox"
				checked={!!checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
			/>
		</label>
	)
}

function MiniRange({ label, minLabel, maxLabel, minValue, maxValue, min, max, disabled = false, onMinChange, onMaxChange }) {
	return (
		<div className={`grid grid-cols-[4.2rem_1fr_1fr] items-center gap-1 ${disabled ? 'opacity-45' : ''}`}>
			<div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</div>
			<MiniNumberInput
				aria-label={minLabel}
				min={min}
				max={max}
				value={minValue}
				disabled={disabled}
				onChange={(event) => onMinChange(Number(event.target.value))}
			/>
			<MiniNumberInput
				aria-label={maxLabel}
				min={min}
				max={max}
				value={maxValue}
				disabled={disabled}
				onChange={(event) => onMaxChange(Number(event.target.value))}
			/>
		</div>
	)
}

function MiniSingleNumber({ label, inputLabel, value, min, max, disabled = false, onChange }) {
	return (
		<div className={`grid grid-cols-[4.2rem_1fr] items-center gap-1 ${disabled ? 'opacity-45' : ''}`}>
			<div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</div>
			<MiniNumberInput
				aria-label={inputLabel}
				min={min}
				max={max}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(Number(event.target.value))}
			/>
		</div>
	)
}

function AcolInfoTooltip({ settings }) {
	const lines = acolSettingsSummary(settings)
	return (
		<div className="group relative">
			<button
				type="button"
				aria-label="Active ACOL conventions"
				className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-slate-50 text-xs font-black text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-100">
				i
			</button>
			<div className="pointer-events-none absolute right-0 top-9 z-20 hidden w-80 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl group-hover:block group-focus-within:block">
				<div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
					Active Conventions
				</div>
				<div className="space-y-1 text-xs font-semibold leading-snug text-slate-700">
					{lines.map((line) => (
						<p key={line}>{line}</p>
					))}
					<p className="pt-1 font-black text-slate-900">
						Change these in ACOL Defaults.
					</p>
				</div>
			</div>
		</div>
	)
}

export default function GeneratorV2() {
	const navigate = useNavigate()
	const restored = useMemo(() => readGeneratorState(), [])
	const seenRef = useRef(new Set())
	const [presetId, setPresetId] = useState(restored.presetId || 'one_nt_mixed')
	const [count, setCount] = useState(restored.count || DEFAULT_COUNT)
	const [startBoard, setStartBoard] = useState(restored.startBoard || 1)
	const [dealerMode, setDealerMode] = useState(restored.dealerMode || 'cycle')
	const [dealerSeat, setDealerSeat] = useState(restored.dealerSeat || 'N')
	const [auctionMode, setAuctionMode] = useState(restored.auctionMode || 'suggest')
	const [dealer4Mode, setDealer4Mode] = useState(restored.dealer4Mode ?? true)
	const [meta, setMeta] = useState(restored.meta || { ...DEFAULT_META, date: todayPbnDate() })
	const [acolSettings, setAcolSettings] = useState(() => normalizeAcolSettings(restored.acolSettings || DEFAULT_ACOL_SETTINGS))
	const [constraints, setConstraints] = useState(restored.constraints || {
		hcpRanges: {
			N: { min: 0, max: 37 },
			E: { min: 0, max: 37 },
			S: { min: 0, max: 37 },
			W: { min: 0, max: 37 },
		},
		nsMin: 0,
		nsMax: 40,
		ewMin: 0,
		ewMax: 40,
	})
	const [boards, setBoards] = useState(restored.boards || [])
	const [warnings, setWarnings] = useState(restored.warnings || [])
	const [status, setStatus] = useState(restored.status || 'Choose a topic, then generate a set.')

	const selectedTopic = useMemo(() => topicFromId(presetId), [presetId])
	const keptBoards = boards.filter((board) => board.keep)
	const nextBoardNumber = useMemo(() => {
		if (!boards.length) return Number(startBoard) || 1
		return Math.max(...boards.map((board) => Number(board.number) || 0)) + 1
	}, [boards, startBoard])

	const generateSet = () => {
		const result = generateGenerator2Boards({
			presetId,
			count,
			startBoard: Number(startBoard) || 1,
			dealerMode,
			dealerSeat,
			auctionMode,
			acolSettings,
			constraints,
			seen: seenRef.current,
		})
		setBoards(result.boards)
		setWarnings(result.warnings)
		setStatus(`Generated ${result.boards.length} boards after ${result.attempts.toLocaleString()} attempts.`)
	}

	const updateBoard = (id, patch) => {
		setBoards((items) =>
			items.map((board) => (board.id === id ? { ...board, ...patch } : board)),
		)
	}

	const regenerateBoard = (board) => {
		const result = generateGenerator2Boards({
			presetId: board.topicId,
			count: 1,
			startBoard: Number(board.number) || 1,
			dealerMode: 'fixed',
			dealerSeat: board.dealer,
			auctionMode,
			acolSettings,
			constraints,
			seen: seenRef.current,
		})
		setBoards((items) => items.map((item) => (item.id === board.id ? result.boards[0] : item)))
		setWarnings(result.warnings)
		setStatus(`Regenerated board ${board.number}.`)
	}

	const updateHcpRange = (seat, field, value) => {
		setConstraints((current) => ({
			...current,
			hcpRanges: {
				...current.hcpRanges,
				[seat]: {
					...current.hcpRanges[seat],
					[field]: value,
				},
			},
		}))
	}

	const updateAcolSetting = (key, value) => {
		setAcolSettings((current) => normalizeAcolSettings({
			...current,
			profile: 'custom',
			[key]: value,
		}))
	}

	const updateAcolProfile = (profile) => {
		setAcolSettings(normalizeAcolSettings(settingsForAcolProfile(profile)))
	}

	const addManualBoard = (board) => {
		setBoards((items) => [...items, board])
		setWarnings([])
		setStatus(`Added board ${board.number}.`)
	}

	const buildPbnForBoards = async (items, options = {}) => {
		const pbnParts = []
		for (const board of items) {
			const shape = boardToExportShape(
				{
					...board,
					number: Number(board.number) || 1,
					auctionText: normalizeAuctionText(board.auctionText).join(' '),
				},
				meta,
			)
			const parsed = BoardZ.parse(shape)
			pbnParts.push(await exportBoardPBN(parsed, { dealer4Mode: options.dealer4Mode ?? dealer4Mode }))
		}
		return pbnParts.join('')
	}

	const exportPbn = async () => {
		if (!keptBoards.length) return
		try {
			const pbn = await buildPbnForBoards(keptBoards)
			downloadText(pbn, `bbc-generator2-${todayFileDate()}.pbn`)
			setStatus(`Downloaded ${keptBoards.length} boards as PBN.`)
		} catch (error) {
			console.error('Generator 2 PBN export failed', error)
			setStatus('PBN export failed. Check the auction tokens and try again.')
		}
	}

	const playBoards = async (items, label = 'Generator 2') => {
		if (!items.length) return
		try {
			const pbn = await buildPbnForBoards(items, { dealer4Mode: false })
			window.sessionStorage.setItem(
				GENERATOR_STATE_KEY,
				JSON.stringify(createGenerator2SessionSnapshot({
					presetId,
					count,
					startBoard,
					dealerMode,
					dealerSeat,
					auctionMode,
					dealer4Mode,
					meta,
					acolSettings,
					constraints,
					boards,
					warnings,
					status,
				})),
			)
			window.sessionStorage.setItem(
				PLAYER_HANDOFF_KEY,
				JSON.stringify({
					pbn,
					name: `${label} (${items.length} board${items.length === 1 ? '' : 's'})`,
					sourcePath: '/generator-v2',
				}),
			)
			navigate('/player')
		} catch (error) {
			console.error('Generator 2 player handoff failed', error)
			setStatus('Could not open this board in the Player. Check the auction tokens and try again.')
		}
	}

	const exportPdf = async () => {
		if (!keptBoards.length) return
		try {
			const { generateGenerator2Pdf } = await import('../generator-v2/generator2Pdf')
			await generateGenerator2Pdf(
				keptBoards.map((board) => ({
					...board,
					auctionText: normalizeAuctionText(board.auctionText).join(' '),
				})),
				meta,
			)
			setStatus(`Downloaded ${keptBoards.length} boards as a compact teacher PDF.`)
		} catch (error) {
			console.error('Generator 2 PDF export failed', error)
			setStatus('PDF export failed. Check the board notes and try again.')
		}
	}

	return (
		<div className="min-h-screen bg-slate-100 text-slate-950">
			<header className="border-b border-slate-200 bg-white">
				<div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-5 py-4">
					<div>
						<h1 className="text-2xl font-black tracking-tight text-slate-950">Generator 2</h1>
						<p className="text-sm font-medium text-slate-500">
							Teaching sets for physical boards, PBN export and teacher PDFs.
						</p>
					</div>
					<nav className="flex flex-wrap items-center gap-2 text-sm font-bold">
						<Link to="/" className="rounded-md bg-slate-100 px-3 py-2 text-slate-800 hover:bg-slate-200">
							Home
						</Link>
						<Link to="/player" className="rounded-md bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800">
							Player
						</Link>
					</nav>
				</div>
			</header>

			<main className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 xl:grid-cols-[370px_1fr]">
				<aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
					<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="mb-4 flex items-start justify-between gap-3">
							<div>
								<h2 className="text-lg font-black text-slate-950">Teaching Brief</h2>
								<p className="mt-1 text-sm font-medium text-slate-500">{selectedTopic.description}</p>
							</div>
						</div>
						<div className="space-y-3">
							<Field label="Topic">
								<Select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
									{SYLLABUS_GROUPS.map((group) => (
										<optgroup key={group.level} label={group.level}>
											{group.topics.map((topic) => (
												<option key={topic.id} value={topic.id}>
													{topic.title}
												</option>
											))}
										</optgroup>
									))}
								</Select>
							</Field>
							<div className="grid grid-cols-3 gap-2">
								<Field label="Boards">
									<NumberInput min="1" max="48" value={count} onChange={(event) => setCount(event.target.value)} />
								</Field>
								<Field label="Start">
									<NumberInput min="1" value={startBoard} onChange={(event) => setStartBoard(event.target.value)} />
								</Field>
								<Field label="Dealer">
									<Select value={dealerMode === 'fixed' ? dealerSeat : 'cycle'} onChange={(event) => {
										if (event.target.value === 'cycle') setDealerMode('cycle')
										else {
											setDealerMode('fixed')
											setDealerSeat(event.target.value)
										}
									}}>
										<option value="cycle">Cycle</option>
										{SEATS.map((seat) => (
											<option key={seat} value={seat}>{seat}</option>
										))}
									</Select>
								</Field>
							</div>
							<Field label="Auction">
								<div className="grid grid-cols-3 gap-2">
									<button
										type="button"
										onClick={() => setAuctionMode('suggest')}
										className={`rounded-md px-3 py-2 text-sm font-black ${
											auctionMode === 'suggest'
												? 'bg-slate-900 text-white'
												: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
										}`}>
										Suggest
									</button>
									<button
										type="button"
										onClick={() => setAuctionMode('auto')}
										className={`rounded-md px-3 py-2 text-sm font-black ${
											auctionMode === 'auto'
												? 'bg-slate-900 text-white'
												: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
										}`}>
										Apply
									</button>
									<button
										type="button"
										onClick={() => setAuctionMode('blank')}
										className={`rounded-md px-3 py-2 text-sm font-black ${
											auctionMode === 'blank'
												? 'bg-slate-900 text-white'
												: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
										}`}>
										Blank
									</button>
								</div>
								<p className="mt-1 text-xs font-semibold text-slate-500">
									Suggest keeps the auction optional; Apply fills it automatically.
								</p>
							</Field>
							<button
								type="button"
								onClick={generateSet}
								className="w-full rounded-lg bg-sky-700 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-sky-800">
								Generate Set
							</button>
						</div>
					</section>

					<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="mb-3 flex items-center justify-between gap-3">
							<h2 className="text-lg font-black text-slate-950">ACOL Defaults</h2>
							<AcolInfoTooltip settings={acolSettings} />
						</div>
						<div className="grid gap-2">
							<MiniField label="Profile">
								<MiniSelect value={acolSettings.profile} onChange={(event) => updateAcolProfile(event.target.value)}>
									{ACOL_PROFILE_OPTIONS.map((profile) => (
										<option key={profile.id} value={profile.id}>
											{profile.label}
										</option>
									))}
								</MiniSelect>
							</MiniField>
							<MiniRange
								label="1NT"
								minLabel="1NT Min"
								maxLabel="1NT Max"
								min="10"
								max="18"
								minValue={acolSettings.oneNtMin}
								maxValue={acolSettings.oneNtMax}
								onMinChange={(value) => updateAcolSetting('oneNtMin', value)}
								onMaxChange={(value) => updateAcolSetting('oneNtMax', value)}
							/>
							<MiniRange
								label="2NT"
								minLabel="2NT Min"
								maxLabel="2NT Max"
								min="18"
								max="24"
								minValue={acolSettings.twoNtMin}
								maxValue={acolSettings.twoNtMax}
								onMinChange={(value) => updateAcolSetting('twoNtMin', value)}
								onMaxChange={(value) => updateAcolSetting('twoNtMax', value)}
							/>
							<div className="grid grid-cols-2 gap-2">
								<MiniField label="Majors">
									<MiniSelect value={acolSettings.majorStyle} onChange={(event) => updateAcolSetting('majorStyle', event.target.value)}>
										<option value="five_card">5-card</option>
										<option value="four_card">4-card</option>
									</MiniSelect>
								</MiniField>
								<MiniField label="2C Style">
									<MiniSelect value={acolSettings.strongTwoStyle} onChange={(event) => updateAcolSetting('strongTwoStyle', event.target.value)}>
										<option value="strong_2c">Strong 2C</option>
										<option value="benjaminised">Benjaminised</option>
										<option value="off">Off</option>
									</MiniSelect>
								</MiniField>
							</div>
							<MiniSingleNumber
								label="2C Min"
								inputLabel="2C Min"
								min="16"
								max="30"
								value={acolSettings.strongTwoClubMin}
								disabled={acolSettings.strongTwoStyle !== 'strong_2c'}
								onChange={(value) => updateAcolSetting('strongTwoClubMin', value)}
							/>
							<MiniRange
								label="Weak 2"
								minLabel="Weak Two Min"
								maxLabel="Weak Two Max"
								min="0"
								max="15"
								minValue={acolSettings.weakTwoMin}
								maxValue={acolSettings.weakTwoMax}
								disabled={!acolSettings.weakTwos}
								onMinChange={(value) => updateAcolSetting('weakTwoMin', value)}
								onMaxChange={(value) => updateAcolSetting('weakTwoMax', value)}
							/>
							<MiniRange
								label="Weak 3"
								minLabel="Weak Three Min"
								maxLabel="Weak Three Max"
								min="0"
								max="15"
								minValue={acolSettings.weakThreeMin}
								maxValue={acolSettings.weakThreeMax}
								disabled={!acolSettings.weakThrees}
								onMinChange={(value) => updateAcolSetting('weakThreeMin', value)}
								onMaxChange={(value) => updateAcolSetting('weakThreeMax', value)}
							/>
							<div className="grid grid-cols-2 gap-1.5">
								<MiniToggle label="1NT Stayman" checked={acolSettings.oneNtStayman} onChange={(value) => updateAcolSetting('oneNtStayman', value)} />
								<MiniToggle label="1NT Transfers" checked={acolSettings.oneNtTransfers} onChange={(value) => updateAcolSetting('oneNtTransfers', value)} />
								<MiniToggle label="2NT Stayman" checked={acolSettings.twoNtStayman} onChange={(value) => updateAcolSetting('twoNtStayman', value)} />
								<MiniToggle label="2NT Transfers" checked={acolSettings.twoNtTransfers} onChange={(value) => updateAcolSetting('twoNtTransfers', value)} />
								<MiniToggle label="Weak Twos" checked={acolSettings.weakTwos} onChange={(value) => updateAcolSetting('weakTwos', value)} />
								<MiniToggle label="Weak Threes" checked={acolSettings.weakThrees} onChange={(value) => updateAcolSetting('weakThrees', value)} />
								<MiniToggle label="Overcalls" checked={acolSettings.overcalls} onChange={(value) => updateAcolSetting('overcalls', value)} />
								<MiniToggle label="Takeout X" checked={acolSettings.takeoutDoubles} onChange={(value) => updateAcolSetting('takeoutDoubles', value)} />
								<MiniToggle label="Negative X" checked={acolSettings.negativeDoubles} onChange={(value) => updateAcolSetting('negativeDoubles', value)} />
								<MiniToggle label="Gerber" checked={acolSettings.gerber} onChange={(value) => updateAcolSetting('gerber', value)} />
								<MiniToggle label="Blackwood" checked={acolSettings.blackwood} onChange={(value) => updateAcolSetting('blackwood', value)} />
								<MiniToggle label="4SF" checked={acolSettings.fourthSuitForcing} onChange={(value) => updateAcolSetting('fourthSuitForcing', value)} />
							</div>
						</div>
					</section>

					<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="mb-3">
							<h2 className="text-lg font-black text-slate-950">Custom Constraints</h2>
						</div>
						<div className="grid grid-cols-[2rem_1fr_1fr] gap-2">
							<div />
							<div className="text-xs font-black uppercase tracking-wide text-slate-500">Min</div>
							<div className="text-xs font-black uppercase tracking-wide text-slate-500">Max</div>
							{SEATS.map((seat) => (
								<Fragment key={seat}>
									<div key={`${seat}-label`} className="grid h-9 place-items-center rounded-md bg-slate-900 text-sm font-black text-white">
										{seat}
									</div>
									<NumberInput key={`${seat}-min`} min="0" max="37" value={constraints.hcpRanges[seat].min} onChange={(event) => updateHcpRange(seat, 'min', event.target.value)} />
									<NumberInput key={`${seat}-max`} min="0" max="37" value={constraints.hcpRanges[seat].max} onChange={(event) => updateHcpRange(seat, 'max', event.target.value)} />
								</Fragment>
							))}
						</div>
						<div className="mt-3 grid grid-cols-2 gap-2">
							<Field label="N/S Min">
								<NumberInput min="0" max="40" value={constraints.nsMin} onChange={(event) => setConstraints((current) => ({ ...current, nsMin: event.target.value }))} />
							</Field>
							<Field label="N/S Max">
								<NumberInput min="0" max="40" value={constraints.nsMax} onChange={(event) => setConstraints((current) => ({ ...current, nsMax: event.target.value }))} />
							</Field>
							<Field label="E/W Min">
								<NumberInput min="0" max="40" value={constraints.ewMin} onChange={(event) => setConstraints((current) => ({ ...current, ewMin: event.target.value }))} />
							</Field>
							<Field label="E/W Max">
								<NumberInput min="0" max="40" value={constraints.ewMax} onChange={(event) => setConstraints((current) => ({ ...current, ewMax: event.target.value }))} />
							</Field>
						</div>
					</section>

					<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<h2 className="mb-3 text-lg font-black text-slate-950">Session Details</h2>
						<div className="space-y-3">
							<Field label="Event">
								<TextInput value={meta.event} onChange={(event) => setMeta((current) => ({ ...current, event: event.target.value }))} />
							</Field>
							<Field label="Site">
								<TextInput value={meta.site} onChange={(event) => setMeta((current) => ({ ...current, site: event.target.value }))} />
							</Field>
							<div className="grid grid-cols-2 gap-2">
								<Field label="Date">
									<TextInput value={meta.date} onChange={(event) => setMeta((current) => ({ ...current, date: event.target.value }))} />
								</Field>
								<Field label="Scoring">
									<Select value={meta.scoring} onChange={(event) => setMeta((current) => ({ ...current, scoring: event.target.value }))}>
										<option value="MPs">MPs</option>
										<option value="IMPs">IMPs</option>
									</Select>
								</Field>
							</div>
							<Field label="System">
								<TextInput value={meta.system} onChange={(event) => setMeta((current) => ({ ...current, system: event.target.value }))} />
							</Field>
							<label className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
								<span>Dealer4 compact PBN</span>
								<input type="checkbox" checked={dealer4Mode} onChange={(event) => setDealer4Mode(event.target.checked)} />
							</label>
						</div>
					</section>
				</aside>

				<section className="space-y-4">
					<ManualBoardBuilder
						nextBoardNumber={nextBoardNumber}
						onAddBoard={addManualBoard}
						onStatus={setStatus}
					/>

					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 className="text-lg font-black text-slate-950">Generated Boards</h2>
								<p className="mt-1 text-sm font-semibold text-slate-500">{status}</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									disabled={!keptBoards.length}
									onClick={exportPbn}
									className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">
									Export PBN
								</button>
								<button
									type="button"
									disabled={!keptBoards.length}
									onClick={exportPdf}
									className="rounded-md bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40">
									Export PDF
								</button>
								<button
									type="button"
									disabled={!keptBoards.length}
									onClick={() => playBoards(keptBoards, 'Generator 2 kept boards')}
									className="rounded-md bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
									Play Kept
								</button>
							</div>
						</div>
						{warnings.length > 0 && (
							<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
								{warnings.map((warning) => (
									<p key={warning}>{warning}</p>
								))}
							</div>
						)}
					</div>

					{boards.length ? (
						boards.map((board) => (
							<BoardReviewCard
								key={board.id}
								board={board}
								onUpdate={(patch) => updateBoard(board.id, patch)}
								onRegenerate={() => regenerateBoard(board)}
								onPlay={() => playBoards([board], `Generator 2 board ${board.number}`)}
							/>
						))
					) : (
						<div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
							<h2 className="text-xl font-black text-slate-900">No boards yet</h2>
							<p className="mx-auto mt-2 max-w-xl text-sm font-medium text-slate-500">
								Generator 2 starts from a teaching topic or a custom HCP pattern. Generate a set, review the auctions and notes, then export PBN and PDF.
							</p>
							<button
								type="button"
								onClick={generateSet}
								className="mt-5 rounded-lg bg-sky-700 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-sky-800">
								Generate First Set
							</button>
						</div>
					)}
				</section>
			</main>
		</div>
	)
}
