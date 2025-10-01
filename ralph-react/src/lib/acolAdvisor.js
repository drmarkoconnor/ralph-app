// Deterministic in-app ACOL auction advisor (v2)
// Implements simplified, interference-free ACOL style per spec:
//  - Seat cycling starts at dealer and rotates N-E-S-W until stop condition.
//  - Stop rule: auction ends after any bid followed by three consecutive passes.
//  - No opponent interference (only natural passes outside opener/responder logic).
//  - Generates ONE mainline auction plus up to TWO alternatives with probabilities.
//  - Bullets limited to ≤3 concise factual lines tied to HCP / fit / plan.
//  - Uses Unicode suit symbols in output (♠ ♥ ♦ ♣) and NT.
//  - Deterministic via deal hash seeded LCG (only used for tie-breaking alt ordering).
// Public: buildAcolAdvice(deal)
// deal: { number, dealer, vul, hands: {N:[],E:[],S:[],W:[]} }

function computeDealHash(hands) {
	try {
		const seats = ['N', 'E', 'S', 'W']
		const parts = seats
			.map((seat) => {
				const arr = (hands[seat] || [])
					.map((c) =>
						c.suit ? c.suit[0].toUpperCase() + normalizeRank(c.rank) : c
					)
					.map(String)
				// Support two card shapes: objects {suit,rank} or strings 'SA'
				const cards = arr.map((card) => {
					if (card.length === 2) return card // 'SA'
					// fallback attempt parse like 'S:A'
					return card.replace(/[^SHDCATKQJ0-9]/g, '').slice(0, 2)
				})
				const norm = cards.sort().join('')
				return seat + ':' + norm
			})
			.join('|')
		return hashString(parts)
	} catch {
		return 'hash-fallback'
	}
}

function normalizeRank(r) {
	if (r === '10') return 'T'
	return String(r).toUpperCase()
}
function hashString(str) {
	let h = 0
	for (let i = 0; i < str.length; i++) {
		h = (h * 131 + str.charCodeAt(i)) >>> 0
	}
	return 'h' + h.toString(16)
}

function hcp(cards) {
	return cards.reduce((t, c) => {
		const rank = extractRank(c)
		return (
			t +
			(rank === 'A'
				? 4
				: rank === 'K'
				? 3
				: rank === 'Q'
				? 2
				: rank === 'J'
				? 1
				: 0)
		)
	}, 0)
}
function extractRank(card) {
	if (typeof card === 'string') {
		return card.slice(-1)
	}
	return normalizeRank(card.rank)
}
function suitLengths(cards) {
	const lens = { S: 0, H: 0, D: 0, C: 0 }
	cards.forEach((c) => {
		const s = typeof c === 'string' ? c[0] : (c.suit && c.suit[0]) || ''
		if (lens[s] !== undefined) lens[s]++
	})
	return lens
}
function mergeLengths(l) {
	return { ...l }
}
function hasFiveCardMajor(lengths) {
	if (lengths.S >= 5 && lengths.S >= lengths.H) return 'S'
	if (lengths.H >= 5) return 'H'
	return null
}
function isBalanced(lengths) {
	const arr = Object.values(lengths)
		.sort((a, b) => a - b)
		.join('-')
	return (
		['2-3-3-5', '2-3-4-4', '3-3-3-4'].includes(arr) ||
		['4333', '4432', '5332'].includes(
			'SHDC'
				.split('')
				.map((k) => lengths[k])
				.join('')
		)
	)
}

function lcg(seed) {
	let s = seed >>> 0
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0
		return s / 0xffffffff
	}
}
function seedFrom(hash) {
	let h = 0
	for (const ch of hash) h = (h * 131 + ch.charCodeAt(0)) >>> 0
	return h
}
function partnerOf(seat) {
	return seat === 'N' ? 'S' : seat === 'S' ? 'N' : seat === 'E' ? 'W' : 'E'
}

function chooseOpening(hcpVal, lengths) {
	if (hcpVal < 12) return 'PASS'
	const fiveS = lengths.S >= 5
	const fiveH = lengths.H >= 5
	if (fiveS || fiveH) {
		if (fiveS && (!fiveH || lengths.S >= lengths.H)) return '1S'
		return '1H'
	}
	if (isBalanced(lengths) && hcpVal <= 14) return '1NT' // 12-14 balanced
	// Choose minor: prefer diamonds with 4+ if at least as long as clubs
	if (lengths.D >= 4 && lengths.D >= lengths.C) return '1D'
	return '1C'
}

