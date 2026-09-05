import { Link, useParams } from 'react-router-dom'
import WalkthroughTour from '../components/WalkthroughTour'
import { concepts, getConcept } from './homeConceptData'

function PrimaryActions({ light }) {
	const primaryBase =
		'inline-flex min-h-13 items-center justify-center rounded-md px-6 py-3 text-base font-black shadow-lg transition focus:outline-none focus:ring-4'
	const secondaryBase =
		'inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-4'

	return (
		<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
			<Link
				to="/generator-v2"
				className={`${primaryBase} bg-sky-600 text-white shadow-sky-950/20 hover:bg-sky-500 focus:ring-sky-300/50`}>
				PBN Generator
			</Link>
			<Link
				to="/player"
				className={`${primaryBase} bg-white text-slate-950 shadow-slate-950/20 hover:bg-slate-100 focus:ring-white/50`}>
				Bridge Player
			</Link>
			<Link
				to="/instructions"
				className={
					light
						? `${secondaryBase} border border-slate-300 bg-white/70 text-slate-800 hover:bg-white focus:ring-slate-300/40`
						: `${secondaryBase} border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/18 focus:ring-white/30`
				}>
				Instructions
			</Link>
			<WalkthroughTour
				autoOpen={false}
				buttonClassName={
					light
						? `${secondaryBase} border border-slate-300 bg-white/70 text-slate-800 hover:bg-white focus:ring-slate-300/40`
						: `${secondaryBase} border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/18 focus:ring-white/30`
				}
			/>
		</div>
	)
}

function ConceptNav({ activeId, light }) {
	return (
		<nav
			aria-label="Home concepts"
			className={`fixed left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-2 shadow-xl backdrop-blur-md ${
				light
					? 'border-slate-200 bg-white/86 text-slate-800'
					: 'border-white/20 bg-slate-950/48 text-white'
			}`}>
			{concepts.map((concept) => (
				<Link
					key={concept.id}
					to={`/home-concepts/${concept.id}`}
					className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
						concept.id === activeId
							? light
								? 'bg-slate-950 text-white'
								: 'bg-white text-slate-950'
							: light
								? 'hover:bg-slate-100'
								: 'hover:bg-white/12'
					}`}>
					{concept.id}
				</Link>
			))}
			<Link
				to="/"
				className={`ml-1 rounded-full px-3 py-1.5 text-xs font-black transition ${
					light ? 'text-slate-500 hover:bg-slate-100' : 'text-white/70 hover:bg-white/12'
				}`}>
				Live
			</Link>
		</nav>
	)
}

export function ConceptHome({ concept, showConceptNav = true }) {
	const textColor = concept.light ? 'text-slate-950' : 'text-white'
	const mutedColor = concept.light ? 'text-slate-700' : 'text-slate-100'
	const eyebrowColor = concept.light ? 'text-slate-600' : 'text-white/78'

	return (
		<div
			className="relative min-h-screen overflow-x-hidden bg-slate-950"
			style={{
				backgroundImage: `url(${concept.image})`,
				backgroundPosition: concept.position,
				backgroundSize: 'cover',
				fontFamily: "'Roboto', 'Inter', 'Arial', sans-serif",
			}}>
			<div className={`absolute inset-0 ${concept.overlay}`} />
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.12),transparent_28%)]" />
			{concept.cardMarks.map((mark) => (
				<div
					key={mark.label}
					className={`pointer-events-none absolute hidden select-none text-[9rem] font-black leading-none tracking-normal md:block ${mark.className}`}>
					{mark.label}
				</div>
			))}

			{showConceptNav && <ConceptNav activeId={concept.id} light={concept.light} />}

			<main className={`relative z-10 flex min-h-screen ${concept.align} px-6 pb-12 ${showConceptNav ? 'pt-28' : 'pt-20'} sm:px-10 lg:px-16`}>
				<div className={`flex w-full flex-col ${concept.align} ${concept.copyWidth}`}>
					<div className={`mb-5 h-1.5 w-20 rounded-full ${concept.accent}`} />
					<p className={`mb-4 text-sm font-black uppercase tracking-[0.18em] ${eyebrowColor}`}>
						Bridge teaching display
					</p>
					<h1 className={`max-w-4xl text-5xl font-black leading-[0.98] tracking-normal ${textColor} sm:text-6xl lg:text-7xl`}>
						Prepare, Present, And Teach Bridge Deals
					</h1>
					<p className={`mt-6 max-w-2xl text-lg font-medium leading-8 ${mutedColor} sm:text-xl`}>
						Create teaching hands, export PBN files, and guide students through bidding and play on a clear classroom display.
					</p>
					<PrimaryActions light={concept.light} />
					<Link
						to="/competitions"
						className={`group mt-7 flex max-w-2xl items-center justify-between gap-5 rounded-2xl border-2 p-4 text-left shadow-xl transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 ${
							concept.light
								? 'border-amber-300 bg-white/88 text-slate-950 hover:bg-white focus:ring-amber-300/40'
								: 'border-amber-300/75 bg-slate-950/72 text-white backdrop-blur hover:bg-slate-950/88 focus:ring-amber-300/40'
						}`}>
						<div>
							<div className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">
								Free competition replays
							</div>
							<div className="mt-1 text-xl font-black">Play a famous final</div>
							<div className={`mt-1 text-sm font-semibold ${concept.light ? 'text-slate-600' : 'text-slate-200'}`}>
								Bid as South, play the deal, then compare with the published expert tables.
							</div>
						</div>
						<span
							aria-hidden="true"
							className="shrink-0 rounded-full bg-amber-300 px-4 py-2 text-xl font-black text-slate-950 transition group-hover:translate-x-1">
							→
						</span>
					</Link>
					<p className={`mt-7 max-w-xl text-sm font-semibold leading-6 ${concept.light ? 'text-slate-600' : 'text-white/64'}`}>
						Generator and Player are the primary workflow. Instructions and the walkthrough remain available when you need support.
					</p>
				</div>
			</main>
		</div>
	)
}

export default function HomeConcepts() {
	const { id } = useParams()
	const concept = getConcept(id)

	return <ConceptHome concept={concept} />
}
