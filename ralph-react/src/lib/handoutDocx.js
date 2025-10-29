// Deterministic Word .docx exporter using the `docx` library.
// One board per page, hard page breaks, cross layout with mini-makeables, and compact top metadata.

import {
	AlignmentType,
	BorderStyle,
	Document,
	HeadingLevel,
	PageBreak,
	Packer,
	Paragraph,
	Tab,
	TabStopType,
	SectionType,
	ShadingType,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType,
} from 'docx'

const suitIcon = (s) => ({ S: '♠', H: '♥', D: '♦', C: '♣', NT: 'NT' }[s] || s)
const isRed = (s) => s === 'H' || s === 'D'

const monoRun = (text, size = 16) =>
	new TextRun({ text, font: 'Courier New', size, color: '111827' })

const labelRun = (text, opts = {}) =>
	new TextRun({ text, bold: true, color: '374151', size: 17, ...opts })

const smallRun = (text) => new TextRun({ text, size: 17, color: '374151' }) // 8.5pt

const seatTitle = (title, isDealer) =>
	new Paragraph({
		alignment: AlignmentType.LEFT,
		spacing: { after: 80 },
		children: [
			new TextRun({ text: title, bold: true, size: 32 }),
			...(isDealer
				? [new TextRun({ text: '  (dealer)', size: 18, color: '6b7280' })]
				: []),
		],
	})

const seatLine = (suitChar, red, ranks) =>
	new Paragraph({
		alignment: AlignmentType.LEFT,
		spacing: { before: 40, after: 40 },
		indent: { left: 120 }, // tiny left indent for visual padding
		tabStops: [{ type: TabStopType.LEFT, position: 720 }], // align ranks to a fixed column (~0.5")
		children: [
			new TextRun({
				text: suitChar,
				bold: true,
				size: 32,
				color: red ? 'c81e1e' : '111827',
			}),
			new Tab(),
			monoRun(ranks, 32),
		],
	})

function ranksFor(cards, suitName) {
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
	const inSuit = (cards || []).filter((c) => c.suit === suitName)
	const sorted = [...inSuit].sort(
		(a, b) => (order[b.rank] || 0) - (order[a.rank] || 0)
	)
	// Display Ten as "10" for consistency in documents
	return sorted.map((c) => String(c.rank)).join('') || '—'
}

function seatBlock(id, d) {
	const dealerId = String(d?.dealer || '')
		.toUpperCase()
		.charAt(0)
	const cards = d.hands?.[id] || []
	const lines = [
		seatTitle(
			{ N: 'North', E: 'East', S: 'South', W: 'West' }[id] || id,
			dealerId === id
		),
		seatLine('♠', false, ranksFor(cards, 'Spades')),
		seatLine('♥', true, ranksFor(cards, 'Hearts')),
		seatLine('♦', true, ranksFor(cards, 'Diamonds')),
		seatLine('♣', false, ranksFor(cards, 'Clubs')),
	]
	// subtle partnership shading
	const fill = id === 'N' || id === 'S' ? 'F8FAFC' : 'FAFAFA'
	return new TableCell({
		shading: { type: ShadingType.CLEAR, color: 'auto', fill },
		borders: {
			top: { style: BorderStyle.NONE },
			bottom: { style: BorderStyle.NONE },
			left: { style: BorderStyle.NONE },
			right: { style: BorderStyle.NONE },
		},
		margins: { top: 140, bottom: 140, left: 140, right: 140 },
		children: lines,
	})
}

function miniMakeables(snap) {
	const tableData = snap && snap.table ? snap.table : null
	const strains = ['S', 'H', 'D', 'C', 'NT']
	const seats = ['N', 'E', 'S', 'W']
	const rows = []
	// header
	rows.push(
		new TableRow({
			children: [
				new TableCell({
					children: [
						new Paragraph({ children: [labelRun('Suit', { size: 18 })] }),
					],
				}),
				...seats.map(
					(s) =>
						new TableCell({
							children: [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									children: [labelRun(s, { size: 18 })],
								}),
							],
						})
				),
			],
		})
	)
	for (const st of strains) {
		const icon = st === 'NT' ? 'NT' : suitIcon(st)
		const iconRun = new TextRun({
			text: icon,
			bold: true,
			size: 18,
			color: isRed(st) ? 'c81e1e' : '111827',
		})
		const cells = [
			new TableCell({ children: [new Paragraph({ children: [iconRun] })] }),
		]
		for (const seat of seats) {
			const raw = tableData?.[st]?.[seat]
			const v = Number.isFinite(raw) ? Math.max(0, raw - 6) : ''
			cells.push(
				new TableCell({
					children: [
						new Paragraph({
							alignment: AlignmentType.CENTER,
							children: [monoRun(String(v), 18)],
						}),
					],
				})
			)
		}
		rows.push(new TableRow({ children: cells }))
	}
	return new Table({
		width: { size: 60, type: WidthType.PERCENTAGE },
		alignment: AlignmentType.CENTER,
		borders: {
			top: { style: BorderStyle.NONE },
			bottom: { style: BorderStyle.NONE },
			left: { style: BorderStyle.NONE },
			right: { style: BorderStyle.NONE },
			insideH: { style: BorderStyle.NONE },
			insideV: { style: BorderStyle.NONE },
		},
		rows,
	})
}

