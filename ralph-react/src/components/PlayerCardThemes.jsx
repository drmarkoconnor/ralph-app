import React, { lazy, Suspense, useId, useState } from 'react'

import cardPngUrl from '../lib/cardImage'
import { suitSymbol } from '../player-v2/bridgeV2'
import { normalizeCardTheme } from '../player-v2/cardDisplay'
import {
	CARD_THEMES,
	cardTheme,
	cardThemeColourClasses,
} from './playerCardThemeConfig'
const ClassicVectorCardFace = lazy(() => import('./ClassicVectorCardFace'))

export function CardFaceArtwork({ card, themeKey, presentationMode = false }) {
	const normalized = normalizeCardTheme(themeKey)
	if (normalized === 'classic') {
		return (
			<Suspense fallback={<span className="sr-only">Loading classic card artwork</span>}>
				<ClassicVectorCardFace card={card} />
			</Suspense>
		)
	}
	if (normalized === 'heritage') {
		return (
			<img
				aria-hidden="true"
				alt=""
				src={cardPngUrl(card.suit, card.rank)}
				className="player-v3-card-art player-v3-card-art--heritage h-full w-full object-fill"
			/>
		)
	}

	const symbol = suitSymbol(card.suit)
	if (normalized === 'jumbo') {
		return (
			<div className="player-v3-card-art player-v3-card-art--jumbo flex h-full w-full flex-col items-center justify-between">
				<span className="self-start leading-[0.82]">
					<span className="block">{card.rank}</span>
					<span className={`${presentationMode ? 'text-[33px]' : 'text-[27px]'} block text-center`}>{symbol}</span>
				</span>
				<span className={`${presentationMode ? 'text-[58px]' : 'text-[48px]'} leading-none opacity-90`}>{symbol}</span>
			</div>
		)
	}

	return (
		<div className="player-v3-card-art player-v3-card-art--index flex h-full w-full flex-col items-start justify-between">
			<span className="flex flex-col items-center leading-none">
				<span>{card.rank}</span>
				<span className={`${presentationMode ? 'text-[34px]' : 'text-[27px]'} leading-none`}>{symbol}</span>
			</span>
			<span className={`${presentationMode ? 'text-[27px]' : 'text-[22px]'} self-end leading-none opacity-90`}>{symbol}</span>
		</div>
	)
}

function PatternCardBack({ colour = '#172554', className = '' }) {
	const patternId = useId().replaceAll(':', '')
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			viewBox="-120 -168 240 336"
			preserveAspectRatio="none"
			className={className}>
			<defs>
				<pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
					<path d="M4 0 8 4 4 8 0 4Z" fill={colour} />
					<circle cx="4" cy="4" r="1.1" fill="#fff" fillOpacity="0.68" />
				</pattern>
			</defs>
			<rect width="239" height="335" x="-119.5" y="-167.5" rx="12" fill="#fff" stroke="#0f172a" strokeWidth="2" />
			<rect width="216" height="312" x="-108" y="-156" rx="9" fill={`url(#${patternId})`} />
			<rect width="198" height="294" x="-99" y="-147" rx="5" fill="none" stroke="#fff" strokeOpacity="0.72" strokeWidth="3" />
		</svg>
	)
}

export function CardBackArtwork({ themeKey, className = '' }) {
	const theme = cardTheme(themeKey)
	const colour = theme.back === 'B2' ? '#9f1239' : '#172554'
	return (
		<PatternCardBack
			colour={colour}
			className={`player-v3-card-back player-v3-card-back--${theme.key} ${className}`}
		/>
	)
}

function ThemePreview({ themeKey }) {
	return (
		<div className="flex shrink-0 items-center gap-1" aria-hidden="true">
			<div
				data-card-theme={themeKey}
				data-card-suit="Spades"
				className={`player-v3-theme-preview-card ${cardThemeColourClasses(themeKey, 'Spades')}`}>
				<CardFaceArtwork card={{ rank: 'A', suit: 'Spades' }} themeKey={themeKey} />
			</div>
			<div className="player-v3-theme-preview-card overflow-hidden border-slate-500 bg-white">
				<CardBackArtwork themeKey={themeKey} className="h-full w-full" />
			</div>
		</div>
	)
}

export function CardThemePicker({ value, onChange }) {
	const [open, setOpen] = useState(false)
	const selected = cardTheme(value)
	return (
		<div
			className="relative"
			onKeyDown={(event) => {
				if (event.key === 'Escape') setOpen(false)
			}}>
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				aria-expanded={open}
				aria-haspopup="listbox"
				className="flex w-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 p-2 text-left hover:border-slate-300">
				<ThemePreview themeKey={selected.key} />
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-black text-slate-950">{selected.label}</span>
					<span className="block text-[11px] font-semibold leading-tight text-slate-600">{selected.description}</span>
				</span>
				<span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Choose</span>
			</button>
			{open && (
				<div
					role="listbox"
					aria-label="Card face and back design"
					className="mt-2 grid max-h-[330px] gap-1.5 overflow-y-auto rounded-xl border-2 border-slate-200 bg-white p-2 shadow-xl">
					{CARD_THEMES.map((theme) => (
						<button
							key={theme.key}
							type="button"
							role="option"
							aria-selected={selected.key === theme.key}
							onClick={() => {
								onChange(theme.key)
								setOpen(false)
							}}
							className={`flex items-center gap-3 rounded-lg border-2 p-2 text-left ${
								selected.key === theme.key
									? 'border-amber-300 bg-amber-50'
									: 'border-transparent hover:border-slate-200 hover:bg-slate-50'
							}`}>
							<ThemePreview themeKey={theme.key} />
							<span className="min-w-0">
								<span className="block text-sm font-black">{theme.label}</span>
								<span className="block text-[11px] font-semibold leading-tight text-slate-600">{theme.description}</span>
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}
