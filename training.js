// ================= تحسينات التمرين =================
// الشاشة تفضل صاحية، التمرين الحالي واضح واللي خلص بيتقفل، ملاحظات لكل تمرين، تظبيط الوزن أثناء التمرين،
// تعديل تمرين قديم، تمرين مختصر لو الوقت ضيق، حاسبة أطباق البار، وحفظ التعديلات في البرنامج

// ===== 1) الشاشة متقفلش أثناء التمرين (Screen Wake Lock) =====
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && S.profile.wake !== false) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && view === 'work' && draftActive()) keepAwake(true); });

// ===== 2) التمرين الحالي والتمارين اللي خلصت =====
const exDone = e => e.sets.length && e.sets.every(s => s.ok);
const expanded = new Set();
function currentIdx() { return S.draft ? S.draft.ex.findIndex(e => !exDone(e)) : -1; }
function doneSummary(e) {
  return isCardio(e.id) ? e.sets.map(s => `${s.r} دقيقة`).join('، ') : e.sets.map(s => `${s.w}×${s.r}`).join('، ');
}
function scrollToCurrent() {
  const i = currentIdx(); if (i < 0) return;
  const el = document.querySelectorAll('#w-ex .ex')[i];
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
}

// ===== 3) ملاحظات لكل تمرين (رقم الكرسي، المسكة…) =====
function exNote(id) { return (S.exNotes || {})[id] || ''; }
function saveExNote(id, v) { S.exNotes = S.exNotes || {}; v = v.trim(); if (v) S.exNotes[id] = v; else delete S.exNotes[id]; save(); }

// ===== 4) تظبيط الوزن أثناء التمرين (Autoregulation) =====
// بعد كل مجموعة: لو كانت سهلة جدًا نزوّد، ولو صعبة زيادة نقلّل، للمجموعة الجاية بس
function autoregulate(e, j) {
  const s = e.sets[j], nx = e.sets[j + 1], X = exInfo(e.id);
  if (!nx || nx.ok || isCardio(e.id) || !(+s.w > 0)) return null;
  const [lo, hi] = X.rr, inc = X.inc || 0;
  nx.w = s.w;
  if (inc && ((s.rir != null && s.rir >= 3 && s.r >= e.tr) || s.r >= hi + 2)) {
    nx.w = num(+s.w + inc); nx.r = Math.max(lo, e.tr);
    return `المجموعة كانت سهلة، فالجاية بـ ${nx.w} كجم`;
  }
  if (s.r < lo || (s.rir === 0 && s.r < e.tr)) {
    nx.w = Math.max(inc || 1, roundTo(s.w * 0.9, inc || 1)); nx.r = e.tr;
    return `المجموعة كانت تقيلة، فالجاية بـ ${nx.w} كجم عشان توصل للعدّات`;
  }
  return null;
}

// ===== 5) حاسبة أطباق البار (بار أولمبي 20 كجم) =====
const PLATE_SET = [25, 20, 15, 10, 5, 2.5, 1.25];
function platesFor(total, bar = 20) {
  let side = (total - bar) / 2; if (side <= 0) return null;
  const out = [];
  for (const p of PLATE_SET) while (side >= p - 0.001) { out.push(p); side -= p; }
  return { out, rest: Math.round(side * 100) / 100 };
}
function plateLine(e) {
  const X = exInfo(e.id);
  if (X.eq !== 'bb' || !(+e.tw > 20)) return '';
  const r = platesFor(+e.tw); if (!r) return '';
  return `<div class="mute" style="font-size:12px;margin:4px 0 0">🧮 على كل ناحية من البار: <b class="ltr">${r.out.join(' + ')}</b> كجم${r.rest ? ` (وناقص ${r.rest})` : ''}</div>`;
}