function unicodeBid(call) {
	if (!call) return call
	if (/^Pass$/i.test(call) || call === 'P') return 'Pass'
	const m = call.match(/^(\d)([SHDC]|NT)$/)
	if (!m) return call
	const level = m[1]
	const strain = m[2]
	const map = { S: '♠', H: '♥', D: '♦', C: '♣' }
	return strain === 'NT' ? level + 'NT' : level + map[strain]
}

function toBase(call) {
	// Inverse: from Unicode back to base letters for parsing contract if needed
	if (/^Pass$/i.test(call)) return 'PASS'
	const m = call.match(/^(\d)([♠♥♦♣]|NT)$/)
	if (!m) return call
	const level = m[1]
	const suitMap = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' }
	const strain = m[2] === 'NT' ? 'NT' : suitMap[m[2]]
	return level + strain
}

function openingDescription(opening) {
	const base = toBase(opening)
	if (base === '1NT') return '12-14 balanced, no 5-card major'
	if (/1[SH]/.test(base)) return '5+ card major'
	if (/1[CD]/.test(base)) return '12+ points, searching for major or NT'
	return 'No opening values'
}

// Build the mainline auction using deterministic, interference-free logic
function buildMainlineAuction(deal, HCP, lengths) {
	const dealer = deal.dealer || 'N'
	const order = rotationFrom(dealer) // starting seat order
	const calls = []
	let openerSeat = null
	let openingCall = null
	// 1. Traverse seats until someone opens (>=12 HCP) else all pass out
	for (let i = 0; i < 4; i++) {
		const seat = order[i]
		const ocall = chooseOpening(HCP[seat], lengths[seat])
		if (ocall !== 'PASS') {
			openerSeat = seat
			openingCall = ocall
			calls.push(unicodeBid(ocall))
			break
		} else calls.push('Pass')
	}
	if (!openingCall) {
		// Pass out: need remaining passes to make four
		while (calls.length < 4) calls.push('Pass')
		return {
			label: 'Mainline ACOL',
			seq: calls,
			opener: null,
			opening: 'PASS',
			bullets: passOutBullets(HCP),
		}
	}
	// Ensure all seats up to this point were recorded; if opener not first, we already pushed passes + opening
	// 2. LHO after opening always Pass (no interference)
	// Determine partner
	const partner = partnerOf(openerSeat)
	// After opening, next seat index
	let nextIndex = calls.length // number of calls already made
	// Append passes for any skipped positions between opener and LHO logically already represented by rotation order; we just continue seat cycling
	// LHO call
	calls.push('Pass')
	nextIndex++
	// 3. Responder action (partner of opener)
	// Find responder position index relative to order
	const responderIndex = order.indexOf(partner)
	while (nextIndex < responderIndex) {
		// fill intermediate seats with Pass (should not normally happen if partner directly after LHO)
		calls.push('Pass')
		nextIndex++
	}
	const responderCallBase = responderCall(
		openingCall,
		HCP[partner],
		lengths[partner]
	)
	const responderCallUnicode =
		responderCallBase === 'PASS' ? 'Pass' : unicodeBid(responderCallBase)
	calls.push(responderCallUnicode)
	nextIndex++
	// 4. RHO pass
	calls.push('Pass')
	nextIndex++
	// 5. Opener rebid (only if responder did something other than Pass or 1NT into game decision context)
	const rebidBase = openerRebid(
		openingCall,
		responderCallBase,
		HCP[openerSeat],
		lengths[openerSeat]
	)
	if (rebidBase) {
		calls.push(unicodeBid(rebidBase))
	}
	// 6. Add passes until three passes after last bid.
	ensureThreePassesAfterLastBid(calls)
	return {
		label: 'Mainline ACOL',
		seq: calls,
		opener: openerSeat,
		opening: unicodeBid(openingCall),
	}
}

