// Notes sanitizer: normalize and map risky glyphs/tags to safe text for PDF and in-app rendering
// Returns { text, replaced, replacements }
export function normalizeAndSanitizeNotes(input) {
	const original = String(input ?? '')
	let text = original
	let replaced = false
	const replacements = []
	const apply = (re, to) => {
		const before = text
		text = text.replace(re, to)
		if (text !== before) {
			replaced = true
			replacements.push({ from: re.toString(), to })
		}
	}
	try {
		const before = text
		text = text.normalize('NFC')
		if (text !== before) replaced = true
	} catch {}
	// Strip zero-width
	apply(/[\u200B-\u200D\uFEFF]/g, '')
	// NBSP -> space
	apply(/\u00A0/g, ' ')
	// Smart quotes/dashes → ASCII
	apply(/[\u201C\u201D]/g, '"') // double
	apply(/[\u2018\u2019]/g, "'") // single
	apply(/[\u2013\u2014]/g, '-') // en/em dash
	// Bullets to dash
	apply(/[\u2022]/g, '- ')
	// Collapse multiple spaces
	apply(/ {2,}/g, ' ')
	// Basic HTML allowance: convert <br> to \n, strip other tags except basic formatting by unwrapping
	// unify <br> variants
	apply(/<\s*br\s*\/?\s*>/gi, '\n')
	// unwrap allowed tags <p>, <em>, <strong>, <ul>, <ol>, <li>
	apply(/<\/?(p|em|strong|ul|ol)\b[^>]*>/gi, '')
	// <li> -> '- ' prefix + newline if not already at line start
	text = text.replace(/<\s*li\b[^>]*>(.*?)<\s*\/\s*li\s*>/gis, (_, inner) => {
		const innerText = inner.replace(/<[^>]+>/g, '')
		return `- ${innerText}\n`
	})
	// Strip remaining tags
	apply(/<[^>]+>/g, '')
	// Collapse multiple blank lines
	apply(/\n{3,}/g, '\n\n')
	// Trim
	text = text.trim()
	return { text, replaced, replacements }
}

