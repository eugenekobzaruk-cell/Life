import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPA_URL="https://xegcaodhilhrrsqwflkx.supabase.co";
const SUPA_KEY="sb_publishable_rFHZtkSKHQN-ISCf334MuQ_auXQCt2F";
const sb=createClient(SUPA_URL,SUPA_KEY,{auth:{persistSession:true,autoRefreshToken:true}});

const $=id=>document.getElementById(id);
const AREAS=[
  {id:"prod",name:"Продакшн",sub:"пісні для артистів, студія"},
  {id:"biz",name:"Ninja · паблішинг · студія-бізнес",sub:"команда, пітчі, облік"},
  {id:"family",name:"Сім'я і Северин",sub:"школа, спільне з Катею"},
  {id:"health",name:"Здоров'я і спорт",sub:"вело, силові, meal-prep"},
  {id:"home",name:"Побут і фінанси",sub:"бюджет, дім, документи"}];
const AN={};AREAS.forEach(a=>AN[a.id]=a.name);
const isArea=a=>AREAS.some(x=>x.id===a);
const DOW=["Нд","Пн","Вт","Ср","Чт","Пт","Сб"],DOWL=["неділя","понеділок","вівторок","середа","четвер","п'ятниця","субота"];
const MON=["січ","лют","бер","кві","тра","чер","лип","сер","вер","жов","лис","гру"];
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fromISO=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=fromISO(s);d.setDate(d.getDate()+n);return iso(d)};
let today=iso(new Date());
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ddmm=s=>s?s.slice(8,10)+"."+s.slice(5,7):"";
const daysTo=s=>Math.round((fromISO(s)-fromISO(today))/864e5);
const hm5=t=>t?String(t).slice(0,5):null;
const dur=e=>{if(!e.start_t||!e.end_t)return 0;const [h1,m1]=e.start_t.split(":").map(Number),[h2,m2]=e.end_t.split(":").map(Number);return Math.max(0,(h2*60+m2-h1*60-m1)/60)};
const fmtH=h=>(Math.round(h*10)/10).toLocaleString("uk-UA")+" год";
const fmtMin=m=>{m=Math.round(m);return Math.floor(m/60)+":"+pad(m%60)};
const mondayOf=s=>{const d=fromISO(s);const k=(d.getDay()+6)%7;d.setDate(d.getDate()-k);return iso(d)};
const hm=d=>pad(d.getHours())+":"+pad(d.getMinutes());
let toastT;function toast(s){const t=$("toast");t.textContent=s;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),1800)}
const LS={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};

// ===== state
let tasks=[],events=[],projects=[],habits=[],timelog=[],timer=null,me={},quote=null,lastAdvice=null,program=null;
let openTask=null,openEvent=null,openProj=null,openArea=null,openDay=null,weekStart=mondayOf(today);
const logHours=(d,area)=>timelog.filter(x=>x.day===d&&(!area||x.area===area)).reduce((a,x)=>a+Number(x.min||0)/60,0);
const live=t=>!t.done;
const taskDay=t=>t.day||t.due||null;
const sortT=(a,b)=>(a.pri||2)-(b.pri||2)||String(a.due||"9").localeCompare(String(b.due||"9"))||String(a.created_at||"").localeCompare(String(b.created_at||""));
const eventsOn=d=>events.filter(e=>e.day===d).sort((a,b)=>String(a.start_t||"").localeCompare(String(b.start_t||"")));
const tasksOn=d=>tasks.filter(t=>taskDay(t)===d).sort(sortT);
const lateTasks=()=>tasks.filter(t=>live(t)&&t.due&&t.due<today).sort(sortT);
const habitsOn=d=>{const w=fromISO(d).getDay();return habits.filter(h=>!h.days||!h.days.length||h.days.includes(w))};
const streakOf=(log,from)=>{let n=0,d=from||today;if(!log||!log[d]){d=addDays(d,-1)}while(log&&log[d]){n++;d=addDays(d,-1)}return n};

// ===== data
async function loadAll(){
  const [t,e,p,h,hl,tl,tm,m,pr,q,ad]=await Promise.all([
    sb.from("tasks").select("*"),sb.from("events").select("*"),sb.from("projects").select("*"),
    sb.from("habits").select("*").order("sort"),sb.from("habit_log").select("*"),
    sb.from("timelog").select("*").gte("day",addDays(today,-60)),sb.from("timer").select("*").eq("id",1).maybeSingle(),
    sb.from("me").select("*").eq("id",1).maybeSingle(),sb.from("program").select("*").eq("id",1).maybeSingle(),sb.from("quotes").select("*").eq("day",today).maybeSingle(),sb.from("advice").select("*").eq("id",1).maybeSingle()]);
  const err=[t,e,p,h,hl,tl,tm,m,pr,q,ad].find(r=>r.error);if(err){$("foot").textContent="Помилка даних: "+err.error.message;return}
  tasks=t.data||[];events=(e.data||[]).map(x=>({...x,start_t:hm5(x.start_t),end_t:hm5(x.end_t)}));projects=p.data||[];
  const logs={};for(const r of (hl.data||[])){(logs[r.habit_id]=logs[r.habit_id]||{})[r.day]=true}
  habits=(h.data||[]).map(x=>({...x,log:logs[x.id]||{}}));
  timelog=(tl.data||[]).map(x=>({...x,start_t:hm5(x.start_t),end_t:hm5(x.end_t)}));
  timer=tm.data&&tm.data.started_at?{...tm.data,start:new Date(tm.data.started_at).getTime()}:null;
  const md=m.data||{};me={wakeTarget:hm5(md.wake_target)||"06:00",why:md.why||"",rules:md.rules||[],wake:md.wake||{},targets:md.targets||{}};
  program=pr.data||null;quote=q.data||null;lastAdvice=ad.data&&ad.data.text?ad.data:null;
  renderAll();
}
let reloadT;function scheduleReload(){clearTimeout(reloadT);reloadT=setTimeout(loadAll,250)}
function subscribe(){
  sb.channel("life").on("postgres_changes",{event:"*",schema:"public"},scheduleReload).subscribe();
}
async function run(p,msg){const {error}=await p;if(error){toast("Не вдалося: "+error.message);throw error}if(msg)toast(msg);scheduleReload()}
const upd=(table,id,patch,msg)=>run(sb.from(table).update(patch).eq("id",id),msg);
const ins=(table,row,msg)=>run(sb.from(table).insert(row),msg);
const del=(table,id)=>run(sb.from(table).delete().eq("id",id),"Видалено");
const saveMe=(patch,msg)=>run(sb.from("me").update({wake_target:patch.wakeTarget??me.wakeTarget,why:patch.why??me.why,rules:patch.rules??me.rules,wake:patch.wake??me.wake,targets:patch.targets??me.targets}).eq("id",1),msg);
async function toggleTask(t){await upd("tasks",t.id,{done:!t.done,done_at:t.done?null:new Date().toISOString()},t.done?"Повернуто":"Зроблено")}
async function setHabit(hb,on){if(on)await run(sb.from("habit_log").delete().eq("habit_id",hb.id).eq("day",today),"Знято");else await run(sb.from("habit_log").upsert({habit_id:hb.id,day:today}),"✓ "+hb.title)}

// ===== tabs
const TABS=["today","week","proj","areas","me"],TITLES={today:"Сьогодні",week:"Тиждень",proj:"Проекти",areas:"Сфери",me:"Я"};
let tab=LS.get("lf-tab")||"today";
function setTab(t){if(!TABS.includes(t))t="today";tab=t;for(const k of TABS){$("p-"+k).hidden=k!==t;$("tb-"+k).setAttribute("aria-selected",k===t)}$("title").textContent=TITLES[t];LS.set("lf-tab",t)}
TABS.forEach(k=>$("tb-"+k).onclick=()=>setTab(k));
for(const sel of ["q-area","np-area"]){$(sel).innerHTML=AREAS.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}
function arm(btn,fn){btn.onclick=async ev=>{ev.stopPropagation();if(btn.dataset.arm==="1"){try{await fn()}catch(e){}}else{btn.dataset.arm="1";btn.textContent="точно видалити?";setTimeout(()=>{btn.dataset.arm="";btn.textContent="Видалити"},2500)}}}

