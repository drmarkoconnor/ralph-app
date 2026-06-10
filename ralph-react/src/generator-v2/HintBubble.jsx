export default function HintBubble({ enabled = true, children, align = 'right' }) {
	if (!enabled || !children) return null
	const alignClass = align === 'left' ? 'left-0' : 'right-0'
	return (
		<span className="group relative inline-flex align-middle">
			<button
				type="button"
				aria-label="Show help"
				className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 bg-white text-[11px] font-black leading-none text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-100">
				?
			</button>
			<span
				role="tooltip"
				className={`pointer-events-none absolute ${alignClass} top-7 z-40 hidden w-64 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left text-xs font-semibold leading-snug text-white shadow-xl group-hover:block group-focus-within:block`}>
				{children}
			</span>
		</span>
	)
}