function crossTable(d) {
	const snap = d?.meta?.grid_snapshot || d._gridSnapshot || null
	return new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		alignment: AlignmentType.CENTER,
		borders: {
			top: { style: BorderStyle.NONE },
			bottom: { style: BorderStyle.NONE },
			left: { style: BorderStyle.NONE },
			right: { style: BorderStyle.NONE },
			insideH: { style: BorderStyle.NONE },
			insideV: { style: BorderStyle.NONE },
		},
		rows: [
			new TableRow({
				children: [
					new TableCell({
						verticalAlign: 'center',
						children: [new Paragraph('')],
						borders: {
							top: { style: BorderStyle.NONE },
							bottom: { style: BorderStyle.NONE },
							left: { style: BorderStyle.NONE },
							right: { style: BorderStyle.NONE },
						},
					}),
					seatBlock('N', d),
					new TableCell({
						verticalAlign: 'center',
						children: [new Paragraph('')],
						borders: {
							top: { style: BorderStyle.NONE },
							bottom: { style: BorderStyle.NONE },
							left: { style: BorderStyle.NONE },
							right: { style: BorderStyle.NONE },
						},
					}),
				],
			}),
			new TableRow({
				children: [
					seatBlock('W', d),
					new TableCell({
						borders: {
							top: { style: BorderStyle.NONE },
							bottom: { style: BorderStyle.NONE },
							left: { style: BorderStyle.NONE },
							right: { style: BorderStyle.NONE },
						},
						children: [miniMakeables(snap)],
					}),
					seatBlock('E', d),
				],
			}),
			new TableRow({
				children: [
					new TableCell({
						verticalAlign: 'center',
						children: [new Paragraph('')],
						borders: {
							top: { style: BorderStyle.NONE },
							bottom: { style: BorderStyle.NONE },
							left: { style: BorderStyle.NONE },
							right: { style: BorderStyle.NONE },
						},
					}),
					seatBlock('S', d),
					new TableCell({
						verticalAlign: 'center',
						children: [new Paragraph('')],
						borders: {
							top: { style: BorderStyle.NONE },
							bottom: { style: BorderStyle.NONE },
							left: { style: BorderStyle.NONE },
							right: { style: BorderStyle.NONE },
						},
					}),
				],
			}),
		],
	})
}

function topHeader(d) {
	return new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		borders: {
			top: { style: BorderStyle.NONE },
			bottom: { style: BorderStyle.NONE },
			left: { style: BorderStyle.NONE },
			right: { style: BorderStyle.NONE },
		},
		rows: [
			new TableRow({
				children: [
					new TableCell({
						width: { size: 50, type: WidthType.PERCENTAGE },
						borders: {
							top: { style: BorderStyle.NONE },
							bottom: { style: BorderStyle.NONE },
							left: { style: BorderStyle.NONE },
							right: { style: BorderStyle.NONE },
						},
						children: [
							new Paragraph({
								children: [
									new TextRun({
										text: `Board ${String(d.number)}`,
										bold: true,
										size: 28,
									}),
								],
							}),
						],
					}),
					new TableCell({
						width: { size: 50, type: WidthType.PERCENTAGE },
						borders: {
							top: { style: BorderStyle.NONE },
							bottom: { style: BorderStyle.NONE },
							left: { style: BorderStyle.NONE },
							right: { style: BorderStyle.NONE },
						},
						children: [
							new Paragraph({
								alignment: AlignmentType.RIGHT,
								children: [
									smallRun(
										`Dealer: ${d.dealer || ''}   Vul: ${d.vul || 'None'}`
									),
								],
							}),
						],
					}),
				],
			}),
		],
	})
}

