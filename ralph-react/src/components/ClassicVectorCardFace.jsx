import React from 'react'
import * as vectorDeck from '@letele/playing-cards'

function vectorCardName(card) {
	const suit = String(card?.suit || '').charAt(0).toUpperCase()
	const rawRank = String(card?.rank || '')
	const rank = ['A', 'K', 'Q', 'J'].includes(rawRank) ? rawRank.toLowerCase() : rawRank
	return `${suit}${rank}`
}

export default function ClassicVectorCardFace({ card }) {
	const VectorCard = vectorDeck[vectorCardName(card)]
	if (!VectorCard) return null
	return (
		<VectorCard
			aria-hidden="true"
			focusable="false"
			className="player-v3-card-art player-v3-card-art--vector h-full w-full"
		/>
	)
}
