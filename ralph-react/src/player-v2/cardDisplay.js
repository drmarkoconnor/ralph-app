import { SUIT_ORDER, partnershipSuitOrder } from './bridgeV2.js'

export const CARD_THEME_KEYS = ['broadcast', 'classic', 'jumbo', 'heritage', 'four-colour']

export function normalizeCardTheme(value) {
	return CARD_THEME_KEYS.includes(value) ? value : 'broadcast'
}

export function buildPartnershipSuitLayout({
	hands,
	seats,
	trump,
	presentationMode = false,
}) {
	const order = partnershipSuitOrder(trump)
	const cardWidth = presentationMode ? 118 : 102
	const emptyWidth = presentationMode ? 78 : 66
	const targetWidth = presentationMode ? 1020 : 820
	const maximumStep = presentationMode ? 52 : 46
	const minimumStep = presentationMode ? 31 : 27
	const counts = Object.fromEntries(
		SUIT_ORDER.map((suit) => [
			suit,
			Math.max(
				0,
				...(seats || []).map(
					(seat) => (hands?.[seat] || []).filter((card) => card.suit === suit).length,
				),
			),
		]),
	)
	const baseWidth = order.reduce(
		(total, suit) => total + (counts[suit] > 0 ? cardWidth : emptyWidth),
		0,
	)
	const extraCards = order.reduce((total, suit) => total + Math.max(0, counts[suit] - 1), 0)
	const availableForFans = Math.max(0, targetWidth - baseWidth - 30)
	const step = extraCards
		? Math.max(minimumStep, Math.min(maximumStep, availableForFans / extraCards))
		: maximumStep
	const widths = Object.fromEntries(
		order.map((suit) => [
			suit,
			counts[suit] > 0 ? cardWidth + Math.max(0, counts[suit] - 1) * step : emptyWidth,
		]),
	)

	return { order, counts, widths, cardWidth, step }
}

export function isRedSuitBoundary(previousSuit, nextSuit) {
	return new Set([previousSuit, nextSuit]).size === 2 &&
		[previousSuit, nextSuit].every((suit) => suit === 'Hearts' || suit === 'Diamonds')
}
