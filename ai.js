// ================= الذكاء الاصطناعي (اختياري، عن طريق OpenRouter) =================
// المفتاح بيتحفظ على التلفون بس ومبيتصدّرش في النسخة الاحتياطية.
// الـ AI بيفهم الكلام والصور ويحوّلهم لأصناف؛ الحسابات كلها بتفضل من قاعدة الأكل بتاعتنا.

const OR = 'https://openrouter.ai/api/v1';
// ترتيب التفضيل: رخيص، بيفهم عربي كويس، وبيقرا الصور
const AI_PREF = ['google/gemini-2.5-flash-lite', 'google/gemini-2.0-flash-lite-001', 'google/gemini-2.0-flash-001', 'google/gemini-2.5-flash', 'openai/gpt-4.1-nano', 'openai/gpt-4o-mini', 'openai/gpt-4.1-mini'];
const aiOn = () => !!(S.ai && S.ai.key);
const aiModel = () => S.ai.model || (S.ai.models && S.ai.models.find(m => m.rec) || {}).id || AI_PREF[0];

class AIError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const AI_MSG = {
  nokey: 'ضيف مفتاح OpenRouter من الإعدادات الأول.',
  offline: 'مفيش نت دلوقتي. الميزة دي محتاجة نت، وباقي التطبيق شغال عادي.',
  key: 'المفتاح مش صحيح أو اتلغى. راجعه في الإعدادات.',
  credit: 'رصيدك في OpenRouter خلص أو قليل. اشحن من openrouter.ai/credits.',
  rate: 'طلبات كتير ورا بعض. استنى دقيقة وجرّب تاني.',
  timeout: 'الرد اتأخر أكتر من اللازم. جرّب تاني.',
  server: 'سيرفر الموديل فيه مشكلة دلوقتي. جرّب تاني بعد شوية أو اختار موديل تاني من الإعدادات.',
  model: 'الموديل ده مش متاح. اختار موديل تاني من الإعدادات.',
  parse: 'الموديل رد بشكل مش مفهوم. جرّب تاني.',
  net: 'مقدرتش أوصل لـ OpenRouter. اتأكد من النت وجرّب تاني.'
};
const aiErrText = e => (e && AI_MSG[e.code]) || AI_MSG.net;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// طلب واحد: مهلة انتظار، وإعادة محاولة لوحدها للأخطاء المؤقتة، وتتبع التكلفة
async function callAI(messages, { maxTokens = 600, timeout = 35000, json = true } = {}) {
  if (!aiOn()) throw new AIError('nokey');
  if (!navigator.onLine) throw new AIError('offline');
  const model = aiModel(), valid = (S.ai.models || []).map(m => m.id);
  const body = { model, messages, max_tokens: maxTokens, temperature: 0.2, usage: { include: true } };
  // موديلات احتياطية لو الأساسي وقع (بنستخدم بس اللي اتأكدنا إنها موجودة)
  const fb = AI_PREF.filter(m => m !== model && valid.includes(m)).slice(0, 2);
  if (fb.length) body.models = [model, ...fb];
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(`${OR}/chat/completions`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'Authorization': `Bearer ${S.ai.key}`, 'Content-Type': 'application/json', 'X-Title': 'Gym Coach' },
        body: JSON.stringify(body)
      });
      clearTimeout(t);
      if (r.status === 401 || r.status === 403) throw new AIError('key');
      if (r.status === 402) throw new AIError('credit');
      if (r.status === 400 || r.status === 404) { const tx = await r.text(); throw new AIError(/model/i.test(tx) ? 'model' : 'server', tx); }
      if (r.status === 429) { last = new AIError('rate'); await sleep(2500 * (attempt + 1)); continue; }
      if (!r.ok) { last = new AIError('server'); await sleep(1500 * (attempt + 1)); continue; }
      const d = await r.json();
      if (d.error) { last = new AIError(d.error.code === 402 ? 'credit' : 'server', d.error.message); if (d.error.code === 402) throw last; await sleep(1500); continue; }
      const text = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '';
      const cost = +(d.usage && d.usage.cost) || 0;
      S.ai.calls = (S.ai.calls || 0) + 1; S.ai.spent = (S.ai.spent || 0) + cost; S.ai.lastCost = cost; save();
      if (!json) return text;
      const obj = parseJSON(text);
      if (!obj) { last = new AIError('parse'); continue; }
      return obj;
    } catch (e) {
      clearTimeout(t);
      if (e instanceof AIError && ['key', 'credit', 'model', 'nokey', 'offline'].includes(e.code)) throw e;
      last = e.name === 'AbortError' ? new AIError('timeout') : e instanceof AIError ? e : new AIError('net');
      if (attempt < 2) await sleep(1200 * (attempt + 1));
    }
  }
  throw last || new AIError('net');
}
function parseJSON(t) {
  if (!t) return null;
  t = String(t).replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

// ===== 1) تسجيل الأكل بالكلام =====
// عشان نوفّر: بنبعت بس الأصناف القريبة من كلامك (مش القاعدة كلها)
function foodCandidates(text) {
  const ws = words(text), seen = new Map();
  const add = f => { if (!seen.has(f.id)) seen.set(f.id, f); };
  ws.forEach((w, i) => { searchFoods(w).slice(0, 6).forEach(add); if (w.startsWith('و') && w.length > 3) searchFoods(w.slice(1)).slice(0, 6).forEach(add); if (ws[i + 1]) searchFoods(w + ' ' + ws[i + 1]).slice(0, 3).forEach(add); });
  FOODS.filter(f => POPULAR.has(f.id)).forEach(add);
  return [...seen.values()].slice(0, 70);
}
// الوجبة من كلامك: "على الغدا" / "فطرت" …
function slotFromText(t) {
  t = normAr(t);
  if (/فطار|فطور|فطرت|الصبح/.test(t)) return 'b';
  if (/غدا|اتغديت/.test(t)) return 'l';
  if (/عشا|اتعشيت|بالليل/.test(t)) return 'd';
  if (/سناك|تصبير|بين الوجبات/.test(t)) return 's';
  return null;
}

// ----- من غير AI: فهم بسيط للجملة (كميات ووحدات وأصناف) -----
const NUMW = { 'واحد': 1, 'واحده': 1, 'وحده': 1, 'اتنين': 2, 'اثنين': 2, 'تلاته': 3, 'ثلاثه': 3, 'تلات': 3, 'اربعه': 4, 'اربع': 4, 'خمسه': 5, 'خمس': 5, 'سته': 6, 'نص': 0.5, 'نصف': 0.5, 'ربع': 0.25, 'تلت': 0.33 };
const UNITW = ['رغيف', 'بيضه', 'بيضات', 'طبق', 'اطباق', 'كوبايه', 'كوبايات', 'علبه', 'معلقه', 'معالق', 'حبه', 'حبات', 'شريحه', 'قطعه', 'حته', 'كيس', 'سكوب', 'صباع', 'كيلو', 'جرام', 'جم', 'ك'];
const SIZEW = ['صغير', 'صغيره', 'وسط', 'متوسط', 'متوسطه', 'كبير', 'كبيره'];
// كلمة بتبدأ بيها أصناف فعلًا (مش مجرد تشابه بعيد)
const strongWord = w => { w = stripAl(normAr(w)); return w.length >= 2 && [...(S.myFoods || []), ...FOODS].some(f => { f._n = f._n || words(f.n); f._a = f._a || words(f.al); return f._n.some(x => x.startsWith(w)) || f._a.some(x => x.startsWith(w)); }); };
// لو الاسم كله مش لاقيه، نجرّب نشيل كلمات زيادة من الآخر
function bestFood(ws) {
  for (let n = ws.length; n >= 1; n--) { const f = searchFoods(ws.slice(0, n).join(' '))[0]; if (f) return f; }
  for (let i = 1; i < ws.length; i++) { const f = searchFoods(ws.slice(i).join(' '))[0]; if (f) return f; }
  return null;
}
function localParse(text) {
  const raw = normAr(text).replace(/[:؛;!?؟.…"'()]/g, ' ').replace(/(\d)([^\d\s.])/g, '$1 $2');
  // نقسّم على الفواصل و"مع"، وعلى "و" اللي في أول الكلمة لو اللي بعدها أكل
  const parts = [];
  raw.split(/[،,+\n]|\sمع\s|\sو\s/).forEach(chunk => {
    let cur = [];
    chunk.split(/\s+/).filter(Boolean).forEach(w => {
      const tail = w.slice(1), tb = tail.replace(/^ال/, '');
      const unitish = UNITW.includes(tb) || NUMW[tb] != null || (tb.endsWith('ين') && UNITW.some(u => u.startsWith(tb.slice(0, -2).replace(/ت$/, 'ه'))));
      if (w.length >= 2 && w.startsWith('و') && !strongWord(w) && (strongWord(tail) || /^\d/.test(tail) || unitish)) { if (cur.length) parts.push(cur); cur = [tail]; }
      else cur.push(w);
    });
    if (cur.length) parts.push(cur);
  });
  const items = [], missed = [];
  parts.forEach(ws => {
    let qty = null, unit = null, size = null; const rest = [];
    ws.forEach(w => {
      const bare = w.replace(/^ال/, '');
      if (/^\d+(\.\d+)?$/.test(w)) qty = (qty || 1) * +w;
      else if (NUMW[bare] != null) qty = (qty || 1) * NUMW[bare];
      else if (UNITW.includes(bare)) unit = bare;
      else if (SIZEW.includes(bare) && rest.length) size = bare.slice(0, 3);
      else if (bare.length > 3 && bare.endsWith('ين') && UNITW.some(u => u.startsWith(bare.slice(0, -2).replace(/ت$/, 'ه')) || u.startsWith(bare.slice(0, -2)))) { unit = bare.slice(0, -2); qty = (qty || 1) * 2; }
      else if (bare.length > 3 && bare.endsWith('ين') && !UNITW.some(u => u.startsWith(bare.slice(0, -2).replace(/ت$/, 'ه')))) {
        // مثنى الأكل نفسه: "موزتين" = 2 موز، "تفاحتين" = 2 تفاح
        const base = [bare.slice(0, -2).replace(/ت$/, 'ه'), bare.slice(0, -2).replace(/ت$/, ''), bare.slice(0, -2)].find(strongWord);
        if (base) { qty = (qty || 1) * 2; rest.push(base); } else rest.push(w);
      }
      else if (/^(اكلت|كلت|فطرت|اتغديت|اتعشيت|شربت|علي|على|غدا|غداء|للغدا|للغداء|فطار|فطور|للفطار|عشا|عشاء|للعشا|للعشاء|سناك|للسناك|وجبه|حوالي|تقريبا|من|في|النهارده|انهارده|ضيف|ضيفهم|ضيفها|ضيفلي|حط|حطهم|سجل|سجلهم|سجلها|دول|ده|دي)$/.test(bare)) {}
      else rest.push(w);
    });
    // "بيضتين" أو "رغيفين": الوحدة هي نفسها الأكل
    if (!rest.length && unit && !['كيلو', 'جرام', 'جم', 'ك'].includes(unit)) rest.push(unit);
    const name = rest.join(' ');
    if (!name) return;
    const f = bestFood(rest);
    if (!f) { missed.push(name); return; }
    qty = qty || 1;
    let u = f.por.length ? 0 : -1, q = f.por.length ? qty : 100 * qty;
    if (unit === 'كيلو' || unit === 'ك') { u = -1; q = Math.round(qty * 1000); }
    else if (unit === 'جرام' || unit === 'جم') { u = -1; q = qty; }
    else if (unit || size) {
      const k = f.por.findIndex(p => { const pn = normAr(p[0]); return (!unit || pn.includes(unit.slice(0, 3))) && (!size || pn.includes(size)); });
      const k2 = k >= 0 ? k : f.por.findIndex(p => unit && normAr(p[0]).includes(unit.slice(0, 3)));
      if (k2 >= 0) u = k2;
    }
    items.push({ id: f.id, q: num(q), u });
  });
  return { items, missed };
}

let aiBusy = false;
async function aiParseFood() {
  const box = $('ai-in'), txt = box.value.trim(), out = $('ai-out');
  if (!txt) return toast('اكتب أكلت إيه الأول');
  if (aiBusy) return; aiBusy = true;
  const btn = $('ai-go'); btn.disabled = true; btn.textContent = aiOn() ? 'بفهم…' : '…'; out.innerHTML = '';
  const slot = slotFromText(txt); if (slot) FB.slot = slot;
  const done = (items, note) => {
    FB.items.push(...items); box.value = ''; renderBuilder();
    $('ai-out').innerHTML = note || '';
    toast(`اتضاف ${items.length} أصناف في ${SLOTS[FB.slot]}. راجعهم وسجّل`);
    $('sheet-c').scrollTo({ top: 0, behavior: 'smooth' });
  };
  const missedNote = m => m.length ? `<p class="mute" style="font-size:13px;margin:6px 0">مش لاقي: <b>${m.map(esc).join('، ')}</b>. دوّر عليه تحت أو ضيفه لأكلاتي.</p>` : '';
  try {
    if (!aiOn()) {
      const r = localParse(txt);
      if (!r.items.length) { out.innerHTML = `<p class="mute">مفهمتش أصناف من الكلام ده. اكتبها مفصولة بـ"و" أو فاصلة، مثلًا: "طبق رز بالشعرية و150 جم لحمة مطبوخة".</p>${missedNote(r.missed)}`; return; }
      return done(r.items, missedNote(r.missed));
    }
    const cands = foodCandidates(txt);
    const list = cands.map(f => `${f.id}|${f.n}|${f.por.map(p => p[0] + ' ' + p[1] + 'جم').join('،') || '-'}`).join('\n');
    const r = await callAI([
      { role: 'system', content: 'أنت مساعد تغذية مصري. حوّل وصف الأكل بالعامية المصرية لقائمة أصناف. استخدم الـ id من القائمة لو الصنف موجود، الأكل اللي بيتاكل مطبوخ اختارله الصنف المكتوب عليه (مطبوخ) أو المطبوخ، واستخدم الصنف (ني) بس لو الكلام قال صراحة إنه ني أو اتوزن قبل الطبخ. الكمية بالحصة المكتوبة في القائمة أو بالجرام، ولو الكمية مش مذكورة خمّن حصة عادية لشخص واحد. لو صنف مش موجود خالص حط id=null واكتب اسمه ووزنه التقريبي بالجرام وتقدير سعرات وبروتين وكارب ودهون للكمية دي. رد بـ JSON بس: {"items":[{"id":"rice_egy","qty":1,"unit":"طبق","name":"رز بالشعرية","grams":null,"est":null}]} والوحدة يا إما اسم حصة من القائمة يا إما "جم". متخترعش أصناف مش مذكورة.' },
      { role: 'user', content: `القائمة (id|الاسم|الحصص):\n${list}\n\nالكلام: ${txt}` }
    ], { maxTokens: 600 });
    const saved = [];
    const items = (r.items || []).map(x => {
      const f = x.id && foodById(x.id), q = Math.max(0, +x.qty || 0);
      if (f) {
        const u = /^(جم|جرام|g|gram)/i.test(x.unit || '') ? -1 : Math.max(0, f.por.findIndex(p => p[0] === x.unit));
        return { id: f.id, q: q || (u < 0 ? 100 : 1), u: f.por.length ? u : -1 };
      }
      // صنف مش موجود: بنحفظه في "أكلاتي" بتقدير الـ AI عشان المرة الجاية يبقى موجود
      if (x.est && +x.est.k && x.name) {
        const g = +x.grams > 0 ? +x.grams : 100, per = v => num((+v || 0) * 100 / g);
        const nf = { id: 'my:' + uid(), n: x.name, al: '', cat: 'my', k: Math.round(+x.est.k * 100 / g), p: per(x.est.p), c: per(x.est.c), f: per(x.est.f), por: [[x.unit && !/^(جم|جرام)/.test(x.unit) ? x.unit : 'حصة', g]], src: 'تقدير AI' };
        keepFood(nf); saved.push(nf.n);
        return { id: nf.id, q: 1, u: 0 };
      }
      return null;
    }).filter(Boolean);
    if (!items.length) { out.innerHTML = '<p class="mute">مفهمتش أصناف من الكلام ده. جرّب تكتبها أوضح، مثلًا: "طبق رز بالشعرية وقطعة لحمة مطبوخة".</p>'; return; }
    done(items, saved.length ? `<p class="mute" style="font-size:13px;margin:6px 0">✨ ضفت لـ"أكلاتي" بتقدير AI: <b>${saved.map(esc).join('، ')}</b>. المرة الجاية هتلاقيهم في البحث.</p>` : '');
  } catch (e) {
    // لو الـ AI فشل، نجرّب الفهم البسيط عشان متقفش
    const r = localParse(txt);
    if (r.items.length) done(r.items, `<p class="warn" style="font-size:13px;margin:6px 0">${aiErrText(e)} فضفتهم بالفهم البسيط، راجع الكميات.</p>${missedNote(r.missed)}`);
    else out.innerHTML = `<p class="warn" style="font-size:13px;margin:6px 0">${aiErrText(e)}</p>`;
  } finally { aiBusy = false; btn.disabled = false; btn.textContent = 'ضيف'; }
}
// إدخال بالصوت (ببلاش، من المتصفح نفسه)
function aiVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('الإدخال بالصوت مش متاح في المتصفح ده');
  const r = new SR(); r.lang = 'ar-EG'; r.interimResults = false;
  const b = $('ai-mic'); b.textContent = '🎙️…';
  r.onresult = e => { $('ai-in').value = ($('ai-in').value + ' ' + e.results[0][0].transcript).trim(); };
  r.onend = () => { b.textContent = '🎤'; };
  r.onerror = () => { b.textContent = '🎤'; toast('مسمعتش كويس، جرّب تاني'); };
  r.start();
}

// ===== 2) صورة جدول القيم الغذائية =====
function shrinkImage(file, max = 1024) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => rej(new Error('img')); img.src = url;
  });
}
async function aiLabel(inp) {
  const file = inp.files[0]; inp.value = '';
  if (!file) return;
  if (aiBusy) return; aiBusy = true;
  const out = $('ai-out'); out.innerHTML = '<p class="mute">بقرا جدول القيم…</p>';
  try {
    const data = await shrinkImage(file);
    const r = await callAI([
      { role: 'system', content: 'اقرا جدول القيم الغذائية من الصورة. رجّع القيم لكل 100 جم (أو 100 مل). لو الجدول مكتوب للحصة بس، حوّله لكل 100 جم باستخدام وزن الحصة. رد بـ JSON بس: {"name":"اسم المنتج بالعربي لو باين","per100":{"k":0,"p":0,"c":0,"f":0},"serving_g":0,"ok":true}. لو الصورة مش جدول قيم غذائية رجّع {"ok":false}.' },
      { role: 'user', content: [{ type: 'text', text: 'اقرا الجدول ده.' }, { type: 'image_url', image_url: { url: data } }] }
    ], { maxTokens: 300, timeout: 45000 });
    if (!r.ok || !r.per100 || !(+r.per100.k >= 0)) { out.innerHTML = '<p class="warn" style="font-size:13px">مقدرتش أقرا جدول قيم غذائية من الصورة. صوّره قريب وواضح ومن غير انعكاس.</p>'; return; }
    // بنملى خانات "ضيفه لأكلاتي" عشان تراجع قبل الحفظ
    $('fb-new').open = true;
    $('fm-n').value = r.name || '';
    $('fm-per').value = '100';
    ['k', 'p', 'c', 'f'].forEach(k => $('fm-' + k).value = Math.round((+r.per100[k] || 0) * 10) / 10);
    FB.labelServing = +r.serving_g || 0;
    out.innerHTML = `<p class="mute" style="margin:6px 0">قريت الجدول ✓ راجع القيم تحت${r.serving_g ? ` (الحصة ${r.serving_g} جم)` : ''} واكتب اسم المنتج، وبعدين دوس "احفظ وضيفه للوجبة".</p>`;
    $('fb-new').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    out.innerHTML = `<p class="warn" style="font-size:13px">${e.message === 'img' ? 'مقدرتش أفتح الصورة.' : aiErrText(e)}</p>`;
  } finally { aiBusy = false; }
}
// الجزء اللي بيتحط فوق شيت تسجيل الوجبة
function aiFoodBlock() {
  return `<div class="card" style="padding:12px;margin:0 0 10px">
    <div class="row"><input id="ai-in" placeholder="${aiOn() ? '✨' : '✍️'} اكتب أو قول أكلت إيه: طبق رز بالشعرية وقطعة لحمة" onkeydown="if(event.key==='Enter')aiParseFood()">
      <button class="fit" id="ai-mic" onclick="aiVoice()" aria-label="اتكلم">🎤</button></div>
    <div class="row" style="margin-top:8px"><button class="p" id="ai-go" onclick="aiParseFood()">ضيف</button>
      ${aiOn() ? `<button onclick="$('ai-cam').click()">📷 صوّر جدول القيم</button>` : ''}</div>
    ${aiOn() ? '' : '<p class="mute" style="margin:6px 0 0;font-size:12px">شغال من غير AI بفهم بسيط. مع مفتاح AI (من الإعدادات) بيفهم أي كلام وبيقدّر الأكل المش موجود.</p>'}
    <input type="file" id="ai-cam" accept="image/*" capture="environment" class="hide" onchange="aiLabel(this)">
    <div id="ai-out"></div></div>
    <p class="mute" style="font-size:12px;margin:-2px 0 10px">⚖️ لو بتوزن بالجرام: اختار <b>(ني)</b> لو وزنت قبل الطبخ، و<b>(مطبوخ)</b> لو وزنت بعده. 100 جم رز ني بتبقى حوالي 300 جم مطبوخ، فالفرق في السعرات كبير. ولو بتسجّل بالطبق أو الكوباية، اختار المطبوخ.</p>`;
}
// من صفحة الأكل على طول: تكتب وتدوس، وتفتح الوجبة جاهزة
function quickLog() {
  const t = $('q-in').value.trim(); if (!t) return toast('اكتب أكلت إيه');
  openBuilder([], slotFromText(t) || defaultSlot());
  $('ai-in').value = t; $('q-in').value = ''; aiParseFood();
}
function quickVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('الإدخال بالصوت مش متاح في المتصفح ده');
  const r = new SR(); r.lang = 'ar-EG'; const b = $('q-mic'); b.textContent = '🎙️…';
  r.onresult = e => { $('q-in').value = e.results[0][0].transcript; quickLog(); };
  r.onend = () => { b.textContent = '🎤'; }; r.onerror = () => { b.textContent = '🎤'; toast('مسمعتش كويس، جرّب تاني'); };
  r.start();
}

