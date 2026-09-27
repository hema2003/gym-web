// ================= مميزات إضافية: النسخ الاحتياطي، صور التقدم، الإنجازات، الإحماء، تكرار الأكل =================

// ===== 1) النسخة الاحتياطية: تذكير كل أسبوع ومشاركة بضغطة (واتساب / Drive) =====
function backupDue() {
  if (!S.workouts.length && S.meals.length < 5) return false;
  return !S.lastBackup || dayDiff(S.lastBackup, today()) >= 7;
}
async function shareBackup() {
  const name = `gym-backup-${today()}.json`;
  const file = new File([JSON.stringify({ ...S, ai: { ...S.ai, key: '' } })], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'نسخة احتياطية من جيم' });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
    }
    S.lastBackup = today(); save(); toast('اتعملت النسخة ✓'); rerender();
  } catch (e) { if (e.name !== 'AbortError') toast('مقدرتش أعمل النسخة، جرّب "صدّر نسخة" من الإعدادات'); }
}

// ===== 2) صور التقدم (IndexedDB عشان الصور كبيرة على التخزين العادي) =====
const photoDB = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('gym-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction('photos', mode), req = fn(t.objectStore('photos'));
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
  }));
  return { all: () => run('readonly', s => s.getAll()), put: o => run('readwrite', s => s.put(o)), del: id => run('readwrite', s => s.delete(id)) };
})();
const POSES = { front: 'قدام', side: 'جنب', back: 'ضهر' };
let photoPose = 'front', photoCache = null;
async function addPhoto(inp) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  try {
    const data = await shrinkImage(f, 900);
    await photoDB.put({ id: uid(), date: today(), pose: photoPose, data });
    photoCache = null; toast('اتحفظت الصورة ✓'); renderPhotos();
  } catch { toast('مقدرتش أحفظ الصورة'); }
}
async function delPhoto(id) { if (!confirm('تمسح الصورة دي؟')) return; await photoDB.del(id); photoCache = null; closeSheet(); renderPhotos(); }
async function renderPhotos() {
  const box = $('p-photos'); if (!box) return;
  try { photoCache = photoCache || (await photoDB.all()).sort((a, b) => a.date.localeCompare(b.date)); } catch { box.innerHTML = '<p class="mute">الصور مش متاحة في المتصفح ده.</p>'; return; }
  const list = photoCache.filter(x => x.pose === photoPose), first = list[0], last = list.at(-1);
  const wAt = d => { const t = trendAt(d); return t ? `${num(t)} كجم` : ''; };
  box.innerHTML = `<div class="chips" style="margin-bottom:10px">${Object.entries(POSES).map(([k, l]) => `<button class="chip ${photoPose === k ? 'on' : ''}" onclick="photoPose='${k}';renderPhotos()">${l}</button>`).join('')}</div>
    ${first && last && first !== last ? `<div class="grid2">${[first, last].map((x, i) => `<figure style="margin:0"><img src="${x.data}" alt="${i ? 'آخر صورة' : 'أول صورة'}" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:var(--r-md)">
      <figcaption class="mute" style="text-align:center;margin-top:4px">${i ? 'دلوقتي' : 'البداية'}: ${fmtShort(x.date)}${wAt(x.date) ? `، ${wAt(x.date)}` : ''}</figcaption></figure>`).join('')}</div>`
      : last ? `<img src="${last.data}" alt="آخر صورة" style="width:60%;display:block;margin:auto;border-radius:var(--r-md)"><p class="mute" style="text-align:center">صوّر تاني بعد أسبوعين وهتظهر المقارنة.</p>`
      : '<p class="mute" style="margin:0 0 8px">الميزان ممكن يثبت والدهون بتنزل. الصور بتبيّن الفرق اللي الرقم مش بيبيّنه. صوّر نفسك كل أسبوعين في نفس المكان والإضاءة، الصبح.</p>'}
    ${list.length > 2 ? `<div class="chips" style="margin-top:10px">${list.map(x => `<button class="chip" onclick="viewPhoto('${x.id}')">${fmtShort(x.date)}</button>`).join('')}</div>` : ''}
    <button class="w" style="margin-top:10px" onclick="$('ph-in').click()">📷 صورة جديدة (${POSES[photoPose]})</button>
    <input type="file" id="ph-in" accept="image/*" capture="user" class="hide" onchange="addPhoto(this)">
    <p class="mute" style="margin:8px 0 0;font-size:12px">الصور متخزنة على تلفونك بس، ومش بتدخل في النسخة الاحتياطية.</p>`;
}
function viewPhoto(id) {
  const x = photoCache.find(p => p.id === id);
  openSheet(`<div class="grip"></div><h3>${fmtDay(x.date)}</h3><img src="${x.data}" alt="صورة تقدم" style="width:100%;border-radius:var(--r-md);margin-top:8px">
    <button class="g w del" style="margin-top:10px" onclick="delPhoto('${id}')">امسح الصورة</button>`);
}