function responderCall(opening, hcpVal, lens) {
	if (opening === '1NT') {
		if (hcpVal <= 7) return 'PASS'
		if (hcpVal <= 9) return '2NT'
		return '3NT'
	}
	if (/1[SH]/.test(opening)) {
		const suit = opening[1]
		const support = lens[suit] || 0
		if (support >= 3) {
			if (hcpVal <= 9) return '2' + suit
			if (hcpVal <= 12) return '3' + suit
			return '4' + suit
		}
		return hcpVal >= 6 ? '1NT' : 'PASS'
	}
	if (/1[CD]/.test(opening)) {
		if (hcpVal < 6) return 'PASS'
		return '1NT'
	}
	return 'PASS'
}

function openerRebid(opening, responderCall, hcpVal, lens) {
	if (/1[SH]/.test(opening) && responderCall === '1NT') {
		if (hcpVal >= 18) return hcpVal >= 19 ? '4' + opening[1] : '3' + opening[1]
		return '2' + opening[1]
	}
	return null
}

function ensureThreePassesAfterLastBid(seq) {
	// convert to base for detection
	function isBid(c) {
		return !/^Pass$/i.test(c)
	}
	if (!seq.some(isBid)) return // already all pass-out
	let trailing = 0
	for (let i = seq.length - 1; i >= 0; i--) {
		if (/^Pass$/i.test(seq[i])) trailing++
		else break
	}
	while (trailing < 3) {
		seq.push('Pass')
		trailing++
	}
}

function passOutBullets(HCP) {
	const entries = Object.entries(HCP).sort((a, b) => b[1] - a[1])
	return [
		'Passed out: no seat reaches 12 HCP.',
		`Highest HCP seat: ${entries[0][0]} (${entries[0][1]} HCP).`,
		'Use for lead / counting practice.',
	]
}

function buildMainlineBullets(mainline, HCP, lengths) {
	if (mainline.opening === 'PASS' || !mainline.opener)
		return mainline.bullets || passOutBullets(HCP)
	const opener = mainline.opener
	const partner = partnerOf(opener)
	const openingBase = toBase(mainline.opening)
	const responderIdx = mainline.seq.findIndex(
		(c) => !/^Pass$/i.test(c) && c !== mainline.opening && true
	)
	// Determine responder call from sequence (first non-pass after opening by partner)
	const responderCall = mainline.seq
		.filter((c) => !/^Pass$/i.test(c))
		.filter((c) => c !== mainline.opening)[0]
	const bullets = []
	bullets.push(
		`Opener ${opener}: ${HCP[opener]} HCP opens ${
			mainline.opening
		} (${openingDescription(mainline.opening)})`
	)
	if (responderCall) {
		const base = toBase(responderCall)
		const openingSuit = /1[SH]/.test(openingBase) ? openingBase[1] : null
		let expl
		if (openingBase === '1NT') {
			if (base === 'PASS') expl = 'Responder with 0-7 HCP passes'
			else if (base === '2NT') expl = 'Responder invites with 8-9 HCP'
			else if (base === '3NT') expl = 'Responder has 10+ HCP – bids game'
		} else if (/1[SH]/.test(openingBase)) {
			if (/^2[SH]$/.test(base))
				expl = `Simple raise showing 6-9 HCP & 3+ ${openingSuit}`
			else if (/^3[SH]$/.test(base))
				expl = `Limit raise ~10-12 HCP & 3+ ${openingSuit}`
			else if (/^4[SH]$/.test(base)) expl = `Game raise 13+ support`
			else if (base === '1NT') expl = 'No fit, 6+ HCP balanced reply'
			else if (base === 'PASS') expl = 'Too weak / no fit (<6 HCP)'
		} else if (/1[CD]/.test(openingBase)) {
			if (base === '1NT') expl = 'Responder 6+ HCP, no major response chosen'
			else if (base === 'PASS') expl = '<6 HCP cannot respond'
		}
		bullets.push(
			`Responder ${partner}: ${HCP[partner]} HCP -> ${responderCall}${
				expl ? ' (' + expl + ')' : ''
			}`
		)
	}
	// Plan bullet
	const combined = HCP[opener] + HCP[partner]
	let plan
	if (/1[SH]/.test(openingBase)) {
		if (combined >= 25) plan = 'Plan: aim for game in the major (25+ combined).'
		else plan = 'Plan: partscore; reassess if additional distribution.'
	} else if (openingBase === '1NT') {
		plan = 'Plan: count winners toward 9 tricks.'
	} else {
		plan = 'Plan: search for major fit or settle in NT.'
	}
	bullets.push(plan)
	return bullets.slice(0, 3)
}

