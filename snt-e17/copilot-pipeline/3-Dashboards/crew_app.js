/* =====================================================================
 * SNT Flow Schedule — Crew Loading
 * Dashboard logic. Pairs with index.html (markup + CSS) and data.json.
 * Build the single-file dashboard with:  python3 build.py
 * =====================================================================
 *
 * THE DATA  (global `P`, loaded from data.json)
 *   P.days    ["2026-08-24", ...]        workdays only — no weekends/holidays
 *   P.trades  ["AHJ","APEX",...]         35 trade names
 *   P.tcol    ["#FF99FF",...]            each trade's fill color from the
 *                                        flow-schedule legend (rows 1-2)
 *   P.levels  ["Level E","Level D",...]  18 levels, in building order
 *   P.zones   [[levelIdx,"G.1.E"], ...]  160 zones, each tied to a level
 *   P.cog     ["Eyewash Stations",...]   13 change-order groups
 *   P.zcog    [3,-1,0,...]               zone -> CO group index, -1 = not CO
 *   P.acts    ["Final Clean", ...]       de-duplicated activity names
 *   P.bars    [[trade,zone,startDay,endDay,activity], ...]
 *                                        one row per activity bar. Indices
 *                                        point into the arrays above.
 *   P.clipped 67                         bars already running on day 0
 *
 * ONE CREW = ONE ACTIVE BAR. A trade running six bars at once needs six
 * crews in six places. This is workfronts, not headcount — the schedule
 * carries no headcount.
 *
 * WHAT LIVES WHERE
 *   filtering ..... which bars survive the chips
 *   series ........ crews per day; stack() adds the per-trade breakdown
 *   chips ......... the three filter rows and their counts
 *   histogram ..... the big stacked canvas
 *   tooltip ....... hover card: trade -> activity, level, zone
 *   minis ......... one small stacked canvas per level
 *   matrix ........ zone x trade table, day or total mode
 *   render ........ recomputes everything; call it after any state change
 *   pop-out ....... the separate day-list window
 *   controls ...... slider, Play, Jump to peak, Clear all, Pop out
 *
 * STATE
 *   sel.lvl    Set of level indices          empty = all
 *   sel.zone   Set of CO group indices       empty = all
 *   sel.trade  Set of trade indices          empty = all
 *   day        index into P.days             the scrubbed day
 *   mode       'day' | 'total'               matrix mode
 *
 * COMMON EDITS
 *   Change a CO group ....... edit GROUPS in build_data.py, re-run it
 *   Change the date window .. edit START in build_data.py, re-run it
 *   Recolor a trade ......... P.tcol comes from the schedule; override in
 *                             build_data.py if you want a different color
 *   Chart height ............ H in drawHist() / the canvas height in drawMinis()
 *   Play speed .............. the 110 (ms) in the $('play') handler
 */

const DAYS=P.days, TRADES=P.trades, TCOL=P.tcol, LEVELS=P.levels, ZONES=P.zones, ACTS=P.acts, BARS=P.bars;
const ND=DAYS.length, NT=TRADES.length, NZ=ZONES.length, NL=LEVELS.length;
const $=id=>document.getElementById(id);
const NAVY='#004F8C', ORANGE='#F88900', LINE='#d7dde4', MID='#5f666d';
const fmt=n=>n.toLocaleString('en-US');
const dO=s=>new Date(s+'T00:00:00');
const dLong=s=>dO(s).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
const dShort=s=>dO(s).toLocaleDateString('en-US',{month:'short',day:'numeric'});

const zoneLevel=ZONES.map(z=>z[0]), zoneName=ZONES.map(z=>z[1]);
const COG=P.cog, ZCOG=P.zcog, NG=COG.length;
const sel={lvl:new Set(), zone:new Set(), trade:new Set()};
let day=Math.max(0, DAYS.indexOf('2026-08-24')), mode='day', timer=null;

/* ---------- filtering ---------- */
function zoneAllowed(z){
  if (sel.zone.size && !sel.zone.has(ZCOG[z])) return false;
  if (sel.lvl.size  && !sel.lvl.has(zoneLevel[z])) return false;
  return true;
}
const tradeAllowed=t=> sel.trade.size ? sel.trade.has(t) : true;
const pass=b=> tradeAllowed(b[0]) && zoneAllowed(b[1]);
function fbars(){ return BARS.filter(pass); }

