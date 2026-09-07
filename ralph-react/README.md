<h1>Ralph Bridge Teaching App</h1>

Purpose-built tool for creating, annotating, exporting and teaching custom
bridge deals with automated ACOL auction guidance.

Key features:

- Drag & drop deal builder with keyboard entry mode
- Metadata & notes per board (theme, lead, DD Par, scoring, etc.)
- Automated ACOL auction advisor (mainline + alternatives)
- PDF handout export (2 boards per page)
- Word handout export (.docx, one board per page with hard page breaks)
- Pages handout export (.rtf, one board per page, optimized for Apple Pages)
- Classroom Player V3 with South practice bidding, contract check, card play,
  replay and clean presentation mode
- Human-style local computer play using sampled hidden deals and DDS, without
  revealing concealed hands or making paid API calls
- Compact, authenticated manual AI Coach for eligible bidding and play decisions
- Free, attributed competition replay library with published table-score
  comparison; optional Coach nudges retain the normal owner/subscriber access rules

Full non-technical user documentation: see <a href="./HELP.md">HELP.md</a>

Developer quick start:

1. Install deps: `npm install`
2. Run dev server: `npm run dev`
3. Build: `npm run build`

Structure overview:

- `src/DragDropCards.jsx` – Deal builder UI
- `src/pages/PlayerV2.jsx` – Current classroom teaching / play interface
- `src/player-v2/humanComputerPlay.js` – Spoiler-safe sampled computer-play engine
- `src/pages/Competitions.jsx` – Curated competition replay catalogue
- `scripts/competition-pbns/` – Allowlisted static competition pack importer
- `src/lib/acolAdvisor.js` – Deterministic ACOL auction advice engine
- `src/lib/handoutPdf.js` – PDF generator (jsPDF)
- `src/lib/handoutDocx.js` – Native DOCX generator with hard PageBreaks
- `src/lib/handoutRtf.js` – RTF generator for Apple Pages

License: Internal teaching aid (add a LICENSE file if distributing externally).

For feature requests or issues, open a ticket or annotate in HELP.md “Future
Ideas” section.
