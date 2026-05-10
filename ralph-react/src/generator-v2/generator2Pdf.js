import { SEATS, SUITS, hcp, partnershipHcp, suitLengths } from './generatorV2Engine'

const RANK_VALUE = {
	A: 14,
	K: 13,
	Q: 12,
	J: 11,
	10: 10,
	9: 9,
	8: 8,
	7: 7,
	6: 6,
	5: 5,
	4: 4,
	3: 3,
	2: 2,
}

function safeText(value) {
	return String(value || '')
		.replace(/[^\x20-\x7E]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
}

function fileDate() {
	const now = new Date()
	const yyyy = now.getFullYear()
	const mm = String(now.getMonth() + 1).padStart(2, '0')
	const dd = String(now.getDate()).padStart(2, '0')
	return `${yyyy}${mm}${dd}`
}

function sortedSuitRanks(cards, suitKey) {
	return [...(cards || [])]
		.filter((card) => card.suitKey === suitKey)
		.sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank])
		.map((card) => card.rank)
}

function rankString(cards, suitKey) {
	const ranks = sortedSuitRanks(cards, suitKey)
	return ranks.length ? ranks.join('') : '-'
}

function drawSuitIcon(doc, suitKey, x, y, size = 4) {
	const half = size / 2
	const red = suitKey === 'H' || suitKey === 'D'
	doc.setFillColor(red ? 190 : 15, red ? 20 : 23, red ? 45 : 42)
	if (suitKey === 'D') {
		doc.triangle(x + half, y, x + size, y + half, x + half, y + size, 'F')
		doc.triangle(x + half, y, x, y + half, x + half, y + size, 'F')
		return
	}
	if (suitKey === 'C') {
		const r = half * 0.55
		doc.circle(x + half, y + r, r, 'F')
		doc.circle(x + r, y + half + r * 0.1, r, 'F')
		doc.circle(x + size - r, y + half + r * 0.1, r, 'F')
		doc.rect(x + half - r * 0.35, y + half, r * 0.7, half + r * 0.55, 'F')
		return
	}
	if (suitKey === 'H') {
		const r = half * 0.58
		doc.circle(x + half - r * 0.55, y + r, r, 'F')
		doc.circle(x + half + r * 0.55, y + r, r, 'F')
		doc.triangle(x + half, y + size, x + size, y + r + r * 0.25, x, y + r + r * 0.25, 'F')
		return
	}
	const r = half * 0.58
	doc.circle(x + half - r * 0.55, y + half, r, 'F')
	doc.circle(x + half + r * 0.55, y + half, r, 'F')
	doc.triangle(x + half, y, x + size, y + half + r * 0.25, x, y + half + r * 0.25, 'F')
	doc.rect(x + half - r * 0.35, y + half + r * 0.4, r * 0.7, half + r * 0.55, 'F')
}

function drawPanel(doc, x, y, w, h, title) {
	doc.setDrawColor(214, 222, 232)
	doc.setFillColor(248, 250, 252)
	doc.roundedRect(x, y, w, h, 2, 2, 'FD')
	doc.setTextColor(15, 23, 42)
	doc.setFont('helvetica', 'bold')
	doc.setFontSize(9)
	doc.text(title, x + 4, y + 6)
}

function drawHand(doc, seat, cards, x, y, options = {}) {
	const labelSize = options.labelSize || 13
	const metaSize = options.metaSize || 8
	const rankSize = options.rankSize || 14
	const rowGap = options.rowGap || 8
	const iconSize = options.iconSize || 4.2
	const lengths = suitLengths(cards)
	doc.setFont('helvetica', 'bold')
	doc.setFontSize(labelSize)
	doc.setTextColor(15, 23, 42)
	doc.text(seat, x, y)
	doc.setFontSize(metaSize)
	doc.setTextColor(71, 85, 105)
	doc.text(`HCP ${hcp(cards)}   ${lengths.S}-${lengths.H}-${lengths.D}-${lengths.C}`, x + 9, y)
	doc.setFont('courier', 'bold')
	doc.setFontSize(rankSize)
	SUITS.forEach((suit, index) => {
		const rowY = y + rowGap + index * rowGap
		drawSuitIcon(doc, suit.key, x, rowY - iconSize, iconSize)
		const red = suit.key === 'H' || suit.key === 'D'
		doc.setTextColor(red ? 190 : 15, red ? 20 : 23, red ? 45 : 42)
		doc.text(rankString(cards, suit.key), x + 7, rowY)
	})
	doc.setFont('helvetica', 'normal')
	doc.setTextColor(15, 23, 42)
}

function auctionRows(calls, startSeat) {
	const rows = []
	const startIndex = Math.max(0, SEATS.indexOf(startSeat || 'N'))
	calls.forEach((call, index) => {
		const absolute = startIndex + index
		const row = Math.floor(absolute / 4)
		const col = absolute % 4
		if (!rows[row]) rows[row] = ['', '', '', '']
		rows[row][col] = call === 'P' ? 'Pass' : call
	})
	return rows
}

