import { useEffect, useMemo, useRef, useState } from 'react'
// Accessible tooltip component with improved background coverage & wrapping
function Tooltip({ label, children, className = '' }) {
	return (
		<span className={`relative group inline-flex ${className}`}>
			{children}
			{label && (
				<span
					role="tooltip"
					className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute z-50 -top-1.5 left-1/2 -translate-x-1/2 -translate-y-full bg-gray-900/95 backdrop-blur-sm text-white text-[11px] leading-tight px-2.5 py-1.5 rounded-md shadow-xl whitespace-pre-line break-words max-w-[220px] ring-1 ring-black/40"
					style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.35)' }}>
					{label}
				</span>
			)}
		</span>
	)
}
import { BoardZ } from './schemas/board'
import { exportBoardPBN } from './pbn/export'
import { parsePBN, sanitizePBN } from './lib/pbn'
import useIsIPhone from './hooks/useIsIPhone'
import {
	computeDealKeyFromEditor,
	computeMakeableGrid,
	getCachedGrid,
} from './lib/makeableGridWorker'
import { settings } from './lib/settings'

// Deck suit order: Clubs, Diamonds, Hearts, Spades (traditional CDHS)
const suits = [
	{ name: 'Clubs', symbol: '♣' },
	{ name: 'Diamonds', symbol: '♦' },
	{ name: 'Hearts', symbol: '♥' },
	{ name: 'Spades', symbol: '♠' },
]
const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

const initialCards = []
suits.forEach((suit, sIdx) => {
	ranks
		.slice()
		.reverse()
		.forEach((rank, rIdx) => {
			initialCards.push({
				id: sIdx * 13 + rIdx + 1,
				rank,
				label: `${rank}${suit.symbol}`,
				suit: suit.name,
				symbol: suit.symbol,
			})
		})
})

const SEATS = ['N', 'E', 'S', 'W']

// Dealer rotates N, E, S, W
function dealerForBoard(boardNo) {
	const map = ['N', 'E', 'S', 'W']
	return map[(boardNo - 1) % 4]
}

// Vulnerability follows the standard 16-board cycle
function vulnerabilityForBoard(boardNo) {
	const cycle = [
		'None', // 1
		'NS', // 2
		'EW', // 3
		'All', // 4
		'NS', // 5
		'EW', // 6
		'All', // 7
		'None', // 8
		'EW', // 9
		'All', // 10
		'None', // 11
		'NS', // 12
		'All', // 13
		'None', // 14
		'NS', // 15
		'EW', // 16
	]
	return cycle[(boardNo - 1) % 16]
}
// Partner theming: N/S share a style; E/W share a different style
const BUCKET_STYLES = {
	N: {
		title: 'NORTH',
		bg: 'bg-emerald-50',
		border: 'border-emerald-300',
		headerBg: 'bg-emerald-100',
		headerText: 'text-emerald-700',
		ring: 'ring-emerald-300',
	},
	S: {
		title: 'SOUTH',
		bg: 'bg-emerald-50',
		border: 'border-emerald-300',
		headerBg: 'bg-emerald-100',
		headerText: 'text-emerald-700',
		ring: 'ring-emerald-300',
	},
	E: {
		title: 'EAST',
		bg: 'bg-rose-50',
		border: 'border-rose-300',
		headerBg: 'bg-rose-100',
		headerText: 'text-rose-700',
		ring: 'ring-rose-300',
	},
	W: {
		title: 'WEST',
		bg: 'bg-rose-50',
		border: 'border-rose-300',
		headerBg: 'bg-rose-100',
		headerText: 'text-rose-700',
		ring: 'ring-rose-300',
	},
}

const SUIT_TEXT = {
	Hearts: 'text-red-600',
	Diamonds: 'text-red-600',
	Spades: 'text-black',
	Clubs: 'text-black',
}

// For seat display and PBN formatting
const SUIT_ORDER = ['Spades', 'Hearts', 'Diamonds', 'Clubs']

// --- PBN import helpers for editor ---
function parseDealToSeatStrings(dealStr) {
	// dealStr like: "N:KQT85.Q.KQT863.Q 32.A832.95.T9643 ..."
	const m = String(dealStr || '')
		.trim()
		.match(/^([NESW]):\s*(.+)$/)
	if (!m) return null
	const start = m[1]
	const rest = m[2].trim()
	const parts = rest.split(/\s+/)
	if (parts.length !== 4) return null
	const seats = ['N', 'E', 'S', 'W']
	const startIdx = seats.indexOf(start)
	const seatOrder = [
		seats[startIdx],
		seats[(startIdx + 1) % 4],
		seats[(startIdx + 2) % 4],
		seats[(startIdx + 3) % 4],
	]
	const seatToSuits = {}
	for (let i = 0; i < 4; i++) {
		const seat = seatOrder[i]
		const seg = parts[i]
		const [s, h, d, c] = seg.split('.').map((x) => x || '')
		const norm = (s) =>
			Array.from(s).map((ch) => (ch === 'T' ? '10' : ch.toUpperCase()))
		seatToSuits[seat] = {
			Spades: norm(s),
			Hearts: norm(h),
			Diamonds: norm(d),
			Clubs: norm(c),
		}
	}
	return seatToSuits
}

function buildBucketsFromDealString(dealStr) {
	const seatMap = parseDealToSeatStrings(dealStr)
	if (!seatMap) return null
	// Clone initial deck to remove as we place cards
	const deckCopy = initialCards.map((c) => ({ ...c }))
	const takeCard = (suitName, rank) => {
		const idx = deckCopy.findIndex(
			(c) => c.suit === suitName && c.rank === rank
		)
		if (idx === -1) return null
		const [card] = deckCopy.splice(idx, 1)
		return card
	}
	const buckets = { N: [], E: [], S: [], W: [] }
	for (const seat of SEATS) {
		const suits = seatMap[seat]
		if (!suits) return null
		for (const suitName of SUIT_ORDER) {
			for (const r of suits[suitName]) {
				const card = takeCard(suitName, r)
				if (!card) return null
				buckets[seat].push(card)
			}
		}
		if (buckets[seat].length !== 13) return null
	}
	return { buckets, remainingDeck: deckCopy }
}

function hcpOfCards(cards) {
	const pts = { A: 4, K: 3, Q: 2, J: 1 }
	return cards.reduce((sum, c) => sum + (pts[c.rank] || 0), 0)
}

const HCP_MAP = { A: 4, K: 3, Q: 2, J: 1 }
const hcpOfCard = (card) => HCP_MAP[card.rank] || 0

function sortByPbnRank(cards) {
	const order = {
		A: 13,
		K: 12,
		Q: 11,
		J: 10,
		10: 9,
		9: 8,
		8: 7,
		7: 6,
		6: 5,
		5: 4,
		4: 3,
		3: 2,
		2: 1,
	}
	return [...cards].sort((a, b) => order[b.rank] - order[a.rank])
}

