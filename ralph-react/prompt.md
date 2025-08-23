Agent Brief: Build “Extended PBN v1.0” Editor/Exporter + DealHash Goal

Create a PBN lesson builder that lets a user compose boards via form fields and
a card-picker, validates/fixes (“bullies”) non-conforming inputs, computes a
DealHash, and exports canonical Extended PBN v1.0 files that my player can read
(including all meta tags like Theme, Interf, PlayScript, etc.).

Tech requirements

TypeScript throughout.

React + Vite UI; Tailwind for styling.

Reuse my existing card picker if present; otherwise scaffold a minimal one.

Node crypto (or Web Crypto) for hashing.

Deliver as a small package with:

/src/editor/ React screens + components

/src/pbn/ parsing, normalization, export, hashing

/src/schemas/ Zod (or similar) schemas

/tests/ unit tests (Vitest)

Extended PBN v1.0 — what to emit Required tags per board (canonical order)

[Event "…"]

[Site "…"]

[Date "YYYY.MM.DD"] (zero-padded)

[Board "N"] (unique int ≥ 1 within file)

[Dealer "N|E|S|W"]

[Vulnerable "None|NS|EW|All"]

[Deal "X:HAND_X HAND_X+1 HAND_X+2 HAND_X+3"]

X is the first listed seat; the remaining three follow clockwise.

Each HAND has four suits in order S.H.D.C.

Ranks use AKQJT98765432; void = single hyphen -; ranks sorted descending.

[Contract "level strain [X|XX]"] e.g. 3NT, 4H, 5DX.

[Declarer "N|E|S|W"]

[Auction "StartSeat"] then lines of calls (1C…7NT, Pass, X, XX). End with three
Passes. Example:

[Auction "N"] 1NT Pass 2C Pass 2H Pass 4H Pass Pass Pass

blank line after each board.

Optional standard tags

[Note "…"] (≤ 300 chars each)

[Play "StartSeat"] (if you later want trick logs)

[Result "=|+n|-n"]

Extended teaching tags (safe for other readers to ignore)

Add once per board, after core PBN tags and before [Auction]:

[TagSpec "System,Theme,Interf,Lead,DDPar,Diagram,PlayScript,Scoring,DealHash"]

[System "Acol 12–14 1NT"]

[Theme "Stayman & transfers with interference"]

[Interf "Landy 2C"] (omit if none)

[Lead "W:♠4"] (seat optional)

[DDPar "3NT= (or 4♥= if major fits)"]

[Diagram "N ♠KQ3 ♥A74 ♦Q62 ♣K853 | E … | S … | W …"] (unicode suits OK)

[PlayScript "1. Count winners … \n 2. Hold up once in ♠ …"] (use \n inside the
value)

[Scoring "MPs|IMPs"]

[DealHash "v1:sha256:<64 hex>"]

DealHash — what, why, how

Purpose: a stable fingerprint of who holds each of the 52 cards, used to

guarantee integrity (no 14/12-card seats; no duplicates/missing)

de-duplicate identical deals across files

cache double-dummy or analysis results

detect silent edits

Definition (v1):

Build canonical deck order: S2..SA, H2..HA, D2..DA, C2..CA (52 cards).

For each card in that order, write the owner seat N/E/S/W → a 52-char owner
string.

Hash with SHA-256. Tag format: [DealHash "v1:sha256:<hex>"].

Normalization before hashing (MUST):

Accept sloppy input; normalize suits separator to ., voids to -, ranks 10/t/x →
T, uppercase.

Sort ranks descending per suit; enforce suit order S.H.D.C.

Rotate the 4 hands so [Deal "X:…"] truly lists X, X+1, X+2, X+3 clockwise (map
to absolute N/E/S/W internally).

Validate 52-card integrity: each seat 13 cards; union is exactly 52 unique
cards.

Optional auto-repair: if exactly one duplicate/missing pair, move the dup to the
missing seat and add a [Note "Auto-fix …"]. Otherwise reject.

TypeScript helper (use Web Crypto in browser, Node crypto in CLI):

export type Seat = 'N'|'E'|'S'|'W'; export type Suit = 'S'|'H'|'D'|'C'; const
RANKS = '23456789TJQKA' as const; const SUITS: Suit[] = ['S','H','D','C'];

