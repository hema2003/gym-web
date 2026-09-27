// ================= المراجعة الأسبوعية (بتشتغل من غير AI) =================
// كل أسبوع جديد: التطبيق بيراجع الأسبوع اللي فات ويعدّل البرنامج والسعرات لو محتاج، ويشرح ليه.
// كل التعديلات بقواعد ثابتة ومعروفة؛ الـ AI (لو متفعّل) بيكتب الشرح بس، ومبيغيّرش أرقام.

let DEFAULT_PROGRAM = null;
const programState = () => Object.fromEntries(ORDER.map(k => [k, PROGRAM[k].ex.map(x => [...x])]));
function applyProgram(st) { ORDER.forEach(k => { if (st[k]) PROGRAM[k].ex = st[k].map(x => [...x]); }); }
// بتتنادي مرة واحدة بعد تحميل البيانات
function initProgram() {
  DEFAULT_PROGRAM = programState();
  if (S.program) applyProgram(S.program);
}
function saveProgram() { S.program = programState(); save(); }
function resetProgram() {
  if (!confirm('ترجّع البرنامج للأصل؟ التمارين اللي اتبدّلت والمجموعات اللي اتغيّرت هترجع زي الأول.')) return;
  applyProgram(DEFAULT_PROGRAM); S.program = null; save(); toast('رجع البرنامج للأصل'); rerender();
}

// حجم كل عضلة في أسبوع معيّن
function volumeIn(ws) {
  const we = addDays(ws, 6), v = Object.fromEntries(Object.keys(MUSCLES).map(k => [k, 0]));
  S.workouts.filter(w => w.date >= ws && w.date <= we).forEach(w => w.ex.forEach(e => {
    const X = exInfo(e.id), n = e.sets.length;
    if (v[X.m] != null) v[X.m] += n;
    (X.sec || []).forEach(m => { if (v[m] != null) v[m] += n / 2; });
  }));
  return v;
}
function readinessAvg(ws) {
  const vals = [...Array(7)].map((_, i) => readiness(addDays(ws, i))).filter(Boolean).map(r => r.sum);
  return vals.length >= 3 ? avg(vals) : null;
}
// بديل لتمرين واقف: نفس العضلة، مش موجود في البرنامج، ويفضّل نفس الأداة
function alternativeFor(id) {
  const X = EX[id], used = new Set(ORDER.flatMap(k => PROGRAM[k].ex.map(x => x[0])));
  const c = Object.entries(EX).filter(([k, x]) => k !== id && x.m === X.m && x.m !== 'cardio' && !used.has(k));
  return (c.find(([, x]) => x.eq === X.eq) || c[0] || [])[0];
}

