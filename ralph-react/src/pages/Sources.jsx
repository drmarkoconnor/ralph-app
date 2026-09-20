import { Link } from 'react-router-dom'
import sources from '../data/pbn-sources.json'

export default function Sources() {
	return (
		<div className="min-h-screen bg-white flex flex-col items-center px-4 py-6">
			<div className="w-full max-w-3xl">
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-3xl font-bold text-gray-800">
						Public PBN Sources
					</h1>
					<Link to="/" className="text-sm text-sky-600 hover:underline">
						← Back to app
					</Link>
				</div>

				<p className="text-sm text-gray-700 leading-6 mb-4">
					The links below lead to publicly available PBN files. Availability
					does not necessarily grant permission to republish them, and reuse
					terms vary. Please check and respect each site's terms.
				</p>

				<ul className="space-y-2 mb-6">
					{sources.map((item, idx) => (
						<li
							key={idx}
							className="p-3 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100">
							<a
								className="text-sky-700 hover:underline"
								href={item.url}
								target="_blank"
								rel="noreferrer">
								{item.title}
							</a>
						</li>
					))}
				</ul>

				<div className="text-sm text-gray-700 leading-6">
					The Bridge Hand Player can load a PBN you have downloaded legitimately.
					The current{' '}
					<Link to="/competitions" className="font-bold text-sky-700 hover:underline">
						competition replay library
					</Link>{' '}
					uses a small reviewed set of official USBF records with visible attribution,
					source checksums and a documented reuse caution. Replay and expert comparison
					remain free; optional AI nudges require normal Coach authorisation.
				</div>

				<section className="mt-8 border-t border-gray-200 pt-6">
					<h2 className="text-xl font-bold text-gray-800">Teaching curriculum references</h2>
					<p className="mt-2 text-sm leading-6 text-gray-700">
						Bridge Play School uses newly generated deals and original prose. These public
						teaching indexes informed the breadth and order of topics; their hands and lesson
						text are not reproduced.
					</p>
					<ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
						<li><a className="text-sky-700 hover:underline" href="https://www.acbl.org/teachers-lounge/" target="_blank" rel="noreferrer">ACBL Teachers’ Lounge curriculum</a></li>
						<li><a className="text-sky-700 hover:underline" href="https://www.acbl.org/cg-lessons/" target="_blank" rel="noreferrer">ACBL Community Games lesson archive</a></li>
						<li><a className="text-sky-700 hover:underline" href="https://www.worldbridge.org/world-bridge-academy/teach-beginners/" target="_blank" rel="noreferrer">World Bridge Federation beginner programme</a></li>
						<li><a className="text-sky-700 hover:underline" href="https://www.vubridge.com/TKit_TOC.php" target="_blank" rel="noreferrer">VuBridge teacher kit topic index</a></li>
						<li><a className="text-sky-700 hover:underline" href="https://www.60secondbridge.com/public-lessons/card-play-in-bridge/" target="_blank" rel="noreferrer">60 Second Bridge card-play index</a></li>
					</ul>
				</section>
			</div>
		</div>
	)
}
