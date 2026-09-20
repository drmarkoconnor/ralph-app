import { normalizeCardTheme } from '../player-v2/cardDisplay.js'

export const CARD_THEMES = [
	{
		key: 'broadcast',
		label: 'Broadcast clarity',
		description: 'Largest clean indices for a hall or television.',
		back: 'B1',
	},
	{
		key: 'classic',
		label: 'Classic courts',
		description: 'Crisp vector pips, traditional honours and illustrated aces.',
		back: 'B2',
	},
	{
		key: 'jumbo',
		label: 'Jumbo bridge',
		description: 'Oversized rank and suit with a restrained centre pip.',
		back: 'B1',
	},
	{
		key: 'heritage',
		label: 'Linen heritage',
		description: 'Full traditional artwork with a warmer printed-card finish.',
		back: 'B2',
	},
	{
		key: 'four-colour',
		label: 'Four-colour teaching',
		description: 'Blue diamonds and green clubs make suit changes unmistakable.',
		back: 'B1',
	},
]

const THEME_BY_KEY = Object.fromEntries(CARD_THEMES.map((theme) => [theme.key, theme]))

export function cardTheme(themeKey) {
	return THEME_BY_KEY[normalizeCardTheme(themeKey)] || CARD_THEMES[0]
}

export function cardThemeColourClasses(themeKey, suit) {
	if (normalizeCardTheme(themeKey) === 'four-colour') {
		if (suit === 'Hearts') return 'border-rose-500 text-rose-700'
		if (suit === 'Diamonds') return 'border-blue-500 text-blue-700'
		if (suit === 'Clubs') return 'border-emerald-600 text-emerald-800'
		return 'border-slate-600 text-slate-950'
	}
	return suit === 'Hearts' || suit === 'Diamonds'
		? 'border-rose-400 text-rose-700'
		: 'border-slate-500 text-slate-950'
}