// Teacher focus bullets (concise coaching prompts)
function buildTeacherFocus(mainline, HCP, lengths, deal) {
	const opener = mainline.opener || deal.dealer || 'N'
	const partner = partnerOf(opener)
	const openingBase = toBase(mainline.opening || '')
	const combined = (HCP[opener] || 0) + (HCP[partner] || 0)
	const fitFocus = /1[SH]/.test(openingBase)
		? 'Assess major fit early'
		: openingBase === '1NT'
		? 'Count sure winners early'
		: 'Search for major fit'
	return [
		fitFocus,
		`Combined HCP: ${combined}`,
		'Outline entries & danger hand',
	]
}

function buildAlternatives(mainline, deal, HCP, lengths, rng) {
	if (!mainline.opener) return []
	const alts = []
	const openingBase = toBase(mainline.opening)
	const opener = mainline.opener
	const partner = partnerOf(opener)
	const responderH = HCP[partner]
	if (/1[SH]/.test(openingBase)) {
		const mainSeqStr = mainline.seq.join(' ')
		const suit = openingBase[1]
		const support = lengths[partner][suit]
		if (mainSeqStr.includes(`4${unicodeBid(openingBase).slice(-1)}`)) {
			alts.push(
				makeAltSequence(
					mainline,
					substituteResponder(
						mainline,
						responderH <= 12 ? '2' + suit : '3' + suit
					)
				)
			)
		} else if (support >= 3 && responderH >= 13) {
			alts.push(
				makeAltSequence(mainline, substituteResponder(mainline, '4' + suit))
			)
		}
	} else if (openingBase === '1NT') {
		if (responderH >= 10) {
			alts.push(makeAltSequence(mainline, substituteResponder(mainline, '2NT')))
		} else if (responderH >= 8) {
			alts.push(makeAltSequence(mainline, substituteResponder(mainline, '3NT')))
		}
	} else if (/1[CD]/.test(openingBase)) {
		if (responderH >= 10) {
			alts.push(
				makeAltSequence(mainline, substituteResponder(mainline, 'PASS'))
			)
		}
	}
	return alts.slice(0, 2)
}

function substituteResponder(mainline, newResponderBase) {
	// Create a shallow variant of sequence with responder call swapped
	const baseSeq = [...mainline.seq]
	const openingIdx = baseSeq.findIndex((c) => !/^Pass$/i.test(c))
	if (openingIdx === -1) return baseSeq
	// responder call is next non-pass played by partner after passes
	// We assume structure: opening, Pass, responder, Pass, (optional rebid), ...
	const responderIdx = openingIdx + 2 // given no interference
	if (baseSeq[responderIdx])
		baseSeq[responderIdx] = unicodeBid(
			newResponderBase === 'PASS' ? 'PASS' : newResponderBase
		)
	// Remove any opener rebid if logically inconsistent (e.g. game jump already achieved)
	const rebidIdx = responderIdx + 2
	const newResponderBaseNorm = newResponderBase
	if (/^4[SH]$/.test(newResponderBaseNorm) || newResponderBaseNorm === '3NT') {
		// strip any following non-pass bid before trailing passes
		for (let i = rebidIdx; i < baseSeq.length; i++) {
			if (!/^Pass$/i.test(baseSeq[i])) {
				baseSeq[i] = 'Pass'
			}
		}
	}
	ensureThreePassesAfterLastBid(baseSeq)
	return baseSeq
}

function makeAltSequence(mainline, seq) {
	return { label: 'Alternative', seq, prob: 0, bullets: [] }
}

function assignProb(lines) {
	if (!lines.length) return
	const main = lines[0]
	if (lines.length === 1) {
		main.prob = 1
		return
	}
	main.prob = 0.88
	const remain = 1 - main.prob
	const share = remain / (lines.length - 1)
	for (let i = 1; i < lines.length; i++)
		lines[i].prob = parseFloat(share.toFixed(2))
	// Adjust rounding drift
	const sum = lines.reduce((s, l) => s + l.prob, 0)
	const drift = +(1 - sum).toFixed(2)
	if (drift !== 0)
		lines[lines.length - 1].prob = +(
			lines[lines.length - 1].prob + drift
		).toFixed(2)
}

// (Removed legacy v1 buildMainline / buildAlternatives / duplicate assignProb)

