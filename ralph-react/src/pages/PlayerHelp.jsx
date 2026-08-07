import { Link } from 'react-router-dom'

export default function PlayerHelp() {
	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6 text-sm">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-semibold">Bridge Hand Player Guide</h1>
				<Link to="/player" className="text-sm text-sky-600 hover:underline">
					Back to Player
				</Link>
			</div>

			<p className="leading-6 text-gray-700">
				The Player is designed for a learner playing South and for a bridge
				teacher presenting to a room. It loads a PBN, lets South bid the hand
				before comparing with the recorded auction, then moves into a large-card
				play table.
			</p>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">1. Load A PBN</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>Use Load PBN to choose a local .pbn file.</li>
					<li>Use the board arrows to move through every board in a multi-board file.</li>
					<li>The player reads board, dealer, vulnerability, deal and auction.</li>
					<li>
						If the auction is legal, the contract and declarer are derived
						automatically.
					</li>
					<li>
						If you change the auction, the app warns that the resulting
						contract, trump suit, declarer and opening leader will be updated.
					</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">2. Bidding Classroom</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>
						Play as South is the default. South's cards are visible and the other
						three seats bid automatically until it is South's turn.
					</li>
					<li>
						Choose Pass, Double, Redouble or a legal level and denomination for
						South. Restart begins the practice auction again from the dealer.
					</li>
					<li>
						Use the N E S W buttons to reveal or hide any hand. Each button is a
						true toggle.
					</li>
					<li>
						Choose Review recorded PBN to step through the teacher's original
						auction. Returning to Play as South restores the live practice auction
						exactly where it was left.
					</li>
					<li>
						Return and the arrow keys step calls only in the recorded comparison
						view. They deliberately do nothing to the live practice auction.
					</li>
					<li>
						The first guided release follows a compatible recorded sequence for
						computer seats, then falls back to conservative ACOL rules if South
						chooses another route.
					</li>
					<li>
						The bidding controls enforce legal calls while still allowing a poor
						but legal choice for discussion.
					</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">3. Moving Into Play</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>
						Confirm the auction when Ralph is happy with the final teaching
						contract.
					</li>
					<li>
						Start Play moves to a green table with all four hand positions in
						view.
					</li>
					<li>
						When North is declarer and South is dummy, the whole table rotates
						180 degrees: North moves to the learner position at the bottom, South
						moves to the top, and East and West exchange screen sides.
					</li>
					<li>
						The computer plays every seat outside the learner's control. When
						North declares, the learner controls the North/South partnership;
						when North/South defend, North plays automatically and South remains
						the learner hand.
					</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">4. Card Play Display</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>
						The centre of the table shows the current trick as four physical
						cards on felt.
					</li>
					<li>
						The winning card is highlighted when a trick completes; dimmed cards
						make the losing plays easy to read. The trick stays in the centre until
						the next card is deliberately played.
					</li>
					<li>
						The Last Trick panel keeps the previous completed trick visible for
						reference without covering the hands.
					</li>
					<li>
						Dummy places trumps at the left of the screen. In no-trumps, clubs
						occupy that position; the remaining suits alternate red and black.
					</li>
					<li>
						The hand on turn has a filled amber surround and a plain-language
						“To play” label. Lower choices puts raised legal cards back into the
						fan without playing one; Raise choices restores the teaching cue.
					</li>
					<li>
						Replay hand restarts the current deal at the opening lead. The Felt
						swatches offer four restrained table colours and remember the choice.
					</li>
					<li>
						Declarer and defence trick counts update from the actual trick
						history.
					</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">5. Keyboard Controls</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>Return: next call in the recorded PBN comparison only.</li>
					<li>
						Right Arrow: next recorded call; during play, advance one
						computer-controlled seat when that manual control is available.
					</li>
					<li>Left Arrow: previous recorded call, or undo one card in play.</li>
					<li>Up Arrow: reveal or hide the partner of the current teaching hand.</li>
					<li>
						Space: show all auction calls before play; during play, toggle all
						hands visible.
					</li>
					<li>R: replay the recorded auction, or restart play from the first trick.</li>
					<li>P: enter or leave Presentation Mode.</li>
					<li>Page Up / Page Down, or [ / ]: previous or next board.</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">6. Presentation Mode</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>Use Presentation mode for larger cards, labels and trick information.</li>
					<li>
						The dark operator bar keeps board navigation, contract confirmation,
						teacher pacing, replay, legal-card height, felt and hand visibility
						available on one line.
					</li>
					<li>Fullscreen removes the browser chrome when the display supports it.</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">7. Current Limits</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>The Save PBN button exports the current board, not the whole loaded file.</li>
					<li>
						A new browser may request one complimentary AI nudge. Further AI calls
						require an invited sign-in; the ordinary bridge player remains free and
						does not make paid calls by itself.
					</li>
					<li>
						The complimentary nudge is currently tied to a retained browser cookie.
						Verified email accounts and server-held entitlements are the planned
						next step before wider or paid access.
					</li>
					<li>
						The larger Coach notebook remains available for owner review and a future
						full-hand post-mortem. The small near-hand nudge is the normal live-play aid.
					</li>
					<li>
						Player 1 still exists in the codebase as a fallback, but normal app
						links now open this classroom player.
					</li>
				</ul>
			</section>
		</div>
	)
}
