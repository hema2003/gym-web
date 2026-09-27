// ================= التحليل والتقدم =================
// أفكار مستعارة: التقرير الأسبوعي (MacroFactor/Whoop)، هدف الوزن وتوقّع الوصول (Happy Scale)،
// استشفاء العضلات (Fitbod)، صفحة لكل تمرين ومستويات القوة (Hevy/Strong/Strength Level)، اكتشاف الثبات (RP)

let progTab = 'week', repOffset = 0, wRange = 90, exAll = false;
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const pctChange = (a, b) => b ? Math.round((a - b) / b * 100) : null;
const fmtRange = (a, b) => `${toDate(a).getDate()} – ${fmtShort(b)}`;
function trendAt(d) { let v = null; for (const p of trendSeries()) { if (p.d <= d) v = p.t; else break; } return v; }

// ===== رسومات صغيرة =====
function sparkline(vals, w = 90, h = 28) {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v - lo) / sp * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="direction:ltr;flex:0 0 auto" aria-hidden="true"><polyline points="${pts}" fill="none" style="stroke:var(--blue)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
// أعمدة: [{l: تسمية, v: قيمة, c: لون}] مع خط هدف اختياري
function barChart(bars, target, unit = '') {
  if (!bars.some(b => b.v)) return '<p class="mute" style="margin:0">لسه مفيش بيانات كفاية للرسم.</p>';
  const W = 330, H = 150, P = 18, bw = (W - P * 2) / bars.length;
  const max = Math.max(target || 0, ...bars.map(b => b.v)) * 1.1 || 1, y = v => H - 22 - v / max * (H - 36);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" style="direction:ltr">`;
  bars.forEach((b, i) => {
    const x = P + i * bw + bw * 0.18, h = H - 22 - y(b.v);
    s += `<rect x="${x.toFixed(1)}" y="${y(b.v).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" style="fill:var(${b.c || '--blue'})"><title>${b.l}: ${Math.round(b.v)} ${unit}</title></rect>`;
    if (bars.length <= 8 || i % 2 === 0) s += `<text x="${(x + bw * 0.32).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" style="fill:var(--ink-3)">${b.l}</text>`;
  });
  if (target) s += `<line x1="${P}" x2="${W - P}" y1="${y(target)}" y2="${y(target)}" style="stroke:var(--ink-2)" stroke-dasharray="4 4"/><text x="${W - P}" y="${y(target) - 4}" text-anchor="end" font-size="10" style="fill:var(--ink-2)">الهدف ${Math.round(target)}</text>`;
  return s + '</svg>';
}

// ===== إحصائيات أسبوع =====
// cap: عدد الأيام اللي تتحسب (عشان نقارن أول يومين من الأسبوع بأول يومين من اللي قبله)
function weekStats(ws, cap = 7) {
  const we = addDays(ws, cap - 1), t = today(), end = we < t ? we : t, inW = d => d >= ws && d <= we, tg = targets();
  const days = [...Array(cap)].map((_, i) => addDays(ws, i)).filter(d => d <= t), n = Math.max(1, days.length);
  const W = S.workouts.filter(w => inW(w.date));
  const lift = W.flatMap(w => w.ex.filter(e => !isCardio(e.id))), card = W.flatMap(w => w.ex.filter(e => isCardio(e.id)));
  const logged = days.filter(d => S.meals.some(m => m.date === d)), tots = logged.map(mealTotals);
  const steps = days.map(d => +((S.daily[d] || {}).steps) || 0).filter(Boolean);
  const weighs = S.weights.filter(x => inW(x.date)).length;
  const wEnd = trendAt(end), wStart = trendAt(addDays(ws, -1));
  const s = {
    ws, we, days: n, workouts: W.length, prs: W.reduce((a, w) => a + (w.prs || 0), 0),
    sets: lift.reduce((a, e) => a + e.sets.length, 0), tonnage: Math.round(lift.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.w * x.r, 0), 0)),
    cMin: card.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.r, 0), 0),
    cKcal: card.reduce((a, e) => a + e.sets.reduce((b, x) => b + cardioKcal(e.id, x.w, x.r), 0), 0),
    logged: logged.length, avgK: avg(tots.map(x => x.k)), avgP: avg(tots.map(x => x.p)),
    pHit: tots.filter(x => x.p >= tg.pro * 0.9).length, kHit: tots.filter(x => Math.abs(x.k - tg.kcal) <= tg.kcal * 0.1).length,
    stepsAvg: avg(steps), stepsHit: steps.filter(x => x >= (S.profile.stepsGoal || 10000) * 0.8).length, weighs,
    wChange: wEnd != null && wStart != null ? wEnd - wStart : null
  };
  // درجة الأسبوع من 100 (محسوبة على الأيام اللي عدّت بس)
  const parts = [
    ['التمرين', Math.min(1, s.workouts / Math.max(1, Math.round(5 * n / 7))), 30, `${s.workouts} من 5`, '--red'],
    ['البروتين', s.pHit / n, 25, `${s.pHit} من ${n} أيام`, '--blue'],
    ['السعرات', s.kHit / n, 20, `${s.kHit} من ${n} أيام`, '--yellow'],
    ['الخطوات', s.stepsHit / n, 15, `${s.stepsHit} من ${n} أيام`, '--green'],
    ['الوزن', Math.min(1, s.weighs / Math.max(1, Math.round(4 * n / 7))), 10, `${s.weighs} مرات`, '--ink-2']
  ];
  s.parts = parts; s.score = Math.round(parts.reduce((a, p) => a + p[1] * p[2], 0));
  return s;
}

