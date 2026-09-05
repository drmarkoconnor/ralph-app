# Curated Competition PBN Library

## Current first release

The home page now links to `/competitions`, a free teaching collection that can
open a complete competition set at its first board or choose a random board.
Every board enters Player V3 through the existing `ralph-player-handoff-v1`
session handoff, keeps South as the learner seat, and preserves the normal
practice-auction, contract-check, card-play, replay and presentation flows.

The initial checked-in collection contains 30 unique deals:

- **2026 Open USBC Final — Segment 1**: boards 1–15.
- **2019 Open USBC Quarterfinal — Match 3, Segment 4**: boards
  16–30.

Both official sources contain Open and Closed room auctions, play records and
results. Player uses one reviewed Open-room record per board for the recorded
auction. At the end of the learner's play it shows the learner's N–S score next
to both published table scores. Many official play records end at a claim, so
the app does not imply that every source contains 52 recorded card plays.

## Free collection and optional Coach access

Competition replay and expert comparison remain free:

- no account is required to open a pack, bid, play, replay or view the published
  Open and Closed room comparison;
- source attribution is shown independently of Coach access;
- an eligible learner decision can show the same compact, manual Coach control
  used elsewhere in Player V3;
- an unauthorised visitor sees only the small contact/sign-in offer, never a
  large modal; and
- only a signed-in owner or subscriber with active Coach access can make a model
  call, using the normal allowance and metering rules.

The anonymous one-call trial does not apply to curated competition packs.

The Coach does not run automatically and is not required to use any part of the
competition collection. Keeping replay free does not by itself create a
redistribution licence.

## Source and rights posture

The two files come from official United States Bridge Federation pages and are
kept with exact source URLs, upstream SHA-256 checksums, retrieval date and
attribution. Participant and team-name tags are removed from the checked-in
playable PBNs, and those names are not copied into pack metadata. No explicit general
redistribution licence was located. Until written terms or permission are
recorded, keep the replay library free, source-linked and easy to remove, and
do not describe the records as licensed. Optional Coach access remains an
independent account feature rather than a fee for opening the competition
records.

The 2026 source file labels its Final Segment 1 records `2026.04.13`, the first
day of the wider event. The official daily schedule places that final segment on
20 April, so the playable copy records `2026.04.20` and its metadata preserves a
note explaining that reviewed correction; the upstream checksum still covers
the unaltered downloaded source.

The earlier Swedish Bridge Federation final remains a future candidate rather
than a bundled pack. Its downloadable PBN is useful for field-score comparison
but does not contain recorded auction or play sections, and its commercial
redistribution position still needs clarification.

## Static import architecture

Runtime scraping is deliberately absent. The checked-in files live under
`public/competitions/` so a class does not depend on an upstream site, CORS or a
live parser during a lesson. Each pack has:

- a selected-room PBN containing one playable record per board;
- a JSON sidecar with source details, both-room results and normalised N–S
  scores;
- a catalogue entry compiled into the frontend;
- a canonical deal fingerprint for authenticated-access and usage policy;
- no participant or team-name tags or corresponding name metadata; and
- a manifest and public policy file for audit.

The allowlisted importer is
`scripts/competition-pbns/import-competition-pbns.mjs`. It has two modes:

```sh
# Offline: validate all checked-in assets, metadata and fingerprints.
node scripts/competition-pbns/import-competition-pbns.mjs --check

# Maintainer-only: refetch the two pinned official files and verify their
# expected upstream checksums before replacing generated assets.
node scripts/competition-pbns/import-competition-pbns.mjs --fetch
```

The production build has no network dependency. A changed upstream checksum
fails the refresh instead of silently importing different material.

## Adding another competition

Before adding a pack:

1. Prefer an organizer's official PBN and event/result page.
2. Record the exact URL, checksum, retrieval date, attribution and reuse note.
3. Confirm 52 unique cards, dealer, vulnerability, board sequence, contract,
   result and score orientation.
4. State honestly whether the source has deals only, auction, full play,
   claimed play, field results or two-room results.
5. Preserve each canonical deal fingerprint and remove participant/team-name
   tags and metadata.
6. Run the offline check, parser tests, Coach tests and a full Player journey.
7. Confirm that replay and comparison work without signing in, while an actual
   nudge still requires normal owner or subscriber access.
8. Obtain and record written permission before moving a pack into any paid or
   commercially promoted collection.

Netlify Blobs are unnecessary for this reviewed first release. They may become
useful only if an owner-managed catalogue later needs publishing between code
deployments.
