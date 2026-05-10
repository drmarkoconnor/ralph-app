export const concepts = [
	{
		id: '1',
		name: 'Black Ace',
		image: '/home-hero/concept-1.jpg',
		position: 'center bottom',
		align: 'items-start text-left',
		copyWidth: 'max-w-3xl',
		overlay: 'bg-[linear-gradient(90deg,rgba(5,8,15,0.92)_0%,rgba(5,8,15,0.72)_42%,rgba(5,8,15,0.18)_100%)]',
		accent: 'bg-sky-500',
		cardMarks: [
			{ label: 'A♠', className: 'left-[58%] top-[16%] rotate-[-12deg] text-white/12' },
			{ label: 'K♥', className: 'right-[9%] top-[35%] rotate-[10deg] text-red-200/12' },
		],
	},
	{
		id: '2',
		name: 'Light Aces',
		image: '/home-hero/concept-2.jpg',
		position: 'center center',
		align: 'items-start text-left',
		copyWidth: 'max-w-2xl',
		overlay: 'bg-[linear-gradient(90deg,rgba(248,250,252,0.96)_0%,rgba(248,250,252,0.82)_40%,rgba(248,250,252,0.22)_100%)]',
		light: true,
		accent: 'bg-red-600',
		cardMarks: [
			{ label: 'A♥', className: 'right-[16%] top-[11%] rotate-[13deg] text-red-600/14' },
			{ label: 'K♣', className: 'right-[8%] bottom-[14%] rotate-[-8deg] text-slate-950/10' },
		],
	},
	{
		id: '3',
		name: 'Table Spread',
		image: '/home-hero/concept-3.jpg',
		position: 'center center',
		align: 'items-center text-center',
		copyWidth: 'max-w-4xl',
		overlay: 'bg-[linear-gradient(180deg,rgba(8,13,22,0.76)_0%,rgba(8,13,22,0.44)_46%,rgba(8,13,22,0.82)_100%)]',
		accent: 'bg-amber-400',
		cardMarks: [
			{ label: 'A♠', className: 'left-[9%] top-[19%] rotate-[-8deg] text-white/12' },
			{ label: 'Q♦', className: 'right-[10%] top-[18%] rotate-[12deg] text-red-200/14' },
		],
	},
	{
		id: '4',
		name: 'Studio Deck',
		image: '/home-hero/concept-4.jpg',
		position: 'center center',
		align: 'items-start text-left',
		copyWidth: 'max-w-2xl',
		overlay: 'bg-[linear-gradient(90deg,rgba(17,8,3,0.9)_0%,rgba(17,8,3,0.62)_48%,rgba(17,8,3,0.2)_100%)]',
		accent: 'bg-emerald-500',
		cardMarks: [
			{ label: 'K♠', className: 'right-[13%] top-[13%] rotate-[-13deg] text-white/12' },
			{ label: 'A♣', className: 'right-[22%] bottom-[17%] rotate-[7deg] text-white/10' },
		],
	},
	{
		id: '5',
		name: 'Teaching Hand',
		image: '/home-hero/concept-5.jpg',
		position: 'center center',
		align: 'items-start text-left',
		copyWidth: 'max-w-2xl',
		overlay: 'bg-[linear-gradient(90deg,rgba(2,6,23,0.9)_0%,rgba(2,6,23,0.62)_45%,rgba(2,6,23,0.18)_100%)]',
		accent: 'bg-red-600',
		cardMarks: [
			{ label: 'A♥', className: 'left-[55%] top-[12%] rotate-[11deg] text-red-200/14' },
			{ label: 'K♠', className: 'right-[9%] bottom-[16%] rotate-[-7deg] text-white/11' },
		],
	},
]

export function getConcept(id) {
	return concepts.find((concept) => concept.id === id) || concepts[0]
}
