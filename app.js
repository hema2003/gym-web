// ================= الحالة =================
const KEY = 'gym-data-v1';
const DEF = () => ({
  v: 2,
  profile: { h: 173, w: 83, bf: 20, act: 1.6, goal: 'cut', adj: 0, adjDate: null, meso: null },
  workouts: [], meals: [], weights: [], meas: [], daily: {}, myFoods: [], draft: null
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
  s.workouts.forEach(w => w.ex.forEach(e => { e.id = resolveId(e.id || 'x:' + e.n); }));
  if (s.draft) s.draft.ex.forEach(e => { e.id = resolveId(e.id); });
  s.meals.forEach(m => { if (m.k == null) Object.assign(m, { k: +m.kcal || 0, p: +m.pro || 0, c: 0, f: 0, slot: 's' }); });
  if (s.draft && !s.draft.v2) s.draft = null;
  // أصناف الأكل القديمة كانت بالوحدة أو بالجرام من غير u
  s.meals.forEach(m => (m.items || []).forEach(it => { if (it.id && it.u === undefined) it.u = UNIT_IDS.includes(it.id) ? 0 : -1; }));
  // الهدف الأساسي خسارة دهون، فأي ملف قديم على "ريكومب" بيتحول لـ "تنشيف" مرة واحدة
  s.flags = s.flags || {};
  if (!s.flags.cut1) { if (s.profile.goal === 'recomp') s.profile.goal = 'cut'; s.flags.cut1 = 1; }
  s.daily = s.daily || {}; s.meas = s.meas || []; s.myFoods = s.myFoods || []; s.v = 2;
  return s;
}
let S;
try { S = migrate(Object.assign(DEF(), JSON.parse(localStorage.getItem(KEY)) || {})); } catch { S = migrate(DEF()); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('مفيش مساحة للحفظ!'); } };
save();

// أي كود تمرين (قديم أو اسم إنجليزي أو مضاف يدوي) → الكود الصحيح في المكتبة
function resolveId(id) {
  if (!id || EX[id]) return id;
  if (ALIAS[id]) return ALIAS[id];
  const name = id.replace(/^x:/, '').trim();
  if (LEGACY[name]) return LEGACY[name];
  for (const k in EX) if (EX[k].n.toLowerCase() === name.toLowerCase() || EX[k].ar === name) return k;
  return id;
}
const prettyName = id => id.replace(/^x:/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'تمرين';
function exInfo(id) {
  const r = resolveId(id);
  if (EX[r]) return EX[r];
  const n = prettyName(r);
  return { n, ar: n, m: null, sec: [], eq: null, rr: [8, 12], rest: 90, inc: 2.5, custom: true,
    steps: ['اعمل الحركة بمدى كامل من أولها لآخرها.', 'نزّل الوزن ببطء في حوالي تانيتين.', 'وقّف قبل الفشل بعدّة أو اتنين (RIR 1-2).'],
    cue: 'ده تمرين إنت ضفته. لو ليه بديل في المكتبة، بدّله من زرار ⋯ عشان يظهر بصورته وشرحه.' };
}
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
  const pro = r5((p.goal === 'cut' ? 2.5 : 2.2) * lbm), fat = r5(0.8 * w);
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
// الحرق الفعلي (فكرة من MacroFactor): متوسط أكلك − (تغيّر متوسط وزنك × 7700 ÷ الأيام)
function expenditure() {
  const d = today(), from = addDays(d, -27);
  const days = [...Array(28)].map((_, i) => addDays(from, i)).filter(x => S.meals.some(m => m.date === x));
  const ts = trendSeries().filter(p => p.d >= from);
  if (days.length < 10 || ts.length < 8) return { need: true, days: days.length, weighs: ts.length };
  const span = dayDiff(ts[0].d, ts.at(-1).d);
  if (span < 10) return { need: true, days: days.length, weighs: ts.length };
  const avgIn = days.reduce((a, x) => a + mealTotals(x).k, 0) / days.length;
  return { tdee: r50(avgIn - (ts.at(-1).t - ts[0].t) * 7700 / span), avgIn: Math.round(avgIn), days: days.length };
}
function applyTdee(tdee) {
  const p = S.profile, formula = targets().tdee;
  p.adj = r50(tdee * (1 + GOALS[p.goal].d) - formula * (1 + GOALS[p.goal].d)); p.adjDate = today();
  save(); toast(`هدفك بقى ${targets().kcal} سعرة`); rerender();
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
    if (X.m && v[X.m] != null) v[X.m] += n;
    (X.sec || []).forEach(m => { if (v[m] != null) v[m] += n / 2; });
  }));
  return v;
}
function bestE1rm(id, beforeDate) {
  let b = 0;
  if (isCardio(id)) return 0;
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
// ===== كارديو: السعرات = MET × الوزن × الساعات =====
const isCardio = id => exInfo(id).m === 'cardio';
function cardioMet(X, w) {
  if (X.cardio === 'lvl') return X.mets[Math.max(0, Math.min(2, Math.round(+w || 2) - 1))];
  const v = (+w || 0) * 1000 / 60, g = X.grade || 0; // م/دقيقة (معادلات ACSM)
  return (X.cardio === 'run' ? 0.2 * v + 0.9 * v * g + 3.5 : 0.1 * v + 1.8 * v * g + 3.5) / 3.5;
}
const cardioKcal = (id, w, min) => Math.round(cardioMet(exInfo(id), w) * curWeight() * (+min || 0) / 60);
function suggest(id) {
  if (isCardio(id)) {
    const X = exInfo(id), L = lastSession(id);
    if (!L) return { w: X.dw, r: X.dm, note: `ابدأ بـ ${X.dm} دقيقة` };
    const s = L.sets[0];
    return { w: s.w, r: Math.min(X.rr[1], s.r + (s.r < X.rr[1] ? 2 : 0)), note: s.r < X.rr[1] ? 'زوّد دقيقتين عن المرة اللي فاتت' : 'ثبّت المدة، وزوّد السرعة أو الشدة سنة' };
  }
  const X = exInfo(id), [lo, hi] = X.rr, L = lastSession(id);
  if (!L) return { w: '', r: lo, note: `أول مرة: اختار وزن تقدر تعمل بيه ${lo}-${hi} عدّة وتفضل قادر على 2 زيادة` };
  const top = Math.max(...L.sets.map(s => s.w));
  const ts = L.sets.filter(s => s.w === top);
  const minR = Math.min(...ts.map(s => s.r));
  if (ts.every(s => s.r >= hi)) {
    if (!X.inc) return { w: top, r: hi, up: true, note: 'وصلت لآخر النطاق، صعّبها: أبطأ أو زوّد وزن إضافي' };
    return { w: num(top + X.inc), r: lo, up: true, note: `⬆ زوّد ${X.inc} كجم وارجع لـ ${lo} عدّات` };
  }
  if (minR < lo) return { w: top, r: lo, note: `نفس الوزن، حاول توصل لـ ${lo} في كل المجموعات` };
  return { w: top, r: Math.min(hi, minR + 1), note: 'نفس الوزن، زوّد عدّة في كل مجموعة' };
}
function makeEx(id, sets, deload, low) {
  const X = exInfo(id), g = suggest(id);
  let n = sets, w = g.w, note = g.note;
  if (X.m === 'cardio') { n = sets; }
  else if (deload) { n = Math.max(2, Math.ceil(sets / 2)); if (w !== '') w = roundTo(w * 0.9, X.inc || 1); note = 'أسبوع خفيف: وزن أقل 10% ومجموعات أقل'; }
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
// ===== الترتيب المرن: التمرين الجاي = اللي بعد آخر تمرين عملته فعلًا =====
function lastProgramWorkout() { for (let i = S.workouts.length - 1; i >= 0; i--) if (ORDER.includes(S.workouts[i].key)) return S.workouts[i]; return null; }
function nextKey() { const w = lastProgramWorkout(); return w ? ORDER[(ORDER.indexOf(w.key) + 1) % ORDER.length] : ORDER[0]; }
const trainedOn = d => S.workouts.some(w => w.date === d);
function restSuggested(d = today()) {
  const y = S.workouts.filter(w => w.date === addDays(d, -1));
  if (y.some(w => REST_AFTER.includes(w.key))) return true;
  return [1, 2, 3].every(n => trainedOn(addDays(d, -n))); // 3 أيام ورا بعض
}
// توقّع الأسبوع: اللي فات من السجل الحقيقي، واللي جاي بيتحسب من مكانك في الترتيب
function projectWeek(ws) {
  const d = today(), out = [];
  let cur = null, restNext = false, streak = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i), done = S.workouts.filter(w => w.date === day);
    if (day < d || done.length) { out.push({ day, done: done.length > 0, key: done.at(-1)?.key }); continue; }
    if (cur === null) {
      cur = nextKey(); restNext = restSuggested(day);
      for (let n = 1; trainedOn(addDays(day, -n)); n++) streak = n;
    }
    if (restNext || streak >= 3) { out.push({ day, plan: true, rest: true }); restNext = false; streak = 0; }
    else { out.push({ day, plan: true, key: cur }); restNext = REST_AFTER.includes(cur); streak++; cur = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]; }
  }
  return out;
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
// ===== البار: بيتحمّل بأطباق على قد التقدّم (ألوان الأطباق الأولمبية) =====
const PLATES = [['--red', 78], ['--blue', 70], ['--yellow', 62], ['--green', 54]];
const barState = {};
function barbell(key, filled, slots) {
  const W = 340, H = 92, cy = H / 2, pw = 11, gap = 3, inner = 118, prev = barState[key] ?? filled;
  barState[key] = filled;
  let s = `<svg class="barbell" viewBox="0 0 ${W} ${H}" role="img" aria-label="${filled} من ${slots}">`;
  s += `<rect x="4" y="${cy - 3}" width="${W - 8}" height="6" rx="3" style="fill:var(--ink-3)"/>`;
  s += `<rect x="${inner - 6}" y="${cy - 9}" width="6" height="18" rx="2" style="fill:var(--ink-2)"/><rect x="${W - inner}" y="${cy - 9}" width="6" height="18" rx="2" style="fill:var(--ink-2)"/>`;
  for (let i = 0; i < slots; i++) {
    const [c, h] = PLATES[i % 4], on = i < filled, isNew = on && i >= prev;
    const xl = inner - 8 - (i + 1) * (pw + gap) + gap, xr = W - inner + 8 + i * (pw + gap);
    const st = on ? `fill:var(${c})` : 'fill:none;stroke:var(--line);stroke-width:1.5';
    s += `<rect class="plate${isNew ? ' new' : ''}" style="${st};--dx:-40px" x="${xl}" y="${cy - h / 2}" width="${pw}" height="${h}" rx="3"/>`;
    s += `<rect class="plate${isNew ? ' new' : ''}" style="${st};--dx:40px" x="${xr}" y="${cy - h / 2}" width="${pw}" height="${h}" rx="3"/>`;
  }
  return s + '</svg>';
}

