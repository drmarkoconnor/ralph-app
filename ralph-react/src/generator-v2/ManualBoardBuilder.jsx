import { useEffect, useMemo, useState } from 'react'
import {
	SEATS,
	SUITS,
	createDeck,
	dealRandomHands,
	dealerForBoard,
	hcp,
	normalizeAuctionText,
	partnershipHcp,
	suitLengths,
	vulnerabilityForBoard,
} from './generatorV2Engine'

const RANK_VALUE = {
	A: 14,
	K: 13,
	Q: 12,
	J: 11,
	10: 10,
	9: 9,
	8: 8,
	7: 7,
	6: 6,
	5: 5,
	4: 4,
	3: 3,
	2: 2,
}
const SUIT_VALUE = { S: 0, H: 1, D: 2, C: 3 }
const MANUAL_DRAFT_KEY = 'ralph-generator2-manual-draft-v1'
const AUTOSAVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const suitText = {
	S: 'text-slate-950',
	H: 'text-rose-700',
	D: 'text-rose-700',
	C: 'text-slate-950',
}

function hasSavedLayout(value) {
	return !!value?.hands && Array.isArray(value.deck) && SEATS.every((seat) => Array.isArray(value.hands[seat]))
}

function readManualDraft() {
	if (typeof window === 'undefined') return {}
	const sessionDraft = readStoredJson(window.sessionStorage, MANUAL_DRAFT_KEY)
	if (isFreshAutosave(sessionDraft)) return sessionDraft
	const localDraft = readStoredJson(window.localStorage, MANUAL_DRAFT_KEY)
	if (isFreshAutosave(localDraft)) return localDraft
	return {}
}

function readStoredJson(storage, key) {
	try {
		return JSON.parse(storage.getItem(key) || '{}')
	} catch {
		return {}
	}
}

function isFreshAutosave(value) {
	if (!value || !Object.keys(value).length) return false
	if (!value.savedAt) return true
	return Date.now() - Number(value.savedAt) <= AUTOSAVE_MAX_AGE_MS
}

function vulnerabilityTone(vul, seat, active) {
	if (active) return 'border-sky-500 bg-sky-50'
	if (vul === 'All') return 'border-rose-200 bg-rose-50'
	if (vul === 'None') return 'border-emerald-100 bg-emerald-50'
	if (vul === 'NS' && (seat === 'N' || seat === 'S')) return 'border-rose-200 bg-rose-50'
	if (vul === 'EW' && (seat === 'E' || seat === 'W')) return 'border-rose-200 bg-rose-50'
	return 'border-slate-200 bg-white'
}

function emptyHands() {
	return { N: [], E: [], S: [], W: [] }
}

function sortCards(cards) {
	return [...cards].sort((a, b) => {
		if (SUIT_VALUE[a.suitKey] !== SUIT_VALUE[b.suitKey]) {
			return SUIT_VALUE[a.suitKey] - SUIT_VALUE[b.suitKey]
		}
		return RANK_VALUE[b.rank] - RANK_VALUE[a.rank]
	})
}

function freshLayout() {
	return {
		deck: sortCards(createDeck()),
		hands: emptyHands(),
	}
}

function completeLayout(hands, deck) {
	return deck.length === 0 && SEATS.every((seat) => hands[seat].length === 13)
}

function shapeText(cards) {
	const lengths = suitLengths(cards)
	return `${lengths.S}-${lengths.H}-${lengths.D}-${lengths.C}`
}

function cardCode(card) {
	return `${card.rank}${card.suitKey}`
}

function parseCardCode(value) {
	const clean = String(value || '')
		.toUpperCase()
		.replace(/\s+/g, '')
	if (clean.length < 2) return null
	const suit = clean.slice(-1)
	if (!['S', 'H', 'D', 'C'].includes(suit)) return null
	const rankRaw = clean.slice(0, -1)
	const rank = rankRaw === 'T' ? '10' : rankRaw
	if (!RANK_VALUE[rank]) return null
	return { rank, suitKey: suit }
}

function findAndRemove(layout, cardId) {
	let found = null
	const next = {
		deck: [],
		hands: emptyHands(),
	}
	for (const card of layout.deck) {
		if (card.id === cardId) found = card
		else next.deck.push(card)
	}
	for (const seat of SEATS) {
		for (const card of layout.hands[seat]) {
			if (card.id === cardId) found = card
			else next.hands[seat].push(card)
		}
	}
	return { found, next }
}

