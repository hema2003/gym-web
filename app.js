// ================= الحالة =================
const KEY = 'gym-data-v1';
const DEF = () => ({
  v: 2,
  profile: { h: 173, w: 83, bf: 20, act: 1.6, goal: 'recomp', adj: 0, adjDate: null, meso: null },
  workouts: [], meals: [], weights: [], meas: [], daily: {}, draft: null
});
const GOALS = {
  cut:    { d: -0.2, r: -0.0075, ar: 'تنشيف' },
  recomp: { d: -0.1, r: -0.0025, ar: 'ريكومب' },
  maint:  { d: 0,    r: 0,       ar: 'ثبات' },
  bulk:   { d: 0.1,  r: 0.0025,  ar: 'تضخيم' }
};

// ================= أدوات =================
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const toDate = s => new Date(s + 'T00:00');
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
const dayDiff = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const weekStart = s => addDays(s, -((toDate(s).getDay() + 1) % 7)); // السبت
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDay = s => toDate(s).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = s => toDate(s).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
const r50 = x => Math.round(x / 50) * 50;
const r5 = x => Math.round(x / 5) * 5;
const roundTo = (x, inc) => inc ? Math.round(x / inc) * inc : Math.round(x);
const num = x => +(+x).toFixed(1);
const sgn = x => (x > 0 ? '+' : '') + num(x);
const e1rm = (w, r) => r > 0 ? w * (1 + r / 30) : 0; // Epley
const pct = (a, b) => Math.min(100, b ? a / b * 100 : 0) + '%';
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
let toastT;
const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); };

// ================= التحميل والترحيل =================
function migrate(s) {
  const d = DEF();
  if (typeof s.profile.goal === 'number') s.profile.goal = s.profile.goal <= -400 ? 'cut' : s.profile.goal < 0 ? 'recomp' : s.profile.goal > 0 ? 'bulk' : 'maint';
  s.profile = Object.assign(d.profile, s.profile);
  if (!GOALS[s.profile.goal]) s.profile.goal = 'recomp';
  if (!s.profile.meso) s.profile.meso = weekStart(today());
  const byName = {};
  for (const id in EX) byName[EX[id].n] = id;
  s.workouts.forEach(w => w.ex.forEach(e => { if (!e.id) e.id = byName[e.n] || 'x:' + e.n; }));
  s.meals.forEach(m => { if (m.k == null) Object.assign(m, { k: +m.kcal || 0, p: +m.pro || 0, c: 0, f: 0, slot: 's' }); });
  if (s.draft && !s.draft.v2) s.draft = null;
  s.daily = s.daily || {}; s.meas = s.meas || []; s.v = 2;
  return s;
}
let S;
try { S = migrate(Object.assign(DEF(), JSON.parse(localStorage.getItem(KEY)) || {})); } catch { S = migrate(DEF()); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('مفيش مساحة للحفظ!'); } };
save();

const exInfo = id => EX[id] || { n: id.slice(2), ar: id.slice(2), m: null, sec: [], rr: [8, 12], rest: 90, inc: 2.5, cue: '' };
const daily = d => (S.daily[d] = S.daily[d] || { water: 0, steps: '', ready: {} });

// ================= الحسابات =================
function trendSeries() {
  let t = null;
  return S.weights.map(x => { t = t == null ? x.w : t + 0.15 * (x.w - t); return { d: x.date, y: x.w, t }; });
}
function curWeight() { const s = trendSeries(); return s.length ? s.at(-1).t : S.profile.w; }
function weeklyRate() {
  const s = trendSeries();
  if (s.length < 4) return null;
  const last = s.at(-1);
  const ref = [...s].reverse().find(x => dayDiff(x.d, last.d) >= 7);
  if (!ref) return null;
  return (last.t - ref.t) / dayDiff(ref.d, last.d) * 7;
}
function targets() {
  const p = S.profile, w = curWeight(), lbm = w * (1 - p.bf / 100);
  const bmr = 370 + 21.6 * lbm; // Katch-McArdle
  const tdee = bmr * p.act;
  const kcal = r50(tdee * (1 + GOALS[p.goal].d) + (+p.adj || 0));
  const pro = r5(2.2 * lbm), fat = r5(0.8 * w);
  return { w, lbm, tdee, kcal, pro, fat, carb: Math.max(0, r5((kcal - pro * 4 - fat * 9) / 4)) };
}
// سعرات بتتظبط لوحدها حسب اتجاه الوزن الحقيقي
function calorieAdvice() {
  const p = S.profile, rate = weeklyRate();
  if (rate == null || S.weights.length < 6 || dayDiff(S.weights[0].date, today()) < 14) return null;
  if (p.adjDate && dayDiff(p.adjDate, today()) < 7) return null;
  const want = GOALS[p.goal].r * curWeight();
  const adj = Math.max(-300, Math.min(300, -r50((rate - want) * 1100)));
  return { rate, want, adj, ok: Math.abs(adj) < 100 };
}
function applyAdj(n) { S.profile.adj = (+S.profile.adj || 0) + n; S.profile.adjDate = today(); save(); toast(`السعرات بقت ${targets().kcal}`); rerender(); }

function mesoWeek(d = today()) { return Math.max(0, Math.floor(dayDiff(S.profile.meso, d) / 7)) % 5 + 1; }
function readiness(d = today()) {
  const r = (S.daily[d] || {}).ready || {};
  const v = ['s', 'e', 'm'].map(k => r[k]).filter(Boolean);
  if (v.length < 3) return null;
  const sum = v.reduce((a, b) => a + b, 0);
  return { sum, low: sum <= 5, high: sum >= 8 };
}
function mealTotals(d) {
  return S.meals.filter(m => m.date === d).reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 });
}
function weeklyVolume(from = addDays(today(), -6)) {
  const v = Object.fromEntries(Object.keys(MUSCLES).map(k => [k, 0]));
  S.workouts.filter(w => w.date >= from).forEach(w => w.ex.forEach(e => {
    const X = exInfo(e.id), n = e.sets.length;
    if (X.m) v[X.m] += n;
    (X.sec || []).forEach(m => v[m] += n / 2);
  }));
  return v;
}
function bestE1rm(id, beforeDate) {
  let b = 0;
  S.workouts.forEach(w => { if (beforeDate && w.date >= beforeDate) return; w.ex.forEach(e => e.id === id && e.sets.forEach(s => b = Math.max(b, e1rm(s.w, s.r)))); });
  return b;
}