const SHORT = { push: 'Push', pull: 'Pull', legs: 'Legs', arms: 'Arms', upper: 'Upper' };
function renderHome() {
  const d = today(), t = targets(), tot = mealTotals(d), dd = daily(d), wk = mesoWeek();
  $('sub').textContent = fmtDay(d);
  const ws = weekStart(d), week = projectWeek(ws), doneWeek = S.workouts.filter(w => w.date >= ws).length;

  $('h-week').innerHTML = week.map(x => {
    const lbl = x.done ? (SHORT[x.key] || 'تمرين') : x.rest ? 'راحة' : x.key ? SHORT[x.key] : '—';
    return `<div class="${x.done ? 'done' : ''} ${x.day === d ? 'today' : ''}"><b>${lbl}</b>${DAY_AR[toDate(x.day).getDay()].replace(/^ال/, '')}</div>`;
  }).join('');

  const done = S.workouts.filter(w => w.date === d), key = nextKey(), P = PROGRAM[key], last = lastProgramWorkout();
  const gap = last ? dayDiff(last.date, d) : 0, sets = P.ex.reduce((a, [, n]) => a + n, 0);
  const deloadTag = wk === 5 ? ' <span class="tag blue">أسبوع خفيف</span>' : '';
  const bar = barbell('week', doneWeek, 5);
  let h;
  if (draftActive()) {
    const n = S.draft.ex.reduce((a, e) => a + e.sets.filter(s => s.ok).length, 0);
    h = `<div class="kicker">تمرين شغّال</div><div class="name">${esc(S.draft.name)}</div><p class="desc">خلّصت ${n} مجموعة لحد دلوقتي.</p>${bar}
      <button class="p w big" onclick="go('work')">كمّل التمرين</button>`;
  } else if (done.length) {
    const w = done.at(-1);
    h = `<div class="kicker">خلّصت تمرين النهارده</div><div class="name">${esc(w.name)} ✓</div><p class="desc">${w.ex.length} تمارين${w.dur ? ` في ${w.dur} دقيقة` : ''}. دلوقتي ركّز على البروتين والنوم.</p>${bar}`;
  } else if (restSuggested()) {
    h = `<div class="kicker">مقترح النهارده</div><div class="name">راحة</div>
      <p class="desc">الاستشفاء جزء من التمرين. امشي 10 آلاف خطوة، وبكرة عليك ${P.name}.</p>${bar}
      <button class="w" onclick="startTpl('${key}')">اتمرن برضه (${P.name})</button>`;
  } else {
    h = `<div class="kicker">تمرين النهارده${deloadTag}</div><div class="name">${P.name}</div>
      <p class="desc">${P.ar.replace(/ · /g, '، ')}. ${P.ex.length} تمارين في حوالي ${Math.round(sets * 2.6)} دقيقة.</p>
      ${last && gap > 1 ? `<p class="mute" style="margin:6px 0 0">آخر تمرين كان ${PROGRAM[last.key].name} من ${gap} أيام، فهنكمّل من بعده.</p>` : ''}
      ${bar}<button class="p w big" onclick="startTpl('${key}')">ابدأ التمرين</button>`;
  }
  $('h-work').innerHTML = h + `<p class="mute" style="margin:8px 0 0;text-align:center">${doneWeek} من 5 تمارين الأسبوع ده</p>`;

  const R = dd.ready, opts = [['s', 'النوم', ['😫', '😐', '😴']], ['e', 'الطاقة', ['🪫', '😐', '⚡']], ['m', 'العضلات', ['😣', '😐', '💪']]];
  $('h-ready').innerHTML = opts.map(([k, l, em]) => `<div class="ready"><span>${l}</span>${em.map((e, i) =>
    `<button class="${R[k] === i + 1 ? 'on' : ''}" onclick="setReady('${k}',${i + 1})" aria-label="${l} ${i + 1}">${e}</button>`).join('')}</div>`).join('');
  const rd = readiness();
  $('h-ready-s').textContent = !rd ? 'اختار عشان التمرين يتظبط عليك' : rd.low ? 'هنخفّف التمرين النهارده' : rd.high ? 'جاهز تمامًا' : 'تمام';

  $('h-nut').innerHTML = energyBlock(t, tot);
  $('h-water').innerHTML = Array.from({ length: 12 }, (_, i) => `<i class="${i < dd.water ? 'on' : ''}"></i>`).join('');
  $('h-water-t').textContent = `المية: ${(dd.water * 0.25).toFixed(2).replace(/\.?0+$/, '') || 0} من 3 لتر`;
  const st = +dd.steps || 0;
  $('h-stepsbar').innerHTML = `<div class="row"><span class="mute">الخطوات: <b class="num" style="font-weight:600">${st.toLocaleString('en')}</b> من 10,000</span></div><div class="bar" style="--c:var(--green)"><i style="width:${pct(st, 10000)}"></i></div>`;

  const rate = weeklyRate(), tw = trendSeries().at(-1);
  $('h-wtrend').textContent = tw ? `${num(tw.t)} كجم${rate != null ? ` (${sgn(rate)}/أسبوع)` : ''}` : '';
  $('h-w').placeholder = S.weights.find(x => x.date === d)?.w ?? 'الوزن (كجم)';
  $('h-steps').placeholder = dd.steps || 'الخطوات';
  $('h-coach').innerHTML = coachTips().map(([i, t]) => `<li><i>${i}</i><span>${t}</span></li>`).join('');
}
// السعرات الفاضلة كرقم كبير، والماكروز بألوان الأطباق
function energyBlock(t, tot) {
  const left = t.kcal - tot.k;
  const m = (v, tg, l, c) => `<div class="stat"><b style="color:var(${c})">${Math.round(v)}</b><span>${l} من ${tg}</span><div class="bar" style="--c:var(${c})"><i style="width:${pct(v, tg)}"></i></div></div>`;
  return `<div class="row" style="align-items:flex-end"><div><div class="energy" style="color:${left < 0 ? 'var(--red)' : 'var(--ink)'}">${Math.abs(left).toLocaleString('en')}</div>
    <div class="mute">${left >= 0 ? 'سعرة فاضلة' : 'سعرة زيادة عن الهدف'}، أكلت ${tot.k} من ${t.kcal}</div></div></div>
    <div class="macros">${m(tot.p, t.pro, 'بروتين', '--blue')}${m(tot.c, t.carb, 'كارب', '--yellow')}${m(tot.f, t.fat, 'دهون', '--green')}</div>`;
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
  const wkW = S.workouts.filter(w => w.date >= weekStart(d));
  const cMin = wkW.reduce((a, w) => a + w.ex.filter(e => isCardio(e.id)).reduce((b, e) => b + e.sets.reduce((c, s) => c + s.r, 0), 0), 0);
  const cK = wkW.reduce((a, w) => a + w.ex.filter(e => isCardio(e.id)).reduce((b, e) => b + e.sets.reduce((c, s) => c + cardioKcal(e.id, s.w, s.r), 0), 0), 0);
  tips.push(['🏃', cMin ? `كارديو الأسبوع ده: ${cMin} دقيقة ≈ ${cK} سعرة. الهدف حوالي 60 دقيقة + خطوات يومية.` : 'مفيش كارديو الأسبوع ده لسه. 20 دقيقة مشي بميل في آخر التمرين بتفرق في التنشيف.']);

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
  if (!S.draft) buildDraft(nextKey());
  const D = S.draft, P = PROGRAM[D.key];
  $('sub').textContent = 'برنامج 5 تمارين بترتيب مرن';
  $('w-tpl').innerHTML = Object.entries(PROGRAM).map(([k, p]) => `<button class="chip ${D.key === k ? 'on' : ''}" onclick="pickTpl('${k}')">${p.name}</button>`).join('')
    + `<button class="chip ${D.key === '' ? 'on' : ''}" onclick="pickTpl('')">حر</button>`;
  $('w-banner').innerHTML = D.deload ? '<div class="banner">🔄 أسبوع خفيف: الأوزان أقل 10% والمجموعات أقل عشان جسمك يستشفى.</div>'
    : D.low ? '<div class="banner warn">😴 جاهزيتك قليلة النهارده، فشِلنا مجموعة من كل تمرين.</div>' : '';
  $('w-title').textContent = D.name;
  $('w-date').value = D.date;
  updateMeta();

  $('w-ex').innerHTML = D.ex.length ? D.ex.map((e, i) => {
    const X = exInfo(e.id);
    return `<div class="ex">
      <div class="ex-h"><div><b>${esc(X.ar)}</b>${X.n !== X.ar ? `<small class="ltr" style="display:block">${esc(X.n)}</small>` : ''}<small>${X.eq ? EQ[X.eq] + '، ' : ''}${X.m === 'cardio' ? `${X.rr[0]} لـ ${X.rr[1]} دقيقة` : `${X.rr[0]} لـ ${X.rr[1]} عدّة، وراحة ${X.rest} ثانية`}</small></div>
        <button class="g" onclick="exSheet(${i})" aria-label="خيارات التمرين">⋯</button></div>
      ${howTo(e.id, i)}
      ${X.m === 'cardio' ? `<div class="target"><span class="tag blue">الهدف: ${e.tr} دقيقة، ${X.wl.split(' ')[0]} ${e.tw}</span><span class="mute">${e.note}</span></div>
      <div class="set head"><span></span><span>السابق</span><span>${X.wl}</span><span>دقايق</span><span>سعرات</span><span></span></div>`
      : `<div class="target"><span class="tag ${e.up ? 'acc' : 'blue'}">الهدف: <b class="ltr">${e.tw !== '' ? e.tw + ' kg × ' : ''}${e.tr}</b></span><span class="mute">${e.note}</span></div>
      <div class="set head"><span></span><span>السابق</span><span>كجم</span><span>عدّات</span><span>RIR</span><span></span></div>`}
      ${e.sets.map((s, j) => `<div class="set ${s.ok ? 'done' : ''}">
        <span class="n">${j + 1}</span>
        <span class="prev">${prevSet(e.id, j)}</span>
        <input type="number" step="0.5" inputmode="decimal" value="${s.w}" onchange="setVal(${i},${j},'w',this.value)">
        <input type="number" inputmode="numeric" value="${s.r}" onchange="setVal(${i},${j},'r',this.value)">
        ${X.m === 'cardio' ? `<span class="rir kc">${cardioKcal(e.id, s.w, s.r)}</span>` : `<button class="rir" onclick="cycleRir(${i},${j})">${s.rir == null ? '—' : s.rir === 3 ? '3+' : s.rir}</button>`}
        <button class="tick" onclick="tick(${i},${j})" aria-label="المجموعة ${j + 1} خلصت">✓</button>
      </div>`).join('')}
      <div class="row"><button class="g sm fit" onclick="addSet(${i})">+ مجموعة</button><button class="g sm fit" onclick="rmSet(${i})">− مجموعة</button></div>
    </div>`;
  }).join('') : '<p class="mute" style="margin:0">اختار يوم من فوق أو ضيف تمارين بنفسك.</p>';

  $('w-hist').innerHTML = S.workouts.slice(-20).reverse().map(w => {
    const sets = w.ex.reduce((a, e) => a + e.sets.length, 0);
    return `<li onclick="histSheet('${w.id}')" style="cursor:pointer"><div><b>${esc(w.name)}</b>${w.deload ? ' <span class="tag blue">Deload</span>' : ''}${w.prs ? ` <span class="tag acc">🏆 ${w.prs}</span>` : ''}
      <div class="mute">${fmtDay(w.date)}، ${w.ex.length} تمارين و${sets} مجموعة${w.dur ? ` في ${w.dur} دقيقة` : ''}</div></div><span class="mute" aria-hidden="true">‹</span></li>`;
  }).join('') || '<li class="mute">لسه مفيش تمارين متسجلة</li>';
}
// عمود "السابق": نفس المجموعة من آخر مرة (فكرة من Hevy)
function prevSet(id, j) {
  const L = lastSession(id); if (!L) return '—';
  const s = L.sets[j]; if (!s) return '—';
  return isCardio(id) ? `${s.r}د` : `${s.w}×${s.r}`;
}
const openHow = new Set();
function howTo(id, i) {
  const X = exInfo(id), img = EX[resolveId(id)] && !X.custom;
  return `<details class="how" ${openHow.has(id) ? 'open' : ''} ontoggle="this.open?openHow.add('${id}'):openHow.delete('${id}')">
    <summary>طريقة الأداء</summary>
    ${img ? `<div class="how-img"><img src="img/${resolveId(id)}-0.jpg" alt="بداية الحركة" loading="lazy" onerror="this.parentNode.remove()"><img src="img/${resolveId(id)}-1.jpg" alt="نهاية الحركة" loading="lazy" onerror="this.remove()"></div>` : ''}
    <ol>${X.steps.map(s => `<li>${s}</li>`).join('')}</ol>
    <div class="banner" style="margin:8px 0 0">💡 ${X.cue}</div>
  </details>`;
}
function updateMeta() {
  const D = S.draft; if (!D) return;
  const all = D.ex.reduce((a, e) => a + e.sets.length, 0), ok = D.ex.reduce((a, e) => a + e.sets.filter(s => s.ok).length, 0);
  const mins = draftActive() ? Math.round((Date.now() - D.start) / 6e4) : 0;
  const P = PROGRAM[D.key];
  $('w-meta').textContent = `${P ? P.ar.replace(/ · /g, '، ') + '. ' : ''}${ok} من ${all} مجموعة${mins ? `، ${mins} دقيقة` : ''}`;
  const slots = 8;
  $('w-bar').innerHTML = barbell('work', all ? Math.round(ok / all * slots) : 0, slots);
}
setInterval(() => view === 'work' && updateMeta(), 20000);
function syncHead() { if (S.draft) { S.draft.date = $('w-date').value || today(); save(); } }
function setVal(i, j, f, v) { S.draft.ex[i].sets[j][f] = v === '' ? '' : +v; save(); if (isCardio(S.draft.ex[i].id)) renderWork(); }
function cycleRir(i, j) { const s = S.draft.ex[i].sets[j]; s.rir = s.rir == null ? 3 : s.rir === 0 ? null : s.rir - 1; save(); vib(5); renderWork(); }
function tick(i, j) {
  const e = S.draft.ex[i], s = e.sets[j];
  if (!s.ok && !(+s.r > 0)) return toast('اكتب العدّات الأول');
  if (!s.ok && !draftActive()) S.draft.start = Date.now();
  s.ok = !s.ok;
  if (s.ok) {
    // الوزن والعدّات بيتنقلوا للمجموعة الجاية لو لسه متعملتش
    const nx = e.sets[j + 1]; if (nx && !nx.ok) { nx.w = s.w; }
    if (!isCardio(e.id)) startRest(exInfo(e.id).rest); vib(15);
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
  const lift = ex.filter(e => !isCardio(e.id)), cardio = ex.filter(e => isCardio(e.id));
  const sets = lift.reduce((a, e) => a + e.sets.length, 0), vol = lift.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);
  const cMin = cardio.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.r, 0), 0), cKcal = cardio.reduce((a, e) => a + e.sets.reduce((b, s) => b + cardioKcal(e.id, s.w, s.r), 0), 0);
  openSheet(`<div class="grip"></div><h3>عاش! 💪 ${esc(w.name)}</h3><p class="mute" style="margin:0 0 12px">${fmtDay(w.date)}</p>
    <div class="grid3"><div class="stat"><b>${sets}</b><span>مجموعة</span></div><div class="stat"><b>${Math.round(vol)}</b><span>كجم حجم</span></div><div class="stat"><b>${w.dur || '—'}</b><span>دقيقة</span></div></div>
    ${cMin ? `<div class="banner" style="margin:12px 0 0">🏃 كارديو: ${cMin} دقيقة ≈ ${cKcal} سعرة محروقة</div>` : ''}
    ${prs.length ? `<div class="card" style="margin:14px 0 0"><h2>🏆 أرقام قياسية جديدة</h2>${prs.map(e => `<div>${esc(exInfo(e.id).ar)}</div>`).join('')}</div>` : ''}
    <button class="p w" style="margin-top:14px" onclick="closeSheet();go('home')">تمام</button>`);
}

