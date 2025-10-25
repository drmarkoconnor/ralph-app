#!/usr/bin/env node
/*
 PBN smoke tests across variants:
 - Numeric dealer (1-4)
 - Spelled dealer (NORTH/EAST/...)
 - Our app PBNS and generic PBN
 - Auctions with AP, doubles, lowercase, noisy tokens
 - Play leader normalization
 Simple assertions: parse succeeds, dealToHands works, leader/declarer resolved, opening leader computed, manual engine can play first trick following rules.
*/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sanitizePBN, parsePBN } from '../src/lib/pbn.js'
import {
	dealToHands,
	rightOf,
	parseTrump,
	evaluateTrick,
	partnerOf,
} from '../src/lib/bridgeCore.js'
import {
	createInitialManualState,
	playCardManual,
} from '../src/lib/manualPlayEngine.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function assert(cond, msg) {
	if (!cond) throw new Error(msg)
}

function tryParseDeal(dealStr) {
	try {
		return dealToHands(dealStr)
	} catch (e) {
		return null
	}
}

function firstPlayableCard(hand, leadSuit) {
	if (!Array.isArray(hand) || hand.length === 0) return null
	if (leadSuit) {
		const follow = hand.filter((c) => c.suit === leadSuit)
		if (follow.length) return follow[0]
	}
	return hand[0]
}

function playOneTrick(hands, openingLeader, trump, declarer) {
	const st0 = createInitialManualState(hands, openingLeader, trump, declarer)
	let st = st0
	const order = ['N', 'E', 'S', 'W']
	for (let i = 0; i < 4; i++) {
		const seat = st.turnSeat
		const leadSuit = st.trick.length ? st.trick[0].card.suit : null
		const card = firstPlayableCard(st.remaining[seat], leadSuit)
		assert(card, `no playable card for ${seat}`)
		const res = playCardManual(st, seat, card.id)
		assert(res.ok, `playCardManual failed for ${seat}: ${res.error}`)
		st = res.state
	}
	assert(st.trick.length === 4, 'trick not complete after 4 plays')
	const winner = evaluateTrick(st.trick, trump)
	assert(['N', 'E', 'S', 'W'].includes(winner), 'winner invalid')
	return true
}

function loadSamplePBNs() {
	const samples = []
	// 1) Dealer numeric, simple auction with AP, lowercase nt
	samples.push(`
[Board "1"]
[Dealer "1"]
[Vulnerable "Both"]
[Deal "N:AKQJ.T98.762.AK Q7.AKQJ.AT9.8765 T983.7654.KQJ.- 6542.32.8543.QJT"]
[Auction "E"]
1c p 1h 2d p 2s p p ap
[Play "S"]
SA SK SQ SJ
`)
	// 2) Spelled dealer, explicit passes/doubles
	samples.push(`
[Board "2"]
[Dealer "SOUTH"]
[Vulnerable "Neither"]
[Deal "S:AKQJ.-.AQT987.32 9876.AKQJ.32.AK 5.T9876.K654.QJ9 T432.5432.J.T8765"]
[Auction "W"]
1NT P 2H X XX P P P
`)
	// 3) Our app style (use local file if present)
	try {
		const p = path.join(__dirname, '..', '66891.pbn')
		const text = fs.readFileSync(p, 'utf8')
		samples.push(text)
	} catch {}
	// 4) Minimal PBN without auction (manual contract later in UI)
	samples.push(`
[Board "4"]
[Dealer "W"]
[Vulnerable "NS"]
[Deal "W:AKQJ.AKQ.JT9.32 T98.T98.8765.76 76.7654.AKQ.AT9 5432.J2.432.KQJ8"]
`)
	// 5) Numeric dealer 4 (W), mixed case auction bids
	samples.push(`
[Board "5"]
[Dealer "4"]
[Vulnerable "All"]
[Deal "W:AT95.KQ3.AT9.432 KQ3.AT9.J72.KT9 J72.J72.KQ3.QJ7 864.8654.8645.A85"]
[Auction "2"]
1h p 2h p p p
`)
	return samples
}

function run() {
	const samples = loadSamplePBNs()
	const results = []
	for (let i = 0; i < samples.length; i++) {
		const raw = samples[i]
		const sanitized = sanitizePBN(raw)
		const parsed = parsePBN(sanitized)
		assert(
			Array.isArray(parsed) && parsed.length > 0,
			`parsed empty for sample ${i + 1}`
		)
		let valid = 0
		let warnings = 0
		for (const deal of parsed) {
			if (!deal.deal) {
				warnings++
				continue
			}
			const hands = tryParseDeal(deal.deal)
			if (!hands) {
				warnings++
				continue
			}
			const dealer = deal.dealer || 'N'
			// opening leader: right of declarer if contract/declarer provided, else dealer
			const decl = deal.declarer || null
			const trump = parseTrump(deal.contract || '')
			const leader = decl ? rightOf(decl) : dealer
			// sanity: leaders and seats valid
			if (!['N', 'E', 'S', 'W'].includes(leader)) {
				warnings++
				continue
			}
			// smoke: can we play one trick in engine
			playOneTrick(hands, leader, trump, decl)
			valid++
		}
		assert(valid > 0, `no valid deals playable for sample ${i + 1}`)
		results.push({
			sample: i + 1,
			deals: parsed.length,
			valid,
			warnings,
			ok: true,
		})
	}
	return results
}

try {
	const out = run()
	console.log('PBN smoke tests: PASS')
	out.forEach((r) =>
		console.log(
			`  Sample ${r.sample}: ${r.deals} deal(s), valid ${r.valid}${
				r.warnings ? `, warnings ${r.warnings}` : ''
			}`
		)
	)
	process.exit(0)
} catch (e) {
	console.error('PBN smoke tests: FAIL\n', e && e.stack ? e.stack : e)
	process.exit(1)
}

