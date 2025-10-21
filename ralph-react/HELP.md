# Ralph Bridge Teaching App – Help & User Guide

> Inclusive, plain‑English guide for teachers and learners. No technical
> background assumed.

---

## 1. What This App Does

Ralph lets you:

- Build custom bridge deals (drag cards into each seat)
- Save a set of boards for a session
- Export:
  - PBN file (for archiving / other softwares)
  - A printable PDF handout (2 boards per page) with diagrams, notes, and
    optional makeable-contracts grid (overtricks)
  - A Word handout (.docx) with one board per page using hard page breaks
    (macOS‑reliable), NESW cross layout, and a centered mini makeables grid
- Teach and replay deals interactively in the Player screen (step through the
  auction you set, then play out the cards)

Its goal is to reduce prep time and give consistent, well‑explained examples for
club teaching.

---

## 2. Core Concepts (Quick Glossary)

Seat letters: N (North), E (East), S (South), W (West) – North/South are
partners; East/West are partners. Dealer: First to act in the auction (rotates
board by board). Vulnerability: Affects scoring (cycle follows the standard
16‑board pattern automatically). Auction: The sequence of calls (bids and Pass)
used to reach a final contract. Contract: The final agreed level and strain
(e.g. 3♠, 4♥, 3NT). Declarer is the first player of the partnership who bid that
strain. Handout: A PDF or Word summary for students – includes hands, metadata,
and (if enabled) ACOL auction advice.

---

## 3. Two Main Screens

1. Deal Builder (Drag & Drop)
   - Assemble, annotate, and save boards.
2. Player
   - Load boards and walk through auction + play for teaching or self‑study.

You can prepare at home, then use only the Player view in class.

---

## 4. Building Deals (Drag & Drop Screen)

1. Start with a full deck at the left.
2. Drag or tap to move cards onto each seat (N/E/S/W) until every seat has 13
   cards.
3. (Optional) Use keyboard entry mode if you prefer typing – each rank adds a
   card to the current seat/suit.
4. Add teaching metadata (theme, notes, suggested lead, etc.).
5. (Optional) Enter an auction you already want to teach (just type calls
   separated by spaces, use “P” for Pass).
6. Click Save Hand – it’s stored in the session list.
7. Repeat for as many boards as you need.

Tip: If you don’t specify an auction, the automated advisor in the PDF can still
generate one using the actual hands.

---

## 5. Automated ACOL Auction Advice

When you export the PDF, the system can generate a “Mainline” ACOL auction plus
up to two sensible alternatives. What it does:

- Analyses each seat’s High Card Points (HCP) and distribution.
- Chooses the most typical opening (standard ACOL: 12+ to open; 1NT = 12‑14
  balanced without a 5‑card major).
- Suggests the partner’s response and (if relevant) opener’s rebid.
- Stops after three passes following the last bid (normal bridge regulation).
- Provides 2–3 quick “Key Points” bullets (why this auction; what to plan for).
- Gives probabilities: Mainline (high likelihood) and alternatives (style or
  judgment variations).

Why this matters for teaching:

- Consistency – every student sees the same logical reference auction.
- Comparison – alternatives let you discuss style: “What if responder were more
  conservative?”
- Focus – the bullets keep attention on evaluation (fit, point range, plan)
  rather than memorizing sequences.

If you manually entered an auction in the builder, that remains the one shown in
the Player; the advisor is mainly for the PDF pedagogical layer. (You could
still discuss the differences if the automated suggestion diverges.)

---

## 6. Entering Your Own Auction vs Letting the Advisor Work

| Scenario                                                             | Best Choice                            | Why                                                 |
| -------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| You have a precise teaching sequence (e.g. introducing a convention) | Manually enter auction                 | Ensures learners see your exact calls in the Player |
| You want standard natural development                                | Let advisor fill it (PDF)              | Saves time; still accurate ACOL illustration        |
| You want to contrast styles                                          | Enter one; compare with advisor output | Facilitates discussion (judgment vs system)         |
| Early beginner lesson (focus on card play)                           | Minimal or simple auction              | Avoid cognitive overload                            |

---

## 7. Using the Player for Teaching

1. Load or navigate to the board.
2. (If you entered an auction) Step through the calls verbally: ask students
   “Why this bid?”
3. Reveal hands progressively (optional, depending on your teaching style) or
   show all to focus on planning.
4. After the auction, identify declarer and discuss opening lead reasoning.
5. Play out tricks: encourage planning (count winners / losers) referencing the
   auction inferences.

Linking auction to play:

- If the auction suggests a major fit: Ask “How does that decide our trump
  management?”
- If 1NT sequences: Count sure winners; discuss finesse choices.
- If partscore: Evaluate whether pushing to game was realistic (using the
  alternative line probabilities in the PDF handout).