// ===== cards
const pillTask=t=>{if(t.done)return["зроблено","done"];if(!t.due)return[t.pj?"проект":"",""];const n=daysTo(t.due);if(n<0)return["прострочено "+(-n)+" дн.","late"];if(n===0)return["дедлайн сьогодні","soon"];if(n<=2)return["дедлайн "+ddmm(t.due),"soon"];return["до "+ddmm(t.due),""]};
function taskCard(t,ctx){
  const [pt,pc]=pillTask(t);
  const el=document.createElement("div");el.className="cat "+(t.area||"")+(t.done?" done":"")+" "+pc+(openTask===t.id?" open":"");el.tabIndex=0;el.setAttribute("role","button");
  const pj=t.pj?projects.find(p=>p.id===t.pj):null;
  el.innerHTML=`<button class="chk" type="button" role="checkbox" aria-checked="${!!t.done}" aria-label="Зроблено">${t.done?"✓":""}</button>
    <div class="name">${esc(t.title)}${t.pri===1?' <small>· головне</small>':""}</div><div class="pill">${pt}</div>
    <div class="meta">${AN[t.area]||""}${pj?" · "+esc(pj.name):""}${t.day&&t.day!==t.due&&ctx!=="day"?" · план "+ddmm(t.day):""}${t.note?" · "+esc(t.note):""}</div>`;
  el.querySelector(".chk").onclick=ev=>{ev.stopPropagation();toggleTask(t)};
  if(openTask===t.id){
    const f=document.createElement("div");f.className="form";f.onclick=e=>e.stopPropagation();
    f.innerHTML=`<input type="text" id="tt-${t.id}" value="${esc(t.title)}" aria-label="Назва" class="full">
      <label class="wide">План на <input type="date" id="td-${t.id}" value="${t.day||""}" aria-label="День"> Дедлайн <input type="date" id="tu-${t.id}" value="${t.due||""}" aria-label="Дедлайн"></label>
      <select id="ta-${t.id}" aria-label="Сфера">${AREAS.map(a=>`<option value="${a.id}"${a.id===t.area?" selected":""}>${esc(a.name)}</option>`).join("")}</select>
      <select id="tp-${t.id}" aria-label="Пріоритет"><option value="1"${t.pri===1?" selected":""}>Головне</option><option value="2"${!t.pri||t.pri===2?" selected":""}>Звичайне</option><option value="3"${t.pri===3?" selected":""}>Колись</option></select>
      <div class="wide"><button class="pri" type="button" id="ts-${t.id}">Зберегти</button><button class="ghost" type="button" id="tn-${t.id}">На сьогодні</button><button class="ghost" type="button" id="tm-${t.id}">На завтра</button><button class="ghost" type="button" id="tx-${t.id}">Видалити</button></div>`;
    el.appendChild(f);
    f.querySelector("#ts-"+t.id).onclick=()=>upd("tasks",t.id,{title:$("tt-"+t.id).value.trim().slice(0,120)||t.title,day:$("td-"+t.id).value||null,due:$("tu-"+t.id).value||null,area:$("ta-"+t.id).value,pri:Number($("tp-"+t.id).value)},"Збережено").then(()=>{openTask=null});
    f.querySelector("#tn-"+t.id).onclick=()=>upd("tasks",t.id,{day:today},"На сьогодні").then(()=>{openTask=null});
    f.querySelector("#tm-"+t.id).onclick=()=>upd("tasks",t.id,{day:addDays(today,1)},"На завтра").then(()=>{openTask=null});
    arm(f.querySelector("#tx-"+t.id),()=>del("tasks",t.id));
  }
  el.onclick=()=>{openTask=openTask===t.id?null:t.id;renderAll()};
  el.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&e.target===el){e.preventDefault();el.click()}};
  return el;
}
function eventCard(e){
  const el=document.createElement("div");el.className="cat "+(e.area||"")+(e.done?" done":"")+(openEvent===e.id?" open":"");el.tabIndex=0;el.setAttribute("role","button");
  const nowHM=hm(new Date());
  const isNow=e.day===today&&e.start_t&&e.end_t&&e.start_t<=nowHM&&nowHM<e.end_t;
  el.innerHTML=`<div class="t">${e.start_t?esc(e.start_t)+(e.end_t?"<br>"+esc(e.end_t):""):"день"}</div><div class="name">${esc(e.title)}</div><div class="pill"${isNow?' style="background:var(--ok-bg);color:var(--ok)"':""}>${isNow?"зараз":e.src==="cal"?"календар":dur(e)?fmtH(dur(e)):""}</div>
    <div class="meta">${AN[e.area]||""}${e.note?" · "+esc(e.note):""}</div>`;
  if(openEvent===e.id){
    const f=document.createElement("div");f.className="form";f.onclick=ev=>ev.stopPropagation();
    f.innerHTML=`<input type="text" id="et-${e.id}" value="${esc(e.title)}" aria-label="Назва" class="full">
      <input type="date" id="ed-${e.id}" value="${e.day}" aria-label="Дата"><select id="ea-${e.id}" aria-label="Сфера">${AREAS.map(a=>`<option value="${a.id}"${a.id===e.area?" selected":""}>${esc(a.name)}</option>`).join("")}</select>
      <input type="time" id="es-${e.id}" value="${e.start_t||""}" aria-label="Початок"><input type="time" id="ee-${e.id}" value="${e.end_t||""}" aria-label="Кінець">
      <div class="wide"><button class="pri" type="button" id="ev-${e.id}">Зберегти</button><button class="ghost" type="button" id="eo-${e.id}">${e.done?"Не відбулось":"Відбулось"}</button><button class="ghost" type="button" id="ex-${e.id}">Видалити</button></div>`;
    el.appendChild(f);
    f.querySelector("#ev-"+e.id).onclick=()=>upd("events",e.id,{title:$("et-"+e.id).value.trim().slice(0,120)||e.title,day:$("ed-"+e.id).value||e.day,area:$("ea-"+e.id).value,start_t:$("es-"+e.id).value||null,end_t:$("ee-"+e.id).value||null},"Збережено").then(()=>{openEvent=null});
    f.querySelector("#eo-"+e.id).onclick=()=>upd("events",e.id,{done:!e.done},e.done?"Повернуто":"Відмічено").then(()=>{openEvent=null});
    arm(f.querySelector("#ex-"+e.id),()=>del("events",e.id));
  }
  el.onclick=()=>{openEvent=openEvent===e.id?null:e.id;renderAll()};
  el.onkeydown=ev=>{if((ev.key==="Enter"||ev.key===" ")&&ev.target===el){ev.preventDefault();el.click()}};
  return el;
}