// ================= منطق التقدم (Double Progression) =================
function lastSession(id) {
  let fallback = null;
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    const w = S.workouts[i], e = w.ex.find(x => x.id === id);
    if (!e || !e.sets.length) continue;
    if (!w.deload) return { date: w.date, sets: e.sets };
    fallback = fallback || { date: w.date, sets: e.sets };
  }
  return fallback;
}
function suggest(id) {
  const X = exInfo(id), [lo, hi] = X.rr, L = lastSession(id);
  if (!L) return { w: '', r: lo, note: `أول مرة: اختار وزن تقدر تعمل بيه ${lo}-${hi} عدة وتفضل قادر على 2 زيادة` };
  const top = Math.max(...L.sets.map(s => s.w));
  const ts = L.sets.filter(s => s.w === top);
  const minR = Math.min(...ts.map(s => s.r));
  if (ts.every(s => s.r >= hi)) {
    if (!X.inc) return { w: top, r: hi, up: true, note: 'وصلت لآخر النطاق، صعّبها: أبطأ أو زوّد وزن إضافي' };
    return { w: num(top + X.inc), r: lo, up: true, note: `⬆ زوّد ${X.inc} كجم وارجع لـ ${lo} عدات` };
  }
  if (minR < lo) return { w: top, r: lo, note: `نفس الوزن، حاول توصل لـ ${lo} في كل المجموعات` };
  return { w: top, r: Math.min(hi, minR + 1), note: 'نفس الوزن، زوّد عدة في كل مجموعة' };
}
function makeEx(id, sets, deload, low) {
  const X = exInfo(id), g = suggest(id);
  let n = sets, w = g.w, note = g.note;
  if (deload) { n = Math.max(2, Math.ceil(sets / 2)); if (w !== '') w = roundTo(w * 0.9, X.inc || 1); note = 'أسبوع خفيف: وزن أقل 10% ومجموعات أقل'; }
  else if (low) n = Math.max(2, sets - 1);
  return { id, tw: w, tr: g.r, note, up: !deload && g.up, sets: Array.from({ length: n }, () => ({ w, r: g.r, rir: null, ok: false })) };
}
function buildDraft(key) {
  const P = PROGRAM[key], deload = mesoWeek() === 5, rd = readiness(), low = !!(rd && rd.low);
  S.draft = {
    v2: 1, key: P ? key : '', name: P ? P.name : 'تمرين حر', date: today(), start: Date.now(), deload, low,
    ex: P ? P.ex.map(([id, n]) => makeEx(id, n, deload, low)) : []
  };
  save();
}
const draftActive = () => S.draft && S.draft.ex.some(e => e.sets.some(s => s.ok));

// ================= التنقل =================
const TITLES = { home: 'اليوم', work: 'التمرين', food: 'الأكل', prog: 'التقدم', set: 'الإعدادات' };
let view = 'home';
function go(v) {
  view = v;
  for (const k in TITLES) $('v-' + k).classList.toggle('hide', k !== v);
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('title').textContent = TITLES[v];
  rerender();
  scrollTo(0, 0);
}
function rerender() { ({ home: renderHome, work: renderWork, food: renderFood, prog: renderProg, set: renderSet })[view](); }