function CardChip({ card, compact = false, selected = false, onClick, onDoubleClick }) {
	return (
		<button
			type="button"
			draggable
			aria-pressed={onClick ? selected : undefined}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
			onDragStart={(event) => event.dataTransfer.setData('text/plain', String(card.id))}
			className={`shrink-0 rounded-md border text-center font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
				compact ? 'h-8 min-w-9 px-1 text-sm' : 'h-9 min-w-10 px-1.5 text-base'
			} ${
				selected
					? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
					: 'border-slate-300 bg-white'
			} ${suitText[card.suitKey]}`}
			title={cardCode(card)}>
			{cardCode(card)}
		</button>
	)
}

function DropZone({ seat, cards, active, vul, onDropCard, onSelectSeat }) {
	const lengths = suitLengths(cards)
	return (
		<section
			onClick={() => onSelectSeat(seat)}
			onDragOver={(event) => event.preventDefault()}
			onDrop={(event) => {
				event.preventDefault()
				const cardId = Number(event.dataTransfer.getData('text/plain'))
				if (cardId) onDropCard(cardId, seat)
			}}
			className={`min-h-[164px] cursor-pointer rounded-lg border p-3 shadow-sm ${vulnerabilityTone(vul, seat, active)}`}>
			<header className="mb-2 flex flex-wrap items-center justify-between gap-2">
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation()
						onSelectSeat(seat)
					}}
					className={`grid h-8 w-8 place-items-center rounded-md text-sm font-black ${
						active ? 'bg-sky-700 text-white' : 'bg-slate-900 text-white'
					}`}>
					{seat}
				</button>
				<div className="flex items-center gap-2 text-xs font-black text-slate-600">
					<span>{cards.length}/13</span>
					<span>HCP {hcp(cards)}</span>
					<span>{lengths.S}-{lengths.H}-{lengths.D}-{lengths.C}</span>
				</div>
			</header>
			<div className="flex min-h-[108px] flex-wrap content-start gap-1.5">
				{sortCards(cards).map((card) => (
					<CardChip
						key={card.id}
						card={card}
						compact
						onDoubleClick={() => onDropCard(card.id, 'deck')}
					/>
				))}
			</div>
		</section>
	)
}