// ===== СЬОГОДНІ
function renderToday(){
  const d0=fromISO(today);$("dateLbl").textContent=DOWL[d0.getDay()]+", "+d0.getDate()+" "+MON[d0.getMonth()];
  const ev=eventsOn(today),tt=tasksOn(today),late=lateTasks();
  const doneAll=tt.filter(t=>t.done).length;
  const nowHM=hm(new Date());
  const next=ev.find(e=>e.start_t&&e.start_t>nowHM&&!e.done),cur=ev.find(e=>e.start_t&&e.end_t&&e.start_t<=nowHM&&nowHM<e.end_t);
    if(cur){$("sumNext").textContent="Зараз · до "+cur.end_t;$("sumMid").textContent=cur.title}
  else if(next){$("sumNext").textContent="Далі о "+next.start_t;$("sumMid").textContent=next.title}
  else{$("sumNext").textContent=ev.length?"Розклад на сьогодні завершено":"Вільний день";$("sumMid").textContent=tt.length?(doneAll===tt.length?"Усе зроблено.":"Залишилось "+(tt.length-doneAll)+" з "+tt.length):"Задач на сьогодні немає"}
  const tl=timelog.filter(x=>x.day===today),tlAll=tl.reduce((a,x)=>a+Number(x.min||0),0);
  $("sumCount").textContent=[ev.length?"подій "+ev.length:"",tlAll?"у роботі "+fmtMin(tlAll):"",late.length?"прострочено "+late.length:""].filter(Boolean).join(" · ");
  $("late").hidden=!late.length;$("lateVal").textContent=late.length;$("lateMeta").textContent=late.slice(0,3).map(t=>t.title).join(" · ");
  // головне: late + pri1 + решта до 3
  const open=tt.filter(t=>!t.done),mainSet=[...late.filter(t=>taskDay(t)!==today),...open.filter(t=>t.pri===1)];
  for(const t of open)if(mainSet.length<3&&!mainSet.includes(t))mainSet.push(t);
  const rest=[...open.filter(t=>!mainSet.includes(t)),...tt.filter(t=>t.done)];
  const T=$("todayTasks");T.innerHTML="";
  if(!mainSet.length)T.innerHTML='<div class="empty">'+(tt.length?"Головне на сьогодні зроблено.":"Скажіть, що в плані — або додайте нижче.")+'</div>';
  mainSet.forEach(t=>T.appendChild(taskCard(t,"day")));
  $("taskSpan").textContent=tt.length?doneAll+" з "+tt.length+" зроблено":"";
  const MT=$("moreTasks");MT.innerHTML="";rest.forEach(t=>MT.appendChild(taskCard(t,"day")));
  $("fMore").hidden=!rest.length;$("moreSpan").textContent=rest.length?rest.length:"";
  const S=$("sched");S.innerHTML="";if(!ev.length)S.innerHTML='<div class="note">Подій з часом сьогодні немає.</div>';ev.forEach(e=>S.appendChild(eventCard(e)));
  const h=ev.reduce((a,e)=>a+dur(e),0);$("schedSpan").textContent=ev.length?ev.length+(h?" · "+fmtH(h):""):"порожньо";
  const TL=$("timelog");TL.innerHTML="";const byP={};
  for(const x of tl){const k=x.pj||x.title||"інше";byP[k]=(byP[k]||0)+Number(x.min||0)}
  if(!tl.length)TL.innerHTML='<div class="note">Скажіть «сів на Рози» — таймер піде.</div>';
  for(const [k,m] of Object.entries(byP).sort((a,b)=>b[1]-a[1])){const pp=projects.find(q=>q.id===k);const el=document.createElement("div");el.className="cat okp";el.style.cursor="default";el.style.gridTemplateColumns="1fr auto";
    el.innerHTML=`<div class="name">${esc(pp?pp.name:k)}</div><div class="pill">${fmtMin(m)}</div><div class="meta" style="grid-column:1/-1">${tl.filter(x=>(x.pj||x.title||"інше")===k).map(x=>x.start_t+"–"+x.end_t).join(" · ")}</div>`;TL.appendChild(el)}
  $("logSpan").textContent=tlAll?fmtMin(tlAll):"";
  const H=$("habits");H.innerHTML="";const hs=habitsOn(today).filter(h=>!h.grp);
  for(const hb of hs){const on=!!(hb.log&&hb.log[today]);
    const b=document.createElement("button");b.className="chip";b.type="button";b.setAttribute("aria-pressed",on);
    const streak=streakOf(hb.log);b.innerHTML=`${on?"✓ ":""}${esc(hb.title)}${streak>1?` <small>×${streak}</small>`:""}`;
    b.onclick=()=>setHabit(hb,on);H.appendChild(b)}
  const I=$("inbox");I.innerHTML="";const inb=tasks.filter(t=>live(t)&&!taskDay(t)).sort(sortT);
  if(!inb.length)I.innerHTML='<div class="note">Порожньо.</div>';inb.forEach(t=>I.appendChild(taskCard(t,"inbox")));
  $("inboxSpan").textContent=inb.length?inb.length:"";
  if(lastAdvice){$("advText").textContent=lastAdvice.text||"";const d=new Date(lastAdvice.ts||0);$("advMeta").textContent=pad(d.getDate())+"."+pad(d.getMonth()+1)+" "+pad(d.getHours())+":"+pad(d.getMinutes())}
}
$("q-date").value=today;
$("q-kind").onchange=()=>{const ev=$("q-kind").value==="event";$("q-start").hidden=!ev;$("q-end").hidden=!ev};
$("q-add").onclick=async()=>{
  const title=$("q-title").value.trim();if(!title){$("q-title").focus();return}
  const area=$("q-area").value,date=$("q-date").value||null;
  if($("q-kind").value==="event")await ins("events",{title:title.slice(0,120),area,day:date||today,start_t:$("q-start").value||null,end_t:$("q-end").value||null,src:"me"},"Додано");
  else await ins("tasks",{title:title.slice(0,120),area,day:date,pri:2},"Додано");
  $("q-title").value="";$("addQuick").open=false;
};

// ===== ТИЖДЕНЬ
function renderWeek(){
  const days=[...Array(7)].map((_,i)=>addDays(weekStart,i));
  const a=fromISO(days[0]),b=fromISO(days[6]);
  $("wkLbl").textContent=(weekStart===mondayOf(today)?"Цей тиждень · ":"")+a.getDate()+" "+MON[a.getMonth()]+" – "+b.getDate()+" "+MON[b.getMonth()];
  let hours=0,nT=0,nD=0,byA={};
  for(const d of days){for(const e of eventsOn(d)){const h=dur(e);hours+=h;byA[e.area]=(byA[e.area]||0)+h}for(const t of tasksOn(d)){nT++;if(t.done)nD++}}
  $("wkHours").textContent=fmtH(hours);$("wkMeta").textContent="задач "+nD+"/"+nT;
  const top=Object.entries(byA).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k,v])=>AN[k]+" "+fmtH(v)).join(" · ");
  $("wkMid").textContent=top||"У розкладі цього тижня ще немає подій з часом.";
  const W=$("weekDays");W.innerHTML="";
  for(const d of days){
    const dd=fromISO(d),ev=eventsOn(d),tt=tasksOn(d),isT=d===today;
    const box=document.createElement("div");box.className="day"+(isT?" today":"");
    const h=ev.reduce((x,e)=>x+dur(e),0);
    box.innerHTML=`<div class="dh"><b>${DOW[dd.getDay()]} ${dd.getDate()}${isT?" · сьогодні":""}</b><span>${h?fmtH(h):""}${tt.length?(h?" · ":"")+"задач "+tt.filter(t=>t.done).length+"/"+tt.length:""}</span></div>`;
    const body=document.createElement("div");
    if(!ev.length&&!tt.length)body.innerHTML='<div class="free">вільно</div>';
    for(const e of ev){const r=document.createElement("div");r.className="row";r.innerHTML=`<span class="d">${e.start_t?esc(e.start_t):"день"}</span><span class="ttl${e.done?" dn":""}">${esc(e.title)}</span><span class="dot ${e.area||""}"></span>`;body.appendChild(r)}
    for(const t of tt){const r=document.createElement("div");r.className="row";r.innerHTML=`<span class="d">${t.due===d?"дедл.":"задача"}</span><span class="ttl${t.done?" dn":""}">${esc(t.title)}</span><span class="dot ${t.area||""}"></span>`;body.appendChild(r)}
    box.appendChild(body);
    if(openDay===d){
      const f=document.createElement("div");f.className="pform";f.style.padding="10px 14px";f.style.borderTop="1px solid var(--line)";
      f.innerHTML=`<select id="wk-kind" class="full" aria-label="Тип"><option value="task">Задача</option><option value="event">Подія з часом</option></select>
        <input type="text" id="wk-title" placeholder="Що" aria-label="Що" class="full"><select id="wk-area" aria-label="Сфера">${AREAS.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
        <input type="time" id="wk-start" aria-label="Початок"><input type="time" id="wk-end" aria-label="Кінець"><button class="pri" type="button" id="wk-add">Додати на ${DOW[dd.getDay()]} ${dd.getDate()}</button>`;
      box.appendChild(f);
      f.querySelector("#wk-add").onclick=async()=>{const title=$("wk-title").value.trim();if(!title){$("wk-title").focus();return}
        if($("wk-kind").value==="event")await ins("events",{title:title.slice(0,120),area:$("wk-area").value,day:d,start_t:$("wk-start").value||null,end_t:$("wk-end").value||null,src:"me"},"Додано");
        else await ins("tasks",{title:title.slice(0,120),area:$("wk-area").value,day:d,pri:2},"Додано");
        openDay=null};
    }
    box.querySelector(".dh").onclick=()=>{openDay=openDay===d?null:d;renderWeek()};
    W.appendChild(box);
  }
}
$("wkPrev").onclick=()=>{weekStart=addDays(weekStart,-7);openDay=null;renderWeek()};
$("wkNext").onclick=()=>{weekStart=addDays(weekStart,7);openDay=null;renderWeek()};

