// PDF handout generation extracted from Player.jsx & DragDropCards
// Exports a single async function generateHandoutPDF(deals, options)
// options: { mode: 'basic'|'full', filenameBase, autoNotes }
// Always renders 2 boards per page per latest spec.

export async function generateHandoutPDF(deals, options = {}) {
	const {
		mode = 'basic',
		filenameBase = 'handout',
		autoNotes = false,
		copyright: copyrightOverride,
	} = options
	if (!Array.isArray(deals) || !deals.length)
		throw new Error('No deals provided')

	// Always attempt to ensure auction advice; even if earlier attempts failed.
	let advisorMod = null
	try {
		advisorMod = await import('./acolAdvisor.js')
	} catch (e) {
		console.warn('[PDF] Failed to load ACOL advisor module', e)
	}
	if (advisorMod && advisorMod.getOrBuildAcolAdvice) {
		deals.forEach((d) => {
			if (d && d.hands && !d.auctionAdvice) {
				try {
					const adv = advisorMod.getOrBuildAcolAdvice(d)
					if (adv) d.auctionAdvice = adv
				} catch (e) {
					console.warn(
						'[PDF] Auction advice build failed for board',
						d.number,
						e
					)
				}
			}
		})
	}
	const { jsPDF } = await import('jspdf')
	const doc = new jsPDF({ unit: 'mm', format: 'a4' })
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
	const sortDisplay = (arr) =>
		[...arr].sort((a, b) => rankOrder[b.rank] - rankOrder[a.rank])
	const rankString = (cards, suit) => {
		const arr = sortDisplay(cards.filter((c) => c.suit === suit))
		if (!arr.length) return '—'
		return arr.map((c) => (c.rank === '10' ? 'T' : c.rank)).join('')
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
				'F'
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
				'F'
			)
			docRef.rect(
				x + half - r * 0.35,
				y + half + r * 0.4,
				r * 0.7,
				half + r * 0.6,
				'F'
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

	// Attempt to load pre-computed auction advice if path / field provided on deal
	const resolveAdviceFor = (dealObj) => {
		// Expect dealObj.dealHash or dealObj.meta.dealHash and global window.__auctionAdvice map OR embedded advice
		if (dealObj.auctionAdvice) return dealObj.auctionAdvice
		try {
			if (typeof window !== 'undefined' && window.__auctionAdvice) {
				const key = dealObj.dealHash || (dealObj.meta && dealObj.meta.dealHash)
				return window.__auctionAdvice[key]
			}
		} catch {}
		return null
	}

	const year = new Date().getFullYear()
	const copyright =
		copyrightOverride || `© ${year} Mark O'Connor. All rights reserved.`

	const drawFooter = () => {
		try {
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
		const notesW = 60 // left notes column width
		const metaW = 55 // right metadata box width
		const gutter = 4
		const diagramAreaW = Math.max(58, availW - notesW - metaW - gutter * 2)
		const diagramCenterX = leftX + notesW + gutter + diagramAreaW / 2
		const metaX = leftX + notesW + gutter + diagramAreaW + gutter

		// Header
		doc.setFontSize(11)
		doc.setFont('helvetica', 'bold')
		doc.text(`Board ${dealObj.number ?? ''}`, leftX, topY + 4)
		doc.setFontSize(8)
		doc.setFont('helvetica', 'normal')
		doc.text(
			`Dealer: ${dealObj.dealer || '?'}  Vul: ${dealObj.vul || 'None'}`,
			leftX + 24,
			topY + 4
		)

		// Metadata summary
		const meta = dealObj.meta || {}
		const contract = deriveContract(dealObj)
		const declarer = dealObj.declarer || meta.declarer || ''
		const theme = meta.theme || meta.themeChoice || ''
		const system = meta.system || ''
		const ddpar = meta.ddpar || meta.DDPar || meta.ddPar || ''
		const lead = meta.lead || ''
		const interf = meta.interf || meta.interference || ''
		const scoring = meta.scoring || ''
		const resultTxt = meta.resultText || dealObj.resultText || ''
		const lineStep = 3.6
		let ly = topY + 6
		const pushMeta = (label, value) => {
			if (!value) return
			doc.setFontSize(6.5)
			doc.text(`${label}: ${value}`, metaX, ly, { maxWidth: metaW - 2 })
			ly += lineStep
		}
		pushMeta('Contract', contract + (declarer ? ` (${declarer})` : ''))
		pushMeta('Theme', theme)
		if (mode === 'full') {
			pushMeta('System', system)
			pushMeta('Interf', interf)
			pushMeta('DDPar', ddpar)
			pushMeta('Lead', lead)
			pushMeta('Scoring', scoring)
			pushMeta('Result', resultTxt)
		} else {
			pushMeta('Lead', lead)
			pushMeta('DDPar', ddpar)
		}

		// Notes (left column) with actual cursor measurement
		let cursorY = topY + 14
		let renderedAnyNote = false
		if (
			(mode === 'full' || autoNotes) &&
			dealObj.notes &&
			dealObj.notes.length
		) {
			doc.setFontSize(8)
			doc.setFont('helvetica', 'bold')
			doc.text('Notes', leftX, topY + 10)
			doc.setFont('helvetica', 'normal')
			const maxRenderLines = mode === 'full' ? 42 : 18 // allow a few more lines (wrapped)
			const lineGap = 3.5
			let wrappedLineCount = 0
			for (const raw of dealObj.notes) {
				if (wrappedLineCount >= maxRenderLines) break
				const base = String(raw || '').trim()
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
		const suitLine = 4.8 // more vertical space for larger rank text
		const fontRanks = 10.2
		const seatFont = 10.5
		const mono = 'helvetica' // switch from courier to helvetica for cleaner look

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
			doc.setFontSize(seatFont)
			doc.setFont('helvetica', 'bold')
			doc.text(seat, x, y - 2.2, { align: 'center' })
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

		// Auction (full mode) placed under diagram spanning notes + diagram width (leave meta column untouched)
		let lastContentY = diagramTopY + seatDy + 10
		if (
			mode === 'full' &&
			Array.isArray(dealObj.calls) &&
			dealObj.calls.length
		) {
			const auctionTop = lastContentY
			doc.setFontSize(7)
			doc.setFont('helvetica', 'bold')
			doc.text('Auction', leftX, auctionTop)
			doc.setFont('helvetica', 'normal')
			const cols = ['N', 'E', 'S', 'W']
			const colWidth = 16
			cols.forEach((c, i) => doc.text(c, leftX + i * colWidth, auctionTop + 4))
			dealObj.calls.forEach((call, idx) => {
				const col = idx % 4
				const r = Math.floor(idx / 4)
				doc.text(String(call), leftX + col * colWidth, auctionTop + 8 + r * 4)
			})
			lastContentY =
				auctionTop + 8 + Math.ceil(dealObj.calls.length / 4) * 4 + 2
		}

		// Integrate auction advice (if available) ALWAYS (basic & full) below auction / diagram
		let advice = resolveAdviceFor(dealObj)
		if (!advice || !advice.auctions || !advice.auctions.length) {
			// Last-chance build attempt per board (sync boundary)
			// We can't await here (drawBlock not async); instead schedule synchronous promise resolution.
			try {
				import('./acolAdvisor.js')
					.then((mod) => {
						if (advice && advice.auctions && advice.auctions.length) return
						if (mod.getOrBuildAcolAdvice && dealObj.hands) {
							const built = mod.getOrBuildAcolAdvice(dealObj)
							if (built) {
								dealObj.auctionAdvice = built
								advice = built
								// NOTE: cannot retroactively draw in same pass; user will see placeholder this page render.
							}
						}
					})
					.catch((e) => {
						console.warn(
							'[PDF] per-board advisor build failed',
							dealObj.number,
							e
						)
					})
			} catch (e) {
				console.warn(
					'[PDF] per-board advisor build scheduling failed',
					dealObj.number,
					e
				)
			}
		}
		if (advice && advice.auctions && advice.auctions.length) {
			// Helper to downgrade Unicode suit symbols to letters if font lacks glyphs
			const pdfBid = (b) =>
				String(b || '')
					.replace(/♠/g, 'S')
					.replace(/♥/g, 'H')
					.replace(/♦/g, 'D')
					.replace(/♣/g, 'C')
					.replace(/^Pass$/i, 'Pass')
			const pdfSeq = (seq) => seq.map(pdfBid)
			// horizontal rule
			doc.setDrawColor(150)
			doc.setLineWidth(0.2)
			doc.line(
				leftX,
				lastContentY + 2,
				leftX + notesW + gutter + diagramAreaW,
				lastContentY + 2
			)
			let y = lastContentY + 5
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(7.5)
			doc.text('Auction Advice (ACOL)', leftX, y)
			y += 3.5
			const main = advice.auctions[advice.recommendation_index || 0]
			// Render 4-column auction table for mainline
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(7)
			doc.text('Mainline Auction', leftX, y)
			y += 3
			doc.setFont('helvetica', 'normal')
			const headerCols = ['N', 'E', 'S', 'W']
			const colW = (notesW + diagramAreaW - 4) / 4
			// table headers
			headerCols.forEach((c, i) => {
				doc.text(c, leftX + 1 + i * colW, y)
			})
			y += 3
			const rows = []
			main.seq.forEach((call, idx) => {
				const r = Math.floor(idx / 4)
				if (!rows[r]) rows[r] = []
				rows[r].push(String(call))
			})
			rows.forEach((r) => {
				const rowCalls = pdfSeq(r)
				rowCalls.forEach((c, i) => {
					doc.text(c, leftX + 1 + i * colW, y)
				})
				y += 3
			})
			y += 1
			// Bullets (≤3)
			doc.setFont('helvetica', 'bold')
			doc.text('Key Points:', leftX, y)
			y += 3
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(6.3)
			main.bullets.slice(0, 3).forEach((b) => {
				const lines = doc.splitTextToSize('• ' + b, notesW + diagramAreaW - 6)
				lines.forEach((line) => {
					doc.text(line, leftX + 1.5, y)
					y += 3
				})
			})
			// Alternatives summary
			const alts = advice.auctions.filter(
				(_, i) => i !== (advice.recommendation_index || 0)
			)
			if (alts.length) {
				y += 1
				doc.setFont('helvetica', 'bold')
				doc.setFontSize(7)
				doc.text('Alternatives', leftX, y)
				y += 3
				doc.setFont('helvetica', 'normal')
				doc.setFontSize(6.2)
				alts.forEach((a) => {
					const prob = (a.prob * 100).toFixed(0) + '%'
					const altRows = []
					a.seq.forEach((call, idx) => {
						const r = Math.floor(idx / 4)
						if (!altRows[r]) altRows[r] = []
						altRows[r].push(pdfBid(call))
					})
					const flat = altRows.map((rw) => rw.join(' ')).join(' | ')
					const line = `${prob}: ${flat}`
					const lines = doc.splitTextToSize(line, notesW + diagramAreaW - 6)
					lines.forEach((l) => {
						doc.text(l, leftX + 1.5, y)
						y += 3
					})
					if (a.bullets && a.bullets.length) {
						const bLine = '• ' + a.bullets[0]
						const split = doc.splitTextToSize(bLine, notesW + diagramAreaW - 6)
						split.forEach((s) => {
							doc.text(s, leftX + 2, y)
							y += 3
						})
					}
				})
			}
		} else {
			// Draw placeholder to make absence visible for debugging
			doc.setFontSize(6.4)
			doc.setFont('helvetica', 'italic')
			doc.text('No auction advice available (debug)', leftX, lastContentY + 6)
		}
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
	return outName
}

