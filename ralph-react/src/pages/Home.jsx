import { Link } from 'react-router-dom'

export default function Home() {
	return (
		<div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
			<h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-2 text-center">
				Bristol Bridge Club
			</h1>
			<p className="text-gray-700 mb-6 text-center">
				Choose a tool to continue
			</p>
			<div className="flex flex-col sm:flex-row gap-3">
				<Link
					to="/picker"
					className="px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-900 text-sm text-center">
					PBN Generator (Construct hands)
				</Link>
				<Link
					to="/player"
					className="px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-900 text-sm text-center">
					PBN Player (Load & Teach)
				</Link>
			</div>
			<div className="mt-6 text-sm text-sky-700">
				<Link to="/instructions" className="hover:underline">
					Read instructions →
				</Link>
			</div>
		</div>
	)
}