// ===== ПРОЕКТИ
function pjState(p){if(p.status==="done")return["здано","done"];if(p.status==="hold")return["пауза",""];if(!p.deadline)return["без дедлайну",""];const n=daysTo(p.deadline);if(n<0)return["прострочено "+(-n)+" дн.","late"];if(n===0)return["дедлайн сьогодні","soon"];if(n<=3)return[n+" дн.","soon"];return[n+" дн.","okp"]}
function renderProjects(){
  const act=projects.filter(p=>p.status!=="done"&&p.status!=="hold");
  $("pjBig").textContent=act.length;$("pjCount").textContent=projects.filter(p=>p.status==="hold").length?"на паузі "+projects.filter(p=>p.status==="hold").length:"";
  const nx=act.filter(p=>p.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline))[0];
  $("pjNext").textContent=nx?"найближчий "+ddmm(nx.deadline)+" · "+nx.name:"";
  const noNext=act.filter(p=>!p.next).length;
  $("pjMid").textContent=noNext?noNext+" проект(и) без наступного кроку — це зазвичай і є те, що стоїть.":"У кожного активного проекту є наступний крок.";
  const G=$("projGroups");G.innerHTML="";
  for(const a of AREAS){
    const list=projects.filter(p=>p.area===a.id).sort((x,y)=>(x.status==="done")-(y.status==="done")||(x.status==="hold")-(y.status==="hold")||String(x.deadline||"9").localeCompare(String(y.deadline||"9")));
    if(!list.length)continue;
    const s=document.createElement("div");s.className="sec";s.textContent=a.name;G.appendChild(s);
    const c=document.createElement("div");c.className="cats";c.style.marginTop="12px";
    for(const p of list){
      const [pt,pc]=pjState(p);const open=tasks.filter(t=>t.pj===p.id&&live(t)).length;
      const el=document.createElement("div");el.className="cat "+a.id+" "+pc+(p.status==="done"?" done":"")+(openProj===p.id?" open":"");el.tabIndex=0;el.setAttribute("role","button");el.style.gridTemplateColumns="1fr auto";
      el.innerHTML=`<div class="name">${esc(p.name)}</div><div class="pill">${pt}</div>
        <div class="meta" style="grid-column:1/-1">${p.next?"→ <b>"+esc(p.next)+"</b>":"<span style='color:var(--warn)'>наступний крок не задано</span>"}${p.deadline?" · дедлайн "+ddmm(p.deadline):""}${open?" · задач "+open:""}${p.note?" · "+esc(p.note):""}</div>`;
      if(openProj===p.id){
        const f=document.createElement("div");f.className="form";f.onclick=e=>e.stopPropagation();
        f.innerHTML=`<input type="text" id="pn-${p.id}" value="${esc(p.next||"")}" placeholder="Наступний крок" aria-label="Наступний крок" class="full">
          <input type="date" id="pd-${p.id}" value="${p.deadline||""}" aria-label="Дедлайн"><input type="text" id="po-${p.id}" value="${esc(p.note||"")}" placeholder="Нотатка" aria-label="Нотатка">
          <div class="wide"><button class="pri" type="button" id="ps-${p.id}">Зберегти</button><button class="ghost" type="button" id="pt-${p.id}">Крок → задача на сьогодні</button><button class="ghost" type="button" id="ph-${p.id}">${p.status==="hold"?"Активувати":"На паузу"}</button><button class="ghost" type="button" id="pz-${p.id}">${p.status==="done"?"Повернути":"Здано"}</button><button class="ghost" type="button" id="px-${p.id}">Видалити</button></div>`;
        el.appendChild(f);
        f.querySelector("#ps-"+p.id).onclick=()=>upd("projects",p.id,{next:$("pn-"+p.id).value.trim().slice(0,160),deadline:$("pd-"+p.id).value||null,note:$("po-"+p.id).value.trim().slice(0,160)},"Збережено").then(()=>{openProj=null});
        f.querySelector("#pt-"+p.id).onclick=async()=>{const nx=$("pn-"+p.id).value.trim();if(!nx){$("pn-"+p.id).focus();return}await ins("tasks",{title:nx.slice(0,120),area:p.area,pj:p.id,day:today,pri:1},"Задача на сьогодні");openProj=null};
        f.querySelector("#ph-"+p.id).onclick=()=>upd("projects",p.id,{status:p.status==="hold"?"active":"hold"}).then(()=>{openProj=null});
        f.querySelector("#pz-"+p.id).onclick=()=>upd("projects",p.id,{status:p.status==="done"?"active":"done"}).then(()=>{openProj=null});
        arm(f.querySelector("#px-"+p.id),()=>del("projects",p.id));
      }
      el.onclick=()=>{openProj=openProj===p.id?null:p.id;renderProjects()};
      el.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&e.target===el){e.preventDefault();el.click()}};
      c.appendChild(el);
    }
    G.appendChild(c);
  }
  if(!projects.length)G.innerHTML='<div class="empty">Проектів ще немає.</div>';
}
$("np-add").onclick=async()=>{const name=$("np-name").value.trim();if(!name){$("np-name").focus();return}
  await ins("projects",{name:name.slice(0,120),area:$("np-area").value,deadline:$("np-dead").value||null,next:$("np-next").value.trim().slice(0,160),status:"active"},"Проект додано");
  ["np-name","np-dead","np-next"].forEach(i=>$(i).value="");$("addProj").open=false};

// ===== СФЕРИ
function renderAreas(){
  const ws=mondayOf(today),days=[...Array(7)].map((_,i)=>addDays(ws,i));
  const byA={};let all=0,tAll=0;for(const a of AREAS)byA[a.id]=0;
  for(const d of days){for(const e of eventsOn(d)){const h=dur(e);byA[e.area]=(byA[e.area]||0)+h;all+=h}for(const a of AREAS){const h=logHours(d,a.id);byA[a.id]+=h;all+=h}}
  const tg=me.targets||{};for(const a of AREAS)tAll+=Number(tg[a.id]||0);
  $("arHours").textContent=fmtH(all);$("arTarget").textContent=tAll?"ціль "+fmtH(tAll):"цілі не задано";
  const a0=fromISO(days[0]),a6=fromISO(days[6]);$("arSpan").textContent=a0.getDate()+" "+MON[a0.getMonth()]+" – "+a6.getDate()+" "+MON[a6.getMonth()];
  const C=$("areaCards");C.innerHTML="";
  for(const a of AREAS){
    const h=byA[a.id]||0,t=Number(tg[a.id]||0),open=tasks.filter(x=>x.area===a.id&&live(x)).length,pj=projects.filter(p=>p.area===a.id&&p.status!=="done"&&p.status!=="hold");
    const nx=pj.filter(p=>p.deadline).sort((x,y)=>x.deadline.localeCompare(y.deadline))[0];
    const el=document.createElement("div");el.className="area "+a.id;el.tabIndex=0;el.setAttribute("role","button");el.style.cursor="pointer";
    el.innerHTML=`<div class="name">${esc(a.name)}</div><div class="h">${fmtH(h)}</div>
      <div class="meta">${t?"ціль "+fmtH(t)+" · ":""}задач ${open} · проектів ${pj.length}${nx?" · найближчий дедлайн "+ddmm(nx.deadline)+" "+esc(nx.name):""}</div>
      ${t?`<div class="bar"><i style="width:${Math.min(100,100*h/t)}%;background:${h>=t?"var(--ok)":"var(--warn)"}"></i></div>`:""}`;
    if(openArea===a.id){const f=document.createElement("div");f.className="form";f.style.gridColumn="1/-1";f.onclick=e=>e.stopPropagation();
      f.innerHTML=`<input type="number" inputmode="decimal" id="ag-${a.id}" value="${t||""}" placeholder="Ціль годин на тиждень" aria-label="Ціль"><button class="pri" type="button" id="as-${a.id}">Зберегти</button>`;
      el.appendChild(f);f.querySelector("#as-"+a.id).onclick=async()=>{const v=parseFloat($("ag-"+a.id).value);await saveMe({targets:Object.assign({},tg,{[a.id]:v>=0?v:0})},"Ціль збережено");openArea=null}}
    el.onclick=()=>{openArea=openArea===a.id?null:a.id;renderAreas()};
    el.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&e.target===el){e.preventDefault();el.click()}};
    C.appendChild(el);
  }
}

// ===== ТАЙМЕР
function renderTimer(){
  const box=$("timerBox");if(!timer||!timer.start){box.hidden=true;return}
  box.hidden=false;const p=projects.find(q=>q.id===timer.pj);
  $("timerName").textContent="▶ "+(p?p.name:timer.title||"Робота");
  $("timerVal").textContent=fmtMin((Date.now()-timer.start)/60000);
  $("timerMeta").textContent="з "+hm(new Date(timer.start))+(p&&p.area?" · "+AN[p.area]:"");
}
setInterval(renderTimer,30000);
async function startTimer(pj,title){
  if(timer&&timer.start)await stopTimer(true);
  const p=projects.find(q=>q.id===pj);
  await run(sb.from("timer").update({pj:pj||null,title:title||(p?p.name:""),area:p?p.area:"prod",started_at:new Date().toISOString()}).eq("id",1),"Пішов: "+(p?p.name:title||""));
  timer={pj,title,area:p?p.area:"prod",start:Date.now()};renderTimer();
}
async function stopTimer(quiet){
  if(!timer||!timer.start)return;const end=Date.now(),min=Math.max(1,Math.round((end-timer.start)/60000));const d=new Date(timer.start);
  await run(sb.from("timelog").insert({pj:timer.pj||null,title:timer.title||"",area:timer.area||"prod",day:iso(d),start_t:hm(d),end_t:hm(new Date(end)),min}));
  await run(sb.from("timer").update({pj:null,started_at:null}).eq("id",1),quiet?"":"Записано "+fmtMin(min));
  timer=null;renderTimer();
}
$("timerStop").onclick=()=>stopTimer(false);