---

## 8. Handouts (PDF and Word)

PDF: Per page shows two boards; Word: each board starts on a new page
deterministically.

Per board includes:

- Header: Board number, Dealer, Vulnerability
- Hand Diagram: All four hands with suits in conventional layout
- Metadata panel: Contract (if set), DD Par (if provided), Lead suggestion,
  Theme, etc.
- Notes: Your curated teaching points (if entered)
- Optional Makeables mini‑grid (double‑dummy, shown as overtricks): in Word it
  is centered with no title; in PDF it appears in the metadata/makeables area
- Auction Advice (if enabled):
  - Mainline auction table (columns N E S W)
  - Key Points (≤3 bullets)
  - Alternatives (probabilities + brief rationale)

Visual alignment details (Word): the NESW cross has no borders; seat content is
left‑aligned with a tiny tabbed indent so suit icons and ranks align in a clean
column; N/S and E/W have subtle partnership shading. The mini makeables grid is
centered and has no heading/title.

Students can annotate the physical handout; you can reference consistent bullet
vocabulary across lessons (e.g. “Combined HCP” or “Aim for game” cues).

---

## 9. Best Practices for Teaching with Auctions

- Always tie a bid to either: (a) Point range, (b) Fit/length, (c) Shape
  description, or (d) Forward plan.
- Pause after the opening bid: ask what responder is evaluating (fit +
  strength).
- Highlight why a _Pass_ can be correct (reinforces discipline, not passivity).
- Use the alternatives to show “What changes if responder upgrades?”
- Emphasize plan bullets: shift students from bid‑naming to goal‑framing (“We
  aim for 8+ major tricks” / “Count to 9 NT winners”).

---

## 10. Troubleshooting & Common Questions

Q: The PDF shows “No auction advice available (debug).” A: That appears if the
advisor couldn’t build in time. Re‑export or ensure each seat has 13 cards.

Q: A board passed out. Is that useful? A: Yes – great for opening lead and
defensive carding practice. The advisor will note which seat held the most HCP.

Q: Unicode suit symbols differ between the hand diagram and auctions. A: For
reliability, auction bids may show letters (S, H, D, C) where fonts could drop
symbols. The card diagrams retain full symbols.

Q: Word for Mac isn’t honoring page breaks. A: The app now generates native
.docx with hard PageBreaks; each board will always begin on a new page in Word
for Mac.

Q: Can I force a different opening (e.g. aggressive style)? A: Enter the auction
manually in the builder; the Player will then follow your sequence. The advisor
output (if generated) can be used to prompt “standard vs aggressive” comparison.

Q: Why only a few bullets? A: Limiting cognitive load drives retention; you can
extend in spoken teaching if needed.

---

## 11. Suggested Lesson Flow Using Ralph

1. Before class: Prepare 6–8 boards showing today’s theme; add short notes (one
   concept per board).
2. Export PDF & print (or share digitally).
3. In class: For each board – preview theme, cover auction reasoning, then play.
4. Ask students to predict dummy before revealing – reinforces auction
   inference.
5. Summarize: Revisit recurring bullet language across boards.

---

## 12. Accessibility & Inclusivity Notes

- Color coding is minimal; suit symbols use both shape and (for red) color
  contrast.
- Text bullets are concise and avoid jargon where possible (e.g. “limit raise”
  appears only with context). Supplement verbally for new players.
- Keyboard entry mode helps users with motor limitations who prefer typing to
  dragging.

---

## 13. Future Ideas (You Can Request)

- Optional stronger / weaker style toggles for the advisor
- Convention layer (Stayman / Transfers) as a switch
- Export to alternate teaching formats (HTML slide deck)
- In‑app replay of recommended line of play with commentary

If something here feels unclear, note it—your feedback helps refine both the
tool and the wording of automation bullets.

---

## 14. Quick Reference Cheat Sheet

Opening (ACOL):

- 12–14 balanced, no 5‑card major: 1NT
- 5‑card major (12+): 1♥ / 1♠ (choose longer; spades if equal)
- Otherwise: Longest minor (prefer 1♦ with 4+ if equal) Responder (simplified in
  advisor):
- Raise with 3+ support (range scales partscore → game)
- 1NT: 6–9 (no fit)
- Pass: <6 and no fit Planning bullet patterns: Fit? Combined HCP? Path to
  tricks? Danger hand?

---

## 15. Getting Help

If something breaks:

- Re‑load the page (clears cache state).
- Ensure each saved board has 52 total cards allocated.
- Check browser console for a one‑line warning and report it.

Enjoy streamlined prep and clearer auctions—spend class time on judgement and
play, not admin.