export function computeDealHashV1(ownerString52: string): Promise<string> { //
ownerString52 must be length 52, chars ∈ {N,E,S,W} const enc = new
TextEncoder().encode(ownerString52); if (typeof window !== 'undefined' &&
'crypto' in window) { return window.crypto.subtle.digest('SHA-256', enc)
.then(buf => 'v1:sha256:' + [...new
Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')); } else {
const { createHash } = await import('crypto'); const hex =
createHash('sha256').update(enc).digest('hex'); return 'v1:sha256:' + hex; } }

UI to build (React) Screen: New Board / Edit Board

Two columns: Metadata and Cards & Auction.

Metadata fields

Event (text)

Site (text)

Date (date picker → emits YYYY.MM.DD)

Board number (int)

Dealer (radio: N/E/S/W)

Vulnerability (select: None/NS/EW/All)

Contract (level + strain + X/XX toggle)

Declarer (N/E/S/W)

Extended tags: System, Theme, Interf (optional), Lead (Seat:Card), DDPar,
Scoring (MPs/IMPs)

PlayScript (multiline → stored with \n)

Notes (repeatable chips or small textareas)

Cards & Auction

Deal entry:

Seat order selector for [Deal "X:…"] prefix (default N).

Card-picker per seat (N/E/S/W), per suit S.H.D.C; enforce 13 cards per seat in
UI.

Live Diagram preview.

Auction builder:

Starts at Dealer; seat rotates automatically.

Buttons: 1C..7NT, Pass, X, XX. Also a way to jump to AP (which inserts the
correct Passes).

Validity check: end with three Passes.

Validation panel (live):

Green checks for: 13 each, 52 unique, sorted S.H.D.C, ranks normalized,
dealer/auction alignment.

Warnings for any auto-repair performed.

Displays DealHash (last 8 hex for brevity) once valid.

Actions

Export Board (append to current PBN file buffer).

Export PBN (download/save the full file).

Import PBN (see “Bullying” below).

“Bullying” (import normalization) rules

When importing any PBN:

Parse tags; tolerate case/spacing; ignore unknown tags.

Auction normalization:

P|p|pass → Pass

Dbl|X → X, Rdbl|XX → XX

AP → expand to the legal number of Pass to end the auction

Rotate auction if first call isn’t by [Dealer]; add [Note "Auto-fix: rotated
auction to start with Dealer=…"]

Deal normalization:

Accept . / space separators; normalize to .

Normalize voids to -, 10|t|x → T

Uppercase; sort ranks descending per suit; ensure suit order S.H.D.C

Rotate hands to match the given prefix X: clockwise

Validate 52-card integrity

If exactly one dup/missing pair → auto-repair and note; otherwise reject with a
clear error

Derive missing fields when possible:

Contract / Declarer from final auction

Result =|±n from raw tricks (if present)

Re-emit canonical Extended PBN v1.0 with [TagSpec …] and computed [DealHash …].

Data model (Zod examples) const RankZ =
z.enum(['2','3','4','5','6','7','8','9','T','J','Q','K','A']); const SuitZ =
z.enum(['S','H','D','C']); const SeatZ = z.enum(['N','E','S','W']);

const HandZ = z.object({ S: z.array(RankZ), H: z.array(RankZ), D:
z.array(RankZ), C: z.array(RankZ), });

const BoardZ = z.object({ event: z.string().min(1), site: z.string().min(1),
date:
z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/),
  board: z.number().int().positive(),
  dealer: SeatZ,
  vul: z.enum(['None','NS','EW','All']),
  dealPrefix: SeatZ,              // the X in [Deal "X:..."]
  hands: z.record(SeatZ, HandZ),  // normalized absolute N/E/S/W
  contract: z.object({ level: z.number().min(1).max(7), strain: z.enum(['S','H','D','C','NT']), dbl: z.enum(['','X','XX']) }),
  declarer: SeatZ,
  auction: z.array(z.enum(['Pass','X','XX']).or(z.string().regex(/^[1-7](C|D|H|S|NT)$/))),
notes: z.array(z.string()).max(10).optional(), ext: z.object({ system:
z.string().optional(), theme: z.string().optional(), interf:
z.string().optional(), lead: z.string().optional(), // e.g. "W:♠4" ddpar:
z.string().optional(), diagram: z.string().optional(), playscript:
z.string().optional(),// with \n scoring: z.enum(['MPs','IMPs']).optional(),
dealHash: z.string().optional(), // filled by exporter }), });

Export helpers

hands → [Deal]: produce X:HAND_X … with suits S.H.D.C, ranks descending, void -.

hands → Diagram: N ♠… ♥… ♦… ♣… | E … | S … | W ….

owner string (52 chars): for each (S,H,D,C) × (2..A), find the owner seat.

DealHash: compute and write [DealHash "v1:sha256:<hex>"].

TagSpec: include
System,Theme,Interf,Lead,DDPar,Diagram,PlayScript,Scoring,DealHash.

Acceptance criteria

Cannot export unless: 13 cards/seat, total 52 unique, auction ends legally,
declarer/contract consistent.

Imported messy files are normalized or rejected with explicit reasons.

DealHash always recomputed on export; shown in UI.

Files open correctly in my player (core tags + extended tags visible).

Unit tests cover:

parsing/normalizing deals with mixed separators/voids,

single dup/miss auto-repair,

owner string correctness,

hash stability across superficial reorderings,

auction rotation & AP expansion.

Minimal board template (use in exporter) [Event "{EVENT}"] [Site "{SITE}"] [Date
"{DATE}"] [Board "{BOARD_NO}"] [Dealer "{DEALER}"] [Vulnerable "{VUL}"] [Deal
"{PREFIX}:{HAND1} {HAND2} {HAND3} {HAND4}"] [Contract "{LEVEL}{STRAIN}{DBL}"]
[Declarer "{DECLARER}"]

[TagSpec "System,Theme,Interf,Lead,DDPar,Diagram,PlayScript,Scoring,DealHash"]
[System "{SYSTEM}"] [Theme "{THEME}"] [Interf "{INTERF}"] [Lead "{LEAD}"] [DDPar
"{DDPAR}"] [Diagram "{DIAGRAM}"] [PlayScript "{PLAYSCRIPT_WITH\\n}"] [Scoring
"{SCORING}"] [DealHash "{DEALHASH}"]

{NOTES…}

[Auction "{AUCTION_START}"] {AUCTION_LINES}