// ===== 3) الإنجازات =====
function badgeList() {
  const W = S.workouts, prs = prTimeline().length, w0 = S.weights[0] ? S.weights[0].w : null, tw = trendSeries().at(-1);
  const lost = w0 && tw ? w0 - tw.t : 0;
  let foodStreak = 0, best = 0, prev = null;
  [...new Set(S.meals.map(m => m.date))].sort().forEach(d => { foodStreak = prev && dayDiff(prev, d) === 1 ? foodStreak + 1 : 1; best = Math.max(best, foodStreak); prev = d; });
  const weeks = {}; W.forEach(w => { const k = weekStart(w.date); weeks[k] = (weeks[k] || 0) + 1; });
  let wkStreak = 0, bestWk = 0;
  for (let i = 0, ws = weekStart(today()); i < 52; i++, ws = addDays(ws, -7)) { if ((weeks[ws] || 0) >= 4) { wkStreak++; bestWk = Math.max(bestWk, wkStreak); } else if (i) wkStreak = 0; }
  return [
    ['first', '🏁', 'أول تمرين', W.length >= 1],
    ['w10', '🔟', '10 تمارين', W.length >= 10],
    ['w50', '💯', '50 تمرين', W.length >= 50],
    ['fullweek', '📅', 'أسبوع كامل (5 تمارين)', Object.values(weeks).some(n => n >= 5)],
    ['wk4', '🔥', '4 أسابيع التزام ورا بعض', bestWk >= 4],
    ['pr1', '🏆', 'أول رقم قياسي', prs >= 1],
    ['pr10', '🥇', '10 أرقام قياسية', prs >= 10],
    ['food7', '🍽️', 'أسبوع تسجيل أكل كامل', best >= 7],
    ['food30', '📒', '30 يوم تسجيل ورا بعض', best >= 30],
    ['kg2', '⚖️', 'نزلت 2 كجم', lost >= 2],
    ['kg5', '🎯', 'نزلت 5 كجم', lost >= 5],
    ['kg10', '🦁', 'نزلت 10 كجم', lost >= 10]
  ];
}
// بتنادى من الرئيسية: لو في إنجاز جديد بيظهرلك
function checkBadges() {
  S.badges = S.badges || [];
  const fresh = badgeList().filter(b => b[3] && !S.badges.includes(b[0]));
  if (!fresh.length) return;
  S.badges.push(...fresh.map(b => b[0])); save();
  setTimeout(() => toast(`🏅 إنجاز جديد: ${fresh[0][2]}`), 600);
}
function badgesHTML() {
  const list = badgeList(), n = list.filter(b => b[3]).length;
  return `<h2>إنجازاتك <small>${n} من ${list.length}</small></h2><div class="grid3">${list.map(([, i, t, on]) =>
    `<div style="text-align:center;padding:10px 4px;border-radius:var(--r-md);background:var(--surface-2);${on ? '' : 'opacity:.35;filter:grayscale(1)'}"><div style="font-size:26px">${i}</div><div style="font-size:12px;margin-top:2px">${t}</div></div>`).join('')}</div>`;
}

// ===== 4) سِتّات الإحماء لأول تمرين مركّب (فكرة من Strong) =====
const COMPOUND = new Set(['flat_bb', 'flat_db', 'incline_db', 'ohp', 'db_ohp', 'squat', 'deadlift', 'rdl', 'bb_row', 'cgbp', 'leg_press', 'pulldown']);
function warmupLine(e, i) {
  if (!COMPOUND.has(e.id) || e.tw === '' || !(+e.tw > 0)) return '';
  const firstCompound = S.draft.ex.findIndex(x => COMPOUND.has(x.id));
  if (i !== firstCompound) return '';
  const inc = exInfo(e.id).inc || 1, w = p => Math.max(inc, roundTo(e.tw * p, inc));
  return `<div class="mute" style="font-size:12px;margin:4px 0 0">🔥 إحماء قبل الشغل: <b class="ltr">${w(0.4)}×10</b>، <b class="ltr">${w(0.6)}×5</b>، <b class="ltr">${w(0.8)}×3</b> (من غير ما تسجّلهم)</div>`;
}

// ===== 5) كرّر أكل امبارح =====
function copyYesterday() {
  const d = fDate(), y = addDays(d, -1), src = S.meals.filter(m => m.date === y);
  if (!src.length) return toast('مفيش أكل متسجل امبارح');
  const have = new Set(S.meals.filter(m => m.date === d).map(m => m.name));
  const add = src.filter(m => !have.has(m.name));
  if (!add.length) return toast('أكل امبارح متسجل النهارده بالفعل');
  add.forEach(m => S.meals.push({ ...structuredClone(m), id: uid(), date: d }));
  save(); toast(`اتنسخ أكل امبارح ✓ (${add.length})`); renderFood();
}
