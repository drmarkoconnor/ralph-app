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
					The links below are public, open sources of PBN files. They are
					provided for learning, analysis, and practice. Please respect the
					terms of each site.
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
					Version 2 note: this app will add importing PBNs so you can reproduce
					previously played tournaments directly inside the tool.
				</div>
			</div>
		</div>
	)
}