// ===== Я
const QUICK_WAKE=["05:30","06:00","06:30","07:00","пізніше"];
const wakeOK=(t,target)=>!!t&&t!=="late"&&t<=target;
function wakeStreak(target){const log=me.wake||{};let n=0,d=today;if(!log[d])d=addDays(d,-1);while(log[d]&&wakeOK(log[d],target)){n++;d=addDays(d,-1)}return n}
function chipRow(el,list){
  el.innerHTML="";if(!list.length){el.innerHTML='<div class="note">—</div>';return 0}let n=0;
  for(const hb of list){const on=!!(hb.log&&hb.log[today]);if(on)n++;const s=streakOf(hb.log);
    const b=document.createElement("button");b.className="chip";b.type="button";b.setAttribute("aria-pressed",on);
    b.innerHTML=`${on?"✓ ":""}${esc(hb.title)}${s>1?` <small>×${s}</small>`:""}`;b.onclick=()=>setHabit(hb,on);el.appendChild(b)}
  return n;
}
function cleanStreak(asc){if(!asc.length)return 0;let n=0,d=today;const all=x=>asc.every(h=>h.log&&h.log[x]);if(!all(d))d=addDays(d,-1);while(all(d)){n++;d=addDays(d,-1)}return n}
function renderMe(){
  const target=me.wakeTarget||"06:00",log=me.wake||{},wt=log[today];
  const asc=habits.filter(h=>h.grp==="ascesis"),com=habits.filter(h=>h.grp==="commit"),ord=habits.filter(h=>h.grp==="order"),mp=habits.filter(h=>h.grp==="morning"),pm=habits.filter(h=>h.grp==="evening");
  const day=program&&program.start_day?Math.max(1,-daysTo(program.start_day)+1):null;
  $("prName").textContent=program?program.name||"Програма":"Програма";
  $("prDay").textContent=day?"день "+day:"—";
  $("prSince").textContent=program&&program.start_day?"з "+ddmm(program.start_day):"";
  const cs=cleanStreak(asc);$("prClean").textContent=cs?"чистих днів поспіль: "+cs:"";
  const ascDone=asc.filter(h=>h.log&&h.log[today]).length;
  const wk=wakeStreak(target);
  $("prMid").textContent=[wt?(wakeOK(wt,target)?"підйом "+wt+" ✓":"підйом пізніше"):"підйом не відмічено",
    "медитації "+(mp.filter(h=>h.log&&h.log[today]).length+pm.filter(h=>h.log&&h.log[today]).length)+"/"+(mp.length+pm.length),
    "аскези "+ascDone+"/"+asc.length].join(" · ");
  $("prBar").style.width=(asc.length?100*ascDone/asc.length:0)+"%";
  $("whyText").textContent=program&&program.intention?program.intention:(me.why||"");
  $("meTarget").textContent="ціль "+target+(wk?" · серія "+wk:"");
  const WC=$("wakeChips");WC.innerHTML="";
  for(const t of QUICK_WAKE){const b=document.createElement("button");b.className="chip";b.type="button";const v=t==="пізніше"?"late":t;b.setAttribute("aria-pressed",wt===v);b.textContent=(t==="пізніше"?"пізніше":"встав о "+t);b.onclick=()=>setWake(v);WC.appendChild(b)}
  chipRow($("mpChips"),mp);
  chipRow($("ascChips"),asc);$("ascSpan").textContent=asc.length?ascDone+" з "+asc.length:"";
  $("cleanBtn").textContent=ascDone===asc.length&&asc.length?"Сьогодні чисто ✓ · відмічено":"Сьогодні чисто ✓";
  chipRow($("pmChips"),pm);
  const cn=chipRow($("comChips"),com);$("comSpan").textContent=com.length?cn+" з "+com.length:"";
  const on=chipRow($("ordChips"),ord);$("ordSpan").textContent=ord.length?on+" з "+ord.length:"";
  const G=$("wakeGrid");G.innerHTML="";let ok7=0;
  for(let i=6;i>=0;i--){const d=addDays(today,-i),v=log[d],dd=fromISO(d);const el=document.createElement("div");el.className=(v?(wakeOK(v,target)?"ok":"miss"):"")+(d===today?" td":"");if(v&&wakeOK(v,target))ok7++;
    el.innerHTML=`${DOW[dd.getDay()]}<b>${v?(v==="late"?"пізн.":v):"—"}</b>`;G.appendChild(el)}
  $("wakeSpan").textContent=ok7+" з 7";
  renderQuote();renderAch();renderRules();
}
$("cleanBtn").onclick=async()=>{const asc=habits.filter(h=>h.grp==="ascesis");await run(sb.from("habit_log").upsert(asc.map(h=>({habit_id:h.id,day:today}))),"Чистий день записано")};
async function setWake(v){const wake=Object.assign({},me.wake||{});if(wake[today]===v)delete wake[today];else wake[today]=v;await saveMe({wake},v==="late"?"Відмічено":"Підйом "+v)}
function renderAch(){
  const target=me.wakeTarget||"06:00",wk=wakeStreak(target),mp=habits.filter(h=>h.grp==="morning");
  const bestMp=Math.max(0,...mp.map(h=>streakOf(h.log)));
  const wakeDays=Object.values(me.wake||{}).filter(v=>wakeOK(v,target)).length;
  const mins=timelog.reduce((a,x)=>a+Number(x.min||0),0);
  const doneP=projects.filter(p=>p.status==="done").length,doneT=tasks.filter(t=>t.done).length;
  const cleanDays=(()=>{const byD={};for(const t of tasks){const d=taskDay(t);if(!d)continue;(byD[d]=byD[d]||[]).push(t)}return Object.entries(byD).filter(([d,l])=>d<=today&&l.length&&l.every(t=>t.done)).length})();
  const bestAny=Math.max(0,...habits.map(h=>streakOf(h.log)));
  const asc=habits.filter(h=>h.grp==="ascesis"),cs=cleanStreak(asc);
  const list=[
    {ic:"🕊",n:"Чистий день",m:cs+" поспіль",got:cs>=1},{ic:"🛡",n:"7 чистих днів",m:cs+"/7",got:cs>=7},{ic:"🌙",n:"21 чистий день",m:cs+"/21",got:cs>=21},{ic:"☀️",n:"40 днів",m:cs+"/40",got:cs>=40},
    {ic:"🌅",n:"Перший ранок",m:"один підйом по цілі",got:wakeDays>=1},
    {ic:"🔥",n:"3 ранки поспіль",m:wk+"/3",got:wk>=3},
    {ic:"⚡",n:"Тиждень ранків",m:wk+"/7",got:wk>=7},
    {ic:"🏔",n:"21 день",m:wk+"/21",got:wk>=21},
    {ic:"🧘",n:"Практика ×7",m:bestMp+"/7",got:bestMp>=7},
    {ic:"🎧",n:"Перша година в студії",m:fmtMin(mins)+" по таймеру",got:mins>=60},
    {ic:"🎼",n:"10 годин продакшну",m:fmtMin(mins)+"/10:00",got:mins>=600},
    {ic:"✅",n:"Чистий день",m:cleanDays+" дн. усе зроблено",got:cleanDays>=1},
    {ic:"🏁",n:"Здано",m:doneP+" проект(и)",got:doneP>=1},
    {ic:"🚴",n:"Будь-яка звичка ×30",m:bestAny+"/30",got:bestAny>=30},
    {ic:"💯",n:"100 задач",m:doneT+"/100",got:doneT>=100}];
  const A=$("achGrid");A.innerHTML="";let got=0;
  for(const a of list){if(a.got)got++;const el=document.createElement("div");el.className="a "+(a.got?"got":"lock");el.innerHTML=`<div class="ic">${a.ic}</div><div class="n">${a.n}</div><div class="m">${esc(a.m)}</div>`;A.appendChild(el)}
  $("achSpan").textContent=got+" з "+list.length;
}
function renderQuote(){if(!quote||quote.day!==today)return;$("qText").textContent="«"+quote.text+"»";$("qWho").textContent=quote.who||"";$("qMean").hidden=!quote.mean;$("qMean").textContent=quote.mean||""}
function renderRules(){const R=$("rulesList");R.innerHTML="";const rules=me.rules||[];
  if(!rules.length)R.innerHTML='<div class="note">Правил ще немає. Скажіть «правило: …» або додайте нижче.</div>';
  rules.forEach((r,i)=>{const el=document.createElement("div");el.className="rule";el.innerHTML=`<span class="n">${i+1}</span><span>${esc(r)}</span><button class="x" type="button" aria-label="Прибрати">×</button>`;
    const x=el.querySelector(".x");x.onclick=async()=>{if(x.dataset.arm==="1"){await saveMe({rules:rules.filter((_,j)=>j!==i)},"Прибрано")}else{x.dataset.arm="1";x.textContent="прибрати?";x.style.fontSize="12px";setTimeout(()=>{x.dataset.arm="";x.textContent="×";x.style.fontSize=""},2500)}};
    R.appendChild(el)});
  $("wk-target").value=me.wakeTarget||"06:00";
}
$("r-add").onclick=async()=>{const t=$("r-text").value.trim();if(!t){$("r-text").focus();return}await saveMe({rules:[...(me.rules||[]),t.slice(0,200)]},"Правило додано");$("r-text").value=""};
$("w-save").onclick=async()=>{const p={};const w=$("w-text").value.trim();if(w)p.why=w.slice(0,200);const t=$("wk-target").value;if(t)p.wakeTarget=t;await saveMe(p,"Збережено");$("w-text").value="";$("addRule").open=false};