// ===== 6) تمرين مختصر لو وقتك ضيق =====
const minsFor = ex => ex.reduce((a, e) => a + (isCardio(e.id) ? +e.tr || 15 : e.sets.length * 2.6), 0);
function shortenSheet() {
  openSheet(`<div class="grip"></div><h3>وقتك قد إيه؟</h3>
    <p class="mute" style="margin:0 0 12px">هشيل الكارديو الأول، وبعدين أقلّل مجموعات التمارين المساعدة، وأحافظ على التمارين الأساسية وتمارين الكتف والدراع.</p>
    <div class="grid3">${[30, 45, 60].map(m => `<button class="p" onclick="shortenWorkout(${m})">${m} دقيقة</button>`).join('')}</div>`);
}
function shortenWorkout(mins) {
  const D = S.draft, before = minsFor(D.ex);
  const keep = e => COMPOUND.has(e.id) || FOCUS.includes(exInfo(e.id).m);
  const pending = e => !e.sets.some(s => s.ok);
  // 1) شيل الكارديو
  if (minsFor(D.ex) > mins) D.ex = D.ex.filter(e => !(isCardio(e.id) && pending(e)));
  // 2) قلّل التمارين المساعدة لمجموعتين
  if (minsFor(D.ex) > mins) D.ex.forEach(e => { if (pending(e) && !keep(e) && e.sets.length > 2) e.sets = e.sets.slice(0, 2); });
  // 3) قلّل أي تمرين لـ 3 مجموعات
  if (minsFor(D.ex) > mins) D.ex.forEach(e => { if (pending(e) && e.sets.length > 3) e.sets = e.sets.slice(0, 3); });
  // 4) شيل تمارين مساعدة من الآخر
  for (let i = D.ex.length - 1; i >= 0 && minsFor(D.ex) > mins; i--) if (pending(D.ex[i]) && !keep(D.ex[i])) D.ex.splice(i, 1);
  // 5) آخر حل: كل التمارين مجموعتين
  if (minsFor(D.ex) > mins) D.ex.forEach(e => { if (pending(e) && e.sets.length > 2) e.sets = e.sets.slice(0, 2); });
  D.short = mins; save(); closeSheet();
  toast(`التمرين بقى حوالي ${Math.round(minsFor(D.ex))} دقيقة بدل ${Math.round(before)}`); renderWork();
}

// ===== 7) تعديل تمرين قديم =====
function editWorkout(id) {
  if (draftActive() && !confirm('فيه تمرين شغال دلوقتي. تسيبه وتعدّل القديم؟')) return;
  const w = S.workouts.find(x => x.id === id);
  S.draft = { v2: 1, key: w.key || '', name: w.name, date: w.date, start: Date.now(), editId: id, deload: !!w.deload,
    ex: w.ex.map(e => ({ id: e.id, tw: e.sets[0].w, tr: e.sets[0].r, note: 'تعديل تمرين قديم', sets: e.sets.map(s => ({ w: s.w, r: s.r, rir: s.rir ?? null, ok: true })) })) };
  save(); closeSheet(); go('work');
}

// ===== 8) حفظ التعديلات في البرنامج =====
function programDiff() {
  const D = S.draft; if (!D || !D.key || D.editId || D.short || !PROGRAM[D.key]) return false;
  const a = PROGRAM[D.key].ex.map(x => x[0]).join(','), b = D.ex.map(e => e.id).join(',');
  return a !== b;
}
function saveToProgram() {
  const D = S.draft, old = Object.fromEntries(PROGRAM[D.key].ex);
  // عدد المجموعات: لو التمرين موجود قبل كده نسيبه زي ما هو (عشان الأسبوع الخفيف أو الوقت الضيق ميأثروش)
  PROGRAM[D.key].ex = D.ex.map(e => [e.id, old[e.id] || Math.max(2, e.sets.length)]);
  saveProgram(); toast(`اتحفظ ترتيب ${PROGRAM[D.key].name} في البرنامج ✓`); renderWork();
}

// ===== 9) ملخص أحسن بعد التمرين: مقارنة بآخر مرة =====
function sessionCompare(w) {
  const prev = S.workouts.filter(x => x.key && x.key === w.key && x.id !== w.id && x.date <= w.date).at(-1);
  if (!prev) return '';
  const vol = x => x.ex.filter(e => !isCardio(e.id)).reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);
  const ch = pctChange(vol(w), vol(prev));
  let better = 0, total = 0;
  w.ex.forEach(e => {
    if (isCardio(e.id)) return;
    const pe = prev.ex.find(x => x.id === e.id); if (!pe) return;
    total++;
    const best = s => Math.max(...s.map(x => e1rm(x.w, x.r)));
    if (best(e.sets) > best(pe.sets) + 0.01) better++;
  });
  return `<div class="banner" style="margin:12px 0 0">مقارنة بآخر ${esc(w.name)} (${fmtShort(prev.date)}): الحجم ${ch == null ? 'زي ما هو' : `${ch > 0 ? '+' : ''}${ch}%`}${total ? `، واتحسنت في ${better} من ${total} تمارين` : ''}.</div>`;
}
