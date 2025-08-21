import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Minimal PBN parser for Deal lines and Board/Dealer/Vulnerable (+Contract/Declarer if present)
function parsePBN(text) {
	const lines = text.split(/\r?\n/)
	const deals = []
	let current = {}
	let inAuction = false
	let inPlay = false
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i]
		const line = raw.trim()
		if (!line && inAuction) {
			inAuction = false
			continue
		}
		if (!line && inPlay) {
			inPlay = false
			continue
		}
		const m = line.match(/^\[([^\s]+)\s+"([^"]*)"\]/)
		if (!m) {
			if (inAuction) {
				const calls = line.split(/\s+/).filter(Boolean)
				current.auction = [...(current.auction || []), ...calls]
			}
			if (inPlay) {
				if (!current.play) current.play = []
				current.play.push(line)
			}
			continue
		}
		const tag = m[1]
		const val = m[2]
		if (tag !== 'Auction' && inAuction) inAuction = false
		if (tag !== 'Play' && inPlay) inPlay = false
		if (tag === 'Board') {
			if (current.deal) deals.push(current)
			current = { board: parseInt(val, 10) }
			inAuction = false
			inPlay = false
			continue
		}
		if (tag === 'Dealer') current.dealer = val
		if (tag === 'Vulnerable') current.vul = val
		if (tag === 'Deal') current.deal = val // e.g., N:... ... ... ...
		if (tag === 'Contract') current.contract = val // e.g., 4S, 3NT
		if (tag === 'Declarer') current.declarer = val // N/E/S/W
		if (tag === 'Auction') {
			inAuction = true
			current.auction = []
			current.auctionDealer = val // starting seat for calls
			continue
		}
		if (tag === 'Play') {
			inPlay = true
			current.play = []
			current.playLeader = val
			continue
		}
	}
	if (current.deal) deals.push(current)
	return deals
}

// Convert a Deal string (e.g., "N:AKQJ.T98.. ...") to seat cards map {N,E,S,W: Card[]}
function dealToHands(dealStr) {
	const [dealer, rest] = dealStr.split(':')
	const orderMap = {
		N: ['N', 'E', 'S', 'W'],
		E: ['E', 'S', 'W', 'N'],
		S: ['S', 'W', 'N', 'E'],
		W: ['W', 'N', 'E', 'S'],
	}
	const seats = orderMap[dealer]
	const parts = rest.trim().split(/\s+/)
	const hands = { N: [], E: [], S: [], W: [] }
	// Helper to expand ranks including T → 10
	const expand = (token) =>
		token === '-' ? [] : token.split('').map((ch) => (ch === 'T' ? '10' : ch))
	// Parse suits SHDC order
	for (let i = 0; i < 4; i++) {
		const seat = seats[i]
		const [sp, he, di, cl] = parts[i].split('.')
		const suits = [sp, he, di, cl]
		const suitNames = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
		suitNames.forEach((sName, idx) => {
			expand(suits[idx]).forEach((rank) => {
				hands[seat].push({
					rank,
					suit: sName,
					symbol: suitSymbol(sName),
					id: `${seat}-${sName}-${rank}-${Math.random().toString(36).slice(2)}`,
				})
			})
		})
	}
	return hands
}

// Parse PBN Play lines into a flat list of card moves (suit/rank), ignoring seat labels.
function parsePlayMoves(playLeader, lines) {
	if (!lines?.length) return []
	const norm = (t) => t.trim().toUpperCase()
	const toSuit = (s) =>
		s === 'S'
			? 'Spades'
			: s === 'H'
			? 'Hearts'
			: s === 'D'
			? 'Diamonds'
			: s === 'C'
			? 'Clubs'
			: null
	const toRank = (r) => (r === 'T' ? '10' : r)
	const cardRe = /^([SHDC])([AKQJT2-9]|10)$/i
	const moves = []
	for (const raw of lines) {
		const line = norm(raw)
		// Strip any optional "Seat:" prefix before tokens
		const afterColon = line.includes(':')
			? line.split(':').slice(1).join(':').trim()
			: line
		const tokens = afterColon.split(/\s+/).filter(Boolean)
		for (const tok of tokens) {
			const m = tok.match(cardRe)
			if (!m) continue
			const suit = toSuit(m[1])
			const rank = toRank(m[2])
			if (suit && rank) moves.push({ suit, rank })
		}
	}
	return moves
}

function suitSymbol(name) {
	return name === 'Spades'
		? '♠'
		: name === 'Hearts'
		? '♥'
		: name === 'Diamonds'
		? '♦'
		: '♣'
}

