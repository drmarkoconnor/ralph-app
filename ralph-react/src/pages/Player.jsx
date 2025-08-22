import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Minimal PBN parser extended to capture metadata (Event/Site/Date) and player names (North/East/South/West)
function parsePBN(text) {
	const lines = text.split(/\r?\n/)
	const deals = []
	let current = {}
	const globalMeta = { meta: {}, players: { N: '', E: '', S: '', W: '' } }
	let inAuction = false
	let inPlay = false
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i] || ''
		const line = raw.trim()
		if (!line && inAuction) inAuction = false
		const m = line.match(/^\[([^\s]+)\s+"([^"]*)"\]/)
		if (!m) {
			if (inAuction) {
				const calls = line
					.replace(/([;%].*)$/g, '')
					.split(/\s+/)
					.filter(Boolean)
				if (calls.length)
					current.auction = [...(current.auction || []), ...calls]
			}
			if (inPlay) {
				if (!current.play) current.play = []
				const body = line.replace(/([;%].*)$/g, '')
				if (body) current.play.push(body)
			}
			continue
		}
		const tag = m[1]
		const val = m[2]
		if (tag !== 'Auction' && inAuction) inAuction = false
		if (tag !== 'Play' && inPlay) inPlay = false
		if (tag === 'Board') {
			if (current.deal) deals.push(current)
			current = {
				board: parseInt(val, 10),
				meta: { ...globalMeta.meta },
				players: { ...globalMeta.players },
			}
			inAuction = false
			inPlay = false
			continue
		}
		if (tag === 'Dealer') current.dealer = val
		if (tag === 'Vulnerable') current.vul = val
		if (tag === 'Deal') current.deal = val
		if (tag === 'Contract') current.contract = val
		if (tag === 'Declarer') current.declarer = val
		if (tag === 'Auction') {
			inAuction = true
			current.auction = []
			current.auctionDealer = val
			continue
		}
		if (tag === 'Play') {
			inPlay = true
			current.play = []
			current.playLeader = val
			continue
		}
		// Metadata and player names
		if (tag === 'Event' || tag === 'Site' || tag === 'Date') {
			const tgt = current.board ? current : globalMeta
			tgt.meta = tgt.meta || {}
			tgt.meta[tag.toLowerCase()] = val
			continue
		}
		if (
			tag === 'North' ||
			tag === 'East' ||
			tag === 'South' ||
			tag === 'West'
		) {
			const seat = tag[0].toUpperCase()
			const tgt = current.board ? current : globalMeta
			tgt.players = tgt.players || { N: '', E: '', S: '', W: '' }
			tgt.players[seat] = val
			continue
		}
	}
	if (current.deal) deals.push(current)
	return deals
}