function topMeta(d) {
	const meta = d.meta || {}
	const notes = (d.notes || []).length ? d.notes : ['—']
	const contract = deriveContract(d)
	const kv = [
		['Event', meta.event],
		['Site', meta.site || meta.siteChoice],
		['Date', meta.date],
		['Theme', meta.theme],
		['System', meta.system],
		['Interf', meta.interf],
		['Lead', meta.lead],
		['DDPar', meta.ddpar || meta.DDPar || meta.ddPar],
		['Scoring', meta.scoring || 'MPs'],
		['Contract', contract || '—'],
		['Declarer', meta.declarer || d.declarer || '—'],
	]
	const notesCell = new TableCell({
		width: { size: 65, type: WidthType.PERCENTAGE },
		borders: {
			top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
			bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
			left: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
			right: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
		},
		children: [
			new Paragraph({ children: [labelRun('Notes')] }),
			...notes.map(
				(line) =>
					new Paragraph({
						spacing: { after: 60 },
						children: [smallRun(String(line))],
					})
			),
		],
	})
	const detailsRows = [
		new TableRow({
			children: [
				new TableCell({
					borders: {
						top: { style: BorderStyle.NONE },
						bottom: { style: BorderStyle.NONE },
						left: { style: BorderStyle.NONE },
						right: { style: BorderStyle.NONE },
					},
					children: [new Paragraph({ children: [labelRun('Details')] })],
				}),
			],
		}),
		...kv.map(
			([k, v]) =>
				new TableRow({
					children: [
						new TableCell({
							borders: {
								top: { style: BorderStyle.NONE },
								bottom: { style: BorderStyle.NONE },
								left: { style: BorderStyle.NONE },
								right: { style: BorderStyle.NONE },
							},
							children: [new Paragraph({ children: [smallRun(k)] })],
						}),
						new TableCell({
							borders: {
								top: { style: BorderStyle.NONE },
								bottom: { style: BorderStyle.NONE },
								left: { style: BorderStyle.NONE },
								right: { style: BorderStyle.NONE },
							},
							children: [
								new Paragraph({ children: [smallRun(v ? String(v) : '—')] }),
							],
						}),
					],
				})
		),
	]
	const detailsTable = new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		borders: {
			top: { style: BorderStyle.NONE },
			bottom: { style: BorderStyle.NONE },
			left: { style: BorderStyle.NONE },
			right: { style: BorderStyle.NONE },
			insideH: { style: BorderStyle.NONE },
			insideV: { style: BorderStyle.NONE },
		},
		rows: detailsRows,
	})
	const detailsCell = new TableCell({
		width: { size: 35, type: WidthType.PERCENTAGE },
		borders: {
			top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
			bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
			left: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
			right: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
		},
		children: [detailsTable],
	})
	return new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		rows: [new TableRow({ children: [notesCell, detailsCell] })],
	})
}

function sectionTitle(text) {
	return new Paragraph({
		spacing: { before: 200, after: 80 },
		children: [new TextRun({ text, bold: true, size: 20 })],
	})
}

function monoParagraph(text) {
	return new Paragraph({
		spacing: { after: 60 },
		children: [new TextRun({ text, font: 'Courier New', size: 18 })],
	})
}

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
	const trailer = calls
		.slice(calls.lastIndexOf(last) + 1, calls.lastIndexOf(last) + 4)
		.map((c) => c.toUpperCase())
	const hasXX = trailer.includes('XX')
	const hasX = trailer.includes('X')
	return `${level}${strain}${hasXX ? 'XX' : hasX ? 'X' : ''}`
}

export async function generateHandoutDOCX(deals, options = {}) {
	const { filenameBase = 'handout' } = options
	if (!Array.isArray(deals) || !deals.length)
		throw new Error('No deals provided')

	// Single section; insert hard PageBreak paragraphs between boards for exact pagination.
	const children = []
	deals.forEach((d, idx) => {
		children.push(
			topHeader(d),
			new Paragraph({ spacing: { after: 80 } }),
			topMeta(d),
			new Paragraph({ spacing: { after: 120 } }),
			crossTable(d)
		)
		// Extra breathing room below the cross
		children.push(new Paragraph({ spacing: { after: 120 } }))

		// Auction section (if present) — single-line plain text
		const calls = Array.isArray(d.calls) ? d.calls : []
		if (calls.length) {
			children.push(sectionTitle('Auction'))
			const auctionLine = calls
				.map(String)
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim()
			children.push(monoParagraph(auctionLine))
		}
		// Play Script section (if present) — single-line, strip seat prefixes like N:/E:/S:/W:
		const play = d.meta?.play || d.meta?.playscript || d.meta?.playScript
		if (play) {
			children.push(sectionTitle('Play'))
			let playLine = ''
			if (Array.isArray(play)) {
				playLine = play
					.map(String)
					.map((s) => s.replace(/^\s*(?:N|E|S|W):\s*/i, ''))
					.join(' ')
			} else {
				playLine = String(play)
					.replace(/\r?\n/g, ' ')
					.replace(/\b(?:N|E|S|W):\s*/gi, '')
			}
			playLine = playLine.replace(/\s+/g, ' ').trim()
			if (playLine) children.push(monoParagraph(playLine))
		}
		if (idx < deals.length - 1) {
			children.push(new Paragraph({ children: [new PageBreak()] }))
		}
	})

	const doc = new Document({
		sections: [
			{
				properties: {},
				children,
			},
		],
	})

	const blob = await Packer.toBlob(doc)
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
	a.href = url
	a.download = `${filenameBase}-${dateStr}.docx`
	a.click()
	URL.revokeObjectURL(url)
	return { filename: a.download }
}

