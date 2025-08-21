import './index.css'
import DragDropCards from './DragDropCards'

function App() {
	return (
		<div className="min-h-screen bg-primary/10 flex flex-col items-center justify-start py-4">
			<h1 className="text-5xl font-fun text-accent mb-3 drop-shadow-lg">
				Ralph's Picker
			</h1>
			<DragDropCards />
		</div>
	)
}

export default App

