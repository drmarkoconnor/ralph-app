import { useEffect, useMemo, useRef, useState } from 'react'

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

function formatSeatPBN(cards) {
	const suitOrder = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
	return suitOrder
		.map((s) => {
			const suited = sortByPbnRank(cards.filter((c) => c.suit === s))
			const txt = suited.map((c) => (c.rank === '10' ? 'T' : c.rank)).join('')
			return txt || '-'
		})
		.join('.')
}

function buildPBN(hands, startBoard = 1) {
	const today = new Date()
	const y = today.getFullYear()
	const m = String(today.getMonth() + 1).padStart(2, '0')
	const d = String(today.getDate()).padStart(2, '0')
	const date = `${y}.${m}.${d}`
	const crlf = '\r\n'
	let out = ''
	hands.forEach((h, i) => {
		const boardNo = startBoard + i
		const dealer = dealerForBoard(boardNo)
		const vul = vulnerabilityForBoard(boardNo)
		// hands listed starting from dealer, clockwise
		const orderMap = {
			N: ['N', 'E', 'S', 'W'],
			E: ['E', 'S', 'W', 'N'],
			S: ['S', 'W', 'N', 'E'],
			W: ['W', 'N', 'E', 'S'],
		}
		const order = orderMap[dealer]
		const handsStr = order.map((seat) => formatSeatPBN(h[seat])).join(' ')
		const deal = `${dealer}:${handsStr}`
		out += `[Event "Club Session"]${crlf}`
		out += `[Site "Local"]${crlf}`
		out += `[Date "${date}"]${crlf}`
		out += `[Board "${boardNo}"]${crlf}`
		out += `[Dealer "${dealer}"]${crlf}`
		out += `[Vulnerable "${vul}"]${crlf}`
		out += `[Deal "${deal}"]${crlf}${crlf}`
	})
	return out
}

function buildSinglePBN(hand, boardNo, dateStr) {
	const dealer = dealerForBoard(boardNo)
	const vul = vulnerabilityForBoard(boardNo)
	const orderMap = {
		N: ['N', 'E', 'S', 'W'],
		E: ['E', 'S', 'W', 'N'],
		S: ['S', 'W', 'N', 'E'],
		W: ['W', 'N', 'E', 'S'],
	}
	const order = orderMap[dealer]
	const handsStr = order.map((seat) => formatSeatPBN(hand[seat])).join(' ')
	const deal = `${dealer}:${handsStr}`
	const crlf = '\r\n'
	return (
		`[Event "Club Session"]${crlf}` +
		`[Site "Local"]${crlf}` +
		`[Date "${dateStr}"]${crlf}` +
		`[Board "${boardNo}"]${crlf}` +
		`[Dealer "${dealer}"]${crlf}` +
		`[Vulnerable "${vul}"]${crlf}` +
		`[Deal "${deal}"]${crlf}${crlf}`
	)
}