export default function ManualBoardBuilder({ nextBoardNumber, onAddBoard, onStatus }) {
	const restoredDraft = useMemo(() => readManualDraft(), [])
	const [layout, setLayout] = useState(() => hasSavedLayout(restoredDraft.layout) ? restoredDraft.layout : freshLayout())
	const [targetSeat, setTargetSeat] = useState(restoredDraft.targetSeat || 'N')
	const [selectedCards, setSelectedCards] = useState(() => new Set(restoredDraft.selectedCards || []))
	const [cardEntry, setCardEntry] = useState(restoredDraft.cardEntry || '')
	const [auctionText, setAuctionText] = useState(restoredDraft.auctionText || '')
	const [notes, setNotes] = useState(restoredDraft.notes || '')

	const dealer = dealerForBoard(nextBoardNumber)
	const vul = vulnerabilityForBoard(nextBoardNumber)
	const complete = completeLayout(layout.hands, layout.deck)
	const totalCards = SEATS.reduce((sum, seat) => sum + layout.hands[seat].length, 0)
	const selectedDeckCards = useMemo(
		() => layout.deck.filter((card) => selectedCards.has(card.id)),
		[layout.deck, selectedCards],
	)
	const liveSummary = useMemo(() => {
		return SEATS.map((seat) => `${seat} ${hcp(layout.hands[seat])} HCP (${shapeText(layout.hands[seat])})`).join('; ')
	}, [layout.hands])

	useEffect(() => {
		if (typeof window === 'undefined') return
		try {
			const serialized = JSON.stringify({
				layout,
				targetSeat,
				selectedCards: [...selectedCards],
				cardEntry,
				auctionText,
				notes,
				savedAt: Date.now(),
			})
			window.sessionStorage.setItem(MANUAL_DRAFT_KEY, serialized)
			window.localStorage.setItem(MANUAL_DRAFT_KEY, serialized)
		} catch {
			// Ignore private-browsing or quota failures; completed boards still export.
		}
	}, [layout, targetSeat, selectedCards, cardEntry, auctionText, notes])

	const moveCard = (cardId, toSeat) => {
		setSelectedCards((current) => {
			if (!current.has(cardId)) return current
			const next = new Set(current)
			next.delete(cardId)
			return next
		})
		setLayout((current) => {
			const { found, next } = findAndRemove(current, cardId)
			if (!found) return current
			if (toSeat === 'deck') {
				next.deck = sortCards([...next.deck, found])
				for (const seat of SEATS) next.hands[seat] = sortCards(next.hands[seat])
				return next
			}
			if (next.hands[toSeat].length >= 13) {
				onStatus?.(`${toSeat} already has 13 cards.`)
				return current
			}
			next.hands[toSeat] = sortCards([...next.hands[toSeat], found])
			next.deck = sortCards(next.deck)
			for (const seat of SEATS) {
				if (seat !== toSeat) next.hands[seat] = sortCards(next.hands[seat])
			}
			return next
		})
	}

	const toggleDeckCard = (cardId) => {
		setSelectedCards((current) => {
			const next = new Set(current)
			if (next.has(cardId)) next.delete(cardId)
			else next.add(cardId)
			return next
		})
	}

	const clearSelection = () => setSelectedCards(new Set())

	const sendSelectedTo = (seat) => {
		const cardsToMove = sortCards(selectedDeckCards)
		if (!cardsToMove.length) {
			onStatus?.('Select one or more deck cards first.')
			return
		}
		const capacity = 13 - layout.hands[seat].length
		if (cardsToMove.length > capacity) {
			onStatus?.(`${seat} has room for ${capacity} more card${capacity === 1 ? '' : 's'}.`)
			return
		}
		const movedIds = new Set(cardsToMove.map((card) => card.id))
		setLayout((current) => {
			const currentCards = sortCards(current.deck.filter((card) => movedIds.has(card.id)))
			if (!currentCards.length || currentCards.length > 13 - current.hands[seat].length) return current
			return {
				deck: sortCards(current.deck.filter((card) => !movedIds.has(card.id))),
				hands: {
					...current.hands,
					[seat]: sortCards([...current.hands[seat], ...currentCards]),
				},
			}
		})
		clearSelection()
		onStatus?.(`Sent ${cardsToMove.length} card${cardsToMove.length === 1 ? '' : 's'} to ${seat}.`)
	}

	const addKeyboardCard = () => {
		const parsed = parseCardCode(cardEntry)
		if (!parsed) {
			onStatus?.('Type a card like AS, KH, 10D or 7C.')
			return
		}
		const allCards = [...layout.deck, ...SEATS.flatMap((seat) => layout.hands[seat])]
		const card = allCards.find((item) => item.rank === parsed.rank && item.suitKey === parsed.suitKey)
		if (!card) {
			onStatus?.(`${cardEntry.toUpperCase()} is not available.`)
			return
		}
		moveCard(card.id, targetSeat)
		setCardEntry('')
	}

	const resetBuilder = (quiet = false) => {
		setLayout(freshLayout())
		clearSelection()
		setAuctionText('')
		setNotes('')
		if (!quiet) onStatus?.('Manual board builder cleared.')
	}

	const fillRandom = () => {
		setLayout({ deck: [], hands: dealRandomHands() })
		clearSelection()
		setNotes('')
		onStatus?.('Random deal filled into the manual builder.')
	}

	const boardFromHands = (hands, title = 'Manual Board') => {
		const auction = normalizeAuctionText(auctionText)
		return {
			id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
			keep: true,
			number: nextBoardNumber,
			dealer,
			vul,
			topicId: title === 'Random Board' ? 'random_deal' : 'manual_board',
			topicTitle: title,
			hands,
			auction,
			auctionText: auction.join(' '),
			notes:
				notes.trim() ||
				`${title}. ${liveSummary}. N/S ${partnershipHcp(hands, 'NS')} HCP, E/W ${partnershipHcp(hands, 'EW')} HCP.`,
			quality: 'manual',
		}
	}

	const addBuilderBoard = () => {
		if (!complete) {
			onStatus?.('Complete all four hands before adding the board.')
			return
		}
		onAddBoard(boardFromHands(layout.hands))
		resetBuilder(true)
	}

	const addRandomBoard = () => {
		const hands = dealRandomHands()
		onAddBoard({
			...boardFromHands(hands, 'Random Board'),
			notes: notes.trim() || `Random board. N/S ${partnershipHcp(hands, 'NS')} HCP, E/W ${partnershipHcp(hands, 'EW')} HCP.`,
		})
	}

	return (
		<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<header className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-black text-slate-950">Manual Board Builder</h2>
					<p className="mt-1 text-sm font-semibold text-slate-500">
						Board {nextBoardNumber} - Dealer {dealer} - Vul {vul} - {totalCards}/52 assigned
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={addRandomBoard}
						className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-black text-white hover:bg-emerald-800">
						Add Random Board
					</button>
					<button
						type="button"
						onClick={fillRandom}
						className="rounded-md bg-slate-900 px-3 py-2 text-sm font-black text-white hover:bg-slate-800">
						Random Fill
					</button>
					<button
						type="button"
						onClick={resetBuilder}
						className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 hover:bg-slate-50">
						Clear
					</button>
				</div>
			</header>

			<div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
				<div className="grid gap-3 md:grid-cols-2">
					{SEATS.map((seat) => (
						<DropZone
							key={seat}
							seat={seat}
							cards={layout.hands[seat]}
							active={targetSeat === seat}
							vul={vul}
							onDropCard={moveCard}
							onSelectSeat={setTargetSeat}
						/>
					))}
				</div>

				<div className="space-y-3">
					<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
						<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
							<div className="text-sm font-black text-slate-900">Deck</div>
							<div className="text-xs font-black uppercase tracking-wide text-slate-500">
								{layout.deck.length} unassigned
							</div>
						</div>
						<div className="mb-2 rounded-md border border-slate-200 bg-white p-2">
							<div className="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
								<span>{selectedDeckCards.length} selected</span>
								<button
									type="button"
									disabled={!selectedDeckCards.length}
									onClick={clearSelection}
									className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
									Clear
								</button>
							</div>
							<div className="grid grid-cols-4 gap-1.5">
								{SEATS.map((seat) => (
									<button
										key={seat}
										type="button"
										disabled={!selectedDeckCards.length}
										onClick={() => sendSelectedTo(seat)}
										className="rounded-md bg-sky-700 px-2 py-1.5 text-xs font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40">
										Send {seat}
									</button>
								))}
							</div>
						</div>
						<div
							onDragOver={(event) => event.preventDefault()}
							onDrop={(event) => {
								event.preventDefault()
								const cardId = Number(event.dataTransfer.getData('text/plain'))
								if (cardId) moveCard(cardId, 'deck')
							}}
							className="max-h-[230px] overflow-y-auto rounded-md bg-white p-2 shadow-inner">
							{SUITS.map((suit) => (
								<div key={suit.key} className="mb-2 grid grid-cols-[1.6rem_1fr] items-start gap-2 last:mb-0">
									<span className={`pt-1 text-sm font-black ${suitText[suit.key]}`}>{suit.label}</span>
									<div className="flex flex-wrap gap-1.5">
										{sortCards(layout.deck)
											.filter((card) => card.suitKey === suit.key)
											.map((card) => (
												<CardChip
													key={card.id}
													card={card}
													compact
													selected={selectedCards.has(card.id)}
													onClick={() => toggleDeckCard(card.id)}
													onDoubleClick={() => moveCard(card.id, targetSeat)}
												/>
											))}
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="rounded-lg border border-slate-200 bg-white p-3">
						<div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
							<div className="flex gap-1">
								{SEATS.map((seat) => (
									<button
										key={seat}
										type="button"
										onClick={() => setTargetSeat(seat)}
										className={`h-10 w-10 rounded-md text-sm font-black ${
											targetSeat === seat
												? 'bg-sky-700 text-white'
												: 'bg-slate-100 text-slate-800 hover:bg-slate-200'
										}`}>
										{seat}
									</button>
								))}
							</div>
							<input
								value={cardEntry}
								onChange={(event) => setCardEntry(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') addKeyboardCard()
								}}
								placeholder="AS, KH, 10D"
								className="h-10 rounded-md border border-slate-200 bg-white px-3 font-mono text-sm font-black text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
							/>
							<button
								type="button"
								onClick={addKeyboardCard}
								className="h-10 rounded-md bg-sky-700 px-4 text-sm font-black text-white hover:bg-sky-800">
								Add
							</button>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-2">
						<label className="block">
							<span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
								Auction
							</span>
							<textarea
								value={auctionText}
								onChange={(event) => setAuctionText(event.target.value)}
								rows={3}
								placeholder="Optional"
								className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-semibold text-slate-900 shadow-inner outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
								Notes
							</span>
							<textarea
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
								rows={3}
								placeholder="Optional"
								className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 shadow-inner outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
							/>
						</label>
					</div>

					<div className="grid grid-cols-3 gap-2 text-center">
						<div className="rounded-md bg-slate-100 px-3 py-2">
							<div className="text-xs font-black uppercase text-slate-500">N/S</div>
							<div className="text-xl font-black text-slate-950">{partnershipHcp(layout.hands, 'NS')}</div>
						</div>
						<div className="rounded-md bg-slate-100 px-3 py-2">
							<div className="text-xs font-black uppercase text-slate-500">E/W</div>
							<div className="text-xl font-black text-slate-950">{partnershipHcp(layout.hands, 'EW')}</div>
						</div>
						<button
							type="button"
							disabled={!complete}
							onClick={addBuilderBoard}
							className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">
							Add Board
						</button>
					</div>
				</div>
			</div>
		</section>
	)
}