export default function Player() {
	const [deals, setDeals] = useState([])
	const [index, setIndex] = useState(0)
	const [hideDefenders, setHideDefenders] = useState(true)
	const [showSuitTally, setShowSuitTally] = useState(true)
	const [showHcpWhenHidden, setShowHcpWhenHidden] = useState(false)
	const fileRef = useRef(null)
	const [selectedName, setSelectedName] = useState('')
	const [exampleMsg, setExampleMsg] = useState('')

	const current = deals[index]
	const hands = useMemo(() => {
		if (!current) return null
		return dealToHands(current.deal)
	}, [current])

	// Parsed play moves from PBN play section (card tokens only)
	const playMoves = useMemo(() => {
		if (!current?.play?.length) return []
		return parsePlayMoves(current.playLeader || null, current.play)
	}, [current])

	// Controlled stepper index (how many cards from playMoves applied)
	const [playIdx, setPlayIdx] = useState(0)

	// Interactive state: remaining hands and played cards per seat
	const [remaining, setRemaining] = useState(null)
	const [played, setPlayed] = useState({ N: [], E: [], S: [], W: [] })
	const [tally, setTally] = useState({
		Spades: [],
		Hearts: [],
		Diamonds: [],
		Clubs: [],
	})
	const [turnSeat, setTurnSeat] = useState(null)
	const [trick, setTrick] = useState([]) // [{seat, card}]
	const [tricksDecl, setTricksDecl] = useState(0)
	const [tricksDef, setTricksDef] = useState(0)
	// Guard to avoid double-resolving a trick on rapid clicks/renders
	const resolvingRef = useRef(false)

	// Initialize when hands change (new file or board)
	useEffect(() => {
		if (hands) {
			setRemaining(hands)
			setPlayed({ N: [], E: [], S: [], W: [] })
			setTally({ Spades: [], Hearts: [], Diamonds: [], Clubs: [] })
			setTrick([])
			setTricksDecl(0)
			setTricksDef(0)
			const dec = current?.declarer
			const leaderFromDec = dec ? leftOf(dec) : current?.dealer || 'N'
			const leader = current?.playLeader || leaderFromDec
			setTurnSeat(leader)
			setPlayIdx(0)
		} else {
			setRemaining(null)
			setPlayed({ N: [], E: [], S: [], W: [] })
			setTally({ Spades: [], Hearts: [], Diamonds: [], Clubs: [] })
			setTrick([])
			setTricksDecl(0)
			setTricksDef(0)
			setTurnSeat(null)
		}
	}, [hands])

	// Apply PBN play moves up to k cards, recomputing from the initial hands
	function applyMovesTo(k) {
		if (!hands) return
		const maxK = Math.max(0, Math.min(k, playMoves.length))
		const rem = {
			N: [...hands.N],
			E: [...hands.E],
			S: [...hands.S],
			W: [...hands.W],
		}
		const pl = { N: [], E: [], S: [], W: [] }
		const tl = { Spades: [], Hearts: [], Diamonds: [], Clubs: [] }
		const trickArr = []
		const trump = parseTrump(current?.contract)
		const dec = current?.declarer
		const leaderFromDec = dec ? leftOf(dec) : current?.dealer || 'N'
		let nextSeat = current?.playLeader || leaderFromDec
		let declTricks = 0
		let defTricks = 0

		const takeFromSeat = (seat, suit, rank) => {
			let idx = rem[seat].findIndex((c) => c.suit === suit && c.rank === rank)
			if (idx === -1 && rank === '10')
				idx = rem[seat].findIndex((c) => c.suit === suit && c.rank === 'T')
			if (idx === -1 && rank === 'T')
				idx = rem[seat].findIndex((c) => c.suit === suit && c.rank === '10')
			if (idx === -1) return null
			const [card] = rem[seat].splice(idx, 1)
			return card
		}

		for (let i = 0; i < maxK; i++) {
			const mv = playMoves[i]
			const card = takeFromSeat(nextSeat, mv.suit, mv.rank)
			if (!card) break
			pl[nextSeat] = [...pl[nextSeat], card]
			tl[card.suit] = [...tl[card.suit], card]
			trickArr.push({ seat: nextSeat, card })
			if (trickArr.length < 4) {
				nextSeat = rightOf(nextSeat)
			} else {
				const winner = evaluateTrick(trickArr, trump)
				if (isDeclarerSide(winner, dec)) declTricks++
				else defTricks++
				nextSeat = winner
				trickArr.length = 0
			}
		}

		setRemaining(rem)
		setPlayed(pl)
		setTally(tl)
		setTrick(trickArr)
		setTricksDecl(declTricks)
		setTricksDef(defTricks)
		setTurnSeat(nextSeat)
		setPlayIdx(maxK)
	}

	const onFile = async (e) => {
		const file = e.target.files?.[0]
		if (!file) return
		const text = await file.text()
		const parsed = parsePBN(text)
		setDeals(parsed)
		setIndex(0)
		setSelectedName(file.name)
		setExampleMsg('')
	}

	const next = () =>
		setIndex((i) => Math.min(i + 1, Math.max(0, deals.length - 1)))
	const prev = () => setIndex((i) => Math.max(0, i - 1))

	const onPlayCard = (seat, cardId) => {
		if (resolvingRef.current) return
		if (!remaining || !remaining[seat]) return
		if (turnSeat !== seat) return
		const pool = remaining[seat]
		const chosen = pool.find((c) => c.id === cardId)
		if (!chosen) return
		const leadSuit = trick.length ? trick[0].card.suit : null
		const hasLead = leadSuit ? pool.some((c) => c.suit === leadSuit) : false
		if (leadSuit && hasLead && chosen.suit !== leadSuit) return

		const card = chosen
		setRemaining((prev) => ({
			...prev,
			[seat]: prev[seat].filter((c) => c.id !== cardId),
		}))
		setPlayed((prev) => ({
			...prev,
			[seat]: [...prev[seat], card],
		}))
		setTally((prev) => ({
			...prev,
			[card.suit]: [...prev[card.suit], card],
		}))

		setTrick((prev) => {
			const nextTrick = [...prev, { seat, card }]
			if (nextTrick.length < 4) {
				setTurnSeat(rightOf(seat))
			} else {
				resolvingRef.current = true
				const trump = parseTrump(current?.contract)
				const winner = evaluateTrick(nextTrick, trump)
				const isDeclSide = isDeclarerSide(winner, current?.declarer)
				if (isDeclSide) setTricksDecl((n) => n + 1)
				else setTricksDef((n) => n + 1)
				setTurnSeat(winner)
				// queue clearing the trick after render
				setTimeout(() => {
					setTrick([])
					resolvingRef.current = false
				}, 0)
			}
			return nextTrick
		})
	}

	return (
		<div className="min-h-screen bg-white flex flex-col items-center px-4 py-6">
			<div className="w-full max-w-5xl">
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-3xl font-bold text-gray-800">
						Tournament PBN Player (beta)
					</h1>
					<Link to="/" className="text-sm text-sky-600 hover:underline">
						← Home
					</Link>
				</div>

				<div className="flex items-center gap-3 mb-3">
					<input
						ref={fileRef}
						type="file"
						accept=".pbn,text/plain"
						onChange={onFile}
						className="hidden"
					/>
					<button
						onClick={() => fileRef.current?.click()}
						className="px-3 py-1.5 rounded bg-sky-600 text-white text-sm hover:bg-sky-700 active:scale-[.98]">
						Choose PBN…
					</button>
					<span className="text-xs px-2 py-1 rounded border bg-white min-w-[180px] text-gray-600">
						{selectedName || 'No file chosen'}
					</span>
					<button
						disabled={!deals.length}
						onClick={prev}
						className="px-2 py-1 rounded border text-sm disabled:opacity-40">
						Prev
					</button>
					<div className="text-sm text-gray-600">
						{deals.length
							? `Board ${deals[index]?.board || index + 1} — ${index + 1}/${
									deals.length
							  }`
							: 'No file loaded'}
						{current?.contract
							? ` • Contract: ${current.contract}${
									current?.declarer ? ` (${current.declarer})` : ''
							  }`
							: ' • No bidding found'}
					</div>
					<button
						disabled={!deals.length}
						onClick={next}
						className="px-2 py-1 rounded border text-sm disabled:opacity-40">
						Next
					</button>
					<label className="ml-auto text-sm text-gray-700 flex items-center gap-1">
						<input
							type="checkbox"
							checked={hideDefenders}
							onChange={(e) => setHideDefenders(e.target.checked)}
						/>{' '}
						Hide defenders
					</label>
					<label className="text-sm text-gray-700 flex items-center gap-1">
						<input
							type="checkbox"
							checked={showSuitTally}
							onChange={(e) => setShowSuitTally(e.target.checked)}
						/>{' '}
						Show suit tally
					</label>
					<label className="text-sm text-gray-700 flex items-center gap-1">
						<input
							type="checkbox"
							checked={showHcpWhenHidden}
							onChange={(e) => setShowHcpWhenHidden(e.target.checked)}
						/>{' '}
						Show HCP for declarer/dummy when hidden
					</label>
				</div>

				{hideDefenders &&
					turnSeat &&
					isDefender(turnSeat, current?.declarer) && (
						<div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
							Defender's turn is hidden — unhide defenders to choose a card.
						</div>
					)}

				{current?.auction?.length ? (
					<AuctionView
						dealer={current.auctionDealer || current.dealer}
						calls={current.auction}
						finalContract={current.contract}
					/>
				) : null}

				{current?.play?.length ? (
					<PlayStepper
						hasPlay={!!current.play?.length}
						lines={current.play}
						idx={playIdx}
						onPrev={() => applyMovesTo(playIdx - 1)}
						onNext={() => applyMovesTo(playIdx + 1)}
					/>
				) : null}

				{/* Player layout or pre-upload options */}
				{remaining ? (
					<PlayerLayout
						remaining={remaining}
						played={played}
						onPlay={onPlayCard}
						hideDefenders={hideDefenders}
						showSuitTally={showSuitTally}
						showHcpWhenHidden={showHcpWhenHidden}
						dealer={current?.dealer}
						vulnerable={current?.vul}
						declarer={current?.declarer}
						contract={current?.contract}
						turnSeat={turnSeat}
						trick={trick}
						tally={tally}
						tricksDecl={tricksDecl}
						tricksDef={tricksDef}
						neededToSet={neededToSet(current?.contract)}
					/>
				) : (
					<PreUploadGrid
						onChooseFile={() => fileRef.current?.click()}
						exampleMsg={exampleMsg}
						setExampleMsg={setExampleMsg}
					/>
				)}
			</div>
		</div>
	)
}

