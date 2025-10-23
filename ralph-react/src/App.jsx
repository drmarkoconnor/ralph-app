import './index.css'
import DragDropCards from './DragDropCards'
import { useState } from 'react'
import { Link } from 'react-router-dom'

function App() {
	// helpers
	const todayISO = new Date().toISOString().slice(0, 10)
	const toPbnDate = (iso) => (iso ? iso.replace(/-/g, '.') : '')

	const [meta, setMeta] = useState({
		// core
		event: 'Club Teaching session',
		siteChoice: 'Bristol Bridge Club',
		siteOther: '',
		dateISO: todayISO,
		date: toPbnDate(todayISO),
		// extended
		system: '',
		themeChoice: 'Bidding - Stayman & Transfers',
		themeCustom: '',
		theme: '', // derived
		interf: '',
		lead: '',
		ddpar: '',
		scoring: 'MPs',
		// explicit contract/declarer (for handout exports)
		contract: '',
		declarer: '',
		// teacher authored
		notes: [],
		notesDraft: '',
		auctionStart: 'N',
		auctionText: '',
		playscript: '',
	})
	return (
		<div className="min-h-screen bg-primary/10 flex flex-col items-center justify-start py-4">
			<h1 className="text-5xl font-fun text-accent mb-1 drop-shadow-lg text-center">
				Bristol Bridge Club's PBN Generator
			</h1>

			<div className="mb-2 text-sm flex gap-3">
				<Link to="/" className="text-sky-600 hover:underline">
					← Home
				</Link>
				<Link to="/player" className="text-sky-600 hover:underline">
					Go to PBN Player →
				</Link>
			</div>
			<DragDropCards meta={meta} setMeta={setMeta} />
		</div>
	)
}

export default App

