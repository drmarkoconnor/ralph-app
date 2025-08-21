import { useMemo, useState } from 'react'

const suits = [
	{ name: 'Spades', symbol: '♠' },
	{ name: 'Hearts', symbol: '♥' },
	{ name: 'Diamonds', symbol: '♦' },
	{ name: 'Clubs', symbol: '♣' },
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
const BUCKET_STYLES = {
	N: {
		title: 'NORTH',
		bg: 'bg-sky-50',
		border: 'border-sky-300',
		headerBg: 'bg-sky-100',
		headerText: 'text-sky-700',
		ring: 'ring-sky-300',
	},
	E: {
		title: 'EAST',
		bg: 'bg-rose-50',
		border: 'border-rose-300',
		headerBg: 'bg-rose-100',
		headerText: 'text-rose-700',
		ring: 'ring-rose-300',
	},
	S: {
		title: 'SOUTH',
		bg: 'bg-emerald-50',
		border: 'border-emerald-300',
		headerBg: 'bg-emerald-100',
		headerText: 'text-emerald-700',
		ring: 'ring-emerald-300',
	},
	W: {
		title: 'WEST',
		bg: 'bg-amber-50',
		border: 'border-amber-300',
		headerBg: 'bg-amber-100',
		headerText: 'text-amber-800',
		ring: 'ring-amber-300',
	},
}

const SUIT_TEXT = {
	Hearts: 'text-red-600',
	Diamonds: 'text-red-600',
	Spades: 'text-black',
	Clubs: 'text-black',
}

const SUIT_ORDER = ['Spades', 'Hearts', 'Diamonds', 'Clubs']

function hcpOfCards(cards) {
	const pts = { A: 4, K: 3, Q: 2, J: 1 }
	return cards.reduce((sum, c) => sum + (pts[c.rank] || 0), 0)
}

function isHonor(rank) {
	return rank === 'A' || rank === 'K' || rank === 'Q' || rank === 'J'
}

function honorBg(rank) {
	if (rank === 'K') return 'bg-gradient-to-br from-yellow-300 to-amber-400'
	if (rank === 'Q') return 'bg-gradient-to-br from-fuchsia-300 to-pink-400'
	if (rank === 'J') return 'bg-gradient-to-br from-blue-300 to-cyan-400'
	// Ace keeps cream but with calligraphic A styling
	return 'bg-[#FFF8E7]'
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

export default function DragDropCards() {
	const [cards, setCards] = useState(initialCards)
	const [bucketCards, setBucketCards] = useState({ N: [], E: [], S: [], W: [] })
	const [draggedCard, setDraggedCard] = useState(null)
	const [activeBucket, setActiveBucket] = useState(null)
	const [selected, setSelected] = useState(() => new Set())
	const [savedHands, setSavedHands] = useState([]) // array of {N,E,S,W}
	const [startBoard, setStartBoard] = useState(1)
	const pbnPreview = useMemo(() => {
		if (savedHands.length === 0)
			return '// PBN preview will appear here after you save at least one hand.'
		return buildPBN(savedHands, startBoard)
	}, [savedHands, startBoard])

	const remaining = cards.length
	const selectedCount = useMemo(() => selected.size, [selected])
	const complete = SEATS.every((s) => bucketCards[s].length === 13)

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

	const onDragStart = (card) => setDraggedCard(card)
	const onDrop = (bucket) => {
		setActiveBucket(null)
		if (draggedCard && bucketCards[bucket].length < 13) {
			setBucketCards((prev) => ({
				...prev,
				[bucket]: [...prev[bucket], draggedCard],
			}))
			setCards((prev) => prev.filter((c) => c.id !== draggedCard.id))
			setDraggedCard(null)
		}
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
			// Optional: toast
		} catch {}
	}

	const handleEmailPBN = () => {
		if (savedHands.length === 0) return
		const pbn = buildPBN(savedHands, startBoard)
		const subject = encodeURIComponent("PBN hands from Ralph's Picker")
		const body = encodeURIComponent(pbn)
		window.location.href = `mailto:?subject=${subject}&body=${body}`
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
		const isFull = bucketCards[id].length >= 13
		const highlight = activeBucket === id ? `ring-2 ${styles.ring}` : ''
		const sortedCards = SUIT_ORDER.flatMap((s) =>
			sortByPbnRank(bucketCards[id].filter((c) => c.suit === s))
		)
		const hcp = hcpOfCards(bucketCards[id])
		return (
			<div
				className={`rounded-xl overflow-hidden shadow-md border ${styles.border} ${styles.bg} ${highlight} w-56`}>
				<div
					className={`w-full ${styles.headerBg} ${styles.headerText} font-extrabold text-[11px] tracking-widest uppercase px-2 py-1.5 flex items-center justify-between`}>
					<span>{styles.title}</span>
					<span className="text-[10px] opacity-80">
						{bucketCards[id].length}/13
					</span>
				</div>
				<div
					onDragOver={(e) => {
						e.preventDefault()
						setActiveBucket(id)
					}}
					onDragLeave={() => setActiveBucket(null)}
					onDrop={() => onDrop(id)}
					className={`min-h-[200px] p-1.5 flex flex-wrap gap-1 items-start justify-center`}>
					{bucketCards[id].length === 0 && (
						<span className="text-[10px] text-gray-400">Drag cards here</span>
					)}
					{sortedCards.map((card) => (
						<div key={card.id} className={`${CARD_BASE}`}>
							{renderFace(card, false)}
						</div>
					))}
				</div>
				<div className="px-3 pb-2 text-[10px] text-gray-700 font-semibold text-right">
					HCP: {hcp}
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col items-center w-full max-w-[1100px] mx-auto gap-2 h-screen overflow-hidden px-2 py-2">
			{/* Deck row */}
			<div className="flex flex-wrap gap-1 mb-2 justify-center">
				{cards.map((card) => {
					const isSelected = selected.has(card.id)
					return (
						<div
							key={card.id}
							draggable
							onDragStart={() => onDragStart(card)}
							onClick={() => toggleSelect(card.id)}
							className={`${CARD_DECK} ${
								isSelected
									? 'ring-4 ring-yellow-300 scale-105'
									: 'hover:scale-105'
							}`}>
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
					disabled={selectedCount === 0 || bucketCards.N.length >= 13}>
					Send North
				</button>
				<button
					className="px-3 py-2 rounded bg-amber-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={() => sendSelectedTo('W')}
					disabled={selectedCount === 0 || bucketCards.W.length >= 13}>
					Send West
				</button>
				<button
					className="px-3 py-2 rounded bg-rose-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={() => sendSelectedTo('E')}
					disabled={selectedCount === 0 || bucketCards.E.length >= 13}>
					Send East
				</button>
				<button
					className="px-3 py-2 rounded bg-emerald-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={() => sendSelectedTo('S')}
					disabled={selectedCount === 0 || bucketCards.S.length >= 13}>
					Send South
				</button>
			</div>

			{/* Buckets in a single row: N, E, S, W with right-side PBN preview */}
			<div className="w-full flex items-start justify-between gap-2">
				<div className="flex flex-row flex-wrap items-start justify-start gap-2">
					<Bucket id="N" />
					<Bucket id="E" />
					<Bucket id="S" />
					<Bucket id="W" />
				</div>
				<pre className="hidden md:block whitespace-pre-wrap text-[10px] leading-tight bg-gray-50 border border-gray-200 rounded p-2 w-64 h-[240px] overflow-auto">
					{pbnPreview}
				</pre>
			</div>

			{/* Toolbar in a single row */}
			<div className="flex flex-wrap items-center justify-center gap-2 w-full mt-1">
				<span className="font-modern text-[11px] text-gray-700 mr-2">
					Selected: {selectedCount} • Remaining: {remaining}
				</span>
				<button
					className="px-2 py-1.5 rounded bg-purple-500 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={handleRandomComplete}
					disabled={remaining === 0}>
					Random Complete
				</button>
				<button
					className="px-2 py-1.5 rounded bg-gray-200 text-gray-800 text-xs hover:bg-gray-300"
					onClick={clearSelection}
					disabled={selectedCount === 0}>
					Clear Selection
				</button>
				<button
					className="px-2 py-1.5 rounded bg-gray-800 text-white text-xs hover:opacity-90"
					onClick={resetBoard}>
					Reset Board
				</button>
				<button
					className="px-2 py-1.5 rounded bg-indigo-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={saveCurrentHand}
					disabled={!complete}>
					Save Hand
				</button>
				<button
					className="px-2 py-1.5 rounded bg-teal-600 text-white text-xs hover:opacity-90 disabled:opacity-40"
					onClick={handleGeneratePBN}
					disabled={savedHands.length === 0}>
					Download PBN
				</button>
				<button
					className="px-2 py-1.5 rounded bg-teal-500 text-white text-[10px] hover:opacity-90 disabled:opacity-40"
					onClick={handleCopyPBN}
					disabled={savedHands.length === 0}>
					Copy
				</button>
				<button
					className="px-2 py-1.5 rounded bg-teal-500 text-white text-[10px] hover:opacity-90 disabled:opacity-40"
					onClick={handleEmailPBN}
					disabled={savedHands.length === 0}>
					Email
				</button>
				<span className="text-[10px] text-gray-600">
					Saved: {savedHands.length}
				</span>
			</div>

			<div className="w-full flex items-center justify-center mt-1">
				<a
					href="/instructions"
					className="text-[11px] text-sky-600 hover:underline">
					Read full instructions →
				</a>
			</div>
		</div>
	)
}

