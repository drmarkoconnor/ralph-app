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
						Bristol Bridge Club's PBN Picker — Instructions
					</h1>
					<Link to="/" className="text-sm text-sky-600 hover:underline">
						← Back to app
					</Link>
				</div>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Overview</h2>
					<p className="text-sm text-gray-700 leading-6">
						Bristol Bridge Club's PBN Picker helps you build and manage bridge
						deals. You can select, drag, and distribute cards into the four
						seats (North, East, South, West), save complete deals, and export
						them as PBN files ready for Dealer4 and other PBN consumers.
					</p>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">
						Deck and Selection
					</h2>
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
					<h2 className="text-xl font-semibold text-gray-800 mb-2">
						Buckets (Seats)
					</h2>
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
							Per-card removal: drag a card out of a seat and drop it on the
							deck row to return it to the deck. You can also drag a card
							directly between seats.
						</li>
					</ul>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Toolbar</h2>
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
					</ul>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">
						PBN Export
					</h2>
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
							Dealer, Vulnerable, Deal.
						</li>
						<li>
							Use Download PBN to save a .pbn file; Copy PBN places the text on
							your clipboard; Email opens an email draft.
						</li>

						<li>
							Hints: a checkbox in the top-right toggles hover hints/tooltips on
							buttons and card actions. When dragging from a seat, a "Drop here
							to return to deck" helper appears above the deck.
						</li>
					</ul>
				</section>

				<section className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Tips</h2>
					<ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
						<li>
							If buttons are disabled, check that a selection exists (for Send)
							or that at least one hand is saved (for PBN).
						</li>
						<li>
							On smaller screens, the layout condenses to fit within one
							viewport height; the toolbar stays reachable.
						</li>
						<li>
							For deterministic boards, place all 52 cards manually before
							saving.
						</li>
					</ul>
				</section>

				<footer className="mt-10 pt-4 border-t text-xs text-gray-600">
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

