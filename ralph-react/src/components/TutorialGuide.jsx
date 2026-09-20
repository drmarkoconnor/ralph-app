import { tutorialCardKey } from '../tutorials/tutorialLibrary.js'
import { visibleTutorialHolding } from '../tutorials/tutorialGuidance.js'

function optionStyle(selected, correct, revealed) {
	if (!revealed) return selected ? 'border-sky-500 bg-sky-50 text-sky-950' : 'border-slate-200 bg-white text-slate-900 hover:border-sky-300'
	if (correct) return 'border-emerald-500 bg-emerald-50 text-emerald-950'
	if (selected) return 'border-rose-400 bg-rose-50 text-rose-950'
	return 'border-slate-200 bg-white text-slate-500'
}

export default function TutorialGuide({
	lesson,
	state,
	derived,
	answer,
	onAnswer,
	dispatch,
	presentationMode = false,
	className = '',
}) {
	if (!lesson) return null
	const promptReady = lesson.kind === 'bidding'
		? (state.practiceAuction?.calls?.length || 0) >= (lesson.promptCallIndex || 0)
		: (state.history?.length || 0) >= (lesson.promptAt || 0)
	const selected = Number.isInteger(answer) ? answer : null
	const revealed = selected !== null
	const correct = revealed && selected === lesson.correctChoice
	const canUseBid =
		lesson.kind === 'bidding' &&
		derived.nextAuctionSeat === 'S' &&
		state.practiceAuction?.status === 'in-progress' &&
		!!lesson.recommendedCall
	const highlightedHolding = visibleTutorialHolding({
		hands: state.play?.remaining || state.hands,
		visibleSeats: state.visibleSeats,
		focusCards: lesson.focusCards,
	})
	const decisionLabel = lesson.decisionTiming === 'this-trick' ? 'Play this trick now' : 'Plan after this trick'

	return (
		<aside className={`${presentationMode ? 'w-[390px]' : 'w-[350px]'} flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border-2 border-amber-300 bg-white text-slate-950 shadow-[0_16px_36px_rgba(0,0,0,0.28)] ${className}`}>
			<header className="shrink-0 bg-slate-950 px-4 py-3 text-white">
				<div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Guided lesson · no AI cost</div>
				<h2 className={`${presentationMode ? 'text-2xl' : 'text-xl'} mt-1 font-black leading-tight`}>{lesson.title}</h2>
			</header>
			<div className={`${presentationMode ? 'max-h-[48vh]' : 'max-h-[42vh]'} min-h-0 flex-1 overflow-y-auto p-4`}>
				{!promptReady ? (
					<div className="rounded-xl bg-sky-50 p-3 text-sm font-bold leading-5 text-sky-950">
						{lesson.kind === 'bidding'
							? 'Watch the auction. The lesson will pause when it is South’s decision.'
							: 'Start the hand. The lesson will pause when the key position is visible.'}
					</div>
				) : (
					<>
						<div className="rounded-xl bg-amber-50 p-3">
							<div className="text-[10px] font-black uppercase tracking-wide text-amber-800">Pattern to notice</div>
							<p className="mt-1 text-sm font-bold leading-5 text-slate-800">{lesson.trigger}</p>
						</div>
						{lesson.kind !== 'bidding' && lesson.decisionCue && (
							<div className={`mt-3 rounded-xl border-2 p-3 ${lesson.decisionTiming === 'this-trick' ? 'border-sky-400 bg-sky-50' : 'border-violet-300 bg-violet-50'}`}>
								<div className={`text-[10px] font-black uppercase tracking-wide ${lesson.decisionTiming === 'this-trick' ? 'text-sky-800' : 'text-violet-800'}`}>{decisionLabel}</div>
								<p className="mt-1 text-sm font-bold leading-5 text-slate-800">{lesson.decisionCue}</p>
								{highlightedHolding && (
									<p className="mt-2 border-t border-slate-300 pt-2 text-xs font-black leading-5 text-slate-950">Cyan outline: {highlightedHolding}</p>
								)}
							</div>
						)}
						<h3 className="mt-3 text-base font-black leading-5">{lesson.prompt}</h3>
						<div className="mt-3 grid gap-2">
							{lesson.choices.map((choice, index) => (
								<button
									key={choice}
									type="button"
									disabled={revealed}
									onClick={() => onAnswer(index)}
									className={`min-h-11 rounded-xl border-2 px-3 py-2 text-left text-sm font-black transition ${optionStyle(selected === index, index === lesson.correctChoice, revealed)}`}>
									<span className="mr-2 opacity-60">{String.fromCharCode(65 + index)}.</span>{choice}
								</button>
							))}
						</div>
						{revealed && (
							<div className={`mt-3 rounded-xl border-2 p-3 ${correct ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
								<div className="font-black">{correct ? 'Good decision.' : 'A useful trap to notice.'}</div>
								<p className="mt-1 text-sm font-semibold leading-5">{lesson.explanation}</p>
								<div className="mt-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-black leading-5 text-amber-100">
									Remember: {lesson.principle}
								</div>
								{lesson.focusCards?.length > 0 && (
									<div className="mt-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-bold leading-5 text-cyan-950">
										<div className="font-black">Why these cards are outlined</div>
										{highlightedHolding && <div className="mt-1">{highlightedHolding}</div>}
										<p className="mt-1">{lesson.highlightExplanation || 'Compare this visible holding when applying the lesson principle. It is a planning aid; normal follow-suit rules still apply.'}</p>
									</div>
								)}
								{canUseBid && (
									<button
										type="button"
										onClick={() => dispatch({ type: 'AUCTION_SOUTH_CALL', call: lesson.recommendedCall })}
										className="mt-3 min-h-11 w-full rounded-xl bg-emerald-700 px-4 py-2 font-black text-white hover:bg-emerald-800">
										Make the suggested call: {lesson.recommendedCall}
									</button>
								)}
								{lesson.recommendedCard && (
									<div className="mt-2 text-sm font-black text-emerald-900">Now choose the outlined {tutorialCardKey(lesson.recommendedCard).replace(':', ' ')}.</div>
								)}
							</div>
						)}
					</>
				)}
			</div>
		</aside>
	)
}
