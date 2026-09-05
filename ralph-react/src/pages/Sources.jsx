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
			</div>
		</div>
	)
}