// ===== Claude API (розбір команд, порада, думка дня)
const KEYS={oa:()=>LS.get("lf-oa")||"",an:()=>LS.get("lf-an")||""};
async function claude(prompt,{json=false,model="claude-haiku-5-5",max=1200}={}){
  const key=KEYS.an();if(!key){openSettings("Потрібен ключ Anthropic");throw new Error("no key")}
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model,max_tokens:max,messages:[{role:"user",content:prompt}]})});
  if(!r.ok){const t=await r.text();throw new Error("Claude "+r.status+": "+t.slice(0,200))}
  const d=await r.json();const text=(d.content||[]).map(c=>c.text||"").join("");
  if(!json)return text;
  return JSON.parse(text.replace(/^[^{]*/,"").replace(/[^}]*$/,""));
}
function summary(){
  const ws=mondayOf(today),days=[...Array(7)].map((_,i)=>addDays(ws,i));
  return {today,weekday:DOWL[fromISO(today).getDay()],now:hm(new Date()),
    todayEvents:eventsOn(today).map(e=>({start:e.start_t,end:e.end_t,title:e.title,area:AN[e.area],done:!!e.done})),
    todayTasks:tasksOn(today).map(t=>({title:t.title,area:AN[t.area],pri:t.pri,done:!!t.done,due:t.due})),
    overdue:lateTasks().map(t=>({title:t.title,due:t.due,area:AN[t.area]})),
    inbox:tasks.filter(t=>live(t)&&!taskDay(t)).map(t=>t.title),
    weekEvents:days.flatMap(d=>eventsOn(d).map(e=>({date:d,start:e.start_t,end:e.end_t,title:e.title,area:AN[e.area]}))),
    weekTasks:days.flatMap(d=>tasksOn(d).filter(live).map(t=>({date:d,title:t.title,due:t.due}))),
    projects:projects.filter(p=>p.status!=="done").map(p=>({name:p.name,area:AN[p.area],deadline:p.deadline,daysLeft:p.deadline?daysTo(p.deadline):null,next:p.next||null,status:p.status||"active",note:p.note||""})),
    habitsToday:habitsOn(today).map(h=>({title:h.title,done:!!(h.log&&h.log[today])})),
    timerRunning:timer&&timer.start?{project:(projects.find(p=>p.id===timer.pj)||{}).name||timer.title,minutes:Math.round((Date.now()-timer.start)/60000)}:null,
    workedTodayMinutes:timelog.filter(x=>x.day===today).reduce((a,x)=>a+Number(x.min||0),0),
    workedThisWeekByProject:(()=>{const r={};for(const x of timelog)if(x.day>=ws&&x.day<=days[6]){const k=(projects.find(p=>p.id===x.pj)||{}).name||x.title||"інше";r[k]=(r[k]||0)+Number(x.min||0)}return r})(),
    weeklyTargetsHours:me.targets||{},why:me.why||"",rules:me.rules||[],wakeTarget:me.wakeTarget||"06:00",wakeToday:(me.wake||{})[today]||null,wakeStreak:wakeStreak(me.wakeTarget||"06:00"),
    program:program?{name:program.name,day:program.start_day?-daysTo(program.start_day)+1:null,intention:program.intention,cleanStreak:cleanStreak(habits.filter(h=>h.grp==="ascesis")),ascesesToday:habits.filter(h=>h.grp==="ascesis").map(h=>({title:h.title,clean:!!(h.log&&h.log[today])})),eveningMeditation:habits.filter(h=>h.grp==="evening").map(h=>({title:h.title,done:!!(h.log&&h.log[today])}))}:null,
    morningPractices:habits.filter(h=>h.grp==="morning").map(h=>({title:h.title,done:!!(h.log&&h.log[today]),streak:streakOf(h.log)}))};
}
$("advBtn").onclick=async()=>{
  const btn=$("advBtn");btn.disabled=true;$("advText").textContent="Думаю…";
  const prompt="Ти ментор і асистент Євгена з тайм-менеджменту (Топанга, Каліфорнія). Він музичний продюсер (пісні для артистів зі строгими дедлайнами), разом з дружиною Катею веде Ninja Music і паблішинг, має сина Северина, тренується (вело, силові, тхеквондо в суботу), веде сімейний бюджет. Сфери: Продакшн, Ninja/паблішинг/студія-бізнес, Сім'я і Северин, Здоров'я і спорт, Побут і фінанси. Він веде програму «Антихряк» (program: намір, аскези, медитації ранок і вечір по годині) — порада має це поважати: без порад про алкоголь, м'ясо, серіали тощо; вечір закінчується медитацією і раннім сном. У даних є його власні правила (rules) і «навіщо» (why) — порада має їх дотримуватись і за потреби на них посилатись. Дані його дашборду (JSON): "+JSON.stringify(summary())+"\n\nНапиши українською 3–5 конкретних кроків: за що братися зараз і до кінця дня, що встигнути цього тижня з огляду на дедлайни, і що з «без дати» або з проектів без наступного кроку варто або запланувати, або викинути. Кожен крок 1–2 речення, спирайся тільки на дані, нічого не вигадуй, без вступу і моралі. Якщо день уже пізній — скажи, що перенести на завтра. Тон: прямий, на його боці. Формат: нумерований список, звичайний текст без markdown.";
  try{const text=await claude(prompt,{model:"claude-sonnet-5-5"});lastAdvice={text,ts:new Date().toISOString()};renderToday();await run(sb.from("advice").update({text,ts:lastAdvice.ts}).eq("id",1))}
  catch(e){$("advText").textContent="Не вдалося отримати пораду: "+e.message}
  btn.disabled=false;
};
$("qBtn").onclick=async()=>{
  const btn=$("qBtn");btn.disabled=true;$("qText").textContent="Підбираю…";$("qWho").textContent="";$("qMean").hidden=true;
  const d=summary();
  const prompt="Ти підбираєш думку дня для Євгена — музичного продюсера, який будує дисципліну: ранній підйом, медитація, читання Йогананди, продакшн із дедлайнами, сім'я. Джерела: Йогананда, стоїки (Марк Аврелій, Сенека, Епіктет), дзен, Бгаґавад-ґіта, Лао-цзи. Сьогоднішній контекст (JSON): "+JSON.stringify({weekday:d.weekday,overdue:d.overdue.length,todayTasks:d.todayTasks.length,timerRunning:d.timerRunning,wakeStreak:d.wakeStreak,why:d.why,rules:d.rules.slice(0,8),program:d.program?{day:d.program.day,cleanStreak:d.program.cleanStreak,intention:d.program.intention}:null})+"\n\nПоверни ТІЛЬКИ JSON: {\"text\":\"цитата або близький переказ, українською, до 25 слів\",\"who\":\"автор, джерело\",\"mean\":\"1–2 речення: що це означає для Євгена саме сьогодні, з прив'язкою до контексту, без моралі\"}. Для Йогананди давай переказ своїми словами, не дослівну цитату. Обирай під день.";
  try{const v=await claude(prompt,{json:true,model:"claude-sonnet-5-5"});quote={day:today,text:String(v.text||"").slice(0,300),who:String(v.who||"").slice(0,80),mean:String(v.mean||"").slice(0,400)};renderQuote();await run(sb.from("quotes").upsert(quote))}
  catch(e){$("qText").textContent="Не вдалося підібрати: "+e.message}
  btn.disabled=false;
};