// ===== 3) شرح المراجعة الأسبوعية =====
async function aiCheckinText(c) {
  const st = weekStats(c.week), tg = targets();
  const payload = {
    goal: GOALS[S.profile.goal].ar, weight: num(curWeight()), weekly_rate_kg: weeklyRate() != null ? num(weeklyRate()) : null,
    targets: { kcal: tg.kcal, protein: tg.pro, steps: S.profile.stepsGoal },
    week: { score: st.score, workouts: st.workouts, sets: st.sets, avg_kcal: st.avgK && Math.round(st.avgK), avg_protein: st.avgP && Math.round(st.avgP), protein_days: st.pHit, logged_days: st.logged, steps_avg: st.stepsAvg && Math.round(st.stepsAvg), cardio_min: st.cMin, prs: st.prs },
    changes: c.changes.map(x => x.t + ' — ' + x.why), notes: c.notes
  };
  try {
    const r = await callAI([
      { role: 'system', content: 'أنت مدرب لياقة وتغذية مصري محترف وبتتكلم بالعامية المصرية بشكل ودود ومختصر. هتاخد ملخص أسبوع المتدرب والتعديلات اللي اتعملت. اكتب: جملتين عن أداء الأسبوع، وبعدين 3 نصايح عملية للأسبوع الجاي. متخترعش أرقام مش موجودة ومتغيّرش التعديلات. رد بـ JSON: {"summary":"...","tips":["...","...","..."]}' },
      { role: 'user', content: JSON.stringify(payload) }
    ], { maxTokens: 450 });
    c.ai = { text: [r.summary, ...(r.tips || []).map(t => '• ' + t)].filter(Boolean).join('\n') };
  } catch (e) { c.ai = { err: aiErrText(e) }; }
  save();
  return c;
}