// شيت تفاصيل التمرين: الشرح، السجل، والتبديل
function exSheet(i) {
  const e = S.draft.ex[i], X = exInfo(e.id);
  const hist = S.workouts.filter(w => w.ex.some(x => x.id === e.id)).slice(-4).reverse();
  const alts = Object.entries(EX).filter(([id, x]) => x.m && x.m === X.m && id !== e.id && !S.draft.ex.some(y => y.id === id));
  openSheet(`<div class="grip"></div><h3>${esc(X.ar)}</h3><p class="mute" style="margin:0 0 10px">${esc(X.n)}${X.m ? ` · ${(MUSCLES[X.m] || 'كارديو')}` : ''}${(X.sec || []).length ? ' + ' + X.sec.map(m => MUSCLES[m]).join('، ') : ''}</p>
    ${howTo(e.id, i).replace('<details class="how"', '<details class="how" open')}
    <h2 class="mute" style="font-size:13px;margin:12px 0 4px">آخر مرات</h2>
    <ul class="list">${hist.map(w => { const x = w.ex.find(y => y.id === e.id); return `<li><span class="mute">${fmtShort(w.date)}</span><span class="ltr">${isCardio(e.id) ? x.sets.map(s => `${s.r} د`).join('  ') : x.sets.map(s => `${s.w}×${s.r}`).join('  ')}</span></li>`; }).join('') || '<li class="mute">لسه</li>'}</ul>
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
  for (const m of [...Object.keys(MUSCLES), 'cardio']) {
    const g = items.filter(([, x]) => x.m === m);
    if (g.length) h += `<div class="mute" style="margin:10px 0 2px">${MUSCLES[m] || 'كارديو'}</div>` + g.map(([id, x]) => `<div class="food-it" onclick="pickEx('${id}')"><span>${esc(x.ar)} <span class="tag">${EQ[x.eq]}</span></span><span class="mute ltr">${esc(x.n)}</span></div>`).join('');
  }
  if (q) h += `<button class="w" style="margin-top:10px" onclick="pickEx('x:'+$('pk-q').value.trim())">+ ضيف "${esc($('pk-q').value.trim())}" كتمرين جديد</button>`;
  $('pk-l').innerHTML = h;
}
function pickEx(id) { S.draft.ex.push(makeEx(resolveId(id), 3, S.draft.deload, S.draft.low)); save(); closeSheet(); renderWork(); }

function histSheet(id) {
  const w = S.workouts.find(x => x.id === id);
  openSheet(`<div class="grip"></div><h3>${esc(w.name)}</h3><p class="mute" style="margin:0 0 10px">${fmtDay(w.date)}${w.dur ? ` · ${w.dur} دقيقة` : ''}</p>
    <ul class="list">${w.ex.map(e => `<li><span>${esc(exInfo(e.id).ar)}</span><span class="ltr mute">${isCardio(e.id) ? e.sets.map(s => `${s.r} د · ${cardioKcal(e.id, s.w, s.r)} سعرة`).join('  ') : e.sets.map(s => `${s.w}×${s.r}`).join('  ')}</span></li>`).join('')}</ul>
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
// كل القيم لكل 100 جم. عنصر الوجبة: {id, q, u} و u = -1 يعني جرامات، وأي رقم تاني يعني رقم الحصة (بيضة، رغيف، كوباية…)
// أو {c:{n,k,p,c,f}} لإدخال يدوي قديم
const foodById = id => FOODS.find(f => f.id === id) || (S.myFoods || []).find(f => f.id === id);
const normAr = s => String(s || '').toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();
const macrosOf = (f, g) => { const m = g / 100; return { k: Math.round(f.k * m), p: num(f.p * m), c: num(f.c * m), f: num(f.f * m) }; };
const gramsOf = it => { const f = foodById(it.id); return it.u >= 0 && f.por[it.u] ? it.q * f.por[it.u][1] : it.q; };
const unitName = (f, u) => u >= 0 && f.por[u] ? f.por[u][0] : 'جم';
const itemMacros = it => it.c ? { k: +it.c.k || 0, p: +it.c.p || 0, c: +it.c.c || 0, f: +it.c.f || 0 } : foodById(it.id) ? macrosOf(foodById(it.id), gramsOf(it)) : { k: 0, p: 0, c: 0, f: 0 };
const itemName = it => { if (it.c) return it.c.n; const f = foodById(it.id); return f ? `${f.n} (${num(it.q)} ${unitName(f, it.u)})` : '؟'; };
const sumMacros = items => items.map(itemMacros).reduce((a, m) => ({ k: a.k + m.k, p: num(a.p + m.p), c: num(a.c + m.c), f: num(a.f + m.f) }), { k: 0, p: 0, c: 0, f: 0 });
const toItem = ([id, q, u]) => ({ id, q, u: u ?? -1 });
const planItems = pm => pm.items.map(toItem);
const planName = pm => planItems(pm).map(itemName).join(' + ');
const fDate = () => $('f-date').value || today();
function shiftDay(n) { $('f-date').value = addDays(fDate(), n); renderFood(); }
function defaultSlot() { const h = new Date().getHours(); return h < 11 ? 'b' : h < 17 ? 'l' : h < 22 ? 'd' : 's'; }

function renderFood() {
  if (!$('f-date').value) $('f-date').value = today();
  const d = fDate(), t = targets(), tot = mealTotals(d);
  $('sub').textContent = d === today() ? 'النهارده' : fmtDay(d);
  $('f-macro').innerHTML = energyBlock(t, tot);
  $('f-sugg').innerHTML = foodSuggestion(d, t, tot);

  const seen = new Set(), recent = [];
  for (let i = S.meals.length - 1; i >= 0 && recent.length < 10; i--) { const m = S.meals[i]; if (!seen.has(m.name)) { seen.add(m.name); recent.push(i); } }
  $('f-quick').innerHTML = recent.map(i => { const n = S.meals[i].name; return `<button class="chip" onclick="reAdd(${i})">+ ${esc(n.length > 30 ? n.slice(0, 28) + '…' : n)}</button>`; }).join('');

  const eaten = new Set(S.meals.filter(m => m.date === d).map(m => m.name));
  const all = MEAL_PLAN.reduce((a, pm) => { const m = sumMacros(planItems(pm)); return { k: a.k + m.k, p: a.p + m.p }; }, { k: 0, p: 0 });
  $('f-plan-t').textContent = `حوالي ${all.k} سعرة`;
  $('f-plan').innerHTML = MEAL_PLAN.map((pm, i) => {
    const m = sumMacros(planItems(pm)), n = planName(pm), on = eaten.has(n);
    return `<li><div><b>${pm.t}</b><div class="mute">${esc(n)}</div><div class="mute">${m.k} سعرة و${Math.round(m.p)} جم بروتين</div></div>
      <div class="row fit" style="gap:6px"><button class="sm" onclick="editPlan(${i})">عدّل</button>
      <button class="sm ${on ? 'p' : ''}" onclick="planMeal(${i})" aria-label="${on ? 'إلغاء' : 'سجّل'}">${on ? '✓' : '+'}</button></div></li>`;
  }).join('');

  // كل وجبة ليها زرار إضافة مباشر (فكرة من MacroFactor)
  const list = S.meals.filter(m => m.date === d);
  $('f-list').innerHTML = Object.keys(SLOTS).map(sl => {
    const g = list.filter(m => m.slot === sl), st = g.reduce((a, m) => a + m.k, 0);
    return `<div class="slot-h"><b>${SLOTS[sl]}${st ? ` <span class="mute" style="font-weight:400">${st} سعرة</span>` : ''}</b>
      <button class="sm" onclick="openBuilder([], '${sl}')">+ أضف</button></div>
      <ul class="list">${g.map(m => `<li><div onclick="editMeal('${m.id}')" style="cursor:pointer;flex:1"><div style="font-weight:500">${esc(m.name)}</div>
        <div class="mute">${m.k} سعرة، بروتين ${num(m.p)}، كارب ${num(m.c)}، دهون ${num(m.f)}</div></div>
        <button class="g del" onclick="rmMeal('${m.id}')" aria-label="احذف الوجبة">✕</button></li>`).join('')}</ul>`;
  }).join('');
}

// اقتراح مرن مش قيد: بيقولك فاضلك قد إيه ويقترح حاجة رخيصة، والقرار ليك
function foodSuggestion(d, t, tot) {
  const left = t.kcal - tot.k, pLeft = t.pro - tot.p;
  const days = [...Array(7)].map((_, i) => addDays(d, -i)).filter(x => S.meals.some(m => m.date === x));
  const avg = days.length >= 3 ? Math.round(days.reduce((a, x) => a + mealTotals(x).k, 0) / days.length) : null;
  const avgLine = avg ? `<p class="mute" style="margin:8px 0 0">متوسطك آخر ${days.length} أيام: <b>${avg}</b> سعرة من ${t.kcal}. المتوسط أهم من يوم لوحده.</p>` : '';
  if (!tot.k) return `<p style="margin:0">ابدأ يومك بوجبة فيها بروتين. سجّل الفطار من النظام تحت، أو اكتب اللي أكلته بنفسك.</p>${avgLine}`;
  if (left < -150) return `<p style="margin:0">عدّيت هدفك بـ <b>${-left}</b> سعرة. مش مشكلة، يوم واحد مش هيفرق، والمهم المتوسط على الأسبوع.</p>${avgLine}`;
  if (left <= 150) return `<p style="margin:0">👌 وصلت لهدفك النهارده${pLeft > 15 ? `، بس فاضلك ${Math.round(pLeft)} جم بروتين. اختار حاجة خفيفة زي علبة زبادي يوناني أو قريش.` : '.'}</p>${avgLine}`;
  let picks = [];
  if (pLeft > 15) picks = PROTEIN_PICKS.map(toItem).map(it => ({ it, m: itemMacros(it) })).filter(x => x.m.k <= left + 50).sort((a, b) => b.m.p / b.m.k - a.m.p / a.m.k).slice(0, 3);
  return `<p style="margin:0">فاضلك <b>${left}</b> سعرة${pLeft > 0 ? ` و<b class="blue">${Math.round(pLeft)}</b> جم بروتين` : ''}. كُل اللي تحبه${picks.length ? '، ولو محتار دي اقتراحات رخيصة غنية بالبروتين:' : '.'}</p>
    ${picks.length ? `<div class="chips" style="margin-top:10px;flex-wrap:wrap">${picks.map(x => `<button class="chip" onclick='quickItem(${JSON.stringify(x.it)})'>+ ${esc(itemName(x.it))}: ${x.m.k} سعرة و${x.m.p} جم بروتين</button>`).join('')}</div>` : ''}${avgLine}`;
}

function addMealEntry(o) { S.meals.push({ id: uid(), date: fDate(), ...o }); save(); vib(10); }
function entryFromItems(items, slot) { return { slot, items, name: items.map(itemName).join(' + '), ...sumMacros(items) }; }
function planMeal(i) {
  const pm = MEAL_PLAN[i], n = planName(pm), d = fDate();
  const had = S.meals.find(m => m.date === d && m.name === n);
  if (had) { S.meals = S.meals.filter(m => m !== had); save(); }
  else { addMealEntry(entryFromItems(planItems(pm), pm.slot)); toast('اتسجّلت ✓'); }
  renderFood();
}
function editPlan(i) { const pm = MEAL_PLAN[i]; openBuilder(planItems(pm), pm.slot, null); }
function quickItem(it) { addMealEntry(entryFromItems([it], defaultSlot())); toast('اتسجّل ✓'); renderFood(); }
function reAdd(idx) {
  const m = S.meals[idx];
  addMealEntry({ slot: defaultSlot(), name: m.name, k: m.k, p: m.p, c: m.c, f: m.f, ...(m.items ? { items: m.items } : {}) });
  toast('اتسجّل ✓'); renderFood();
}
function editMeal(id) {
  const m = S.meals.find(x => x.id === id);
  openBuilder(m.items ? structuredClone(m.items) : [{ c: { n: m.name, k: m.k, p: m.p, c: m.c, f: m.f } }], m.slot, id);
}
function rmMeal(id) { S.meals = S.meals.filter(m => m.id !== id); save(); renderFood(); }

// ===== شيت تسجيل وجبة =====
const FB = { items: [], slot: 'b', edit: null, cat: '' };
function openBuilder(items = [], slot = defaultSlot(), edit = null) {
  Object.assign(FB, { items: items.map(x => ({ ...x })), slot, edit, cat: '' });
  openSheet(`<div class="grip"></div><h3>${edit ? 'تعديل الوجبة' : 'سجّل وجبة'}</h3>
    <div class="chips" id="fb-slot" style="margin:10px 0"></div>
    <div id="fb-items"></div>
    <div class="card" style="margin:10px 0;background:var(--card2);padding:12px" id="fb-tot"></div>
    <button class="p w" style="padding:14px" id="fb-save" onclick="saveBuilder()"></button>
    <div class="row" style="margin-top:14px">
      <input id="fb-q" type="search" placeholder="ابحث: طماطم، فراخ، كشري… أو رقم الباركود" oninput="renderFbList()">
      ${'BarcodeDetector' in window ? '<button class="fit" onclick="scanBarcode()" aria-label="امسح باركود">📷</button>' : ''}
    </div>
    <div id="fb-scan"></div>
    <div class="chips" id="fb-cats" style="margin:10px 0 4px"></div>
    <div id="fb-list" style="max-height:40vh;overflow:auto"></div>
    <details id="fb-new" style="margin-top:12px"><summary class="mute">صنف مش موجود؟ ضيفه لـ"أكلاتي" مرة واحدة</summary>
      <input id="fm-n" placeholder="اسم الأكل" style="margin:8px 0">
      <div class="row" style="margin-bottom:8px"><label class="fit" style="margin:0">القيم دي لكل</label>
        <select id="fm-per"><option value="100">100 جم</option><option value="1">حصة واحدة</option></select></div>
      <div class="grid4"><div><label>سعرات</label><input type="number" id="fm-k"></div><div><label>بروتين</label><input type="number" id="fm-p"></div><div><label>كارب</label><input type="number" id="fm-c"></div><div><label>دهون</label><input type="number" id="fm-f"></div></div>
      <button class="w" style="margin-top:8px" onclick="addMyFood()">احفظ وضيفه للوجبة</button>
    </details>
    ${edit ? `<button class="g w del" style="margin-top:6px" onclick="rmMeal('${edit}');closeSheet()">حذف الوجبة</button>` : ''}`);
  renderBuilder();
}
function renderBuilder() {
  $('fb-slot').innerHTML = Object.entries(SLOTS).map(([k, l]) => `<button class="chip ${FB.slot === k ? 'on' : ''}" onclick="FB.slot='${k}';renderBuilder()">${l}</button>`).join('');
  $('fb-items').innerHTML = FB.items.map((it, i) => {
    const m = itemMacros(it);
    if (it.c || !foodById(it.id)) return `<div class="fb-it"><div style="flex:1"><b>${esc(itemName(it))}</b><div class="mute">${m.k} سعرة · بروتين ${m.p}</div></div><button class="g del" onclick="fbRm(${i})" aria-label="شيل">✕</button></div>`;
    const f = foodById(it.id), step = it.u >= 0 ? 1 : 25;
    return `<div class="fb-it"><div style="flex:1;min-width:0"><b>${esc(f.n)}</b><div class="mute" id="fb-m${i}">${m.k} سعرة · بروتين ${m.p} · ${Math.round(gramsOf(it))} جم</div></div>
      <div class="stepper"><button onclick="fbQ(${i},-${step})" aria-label="أقل">−</button><input type="number" inputmode="decimal" value="${num(it.q)}" oninput="fbSet(${i},this.value)"><button onclick="fbQ(${i},${step})" aria-label="أكتر">+</button></div>
      <select class="unit" onchange="fbU(${i},+this.value)" aria-label="الوحدة">${f.por.map((p, j) => `<option value="${j}" ${it.u === j ? 'selected' : ''}>${esc(p[0])}</option>`).join('')}<option value="-1" ${it.u < 0 ? 'selected' : ''}>جم</option></select>
      <button class="g del" onclick="fbRm(${i})" aria-label="شيل">✕</button></div>`;
  }).join('') || '<p class="mute" style="margin:6px 0">ابحث تحت وضيف كل حاجة أكلتها، وظبّط الكمية بالحصة أو بالجرام.</p>';
  $('fb-cats').innerHTML = [['', 'الكل'], ['my', 'أكلاتي'], ...Object.entries(FOOD_CATS)].map(([k, l]) => `<button class="chip ${FB.cat === k ? 'on' : ''}" onclick="FB.cat='${k}';renderBuilder()">${l}</button>`).join('');
  renderFbTot(); renderFbList();
}
function renderFbTot() {
  const s = sumMacros(FB.items);
  const c = (v, l, cl) => `<div class="stat"><b class="${cl}" style="text-align:center">${Math.round(v)}</b><span>${l}</span></div>`;
  $('fb-tot').innerHTML = `<div class="grid4" style="text-align:center">${c(s.k, 'سعرة', 'acc')}${c(s.p, 'بروتين', 'blue')}${c(s.c, 'كارب', 'amber')}${c(s.f, 'دهون', 'pink')}</div>`;
  $('fb-save').textContent = FB.items.length ? `${FB.edit ? 'احفظ التعديل' : 'سجّل الوجبة'} · ${s.k} سعرة` : 'ضيف أكل الأول';
}
function foodRow(f) {
  const hint = f.por[0] ? `، ${esc(f.por[0][0])} = ${Math.round(f.k * f.por[0][1] / 100)} سعرة` : '';
  return `<div class="food-it" onclick="fbAdd('${f.id}')"><div><div>${esc(f.n)}${f.src ? ` <span class="tag">${f.src}</span>` : ''}</div><div class="mute" style="font-size:12px">${f.k} سعرة و${f.p} جم بروتين لكل 100 جم${hint}</div></div><b class="acc" style="font-size:20px">+</b></div>`;
}
function renderFbList() {
  const raw = ($('fb-q').value || '').trim(), q = normAr(raw), my = S.myFoods || [];
  let h = '';
  if (/^\d{8,14}$/.test(raw)) { $('fb-list').innerHTML = `<button class="w" onclick="lookupBarcode('${raw}')">🔎 دوّر على الباركود ${raw}</button>`; return; }
  if (q) {
    const scored = [...my, ...FOODS].map(f => {
      const n = normAr(f.n), a = normAr(f.al);
      const s = n.startsWith(q) ? 3 : n.includes(q) ? 2 : a.split(' ').some(w => w.startsWith(q)) ? 1.5 : a.includes(q) ? 1 : 0;
      return [s, f];
    }).filter(x => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 40);
    h = scored.map(x => foodRow(x[1])).join('');
    h += `<button class="w" style="margin-top:10px" onclick="searchOnline()">🌐 ${scored.length ? 'مش لاقي اللي عايزه؟ ' : ''}دوّر أونلاين على "${esc(raw)}"</button><div id="fb-online"></div>`;
    if (!scored.length) h = '<p class="mute">مش لاقيه في القائمة. دوّر أونلاين (للمنتجات المعبّأة) أو ضيفه لـ"أكلاتي" تحت.</p>' + h;
  } else if (FB.cat === 'my') {
    h = my.map(foodRow).join('') || '<p class="mute">لسه مضفتش أكلات خاصة بيك. ضيف من تحت، أو دوّر أونلاين وهتتحفظ هنا.</p>';
  } else if (FB.cat) {
    h = FOODS.filter(f => f.cat === FB.cat).map(foodRow).join('');
  } else {
    const used = [], seen = new Set();
    for (let i = S.meals.length - 1; i >= 0 && used.length < 10; i--) (S.meals[i].items || []).forEach(it => { if (it.id && !seen.has(it.id) && foodById(it.id)) { seen.add(it.id); used.push(foodById(it.id)); } });
    h = (used.length ? `<div class="mute" style="margin:6px 0 2px">استخدمتهم قريب</div>${used.map(foodRow).join('')}<div class="mute" style="margin:12px 0 2px">كل الأكل (${FOODS.length + my.length} صنف)</div>` : '')
      + [...my, ...FOODS].filter(f => !seen.has(f.id)).slice(0, 60).map(foodRow).join('');
  }
  $('fb-list').innerHTML = h;
}
function fbAdd(id) {
  const f = foodById(id), ex = FB.items.find(x => x.id === id);
  if (ex) ex.q = num(ex.q + (ex.u >= 0 ? 1 : 50));
  else FB.items.push(f.por.length ? { id, q: 1, u: 0 } : { id, q: 100, u: -1 });
  $('fb-q').value = ''; vib(8); renderBuilder(); $('sheet-c').scrollTo({ top: 0, behavior: 'smooth' });
}
function fbQ(i, d) { const it = FB.items[i]; it.q = Math.max(0, num(it.q + d)); renderBuilder(); }
function fbSet(i, v) { const it = FB.items[i]; it.q = +v || 0; const m = itemMacros(it); $('fb-m' + i).textContent = `${m.k} سعرة · بروتين ${m.p} · ${Math.round(gramsOf(it))} جم`; renderFbTot(); }
function fbU(i, u) { const it = FB.items[i], g = gramsOf(it), f = foodById(it.id); it.u = u; it.q = u < 0 ? Math.round(g) : num(Math.max(0.5, g / f.por[u][1])); renderBuilder(); }
function fbRm(i) { FB.items.splice(i, 1); renderBuilder(); }
function addMyFood() {
  const n = $('fm-n').value.trim(), k = +$('fm-k').value;
  if (!n || !$('fm-k').value) return toast('اكتب الاسم والسعرات');
  const per = +$('fm-per').value, f = { id: 'my:' + uid(), n, al: '', cat: 'my', k, p: +$('fm-p').value || 0, c: +$('fm-c').value || 0, f: +$('fm-f').value || 0, por: per === 1 ? [['حصة', 100]] : [], src: 'أكلاتي' };
  S.myFoods = [f, ...(S.myFoods || [])]; save();
  ['n', 'k', 'p', 'c', 'f'].forEach(x => $('fm-' + x).value = '');
  $('fb-new').open = false; fbAdd(f.id); toast('اتحفظ في أكلاتي ✓');
}
function saveBuilder() {
  const items = FB.items.filter(it => it.c || it.q > 0);
  if (!items.length) return toast('ضيف أكل الأول');
  const e = entryFromItems(items, FB.slot);
  if (FB.edit) { Object.assign(S.meals.find(m => m.id === FB.edit), e); save(); }
  else addMealEntry(e);
  closeSheet(); toast(FB.edit ? 'اتعدّلت ✓' : 'اتسجّلت ✓'); renderFood();
}

// ===== البحث أونلاين والباركود (Open Food Facts: قاعدة بيانات مفتوحة ومجانية) =====
const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_ar,brands,nutriments,serving_quantity';
function offToFood(p) {
  const n = p.nutriments || {}, k = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
  if (k == null) return null;
  const name = [p.product_name_ar || p.product_name, p.brands && p.brands.split(',')[0]].filter(Boolean).join(' - ');
  if (!name) return null;
  const sq = parseFloat(p.serving_quantity);
  return { id: 'off:' + p.code, n: name, al: '', cat: 'my', k: Math.round(k), p: num(n.proteins_100g || 0), c: num(n.carbohydrates_100g || 0), f: num(n.fat_100g || 0), por: sq > 0 ? [['حصة', sq]] : [], src: 'أونلاين' };
}
function keepFood(f) { if (!foodById(f.id)) { S.myFoods = [f, ...(S.myFoods || [])]; save(); } }
let offResults = [];
async function searchOnline() {
  const q = $('fb-q').value.trim(), box = $('fb-online');
  if (!q) return;
  if (!navigator.onLine) { box.innerHTML = '<p class="mute">محتاج نت عشان البحث أونلاين.</p>'; return; }
  box.innerHTML = '<p class="mute">بدوّر…</p>';
  try {
    const r = await fetch(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`);
    offResults = ((await r.json()).products || []).map(offToFood).filter(Boolean);
    box.innerHTML = offResults.length ? '<div class="mute" style="margin:10px 0 2px">نتايج أونلاين (القيم لكل 100 جم من على العبوة)</div>' +
      offResults.map((f, i) => `<div class="food-it" onclick="pickOnline(${i})"><div><div>${esc(f.n)}</div><div class="mute" style="font-size:12px">${f.k} سعرة و${f.p} جم بروتين لكل 100 جم</div></div><b class="acc" style="font-size:20px">+</b></div>`).join('')
      : '<p class="mute">ملقتش نتايج. جرّب اسم تاني أو بالإنجليزي، أو ضيفه بنفسك.</p>';
  } catch { box.innerHTML = '<p class="mute">البحث مش شغال دلوقتي. جرّب تاني بعد شوية.</p>'; }
}
function pickOnline(i) { const f = offResults[i]; keepFood(f); fbAdd(f.id); }
async function lookupBarcode(code) {
  const box = $('fb-list');
  box.innerHTML = '<p class="mute">بدوّر على المنتج…</p>';
  try {
    const r = await (await fetch(`${OFF}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`)).json();
    const f = r.status === 1 && offToFood({ ...r.product, code });
    if (!f) { box.innerHTML = '<p class="mute">المنتج ده مش موجود أو ملوش قيم غذائية. ضيفه بنفسك من تحت.</p>'; return; }
    keepFood(f); fbAdd(f.id); toast(`لقيته: ${f.n}`);
  } catch { box.innerHTML = '<p class="mute">محتاج نت عشان تدوّر بالباركود.</p>'; }
}
let scanStream = null;
async function scanBarcode() {
  const box = $('fb-scan');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    box.innerHTML = '<div style="position:relative;margin-top:10px"><video id="fb-vid" playsinline muted style="width:100%;border-radius:14px"></video><button class="sm" style="position:absolute;top:8px;left:8px" onclick="stopScan()">✕</button></div>';
    const v = $('fb-vid'); v.srcObject = scanStream; await v.play();
    const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    const loop = async () => {
      if (!scanStream) return;
      try { const c = await det.detect(v); if (c.length) { const code = c[0].rawValue; stopScan(); vib(40); $('fb-q').value = code; return lookupBarcode(code); } } catch {}
      requestAnimationFrame(loop);
    };
    loop();
  } catch { toast('مقدرتش أفتح الكاميرا. اكتب رقم الباركود بدالها.'); }
}
function stopScan() { if (scanStream) scanStream.getTracks().forEach(t => t.stop()); scanStream = null; const b = $('fb-scan'); if (b) b.innerHTML = ''; }

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
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--blue)" stop-opacity=".22"/><stop offset="1" style="stop-color:var(--blue)" stop-opacity="0"/></linearGradient></defs>
    ${[hi, lo].map(v => `<line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)" stroke-dasharray="3 4"/><text x="0" y="${y(v) + 4}" style="fill:var(--ink-3)" font-size="10">${num(v)}</text>`).join('')}
    <path d="${path}L${x(L.d)},${H - P}L${x(main[0].d)},${H - P}Z" fill="url(#g)"/>
    ${trend ? pts.map(p => `<circle cx="${x(p.d)}" cy="${y(p.y)}" r="2.5" style="fill:var(--ink-3)" opacity=".7"/>`).join('') : ''}
    <path d="${path}" fill="none" style="stroke:var(--blue)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(L.d)}" cy="${y(L.y)}" r="4.5" style="fill:var(--blue)"/>
    <text x="${P}" y="${H - 6}" style="fill:var(--ink-3)" font-size="10">${pts[0].d.slice(5)}</text>
    <text x="${W - P}" y="${H - 6}" style="fill:var(--ink-3)" font-size="10" text-anchor="end">${pts.at(-1).d.slice(5)} · ${num(L.y)}</text>
  </svg>`;
}
function renderProg() {
  $('sub').textContent = 'البيانات بتقول إيه';
  const ts = trendSeries(), rate = weeklyRate(), goalR = GOALS[S.profile.goal].r;
  $('p-w').textContent = ts.length ? num(ts.at(-1).t) : S.profile.w;
  $('p-rate').textContent = rate == null ? '—' : sgn(rate);
  $('p-rate').style.color = rate == null ? '' : Math.abs(rate - goalR * curWeight()) < 0.25 ? 'var(--acc)' : 'var(--amber)';
  $('p-n').textContent = S.workouts.filter(w => w.date >= weekStart(today())).length + '/5';
  const ex = expenditure(), tg = targets();
  $('p-tdee').innerHTML = ex.need
    ? `<p style="margin:0">عشان أحسب حرقك الحقيقي، محتاج <b>10 أيام أكل متسجل</b> و<b>8 مرات وزن</b> خلال 4 أسابيع.</p>
       <p class="mute" style="margin:6px 0 0">عندك دلوقتي ${ex.days} يوم أكل و${ex.weighs} مرة وزن. وده أدق بكتير من أي معادلة.</p>`
    : `<div class="energy">${ex.tdee.toLocaleString('en')}</div><div class="mute">سعرة في اليوم حرقك الفعلي. المعادلة كانت متوقعة ${r50(tg.tdee).toLocaleString('en')}، ومتوسط أكلك ${ex.avgIn.toLocaleString('en')}.</div>
       ${Math.abs(ex.tdee - tg.tdee) >= 150 ? `<button class="p w" style="margin-top:12px" onclick="applyTdee(${ex.tdee})">ظبّط هدفي على الحرق الفعلي (${r50(ex.tdee * (1 + GOALS[S.profile.goal].d))} سعرة)</button>` : '<p class="mute" style="margin:8px 0 0">هدفك مظبوط على حرقك الفعلي.</p>'}`;
  $('p-wchart').innerHTML = lineChart(ts.map(p => ({ d: p.d, y: p.y })), ts.map(p => ({ d: p.d, y: p.t })));

  const v = weeklyVolume(), scale = 30;
  $('p-vol').innerHTML = Object.keys(MUSCLES).map(m => {
    const [lo, hi] = VOLUME[m], val = v[m], cls = val < lo ? 'low' : val > hi * 1.15 ? 'hi' : '';
    return `<div class="vol"><span>${MUSCLES[m]}${FOCUS.includes(m) ? ' ★' : ''}</span>
      <div class="track"><div class="band" style="right:${lo / scale * 100}%;width:${(hi - lo) / scale * 100}%"></div><div class="fill ${cls}" style="width:${Math.min(100, val / scale * 100)}%"></div></div>
      <b class="ltr" style="font-weight:600">${num(val)}</b></div>`;
  }).join('');

  const ids = [...new Set(S.workouts.flatMap(w => w.ex.map(e => e.id)))].filter(id => !isCardio(id));
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
function closeSheet() { if (typeof stopScan === 'function') stopScan(); $('sheet').close(); }

$('sheet').addEventListener('close', () => stopScan());
go('home');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