// ================= اليوم =================
const SHORT = { push: 'Push', pull: 'Pull', legs: 'Legs', arms: 'Arms', upper: 'Upper' };
function renderHome() {
  const d = today(), t = targets(), tot = mealTotals(d), dd = daily(d), wk = mesoWeek();
  $('sub').textContent = fmtDay(d);

  const ws = weekStart(d);
  $('h-week').innerHTML = WEEK_ORDER.map((_, i) => {
    const day = addDays(ws, i), k = SCHEDULE[toDate(day).getDay()], done = S.workouts.some(w => w.date === day);
    return `<div class="${done ? 'done' : ''} ${day === d ? 'today' : ''}"><b>${k ? SHORT[k] : '—'}</b>${DAY_AR[toDate(day).getDay()].replace('ال', '')}</div>`;
  }).join('');

  $('h-meso').innerHTML = wk === 5 ? '<span class="tag blue">Deload · أسبوع خفيف</span>' : `<span class="tag">أسبوع ${wk} من 4</span>`;
  const done = S.workouts.filter(w => w.date === d), key = SCHEDULE[new Date().getDay()], P = PROGRAM[key];
  let h;
  if (draftActive()) {
    const n = S.draft.ex.reduce((a, e) => a + e.sets.filter(s => s.ok).length, 0);
    h = `<p style="margin:0 0 10px">فيه تمرين شغال: <b class="acc">${esc(S.draft.name)}</b> · ${n} مجموعة خلصت</p><button class="p w" onclick="go('work')">كمّل التمرين</button>`;
  } else if (done.length) {
    const w = done.at(-1);
    h = `<p style="margin:0">✅ خلصت <b>${esc(w.name)}</b> · ${w.ex.length} تمارين${w.dur ? ` · ${w.dur} دقيقة` : ''}</p><p class="mute" style="margin:4px 0 0">ركّز على الأكل والنوم عشان تستشفى.</p>`;
  } else if (P) {
    const sets = P.ex.reduce((a, [, n]) => a + n, 0);
    h = `<div style="margin-bottom:10px"><b style="font-size:20px">${P.name}</b> <span class="mute">${P.ar}</span>
      <div class="mute">${P.ex.length} تمارين · ${sets} مجموعة · حوالي ${Math.round(sets * 2.6)} دقيقة</div></div>
      <button class="p w" onclick="startTpl('${key}')">ابدأ التمرين</button>`;
  } else {
    h = `<p style="margin:0 0 10px">يوم راحة 😴 امشي 8-10 آلاف خطوة، والراحة جزء من التمرين.</p><button class="w" onclick="go('work')">اختار تمرين برضه</button>`;
  }
  $('h-work').innerHTML = h;

  const R = dd.ready, opts = [['s', 'نوم', ['😫', '😐', '😴']], ['e', 'طاقة', ['🪫', '😐', '⚡']], ['m', 'عضلات', ['😣', '😐', '💪']]];
  $('h-ready').innerHTML = opts.map(([k, l, em]) => `<div class="ready"><span>${l}</span>${em.map((e, i) =>
    `<button class="${R[k] === i + 1 ? 'on' : ''}" onclick="setReady('${k}',${i + 1})">${e}</button>`).join('')}</div>`).join('');
  const rd = readiness();
  $('h-ready-s').textContent = !rd ? '' : rd.low ? 'خفّف النهارده' : rd.high ? 'جاهز 💪' : 'تمام';

  $('h-nut').innerHTML = `
    <div class="stat"><b>${tot.k}</b><span>من ${t.kcal} سعرة</span><div class="bar"><i style="width:${pct(tot.k, t.kcal)}"></i></div></div>
    <div class="stat"><b class="blue">${Math.round(tot.p)}</b><span>من ${t.pro} جم بروتين</span><div class="bar" style="--c:var(--blue)"><i style="width:${pct(tot.p, t.pro)}"></i></div></div>`;
  $('h-water').innerHTML = Array.from({ length: 12 }, (_, i) => `<i class="${i < dd.water ? 'on' : ''}"></i>`).join('');
  $('h-water-t').textContent = `مية: ${(dd.water * 0.25).toFixed(2).replace(/\.?0+$/, '')} من 3 لتر`;

  const rate = weeklyRate(), tw = trendSeries().at(-1);
  $('h-wtrend').textContent = tw ? `متوسط ${num(tw.t)}${rate != null ? ` · ${sgn(rate)}/أسبوع` : ''}` : '';
  $('h-w').placeholder = S.weights.find(x => x.date === d)?.w ?? 'الوزن كجم';
  $('h-steps').placeholder = dd.steps || 'خطوات';

  $('h-coach').innerHTML = coachTips().map(([i, t]) => `<li><i>${i}</i><span>${t}</span></li>`).join('');
}
function coachTips() {
  const d = today(), t = targets(), tot = mealTotals(d), tips = [], rd = readiness(), hr = new Date().getHours();
  const adv = calorieAdvice();
  if (adv && !adv.ok) tips.push(['⚖️', `وزنك بيتغير ${sgn(adv.rate)} كجم/أسبوع، وهدفك ${sgn(adv.want)}. اقتراحي تغيّر السعرات ${sgn(adv.adj)}.
    <button class="sm p" style="margin-top:6px;display:block" onclick="applyAdj(${adv.adj})">طبّق (${t.kcal + adv.adj} سعرة)</button>`]);
  else if (adv && adv.ok) tips.push(['✅', `وزنك ماشي بمعدل ${sgn(adv.rate)} كجم/أسبوع، مظبوط على هدفك. كمّل كده.`]);
  if (!S.weights.some(x => x.date === d)) tips.push(['📏', 'اوزن نفسك الصبح بعد الحمام وقبل الأكل. التطبيق بيحسب المتوسط، فمتقلقش من تذبذب يوم.']);
  if (mesoWeek() === 5) tips.push(['🔄', 'ده أسبوع Deload: الوزن أقل والمجموعات أقل. ده اللي بيخليك تكسر أرقامك الأسبوع الجاي.']);
  else if (rd && rd.low) tips.push(['😴', 'جاهزيتك قليلة النهارده، فالتمرين هيتعمل بمجموعة أقل في كل تمرين. متضغطش على نفسك.']);
  if (hr >= 14 && tot.p < t.pro) {
    const left = Math.round(t.pro - tot.p);
    tips.push(['🥚', `فاضلك ${left} جم بروتين. علبة تونة فيها 28 جم، و200 جم قريش فيها 24 جم.`]);
  }
  if (S.workouts.length >= 3) {
    const v = weeklyVolume(), low = FOCUS.filter(m => v[m] < VOLUME[m][0]);
    if (low.length) tips.push(['💪', `حجم ${low.map(m => MUSCLES[m]).join(' و')} قليل الأسبوع ده. متفوّتش يوم الكتف والدراع.`]);
    const prs = S.workouts.filter(w => w.date >= addDays(d, -6)).reduce((a, w) => a + (w.prs || 0), 0);
    if (prs) tips.push(['🏆', `كسرت ${prs} رقم قياسي الأسبوع ده. عاش!`]);
  }
  const wkN = S.workouts.filter(w => w.date >= weekStart(d)).length;
  tips.push(['📅', `عملت ${wkN} من 5 تمارين الأسبوع ده.`]);
  return tips;
}
function setReady(k, v) { const r = daily(today()).ready; r[k] = r[k] === v ? undefined : v; save(); vib(8); renderHome(); }
function water(n) { const dd = daily(today()); dd.water = Math.max(0, Math.min(16, dd.water + n)); save(); vib(8); renderHome(); }
function saveDaily() {
  const w = parseFloat($('h-w').value), st = parseInt($('h-steps').value), d = today();
  if (!w && !st) return toast('اكتب وزنك أو خطواتك');
  if (w) {
    S.weights = S.weights.filter(x => x.date !== d);
    S.weights.push({ date: d, w });
    S.weights.sort((a, b) => a.date.localeCompare(b.date));
    S.profile.w = w;
  }
  if (st) daily(d).steps = st;
  $('h-w').value = $('h-steps').value = '';
  save(); toast('اتسجّل ✓'); renderHome();
}

