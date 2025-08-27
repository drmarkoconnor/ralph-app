import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
		const trailing = line.slice(m[0].length).trim()
		if (tag !== 'Auction' && inAuction) inAuction = false
		if (tag !== 'Play' && inPlay) inPlay = false
		if (tag === 'Board') {
			if (current.deal) deals.push(current)
			current = {
				board: parseInt(val, 10),
				meta: { ...globalMeta.meta },
				players: { ...globalMeta.players },
				ext: {},
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
		if (tag === 'Result') {
			const n = parseInt(val, 10)
			if (!Number.isNaN(n)) current.resultTricks = n
			continue
		}
		if (tag === 'Score') {
			const n = parseInt(val, 10)
			if (!Number.isNaN(n)) current.scoreTag = n
			continue
		}
		if (tag === 'Auction') {
			inAuction = true
			current.auction = []
			current.auctionDealer = val
			// Support inline auction content on the same line
			if (trailing) {
				const calls = trailing
					.replace(/([;%].*)$/g, '')
					.split(/\s+/)
					.filter(Boolean)
				if (calls.length) current.auction.push(...calls)
			}
			continue
		}
		if (tag === 'Play') {
			inPlay = true
			current.play = []
			current.playLeader = val
			continue
		}
		if (tag === 'PlayScript') {
			// decode escaped newlines (\n) into actual lines
			const decoded = String(val || '').replace(/\\n/g, '\n')
			current.playScript = decoded
			continue
		}
		// Metadata and player names
		if (tag === 'Event' || tag === 'Site' || tag === 'Date') {
			const tgt = current.board ? current : globalMeta
			tgt.meta = tgt.meta || {}
			tgt.meta[tag.toLowerCase()] = val
			continue
		}
		// Extended tags
		if (tag === 'TagSpec') {
			current.ext = current.ext || {}
			current.ext.tagSpec = val
			continue
		}
		if (
			tag === 'System' ||
			tag === 'Theme' ||
			tag === 'Interf' ||
			tag === 'Lead' ||
			tag === 'DDPar' ||
			tag === 'Diagram' ||
			tag === 'Scoring'
		) {
			current.ext = current.ext || {}
			current.ext[tag.toLowerCase()] = val
			continue
		}
		if (tag === 'DealHash') {
			current.ext = current.ext || {}
			current.ext.dealHash = val
			continue
		}
		if (tag === 'Note') {
			current.notes = current.notes || []
			if (val) current.notes.push(val)
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

// Treat common placeholder tokens as missing metadata
function cleanMetaVal(val) {
	if (val == null) return ''
	const t = String(val).trim()
	if (!t) return ''
	if (/^#+$/.test(t)) return '' // '##' '###'
	if (/^\?+$/.test(t)) return '' // '?' '??' '???'
	if (t === '-' || /^N\/?A$/i.test(t)) return ''
	return t
}

// Compact metadata panel using small-caps to display core and extended tags
function MetaPanel({ current, effContract, effDeclarer }) {
	if (!current) return null
	const m = current.meta || {}
	const ext = current.ext || {}
	const rows = []
	const pushRow = (label, value) => {
		const v = cleanMetaVal(value)
		if (v) rows.push({ label, value: v })
	}
	pushRow('Event', m.event)
	pushRow('Site', m.site)
	pushRow('Date', m.date)
	pushRow('Board', current.board)
	pushRow('Dealer', current.dealer)
	pushRow('Vul', current.vul)
	if (effContract)
		pushRow(
			'Contract',
			`${effContract}${effDeclarer ? ` (${effDeclarer})` : ''}`
		)
	pushRow('System', ext.system)
	pushRow('Theme', ext.theme)
	pushRow('Interf', ext.interf)
	pushRow('Lead', ext.lead)
	pushRow('DDPar', ext.ddpar)
	pushRow('Scoring', ext.scoring)
	pushRow('DealHash', ext.dealHash)
	const notes = Array.isArray(current.notes)
		? current.notes.filter(Boolean)
		: []
	return (
		<div className="mb-2 rounded border bg-white p-2 w-full max-w-5xl">
			<div
				className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-xs"
				style={{ fontVariant: 'small-caps' }}>
				{rows.map((r, idx) => (
					<div key={`m-${idx}`} className="flex items-center gap-1">
						<span className="text-gray-500">{r.label}:</span>
						<span className="text-gray-800 font-semibold truncate">
							{r.value}
						</span>
					</div>
				))}
			</div>
			{notes.length ? (
				<div className="mt-2 text-xs" style={{ fontVariant: 'small-caps' }}>
					<div className="text-gray-500 mb-1">Notes:</div>
					<ul className="list-disc ml-5 text-gray-800 space-y-0.5">
						{notes.map((n, i) => (
							<li key={`note-${i}`}>{n}</li>
						))}
					</ul>
				</div>
			) : null}
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
	const [teacherMode, setTeacherMode] = useState(false)
	const [auctionRevealed, setAuctionRevealed] = useState(true)
	const playIdxRef = useRef(0)
	const lastTrickKeyRef = useRef('')

	// Manual play timeline when no PBN Play is present
	const [manualMoves, setManualMoves] = useState([]) // { seat, suit, rank }[]

	// Manual overrides when PBN lacks contract/declarer
	const [manualDeclarer, setManualDeclarer] = useState('') // 'N'|'E'|'S'|'W'|''
	const [manualLevel, setManualLevel] = useState('') // '1'..'7'|''
	const [manualStrain, setManualStrain] = useState('') // 'C'|'D'|'H'|'S'|'NT'|''
	const [manualDbl, setManualDbl] = useState('') // ''|'X'|'XX'

	// Deals and current selection
	const [deals, setDeals] = useState([])
	const [index, setIndex] = useState(0)
	const current = deals[index] || null

	// When teacher focus is toggled on, hide the auction by default; reveal when turning off
	useEffect(() => {
		if (teacherMode) setAuctionRevealed(false)
		else setAuctionRevealed(true)
	}, [teacherMode])

	// On board change while in teacher mode, keep auction hidden by default
	useEffect(() => {
		if (teacherMode) setAuctionRevealed(false)
	}, [teacherMode, current?.board])

	// Effective context with manual overrides
	// Validate auction and optionally derive contract/declarer
	const validatedAuction = useMemo(() => {
		if (!current) return { legal: false }
		const calls = Array.isArray(current.auction) ? current.auction : []
		if (!calls.length) return { legal: false }
		return validateAuction(
			current.auctionDealer || current.dealer || 'N',
			calls
		)
	}, [current])

	const effDeclarer =
		manualDeclarer ||
		current?.declarer ||
		(validatedAuction.legal ? validatedAuction.declarer : '') ||
		''
	const effContract = useMemo(() => {
		if (manualLevel && manualStrain) {
			return `${manualLevel}${manualStrain}${manualDbl}`
		}
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

	// Board state: remaining hands, per-suit tally of played cards, current trick, turn, and trick counts
	const [remaining, setRemaining] = useState(null)
	const [tally, setTally] = useState({
		Spades: [],
		Hearts: [],
		Diamonds: [],
		Clubs: [],
	})
	const [trick, setTrick] = useState([])
	const [turnSeat, setTurnSeat] = useState(null)
	const [tricksDecl, setTricksDecl] = useState(0)
	const [tricksDef, setTricksDef] = useState(0)
	const resolvingRef = useRef(false)
	const [flashWinner, setFlashWinner] = useState(null)
	const flashTimerRef = useRef(null)

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
		// Prefer explicit Play lines
		if (current?.play?.length) {
			try {
				return parsePlayMoves(current?.playLeader, current.play, effContract)
			} catch (e) {
				console.error('Failed to parse Play:', e)
				return []
			}
		}
		// Next, try PlayScript if provided
		if (current?.playScript) {
			try {
				return parsePlayScript(current.playScript)
			} catch (e) {
				console.error('Failed to parse PlayScript:', e)
				return []
			}
		}
		return []
	}, [current?.playLeader, current?.play, current?.playScript, effContract])

	// Unified timeline source: prefer PBN moves if present, else manual
	const usingManual = playMoves.length === 0
	const timelineMoves = usingManual ? manualMoves : playMoves

	// Initialize/reinitialize board state when a new deal loads or context changes
	useEffect(() => {
		if (!hands) {
			setRemaining(null)
			setTally({ Spades: [], Hearts: [], Diamonds: [], Clubs: [] })
			setTrick([])
			setTurnSeat(null)
			setTricksDecl(0)
			setTricksDef(0)
			setPlayIdx(0)
			return
		}
		// Seed from hands; determine initial leader: Play tag, else right of declarer, else dealer
		const seed = {
			N: [...hands.N],
			E: [...hands.E],
			S: [...hands.S],
			W: [...hands.W],
		}
		setRemaining(seed)
		setTally({ Spades: [], Hearts: [], Diamonds: [], Clubs: [] })
		setTrick([])
		setTricksDecl(0)
		setTricksDef(0)
		const leaderFromDec = effDeclarer
			? rightOf(effDeclarer)
			: current?.dealer || 'N'
		setTurnSeat(current?.playLeader || leaderFromDec)
		setPlayIdx(0)
		// reset manual overrides when changing boards if the new board has contract/declarer
		if (current?.contract) {
			if (manualLevel || manualStrain || manualDbl) {
				// clear manual when PBN already has contract
				setManualLevel('')
				setManualStrain('')
				setManualDbl('')
			}
		}
		if (current?.declarer && manualDeclarer) setManualDeclarer('')
	}, [
		hands,
		effDeclarer,
		current?.declarer,
		current?.dealer,
		current?.playLeader,
		current?.contract,
	])

	// Apply timeline moves up to k cards, recomputing from the initial hands
	const applyMovesTo = useCallback(
		(k) => {
			if (!hands) return
			// cancel any pending winner flash when stepping
			if (flashTimerRef.current) {
				clearTimeout(flashTimerRef.current)
				flashTimerRef.current = null
			}
			resolvingRef.current = false
			setFlashWinner(null)
			const maxK = Math.max(0, Math.min(k, timelineMoves.length))
			const pauseAtEnd = maxK > 0 && maxK % 4 === 0
			const rem = {
				N: [...hands.N],
				E: [...hands.E],
				S: [...hands.S],
				W: [...hands.W],
			}
			const tl = { Spades: [], Hearts: [], Diamonds: [], Clubs: [] }
			const trickArr = []
			const trump = effTrump
			const dec = effDeclarer || null
			const leaderFromDec = dec ? rightOf(dec) : current?.dealer || 'N'
			let nextSeat = current?.playLeader || leaderFromDec
			let declTricks = 0
			let defTricks = 0
			let lastWinnerAtPause = null

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
				const mv = timelineMoves[i]
				const seatForMove = mv.seat || nextSeat
				const card = takeFromSeat(seatForMove, mv.suit, mv.rank)
				if (!card) break
				tl[card.suit] = [...tl[card.suit], card]
				trickArr.push({ seat: seatForMove, card })
				if (trickArr.length < 4) {
					nextSeat = rightOf(seatForMove)
				} else {
					const winner = evaluateTrick(trickArr, trump)
					if (winner) {
						if (dec) {
							if (isDeclarerSide(winner, dec)) declTricks++
							else defTricks++
						}
						nextSeat = winner
					}
					// If we're pausing at trick end (k is multiple of 4), keep the 4 cards visible
					// and remember the winner for highlighting; otherwise clear immediately.
					const isLastApplied = i === maxK - 1
					if (isLastApplied && pauseAtEnd) {
						lastWinnerAtPause = winner
						// keep trickArr as-is (length 4) so the UI shows the full trick
					} else {
						trickArr.length = 0
					}
				}
			}

			setRemaining(rem)
			setTally(tl)
			setTrick(trickArr)
			setTricksDecl(declTricks)
			setTricksDef(defTricks)
			setTurnSeat(nextSeat)
			// Highlight the winner when paused at the end of a trick; clear otherwise
			setFlashWinner(pauseAtEnd ? lastWinnerAtPause : null)
			setPlayIdx(maxK)
		},
		[
			hands,
			timelineMoves,
			effContract,
			effDeclarer,
			current?.dealer,
			current?.playLeader,
		]
	)

	// Keep a ref of playIdx for keyboard handler without depending on it
	useEffect(() => {
		playIdxRef.current = playIdx
	}, [playIdx])

	// Cleanup any pending flash timer when deal/context changes or unmounts
	useEffect(() => {
		return () => {
			if (flashTimerRef.current) {
				clearTimeout(flashTimerRef.current)
				flashTimerRef.current = null
			}
		}
	}, [])

	// Keyboard shortcuts for stepping (Left/Right arrows)
	useEffect(() => {
		const onKey = (e) => {
			const tag = String(e.target?.tagName || '').toLowerCase()
			if (
				tag === 'input' ||
				tag === 'textarea' ||
				tag === 'select' ||
				e.target?.isContentEditable
			)
				return
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
			if (e.key === 'ArrowLeft') {
				e.preventDefault()
				applyMovesTo(playIdxRef.current - 1)
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault()
				applyMovesTo(playIdxRef.current + 1)
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [applyMovesTo])
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
		// At the start of a new trick (0 or 4 cards in trick), there is no lead suit restriction
		const isNewTrick = trick.length === 0 || trick.length === 4
		const leadSuit = isNewTrick ? null : trick[0].card.suit
		const hasLead = leadSuit ? pool.some((c) => c.suit === leadSuit) : false
		if (leadSuit && hasLead && chosen.suit !== leadSuit) return

		// Guard against any malformed card
		const card = chosen
		if (!/^(A|K|Q|J|10|[2-9])$/.test(card.rank)) return

		// If playing manually (no PBN Play), record timeline move for stepping
		if (usingManual) {
			setManualMoves((prev) => [
				...prev,
				{ seat, suit: card.suit, rank: card.rank },
			])
			setPlayIdx((i) => i + 1)
		}
		setRemaining((prev) => ({
			...prev,
			[seat]: prev[seat].filter((c) => c.id !== cardId),
		}))
		setTally((prev) => ({
			...prev,
			[card.suit]: [...prev[card.suit], card],
		}))

		setTrick((prev) => {
			let nextTrick
			if (prev.length === 4) {
				// Start a new trick with this card; previous trick cleared already
				nextTrick = [{ seat, card }]
				setTurnSeat(rightOf(seat))
				lastTrickKeyRef.current = ''
				return nextTrick
			}
			nextTrick = [...prev, { seat, card }]
			if (nextTrick.length < 4) {
				setTurnSeat(rightOf(seat))
				return nextTrick
			}
			// Trick just completed with 4th card: determine winner, flash briefly, then clear center
			resolvingRef.current = true
			const winner = evaluateTrick(nextTrick, effTrump)
			const key = nextTrick
				.map((t) => `${t.seat}-${t.card.suit}-${t.card.rank}`)
				.join('|')
			if (lastTrickKeyRef.current === key) {
				// prevent double-processing the same 4-card trick (e.g., in dev double invoke)
				resolvingRef.current = false
				return []
			}
			lastTrickKeyRef.current = key
			if (winner) {
				setFlashWinner(winner)
				setTurnSeat(winner)
				if (effDeclarer) {
					const isDeclSide = isDeclarerSide(winner, effDeclarer)
					if (isDeclSide) setTricksDecl((n) => n + 1)
					else setTricksDef((n) => n + 1)
				}
			}
			// Delay clearing the center for a short flash
			if (flashTimerRef.current) {
				clearTimeout(flashTimerRef.current)
				flashTimerRef.current = null
			}
			flashTimerRef.current = setTimeout(() => {
				setTrick([])
				setFlashWinner(null)
				resolvingRef.current = false
				flashTimerRef.current = null
			}, 450)
			return nextTrick
		})
	}

	// Derived: step helper and result/score for completed hands
	const totalMoves = timelineMoves.length
	const stepHelper = totalMoves
		? (() => {
				const i = Math.max(0, Math.min(playIdx, totalMoves - 1))
				const mv = timelineMoves[i]
				return `Step ${i + 1}/${totalMoves}: ${mv.rank}${suitSymbol(mv.suit)}`
		  })()
		: 'Manual play'

	const result = useMemo(() => {
		if (!effContract || !effDeclarer) return null
		const completed = tricksDecl + tricksDef
		const remainingTricks = Math.max(0, 13 - completed)
		const isFinished = playIdx >= totalMoves
		// Prefer explicit Result from PBN when provided
		const declFromTag = Number.isFinite(current?.resultTricks)
			? current.resultTricks
			: null
		const assumedDecl =
			declFromTag != null
				? declFromTag
				: isFinished
				? tricksDecl + remainingTricks
				: null
		if (assumedDecl == null) return { partial: true }
		const vul = isSeatVul(effDeclarer, current.vul)
		return computeDuplicateScore(effContract, effDeclarer, vul, assumedDecl)
	}, [
		playIdx,
		totalMoves,
		tricksDecl,
		tricksDef,
		effContract,
		effDeclarer,
		current?.vul,
		current?.resultTricks,
	])

	// Build trick history up to current index (completed tricks + optional partial)
	const trickHistory = useMemo(() => {
		const k = Math.max(0, Math.min(playIdx, timelineMoves.length))
		if (k === 0) return []
		const rounds = []
		const trump = effTrump
		const dec = effDeclarer
		const leaderFromDec = dec ? rightOf(dec) : current?.dealer || 'N'
		let nextSeat = current?.playLeader || leaderFromDec
		let cur = []
		for (let i = 0; i < k; i++) {
			const mv = timelineMoves[i]
			const seat = mv.seat || nextSeat
			cur.push({ seat, suit: mv.suit, rank: mv.rank })
			if (cur.length < 4) {
				nextSeat = rightOf(seat)
			} else {
				const winner = evaluateTrick(
					cur.map((x) => ({
						seat: x.seat,
						card: { suit: x.suit, rank: x.rank },
					})),
					trump
				)
				rounds.push({ cards: cur, winner })
				nextSeat = winner
				cur = []
			}
		}
		// include partial trick if any
		if (cur.length > 0) rounds.push({ cards: cur, winner: null })
		return rounds
	}, [
		playIdx,
		timelineMoves,
		effContract,
		effDeclarer,
		current?.dealer,
		current?.playLeader,
	])
	const derivedCounts = useMemo(() => {
		if (!effDeclarer) return { decl: tricksDecl, def: tricksDef }
		let decl = 0
		let def = 0
		for (const r of trickHistory) {
			if (!r.winner) continue
			if (isDeclarerSide(r.winner, effDeclarer)) decl++
			else def++
		}
		return { decl, def }
	}, [trickHistory, effDeclarer, tricksDecl, tricksDef])
	return (
		<div className="w-full flex flex-col items-center">
			{teacherMode ? (
				<div className="pointer-events-none fixed inset-0 z-10 bg-black/80" />
			) : null}
			<div className="relative z-20 w-full max-w-5xl">
				{!teacherMode ? (
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
							{effContract
								? ` • Contract: ${effContract}${
										effDeclarer ? ` (${effDeclarer})` : ''
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
						{validatedAuction?.legal ? (
							<button
								onClick={() => setAuctionRevealed((v) => !v)}
								className={`px-2.5 py-1 rounded border text-sm font-semibold ${
									auctionRevealed
										? 'bg-white text-gray-800 border-gray-300'
										: 'bg-violet-600 text-white border-violet-700'
								}`}
								title={auctionRevealed ? 'Hide auction' : 'Reveal the auction'}>
								{auctionRevealed ? 'Hide Auction' : 'Reveal Auction'}
							</button>
						) : null}
						<button
							onClick={() => setTeacherMode((v) => !v)}
							className={`${
								teacherMode
									? 'bg-rose-600 text-white border-rose-700'
									: 'bg-white text-gray-800 border-gray-300'
							} px-2.5 py-1 rounded border text-sm font-semibold`}
							title={
								teacherMode ? 'Disable teacher focus' : 'Enable teacher focus'
							}>
							{teacherMode ? 'Teacher Focus: ON' : 'Teacher Focus'}
						</button>
					</div>
				) : null}

				{/* Floating exit for Teacher Focus */}
				{teacherMode ? (
					<button
						onClick={() => setTeacherMode(false)}
						className="fixed top-2 right-2 z-30 px-2 py-1 rounded bg-rose-600 text-white text-xs shadow"
						title="Exit teacher focus">
						Exit Focus
					</button>
				) : null}

				{/* Metadata panel (hidden in Teacher Focus) */}
				{!teacherMode ? (
					<MetaPanel
						current={current}
						effContract={effContract}
						effDeclarer={effDeclarer}
					/>
				) : null}

				{!teacherMode &&
					hideDefenders &&
					turnSeat &&
					isDefender(turnSeat, effDeclarer) && (
						<div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
							Defender's turn is hidden — unhide defenders to choose a card.
						</div>
					)}

				{validatedAuction?.legal && auctionRevealed && !teacherMode ? (
					<AuctionView
						dealer={current.auctionDealer || current.dealer}
						calls={current.auction}
						finalContract={effContract}
					/>
				) : null}

				{/* Manual contract/declarer controls when missing in PBN */}
				{!teacherMode && !current?.contract ? (
					<div className="mb-2 rounded border bg-white p-2 text-xs text-gray-700 flex flex-wrap items-center gap-2">
						<span className="font-semibold">Set contract:</span>
						<label className="flex items-center gap-1">
							Declarer
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
						<label className="flex items-center gap-1">
							Level
							<select
								className="border rounded px-1 py-0.5"
								value={manualLevel}
								onChange={(e) => setManualLevel(e.target.value)}>
								<option value="">—</option>
								{['1', '2', '3', '4', '5', '6', '7'].map((lv) => (
									<option key={lv} value={lv}>
										{lv}
									</option>
								))}
							</select>
						</label>
						<label className="flex items-center gap-1">
							Trumps
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
						<label className="flex items-center gap-1">
							Dbl
							<select
								className="border rounded px-1 py-0.5"
								value={manualDbl}
								onChange={(e) => setManualDbl(e.target.value)}>
								<option value="">—</option>
								<option value="X">X</option>
								<option value="XX">XX</option>
							</select>
						</label>
						<button
							onClick={() => {
								// Reset manual timeline and reinitialize board state
								setManualMoves([])
								setTricksDecl(0)
								setTricksDef(0)
								setTrick([])
								// Reset remaining hands and tally
								if (hands) {
									setRemaining({
										N: [...hands.N],
										E: [...hands.E],
										S: [...hands.S],
										W: [...hands.W],
									})
								}
								setTally({ Spades: [], Hearts: [], Diamonds: [], Clubs: [] })
								setPlayIdx(0)
								// set initial leader from declarer if available, else dealer
								const leaderFromDec =
									manualDeclarer || current?.declarer
										? rightOf(manualDeclarer || current?.declarer)
										: current?.dealer || 'N'
								setTurnSeat(current?.playLeader || leaderFromDec)
							}}
							className="ml-2 px-2 py-0.5 rounded border bg-white hover:bg-gray-50">
							Start again
						</button>
					</div>
				) : null}

				{/* Trick panel will be placed below South inside the PlayerLayout */}

				{/* Card tally (four columns per trick, in play order) */}
				{!teacherMode && trickHistory.length ? (
					<div className="mt-2 rounded-lg border bg-white p-2 w-full max-w-[820px] text-xs text-gray-700">
						<div className="font-semibold mb-1">Card tally</div>
						<div className="flex flex-col gap-1">
							{trickHistory.map((t, i) => {
								// Ensure exactly four columns; pad with blanks for partial tricks
								const cols = [0, 1, 2, 3].map((idx) => t.cards[idx] || null)
								return (
									<div key={`ct-${i}`} className="grid grid-cols-4 gap-2">
										{cols.map((c, j) => {
											if (!c)
												return (
													<span key={`ct-${i}-${j}`} className="text-gray-400">
														—
													</span>
												)
											const token = `${c.rank}${suitLetter(c.suit)}`
											const isWin = t.winner && c.seat === t.winner
											return (
												<span
													key={`ct-${i}-${j}`}
													className={isWin ? 'font-bold' : ''}>
													{token}
												</span>
											)
										})}
									</div>
								)
							})}
						</div>
					</div>
				) : null}

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
						declarer={effDeclarer}
						contract={effContract}
						players={current?.players || {}}
						result={result}
						turnSeat={turnSeat}
						trick={trick}
						tally={tally}
						tricksDecl={derivedCounts.decl}
						tricksDef={derivedCounts.def}
						neededToSet={neededToSet(effContract)}
						teacherMode={teacherMode}
						flashWinner={flashWinner}
						// Center/stepper props
						totalMoves={totalMoves}
						helperText={stepHelper}
						idx={playIdx}
						onPrev={() => applyMovesTo(playIdxRef.current - 1)}
						onNext={() => applyMovesTo(playIdxRef.current + 1)}
						resultTag={current?.resultTricks}
						finishedBanner={
							result && !result.partial
								? `${result.resultText} • Score ${result.score > 0 ? '+' : ''}${
										result.score
								  }`
								: null
						}
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
	teacherMode,
	flashWinner,
	// Center/stepper props
	totalMoves = 0,
	helperText = 'Manual play',
	idx = 0,
	onPrev,
	onNext,
	resultTag,
	finishedBanner,
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
	const completedTricks = tricksDecl + tricksDef
	return (
		<div className="w-full flex flex-col items-stretch gap-2">
			<div className="w-full flex items-start justify-center gap-3">
				{/* Left margin: suit tally only */}
				<div className="w-44 hidden md:flex flex-col gap-2">
					{showSuitTally && <SuitTally tally={tally} />}
				</div>
				{/* Center cross grid with compact spacing */}
				<div className="flex-1">
					<div className="grid grid-cols-3 gap-x-6 gap-y-0 items-center justify-items-center">
						{/* Top (North) */}
						<div />
						<div>
							<SeatPanel
								id="N"
								remaining={remaining}
								onPlay={onPlay}
								visible={visible.includes('N')}
								dealer={dealer}
								vulnerable={vulnerable}
								turnSeat={turnSeat}
								trick={trick}
								declarer={declarer}
								playerName={players['N']}
								showHcpWhenHidden={showHcpWhenHidden}
								teacherMode={teacherMode}
							/>
						</div>
						<div />
						{/* Middle row: West | (empty) | East */}
						<div className="justify-self-end mr-2">
							<SeatPanel
								id="W"
								remaining={remaining}
								onPlay={onPlay}
								visible={visible.includes('W')}
								dealer={dealer}
								vulnerable={vulnerable}
								turnSeat={turnSeat}
								trick={trick}
								declarer={declarer}
								playerName={players['W']}
								showHcpWhenHidden={showHcpWhenHidden}
								teacherMode={teacherMode}
							/>
						</div>
						<div />
						<div className="justify-self-start ml-2">
							<SeatPanel
								id="E"
								remaining={remaining}
								onPlay={onPlay}
								visible={visible.includes('E')}
								dealer={dealer}
								vulnerable={vulnerable}
								turnSeat={turnSeat}
								trick={trick}
								declarer={declarer}
								playerName={players['E']}
								showHcpWhenHidden={showHcpWhenHidden}
								teacherMode={teacherMode}
							/>
						</div>
						{/* Bottom (South) */}
						<div />
						<div>
							<SeatPanel
								id="S"
								remaining={remaining}
								onPlay={onPlay}
								visible={visible.includes('S')}
								dealer={dealer}
								vulnerable={vulnerable}
								turnSeat={turnSeat}
								trick={trick}
								declarer={declarer}
								playerName={players['S']}
								showHcpWhenHidden={showHcpWhenHidden}
								teacherMode={teacherMode}
							/>
						</div>
						<div />
					</div>
					{/* Trick panel placement: above North in teacher mode, below South otherwise */}
					{teacherMode ? (
						<div className="col-span-3 flex items-center justify-center mb-2">
							<CurrentTrick
								teacherMode={teacherMode}
								trick={trick}
								turnSeat={turnSeat}
								winnerSeat={flashWinner}
								hasPlay={!!totalMoves}
								totalMoves={totalMoves}
								helperText={helperText}
								idx={idx}
								onPrev={onPrev}
								onNext={onNext}
								resultTag={resultTag}
								completedTricks={completedTricks}
								finishedBanner={finishedBanner}
							/>
						</div>
					) : (
						<div className="flex items-center justify-center mt-3">
							<CurrentTrick
								teacherMode={teacherMode}
								trick={trick}
								turnSeat={turnSeat}
								winnerSeat={flashWinner}
								hasPlay={!!totalMoves}
								totalMoves={totalMoves}
								helperText={helperText}
								idx={idx}
								onPrev={onPrev}
								onNext={onNext}
								resultTag={resultTag}
								completedTricks={completedTricks}
								finishedBanner={finishedBanner}
							/>
						</div>
					)}
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

function SuitTally({ tally }) {
	if (!tally) return null
	const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
	const color = (s) =>
		s === 'Hearts' || s === 'Diamonds' ? 'text-red-600' : 'text-black'
	const sym = (s) =>
		s === 'Spades' ? '♠' : s === 'Hearts' ? '♥' : s === 'Diamonds' ? '♦' : '♣'
	return (
		<div className="rounded border bg-white p-2">
			<div className="text-[11px] text-gray-600 mb-1">Played</div>
			<div className="flex flex-col gap-1">
				{suits.map((s) => (
					<div
						key={`tally-${s}`}
						className="flex items-center justify-between text-xs">
						<span className={`font-semibold ${color(s)}`}>{sym(s)}</span>
						<span className="text-gray-700">{tally[s]?.length || 0}</span>
					</div>
				))}
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
	teacherMode,
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
					? 'border-red-600'
					: 'border-gray-300'
			} ${
				teacherMode
					? isTurn
						? 'relative z-20 bg-white ring-2 ring-rose-400 shadow-lg'
						: 'relative z-10 bg-white/95 ring-1 ring-slate-300'
					: 'bg-white'
			} ${teacherMode && !isTurn ? 'opacity-90' : ''} w-48`}>
			<div
				className={`w-full ${
					isDealer
						? 'bg-amber-100 text-amber-900'
						: isTurn
						? 'bg-red-100 text-red-900'
						: teacherMode
						? 'bg-gray-50 text-gray-700'
						: 'bg-gray-100 text-gray-800'
				} font-extrabold text-[10px] tracking-widest uppercase px-1.5 py-1 flex items-center justify-between`}>
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
							className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 text-[8px] rounded-full bg-amber-500 text-white">
							D
						</span>
					)}
				</span>
				<span className="flex items-center gap-1">
					{isTurn && (
						<span className="text-[9px] font-bold text-white bg-red-600 rounded px-0.5 py-0.5">
							{seatFullName(id)} to play
						</span>
					)}
					{seatIsVul && (
						<span className="text-[8px] font-bold text-red-700 bg-red-100 border border-red-200 rounded px-0.5 py-0.5">
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
						<span className="text-[9px] opacity-80">HCP {hcp}</span>
					)}
					<span className="text-[9px] opacity-80">{bySeat.length}/13</span>
				</span>
			</div>
			<div className="h-40 p-2 flex flex-col gap-1.5 items-stretch justify-center">
				{suitOrder.map((suit) => (
					<div key={`${id}-${suit}`} className="flex items-center gap-3 flex-1">
						<div
							className={`w-6 text-center text-lg leading-none ${suitText[suit]}`}>
							{suit === 'Clubs'
								? '♣'
								: suit === 'Diamonds'
								? '♦'
								: suit === 'Hearts'
								? '♥'
								: '♠'}
						</div>
						<div className="flex-1 text-xs md:text-sm leading-none flex flex-wrap gap-1">
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
				<div className="px-1.5 pb-1.5 pt-0.5 text-[9px] text-gray-500 truncate">
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
	teacherMode = false,
	trick,
	turnSeat,
	winnerSeat,
	hasPlay,
	totalMoves = 0,
	helperText = 'Manual play',
	idx = 0,
	onPrev,
	onNext,
	finishedBanner,
	resultTag,
	completedTricks,
}) {
	const order = ['N', 'E', 'S', 'W']
	const items = Array.isArray(trick) ? trick : []
	const safeIdx = Math.min(Math.max(0, idx), Math.max(0, totalMoves - 1))
	const helper = helperText
	const completed =
		typeof completedTricks === 'number'
			? completedTricks
			: hasPlay
			? Math.floor(idx / 4)
			: 0
	return (
		<div
			className={`mt-2 rounded-xl border p-2 w-full max-w-[820px] ${
				teacherMode
					? 'relative z-20 bg-white shadow-lg ring-2 ring-rose-200'
					: 'bg-white'
			}`}>
			<div className="flex items-center justify-between">
				<button
					onClick={onPrev}
					disabled={safeIdx === 0}
					className="px-2 py-1 rounded border text-xs disabled:opacity-40">
					← Prev
				</button>
				<div className="flex-1 px-2">
					<div className="text-[11px] text-center text-gray-600">{helper}</div>
					<div className="grid grid-cols-4 gap-2 place-items-center mt-1">
						{order.map((seat) => {
							const isTurn = turnSeat === seat
							return (
								<div
									key={`ctl-${seat}`}
									className={`text-center text-[9px] font-semibold ${
										isTurn ? 'text-red-600' : 'text-gray-500'
									}`}>
									{seat} {isTurn ? '•' : ''}
								</div>
							)
						})}
						{order.map((seat) => {
							const t = items.find((x) => x.seat === seat)
							const isTurn = turnSeat === seat
							const isWinner =
								winnerSeat && seat === winnerSeat && items.length === 4
							const base = teacherMode
								? isTurn
									? 'border-red-500 ring-2 ring-rose-400 bg-gradient-to-br from-white to-rose-50'
									: 'border-slate-200 bg-gradient-to-br from-white to-slate-50'
								: isTurn
								? 'border-red-400 bg-red-50'
								: 'bg-[#FFF8E7]'
							const winnerClass = isWinner
								? ' ring-2 ring-emerald-400 border-emerald-500'
								: ''
							return (
								<div
									key={`ct-${seat}`}
									className={`w-12 h-12 rounded-lg border flex items-center justify-center ${base}${winnerClass}`}>
									{t ? (
										<div
											className={`${
												t.card.suit === 'Hearts' || t.card.suit === 'Diamonds'
													? 'text-red-600'
													: 'text-black'
											} text-lg font-extrabold`}>
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
				<button
					onClick={onNext}
					disabled={safeIdx >= totalMoves - 1}
					className="px-1.5 py-0.5 rounded border text-[11px] disabled:opacity-40">
					Next →
				</button>
			</div>
			<div className="mt-0.5 text-[10px] text-center text-gray-500">
				{totalMoves > 0 ? `${safeIdx + 1}/${totalMoves}` : '—'} · Completed
				tricks: <span className="font-semibold">{Math.max(0, completed)}</span>
			</div>
			{finishedBanner ? (
				<div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
					{finishedBanner}
				</div>
			) : null}
			{resultTag != null && idx < totalMoves ? (
				<div className="mt-2 text-[11px] text-sky-700 bg-sky-50 border border-sky-200 rounded px-2 py-1">
					Result tag present: final tricks by declarer = {resultTag}. Play may
					be truncated in the PBN.
				</div>
			) : null}
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
		const [s, h, d, c] = seg.split('.').map((x) => (x && x !== '-' ? x : ''))
		const parseSuit = (suitName, str) =>
			Array.from(str)
				.map((ch) => ch.toUpperCase())
				.filter((ch) => /^(?:[AKQJT2-9])$/.test(ch))
				.map((ch) => ({
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

// Parse PBN Play lines into chronological seat-aware moves.
// Handles BridgePlaza-style fixed-seat order per trick line (W N E S), rotating per leader.
function parsePlayMoves(playLeader, lines, contract) {
	const fixedSeats = ['W', 'N', 'E', 'S']
	const rotateFromLeader = (leader) => {
		const base = ['N', 'E', 'S', 'W']
		const i = base.indexOf(leader || 'N')
		return [base[i], base[(i + 1) % 4], base[(i + 2) % 4], base[(i + 3) % 4]]
	}
	const parseToken = (tok) => {
		const t = String(tok || '').replace(/[.,;]$/g, '')
		if (!t || t === '-' || t === '*') return null
		// Skip seat markers like N:, E:, etc.
		if (/^[NESW]:?$/i.test(t)) return null
		let m = t.match(/^([SHDC])(?::)?(10|[AKQJT2-9])$/i)
		if (m) return { suit: suitName(m[1]), rank: normalizeRank(m[2]) }
		const m2 = t.match(/^([SHDC]):$/i)
		if (m2) return { suit: suitName(m2[1]), rank: null }
		const m3 = t.match(/^([SHDC])[-](10|[AKQJT2-9])$/i)
		if (m3) return { suit: suitName(m3[1]), rank: normalizeRank(m3[2]) }
		const m4 = t.match(/^([SHDC])$/i)
		if (m4) return { suit: suitName(m4[1]), rank: null }
		if (/^(10|[AKQJT2-9])$/i.test(t))
			return { suit: null, rank: normalizeRank(t) }
		return null
	}
	const trump = parseTrump(contract)
	let leader = playLeader || 'N'
	const out = []
	let carry = [] // tokens in fixed seat order groups of 4
	const flushCarry = () => {
		while (carry.length >= 4) {
			const seatsChrono = rotateFromLeader(leader)
			const group = carry.slice(0, 4)
			const trickCards = []
			for (let j = 0; j < 4; j++) {
				const seat = seatsChrono[j]
				const idxFixed = fixedSeats.indexOf(seat)
				const tok = group[idxFixed]
				if (!tok) continue
				out.push({ seat, suit: tok.suit, rank: tok.rank })
				trickCards.push({ seat, card: { suit: tok.suit, rank: tok.rank } })
			}
			if (trickCards.length === 4) {
				const winner = evaluateTrick(trickCards, trump)
				leader = winner
			}
			carry = carry.slice(4)
		}
	}
	for (const raw of lines) {
		const line = (raw || '').replace(/([;%].*)$/g, '').trim()
		if (!line) continue
		const parts = line.split(/\s+/).filter(Boolean)
		if (!parts.length) continue
		let pendingSuit = null
		for (let i = 0; i < parts.length; i++) {
			const tok = parseToken(parts[i])
			if (!tok) continue
			if (tok.suit && tok.rank) {
				carry.push({ suit: tok.suit, rank: tok.rank })
				continue
			}
			if (tok.suit && !tok.rank) {
				pendingSuit = tok.suit
				continue
			}
			if (!tok.suit && tok.rank && pendingSuit) {
				carry.push({ suit: pendingSuit, rank: tok.rank })
				pendingSuit = null
				continue
			}
		}
		flushCarry()
	}
	if (carry.length > 0) {
		const seatsChrono = rotateFromLeader(leader)
		for (let j = 0; j < 4; j++) {
			const seat = seatsChrono[j]
			const idxFixed = fixedSeats.indexOf(seat)
			if (idxFixed < carry.length) {
				const tok = carry[idxFixed]
				out.push({ seat, suit: tok.suit, rank: tok.rank })
			} else break
		}
	}
	return out
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

// Short suit letter for trick history (S, H, D, C)
function suitLetter(suit) {
	return suit === 'Spades'
		? 'S'
		: suit === 'Hearts'
		? 'H'
		: suit === 'Diamonds'
		? 'D'
		: 'C'
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
	if (!Array.isArray(trickArr) || trickArr.length === 0) return null
	const leadSuit = trickArr[0].card.suit
	const inTrump = trumpSuit
		? trickArr.filter((p) => p.card.suit === trumpSuit)
		: []
	const pool = inTrump.length
		? inTrump
		: trickArr.filter((p) => p.card.suit === leadSuit)
	let best = pool[0]
	for (let i = 1; i < pool.length; i++) {
		if (rankValue(pool[i].card.rank) > rankValue(best.card.rank)) best = pool[i]
	}
	return best.seat
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

// Validate an auction sequence: ensure legal progression and end condition; derive final contract and declarer.
function validateAuction(dealer, calls) {
	const seats = ['N', 'E', 'S', 'W']
	const startIdx = seats.indexOf(dealer || 'N')
	const seatFor = (i) => seats[(startIdx + i) % 4]
	const isPass = (c) => /^P(ASS)?$/i.test(c)
	const isX = (c) => /^X$/i.test(c)
	const isXX = (c) => /^XX$/i.test(c)
	const bidRe = /^([1-7])(C|D|H|S|NT)$/i
	let lastBid = null
	let lastBidder = null
	let lastDblBy = null
	let lastXXBy = null
	const history = []
	for (let i = 0; i < calls.length; i++) {
		const call = calls[i]
		const seat = seatFor(i)
		if (bidRe.test(call)) {
			const m = call.toUpperCase().match(bidRe)
			const level = parseInt(m[1], 10)
			const strain = m[2]
			// must overcall the last bid
			if (lastBid) {
				const [prevLevel, prevStrain] = lastBid
				const ord = ['C', 'D', 'H', 'S', 'NT']
				const prevIdx = ord.indexOf(prevStrain)
				const curIdx = ord.indexOf(strain)
				const higher =
					level > prevLevel || (level === prevLevel && curIdx > prevIdx)
				if (!higher) return { legal: false }
			}
			lastBid = [level, strain]
			lastBidder = seat
			lastDblBy = null
			lastXXBy = null
			history.push({ seat, type: 'bid', level, strain })
			continue
		}
		if (isX(call)) {
			// double allowed only if opponents made last bid and no outstanding double on that bid
			if (!lastBid || !lastBidder) return { legal: false }
			const oppTeam = (s) => seats.indexOf(s) % 2
			if (oppTeam(seat) === oppTeam(lastBidder)) return { legal: false }
			if (lastDblBy) return { legal: false }
			lastDblBy = seat
			lastXXBy = null
			history.push({ seat, type: 'X' })
			continue
		}
		if (isXX(call)) {
			// redouble allowed only if partner was doubled and not already redoubled
			if (!lastDblBy) return { legal: false }
			const sameTeam = (a, b) => seats.indexOf(a) % 2 === seats.indexOf(b) % 2
			if (!sameTeam(seat, lastBidder)) return { legal: false }
			if (lastXXBy) return { legal: false }
			lastXXBy = seat
			history.push({ seat, type: 'XX' })
			continue
		}
		if (isPass(call)) {
			history.push({ seat, type: 'P' })
			continue
		}
		// unknown call
		return { legal: false }
	}
	// Determine ending: needs a final bid followed by three passes
	const callsUp = calls.map((c) => c.toUpperCase())
	const lastBidIdx = [...callsUp]
		.map((c, i) => (bidRe.test(c) ? i : -1))
		.filter((i) => i >= 0)
		.pop()
	if (lastBidIdx == null) return { legal: false }
	if (
		!(
			callsUp[lastBidIdx + 1] === 'PASS' &&
			callsUp[lastBidIdx + 2] === 'PASS' &&
			callsUp[lastBidIdx + 3] === 'PASS'
		)
	) {
		return { legal: false }
	}
	const m = calls[lastBidIdx].toUpperCase().match(bidRe)
	const level = parseInt(m[1], 10)
	const strain = m[2]
	const dbl = callsUp.slice(lastBidIdx + 1).includes('XX')
		? 'XX'
		: callsUp.slice(lastBidIdx + 1).includes('X')
		? 'X'
		: ''
	const contract = `${level}${strain}${dbl}`
	// declarer is first player of the declaring side who bid the final strain
	const declaringTeam = seats.indexOf(lastBidder) % 2
	let declarer = null
	for (let i = 0; i <= lastBidIdx; i++) {
		const c = calls[i]
		if (bidRe.test(c)) {
			const mm = c.toUpperCase().match(bidRe)
			if (mm[2] === strain) {
				const seat = seatFor(i)
				if (seats.indexOf(seat) % 2 === declaringTeam) {
					declarer = seat
					break
				}
			}
		}
	}
	return { legal: true, contract, declarer }
}

// Parse a PlayScript string into chronological seat-aware moves.
function parsePlayScript(text) {
	// Expected lines like "W: S4" or "N: HA" or suit-first notation similar to Play
	const lines = String(text || '').split(/\n/)
	const out = []
	const parse = (tok) => {
		const t = String(tok || '').trim()
		if (!t) return null
		const m = t.match(/^([SHDC])\s*(10|[AKQJT2-9])$/i)
		if (m) return { suit: suitName(m[1]), rank: normalizeRank(m[2]) }
		const m2 = t.match(/^([SHDC])[-:](10|[AKQJT2-9])$/i)
		if (m2) return { suit: suitName(m2[1]), rank: normalizeRank(m2[2]) }
		return null
	}
	let leader = null
	for (const raw of lines) {
		const s = raw.replace(/([;%].*)$/g, '').trim()
		if (!s) continue
		const mm = s.match(/^([NESW])\s*:\s*(.+)$/i)
		if (!mm) continue
		const seat = mm[1].toUpperCase()
		const rest = mm[2]
		const parts = rest.split(/\s+/).filter(Boolean)
		for (const p of parts) {
			const token = parse(p)
			if (token) {
				out.push({ seat, suit: token.suit, rank: token.rank })
				if (!leader) leader = seat
			}
		}
	}
	return out
}

