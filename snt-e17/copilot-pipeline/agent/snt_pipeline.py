#!/usr/bin/env python3
"""
SNT PIPELINE - one run, all three deliverable sets.

Orchestrates the three proven stage scripts (planner_extract,
build_wwp_tab, build_dashboards) without changing a line of them:

  stage 1  Interiors Planner  -> Planner_Extract.xlsx + _Week.xlsx
  stage 2  + SNT WWP Shared   -> "<name> - WWP.xlsx" (new weekly tab)
  stage 3  + templates        -> SNT-Crew-Loading.html + SNT-Gantt.html

It identifies the attached workbooks BY CONTENT (sheet names), not by
filename, and runs each stage in its own clean folder so no stage can
grab the wrong file. Attach fewer files and it runs the stages it can:
Planner only -> extract + dashboards. Planner + WWP -> everything.
"""
import re, shutil, subprocess, sys, zipfile
from pathlib import Path

SRC = Path("/mnt/data") if Path("/mnt/data").is_dir() else Path(".")
WEEK = None
for a in sys.argv[1:]:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", a):
        WEEK = a
if WEEK:
    print(f"Target week override: Monday {WEEK}")
OUT = Path(".").resolve()

def sheet_names(x):
    try:
        with zipfile.ZipFile(x) as z:
            wb = z.read("xl/workbook.xml").decode("utf-8", "replace")
        return re.findall(r'<sheet name="([^"]+)"', wb)
    except Exception:
        return []

def find_script(stem):
    for ext in (".txt", ".py"):
        p = SRC / (stem + ext)
        if p.exists():
            return p
    sys.exit(f"MISSING from knowledge: {stem}.txt - re-add it to the agent and retry.")

def run_stage(title, script_stem, staging):
    stage = OUT / ("stage_" + script_stem)
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir()
    for src, name in staging:
        shutil.copy(src, stage / name)
    if WEEK:
        (stage / "week_override.txt").write_text(WEEK)
    shutil.copy(find_script(script_stem), stage / (script_stem + ".py"))
    print(f"\n{'='*62}\nSTAGE: {title}\n{'='*62}")
    r = subprocess.run([sys.executable, script_stem + ".py"],
                       cwd=stage, capture_output=True, text=True, timeout=600)
    print(r.stdout)
    if r.returncode != 0:
        print(r.stderr)
        sys.exit(f"Stage '{title}' failed - full error above. Stopping; "
                 "nothing after this stage was built.")
    return stage

def publish(stage, names):
    got = []
    for n in names:
        p = stage / n
        if p.exists():
            shutil.copy(p, OUT / n)
            if SRC != OUT:
                try: shutil.copy(p, SRC / n)
                except Exception: pass
            got.append(n)
    return got

# ---------------- identify the attachments by content -----------------
OUTPUT_HINTS = ("planner_extract", "extract_week", "- wwp", "snt-crew", "snt-gantt")
planner = wwp = None
extract_full = extract_week = None
for x in sorted(SRC.glob("*.xlsx")):
    low = x.name.lower()
    if low.startswith("~") or any(h in low for h in OUTPUT_HINTS):
        if "planner_extract" in low and "week" in low: extract_week = x
        elif "planner_extract" in low: extract_full = x
        continue
    names = sheet_names(x)
    if any(n in ("Lookahead", "Lvl E-17 Modified") for n in names):
        planner = x
    elif sum(1 for n in names if re.match(r"WWP \d\d\.\d\d\.\d\d", n)) >= 3:
        wwp = x

print("Attachments identified:")
print("  Planner (takt schedule):", planner.name if planner else "- not attached")
print("  WWP workbook           :", wwp.name if wwp else "- not attached")
if not planner and not extract_full:
    sys.exit("\nNothing to run: attach this week's Interiors Planner "
             "(and SNT WWP Shared for the weekly tab). Upload from the "
             "Downloads folder so the files reach Python.")

produced = []

# ---------------- stage 1: extract ------------------------------------
if planner:
    s1 = run_stage("Extract the Planner", "planner_extract",
                   [(planner, planner.name)])
    produced += publish(s1, ["Planner_Extract.xlsx", "Planner_Extract.csv",
                             "Planner_Extract_Week.xlsx", "Planner_Extract_Week.csv"])
    extract_full = OUT / "Planner_Extract.xlsx"
    extract_week = OUT / "Planner_Extract_Week.xlsx"
else:
    print("\n(no Planner attached - using the attached extract files)")

# ---------------- stage 2: WWP tab ------------------------------------
if wwp and extract_week and Path(extract_week).exists():
    s2 = run_stage("Build the WWP tab", "build_wwp_tab",
                   [(wwp, wwp.name), (extract_week, "Planner_Extract_Week.xlsx")])
    made = [p.name for p in s2.glob("* - WWP.xlsx")]
    produced += publish(s2, made)
elif wwp:
    print("\nSKIPPED WWP tab: no week extract available.")
else:
    print("\nSKIPPED WWP tab: the WWP workbook was not attached.")

# ---------------- stage 3: dashboards ---------------------------------
TPL = ["crew_index", "crew_app", "gantt_head", "gantt_app"]
EXT = {"crew_index": ".html", "crew_app": ".js", "gantt_head": ".html", "gantt_app": ".js"}
tpl_files = []
for t in TPL:
    hit = next((SRC / (t + e) for e in (".txt", EXT[t]) if (SRC / (t + e)).exists()), None)
    if hit: tpl_files.append((hit, t + EXT[t]))
if extract_full and Path(extract_full).exists() and len(tpl_files) == len(TPL):
    s3 = run_stage("Build the dashboards", "build_dashboards",
                   [(extract_full, "Planner_Extract.xlsx")] + tpl_files)
    produced += publish(s3, ["SNT-Crew-Loading.html", "SNT-Gantt.html"])
else:
    missing = [t for t in TPL if not any(n.startswith(t) for _, n in tpl_files)]
    print(f"\nSKIPPED dashboards: missing templates {missing} - re-add them "
          "to the agent's knowledge." if missing else
          "\nSKIPPED dashboards: no full extract available.")

# ---------------- summary ---------------------------------------------
print(f"\n{'='*62}\nDONE - files ready for download:")
for n in produced:
    print(f"  {n:<34} {Path(OUT/n).stat().st_size:,} bytes")
if not produced:
    sys.exit("No outputs were produced - see the stage reports above.")