function PlayerLayout({
	remaining,
	played,
	onPlay,
	hideDefenders,
	showSuitTally,
	showHcpWhenHidden,
	dealer,
	vulnerable,
	declarer,
	contract,
	turnSeat,
	trick,
	tally,
	tricksDecl,
	tricksDef,
	neededToSet,
}) {
	const seats = ['N', 'E', 'S', 'W']
	// Use the shared seat order
	// eslint-disable-next-line no-unused-vars
	const _useSharedSeatOrder = orderSeats
	let visible = seats
	if (hideDefenders) {
		if (declarer) {
			const partner = partnerOf(declarer)
			const showDummy = (trick?.length || 0) >= 1
			visible = showDummy ? [declarer, partner] : [declarer]
		} else {
			visible = ['N', 'S']
		}
	}
	return (
		<div className="w-full flex flex-col items-stretch gap-2">
			<div className="w-full flex items-start justify-center gap-3">
				{/* Left margin: suit tally only */}
				<div className="w-44 hidden md:flex flex-col gap-2">
					{showSuitTally && <SuitTally tally={tally} />}
				</div>
				{/* Center seats */}
				<div className="flex flex-col items-center gap-2">
					<div className="flex flex-row flex-wrap items-start justify-center gap-2">
						{seats.map((id) => (
							<SeatPanel
								key={id}
								id={id}
								remaining={remaining}
								onPlay={onPlay}
								visible={visible.includes(id)}
								dealer={dealer}
								vulnerable={vulnerable}
								turnSeat={turnSeat}
								trick={trick}
								declarer={declarer}
								showHcpWhenHidden={showHcpWhenHidden}
							/>
						))}
					</div>
					{/* Current trick display */}
					<CurrentTrick trick={trick} turnSeat={turnSeat} />
				</div>
				{/* Right margin: scoreboard */}
				<div className="w-52 hidden md:flex flex-col gap-2">
					<ScorePanel
						tricksDecl={tricksDecl}
						tricksDef={tricksDef}
						neededToSet={neededToSet}
						contract={contract}
						declarer={declarer}
					/>
				</div>
			</div>
		</div>
	)
}