// ===== الثبات: تمرين مبيتحسنش آخر 3 مرات =====
function exSessions(id) {
  return S.workouts.filter(w => !w.deload).map(w => { const e = w.ex.find(x => x.id === id); return e && e.sets.length && { d: w.date, v: Math.max(...e.sets.map(s => e1rm(s.w, s.r))), sets: e.sets }; }).filter(Boolean);
}
function plateaus() {
  const since = addDays(today(), -42), ids = [...new Set(S.workouts.flatMap(w => w.ex.map(e => e.id)))].filter(id => !isCardio(id));
  return ids.map(id => {
    const ss = exSessions(id).filter(x => x.d >= since);
    if (ss.length < 4) return null;
    const last3 = Math.max(...ss.slice(-3).map(x => x.v)), before = Math.max(...ss.slice(0, -3).map(x => x.v));
    return last3 <= before * 1.01 ? { id, n: ss.length } : null;
  }).filter(Boolean);
}

// ===== استشفاء العضلات (فكرة Fitbod): التعب بيقل مع الوقت =====
function recovery() {
  const now = Date.now(), f = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, 0]));
  S.workouts.filter(w => w.date >= addDays(today(), -5)).forEach(w => {
    const hrs = (now - new Date(w.date + 'T18:00').getTime()) / 36e5;
    const decay = Math.exp(-Math.max(0, hrs) / 30);
    w.ex.forEach(e => { const X = exInfo(e.id); if (!MUSCLES[X.m]) return; f[X.m] += e.sets.length * decay; (X.sec || []).forEach(m => f[m] += e.sets.length * 0.5 * decay); });
  });
  return Object.fromEntries(Object.entries(f).map(([m, v]) => [m, Math.max(0, Math.min(100, Math.round(100 - v * 9)))]));
}

// ===== مستويات القوة بالنسبة لوزن جسمك (تقريبية، رجالة) =====
// [تمرين، حدود المستويات كنسبة من وزن الجسم للـ 1RM (للدمبل: لكل دمبل)]
const STANDARDS = [
  ['flat_bb', [0.75, 1.1, 1.5]], ['flat_db', [0.3, 0.45, 0.6]], ['incline_db', [0.25, 0.4, 0.55]],
  ['squat', [1, 1.5, 2]], ['deadlift', [1.25, 1.75, 2.25]], ['rdl', [0.9, 1.3, 1.7]],
  ['ohp', [0.5, 0.75, 1]], ['db_ohp', [0.2, 0.32, 0.45]], ['bb_row', [0.6, 0.9, 1.2]],
  ['pulldown', [0.6, 0.9, 1.15]], ['bb_curl', [0.35, 0.55, 0.75]], ['cgbp', [0.65, 1, 1.35]]
];
const LEVELS = ['مبتدئ', 'متوسط', 'متقدم', 'قوي جدًا'];

