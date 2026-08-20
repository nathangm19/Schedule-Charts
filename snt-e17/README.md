# SNT Interior Finishes Lvl E-17 — schedule dashboards

Swedish North Tower (24050001), Interior Finishes Lvl E-17, window 2026-08-24 → 2027-03-01
(129 workdays, 1,602 activities, 154 zones, 35 trades). Data extracted from
"Interior Finishes - Lvl E-17 Flow Schedule Rev 1" via the planner extract script
(see the SNT-Takt-Workflow package, step 1).

- **SNT-Gantt.html** — waterfall Gantt: level → zone, one row per activity, cascading by
  start date. Filter by trade / level / change-order group; Fit-Normal-Wide zoom; hover for
  activity, zone, trade, dates, workdays. Locked-in layout per Nate, 2026-08-19.
- **SNT-Crew-Loading.html** — crew-loading dashboard (stacked-by-trade histogram, one active
  bar = one crew, day slider with pop-out activity list).

Both are single self-contained HTML files — open in any browser, no server.

## src/
- `head.html` + `app.js` + `dash.json` → `build.sh` concatenates them into SNT-Gantt.html.
  Edit the parts, run `sh build.sh`. This is the split intended for Copilot 365 to manipulate.
- `dash.json` is the shared dataset (also feeds the crew-loading dashboard):
  `{days, trades, tcol, levels, zones:[[lvlIdx,name]], cog, zcog, acts, bars:[[trade,zone,startDay,endDay,actIdx]]}`.
  Regenerate from the Planner with the extract pipeline, not by hand.
