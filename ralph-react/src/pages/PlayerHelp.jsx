import React from 'react'
import { Link } from 'react-router-dom'

export default function PlayerHelp() {
	return (
		<div className="max-w-4xl mx-auto p-6 space-y-6 text-sm">
			<div className="flex justify-between items-center">
				<h1 className="text-2xl font-semibold">Player Page Guide</h1>
				<Link to="/player" className="text-sky-600 hover:underline text-sm">
					← Back to Player
				</Link>
			</div>
			<p className="text-gray-700">
				Quick tour of how the player works: load a deal, plan, then play with
				friendly guidance.
			</p>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">1. Loading a Deal</h2>
				<ul className="list-disc ml-5 space-y-1">
					<li>Pick a PBN file. We read the board info, hands, and auction.</li>
					<li>
						If the auction is legal we set the contract + declarer
						automatically. If not, you can type a contract.
					</li>
					<li>
						If no play record is present you play it out manually (that’s the
						main mode).
					</li>
					<li>We set who leads and clear the first trick area.</li>
				</ul>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">2. Pre‑Play Planning</h2>
				<p>
					Shows up after we know declarer + dummy and before the first card. You
					must fill it out before playing.
				</p>
				<ul className="list-disc ml-5 space-y-1">
					<li>
						<strong>Sure winners</strong>: Aces count. A king usually counts if
						you have at least two cards there. A queen sometimes counts if you
						have length + a higher honor.
					</li>
					<li>
						<strong>Likely losers</strong>: Look at the top 3 cards in a suit;
						any spot without A/K/Q usually risks a loser.
					</li>
					<li>
						Your numbers are checked vs a simple reference. Close = “good”,
						kinda close = “neutral”, way off = “bad”.
					</li>
					<li>
						You also get a <strong>Partnership Snapshot</strong>: HCP, shapes,
						trump fit, longest side suits, problem suits, entry hints.
					</li>
					<li>
						The goal: know how many tricks you already own and which suits need
						work.
					</li>
				</ul>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">3. Table Layout</h2>
				<ul className="list-disc ml-5 space-y-1">
					<li>
						Hands shown in a cross: North top, South bottom, West left, East
						right; center panel shows current trick.
					</li>
					<li>
						North/South headers tinted to emphasize the partnership vertically.
					</li>
					<li>
						Legal play enforcement: When following suit is possible, only those
						suit buttons are enabled.
					</li>
				</ul>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">4. Auto Defenders (if Hidden)</h2>
				<ul className="list-disc ml-5 space-y-1">
					<li>
						If defenders are hidden, their plays are chosen automatically using
						a light heuristic:
					</li>
					<li>
						<em>Lead / No lead yet</em>: Prefer length suit (non-trump) and lead
						lowest spot (Basic), or slightly more distribution aware
						(Intermediate).
					</li>
					<li>
						<em>Following suit</em>: Lowest card normally unless a cheap winning
						attempt exists.
					</li>
					<li>
						<em>Partner winning</em>: Usually play lowest card to encourage
						(variant depends on signal mode).
					</li>
				</ul>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">5. Declarer Advice</h2>
				<p className="italic text-gray-600">
					Temporarily disabled — we will integrate a live coach API in a later
					version.
				</p>
				<p className="line-through opacity-60">
					The advice panel reacts to each card you (declarer or dummy) play:
				</p>
				<ul className="list-disc ml-5 space-y-1">
					<li>
						<strong>Quality</strong>: good / neutral / bad — judged on ruffs,
						trump control, and timing.
					</li>
					<li>
						<strong>Why</strong>: Short reason (we rotate phrases so it doesn’t
						get stale).
					</li>
					<li>
						<strong>Next</strong>: What to think about now (draw trumps? build a
						long suit? count entries?).
					</li>
					<li>
						<strong>Principle</strong>: Tiny reminder (like remaining trumps or
						“short-hand ruff”).
					</li>
				</ul>
				<h3 className="font-semibold">What Triggers Messages?</h3>
				<ul className="list-disc ml-5 space-y-1">
					<li>Ruffing in the short trump hand = usually good.</li>
					<li>Pulling enemy trumps early (when safe) = good.</li>
					<li>
						Playing more trumps when they have almost none left = neutral.
					</li>
					<li>Switching to a side suit too early = bad.</li>
					<li>Random discard instead of a useful ruff or plan move = bad.</li>
				</ul>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">6. Trick History</h2>
				<ul className="list-disc ml-5 space-y-1">
					<li>
						Each completed trick stores seat → card mapping and the winner.
					</li>
					<li>
						Navigation controls (⏮ ◀ ▶ ⏭) rebuild state deterministically from
						history allowing review or step-back.
					</li>
				</ul>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">7. Scoring</h2>
				<ul className="list-disc ml-5 space-y-1">
					<li>
						Shows declarer, contract, trick counts, and a computed duplicate
						score once contract & tricks align.
					</li>
				</ul>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">8. Roadmap (Planned)</h2>
				<ul className="list-disc ml-5 space-y-1">
					<li>Deeper LOSER → CONVERTED tracking.</li>
					<li>No-trump specific planning adjustments.</li>
					<li>Probabilistic finesse guidance (low priority).</li>
					<li>Dark theme toggle & accessibility contrast options.</li>
				</ul>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">9. Quick Glossary</h2>
				<ul className="list-disc ml-5 space-y-1">
					<li>
						<strong>Sure Winner</strong>: Trick you expect to win right now
						(ace, sometimes supported K/Q).
					</li>
					<li>
						<strong>Loser</strong>: Trick you’ll probably drop unless you fix it
						(ruff, finesse, discard).
					</li>
					<li>
						<strong>Ruff</strong>: Win with a trump after you run out of the led
						suit.
					</li>
					<li>
						<strong>Entry</strong>: Card that lets you reach the other hand’s
						winners.
					</li>
				</ul>
			</section>
		</div>
	)
}

