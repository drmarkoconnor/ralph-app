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
					current.dealer = val.toUpperCase()
					break
				case 'Vulnerable':
					current.vul = val
					break
				case 'Deal':
					current.deal = val
					break
				case 'Contract':
					current.contract = val
					break
				case 'Declarer':
					current.declarer = val.toUpperCase()
					break
				case 'Auction':
					current.auction = []
					current.auctionDealer = val.toUpperCase()
					inAuction = true
					break
				case 'Play':
					current.play = []
					current.playLeader = val.toUpperCase()
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
			const calls = line
				.replace(/([;%].*)$/g, '')
				.split(/\s+/)
				.filter(Boolean)
			if (calls.length) current.auction = [...(current.auction || []), ...calls]
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
	return deals
}