/* ---------- series ---------- */
function series(bars){
  const a=new Array(ND).fill(0);
  for (const b of bars) for (let d=b[2]; d<=b[3]; d++) a[d]++;
  return a;
}
function stack(bars){                       // [day][trade] -> crews
  const m=new Array(ND); for(let i=0;i<ND;i++) m[i]=null;
  for (const b of bars) for (let d=b[2]; d<=b[3]; d++){
    const r = m[d] || (m[d]=new Int16Array(NT)); r[b[0]]++;
  }
  return m;
}
function seriesByLevel(bars){
  const m=LEVELS.map(()=>new Array(ND).fill(0));
  const s=LEVELS.map(()=>new Array(ND).fill(null));
  for (const b of bars){ const L=zoneLevel[b[1]];
    for (let d=b[2]; d<=b[3]; d++){ m[L][d]++;
      const r=s[L][d] || (s[L][d]=new Int16Array(NT)); r[b[0]]++; } }
  return [m,s];
}

/* ---------- chips ---------- */
function chipHTML(label,on,count,color,attrs){
  return `<button type="button" class="chip${on?' on':''}" ${attrs}>`+
    (color?`<i class="sw" style="background:${color}"></i>`:'')+
    `<span>${label}</span><span class="n">${fmt(count)}</span></button>`;
}
function buildChips(){
  const all=fbars();
  const cl=LEVELS.map(()=>0), cz=COG.map(()=>0), ct=TRADES.map(()=>0);
  for (const b of BARS){
    const n=b[3]-b[2]+1, g=ZCOG[b[1]], L=zoneLevel[b[1]];
    if (tradeAllowed(b[0])){
      if (!sel.zone.size || sel.zone.has(g)) cl[L]+=n;
      if (g>=0 && (!sel.lvl.size || sel.lvl.has(L))) cz[g]+=n;
    }
    if (zoneAllowed(b[1])) ct[b[0]]+=n;
  }
  $('lchips').innerHTML = LEVELS.map((n,i)=>chipHTML(n, sel.lvl.has(i), cl[i], null, `data-k="lvl" data-i="${i}"`)).join('');
  const gShow = COG.map((n,i)=>i).filter(i => cz[i]>0 || sel.zone.has(i));
  $('zchips').innerHTML = gShow.length
    ? gShow.map(i=>chipHTML(COG[i], sel.zone.has(i), cz[i], null, `data-k="zone" data-i="${i}"`)).join('')
    : '<span class="hint" style="color:var(--mid);font-size:13px">no change order work under this filter</span>';
  $('tchips').innerHTML = TRADES.map((n,i)=>chipHTML(n, sel.trade.has(i), ct[i], TCOL[i], `data-k="trade" data-i="${i}"`)).join('');
  document.querySelectorAll('.chip[data-k]').forEach(c=>{
    c.onclick = ev => {
      const k=c.dataset.k, i=+c.dataset.i, S=sel[k];
      if (ev.ctrlKey || ev.metaKey){ S.has(i)?S.delete(i):S.add(i); }
      else { const only = S.size===1 && S.has(i); S.clear(); if(!only) S.add(i); }
      render();
    };
  });
}

