import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'ralphWalkthroughDismissed'

const slides = [
	{
		image: '/walkthrough/01-home.png',
		audio: '/walkthrough/audio/01-home.mp3',
		title: 'Start On The Home Page',
		narration:
			'Start from the home page. PBN Generator is for preparing teaching deals, and Bridge Hand Player is for displaying them clearly during a class.',
	},
	{
		image: '/walkthrough/02-generator-entry.png',
		audio: '/walkthrough/audio/02-generator-entry.mp3',
		title: 'Open PBN Generator',
		narration:
			'The generator opens with the teaching brief on the left and the board workspace on the right, so setup and review stay on one screen.',
	},
	{
		image: '/walkthrough/03-teaching-topic.png',
		audio: '/walkthrough/audio/03-teaching-topic.mp3',
		title: 'Choose A Topic',
		narration:
			'Choose the lesson topic first. The generator uses that choice to shape the deals and to prepare notes that support the teaching point.',
	},
	{
		image: '/walkthrough/04-board-settings.png',
		audio: '/walkthrough/audio/04-board-settings.mp3',
		title: 'Set The Session Shape',
		narration:
			'Set the number of boards, the first board number, and the dealer flow. This lets a teaching set match the boards you want to use in class.',
	},
	{
		image: '/walkthrough/05-auction-options.png',
		audio: '/walkthrough/audio/05-auction-options.mp3',
		title: 'Control Auction Guidance',
		narration:
			'Suggest keeps the auction optional, Apply writes it into the board, and Blank leaves the auction empty for live adjustment in Bridge Hand Player.',
	},
	{
		image: '/walkthrough/06-generate-set.png',
		audio: '/walkthrough/audio/06-generate-set.mp3',
		title: 'Generate The Boards',
		narration:
			'Generate Set creates a run of boards and keeps them available for review. You can regenerate individual boards without rebuilding the full set.',
	},
	{
		image: '/walkthrough/07-board-review.png',
		audio: '/walkthrough/audio/07-board-review.mp3',
		title: 'Review Each Deal',
		narration:
			'Each board shows dealer, vulnerability, high-card points, partnership totals, hand shapes, and the full four-hand diagram.',
	},
	{
		image: '/walkthrough/08-suggested-auction.png',
		audio: '/walkthrough/audio/08-suggested-auction.mp3',
		title: 'Use Or Clear Suggestions',
		narration:
			'The suggested auction is not forced. Use it when it helps the lesson, clear it when you want a clean board, or edit the auction by hand.',
	},
	{
		image: '/walkthrough/09-teacher-notes.png',
		audio: '/walkthrough/audio/09-teacher-notes.mp3',
		title: 'Edit Teacher Notes',
		narration:
			'Teacher notes can be adjusted before export, so the same deal can carry the exact reminders you want when answering student questions.',
	},
	{
		image: '/walkthrough/10-export-options.png',
		audio: '/walkthrough/audio/10-export-options.mp3',
		title: 'Export Teaching Files',
		narration:
			'Export PBN for sharing or loading later, and export the compact teacher PDF as a memory aid with multiple boards on each page.',
	},
	{
		image: '/walkthrough/11-open-player.png',
		audio: '/walkthrough/audio/11-open-player.mp3',
		title: 'Send Boards To Player',
		narration:
			'Play opens the selected board or the kept set directly in Bridge Hand Player. There is no need to save a PBN first unless you want a file copy.',
	},
	{
		image: '/walkthrough/12-player-display.png',
		audio: '/walkthrough/audio/12-player-display.mp3',
		title: 'Teach From Bridge Hand Player',
		narration:
			'Bridge Hand Player lets you adjust the auction, reveal hands, move into play, and use fullscreen display for a projected teaching session.',
	},
]

function Narrator() {
	return (
		<div className="relative h-20 w-20 shrink-0">
			<div className="absolute inset-x-3 bottom-0 h-10 rounded-b-3xl rounded-t-xl bg-sky-700 shadow-lg" />
			<div className="absolute left-2 top-0 h-16 w-16 rounded-full border-4 border-white bg-amber-100 shadow-xl">
				<div className="absolute left-3 top-6 h-2 w-2 rounded-full bg-slate-950" />
				<div className="absolute right-3 top-6 h-2 w-2 rounded-full bg-slate-950" />
				<div className="absolute left-1/2 top-9 h-2 w-7 -translate-x-1/2 rounded-b-full border-b-4 border-slate-900" />
				<div className="absolute -right-1 top-2 h-5 w-5 rounded-full bg-fuchsia-500" />
			</div>
			<div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-white px-1.5 py-0.5 text-[10px] font-black text-sky-800 shadow">
				R
			</div>
		</div>
	)
}