// ================= التمرين =================
function startTpl(k) { if (!draftActive() || confirm('فيه تمرين شغال. تبدأ واحد جديد؟')) buildDraft(k); go('work'); }
function pickTpl(k) {
  if (draftActive() && !confirm('هتمسح التمرين الحالي؟')) return;
  buildDraft(k); renderWork();
}
function renderWork() {
  if (!S.draft) buildDraft(SCHEDULE[new Date().getDay()] || '');
  const D = S.draft, P = PROGRAM[D.key];
  $('sub').textContent = 'Push · Pull · Legs · Arms · Upper';
  $('w-tpl').innerHTML = Object.entries(PROGRAM).map(([k, p]) => `<button class="chip ${D.key === k ? 'on' : ''}" onclick="pickTpl('${k}')">${p.name}</button>`).join('')
    + `<button class="chip ${D.key === '' ? 'on' : ''}" onclick="pickTpl('')">حر</button>`;
  $('w-banner').innerHTML = D.deload ? '<div class="banner">🔄 أسبوع Deload: الأوزان أقل 10% والمجموعات أقل. خليه سهل.</div>'
    : D.low ? '<div class="banner warn">😴 جاهزيتك قليلة، شِلت مجموعة من كل تمرين.</div>' : '';
  $('w-title').textContent = D.name + (P ? ' · ' + P.ar : '');
  $('w-date').value = D.date;
  updateMeta();

  $('w-ex').innerHTML = D.ex.length ? D.ex.map((e, i) => {
    const X = exInfo(e.id);
    return `<div class="ex">
      <div class="ex-h"><div><b>${esc(X.ar)}</b><small>${esc(X.n)}${X.m ? ' · ' + MUSCLES[X.m] : ''} · ${X.rr[0]}-${X.rr[1]} عدة · راحة ${X.rest}ث</small></div>
        <button class="g" onclick="exSheet(${i})" aria-label="تفاصيل">⋯</button></div>
      <div class="target"><span class="tag ${e.up ? 'acc' : 'blue'} ltr">🎯 ${e.tw !== '' ? e.tw + ' kg × ' : ''}${e.tr}</span><span class="mute">${e.note}</span></div>
      <div class="set head"><span></span><span>كجم</span><span>عدات</span><span>RIR</span><span></span></div>
      ${e.sets.map((s, j) => `<div class="set ${s.ok ? 'done' : ''}">
        <span class="n">${j + 1}</span>
        <input type="number" step="0.5" inputmode="decimal" value="${s.w}" onchange="setVal(${i},${j},'w',this.value)">
        <input type="number" inputmode="numeric" value="${s.r}" onchange="setVal(${i},${j},'r',this.value)">
        <button class="rir" onclick="cycleRir(${i},${j})">${s.rir == null ? '—' : s.rir === 3 ? '3+' : s.rir}</button>
        <button class="tick" onclick="tick(${i},${j})">✓</button>
      </div>`).join('')}
      <div class="row"><button class="g sm fit" onclick="addSet(${i})">+ مجموعة</button><button class="g sm fit" onclick="rmSet(${i})">− مجموعة</button></div>
    </div>`;
  }).join('') : '<p class="mute" style="margin:0">اختار يوم من فوق أو ضيف تمارين بنفسك.</p>';

  $('w-hist').innerHTML = S.workouts.slice(-20).reverse().map(w => {
    const sets = w.ex.reduce((a, e) => a + e.sets.length, 0);
    return `<li onclick="histSheet('${w.id}')" style="cursor:pointer"><div><b>${esc(w.name)}</b>${w.deload ? ' <span class="tag blue">Deload</span>' : ''}${w.prs ? ` <span class="tag acc">🏆 ${w.prs}</span>` : ''}
      <div class="mute">${fmtDay(w.date)} · ${w.ex.length} تمارين · ${sets} مجموعة${w.dur ? ` · ${w.dur}د` : ''}</div></div><span class="mute">←</span></li>`;
  }).join('') || '<li class="mute">لسه مفيش تمارين متسجلة</li>';
}
function updateMeta() {
  const D = S.draft; if (!D) return;
  const all = D.ex.reduce((a, e) => a + e.sets.length, 0), ok = D.ex.reduce((a, e) => a + e.sets.filter(s => s.ok).length, 0);
  const mins = draftActive() ? Math.round((Date.now() - D.start) / 6e4) : 0;
  $('w-meta').textContent = `أسبوع ${mesoWeek()} · ${ok}/${all} مجموعة${mins ? ` · ⏱ ${mins} دقيقة` : ''}`;
}
setInterval(() => view === 'work' && updateMeta(), 20000);
function syncHead() { if (S.draft) { S.draft.date = $('w-date').value || today(); save(); } }
function setVal(i, j, f, v) { S.draft.ex[i].sets[j][f] = v === '' ? '' : +v; save(); }
function cycleRir(i, j) { const s = S.draft.ex[i].sets[j]; s.rir = s.rir == null ? 3 : s.rir === 0 ? null : s.rir - 1; save(); vib(5); renderWork(); }
function tick(i, j) {
  const e = S.draft.ex[i], s = e.sets[j];
  if (!s.ok && !(+s.r > 0)) return toast('اكتب العدات الأول');
  if (!s.ok && !draftActive()) S.draft.start = Date.now();
  s.ok = !s.ok;
  if (s.ok) {
    // الوزن والعدات بيتنقلوا للمجموعة الجاية لو لسه متعملتش
    const nx = e.sets[j + 1]; if (nx && !nx.ok) { nx.w = s.w; }
    startRest(exInfo(e.id).rest); vib(15);
  }
  save(); renderWork();
}
function addSet(i) { const ss = S.draft.ex[i].sets, l = ss.at(-1) || { w: '', r: '' }; ss.push({ w: l.w, r: l.r, rir: null, ok: false }); save(); renderWork(); }
function rmSet(i) { if (S.draft.ex[i].sets.length > 1) S.draft.ex[i].sets.pop(); save(); renderWork(); }

