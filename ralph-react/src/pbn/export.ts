import type { Board, Seat } from '../schemas/board'
import { ownerStringFromHands, computeDealHashV1 } from './hash'

const CRLF = '\r\n'

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

export async function exportBoardPBN(board: Board): Promise<string> {
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
		`[Event "${board.event}"]`,
		`[Site "${board.site}"]`,
		`[Date "${board.date}"]`,
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
	ext.push(
		'[TagSpec "System,Theme,Interf,Lead,DDPar,Diagram,PlayScript,Scoring,DealHash"]'
	)
	if (board.ext.system) ext.push(`[System "${board.ext.system}"]`)
	if (board.ext.theme) ext.push(`[Theme "${board.ext.theme}"]`)
	if (board.ext.interf) ext.push(`[Interf "${board.ext.interf}"]`)
	if (board.ext.lead) ext.push(`[Lead "${board.ext.lead}"]`)
	if (board.ext.ddpar) ext.push(`[DDPar "${board.ext.ddpar}"]`)
	if (board.ext.diagram) ext.push(`[Diagram "${board.ext.diagram}"]`)
	if (board.ext.playscript)
		ext.push(`[PlayScript "${board.ext.playscript.replace(/\n/g, '\\n')}"]`)
	if (board.ext.scoring) ext.push(`[Scoring "${board.ext.scoring}"]`)
	if (dealHash) ext.push(`[DealHash "${dealHash}"]`)

	const notes = (board.notes || []).map((n) => `[Note "${n.slice(0, 300)}"]`)

	const auction: string[] = []
	if (board.auctionStart && board.auction && board.auction.length) {
		auction.push(`[Auction "${board.auctionStart}"] ${board.auction.join(' ')}`)
	}

	return [...core, ...ext, ...notes, ...auction, ''].join(CRLF) + CRLF
}