// Deprecated string PBN builders were removed in favor of Extended PBN export
export default function DragDropCards({ meta, setMeta }) {
	// Unified deal state: deck + seat buckets
	const [deal, setDeal] = useState({
		deck: initialCards,
		buckets: { N: [], E: [], S: [], W: [] },
	})
	// DnD state
	const [draggedCard, setDraggedCard] = useState(null)
	const [dragSource, setDragSource] = useState(null) // 'deck' | 'N' | 'E' | 'S' | 'W' | null
	const [activeBucket, setActiveBucket] = useState(null)
	// Selection under deck
	const [selected, setSelected] = useState(() => new Set())
	// Saved hands as {N,E,S,W}
	const [savedHands, setSavedHands] = useState([]) // each item: {N,E,S,W, meta?}
	const [startBoard, setStartBoard] = useState(1)
	// Preview / copy state
	const [previewIndex, setPreviewIndex] = useState(0)
	const [copyState, setCopyState] = useState('idle') // idle | ok | err
	const [hintsEnabled, setHintsEnabled] = useState(true)
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const copyTimerRef = useRef(null)
	// PBN import session
	const [pbnImport, setPbnImport] = useState(null) // { filename, deals:[{deal, board, dealer, vul, auctionDealer, auctionTokens, ext}], index }
	const fileInputRef = useRef(null)

	const toPbnDate = (iso) => (iso ? String(iso).replace(/-/g, '.') : '')

	// Left controls panel state
	const [leftOpen, setLeftOpen] = useState(true)
	const isIPhone = useIsIPhone()
	const [activeSeat, setActiveSeat] = useState('N')
	// Makeable grid is always included in handouts now; no toggle state needed
	const [dealer4Mode, setDealer4Mode] = useState(true) // Export PBN in Dealer4-compatible mode
	// handoutMode deprecated – always full now
	const handoutMode = 'full'

	// Live Makeable grid state
	// Always present DDS values as overtricks (raw − 6)
	const [gridState, setGridState] = useState({ status: 'incomplete' }) // incomplete|computing|ready|error
	const [gridData, setGridData] = useState(null)
	const gridAbortRef = useRef({ token: 0 })

	// --- HCP Allocator state ---
	const [hcpEnabled, setHcpEnabled] = useState({
		N: false,
		E: false,
		S: false,
		W: false,
	})
	const [hcpTargets, setHcpTargets] = useState({ N: 10, E: 10, S: 10, W: 10 })
	const [hcpError, setHcpError] = useState('')
	// Optional shape constraints per seat (min combined lengths)
	const [shapeMajorsMin, setShapeMajorsMin] = useState({
		N: 0,
		E: 0,
		S: 0,
		W: 0,
	})
	const [shapeMinorsMin, setShapeMinorsMin] = useState({
		N: 0,
		E: 0,
		S: 0,
		W: 0,
	})
	const [shapeModal, setShapeModal] = useState({ open: false, message: '' })

	// Track if user has manually interacted with Theme select to avoid auto-clearing after selection
	const themeTouchedRef = useRef(false)
	useEffect(() => {
		// If initial meta (from parent) seeds a default theme we don't want, clear it once so blank placeholder shows.
		if (!themeTouchedRef.current) {
			const stayman = 'Bidding - Stayman & Transfers'
			if (meta?.themeChoice === stayman) {
				setMeta?.((m) => ({ ...m, themeChoice: '' }))
			}
		}
	}, [meta?.themeChoice, setMeta])

	// Removed previous auto-default to 'Custom…'; now start blank so user explicitly chooses a theme.

	// Keyboard entry mode
	const [kbMode, setKbMode] = useState(false)
	const [kbSeatIdx, setKbSeatIdx] = useState(0) // 0:N,1:E,2:S,3:W
	const [kbSuitIdx, setKbSuitIdx] = useState(0) // 0:Clubs,1:Diamonds,2:Hearts,3:Spades
	const [kbRanks, setKbRanks] = useState([]) // ranks buffer e.g. ['2','10','J','Q']
	// Refs for stable, up-to-date values in global key handler
	const kbModeRef = useRef(kbMode)
	const kbSeatRef = useRef(0)
	const kbSuitRef = useRef(0)
	const kbRanksRef = useRef([])
	const lastKeyRef = useRef({ key: null, t: 0 })
	const inFlightRef = useRef(false)
	// Deduplication for operations (seat+suit+rank) within a short window
	const lastOpRef = useRef({ op: null, t: 0 })
	// Seat lock state: prevents edits/randomization for locked seats
	const [lockedSeats, setLockedSeats] = useState({
		N: false,
		E: false,
		S: false,
		W: false,
	})
	const lockedRef = useRef(lockedSeats)
	useEffect(() => {
		lockedRef.current = lockedSeats
	}, [lockedSeats])
	const KB_SEATS = SEATS
	const KB_SUITS = ['Clubs', 'Diamonds', 'Hearts', 'Spades']

	const currentKbSeat = KB_SEATS[kbSeatIdx]
	const currentKbSuit = KB_SUITS[kbSuitIdx]

	// Keep refs in sync with state for robust global key handling
	useEffect(() => {
		kbModeRef.current = kbMode
	}, [kbMode])
	useEffect(() => {
		kbSeatRef.current = kbSeatIdx
	}, [kbSeatIdx])
	useEffect(() => {
		kbSuitRef.current = kbSuitIdx
	}, [kbSuitIdx])
	useEffect(() => {
		kbRanksRef.current = kbRanks
	}, [kbRanks])

	const resetKb = () => {
		setKbSeatIdx(0)
		setKbSuitIdx(0)
		setKbRanks([])
		kbSeatRef.current = 0
		kbSuitRef.current = 0
	}

	useEffect(() => {
		// Global singleton keyboard handler to avoid duplicates across HMR/StrictMode
		const handler = (e) => {
			if (!kbModeRef.current) return
			if (e.isComposing || e.repeat) return
			const tag = String(e.target?.tagName || '').toLowerCase()
			if (
				tag === 'input' ||
				tag === 'textarea' ||
				tag === 'select' ||
				e.target?.isContentEditable
			)
				return
			if (e.metaKey || e.ctrlKey || e.altKey) return
			// Guard against near-duplicate events for the same key
			const now = Date.now()
			const keyId = String(e.key || '').toLowerCase()
			if (inFlightRef.current) return
			if (
				lastKeyRef.current.key === keyId &&
				now - lastKeyRef.current.t < 200
			) {
				return
			}
			lastKeyRef.current = { key: keyId, t: now }
			const k = e.key
			if (k === 'Escape') {
				if (typeof e.stopImmediatePropagation === 'function')
					e.stopImmediatePropagation()
				e.stopPropagation()
				e.preventDefault()
				setKbMode(false)
				return
			}
			if (k === 'Enter') {
				if (typeof e.stopImmediatePropagation === 'function')
					e.stopImmediatePropagation()
				e.stopPropagation()
				e.preventDefault()
				inFlightRef.current = true
				queueMicrotask(() => {
					commitKbSelection()
					inFlightRef.current = false
				})
				return
			}
			if (k === 'Backspace') {
				if (typeof e.stopImmediatePropagation === 'function')
					e.stopImmediatePropagation()
				e.stopPropagation()
				e.preventDefault()
				inFlightRef.current = true
				queueMicrotask(() => {
					const seatAtKey = KB_SEATS[kbSeatRef.current]
					const suitAtKey = KB_SUITS[kbSuitRef.current]
					// Do not remove from locked seats via keyboard
					if (lockedRef.current[seatAtKey]) {
						inFlightRef.current = false
						return
					}
					const buf = kbRanksRef.current
					const last = buf[buf.length - 1]
					// Always trim buffer if present
					if (buf.length > 0) {
						setKbRanks((prev) => prev.slice(0, prev.length - 1))
					}
					if (!last) {
						inFlightRef.current = false
						return
					}
					setDeal((prev) => {
						const seatArr = prev.buckets[seatAtKey] || []
						const idx = seatArr.findIndex(
							(c) =>
								c.suit === suitAtKey &&
								(c.rank === last || (last === '10' && c.rank === '10'))
						)
						if (idx === -1) return prev
						const card = seatArr[idx]
						const nextSeat = seatArr.slice()
						nextSeat.splice(idx, 1)
						return {
							deck: sortDeck([...prev.deck, card]),
							buckets: { ...prev.buckets, [seatAtKey]: nextSeat },
						}
					})
					inFlightRef.current = false
				})
				return
			}
			const lower = k.toLowerCase()
			let rank = null
			if (/^[2-9]$/.test(lower)) rank = lower
			else if (lower === 't' || lower === '0') rank = '10'
			else if (lower === 'j') rank = 'J'
			else if (lower === 'q') rank = 'Q'
			else if (lower === 'k') rank = 'K'
			else if (lower === 'a') rank = 'A'
			if (rank) {
				if (typeof e.stopImmediatePropagation === 'function')
					e.stopImmediatePropagation()
				e.stopPropagation()
				e.preventDefault()
				// Capture seat/suit at the time of the keypress to avoid race with cursor advance
				const seatAtKey = KB_SEATS[kbSeatRef.current]
				const suitAtKey = KB_SUITS[kbSuitRef.current]
				// Deduplicate same seat/suit/rank within 300ms (before scheduling)
				const op = `${seatAtKey}-${suitAtKey}-${rank}`
				if (lastOpRef.current.op === op && now - lastOpRef.current.t < 300) {
					return
				}
				lastOpRef.current = { op, t: now }
				inFlightRef.current = true
				queueMicrotask(() => {
					addRankToCurrentSeat(rank, seatAtKey, suitAtKey)
					inFlightRef.current = false
				})
			}
		}
		try {
			const prev = window.__BBC_PBN_KB_HANDLER__
			if (prev) {
				window.removeEventListener('keydown', prev)
			}
			window.__BBC_PBN_KB_HANDLER__ = handler
			window.addEventListener('keydown', handler)
		} catch {
			window.addEventListener('keydown', handler)
		}
		return () => {
			window.removeEventListener('keydown', handler)
			try {
				if (window.__BBC_PBN_KB_HANDLER__ === handler) {
					delete window.__BBC_PBN_KB_HANDLER__
				}
			} catch {
				/* no-op */
			}
		}
	}, [])

	const advanceKbCursor = () => {
		const curSuit = kbSuitRef.current
		const curSeat = kbSeatRef.current
		if (curSuit >= KB_SUITS.length - 1) {
			const nextSeat = (curSeat + 1) % KB_SEATS.length
			setKbSuitIdx(0)
			setKbSeatIdx(nextSeat)
			kbSuitRef.current = 0
			kbSeatRef.current = nextSeat
		} else {
			const nextSuit = curSuit + 1
			setKbSuitIdx(nextSuit)
			kbSuitRef.current = nextSuit
		}
	}

	const commitKbSelection = () => {
		// Enter advances to next suit/seat and clears the typed buffer; cards were already applied on keypress
		setKbRanks([])
		advanceKbCursor()
	}

	// Immediately move a typed rank from deck to the current seat/suit
	const addRankToCurrentSeat = (rank, seatOverride, suitOverride) => {
		const seat = seatOverride || currentKbSeat
		if (lockedRef.current[seat]) return
		const suit = suitOverride || currentKbSuit
		// prevent duplicate rank entries in the status buffer
		setKbRanks((prev) => (prev.includes(rank) ? prev : [...prev, rank]))
		setDeal((prev) => {
			// If already allocated anywhere, strip any lingering copy from deck
			const allocated = SEATS.some((s) =>
				(prev.buckets[s] || []).some(
					(c) =>
						c.suit === suit &&
						(c.rank === rank || (rank === '10' && c.rank === '10'))
				)
			)
			if (allocated) {
				const idxInDeck = prev.deck.findIndex(
					(c) =>
						c.suit === suit &&
						(c.rank === rank || (rank === '10' && c.rank === '10'))
				)
				if (idxInDeck === -1) return prev
				return {
					deck: prev.deck.filter((_, i) => i !== idxInDeck),
					buckets: prev.buckets,
				}
			}
			// Otherwise add from deck to target seat if capacity allows
			if (prev.buckets[seat].length >= 13) return prev
			const idxInDeck = prev.deck.findIndex(
				(c) =>
					c.suit === suit &&
					(c.rank === rank || (rank === '10' && c.rank === '10'))
			)
			if (idxInDeck === -1) return prev
			const card = prev.deck[idxInDeck]
			const existsInSeat = prev.buckets[seat].some(
				(c) => c.suit === suit && c.rank === card.rank
			)
			if (existsInSeat) return prev
			return {
				deck: prev.deck.filter((_, i) => i !== idxInDeck),
				buckets: {
					...prev.buckets,
					[seat]: [...prev.buckets[seat], card],
				},
			}
		})
	}

	// Extended PBN preview slides generated asynchronously per saved hand
	const [extSlides, setExtSlides] = useState([])
	useEffect(() => {
		let cancelled = false
		const build = async () => {
			const arr = []
			for (let i = 0; i < savedHands.length; i++) {
				try {
					const board = buildBoardFromHand(savedHands[i], startBoard + i)
					const txt = await exportBoardPBN(board)
					if (cancelled) return
					arr.push(txt)
				} catch {
					// If something goes wrong, still push a minimal placeholder
					arr.push('// Error generating preview for board ' + (startBoard + i))
				}
			}
			if (!cancelled) setExtSlides(arr)
		}
		build()
		return () => {
			cancelled = true
		}
	}, [savedHands, startBoard, meta])

	useEffect(() => {
		if (previewIndex > Math.max(0, extSlides.length - 1)) {
			setPreviewIndex(Math.max(0, extSlides.length - 1))
		}
	}, [extSlides.length, previewIndex])

	useEffect(() => {
		document.title = "Bristol Bridge Club's PBN Picker"
	}, [])

	const remaining = deal.deck.length
	const selectedCount = useMemo(() => selected.size, [selected])
	const complete = SEATS.every((s) => deal.buckets[s].length === 13)
	const nextBoardNo = startBoard + savedHands.length
	const currentDealer = dealerForBoard(nextBoardNo)

	const toggleSelect = (id) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const clearSelection = () => setSelected(new Set())

	const resetBoard = () => {
		setDeal({ deck: initialCards, buckets: { N: [], E: [], S: [], W: [] } })
		setSelected(new Set())
		setGridState({ status: 'incomplete' })
		setGridData(null)
		setHcpError('')
		setLockedSeats({ N: false, E: false, S: false, W: false })
	}
	useEffect(() => {
		if (!complete) {
			setGridState({ status: 'incomplete' })
			setGridData(null)
			return
		}
		let cancelled = false
		const run = async () => {
			setGridState({ status: 'computing' })
			const boardNo = startBoard + savedHands.length
			const dealer = dealerForBoard(boardNo)
			const vul = vulnerabilityForBoard(boardNo)
			const { hash, hands } = await computeDealKeyFromEditor(deal, dealer, vul)
			const cached = getCachedGrid(hash)
			const dealForEngine = {
				dealer,
				hands: {
					N: deal.buckets.N,
					E: deal.buckets.E,
					S: deal.buckets.S,
					W: deal.buckets.W,
				},
			}
			if (cached) {
				if (cancelled) return
				setGridData({ deal_key: hash, table: cached })
				setGridState({ status: 'ready' })
				return
			}
			const t0 = Date.now()
			const res = await computeMakeableGrid(dealForEngine, hash)
			if (cancelled) return
			if (res && !res.error) {
				setGridData({ deal_key: res.deal_key, table: res.table })
				setGridState({ status: 'ready', ms: Date.now() - t0 })
			} else {
				setGridState({ status: 'error', error: res?.error || 'unknown' })
			}
		}
		run()
		return () => {
			cancelled = true
		}
	}, [complete, deal, startBoard, savedHands.length])

	const fullReset = () => {
		setSavedHands([])
		setStartBoard(1)
		resetBoard()
	}
	// HTML5 DnD handlers (robust across browsers)
	const onDragStartDeck = (e, card) => {
		try {
			e.dataTransfer.setData('text/plain', String(card.id))
			e.dataTransfer.effectAllowed = 'move'
		} catch {
			// Some browsers can throw here under odd conditions; ignore
			void 0
		}
		setDraggedCard(card)
		setDragSource('deck')
	}

	const onDragStartBucket = (e, card, bucket) => {
		try {
			e.dataTransfer.setData('text/plain', String(card.id))
			e.dataTransfer.effectAllowed = 'move'
		} catch {
			// Some browsers can throw here under odd conditions; ignore
			void 0
		}
		setDraggedCard(card)
		setDragSource(bucket)
	}

	const onDragEnd = () => {
		setActiveBucket(null)
		setDraggedCard(null)
		setDragSource(null)
	}

	const onDrop = (e, bucket) => {
		if (e && e.preventDefault) e.preventDefault()
		setActiveBucket(null)
		if (!draggedCard) return
		// Respect seat locks: cannot drop into a locked seat or move cards out of a locked seat
		if (SEATS.includes(bucket) && lockedSeats[bucket]) return
		if (SEATS.includes(dragSource) && lockedSeats[dragSource]) return
		if (dragSource === 'deck') {
			setDeal((prev) => {
				const capOk = prev.buckets[bucket].length < 13
				if (!capOk) return prev
				const inDeck = prev.deck.some((c) => c.id === draggedCard.id)
				if (!inDeck) return prev
				return {
					deck: prev.deck.filter((c) => c.id !== draggedCard.id),
					buckets: {
						...prev.buckets,
						[bucket]: [...prev.buckets[bucket], draggedCard],
					},
				}
			})
		} else if (SEATS.includes(dragSource)) {
			setDeal((prev) => {
				if (dragSource === bucket) return prev
				const capOk = prev.buckets[bucket].length < 13
				if (!capOk) return prev
				const fromArr = prev.buckets[dragSource]
				const exists = fromArr.some((c) => c.id === draggedCard.id)
				if (!exists) return prev
				return {
					deck: prev.deck,
					buckets: {
						...prev.buckets,
						[dragSource]: fromArr.filter((c) => c.id !== draggedCard.id),
						[bucket]: [...prev.buckets[bucket], draggedCard],
					},
				}
			})
		}
		setDraggedCard(null)
		setDragSource(null)
	}

	const onDropToDeck = (e) => {
		if (e && e.preventDefault) e.preventDefault()
		if (!draggedCard || !SEATS.includes(dragSource)) return
		// Cannot move out of a locked seat
		if (lockedSeats[dragSource]) return
		setDeal((prev) => {
			const fromArr = prev.buckets[dragSource]
			const exists = fromArr.some((c) => c.id === draggedCard.id)
			if (!exists) return prev
			const nextDeck = sortDeck([...prev.deck, draggedCard])
			return {
				deck: nextDeck,
				buckets: {
					...prev.buckets,
					[dragSource]: fromArr.filter((c) => c.id !== draggedCard.id),
				},
			}
		})
		setDraggedCard(null)
		setDragSource(null)
	}

	// --- HCP allocation logic ---
	// Find a subset of honors (by original index) whose HCP sums exactly to target.
	// Returns an array of indices into the "honors" array (not a shuffled copy!)
	const findHonorSubset = (honors, target) => {
		// honors: array of { card, hcp }
		const items = honors.map((h, idx) => ({ idx, hcp: h.hcp }))
		// Randomize search order but keep original indices for correct removal
		const order = items.slice().sort(() => Math.random() - 0.5)
		const n = order.length
		const memo = new Map()
		const dfs = (i, sum, count) => {
			const key = `${i}|${sum}|${count}`
			if (memo.has(key)) return null
			if (sum === target && count <= 13) return []
			if (sum > target || count > 13) return null
			if (i >= n) return null
			// Bound: sum of remaining max points
			let maxRemain = 0
			for (let k = i; k < n; k++) maxRemain += order[k].hcp
			if (sum + maxRemain < target) {
				memo.set(key, null)
				return null
			}
			// Try include
			const withRes = dfs(i + 1, sum + order[i].hcp, count + 1)
			if (withRes) return [order[i].idx, ...withRes]
			// Try skip
			const withoutRes = dfs(i + 1, sum, count)
			if (withoutRes) return withoutRes
			memo.set(key, null)
			return null
		}
		return dfs(0, 0, 0)
	}

	const allocateHcpHands = () => {
		setHcpError('')
		// collect seats to allocate
		const seatsToAlloc = SEATS.filter((s) => hcpEnabled[s])
		if (seatsToAlloc.length === 0) {
			setHcpError('Select at least one seat to allocate HCP to.')
			return
		}
		// sanitize targets 0..29 and ints
		const targets = {}
		for (const s of seatsToAlloc) {
			let v = Number(hcpTargets[s])
			if (!Number.isFinite(v)) v = 0
			v = Math.max(0, Math.min(29, Math.round(v)))
			targets[s] = v
		}
		const totalWanted = Object.values(targets).reduce((a, b) => a + b, 0)
		if (totalWanted > 40) {
			setHcpError('Total HCP across selected seats exceeds 40.')
			return
		}
		// Build a working deck: start from current deal, but return selected seats' cards to deck first
		let workBuckets = {
			N: [...deal.buckets.N],
			E: [...deal.buckets.E],
			S: [...deal.buckets.S],
			W: [...deal.buckets.W],
		}
		let workDeck = [...deal.deck]
		for (const s of seatsToAlloc) {
			if (workBuckets[s].length) {
				workDeck = sortDeck([...workDeck, ...workBuckets[s]])
				workBuckets[s] = []
			}
		}
		// Split honors and zeros
		let honors = []
		let zeros = []
		for (const c of workDeck) {
			const h = hcpOfCard(c)
			if (h > 0) honors.push({ card: c, hcp: h })
			else zeros.push(c)
		}
		// Fisher–Yates shuffle zeros so filler is random
		for (let i = zeros.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			;[zeros[i], zeros[j]] = [zeros[j], zeros[i]]
		}
		const availHonorPoints = honors.reduce((s, it) => s + it.hcp, 0)
		if (totalWanted > availHonorPoints) {
			setHcpError(
				'Not enough honor points available in the deck for the requested totals.'
			)
			return
		}
		// Allocate seats with highest targets first for better chance of success
		const orderSeats = seatsToAlloc
			.slice()
			.sort((a, b) => targets[b] - targets[a] || Math.random() - 0.5)

		const countSuits = (arr) => {
			const counts = { Clubs: 0, Diamonds: 0, Hearts: 0, Spades: 0 }
			for (const c of arr) counts[c.suit] = (counts[c.suit] || 0) + 1
			return counts
		}
		const pickFiller = (poolZeros, need, currentCounts) => {
			// Try thresholds progressively to avoid extreme long suits while staying random
			const thresholds = [8, 9, 13]
			let pool = poolZeros.slice()
			const picked = []
			for (const maxSuit of thresholds) {
				const nextPool = []
				for (let i = 0; i < pool.length && picked.length < need; i++) {
					const c = pool[i]
					if ((currentCounts[c.suit] || 0) < maxSuit) {
						picked.push(c)
						currentCounts[c.suit] = (currentCounts[c.suit] || 0) + 1
					} else {
						nextPool.push(c)
					}
				}
				// Add the rest back for potential next threshold
				pool = [...nextPool, ...pool.slice(Math.min(pool.length, pool.length))]
				if (picked.length >= need) {
					// Remove picked from original zeros
					const used = new Set(picked.map((c) => c.id))
					const remainingZeros = poolZeros.filter((c) => !used.has(c.id))
					return { picked, remainingZeros }
				}
			}
			// If still not enough (shouldn't happen), just take first available
			const extra = pool.slice(0, need - picked.length)
			const used = new Set([...picked, ...extra].map((c) => c.id))
			const remainingZeros = poolZeros.filter((c) => !used.has(c.id))
			return { picked: [...picked, ...extra], remainingZeros }
		}
		const built = {}
		const warnings = []
		for (const s of orderSeats) {
			const target = targets[s]
			if (target === 0) {
				// pick 13 zero-point cards if possible, with suit balance
				if (zeros.length < 13) {
					setHcpError(`Insufficient low cards to allocate 0 HCP for ${s}.`)
					return
				}
				// Apply optional shape preferences first, then fill the rest
				let seatCounts0 = { Clubs: 0, Diamonds: 0, Hearts: 0, Spades: 0 }
				const prefer = {
					majors: Math.max(0, Number(shapeMajorsMin[s] || 0)),
					minors: Math.max(0, Number(shapeMinorsMin[s] || 0)),
				}
				let picked0 = []
				// Shuffle zeros lightly
				zeros = zeros.sort(() => Math.random() - 0.5)
				const pickFromSuits = (pool, need, suitsSet) => {
					if (need <= 0) return { picked: [], rest: pool }
					const res = []
					const rest = []
					for (const c of pool) {
						if (res.length < need && suitsSet.has(c.suit)) res.push(c)
						else rest.push(c)
					}
					return { picked: res, rest }
				}
				// Majors then minors
				let majorsHave0 = seatCounts0.Hearts + seatCounts0.Spades
				let minorsHave0 = seatCounts0.Clubs + seatCounts0.Diamonds
				if (prefer.majors > 0) {
					const needMaj0 = Math.max(0, prefer.majors - majorsHave0)
					const { picked, rest } = pickFromSuits(
						zeros,
						needMaj0,
						new Set(['Hearts', 'Spades'])
					)
					picked0.push(...picked)
					zeros = rest
					for (const c of picked)
						seatCounts0[c.suit] = (seatCounts0[c.suit] || 0) + 1
					majorsHave0 = seatCounts0.Hearts + seatCounts0.Spades
				}
				if (prefer.minors > 0) {
					const needMin0 = Math.max(0, prefer.minors - minorsHave0)
					const { picked, rest } = pickFromSuits(
						zeros,
						needMin0,
						new Set(['Clubs', 'Diamonds'])
					)
					picked0.push(...picked)
					zeros = rest
					for (const c of picked)
						seatCounts0[c.suit] = (seatCounts0[c.suit] || 0) + 1
					minorsHave0 = seatCounts0.Clubs + seatCounts0.Diamonds
				}
				// Fill remaining to 13 with any zeros
				const need0 = 13 - picked0.length
				if (zeros.length < need0) {
					setHcpError(`Insufficient low cards to complete ${s}'s hand.`)
					return
				}
				picked0.push(...zeros.slice(0, need0))
				zeros = zeros.slice(need0)
				built[s] = picked0
				// Shape warning if unmet
				const majAch0 = built[s].filter(
					(c) => c.suit === 'Hearts' || c.suit === 'Spades'
				).length
				const minAch0 = built[s].filter(
					(c) => c.suit === 'Clubs' || c.suit === 'Diamonds'
				).length
				if (prefer.majors > 0 && majAch0 < prefer.majors)
					warnings.push(
						`${s}: requested Majors≥${prefer.majors}, achieved ${majAch0}. Proceeded.`
					)
				if (prefer.minors > 0 && minAch0 < prefer.minors)
					warnings.push(
						`${s}: requested Minors≥${prefer.minors}, achieved ${minAch0}. Proceeded.`
					)
				continue
			}
			// Re-shuffle honors before each seat to add randomness
			honors = honors.sort(() => Math.random() - 0.5)
			const idxs = findHonorSubset(honors, target)
			if (!idxs) {
				setHcpError(
					`Could not find an exact ${target} HCP honor combination for ${s}. Try slightly different totals or fewer selected seats.`
				)
				return
			}
			// Collect chosen honors (take in descending idx order to splice safely)
			const chosen = []
			const idxSorted = idxs.slice().sort((a, b) => b - a)
			for (const i of idxSorted) {
				const it = honors.splice(i, 1)[0]
				chosen.push(it.card)
			}
			// Fill to 13 with zeros, honoring optional shape constraints first
			const need = 13 - chosen.length
			if (need < 0) {
				setHcpError('Internal error: selected more than 13 honors.')
				return
			}
			if (zeros.length < need) {
				setHcpError(`Insufficient low cards to complete ${s}'s hand.`)
				return
			}
			const suitCounts = countSuits(chosen)
			const prefer = {
				majors: Math.max(0, Number(shapeMajorsMin[s] || 0)),
				minors: Math.max(0, Number(shapeMinorsMin[s] || 0)),
			}
			// Shuffle zeros lightly
			zeros = zeros.sort(() => Math.random() - 0.5)
			const pickFromSuits = (pool, needCount, suitsSet) => {
				if (needCount <= 0) return { picked: [], rest: pool }
				const res = []
				const rest = []
				for (const c of pool) {
					if (res.length < needCount && suitsSet.has(c.suit)) res.push(c)
					else rest.push(c)
				}
				return { picked: res, rest }
			}
			let filler = []
			let poolZ = zeros
			// Try to satisfy majors then minors preferences first
			if (prefer.majors > 0) {
				const haveMaj = (suitCounts.Hearts || 0) + (suitCounts.Spades || 0)
				const needMaj = Math.max(0, prefer.majors - haveMaj)
				if (needMaj > 0) {
					const { picked, rest } = pickFromSuits(
						poolZ,
						needMaj,
						new Set(['Hearts', 'Spades'])
					)
					filler.push(...picked)
					for (const c of picked)
						suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
					poolZ = rest
				}
			}
			if (prefer.minors > 0) {
				const haveMin = (suitCounts.Clubs || 0) + (suitCounts.Diamonds || 0)
				const needMin = Math.max(0, prefer.minors - haveMin)
				if (needMin > 0) {
					const { picked, rest } = pickFromSuits(
						poolZ,
						needMin,
						new Set(['Clubs', 'Diamonds'])
					)
					filler.push(...picked)
					for (const c of picked)
						suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
					poolZ = rest
				}
			}
			// Fill remaining slots with any zeros
			const stillNeed = need - filler.length
			if (stillNeed > 0) {
				if (poolZ.length < stillNeed) {
					setHcpError(`Insufficient low cards to complete ${s}'s hand.`)
					return
				}
				filler.push(...poolZ.slice(0, stillNeed))
				poolZ = poolZ.slice(stillNeed)
			}
			zeros = poolZ
			built[s] = [...chosen, ...filler]
			// Shape warning if unmet
			const majAch = built[s].filter(
				(c) => c.suit === 'Hearts' || c.suit === 'Spades'
			).length
			const minAch = built[s].filter(
				(c) => c.suit === 'Clubs' || c.suit === 'Diamonds'
			).length
			if (prefer.majors > 0 && majAch < prefer.majors)
				warnings.push(
					`${s}: requested Majors≥${prefer.majors}, achieved ${majAch}. Proceeded.`
				)
			if (prefer.minors > 0 && minAch < prefer.minors)
				warnings.push(
					`${s}: requested Minors≥${prefer.minors}, achieved ${minAch}. Proceeded.`
				)
			// Verification: ensure exact HCP match for this seat before continuing
			const seatHcp = hcpOfCards(built[s])
			if (seatHcp !== target) {
				setHcpError(
					`Internal allocation error for ${s}: expected ${target} HCP, got ${seatHcp}. Please try again.`
				)
				return
			}
		}
		// Commit: update buckets and deck (remaining honors/zeros + untouched seat cards)
		const usedIds = new Set()
		Object.values(built).forEach((arr) => arr.forEach((c) => usedIds.add(c.id)))
		const nextDeck = sortDeck(
			[...honors.map((h) => h.card), ...zeros].filter((c) => !usedIds.has(c.id))
		)
		const nextBuckets = { ...workBuckets }
		for (const s of orderSeats) nextBuckets[s] = built[s]
		setDeal({ deck: nextDeck, buckets: nextBuckets })
		setSelected(new Set())
		setHcpError('')
		if (warnings.length) {
			setShapeModal({ open: true, message: warnings.join('\n') })
		}
		// Auto-lock allocated seats
		setLockedSeats((prev) => {
			const next = { ...prev }
			for (const s of Object.keys(built)) next[s] = true
			return next
		})
	}

	// Simple click-to-remove: clicking a card in a seat moves it back to the deck
	const removeCardFromSeat = (cardId, seat) => {
		if (lockedSeats[seat]) return
		setDeal((prev) => {
			const fromArr = prev.buckets[seat]
			const idx = fromArr.findIndex((c) => c.id === cardId)
			if (idx === -1) return prev
			const card = fromArr[idx]
			const nextFrom = fromArr.slice()
			nextFrom.splice(idx, 1)
			return {
				deck: sortDeck([...prev.deck, card]),
				buckets: { ...prev.buckets, [seat]: nextFrom },
			}
		})
	}

	// Keep deck ordered CDHS and by rank 2..A when cards return to the deck
	const sortDeck = (arr) => {
		const suitOrder = { Clubs: 0, Diamonds: 1, Hearts: 2, Spades: 3 }
		const rankOrder = {
			2: 2,
			3: 3,
			4: 4,
			5: 5,
			6: 6,
			7: 7,
			8: 8,
			9: 9,
			10: 10,
			J: 11,
			Q: 12,
			K: 13,
			A: 14,
		}
		return [...arr].sort((a, b) => {
			const s = suitOrder[a.suit] - suitOrder[b.suit]
			if (s !== 0) return s
			return rankOrder[a.rank] - rankOrder[b.rank]
		})
	}

	const sendSelectedTo = (bucket) => {
		if (selected.size === 0) return
		if (SEATS.includes(bucket) && lockedSeats[bucket]) return
		// compute using current deal snapshot
		const capacity = 13 - deal.buckets[bucket].length
		if (capacity <= 0) return
		const toMove = deal.deck
			.filter((c) => selected.has(c.id))
			.slice(0, capacity)
		if (toMove.length === 0) return
		const movedIds = new Set(toMove.map((c) => c.id))
		setDeal((prev) => ({
			deck: prev.deck.filter((c) => !movedIds.has(c.id)),
			buckets: {
				...prev.buckets,
				[bucket]: [...prev.buckets[bucket], ...toMove],
			},
		}))
		setSelected((prev) => {
			const next = new Set(prev)
			for (const id of movedIds) next.delete(id)
			return next
		})
	}

	const handleRandomComplete = () => {
		// random fill respecting capacity 13
		setDeal((prev) => {
			let pool = [...prev.deck]
			const nextBuckets = { ...prev.buckets }
			while (pool.length) {
				const candidates = SEATS.filter(
					(s) => !lockedSeats[s] && nextBuckets[s].length < 13
				)
				if (candidates.length === 0) break
				const idx = Math.floor(Math.random() * pool.length)
				const [card] = pool.splice(idx, 1)
				const b = candidates[Math.floor(Math.random() * candidates.length)]
				nextBuckets[b] = [...nextBuckets[b], card]
			}
			return { deck: pool, buckets: nextBuckets }
		})
		setSelected(new Set())
	}

	const saveCurrentHand = () => {
		if (!complete) return
		// Snapshot current teaching metadata so later edits don't retroactively change earlier saved hands
		const snapshotTheme =
			meta?.themeChoice === 'Custom…'
				? meta?.themeCustom || ''
				: meta?.themeChoice || ''
		// Auto-promote notesDraft to notes if user forgot to click Set Notes
		let effectiveNotes = meta?.notes && meta.notes.length ? [...meta.notes] : []
		if ((!effectiveNotes || !effectiveNotes.length) && meta?.notesDraft) {
			const raw = String(meta.notesDraft).trim()
			if (raw) effectiveNotes = [raw]
		}
		const snapshot = {
			event: meta?.event,
			siteChoice: meta?.siteChoice,
			siteOther: meta?.siteOther,
			date: meta?.date,
			system: meta?.system,
			theme: snapshotTheme,
			interf: meta?.interf,
			lead: meta?.lead,
			ddpar: meta?.ddpar,
			scoring: meta?.scoring,
			contract: meta?.contract,
			declarer: meta?.declarer,
			auctionStart: meta?.auctionStart,
			auctionText: meta?.auctionText,
			playscript: meta?.playscript,
			notes: effectiveNotes,
		}

		// Persist makeable snapshot if available
		let gridSnapshot = null
		if (gridState.status === 'ready' && gridData?.table) {
			gridSnapshot = { ...gridData.table }
		}
		setSavedHands((prev) => [
			...prev,
			{
				N: deal.buckets.N,
				E: deal.buckets.E,
				S: deal.buckets.S,
				W: deal.buckets.W,
				meta: { ...snapshot, grid_snapshot: gridSnapshot },
			},
		])
		resetBoard()
		// Clear notes draft & notes ready for next hand authoring
		setMeta?.((m) => ({ ...m, notesDraft: '', notes: [] }))
	}

	const downloadPBN = (content) => {
		const blob = new Blob([content], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		// Filename pattern: ralph-DATE-Theme-hand.pbn
		const now = new Date()
		const yyyy = now.getFullYear()
		const mm = String(now.getMonth() + 1).padStart(2, '0')
		const dd = String(now.getDate()).padStart(2, '0')
		const datePart = `${yyyy}${mm}${dd}`
		let themeRaw = ''
		if (meta?.themeChoice) {
			if (meta.themeChoice === 'Custom…') themeRaw = meta?.themeCustom || ''
			else themeRaw = meta.themeChoice
		}
		const safeTheme =
			(themeRaw || 'Session')
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.slice(0, 40) || 'session'
		const edited = pbnImport ? '-edited' : ''
		a.download = `bbc-pbn-${datePart}${edited}.pbn`
		a.click()
		URL.revokeObjectURL(url)
	}

	const applyImportedBoard = (dealsArr, idx) => {
		if (!Array.isArray(dealsArr) || !dealsArr[idx]) return false
		const d = dealsArr[idx]
		const built = buildBucketsFromDealString(d.deal)
		if (!built) return false
		setDeal({ deck: sortDeck(built.remainingDeck), buckets: built.buckets })
		// Seed metadata from PBN
		setMeta?.((m) => ({
			...m,
			auctionStart: d.auctionDealer || d.dealer || m?.auctionStart || 'N',
			auctionText: (d.auctionTokens || []).join(' '),
			date: d.ext?.Date || m?.date,
			dateISO: (d.ext?.Date || '').replace(/\./g, '-'),
			event: d.ext?.Event || m?.event,
			siteChoice: d.ext?.Site || m?.siteChoice,
		}))
		// Align startBoard to this board number for export continuity
		const bno = parseInt(d.board, 10)
		if (!Number.isNaN(bno) && bno > 0) setStartBoard(bno)
		return true
	}

	const handleLoadPbnFile = async (file) => {
		if (!file) return
		try {
			const text = await file.text()
			const clean = sanitizePBN(text)
			const parsed = parsePBN(clean)
			const deals = parsed
				.filter((d) => d && d.deal)
				.map((d) => ({
					deal: d.deal,
					board: d.board || '',
					dealer: d.dealer || d.auctionDealer || '',
					vul: d.vul || '',
					auctionDealer: d.auctionDealer || d.dealer || '',
					auctionTokens: Array.isArray(d.auction) ? d.auction : [],
					ext: d.ext || {},
				}))
			if (!deals.length) return
			const info = { filename: file.name, deals, index: 0 }
			setPbnImport(info)
			applyImportedBoard(deals, 0)
		} catch (e) {
			console.error('Failed to parse PBN', e)
		}
	}

	// Helpers to map picker hands to Extended Board hands (rank chars and suit letters)
	const toRankChar = (r) => (r === '10' ? 'T' : r)
	const mapSeatHand = (handArr) => {
		return {
			S: sortByPbnRank(handArr.filter((c) => c.suit === 'Spades')).map((c) =>
				toRankChar(c.rank)
			),
			H: sortByPbnRank(handArr.filter((c) => c.suit === 'Hearts')).map((c) =>
				toRankChar(c.rank)
			),
			D: sortByPbnRank(handArr.filter((c) => c.suit === 'Diamonds')).map((c) =>
				toRankChar(c.rank)
			),
			C: sortByPbnRank(handArr.filter((c) => c.suit === 'Clubs')).map((c) =>
				toRankChar(c.rank)
			),
		}
	}

	const buildBoardFromHand = (hand, boardNo) => {
		const dealer = dealerForBoard(boardNo)
		const vul = vulnerabilityForBoard(boardNo)
		const today = new Date()
		const y = today.getFullYear()
		const m = String(today.getMonth() + 1).padStart(2, '0')
		const d = String(today.getDate()).padStart(2, '0')
		const dateStrDefault = `${y}.${m}.${d}`
		const metaSnap = hand.meta || meta || {}
		const event = metaSnap.event || meta?.event || 'Club Teaching session'
		const siteChoice =
			metaSnap.siteChoice || meta?.siteChoice || 'Bristol Bridge Club'
		const site =
			siteChoice === 'Other'
				? metaSnap.siteOther || meta?.siteOther || 'Other'
				: siteChoice
		const dateStr = metaSnap.date || meta?.date || dateStrDefault
		const theme =
			metaSnap.theme ||
			(meta?.themeChoice === 'Custom…'
				? meta?.themeCustom || ''
				: meta?.themeChoice)
		const auctionTokens = (metaSnap.auctionText || meta?.auctionText || '')
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((t) => (t === 'P' ? 'Pass' : t))

		// dealPrefix aligns with dealer by default
		const boardObj = {
			event,
			site,
			date: dateStr,
			board: boardNo,
			dealer,
			vul,
			dealPrefix: dealer,
			hands: {
				N: mapSeatHand(hand.N),
				E: mapSeatHand(hand.E),
				S: mapSeatHand(hand.S),
				W: mapSeatHand(hand.W),
			},
			notes:
				metaSnap.notes && metaSnap.notes.length
					? metaSnap.notes
					: meta?.notes || [],
			auctionStart: auctionTokens.length
				? metaSnap.auctionStart || meta?.auctionStart || 'N'
				: undefined,
			auction: auctionTokens.length ? auctionTokens : undefined,
			ext: {
				system: metaSnap.system || meta?.system || undefined,
				theme: theme || undefined,
				interf: metaSnap.interf || meta?.interf || undefined,
				ddpar: metaSnap.ddpar || meta?.ddpar || undefined,
				scoring: metaSnap.scoring || meta?.scoring || undefined,
				lead: metaSnap.lead || meta?.lead || undefined,
				playscript: metaSnap.playscript || meta?.playscript || undefined,
			},
		}
		return BoardZ.parse(boardObj)
	}

	const exportSavedBoards = async () => {
		const texts = []
		for (let i = 0; i < savedHands.length; i++) {
			const bno = startBoard + i
			const board = buildBoardFromHand(savedHands[i], bno)
			const txt = await exportBoardPBN(board, { dealer4Mode })
			texts.push(txt)
		}
		return texts.join('')
	}

	const handleGeneratePBN = async () => {
		if (savedHands.length === 0) return
		try {
			const pbn = await exportSavedBoards()
			downloadPBN(pbn)
		} catch (e) {
			console.error('Export failed', e)
		}
	}

	const handleCopyPBN = async () => {
		if (savedHands.length === 0) return
		try {
			const pbn = await exportSavedBoards()
			await navigator.clipboard.writeText(pbn)
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
			setCopyState('ok')
			copyTimerRef.current = setTimeout(() => setCopyState('idle'), 2000)
		} catch {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
			setCopyState('err')
			copyTimerRef.current = setTimeout(() => setCopyState('idle'), 2000)
		}
	}

	// NOTE: Inline PDF generator removed in favor of shared lib/handoutPdf.js

	const handleEmailPBN = async () => {
		if (savedHands.length === 0) return
		try {
			const pbn = await exportSavedBoards()
			const subject = encodeURIComponent(
				"PBN hands from Bristol Bridge Club's PBN Picker"
			)
			const body = encodeURIComponent(pbn)
			window.location.href = `mailto:dr.mark.oconnor@googlemail.com?subject=${subject}&body=${body}`
		} catch (e) {
			console.error('Email export failed', e)
		}
	}

	// Explicit dealer selection: aligns startBoard so the next board's dealer equals the chosen seat
	const setDealerExplicit = (seat) => {
		const idx = SEATS.indexOf(seat)
		if (idx === -1) return
		const currentMod = (startBoard + savedHands.length - 1) % 4
		const delta = (idx - currentMod + 4) % 4
		setStartBoard(startBoard + delta)
	}

	const CARD_DECK =
		'rounded-lg shadow-md cursor-pointer select-none transition-all duration-150 font-serif w-[48px] h-[72px] flex flex-col items-center justify-center border border-neutral-300 bg-[#FFF8E7]'
	const CARD_BUCKET =
		'rounded-md shadow cursor-pointer select-none transition-all duration-150 font-serif w-[40px] h-[60px] flex flex-col items-center justify-center border border-neutral-300 bg-[#FFF8E7]'

	const renderFace = (card, largeCenter = false) => {
		const isA = card.rank === 'A'
		const suitClass = SUIT_TEXT[card.suit]
		// Ace keeps calligraphic A, but symbol size increased
		if (isA) {
			return (
				<div
					className={`w-full h-full bg-[#FFF8E7] flex flex-col items-center justify-center ${suitClass}`}>
					<div
						style={{ fontFamily: 'Apple Chancery, Snell Roundhand, cursive' }}
						className={`${
							largeCenter ? 'text-2xl' : 'text-base'
						} leading-none italic`}>
						A
					</div>
					<div
						className={`${
							largeCenter ? 'text-2xl' : 'text-base'
						} leading-none`}>
						{card.symbol}
					</div>
				</div>
			)
		}
		// J/Q/K and number cards share the same clean face style
		return (
			<div
				className={`w-full h-full bg-[#FFF8E7] flex flex-col items-center justify-center ${suitClass}`}>
				<div
					className={`${
						largeCenter ? 'text-2xl' : 'text-lg'
					} leading-none font-extrabold`}>
					{card.rank}
				</div>
				<div className={`${largeCenter ? 'text-2xl' : 'text-lg'} leading-none`}>
					{card.symbol}
				</div>
			</div>
		)
	}

	const Bucket = ({ id }) => {
		const styles = BUCKET_STYLES[id]
		const highlight = activeBucket === id ? `ring-2 ${styles.ring}` : ''
		const nextBoardNo = startBoard + savedHands.length
		const vul = vulnerabilityForBoard(nextBoardNo)
		const dealer = dealerForBoard(nextBoardNo)
		const isDealer = dealer === id
		const seatIsVul =
			vul === 'All' ||
			(vul === 'NS' && (id === 'N' || id === 'S')) ||
			(vul === 'EW' && (id === 'E' || id === 'W'))

		const rowOrder = ['Clubs', 'Diamonds', 'Hearts', 'Spades']
		// Reversed display order per request: Spades, Hearts, Diamonds, Clubs
		const displayOrder = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
		const hcp = hcpOfCards(deal.buckets[id])

		return (
			<div
				className={`rounded-xl overflow-hidden shadow-md border ${
					isDealer ? 'border-amber-500' : styles.border
				} ${styles.bg} ${highlight} w-64`}>
				<div
					className={`w-full ${
						isDealer
							? 'bg-amber-100 text-amber-900'
							: `${styles.headerBg} ${styles.headerText}`
					} font-extrabold text-[11px] tracking-widest uppercase px-2 py-1.5 flex items-center justify-between`}>
					<span className="flex items-center gap-1">
						{styles.title}
						{isDealer && (
							<span
								title="Dealer"
								className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[9px] rounded-full bg-amber-500 text-white">
								D
							</span>
						)}
						{lockedSeats[id] && (
							<span
								title="Locked"
								className="ml-1 inline-flex items-center justify-center px-1 h-4 text-[9px] rounded bg-gray-800 text-white">
								LOCK
							</span>
						)}
					</span>
					<span className="flex items-center gap-1">
						{seatIsVul && (
							<span className="text-[9px] font-bold text-red-700 bg-red-100 border border-red-200 rounded px-1 py-0.5">
								V
							</span>
						)}
						<span className="text-[10px] opacity-80">
							{deal.buckets[id].length}/13
						</span>
					</span>
				</div>
				<div
					onDragOver={(e) => {
						e.preventDefault()
						setActiveBucket(id)
					}}
					onDragLeave={() => setActiveBucket(null)}
					onDrop={(e) => onDrop(e, id)}
					className={`h-64 p-3 flex flex-col gap-2 items-stretch justify-center`}>
					{displayOrder.map((suit) => {
						const suitCards = sortByPbnRank(
							deal.buckets[id].filter((c) => c.suit === suit)
						)
						const suitColor = SUIT_TEXT[suit]
						return (
							<div
								key={`${id}-${suit}`}
								className="flex items-center gap-3 flex-1">
								<div
									className={`w-8 text-center text-2xl leading-none ${suitColor}`}>
									{suit === 'Clubs'
										? '♣'
										: suit === 'Diamonds'
										? '♦'
										: suit === 'Hearts'
										? '♥'
										: '♠'}
								</div>
								<div
									className={`flex-1 ${
										kbMode && id === currentKbSeat && suit === currentKbSuit
											? 'ring-2 ring-sky-300 rounded bg-white'
											: ''
									}`}>
									{suiteRowContent(suitCards, id, suit)}
								</div>
							</div>
						)
					})}
				</div>
				<div className="px-3 pb-2 text-[10px] text-gray-700 font-semibold text-right">
					HCP: {hcp}
				</div>
			</div>
		)
	}

	// Renders a suit row as a sequence of draggable rank spans; shows '-' when void
	function suiteRowContent(suitCards, bucketId) {
		if (!suitCards || suitCards.length === 0) {
			return <span className="text-base md:text-lg text-gray-500">-</span>
		}
		return (
			<div className="flex flex-row flex-wrap items-center gap-2 text-base md:text-lg leading-none">
				{suitCards.map((card) => (
					<span
						key={card.id}
						draggable
						onDragStart={(e) => onDragStartBucket(e, card, bucketId)}
						onDragEnd={onDragEnd}
						onClick={() => removeCardFromSeat(card.id, bucketId)}
						className="font-semibold text-gray-900 px-1 select-none cursor-grab active:cursor-grabbing">
						{card.rank}
					</span>
				))}
			</div>
		)
	}

	return (
		<div className="w-full min-h-screen flex items-stretch">
			{/* Left controls panel: move entire top toolbar here */}
			<div
				className={`${
					leftOpen ? 'w-80' : 'w-10'
				} transition-all duration-200 border-r bg-white relative`}>
				<div className="h-10 flex items-center justify-between px-2 border-b">
					<span className="text-xs font-semibold text-gray-700">Generator</span>
					<button
						className="text-xs px-2 py-0.5 rounded border bg-white"
						onClick={() => setLeftOpen(!leftOpen)}>
						{leftOpen ? '⟨' : '⟩'}
					</button>
				</div>
				<div
					className={`${
						leftOpen ? 'p-2' : 'p-0'
					} overflow-y-auto max-h-[calc(100vh-40px)]`}>
					{leftOpen && (
						<div className="space-y-2 text-xs">
							{/* Metadata moved from top header to left panel */}
							<div className="space-y-1">
								<div className="text-[11px] font-semibold text-gray-800">
									Metadata
								</div>
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">Event</span>
									<select
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.event || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, event: e.target.value }))
										}>
										<option>Club Teaching session</option>
										<option>Club Tournament</option>
										<option>Club Social</option>
									</select>
								</label>
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">Location</span>
									<select
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.siteChoice || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, siteChoice: e.target.value }))
										}>
										<option>Bristol Bridge Club</option>
										<option>Home</option>
										<option>3rd Party</option>
										<option>Other</option>
									</select>
								</label>
								{meta?.siteChoice === 'Other' && (
									<label className="flex items-center justify-between gap-1">
										<span className="text-[11px] text-gray-600">
											Location (Other)
										</span>
										<input
											className="border rounded px-1 py-0.5 text-[11px] flex-1"
											value={meta?.siteOther || ''}
											onChange={(e) =>
												setMeta?.((m) => ({ ...m, siteOther: e.target.value }))
											}
										/>
									</label>
								)}
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">Date</span>
									<input
										type="date"
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.dateISO || ''}
										onChange={(e) => {
											const iso = e.target.value
											setMeta?.((m) => ({
												...m,
												dateISO: iso,
												date: toPbnDate(iso),
											}))
										}}
									/>
								</label>
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">System</span>
									<input
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.system || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, system: e.target.value }))
										}
										placeholder="Acol 12-14 1NT"
									/>
								</label>
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">Theme</span>
									<select
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.themeChoice || ''}
										onChange={(e) => {
											themeTouchedRef.current = true
											setMeta?.((m) => ({ ...m, themeChoice: e.target.value }))
										}}>
										<option value="">(select a theme)</option>
										<option>Bidding - Stayman & Transfers</option>
										<option>Bidding - Overcalls</option>
										<option>Bidding - Weak Twos</option>
										<option>Slam Bidding</option>
										<option>Opening Leads</option>
										<option>Defence - Signals</option>
										<option>Declarer - Finesses</option>
										<option>Declarer - Suit Establishment</option>
										<option>Declarer - Counting</option>
										<option>Card Play - Ducking</option>
										<option>Endplays & Squeezes</option>
										<option>Interference - Landy</option>
										<option>Custom…</option>
									</select>
								</label>
								{meta?.themeChoice === 'Custom…' && (
									<label className="flex items-center justify-between gap-1">
										<span className="text-[11px] text-gray-600">
											Theme (Custom)
										</span>
										<input
											className="border rounded px-1 py-0.5 text-[11px] flex-1"
											value={meta?.themeCustom || ''}
											onChange={(e) =>
												setMeta?.((m) => ({
													...m,
													themeCustom: e.target.value,
												}))
											}
											placeholder="e.g. Inverted Minors"
										/>
									</label>
								)}
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">Interf</span>
									<input
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.interf || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, interf: e.target.value }))
										}
										placeholder="Landy 2C"
									/>
								</label>
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">Lead</span>
									<input
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.lead || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, lead: e.target.value }))
										}
										placeholder="W:♠4"
									/>
								</label>
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">DDPar</span>
									<input
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.ddpar || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, ddpar: e.target.value }))
										}
										placeholder="3NT="
									/>
								</label>
								<label className="flex items-center justify-between gap-1">
									<span className="text-[11px] text-gray-600">Scoring</span>
									<select
										className="border rounded px-1 py-0.5 text-[11px] flex-1"
										value={meta?.scoring || 'MPs'}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, scoring: e.target.value }))
										}>
										<option value="MPs">MPs</option>
										<option value="IMPs">IMPs</option>
									</select>
								</label>

								{/* Contract & Declarer */}
								<div className="pt-1 border-t space-y-1">
									<div className="grid grid-cols-1 gap-1">
										<label className="flex items-center justify-between gap-1">
											<span className="text-[11px] text-gray-600">
												Contract
											</span>
											<input
												className="border rounded px-1 py-0.5 text-[11px] flex-1"
												placeholder="e.g. 3NT, 4H X, 5CXX"
												value={meta?.contract || ''}
												onChange={(e) =>
													setMeta?.((m) => ({ ...m, contract: e.target.value }))
												}
											/>
										</label>
										<label className="flex items-center justify-between gap-1">
											<span className="text-[11px] text-gray-600">
												Declarer
											</span>
											<select
												className="border rounded px-1 py-0.5 text-[11px] flex-1"
												value={meta?.declarer || ''}
												onChange={(e) =>
													setMeta?.((m) => ({ ...m, declarer: e.target.value }))
												}>
												<option value="">(auto)</option>
												<option value="N">N</option>
												<option value="E">E</option>
												<option value="S">S</option>
												<option value="W">W</option>
											</select>
										</label>
									</div>
								</div>

								{/* Auction & Play */}
								<div className="space-y-1">
									<div className="text-[11px] font-semibold text-gray-800">
										Ideal Bidding
									</div>
									<div className="flex items-center gap-1">
										<label className="flex items-center gap-1">
											<span className="text-[11px] text-gray-600">Start</span>
											<select
												className="border rounded px-1 py-0.5 text-[11px]"
												value={meta?.auctionStart || 'N'}
												onChange={(e) =>
													setMeta?.((m) => ({
														...m,
														auctionStart: e.target.value,
													}))
												}>
												<option>N</option>
												<option>E</option>
												<option>S</option>
												<option>W</option>
											</select>
										</label>
										<input
											className="border rounded px-1 py-0.5 text-[11px] flex-1"
											placeholder="e.g. 1NT Pass 2C … Pass Pass Pass"
											value={meta?.auctionText || ''}
											onChange={(e) =>
												setMeta?.((m) => ({
													...m,
													auctionText: e.target.value,
												}))
											}
										/>
									</div>
									<div className="text-[10px] text-gray-500">
										Ends with three Passes.
									</div>
								</div>
								<div className="space-y-1">
									<div className="text-[11px] font-semibold text-gray-800">
										PlayScript
									</div>
									<textarea
										className="border rounded px-1 py-0.5 text-[11px] h-16 w-full"
										placeholder={`One play per line, e.g.\nW:♠4\nN:♠A\nE:♠2\nS:♠7`}
										value={meta?.playscript || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, playscript: e.target.value }))
										}
									/>
								</div>

								{/* Notes */}
								<div className="pt-1 border-t space-y-1">
									<div className="text-[11px] font-semibold text-gray-800">
										Notes
									</div>
									<textarea
										className="border rounded px-1 py-0.5 text-[11px] h-24 w-full"
										value={meta?.notesDraft || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, notesDraft: e.target.value }))
										}
										placeholder="Teaching notes for this hand..."
									/>
									<div className="flex items-center gap-1">
										<button
											className="px-2 py-1 rounded border text-[11px]"
											onClick={() => {
												const raw = String(meta?.notesDraft || '').trim()
												if (!raw) return
												// Single block stored as one element; PDF will wrap
												setMeta?.((m) => ({ ...m, notes: [raw] }))
											}}>
											Set Notes
										</button>
										<button
											className="px-2 py-1 rounded border text-[11px]"
											onClick={() =>
												setMeta?.((m) => ({ ...m, notes: [], notesDraft: '' }))
											}>
											Clear
										</button>
									</div>
									{(meta?.notes || []).length > 0 && (
										<div className="mt-1 text-[10px] text-gray-600 line-clamp-4 whitespace-pre-wrap break-words border rounded p-1 bg-gray-50">
											{meta?.notes[0]}
										</div>
									)}
								</div>

								{/* Preview template removed per user request */}

								<div className="flex items-center justify-between">
									<span className="text-gray-700">Hints</span>
									<label className="flex items-center gap-1">
										<input
											type="checkbox"
											checked={hintsEnabled}
											onChange={(e) => setHintsEnabled(e.target.checked)}
										/>
									</label>
								</div>
								<div className="space-y-1">
									<div className="text-[11px] text-gray-600">Dealer</div>
									<div className="flex flex-wrap gap-1">
										{SEATS.map((s) => (
											<button
												key={`dealer-${s}`}
												onClick={() => setDealerExplicit(s)}
												className={`px-1.5 py-0.5 rounded text-[10px] border ${
													s === currentDealer
														? 'bg-amber-500 border-amber-600 text-white'
														: 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
												}`}>
												{s}
											</button>
										))}
									</div>
								</div>
								<div className="text-[11px] text-gray-700">
									Selected: {selectedCount} • Remaining: {remaining}
								</div>
								{/* HCP Allocator */}
								<div className="mt-1 border rounded p-2 bg-gray-50 space-y-1">
									<div className="text-[11px] font-semibold text-gray-800">
										Allocate HCP
									</div>
									<div className="grid grid-cols-2 gap-1">
										{SEATS.map((s) => (
											<div
												key={`hcp-${s}`}
												className="flex items-center justify-between gap-2">
												<label className="flex items-center gap-1">
													<input
														type="checkbox"
														checked={hcpEnabled[s]}
														onChange={(e) =>
															setHcpEnabled((prev) => ({
																...prev,
																[s]: e.target.checked,
															}))
														}
													/>
													<span className="w-5 text-center font-semibold">
														{s}
													</span>
												</label>
												<input
													type="number"
													min={0}
													max={29}
													value={hcpTargets[s]}
													disabled={!hcpEnabled[s]}
													onChange={(e) => {
														const v = Math.max(
															0,
															Math.min(
																29,
																Math.round(Number(e.target.value) || 0)
															)
														)
														setHcpTargets((prev) => ({ ...prev, [s]: v }))
													}}
													className="w-12 border rounded px-1 py-0.5 text-[11px]"
												/>
												<div className="flex items-center gap-1">
													<label className="flex items-center gap-1 text-[10px]">
														<input
															type="checkbox"
															checked={!!lockedSeats[s]}
															onChange={(e) =>
																setLockedSeats((prev) => ({
																	...prev,
																	[s]: e.target.checked,
																}))
															}
														/>
														<span title="Lock seat">🔒</span>
													</label>
												</div>
											</div>
										))}
									</div>
									{/* Shape constraints (optional) */}
									<div className="grid grid-cols-1 gap-1 mt-1">
										{SEATS.map((s) => (
											<div
												key={`shape-${s}`}
												className="flex items-center justify-between gap-1">
												<label className="flex items-center gap-1 text-[11px]">
													<span className="w-5 text-center font-semibold opacity-70">
														{s}
													</span>
													<span className="opacity-70">Maj≥</span>
													<input
														type="number"
														min={0}
														max={13}
														value={shapeMajorsMin[s]}
														disabled={!hcpEnabled[s]}
														onChange={(e) =>
															setShapeMajorsMin((prev) => ({
																...prev,
																[s]: Math.max(
																	0,
																	Math.min(13, Number(e.target.value) || 0)
																),
															}))
														}
														className="w-11 border rounded px-1 py-0.5 text-[11px]"
													/>
												</label>
												<label className="flex items-center gap-1 text-[11px]">
													<span className="opacity-70">Min≥</span>
													<input
														type="number"
														min={0}
														max={13}
														value={shapeMinorsMin[s]}
														disabled={!hcpEnabled[s]}
														onChange={(e) =>
															setShapeMinorsMin((prev) => ({
																...prev,
																[s]: Math.max(
																	0,
																	Math.min(13, Number(e.target.value) || 0)
																),
															}))
														}
														className="w-11 border rounded px-1 py-0.5 text-[11px]"
													/>
												</label>
											</div>
										))}
									</div>
									{hcpError && (
										<div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
											{hcpError}
										</div>
									)}
									<div className="flex items-center gap-2">
										<button
											className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] hover:bg-emerald-700"
											onClick={allocateHcpHands}
											title="Allocate exact HCP hands for selected seats; remaining cards stay in the deck for Randomize.">
											Allocate points
										</button>
										<button
											className="px-2 py-1 rounded border text-[11px]"
											onClick={() => {
												setHcpEnabled({
													N: false,
													E: false,
													S: false,
													W: false,
												})
												setHcpTargets({ N: 10, E: 10, S: 10, W: 10 })
												setShapeMajorsMin({ N: 0, E: 0, S: 0, W: 0 })
												setShapeMinorsMin({ N: 0, E: 0, S: 0, W: 0 })
												setHcpError('')
											}}>
											Reset HCP
										</button>
									</div>
								</div>
								{/* Shape relaxation modal */}
								{shapeModal.open && (
									<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
										<div className="bg-white rounded shadow-xl p-4 max-w-sm w-[90%]">
											<div className="text-sm font-semibold mb-2">
												Shape relaxed
											</div>
											<div className="text-[12px] whitespace-pre-wrap text-gray-700">
												{shapeModal.message}
											</div>
											<div className="mt-3 text-right">
												<button
													className="px-3 py-1 rounded bg-gray-800 text-white text-[12px]"
													onClick={() =>
														setShapeModal({ open: false, message: '' })
													}>
													OK
												</button>
											</div>
										</div>
									</div>
								)}
								<div className="grid grid-cols-1 gap-1">
									<button
										className="px-3 py-2 rounded bg-purple-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
										onClick={handleRandomComplete}
										disabled={remaining === 0}>
										Random Complete
									</button>
									{selectedCount > 0 && (
										<button
											className="px-3 py-2 rounded bg-gray-200 text-gray-800 text-xs hover:bg-gray-300"
											onClick={clearSelection}>
											Clear Selection
										</button>
									)}
									<button
										className="px-3 py-2 rounded bg-gray-900 text-white text-xs hover:opacity-90"
										onClick={resetBoard}>
										Reset Board
									</button>
									<button
										className="px-3 py-2 rounded bg-indigo-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
										onClick={saveCurrentHand}
										disabled={!complete}>
										Save Hand
									</button>
									<button
										className={`px-3 py-2 rounded text-white text-xs hover:opacity-90 disabled:opacity-40 ${
											copyState === 'ok'
												? 'bg-green-600'
												: copyState === 'err'
												? 'bg-rose-600'
												: 'bg-teal-500'
										}`}
										onClick={handleCopyPBN}
										disabled={savedHands.length === 0}>
										{copyState === 'ok'
											? 'Copied!'
											: copyState === 'err'
											? 'Copy failed'
											: 'Copy PBN'}
									</button>
									<button
										className="px-3 py-2 rounded bg-teal-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
										onClick={handleEmailPBN}
										disabled={savedHands.length === 0}>
										Email PBN
									</button>
									<div className="text-[11px] text-gray-600">
										Saved: {savedHands.length}
									</div>
									<button
										className="px-3 py-2 rounded bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-40"
										onClick={() => setShowDeleteModal(true)}
										disabled={savedHands.length === 0}>
										Delete PBN
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
				{!leftOpen && (
					<button
						className="absolute top-12 -right-3 z-20 w-6 h-8 rounded-md shadow bg-white border text-xs"
						onClick={() => setLeftOpen(true)}
						title="Expand left panel">
						▶
					</button>
				)}
			</div>

			{/* Main generator canvas */}
			<div className="flex-1 min-h-screen bg-gradient-to-b from-white to-slate-50">
				<div className="flex flex-col items-center w-full max-w-[1100px] mx-auto gap-2 px-2 py-2">
					{/* Randomize first: prominent and above the deck */}
					<div className="w-full flex items-center justify-center flex-wrap gap-2">
						<button
							className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm shadow hover:bg-purple-700"
							onClick={handleRandomComplete}
							disabled={remaining === 0}
							title="Quick random distribution">
							Randomize
						</button>
						<Tooltip
							label={
								'Generate a one-page quick use guide for the Generator & Player (workflow, options, advice engine).'
							}>
							<button
								className="ml-3 px-4 py-2 rounded-full bg-sky-600 text-white text-sm shadow hover:bg-sky-700"
								onClick={async () => {
									try {
										const { generateTeacherCheatSheetPDF } = await import(
											'./lib/teacherCheatSheetPdf'
										)
										await generateTeacherCheatSheetPDF()
									} catch (e) {
										console.error('Cheat sheet PDF failed', e)
									}
								}}>
								Quick Use Guide PDF
							</button>
						</Tooltip>
						{/* PBN import for editing */}
						<input
							ref={fileInputRef}
							type="file"
							accept=".pbn,text/plain"
							className="hidden"
							onChange={(e) => {
								const f = e.target.files && e.target.files[0]
								if (f) handleLoadPbnFile(f)
								e.target.value = ''
							}}
						/>
						<button
							className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm shadow hover:bg-amber-700"
							onClick={() => fileInputRef.current?.click()}
							title="Load a PBN file, pick a board, and edit the cards here">
							Load PBN for Editing…
						</button>
						{pbnImport && (
							<div className="flex items-center gap-2 text-[11px] text-gray-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
								<span
									className="font-semibold max-w-[220px] truncate"
									title={pbnImport.filename}>
									Loaded: {pbnImport.filename}
								</span>
								{pbnImport.deals.length > 1 && (
									<>
										<button
											className="px-2 py-0.5 rounded border bg-white"
											onClick={() => {
												const next =
													(pbnImport.index - 1 + pbnImport.deals.length) %
													pbnImport.deals.length
												if (applyImportedBoard(pbnImport.deals, next))
													setPbnImport({ ...pbnImport, index: next })
											}}>
											◀
										</button>
										<span>
											Board{' '}
											{pbnImport.deals[pbnImport.index].board ||
												pbnImport.index + 1}{' '}
											({pbnImport.index + 1}/{pbnImport.deals.length})
										</span>
										<button
											className="px-2 py-0.5 rounded border bg-white"
											onClick={() => {
												const next =
													(pbnImport.index + 1) % pbnImport.deals.length
												if (applyImportedBoard(pbnImport.deals, next))
													setPbnImport({ ...pbnImport, index: next })
											}}>
											▶
										</button>
									</>
								)}
							</div>
						)}
					</div>

					{/* Deck with DnD */}

					{SEATS.includes(dragSource) && hintsEnabled && (
						<div className="w-full text-center mb-1">
							<span className="inline-block text-[11px] text-gray-700 px-2 py-1 bg-gray-50 border border-dashed border-gray-400 rounded">
								Drop here to return to deck
							</span>
						</div>
					)}

					<div
						className="flex flex-wrap gap-1 mb-2 justify-center min-h-[60px]"
						onDragOver={(e) => {
							e.preventDefault()
							try {
								e.dataTransfer.dropEffect = 'move'
							} catch {
								void 0
							}
						}}
						onDrop={onDropToDeck}>
						{deal.deck.map((card) => {
							const isSelected = selected.has(card.id)
							return (
								<div
									key={card.id}
									draggable
									onDragStart={(e) => onDragStartDeck(e, card)}
									onDragEnd={onDragEnd}
									onClick={() => toggleSelect(card.id)}
									className={`rounded-lg shadow-md cursor-pointer select-none transition-all duration-150 font-serif w-[48px] h-[72px] flex flex-col items-center justify-center border border-neutral-300 bg-[#FFF8E7] ${
										isSelected
											? 'ring-4 ring-yellow-300 scale-105'
											: 'hover:scale-105'
									}`}
									title={
										hintsEnabled ? 'Click to select, drag to a seat' : undefined
									}>
									{renderFace(card, true)}
								</div>
							)
						})}
					</div>

					{/* Save and onboarding guidance under the deck */}
					<div className="w-full max-w-[900px] mx-auto mb-2">
						<div className="rounded-md border border-gray-200 bg-white p-3 flex flex-col gap-2 items-start">
							<div className="text-[12px] text-gray-800">
								{complete ? (
									<span>
										Ready to save this board — Board {nextBoardNo} (Dealer{' '}
										{currentDealer}, Vul {vulnerabilityForBoard(nextBoardNo)}).
									</span>
								) : (
									<span>
										Deal all 52 cards into the four hands. Remaining in deck:{' '}
										{remaining}.
									</span>
								)}
							</div>
							<div className="flex flex-col md:flex-row md:items-center md:gap-3 w-full">
								<div className="flex items-center gap-2 flex-wrap">
									<Tooltip
										label={
											complete
												? 'Save this complete deal with current notes.'
												: 'All four hands must contain 13 cards.'
										}>
										<button
											className="px-4 py-2 rounded bg-indigo-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
											onClick={saveCurrentHand}
											disabled={!complete}>
											Save Hand
										</button>
									</Tooltip>
									<Tooltip
										label={
											savedHands.length
												? 'Download your current PBN file with all saved boards. You can re-save after each additional board.'
												: 'Save at least one board first.'
										}>
										<button
											className="px-4 py-2 rounded bg-teal-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
											onClick={handleGeneratePBN}
											disabled={savedHands.length === 0}>
											Download PBN (saved boards)
										</button>
									</Tooltip>
									<Tooltip
										label={
											'Generate a formatted PDF handout (2 boards/page) including notes, metadata, and makeables.'
										}>
										<button
											className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-40 disabled:cursor-not-allowed ${
												savedHands.length === 0
													? 'bg-rose-600 text-white'
													: 'bg-rose-600 text-white hover:bg-rose-700'
											}`}
											disabled={savedHands.length === 0}
											onClick={async () => {
												if (savedHands.length === 0) return
												try {
													const { generateHandoutPDF } = await import(
														'./lib/handoutPdf'
													)
													const dealsForPdf = savedHands.map((h, i) => {
														const boardNo = startBoard + i
														const dealer = dealerForBoard(boardNo)
														const vul = vulnerabilityForBoard(boardNo)
														const notes = h.meta?.notes || []
														const auctionTokens = (h.meta?.auctionText || '')
															.trim()
															.split(/\s+/)
															.filter(Boolean)
															.map((t) => (t === 'P' ? 'Pass' : t))
														return {
															number: boardNo,
															dealer,
															vul,
															hands: { N: h.N, E: h.E, S: h.S, W: h.W },
															notes,
															calls: auctionTokens,
															contract: h.meta?.contract,
															declarer: h.meta?.declarer,
															meta: { ...h.meta },
														}
													})
													const now = new Date()
													const yyyy = now.getFullYear()
													const mm = String(now.getMonth() + 1).padStart(2, '0')
													const dd = String(now.getDate()).padStart(2, '0')
													let themeRaw = ''
													if (meta?.themeChoice) {
														if (meta.themeChoice === 'Custom…')
															themeRaw = meta?.themeCustom || ''
														else themeRaw = meta.themeChoice
													}
													const safeTheme =
														(themeRaw || 'Session')
															.toLowerCase()
															.replace(/[^a-z0-9]+/g, '-')
															.replace(/^-+|-+$/g, '')
															.slice(0, 40) || 'session'
													const base = `bbc-pbn`
													await generateHandoutPDF(dealsForPdf, {
														mode: 'full',
														filenameBase: base,
														autoNotes: true,
														includeMakeableGrid: true,
														copyright: '',
													})
												} catch (e) {
													console.error('PDF handout failed', e)
												}
											}}>
											<span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-sm bg-white/20">
												PDF
											</span>
											<span>PDF Handout (.pdf)</span>
										</button>
									</Tooltip>
									<Tooltip
										label={
											'Export a Word (.docx) handout with hard page breaks (one board per page).'
										}>
										<button
											className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed ${
												savedHands.length === 0
													? 'bg-blue-600 text-white'
													: 'bg-blue-600 text-white hover:bg-blue-700'
											}`}
											disabled={savedHands.length === 0}
											onClick={async () => {
												if (savedHands.length === 0) return
												try {
													const { generateHandoutDOCX } = await import(
														'./lib/handoutDocx'
													)
													const dealsForDoc = savedHands.map((h, i) => {
														const boardNo = startBoard + i
														const dealer = dealerForBoard(boardNo)
														const vul = vulnerabilityForBoard(boardNo)
														const notes = h.meta?.notes || []
														const auctionTokens = (h.meta?.auctionText || '')
															.trim()
															.split(/\s+/)
															.filter(Boolean)
															.map((t) => (t === 'P' ? 'Pass' : t))
														return {
															number: boardNo,
															dealer,
															vul,
															hands: { N: h.N, E: h.E, S: h.S, W: h.W },
															notes,
															calls: auctionTokens,
															contract: h.meta?.contract,
															declarer: h.meta?.declarer,
															meta: { ...h.meta },
														}
													})
													const now = new Date()
													const yyyy = now.getFullYear()
													const mm = String(now.getMonth() + 1).padStart(2, '0')
													const dd = String(now.getDate()).padStart(2, '0')
													let themeRaw = ''
													if (meta?.themeChoice) {
														if (meta.themeChoice === 'Custom…')
															themeRaw = meta?.themeCustom || ''
														else themeRaw = meta.themeChoice
													}
													const safeTheme =
														(themeRaw || 'Session')
															.toLowerCase()
															.replace(/[^a-z0-9]+/g, '-')
															.replace(/^-+|-+$/g, '')
															.slice(0, 40) || 'session'
													const base = `bbc-pbn`
													await generateHandoutDOCX(dealsForDoc, {
														filenameBase: base,
													})
												} catch (e) {
													console.error('DOC handout failed', e)
												}
											}}>
											<span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-sm bg-white/20">
												W
											</span>
											<span>Word Handout (.docx)</span>
										</button>
									</Tooltip>
									<Tooltip
										label={
											'Export a Pages-friendly handout (.rtf) with one board per page. Opens cleanly in Apple Pages.'
										}>
										<button
											className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed ${
												savedHands.length === 0
													? 'bg-emerald-600 text-white'
													: 'bg-emerald-600 text-white hover:bg-emerald-700'
											}`}
											disabled={savedHands.length === 0}
											onClick={async () => {
												if (savedHands.length === 0) return
												try {
													const { generateHandoutRTF } = await import(
														'./lib/handoutRtf'
													)
													const dealsForRtf = savedHands.map((h, i) => {
														const boardNo = startBoard + i
														const dealer = dealerForBoard(boardNo)
														const vul = vulnerabilityForBoard(boardNo)
														const notes = h.meta?.notes || []
														const auctionTokens = (h.meta?.auctionText || '')
															.trim()
															.split(/\s+/)
															.filter(Boolean)
															.map((t) => (t === 'P' ? 'Pass' : t))
														return {
															number: boardNo,
															dealer,
															vul,
															hands: { N: h.N, E: h.E, S: h.S, W: h.W },
															notes,
															calls: auctionTokens,
															contract: h.meta?.contract,
															declarer: h.meta?.declarer,
															meta: { ...h.meta },
														}
													})
													const now = new Date()
													const yyyy = now.getFullYear()
													const mm = String(now.getMonth() + 1).padStart(2, '0')
													const dd = String(now.getDate()).padStart(2, '0')
													let themeRaw = ''
													if (meta?.themeChoice) {
														if (meta.themeChoice === 'Custom…')
															themeRaw = meta?.themeCustom || ''
														else themeRaw = meta.themeChoice
													}
													const safeTheme =
														(themeRaw || 'Session')
															.toLowerCase()
															.replace(/[^a-z0-9]+/g, '-')
															.replace(/^-+|-+$/g, '')
															.slice(0, 40) || 'session'
													const base = `bbc-pbn`
													await generateHandoutRTF(dealsForRtf, {
														filenameBase: base,
													})
												} catch (e) {
													console.error('Pages handout failed', e)
												}
											}}>
											<span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-sm bg-white/20">
												P
											</span>
											<span>Pages Handout (.rtf)</span>
										</button>
									</Tooltip>
									<Tooltip
										label={
											'Export PBN in a legacy-friendly format preferred by Dealer4 (minimal tags, multiline auctions).'
										}>
										<label className="flex items-center gap-1 text-[11px] text-gray-700 select-none cursor-pointer">
											<input
												type="checkbox"
												checked={dealer4Mode}
												onChange={(e) => setDealer4Mode(e.target.checked)}
											/>
											<span>Dealer4‑compatible PBN</span>
										</label>
									</Tooltip>
									{/* Makeable contracts grid is always included in handouts */}
									{/* Overtricks toggle removed: always show raw − 6 */}
									<span className="text-[11px] text-gray-600">
										Saved: {savedHands.length}
									</span>
								</div>
							</div>
							<div className="text-[11px] text-gray-600 mt-1">
								Save hands as you go. Click "Download PBN (saved boards)"
								anytime to download the current PBN with all saved boards;
								re-click after adding more. At the end of your session, download
								a final PBN.
							</div>
						</div>
					</div>
					<div className="flex flex-wrap gap-2 justify-center -mt-1 mb-1 w-full">
						<button
							className={`px-3 py-2 rounded ${
								kbMode ? 'bg-black text-white' : 'bg-gray-900 text-white'
							} text-xs hover:opacity-90`}
							onClick={() => {
								setKbMode((v) => !v)
								if (!kbMode) {
									resetKb()
								}
							}}
							title="Toggle keyboard entry (type ranks then Enter; Enter on empty = void; Esc to exit)">
							{kbMode ? 'Keyboard: ON' : 'Keyboard: OFF'}
						</button>
						<button
							className="px-3 py-2 rounded bg-sky-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
							onClick={() => sendSelectedTo('N')}
							disabled={selectedCount === 0 || deal.buckets.N.length >= 13}
							title={
								hintsEnabled ? 'Send selected deck cards to North' : undefined
							}>
							Send North
						</button>
						<button
							className="px-3 py-2 rounded bg-amber-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
							onClick={() => sendSelectedTo('W')}
							disabled={selectedCount === 0 || deal.buckets.W.length >= 13}
							title={
								hintsEnabled ? 'Send selected deck cards to West' : undefined
							}>
							Send West
						</button>
						<button
							className="px-3 py-2 rounded bg-rose-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
							onClick={() => sendSelectedTo('E')}
							disabled={selectedCount === 0 || deal.buckets.E.length >= 13}
							title={
								hintsEnabled ? 'Send selected deck cards to East' : undefined
							}>
							Send East
						</button>
						<button
							className="px-3 py-2 rounded bg-emerald-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
							onClick={() => sendSelectedTo('S')}
							disabled={selectedCount === 0 || deal.buckets.S.length >= 13}
							title={
								hintsEnabled ? 'Send selected deck cards to South' : undefined
							}>
							Send South
						</button>
					</div>

					{/* Buckets row: iPhone tabs vs desktop grid */}
					{isIPhone ? (
						<div className="w-full max-w-sm mx-auto">
							<div className="flex items-center justify-center gap-1 p-1 rounded-lg border bg-white sticky top-0 z-10">
								{SEATS.map((s) => (
									<button
										key={`tab-${s}`}
										onClick={() => setActiveSeat(s)}
										className={`flex-1 px-2 py-1 rounded text-xs border ${
											activeSeat === s ? 'bg-gray-900 text-white' : 'bg-white'
										}`}>
										{s}
									</button>
								))}
							</div>
							<div className="mt-2 flex items-center justify-center">
								<Bucket id={activeSeat} />
							</div>
						</div>
					) : (
						<div className="w-full flex items-start justify-center gap-2">
							<div className="flex flex-row flex-wrap items-start justify-center gap-2">
								<Bucket id="N" />
								<Bucket id="E" />
								<Bucket id="S" />
								<Bucket id="W" />
							</div>
						</div>
					)}

					{/* Live Makeable Contracts panel */}
					<div className="w-full max-w-[900px] mx-auto my-2">
						<div className="rounded-md border border-gray-200 bg-white p-3">
							<div className="flex items-center justify-between">
								<div className="text-sm font-semibold">Makeable Contracts</div>
								<div
									className="text-[11px] text-gray-500"
									title="Double-dummy assumes perfect play/defence.">
									ⓘ Double-dummy assumes perfect play/defence.
								</div>
							</div>
							<div className="mt-2">
								{gridState.status === 'incomplete' && (
									<div className="text-[12px] text-gray-700">
										Complete the board to compute the table.
									</div>
								)}
								{gridState.status === 'computing' && (
									<div className="text-[12px] text-gray-700">Computing…</div>
								)}
								{gridState.status === 'error' && (
									<div className="text-[12px] text-rose-700">
										Error computing table:{' '}
										{String(gridState.error || 'Unknown')}
									</div>
								)}
								{gridState.status === 'ready' && gridData?.table && (
									<div className="rounded-md border border-gray-200 overflow-hidden shadow-sm inline-block">
										<table className="text-[12px] table-fixed min-w-[360px]">
											<thead>
												<tr className="bg-gray-50 text-gray-700">
													<th className="w-24 px-2 py-1 text-left font-semibold">
														Suit
													</th>
													{['N', 'E', 'S', 'W'].map((h) => (
														<th
															key={h}
															className="w-14 px-2 py-1 text-center font-semibold">
															{h}
														</th>
													))}
												</tr>
											</thead>
											<tbody className="divide-y divide-gray-200">
												{['S', 'H', 'D', 'C', 'NT'].map((st, idx) => (
													<tr
														key={st}
														className={
															idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
														}>
														<td className="px-2 py-1 font-semibold">
															{st === 'S' && (
																<span className="text-black">♠ Spades</span>
															)}
															{st === 'H' && (
																<span className="text-red-600">♥ Hearts</span>
															)}
															{st === 'D' && (
																<span className="text-red-600">♦ Diamonds</span>
															)}
															{st === 'C' && (
																<span className="text-black">♣ Clubs</span>
															)}
															{st === 'NT' && (
																<span className="inline-flex items-center gap-1 text-gray-800">
																	<span className="inline-block px-1 py-0.5 text-[10px] leading-none rounded border">
																		NT
																	</span>{' '}
																	No‑Trump
																</span>
															)}
														</td>
														{['N', 'E', 'S', 'W'].map((seat) => {
															const raw = gridData.table?.table?.[st]?.[seat]
															const v = Number.isFinite(raw)
																? Math.max(0, raw - 6)
																: ''
															return (
																<td
																	key={seat}
																	className="px-2 py-1 text-center font-mono tabular-nums text-[12px]">
																	{v}
																</td>
															)
														})}
													</tr>
												))}
											</tbody>
										</table>
										<div className="px-2 py-1 text-[10px] text-gray-600 border-t bg-white">
											Showing overtricks (raw − 6)
										</div>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Preview and toolbar sections moved or kept below as needed */}
					{/* ...existing code... */}

					{/* Confirmation Modal */}
					{showDeleteModal && (
						<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
							<div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[90%] max-w-sm p-4">
								<h3 className="text-sm font-semibold text-gray-800 mb-2">
									Delete all saved PBN deals?
								</h3>
								<p className="text-xs text-gray-700 mb-4">
									This will remove all saved boards and reset the app to the
									start. This action cannot be undone.
								</p>
								<div className="flex items-center justify-end gap-2">
									<button
										className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs border border-gray-300"
										onClick={() => setShowDeleteModal(false)}>
										Cancel
									</button>
									<button
										className="px-3 py-1.5 rounded bg-rose-600 text-white text-xs hover:bg-rose-700"
										onClick={() => {
											fullReset()
											setShowDeleteModal(false)
										}}>
										Delete
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

// Confirmation Modal for delete (restored)
// Keep outside main return to avoid accidental duplication; rendered where state lives above.

