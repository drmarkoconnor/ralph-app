import { useEffect, useState } from 'react'
import useIsIPhone from '../hooks/useIsIPhone'

export default function SidebarLayout({
	left,
	right,
	children,
	defaultLeftOpen = true,
	defaultRightOpen = true,
}) {
	const [leftOpen, setLeftOpen] = useState(defaultLeftOpen)
	const [rightOpen, setRightOpen] = useState(defaultRightOpen)
	const isIPhone = useIsIPhone()

	// On iPhone, default both drawers closed and provide top buttons to open them.
	useEffect(() => {
		if (isIPhone) {
			setLeftOpen(false)
			setRightOpen(false)
		}
	}, [isIPhone])
	return (
		<div className="min-h-screen w-full relative">
			<div className="flex items-stretch">
				{/* Left sidebar */}
				<div
					className={`${
						isIPhone
							? `${
									leftOpen ? 'translate-x-0' : '-translate-x-full'
							  } fixed inset-y-0 left-0 w-72 max-w-[80vw] z-40`
							: `${leftOpen ? 'w-72' : 'w-10'}`
					} transition-all duration-200 border-r bg-slate-50 relative`}
					aria-label="Left sidebar">
					<div className="h-10 flex items-center justify-between px-2 border-b">
						<span className="text-xs font-semibold text-gray-700">Options</span>
						<button
							className="text-xs px-2 py-0.5 rounded border bg-white"
							onClick={() => setLeftOpen(!leftOpen)}
							title={leftOpen ? 'Hide options' : 'Show options'}>
							{leftOpen ? '⟨' : '⟩'}
						</button>
					</div>
					<div
						className={`${
							leftOpen ? 'p-2' : 'p-0'
						} overflow-y-auto max-h-[calc(100vh-40px)]`}>
						{leftOpen ? left : null}
					</div>
					{!leftOpen && !isIPhone && (
						<button
							className="absolute top-12 -right-3 z-20 w-6 h-8 rounded-md shadow bg-white border text-xs"
							onClick={() => setLeftOpen(true)}
							title="Expand left panel">
							▶
						</button>
					)}
				</div>

				{/* Main content */}
				<div
					className={`flex-1 min-h-screen bg-gradient-to-b from-white to-slate-50 ${
						isIPhone ? 'pt-10' : ''
					}`}>
					{isIPhone && (
						<div
							className="fixed top-0 inset-x-0 z-30 h-10 bg-white border-b flex items-center justify-between px-2"
							style={{ paddingTop: 'env(safe-area-inset-top)' }}>
							<button
								className="px-2 py-0.5 rounded border bg-white text-xs"
								onClick={() => setLeftOpen(true)}
								title="Open options">
								☰ Options
							</button>
							<button
								className="px-2 py-0.5 rounded border bg-white text-xs"
								onClick={() => setRightOpen(true)}
								title="Open panel">
								Panel ▤
							</button>
						</div>
					)}
					{children}
				</div>

				{/* Right sidebar */}
				<div
					className={`${
						isIPhone
							? `${
									rightOpen ? 'translate-x-0' : 'translate-x-full'
							  } fixed inset-y-0 right-0 w-72 max-w-[80vw] z-40`
							: `${rightOpen ? 'w-72' : 'w-10'}`
					} transition-all duration-200 border-l bg-gray-50 relative`}
					aria-label="Right sidebar">
					<div className="h-10 flex items-center justify-between px-2 border-b">
						<span className="text-xs font-semibold text-gray-700">Panel</span>
						<button
							className="text-xs px-2 py-0.5 rounded border bg-white"
							onClick={() => setRightOpen(!rightOpen)}
							title={rightOpen ? 'Hide panel' : 'Show panel'}>
							{rightOpen ? '⟩' : '⟨'}
						</button>
					</div>
					<div
						className={`${
							rightOpen ? 'p-2' : 'p-0'
						} overflow-y-auto max-h-[calc(100vh-40px)]`}>
						{rightOpen ? right : null}
					</div>
					{!rightOpen && !isIPhone && (
						<button
							className="absolute top-12 -left-3 z-20 w-6 h-8 rounded-md shadow bg-white border text-xs"
							onClick={() => setRightOpen(true)}
							title="Expand right panel">
							◀
						</button>
					)}
				</div>

				{/* iPhone overlay backdrop when any drawer is open */}
				{isIPhone && (leftOpen || rightOpen) && (
					<div
						className="fixed inset-0 z-30 bg-black/40"
						onClick={() => {
							setLeftOpen(false)
							setRightOpen(false)
						}}
					/>
				)}
			</div>
		</div>
	)
}