function finishWorkout() {
  const D = S.draft;
  const anyOk = draftActive();
  const ex = D.ex.map(e => ({
    id: e.id,
    sets: e.sets.filter(s => (anyOk ? s.ok : true) && +s.r > 0).map(s => ({ w: +s.w || 0, r: +s.r, ...(s.rir != null ? { rir: s.rir } : {}) }))
  })).filter(e => e.sets.length);
  if (!ex.length) return toast('سجّل مجموعة واحدة على الأقل');
  const prs = ex.filter(e => { const b = bestE1rm(e.id, D.date); return b > 0 && Math.max(...e.sets.map(s => e1rm(s.w, s.r))) > b + 0.01; });
  const w = { id: uid(), date: D.date, key: D.key, name: D.name, deload: D.deload || undefined, prs: prs.length || undefined,
    dur: anyOk ? Math.max(1, Math.round((Date.now() - D.start) / 6e4)) : undefined, ex };
  S.workouts.push(w);
  S.workouts.sort((a, b) => a.date.localeCompare(b.date));
  S.draft = null; restStop(); save(); vib([30, 50, 30]);
  const sets = ex.reduce((a, e) => a + e.sets.length, 0), vol = ex.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);
  openSheet(`<div class="grip"></div><h3>عاش! 💪 ${esc(w.name)}</h3><p class="mute" style="margin:0 0 12px">${fmtDay(w.date)}</p>
    <div class="grid3"><div class="stat"><b>${sets}</b><span>مجموعة</span></div><div class="stat"><b>${Math.round(vol)}</b><span>كجم حجم</span></div><div class="stat"><b>${w.dur || '—'}</b><span>دقيقة</span></div></div>
    ${prs.length ? `<div class="card" style="margin:14px 0 0"><h2>🏆 أرقام قياسية جديدة</h2>${prs.map(e => `<div>${esc(exInfo(e.id).ar)}</div>`).join('')}</div>` : ''}
    <button class="p w" style="margin-top:14px" onclick="closeSheet();go('home')">تمام</button>`);
}