// ===== الإعدادات =====
async function loadModels() {
  const box = $('ai-models');
  box.innerHTML = '<option>بجيب الموديلات وأسعارها…</option>';
  try {
    const r = await (await fetch(`${OR}/models`)).json();
    const list = (r.data || []).filter(m => (m.architecture && (m.architecture.input_modalities || []).includes('image')) && +m.pricing.prompt >= 0)
      .map(m => ({ id: m.id, in: +m.pricing.prompt * 1e6, out: +m.pricing.completion * 1e6, free: m.id.endsWith(':free') }))
      .filter(m => m.in <= 1 && (/^(google|openai|anthropic|qwen|meta-llama|mistralai|x-ai)\//.test(m.id)));
    const recId = AI_PREF.find(id => list.some(m => m.id === id));
    list.forEach(m => m.rec = m.id === recId);
    list.sort((a, b) => (b.rec - a.rec) || (a.in + a.out) - (b.in + b.out));
    S.ai.models = list.slice(0, 25); save();
  } catch { toast('مقدرتش أجيب قائمة الموديلات. هنستخدم الموديل المقترح.'); }
  renderAISettings();
}
function renderAISettings() {
  const A = S.ai, box = $('ai-set'); if (!box) return;
  const models = A.models || [], cur = aiModel();
  box.innerHTML = `
    <label for="ai-key">مفتاح OpenRouter API</label>
    <div class="row"><input id="ai-key" type="password" autocomplete="off" placeholder="${A.key ? '•••• محفوظ (اكتب مفتاح جديد لو عايز تغيّره)' : 'sk-or-v1-...'}">
      <button class="p fit" onclick="saveAIKey()">احفظ</button></div>
    ${A.key ? `<div class="row" style="margin-top:12px"><div><label for="ai-models">الموديل</label>
      <select id="ai-models" onchange="S.ai.model=this.value;save()">${models.length ? models.map(m => `<option value="${m.id}" ${m.id === cur ? 'selected' : ''}>${m.rec ? '⭐ ' : ''}${m.id}، $${m.in.toFixed(2)} / $${m.out.toFixed(2)}</option>`).join('') : `<option>${esc(cur)}</option>`}</select></div>
      <button class="fit" style="align-self:flex-end" onclick="loadModels()">حدّث القائمة</button></div>
      <p class="mute" style="margin:6px 0 0">الأسعار بالدولار لكل مليون توكن (دخل / خرج). ⭐ = المقترح: رخيص وبيفهم عربي وبيقرا الصور.</p>
      <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" style="width:auto;min-height:0" ${A.weekly !== false ? 'checked' : ''} onchange="S.ai.weekly=this.checked;save()"> المدرب يكتب شرح للمراجعة الأسبوعية</label>
      <div class="row" style="margin-top:12px"><button onclick="testAI()">اختبر الاتصال والرصيد</button><button class="g del fit" onclick="clearAIKey()">امسح المفتاح</button></div>
      <p class="mute" id="ai-status" style="margin:8px 0 0">استخدمته ${A.calls || 0} مرة، وصرفت حوالي $${(A.spent || 0).toFixed(4)}.${A.lastCost ? ` آخر عملية كلّفت $${A.lastCost.toFixed(5)}.` : ''}</p>` : ''}`;
}
function saveAIKey() {
  const k = $('ai-key').value.trim();
  if (!/^sk-or-/.test(k)) return toast('المفتاح لازم يبدأ بـ sk-or-');
  S.ai.key = k; save(); toast('اتحفظ المفتاح على تلفونك ✓'); loadModels();
}
function clearAIKey() { if (!confirm('تمسح المفتاح من التلفون؟')) return; S.ai.key = ''; save(); renderAISettings(); }
async function testAI() {
  const st = $('ai-status'); st.textContent = 'بختبر…';
  try {
    let bal = '';
    try {
      const r = await fetch(`${OR}/credits`, { headers: { Authorization: `Bearer ${S.ai.key}` } });
      if (r.status === 401) throw new AIError('key');
      const d = (await r.json()).data;
      if (d) bal = ` رصيدك الباقي حوالي $${(d.total_credits - d.total_usage).toFixed(2)}.`;
    } catch (e) { if (e.code === 'key') throw e; }
    const r = await callAI([{ role: 'user', content: 'رد بـ JSON بس: {"ok":true}' }], { maxTokens: 20 });
    st.textContent = r.ok ? `✓ الاتصال شغال بـ ${aiModel()}.${bal}` : 'الموديل رد بس بشكل غريب. جرّب موديل تاني.';
  } catch (e) { st.textContent = '✗ ' + aiErrText(e); }
}

// ===== 4) اسأل المدرب: أسئلة عن بياناتك انت (مش شات عام) =====
// بنبعت ملخص صغير لبياناتك مع كل سؤال، والمحادثة مش بتتحفظ عشان التكلفة تفضل قليلة
let coachChat = [];
function coachContext() {
  const tg = targets(), ws = weekStart(today()), a = weekStats(addDays(ws, -7)), b = weekStats(ws), tot = mealTotals(today()), rec = recovery();
  const recent = S.workouts.slice(-6).map(w => ({ d: w.date, n: w.name, top: w.ex.filter(e => !isCardio(e.id)).slice(0, 4).map(e => { const s = e.sets.reduce((x, y) => e1rm(y.w, y.r) > e1rm(x.w, x.r) ? y : x, e.sets[0]); return `${exInfo(e.id).ar} ${s.w}×${s.r}`; }) }));
  return {
    today: today(), goal: GOALS[S.profile.goal].ar, height: S.profile.h, bodyfat_start: S.profile.bf,
    weight_trend: num(curWeight()), weekly_rate: weeklyRate() != null ? num(weeklyRate()) : null, goal_weight: S.profile.goalW || null,
    targets: { kcal: tg.kcal, protein: tg.pro, carbs: tg.carb, fat: tg.fat, steps: S.profile.stepsGoal },
    today_eaten: { kcal: tot.k, protein: Math.round(tot.p) }, next_workout: PROGRAM[nextKey()].name,
    last_week: { score: a.score, workouts: a.workouts, avg_kcal: a.avgK && Math.round(a.avgK), avg_protein: a.avgP && Math.round(a.avgP), steps: a.stepsAvg && Math.round(a.stepsAvg) },
    this_week: { score: b.score, workouts: b.workouts },
    plateaus: plateaus().map(x => exInfo(x.id).ar), tired_muscles: Object.keys(rec).filter(m => rec[m] < 50).map(m => MUSCLES[m]),
    recent_workouts: recent, expenditure: expenditure().tdee || null
  };
}
function openCoach() {
  if (!aiOn()) return toast(AI_MSG.nokey);
  const quick = ['ليه وزني مش بينزل أسرع؟', 'آكل إيه باقي النهارده؟', 'إزاي أكسر الثبات في تمرين واقف؟', 'أسبوعي كان عامل إزاي؟'];
  openSheet(`<div class="grip"></div><h3>اسأل المدرب ✨</h3>
    <p class="mute" style="margin:0 0 10px">بيرد على أسئلتك بناءً على أكلك وتمارينك ووزنك انت.</p>
    <div id="co-log" style="max-height:45vh;overflow:auto">${coachChat.map(m => `<div class="${m.role === 'user' ? 'tag' : 'banner'}" style="display:block;margin:6px 0;white-space:pre-line;${m.role === 'user' ? 'font-size:14px;padding:8px 12px' : ''}">${esc(m.content)}</div>`).join('')}</div>
    <div class="chips" style="margin:8px 0;flex-wrap:wrap">${quick.map(q => `<button class="chip" onclick="askCoach(this.textContent)">${q}</button>`).join('')}</div>
    <div class="row"><input id="co-in" placeholder="اكتب سؤالك…" onkeydown="if(event.key==='Enter')askCoach()"><button class="p fit" id="co-go" onclick="askCoach()">اسأل</button></div>`);
  const log = $('co-log'); log.scrollTop = log.scrollHeight;
}
async function askCoach(q) {
  q = (q || $('co-in').value || '').trim(); if (!q || aiBusy) return;
  aiBusy = true; coachChat.push({ role: 'user', content: q }); openCoach();
  $('co-go').disabled = true; $('co-go').textContent = '…';
  try {
    const ans = await callAI([
      { role: 'system', content: 'أنت مدرب لياقة وتغذية مصري محترف. رد بالعامية المصرية، مختصر وعملي (أقل من 120 كلمة)، واعتمد على بيانات المتدرب اللي في JSON. لو السؤال عن أكل اقترح أكل مصري رخيص. متخترعش أرقام مش موجودة، ولو معلومة ناقصة قول كده. لو في عرض طبي زي ألم حاد انصحه يروح لدكتور.\nبيانات المتدرب: ' + JSON.stringify(coachContext()) },
      ...coachChat.slice(-6)
    ], { maxTokens: 450, json: false });
    coachChat.push({ role: 'assistant', content: ans.trim() || 'مفيش رد، جرّب تاني.' });
  } catch (e) { coachChat.push({ role: 'assistant', content: '⚠️ ' + aiErrText(e) }); }
  aiBusy = false; if ($('sheet').open) openCoach();
}
