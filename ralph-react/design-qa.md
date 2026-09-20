# Design QA — tutorial guide / South hand collision

## Evidence

- Source visual truth: `/var/folders/vj/npq33gzx2tdf0rrygvpfmwmw0000gn/T/codex-clipboard-6783749e-af5e-45b7-8123-2818d95d7488.png`
- Normalized source crop: `.qa/tutorial-guide-source-crop.png`
- Revised implementation screenshot: `.qa/tutorial-guide-no-overlap.png`
- Side-by-side comparison: `.qa/tutorial-guide-comparison.png`
- Route: `http://127.0.0.1:5174/player`
- Viewport: 1649 × 815 CSS pixels at device scale 1.
- Source dimensions: 1649 × 1050 pixels including browser chrome. The app region was cropped from y=154 to 1649 × 815 for like-for-like comparison.
- Implementation dimensions: 1649 × 815 pixels.
- State: Bridge Play School board 6, 3NT by South; West led 2C, dummy played 8C, East played KC, South to play; the correct tutorial answer was revealed.

## Full-view comparison

The source showed the tutorial guide extending through the bottom grid row and covering the left side of South's clubs. In the revised view, West's concealed-seat marker and the guide share a bounded middle-row stack. South remains alone in the bottom row. The guide keeps its existing width and hierarchy but scrolls internally when its explanation exceeds the available middle-row height.

Measured revised geometry in the matching normal view:

- Guide: left 134.5, right 444.5, top 358, bottom 622.5.
- South hand: left 391.5, right 1257.5, top 630.5, bottom 793.
- Geometric overlap: false (8 CSS pixels of vertical separation).

Presentation mode was also checked. The guide ended at y=798 and South began at y=806, again with no overlap. The single Restore normal view control remained visible.

## Focused-region comparison

The side-by-side image focuses on the lower-left guide and South hand because that is the only region changed. It shows the original collision on the left and the separated row structure on the right. No focused crop was needed for card artwork or the central trick because those components were not modified.

## Fidelity surfaces

- Fonts and typography: unchanged from the existing Player; guide heading, prompt, answers and explanation retain the same sizes, weights and wrapping.
- Spacing and layout rhythm: corrected. The guide now occupies the middle row and has an internal scrolling body; South retains its aligned suit lanes in the bottom row.
- Colors and visual tokens: unchanged; existing amber, slate, white and felt-theme tokens remain intact.
- Image quality and asset fidelity: card faces, backs and felt rendering are unchanged and remain sharp at the tested viewport.
- Copy and content: unchanged; all lesson prompts, answers and explanations remain available through internal scrolling.

## Comparison history

1. Earlier finding — P1: the guide and South hand occupied intersecting lower-left space, obscuring playable cards.
2. Fix — changed the table grid so the guide is grouped with West in the middle row, made the guide a constrained flex column, and kept its content internally scrollable.
3. Post-fix evidence — normal and presentation-mode bounding boxes report no intersection; the side-by-side capture confirms South's clubs are fully visible.

## Findings

No remaining P0, P1 or P2 mismatch was found for the reported state.

## Interaction and runtime checks

- Started the lesson and accepted the scripted opening lead.
- Played dummy's legal 8C and allowed East's automatic response.
- Revealed the correct teaching answer and scrolled content remained available.
- Checked normal and presentation layouts.
- Browser console errors: none.
- Player tests: 70 passed.
- Production build: passed.

## Follow-up polish

No P3 change is required for this targeted correction.

final result: passed

---

# Design QA — tutorial lead, teaching copy and card focus alignment

## Evidence

- Source visual truth: `/var/folders/vj/npq33gzx2tdf0rrygvpfmwmw0000gn/T/codex-clipboard-61bdf1fc-9091-4e0c-8be4-f251bd514f4c.png`
- Route: `http://127.0.0.1:5175/player`
- Checked states: Bridge Play School boards 6 and 7 at the opening trick in normal table view.
- Board 6 observed state: West led 2D; North held exactly DA-DK-DQ-D5-D4; South held exactly DJ-D3.
- Board 7 observed state: West led 5C; North held exactly CA-CQ-C9-C8-C7-C6; South held exactly CK-C3-C2. After North played C6, the scripted East response was CJ.

## Findings and corrections

1. The source mismatch was genuine: board 7 opened with a diamond while cyan outlines identified clubs, without explaining that the clubs were a later plan.
2. Board 7 now opens with C5, asks for C6 immediately, scripts East's CJ response, and explains South's C2 duck and retained C3 entry step by step.
3. Board 6 now opens with D2 and explains the complete first-trick sequence: dummy wins DA and South releases DJ underneath it.
4. Both generated deals now constrain the relevant suit lengths exactly, preventing random filler cards from contradicting the stated holdings.
5. Every declarer-play lesson now labels its teaching moment as either **Play this trick now** or **Plan after this trick**. The latter explicitly says the cyan cards are a forward plan rather than permission to revoke.
6. The guide names the exact visible outlined holding by seat, then explains why those cards—not merely an unspecified group—are highlighted.

## Visual and interaction checks

- The opening lead suit, prompt, legal card buttons and highlighted suit agree on both corrected entry lessons.
- The exact holding summary is derived only from visible hands; it does not reveal concealed defenders' cards.
- The guide remains within its bounded, internally scrolling panel and does not cover South's cards.
- Existing card artwork, felt, hand alignment and central playing surface are unchanged.
- The invalid `/tutorials` route used briefly during QA produced the expected router 404; valid `/lessons` and `/player` states produced no new application errors.

## Automated checks

- Player tests: 73 passed.
- Generator tests: 22 passed.
- Coach tests: 63 passed.
- Netlify/Vite production build: passed.

final result: passed
