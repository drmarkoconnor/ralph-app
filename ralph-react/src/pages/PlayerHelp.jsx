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
				teacher presenting to a room. It separates the lesson into three clear
				stages: bid as South, check the resulting contract, then move into the
				large-card play table.
			</p>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">1. Load A PBN</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>Use Load PBN to choose a local .pbn file.</li>
					<li>Use the board arrows to move through every board in a multi-board file.</li>
					<li>The player reads board, dealer, vulnerability, deal and auction.</li>
					<li>
						A blank auction is valid. The Player explains that bidding is the first
						task and waits for Start bidding before any computer seat calls.
					</li>
					<li>
						If the PBN includes an auction, it is kept as a secondary, read-only
						comparison; it never replaces South's practice auction.
					</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">2. Bidding Classroom</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>
						Play as South is the default. During bidding, the screen concentrates on
						South's compact hand, the auction and large bidding controls; the
						four-seat table is reserved for card play.
					</li>
					<li>
						After Start bidding, North, East and West bid automatically using the
						guided ACOL rules until it is South's turn.
					</li>
					<li>
						Choose Pass, Double, Redouble or a legal level and denomination for
						South. Restart auction begins again from the dealer.
					</li>
					<li>
						When a reference auction exists, Compare recorded auction opens it as a
						secondary teaching view. Returning to practice preserves the learner's
						auction exactly where it was left.
					</li>
					<li>
						Return and the arrow keys step calls only in the recorded comparison
						view. They deliberately do nothing to the live practice auction.
					</li>
					<li>
						The bidding controls enforce legal calls while still allowing a poor
						but legal choice for discussion.
					</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">3. Check The Contract</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>
						When bidding ends, the Player presents a checkpoint showing the final
						contract, declarer, opening leader and South's learner role.
					</li>
					<li>
						Check those four facts before confirming. If necessary, restart the
						auction before card play begins.
					</li>
					<li>
						Start play then moves to the full green table with all four hand
						positions in view.
					</li>
					<li>
						If the hand is passed out, there is no card-play phase. Restart the
						auction or move to another board; a teacher can set a contract instead
						when the lesson is intended to begin with card play.
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
						A concealed seat is a compact marker showing only its seat and number of
						cards remaining. It shows no card backs and no HCP information.
					</li>
					<li>
						Only the learner's hand, a hand deliberately revealed by the teacher,
						and dummy after the opening lead remain as full card displays.
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
					<li>Return: next call in the recorded-auction comparison only.</li>
					<li>
						Right Arrow: next recorded call; during play, advance one
						computer-controlled seat when that manual control is available.
					</li>
					<li>Left Arrow: previous recorded call, or undo one card in play.</li>
					<li>
						Up Arrow: during card play, reveal or hide the partner of the current
						teaching hand.
					</li>
					<li>
						Space: show all auction calls before play; during play, toggle all
						hands visible.
					</li>
					<li>R: replay the recorded auction, or restart play from the first trick.</li>
					<li>P: present the table, or restore the normal Player view.</li>
					<li>Page Up / Page Down, or [ / ]: previous or next board.</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">6. Present The Table</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>
						Choose Present table once to enlarge the table and request browser
						fullscreen.
					</li>
					<li>
						The clean presentation view hides the app header, navigation and Player
						toolbars so the hands and central trick use the projected screen.
					</li>
					<li>
						Restore normal view · Esc remains available as the single exit control.
					</li>
					<li>
						If the browser denies fullscreen, the same clean table stays available
						inside the page; card play is not interrupted.
					</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">7. Competition Replays And Coach</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>
						Choose Play a famous final on the Home screen to practise a reviewed
						competition set or start on a random board.
					</li>
					<li>
						After a competition hand, your North–South score is compared with the
						published Open and Closed room scores.
					</li>
					<li>
						Competition replay and expert comparison are free and clearly attributed.
						At an eligible South or learner-controlled North decision, the same compact,
						manual AI nudge is available only through an authorised Coach account.
					</li>
					<li>
						Without Coach access, the Player shows a small contact or sign-in offer rather
						than interrupting the hand. AI never runs automatically.
					</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">8. Current Limits</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>The Save PBN button exports the current board, not the whole loaded file.</li>
					<li>
						The automatic practice bidder uses a guided ACOL foundation and does not yet
						model every competitive auction or convention.
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