export function buildAcolAdvice(deal) {
	if (!deal || !deal.hands) return null
	const dealer = deal.dealer || 'N'
	const hash = deal.dealHash || computeDealHash(deal.hands)
	const seats = ['N', 'E', 'S', 'W']
	const HCP = {}
	const lengths = {}
	seats.forEach((seat) => {
		const cards = deal.hands[seat] || []
		HCP[seat] = hcp(cards)
		lengths[seat] = suitLengths(cards)
	})
	const mainline = buildMainlineAuction(deal, HCP, lengths)
	mainline.bullets = buildMainlineBullets(mainline, HCP, lengths)
	const rng = lcg(seedFrom(hash)) // presently only for potential tie-break future use
	const alts = buildAlternatives(mainline, deal, HCP, lengths, rng).map(
		(a) => ({ ...a, bullets: buildAltBullets(a, mainline, HCP, lengths) })
	)
	const auctions = [mainline, ...alts]
	assignProb(auctions)
	const lastBid = [...mainline.seq].reverse().find((c) => !/^Pass$/i.test(c))
	const baseLast = lastBid ? toBase(lastBid) : null
	const dealerSeat = dealer
	const seatOrder = rotationFrom(dealerSeat)
	let bidIndex = mainline.seq.lastIndexOf(lastBid)
	if (bidIndex < 0) bidIndex = mainline.seq.length - 1
	const declarerSeat = seatOrder[bidIndex % 4]
	const parsed = parseContract(baseLast || '')
	const final_contract = parsed
		? { ...parsed, by: declarerSeat }
		: { by: dealerSeat, level: 1, strain: 'NT' }
	return {
		dealHash: hash,
		board: deal.number || 0,
		meta: {
			dealer: dealerSeat,
			vul: deal.vul || 'None',
			system: deal.meta?.system || 'ACOL',
		},
		auctions,
		recommendation_index: 0,
		final_contract,
		teacher_focus: buildTeacherFocus(mainline, HCP, lengths, deal),
	}
}

function parseContract(call) {
	const m = call && call.match(/^(\d)([SHDC]|NT)$/)
	if (!m) return null
	return { by: 'N', level: parseInt(m[1], 10), strain: m[2] }
}

function rotationFrom(start) {
	const order = ['N', 'E', 'S', 'W']
	const idx = order.indexOf(start)
	return [0, 1, 2, 3].map((i) => order[(idx + i) % 4])
}

// Simple in-memory cache so multiple exports avoid recompute
const _adviceCache = new Map()
export function getOrBuildAcolAdvice(deal) {
	const key = deal.dealHash || computeDealHash(deal.hands)
	if (_adviceCache.has(key)) return _adviceCache.get(key)
	const adv = buildAcolAdvice(deal)
	if (adv) _adviceCache.set(key, adv)
	return adv
}

export function hasAcolAdvice(deal) {
	const key = deal.dealHash || computeDealHash(deal.hands)
	return _adviceCache.has(key) || !!deal.auctionAdvice
}

// Additional helper for alternative bullets
function buildAltBullets(alt, mainline, HCP, lengths) {
	// Simple comparative bullets referencing mainline
	if (!mainline.opener) return alt.bullets || []
	const opener = mainline.opener
	const partner = partnerOf(opener)
	const altResponder = extractResponderCall(alt.seq, mainline.opener)
	const mainResponder = extractResponderCall(mainline.seq, mainline.opener)
	if (!altResponder || altResponder === mainResponder) return []
	const baseAlt = toBase(altResponder)
	const baseMain = toBase(mainResponder)
	const bullets = []
	bullets.push(
		`Alternative responder action: ${altResponder} vs ${mainResponder}.`
	)
	bullets.push(`Opener/Responder HCP: ${HCP[opener]} + ${HCP[partner]}`)
	bullets.push('Shows different valuation style.')
	return bullets.slice(0, 3)
}

function extractResponderCall(seq, opener) {
	const order = rotationFrom(opener)
	let foundOpening = false
	for (let i = 0; i < seq.length; i++) {
		const seat = order[i % 4]
		const call = seq[i]
		if (!foundOpening && !/^Pass$/i.test(call)) {
			if (seat === opener) foundOpening = true
			continue
		}
		if (foundOpening && seat === partnerOf(opener) && !/^Pass$/i.test(call))
			return call
	}
	return null
}

