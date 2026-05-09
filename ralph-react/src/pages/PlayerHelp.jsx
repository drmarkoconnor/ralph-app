import { Link } from 'react-router-dom'

export default function PlayerHelp() {
	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6 text-sm">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-semibold">Ralph Player Guide</h1>
				<Link to="/player" className="text-sm text-sky-600 hover:underline">
					Back to Player
				</Link>
			</div>

			<p className="leading-6 text-gray-700">
				The Player is designed for a bridge teacher presenting to a room. It
				loads a PBN, lets you teach the auction one call at a time, then moves
				into a large-card play table with simple keyboard stepping.
			</p>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">1. Load A PBN</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>Use Load PBN to choose a local .pbn file.</li>
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
					<li>The auction starts with the dealer hand visible by default.</li>
					<li>
						Use the N E S W buttons to reveal or hide any hand. Each button is a
						true toggle.
					</li>
					<li>
						Step through the PBN auction one call at a time, or show the whole
						auction when the class is ready.
					</li>
					<li>
						To explore alternatives, rewind to a call and continue with a
						different legal call.
					</li>
					<li>
						The bidding editor enforces bridge legality while still allowing
						poor judgement bids for teaching.
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
						The default classroom view shows declarer first; dummy appears after
						the opening lead.
					</li>
					<li>
						Defenders remain hidden and auto-play unless Ralph reveals their
						hand and chooses a card manually.
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
						make the losing plays easy to read.
					</li>
					<li>
						The Last Trick panel keeps the previous completed trick visible for
						reference without covering the hands.
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
					<li>Right Arrow: next auction call, or auto-play the next card.</li>
					<li>Left Arrow: previous auction call, or undo one card in play.</li>
					<li>Up Arrow: reveal or hide the partner of the current teaching hand.</li>
					<li>
						Space: show all auction calls before play; during play, toggle all
						hands visible.
					</li>
					<li>R: replay bidding, or restart play from the first trick.</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">6. Current Limits</h2>
				<ul className="ml-5 list-disc space-y-1 text-gray-700">
					<li>Edited auctions are temporary for the lesson and are not yet exported.</li>
					<li>
						ACOL convention settings are planned for a later version; the
						current player focuses on visual classroom flow.
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
