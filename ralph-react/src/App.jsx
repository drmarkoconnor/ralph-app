import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import './index.css'

function App() {
	const [count, setCount] = useState(0)

	return (
		<div className="min-h-screen bg-primary flex flex-col items-center justify-center">
			<div>
				<a href="https://vite.dev" target="_blank">
					<img src={viteLogo} className="logo" alt="Vite logo" />
				</a>
				<a href="https://react.dev" target="_blank">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
			</div>
			<h1 className="text-6xl font-fun text-accent mb-6 drop-shadow-lg">
				Ralph App
			</h1>
			<p className="text-xl font-modern text-white mb-4">
				Welcome to your modern, fun app!
			</p>
			<div className="card">
				<button onClick={() => setCount((count) => count + 1)}>
					count is {count}
				</button>
				<p>
					Edit <code>src/App.jsx</code> and save to test HMR
				</p>
			</div>
			<button className="px-6 py-3 rounded-lg bg-accent text-white font-fun text-lg shadow-md hover:bg-pink-400 transition">
				Get Started
			</button>
			<p className="read-the-docs">
				Click on the Vite and React logos to learn more
			</p>
		</div>
	)
}

export default App

