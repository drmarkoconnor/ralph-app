import { Link } from 'react-router-dom'

export default function Instructions() {
	const today = new Date()
	const d = today.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
	})
	return (
		<div className="min-h-screen bg-white flex flex-col items-center px-4 py-6">
			<div className="w-full max-w-3xl">
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-3xl font-bold text-gray-800">
						Bristol Bridge Club — Instructions (Player & Generator)
					</h1>
					<Link to="/" className="text-sm text-sky-600 hover:underline">
						← Back to app
					</Link>
				</div>

				{/* Quick navigation */}
				<nav className="mb-6 text-sm">
					<ul className="flex flex-wrap gap-3 text-sky-700">
						<li><a href="#player" className="hover:underline">Player</a></li>
						<li><a href="#generator" className="hover:underline">Generator</a></li>
					</ul>
				</nav>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Overview</h2>
					<p className="text-sm text-gray-700 leading-6">
						Bristol Bridge Club's PBN Picker helps you build and manage bridge
						deals. You can select, drag, and distribute cards into the four
						seats (North, East, South, West), save complete deals, and export
						them as PBN files ready for Dealer4 and other PBN consumers.
					</p>
				</section>

				<section id="player" className="mb-8">
					<h2 className="text-2xl font-semibold text-gray-800 mb-2">Player</h2>
					<p className="text-sm text-gray-700 leading-6 mb-3">
						Load PBN boards, reveal the auction when ready, and step through tricks with a classroom-friendly layout. The Player supports Extended PBN tags, validates auctions, and derives opening leader as right-hand opponent of declarer when needed. Auctions are sanitized to remove annotations (e.g., =1=, $1) and map AP to triple pass.
					</p>
					<div className="space-y-3">
						<div>
							<h3 className="text-lg font-semibold text-gray-800">Loading & navigation</h3>
							<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
								<li>Use “Choose PBN…” to load. Use Prev/Next for board navigation.</li>
								<li>If contract/declarer are missing, set them manually. Opening lead defaults to RHO of declarer (unless Play explicitly specifies a leader).</li>
								<li>Keyboard: Left/Right arrow keys step through the timeline (when Play or PlayScript is present).</li>
							</ul>
						</div>
						<div>
							<h3 className="text-lg font-semibold text-gray-800">Auction</h3>
							<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
								<li>Toggle “Reveal Auction” to hide/reveal bidding. In Teacher Focus, auction starts hidden.</li>
								<li>Auctions are sanitized (annotations removed) and shown cleanly; “AP” (All Pass) appears as three passes.</li>
							</ul>
						</div>
						<div>
							<h3 className="text-lg font-semibold text-gray-800">Play</h3>
							<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
								<li>Follow-suit is enforced after the lead. Legal cards highlight accordingly.</li>
								<li>On trick completion, the winner briefly flashes before the center clears. Winner leads next.</li>
								<li>Card Tally lists the played cards in order; the winning card is bold.</li>
							</ul>
						</div>
						<div>
							<h3 className="text-lg font-semibold text-gray-800">Scoreboard</h3>
							<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
								<li>Declarer/defender trick counts are derived from trick history.</li>
								<li>If PBN includes Result/Score, those are displayed even if play is partial.</li>
								<li>“Defenders to defeat” shows how many tricks are needed to set.</li>
							</ul>
						</div>
						<div>
							<h3 className="text-lg font-semibold text-gray-800">Teacher Focus</h3>
							<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
								<li>Dims everything except hands and the current trick. The trick panel moves above North.</li>
								<li>Metadata, auction, and controls above the cards are hidden. Use the floating “Exit Focus” to leave.</li>
							</ul>
						</div>
					</div>
				</section>

				<section id="generator" className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Generator — Deck and Selection</h2>
					<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
						<li>Click a card to select it; click again to deselect.</li>
						<li>
							You can select multiple cards and then use the Send buttons to
							place them into a seat.
						</li>
						<li>Alternatively, drag a single card and drop it into a seat.</li>
						<li>
							Each seat holds exactly 13 cards. Capacity indicators show current
							counts.
						</li>
					</ul>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Generator — Buckets (Seats)</h2>
					<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
						<li>
							Seats are labeled NORTH (N), EAST (E), SOUTH (S), and WEST (W).
						</li>
						<li>
							Cards inside a seat are automatically sorted by suit (Spades,
							Hearts, Diamonds, Clubs) and rank (A high).
						</li>
						<li>
							Each bucket shows the High Card Points (HCP) total at the bottom.
						</li>
						<li>
							Per-card removal: click a card in a seat to return it to the deck (or drag it out). You can also drag a card directly between seats.
						</li>
					</ul>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Generator — Toolbar</h2>
					<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
						<li>
							Random Complete fills remaining cards randomly into seats up to 13
							each.
						</li>
						<li>
							Clear Selection deselects currently selected deck cards (the
							button only appears when you have a selection).
						</li>
						<li>
							Reset Board clears all seats and returns all cards to the deck.
						</li>
						<li>
							Save Hand stores a complete 52-card distribution for export.
						</li>
						<li>
							Download/Copy/Email PBN lets you export saved deals in PBN format.
						</li>
						<li>
							Delete PBN removes all saved boards after a confirmation. This is
							kept separate from other controls to avoid accidental clicks.
						</li>
					</ul>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Generator — Keyboard Entry Mode</h2>
					<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
						<li>Toggle “Keyboard: ON” under the deck to enable typing.</li>
						<li>Type ranks for the highlighted suit/seat: 2–9, T or 0 for 10, J, Q, K, A.</li>
						<li>Each keystroke moves the card immediately from the deck to the active suit row.</li>
						<li>Press Enter to commit the suit and advance: Clubs → Diamonds → Hearts → Spades, then proceed N → E → S → W.</li>
						<li>Backspace trims the typed buffer; Esc exits keyboard mode.</li>
					</ul>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Generator — PBN Export</h2>
					<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
						<li>
							Dealer rotates N, E, S, W by board number. Vulnerability follows
							the standard 16-board cycle.
						</li>
						<li>
							Deal hands are listed starting from the dealer, clockwise (e.g.,
							Dealer E → E S W N).
						</li>
						<li>
							Line endings are CRLF. Tags include Event, Site, Date, Board,
							Dealer, Vulnerable, Deal. Text fields are sanitized to ASCII and suit glyphs are replaced for Dealer4 compatibility.
						</li>
						<li>
							Use Download PBN to save a .pbn file; Copy PBN places the text on
							your clipboard; Email opens an email draft.
						</li>
						<li>Extended tags supported: System, Theme, Interf, Lead, DDPar, Scoring, Notes, and optional PlayScript. DealHash is added when a full deal is present.</li>
						<li>Preview Template shows a sample Extended PBN using the metadata editor at the top of the app.</li>

						<li>
							Hints: a checkbox in the top-right toggles hover hints/tooltips on
							buttons and card actions. When dragging from a seat, a "Drop here
							to return to deck" helper appears above the deck.
						</li>
					</ul>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">General Tips</h2>
					<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
						<li>
							If buttons are disabled, check that a selection exists (for Send)
							or that at least one hand is saved (for PBN).
						<li>For deterministic boards, place all 52 cards manually before saving.</li>
						<li>Handout PDF includes a Makeable Contracts grid computed via a WASM double-dummy solver.</li>
						</li>
						<li>
							For deterministic boards, place all 52 cards manually before
							saving.
						</li>
						<li>Player supports keyboard stepping with ←/→ when a timeline (Play or PlayScript) is available.</li>
						<li>In Teacher Focus, use the floating “Exit Focus” control to leave focus mode quickly.</li>
					</ul>
				</section>

				<footer className="mt-10 pt-4 border-t text-xs text-gray-600">
					<div className="mb-2">
						<a href="/sources" className="text-sky-600 hover:underline">
							Browse public PBN sources →
						</a>
					</div>
					<div>Copyright © Dr Mark O'Connor — {d}</div>
					<div>
						Enhancement requests:{' '}
						<a
							className="text-sky-600 hover:underline"
							href="mailto:dr.mark.oconnor@googlemail.com">
							dr.mark.oconnor@googlemail.com
						</a>
					</div>
				</footer>
			</div>
		</div>
	)
}

