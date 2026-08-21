const DAYS=P.days, TRADES=P.trades, TCOL=P.tcol, LEVELS=P.levels, ZONES=P.zones,
      COG=P.cog, ZCOG=P.zcog, ACTS=P.acts, BARS=P.bars;
const ND=DAYS.length;
const $=id=>document.getElementById(id);
const zLvl=ZONES.map(z=>z[0]), zName=ZONES.map(z=>z[1]);
const fmt=n=>n.toLocaleString('en-US');
const dO=s=>new Date(s+'T00:00:00');
const dShort=s=>dO(s).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const dLong=s=>dO(s).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});

const sel={trade:new Set(), lvl:new Set(), cog:new Set()};
let qTerms=[];                                // activity-name search, comma = OR
const ACTL=ACTS.map(a=>a.toLowerCase());
const qPass=b=>!qTerms.length || qTerms.some(t=>ACTL[b[4]].includes(t));
let zoomSel=0, dayW=8;                        // px per workday (0 = fit to the panel)
let horizon=null;                             // null=full, or workdays (5/10/30)
let curDay=0;                                 // draggable day cursor
const NDv=()=> horizon?Math.min(horizon,ND):ND;
const dayWidth=()=> zoomSel ||
  Math.min(64,Math.max(4,Math.floor((document.getElementById('gwrap').clientWidth-322)/NDv())));
const LANE=19, BAND=24;                       // lanes stack inside a zone row

/* one row per activity: lane = position in the zone's start-sorted list */
const lanes=list=>({out:list.map((b,i)=>[b,i]), n:Math.max(1,list.length)});
const CHW=6.1;                                 // approx px per character at 10.5px
const labelW=t=>t.length*CHW+12;

/* text colour that stays readable on the schedule's own trade colours */
const inkOn={};
function ink(hex){
  if(inkOn[hex]!==undefined) return inkOn[hex];
  const h=hex.replace('#',''), r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  return inkOn[hex]=(0.299*r+0.587*g+0.114*b)<140?'#fff':'#111';
}

$('span').textContent=`Swedish North Tower · Interior Finishes Lvl E–17 · ${DAYS[0]} to ${DAYS[ND-1]} · ${ND} workdays`;

const pass=b=>
  qPass(b) &&
  (!horizon        || b[2]<horizon) &&
  (!sel.trade.size || sel.trade.has(b[0])) &&
  (!sel.lvl.size   || sel.lvl.has(zLvl[b[1]])) &&
  (!sel.cog.size   || sel.cog.has(ZCOG[b[1]]));

/* ---------- chips ---------- */
function chip(label,on,count,color,attrs){
  return `<button type="button" class="chip${on?' on':''}" ${attrs}>`+
    (color?`<i class="sw" style="background:${color}"></i>`:'')+
    `<span>${label}</span><span class="n">${fmt(count)}</span></button>`;
}
function buildChips(){
  const ct=TRADES.map(()=>0), cl=LEVELS.map(()=>0), cg=COG.map(()=>0);
  for (const b of BARS){
    if (!qPass(b) || (horizon && b[2]>=horizon)) continue;
    const okT=!sel.trade.size||sel.trade.has(b[0]);
    const okL=!sel.lvl.size  ||sel.lvl.has(zLvl[b[1]]);
    const okG=!sel.cog.size  ||sel.cog.has(ZCOG[b[1]]);
    if (okL&&okG) ct[b[0]]++;
    if (okT&&okG) cl[zLvl[b[1]]]++;
    if (okT&&okL && ZCOG[b[1]]>=0) cg[ZCOG[b[1]]]++;
  }
  $('tchips').innerHTML=TRADES.map((n,i)=>chip(n,sel.trade.has(i),ct[i],TCOL[i],`data-k="trade" data-i="${i}"`)).join('');
  $('lchips').innerHTML=LEVELS.map((n,i)=>chip(n,sel.lvl.has(i),cl[i],null,`data-k="lvl" data-i="${i}"`)).join('');
  $('gchips').innerHTML=COG.map((n,i)=>chip(n,sel.cog.has(i),cg[i],null,`data-k="cog" data-i="${i}"`)).join('');
  document.querySelectorAll('.chip[data-k]').forEach(c=>{
    c.onclick=ev=>{
      const S=sel[c.dataset.k], i=+c.dataset.i;
      if (ev.ctrlKey||ev.metaKey){ S.has(i)?S.delete(i):S.add(i); }
      else { const only=S.size===1&&S.has(i); S.clear(); if(!only) S.add(i); }
      render();
    };
  });
}