/* ---------- histogram ---------- */
let histGeom=null;
function drawHist(tot, st){
  const cv=$('hist'), dpr=window.devicePixelRatio||1;
  const W=cv.parentElement.clientWidth-32, H=230;
  cv.width=W*dpr; cv.height=H*dpr; cv.style.height=H+'px';
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const PL=44,PR=8,PT=12,PB=32, iw=(W-PL-PR)/ND, peak=Math.max(1,...tot);
  histGeom={PL,PT,PB,iw,peak,W,H};
  g.strokeStyle=LINE; g.fillStyle=MID; g.font='11px "Segoe UI",Arial'; g.textAlign='right';
  [0,Math.round(peak/2),peak].forEach(v=>{
    const y=PT+(H-PT-PB)*(1-v/peak);
    g.beginPath(); g.moveTo(PL,Math.round(y)+.5); g.lineTo(W-PR,Math.round(y)+.5); g.stroke();
    g.fillText(v, PL-7, y+4);
  });
  g.textAlign='left'; let seen='';
  for (let i=0;i<ND;i++){
    const d=dO(DAYS[i]), k=d.getFullYear()+'-'+d.getMonth();
    if (k!==seen){ seen=k;
      const x=PL+i*iw;
      g.strokeStyle='#e7ebf0'; g.beginPath(); g.moveTo(Math.round(x)+.5,PT); g.lineTo(Math.round(x)+.5,H-PB); g.stroke();
      if (d.getMonth()%2===0){ g.fillStyle=MID;
        g.fillText(d.toLocaleDateString('en-US',{month:'short'})+" '"+String(d.getFullYear()).slice(2), x+2, H-PB+14); }
    }
  }
  const bw=Math.max(1,iw-0.6), unit=(H-PT-PB)/peak;
  for (let i=0;i<ND;i++){
    const v=tot[i]; if(!v) continue;
    const x=PL+i*iw; const row=st[i];
    let acc=0;
    for (let t=0;t<NT;t++){
      const c=row?row[t]:0; if(!c) continue;
      const y0=H-PB-(acc+c)*unit, hh=c*unit;
      g.fillStyle=TCOL[t]; g.fillRect(x, y0, bw, hh);
      if (hh>3.5){ g.strokeStyle='rgba(255,255,255,.65)'; g.lineWidth=1;
        g.beginPath(); g.moveTo(x, Math.round(y0)+.5); g.lineTo(x+bw, Math.round(y0)+.5); g.stroke(); }
      acc+=c;
    }
    if (i===day){ g.strokeStyle=ORANGE; g.lineWidth=1.5;
      g.strokeRect(x-0.5, H-PB-v*unit-0.5, bw+1, v*unit+1); g.lineWidth=1; }
  }
  const xd=PL+day*iw+iw/2;
  g.strokeStyle=ORANGE; g.lineWidth=1; g.beginPath();
  g.moveTo(Math.round(xd)+.5,PT-6); g.lineTo(Math.round(xd)+.5,H-PB); g.stroke();
  g.fillStyle=ORANGE; g.beginPath(); g.moveTo(xd-4,PT-6); g.lineTo(xd+4,PT-6); g.lineTo(xd,PT); g.fill();
}

