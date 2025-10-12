import type { Board, Seat } from '../schemas/board'
import { ownerStringFromHands, computeDealHashV1 } from './hash'

const CRLF = '\r\n'

// Dealer4 and some legacy PBN consumers are strict about ASCII-only tag values.
// Sanitize text: replace Unicode suit symbols, smart quotes/dashes, strip other non-ASCII,
// and avoid raw double-quotes inside values.
function sanitizePbnText(input?: string): string {
	if (!input) return ''
	let s = String(input)
	// Normalise common punctuation and suit symbols
	s = s
		.replace(/[“”]/g, '"')
		.replace(/[‘’]/g, "'")
		.replace(/[–—]/g, '-')
		.replace(/…/g, '...')
		.replace(/♠/g, 'S')
		.replace(/♥/g, 'H')
		.replace(/♦/g, 'D')
		.replace(/♣/g, 'C')
	// Collapse newlines/CRs/tabs inside tag values
	s = s.replace(/[\r\n\t]+/g, ' ').trim()
	// PBN strings use double quotes as delimiters; avoid embedded quotes by converting to apostrophes
	s = s.replace(/"/g, "'")
	// Finally, strip any non-ASCII control/extended characters (keep printable ASCII 32..126)
	s = s.replace(/[^\x20-\x7E]/g, '')
	return s
}

const seatOrderFrom = (start: Seat): Seat[] => {
	const all: Seat[] = ['N', 'E', 'S', 'W']
	const i = all.indexOf(start)
	return [all[i], all[(i + 1) % 4], all[(i + 2) % 4], all[(i + 3) % 4]]
}

function suitBlock(h: {
	S: string[]
	H: string[]
	D: string[]
	C: string[]
}): string {
	const suit = (arr: string[]) => (arr.length ? arr.join('') : '-')
	return [suit(h.S), suit(h.H), suit(h.D), suit(h.C)].join('.')
}

export async function exportBoardPBN(
	board: Board,
	opts?: { dealer4Mode?: boolean }
): Promise<string> {
	const dealer4Mode = !!opts?.dealer4Mode
	const order = seatOrderFrom(board.dealPrefix)
	const handBlocks = order.map((s) => suitBlock(board.hands[s]))
	const dealLine = `${board.dealPrefix}:${handBlocks.join(' ')}`

	// compute owner string + hash (skip gracefully if hands are incomplete)
	let dealHash: string | undefined
	try {
		const owner = ownerStringFromHands(board.hands as any)
		dealHash = await computeDealHashV1(owner)
	} catch {
		dealHash = undefined
	}

	const core = [
		`[Event "${sanitizePbnText(board.event)}"]`,
		`[Site "${sanitizePbnText(board.site)}"]`,
		`[Date "${sanitizePbnText(board.date)}"]`,
		`[Board "${board.board}"]`,
		`[Dealer "${board.dealer}"]`,
		`[Vulnerable "${board.vul}"]`,
		`[Deal "${dealLine}"]`,
	]
	if (board.contract) {
		core.push(
			`[Contract "${board.contract.level}${board.contract.strain}${
				board.contract.dbl || ''
			}"]`
		)
	}
	if (board.declarer) core.push(`[Declarer "${board.declarer}"]`)

	const ext: string[] = []
	if (!dealer4Mode) {
		ext.push(
			'[TagSpec "System,Theme,Interf,Lead,DDPar,Diagram,PlayScript,Scoring,DealHash"]'
		)
		if (board.ext.system)
			ext.push(`[System "${sanitizePbnText(board.ext.system)}"]`)
		if (board.ext.theme)
			ext.push(`[Theme "${sanitizePbnText(board.ext.theme)}"]`)
		if (board.ext.interf)
			ext.push(`[Interf "${sanitizePbnText(board.ext.interf)}"]`)
		if (board.ext.lead)
			ext.push(`[Lead "${sanitizePbnText(board.ext.lead)}"]`)
		if (board.ext.ddpar)
			ext.push(`[DDPar "${sanitizePbnText(board.ext.ddpar)}"]`)
		if (board.ext.diagram)
			ext.push(`[Diagram "${sanitizePbnText(board.ext.diagram)}"]`)
		if (board.ext.playscript)
			ext.push(
				`[PlayScript "${sanitizePbnText(board.ext.playscript).replace(
					/\n/g,
					'\\n'
				)}"]`
			)
		if (board.ext.scoring)
			ext.push(`[Scoring "${sanitizePbnText(board.ext.scoring)}"]`)
		if (dealHash) ext.push(`[DealHash "${dealHash}"]`)
	}

	const notes = (board.notes || []).map(
		(n) => `[Note "${sanitizePbnText(n).slice(0, 300)}"]`
	)

	const auction: string[] = []
	if (board.auctionStart && board.auction && board.auction.length) {
		const canon = (c: string) => {
			const t = sanitizePbnText(c).toUpperCase().trim()
			if (/^(P|PASS)$/.test(t)) return 'P'
			if (/^AP$/.test(t)) return 'AP'
			if (/^XX$/.test(t)) return 'XX'
			if (/^X$/.test(t)) return 'X'
			const m = t.match(/^([1-7])(C|D|H|S|NT)$/)
			return m ? `${m[1]}${m[2]}` : t
		}
		const calls = board.auction.map((c) => canon(String(c)))
		// Emit header on its own line, then calls on subsequent lines (wrap every 4 for readability)
		auction.push(`[Auction "${board.auctionStart}"]`)
		for (let i = 0; i < calls.length; i += 4) {
			auction.push(calls.slice(i, i + 4).join(' '))
		}
	}

	return [...core, ...ext, ...notes, ...auction, ''].join(CRLF) + CRLF
}

