<h1>Ralph Bridge Teaching App</h1>

Purpose-built tool for creating, annotating, exporting and teaching custom
bridge deals with automated ACOL auction guidance.

Key features:

- Drag & drop deal builder with keyboard entry mode
- Metadata & notes per board (theme, lead, DD Par, scoring, etc.)
- Automated ACOL auction advisor (mainline + alternatives)
- PDF handout export (2 boards per page)
- Word handout export (.docx, one board per page with hard page breaks)
- Player view to step through auction & play for teaching

Full non-technical user documentation: see <a href="./HELP.md">HELP.md</a>

Developer quick start:

1. Install deps: `npm install`
2. Run dev server: `npm run dev`
3. Build: `npm run build`

Structure overview:

- `src/DragDropCards.jsx` – Deal builder UI
- `src/pages/Player.jsx` – Teaching / play interface
- `src/lib/acolAdvisor.js` – Deterministic ACOL auction advice engine
- `src/lib/handoutPdf.js` – PDF generator (jsPDF)
- `src/lib/handoutDocx.js` – Native DOCX generator with hard PageBreaks

License: Internal teaching aid (add a LICENSE file if distributing externally).

For feature requests or issues, open a ticket or annotate in HELP.md “Future
Ideas” section.

