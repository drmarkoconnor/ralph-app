# 2026-05-14 Session Handoff

This note records the current state after the Generator 2, ACOL convention, and Player 2 follow-up work.

## Repository State

- Active branch: `main`
- Remote: `origin/main`
- Latest pushed commits:
  - `83ce504` - `Pause player automation after completed hand`
  - `7654eb1` - `Add ACOL convention profiles`
  - `519c451` - `Expand generator teaching topics`
  - `3c48b30` - `Add v2 handoff notes`

When returning, start with:

```bash
git status -sb
git pull --ff-only origin main
```

## What Changed In This Session

### Generator 2 Card Selection

Manual board building now supports the extra workflow Ralph wanted:

- Select multiple cards first.
- Send the selected block to a chosen seat.
- Keep existing double-click and drag behaviour.
- Enforce normal bridge limits, especially 13 cards per hand.
- Make the full hand block clickable, not only the badge.

Key file:

- `src/generator-v2/ManualBoardBuilder.jsx`

### Generator 2 Teaching Topics

The teaching-topic list was expanded and tightened. New and improved topics include stronger ACOL options such as:

- 2C opening, modelled as the strong artificial 23+ point style.
- 2NT opening, modelled as 20-22 balanced.
- Takeout doubles now require the suggested auction to include the double.

The generation logic is algorithmic and does not require an OpenAI API. That is intentional: it avoids cost and keeps the app deterministic enough to test.

Key files:

- `src/generator-v2/generatorV2Engine.js`
- `src/generator-v2/generatorV2Engine.test.js`
- `src/pages/GeneratorV2.jsx`

### ACOL Convention Profiles

The old compact `ACOL Defaults` panel has been expanded without taking over the screen.

Current behaviour:

- Standard, Benjaminised, and Custom profile choices.
- Editable ranges for `1NT`, `2NT`, strong `2C`, Benjamin `2C`, Benjamin `2D`, weak two, and weak three settings where relevant.
- Convention toggles for Stayman, transfers, weak twos, weak threes, and Benjaminised options.
- Topic generation respects disabled conventions instead of silently generating clashing boards.
- If a selected topic is incompatible with the current ACOL settings, Generator 2 surfaces guidance instead of falling back to an unrelated hand type.
- Hover/focus summary explains which conventions are in play and where to change them.

Main design constraint:

- Keep the panel compact and two-column where useful.
- Avoid large new visual sections unless Ralph explicitly asks for a bigger conventions editor.

Key files:

- `src/pages/GeneratorV2.jsx`
- `src/generator-v2/generatorV2Engine.js`
- `src/generator-v2/generatorV2Engine.test.js`

### Player 2 Automation Pause

Player 2 now avoids the irritating behaviour where, after a hand has completed, stepping backwards through the play starts automation again.

What changed:

- A compact `Stop` / `Resume` play-control button was added.
- Automation pauses automatically after the 13th trick completes.
- Undoing cards after completion keeps automation paused, so the teacher can review the hand calmly.
- Resuming automation is still possible if wanted.

Root cause:

- After the completed hand was undone, the player returned to a valid `play` phase with a current turn seat. The existing timer-based automation then resumed because nothing explicitly told it the teacher was reviewing the completed hand.

Key files:

- `src/pages/PlayerV2.jsx`
- `src/player-v2/playerV2Reducer.js`
- `src/player-v2/playerV2Reducer.test.js`

## Verification Already Run

These checks passed before pushing:

```bash
node --test src/player-v2/playerV2Reducer.test.js
npm run test:generator2
npx eslint src/pages/PlayerV2.jsx src/player-v2/playerV2Reducer.js src/player-v2/playerV2Reducer.test.js src/generator-v2/generatorV2Engine.js src/generator-v2/generatorV2Engine.test.js src/pages/GeneratorV2.jsx
npm run build
```

A browser smoke test was also run against Player 2 to confirm that the new `Stop` / `Resume` control fits in the existing play-control area and does not cause horizontal overflow.

The build still reports the existing stale `baseline-browser-mapping` and `Browserslist` data warnings. These warnings are not new and did not block the build.

## Likely Next Conversation

Ralph may come back with preferences for ACOL standards. The likely expansion area is a more configurable convention profile, for example:

- Different 1NT ranges, such as 12-14, 14-16, or 15-17.
- Strong two style: traditional ACOL strong twos, Benjaminised 2C/2D, or strong artificial 2C only.
- Weak two suit choices.
- Whether transfers are on over 1NT.
- Whether Stayman is on.
- Whether 2NT is 20-22 or another agreed range.
- Whether weak threes are enabled.

Implementation guidance:

- Keep the existing compact panel unless the requested choices no longer fit cleanly.
- Prefer profile presets plus a `Custom` override rather than showing every possible bridge setting at once.
- Every convention toggle or point range must flow into the generator engine and tests.
- Do not allow a topic to generate if the selected ACOL settings say that convention is off.
- Add regression tests for every newly configurable convention.

## Useful Commands

```bash
npm run test:generator2
node --test src/player-v2/playerV2Reducer.test.js
npm run build
npm run dev -- --host 127.0.0.1
```

## Cautions

- The app is currently working well visually. Make future changes surgically and check the screen at normal laptop width before pushing.
- Generator 2 should remain teacher-first: quick topic choice, sensible generated boards, optional auctions, and easy handoff to Player 2.
- Player 2 play code is now behaving well. Avoid broad refactors there unless there is a clear bug or user request.
- The generator should continue to use deterministic ACOL bridge rules rather than an OpenAI API for normal hand and auction generation.