export default function DragDropCards() {
	const [cards, setCards] = useState(initialCards)
	const [bucketCards, setBucketCards] = useState({ N: [], E: [], S: [], W: [] })
	const [draggedCard, setDraggedCard] = useState(null)
	const [dragSource, setDragSource] = useState(null) // 'deck' | 'N' | 'E' | 'S' | 'W' | null
	const [activeBucket, setActiveBucket] = useState(null)
	const [selected, setSelected] = useState(() => new Set())
	const [savedHands, setSavedHands] = useState([]) // array of {N,E,S,W}
	const [startBoard, setStartBoard] = useState(1)
	const [showPreview, setShowPreview] = useState(false)
	const [previewIndex, setPreviewIndex] = useState(0)
	const [copyState, setCopyState] = useState('idle') // idle | ok | err
	const [hintsEnabled, setHintsEnabled] = useState(true)
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const copyTimerRef = useRef(null)

	const { slides } = useMemo(() => {
		const today = new Date()
		const y = today.getFullYear()
		const m = String(today.getMonth() + 1).padStart(2, '0')
		const d = String(today.getDate()).padStart(2, '0')
		const dateStr = `${y}.${m}.${d}`
		return {
			slides: savedHands.map((hand, i) =>
				buildSinglePBN(hand, startBoard + i, dateStr)
			),
		}
	}, [savedHands, startBoard])

	useEffect(() => {
		if (previewIndex > Math.max(0, slides.length - 1)) {
			setPreviewIndex(Math.max(0, slides.length - 1))
		}
	}, [slides.length, previewIndex])

	useEffect(() => {
		document.title = "Bristol Bridge Club's PBN Picker"
	}, [])

	const remaining = cards.length
	const selectedCount = useMemo(() => selected.size, [selected])
	const complete = SEATS.every((s) => bucketCards[s].length === 13)
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
		setCards(initialCards)
		setBucketCards({ N: [], E: [], S: [], W: [] })
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
			if (bucketCards[bucket].length < 13) {
				setBucketCards((prev) => ({
					...prev,
					[bucket]: [...prev[bucket], draggedCard],
				}))
				setCards((prev) => prev.filter((c) => c.id !== draggedCard.id))
			}
		} else if (SEATS.includes(dragSource)) {
			if (dragSource !== bucket && bucketCards[bucket].length < 13) {
				setBucketCards((prev) => {
					const from = dragSource
					return {
						...prev,
						[from]: prev[from].filter((c) => c.id !== draggedCard.id),
						[bucket]: [...prev[bucket], draggedCard],
					}
				})
			}
		}
		setDraggedCard(null)
		setDragSource(null)
	}

	const onDropToDeck = (e) => {
		if (e && e.preventDefault) e.preventDefault()
		if (!draggedCard || !SEATS.includes(dragSource)) return
		setBucketCards((prev) => ({
			...prev,
			[dragSource]: prev[dragSource].filter((c) => c.id !== draggedCard.id),
		}))
		setCards((prev) => sortDeck([...prev, draggedCard]))
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
		const capacity = 13 - bucketCards[bucket].length
		if (capacity <= 0) return
		const toMove = cards.filter((c) => selected.has(c.id)).slice(0, capacity)
		if (toMove.length === 0) return
		setBucketCards((prev) => ({
			...prev,
			[bucket]: [...prev[bucket], ...toMove],
		}))
		const movedIds = new Set(toMove.map((c) => c.id))
		setCards((prev) => prev.filter((c) => !movedIds.has(c.id)))
		setSelected((prev) => {
			const next = new Set(prev)
			toMove.forEach((c) => next.delete(c.id))
			return next
		})
	}

	const handleRandomComplete = () => {
		// random fill respecting capacity 13
		let pool = [...cards]
		const nextBuckets = { ...bucketCards }
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
		setBucketCards(nextBuckets)
		setCards([])
		setSelected(new Set())
	}

	const saveCurrentHand = () => {
		if (!complete) return
		setSavedHands((prev) => [
			...prev,
			{
				N: bucketCards.N,
				E: bucketCards.E,
				S: bucketCards.S,
				W: bucketCards.W,
			},
		])
		resetBoard()
	}

	const downloadPBN = (content) => {
		const blob = new Blob([content], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'hands.pbn'
		a.click()
		URL.revokeObjectURL(url)
	}

	const handleGeneratePBN = async () => {
		if (savedHands.length === 0) return
		const pbn = buildPBN(savedHands, startBoard)
		downloadPBN(pbn)
	}

	const handleCopyPBN = async () => {
		if (savedHands.length === 0) return
		const pbn = buildPBN(savedHands, startBoard)
		try {
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

	const handleEmailPBN = () => {
		if (savedHands.length === 0) return
		const pbn = buildPBN(savedHands, startBoard)
		const subject = encodeURIComponent(
			"PBN hands from Bristol Bridge Club's PBN Picker"
		)
		const body = encodeURIComponent(pbn)
		window.location.href = `mailto:dr.mark.oconnor@googlemail.com?subject=${subject}&body=${body}`
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
		const hcp = hcpOfCards(bucketCards[id])

		return (
			<div
				className={`rounded-xl overflow-hidden shadow-md border ${
					isDealer ? 'border-amber-500' : styles.border
				} ${styles.bg} ${highlight} w-60`}>
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
							{bucketCards[id].length}/13
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
					className={`min-h-[200px] p-2 flex flex-col gap-1 items-stretch justify-start`}>
					{rowOrder.map((suit) => {
						const suitCards = sortByPbnRank(
							bucketCards[id].filter((c) => c.suit === suit)
						)
						const suitColor = SUIT_TEXT[suit]
						return (
							<div
								key={`${id}-${suit}`}
								className="flex items-center gap-2 min-h-[28px]">
								<div
									className={`w-6 text-center text-xl leading-none ${suitColor}`}>
									{suit === 'Clubs'
										? '♣'
										: suit === 'Diamonds'
										? '♦'
										: suit === 'Hearts'
										? '♥'
										: '♠'}
								</div>
								<div className="flex-1">{suiteRowContent(suitCards, id)}</div>
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
			return <span className="text-[12px] text-gray-500">-</span>
		}
		return (
			<div className="flex flex-row flex-wrap items-center gap-1">
				{suitCards.map((card) => (
					<span
						key={card.id}
						draggable
						onDragStart={(e) => onDragStartBucket(e, card, bucketId)}
						onDragEnd={onDragEnd}
						className="text-[12px] font-semibold text-gray-900 px-0.5 select-none cursor-grab active:cursor-grabbing">
						{card.rank}
					</span>
				))}
			</div>
		)
	}

	return (
		<div className="flex flex-col items-center w-full max-w-[1100px] mx-auto gap-2 min-h-screen px-2 py-2">
			{/* Top-right hints toggle */}
			<div className="w-full flex justify-end">
				<label className="text-[11px] text-gray-600 flex items-center gap-1 select-none">
					<input
						type="checkbox"
						checked={hintsEnabled}
						onChange={(e) => setHintsEnabled(e.target.checked)}
					/>
					Hints
				</label>
			</div>

			{/* Deck drop hint when dragging from a bucket */}
			{SEATS.includes(dragSource) && hintsEnabled && (
				<div className="w-full text-center mb-1">
					<span className="inline-block text-[11px] text-gray-700 px-2 py-1 bg-gray-50 border border-dashed border-gray-400 rounded">
						Drop here to return to deck
					</span>
				</div>
			)}

			{/* Deck row */}
			<div
				className="flex flex-wrap gap-1 mb-2 justify-center min-h-[60px]"
				onDragOver={(e) => {
					e.preventDefault()
					try {
						e.dataTransfer.dropEffect = 'move'
					} catch {
						// Some browsers can throw here under odd conditions; ignore
						void 0
					}
				}}
				onDrop={onDropToDeck}>
				{cards.map((card) => {
					const isSelected = selected.has(card.id)
					return (
						<div
							key={card.id}
							draggable
							onDragStart={(e) => onDragStartDeck(e, card)}
							onDragEnd={onDragEnd}
							onClick={() => toggleSelect(card.id)}
							className={`${CARD_DECK} ${
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

			{/* Send-to buttons directly under the deck */}
			<div className="flex flex-wrap gap-2 justify-center -mt-1 mb-1 w-full">
				<button
					className="px-3 py-2 rounded bg-sky-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={() => sendSelectedTo('N')}
					disabled={selectedCount === 0 || bucketCards.N.length >= 13}
					title={
						hintsEnabled ? 'Send selected deck cards to North' : undefined
					}>
					Send North
				</button>
				<button
					className="px-3 py-2 rounded bg-amber-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={() => sendSelectedTo('W')}
					disabled={selectedCount === 0 || bucketCards.W.length >= 13}
					title={hintsEnabled ? 'Send selected deck cards to West' : undefined}>
					Send West
				</button>
				<button
					className="px-3 py-2 rounded bg-rose-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={() => sendSelectedTo('E')}
					disabled={selectedCount === 0 || bucketCards.E.length >= 13}
					title={hintsEnabled ? 'Send selected deck cards to East' : undefined}>
					Send East
				</button>
				<button
					className="px-3 py-2 rounded bg-emerald-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={() => sendSelectedTo('S')}
					disabled={selectedCount === 0 || bucketCards.S.length >= 13}
					title={
						hintsEnabled ? 'Send selected deck cards to South' : undefined
					}>
					Send South
				</button>
			</div>

			{/* Buckets in a single row: N, E, S, W */}
			<div className="w-full flex items-start justify-center gap-2">
				<div className="flex flex-row flex-wrap items-start justify-center gap-2">
					<Bucket id="N" />
					<Bucket id="E" />
					<Bucket id="S" />
					<Bucket id="W" />
				</div>
			</div>

			{/* Legend for vulnerability marker */}
			<div className="w-full flex items-center justify-center mt-1 mb-1">
				<span className="text-[10px] text-gray-600">
					Legend:{' '}
					<span className="inline-block text-[9px] font-bold text-red-700 bg-red-100 border border-red-200 rounded px-1 py-0.5">
						V
					</span>{' '}
					= Vulnerable on next board
				</span>
			</div>

			{/* Pop-out PBN preview carousel under buckets (two-line scroll) */}
			<div className="w-full">
				<div className="flex items-center justify-center gap-2 mb-1">
					<button
						className="px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs border border-gray-300"
						onClick={() => setShowPreview((v) => !v)}>
						{showPreview ? 'Hide PBN' : 'Show PBN'}
					</button>
					{showPreview && (
						<>
							<button
								className="px-2 py-1 rounded bg-white text-gray-800 text-xs border border-gray-300 disabled:opacity-40"
								onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
								disabled={previewIndex === 0 || slides.length <= 1}>
								Prev
							</button>
							<div className="text-[10px] text-gray-600">
								{slides.length > 0
									? `Board ${startBoard + previewIndex} of ${
											startBoard + slides.length - 1
									  }`
									: 'No boards saved'}
							</div>
							<button
								className="px-2 py-1 rounded bg-white text-gray-800 text-xs border border-gray-300 disabled:opacity-40"
								onClick={() =>
									setPreviewIndex((i) => Math.min(slides.length - 1, i + 1))
								}
								disabled={
									previewIndex >= slides.length - 1 || slides.length <= 1
								}>
								Next
							</button>
						</>
					)}
				</div>
				{showPreview && (
					<pre className="whitespace-pre-wrap text-[10px] leading-tight bg-gray-50 border border-gray-200 rounded p-2 w-full h-10 overflow-y-auto">
						{slides.length > 0
							? slides[previewIndex]
							: '// Save a hand to preview PBN'}
					</pre>
				)}
			</div>

			{/* Toolbar in a single row */}
			<div className="flex flex-wrap items-center justify-center gap-2 w-full mt-1">
				{/* Dealer selector */}
				<div className="flex items-center gap-1 mr-2">
					<span className="text-[10px] text-gray-600">Dealer:</span>
					{SEATS.map((s) => (
						<button
							key={`dealer-${s}`}
							onClick={() => setDealerExplicit(s)}
							className={`px-1.5 py-0.5 rounded text-[10px] border ${
								s === currentDealer
									? 'bg-amber-500 border-amber-600 text-white'
									: 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
							}`}
							title={`Set next dealer to ${s}`}>
							{s}
						</button>
					))}
				</div>
				<span className="font-modern text-[11px] text-gray-700 mr-2">
					Selected: {selectedCount} • Remaining: {remaining}
				</span>
				<button
					className="px-2 py-1.5 rounded bg-purple-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={handleRandomComplete}
					disabled={remaining === 0}
					title={
						hintsEnabled
							? 'Randomly deal remaining deck cards to seats'
							: undefined
					}>
					Random Complete
				</button>
				{selectedCount > 0 && (
					<button
						className="px-2 py-1.5 rounded bg-gray-200 text-gray-800 text-xs hover:bg-gray-300"
						onClick={clearSelection}
						title={
							hintsEnabled
								? 'Deselect currently selected deck cards'
								: undefined
						}>
						Clear Selection
					</button>
				)}
				<button
					className="px-2 py-1.5 rounded bg-gray-800 text-white text-xs hover:opacity-90"
					onClick={resetBoard}
					title={
						hintsEnabled
							? 'Clear all seats and return all cards to deck'
							: undefined
					}>
					Reset Board
				</button>
				<button
					className="px-2 py-1.5 rounded bg-indigo-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={saveCurrentHand}
					disabled={!complete}
					title={hintsEnabled ? 'Save this 52-card distribution' : undefined}>
					Save Hand
				</button>
				<button
					className="px-2 py-1.5 rounded bg-teal-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={handleGeneratePBN}
					disabled={savedHands.length === 0}
					title={hintsEnabled ? 'Download saved deals as PBN' : undefined}>
					Download PBN
				</button>
				<button
					className={`px-2 py-1.5 rounded text-white text-[10px] hover:opacity-90 disabled:opacity-40 ${
						copyState === 'ok'
							? 'bg-green-600'
							: copyState === 'err'
							? 'bg-rose-600'
							: 'bg-teal-500'
					}`}
					onClick={handleCopyPBN}
					disabled={savedHands.length === 0}
					title={hintsEnabled ? 'Copy PBN to clipboard' : undefined}>
					{copyState === 'ok'
						? 'Copied!'
						: copyState === 'err'
						? 'Copy failed'
						: 'Copy'}
				</button>
				<button
					className="px-2 py-1.5 rounded bg-teal-500 text-white text-[10px] hover:opacity-90 disabled:opacity-40"
					onClick={handleEmailPBN}
					disabled={savedHands.length === 0}
					title={hintsEnabled ? 'Email PBN' : undefined}>
					Email
				</button>
				<span className="text-[10px] text-gray-600">
					Saved: {savedHands.length}
				</span>
			</div>

			{/* Danger zone: Delete PBN, kept separate */}
			<div className="w-full flex items-center justify-center mt-2">
				<button
					className="px-3 py-2 rounded bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-40"
					onClick={() => setShowDeleteModal(true)}
					disabled={savedHands.length === 0}
					title={hintsEnabled ? 'Delete all saved PBN boards' : undefined}>
					Delete PBN
				</button>
			</div>

			{/* Confirmation Modal */}
			{showDeleteModal && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[90%] max-w-sm p-4">
						<h3 className="text-sm font-semibold text-gray-800 mb-2">
							Delete all saved PBN deals?
						</h3>
						<p className="text-xs text-gray-700 mb-4">
							This will remove all saved boards and reset the app to the start.
							This action cannot be undone.
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

			{/* Mobile preview handled by unified preview section above */}

			<div className="w-full flex items-center justify-center mt-1">
				<a
					href="/instructions"
					className="text-[11px] text-sky-600 hover:underline">
					Read full instructions →
				</a>
			</div>

			<div className="w-full flex items-center justify-center">
				<a href="/sources" className="text-[11px] text-sky-600 hover:underline">
					Browse public PBN sources →
				</a>
			</div>
		</div>
	)
}