export default function WalkthroughTour({
	autoOpen = true,
	buttonClassName = 'px-5 py-3 rounded-xl bg-slate-900 text-white shadow hover:bg-slate-800',
}) {
	const audioRef = useRef(null)
	const [open, setOpen] = useState(false)
	const [index, setIndex] = useState(0)
	const [playing, setPlaying] = useState(false)
	const [dismiss, setDismiss] = useState(false)
	const [narrationEnabled, setNarrationEnabled] = useState(true)

	const slide = slides[index]
	const progress = useMemo(() => ((index + 1) / slides.length) * 100, [index])

	const stopNarration = useCallback(() => {
		const audio = audioRef.current
		if (!audio) return
		audio.pause()
	}, [])

	useEffect(() => {
		if (!autoOpen) return
		if (localStorage.getItem(STORAGE_KEY) === '1') return
		const timer = window.setTimeout(() => setOpen(true), 450)
		return () => window.clearTimeout(timer)
	}, [autoOpen])

	useEffect(() => {
		if (!open || !playing) return undefined
		if (narrationEnabled && slide.audio && audioRef.current) {
			const audio = audioRef.current
			audio.pause()
			audio.currentTime = 0
			audio.src = slide.audio
			audio.play().catch((error) => {
				console.error('Walkthrough audio failed to play', error)
				setPlaying(false)
			})
			return () => audio.pause()
		}
		const timer = window.setTimeout(() => {
			setIndex((current) => {
				if (current >= slides.length - 1) {
					setPlaying(false)
					return current
				}
				return current + 1
			})
		}, 7800)
		return () => window.clearTimeout(timer)
	}, [open, playing, index, narrationEnabled, slide.audio])

	useEffect(() => {
		if (open && playing && !narrationEnabled) stopNarration()
	}, [open, playing, narrationEnabled, stopNarration])

	useEffect(() => stopNarration, [stopNarration])

	const close = () => {
		if (dismiss) localStorage.setItem(STORAGE_KEY, '1')
		setPlaying(false)
		stopNarration()
		setOpen(false)
	}

	const next = () => setIndex((current) => Math.min(slides.length - 1, current + 1))
	const prev = () => setIndex((current) => Math.max(0, current - 1))
	const onAudioEnded = () => {
		setIndex((current) => {
			if (current >= slides.length - 1) {
				setPlaying(false)
				return current
			}
			return current + 1
		})
	}
	const togglePlaying = () => {
		setPlaying((value) => {
			if (value) stopNarration()
			return !value
		})
	}

	return (
		<>
			<button
				type="button"
				onClick={() => {
					setIndex(0)
					setOpen(true)
				}}
				className={buttonClassName}>
				Watch walkthrough
			</button>

			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
					<div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl">
						<header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
							<div>
								<h2 className="text-xl font-black text-slate-950">Bridge Teaching Tour</h2>
								<p className="text-sm font-medium text-slate-500">
									Generator 2 to Bridge Hand Player in twelve narrated steps
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
									<input
										type="checkbox"
										checked={narrationEnabled}
										onChange={(event) => setNarrationEnabled(event.target.checked)}
									/>
									Audio
								</label>
								<button
									type="button"
									onClick={togglePlaying}
									className="rounded-md bg-sky-700 px-3 py-2 text-sm font-black text-white hover:bg-sky-800">
									{playing ? 'Pause' : 'Play'}
								</button>
								<button
									type="button"
									onClick={close}
									className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 hover:bg-slate-50">
									Close
								</button>
							</div>
						</header>
						<audio ref={audioRef} preload="metadata" onEnded={onAudioEnded} />

						<div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_330px]">
							<div className="min-h-0 bg-slate-100 p-3">
								<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
									<img
										src={slide.image}
										alt={slide.title}
										className="h-full max-h-[64vh] w-full object-contain"
									/>
								</div>
							</div>

							<aside className="flex flex-col gap-4 border-l border-slate-200 bg-slate-50 p-4">
								<div className="flex items-start gap-3">
									<Narrator />
									<div className="relative rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
										<div className="absolute -left-2 top-8 h-4 w-4 rotate-45 border-b border-l border-sky-100 bg-white" />
										<h3 className="text-lg font-black text-slate-950">{slide.title}</h3>
										<p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
											{slide.narration}
										</p>
									</div>
								</div>

								<div className="mt-auto">
									<div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200">
										<div
											className="h-full rounded-full bg-sky-700 transition-all"
											style={{ width: `${progress}%` }}
										/>
									</div>
									<div className="mb-3 flex items-center justify-between text-xs font-black uppercase tracking-wide text-slate-500">
										<span>
											Step {index + 1} of {slides.length}
										</span>
										<span>{playing ? 'Playing' : 'Paused'}</span>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<button
											type="button"
											onClick={prev}
											disabled={index === 0}
											className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 disabled:opacity-40">
											Back
										</button>
										<button
											type="button"
											onClick={next}
											disabled={index === slides.length - 1}
											className="rounded-md bg-slate-900 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
											Next
										</button>
									</div>
									<label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-600">
										<input
											type="checkbox"
											checked={dismiss}
											onChange={(event) => setDismiss(event.target.checked)}
										/>
										Do not show this automatically again
									</label>
								</div>
							</aside>
						</div>
					</div>
				</div>
			)}
		</>
	)
}