// شيت تفاصيل التمرين: الشرح، السجل، والتبديل
function exSheet(i) {
  const e = S.draft.ex[i], X = exInfo(e.id);
  const hist = S.workouts.filter(w => w.ex.some(x => x.id === e.id)).slice(-4).reverse();
  const alts = Object.entries(EX).filter(([id, x]) => x.m && x.m === X.m && id !== e.id && !S.draft.ex.some(y => y.id === id));
  openSheet(`<div class="grip"></div><h3>${esc(X.ar)}</h3><p class="mute" style="margin:0 0 10px">${esc(X.n)}${X.m ? ` · ${MUSCLES[X.m]}` : ''}${(X.sec || []).length ? ' + ' + X.sec.map(m => MUSCLES[m]).join('، ') : ''}</p>
    ${X.cue ? `<div class="banner">💡 ${X.cue}</div>` : ''}
    <h2 class="mute" style="font-size:13px;margin:12px 0 4px">آخر مرات</h2>
    <ul class="list">${hist.map(w => { const x = w.ex.find(y => y.id === e.id); return `<li><span class="mute">${fmtShort(w.date)}</span><span class="ltr">${x.sets.map(s => `${s.w}×${s.r}`).join('  ')}</span></li>`; }).join('') || '<li class="mute">لسه</li>'}</ul>
    ${alts.length ? `<h2 class="mute" style="font-size:13px;margin:12px 0 6px">بدّل بتمرين تاني لنفس العضلة</h2><div class="chips" style="flex-wrap:wrap">${alts.map(([id, x]) => `<button class="chip" onclick="swapEx(${i},'${id}')">${esc(x.ar)}</button>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:14px">
      <button onclick="moveEx(${i},-1)">↑ لفوق</button><button onclick="moveEx(${i},1)">↓ لتحت</button>
      <button class="del" onclick="rmEx(${i})">مسح</button>
    </div>`);
}
function swapEx(i, id) { const n = S.draft.ex[i].sets.length; S.draft.ex[i] = makeEx(id, n, S.draft.deload, false); save(); closeSheet(); renderWork(); }
function moveEx(i, d) { const a = S.draft.ex, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(); closeSheet(); renderWork(); }
function rmEx(i) { S.draft.ex.splice(i, 1); save(); closeSheet(); renderWork(); }

function openPicker() {
  openSheet(`<div class="grip"></div><h3>أضف تمرين</h3>
    <input id="pk-q" placeholder="دوّر… (عربي أو إنجليزي)" oninput="renderPicker()" style="margin:10px 0">
    <div id="pk-l"></div>`);
  renderPicker();
}
function renderPicker() {
  const q = $('pk-q').value.trim().toLowerCase();
  const items = Object.entries(EX).filter(([, x]) => !q || x.ar.includes(q) || x.n.toLowerCase().includes(q));
  let h = '';
  for (const m in MUSCLES) {
    const g = items.filter(([, x]) => x.m === m);
    if (g.length) h += `<div class="mute" style="margin:10px 0 2px">${MUSCLES[m]}</div>` + g.map(([id, x]) => `<div class="food-it" onclick="pickEx('${id}')"><span>${esc(x.ar)}</span><span class="mute ltr">${esc(x.n)}</span></div>`).join('');
  }
  if (q) h += `<button class="w" style="margin-top:10px" onclick="pickEx('x:'+$('pk-q').value.trim())">+ ضيف "${esc($('pk-q').value.trim())}" كتمرين جديد</button>`;
  $('pk-l').innerHTML = h;
}
function pickEx(id) { S.draft.ex.push(makeEx(id, 3, S.draft.deload, S.draft.low)); save(); closeSheet(); renderWork(); }

function histSheet(id) {
  const w = S.workouts.find(x => x.id === id);
  openSheet(`<div class="grip"></div><h3>${esc(w.name)}</h3><p class="mute" style="margin:0 0 10px">${fmtDay(w.date)}${w.dur ? ` · ${w.dur} دقيقة` : ''}</p>
    <ul class="list">${w.ex.map(e => `<li><span>${esc(exInfo(e.id).ar)}</span><span class="ltr mute">${e.sets.map(s => `${s.w}×${s.r}`).join('  ')}</span></li>`).join('')}</ul>
    <button class="g w del" style="margin-top:12px" onclick="rmWorkout('${id}')">مسح التمرين ده</button>`);
}
function rmWorkout(id) {
  if (!confirm('امسح التمرين ده؟')) return;
  S.workouts = S.workouts.filter(w => w.id !== id); save(); closeSheet(); rerender();
}

// ================= مؤقت الراحة =================
const RT = { end: 0, total: 0, iv: null, fired: false };
let AC;
function startRest(sec) {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  Object.assign(RT, { end: Date.now() + sec * 1000, total: sec, fired: false });
  $('rest').classList.remove('hide', 'end');
  clearInterval(RT.iv); RT.iv = setInterval(tickRest, 250); tickRest();
}
function tickRest() {
  const left = Math.ceil((RT.end - Date.now()) / 1000);
  if (left <= 0) {
    $('rest').classList.add('end'); $('rest-t').textContent = 'يلا!'; $('rest-b').style.width = '100%';
    if (!RT.fired) { RT.fired = true; vib([200, 100, 200]); beep(); }
    if (left < -30) restStop();
    return;
  }
  $('rest-t').textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
  $('rest-b').style.width = (100 - left / RT.total * 100) + '%';
}
function restAdd(n) { RT.end += n * 1000; RT.total = Math.max(1, RT.total + n); if (RT.end > Date.now()) { RT.fired = false; $('rest').classList.remove('end'); } tickRest(); }
function restStop() { clearInterval(RT.iv); $('rest').classList.add('hide'); }
function beep() {
  try {
    [0, .3].forEach(t => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.frequency.value = 880; g.gain.value = .2; o.connect(g); g.connect(AC.destination);
      o.start(AC.currentTime + t); o.stop(AC.currentTime + t + .18);
    });
  } catch {}
}

// ================= الأكل =================
const foodById = id => FOODS.find(f => f.id === id);
const macrosOf = (f, q) => { const m = q / f.b; return { k: Math.round(f.k * m), p: num(f.p * m), c: num(f.c * m), f: num(f.f * m) }; };
const itemLabel = (f, q) => f.u === 'جم' ? `${f.n} ${q}جم` : `${f.n} ×${q}`;
function planMacros(pm) {
  return pm.items.reduce((a, [id, q]) => { const m = macrosOf(foodById(id), q); return { k: a.k + m.k, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }; }, { k: 0, p: 0, c: 0, f: 0 });
}
const planName = pm => pm.items.map(([id, q]) => itemLabel(foodById(id), q)).join(' + ');
const fDate = () => $('f-date').value || today();
function shiftDay(n) { $('f-date').value = addDays(fDate(), n); renderFood(); }
function defaultSlot() { const h = new Date().getHours(); return h < 11 ? 'b' : h < 17 ? 'l' : h < 22 ? 'd' : 's'; }

function renderFood() {
  if (!$('f-date').value) $('f-date').value = today();
  const d = fDate(), t = targets(), tot = mealTotals(d);
  $('sub').textContent = d === today() ? 'النهارده' : fmtDay(d);
  const mk = (v, tg, l, c) => `<div class="stat"><b style="color:${c}">${Math.round(v)}</b><span>${l} / ${tg}</span><div class="bar" style="--c:${c}"><i style="width:${pct(v, tg)}"></i></div></div>`;
  $('f-macro').innerHTML = mk(tot.k, t.kcal, 'سعرات', 'var(--acc)') + mk(tot.p, t.pro, 'بروتين', 'var(--blue)') + mk(tot.c, t.carb, 'كارب', 'var(--amber)') + mk(tot.f, t.fat, 'دهون', 'var(--pink)');

  const seen = new Set(), recent = [];
  for (let i = S.meals.length - 1; i >= 0 && recent.length < 10; i--) { const m = S.meals[i]; if (!seen.has(m.name)) { seen.add(m.name); recent.push(m); } }
  $('f-quick').innerHTML = recent.map((m, i) => `<button class="chip" onclick="reAdd(${S.meals.indexOf(m)})">+ ${esc(m.name.length > 28 ? m.name.slice(0, 26) + '…' : m.name)}</button>`).join('');

  const eaten = new Set(S.meals.filter(m => m.date === d).map(m => m.name));
  const all = MEAL_PLAN.map(planMacros).reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p }), { k: 0, p: 0 });
  $('f-plan-t').textContent = `≈ ${all.k} سعرة · ${Math.round(all.p)} بروتين`;
  $('f-plan').innerHTML = MEAL_PLAN.map((pm, i) => {
    const m = planMacros(pm), n = planName(pm), on = eaten.has(n);
    return `<li><div><b>${pm.t}</b><div class="mute">${esc(n)}</div><div class="mute">${m.k} سعرة · ${Math.round(m.p)} بروتين</div></div>
      <button class="fit ${on ? 'p' : ''}" onclick="planMeal(${i})">${on ? '✓' : '+'}</button></li>`;
  }).join('');

  const list = S.meals.filter(m => m.date === d);
  $('f-list').innerHTML = Object.keys(SLOTS).map(sl => {
    const g = list.filter(m => m.slot === sl);
    if (!g.length) return '';
    return `<li class="mute" style="padding-bottom:0;border:0">${SLOTS[sl]}</li>` + g.map(m =>
      `<li><div><b style="font-weight:600">${esc(m.name)}</b><div class="mute">${m.k} سعرة · ب ${num(m.p)} · ك ${num(m.c)} · د ${num(m.f)}</div></div><button class="g del" onclick="rmMeal('${m.id}')">✕</button></li>`).join('');
  }).join('') || '<li class="mute">لسه مسجلتش أكل لليوم ده</li>';
}
function addMealEntry(o) { S.meals.push({ id: uid(), date: fDate(), ...o }); save(); vib(10); }
function planMeal(i) {
  const pm = MEAL_PLAN[i], n = planName(pm), d = fDate();
  const had = S.meals.find(m => m.date === d && m.name === n);
  if (had) S.meals = S.meals.filter(m => m !== had), save();
  else addMealEntry({ slot: pm.slot, name: n, ...planMacros(pm) });
  renderFood();
}
function reAdd(idx) { const m = S.meals[idx]; addMealEntry({ slot: defaultSlot(), name: m.name, k: m.k, p: m.p, c: m.c, f: m.f }); toast('اتضاف ✓'); renderFood(); }
function rmMeal(id) { S.meals = S.meals.filter(m => m.id !== id); save(); renderFood(); }

