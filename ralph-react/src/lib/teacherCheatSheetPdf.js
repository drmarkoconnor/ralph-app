// Generates a single-page (A4) App Usage Guide PDF
// Replaces earlier ACOL cheat sheet with a practical guide to using the Generator and Player modules.
// Audience: Teachers running a session; quick reference to workflow and feature toggles.

export async function generateTeacherCheatSheetPDF(options = {}) {
	const { filename = 'ralph-app-usage-guide' } = options
	const { jsPDF } = await import('jspdf')
	const doc = new jsPDF({ unit: 'mm', format: 'a4' })
	const pageW = 210
	const margin = 10
	let y = margin

	const sanitize = (t) =>
		String(t)
			.replace(/[“”]/g, '"')
			.replace(/[‘’]/g, "'")
			.replace(/[–—]/g, '-')
			.replace(/≥/g, '>=')
			.replace(/≤/g, '<=')
			.replace(/…/g, '...')
			.replace(
				/♠|♥|♦|♣/g,
				(m) => ({ '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' }[m])
			)
			// Allow © symbol else convert to (c)
			.replace(/©/g, '(c)')
			.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
			.trim()
	const BULLET = '-'

	const section = (title, bullets, opts = {}) => {
		const { twoCol = false, small = false } = opts
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(11)
		doc.text(sanitize(title), margin, y)
		y += 4
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(small ? 7 : 8)
		const maxWidth = pageW - margin * 2

		if (twoCol) {
			const colW = (maxWidth - 6) / 2
			let leftY = y
			let rightY = y
			bullets.forEach((raw, i) => {
				const b = sanitize(raw)
				const targetX = margin + (i % 2 === 0 ? 0 : colW + 6)
				const targetY = i % 2 === 0 ? leftY : rightY
				const lines = doc.splitTextToSize(BULLET + ' ' + b, colW)
				lines.forEach((ln, idx) => {
					doc.text(ln, targetX, targetY + idx * 3.6)
				})
				const used = lines.length * 3.6 + 1.2
				if (i % 2 === 0) leftY += used
				else rightY += used
			})
			y = Math.max(leftY, rightY) + 2
			return
		}
		bullets.forEach((raw) => {
			const b = sanitize(raw)
			if (!b) return
			const lines = doc.splitTextToSize(BULLET + ' ' + b, maxWidth)
			lines.forEach((ln) => {
				doc.text(ln, margin, y)
				y += 3.8
			})
			y += 0.8
		})
		y += 1
	}

	// Header
	doc.setFont('helvetica', 'bold')
	doc.setFontSize(16)
	doc.text('Ralph Bridge App - Usage Guide', pageW / 2, y, { align: 'center' })
	y += 6
	doc.setFontSize(8)
	doc.setFont('helvetica', 'normal')
	doc.text(
		'Generator & Player workflow | Deterministic ACOL advisor | Teaching-focused features',
		pageW / 2,
		y,
		{ align: 'center' }
	)
	y += 6

	section('Generator - Core Flow', [
		'Deal cards manually (drag / select & send / keyboard mode) until all 52 placed.',
		'Click "Save Hand" to snapshot hands + current metadata & notes.',
		'Repeat to accumulate boards; board number, dealer & vulnerability auto-rotate.',
		'Toggle "Full Handout PDF" then export (adds formatted 2-up PDF).',
		'Enable "Auction Advice" to include deterministic ACOL mainline + alternatives.',
		'"Save all to PBN now" downloads cumulative PBN (and PDF if enabled).',
	])

	section('Generator - Metadata & Notes', [
		'Event / Location / Date populate standard PBN tags & PDF header.',
		'Theme: choose preset or "Custom..." for ad-hoc session focus.',
		'System / Interf / Lead / DDPar / Scoring: optional teaching context lines.',
		'Auction (ideal) field: free-form reference; PDF still shows generated advice separately.',
		'Notes box: write teaching bullet(s); "Set Notes" stores snapshot for current board.',
		'Reset Board only clears current unsaved deal; Delete PBN wipes all saved boards.',
	])

	section('Generator - Power Features', [
		'Keyboard Mode: type ranks in suit order; Enter advances; Esc exits.',
		'Random Complete: fills remaining deck randomly (useful baseline).',
		'Dealer buttons realign next board number so chosen seat becomes dealer.',
		'Auction Advice engine: deterministic (no RNG) - consistent session handouts.',
		'PDF sanitises suit symbols to ensure font safety (fallback S H D C if needed).',
		'In-memory caching avoids re-computation across multiple exports.',
	])

	section('Player - Loading & Setup', [
		'Click "Choose PBN..." to load the exported (or any) PBN file.',
		'Boards list shows progress: use Prev / Next to navigate.',
		'If no auction / contract present you can set contract manually (Declarer, Level, Strain, Dbl).',
		'Hide defenders: conceals defender hands & enables auto-play logic for them.',
		'AI difficulty changes defender selection (Basic -> simple low card / lead heuristics).',
		'Signals mode placeholder (Standard / LowEnc) - displayed in AI reasoning tags.',
	])

	section('Player - Play & Planning', [
		'Pre-Play Planning panel prompts sure winners & likely losers before first card.',
		'Submitting plan logs feedback vs reference heuristic counts.',
		'Advice Panel: live declarer feedback (quality + next thought + principle).',
		'Teacher Focus mode darkens chrome & highlights cards / trick display.',
		'Pause at trick end: briefly freezes between tricks - aid discussion.',
		'Completed Tricks panel lists each trick (winner + four cards).',
	])

	section('Player - Navigation & Review', [
		'History controls (<< < > >>) allow stepping through your manual play record.',
		'Adjust planning numbers (winners / losers) before first card if miscounted.',
		'AI Log (when defenders hidden) shows reasoning: seat + chosen card + heuristic.',
		'Auction graphic (top-right) renders raw auction if present (separate from advice).',
		'Score panel auto-updates trick counts & final duplicate score on completion.',
		'Manual contract override persists for current loaded board until file reload.',
	])

	section('Auction Advice Engine (Summary)', [
		'Deterministic ACOL: opens >=12 HCP; major preference; 12-14 1NT.',
		'Responder logic: raises with 3+ support; simple NT responses else.',
		'Generates mainline + up to 2 alternatives with probabilities (88% / remainder split).',
		'Bullets: <=3 concise teaching points (opening rationale, responder action, plan).',
		'Alternatives show comparative responder action & probability weighting.',
		'Caching ensures identical deal always returns identical labelled sequence.',
	])

	section(
		'Tips & Troubleshooting',
		[
			'If PDF misses advice: ensure "Auction Advice" was ticked before export.',
			'Suit symbols fallback automatically if font glyphs absent (display as S H D C).',
			'Long notes auto-wrap; keep to punchy bullets for space efficiency.',
			'Use a fresh browser tab/session if keyboard handler becomes unresponsive.',
			'Deleting PBN is irreversible - download first if in doubt.',
			'Plan numbers are heuristic: encourage recounting rather than memorising output.',
		],
		{ twoCol: true }
	)

	// Footer
	const dateStr = new Date().toISOString().slice(0, 10)
	doc.setFontSize(6.5)
	doc.setFont('helvetica', 'italic')
	const year = new Date().getFullYear()
	const copyright = `(c) ${year} Mark O'Connor. All rights reserved.`
	doc.text(`Generated ${dateStr} | Ralph App Usage Guide`, pageW / 2, 291, {
		align: 'center',
	})
	doc.setFontSize(6)
	doc.text(copyright, pageW / 2, 295, { align: 'center' })

	const out = `${filename}-${dateStr.replace(/-/g, '')}.pdf`
	doc.save(out)
	return out
}

