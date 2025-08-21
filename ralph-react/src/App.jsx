import './index.css'
import DragDropCards from './DragDropCards'

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
			<DragDropCards />
		</div>
	)
}

export default App

