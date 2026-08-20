# Weekly Work Plan — Build Standard
**Swedish North Tower · Interior Finishes Lvl E–17**
Owner: Nate Mahlum · Companion doc to the WWP Builder agent

This is the reference the WWP Builder agent is grounded on, and the
document a colleague reads to run the process without the agent.

---

## 1. What this process does

Turns one week of the **Interior Finishes Lvl E-17 Flow Schedule** (a
takt plan) into the **WWP tab** in `SNT_WWP_Shared.xlsx`.

- **Input** — the flow schedule, sheet `Lvl E-17 Modified`.
- **Output** — a tab named `WWP MM.DD.YY`, matching the prior weeks.
- **Cadence** — built Thursday/Friday for the following Monday.

An activity belongs in the week if its bar **touches** Monday–Friday —
starting, in progress, or finishing. Not just the ones starting.

---

## 2. Why this needs a data step first

On the flow schedule an activity is a **colored bar**, not a row of
data. The fill color *is* the trade contractor — the legend in rows 1–2
is the key. Three consequences:

1. **Copilot cannot read fill colors.** File grounding extracts text and
   values, not formatting. Ask Copilot to read the schedule directly and
   it will produce confident, invented answers.
2. **Bars are not merged cells.** One run of same-colored cells can hold
   two labels — the second label starts a new activity mid-run. Start
   and finish dates come from the run's first and last calendar column.
3. **Some colors are statuses, not trades** — Complete, Issues, AHJ,
   Owner Furn., and the whole Energization band. See §5.

So the pipeline is: **extract (deterministic) → compose (agent) → QA (human).**
The extract is produced by the `Extract Takt Week` script/flow. Nobody
needs to open Excel to run it.

---

## 3. The extract

The extract is a flat table, one row per activity live that week:

| Column | Meaning |
|---|---|
| Level | Column B band on the schedule, carried down |
| Zone | Column C band, carried down |
| Sub-Zone | Column D band — rare; blank unless the schedule shows one |
| Start / Finish | First and last calendar column of the bar |
| Activity | The bar's label text |
| Fill | Resolved hex of the bar |
| Trade | Fill matched to the rows 1–2 legend |
| SrcRow | Schedule row — this is what preserves takt order |
| Flag | Set when the bar starts before the scan window |

**Keep the extract's row order.** It is the takt plan's own top-to-bottom
sequence, and that is how the WWP is ordered (§6).

---

## 4. Column mapping

| WWP column | Source | Rule |
|---|---|---|
| Floor (D) | Level | JOBDATA floor code — `LVL E`, `LVL 9`, `LVL16`, `Stair 2`. Blank on elevator sections |
| Area (E) | Zone (+ Sub-Zone) | Verbatim. Sub-zone in parentheses. `Z1`–`Z4` → `Zone 1`–`Zone 4` |
| Assignment Description (F) | Activity | Strip a trailing `(Nd;Nc)` only |
| Organization (G) | Trade | Exact JOBDATA name — see §5 |
| Foreman (H) | Prior tabs | Most-used foreman for that org **on that floor** |
| Comments (I) | — | Blank except the cases in §5 |
| Mon–Fri (J–N) | Start / Finish | `S` `X` `C` `SC` — see §7 |
| Sat (O) | — | Always blank. The schedule has no Saturday columns |

---

## 5. Trade → Organization

The flow schedule and the WWP use different names for the same
subcontractor. Translate, never free-text:

| Flow schedule | WWP (JOBDATA) |
|---|---|
| Veca | VECA |
| Pipefitter | MMFS Mechanical Piping |
| Sheet Metal | MMFS Sheet Metal |
| Plumbing | MMFS Plumbing |
| Medgas | Mac-Miller Med gas |
| MM-Controls | Mac-Miller Controls |
| Pro Clean | ProClean |
| Kendell | Kendall |
| Grazinni | Grazzini |
| Acendent | Ascendent |
| NW Precast | Northwest Precast |
| Fairweather | Fairweather Masonry |
| McKinstry | Mckinstry |
| Flynn Roof / Flynn MP | Flynn |
| All Trades | ALL |

Everything else carries its own name.

### Colors that are not trades

| On the schedule | Book it to | Why |
|---|---|---|
| Energization band | **VECA** | Those colors are power systems (Normal / Critical / Life Safety / Optional / Equipment / UPS), not contractors. VECA is the project electrician |
| "Complete" green on ICU door glass | Goldfinch | Prior tabs book ICU doors to Goldfinch |
| Red on sprinkler / FSD / fence | Mckinstry | Red is shared by "McKinstry" and "Issues" in the legend |
| Red on a constraint flag | ALL (Mortenson for permits) | Keep the row, note it in Comments |
| AHJ pink on inspections | ALL | Prior tabs book inspections to ALL |
| Owner Furn. on installs | Mortenson | Note "Owner-furnished install" |
| A fill not in the legend | Match the **work** to the trade | Never pick by nearest color — pale blue and pale green sit closer to each other than to the right answer |

**Known unlegended fill:** `#E2F0D9` (accent6, lighter 80%) is the legacy
Wilkie swatch. Every activity using it is casework, solid surface,
countertops, window sills, or WD-1/SSM-X. Book it to **Wilkie**.

---

## 6. Row order

1. **Section = Floor**, in the WWP template's section order.
2. **Area in takt order** — the sequence the zone bands appear on the
   flow schedule, not alphabetical. Sort by the extract's SrcRow.
3. **Organization** within an area, then start date.

Add-on scope (Eyewash Stations, IDF Cooling Changes, PR build-outs,
Misc Activities) is **not** pulled out into its own group — it sits
wherever the takt plan puts it.

---

## 7. Day marks

| Mark | Meaning |
|---|---|
| `S` | Starts that day |
| `X` | In progress |
| `C` | Finishes that day |
| `SC` | Starts and finishes the same day |

**No periods.** `S.` `C.` `X.` `SC.` mean *complete per plan* in this
workbook and turn the cell green. Never plan with them.

A bar that started before Monday opens the week with `X`. A bar running
past Friday gets no `C`.

---

## 8. Foreman

Read it off the last six WWP tabs — most-used foreman for that
organization **on that floor**. The pairing is floor-specific: VECA is
Brett Collins on 14/15, Greg Mewaldt on 6/7, Mario Mendoza on 1.

Fall back to the org's overall most-used name. **Blank when there is no
precedent, and always blank when Organization is ALL.** Short names are
the house style.

---

## 9. QA gate — before the tab goes out

- [ ] Row count matches the extract. Nothing dropped, nothing added.
- [ ] Every Organization is an exact JOBDATA value.
- [ ] Every Floor is an exact JOBDATA code.
- [ ] No day mark carries a period. No unexplained green.
- [ ] No `(Nd;Nc)` left in a description; `(EDD: …)` still intact.
- [ ] Areas follow takt order, not alphabetical.
- [ ] `TOTAL ACTIVITIES` (S3) equals the row count. If it is off, a
      section header name is missing from its COUNTIFS exclusion list.
- [ ] Every judgment call is stated in the handoff, not buried.

---

## 10. Known gaps

- The `TOTAL ACTIVITIES` COUNTIFS on the template omits four section
  names — *ED Entry (Exterior)*, *Minor ST (Exterior)*, *Tunnel
  (Exterior)*, *West Hoist Infill* — so the count runs high whenever
  those sections are present.
- The `WWP 07.20.26` tab books all Energization to CREO. Wrong — VECA.
- The July 20 tab's start/finish dates were read from whole color runs
  rather than per-label, so multi-label runs share one wide date range.