// ===== ГОЛОС
let rec=null,chunks=[],recStart=0,recTimer=null,pending=null,mediaStream=null;
const ACT_LABEL={clean_day:"Чистий день",broke:"Зрив",wake:"Підйом",rule_add:"Правило",why_set:"Навіщо",timer_start:"▶ Таймер",timer_stop:"■ Стоп",add_event:"Подія",add_task:"Задача",done_task:"Зроблено",add_project:"Проект",set_next:"Наступний крок",move_task:"Перенести",habit:"Звичка ✓",note:"Нотатка"};
function describe(a){
  const p=a.pj?projects.find(q=>q.id===a.pj):null,t=a.task?tasks.find(q=>q.id===a.task):null;
  switch(a.type){
    case"timer_start":return (p?p.name:a.title||"?");
    case"timer_stop":return timer&&timer.start?"зупинити і записати час":"таймер не запущено";
    case"add_event":return (a.date?ddmm(a.date):"?")+(a.start?" "+a.start:"")+(a.end?"–"+a.end:"")+" · "+(a.title||"?")+" · "+(AN[a.area]||"");
    case"add_task":return (a.title||"?")+(a.day?" · на "+ddmm(a.day):"")+(a.due?" · до "+ddmm(a.due):"")+(a.pri===1?" · головне":"")+" · "+(AN[a.area]||"")+(p?" · "+p.name:"");
    case"done_task":return t?t.title:"задачу не знайдено";
    case"move_task":return (t?t.title:"?")+" → "+(a.day?ddmm(a.day):"?");
    case"add_project":return (a.name||"?")+" · "+(AN[a.area]||"")+(a.deadline?" · до "+ddmm(a.deadline):"");
    case"set_next":return (p?p.name:"?")+" → "+(a.next||"?");
    case"habit":{const h=habits.find(q=>q.id===a.habit);return h?h.title:"?"}
    case"wake":return a.time==="late"?"сьогодні пізніше за ціль":"встав о "+(a.time||"?");
    case"clean_day":return "усі аскези сьогодні дотримано";
    case"broke":{const h=habits.find(q=>q.id===a.habit);return "зрив: "+(h?h.title:"?")}
    case"rule_add":case"why_set":return a.text||"?";
    default:return a.text||"";
  }
}
function ctx(){
  return {today,weekday:DOWL[fromISO(today).getDay()],now:hm(new Date()),timer:timer&&timer.start?{pj:timer.pj,title:timer.title}:null,
    areas:AREAS.map(a=>({id:a.id,name:a.name})),
    projects:projects.filter(p=>p.status!=="done").map(p=>({id:p.id,name:p.name,area:p.area})),
    openTasks:tasks.filter(live).map(t=>({id:t.id,title:t.title,area:t.area,day:t.day,due:t.due})),
    habits:habits.filter(h=>h.grp!=="ascesis").map(h=>({id:h.id,title:h.title,grp:h.grp})),asceses:habits.filter(h=>h.grp==="ascesis").map(h=>({id:h.id,title:h.title})),wakeTarget:me.wakeTarget||"06:00"};
}
const PARSE_RULES="Типи дій:\n- {\"type\":\"timer_start\",\"pj\":\"<id проекту з контексту>\",\"title\":\"<якщо проекту немає — назва>\"} — «сів на…», «почав…», «працюю над…»\n- {\"type\":\"timer_stop\"} — «стоп», «пауза», «закінчив», «перерва»\n- {\"type\":\"add_event\",\"title\",\"date\":\"YYYY-MM-DD\",\"start\":\"HH:MM\"|null,\"end\":\"HH:MM\"|null,\"area\"} — зустріч, дзвінок, сесія, поїздка з часом; «завтра/у вівторок/наступної середи» рахуй від today і weekday; без кінця — end = start + 1 год\n- {\"type\":\"add_task\",\"title\",\"area\",\"day\":\"YYYY-MM-DD\"|null,\"due\":\"YYYY-MM-DD\"|null,\"pri\":1|2,\"pj\":\"<id>\"|null} — «треба…», «не забути…», «зробити…»; «сьогодні» → day=today; «до п'ятниці» → due; «головне/важливо» → pri 1\n- {\"type\":\"done_task\",\"task\":\"<id з openTasks>\"} — «зробив…», «закрив…», «готово…»; обери найближчу за змістом задачу\n- {\"type\":\"move_task\",\"task\":\"<id>\",\"day\":\"YYYY-MM-DD\"} — «перенеси … на завтра»\n- {\"type\":\"add_project\",\"name\",\"area\",\"deadline\":\"YYYY-MM-DD\"|null,\"next\":\"\"} — новий проект/пісня/клієнт\n- {\"type\":\"set_next\",\"pj\":\"<id>\",\"next\":\"...\"} — «наступний крок по … — …»\n- {\"type\":\"habit\",\"habit\":\"<id>\"} — «покатався», «потренувався», «зважився», «помедитував», «почитав Йогананду»\n- {\"type\":\"clean_day\"} — «сьогодні чисто», «день чистий», «всі аскези дотримав»\n- {\"type\":\"broke\",\"habit\":\"<id з asceses>\"} — «зірвався на солодке», «випив», «залип в інстаграмі» — знімає галочку цієї аскези за сьогодні\n- {\"type\":\"habit\",\"habit\":\"<id з habits>\"} також для медитацій (grp morning/evening: «помедитував зранку/ввечері»), зобов'язань (grp commit: «порухався», «добре спав», «працював залочено») і порядку (grp order: «прибрав студію», «помив авто», «поголився»)\n- {\"type\":\"wake\",\"time\":\"HH:MM\"|\"late\"} — «встав о шостій», «прокинувся о 5:40», «проспав» → late\n- {\"type\":\"rule_add\",\"text\"} — «правило: …», «хочу жити так: …», «принцип: …» — коротко, у його словах\n- {\"type\":\"why_set\",\"text\"} — «навіщо все це: …», «моя ціль на рік — …»\n- {\"type\":\"note\",\"text\"} — якщо нічого не підходить, коротко що саме незрозуміло\nСфера за змістом: пісні/клієнти/студійна робота → prod; Ninja, паблішинг, команда, пітчі, облік студії → biz; Северин, школа, Катя (не бізнес) → family; вело, силові, тхеквондо, їжа, вага, медитація → health; бюджет, дім, документи, покупки → home. Одна фраза може давати кілька дій. Дати тільки YYYY-MM-DD, час HH:MM 24 год. Без markdown, без пояснень.";
async function parseCommand(text){
  if(/^(стоп|стій|пауза|stop|зупини(ти)?|закінчив|перерва)[.!]?$/i.test(text.trim()))return {understood:"Стоп",actions:[{type:"timer_stop"}]};
  const prompt="Ти асистент Євгена з тайм-менеджменту. Перетвори його надиктовану фразу (українською, можливі помилки розпізнавання: «Рози» = пісня Yaktak «Рози», «Нащо» = пісня Yaktak, Міоко = Mioko, Ковальов = Kovalov) на дії для дашборду. Контекст (JSON): "+JSON.stringify(ctx())+"\n\nФраза: «"+text.replace(/"/g,"'")+"»\n\nПоверни ТІЛЬКИ JSON виду {\"understood\":\"одне речення, що ти зрозумів\",\"actions\":[...]}. "+PARSE_RULES;
  const v=await claude(prompt,{json:true});if(!v||!Array.isArray(v.actions))throw new Error("порожня відповідь");return v;
}
async function execute(acts){
  let n=0;
  for(const a of acts){try{
    switch(a.type){
      case"timer_start":await startTimer(a.pj||null,a.title||"");break;
      case"timer_stop":await stopTimer(false);break;
      case"add_event":if(a.title&&a.date){let end=a.end||null;if(a.start&&!end){const [h,m]=a.start.split(":").map(Number);end=pad(Math.min(23,h+1))+":"+pad(m)}await ins("events",{title:String(a.title).slice(0,120),area:isArea(a.area)?a.area:"family",day:a.date,start_t:a.start||null,end_t:end,src:"me"})}break;
      case"add_task":if(a.title)await ins("tasks",{title:String(a.title).slice(0,120),area:isArea(a.area)?a.area:"home",day:a.day||null,due:a.due||null,pri:a.pri===1?1:2,pj:a.pj&&projects.some(p=>p.id===a.pj)?a.pj:null});break;
      case"done_task":if(a.task&&tasks.some(t=>t.id===a.task))await upd("tasks",a.task,{done:true,done_at:new Date().toISOString()});break;
      case"move_task":if(a.task&&a.day&&tasks.some(t=>t.id===a.task))await upd("tasks",a.task,{day:a.day});break;
      case"add_project":if(a.name)await ins("projects",{name:String(a.name).slice(0,120),area:isArea(a.area)?a.area:"prod",deadline:a.deadline||null,next:a.next||"",status:"active"});break;
      case"set_next":if(a.pj&&projects.some(p=>p.id===a.pj))await upd("projects",a.pj,{next:String(a.next||"").slice(0,160)});break;
      case"habit":{const h=habits.find(q=>q.id===a.habit);if(h)await run(sb.from("habit_log").upsert({habit_id:h.id,day:today}));break}
      case"clean_day":{const rows=habits.filter(h=>h.grp==="ascesis").map(h=>({habit_id:h.id,day:today}));await run(sb.from("habit_log").upsert(rows));break}
      case"broke":{if(a.habit)await run(sb.from("habit_log").delete().eq("habit_id",a.habit).eq("day",today));break}
      case"wake":{const wake=Object.assign({},me.wake||{});wake[today]=a.time==="late"?"late":String(a.time||"").slice(0,5);await saveMe({wake});me.wake=wake;break}
      case"rule_add":{const rules=[...(me.rules||[]),String(a.text||"").slice(0,200)];await saveMe({rules});me.rules=rules;break}
      case"why_set":{await saveMe({why:String(a.text||"").slice(0,200)});break}
      default:continue;
    }n++}catch(e){toast("Не вийшло: "+(ACT_LABEL[a.type]||a.type))}}
  toast(n?"Виконано: "+n:"Нічого не виконано");
}
function showPending(v){
  pending=v;$("sayUnderstood").textContent=v.understood||"";const A=$("sayActions");A.innerHTML="";
  if(!v.actions.length)A.innerHTML='<div class="note">Дій не розпізнано.</div>';
  for(const a of v.actions){const el=document.createElement("div");el.className="cat "+(a.area||"")+" okp";el.style.cursor="default";el.style.gridTemplateColumns="1fr auto";el.innerHTML=`<div class="name">${esc(describe(a))}</div><div class="pill">${ACT_LABEL[a.type]||a.type}</div>`;A.appendChild(el)}
  $("sayResult").hidden=false;
}
async function handleText(text){
  $("sayBox").hidden=false;$("sayText").value=text;$("sayResult").hidden=true;
  const btn=$("sayGo");btn.disabled=true;btn.textContent="Розбираю…";
  try{const v=await parseCommand(text);
    sb.from("voice_log").insert({heard:text,understood:v.understood||"",actions:v.actions}).then(()=>{});
    const auto=LS.get("lf-auto")==="1";
    const simple=v.actions.length&&v.actions.every(a=>["timer_start","timer_stop","habit","wake","clean_day","broke"].includes(a.type));
    if(auto||simple){showPending(v);await execute(v.actions);pending=null;$("sayBox").hidden=true;$("sayText").value=""}else showPending(v);
  }catch(e){toast("Не вдалося розібрати: "+e.message)}
  btn.disabled=false;btn.textContent="Виконати";
}
$("sayGo").onclick=()=>{const t=$("sayText").value.trim();if(!t){$("sayText").focus();return}handleText(t)};
$("sayConfirm").onclick=async()=>{if(!pending)return;const acts=pending.actions;pending=null;await execute(acts);$("sayBox").hidden=true;$("sayText").value=""};
$("sayNo").onclick=()=>{$("sayResult").hidden=true;pending=null;$("sayText").focus()};
$("sayCancel").onclick=()=>{$("sayBox").hidden=true;pending=null};
$("typeBtn").onclick=()=>{$("sayBox").hidden=false;$("sayResult").hidden=true;$("sayText").value="";setTimeout(()=>$("sayText").focus(),50)};

function pickMime(){for(const m of ["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg"])if(window.MediaRecorder&&MediaRecorder.isTypeSupported(m))return m;return ""}
async function startRec(){
  if(!KEYS.oa()){openSettings("Потрібен ключ OpenAI для розпізнавання");return}
  if(!navigator.mediaDevices||!window.MediaRecorder){toast("Цей браузер не вміє записувати. Відкрийте в Safari.");return}
  try{mediaStream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){toast("Немає доступу до мікрофона: дозвольте в Safari");return}
  chunks=[];const mime=pickMime();rec=new MediaRecorder(mediaStream,mime?{mimeType:mime}:undefined);
  rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  rec.onstop=async()=>{mediaStream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:rec.mimeType||mime||"audio/mp4"});setRecUI(false);
    if(blob.size<2000){toast("Занадто коротко");return}await transcribe(blob)};
  rec.start();recStart=Date.now();setRecUI(true);
  recTimer=setInterval(()=>{$("recTime").textContent=fmtMin((Date.now()-recStart)/60000);if(Date.now()-recStart>120000)stopRec()},500);
}
function stopRec(){clearInterval(recTimer);if(rec&&rec.state!=="inactive")rec.stop()}
function setRecUI(on){const b=$("micBtn");b.classList.toggle("rec",on);b.textContent=on?"● Слухаю… тапніть, щоб зупинити":"🎤 Сказати";$("recTime").hidden=!on;if(!on)$("recTime").textContent=""}
$("micBtn").onclick=()=>{if(rec&&rec.state==="recording")stopRec();else startRec()};
async function transcribe(blob){
  $("sayBox").hidden=false;$("sayResult").hidden=true;$("sayText").value="";$("sayText").placeholder="Розпізнаю…";
  try{
    const ext=(blob.type||"").includes("mp4")?"m4a":(blob.type||"").includes("ogg")?"ogg":"webm";
    const fd=new FormData();fd.append("file",blob,"say."+ext);fd.append("model","gpt-4o-mini-transcribe");fd.append("language","uk");
    fd.append("prompt","Yaktak, Рози, Нащо, Mioko, Міоко, Kovalov, Ковальов, Ninja Music, Катя, Северин, Йогананда, тхеквондо, meal-prep, Бен");
    const r=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:"Bearer "+KEYS.oa()},body:fd});
    if(!r.ok){const t=await r.text();throw new Error("OpenAI "+r.status+": "+t.slice(0,160))}
    const d=await r.json();const text=(d.text||"").trim();if(!text){toast("Нічого не почув");return}
    await handleText(text);
  }catch(e){toast("Розпізнавання: "+e.message)}
  finally{$("sayText").placeholder="Скажіть або напишіть команду"}
}

