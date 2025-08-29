import { Link } from 'react-router-dom'
import HeroCards from '../components/HeroCards'

export default function Home() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-sky-50">
			<div className="max-w-6xl mx-auto px-6 py-12 min-h-screen flex flex-col md:flex-row items-center justify-center gap-10">
				{/* Left: copy + CTAs */}
				<div className="flex-1 flex flex-col items-start">
					<h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight">
						Learn, Build, and Teach Bridge
					</h1>
					<p className="text-lg text-gray-700 mt-4 max-w-xl">
						Explore our playful tools for teaching and preparing Bridge
						sessions. Create hands with the Generator or teach with the live
						Player.
					</p>
					<div className="mt-6 flex flex-wrap gap-3">
						<Link
							to="/picker"
							className="px-5 py-3 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700">
							PBN Generator
						</Link>
						<Link
							to="/player"
							className="px-5 py-3 rounded-xl bg-fuchsia-600 text-white shadow hover:bg-fuchsia-700">
							PBN Player
						</Link>
						<Link
							to="/instructions"
							className="px-5 py-3 rounded-xl bg-white text-gray-900 border border-gray-200 shadow hover:bg-gray-50">
							Read instructions
						</Link>
					</div>
				</div>
				{/* Right: hero art */}
				<div className="flex-1 flex items-center justify-center">
					<HeroCards />
				</div>
			</div>
		</div>
	)
}