function runCheckin(ws, silent) {
  if (S.checkins.some(c => c.week === ws)) return S.checkins.find(c => c.week === ws);
  const st = weekStats(ws), p = S.profile, tg = targets(), changes = [], notes = [];
  const snap = { adj: p.adj || 0, stepsGoal: p.stepsGoal, meso: p.meso, program: programState() };
  const hasData = st.workouts || st.logged || st.weighs;
  if (!hasData) return null;

  // ---- 1) السعرات والخطوات حسب اتجاه الوزن ----
  const rate = weeklyRate(), want = GOALS[p.goal].r * curWeight(), enoughW = S.weights.length >= 6 && dayDiff(S.weights[0].date, today()) >= 14;
  if (!enoughW) notes.push('محتاج أسبوعين وزن متسجل على الأقل قبل ما أعدّل السعرات.');
  else if (st.logged < 4) notes.push(`سجّلت أكلك ${st.logged} أيام بس، فمش هغيّر السعرات. لما تسجّل 4 أيام أو أكتر أقدر أحكم صح.`);
  else if (p.goal === 'cut' && rate > want * 0.5) {
    if (st.stepsAvg != null && st.stepsAvg < p.stepsGoal - 1500) notes.push(`النزول أبطأ من المطلوب، بس متوسط خطواتك ${Math.round(st.stepsAvg).toLocaleString('en')} أقل من هدفك. حقق هدف الخطوات الأول قبل ما نقلّل الأكل.`);
    else if (p.stepsGoal < 12000) {
      p.stepsGoal += 1000;
      changes.push({ icon: '🚶', t: `هدف الخطوات بقى ${p.stepsGoal.toLocaleString('en')}`, why: `وزنك بينزل ${sgn(rate)} كجم/أسبوع، وهدفك ${sgn(want)}. زيادة الحركة أحسن من تقليل الأكل الأول، لأنها بتحافظ على طاقتك في التمرين.` });
    } else {
      const floor = 1700;
      const newK = Math.max(floor, tg.kcal - 150);
      if (newK < tg.kcal) { p.adj = (+p.adj || 0) - (tg.kcal - newK); p.adjDate = today(); changes.push({ icon: '🍽️', t: `السعرات بقت ${newK} بدل ${tg.kcal}`, why: `النزول بطيء (${sgn(rate)} كجم/أسبوع) رغم إنك محقق هدف الخطوات، فقلّلنا 150 سعرة بس. تقليل صغير عشان متخسرش عضل.` }); }
    }
  } else if (p.goal === 'cut' && rate < want * 1.6) {
    p.adj = (+p.adj || 0) + 150; p.adjDate = today();
    changes.push({ icon: '🍽️', t: `السعرات بقت ${tg.kcal + 150} بدل ${tg.kcal}`, why: `بتنزل بسرعة (${sgn(rate)} كجم/أسبوع). النزول أسرع من 1% من وزنك في الأسبوع بيزوّد خسارة العضل، فزوّدنا 150 سعرة.` });
  } else if (p.goal !== 'cut') {
    const adv = calorieAdvice();
    if (adv && !adv.ok) { p.adj = (+p.adj || 0) + adv.adj; p.adjDate = today(); changes.push({ icon: '🍽️', t: `السعرات اتعدّلت ${sgn(adv.adj)}`, why: `وزنك بيتغير ${sgn(rate)} كجم/أسبوع، والمطلوب ${sgn(want)}.` }); }
  } else notes.push(`وزنك بينزل ${sgn(rate)} كجم/أسبوع، وده مظبوط على هدفك. السعرات زي ما هي.`);

  // ---- 2) تمارين واقفة: نبدّلها ----
  const since21 = addDays(today(), -21);
  plateaus().filter(x => ORDER.some(k => PROGRAM[k].ex.some(e => e[0] === x.id)) && exSessions(x.id)[0].d < since21).slice(0, 2).forEach(x => {
    const alt = alternativeFor(x.id);
    if (!alt) return;
    ORDER.forEach(k => PROGRAM[k].ex.forEach(e => { if (e[0] === x.id) e[0] = alt; }));
    changes.push({ icon: '🔁', t: `${EX[x.id].ar} اتبدّل بـ ${EX[alt].ar}`, why: `${EX[x.id].ar} مبيتحسنش من آخر 3 مرات. تغيير الزاوية أو الأداة بيدّي العضلة تحفيز جديد ويكسر الثبات.` });
  });

  // ---- 3) الحجم الأسبوعي ----
  const vol = volumeIn(ws), rAvg = readinessAvg(ws);
  if (st.workouts >= 3) {
    FOCUS.forEach(m => {
      if (vol[m] >= VOLUME[m][0] || (rAvg != null && rAvg <= 5)) return;
      const hit = ORDER.flatMap(k => PROGRAM[k].ex.filter(e => EX[e[0]] && EX[e[0]].m === m && e[1] < 5)).at(0);
      if (!hit) return;
      hit[1]++;
      changes.push({ icon: '➕', t: `مجموعة زيادة في ${EX[hit[0]].ar}`, why: `${MUSCLES[m]} أخدت ${num(vol[m])} مجموعة بس الأسبوع اللي فات، وأقل حد للنمو ${VOLUME[m][0]}.` });
    });
    Object.keys(MUSCLES).forEach(m => {
      if (vol[m] <= VOLUME[m][1] * 1.2) return;
      const cand = ORDER.flatMap(k => PROGRAM[k].ex.filter(e => EX[e[0]] && EX[e[0]].m === m && e[1] > 2)).sort((a, b) => b[1] - a[1])[0];
      if (!cand) return;
      cand[1]--;
      changes.push({ icon: '➖', t: `مجموعة أقل في ${EX[cand[0]].ar}`, why: `${MUSCLES[m]} أخدت ${num(vol[m])} مجموعة، وده أكتر من اللي تقدر تستشفى منه وانت في عجز سعرات.` });
    });
  } else if (st.workouts) notes.push(`اتمرنت ${st.workouts} مرات بس، فمش هغيّر في المجموعات. الأولوية إنك تكمّل الـ 5 تمارين.`);

  // ---- 4) إرهاق: أسبوع خفيف بدري ----
  const mw = mesoWeek(addDays(ws, 7));
  if (rAvg != null && rAvg <= 5 && mw !== 5 && mw !== 1) {
    p.meso = addDays(addDays(ws, 7), -28);
    changes.push({ icon: '🔄', t: 'الأسبوع ده بقى أسبوع خفيف', why: `متوسط جاهزيتك (النوم والطاقة والعضلات) كان قليل الأسبوع اللي فات. أسبوع خفيف دلوقتي هيرجّعك أقوى، أحسن من إنك تكمّل وانت مرهق.` });
  }

  // ---- 5) ملاحظات من غير تعديل ----
  if (st.logged && st.pHit < st.logged * 0.6) notes.push(`البروتين اتحقق ${st.pHit} من ${st.logged} أيام. ده أهم رقم يحمي عضلك في التنشيف.`);

  if (changes.some(c => /اتبدّل|مجموعة/.test(c.t))) S.program = programState();
  const c = { week: ws, date: today(), score: st.score, changes, notes, snap, seen: !!silent, ai: null };
  S.checkins.push(c); save();
  if (S.ai && S.ai.key && S.ai.weekly !== false) aiCheckinText(c).catch(() => {});
  return c;
}
// بتشتغل أول ما تفتح التطبيق في أسبوع جديد
function autoCheckin() {
  const last = addDays(weekStart(today()), -7);
  if (S.checkins.some(c => c.week === last)) return;
  if (!S.workouts.length && !S.weights.length) return;
  runCheckin(last);
}
function undoCheckin(week) {
  const c = S.checkins.find(x => x.week === week); if (!c || c.undone) return;
  Object.assign(S.profile, { adj: c.snap.adj, stepsGoal: c.snap.stepsGoal, meso: c.snap.meso });
  applyProgram(c.snap.program); S.program = c.snap.program; c.undone = true; save();
  toast('رجّعنا كل تعديلات المراجعة'); closeSheet(); rerender();
}