function drawAuction(doc, board, x, y, w, options = {}) {
	const maxRows = options.maxRows || 10
	const headerSize = options.headerSize || 8
	const callSize = options.callSize || 8.5
	const rowGap = options.rowGap || 6
	const calls = String(board.auctionText || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
	const rows = auctionRows(calls, board.dealer)
	const colW = w / 4
	doc.setFont('helvetica', 'bold')
	doc.setFontSize(headerSize)
	doc.setTextColor(71, 85, 105)
	SEATS.forEach((seat, index) => {
		doc.text(seat, x + index * colW + colW / 2, y, { align: 'center' })
	})
	doc.setFont('helvetica', 'normal')
	doc.setFontSize(callSize)
	doc.setTextColor(15, 23, 42)
	if (!rows.length) {
		doc.text('No auction recorded', x, y + 7)
		return y + 12
	}
	rows.slice(0, maxRows).forEach((row, rowIndex) => {
		row.forEach((call, col) => {
			if (!call) return
			doc.text(call, x + col * colW + colW / 2, y + 7 + rowIndex * rowGap, { align: 'center' })
		})
	})
	return y + 10 + Math.min(rows.length, maxRows) * rowGap
}

function drawCompactBoard(doc, board, meta, x, y, w, h) {
	doc.setDrawColor(203, 213, 225)
	doc.setFillColor(255, 255, 255)
	doc.roundedRect(x, y, w, h, 2, 2, 'FD')

	doc.setFillColor(15, 23, 42)
	doc.roundedRect(x, y, w, 11, 2, 2, 'F')
	doc.setFont('helvetica', 'bold')
	doc.setTextColor(255, 255, 255)
	doc.setFontSize(12)
	doc.text(`Board ${board.number}`, x + 4, y + 7.5)
	doc.setFontSize(7.5)
	doc.text(safeText(board.topicTitle || meta.system || 'Teaching board').slice(0, 58), x + 34, y + 5.2)
	doc.setFont('helvetica', 'normal')
	doc.text(`Dealer ${board.dealer}   Vul ${board.vul}   ${safeText(meta.system || 'ACOL').slice(0, 32)}`, x + 34, y + 9)

	const leftW = 54
	const handX = x + leftW + 9
	const handY = y + 20
	drawPanel(doc, x + 4, y + 16, leftW - 7, 34, 'Comments')
	doc.setFont('helvetica', 'normal')
	doc.setFontSize(6.8)
	doc.setTextColor(15, 23, 42)
	const noteLines = doc.splitTextToSize(safeText(board.notes || 'No comments recorded.'), leftW - 14).slice(0, 7)
	doc.text(noteLines, x + 7, y + 26, { lineHeightFactor: 1.12 })

	drawPanel(doc, x + 4, y + 54, leftW - 7, 35, 'Auction')
	drawAuction(doc, board, x + 7, y + 66, leftW - 13, {
		maxRows: 4,
		headerSize: 6.8,
		callSize: 7,
		rowGap: 5,
	})

	drawPanel(doc, x + 4, y + 93, leftW - 7, 25, 'Point Count')
	doc.setFont('helvetica', 'bold')
	doc.setFontSize(7.2)
	doc.setTextColor(15, 23, 42)
	doc.text(`NS ${partnershipHcp(board.hands, 'NS')}`, x + 7, y + 103)
	doc.text(`EW ${partnershipHcp(board.hands, 'EW')}`, x + 28, y + 103)
	SEATS.forEach((seat, index) => {
		doc.text(`${seat} ${hcp(board.hands[seat])}`, x + 7 + (index % 2) * 21, y + 111 + Math.floor(index / 2) * 5)
	})

	doc.setDrawColor(226, 232, 240)
	doc.roundedRect(x + leftW + 2, y + 16, w - leftW - 6, h - 22, 2, 2, 'S')
	doc.setDrawColor(203, 213, 225)
	doc.line(x + leftW + 60, y + 36, x + leftW + 60, y + h - 24)
	doc.line(x + leftW + 28, y + 69, x + w - 12, y + 69)

	const mini = { labelSize: 9, metaSize: 5.8, rankSize: 9.5, rowGap: 5.5, iconSize: 3.2 }
	drawHand(doc, 'N', board.hands.N, handX + 35, handY, mini)
	drawHand(doc, 'W', board.hands.W, handX + 4, handY + 44, mini)
	drawHand(doc, 'E', board.hands.E, handX + 70, handY + 44, mini)
	drawHand(doc, 'S', board.hands.S, handX + 35, handY + 88, mini)
}

function drawBoardPage(doc, boards, meta) {
	const pageW = 210
	const pageH = 297
	const margin = 12
	doc.setFillColor(255, 255, 255)
	doc.rect(0, 0, pageW, pageH, 'F')
	const slotH = 132
	const gap = 8
	boards.forEach((board, index) => {
		drawCompactBoard(doc, board, meta, margin, 10 + index * (slotH + gap), pageW - margin * 2, slotH)
	})

	doc.setFont('helvetica', 'normal')
	doc.setFontSize(7.5)
	doc.setTextColor(100, 116, 139)
	doc.text(safeText(`${meta.event || ''} ${meta.site || ''} ${meta.date || ''}`), pageW / 2, 286, {
		align: 'center',
	})
}

export async function generateGenerator2Pdf(boards, meta = {}) {
	if (!Array.isArray(boards) || !boards.length) throw new Error('No boards provided')
	const { jsPDF } = await import('jspdf')
	const doc = new jsPDF({ unit: 'mm', format: 'a4' })
	for (let index = 0; index < boards.length; index += 2) {
		if (index > 0) doc.addPage()
		drawBoardPage(doc, boards.slice(index, index + 2), meta)
	}
	const filename = `bbc-generator2-${fileDate()}-teacher.pdf`
	doc.save(filename)
	return { filename }
}