// ===== تاريخ الأرقام القياسية =====
function prTimeline() {
  const best = {}, out = [];
  S.workouts.forEach(w => w.ex.forEach(e => {
    if (isCardio(e.id)) return;
    const top = e.sets.reduce((a, s) => e1rm(s.w, s.r) > e1rm(a.w, a.r) ? s : a, e.sets[0]);
    const v = e1rm(top.w, top.r);
    if (best[e.id] != null && v > best[e.id] + 0.01) out.push({ d: w.date, id: e.id, s: top, v });
    best[e.id] = Math.max(best[e.id] || 0, v);
  }));
  return out.reverse();
}

// ================= العرض =================
function renderProg() {
  $('sub').textContent = 'الأرقام بتقول إيه عن تقدّمك';
  $('p-tabs').innerHTML = [['week', 'الأسبوع'], ['body', 'الجسم'], ['str', 'القوة'], ['food', 'الأكل']]
    .map(([k, l]) => `<button class="chip ${progTab === k ? 'on' : ''}" onclick="progTab='${k}';renderProg()">${l}</button>`).join('');
  ['week', 'body', 'str', 'food'].forEach(k => $('p-' + k).classList.toggle('hide', k !== progTab));
  ({ week: renderWeek, body: renderBody, str: renderStrength, food: renderNutri })[progTab]();
}