// شيت إضافة أكل
const FS = { id: null, q: 0, slot: 'b' };
function openFood() {
  FS.id = null; FS.slot = defaultSlot();
  openSheet(`<div class="grip"></div><h3>أضف أكل</h3>
    <div class="chips" id="fs-slot" style="margin:10px 0"></div>
    <div id="fs-sel"></div>
    <input id="fs-q" placeholder="دوّر على أكل…" oninput="renderFoodList()" style="margin:6px 0">
    <div id="fs-list"></div>
    <details style="margin-top:12px"><summary class="mute">إدخال يدوي</summary>
      <input id="fm-n" placeholder="اسم الأكل" style="margin:8px 0">
      <div class="grid4"><input type="number" id="fm-k" placeholder="سعرات"><input type="number" id="fm-p" placeholder="بروتين"><input type="number" id="fm-c" placeholder="كارب"><input type="number" id="fm-f" placeholder="دهون"></div>
      <button class="w" style="margin-top:8px" onclick="addManual()">أضف</button>
    </details>`);
  renderFoodSheet();
}
function renderFoodSheet() {
  $('fs-slot').innerHTML = Object.entries(SLOTS).map(([k, l]) => `<button class="chip ${FS.slot === k ? 'on' : ''}" onclick="FS.slot='${k}';renderFoodSheet()">${l}</button>`).join('');
  const f = FS.id && foodById(FS.id);
  if (f) {
    const m = macrosOf(f, FS.q), step = f.b === 100 ? 25 : 1;
    $('fs-sel').innerHTML = `<div class="card" style="margin:6px 0;background:var(--card2)"><b>${f.n}</b>
      <div class="row" style="margin:10px 0">
        <button class="fit" onclick="FS.q=Math.max(${step},FS.q-${step});renderFoodSheet()">−</button>
        <input type="number" value="${FS.q}" oninput="FS.q=+this.value||0;renderFoodSel()">
        <span class="fit mute">${f.u}</span>
        <button class="fit" onclick="FS.q+=${step};renderFoodSheet()">+</button>
      </div>
      <div class="mute" id="fs-m">${m.k} سعرة · ب ${m.p} · ك ${m.c} · د ${m.f}</div>
      <button class="p w" style="margin-top:10px" onclick="addFood()">أضف ✓</button></div>`;
  } else $('fs-sel').innerHTML = '';
  renderFoodList();
}
function renderFoodSel() { const f = foodById(FS.id), m = macrosOf(f, FS.q); $('fs-m').textContent = `${m.k} سعرة · ب ${m.p} · ك ${m.c} · د ${m.f}`; }
function renderFoodList() {
  const q = ($('fs-q').value || '').trim();
  $('fs-list').innerHTML = FOODS.filter(f => !q || f.n.includes(q)).map(f =>
    `<div class="food-it" onclick="FS.id='${f.id}';FS.q=${f.d};renderFoodSheet()"><span>${f.n}</span><span class="mute">${f.k} سعرة · ب ${f.p} / ${f.b === 1 ? f.u : '100جم'}</span></div>`).join('');
}
function addFood() {
  const f = foodById(FS.id); if (!FS.q) return;
  addMealEntry({ slot: FS.slot, name: itemLabel(f, FS.q), ...macrosOf(f, FS.q) });
  closeSheet(); toast('اتضاف ✓'); renderFood();
}
function addManual() {
  const n = $('fm-n').value.trim(), k = +$('fm-k').value || 0;
  if (!n || !k) return toast('اكتب الاسم والسعرات');
  addMealEntry({ slot: FS.slot, name: n, k, p: +$('fm-p').value || 0, c: +$('fm-c').value || 0, f: +$('fm-f').value || 0 });
  closeSheet(); toast('اتضاف ✓'); renderFood();
}