// Convert a Deal string (e.g., "N:AKQJ.T98.. ...") to seat cards map {N,E,S,W: Card[]}
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
export default function Player() {
	// Controlled stepper index (how many cards from playMoves applied)
	const [playIdx, setPlayIdx] = useState(0)
	// File input and UI controls
	const fileRef = useRef(null)
	const [selectedName, setSelectedName] = useState('')
	const [exampleMsg, setExampleMsg] = useState('')
	const [hideDefenders, setHideDefenders] = useState(false)
	const [showSuitTally, setShowSuitTally] = useState(false)
	const [showHcpWhenHidden, setShowHcpWhenHidden] = useState(false)

	// Deals and current selection
	const [deals, setDeals] = useState([])
	const [index, setIndex] = useState(0)
	const current = deals[index] || null

	// Derived: parsed hands and play moves
	const hands = useMemo(() => {
		if (!current?.deal) return null
		try {
			return dealToHands(current.deal)
		} catch (e) {
			console.error('Failed to parse Deal:', e)
			return null
		}
	}, [current?.deal])

	const playMoves = useMemo(() => {
		if (!current?.play?.length) return []
		try {
			return parsePlayMoves(current?.playLeader, current.play)
		} catch (e) {
			console.error('Failed to parse Play:', e)
			return []
		}
	}, [current?.playLeader, current?.play])

	// Interactive state: remaining hands per seat
	const [remaining, setRemaining] = useState(null)
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
			setTally({ Spades: [], Hearts: [], Diamonds: [], Clubs: [] })
			setTrick([])
			setTricksDecl(0)
			setTricksDef(0)
			setTurnSeat(null)
		}
	}, [hands, current?.declarer, current?.dealer, current?.playLeader])

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
			tl[card.suit] = [...tl[card.suit], card]
			trickArr.push({ seat: nextSeat, card })
			if (trickArr.length < 4) {
				nextSeat = rightOf(nextSeat)
			} else {
			// Keyboard shortcuts for stepping through play
			useEffect(() => {
				const onKey = (e) => {
					// Avoid when typing in inputs/textareas
					const tag = (e.target && e.target.tagName) || ''
					if (/(INPUT|TEXTAREA|SELECT)/.test(tag)) return
					if (e.key === 'ArrowRight') {
						e.preventDefault()
						applyMovesTo(playIdx + 1)
					}
					if (e.key === 'ArrowLeft') {
						e.preventDefault()
						applyMovesTo(playIdx - 1)
					}
				}
				window.addEventListener('keydown', onKey)
				return () => window.removeEventListener('keydown', onKey)
			}, [playIdx, applyMovesTo])
				const winner = evaluateTrick(trickArr, trump)
		function parsePlayMoves(playLeader, lines) {
			// Accept common PBN token formats: "S: A", "S:A", "SA", "S10", or separate suit then rank
			const moves = []
			for (const rawLine of lines) {
				const line = rawLine.replace(/[|]/g, ' ').replace(/[,;]/g, ' ')
				const parts = line.split(/\s+/).filter(Boolean)
				let pendingSuit = null
				for (let i = 0; i < parts.length; i++) {
					const tok0 = parts[i].replace(/[.]+$/g, '') // strip trailing dots used as trick separators
					// Patterns
					let m
					// 1) "S:" then next token rank
					m = tok0.match(/^([SHDC]):$/i)
					if (m) {
						const r = parts[i + 1]
						if (r) {
							moves.push({ suit: suitName(m[1]), rank: normalizeRank(r) })
							i++
							continue
						}
					}
					// 2) "S:9" or "S:A"
					m = tok0.match(/^([SHDC]):([AKQJT2-9]|10)$/i)
					if (m) {
						moves.push({ suit: suitName(m[1]), rank: normalizeRank(m[2]) })
						continue
					}
					// 3) "S9", "SA", "S10"
					m = tok0.match(/^([SHDC])([AKQJT2-9]|10)$/i)
					if (m) {
						moves.push({ suit: suitName(m[1]), rank: normalizeRank(m[2]) })
						continue
					}
					// 4) Suit alone followed by separate rank token
					m = tok0.match(/^([SHDC])$/i)
					if (m) {
						pendingSuit = suitName(m[1])
						continue
					}
					if (pendingSuit) {
						const rnk = tok0.match(/^([AKQJT2-9]|10)$/i)
						if (rnk) {
							moves.push({ suit: pendingSuit, rank: normalizeRank(rnk[1]) })
							pendingSuit = null
							continue
						}
					}
					// Otherwise ignore token
				}
			}
			return moves
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

	// Derived: step helper and result/score for completed hands
	const totalMoves = playMoves.length
	const stepHelper = totalMoves
		? (() => {
				const i = Math.max(0, Math.min(playIdx, totalMoves - 1))
				const mv = playMoves[i]
				return `Step ${i + 1}/${totalMoves}: ${mv.rank}${suitSymbol(mv.suit)}`
		  })()
		: 'Manual play'

	const result = useMemo(() => {
	// Keyboard shortcuts for stepping (Left/Right arrows)
	useEffect(() => {
		const onKey = (e) => {
			const tag = String(e.target?.tagName || '').toLowerCase()
			if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
			if (e.key === 'ArrowLeft') {
				e.preventDefault()
				applyMovesTo(playIdx - 1)
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault()
				applyMovesTo(playIdx + 1)
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [playIdx])
		if (!current?.contract || !current?.declarer) return null
		const completed = tricksDecl + tricksDef
		const remainingTricks = Math.max(0, 13 - completed)
		const isFinished = playIdx >= totalMoves
		const assumedDecl = isFinished ? tricksDecl + remainingTricks : null
		if (assumedDecl == null) return { partial: true }
		const vul = isSeatVul(current.declarer, current.vul)
		return computeDuplicateScore(
			current.contract,
			current.declarer,
			vul,
			assumedDecl
		)
	}, [
		playIdx,
		totalMoves,
		tricksDecl,
		tricksDef,
		current?.contract,
		current?.declarer,
		current?.vul,
	])

	return (
		<div className="min-h-screen bg-white flex flex-col items-center px-4 py-6">
			<div className="w-full max-w-5xl">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-3xl font-bold text-gray-800">
							Tournament PBN Player (beta)
						</h1>
						{current?.meta ? (
							<div className="text-xs text-gray-600">
								{[
									current?.meta?.event ? `${current.meta.event}` : null,
									current?.meta?.date ? `${current.meta.date}` : null,
									current?.meta?.site ? `${current.meta.site}` : null,
								]
									.filter(Boolean)
									.join(' • ')}
							</div>
						) : null}
					</div>
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

				{/* Current Trick panel with integrated stepper controls */}
				<CurrentTrick
					trick={trick}
					turnSeat={turnSeat}
					hasPlay={!!totalMoves}
					totalMoves={totalMoves}
					helperText={stepHelper}
					idx={playIdx}
					onPrev={() => applyMovesTo(playIdx - 1)}
					onNext={() => applyMovesTo(playIdx + 1)}
					finishedBanner={
						result && !result.partial
							? `${result.resultText} • Score ${result.score > 0 ? '+' : ''}${
									result.score
							  }`
							: null
					}
				/>

				{/* Player layout or pre-upload options */}
				{remaining ? (
					<PlayerLayout
						remaining={remaining}
						onPlay={onPlayCard}
						hideDefenders={hideDefenders}
						showSuitTally={showSuitTally}
						showHcpWhenHidden={showHcpWhenHidden}
						dealer={current?.dealer}
						vulnerable={current?.vul}
						declarer={current?.declarer}
						contract={current?.contract}
						players={current?.players || {}}
						result={result}
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
	onPlay,
	hideDefenders,
	showSuitTally,
	showHcpWhenHidden,
	dealer,
	vulnerable,
	declarer,
	contract,
	players = {},
	result,
	turnSeat,
	trick,
	tally,
	tricksDecl,
	tricksDef,
	neededToSet,
}) {
	const seats = ['N', 'E', 'S', 'W']
	// Use the shared seat order (kept for clarity)
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
								playerName={players[id]}
								showHcpWhenHidden={showHcpWhenHidden}
							/>
						))}
					</div>
					{/* Current trick now displayed above with integrated controls */}
				</div>
				{/* Right margin: scoreboard */}
				<div className="w-64 hidden md:flex flex-col gap-2">
					<ScorePanel
						tricksDecl={tricksDecl}
						tricksDef={tricksDef}
						neededToSet={neededToSet}
						contract={contract}
						declarer={declarer}
						result={result}
					/>
				</div>
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
	playerName,
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
			{/* Player name if present in PBN */}
			{playerName ? (
				<div className="px-2 pb-2 pt-0.5 text-[10px] text-gray-500 truncate">
					{playerName}
				</div>
			) : null}
		</div>
	)
}

function ScorePanel({
	tricksDecl,
	tricksDef,
	neededToSet,
	contract,
	declarer,
	result,
}) {
	return (
		<div className="rounded-lg border bg-white p-3">
			<div className="text-[11px] text-gray-600 mb-1">Scoreboard</div>
			<div className="text-xs text-gray-800">
				Declarer: <span className="font-semibold">{declarer || '-'}</span>
			</div>
			<div className="text-xs text-gray-800 mb-1">
				Contract: <span className="font-semibold">{contract || '-'}</span>
			</div>
			<div className="text-xs text-gray-800">
				Declarer tricks: <span className="font-semibold">{tricksDecl}</span>
			</div>
			<div className="text-xs text-gray-800">
				Defender tricks: <span className="font-semibold">{tricksDef}</span>
			</div>
			<div className="text-xs text-gray-800">
				Defenders to defeat:{' '}
				<span className="font-semibold">{neededToSet || '-'}</span>
				{typeof neededToSet === 'number' && neededToSet > 0 ? (
					<span className="text-gray-600">{` (remaining ${Math.max(
						0,
						neededToSet - tricksDef
					)})`}</span>
				) : null}
			</div>
			{result && !result.partial ? (
				<div className="mt-1 text-xs text-gray-800">
					Result: <span className="font-semibold">{result.resultText}</span>
					{typeof result.score === 'number' ? (
						<span className="ml-1 font-semibold">{`Score ${
							result.score > 0 ? '+' : ''
						}${result.score}`}</span>
					) : null}
				</div>
			) : null}
		</div>
	)
}

function CurrentTrick({
	trick,
	turnSeat,
	hasPlay,
	totalMoves = 0,
	helperText = 'Manual play',
	idx = 0,
	onPrev,
	onNext,
	finishedBanner,
}) {
	const order = ['N', 'E', 'S', 'W']
	const items = Array.isArray(trick) ? trick : []
	const safeIdx = Math.min(Math.max(0, idx), Math.max(0, totalMoves - 1))
	const helper = helperText
	const completed = hasPlay ? Math.floor(idx / 4) : 0
	return (
		<div className="mt-2 rounded-lg border bg-white p-3 w-full max-w-[820px]">
			<div className="text-xs text-gray-600 mb-2 flex items-center justify-between">
				<span>Current Trick</span>
				<div className="flex items-center gap-2">
					<button
						onClick={onPrev}
						disabled={safeIdx === 0}
						className="px-2 py-0.5 rounded border text-xs disabled:opacity-40">
						Prev
					</button>
					<span className="text-[10px] text-gray-600">
						{totalMoves > 0 ? `${safeIdx + 1}/${totalMoves}` : '—'}
					</span>
					<button
						onClick={onNext}
						disabled={safeIdx >= totalMoves - 1}
						className="px-2 py-0.5 rounded border text-xs disabled:opacity-40">
						Next
					</button>
				</div>
			</div>
			<div className="text-[11px] text-gray-600 mb-2">{helper}</div>
			{/* Unified grid: labels above boxes in the same 4-column grid */}
			<div className="grid grid-cols-4 gap-4 place-items-center">
				{order.map((seat) => {
					const isTurn = turnSeat === seat
					return (
						<div
							key={`ctl-${seat}`}
							className={`text-center text-[11px] font-semibold ${
								isTurn ? 'text-red-600' : 'text-gray-500'
							}`}>
							{seat} {isTurn ? '•' : ''}
						</div>
					)
				})}
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
			{finishedBanner ? (
				<div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
					{finishedBanner}
				</div>
			) : null}
			<div className="mt-2 text-[11px] text-gray-500">
				Completed tricks:{' '}
				<span className="font-semibold">{Math.max(0, completed)}</span>
			</div>
		</div>
	)
}

// (Removed duplicate AuctionView and old PlayStepper here; single AuctionView is defined above)

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

// Convert a PBN Deal string to seat hands
function dealToHands(dealStr) {
	// Example deal: "N:AKQJ.T98..  ..." four seat segments in SHDC order per seat
	const m = dealStr.match(/^([NESW]):(.+)$/)
	if (!m) throw new Error('Bad Deal string')
	const start = m[1]
	const rest = m[2].trim()
	const seats = ['N', 'E', 'S', 'W']
	const startIdx = seats.indexOf(start)
	const segs = rest.split(/\s+/)
	if (segs.length !== 4) throw new Error('Deal must have 4 seat segments')
	const seatMap = {}
	for (let i = 0; i < 4; i++) {
		const seat = seats[(startIdx + i) % 4]
		const seg = segs[i]
		const [s, h, d, c] = seg.split('.').map((x) => x || '')
		const parseSuit = (suitName, str) =>
			Array.from(str).map((ch) => ({
				id: `${seat}-${suitName}-${ch}-${Math.random()
					.toString(36)
					.slice(2, 7)}`,
				suit: suitName,
				rank: ch === 'T' ? '10' : ch,
			}))
		const cards = [
			...parseSuit('Spades', s),
			...parseSuit('Hearts', h),
			...parseSuit('Diamonds', d),
			...parseSuit('Clubs', c),
		]
		seatMap[seat] = cards
	}
	return seatMap
}

// Parse PBN Play lines like "S: A" or combined tokens
function parsePlayMoves(playLeader, lines) {
	// Robustly parse PBN Play lines. Supports:
	// - Seat-labelled tokens: "W:" "N:" etc (ignored for card extraction)
	// - Combined cards: "DA", "S10", "HJ"
	// - Split with colon: "S:A" or tokens "S:" followed by "A"
	// - Split with space: "S A"
	const moves = []
	for (const raw of lines) {
		const line = (raw || '').replace(/([;%].*)$/g, '').trim()
		if (!line) continue
		const parts = line.split(/\s+/).filter(Boolean)
		for (let i = 0; i < parts.length; i++) {
			let tok = parts[i].replace(/[.,;]$/g, '')
			// Skip seat markers like N:, E, W: etc.
			if (/^[NESW]:?$/i.test(tok)) continue
			// Combined suit+rank (e.g., DA, S10)
			let m = tok.match(/^([SHDC])(?:\:)?(10|[AKQJT2-9])$/i)
			if (m) {
				moves.push({ suit: suitName(m[1]), rank: normalizeRank(m[2]) })
				continue
			}
			// Suit with colon then separate rank token: "S:" "A"
			let m2 = tok.match(/^([SHDC]):$/i)
			if (m2 && parts[i + 1]) {
				moves.push({ suit: suitName(m2[1]), rank: normalizeRank(parts[i + 1]) })
				i++
				continue
			}
			// Suit then space then rank: "S" "A"
			let m3 = tok.match(/^([SHDC])$/i)
			if (m3 && parts[i + 1] && /^(10|[AKQJT2-9])$/i.test(parts[i + 1])) {
				moves.push({ suit: suitName(m3[1]), rank: normalizeRank(parts[i + 1]) })
				i++
				continue
			}
			// Suit-joined with hyphen: "S-A" or "S-10"
			let m4 = tok.match(/^([SHDC])[-](10|[AKQJT2-9])$/i)
			if (m4) {
				moves.push({ suit: suitName(m4[1]), rank: normalizeRank(m4[2]) })
				continue
			}
		}
	}
	return moves
}

function suitName(letter) {
	const L = String(letter).toUpperCase()
	return L === 'S'
		? 'Spades'
		: L === 'H'
		? 'Hearts'
		: L === 'D'
		? 'Diamonds'
		: 'Clubs'
}
function normalizeRank(r) {
	return r === 'T' ? '10' : r.toUpperCase()
}

function suitSymbol(suit) {
	return suit === 'Spades'
		? '♠'
		: suit === 'Hearts'
		? '♥'
		: suit === 'Diamonds'
		? '♦'
		: '♣'
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
	// Defenders need 8 - level total tricks to defeat the contract
	return Math.max(0, 8 - level)
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

// Determine if a seat is vulnerable from PBN Vulnerable tag
function isSeatVul(seat, vulTag) {
	if (!seat || !vulTag) return false
	if (vulTag === 'All') return true
	if (vulTag === 'None') return false
	if (vulTag === 'NS') return seat === 'N' || seat === 'S'
	if (vulTag === 'EW') return seat === 'E' || seat === 'W'
	return false
}

// Compute approximate duplicate score for contract, given declarer vul status and declarer tricks
function computeDuplicateScore(contract, declarer, vul, declTricks) {
	// contract examples: 4S, 3NT, 2HX, 6NTXX etc.
	if (!contract) return { partial: true }
	const m = String(contract)
		.toUpperCase()
		.match(/^(\d)(C|D|H|S|NT)(X{0,2})?$/)
	if (!m) return { partial: true }
	const level = parseInt(m[1], 10)
	const strain = m[2]
	const dbl = m[3] || '' // '', 'X', 'XX'
	const target = 6 + level
	const made = declTricks - target
	const isNT = strain === 'NT'
	const isMajor = strain === 'H' || strain === 'S'
	const base = isNT ? 40 : isMajor ? 30 : 20
	const baseSecondOn = isNT ? 30 : base
	const trickValue = (n) => {
		if (n <= 0) return 0
		let v = 0
		if (n >= 1) v += base
		if (n >= 2) v += (n - 1) * baseSecondOn
		return v
	}
	const overValue = (n) => {
		if (n <= 0) return 0
		if (dbl === 'XX') return n * (vul ? 400 : 200)
		if (dbl === 'X') return n * (vul ? 200 : 100)
		return n * (isNT ? 30 : isMajor ? 30 : 20)
	}
	const underPenalty = (n) => {
		if (n <= 0) return 0
		if (!dbl) return n * (vul ? 100 : 50)
		if (dbl === 'XX') {
			if (!vul) {
				if (n === 1) return 200
				if (n === 2) return 500
				return 500 + (n - 2) * 300
			}
			// vul
			return 400 + (n - 1) * 400
		}
		// X
		if (!vul) {
			if (n === 1) return 100
			if (n === 2) return 300
			return 300 + (n - 2) * 300
		}
		// vul
		return 200 + (n - 1) * 300
	}

	let score = 0
	let resultText = ''
	if (made >= 0) {
		// contract made
		const contractValue = trickValue(level)
		const trickScore =
			dbl === 'XX'
				? contractValue * 4
				: dbl === 'X'
				? contractValue * 2
				: contractValue
		const over = overValue(made)
		const insult = dbl === 'XX' ? 100 : dbl === 'X' ? 50 : 0
		const game = contractValue >= 100
		const slamBonus =
			level === 6 ? (vul ? 750 : 500) : level === 7 ? (vul ? 1500 : 1000) : 0
		const gamePartScore = game ? (vul ? 500 : 300) : 50
		score = trickScore + over + insult + slamBonus + gamePartScore
		resultText = `${level}${strain}${dbl ? dbl : ''}=${
			made === 0 ? '' : `+${made}`
		}`
	} else {
		const down = -made
		const penalty = underPenalty(down)
		score = -penalty
		resultText = `${level}${strain}${dbl ? dbl : ''}-${down}`
	}
	return { partial: false, score, resultText }
}

