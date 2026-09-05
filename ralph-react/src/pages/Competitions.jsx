import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { competitionPacks } from '../data/competitionPacks.generated.js'

const PLAYER_HANDOFF_KEY = 'ralph-player-handoff-v1'

function referencesByBoard(metadata) {
	return Object.fromEntries(
		(metadata?.boardComparisons || metadata?.boards || []).map((board) => [
			String(board.boardNumber),
			(board.referenceResults || board.roomResults || []).map((reference) => ({
				room: reference.room || 'Published table',
				contract: reference.contract || '',
				declarer: reference.declarer || '',
				result:
					reference.outcome ||
					reference.contractOutcome ||
					(Number.isFinite(Number(reference.tricksTaken))
						? `${reference.tricksTaken} tricks`
						: ''),
				nsScore: Number(reference.scoreNS ?? reference.score?.ns),
			})),
		]),
	)
}

function PackCard({ pack, busy, onOpen }) {
	return (
		<article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/8">
			<div className="flex items-start justify-between gap-4">
				<div>
					<div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
						Competition replay
					</div>
					<h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">{pack.title}</h2>
				</div>
				<span className="shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-black text-amber-950">
					{pack.boardCount} boards
				</span>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold text-slate-700">
				<div className="rounded-xl bg-slate-100 p-3">
					<div className="text-[10px] uppercase tracking-wide text-slate-500">Event</div>
					<div className="mt-1">{pack.event}</div>
				</div>
				<div className="rounded-xl bg-slate-100 p-3">
					<div className="text-[10px] uppercase tracking-wide text-slate-500">Date</div>
					<div className="mt-1">{pack.date || 'Published event'}</div>
				</div>
			</div>

			<p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
				Bid each deal as South, play it through, then compare your N–S score with the
				published Open and Closed room results.
			</p>
			<div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-950">
				Replay and expert comparison are free. Optional AI nudges require an authorised
				Coach account.
			</div>

			<div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
				<button
					type="button"
					disabled={busy}
					onClick={() => onOpen(pack, false)}
					className="min-h-12 rounded-xl bg-emerald-700 px-4 py-3 text-base font-black text-white shadow-md hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
					{busy ? 'Loading…' : 'Start at first board'}
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={() => onOpen(pack, true)}
					className="min-h-12 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base font-black text-amber-950 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60">
					Surprise me
				</button>
			</div>
			<div className="mt-4 text-xs font-semibold leading-5 text-slate-500">
				{pack.attribution}{' '}
				<a
					href={pack.sourcePageUrl}
					target="_blank"
					rel="noreferrer"
					className="font-black text-sky-700 underline underline-offset-2">
					Official source
				</a>
			</div>
		</article>
	)
}

export default function Competitions() {
	const navigate = useNavigate()
	const [loadingId, setLoadingId] = useState('')
	const [error, setError] = useState('')
	const featuredPacks = useMemo(() => competitionPacks.filter((pack) => pack.boardCount > 0), [])

	const openPack = async (pack, randomBoard) => {
		setLoadingId(pack.id)
		setError('')
		try {
			const [pbnResponse, metadataResponse] = await Promise.all([
				fetch(pack.pbnPath),
				fetch(pack.metadataPath),
			])
			if (!pbnResponse.ok || !metadataResponse.ok) {
				throw new Error('The replay pack could not be loaded.')
			}
			const [pbn, metadata] = await Promise.all([
				pbnResponse.text(),
				metadataResponse.json(),
			])
			const startIndex = randomBoard
				? Math.floor(Math.random() * Math.max(1, Number(pack.boardCount) || 1))
				: 0
			window.sessionStorage.setItem(
				PLAYER_HANDOFF_KEY,
				JSON.stringify({
					pbn,
					name: pack.shortTitle || pack.title,
					sourcePath: '/competitions',
					returnLabel: 'Competition library',
					startIndex,
					content: {
						kind: 'competition',
						packId: pack.id,
						attribution: pack.attribution,
						sourcePageUrl: pack.sourcePageUrl,
						boardComparisons: referencesByBoard(metadata),
					},
				}),
			)
			navigate('/player')
		} catch (loadError) {
			setError(loadError?.message || 'The replay pack could not be loaded.')
			setLoadingId('')
		}
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,#14532d_0%,#052e24_42%,#020617_100%)] px-5 py-8 text-white sm:px-8">
			<header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
				<div className="text-lg font-black">Bridge Hand Player</div>
				<div className="flex items-center gap-3 text-sm font-bold">
					<Link to="/player" className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">
						Load your own PBN
					</Link>
					<Link to="/" className="rounded-lg bg-white px-3 py-2 text-slate-950 hover:bg-slate-100">
						Home
					</Link>
				</div>
			</header>

			<main className="mx-auto max-w-6xl pb-12 pt-14">
				<div className="max-w-4xl">
					<div className="text-sm font-black uppercase tracking-[0.24em] text-amber-300">
						Free teaching collection
					</div>
					<h1 className="mt-3 text-5xl font-black leading-[0.98] sm:text-6xl">
						Play a famous final
					</h1>
					<p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-emerald-50 sm:text-xl">
						Take the South seat in a published competition set. Practise the auction,
						play the cards, and compare your final score with the expert tables.
					</p>
				</div>

				{error && (
					<div role="alert" className="mt-7 rounded-xl border-2 border-rose-300 bg-rose-950/80 p-4 font-bold text-rose-50">
						{error} Please try again or use the official source link.
					</div>
				)}

				<div className="mt-9 grid gap-6 lg:grid-cols-2">
					{featuredPacks.map((pack) => (
						<PackCard
							key={pack.id}
							pack={pack}
							busy={loadingId === pack.id}
							onOpen={openPack}
						/>
					))}
				</div>

				<section className="mt-8 rounded-2xl border border-white/20 bg-white/8 p-5 text-sm font-semibold leading-6 text-emerald-50">
					<strong className="text-white">About this library.</strong> Packs are reviewed and
					stored with the app so lessons do not depend on a live third-party website. Each
					pack links to its official source. Replay and published comparison need no account;
					the optional compact AI Coach follows the normal owner or subscriber sign-in rules.
					Published results are factual table records, not a claim that there is only one
					correct auction or line of play.
				</section>
			</main>
		</div>
	)
}