// ===== العرض =====
function checkinCard() {
  const c = S.checkins.at(-1);
  if (!c || c.seen) return '';
  return `<div class="card" style="border:2px solid var(--blue)"><h2>مراجعة الأسبوع جاهزة <small>${c.score}/100</small></h2>
    <p style="margin:0 0 12px">${c.changes.length ? `عملت ${c.changes.length} تعديلات على برنامجك بناءً على أسبوعك.` : 'راجعت أسبوعك، ومفيش حاجة محتاجة تتغير.'}</p>
    <button class="p w" onclick="openCheckin('${c.week}')">شوف المراجعة</button></div>`;
}
function openCheckin(week) {
  const c = S.checkins.find(x => x.week === week); if (!c) return;
  c.seen = true; save();
  const ai = c.ai;
  openSheet(`<div class="grip"></div><h3>مراجعة أسبوع ${fmtRange(c.week, addDays(c.week, 6))}</h3>
    <p class="mute" style="margin:0 0 12px">درجة الأسبوع ${c.score}/100</p>
    ${ai && ai.text ? `<div class="banner" style="white-space:pre-line">✨ ${esc(ai.text)}</div>` : ''}
    ${ai && ai.err ? `<div class="banner warn">${esc(ai.err)} <button class="sm" style="margin-top:6px;display:block" onclick="retryCheckinAI('${c.week}')">جرّب تاني</button></div>` : ''}
    ${!ai && S.ai && S.ai.key ? `<div class="banner" id="ci-ai">✨ المدرب بيكتب ملاحظاته…</div>` : ''}
    <h2 style="margin-top:6px">${c.changes.length ? 'اللي اتعدّل وليه' : 'مفيش تعديلات'}</h2>
    <ul class="coach">${c.changes.map(x => `<li><i>${x.icon}</i><span><b>${esc(x.t)}</b><br><span class="mute">${esc(x.why)}</span></span></li>`).join('') || '<li><i>✅</i><span>كل حاجة ماشية صح، فكمّل زي ما انت.</span></li>'}</ul>
    ${c.notes.length ? `<h2 style="margin-top:14px">ملاحظات</h2><ul class="coach">${c.notes.map(n => `<li><i>💡</i><span>${esc(n)}</span></li>`).join('')}</ul>` : ''}
    ${c.changes.length && !c.undone ? `<button class="g w" style="margin-top:10px" onclick="undoCheckin('${c.week}')">تراجع عن التعديلات دي</button>` : c.undone ? '<p class="mute">اتراجعت عن التعديلات دي.</p>' : ''}
    <button class="p w" style="margin-top:8px" onclick="closeSheet()">تمام</button>`);
  if (!ai && S.ai && S.ai.key) aiCheckinText(c).then(() => { if ($('sheet').open && $('ci-ai')) openCheckin(week); }).catch(() => { if ($('sheet').open) openCheckin(week); });
}
function retryCheckinAI(week) { const c = S.checkins.find(x => x.week === week); c.ai = null; save(); openCheckin(week); }
function checkinsList() {
  return S.checkins.slice(-6).reverse().map(c => `<li onclick="openCheckin('${c.week}')" style="cursor:pointer"><div><div>أسبوع ${fmtRange(c.week, addDays(c.week, 6))}</div>
    <div class="mute">${c.changes.length ? `${c.changes.length} تعديلات` : 'من غير تعديلات'}${c.undone ? '، اتراجعت عنها' : ''}</div></div><b class="num">${c.score}</b></li>`).join('')
    || '<li class="mute">أول مراجعة هتتعمل لوحدها أول ما يبدأ أسبوع جديد (يوم السبت).</li>';
}