// ----- الأسبوع -----
function renderWeek() {
  const ws = addDays(weekStart(today()), repOffset * 7), s = weekStats(ws), p = weekStats(addDays(ws, -7), s.days), tg = targets();
  const cmp = (a, b, unit = '%') => { const c = pctChange(a, b); return c == null || !b ? '' : `<span class="${c >= 0 ? 'green' : 'red'}" style="font-size:12px"> ${c > 0 ? '+' : ''}${c}${unit}</span>`; };
  const stat = (v, l, extra = '') => `<div class="stat"><b>${v}</b><span>${l}${extra}</span></div>`;
  $('p-week').innerHTML = `
    <div class="row" style="margin:4px 0 8px">
      <button class="g fit" onclick="repOffset--;renderProg()" aria-label="الأسبوع اللي قبله">‹ قبله</button>
      <b style="text-align:center;font-family:var(--display);font-weight:600">${repOffset === 0 ? 'الأسبوع ده' : repOffset === -1 ? 'الأسبوع اللي فات' : fmtRange(ws, addDays(ws, 6))}</b>
      <button class="g fit" onclick="repOffset=Math.min(0,repOffset+1);renderProg()" ${repOffset === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="الأسبوع اللي بعده">بعده ›</button>
    </div>
    <div class="card">
      <div class="row" style="align-items:flex-end">
        <div><div class="energy">${s.score}<span style="font-size:18px;color:var(--ink-3)">/100</span></div><div class="mute">درجة الأسبوع${repOffset === 0 && s.days < 7 ? ` (بعد ${s.days} أيام)` : ''}</div></div>
      </div>
      <div style="margin-top:14px">${s.parts.map(([l, v, , txt, c]) => `<div class="row" style="margin:8px 0"><span class="fit" style="width:64px;font-size:13px">${l}</span>
        <div><div class="bar" style="--c:var(${c});margin:0"><i style="width:${Math.round(v * 100)}%"></i></div></div><span class="fit mute" style="width:84px;text-align:left">${txt}</span></div>`).join('')}</div>
    </div>
    <div class="card"><h2>الملخص</h2><div class="grid2">
      ${stat(s.wChange == null ? '—' : sgn(s.wChange), 'تغيّر الوزن (كجم)')}
      ${stat(s.avgK == null ? '—' : Math.round(s.avgK), `متوسط السعرات من ${tg.kcal}`)}
      ${stat(s.avgP == null ? '—' : Math.round(s.avgP), `متوسط البروتين من ${tg.pro}`)}
      ${stat(s.workouts, 'تمارين', s.prs ? `، و${s.prs} أرقام قياسية 🏆` : '')}
      ${stat(s.sets, 'مجموعة', cmp(s.sets, p.sets))}
      ${stat(s.tonnage.toLocaleString('en'), 'كجم حجم التمرين', cmp(s.tonnage, p.tonnage))}
      ${stat(s.cMin, 'دقيقة كارديو', s.cKcal ? ` (${s.cKcal} سعرة)` : '')}
      ${stat(s.stepsAvg == null ? '—' : Math.round(s.stepsAvg).toLocaleString('en'), 'متوسط الخطوات')}
    </div>${s.days < 7 ? `<p class="mute" style="margin:10px 0 0">المقارنة بأول ${s.days} أيام من الأسبوع اللي فات.</p>` : ''}</div>
    <div class="card"><h2>ملاحظات الأسبوع</h2><ul class="coach">${weekInsights(s, p).map(([i, t]) => `<li><i>${i}</i><span>${t}</span></li>`).join('')}</ul></div>
    <div class="card">${badgesHTML()}</div>
    <div class="card"><h2>المراجعات الأسبوعية <small>بتتعمل لوحدها كل سبت</small></h2><ul class="list">${checkinsList()}</ul>
      ${repOffset < 0 && !S.checkins.some(c => c.week === ws) ? `<button class="w" style="margin-top:8px" onclick="const c=runCheckin('${ws}',true);c?openCheckin(c.week):toast('مفيش بيانات كفاية للأسبوع ده')">اعمل مراجعة للأسبوع ده</button>` : ''}</div>`;
}
function weekInsights(s, p) {
  const out = [], tg = targets(), rate = weeklyRate(), want = GOALS[S.profile.goal].r * curWeight();
  if (!s.workouts && !s.logged && !s.weighs) return [['📝', 'مفيش بيانات للأسبوع ده. سجّل تمارينك وأكلك ووزنك، والتقرير هيتملى لوحده.']];
  if (s.wChange != null && rate != null) {
    if (S.profile.goal === 'cut') out.push(rate > -0.15 ? ['⚖️', `وزنك شبه ثابت (${sgn(rate)} كجم/أسبوع). لو فضل كده أسبوعين، قلّل 150 سعرة أو زوّد الخطوات.`]
      : rate < want * 1.6 ? ['⚠️', `بتنزل بسرعة (${sgn(rate)} كجم/أسبوع). النزول السريع بياكل من العضل، فزوّد 150 سعرة.`]
      : ['✅', `بتنزل ${sgn(rate)} كجم في الأسبوع، وده المعدل المثالي للتنشيف مع الحفاظ على العضل.`]);
  }
  if (s.logged) out.push(s.pHit >= s.logged * 0.8 ? ['🥚', `حققت هدف البروتين ${s.pHit} من ${s.logged} أيام. ممتاز.`] : ['🥚', `هدف البروتين اتحقق ${s.pHit} من ${s.logged} أيام بس. البروتين هو اللي بيحمي عضلك في التنشيف.`]);
  else out.push(['🍽️', 'مسجلتش أكل الأسبوع ده. من غير تسجيل مش هقدر أحسب حرقك الفعلي.']);
  const c = pctChange(s.tonnage, p.tonnage);
  if (s.workouts && c != null && p.tonnage) out.push(c <= -20 ? ['📉', `حجم تمرينك أقل ${-c}% من الأسبوع اللي فات. لو ده مش أسبوع خفيف، حاول متفوّتش تمارين.`] : c >= 15 ? ['📈', `حجم تمرينك زاد ${c}% عن الأسبوع اللي فات.`] : ['💪', 'حجم تمرينك ثابت تقريبًا، وده كويس في التنشيف.']);
  const pl = plateaus().slice(0, 2);
  if (pl.length) out.push(['🧱', `${pl.map(x => exInfo(x.id).ar).join(' و')} مبيتحسنش من 3 مرات. في التنشيف الثبات طبيعي، بس لو عايز تكسره جرّب نطاق عدّات تاني أو بدّل التمرين.`]);
  if (s.stepsAvg != null && s.stepsAvg < 8000) out.push(['🚶', `متوسط خطواتك ${Math.round(s.stepsAvg).toLocaleString('en')}. زيادة 3000 خطوة في اليوم بتحرق حوالي 120 سعرة زيادة.`]);
  if (!s.cMin && s.workouts) out.push(['🏃', 'مفيش كارديو الأسبوع ده. 20 دقيقة مشي بميل بعد التمرين بتسرّع التنشيف.']);
  return out;
}

