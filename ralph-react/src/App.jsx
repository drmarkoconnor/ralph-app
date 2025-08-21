import './index.css'
import DragDropCards from './DragDropCards'
import { Link } from 'react-router-dom'

function App() {
	return (
		<div className="min-h-screen bg-primary/10 flex flex-col items-center justify-start py-4">
			<h1 className="text-5xl font-fun text-accent mb-1 drop-shadow-lg text-center">
				Bristol Bridge Club's PBN Picker
			</h1>
			<div
				className="mb-3 text-sm italic text-gray-700"
				style={{ fontFamily: 'Apple Chancery, Snell Roundhand, cursive' }}>
				Mr Ralph Power, Educational Director, Bristol Bridge Club
			</div>
			<div className="mb-2 text-sm flex gap-3">
				<Link to="/" className="text-sky-600 hover:underline">
					← Home
				</Link>
				<Link to="/player" className="text-sky-600 hover:underline">
					Go to PBN Player →
				</Link>
			</div>
			<DragDropCards />
		</div>
	)
}

export default App

