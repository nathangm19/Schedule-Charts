# SNT Takt Pipeline for Copilot 365

> **Streamlined path (current):** the **SNT WWP Builder** Copilot agent runs all three
> steps in one chat — attach the two live workbooks, say "run". Its kit lives in
> `agent/`. The per-step folders below remain the manual fallback.
Swedish North Tower · Interior Finishes Lvl E-17 · Mortenson

Three steps, three packages, three prompts. Each package is a Python
script Copilot runs in its code sandbox plus the exact prompt that makes
it run the script verbatim. The scripts ARE the software - Copilot
cannot run an installed program, but it runs Python on attached files.

    Interiors Planner.xlsx ──1──> Planner_Extract.xlsx (+ _Week)
    _Week + SNT WWP Shared ──2──> new "WWP MM.DD.YY" tab
    Planner_Extract (full) ──3──> SNT-Crew-Loading.html + SNT-Gantt.html

## Two rules that make every run work (learned the hard way)
1. **Attach with "+ > Upload from this device", picking files from a
   plain local folder like Downloads.** A file picked out of a
   OneDrive/SharePoint-synced folder arrives as a cloud reference that
   Copilot's Python tool cannot open. Copy inputs to Downloads first.
2. Every prompt starts by making Copilot **list /mnt/data** and confirm
   the attachments physically landed before running - if one is missing
   it stops and names it instead of improvising.

## How to run a step
1. Open Copilot 365 chat (a model with code execution - GPT/Claude both work).
2. Attach the files listed at the top of that step's PROMPT.txt
   (from this OneDrive folder or your machine).
3. Paste the whole PROMPT.txt as your message. Wait for the downloads.

Steps 2 and 3 both consume step 1's output, so run 1 first each week.
Step 3 does not need step 2.

## What each step does
- **1-Extract** - decodes the colored bars on the Planner's "Lookahead"
  sheet (fill color -> trade via the rows-1/2 legend and the workbook
  theme; colored runs -> start/finish; merged bands -> level/zone).
  Auto-picks next Monday as "the week". UNRESOLVED rows are listed in
  the report - those are the only rows needing a human.
- **2-WWP** - clones the newest existing "WWP MM.DD.YY" tab in the live
  workbook (styles, header formulas, day-code conditional formatting,
  dropdowns) and fills it from the week extract under the house rules:
  S/X/C/SC codes with no trailing periods, Floor -> Area in takt order
  -> Organization, Energization = VECA filed under the level named in
  the activity, duration tags stripped, foreman carried from the same
  org's rows on the previous tab. Every other tab passes through
  byte-for-byte (zip surgery, not an openpyxl round-trip).
- **3-Dashboards** - rebuilds the two approved single-file HTML
  dashboards from the full extract. The templates in the folder are the
  locked design; the script only swaps the data. Colors come from the
  Planner's own legend.

## Honest limits (tell your reader, don't hide them)
- ~6 fills sit in no legend -> Trade = UNRESOLVED, listed in step 1's
  report, commented "assign by hand" on the WWP tab.
- Status-colored bars (bright green completion highlight) are real work
  with no trade stated -> "Status (no trade color)".
- A crew = one active activity bar (workfronts). The Planner carries no
  headcount, so none is invented.
- New trade on the Planner? It appears automatically from the legend; if
  its WWP organization name differs, add one line to ORG in
  build_wwp_tab.py.

## Changing the week or window
Every script has a CONFIG block at the top. WEEK_START/START = None
means "next Monday from today"; set "2026-08-24" style dates to pin.

Each script also exists as a .txt twin because some upload boxes refuse
.py files - the content is identical.
