# Phase 2 — WWP as web software (parked, decided 2026-08-20)

Phase 1 (live now): Planner -> extract -> WWP tab -> dashboards via the
Copilot pipeline. Excel WWP stays the shared write surface; morning
tracking happens there.

Phase 2 plan (Nate's sequencing): build a workable web product, host it
cheaply (e.g. GitHub Pages for the UI), work out the bugs on scrubbed
sample data, THEN pitch IT and swap onto a Mortenson host to replace
the Excel WWP.

## Requirements it must meet (from the 2026-08-20 discussion)
- Create the weekly work plan directly - no excel-to-excel step
- Subs create/edit activities in a genuinely SHARED system, with
  per-organization scoping and who/when stamps
- Morning tracking per the existing WWP workflow: S / X / C / SC day
  codes (no trailing periods), done-as-planned, variance reason +
  category, PPC rollup

## Architecture notes
- GitHub Pages serves static frontends only: the board UI can live
  there, but multi-user shared state needs a small backend + auth even
  at prototype stage. Decide backend when work starts.
- Pages sites are public (private-repo Pages needs Enterprise): the
  prototype runs on scrubbed/sample data only - never the real SNT
  schedule or foreman names.
- Seed assets already in this repo: extract pipeline (data feed),
  src/dash.json (schema: days/trades/tcol/levels/zones/cog/zcog/acts/
  bars), SNT-Gantt.html (front-end starting point, incl. filters,
  search, day cursor, crew histogram).
- Interim alternative if wanted sooner: Microsoft Lists + column-format
  JSON chips + Power Automate weekly load - zero-server version on the
  M365 tenant (design sketched in the same discussion).