// ----- الجسم -----
function renderBody() {
  const p = S.profile, ts = trendSeries(), now = ts.length ? ts.at(-1).t : p.w, rate = weeklyRate();
  const w0 = S.weights[0] ? S.weights[0].w : p.w, lbm0 = w0 * (1 - p.bf / 100), goalW = p.goalW || +(lbm0 / 0.85).toFixed(1);
  const bfNow = Math.max(3, (1 - lbm0 / now) * 100), done = w0 - now, total = w0 - goalW, prog = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  let eta = '';
  if (now <= goalW) eta = '🎉 وصلت لهدفك! تقدر تحط هدف جديد أو تحوّل لثبات.';
  else if (rate != null && rate < -0.05) { const wk = (now - goalW) / -rate; eta = `بالمعدل الحالي (${sgn(rate)} كجم/أسبوع) هتوصل حوالي <b>${fmtShort(addDays(today(), Math.round(wk * 7)))}</b>، يعني بعد ${Math.ceil(wk)} أسبوع.`; }
  else eta = 'محتاج أسبوعين وزن متسجل على الأقل عشان أتوقع هتوصل إمتى.';
  $('p-goal').innerHTML = `
    <div class="row" style="align-items:flex-end"><div><div class="energy">${num(now)}</div><div class="mute">كجم دلوقتي (المتوسط)</div></div>
      <div class="fit" style="text-align:left"><div class="num" style="font-size:22px">${num(goalW)}</div><div class="mute">الهدف</div></div></div>
    <div class="bar" style="--c:var(--green);height:12px;margin-top:14px"><i style="width:${Math.round(prog * 100)}%"></i></div>
    <div class="row mute" style="margin-top:6px"><span>بدأت ${num(w0)}</span><span style="text-align:left">${done > 0 ? `نزلت ${num(done)} كجم` : ''}</span></div>
    <p style="margin:12px 0 0">${eta}</p>
    <p class="mute" style="margin:6px 0 0">نسبة دهونك التقديرية دلوقتي حوالي <b>${Math.round(bfNow)}%</b> (بدأت ${p.bf}%)، ده لو حافظت على عضلك. الهدف محسوب على 15% دهون.</p>
    <div class="row" style="margin-top:12px"><input type="number" inputmode="decimal" step="0.5" id="p-goalw" placeholder="غيّر الهدف (كجم)"><button class="fit" onclick="setGoalW()">احفظ</button></div>`;

  const ex = expenditure(), tg = targets();
  $('p-tdee').innerHTML = ex.need
    ? `<p style="margin:0">عشان أحسب حرقك الحقيقي محتاج <b>10 أيام أكل متسجل</b> و<b>8 مرات وزن</b> خلال 4 أسابيع.</p>
       <p class="mute" style="margin:6px 0 0">عندك دلوقتي ${ex.days} يوم أكل و${ex.weighs} مرة وزن.</p>`
    : Math.abs(ex.tdee - tg.tdee) > tg.tdee * 0.3
    ? `<div class="energy">${ex.tdee.toLocaleString('en')}</div><p class="warn" style="margin:6px 0 0">الرقم ده بعيد جدًا عن المتوقع (${r50(tg.tdee).toLocaleString('en')}). غالبًا في وجبات مش متسجلة أو أيام ناقصة، فمش هعدّل هدفك عليه. سجّل كل أكلك أسبوعين والرقم هيتظبط.</p>`
    : `<div class="energy">${ex.tdee.toLocaleString('en')}</div><div class="mute">سعرة في اليوم حرقك الفعلي. المعادلة كانت متوقعة ${r50(tg.tdee).toLocaleString('en')}، ومتوسط أكلك ${ex.avgIn.toLocaleString('en')}.</div>
       ${Math.abs(ex.tdee - tg.tdee) >= 150 ? `<button class="p w" style="margin-top:12px" onclick="applyTdee(${ex.tdee})">ظبّط هدفي على الحرق الفعلي (${r50(ex.tdee * (1 + GOALS[S.profile.goal].d))} سعرة)</button>` : '<p class="mute" style="margin:8px 0 0">هدفك مظبوط على حرقك الفعلي.</p>'}`;

  $('p-wrange').innerHTML = [[30, 'شهر'], [90, '3 شهور'], [0, 'الكل']].map(([v, l]) => `<button class="chip ${wRange === v ? 'on' : ''}" onclick="wRange=${v};renderProg()">${l}</button>`).join('');
  const from = wRange ? addDays(today(), -wRange) : '0000', tsr = ts.filter(x => x.d >= from);
  $('p-wchart').innerHTML = lineChart(tsr.map(x => ({ d: x.d, y: x.y })), tsr.map(x => ({ d: x.d, y: x.t })));

  const M = S.meas, f0 = M[0], fl = M.at(-1), ml = { waist: 'الوسط', arm: 'الدراع', chest: 'الصدر', sh: 'الكتف' };
  $('p-meas').innerHTML = fl ? Object.keys(ml).filter(k => fl[k]).map(k => {
    const d = f0[k] ? fl[k] - f0[k] : 0, good = k === 'waist' ? d <= 0 : d >= 0, series = M.filter(m => m[k]).map(m => m[k]);
    return `<li><span>${ml[k]}</span><span class="row fit" style="gap:10px">${sparkline(series, 60, 22)}<b>${fl[k]}</b>${M.length > 1 && d ? `<span class="${good ? 'green' : 'red'} ltr" style="font-size:13px">${sgn(d)}</span>` : ''}</span></li>`;
  }).join('') + `<li class="mute">آخر قياس ${fmtShort(fl.date)}. قيس كل أسبوعين، الصبح قبل الأكل.</li>`
    : '<li class="mute">قيس الوسط والدراع كل أسبوعين. لو الوسط بينزل والدراع ثابت، يبقى بتخسر دهون مش عضل.</li>';
  renderPhotos();
}