function PlayedColumn({ id, played, hidden, align = 'left' }) {
	if (hidden) return <div className="min-h-[100px]" />
	const seatName =
		id === 'N' ? 'NORTH' : id === 'E' ? 'EAST' : id === 'S' ? 'SOUTH' : 'WEST'
	return (
		<div
			className={`rounded-lg border bg-gray-50 ${
				align === 'right' ? 'text-right' : ''
			} p-2`}>
			<div className="text-[10px] font-semibold text-gray-600 mb-1">
				{seatName} played
			</div>
			<div
				className={`flex ${
					align === 'right' ? 'justify-end' : 'justify-start'
				} flex-wrap gap-1`}>
				{played.length ? (
					played.map((c) => (
						<span
							key={c.id}
							className={`inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded border ${
								c.suit === 'Hearts' || c.suit === 'Diamonds'
									? 'text-red-600 border-red-200 bg-white'
									: 'text-gray-800 border-gray-200 bg-white'
							}`}>
							{c.rank}
							{suitSymbol(c.suit)}
						</span>
					))
				) : (
					<span className="text-[11px] text-gray-400 italic">none</span>
				)}
			</div>
		</div>
	)
}

function SeatPanel({
	id,
	remaining,
	onPlay,
	visible,
	dealer,
	vulnerable,
	turnSeat,
	trick,
	declarer,
	showHcpWhenHidden,
}) {
	const bySeat = remaining[id] || []
	const hcp = bySeat.reduce((sum, c) => sum + hcpValue(c.rank), 0)
	const suitOrder = ['Clubs', 'Diamonds', 'Hearts', 'Spades']
	const suitText = {
		Hearts: 'text-red-600',
		Diamonds: 'text-red-600',
		Spades: 'text-black',
		Clubs: 'text-black',
	}
	const isDealer = dealer === id
	const seatIsVul =
		vulnerable === 'All' ||
		(vulnerable === 'NS' && (id === 'N' || id === 'S')) ||
		(vulnerable === 'EW' && (id === 'E' || id === 'W'))

	// Group and sort by suit descending rank for display
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
	const cardsBySuit = Object.fromEntries(
		suitOrder.map((s) => [
			s,
			bySeat
				.filter((c) => c.suit === s)
				.sort((a, b) => order[b.rank] - order[a.rank]),
		])
	)

	const isTurn = turnSeat === id
	return (
		<div
			className={`rounded-xl overflow-hidden shadow-md border ${
				isDealer
					? 'border-amber-500'
					: isTurn
					? 'border-red-500'
					: 'border-gray-300'
			} bg-white w-64`}>
			<div
				className={`w-full ${
					isDealer
						? 'bg-amber-100 text-amber-900'
						: isTurn
						? 'bg-red-100 text-red-900'
						: 'bg-gray-100 text-gray-800'
				} font-extrabold text-[11px] tracking-widest uppercase px-2 py-1.5 flex items-center justify-between`}>
				<span className="flex items-center gap-1">
					{id === 'N'
						? 'NORTH'
						: id === 'E'
						? 'EAST'
						: id === 'S'
						? 'SOUTH'
						: 'WEST'}
					{isDealer && (
						<span
							title="Dealer"
							className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[9px] rounded-full bg-amber-500 text-white">
							D
						</span>
					)}
				</span>
				<span className="flex items-center gap-1">
					{isTurn && (
						<span className="text-[10px] font-bold text-white bg-red-500 rounded px-1 py-0.5">
							{seatFullName(id)} to play
						</span>
					)}
					{seatIsVul && (
						<span className="text-[9px] font-bold text-red-700 bg-red-100 border border-red-200 rounded px-1 py-0.5">
							V
						</span>
					)}
					{(visible ||
						(showHcpWhenHidden &&
							declarer &&
							(id === declarer ||
								id ===
									['N', 'E', 'S', 'W'][
										(['N', 'E', 'S', 'W'].indexOf(declarer) + 2) % 4
									]))) && (
						<span className="text-[10px] opacity-80">HCP {hcp}</span>
					)}
					<span className="text-[10px] opacity-80">{bySeat.length}/13</span>
				</span>
			</div>
			<div className="h-64 p-3 flex flex-col gap-2 items-stretch justify-center">
				{suitOrder.map((suit) => (
					<div key={`${id}-${suit}`} className="flex items-center gap-3 flex-1">
						<div
							className={`w-8 text-center text-2xl leading-none ${suitText[suit]}`}>
							{suit === 'Clubs'
								? '♣'
								: suit === 'Diamonds'
								? '♦'
								: suit === 'Hearts'
								? '♥'
								: '♠'}
						</div>
						<div className="flex-1 text-base md:text-lg leading-none flex flex-wrap gap-2">
							{visible ? (
								cardsBySuit[suit].length ? (
									cardsBySuit[suit].map((c) => {
										const leadSuit = trick.length ? trick[0].card.suit : null
										const hasLead = leadSuit
											? bySeat.some((x) => x.suit === leadSuit)
											: false
										const legal =
											turnSeat === id &&
											(!leadSuit || !hasLead || c.suit === leadSuit)
										return (
											<button
												key={c.id}
												onClick={() => legal && onPlay(id, c.id)}
												disabled={!legal}
												className={`font-semibold px-1 select-none rounded ${
													legal
														? 'text-gray-900 hover:bg-gray-100 active:scale-95'
														: 'text-gray-400 cursor-not-allowed opacity-60'
												}`}>
												{c.rank}
											</button>
										)
									})
								) : (
									<span className="text-base md:text-lg text-gray-500">-</span>
								)
							) : (
								<span className="text-gray-400 text-sm italic">hidden</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function CurrentTrick({ trick, turnSeat }) {
	// Display across as N, E, W, S (swap S and W compared to prior)
	const order = ['N', 'E', 'W', 'S']
	const items = trick
	// Simple trick count approximation (number of cards played div 4 is completed tricks)
	const tricksPlayed = Math.floor(
		(13 * 4 - (items.length ? 52 - items.length : 52)) / 4
	) // placeholder visual only
	return (
		<div className="mt-2 rounded-lg border bg-white p-3 min-h-[116px] w-full max-w-[820px]">
			<div className="text-xs text-gray-600 mb-2 flex items-center justify-between">
				<span>Current Trick</span>
				<span className="text-[11px] text-gray-500">
					Tricks played:{' '}
					<span className="font-semibold text-gray-700">
						{Math.max(0, Math.floor((13 * 4 - 52 + items.length) / 4))}
					</span>
				</span>
			</div>
			{/* Labels row */}
			<div className="flex items-center justify-center gap-4 mb-1">
				{order.map((seat) => {
					const isTurn = turnSeat === seat
					return (
						<div
							key={`ctl-${seat}`}
							className={`w-20 text-center text-[11px] font-semibold ${
								isTurn ? 'text-red-600' : 'text-gray-500'
							}`}>
							{seat} {isTurn ? '•' : ''}
						</div>
					)
				})}
			</div>
			{/* Cards row */}
			<div className="flex items-center justify-center gap-4">
				{order.map((seat) => {
					const t = items.find((x) => x.seat === seat)
					const isTurn = turnSeat === seat
					return (
						<div
							key={`ct-${seat}`}
							className={`w-20 h-24 rounded-md border flex items-center justify-center ${
								isTurn ? 'border-red-400 bg-red-50' : 'bg-[#FFF8E7]'
							}`}>
							{t ? (
								<div
									className={`${
										t.card.suit === 'Hearts' || t.card.suit === 'Diamonds'
											? 'text-red-600'
											: 'text-black'
									} text-2xl font-extrabold`}>
									{t.card.rank}
									{suitSymbol(t.card.suit)}
								</div>
							) : (
								<span className="text-[10px] text-gray-400">—</span>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}

function ScorePanel({
	tricksDecl,
	tricksDef,
	neededToSet,
	contract,
	declarer,
}) {
	return (
		<div className="rounded-lg border bg-white p-3">
			<div className="text-xs text-gray-600 mb-1">Scoreboard</div>
			<div className="text-sm text-gray-800">
				Declarer: <span className="font-semibold">{declarer || '-'}</span>
			</div>
			<div className="text-sm text-gray-800 mb-1">
				Contract: <span className="font-semibold">{contract || '-'}</span>
			</div>
			<div className="text-sm text-gray-800">
				Declarer tricks: <span className="font-semibold">{tricksDecl}</span>
			</div>
			<div className="text-sm text-gray-800">
				Defender tricks: <span className="font-semibold">{tricksDef}</span>
			</div>
			<div className="text-sm text-gray-800">
				Defenders need to set:{' '}
				<span className="font-semibold">
					{Math.max(0, neededToSet - tricksDef)}
				</span>
			</div>
		</div>
	)
}

function SuitTally({ tally }) {
	const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
	const color = (s) =>
		s === 'Hearts' || s === 'Diamonds' ? 'text-red-600' : 'text-black'
	return (
		<div className="rounded-lg border bg-white p-2 text-xs">
			<div className="font-semibold text-gray-600 mb-1">Played by suit</div>
			<div className="flex flex-col gap-1">
				{suits.map((s) => (
					<div key={`tally-${s}`} className="flex items-center gap-2">
						<span className={`${color(s)} w-4 text-center`}>
							{suitSymbol(s)}
						</span>
						<div className="flex-1 flex flex-wrap gap-1">
							{(tally[s] || []).length ? (
								tally[s].map((c) => (
									<span
										key={c.id}
										className="inline-flex items-center justify-center text-[10px] px-1 py-0.5 rounded border bg-white">
										{c.rank}
									</span>
								))
							) : (
								<span className="text-[10px] text-gray-400">none</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function AuctionView({ dealer, calls, finalContract }) {
	if (!dealer || !calls?.length) return null
	const seats = ['N', 'E', 'S', 'W']
	const startIdx = seats.indexOf(dealer)
	const seatFor = (i) => seats[(startIdx + i) % 4]
	const seatColor = (s) =>
		s === 'N' || s === 'S'
			? 'bg-emerald-50 text-emerald-800 border-emerald-200'
			: 'bg-rose-50 text-rose-800 border-rose-200'
	const contractColor = (c) => {
		if (!c) return 'bg-gray-200 text-gray-800'
		const up = c.toUpperCase()
		if (up.includes('NT')) return 'bg-slate-800 text-white'
		if (up.endsWith('S')) return 'bg-gray-900 text-white'
		if (up.endsWith('H')) return 'bg-red-600 text-white'
		if (up.endsWith('D')) return 'bg-amber-500 text-white'
		if (up.endsWith('C')) return 'bg-green-600 text-white'
		return 'bg-gray-200 text-gray-800'
	}
	// Truncate auction to final contract + trailing three passes
	const isPass = (c) => /^P(ASS)?$/i.test(c)
	const isBid = (c) => /^(?:[1-7](?:C|D|H|S|NT))(?:X{1,2})?$/i.test(c)
	let trimmed = [...calls]
	// Remove any tokens that look like card play (e.g., 'S: A', etc.) — we only expect bids/passes here
	trimmed = trimmed.filter((c) => isPass(c) || isBid(c))
	let finalIdx = -1
	for (let i = 0; i < trimmed.length; i++) {
		if (
			isBid(trimmed[i]) &&
			isPass(trimmed[i + 1]) &&
			isPass(trimmed[i + 2]) &&
			isPass(trimmed[i + 3])
		) {
			finalIdx = i
			break
		}
	}
	const showCalls = finalIdx >= 0 ? trimmed.slice(0, finalIdx + 4) : trimmed
	const showFinal = finalIdx >= 0 ? trimmed[finalIdx] : finalContract
	return (
		<div className="mb-3 text-xs text-gray-700">
			<div className="font-semibold mb-1">Auction</div>
			<div className="flex flex-wrap items-center gap-1">
				{showCalls.map((call, i) => (
					<span
						key={`call-${i}`}
						className={`inline-flex items-center gap-1 px-1 py-0.5 rounded border ${seatColor(
							seatFor(i)
						)}`}>
						<span className="opacity-70">{seatFor(i)}:</span>
						<span className="font-semibold">{call}</span>
					</span>
				))}
				{showFinal ? (
					<span
						className={`ml-2 inline-flex items-center px-2 py-0.5 rounded ${contractColor(
							showFinal
						)}`}>
						Final: {showFinal}
					</span>
				) : null}
			</div>
		</div>
	)
}

function PlayStepper({ hasPlay, lines, idx, onPrev, onNext }) {
	if (!hasPlay || !lines?.length) return null
	const safeIdx = Math.min(Math.max(0, idx), lines.length - 1)
	const step = lines[safeIdx]
	const commentary = `Step ${safeIdx + 1}/${
		lines.length
	}: ${step}. Teacher note: discuss why this choice is reasonable.`
	return (
		<div className="mb-3 rounded-lg border bg-white p-3">
			<div className="flex items-center justify-between mb-2">
				<div className="text-xs font-semibold text-gray-800">
					Step through the play (from PBN)
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={onPrev}
						disabled={safeIdx === 0}
						className="px-2 py-0.5 rounded border text-xs disabled:opacity-40">
						Prev
					</button>
					<button
						onClick={onNext}
						disabled={safeIdx >= lines.length - 1}
						className="px-2 py-0.5 rounded border text-xs disabled:opacity-40">
						Next
					</button>
				</div>
			</div>
			<div className="text-xs text-gray-700">{commentary}</div>
		</div>
	)
}

function PreUploadGrid({ onChooseFile, exampleMsg, setExampleMsg }) {
	const examples = [
		{
			group: 'Openings',
			items: [
				'1NT',
				'1 of a Suit',
				'2NT',
				'2♣ (strong)',
				'2 of a Suit (weak)',
				'3 of a Suit (weak)',
				'Pass',
			],
		},
		{
			group: 'Conventions',
			items: [
				'Slam bidding',
				'4th Suit Forcing',
				'Stayman',
				'Transfers',
				'Michaels / Unusual 2NT',
			],
		},
	]
	return (
		<div className="w-full">
			<div className="rounded-lg border bg-white p-4 mb-3">
				<div className="flex items-center justify-between mb-2">
					<div className="text-sm font-semibold text-gray-800">Get started</div>
					<button
						onClick={onChooseFile}
						className="px-2.5 py-1 rounded bg-sky-600 text-white text-xs hover:bg-sky-700">
						Choose PBN…
					</button>
				</div>
				<div className="text-xs text-gray-600">
					Load a PBN tournament file or pick an example scenario below. Examples
					are placeholders; we’ll wire them up next.
				</div>
			</div>

			<div className="overflow-x-auto rounded-lg border bg-white">
				<table className="w-full text-sm">
					<thead className="bg-gray-50 text-gray-600">
						<tr>
							<th className="text-left font-semibold p-2">Category</th>
							<th className="text-left font-semibold p-2">Scenarios</th>
						</tr>
					</thead>
					<tbody>
						{examples.map((row) => (
							<tr key={row.group} className="border-t">
								<td className="align-top p-2 font-semibold text-gray-800 w-40">
									{row.group}
								</td>
								<td className="p-2">
									<div className="flex flex-wrap gap-2">
										{row.items.map((label) => (
											<button
												key={label}
												onClick={() =>
													setExampleMsg(
														`Example selected: ${label} (coming soon)`
													)
												}
												className="px-2 py-1 rounded border bg-white hover:bg-gray-50">
												{label}
											</button>
										))}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{exampleMsg ? (
				<div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
					{exampleMsg}
				</div>
			) : null}
		</div>
	)
}

// Helpers: seats and winners
const orderSeats = ['N', 'E', 'S', 'W']
function rightOf(seat) {
	return orderSeats[(orderSeats.indexOf(seat) + 1) % 4]
}
function leftOf(seat) {
	return orderSeats[(orderSeats.indexOf(seat) + 3) % 4]
}
function partnerOf(seat) {
	return orderSeats[(orderSeats.indexOf(seat) + 2) % 4]
}
function isDefender(seat, declarer) {
	if (!declarer) return false
	const opp = orderSeats[(orderSeats.indexOf(declarer) + 2) % 4]
	return seat !== declarer && seat !== opp
}
function declarerVisible(declarer) {
	if (!declarer) return ['N', 'S']
	const opp = orderSeats[(orderSeats.indexOf(declarer) + 2) % 4]
	return [declarer, opp]
}

function rankValue(rank) {
	const map = {
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
	return map[rank] || 0
}

// High-card point value helper (A=4, K=3, Q=2, J=1; others 0)
function hcpValue(rank) {
	if (rank === 'A') return 4
	if (rank === 'K') return 3
	if (rank === 'Q') return 2
	if (rank === 'J') return 1
	return 0
}
function parseTrump(contract) {
	if (!contract) return null
	const up = contract.toUpperCase().replace(/X+$/, '')
	if (up.includes('NT')) return null
	if (up.endsWith('S')) return 'Spades'
	if (up.endsWith('H')) return 'Hearts'
	if (up.endsWith('D')) return 'Diamonds'
	if (up.endsWith('C')) return 'Clubs'
	return null
}
function evaluateTrick(trickArr, trumpSuit) {
	const leadSuit = trickArr[0].card.suit
	let winner = trickArr[0]
	function hcpValue(rank) {
		if (rank === 'A') return 4
		if (rank === 'K') return 3
		if (rank === 'Q') return 2
		if (rank === 'J') return 1
		return 0
	}
	for (let i = 1; i < trickArr.length; i++) {
		const t = trickArr[i]
		if (trumpSuit) {
			const wTrump = winner.card.suit === trumpSuit
			const tTrump = t.card.suit === trumpSuit
			if (
				tTrump &&
				(!wTrump || rankValue(t.card.rank) > rankValue(winner.card.rank))
			)
				winner = t
		}
		if (!trumpSuit) {
			if (
				t.card.suit === leadSuit &&
				rankValue(t.card.rank) > rankValue(winner.card.rank)
			)
				winner = t
		}
	}
	return winner.seat
}
function isDeclarerSide(seat, declarer) {
	if (!declarer) return false
	const opp = orderSeats[(orderSeats.indexOf(declarer) + 2) % 4]
	return seat === declarer || seat === opp
}
function neededToSet(contract) {
	if (!contract) return 0
	const level = parseInt(contract, 10)
	if (!level) return 0
	const target = 6 + level
	const defendersNeed = 13 - target + 1
	return defendersNeed
}

function seatFullName(id) {
	return id === 'N'
		? 'North'
		: id === 'E'
		? 'East'
		: id === 'S'
		? 'South'
		: 'West'
}

