// PDF handout generation extracted from Player.jsx & DragDropCards
// Exports a single async function generateHandoutPDF(deals, options)
// options: { mode: 'basic'|'full', filenameBase, autoNotes }
// Always renders 2 boards per page per latest spec.

import { normalizeAndSanitizeNotes } from './sanitize'

export async function generateHandoutPDF(deals, options = {}) {
	const {
		mode = 'basic',
		filenameBase = 'handout',
		autoNotes = false,
		copyright: copyrightOverride,
		includeMetadata = false,
		includeMakeableGrid = true,
	} = options
	if (!Array.isArray(deals) || !deals.length)
		throw new Error('No deals provided')

	const { jsPDF } = await import('jspdf')
	const doc = new jsPDF({ unit: 'mm', format: 'a4' })

	// Register a small embedded monospaced font for reliable rank alignment.
	// Using jsPDF's built-in Courier can still vary across viewers; embedding avoids that.
	try {
		// Font embedding intentionally skipped to keep bundle slim.
		// If needed in future, add TTF via addFileToVFS/addFont here.
	} catch {
		/* ignore embedding errors; fallback to built-in */
	}
	const pageW = 210
	const pageH = 297
	const marginX = 12
	const blocksPerPage = 2 // fixed as requested
	const usableH = pageH - marginX * 2
	const blockH = usableH / blocksPerPage - 4
	let boardOnPage = 0
	const suitOrderDisplay = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
	const rankOrder = {
		A: 14,
		K: 13,
		Q: 12,
		J: 11,
		T: 10,
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

	// Do not compute new DD tables here; PDF should use stored snapshot for determinism
	const sortDisplay = (arr) =>
		[...arr].sort((a, b) => rankOrder[b.rank] - rankOrder[a.rank])
	const rankString = (cards, suit) => {
		const arr = sortDisplay(cards.filter((c) => c.suit === suit))
		if (!arr.length) return '—'
		// Always display Ten as "10" (not "T") for readability consistency
		return arr.map((c) => String(c.rank)).join('')
	}
	const drawSuitIcon = (docRef, suit, x, y, size = 3.6) => {
		const half = size / 2
		if (suit === 'Hearts' || suit === 'Diamonds') docRef.setFillColor(190, 0, 0)
		else docRef.setFillColor(0, 0, 0)
		if (suit === 'Diamonds') {
			docRef.triangle(x + half, y, x + size, y + half, x + half, y + size, 'F')
			docRef.triangle(x + half, y, x, y + half, x + half, y + size, 'F')
			return
		}
		if (suit === 'Clubs') {
			const r = half * 0.55
			docRef.circle(x + half, y + r, r, 'F')
			docRef.circle(x + r, y + half + r * 0.1, r, 'F')
			docRef.circle(x + size - r, y + half + r * 0.1, r, 'F')
			docRef.rect(x + half - r * 0.35, y + half, r * 0.7, half + r * 0.6, 'F')
			return
		}
		if (suit === 'Hearts') {
			const r = half * 0.6
			docRef.circle(x + half - r * 0.55, y + r, r, 'F')
			docRef.circle(x + half + r * 0.55, y + r, r, 'F')
			docRef.triangle(
				x + half,
				y + size,
				x + size,
				y + r + r * 0.2,
				x,
				y + r + r * 0.2,
				'F',
			)
			return
		}
		if (suit === 'Spades') {
			const r = half * 0.6
			docRef.circle(x + half - r * 0.55, y + half, r, 'F')
			docRef.circle(x + half + r * 0.55, y + half, r, 'F')
			docRef.triangle(
				x + half,
				y,
				x + size,
				y + half + r * 0.2,
				x,
				y + half + r * 0.2,
				'F',
			)
			docRef.rect(
				x + half - r * 0.35,
				y + half + r * 0.4,
				r * 0.7,
				half + r * 0.6,
				'F',
			)
		}
	}
	const deriveContract = (d) => {
		if (d.contract) return d.contract
		if (Array.isArray(d.calls) && d.calls.length) {
			const bidRe = /^([1-7])(C|D|H|S|NT)$/i
			const calls = d.calls.map(String)
			let lastBidIdx = -1
			for (let i = 0; i < calls.length; i++)
				if (bidRe.test(calls[i])) lastBidIdx = i
			if (lastBidIdx >= 0) {
				const mm = calls[lastBidIdx].toUpperCase().match(bidRe)
				const level = mm[1]
				const strain = mm[2]
				const trailer = calls
					.slice(lastBidIdx + 1, lastBidIdx + 4)
					.map((c) => c.toUpperCase())
				const hasXX = trailer.includes('XX')
				const hasX = trailer.includes('X')
				return `${level}${strain}${hasXX ? 'XX' : hasX ? 'X' : ''}`
			}
		}
		return ''
	}

	// Auction advice fully removed

	// Default: no footer unless explicitly provided
	const copyright = copyrightOverride || ''

	const drawFooter = () => {
		try {
			if (!copyright) return
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(6)
			doc.setTextColor(120, 120, 120)
			doc.text(copyright, pageW / 2, pageH - 4, {
				align: 'center',
				maxWidth: pageW - 20,
			})
			doc.setTextColor(0, 0, 0)
		} catch {
			/* no-op */
		}
	}

	const drawBlock = (dealObj) => {
		const topY = marginX + boardOnPage * (blockH + 6)
		const leftX = marginX
		const availW = pageW - marginX * 2
		// Layout columns
		const notesW = 60 // left comments column width
		const metaW = 0
		const gutter = 4
		const diagramAreaW = Math.max(58, availW - notesW - metaW - gutter * 2)
		const diagramCenterX = leftX + notesW + gutter + diagramAreaW / 2 - 2

		// Header
		doc.setFontSize(11)
		doc.setFont('helvetica', 'bold')
		doc.text(`Board ${dealObj.number ?? ''}`, leftX, topY + 4)

		if (includeMetadata) {
			doc.setFontSize(8)
			doc.setFont('helvetica', 'normal')
			doc.text(
				`Dealer: ${dealObj.dealer || '?'}  Vul: ${dealObj.vul || 'None'}`,
				leftX + 24,
				topY + 4,
			)
		}

		// Comments / notes (left column) with actual cursor measurement
		let cursorY = topY + 14
		let renderedAnyNote = false
		let sanitizedReplacements = 0
		if (
			(mode === 'full' || autoNotes) &&
			dealObj.notes &&
			dealObj.notes.length
		) {
			doc.setFontSize(8)
			doc.setFont('helvetica', 'bold')
			doc.text('Comments', leftX, topY + 10)
			doc.setFont('helvetica', 'normal')
			const maxRenderLines = mode === 'full' ? 42 : 18 // allow a few more lines (wrapped)
			const lineGap = 3.5
			let wrappedLineCount = 0
			for (const raw of dealObj.notes) {
				if (wrappedLineCount >= maxRenderLines) break
				const { text: san, replaced } = normalizeAndSanitizeNotes(raw)
				if (replaced) sanitizedReplacements++
				const base = String(san || '').trim()
				if (!base) continue
				const pieces = doc.splitTextToSize('• ' + base, notesW - 2)
				for (const seg of pieces) {
					if (wrappedLineCount >= maxRenderLines) break
					doc.text(seg, leftX, cursorY, { maxWidth: notesW - 2 })
					cursorY += lineGap
					wrappedLineCount++
					renderedAnyNote = true
				}
			}
		}
		const notesBottomY = renderedAnyNote ? cursorY : topY + 14

		// Diagram positioning: ensure clear gap below notes
		const diagramTopY = Math.max(topY + 26, notesBottomY + 6)
		// Compact seat spacing while enlarging ranks for legibility
		const seatDy = 23
		const seatDx = Math.min(30, diagramAreaW / 2.6)
		const suitLine = 4.8 // vertical spacing per suit row
		const fontRanks = 10.2
		const seatFont = 10.5
		const mono = 'courier' // keep using built-in; embedding is optional above

		const seatData = {
			N: dealObj.hands?.N || [],
			E: dealObj.hands?.E || [],
			S: dealObj.hands?.S || [],
			W: dealObj.hands?.W || [],
		}
		const seatPos = {
			N: [diagramCenterX, diagramTopY - seatDy],
			S: [diagramCenterX, diagramTopY + seatDy],
			W: [diagramCenterX - seatDx, diagramTopY],
			E: [diagramCenterX + seatDx, diagramTopY],
		}
		const drawSeat = (seat) => {
			const [x, y] = seatPos[seat]
			const labelX = x - 1.5
			doc.setFontSize(seatFont)
			doc.setFont('helvetica', 'bold')
			doc.text(seat, labelX, y - 2.2, { align: 'center' })
			doc.setFontSize(fontRanks)
			doc.setFont(mono, 'bold')
			suitOrderDisplay.forEach((suit, i) => {
				const lineY = y + i * suitLine
				drawSuitIcon(doc, suit, x - 19, lineY - 3.3, 3.4)
				doc.text(rankString(seatData[seat], suit) || '—', x - 13.5, lineY, {
					align: 'left',
				})
			})
			doc.setFont('helvetica', 'normal')
		}
		;['N', 'W', 'E', 'S'].forEach(drawSeat)

		// Compute a more accurate bottom for the hand diagram, then start content below it
		// S seat is at diagramTopY + seatDy; there are 4 suit lines spaced by suitLine
		// Bottom line index is 3, so add 3 * suitLine, plus extra breathing room
		const diagramBottomY = diagramTopY + seatDy + suitLine * 3 + 8
		// Auction placed under diagram; must respect actual first bidder (auctionStart) rather than always North.
		let lastContentY = diagramBottomY + 2 // small extra spacing for aesthetics
		if (Array.isArray(dealObj.calls) && dealObj.calls.length) {
			const auctionTop = lastContentY
			doc.setFontSize(7)
			doc.setFont('helvetica', 'bold')
			doc.text('Auction', leftX, auctionTop)
			doc.setFont('helvetica', 'normal')
			const cols = ['N', 'E', 'S', 'W']
			const colWidth = 16
			const tableX = leftX - 2
			cols.forEach((c, i) => doc.text(c, tableX + i * colWidth, auctionTop + 4))
			const seats = ['N', 'E', 'S', 'W']
			const startSeat =
				dealObj.auctionStart || dealObj.auctionDealer || dealObj.dealer || 'N'
			const startIdx = Math.max(0, seats.indexOf(startSeat))
			const rows = []
			dealObj.calls.forEach((call, idx) => {
				const absoluteSeatIdx = (startIdx + idx) % 4
				const rowIdx = Math.floor((startIdx + idx) / 4)
				if (!rows[rowIdx]) rows[rowIdx] = new Array(4).fill('')
				rows[rowIdx][absoluteSeatIdx] = String(call)
			})
			rows.forEach((row, r) => {
				row.forEach((call, col) => {
					if (!call) return
					doc.text(call, tableX + col * colWidth, auctionTop + 8 + r * 4)
				})
			})
			lastContentY = auctionTop + 8 + rows.length * 4 + 2
		}

		// Attach per-block preflight summary to the deal object for caller visibility
		dealObj._pdfPreflight = { notesReplacements: sanitizedReplacements }
	}

	deals.forEach((d, i) => {
		if (i > 0 && i % 2 === 0) {
			drawFooter()
			doc.addPage()
			boardOnPage = 0
		}
		drawBlock(d)
		boardOnPage++
		// After finishing a page worth (2 blocks) OR last deal, draw footer
		const endOfPage = boardOnPage === 2 || i === deals.length - 1
		if (endOfPage) drawFooter()
	})

	const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
	const outName = `${filenameBase || 'handout'}-${dateStr}${
		mode === 'full' ? '-full' : ''
	}.pdf`
	doc.save(outName)
	const totalRepl = deals.reduce(
		(sum, d) => sum + (d?._pdfPreflight?.notesReplacements || 0),
		0,
	)
	return { filename: outName, preflight: { notesReplacements: totalRepl } }
}