// ===== settings / auth
function openSettings(msg){$("setBox").hidden=false;$("set-oa").value=KEYS.oa();$("set-an").value=KEYS.an();$("set-auto").checked=LS.get("lf-auto")==="1";$("setMsg").textContent=msg||""}
$("setBtn").onclick=()=>openSettings("");
$("setClose").onclick=()=>{$("setBox").hidden=true};
$("setSave").onclick=()=>{LS.set("lf-oa",$("set-oa").value.trim());LS.set("lf-an",$("set-an").value.trim());LS.set("lf-auto",$("set-auto").checked?"1":"0");$("setBox").hidden=true;toast("Збережено на цьому телефоні")};
$("setLogout").onclick=async()=>{await sb.auth.signOut();location.reload()};
$("loginBtn").onclick=async()=>{
  const email=$("lg-email").value.trim(),password=$("lg-pass").value;if(!email||!password)return;
  $("loginBtn").disabled=true;$("lgMsg").textContent="";
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error){$("lgMsg").textContent="Не вдалося увійти: "+error.message;$("loginBtn").disabled=false;return}
  $("login").hidden=true;$("app").hidden=false;await boot();
};
$("lg-pass").onkeydown=e=>{if(e.key==="Enter")$("loginBtn").click()};

function renderAll(){renderToday();renderWeek();renderProjects();renderAreas();renderTimer();renderMe()}
async function boot(){setTab(tab);await loadAll();subscribe();
  $("foot").textContent="Дані — ваша база Supabase (Life). Ключі OpenAI/Anthropic зберігаються тільки на цьому телефоні.";
  setInterval(()=>{const t=iso(new Date());if(t!==today){today=t;weekStart=mondayOf(today);loadAll()}},60000)}
(async()=>{
  const {data}=await sb.auth.getSession();
  if(data.session){$("login").hidden=true;$("app").hidden=false;await boot()}
  else{$("login").hidden=false;$("app").hidden=true}
})();