/* ---------- tooltip ---------- */
const tip=$('tip');
function showTip(ev,html){
  tip.innerHTML=html; tip.style.display='block';
  const r=tip.getBoundingClientRect();
  let x=ev.clientX+14, y=ev.clientY+14;
  if(x+r.width>innerWidth-8) x=ev.clientX-r.width-14;
  if(y+r.height>innerHeight-8) y=Math.max(8,ev.clientY-r.height-14);
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
const hideTip=()=>{tip.style.display='none';};

/* ---------- render ---------- */
function render(){
  buildChips();
  dayW=dayWidth();
  const N=NDv();
  if(curDay>=N) curDay=0;
  const bars=BARS.filter(pass);
  const W=N*dayW;

  // KPIs
  const zs=new Set(bars.map(b=>b[1]));
  $('kAct').textContent=fmt(bars.length);
  $('kZone').textContent=fmt(zs.size);
  const lv=new Set([...zs].map(z=>zLvl[z]));
  $('kZoneN').textContent=`across ${lv.size} level${lv.size===1?'':'s'}`;
  if (bars.length){
    $('kFirst').textContent=dShort(DAYS[Math.min(...bars.map(b=>b[2]))]);
    $('kLast').textContent =dShort(DAYS[Math.max(...bars.map(b=>b[3]))]);
  } else { $('kFirst').textContent='—'; $('kLast').textContent='—'; }
  const tsel=sel.trade.size ? (sel.trade.size===1?TRADES[[...sel.trade][0]]:sel.trade.size+' trades') : 'All trades';
  $('kActN').textContent=qTerms.length ? `${tsel} · "${qTerms.join('" or "')}"` : tsel;
  $('note').textContent=`${fmt(bars.length)} activities · ${zs.size} zones`;

  if(!bars.length){ $('grid').innerHTML='<div class="empty" style="grid-column:1/-1">Nothing matches this filter.</div>'; return; }

  // rows: levels that have work, then their zones that have work
  const byZone={}; bars.forEach(b=>(byZone[b[1]]=byZone[b[1]]||[]).push(b));
  const zoneIds=Object.keys(byZone).map(Number)
    .sort((a,b)=>zLvl[a]-zLvl[b] || Math.min(...byZone[a].map(x=>x[2]))-Math.min(...byZone[b].map(x=>x[2])));

  // month bands + week ticks (week = first WORKDAY of the week, so holidays
  // don't drop a tick) + every day's date once there's room for it
  let axis='', gl='';
  const mos=[]; let seenMo='', seenWk=null;
  const showDays = dayW>=13;
  for(let i=0;i<N;i++){
    const d=dO(DAYS[i]), x=i*dayW;
    const mo=d.getFullYear()+'-'+d.getMonth();
    const wk=Math.floor((d-dO(DAYS[0]))/864e5/7);
    if(mo!==seenMo){ seenMo=mo; seenWk=wk;
      mos.push({x, d});
      axis+=`<div class="div modiv" style="left:${x}px"></div>`;
      gl  +=`<div class="gl mo" style="left:${x}px"></div>`;
    } else if(wk!==seenWk){ seenWk=wk;
      axis+=`<div class="div" style="left:${x}px"></div>`;
      gl  +=`<div class="gl" style="left:${x}px"></div>`;
      if(!showDays && dayW>=8) axis+=`<div class="wk" style="left:${x}px">${d.getDate()}</div>`;
    }
    if(showDays) axis+=`<div class="dy" style="left:${x}px;width:${dayW}px">${d.getDate()}</div>`;
  }
  // spotlight the next 6 weeks when looking at the full window
  const SPOT=Math.min(30,N);
  let spot='';
  if(!horizon && N>SPOT){
    spot=`<div class="spot" style="left:0;width:${SPOT*dayW}px"></div>`;
    axis+=`<div class="spotlab" style="left:${SPOT*dayW+5}px">&larr; NEXT 6 WEEKS</div>`;
  }
  // a month label only renders if its own band can hold it — no collisions at any zoom
  mos.forEach((m,i)=>{
    const w=(i+1<mos.length?mos[i+1].x:W)-m.x;
    const full=m.d.toLocaleDateString('en-US',{month:'short'})+'\u2019'+String(m.d.getFullYear()).slice(2);
    const txt = w>=54 ? full : w>=30 ? m.d.toLocaleDateString('en-US',{month:'short'}) : '';
    if(txt) axis+=`<div class="mo" style="left:${m.x}px;width:${w}px">${txt}</div>`;
  });

  const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const rows=[]; let curL=-1, H=0;
  for(const z of zoneIds){
    if(zLvl[z]!==curL){ curL=zLvl[z];
      rows.push(`<div class="lab band" style="height:${BAND}px">${LEVELS[curL]}</div>`+
                `<div class="track band" style="width:${W}px;height:${BAND}px"></div>`);
      H+=BAND;
    }
    const list=byZone[z].slice().sort((a,c)=>a[2]-c[2]||a[3]-c[3]);
    const L=lanes(list), rowH=L.n*LANE+4;
    // next-start per lane, so a short bar can put its name in the empty space after it
    let inner='';
    L.out.forEach(([b,ln],i)=>{
      const e2=Math.min(b[3],N-1), clip=e2<b[3];
      const x=b[2]*dayW, w=Math.max(3,(e2-b[2]+1)*dayW-1), c=TCOL[b[0]];
      const nm=esc(ACTS[b[4]])+(clip?' &rsaquo;':''), lw=labelW(ACTS[b[4]]), top=2+ln*LANE;
      const inside = w>=lw;
      const outside = !inside && !clip && N*dayW-(x+w)>=lw+6;
      inner+=`<div class="bar" style="left:${x}px;top:${top}px;width:${w}px;background:${c};color:${ink(c)}"`+
             ` data-t="${b[0]}" data-z="${z}" data-s="${b[2]}" data-e="${b[3]}" data-a="${b[4]}">${inside?nm:''}</div>`;
      if(outside) inner+=`<div class="blab" style="left:${x+w+4}px;top:${top}px">${nm}</div>`;
    });
    rows.push(`<div class="lab" style="height:${rowH}px" title="${esc(zName[z])}"><span>${esc(zName[z])}</span></div>`+
              `<div class="track" style="width:${W}px;height:${rowH}px">${inner}</div>`);
    H+=rowH;
  }
  $('grid').innerHTML=`<div class="hdrcell">Level &middot; Zone</div>`+
    `<div class="axis" style="width:${W}px">${axis}</div>`+rows.join('');
  // gridlines painted once behind every row
  let gL=$('glayer');
  if(!gL){ gL=document.createElement('div'); gL.id='glayer'; $('gwrap').appendChild(gL); }
  const labw=getComputedStyle(document.documentElement).getPropertyValue('--labw');
  gL.style.left=labw;
  gL.style.width=W+'px'; gL.style.height=H+'px'; gL.innerHTML=spot+gl;

  // the day cursor lives in the chart and drives the histogram
  let cur=$('cur');
  if(!cur){ cur=document.createElement('div'); cur.id='cur';
    cur.innerHTML='<div class="knob"></div>';
    $('gwrap').appendChild(cur); wireCursor(cur); }
  cur.style.top='44px'; cur.style.height=H+'px';
  placeCursor();
}

function placeCursor(){
  const cur=$('cur'); if(!cur) return;
  const labw=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--labw'));
  cur.style.left=(labw+(curDay+0.5)*dayW)+'px';
  cur.querySelector('.knob').textContent=dShort(DAYS[curDay]);
}
function wireCursor(cur){
  let drag=false;
  cur.onpointerdown=e=>{ drag=true; cur.setPointerCapture(e.pointerId); e.preventDefault(); };
  cur.onpointermove=e=>{
    if(!drag) return;
    const labw=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--labw'));
    const g=$('gwrap'), r=g.getBoundingClientRect();
    const x=e.clientX-r.left+g.scrollLeft-labw;
    const d=Math.max(0,Math.min(NDv()-1,Math.floor(x/dayW)));
    if(d!==curDay){ curDay=d; placeCursor(); histo(); }
  };
  cur.onpointerup=()=>drag=false;
}
/* one delegated listener instead of 3,000+ per-row handlers */
let hiA=null, hiB=null;
const unlight=()=>{ if(hiA){hiA.classList.remove('row-hi'); hiB.classList.remove('row-hi');} hiA=hiB=null; };
$('grid').addEventListener('mousemove',ev=>{
  const cell=ev.target.closest('.lab,.track'); 
  if(!cell || cell.classList.contains('hdrcell')){ unlight(); hideTip(); return; }
  const kids=cell.parentNode.children, i=[].indexOf.call(kids,cell), j=i%2 ? i-1 : i+1;
  const a=kids[i%2?j:i], b=kids[i%2?i:j];
  if(a!==hiA){ unlight(); hiA=a; hiB=b; a.classList.add('row-hi'); b.classList.add('row-hi'); }

  const el=ev.target.closest('.bar');
  if(!el){ hideTip(); return; }
  const t=+el.dataset.t, z=+el.dataset.z, s=+el.dataset.s, e=+el.dataset.e, aI=+el.dataset.a, n=e-s+1;
  showTip(ev,
    `<div class="th">${ACTS[aI]}</div>`+
    `<div class="rowl">${LEVELS[zLvl[z]]} &middot; <b>${zName[z]}</b></div>`+
    `<div class="rowl"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${TCOL[t]};`+
    `border:1px solid rgba(0,0,0,.3);margin-right:5px"></i><b>${TRADES[t]}</b></div>`+
    `<div class="rowl">${dLong(DAYS[s])} &rarr; ${dLong(DAYS[e])}</div>`+
    `<div class="rowl"><b>${n}</b> workday${n===1?'':'s'}</div>`);
});
$('grid').addEventListener('mouseleave',()=>{unlight(); hideTip();});

/* ---------- controls ---------- */
const RANGES=[['Next wk',5],['2 wk',10],['6 wk',30],['Full',0]];
$('range').innerHTML=RANGES.map(([n,v])=>`<button type="button" data-h="${v}" aria-pressed="${(v||null)===horizon}">${n}</button>`).join('');
$('range').onclick=ev=>{
  const b=ev.target.closest('button'); if(!b) return;
  horizon=+b.dataset.h||null;
  $('range').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',(+x.dataset.h||null)===horizon));
  render();
};
const ZOOMS=[['Fit',0],['Normal',8],['Wide',16]];
$('zoom').innerHTML=ZOOMS.map(([n,v])=>`<button type="button" data-w="${v}" aria-pressed="${v===zoomSel}">${n}</button>`).join('');
$('zoom').onclick=ev=>{
  const b=ev.target.closest('button'); if(!b) return;
  zoomSel=+b.dataset.w;
  $('zoom').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.w===zoomSel));
  render();
};
let rt; addEventListener('resize',()=>{ if(zoomSel) return; clearTimeout(rt); rt=setTimeout(render,150); });
$('reset').onclick=()=>{ sel.trade.clear(); sel.lvl.clear(); sel.cog.clear();
  qTerms=[]; $('q').value=''; render(); };