function setGoalW() { const v = parseFloat($('p-goalw').value); if (!v) return toast('اكتب الوزن المستهدف'); S.profile.goalW = v; save(); toast('اتحفظ الهدف ✓'); renderProg(); }

// ----- القوة -----
function renderStrength() {
  const rec = recovery();
  $('p-recov').innerHTML = `<div class="chips" style="flex-wrap:wrap">${Object.keys(MUSCLES).map(m => {
    const v = rec[m], c = v >= 80 ? '--green' : v >= 50 ? '--yellow' : '--red';
    return `<span class="chip" style="border-color:color-mix(in srgb,var(${c}) 45%,transparent)"><b style="color:var(${c})">${v}%</b> ${MUSCLES[m]}</span>`;
  }).join('')}</div><p class="mute" style="margin:10px 0 0">محسوبة من المجموعات اللي عملتها في آخر 5 أيام. الأخضر جاهز، والأحمر لسه محتاج راحة.</p>`;

  const bw = curWeight();
  const std = STANDARDS.map(([id, lv]) => {
    const ss = exSessions(id); if (!ss.length) return null;
    const best = Math.max(...ss.map(x => x.v)), r = best / bw, lvl = lv.filter(x => r >= x).length;
    const next = lv[lvl], toNext = next ? Math.ceil(next * bw - best) : 0;
    return `<li><div><div>${esc(exInfo(id).ar)}</div><div class="mute">1RM تقديري ${Math.round(best)} كجم${EX[id].eq === 'db' ? ' لكل دمبل' : ''}${next ? `، فاضل ${toNext} كجم للمستوى الجاي` : ''}</div></div>
      <span class="tag ${lvl >= 2 ? 'acc' : lvl === 1 ? 'blue' : ''}">${LEVELS[lvl]}</span></li>`;
  }).filter(Boolean);
  $('p-std').innerHTML = std.join('') || '<li class="mute">سجّل تمارين زي البنش والسكوات والديدلفت وضغط الكتف، وهيظهرلك مستواك مقارنة بوزنك.</li>';

  const ids = [...new Set(S.workouts.flatMap(w => w.ex.map(e => e.id)))].filter(id => !isCardio(id));
  const since = addDays(today(), -28);
  const list = ids.map(id => {
    const ss = exSessions(id), best = Math.max(...ss.map(x => x.v)), old = ss.filter(x => x.d < since), recent = ss.filter(x => x.d >= since);
    const ch = old.length && recent.length ? pctChange(Math.max(...recent.map(x => x.v)), Math.max(...old.map(x => x.v))) : null;
    return { id, ss, best, ch, last: ss.at(-1)?.d || '' };
  }).sort((a, b) => b.last.localeCompare(a.last));
  const exRows = list.slice(0, exAll ? 99 : 8).map(x => `<li onclick="exDetail('${x.id}')" style="cursor:pointer"><div style="min-width:0"><div>${esc(exInfo(x.id).ar)}</div>
      <div class="mute">${Math.round(x.best)} كجم${x.ch != null ? `، <span class="${x.ch >= 0 ? 'green' : 'red'}">${x.ch > 0 ? '+' : ''}${x.ch}% في 4 أسابيع</span>` : ''}</div></div>
      ${sparkline(x.ss.slice(-10).map(s => s.v))}</li>`).join('');
  $('p-exlist').innerHTML = (exRows || '<li class="mute">لسه مفيش تمارين متسجلة.</li>')
    + (list.length > 8 ? `<li><button class="g w" onclick="exAll=!exAll;renderProg()">${exAll ? 'اعرض أقل' : `اعرض كل التمارين (${list.length})`}</button></li>` : '');

  const weeks = [...Array(8)].map((_, i) => addDays(weekStart(today()), -(7 - i) * 7));
  $('p-volw').innerHTML = barChart(weeks.map(ws => ({ l: fmtShort(ws), v: weekStats(ws).sets, c: '--blue' })), 0, 'مجموعة');

  const v = weeklyVolume(), scale = 30;
  $('p-vol').innerHTML = Object.keys(MUSCLES).map(m => {
    const [lo, hi] = VOLUME[m], val = v[m], cls = val < lo ? 'low' : val > hi * 1.15 ? 'hi' : '';
    return `<div class="vol"><span>${MUSCLES[m]}${FOCUS.includes(m) ? ' ★' : ''}</span>
      <div class="track"><div class="band" style="right:${lo / scale * 100}%;width:${(hi - lo) / scale * 100}%"></div><div class="fill ${cls}" style="width:${Math.min(100, val / scale * 100)}%"></div></div>
      <b class="ltr" style="font-weight:600">${num(val)}</b></div>`;
  }).join('');

  const start = addDays(weekStart(today()), -77), t = today(), days = new Set(S.workouts.map(w => w.date));
  $('p-heat').innerHTML = Array.from({ length: 84 }, (_, i) => { const d = addDays(start, i); return `<i class="${d > t ? 'fut' : days.has(d) ? 'on' : ''}" title="${d}"></i>`; }).join('');

  $('p-prs').innerHTML = prTimeline().slice(0, 10).map(x => `<li><div><div>${esc(exInfo(x.id).ar)}</div><div class="mute">${fmtShort(x.d)}</div></div><b class="green ltr">${x.s.w} kg × ${x.s.r}</b></li>`).join('')
    || '<li class="mute">أول ما تكسر رقم في أي تمرين هيظهر هنا.</li>';
}
// صفحة التمرين (فكرة Hevy)
function exDetail(id) {
  const X = exInfo(id), ss = exSessions(id), all = S.workouts.filter(w => w.ex.some(e => e.id === id));
  const bestSet = all.flatMap(w => w.ex.filter(e => e.id === id).flatMap(e => e.sets)).reduce((a, s) => !a || e1rm(s.w, s.r) > e1rm(a.w, a.r) ? s : a, null);
  const heaviest = Math.max(...all.flatMap(w => w.ex.filter(e => e.id === id).flatMap(e => e.sets.map(s => s.w))));
  const vol = all.reduce((a, w) => a + w.ex.filter(e => e.id === id).reduce((b, e) => b + e.sets.reduce((c, s) => c + s.w * s.r, 0), 0), 0);
  openSheet(`<div class="grip"></div><h3>${esc(X.ar)}</h3><p class="mute ltr" style="margin:0 0 12px;text-align:right">${esc(X.n)}</p>
    <div class="grid3"><div class="stat"><b>${Math.round(Math.max(...ss.map(x => x.v)))}</b><span>أقصى 1RM</span></div>
      <div class="stat"><b>${heaviest}</b><span>أتقل وزن</span></div><div class="stat"><b>${all.length}</b><span>مرة</span></div></div>
    <p class="mute" style="margin:10px 0">أحسن مجموعة: <b class="ltr">${bestSet.w} kg × ${bestSet.r}</b>، وإجمالي الحجم ${Math.round(vol).toLocaleString('en')} كجم.</p>
    <div class="card" style="padding:12px">${lineChart(ss.map(x => ({ d: x.d, y: x.v })))}</div>
    <h2 style="margin-top:14px">السجل</h2>
    <ul class="list">${all.slice().reverse().slice(0, 15).map(w => { const e = w.ex.find(y => y.id === id); return `<li><span class="mute">${fmtShort(w.date)}${w.deload ? ' (خفيف)' : ''}</span><span class="ltr">${e.sets.map(s => `${s.w}×${s.r}`).join('  ')}</span></li>`; }).join('')}</ul>`);
}

