// Structured RTF exporter tailored for Apple Pages (tables for header/meta/cross)

function esc(s = '') {
	return String(s)
		.replace(/\\/g, '\\\\')
		.replace(/{/g, '\\{')
		.replace(/}/g, '\\}')
		.replace(/\n/g, '\\line ')
}

function toRankLine(cards, suitName) {
	const order = {
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
	const arr = (cards || []).filter((c) => c.suit === suitName)
	arr.sort((a, b) => (order[b.rank] || 0) - (order[a.rank] || 0))
	return arr.length ? arr.map((c) => String(c.rank)).join('') : '-'
}

function seatBlockRTF(seatId, d) {
	const cards = d.hands?.[seatId] || []
	const seatName =
		{ N: 'North', E: 'East', S: 'South', W: 'West' }[seatId] || seatId
	const dealer =
		String(d.dealer || '')
			.toUpperCase()
			.charAt(0) === seatId
	const title = `{\\fs26\\b ${esc(seatName)}}${
		dealer ? ` ${esc('(dealer)')}` : ''
	}`
	// RTF Unicode escapes for suit symbols to avoid mojibake in Pages
	const U = {
		spade: '\\u9824?',
		heart: '\\u9829?',
		diamond: '\\u9830?',
		club: '\\u9827?',
	}
	const line = (sym, colorCmd, ranks) =>
		`\\fs28\\b ${colorCmd}${sym}\\cf0\\tab {\\f1 \\fs24 ${esc(ranks)}}`
	const s = toRankLine(cards, 'Spades')
	const h = toRankLine(cards, 'Hearts')
	const dmd = toRankLine(cards, 'Diamonds')
	const c = toRankLine(cards, 'Clubs')
	// Hearts/Diamonds use color index 1 (red) from color table
	return `${title}\\line ${line(U.spade, '', s)}\\line ${line(
		U.heart,
		'\\cf1 ',
		h
	)}\\line ${line(U.diamond, '\\cf1 ', dmd)}\\line ${line(U.club, '', c)}`
}

// Compact metadata grid (4 rows x 2 columns) with small font under header
function deriveContract(d) {
	if (d?.meta?.contract) return String(d.meta.contract)
	if (d.contract) return String(d.contract)
	const calls = Array.isArray(d.calls) ? d.calls.map(String) : []
	const bidRe = /^([1-7])(C|D|H|S|NT)$/i
	let last = ''
	for (let i = 0; i < calls.length; i++)
		if (bidRe.test(calls[i])) last = calls[i]
	if (!last) return ''
	const mm = last.toUpperCase().match(bidRe)
	const level = mm[1]
	const strain = mm[2]
	const idx = calls.lastIndexOf(last)
	const trailer = calls.slice(idx + 1, idx + 4).map((c) => c.toUpperCase())
	const hasXX = trailer.includes('XX')
	const hasX = trailer.includes('X')
	return `${level}${strain}${hasXX ? 'XX' : hasX ? 'X' : ''}`
}

// meta grid removed per new layout

function notesRTF(d) {
	const notes = Array.isArray(d.notes)
		? d.notes
		: d.meta?.notes
		? [d.meta.notes]
		: []
	const text = notes.length ? esc(notes.join('\n')) : '-'
	// Merged two-cell row across the full width to be robust in Pages
	const colW = [5000, 5000]
	const cellProps = ['\\clmgf', '\\clmrg']
	const content = ` {\\fs30\\b Notes}\\line {\\fs24 ${text}}`
	return rtfRow(colW, [`${content}`, ``], cellProps)
}

// Build an RTF table row: cellWidths in twips, cells content as raw RTF strings
function rtfRow(cellWidths, cellContents, cellProps) {
	// borderless row with small cell padding
	let out = `\\trowd\\trgaph108\\trleft0\\trbrdrt\\brdrnil\\trbrdrl\\brdrnil\\trbrdrr\\brdrnil\\trbrdrb\\brdrnil`
	let acc = 0
	for (let i = 0; i < cellWidths.length; i++) {
		const props = cellProps && cellProps[i] ? cellProps[i] : ''
		acc += Math.round(cellWidths[i])
		out += `\\clbrdrt\\brdrnil\\clbrdrl\\brdrnil\\clbrdrr\\brdrnil\\clbrdrb\\brdrnil${props}\\cellx${Math.round(
			acc
		)}`
	}
	for (let i = 0; i < cellContents.length; i++) {
		out += `{\\pard\\intbl ${cellContents[i]}\\cell}`
	}
	out += `\\row `
	return out
}

// Generic row builder for nested tables (no forced border resets)
function rtfRowInner(cellWidths, cellContents, cellProps, rowProps = '') {
	let out = `\\trowd\\trgaph90\\trleft0${rowProps}`
	let acc = 0
	for (let i = 0; i < cellWidths.length; i++) {
		const props = cellProps && cellProps[i] ? cellProps[i] : ''
		acc += Math.round(cellWidths[i])
		out += `${props}\\cellx${Math.round(acc)}`
	}
	for (let i = 0; i < cellContents.length; i++) {
		out += `{\\pard\\intbl ${cellContents[i]}\\cell}`
	}
	out += `\\row `
	return out
}

function miniMakeablesRTF(d) {
	const snap = d?.meta?.grid_snapshot || d._gridSnapshot || null
	const table = snap && snap.table ? snap.table : null
	const strains = ['S', 'H', 'D', 'C', 'NT']
	const seats = ['N', 'E', 'S', 'W']
	if (!table) return `{\\i unavailable}`

	// inner table widths (twips) sum to fit center cell (~3333 twips)
	const colW = [700, 650, 650, 650, 650]
	const grid =
		'\\clbrdrt\\brdrs\\brdrw8\\clbrdrl\\brdrs\\brdrw8\\clbrdrr\\brdrs\\brdrw8\\clbrdrb\\brdrs\\brdrw8'
	const headerProps = [`${grid}\\clcbpat4`, grid, grid, grid, grid]
	const header = rtfRowInner(
		colW,
		[
			`{\\ql {\\b \\fs22 Suit}}`,
			...seats.map((s) => `{\\ql {\\b \\fs18 ${s}}}`),
		],
		headerProps
	)

	const rows = strains
		.map((st) => {
			const icon = st === 'NT' ? 'NT' : st
			const suitText = st === 'H' || st === 'D' ? `\\cf1 ${icon}\\cf0` : icon
			const vals = seats.map((seat) => {
				const raw = table?.[st]?.[seat]
				const v = Number.isFinite(raw) ? Math.max(0, raw - 6) : 0
				return `{\\qc \\fs20\\b {\\f1 ${esc(String(v))}}}`
			})
			const props = [grid, grid, grid, grid, grid]
			return rtfRowInner(colW, [`{\\qc \\fs16 ${suitText}}`, ...vals], props)
			return rtfRowInner(colW, [`{\\qc \\fs20\\b ${suitText}}`, ...vals], props)
		})
		.join('')

	return header + rows
}

function auctionRoundsTableRTF(d) {
	const calls = Array.isArray(d.calls) ? d.calls.map(String) : []
	const seats = ['N', 'E', 'S', 'W']
	const start = Math.max(
		0,
		seats.indexOf(String(d.dealer || 'N').toUpperCase())
	)
	const grid =
		'\\clbrdrt\\brdrs\\brdrw8\\clbrdrl\\brdrs\\brdrw8\\clbrdrr\\brdrs\\brdrw8\\clbrdrb\\brdrs\\brdrw8'
	const colW = [2500, 2500, 2500, 2500]
	const headerProps = [
		grid + '\\clcbpat4',
		grid + '\\clcbpat4',
		grid + '\\clcbpat4',
		grid + '\\clcbpat4',
	]
	const header = rtfRowInner(
		colW,
		seats.map((s) => `{\\ql {\\b \\fs22 ${s}}}`),
		headerProps
	)
	// Build rows with rotation from dealer; blanks before dealer in first row
	const rows = []
	if (calls.length === 0) {
		// produce a few empty rows
		for (let i = 0; i < 4; i++) rows.push(['', '', '', ''])
	} else {
		let col = start
		let current = ['', '', '', '']
		// pre-blanks before dealer in first round
		for (let i = 0; i < start; i++) current[i] = ''
		for (let i = 0; i < calls.length; i++) {
			const disp = calls[i] === 'P' ? 'Pass' : calls[i]
			current[col] = `\\fs22\\b {\\f1 ${esc(String(disp))}}`
			col = (col + 1) % 4
			if (col === start) {
				rows.push(current)
				current = ['', '', '', '']
			}
		}
		// push any partial row
		if (current.some((c) => c !== '')) rows.push(current)
	}
	const body = rows
		.map((r) =>
			rtfRowInner(
				colW,
				r.map((c) => `{\\qc ${c}}`),
				[grid, grid, grid, grid]
			)
		)
		.join('')
	return header + body
}

function renderBoard(d) {
	const pageWidth = 10000 // twips (approx)
	const notesRow = notesRTF(d)
	const spacer = `\\pard\\sb40 \\par `
	// Cross layout 3x3: N centered on row 1, W/E on row 2, S centered on row 3
	const north = seatBlockRTF('N', d)
	const south = seatBlockRTF('S', d)
	const east = seatBlockRTF('E', d)
	const west = seatBlockRTF('W', d)
	const center = ``
	const crossRow1 = rtfRow(
		[pageWidth / 3, pageWidth / 3, pageWidth / 3],
		[``, north, ``],
		[``, `\\clcbpat2`, ``]
	)
	const crossRow2 = rtfRow(
		[pageWidth / 3, pageWidth / 3, pageWidth / 3],
		[`{\\qr ${west}}`, center, east],
		[`\\clcbpat3`, ``, `\\clcbpat3`]
	)
	const crossRow3 = rtfRow(
		[pageWidth / 3, pageWidth / 3, pageWidth / 3],
		[``, south, ``],
		[``, `\\clcbpat2`, ``]
	)
	let out = ''
	// Notes at top
	out += notesRow
	out += spacer
	// Seats in cross
	out += crossRow1 + crossRow2 + crossRow3
	// Makeables grid below, centered
	const makeablesBlock = miniMakeablesRTF(d)
	if (makeablesBlock) {
		out += spacer + `\\pard\\ql {\\b \\fs28 Makeables}\\par `
		out += `\\pard\\qc ` + makeablesBlock + `\\par `
	}
	// Bidding table (rounds)
	const auctionTbl = auctionRoundsTableRTF(d)
	out += spacer + `{\\pard\\ql {\\b \\fs28 Auction}\\par }` + auctionTbl
	return out
}

export async function generateHandoutRTF(deals, options = {}) {
	if (!Array.isArray(deals) || !deals.length)
		throw new Error('No deals provided')
	const { filenameBase = 'handout' } = options
	// color table: [auto]; red (idx1); NS gray (idx2); EW gray (idx3); header blue (idx4)
	const header =
		'{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}{\\f1 Courier New;}}{\\colortbl;\\red220\\green38\\blue38;\\red240\\green240\\blue240;\\red228\\green228\\blue228;\\red218\\green235\\blue252;}\\paperw11906\\paperh16838\\margl720\\margr720\\margt720\\margb720'
	const blocks = deals.map(renderBoard)
	let body = ''
	for (let i = 0; i < blocks.length; i++) {
		body += blocks[i]
		// Strict one board per page: add page break between boards, not after the last
		if (i < blocks.length - 1) body += '\\page '
	}
	const rtf = header + body + '}'
	const blob = new Blob([rtf], { type: 'application/rtf' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
	a.href = url
	a.download = `${filenameBase}-${dateStr}.rtf`
	a.click()
	URL.revokeObjectURL(url)
	return { filename: a.download }
}