let qt; $('q').oninput=()=>{ clearTimeout(qt); qt=setTimeout(()=>{
  qTerms=$('q').value.toLowerCase().split(',').map(t=>t.trim()).filter(Boolean);
  render(); },160); };

/* ---------- floating crew histogram ---------- */
const fsel=$('fsel');
fsel.innerHTML='<option value="-1">All trades</option>'+
  TRADES.map((t,i)=>`<option value="${i}">${t}</option>`).join('');
fsel.onchange=histo;
$('fmin').onclick=()=>$('float').classList.toggle('min');

function histo(){
  const t=+fsel.value, N=NDv();
  // same level / change-order / window filters as the chart; dropdown picks the trade
  const bars=BARS.filter(b=>
    qPass(b) &&
    (!horizon || b[2]<horizon) &&
    (t<0 ? (!sel.trade.size||sel.trade.has(b[0])) : b[0]===t) &&
    (!sel.lvl.size||sel.lvl.has(zLvl[b[1]])) &&
    (!sel.cog.size||sel.cog.has(ZCOG[b[1]])));
  // crews per day per trade, stacked in the schedule's own colors
  const cnt=Array.from({length:N},()=>new Map());
  for(const b of bars){
    const e=Math.min(b[3],N-1);
    for(let i=b[2];i<=e;i++) cnt[i].set(b[0],(cnt[i].get(b[0])||0)+1);
  }
  const tot=cnt.map(m=>{let s=0; m.forEach(v=>s+=v); return s;});
  const W=360,H=130,padB=16,padT=12,bw=W/N;
  const mx=Math.max(1,...tot), sc=(H-padB-padT)/mx;
  let svg=''; let seen='';
  for(let i=0;i<N;i++){
    const d=dO(DAYS[i]), mo=d.getFullYear()+'-'+d.getMonth();
    if(mo!==seen){ seen=mo;
      svg+=`<line x1="${i*bw}" y1="${padT}" x2="${i*bw}" y2="${H-padB}" stroke="#dbe2e9"/>`+
           `<text x="${i*bw+2}" y="${H-4}" font-size="9" fill="#5f666d">${d.toLocaleDateString('en-US',{month:'short'})}${N<=30?' '+d.getDate():''}</text>`;
    }
    let y=H-padB;
    const ts=[...cnt[i].keys()].sort((a,b)=>a-b);
    for(const tr of ts){
      const h=cnt[i].get(tr)*sc; y-=h;
      svg+=`<rect class="hb" x="${i*bw}" y="${y}" width="${Math.max(1,bw-.6)}" height="${h}"`+
           ` fill="${TCOL[tr]}" data-i="${i}" data-t="${tr}" data-c="${cnt[i].get(tr)}"/>`;
    }
  }
  // day-cursor marker
  svg+=`<line x1="${(curDay+0.5)*bw}" y1="${padT-6}" x2="${(curDay+0.5)*bw}" y2="${H-padB}"`+
       ` stroke="#F88900" stroke-width="2"/>`;
  svg+=`<text x="2" y="${padT-2}" font-size="10" font-weight="700" fill="#004F8C">peak ${mx}</text>`;
  $('fsvg').innerHTML=svg;
  const nm=t<0?(sel.trade.size?'chart-filtered trades':'all trades'):TRADES[t];
  $('fnote').innerHTML=`<b>${dShort(DAYS[curDay])}: ${fmt(tot[curDay]||0)} crew${tot[curDay]===1?'':'s'}</b>`+
    ` &middot; ${nm} &middot; drag the orange line in the chart`;
  $('fsvg').onmousemove=ev=>{
    const r=ev.target.closest('.hb');
    if(!r){ hideTip(); return; }
    showTip(ev,`<div class="th">${r.dataset.c} &middot; ${TRADES[+r.dataset.t]}</div>`+
      `<div class="rowl">${dLong(DAYS[+r.dataset.i])} &middot; ${tot[+r.dataset.i]} total</div>`);
  };
  $('fsvg').onmouseleave=hideTip;
}

/* drag by the header; stays fixed so it follows the scroll on its own */
(()=>{ const f=$('float'), h=$('fdrag'); let sx,sy,ox,oy,mv=false;
  h.onmousedown=e=>{ if(e.target.tagName==='SELECT'||e.target.tagName==='BUTTON')return;
    mv=true; sx=e.clientX; sy=e.clientY; const r=f.getBoundingClientRect(); ox=r.left; oy=r.top;
    e.preventDefault(); };
  addEventListener('mousemove',e=>{ if(!mv)return;
    f.style.left=Math.max(0,Math.min(innerWidth-f.offsetWidth,ox+e.clientX-sx))+'px';
    f.style.top =Math.max(0,Math.min(innerHeight-40,oy+e.clientY-sy))+'px';
    f.style.right='auto'; f.style.bottom='auto'; });
  addEventListener('mouseup',()=>mv=false);
})();

const _render=render;
render=function(){ _render(); histo(); };
render();
