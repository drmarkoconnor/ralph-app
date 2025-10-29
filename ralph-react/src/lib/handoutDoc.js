// Generate a simple .doc file (Word-compatible) using HTML with a .doc mime-type.
// This produces a clean document with NESW aligned using a table and a styled makeables grid.

export async function generateHandoutDOC(deals, options = {}) {
	const { filenameBase = 'handout' } = options
	if (!Array.isArray(deals) || !deals.length)
		throw new Error('No deals provided')

	const escape = (s) => String(s == null ? '' : s)

	const suit = (s) =>
		({
			S: '♠',
			H: '♥',
			D: '♦',
			C: '♣',
			NT: 'NT',
		}[s] || s)

	const suitClass = (s) => (s === 'H' || s === 'D' ? 'red' : 'blk')

	const topMeta = (d) => {
		const meta = d.meta || {}
		const notesHtml = (d.notes || []).length
			? (d.notes || [])
					.map((n) => `<div class="note-line">${escape(n)}</div>`)
					.join('')
			: '<div class="note-line empty">—</div>'
		const kvRow = (k, v) =>
			`<tr><td class="k">${k}</td><td class="v">${
				v ? escape(v) : '—'
			}</td></tr>`
		return `
      <table class="top-meta" role="presentation">
        <tbody>
          <tr>
            <td class="notes-cell">
              <div class="mini-title">Notes</div>
              <div class="notes">${notesHtml}</div>
            </td>
            <td class="meta-cell">
              <div class="mini-title">Details</div>
              <table class="kv" role="presentation">
                <tbody>
                  ${kvRow('Theme', meta.theme)}
                  ${kvRow('System', meta.system)}
                  ${kvRow('Lead', meta.lead)}
                  ${kvRow('DDPar', meta.ddpar || meta.DDPar || meta.ddPar)}
                  ${kvRow('Scoring', meta.scoring)}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>`
	}

	const crossHandsBlock = (d, snap) => {
		const seatCards = (id) => d.hands?.[id] || []
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
		const ranks = (arr, suitName) => {
			const inSuit = arr.filter((c) => c.suit === suitName)
			const sorted = [...inSuit].sort(
				(a, b) => (order[b.rank] || 0) - (order[a.rank] || 0)
			)
			// Display Ten as "10" for consistency
			return sorted.map((c) => String(c.rank)).join('') || '—'
		}
		const dealerId = String(d?.dealer || '')
			.toUpperCase()
			.charAt(0)
		const miniMakeables = (snapIn) => {
			const table = snapIn && snapIn.table ? snapIn.table : null
			const seats = ['N', 'E', 'S', 'W']
			const strains = ['S', 'H', 'D', 'C', 'NT']
			if (!table) return `<div class="mini-empty">unavailable</div>`
			const rows = strains
				.map((st) => {
					const icon =
						st === 'NT'
							? 'NT'
							: `<span class="${suitClass(st)}">${suit(st)}</span>`
					const tds = seats
						.map((seat) => {
							const raw = table?.[st]?.[seat]
							const v = Number.isFinite(raw) ? Math.max(0, raw - 6) : ''
							return `<td>${v}</td>`
						})
						.join('')
					return `<tr><th>${icon}</th>${tds}</tr>`
				})
				.join('')
			return `
        <table class="mini-make" role="presentation">
          <thead><tr><th>Suit</th><th>N</th><th>E</th><th>S</th><th>W</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
		}
		const seatBlock = (id, title) => {
			const cards = seatCards(id)
			const dealerTag =
				dealerId === id ? '<span class="dealer">(dealer)</span>' : ''
			return `
        <div class="seat">
          <div class="seat-title">${title} ${dealerTag}</div>
          <table class="seat-lines">
            <tbody>
              <tr>
                <td class="suit"><span class="blk">${suit('S')}</span></td>
                <td class="ranks mono">${ranks(cards, 'Spades')}</td>
              </tr>
              <tr>
                <td class="suit"><span class="red">${suit('H')}</span></td>
                <td class="ranks mono">${ranks(cards, 'Hearts')}</td>
              </tr>
              <tr>
                <td class="suit"><span class="red">${suit('D')}</span></td>
                <td class="ranks mono">${ranks(cards, 'Diamonds')}</td>
              </tr>
              <tr>
                <td class="suit"><span class="blk">${suit('C')}</span></td>
                <td class="ranks mono">${ranks(cards, 'Clubs')}</td>
              </tr>
            </tbody>
          </table>
        </div>`
		}
		return `
      <table class="cross" role="presentation">
        <tbody>
          <tr>
            <td class="corner empty"></td>
            <td class="north">${seatBlock('N', 'North')}</td>
            <td class="corner empty"></td>
          </tr>
          <tr>
            <td class="west">${seatBlock('W', 'West')}</td>
            <td class="centerTag">${miniMakeables(snap)}</td>
            <td class="east">${seatBlock('E', 'East')}</td>
          </tr>
          <tr>
            <td class="corner empty"></td>
            <td class="south">${seatBlock('S', 'South')}</td>
            <td class="corner empty"></td>
          </tr>
        </tbody>
      </table>`
	}

	// Removed main makeables block in favor of center mini table

	const section = (d) => {
		const snap = d?.meta?.grid_snapshot || d._gridSnapshot || null
		const header = `
      <div class="hdr">
        <div><strong>Board ${escape(d.number)}</strong></div>
        <div>Dealer: ${escape(d.dealer || '')} &nbsp; Vul: ${escape(
			d.vul || 'None'
		)}</div>
      </div>`
		return `
      <div class="board">
        ${header}
        ${topMeta(d)}
        <div class="cross-wrap">${crossHandsBlock(d, snap)}</div>
      </div>`
	}

	const css = `
    <style>
      body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  .board { page-break-inside: avoid; border: 1px solid #ddd; border-radius: 10px; padding: 12px; margin: 0; }
  /* Inter-board page break paragraph (more reliable on Word for Mac) */
  p.page-break { page-break-before: always; mso-break-type: page-break; margin: 0; line-height: 0; font-size: 0; }
  /* Cross wrapper */
  .cross-wrap { margin-top: 6px; }
  .hdr { display:flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
      h4 { margin: 8px 0 6px; }
  .make { width: 100%; border-collapse: collapse; }
  .make th, .make td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; }
  .make thead th { background: #f0f4ff; }
      .suit { width: 28px; font-weight: bold; }
      .red { color: #c81e1e; }
      .blk { color: #111827; }
  .notes { margin: 0; padding: 0; }
  .note-line { margin: 0 0 4px 0; }

  /* Top meta table */
  .top-meta { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 4px 0 6px; }
  .top-meta td { vertical-align: top; border: 1px solid #e5e7eb; padding: 6px 8px; }
  .top-meta .notes-cell { width: 65%; }
  .top-meta .meta-cell { width: 35%; }
  .mini-title { font-weight: 700; color: #374151; margin-bottom: 4px; font-size: 8.5pt; }
  .kv { width: 100%; border-collapse: collapse; }
  .kv td { border: none; padding: 2px 4px; font-size: 8.5pt; }
  .kv .k { width: 38%; color: #6b7280; }
  .kv .v { width: 62%; }
  .notes { min-height: 52px; }
  .note-line.empty { color: #9ca3af; font-style: italic; }

      /* Cross layout */
  .cross { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 2px 0 8px; page-break-inside: avoid; }
  .cross tr, .cross td { page-break-inside: avoid; }
  .cross td { vertical-align: middle; text-align: center; }
  .corner { width: 33.33%; height: 8px; }
  .centerTag { padding: 4px 0; }
  .north, .south, .east, .west { padding: 10px; }
  .north .seat, .south .seat, .east .seat, .west .seat { border: 1.5px solid #d1d5db; border-radius: 10px; padding: 14px; display: inline-block; text-align: left; box-shadow: 0 1px 1px rgba(0,0,0,0.06); background: #fff; }
  /* Subtle partnership shading: NS cool, EW neutral */
  .north .seat, .south .seat { background-color: #f8fafc; }
  .east .seat, .west .seat { background-color: #fafafa; }
  .seat-title { font-weight: 800; text-align: center; margin-bottom: 8px; font-size: 16px; letter-spacing: 0.2px; }
  .seat-title .dealer { font-weight: 600; font-size: 10px; color: #6b7280; margin-left: 4px; }
  .seat-lines { border-collapse: collapse; }
  .seat-lines td { padding: 4px 10px; border: none; }
  .ranks { min-width: 170px; font-size: 16px; letter-spacing: 0.3px; }
  .suit { width: 32px; font-weight: 900; font-size: 16px; }
  /* Mini makeables in center */
  .mini-make { border-collapse: collapse; margin: 0 auto; font-size: 11px; }
  .mini-make th, .mini-make td { border: 1px solid #d1d5db; padding: 2px 4px; text-align: center; }
  .mini-make thead th { background: #f8fafc; font-weight: 600; }
  .mini-empty { font-style: italic; color: #6b7280; font-size: 11px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; }
    </style>`

	const sections = deals.map((d) => section(d))
	// Use a Word-specific page break (MSO) plus a fallback paragraph for non-Word consumers.
	const wordBreak = `<!--[if mso]><p class="page-break" style="page-break-before:always;mso-break-type:page-break;"><span style="mso-special-character:page-break"></span></p><![endif]--><!--[if !mso]><!--><p class="page-break"></p><!--<![endif]-->`
	const html = `<!DOCTYPE html>
  <html><head><meta charset="utf-8"/>${css}</head><body>
    ${sections.join(wordBreak)}
  </body></html>`

	// Create a Word-compatible .doc blob from the HTML
	const blob = new Blob([html], { type: 'application/msword' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
	a.href = url
	a.download = `${filenameBase || 'handout'}-${dateStr}.doc`
	a.click()
	URL.revokeObjectURL(url)
	return { filename: a.download }
}

