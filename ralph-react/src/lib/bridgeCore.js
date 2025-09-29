// Core bridge logic extracted from Player.jsx
// Provides seat utilities, parsing helpers, scoring, and trick evaluation.

export const SEATS = ['N', 'E', 'S', 'W']

export function rightOf(seat) {
	return SEATS[(SEATS.indexOf(seat) + 1) % 4]
}
export function partnerOf(seat) {
	return SEATS[(SEATS.indexOf(seat) + 2) % 4]
}
export function isDefender(seat, declarer) {
	if (!declarer) return false
	const opp = partnerOf(declarer)
	return seat !== declarer && seat !== opp
}
// Returns true if the seat belongs to declarer's partnership
export function isDeclarerSide(seat, declarer) {
    if (!declarer) return false
    const p = partnerOf(declarer)
    return seat === declarer || seat === p
}
export function hcpValue(rank) {
	if (rank === 'A') return 4
	if (rank === 'K') return 3
	if (rank === 'Q') return 2
	if (rank === 'J') return 1
	return 0
}
export function suitName(letter) {
	const L = String(letter).toUpperCase()
	return L === 'S'
		? 'Spades'
		: L === 'H'
		? 'Hearts'
		: L === 'D'
		? 'Diamonds'
		: 'Clubs'
}
export function normalizeRank(r) {
	return r === 'T' ? '10' : r.toUpperCase()
}
export function parseTrump(contract) {
	if (!contract) return null
	const up = String(contract).toUpperCase().replace(/X+$/, '')
	if (up.includes('NT')) return null
	if (up.endsWith('S')) return 'Spades'
	if (up.endsWith('H')) return 'Hearts'
	if (up.endsWith('D')) return 'Diamonds'
	if (up.endsWith('C')) return 'Clubs'
	return null
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
export function evaluateTrick(trickArr, trumpSuit) {
	if (!Array.isArray(trickArr) || trickArr.length === 0) return null
	const leadSuit = trickArr[0].card.suit
	// If any trump cards were played, only they can win; otherwise use lead suit cards
	let pool = []
	if (trumpSuit) {
		const trumpsPlayed = trickArr.filter(p => p.card.suit === trumpSuit)
		if (trumpsPlayed.length) pool = trumpsPlayed
	}
	if (!pool.length) pool = trickArr.filter(p => p.card.suit === leadSuit)
	if (!pool.length) return null
	let best = pool[0]
	for (let i = 1; i < pool.length; i++) {
		if (rankValue(pool[i].card.rank) > rankValue(best.card.rank)) best = pool[i]
	}
	return best.seat
}

// Debug helper: capture a lightweight snapshot of a trick for logging
export function debugTrickSnapshot(trickArr) {
	if (!Array.isArray(trickArr)) return []
	return trickArr.map(t => `${t.seat}:${t.card.rank}${t.card.suit[0]}`)
}
export function dealToHands(dealStr) {
	const m = String(dealStr || '').match(/^([NESW]):\s*(.+)$/)
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
export function computeDuplicateScore(contract, declarer, vul, declTricks) {
	if (!contract) return { partial: true }
	const m = String(contract)
		.toUpperCase()
		.match(/^(\d)(C|D|H|S|NT)(X{0,2})?$/)
	if (!m) return { partial: true }
	const level = parseInt(m[1], 10)
	const strain = m[2]
	const dbl = m[3] || ''
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
		return n * (isNT || isMajor ? 30 : 20)
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
			return 400 + (n - 1) * 400
		}
		if (!vul) {
			if (n === 1) return 100
			if (n === 2) return 300
			return 300 + (n - 2) * 300
		}
		return 200 + (n - 1) * 300
	}
	let score = 0
	let resultText = ''
	if (made >= 0) {
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
export function neededToSet(contract) {
	if (!contract) return 0
	const m = String(contract).match(/^(\d)/)
	if (!m) return 0
	const level = parseInt(m[1], 10)
	if (!level) return 0
	return Math.max(0, 8 - level)
}
// Determine if a specific seat is vulnerable given a vulnerability string ("None", "All", "NS", "EW")
export function isSeatVul(seat, vul) {
	const v = String(vul || '').toUpperCase()
	if (v === 'ALL') return true
	if (v === 'NONE' || v === '') return false
	if (v === 'NS') return seat === 'N' || seat === 'S'
	if (v === 'EW') return seat === 'E' || seat === 'W'
	return false
}
export function validateAuction(dealer, calls) {
	const seats = ['N', 'E', 'S', 'W']
	const startIdx = seats.indexOf(dealer || 'N')
	const seatFor = (i) => seats[(startIdx + i) % 4]
	const isPass = (c) => /^P(ASS)?$/i.test(c)
	const isX = (c) => /^X$/i.test(c)
	const isXX = (c) => /^XX$/i.test(c)
	const bidRe = /^([1-7])(C|D|H|S|NT)$/i
	let lastBid = null,
		lastBidder = null,
		lastDblBy = null,
		lastXXBy = null
	for (let i = 0; i < calls.length; i++) {
		const call = calls[i]
		const seat = seatFor(i)
		if (bidRe.test(call)) {
			const m = call.toUpperCase().match(bidRe)
			const level = parseInt(m[1], 10)
			const strain = m[2]
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
			continue
		}
		if (isX(call)) {
			if (!lastBid || !lastBidder) return { legal: false }
			const oppTeam = (s) => seats.indexOf(s) % 2
			if (oppTeam(seat) === oppTeam(lastBidder)) return { legal: false }
			if (lastDblBy) return { legal: false }
			lastDblBy = seat
			lastXXBy = null
			continue
		}
		if (isXX(call)) {
			if (!lastDblBy) return { legal: false }
			const sameTeam = (a, b) => seats.indexOf(a) % 2 === seats.indexOf(b) % 2
			if (!sameTeam(seat, lastBidder)) return { legal: false }
			if (lastXXBy) return { legal: false }
			lastXXBy = seat
			continue
		}
		if (isPass(call)) continue
		return { legal: false }
	}
	const callsUp = calls.map((c) => String(c).toUpperCase())
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
	)
		return { legal: false }
	const mm = calls[lastBidIdx].toUpperCase().match(bidRe)
	const level = parseInt(mm[1], 10)
	const strain = mm[2]
	const dbl = callsUp.slice(lastBidIdx + 1).includes('XX')
		? 'XX'
		: callsUp.slice(lastBidIdx + 1).includes('X')
		? 'X'
		: ''
	const contract = `${level}${strain}${dbl}`
	const declaringTeam = seats.indexOf(lastBidder) % 2
	let declarer = null
	for (let i = 0; i <= lastBidIdx; i++) {
		const c = calls[i]
		if (bidRe.test(c)) {
			const t = c.toUpperCase().match(bidRe)
			if (t[2] === strain) {
				const s = seatFor(i)
				if (seats.indexOf(s) % 2 === declaringTeam) {
					declarer = s
					break
				}
			}
		}
	}
	return { legal: true, contract, declarer }
}
export function parsePlayMoves(playLeader, lines, contract) {
	const fixedSeats = ['W', 'N', 'E', 'S']
	const rotateFromLeader = (leader) => {
		const base = ['N', 'E', 'S', 'W']
		const i = base.indexOf(leader || 'N')
		return [base[i], base[(i + 1) % 4], base[(i + 2) % 4], base[(i + 3) % 4]]
	}
	const parseToken = (tok) => {
		const t = String(tok || '').replace(/[.,;]$/g, '')
		if (!t || t === '-' || t === '*') return null
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
	let carry = []
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
	for (const raw of lines || []) {
		const line = String(raw || '')
			.replace(/([;%].*)$/g, '')
			.trim()
		if (!line) continue
		const parts = line.split(/\s+/).filter(Boolean)
		let pendingSuit = null
		for (const p of parts) {
			const tok = parseToken(p)
			if (!tok) continue
			if (tok.suit && tok.rank) {
				carry.push(tok)
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
			const idx = fixedSeats.indexOf(seat)
			if (idx < carry.length) {
				const tok = carry[idx]
				out.push({ seat, suit: tok.suit, rank: tok.rank })
			} else break
		}
	}
	return out
}
export function parsePlayScript(text) {
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
			if (token) out.push({ seat, suit: token.suit, rank: token.rank })
		}
	}
	return out
}

