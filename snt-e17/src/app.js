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
let zoomSel=0, dayW=8;                        // px per workday (0 = fit to the panel)
const dayWidth=()=> zoomSel || Math.max(4,Math.floor((document.getElementById('gwrap').clientWidth-322)/ND));
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
  const bars=BARS.filter(pass);
  const W=ND*dayW;

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
  $('kActN').textContent=tsel;
  $('note').textContent=`${fmt(bars.length)} activities · ${zs.size} zones`;

  if(!bars.length){ $('grid').innerHTML='<div class="empty" style="grid-column:1/-1">Nothing matches this filter.</div>'; return; }

  // rows: levels that have work, then their zones that have work
  const byZone={}; bars.forEach(b=>(byZone[b[1]]=byZone[b[1]]||[]).push(b));
  const zoneIds=Object.keys(byZone).map(Number)
    .sort((a,b)=>zLvl[a]-zLvl[b] || Math.min(...byZone[a].map(x=>x[2]))-Math.min(...byZone[b].map(x=>x[2])));

  // month bands + week ticks (week = first WORKDAY of the week, so holidays don't drop a tick)
  let axis='', gl='';
  const mos=[]; let seenMo='', seenWk=null;
  for(let i=0;i<ND;i++){
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
      if(dayW>=8) axis+=`<div class="wk" style="left:${x}px">${d.getDate()}</div>`;
    }
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
      const x=b[2]*dayW, w=Math.max(3,(b[3]-b[2]+1)*dayW-1), c=TCOL[b[0]];
      const nm=esc(ACTS[b[4]]), lw=labelW(ACTS[b[4]]), top=2+ln*LANE;
      const inside = w>=lw;
      const outside = !inside && ND*dayW-(x+w)>=lw+6;
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
  gL.style.left=getComputedStyle(document.documentElement).getPropertyValue('--labw');
  gL.style.width=W+'px'; gL.style.height=H+'px'; gL.innerHTML=gl;
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
const ZOOMS=[['Fit',0],['Normal',8],['Wide',16]];
$('zoom').innerHTML=ZOOMS.map(([n,v])=>`<button type="button" data-w="${v}" aria-pressed="${v===zoomSel}">${n}</button>`).join('');
$('zoom').onclick=ev=>{
  const b=ev.target.closest('button'); if(!b) return;
  zoomSel=+b.dataset.w;
  $('zoom').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.w===zoomSel));
  render();
};
let rt; addEventListener('resize',()=>{ if(zoomSel) return; clearTimeout(rt); rt=setTimeout(render,150); });
$('reset').onclick=()=>{ sel.trade.clear(); sel.lvl.clear(); sel.cog.clear(); render(); };
render();
