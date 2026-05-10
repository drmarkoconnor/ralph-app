# Version 2 Handoff

Final V2 was locked on `main` after the `generator2_planning` branch was merged.

- Feature commit: `a0bde19` - `Finalize generator and player v2`
- Merge commit: `9be2174` - `Merge final generator and player v2`
- Deployment target shared with Ralph: `https://ralph-pbn-picker.netlify.app/`

## Product State

V2 is now centred on two visible tools from the home page:

- `PBN Generator`: prepares teaching boards, optional auctions, notes, PBN files, and compact teacher PDFs.
- `Bridge Player` / `Bridge Hand Player`: displays and plays boards for classroom or club teaching, with a more projectable visual layout.

The older classic generator and classic player code has not been deleted yet. It is intentionally hidden from the home page and normal navigation so it can be removed later only after user confidence in V2 is high.

## Main User-Facing Changes

- The home page was redesigned with a photographic hero and professional typography.
- Five home concepts were kept in the repo for reference under `/home-concepts/1` to `/home-concepts/5`; option 4 is the live home page.
- A narrated walkthrough is available from the home page.
- The walkthrough uses generated screenshots plus split MP3 narration clips in `public/walkthrough/audio`.
- The old `Ralph Player` visible heading was changed to `Bridge Hand Player`.
- The support/contact email was changed to `bridge@markoconnor.ai`.

## Generator 2

Generator 2 routes:

- `/generator-v2`
- `/generator2`
- `/picker` now points to Generator 2 for backward compatibility.

Important files:

- `src/pages/GeneratorV2.jsx`
- `src/generator-v2/generatorV2Engine.js`
- `src/generator-v2/generatorV2Engine.test.js`
- `src/generator-v2/ManualBoardBuilder.jsx`
- `src/generator-v2/generator2Pdf.js`

Current intended behaviour:

- Generate teaching sets from topics and HCP constraints.
- Keep auctions optional by default with `Suggest`, `Apply`, and `Blank` modes.
- Allow suggested auctions to be accepted or cleared board by board.
- Allow manual board construction by double-clicking cards into and out of selected hands.
- Shade hand boxes by vulnerability: all red/pink when all vulnerable, all green when none vulnerable, and only the vulnerable partnership shaded when N/S or E/W vulnerable.
- Export kept boards as PBN.
- Export kept boards as compact teacher PDF, currently two boards per A4 page.
- Send one board or all kept boards directly to Bridge Hand Player without requiring a PBN file save.
- Preserve Generator 2 state when moving to the player and back.

Deliberately not replicated from the old generator unless requested:

- Deck scaling.
- Seat locking.
- Full metadata table workflow.
- Mandatory generator-side auction choice.

## Bridge Hand Player

Player routes:

- `/player`
- `/player-v2`

Important files:

- `src/pages/PlayerV2.jsx`
- `src/player-v2/playerV2Reducer.js`

Current intended behaviour:

- Load normal PBN files or direct handoffs from Generator 2.
- Save the current board as PBN with the current auction/contract state.
- Allow auction changes in the player rather than forcing all decisions in the generator.
- Reveal hands, start play, confirm/trick controls, and show contract/result panels in a projected teaching layout.
- Use fullscreen from the header; Escape exits fullscreen through the browser Fullscreen API.
- After the opening lead, playable cards expand less aggressively and active hands are spaced wider so adjacent cards remain readable to a larger audience.
- Provide a `Back to Generator` link when the board came from Generator 2.

## Walkthrough

Important files:

- `src/components/WalkthroughTour.jsx`
- `scripts/capture-walkthrough.mjs`
- `public/walkthrough/*.png`
- `public/walkthrough/audio/*.mp3`

The walkthrough has twelve slides:

1. Home page.
2. Generator entry.
3. Teaching topic.
4. Board settings.
5. Auction options.
6. Generate set.
7. Board review.
8. Suggested auction.
9. Teacher notes.
10. Export options.
11. Open player.
12. Player display.

The narration was supplied as one ElevenLabs MP3 and split by natural pauses into one MP3 per slide. The walkthrough advances to the next slide when the current clip ends. If audio is turned off, it falls back to timed slide advancement.

To regenerate screenshots, use:

```bash
npm run capture:walkthrough
```

The capture script assumes the dev server is running at `http://127.0.0.1:5173` unless `RALPH_CAPTURE_URL` is set.

## Session And Handoff Keys

These browser session storage keys link the generator and player:

- `ralph-player-handoff-v1`: PBN payload from Generator 2 to Bridge Hand Player.
- `ralph-generator2-state-v1`: Generator 2 state snapshot for back-navigation.

Be cautious when changing either key because the generator/player navigation flow depends on them.

## Current Verification

Before the final V2 merge, these passed:

- `npm run test:generator2`
- targeted `eslint` over the V2 files
- `npm run capture:walkthrough`
- `npm run build`

The production build still reports existing warnings about stale `baseline-browser-mapping` and `Browserslist` data. These warnings do not currently block the build.

## Known Risks And V3 Starting Points

- Dependency audit should be reviewed before any public marketing push. Previous checks showed advisories around `jspdf`/`dompurify` and `react-router-dom`; fixing them may require careful dependency updates.
- Classic generator/player code is still present but hidden. V3 can remove it once Ralph is comfortable with V2.
- The home concept preview route `/home-concepts/:id` is still available but not advertised. V3 can remove it or keep it as an internal design reference.
- The walkthrough audio is synced from pause detection, not word-level alignment. It is good enough for V2 but could be refined if a new narration is supplied.
- The compact teacher PDF is currently two boards per A4 page. Three boards per page remains an option if teachers want denser printouts.
- Generator 2 does not yet import/edit an existing PBN set. Add only if requested.
- The player is visually much stronger for projection, but audience testing should decide whether card spacing, board scaling, and hand reveal defaults need further adjustment.
- Consider a final naming pass: the home CTA says `Bridge Player`, while the screen heading says `Bridge Hand Player`.

## Design Principles To Preserve

- Keep the workflow teacher-first rather than bridge-player-as-game.
- Generator 2 should prepare and organise hands, not force all teaching decisions.
- Bridge Hand Player should remain the place for live auction correction, reveal decisions, and play-through teaching.
- Prefer clear, large, projectable UI over dense metadata screens.
- Do not reintroduce old generator controls unless they solve a clearly observed user problem.