// ================= التقدم =================
function lineChart(pts, trend) {
  if (pts.length < 2) return '<p class="mute" style="margin:0">محتاج تسجيلين على الأقل عشان يظهر الرسم.</p>';
  const W = 320, H = 170, P = 26, main = trend || pts;
  const ys = [...pts, ...(trend || [])].map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const d0 = pts[0].d, dn = Math.max(1, dayDiff(d0, pts.at(-1).d));
  const x = d => P + dayDiff(d0, d) / dn * (W - P * 2), y = v => H - P - (v - lo) / span * (H - P * 2);
  const path = main.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
  const L = main.at(-1);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="direction:ltr;height:auto">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6f432" stop-opacity=".22"/><stop offset="1" stop-color="#c6f432" stop-opacity="0"/></linearGradient></defs>
    ${[hi, lo].map(v => `<line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}" stroke="#26292e" stroke-dasharray="3 4"/><text x="0" y="${y(v) + 4}" fill="#8a9099" font-size="10">${num(v)}</text>`).join('')}
    <path d="${path}L${x(L.d)},${H - P}L${x(main[0].d)},${H - P}Z" fill="url(#g)"/>
    ${trend ? pts.map(p => `<circle cx="${x(p.d)}" cy="${y(p.y)}" r="2.5" fill="#8a9099" opacity=".7"/>`).join('') : ''}
    <path d="${path}" fill="none" stroke="#c6f432" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(L.d)}" cy="${y(L.y)}" r="4.5" fill="#c6f432"/>
    <text x="${P}" y="${H - 6}" fill="#8a9099" font-size="10">${pts[0].d.slice(5)}</text>
    <text x="${W - P}" y="${H - 6}" fill="#8a9099" font-size="10" text-anchor="end">${pts.at(-1).d.slice(5)} · ${num(L.y)}</text>
  </svg>`;
}
function renderProg() {
  $('sub').textContent = 'البيانات بتقول إيه';
  const ts = trendSeries(), rate = weeklyRate(), goalR = GOALS[S.profile.goal].r;
  $('p-w').textContent = ts.length ? num(ts.at(-1).t) : S.profile.w;
  $('p-rate').textContent = rate == null ? '—' : sgn(rate);
  $('p-rate').style.color = rate == null ? '' : Math.abs(rate - goalR * curWeight()) < 0.25 ? 'var(--acc)' : 'var(--amber)';
  $('p-n').textContent = S.workouts.filter(w => w.date >= weekStart(today())).length + '/5';
  $('p-wchart').innerHTML = lineChart(ts.map(p => ({ d: p.d, y: p.y })), ts.map(p => ({ d: p.d, y: p.t })));

  const v = weeklyVolume(), scale = 30;
  $('p-vol').innerHTML = Object.keys(MUSCLES).map(m => {
    const [lo, hi] = VOLUME[m], val = v[m], cls = val < lo ? 'low' : val > hi * 1.15 ? 'hi' : '';
    return `<div class="vol"><span>${MUSCLES[m]}${FOCUS.includes(m) ? ' ★' : ''}</span>
      <div class="track"><div class="band" style="right:${lo / scale * 100}%;width:${(hi - lo) / scale * 100}%"></div><div class="fill ${cls}" style="width:${Math.min(100, val / scale * 100)}%"></div></div>
      <b class="ltr" style="font-weight:600">${num(val)}</b></div>`;
  }).join('');

  const ids = [...new Set(S.workouts.flatMap(w => w.ex.map(e => e.id)))];
  const cur = $('p-ex').value;
  $('p-ex').innerHTML = ids.map(id => `<option value="${esc(id)}" ${id === cur ? 'selected' : ''}>${esc(exInfo(id).ar)}</option>`).join('') || '<option>لسه مفيش تمارين</option>';
  renderExChart();

  const start = addDays(weekStart(today()), -77), t = today(), days = new Set(S.workouts.map(w => w.date));
  $('p-heat').innerHTML = Array.from({ length: 84 }, (_, i) => { const d = addDays(start, i); return `<i class="${d > t ? 'fut' : days.has(d) ? 'on' : ''}" title="${d}"></i>`; }).join('');

  const M = S.meas, f0 = M[0], fl = M.at(-1);
  const ml = { waist: 'وسط', arm: 'دراع', chest: 'صدر', sh: 'كتف' };
  $('p-meas').innerHTML = fl ? Object.keys(ml).filter(k => fl[k]).map(k => {
    const d = f0[k] ? fl[k] - f0[k] : 0, good = k === 'waist' ? d <= 0 : d >= 0;
    return `<li><span>${ml[k]}</span><span><b>${fl[k]}</b> ${M.length > 1 && d ? `<span class="${good ? 'acc' : 'warn'} ltr">(${sgn(d)})</span>` : ''}</span></li>`;
  }).join('') + `<li class="mute">آخر قياس ${fmtShort(fl.date)} · قيس كل أسبوعين</li>` : '<li class="mute">قيس الوسط والدراع كل أسبوعين. لو الوسط بينزل والدراع ثابت أو بيزيد، يبقى الريكومب شغال.</li>';

  $('p-prs').innerHTML = ids.map(id => {
    let best = null;
    S.workouts.forEach(w => w.ex.forEach(e => e.id === id && e.sets.forEach(s => { if (!best || e1rm(s.w, s.r) > e1rm(best.w, best.r)) best = s; })));
    return `<li><span>${esc(exInfo(id).ar)}</span><span class="ltr"><b class="acc">${best.w} kg × ${best.r}</b> <span class="mute">≈${Math.round(e1rm(best.w, best.r))}</span></span></li>`;
  }).join('') || '<li class="mute">سجّل تمارينك وأرقامك هتظهر هنا</li>';
}
function renderExChart() {
  const id = $('p-ex').value;
  const pts = S.workouts.map(w => { const e = w.ex.find(x => x.id === id); return e && { d: w.date, y: Math.max(...e.sets.map(s => e1rm(s.w, s.r))) }; }).filter(Boolean);
  $('p-exchart').innerHTML = lineChart(pts);
}
function saveMeas() {
  const o = { date: today() };
  ['waist', 'arm', 'chest', 'sh'].forEach(k => { const v = parseFloat($('m-' + k).value); if (v) o[k] = v; });
  if (Object.keys(o).length < 2) return toast('اكتب مقاس واحد على الأقل');
  S.meas = S.meas.filter(m => m.date !== o.date); S.meas.push(o);
  ['waist', 'arm', 'chest', 'sh'].forEach(k => $('m-' + k).value = '');
  save(); toast('اتسجّل ✓'); renderProg();
}

// ================= الإعدادات =================
function renderSet() {
  $('sub').textContent = '';
  const p = S.profile, t = targets();
  $('s-h').value = p.h; $('s-w').value = num(t.w); $('s-bf').value = p.bf; $('s-act').value = p.act; $('s-goal').value = p.goal;
  $('s-meso').value = p.meso; $('s-adj').value = p.adj || 0;
  $('s-calc').innerHTML = `
    <div class="stat"><b class="acc">${t.kcal}</b><span>سعرة</span></div>
    <div class="stat"><b class="blue">${t.pro}</b><span>بروتين جم</span></div>
    <div class="stat"><b class="amber">${t.carb}</b><span>كارب جم</span></div>
    <div class="stat"><b class="pink">${t.fat}</b><span>دهون جم</span></div>`;
  $('s-note').textContent = `حرقك اليومي حوالي ${r50(t.tdee)} سعرة · الكتلة الصافية ${num(t.lbm)} كجم · BMI ${num(t.w / (p.h / 100) ** 2)}. البروتين محسوب 2.2 جم لكل كيلو كتلة صافية.`;
}
function saveProfile() {
  const w = +$('s-w').value;
  Object.assign(S.profile, {
    h: +$('s-h').value || 173, bf: +$('s-bf').value || 20, act: +$('s-act').value, goal: $('s-goal').value,
    meso: $('s-meso').value || S.profile.meso, adj: +$('s-adj').value || 0
  });
  if (w && !S.weights.length) S.profile.w = w;
  save(); toast('اتحفظ ✓'); renderSet();
}
function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
  a.download = `gym-backup-${today()}.json`; a.click();
}
function importData(inp) {
  const f = inp.files[0]; if (!f) return;
  f.text().then(t => {
    try { const d = JSON.parse(t); if (!Array.isArray(d.workouts)) throw 0; S = migrate(Object.assign(DEF(), d)); save(); toast('اتستورد ✓'); go('home'); }
    catch { toast('الملف ده مش صالح'); }
  });
  inp.value = '';
}
function resetAll() {
  if (!confirm('متأكد؟ كل حاجة هتتمسح.')) return;
  S = migrate(DEF()); save(); go('home');
}

// ================= شيت =================
function openSheet(h) { $('sheet-c').innerHTML = h; const d = $('sheet'); if (!d.open) d.showModal(); }
function closeSheet() { $('sheet').close(); }

go('home');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
