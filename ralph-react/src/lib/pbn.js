// PBN sanitation & parsing utilities
// Extracted from Player.jsx to share between generator/player.

export function sanitizePBN(raw) {
	if (!raw) return ''
	let text = String(raw)
	text = text.replace(/\{[^}]*\}/gs, '') // remove { } comments
	text = text.replace(/\$\d+/g, '') // strip $ footnotes
	text = text
		.split(/\r?\n/)
		.filter((ln) => !/^\s*%/.test(ln))
		.join('\n')
	text = text.replace(/\n{3,}/g, '\n\n')
	return text
}

// Returns array of parsed deal objects with core tags plus ext map for unknown tags
export function parsePBN(text) {
	const lines = String(text || '').split(/\r?\n/)
	const deals = []
	let current = null
	let inAuction = false
	let inPlay = false
	const normDealer = (val) => {
		const v = String(val || '').trim()
		const up = v.toUpperCase()
		// Support numeric dealer (1..4) and spelled-out dealers
		if (/^[1-4]$/.test(up)) return ['N', 'E', 'S', 'W'][parseInt(up, 10) - 1]
		if (/^(NORTH|EAST|SOUTH|WEST)$/.test(up)) return up[0]
		if (/^[NESW]$/.test(up)) return up
		return 'N'
	}
	const normVul = (val) => {
		const up = String(val || '').trim().toUpperCase()
		if (up === 'BOTH') return 'All'
		if (up === 'NEITHER') return 'None'
		if (up === 'LOVE' || up === 'NONE') return 'None'
		if (up === 'ALL') return 'All'
		if (up === 'NS' || up === 'EW') return up
		return up || 'None'
	}
	for (const raw of lines) {
		const line = String(raw || '').trim()
		if (!line && inAuction) inAuction = false
		if (!line && inPlay) inPlay = false
		if (!line) {
			if (current) {
				deals.push(current)
				current = null
			}
			continue
		}
		if (/^\([A-Z]+\)/.test(line)) continue
		const m = line.match(/^\[([^\s]+)\s+"([^"]*)"\]/)
		if (m) {
			const key = m[1]
			const val = m[2]
			current = current || { ext: {} }
			switch (key) {
				case 'Board':
					current.board = val
					break
				case 'Dealer':
					current.dealer = normDealer(val)
					break
				case 'Vulnerable':
					current.vul = normVul(val)
					break
				case 'Deal':
					current.deal = val
					break
				case 'Contract':
					current.contract = val
					break
				case 'Declarer':
					current.declarer = normDealer(val)
					break
				case 'Auction':
					current.auction = []
					current.auctionDealer = normDealer(val)
					inAuction = true
					break
				case 'Play':
					current.play = []
					current.playLeader = normDealer(val)
					inPlay = true
					break
				case 'Event':
				case 'Site':
				case 'Date':
				case 'Room':
				case 'Score':
				case 'BCFlags':
					current.ext[key] = val
					break
				default:
					current.ext[key] = val
			}
			continue
		}
		if (inAuction) {
			// Strip trailing comments and common footnote markers, then tokenize
			const cleaned = line
				.replace(/([;%].*)$/g, '')
				.replace(/\$\d+/g, '') // remove $1, $2 references
				.replace(/=\d+=/g, '') // remove =1= style references
				.trim()
			const rawTokens = cleaned.split(/\s+/).filter(Boolean)
			const out = []
			for (let tok of rawTokens) {
				if (!tok) continue
				let t = String(tok).trim()
				// Remove trailing punctuation and stray markers
				t = t.replace(/[.,;:]+$/g, '')
				// Map synonyms and ignore non-calls
				if (/^AP$/i.test(t)) {
					// All Pass -> three passes after final bid; append 3 passes
					out.push('P', 'P', 'P')
					continue
				}
				if (/^P(ASS)?$/i.test(t)) {
					out.push('P')
					continue
				}
				if (/^XX$/i.test(t)) {
					out.push('XX')
					continue
				}
				if (/^X$/i.test(t)) {
					out.push('X')
					continue
				}
				// Normalize simple bids like 1C, 3NT
				const m = t.match(/^([1-7])(C|D|H|S|NT)$/i)
				if (m) {
					out.push(`${m[1]}${m[2].toUpperCase()}`)
					continue
				}
				// Otherwise ignore unknown/annotation tokens (e.g., =1=, $1, !, etc.)
			}
			if (out.length) current.auction = [...(current.auction || []), ...out]
			continue
		}
		if (inPlay) {
			current.play = current.play || []
			if (line) current.play.push(line)
			continue
		}
		if (current) {
			deals.push(current)
			current = null
		}
	}
	if (current) deals.push(current)
	// Normalize auctions: if the final bid is not followed by three passes, append passes
	const bidRe = /^([1-7])(C|D|H|S|NT)$/i
	const isPass = (c) => /^P(ASS)?$/i.test(String(c))
	for (const d of deals) {
		if (Array.isArray(d.auction) && d.auction.length) {
			let calls = d.auction.slice()
			const lastBidIdx = calls
				.map((c, i) => (bidRe.test(String(c)) ? i : -1))
				.filter((i) => i >= 0)
				.pop()
			if (lastBidIdx != null) {
				// Ensure the last three calls are passes after the last bid
				let up = calls.map((c) => String(c).toUpperCase())
				while (
					up.length < lastBidIdx + 4 ||
					!(isPass(up[up.length - 1]) && isPass(up[up.length - 2]) && isPass(up[up.length - 3]))
				) {
					calls.push('P')
					up = calls.map((c) => String(c).toUpperCase())
					// safety guard to avoid infinite loops in malformed data
					if (calls.length > 200) break
				}
			}
			d.auction = calls
		}
	}
	return deals
}

