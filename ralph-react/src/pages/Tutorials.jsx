import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
	tutorialContent,
	tutorialCurriculum,
	tutorialLessons,
	tutorialPbn,
} from '../tutorials/tutorialLibrary.js'

const PLAYER_HANDOFF_KEY = 'ralph-player-handoff-v1'
const TUTORIAL_PROGRESS_KEY = 'ralph-tutorial-progress-v1'

function readProgress() {
	if (typeof window === 'undefined') return {}
	try {
		return JSON.parse(window.localStorage.getItem(TUTORIAL_PROGRESS_KEY) || '{}')
	} catch {
		return {}
	}
}

function downloadCourse() {
	const blob = new Blob([tutorialPbn], { type: 'text/plain;charset=utf-8' })
	const link = document.createElement('a')
	link.href = URL.createObjectURL(blob)
	link.download = 'bridge-play-school-original-teaching-deals.pbn'
	document.body.appendChild(link)
	link.click()
	link.remove()
	URL.revokeObjectURL(link.href)
}

function LessonCard({ lesson, index, status, onStart }) {
	const completed = status === 'completed'
	const attempted = status === 'attempted'
	return (
		<article className="flex h-full flex-col rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-lg shadow-slate-950/8">
			<div className="flex items-start justify-between gap-4">
				<div>
					<div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
						Lesson {index + 1} · {lesson.category}
					</div>
					<h2 className="mt-2 text-xl font-black leading-tight text-slate-950">{lesson.title}</h2>
				</div>
				<span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
					completed
						? 'bg-emerald-100 text-emerald-900'
						: attempted
							? 'bg-amber-100 text-amber-950'
							: 'bg-slate-100 text-slate-700'
				}`}>
					{completed ? 'Complete' : attempted ? 'In progress' : lesson.levelName}
				</span>
			</div>
			<p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{lesson.trigger}</p>
			<div className="mt-auto pt-5">
				<button
					type="button"
					onClick={() => onStart(index)}
					className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 py-3 font-black text-white shadow-md hover:bg-emerald-800">
					{completed ? 'Replay lesson' : attempted ? 'Continue lesson' : 'Start lesson'}
				</button>
			</div>
		</article>
	)
}

export default function Tutorials() {
	const navigate = useNavigate()
	const [filter, setFilter] = useState('all')
	const [level, setLevel] = useState('all')
	const [progress] = useState(readProgress)
	const completedCount = tutorialLessons.filter((lesson) => progress[lesson.id] === 'completed').length
	const visibleLessons = useMemo(() => {
		const group = tutorialCurriculum.find((item) => item.id === filter)
		return tutorialLessons.filter((lesson) => {
			const groupMatch = !group || group.categories.includes(lesson.category)
			const levelMatch = level === 'all' || lesson.levelName === level
			return groupMatch && levelMatch
		})
	}, [filter, level])

	const openLesson = (index) => {
		window.sessionStorage.setItem(
			PLAYER_HANDOFF_KEY,
			JSON.stringify({
				pbn: tutorialPbn,
				name: 'Bridge Play School',
				sourcePath: '/lessons',
				returnLabel: 'Lesson library',
				startIndex: index,
				content: tutorialContent(),
			}),
		)
		navigate('/player')
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,#166534_0%,#064e3b_42%,#020617_100%)] px-5 py-8 text-white sm:px-8">
			<header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
				<div className="text-lg font-black">Bridge Hand Player</div>
				<div className="flex flex-wrap items-center justify-end gap-2 text-sm font-bold">
					<button onClick={downloadCourse} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">
						Download course PBN
					</button>
					<Link to="/player" className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">Load your PBN</Link>
					<Link to="/" className="rounded-lg bg-white px-3 py-2 text-slate-950 hover:bg-slate-100">Home</Link>
				</div>
			</header>

			<main className="mx-auto max-w-7xl pb-14 pt-12">
				<div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
					<div className="max-w-4xl">
						<div className="text-sm font-black uppercase tracking-[0.24em] text-amber-300">Free · offline · no AI calls</div>
						<h1 className="mt-3 text-5xl font-black leading-[0.98] sm:text-6xl">Bridge Play School</h1>
						<p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-emerald-50 sm:text-xl">
							Pause at the decision, commit to an answer, then reveal the principle and see the important cards highlighted on the table.
						</p>
					</div>
					<div className="rounded-2xl border-2 border-amber-300 bg-slate-950/55 px-6 py-4 text-center shadow-xl">
						<div className="text-4xl font-black text-amber-300">{completedCount}/{tutorialLessons.length}</div>
						<div className="mt-1 text-xs font-black uppercase tracking-wide text-emerald-50">Lessons completed</div>
					</div>
				</div>

				<section className="mt-8 rounded-2xl border border-white/20 bg-white/8 p-4">
					<div className="flex flex-wrap gap-2">
						<button onClick={() => setFilter('all')} className={`rounded-full px-4 py-2 text-sm font-black ${filter === 'all' ? 'bg-amber-300 text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'}`}>All topics</button>
						{tutorialCurriculum.map((group) => (
							<button key={group.id} onClick={() => setFilter(group.id)} className={`rounded-full px-4 py-2 text-sm font-black ${filter === group.id ? 'bg-amber-300 text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'}`}>{group.label}</button>
						))}
					</div>
					<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/15 pt-3">
						<span className="mr-1 text-xs font-black uppercase tracking-wide text-emerald-100">Level</span>
						{['all', 'Beginner', 'Intermediate', 'Advanced', 'Expert'].map((item) => (
							<button key={item} onClick={() => setLevel(item)} className={`rounded-lg px-3 py-1.5 text-xs font-black ${level === item ? 'bg-sky-200 text-sky-950' : 'bg-slate-950/40 text-white hover:bg-slate-950/65'}`}>{item === 'all' ? 'All levels' : item}</button>
						))}
					</div>
				</section>

				<div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
					{visibleLessons.map((lesson) => {
						const index = tutorialLessons.findIndex((item) => item.id === lesson.id)
						return <LessonCard key={lesson.id} lesson={lesson} index={index} status={progress[lesson.id]} onStart={openLesson} />
					})}
				</div>

				<section className="mt-9 rounded-2xl border border-white/20 bg-slate-950/35 p-5 text-sm font-semibold leading-6 text-emerald-50">
					<strong className="text-white">Original teaching material.</strong> Every deal and explanation in this course was created for this app. The sequence reflects established bridge-teaching themes, but it does not reproduce a third-party lesson, hand or commentary. The course runs locally in the Player and never calls a paid AI model.
				</section>
			</main>
		</div>
	)
}