/* ---------- tooltip ---------- */
const tip=$('tip');
function showTip(ev, html){
  tip.innerHTML=html; tip.style.display='block';
  const r=tip.getBoundingClientRect();
  let x=ev.clientX+14, y=ev.clientY+14;
  if (x+r.width>innerWidth-8) x=ev.clientX-r.width-14;
  if (y+r.height>innerHeight-8) y=Math.max(8, ev.clientY-r.height-14);
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
const hideTip=()=>{tip.style.display='none';};

function dayDetail(i, bars, limit){
  const rows=[];
  for (const b of bars) if (b[2]<=i && b[3]>=i) rows.push(b);
  const byTrade={};
  rows.forEach(b=>{ (byTrade[b[0]]=byTrade[b[0]]||[]).push(b); });
  const order=Object.keys(byTrade).map(Number).sort((a,b)=>byTrade[b].length-byTrade[a].length);
  let html=`<div class="th">${dLong(DAYS[i])} &middot; ${rows.length} crew${rows.length===1?'':'s'}</div><table>`;
  let shown=0;
  for (const t of order){
    if (shown>=(limit||7)) { html+=`<tr><td class="zn">+ ${order.length-shown} more trades</td><td class="n"></td></tr>`; break; }
    const list=byTrade[t];
    html+=`<tr><td><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${TCOL[t]};border:1px solid rgba(0,0,0,.3);margin-right:5px"></i><b>${TRADES[t]}</b></td><td class="n">${list.length}</td></tr>`;
    list.slice(0,2).forEach(b=>{
      html+=`<tr><td class="zn" style="padding-left:16px"><b style="color:var(--ink);font-weight:600">${ACTS[b[4]]}</b><br>${LEVELS[zoneLevel[b[1]]]} &middot; ${zoneName[b[1]]}</td><td class="n"></td></tr>`;
    });
    if (list.length>2) html+=`<tr><td class="zn" style="padding-left:16px">+ ${list.length-2} more</td><td class="n"></td></tr>`;
    shown++;
  }
  return html+'</table>';
}

/* ---------- minis ---------- */
function drawMinis(byLvl, bars, stByLvl){
  const host=$('minis');
  const rows=LEVELS.map((n,i)=>i).filter(i=>byLvl[i].some(v=>v>0));
  if(!rows.length){ host.innerHTML='<div class="empty">Nothing selected.</div>'; $('miniNote').textContent=''; return; }
  const ymax=Math.max(1,...rows.map(i=>Math.max(...byLvl[i])));
  $('miniNote').textContent=`y-scale 0 – ${ymax} crews`;
  host.innerHTML=rows.map(i=>{
    const pk=Math.max(...byLvl[i]);
    return `<div class="mini"><h3>${LEVELS[i]}<span class="pk">peak ${pk}</span></h3>`+
           `<canvas data-l="${i}" height="86"></canvas></div>`;
  }).join('');
  host.querySelectorAll('canvas').forEach(cv=>{
    const L=+cv.dataset.l, dpr=window.devicePixelRatio||1;
    const W=cv.parentElement.clientWidth, H=86;
    cv.width=W*dpr; cv.height=H*dpr; cv.style.height=H+'px';
    const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
    const iw=W/ND, s=byLvl[L], stk=stByLvl[L], unit=(H-6)/ymax, bw=Math.max(1,iw-0.4);
    g.strokeStyle=LINE; g.beginPath(); g.moveTo(0,H-.5); g.lineTo(W,H-.5); g.stroke();
    for(let i=0;i<ND;i++){ const v=s[i]; if(!v) continue;
      const row=stk[i]; let acc=0;
      for(let t=0;t<NT;t++){ const c=row?row[t]:0; if(!c) continue;
        g.fillStyle=TCOL[t]; g.fillRect(i*iw, H-(acc+c)*unit, bw, c*unit); acc+=c; }
      if(i===day){ g.strokeStyle=ORANGE; g.lineWidth=1.2;
        g.strokeRect(i*iw-0.5, H-v*unit-0.5, bw+1, v*unit+1); g.lineWidth=1; } }
    const X=day*iw+iw/2;
    g.strokeStyle=ORANGE; g.beginPath(); g.moveTo(Math.round(X)+.5,0); g.lineTo(Math.round(X)+.5,H); g.stroke();
    cv.onmousemove=ev=>{
      const r=cv.getBoundingClientRect(), i=Math.floor((ev.clientX-r.left)/iw);
      if(i<0||i>=ND){hideTip();return;}
      const sub=bars.filter(b=>zoneLevel[b[1]]===L);
      showTip(ev, `<div class="zn" style="font-size:12px;margin-bottom:3px">${LEVELS[L]}</div>`+dayDetail(i, sub, 5));
    };
    cv.onmouseleave=hideTip;
    cv.onclick=ev=>{ const r=cv.getBoundingClientRect(); const i=Math.floor((ev.clientX-r.left)/iw);
      if(i>=0&&i<ND){ day=i; $('sc').value=i; render(); } };
  });
}

/* ---------- matrix ---------- */
function drawMatrix(bars){
  const host=$('mx');
  const val={}, tTot=TRADES.map(()=>0);
  for (const b of bars){
    let v=0;
    if (mode==='day'){ v=(b[2]<=day && b[3]>=day)?1:0; }
    else v=b[3]-b[2]+1;
    if(!v) continue;
    const key=b[1]+':'+b[0]; val[key]=(val[key]||0)+v; tTot[b[0]]+=v;
  }
  const zRows=[...new Set(Object.keys(val).map(k=>+k.split(':')[0]))]
    .sort((a,b)=>zoneLevel[a]-zoneLevel[b] || zoneName[a].localeCompare(zoneName[b]));
  const tCols=TRADES.map((n,i)=>i).filter(i=>tTot[i]>0);
  if(!zRows.length){ host.innerHTML='<div class="empty">No crews '+(mode==='day'?'on '+dLong(DAYS[day]):'in the selection')+'.</div>'; return; }
  let h='<table class="mx"><thead class="mxhead"><tr><th class="z">Zone</th>';
  tCols.forEach(t=>{ h+=`<th class="${sel.trade.has(t)?'on':''}" data-t="${t}"><i style="background:${TCOL[t]}"></i>${TRADES[t]}</th>`; });
  h+='<th class="tot">Total</th></tr></thead><tbody>';
  let curL=-1;
  zRows.forEach(z=>{
    if (zoneLevel[z]!==curL){ curL=zoneLevel[z];
      h+=`<tr class="roll"><th class="z" data-l="${curL}">${LEVELS[curL]}</th>`;
      let rt=0; tCols.forEach(t=>{ let s=0; zRows.filter(q=>zoneLevel[q]===curL).forEach(q=>s+=val[q+':'+t]||0); rt+=s;
        h+=`<td>${s||''}</td>`; });
      h+=`<td class="tot">${rt}</td></tr>`;
    }
    let rt=0;
    h+=`<tr><th class="z sub ${sel.zone.has(z)?'on':''}" data-z="${z}" title="${zoneName[z]}">${zoneName[z]}</th>`;
    tCols.forEach(t=>{ const v=val[z+':'+t]||0; rt+=v;
      h+=`<td class="hit ${v?'':'z0'}" data-z="${z}" data-t="${t}">${v||'·'}</td>`; });
    h+=`<td class="tot">${rt}</td></tr>`;
  });
  h+='<tr class="tot"><th class="z">Total</th>';
  let gt=0; tCols.forEach(t=>{ gt+=tTot[t]; h+=`<td>${tTot[t]}</td>`; });
  h+=`<td>${gt}</td></tr></tbody></table>`;
  host.innerHTML=h;
  host.querySelectorAll('th[data-t]').forEach(el=>el.onclick=ev=>{
    const t=+el.dataset.t; if(ev.ctrlKey||ev.metaKey){ sel.trade.has(t)?sel.trade.delete(t):sel.trade.add(t); }
    else { const only=sel.trade.size===1&&sel.trade.has(t); sel.trade.clear(); if(!only) sel.trade.add(t); } render(); });
  host.querySelectorAll('th[data-z]').forEach(el=>el.onclick=ev=>{
    const g=ZCOG[+el.dataset.z]; if(g<0) return;
    if(ev.ctrlKey||ev.metaKey){ sel.zone.has(g)?sel.zone.delete(g):sel.zone.add(g); }
    else { const only=sel.zone.size===1&&sel.zone.has(g); sel.zone.clear(); if(!only) sel.zone.add(g); } render(); });
  host.querySelectorAll('th[data-l]').forEach(el=>el.onclick=()=>{
    const L=+el.dataset.l;
    const only=sel.lvl.size===1&&sel.lvl.has(L); sel.lvl.clear(); if(!only) sel.lvl.add(L); render(); });
  host.querySelectorAll('td.hit').forEach(el=>el.onclick=()=>{
    const g=ZCOG[+el.dataset.z]; sel.zone.clear(); if(g>=0) sel.zone.add(g);
    sel.trade.clear(); sel.trade.add(+el.dataset.t); render(); });
}

/* ---------- render ---------- */
function render(){
  const bars=fbars(), tot=series(bars), st=stack(bars);
  const [byLvl, stByLvl]=seriesByLevel(bars);
  const peak=Math.max(0,...tot), pi=tot.indexOf(peak);
  const crewDays=tot.reduce((a,b)=>a+b,0);
  $('kPeak').textContent=fmt(peak);
  $('kPeakOn').textContent=peak?dLong(DAYS[pi]):'—';
  $('kDay').textContent=fmt(tot[day]||0);
  $('kDayOn').textContent=dLong(DAYS[day]);
  $('kTot').textContent=fmt(crewDays);
  const parts=[];
  parts.push(sel.trade.size ? (sel.trade.size===1?TRADES[[...sel.trade][0]]:sel.trade.size+' trades') : 'All trades');
  if (sel.zone.size) parts.push(sel.zone.size===1?COG[[...sel.zone][0]]:sel.zone.size+' CO groups');
  if (sel.lvl.size)  parts.push(sel.lvl.size===1?LEVELS[[...sel.lvl][0]]:sel.lvl.size+' levels');
  if (!sel.zone.size && !sel.lvl.size) parts.push('all levels');
  $('selNote').textContent=parts.join(' · ');
  $('winNote').textContent=`${fmt(bars.length)} activities · peak ${peak}`+(P.clipped?` · ${P.clipped} bar clipped at window start`:'');
  $('scDay').textContent=dLong(DAYS[day]);
  $('sc').max=ND-1; $('sc').value=day;
  buildChips();
  drawHist(tot, st); drawMinis(byLvl, bars, stByLvl); drawMatrix(bars);
  $('hist').onmousemove=ev=>{
    if(!histGeom) return;
    const r=$('hist').getBoundingClientRect();
    const i=Math.floor((ev.clientX-r.left-histGeom.PL)/histGeom.iw);
    if(i<0||i>=ND||!tot[i]){hideTip();return;}
    showTip(ev, dayDetail(i, bars));
  };
  $('hist').onmouseleave=hideTip;
  updatePop(bars);
  $('hist').onclick=ev=>{
    const r=$('hist').getBoundingClientRect();
    const i=Math.floor((ev.clientX-r.left-histGeom.PL)/histGeom.iw);
    if(i>=0&&i<ND){ day=i; render(); }
  };
}

/* ---------- pop-out day list ---------- */
let popWin=null;
const POPCSS=`body{margin:0;font:14px/1.45 "Segoe UI",-apple-system,system-ui,Roboto,Arial,sans-serif;color:#231F20;background:#eef1f5}
h1{margin:0;font-size:17px;font-weight:700}
header{background:#004F8C;color:#fff;padding:11px 16px;position:sticky;top:0;z-index:2}
header .sub{color:#b9cde4;font-size:13px;margin-top:2px}
header .cnt{float:right;font-size:26px;font-weight:800;line-height:1}
.wrap{padding:0}
table{border-collapse:collapse;width:100%;font-size:13.5px;background:#fff}
th,td{text-align:left;padding:6px 12px;border-bottom:1px solid #e2e7ec;vertical-align:top}
thead th{position:sticky;top:63px;background:#f5f7fa;font-size:11px;letter-spacing:.7px;text-transform:uppercase;
  color:#5f666d;font-weight:700;z-index:1;border-bottom:1px solid #cfd6de}
tr.grp td{background:#e9eff7;font-weight:700;color:#004F8C;font-size:12px;letter-spacing:.5px;text-transform:uppercase}
td.act{font-weight:600}
td.tr{white-space:nowrap}
td.tr i{display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid rgba(0,0,0,.3);margin-right:6px;vertical-align:-1px}
.none{padding:34px 16px;text-align:center;color:#5f666d}`;

function popHTML(bars){
  const rows=bars.filter(b=>b[2]<=day&&b[3]>=day)
    .map(b=>({act:ACTS[b[4]], lvl:LEVELS[zoneLevel[b[1]]], lvi:zoneLevel[b[1]],
              zone:zoneName[b[1]], tr:TRADES[b[0]], col:TCOL[b[0]]}))
    .sort((x,y)=> x.lvi-y.lvi || x.zone.localeCompare(y.zone) || x.tr.localeCompare(y.tr) || x.act.localeCompare(y.act));
  const filt=$('selNote').textContent;
  let h=`<header><span class="cnt">${rows.length}</span><h1>${dLong(DAYS[day])}</h1>`+
        `<div class="sub">${filt} &middot; ${rows.length} crew${rows.length===1?'':'s'} working</div></header>`;
  if(!rows.length) return h+'<div class="none">No crews scheduled on this day under the current filter.</div>';
  h+='<table><thead><tr><th style="width:44%">Activity</th><th style="width:14%">Level</th><th style="width:26%">Zone</th><th style="width:16%">Trade</th></tr></thead><tbody>';
  let cur=-1;
  rows.forEach(r=>{
    if(r.lvi!==cur){ cur=r.lvi; h+=`<tr class="grp"><td colspan="4">${r.lvl}</td></tr>`; }
    h+=`<tr><td class="act">${r.act}</td><td>${r.lvl}</td><td>${r.zone}</td>`+
       `<td class="tr"><i style="background:${r.col}"></i>${r.tr}</td></tr>`;
  });
  return h+'</tbody></table>';
}
function updatePop(bars){
  if(!popWin || popWin.closed) return;
  try{ popWin.document.body.innerHTML = popHTML(bars); }catch(e){}
}
function openPop(bars){
  popWin=window.open('','sntDayList','width=880,height=920');
  if(!popWin){ alert('Allow pop-ups for this file to open the day list in its own window.'); return; }
  popWin.document.open();
  popWin.document.write(`<!doctype html><meta charset="utf-8"><title>Crews on the selected day</title><style>${POPCSS}</style><body></body>`);
  popWin.document.close();
  popWin.document.title='Crews on the selected day';
  updatePop(bars);
  popWin.focus();
}

/* ---------- controls ---------- */
$('sc').oninput=e=>{ day=+e.target.value; render(); };
$('popBtn').onclick=()=>openPop(fbars());
$('peakBtn').onclick=()=>{ const t=series(fbars()); day=t.indexOf(Math.max(...t)); render(); };
$('reset').onclick=()=>{ sel.lvl.clear(); sel.zone.clear(); sel.trade.clear(); render(); };
$('play').onclick=()=>{
  if (timer){ clearInterval(timer); timer=null; $('play').innerHTML='&#9654; Play'; return; }
  $('play').innerHTML='&#10073;&#10073; Pause';
  timer=setInterval(()=>{ day=(day+1)%ND; render(); }, 110);
};
function setMode(m){ mode=m;
  $('mDay').className='btn'+(m==='day'?'':' ghost'); $('mTot').className='btn'+(m==='total'?'':' ghost');
  drawMatrix(fbars()); }
$('mDay').onclick=()=>setMode('day'); $('mTot').onclick=()=>setMode('total');
let rt; addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(render,150); });
render();
