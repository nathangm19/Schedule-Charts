# WWP Board — phase-2 prototype

The Weekly Work Plan as web software: create the plan directly, let each
organization (subs included) add and edit its own work in a shared
system, and run the morning tracking workflow — S / X / C / SC day
codes, added work, done-as-planned, variance reason + category, live
PPC.

## Two modes, one file

`web/index.html` is the whole front end. It probes for `/api/ping` on
load:

- **No API found → LOCAL DEMO.** Runs entirely in the browser with
  scrubbed sample data; edits persist in that browser only. This is the
  GitHub Pages / work-out-the-bugs mode. Never put real project data in
  this mode on a public host.
- **API found → SHARED.** Full multi-user: org access codes, server-
  enforced scoping (an organization can only write its own rows), every
  create/edit stamped who + when, all screens refreshed within ~5s.

## Run the shared server

    cd server
    cp config.example.json config.json     # set real access codes!
    npm install
    node server.js                          # http://localhost:8787

Storage is `server/data/db.json` (atomic writes) — right for a
crew-scale prototype, swappable for a database on the production host.
`config.json` holds one code per organization plus the admin code; both
are gitignored.

## The workflow in the app

- **Plan mode** — click day cells to set planned days; S/X/C/SC codes
  derive automatically (same marks as the Excel WWP, no trailing
  periods).
- **Track mode** (every morning) — click a planned day to cycle
  done ✓ / missed ✗; click an empty day to log added work (AD).
  Tracking auto-fills done-as-planned; a NO opens variance category +
  reason. PPC = yes / (yes + no), live in the header.
- **Import** — seed a week from the pipeline's Planner_Extract_Week
  CSV. **Export** — JSON or WWP-column CSV (codes carry `.` for done,
  `!` for missed).

## Deploy notes

- GitHub Pages: publish `web/` (a copy lives at repo `/docs` — enable
  Pages on main → /docs). Demo mode only, sample data only.
- Mortenson host later: any Node box runs `server/` as-is behind SSO;
  the front end upgrades itself the moment `/api/ping` answers.
