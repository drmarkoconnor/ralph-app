import { useEffect, useMemo, useRef, useState } from 'react'
import { BoardZ } from './schemas/board'
import { exportBoardPBN } from './pbn/export'
import useIsIPhone from './hooks/useIsIPhone'

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

function hcpOfCards(cards) {
	const pts = { A: 4, K: 3, Q: 2, J: 1 }
	return cards.reduce((sum, c) => sum + (pts[c.rank] || 0), 0)
}

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

	// Metadata preview (Template)
	const [exportPreview, setExportPreview] = useState('')
	const toPbnDate = (iso) => (iso ? String(iso).replace(/-/g, '.') : '')
	const onExportTemplate = async () => {
		try {
			const site =
				meta?.siteChoice === 'Other'
					? meta?.siteOther || 'Other'
					: meta?.siteChoice
			const theme =
				meta?.themeChoice === 'Custom…'
					? meta?.themeCustom || ''
					: meta?.themeChoice
			const auctionTokens = String(meta?.auctionText || '')
				.trim()
				.split(/\s+/)
				.filter(Boolean)
			const sample = BoardZ.parse({
				event: meta?.event || 'Club Teaching session',
				site,
				date: meta?.date || toPbnDate(meta?.dateISO),
				board: 1,
				dealer: 'N',
				vul: 'None',
				dealPrefix: 'N',
				hands: {
					N: { S: [], H: [], D: [], C: [] },
					E: { S: [], H: [], D: [], C: [] },
					S: { S: [], H: [], D: [], C: [] },
					W: { S: [], H: [], D: [], C: [] },
				},
				auctionStart: auctionTokens.length
					? meta?.auctionStart || 'N'
					: undefined,
				auction: auctionTokens.length ? auctionTokens : undefined,
				ext: {
					system: meta?.system || undefined,
					theme: theme || undefined,
					interf: meta?.interf || undefined,
					lead: meta?.lead || undefined,
					ddpar: meta?.ddpar || undefined,
					scoring: meta?.scoring || undefined,
					playscript: meta?.playscript || undefined,
				},
				notes: meta?.notes && meta.notes.length ? meta.notes : [],
			})
			const txt = await exportBoardPBN(sample)
			setExportPreview(txt)
		} catch (e) {
			setExportPreview(String(e))
		}
	}

	// Left controls panel state
	const [leftOpen, setLeftOpen] = useState(true)
	const isIPhone = useIsIPhone()
	const [activeSeat, setActiveSeat] = useState('N')
	const [includeHandout, setIncludeHandout] = useState(false)
	const [handoutMode, setHandoutMode] = useState('basic') // 'basic' | 'full'

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
	}

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
				const idx = Math.floor(Math.random() * pool.length)
				const [card] = pool.splice(idx, 1)
				const order = ['N', 'E', 'S', 'W']
				for (let i = 0; i < 20; i++) {
					const b = order[Math.floor(Math.random() * 4)]
					if (nextBuckets[b].length < 13) {
						nextBuckets[b] = [...nextBuckets[b], card]
						break
					}
				}
			}
			return { deck: [], buckets: nextBuckets }
		})
		setSelected(new Set())
	}

	const saveCurrentHand = () => {
		if (!complete) return
		// Snapshot current teaching metadata so later edits don't retroactively change earlier saved hands
		const snapshotTheme =
			meta?.themeChoice === 'Custom…' ? meta?.themeCustom || '' : meta?.themeChoice || ''
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
			auctionStart: meta?.auctionStart,
			auctionText: meta?.auctionText,
			playscript: meta?.playscript,
			notes: meta?.notes ? [...meta.notes] : [],
		}
		setSavedHands((prev) => [
			...prev,
			{ N: deal.buckets.N, E: deal.buckets.E, S: deal.buckets.S, W: deal.buckets.W, meta: snapshot },
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
		const safeTheme = (themeRaw || 'Session')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'session'
		a.download = `ralph-${datePart}-${safeTheme}-hand.pbn`
		a.click()
		URL.revokeObjectURL(url)
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
		const siteChoice = metaSnap.siteChoice || meta?.siteChoice || 'Bristol Bridge Club'
		const site = siteChoice === 'Other' ? metaSnap.siteOther || meta?.siteOther || 'Other' : siteChoice
		const dateStr = metaSnap.date || meta?.date || dateStrDefault
		const theme = metaSnap.theme || (
			meta?.themeChoice === 'Custom…' ? meta?.themeCustom || '' : meta?.themeChoice
		)
		const auctionTokens = (metaSnap.auctionText || meta?.auctionText || '')
			.trim()
			.split(/\s+/)
			.filter(Boolean)

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
			notes: metaSnap.notes && metaSnap.notes.length ? metaSnap.notes : meta?.notes || [],
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
			const txt = await exportBoardPBN(board)
			texts.push(txt)
		}
		return texts.join('')
	}

	const handleGeneratePBN = async () => {
		if (savedHands.length === 0) return
		try {
			const pbn = await exportSavedBoards()
			downloadPBN(pbn)
			if (includeHandout) {
				try {
					const pdfBlob = await generateHandoutPDF({
						savedHands,
						meta,
						startBoard,
						mode: handoutMode,
					})
					const url = URL.createObjectURL(pdfBlob)
					const a = document.createElement('a')
					a.href = url
					a.download = 'hands.pdf'
					a.click()
					URL.revokeObjectURL(url)
				} catch (err) {
					console.error('PDF handout failed', err)
				}
			}
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

	// PDF Handout generator (lazy-load jsPDF)
	async function generateHandoutPDF({ savedHands, meta, startBoard, mode = 'basic' }) {
		const { jsPDF } = await import('jspdf')
		const doc = new jsPDF({ unit: 'mm', format: 'a4' })
		const pageW = 210
		const pageH = 297
		const marginX = 12
		// Per revised requirement: always 2 boards per page (ignore former 3/page basic mode)
		const blocksPerPage = 2
		const usableH = pageH - marginX * 2
		const blockH = usableH / blocksPerPage - 4
		const title = meta?.event || 'Bridge Teaching Session'
		let boardOnPage = 0

		const rankOrder = {
			A: 14,
			K: 13,
			Q: 12,
			J: 11,
			T: 10,
			'10': 10,
			9: 9,
			8: 8,
			7: 7,
			6: 6,
			5: 5,
			4: 4,
			3: 3,
			2: 2,
		}
		const sortDisplay = (cards) =>
			[...cards].sort((a, b) => rankOrder[b.rank] - rankOrder[a.rank])
		// Suits drawn as vector glyphs to ensure visibility in PDF (no font glyph dependency)
		const suitOrderDisplay = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
		const rankString = (seatCards, suit) => {
			const arr = sortDisplay(seatCards.filter((c) => c.suit === suit))
			if (!arr.length) return '—'
			return arr.map((c) => (c.rank === '10' ? 'T' : c.rank)).join('')
		}
		const drawSuitIcon = (suit, x, y, size = 3.6) => {
			const half = size / 2
			doc.setDrawColor(0, 0, 0)
			if (suit === 'Hearts' || suit === 'Diamonds') doc.setFillColor(190, 0, 0)
			else doc.setFillColor(0, 0, 0)
			if (suit === 'Diamonds') {
				// Diamond: simple rotated square
				doc.saveGraphicsState?.()
				doc.triangle(x + half, y, x + size, y + half, x + half, y + size, 'F')
				doc.triangle(x + half, y, x, y + half, x + half, y + size, 'F')
				return
			}
			if (suit === 'Clubs') {
				// Three circles + stem
				const r = half * 0.55
				doc.circle(x + half, y + r, r, 'F')
				doc.circle(x + r, y + half + r * 0.1, r, 'F')
				doc.circle(x + size - r, y + half + r * 0.1, r, 'F')
				// stem
				doc.rect(x + half - r * 0.35, y + half, r * 0.7, half + r * 0.6, 'F')
				return
			}
			if (suit === 'Hearts') {
				// Two circles + inverted triangle
				const r = half * 0.6
				doc.circle(x + half - r * 0.55, y + r, r, 'F')
				doc.circle(x + half + r * 0.55, y + r, r, 'F')
				doc.triangle(
					x + half,
					y + size,
					x + size,
					y + r + r * 0.2,
					x,
					y + r + r * 0.2,
					'F'
				)
				return
			}
			if (suit === 'Spades') {
				// Inverted heart + stem
				const r = half * 0.6
				doc.circle(x + half - r * 0.55, y + half, r, 'F')
				doc.circle(x + half + r * 0.55, y + half, r, 'F')
				doc.triangle(
					x + half,
					y,
					x + size,
					y + half + r * 0.2,
					x,
					y + half + r * 0.2,
					'F'
				)
				// stem
				doc.rect(x + half - r * 0.35, y + half + r * 0.4, r * 0.7, half + r * 0.6, 'F')
			}
		}

		const drawBoardBlock = (handObj, boardNo) => {
			const gap = 6
			const topY = marginX + boardOnPage * (blockH + gap)
			// Header
			doc.setFontSize(11)
			doc.setFont('helvetica', 'bold')
			doc.text(
				`Board ${boardNo}  Dealer ${dealerForBoard(boardNo)}  Vul ${vulnerabilityForBoard(boardNo)}`,
				marginX,
				topY + 5
			)
			doc.setFontSize(9)
			doc.setFont('helvetica', 'normal')
			doc.text(title, marginX, topY + 10)

			// Notes beneath header (left)
			const m = handObj.meta || meta || {}
			const rawNotes = Array.isArray(m.notes) ? m.notes : []
			const maxNoteLines = mode === 'full' ? 10 : 5
			const notesLines = rawNotes.slice(0, maxNoteLines).map(n=> (n||'').trim()).filter(Boolean)
			if (notesLines.length) {
				doc.setFontSize(7.5)
				doc.setFont('helvetica','bold')
				doc.text('Notes', marginX, topY + 14)
				doc.setFont('helvetica','normal')
				notesLines.forEach((ln,i)=> {
					doc.text('• ' + ln, marginX, topY + 18 + i*4, { maxWidth: 80 })
				})
			}
			const notesHeight = notesLines.length ? (notesLines.length * 4) + 8 : 0

			// Hands diagram region now placed below notes
			const centerX = pageW / 2
			const centerY = topY + 30 + notesHeight
			const horizontalOffset = 60
			const lineHeight = 5.2
			const suitIconSize = 4.2
			const textOffsetX = suitIconSize + 1.8

			const drawSeat = (label, cards, x, y, seatAlign = 'center') => {
				doc.setFont('helvetica', 'bold')
				doc.setFontSize(10)
				doc.text(label, x, y, { align: seatAlign })
				doc.setFont('helvetica', 'normal')
				doc.setFontSize(9.5)
				suitOrderDisplay.forEach((s, idx) => {
					const lineY = y + (idx + 1) * lineHeight
					// Determine starting X for left/center/right alignment when drawing icon+text manually
					let startX = x
					if (seatAlign === 'center') startX = x - 18 // approximate half width
					if (seatAlign === 'right') startX = x - 36
					const color = s === 'Hearts' || s === 'Diamonds' ? [180, 0, 0] : [0, 0, 0]
					doc.setTextColor(0, 0, 0)
					drawSuitIcon(s, startX, lineY - suitIconSize + 1.2, suitIconSize)
					doc.setTextColor(...color)
					doc.text(rankString(cards, s), startX + textOffsetX, lineY)
				})
				doc.setTextColor(0, 0, 0)
			}

			// Extract seat arrays
			const N = handObj.N
			const E = handObj.E
			const S = handObj.S
			const W = handObj.W

			// Draw seats (N top) with updated spacing
			drawSeat('North', N, centerX, centerY - 28, 'center')
			drawSeat('South', S, centerX, centerY + 38, 'center')
			drawSeat('West', W, centerX - horizontalOffset, centerY + 2, 'left')
			drawSeat('East', E, centerX + horizontalOffset, centerY + 2, 'right')

			// Metadata compact box (right)
			const metaX = pageW - marginX - 58
			const metaY = topY + 14
			doc.setFont('helvetica','bold')
			doc.setFontSize(8)
			doc.text('Meta', metaX, metaY)
			doc.setFont('helvetica','normal')
			let my = metaY + 4
			const metaLine = (label,val) => { if(!val) return; doc.text(`${label}: ${val}`, metaX, my, { maxWidth: 58 }); my += 4 }
			metaLine('Ideal', m.ddpar)
			metaLine('Lead', m.lead)
			if (mode === 'full') {
				metaLine('System', m.system)
				metaLine('Theme', m.theme)
				metaLine('Score', m.scoring)
				metaLine('Interf', m.interf)
				if (m.auctionText) metaLine('Auction', m.auctionText)
				if (m.playscript) {
					const firstPlay = String(m.playscript).split(/\n/).filter(Boolean)[0]
					metaLine('LeadSeq', firstPlay)
				}
			}
		}

		for (let i = 0; i < savedHands.length; i++) {
			if (i !== 0 && i % blocksPerPage === 0) {
				doc.addPage()
				boardOnPage = 0
			}
			const boardNo = startBoard + i
			drawBoardBlock(savedHands[i], boardNo)
			boardOnPage++
		}

		return doc.output('blob')
	}

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
					leftOpen ? 'w-72' : 'w-10'
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
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, themeChoice: e.target.value }))
										}>
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

								{/* Auction & Play */}
								<div className="pt-1 border-t space-y-1">
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
										className="border rounded px-1 py-0.5 text-[11px] h-16 w-full"
										value={meta?.notesDraft || ''}
										onChange={(e) =>
											setMeta?.((m) => ({ ...m, notesDraft: e.target.value }))
										}
										placeholder="Paste teaching notes here..."
									/>
									<div className="flex items-center gap-1">
										<button
											className="px-2 py-1 rounded border text-[11px]"
											onClick={() => {
												const raw = String(meta?.notesDraft || '').trim()
												if (!raw) return
												const blocks = raw.split(/\n\s*\n/).filter(Boolean)
												const chunks = []
												const pushChunk = (s) => {
													const trimmed = s.trim()
													if (!trimmed) return
													for (let i = 0; i < trimmed.length; i += 280) {
														chunks.push(trimmed.slice(i, i + 280))
													}
												}
												if (blocks.length > 1) blocks.forEach(pushChunk)
												else pushChunk(raw)
												setMeta?.((m) => ({ ...m, notes: chunks.slice(0, 10) }))
											}}>
											Split
										</button>
										<button
											className="px-2 py-1 rounded border text-[11px]"
											onClick={() =>
												setMeta?.((m) => ({ ...m, notes: [], notesDraft: '' }))
											}>
											Clear
										</button>
									</div>
									<div className="flex flex-col gap-1">
										{(meta?.notes || []).map((n, idx) => (
											<div key={idx} className="flex items-center gap-1">
												<input
													className="border rounded px-1 py-0.5 text-[11px] flex-1"
													value={n}
													onChange={(e) => {
														const arr = [...(meta?.notes || [])]
														arr[idx] = e.target.value
														setMeta?.((m) => ({ ...m, notes: arr }))
													}}
												/>
												<button
													className="px-2 py-1 rounded border text-[11px]"
													onClick={() => {
														const arr = (meta?.notes || []).filter(
															(_, i) => i !== idx
														)
														setMeta?.((m) => ({ ...m, notes: arr }))
													}}>
													✕
												</button>
											</div>
										))}
										{(meta?.notes || []).length < 10 && (
											<button
												className="px-2 py-1 rounded border text-[11px] self-start"
												onClick={() =>
													setMeta?.((m) => ({
														...m,
														notes: [...(m.notes || []), ''],
													}))
												}>
												+ Add note
											</button>
										)}
									</div>
								</div>

								<div className="pt-1 border-t space-y-1">
									<button
										className="w-full px-2 py-1 rounded border bg-white text-[11px]"
										onClick={onExportTemplate}>
										Preview Template
									</button>
									{exportPreview && (
										<pre className="whitespace-pre-wrap text-[10px] leading-tight bg-gray-50 border border-gray-200 rounded p-2 max-h-24 overflow-y-auto">
											{exportPreview}
										</pre>
									)}
								</div>

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
					<div className="w-full flex items-center justify-center">
						<button
							className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm shadow hover:bg-purple-700"
							onClick={handleRandomComplete}
							disabled={remaining === 0}
							title="Quick random distribution">
							Randomize
						</button>
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
									<button
										className="px-4 py-2 rounded bg-indigo-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
										onClick={saveCurrentHand}
										disabled={!complete}
										title={
											complete
												? 'Save this complete deal'
												: 'Finish distributing to enable saving'
										}>
										Save Hand
									</button>
									<button
										className="px-4 py-2 rounded bg-teal-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
										onClick={handleGeneratePBN}
										disabled={savedHands.length === 0}
										title={
											savedHands.length
												? 'Generate a PBN file of all saved boards now'
												: 'Save at least one board first'
										}>
										Save all to PBN now
									</button>
									<label className="flex items-center gap-1 text-[11px] text-gray-700 select-none">
										<input
											type="checkbox"
											checked={includeHandout}
											onChange={(e) => setIncludeHandout(e.target.checked)}
										/>
										<span>Handout PDF</span>
									</label>
									{includeHandout && (
										<div className="flex items-center gap-1 text-[11px]">
											<select
												className="border rounded px-1 py-0.5 text-[11px]"
												value={handoutMode}
												onChange={(e) => setHandoutMode(e.target.value)}>
												<option value="basic">Basic</option>
												<option value="full">Full detail</option>
											</select>
										</div>
									)}
									<span className="text-[11px] text-gray-600">
										Saved: {savedHands.length}
									</span>
								</div>
							</div>
							<div className="text-[11px] text-gray-600 mt-1">
								Keep dealing and saving boards. When ready, click "Save all to
								PBN now" to download your cumulative PBN file.
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

