import { useState, useMemo, useEffect, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_IDX = {Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};

const SHIFTS = [
  { key:"morning",   label:"Morning",   icon:"🌅", slots:3, maxSlots:3, dStart:"06:00", dEnd:"11:30", accent:"#f59e0b", glow:"rgba(245,158,11,0.09)",  badge:"rgba(245,158,11,0.12)" },
  { key:"afternoon", label:"Afternoon", icon:"☀️",  slots:2, maxSlots:3, dStart:"11:30", dEnd:"17:00", accent:"#38bdf8", glow:"rgba(56,189,248,0.09)",  badge:"rgba(56,189,248,0.12)" },
  { key:"evening",   label:"Evening",   icon:"🌙", slots:2, maxSlots:2, dStart:"17:00", dEnd:"21:30", accent:"#a78bfa", glow:"rgba(167,139,250,0.09)", badge:"rgba(167,139,250,0.12)" },
];

const INIT_STAFF = [
  { id:1, name:"Priya Sharma",  rate:11.44, maxHours:40, holidays:[], availableDays:[0,1,2,3,4,5,6], allowedShifts:["morning","afternoon","evening"] },
  { id:2, name:"James Cooper",  rate:12.00, maxHours:35, holidays:[], availableDays:[0,1,2,3,4,5,6], allowedShifts:["morning","afternoon","evening"] },
  { id:3, name:"Fatima Ali",    rate:11.44, maxHours:30, holidays:[],  availableDays:[0,1,2,3,4,5,6], allowedShifts:["morning","afternoon","evening"] },
  { id:4, name:"Tom Bradley",   rate:13.50, maxHours:40, holidays:[], availableDays:[0,1,2,3,4,5,6], allowedShifts:["morning","afternoon","evening"] },
  { id:5, name:"Sarah Mills",   rate:11.44, maxHours:25, holidays:[],  availableDays:[0,1,2,3,4],     allowedShifts:["morning","afternoon"] },
  { id:6, name:"Dan Patel",     rate:12.50, maxHours:40, holidays:[], availableDays:[0,1,2,3,4,5,6], allowedShifts:["morning","afternoon","evening"] },
  { id:7, name:"Emma Clarke",   rate:11.44, maxHours:32, holidays:[], availableDays:[1,2,3,4,5,6],   allowedShifts:["afternoon","evening"] },
];

const PRESET = {
  Monday:    { morning:[1,2,3], afternoon:[4,5,null], evening:[6,7] },
  Tuesday:   { morning:[2,3,4], afternoon:[5,6,null], evening:[7,1] },
  Wednesday: { morning:[1,3,5], afternoon:[4,7,null], evening:[2,6] },
  Thursday:  { morning:[2,4,6], afternoon:[1,5,null], evening:[3,7] },
  Friday:    { morning:[3,5,7], afternoon:[2,6,null], evening:[1,4] },
  Saturday:  { morning:[1,4,6], afternoon:[2,7,null], evening:[3,5] },
  Sunday:    { morning:[2,5,7], afternoon:[1,3,null], evening:[4,6] },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const toMins  = t => { const [h,m]=(t||"00:00").split(":").map(Number); return h*60+m; };
const calcHrs = (s,e) => { const d=toMins(e)-toMins(s); return d>0?d/60:0; };
const fmt     = n => n.toFixed(1);
const shuffle = arr => [...arr].sort(()=>Math.random()-0.5);

function initRota() {
  const rota = {};
  for (const day of DAYS) {
    rota[day] = {};
    for (const sh of SHIFTS) {
      rota[day][sh.key] = Array.from({length:sh.maxSlots}, (_,i) => ({
        staffId: PRESET[day]?.[sh.key]?.[i] ?? null,
        start:   sh.dStart,
        end:     sh.dEnd,
      }));
    }
  }
  return rota;
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:"#0b0d12", surf:"#111318", surf2:"#181c26",
  border:"#242838", border2:"#2e3448",
  text:"#e2e6f0", muted:"#5a6282", dim:"#3a4060",
  amber:"#f59e0b", blue:"#38bdf8", purple:"#a78bfa",
  green:"#34d399", red:"#f87171", orange:"#fb923c", teal:"#2dd4bf",
  font:"'Barlow', sans-serif", mono:"'Fira Mono', monospace",
};

const inputBase = {
  background:C.surf2, border:`1px solid ${C.border}`,
  borderRadius:6, color:C.text, outline:"none",
  fontFamily:C.font, transition:"border 0.15s",
};

function TH() {
  return {
    padding:"10px 14px", fontFamily:C.font, fontWeight:700, fontSize:11,
    color:C.muted, letterSpacing:"0.06em", textTransform:"uppercase",
    borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap",
  };
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function RotaDashboard() {
  const [staff,          setStaff]          = useState(INIT_STAFF);
  const [rota,           setRota]           = useState(initRota);
  const [tab,            setTab]            = useState("rota");
  const [nextId,         setNextId]         = useState(8);
  const [weekLabel,      setWeekLabel]      = useState("w/c 30 Jun 2025");
  const [afternoonExtra, setAfternoonExtra] = useState(new Set());
  const [toast,          setToast]          = useState(null);
  const [expandedStaff,  setExpandedStaff]  = useState(null);

  useEffect(() => {
    const l = document.createElement("link");
    l.rel  = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&family=Fira+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
    document.body.style.margin = "0";
    document.body.style.background = C.bg;
  }, []);

  const showToast = useCallback((msg, color = C.blue) => {
    setToast({msg, color});
    setTimeout(() => setToast(null), 4200);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const staffById = useMemo(() => {
    const m = {}; staff.forEach(s => m[s.id] = s); return m;
  }, [staff]);

  const getSlotCount = useCallback((day, shKey) => {
    if (shKey === "afternoon") return afternoonExtra.has(day) ? 3 : 2;
    return SHIFTS.find(s => s.key === shKey).slots;
  }, [afternoonExtra]);

  const staffHours = useMemo(() => {
    const h = {}; staff.forEach(s => h[s.id] = 0);
    DAYS.forEach(day => SHIFTS.forEach(sh => {
      const n = getSlotCount(day, sh.key);
      rota[day][sh.key].slice(0,n).forEach(slot => {
        if (slot.staffId != null)
          h[slot.staffId] = (h[slot.staffId]||0) + calcHrs(slot.start, slot.end);
      });
    }));
    return h;
  }, [rota, staff, getSlotCount]);

  const conflicts = useMemo(() => {
    const c = new Set();
    // Time overlaps
    DAYS.forEach(day => {
      const byP = {};
      SHIFTS.forEach(sh => {
        rota[day][sh.key].slice(0, getSlotCount(day,sh.key)).forEach((slot,idx) => {
          if (slot.staffId == null) return;
          (byP[slot.staffId] = byP[slot.staffId]||[]).push({sh:sh.key,idx,s:toMins(slot.start),e:toMins(slot.end)});
        });
      });
      Object.values(byP).forEach(arr => {
        for (let i=0;i<arr.length;i++) for (let j=i+1;j<arr.length;j++)
          if (arr[i].s<arr[j].e && arr[j].s<arr[i].e) {
            c.add(`${day}-${arr[i].sh}-${arr[i].idx}`);
            c.add(`${day}-${arr[j].sh}-${arr[j].idx}`);
          }
      });
    });
    // Per-staff rule violations
    staff.forEach(s => {
      if ((staffHours[s.id]||0) > s.maxHours) {
        c.add(`over-${s.id}`);
        DAYS.forEach(day => SHIFTS.forEach(sh =>
          rota[day][sh.key].slice(0,getSlotCount(day,sh.key)).forEach((slot,idx)=>{
            if (slot.staffId===s.id) c.add(`${day}-${sh.key}-${idx}`);
          })
        ));
      }
      DAYS.forEach((day,di) => SHIFTS.forEach(sh =>
        rota[day][sh.key].slice(0,getSlotCount(day,sh.key)).forEach((slot,idx)=>{
          if (slot.staffId !== s.id) return;
          const k = `${day}-${sh.key}-${idx}`;
          if (s.holidays.includes(day))       { c.add(k); c.add(`hol-${s.id}-${day}`); }
          if (!s.availableDays.includes(di))  c.add(k);
          if (!s.allowedShifts.includes(sh.key)) c.add(k);
        })
      ));
    });
    return c;
  }, [rota, staff, staffHours, getSlotCount]);

  const totalCost = useMemo(() =>
    staff.reduce((t,s) => t + (staffHours[s.id]||0)*s.rate, 0),
  [staff, staffHours]);

  const conflictSummary = useMemo(() => {
    let overlap=0, overHrs=0, holiday=0;
    conflicts.forEach(k => {
      if (k.startsWith("over-")) overHrs++;
      else if (k.startsWith("hol-")) holiday++;
      else overlap++;
    });
    return {overlap, overHrs, holiday, total:overlap+overHrs+holiday};
  }, [conflicts]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const setSlot = (day,shKey,idx,field,val) =>
    setRota(p => ({...p,[day]:{...p[day],[shKey]:p[day][shKey].map((s,i)=>i===idx?{...s,[field]:val}:s)}}));

  const editStaff = (id,field,val) =>
    setStaff(p => p.map(s => s.id===id ? {...s,[field]:val} : s));

  const toggleHoliday = (id,day) => setStaff(p => p.map(s => {
    if (s.id!==id) return s;
    const h = s.holidays.includes(day) ? s.holidays.filter(d=>d!==day) : [...s.holidays,day];
    return {...s,holidays:h};
  }));

  const toggleAvailDay = (id,di) => setStaff(p => p.map(s => {
    if (s.id!==id) return s;
    const d = s.availableDays.includes(di) ? s.availableDays.filter(x=>x!==di) : [...s.availableDays,di];
    return {...s,availableDays:d};
  }));

  const toggleAllowedShift = (id,shKey) => setStaff(p => p.map(s => {
    if (s.id!==id) return s;
    const sh = s.allowedShifts.includes(shKey) ? s.allowedShifts.filter(x=>x!==shKey) : [...s.allowedShifts,shKey];
    return {...s,allowedShifts:sh};
  }));

  const addStaff = () => {
    const id = nextId;
    setStaff(p=>[...p,{id,name:"New Member",rate:11.44,maxHours:40,holidays:[],
      availableDays:[0,1,2,3,4,5,6],allowedShifts:["morning","afternoon","evening"]}]);
    setExpandedStaff(id);
    setNextId(n=>n+1);
  };

  const removeStaff = id => {
    setStaff(p=>p.filter(s=>s.id!==id));
    setRota(p=>{
      const n={};
      DAYS.forEach(day=>{n[day]={};SHIFTS.forEach(sh=>{
        n[day][sh.key]=p[day][sh.key].map(slot=>slot.staffId===id?{...slot,staffId:null}:slot);
      })});
      return n;
    });
    if (expandedStaff===id) setExpandedStaff(null);
  };

  const toggleAfternoonExtra = day => setAfternoonExtra(prev=>{
    const next=new Set(prev); next.has(day)?next.delete(day):next.add(day); return next;
  });

  // ── Auto-Generate ──────────────────────────────────────────────────────────
  const autoGenerate = useCallback(() => {
    const tempHours = {}; staff.forEach(s=>tempHours[s.id]=0);
    const newRota = {};
    DAYS.forEach(day => {
      const di = DAY_IDX[day]; newRota[day]={};
      SHIFTS.forEach(sh => {
        const count    = getSlotCount(day,sh.key);
        const refSlots = rota[day][sh.key];
        const shiftHrs = calcHrs(refSlots[0]?.start||sh.dStart, refSlots[0]?.end||sh.dEnd);
        const eligible = shuffle(staff.filter(s=>
          !s.holidays.includes(day) && s.availableDays.includes(di) && s.allowedShifts.includes(sh.key)
        )).sort((a,b)=>(tempHours[a.id]||0)-(tempHours[b.id]||0));
        const assigned=[];
        for (const s of eligible) {
          if (assigned.length>=count) break;
          if ((tempHours[s.id]||0)+shiftHrs<=s.maxHours) {
            assigned.push(s.id);
            tempHours[s.id]=(tempHours[s.id]||0)+shiftHrs;
          }
        }
        newRota[day][sh.key]=Array.from({length:sh.maxSlots},(_,i)=>({
          staffId:assigned[i]??null,
          start:refSlots[i]?.start||sh.dStart,
          end:refSlots[i]?.end||sh.dEnd,
        }));
      });
    });
    setRota(newRota);
    showToast("⚡ Rota generated — holidays, day restrictions & shift types applied. Hours balanced across team.", C.blue);
  }, [staff, rota, getSlotCount, showToast]);

  // ── Print Export ───────────────────────────────────────────────────────────
  const handlePrint = () => {
    const shBg = {morning:"#fffbeb",afternoon:"#f0f9ff",evening:"#f5f3ff"};
    const shFg = {morning:"#92400e",afternoon:"#0369a1",evening:"#5b21b6"};
    const tableRows = DAYS.map(day=>{
      const di=DAY_IDX[day]; const weekend=[5,6].includes(di);
      const cells=SHIFTS.map(sh=>{
        const count=getSlotCount(day,sh.key);
        const items=rota[day][sh.key].slice(0,count).map((slot,idx)=>{
          const sm=slot.staffId?staffById[slot.staffId]:null;
          const hrs=calcHrs(slot.start,slot.end);
          const isHol=sm&&sm.holidays.includes(day);
          const isBad=conflicts.has(`${day}-${sh.key}-${idx}`);
          const flag=isHol?" 🏖":isBad?" ⚠️":"";
          return `<div style="padding:4px 0;${idx<count-1?"border-bottom:1px solid #e2e8f0;":""}">
            <div style="font-weight:600;color:${isBad?"#b91c1c":"#1e293b"}">${sm?sm.name+flag:"<span style='color:#94a3b8;font-style:italic'>Unassigned</span>"}</div>
            <div style="font-size:10px;color:#64748b">${slot.start}–${slot.end} · ${fmt(hrs)}h${sm?" · £"+(sm.rate*hrs).toFixed(2):""}</div>
          </div>`;
        }).join("");
        return `<td style="border:1px solid #cbd5e1;padding:9px;vertical-align:top;background:${shBg[sh.key]}">
          <div style="font-size:9px;font-weight:800;color:${shFg[sh.key]};letter-spacing:0.07em;text-transform:uppercase;margin-bottom:5px">${sh.icon} ${sh.label}${count===3&&sh.key==="afternoon"?" ·+1":""}</div>
          ${items}
        </td>`;
      }).join("");
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:10px;font-weight:700;background:${weekend?"#fef9ec":"#f8fafc"};color:${weekend?"#92400e":"#1e293b"};vertical-align:top;white-space:nowrap">
          ${day.slice(0,3).toUpperCase()}<br><span style="font-size:9px;font-weight:400;color:#94a3b8">${day}</span>
        </td>${cells}
      </tr>`;
    }).join("");

    const staffRef = staff.map(s=>{
      const hols=s.holidays.length?` 🏖 ${s.holidays.map(d=>d.slice(0,3)).join(",")}`:"";
      const offDays=DAYS.filter((_,i)=>!s.availableDays.includes(i));
      const dayNote=offDays.length?` · Off: ${offDays.map(d=>d.slice(0,3)).join(",")}`:"";
      const shNote=s.allowedShifts.length<3?` · ${SHIFTS.filter(sh=>s.allowedShifts.includes(sh.key)).map(sh=>sh.label).join("/")} only`:"";
      return `<tr><td>${s.name}</td><td>£${s.rate.toFixed(2)}/hr</td><td>${s.maxHours}h max</td><td>${fmt(staffHours[s.id]||0)}h</td><td style="color:#0369a1">${hols||"—"}</td><td style="color:#7c3aed">${dayNote||"All days"}${shNote}</td></tr>`;
    }).join("");

    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><title>Staff Rota – ${weekLabel}</title>
      <style>
        *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1e293b;margin:0;padding:20px;background:#fff}
        h1{margin:0;font-size:20px}
        table{border-collapse:collapse;width:100%}
        th{background:#1e293b;color:#fff;padding:8px 12px;text-align:left;font-size:10px;letter-spacing:0.06em;text-transform:uppercase}
        td{vertical-align:top}
        .meta{color:#64748b;font-size:11px;margin:3px 0 0}
        .ref th{background:#f1f5f9;color:#475569;font-size:10px}
        .ref td{border:1px solid #e2e8f0;padding:7px 10px;font-size:11px}
        .footer{margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
        .chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
        .chip{padding:2px 8px;border-radius:3px;font-size:9px;font-weight:800;letter-spacing:0.05em}
        @media print{body{padding:8px;font-size:11px}@page{size:A4 landscape;margin:8mm}.no-print{display:none!important}}
      </style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:10px;flex-wrap:wrap">
        <div>
          <h1>🏪 QuickShop — Staff Rota</h1>
          <div class="meta">Week commencing: <strong>${weekLabel}</strong> &nbsp;·&nbsp; Store hours: 06:00–21:30 &nbsp;·&nbsp; Est. wage cost: <strong>£${totalCost.toFixed(2)}</strong></div>
          <div class="chips">
            <span class="chip" style="background:#fef3c7;color:#92400e">🌅 Morning 06:00–11:30 · 3 staff</span>
            <span class="chip" style="background:#e0f2fe;color:#0369a1">☀️ Afternoon 11:30–17:00 · 2–3 staff</span>
            <span class="chip" style="background:#ede9fe;color:#5b21b6">🌙 Evening 17:00–21:30 · 2 staff</span>
            <span class="chip" style="background:#fff7ed;color:#c2410c">🏖 Holiday &nbsp; ⚠️ Conflict</span>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#64748b">
          Printed: ${new Date().toLocaleDateString("en-GB",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}<br>
          Conflicts: ${conflictSummary.overlap} overlap · ${conflictSummary.overHrs} over-hrs · ${conflictSummary.holiday} holiday
        </div>
      </div>

      <table style="margin-bottom:14px">
        <thead><tr><th style="width:70px">Day</th><th>🌅 Morning</th><th>☀️ Afternoon</th><th>🌙 Evening</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>

      <div style="font-size:10px;font-weight:800;color:#475569;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px">Staff Reference</div>
      <table class="ref" style="margin-bottom:12px">
        <thead><tr><th>Name</th><th>Rate</th><th>Max Hrs</th><th>Wk Hrs</th><th>Holidays</th><th>Restrictions</th></tr></thead>
        <tbody>${staffRef}</tbody>
      </table>

      <div class="footer">
        <span>QuickShop Rota Manager · Confidential — staff notice board only</span>
        <span>Auto-generated · Please check for any last-minute changes</span>
      </div>

      <div class="no-print" style="margin-top:16px;text-align:center">
        <button onclick="window.print()" style="background:#1e293b;color:#fff;border:none;border-radius:6px;padding:9px 22px;font-size:13px;cursor:pointer">🖨 Print / Save as PDF</button>
      </div>
      <script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script>
    </body></html>`);
    w.document.close();
  };

  // ── Flag helper ────────────────────────────────────────────────────────────
  const getSlotFlags = (day, shKey, idx, slot) => {
    const sm = slot.staffId!=null ? staffById[slot.staffId] : null;
    if (!sm) return {};
    const di=DAY_IDX[day];
    const isHol  = sm.holidays.includes(day);
    const isUnav = !sm.availableDays.includes(di);
    const isWSh  = !sm.allowedShifts.includes(shKey);
    const isTime = !isHol&&!isUnav&&!isWSh&&conflicts.has(`${day}-${shKey}-${idx}`);
    return {isHol,isUnav,isWSh,isTime,isBad:isHol||isUnav||isWSh||isTime};
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:C.font,color:C.text,fontSize:14}}>

      {/* HEADER */}
      <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"12px 22px",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:100,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:37,height:37,background:`linear-gradient(135deg,${C.amber},#c97008)`,
            borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:18,boxShadow:`0 0 18px rgba(245,158,11,0.4)`,flexShrink:0}}>🏪</div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:21,lineHeight:1.1}}>
              QUICKSHOP <span style={{color:C.amber}}>ROTA</span>
            </div>
            <div style={{fontSize:10,color:C.muted,fontFamily:C.mono}}>06:00–21:30 · 7-day week</div>
          </div>
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
          <input value={weekLabel} onChange={e=>setWeekLabel(e.target.value)}
            style={{...inputBase,padding:"5px 10px",fontSize:12,fontFamily:C.mono,width:128}}
            placeholder="w/c date…"/>
          {conflictSummary.total>0 ? (
            <>
              {conflictSummary.overlap>0&&<Pill color={C.red} bg="rgba(248,113,113,0.11)">⚠️ {conflictSummary.overlap} overlap</Pill>}
              {conflictSummary.overHrs>0&&<Pill color={C.red} bg="rgba(248,113,113,0.11)">⏱ {conflictSummary.overHrs} over-hrs</Pill>}
              {conflictSummary.holiday>0&&<Pill color={C.orange} bg="rgba(251,146,60,0.11)">🏖 {conflictSummary.holiday} hol clash</Pill>}
            </>
          ):(
            <Pill color={C.green} bg="rgba(52,211,153,0.09)">✓ No conflicts</Pill>
          )}
          <Pill color={C.amber} bg="rgba(245,158,11,0.09)">💷 £{totalCost.toFixed(2)}</Pill>
          <HdrBtn onClick={autoGenerate} grad="linear-gradient(135deg,#3b82f6,#1d4ed8)" shadow="rgba(59,130,246,0.35)">⚡ Auto-Generate</HdrBtn>
          <HdrBtn onClick={handlePrint} grad={`linear-gradient(135deg,${C.green},#059669)`} shadow="rgba(52,211,153,0.3)" dark>🖨 Print Rota</HdrBtn>
        </div>
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{background:`${toast.color}14`,borderBottom:`1px solid ${toast.color}44`,
          padding:"7px 22px",fontSize:11,color:toast.color,fontFamily:C.mono}}>
          {toast.msg}
        </div>
      )}

      {/* TABS */}
      <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"0 22px",display:"flex",gap:2}}>
        {[{id:"rota",icon:"📋",label:"Weekly Rota"},{id:"staff",icon:"👥",label:"Staff & Settings"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background:"none",border:"none",cursor:"pointer",padding:"10px 15px",
            fontSize:13,fontFamily:C.font,fontWeight:tab===t.id?700:400,
            color:tab===t.id?C.amber:C.muted,
            borderBottom:`2px solid ${tab===t.id?C.amber:"transparent"}`,
            transition:"all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <div style={{padding:18}}>

        {/* ══════════════════════════ ROTA TAB ══════════════════════════════ */}
        {tab==="rota"&&(
          <div style={{overflowX:"auto"}}>
            {/* Legend row */}
            <div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap"}}>
              {SHIFTS.map(sh=>(
                <Tag key={sh.key} color={sh.accent} bg={sh.badge}>
                  {sh.icon} <strong>{sh.label}</strong>
                  <Mono>{sh.dStart}–{sh.dEnd}</Mono>
                  <Mono dim>{sh.key==="afternoon"?"2–3 slots":`×${sh.slots}`}</Mono>
                </Tag>
              ))}
              <Tag color={C.orange} bg="rgba(251,146,60,0.09)">🏖 Striped = holiday/restriction</Tag>
              <Tag color={C.blue}   bg="rgba(56,189,248,0.07)">OPT = optional 3rd afternoon slot</Tag>
            </div>

            <table style={{borderCollapse:"collapse",width:"100%",minWidth:900}}>
              <thead>
                <tr>
                  <th style={{...TH(),width:82,textAlign:"left"}}>DAY</th>
                  {SHIFTS.map(sh=>(
                    <th key={sh.key} style={{...TH(),textAlign:"center"}}>
                      <span style={{color:sh.accent}}>{sh.icon} {sh.label.toUpperCase()}</span>
                      <div style={{fontSize:9,color:C.muted,fontWeight:400,marginTop:2}}>
                        {sh.key==="afternoon"?"2 required · 3rd optional per day":`${sh.slots} required`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day,di)=>{
                  const weekend=[5,6].includes(di);
                  return (
                    <tr key={day} style={{borderTop:`1px solid ${C.border}`}}>
                      <td style={{padding:"9px 11px",verticalAlign:"top",
                        fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,
                        color:weekend?C.amber:C.text,minWidth:78}}>
                        <div>{day.slice(0,3).toUpperCase()}</div>
                        <div style={{fontSize:9,fontWeight:400,color:C.muted,fontFamily:C.mono}}>{day}</div>
                        {weekend&&<div style={{marginTop:3,fontSize:8,background:"rgba(245,158,11,0.13)",
                          color:C.amber,padding:"2px 4px",borderRadius:3,display:"inline-block",fontWeight:800,letterSpacing:"0.04em"}}>WKND</div>}
                      </td>
                      {SHIFTS.map(sh=>{
                        const count=getSlotCount(day,sh.key);
                        return (
                          <td key={sh.key} style={{padding:"5px 4px",verticalAlign:"top",
                            background:`linear-gradient(180deg,${sh.glow} 0%,transparent 55%)`}}>
                            {sh.key==="afternoon"&&(
                              <button onClick={()=>toggleAfternoonExtra(day)} style={{
                                display:"block",width:"100%",marginBottom:4,
                                background:afternoonExtra.has(day)?"rgba(56,189,248,0.12)":"transparent",
                                border:`1px dashed ${afternoonExtra.has(day)?C.blue:C.dim}`,
                                borderRadius:5,padding:"2px 0",fontSize:9,
                                color:afternoonExtra.has(day)?C.blue:C.dim,
                                cursor:"pointer",fontFamily:C.font,fontWeight:700,
                                transition:"all 0.15s",letterSpacing:"0.03em",
                              }}>{afternoonExtra.has(day)?"✕ Remove 3rd slot":"+ Optional 3rd slot"}</button>
                            )}
                            {rota[day][sh.key].slice(0,count).map((slot,idx)=>{
                              const {isHol,isUnav,isWSh,isTime,isBad}=getSlotFlags(day,sh.key,idx,slot);
                              const sm=slot.staffId!=null?staffById[slot.staffId]:null;
                              const hrs=calcHrs(slot.start,slot.end);
                              const isOpt=sh.key==="afternoon"&&idx===2;
                              const bgStyle=isHol||isUnav||isWSh
                                ?"repeating-linear-gradient(45deg,rgba(251,146,60,0.06),rgba(251,146,60,0.06) 4px,transparent 4px,transparent 10px)"
                                :isTime?"rgba(248,113,113,0.08)"
                                :isOpt?"rgba(56,189,248,0.04)":C.surf2;
                              const borderCol=isBad?(isHol?C.orange:C.red):isOpt?C.blue+"44":C.border2;
                              return (
                                <div key={idx} style={{background:bgStyle,border:`1px solid ${borderCol}`,
                                  borderRadius:7,padding:"6px 8px",
                                  marginBottom:idx<count-1?4:0,transition:"border 0.15s",position:"relative"}}>
                                  {isOpt&&<div style={{position:"absolute",top:2,right:5,
                                    fontSize:7,color:C.blue,fontWeight:800,letterSpacing:"0.05em",opacity:0.7}}>OPT</div>}
                                  {/* Staff select */}
                                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                                    {isBad&&<span title={isHol?"On holiday":isUnav?"Day unavailable":isWSh?"Shift not allowed":"Time overlap"}
                                      style={{fontSize:9,flexShrink:0}}>{isHol?"🏖":"⚠️"}</span>}
                                    <select value={slot.staffId??""} 
                                      onChange={e=>setSlot(day,sh.key,idx,"staffId",
                                        e.target.value===""?null:Number(e.target.value))}
                                      style={{flex:1,background:C.surf,border:`1px solid ${C.border}`,
                                        borderRadius:5,color:slot.staffId?C.text:C.muted,
                                        fontSize:11,padding:"3px 4px",fontFamily:C.font,
                                        cursor:"pointer",outline:"none",minWidth:0}}>
                                      <option value="">— Unassigned —</option>
                                      {staff.map(s=>{
                                        const warn=s.holidays.includes(day)||!s.availableDays.includes(di)||!s.allowedShifts.includes(sh.key);
                                        return <option key={s.id} value={s.id}
                                          style={{color:warn?"#fb923c":undefined}}>
                                          {s.name}{s.holidays.includes(day)?" 🏖":!s.availableDays.includes(di)?" (unavail)":!s.allowedShifts.includes(sh.key)?" (restricted)":""}
                                        </option>;
                                      })}
                                    </select>
                                  </div>
                                  {/* Time inputs */}
                                  <div style={{display:"flex",alignItems:"center",gap:3}}>
                                    <input type="time" value={slot.start}
                                      onChange={e=>setSlot(day,sh.key,idx,"start",e.target.value)}
                                      style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:4,
                                        color:C.text,fontSize:10,padding:"2px 3px",fontFamily:C.mono,
                                        flex:1,minWidth:0,outline:"none"}}/>
                                    <span style={{color:C.dim,fontSize:9}}>–</span>
                                    <input type="time" value={slot.end}
                                      onChange={e=>setSlot(day,sh.key,idx,"end",e.target.value)}
                                      style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:4,
                                        color:C.text,fontSize:10,padding:"2px 3px",fontFamily:C.mono,
                                        flex:1,minWidth:0,outline:"none"}}/>
                                    <span style={{fontFamily:C.mono,fontSize:10,
                                      color:hrs>0?sh.accent:C.dim,minWidth:26,
                                      textAlign:"right",fontWeight:600,flexShrink:0}}>
                                      {hrs>0?`${fmt(hrs)}h`:"—"}
                                    </span>
                                  </div>
                                  {/* Micro wage */}
                                  {sm&&hrs>0&&(
                                    <div style={{marginTop:3,fontSize:9,fontFamily:C.mono,color:C.muted,
                                      display:"flex",justifyContent:"space-between",
                                      borderTop:`1px solid ${C.border}`,paddingTop:3}}>
                                      <span>{sm.name.split(" ")[0]}</span>
                                      <span style={{color:sh.accent}}>£{(sm.rate*hrs).toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════════════════════ STAFF TAB ═════════════════════════════ */}
        {tab==="staff"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <h2 style={{margin:0,fontSize:19,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:"0.03em"}}>
                  STAFF <span style={{color:C.amber}}>&amp; SETTINGS</span>
                </h2>
                <p style={{margin:"3px 0 0",color:C.muted,fontSize:12}}>
                  Rates · max hours · holidays · day availability · shift restrictions
                </p>
              </div>
              <button onClick={addStaff} style={{
                background:`linear-gradient(135deg,${C.amber},#b45309)`,
                border:"none",borderRadius:8,padding:"7px 15px",
                fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",
                color:"#000",boxShadow:`0 4px 12px rgba(245,158,11,0.3)`,
              }}>+ ADD MEMBER</button>
            </div>

            {/* Summary KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:16}}>
              {[
                {label:"Staff",      val:staff.length,  color:C.purple, icon:"👥"},
                {label:"Wk Hours",   val:`${fmt(Object.values(staffHours).reduce((a,b)=>a+b,0))}h`, color:C.blue, icon:"⏱"},
                {label:"Est. Cost",  val:`£${totalCost.toFixed(2)}`, color:C.amber, icon:"💷"},
                {label:"Conflicts",  val:conflictSummary.total, color:conflictSummary.total>0?C.red:C.green, icon:conflictSummary.total>0?"⚠️":"✓"},
              ].map(k=>(
                <div key={k.label} style={{background:C.surf,border:`1px solid ${C.border}`,
                  borderRadius:9,padding:"11px 14px",borderLeft:`3px solid ${k.color}`}}>
                  <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:"0.05em",marginBottom:4}}>
                    {k.icon} {k.label.toUpperCase()}
                  </div>
                  <div style={{fontSize:21,fontWeight:700,color:k.color,fontFamily:C.mono}}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Staff cards */}
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {staff.map((s,i)=>{
                const hrs=staffHours[s.id]||0;
                const over=conflicts.has(`over-${s.id}`);
                const rem=s.maxHours-hrs;
                const open=expandedStaff===s.id;
                return (
                  <div key={s.id} style={{
                    background:C.surf,
                    border:`1px solid ${over?C.red+"55":open?C.amber+"55":C.border}`,
                    borderRadius:11,overflow:"hidden",
                    boxShadow:open?`0 0 0 1px ${C.amber}18`:"none",
                    transition:"border 0.2s",
                  }}>
                    {/* Header row */}
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 15px",
                      cursor:"pointer",flexWrap:"wrap"}}
                      onClick={()=>setExpandedStaff(open?null:s.id)}>
                      {/* Avatar */}
                      <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                        background:`linear-gradient(135deg,${C.amber}44,${C.purple}44)`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:11,fontWeight:700,color:C.muted}}>{i+1}</div>
                      {/* Name */}
                      <div onClick={e=>e.stopPropagation()} style={{flexShrink:0}}>
                        <input value={s.name} onChange={e=>editStaff(s.id,"name",e.target.value)}
                          style={{...inputBase,padding:"5px 9px",fontSize:13,fontWeight:600,width:152}}
                          onClick={e=>e.stopPropagation()}/>
                      </div>
                      {/* Rate */}
                      <div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:3}}>
                        <span style={{color:C.muted,fontSize:11}}>£</span>
                        <input type="number" step="0.01" min="0" value={s.rate}
                          onChange={e=>editStaff(s.id,"rate",parseFloat(e.target.value)||0)}
                          style={{...inputBase,padding:"5px 6px",fontSize:12,fontFamily:C.mono,width:60}}/>
                        <span style={{color:C.muted,fontSize:11}}>/hr</span>
                      </div>
                      {/* Max hrs */}
                      <div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:3}}>
                        <span style={{color:C.muted,fontSize:11}}>Max</span>
                        <input type="number" min="0" value={s.maxHours}
                          onChange={e=>editStaff(s.id,"maxHours",parseInt(e.target.value)||0)}
                          style={{...inputBase,padding:"5px 6px",fontSize:12,fontFamily:C.mono,width:50}}/>
                        <span style={{color:C.muted,fontSize:11}}>h</span>
                      </div>
                      {/* Hours bar */}
                      <div style={{flex:1,minWidth:110}} onClick={e=>e.stopPropagation()}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:10,color:C.muted}}>Assigned</span>
                          <span style={{fontFamily:C.mono,fontSize:10,fontWeight:600,color:over?C.red:C.green}}>
                            {fmt(hrs)}/{s.maxHours}h
                          </span>
                        </div>
                        <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:2,transition:"width 0.3s",
                            width:`${Math.min((hrs/s.maxHours)*100,100)}%`,
                            background:over?`linear-gradient(90deg,${C.red},#ff6b6b)`:`linear-gradient(90deg,${C.green},${C.teal})`}}/>
                        </div>
                      </div>
                      {/* Status */}
                      <span style={{fontSize:10,padding:"3px 8px",borderRadius:10,fontWeight:700,
                        background:over?"rgba(248,113,113,0.11)":"rgba(52,211,153,0.08)",
                        color:over?C.red:C.green,
                        border:`1px solid ${over?"rgba(248,113,113,0.25)":"rgba(52,211,153,0.2)"}`}}>
                        {over?`⚠️ −${fmt(Math.abs(rem))}h`:`✓ +${fmt(rem)}h`}
                      </span>
                      {s.holidays.length>0&&<span style={{fontSize:10,color:C.orange,fontWeight:700}}>🏖 {s.holidays.length}d</span>}
                      {s.availableDays.length<7&&<span style={{fontSize:10,color:C.blue,fontWeight:700}}>📅 {s.availableDays.length}d</span>}
                      {s.allowedShifts.length<3&&<span style={{fontSize:10,color:C.purple,fontWeight:700}}>🔀 restricted</span>}
                      <span style={{fontFamily:C.mono,fontSize:11,color:C.amber,fontWeight:600}}>£{(hrs*s.rate).toFixed(2)}</span>
                      <span style={{color:C.muted,fontSize:12,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▾</span>
                      <button onClick={e=>{e.stopPropagation();removeStaff(s.id);}} style={{
                        background:"none",border:`1px solid ${C.border}`,borderRadius:6,
                        color:C.muted,cursor:"pointer",fontSize:12,padding:"3px 7px"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>🗑</button>
                    </div>

                    {/* Expanded panel */}
                    {open&&(
                      <div style={{padding:"15px 18px 17px",borderTop:`1px solid ${C.border}`,
                        background:"#0f1117",
                        display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:18}}>

                        {/* Available days */}
                        <div>
                          <SLabel>📅 Works on</SLabel>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {DAYS.map((day,di)=>{
                              const on=s.availableDays.includes(di);
                              return <TChip key={di} on={on} color={C.blue}
                                onClick={()=>toggleAvailDay(s.id,di)}>{day.slice(0,2)}</TChip>;
                            })}
                          </div>
                          {s.availableDays.length<7&&(
                            <div style={{marginTop:5,fontSize:10,color:C.muted,fontFamily:C.mono}}>
                              Not working: {DAYS.filter((_,i)=>!s.availableDays.includes(i)).join(", ")}
                            </div>
                          )}
                        </div>

                        {/* Allowed shifts */}
                        <div>
                          <SLabel>🔀 Permitted shifts</SLabel>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                            {SHIFTS.map(sh=>{
                              const on=s.allowedShifts.includes(sh.key);
                              return <TChip key={sh.key} on={on} color={sh.accent}
                                bg={on?sh.badge:undefined}
                                onClick={()=>toggleAllowedShift(s.id,sh.key)}>
                                {sh.icon} {sh.label}
                              </TChip>;
                            })}
                          </div>
                          {s.allowedShifts.length<3&&(
                            <div style={{marginTop:5,fontSize:10,color:C.orange}}>
                              ⚡ Auto-generate will respect this
                            </div>
                          )}
                        </div>

                        {/* Holidays */}
                        <div>
                          <SLabel>🏖 Holiday days (this week)</SLabel>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {DAYS.map((day,di)=>{
                              const on=s.holidays.includes(day);
                              return <TChip key={di} on={on} color={C.orange}
                                onClick={()=>toggleHoliday(s.id,day)}>{day.slice(0,2)}</TChip>;
                            })}
                          </div>
                          {s.holidays.length>0&&(
                            <div style={{marginTop:5,fontSize:10,color:C.orange,fontFamily:C.mono}}>
                              Off: {s.holidays.join(", ")}
                              {s.holidays.some(d=>conflicts.has(`hol-${s.id}-${d}`))&&" — still assigned ⚠️"}
                            </div>
                          )}
                        </div>

                        {/* Per-shift hours */}
                        <div>
                          <SLabel>📊 Hours by shift type</SLabel>
                          {SHIFTS.map(sh=>{
                            let shHrs=0;
                            DAYS.forEach(day=>{
                              rota[day][sh.key].slice(0,getSlotCount(day,sh.key)).forEach(slot=>{
                                if(slot.staffId===s.id) shHrs+=calcHrs(slot.start,slot.end);
                              });
                            });
                            return (
                              <div key={sh.key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                                <span style={{fontSize:11,minWidth:68,color:C.muted}}>{sh.icon} {sh.label}</span>
                                <div style={{flex:1,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                                  <div style={{height:"100%",borderRadius:2,transition:"width 0.3s",
                                    width:`${s.maxHours>0?Math.min((shHrs/s.maxHours)*100,100):0}%`,
                                    background:sh.accent}}/>
                                </div>
                                <span style={{fontFamily:C.mono,fontSize:10,color:sh.accent,minWidth:28,textAlign:"right"}}>
                                  {fmt(shHrs)}h
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Auto-generate hint */}
            <div style={{marginTop:16,background:"rgba(59,130,246,0.05)",
              border:"1px dashed rgba(59,130,246,0.22)",borderRadius:9,
              padding:"13px 16px",fontSize:12,color:"#93c5fd",
              display:"flex",alignItems:"flex-start",gap:10}}>
              <span style={{fontSize:18,flexShrink:0}}>⚡</span>
              <div><strong>Auto-Generate</strong> builds next week's rota using all constraints above.
                It skips staff on holiday, off their available days, or restricted from a shift type.
                Hours are balanced across the team — staff with fewer hours assigned so far get priority.
                Shift times carry over from the current rota unchanged. Hit <strong>⚡ Auto-Generate</strong> in the top bar.</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── MICRO-COMPONENTS ─────────────────────────────────────────────────────────
function Pill({children,color,bg}) {
  return <div style={{background:bg,border:`1px solid ${color}44`,borderRadius:7,
    padding:"5px 11px",fontSize:11,color,fontWeight:700,
    fontFamily:"'Fira Mono',monospace",whiteSpace:"nowrap"}}>{children}</div>;
}
function HdrBtn({children,onClick,grad,shadow,dark}) {
  return <button onClick={onClick} style={{
    background:grad,border:"none",borderRadius:8,padding:"7px 13px",
    fontFamily:"'Barlow',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",
    color:dark?"#000":"#fff",boxShadow:`0 4px 12px ${shadow}`,
    letterSpacing:"0.02em",whiteSpace:"nowrap"}}>{children}</button>;
}
function Tag({children,color,bg}) {
  return <div style={{display:"flex",alignItems:"center",gap:5,background:bg,
    border:`1px solid ${color}33`,borderRadius:7,padding:"4px 10px",fontSize:11}}>{children}</div>;
}
function Mono({children,dim}) {
  return <span style={{fontFamily:"'Fira Mono',monospace",fontSize:10,color:dim?C.dim:C.muted}}>{children}</span>;
}
function SLabel({children}) {
  return <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:"0.06em",
    marginBottom:7,textTransform:"uppercase"}}>{children}</div>;
}
function TChip({children,on,color,bg,onClick}) {
  return <button onClick={onClick} style={{
    padding:"4px 9px",borderRadius:6,cursor:"pointer",
    border:`1px solid ${on?color+"77":C.border}`,
    background:on?(bg||`${color}18`):"transparent",
    color:on?color:C.dim,fontSize:11,fontWeight:700,
    fontFamily:"'Barlow',sans-serif",transition:"all 0.15s"}}>{children}</button>;
}