// ----- الأكل -----
function renderNutri() {
  const tg = targets(), days = [...Array(14)].map((_, i) => addDays(today(), i - 13));
  const tot = days.map(d => ({ d, t: mealTotals(d), on: S.meals.some(m => m.date === d) }));
  $('p-kbars').innerHTML = barChart(tot.map(x => ({ l: String(toDate(x.d).getDate()), v: x.t.k, c: !x.on ? '--line' : Math.abs(x.t.k - tg.kcal) <= tg.kcal * 0.1 ? '--green' : x.t.k > tg.kcal ? '--red' : '--yellow' })), tg.kcal, 'سعرة');
  $('p-pbars').innerHTML = barChart(tot.map(x => ({ l: String(toDate(x.d).getDate()), v: x.t.p, c: x.t.p >= tg.pro * 0.9 ? '--blue' : '--line' })), tg.pro, 'جم');

  const logged = tot.filter(x => x.on), last30 = [...Array(30)].map((_, i) => addDays(today(), -i)).filter(d => S.meals.some(m => m.date === d));
  let streak = 0; for (let i = S.meals.some(m => m.date === today()) ? 0 : 1; S.meals.some(m => m.date === addDays(today(), -i)); i++) streak++;
  const a = k => avg(logged.map(x => x.t[k])) || 0, kc = a('p') * 4 + a('c') * 4 + a('f') * 9 || 1;
  $('p-nstats').innerHTML = `<div class="grid2">
    <div class="stat"><b>${logged.length ? Math.round(a('k')) : '—'}</b><span>متوسط السعرات (14 يوم)</span></div>
    <div class="stat"><b>${logged.length ? Math.round(a('p')) : '—'}</b><span>متوسط البروتين</span></div>
    <div class="stat"><b>${streak}</b><span>أيام ورا بعض بتسجّل أكلك</span></div>
    <div class="stat"><b>${last30.length}</b><span>يوم متسجل من آخر 30</span></div></div>
    ${logged.length ? `<div style="margin-top:14px"><div class="mute" style="margin-bottom:6px">توزيع السعرات على الماكروز</div>
      <div style="display:flex;height:14px;border-radius:99px;overflow:hidden">${[['p', '--blue', 4], ['c', '--yellow', 4], ['f', '--green', 9]].map(([k, c, m]) => `<i style="width:${a(k) * m / kc * 100}%;background:var(${c})"></i>`).join('')}</div>
      <div class="row mute" style="margin-top:6px"><span class="blue">بروتين ${Math.round(a('p') * 4 / kc * 100)}%</span><span class="yellow">كارب ${Math.round(a('c') * 4 / kc * 100)}%</span><span class="green">دهون ${Math.round(a('f') * 9 / kc * 100)}%</span></div></div>` : ''}`;

  // أكتر أكلات بتجيب منها سعرات (آخر 30 يوم)
  const since = addDays(today(), -30), map = {};
  S.meals.filter(m => m.date >= since).forEach(m => (m.items && m.items.length ? m.items.map(it => [it.c ? it.c.n : (foodById(it.id) || {}).n || '؟', itemMacros(it).k]) : [[m.name, m.k]]).forEach(([n, k]) => map[n] = (map[n] || 0) + k));
  const top = Object.entries(map).sort((x, y) => y[1] - x[1]).slice(0, 6), sum = Object.values(map).reduce((x, y) => x + y, 0) || 1;
  $('p-top').innerHTML = top.map(([n, k]) => `<li><span>${esc(n.length > 34 ? n.slice(0, 32) + '…' : n)}</span><span class="mute">${Math.round(k / sum * 100)}% من سعراتك</span></li>`).join('')
    || '<li class="mute">سجّل أكلك وهتعرف أكتر حاجة بتجيب منها سعرات.</li>';
}
