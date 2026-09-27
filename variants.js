// ================= الأنواع: صنف واحد وجواه اختيارات (ني / مطبوخ / مشوي…) =================
// [id, اسم النوع, معامل] — المعامل = كام جرام من النوع الأساسي بيساوي 1 جم من النوع ده
// مثال: 1 جم رز ني بيطلع 2.75 جم رز مطبوخ، فمعامل الني 2.75. ده اللي بيخلّي التبديل يحافظ على نفس الأكل.
const VARIANTS = [
  { n: 'رز أبيض', v: [['rice', 'مطبوخ', 1], ['rice_raw', 'ني', 2.75]] },
  { n: 'رز بالشعرية', v: [['rice_egy', 'مطبوخ', 1], ['rice_egy_raw', 'ني', 2.5]] },
  { n: 'مكرونة', v: [['pasta', 'مطبوخة', 1], ['pasta_raw', 'ني', 2.3]] },
  { n: 'لحمة', v: [['beef_cooked', 'مطبوخة', 1], ['beef', 'ني', 0.65], ['beef_grill', 'مشوية', 1], ['beef_stew', 'بالصلصة', 1]] },
  { n: 'فراخ', v: [['chick_grill', 'مشوية', 1], ['chick_cooked', 'مسلوقة', 1], ['chick', 'ني', 0.7], ['pane', 'بانيه', 1], ['crispy', 'كريسبي', 1]] },
  { n: 'كبدة فراخ', v: [['liver_cooked', 'مطبوخة', 1], ['liver', 'ني', 0.75]] },
  { n: 'سمك', v: [['fish_grill', 'مشوي', 1], ['fish_fried', 'مقلي', 1], ['tilapia', 'ني', 0.75]] },
  { n: 'بيض', v: [['egg', 'مسلوق', 1], ['egg_fried', 'مقلي', 1], ['omelette', 'عجة', 1], ['egg_white', 'بياض بس', 1]] },
  { n: 'بطاطس', v: [['potato', 'مسلوقة', 1], ['potato_oven', 'فرن', 1], ['mashed', 'بيوريه', 1], ['fries', 'محمرة', 1]] },
  { n: 'فول', v: [['foul', 'مدمس', 1], ['foul_oil', 'بالزيت', 1], ['foul_egg', 'بالبيض', 1]] },
  { n: 'عيش', v: [['bread', 'بلدي', 1], ['bread_shami', 'شامي', 1], ['bread_brown', 'سن', 1], ['bread_ww', 'حبة كاملة', 1], ['bread_oat', 'شوفان', 1], ['bread_diet', 'دايت', 1]] },
  { n: 'توست', v: [['toast', 'أبيض', 1], ['toast_brown', 'بني', 1]] },
  { n: 'فينو', v: [['fino', 'أبيض', 1], ['fino_brown', 'سن', 1]] },
  { n: 'لبن', v: [['milk', 'كامل الدسم', 1], ['milk_low', 'خالي الدسم', 1], ['choc_milk', 'بالشوكولاتة', 1]] },
  { n: 'زبادي', v: [['yogurt', 'عادي', 1], ['greek_yog', 'يوناني', 1], ['fruit_yog', 'بالفواكه', 1]] },
  { n: 'جبنة', v: [['cottage', 'قريش', 1], ['white_ch', 'بيضا', 1], ['istanbuli', 'اسطنبولي', 1], ['roumi', 'رومي', 1], ['cheddar', 'شيدر', 1], ['mozz', 'موتزاريلا', 1], ['processed', 'مثلثات', 1]] },
  { n: 'عدس', v: [['lentil', 'أصفر', 1], ['lentil_brown', 'بجبة', 1], ['lentil_soup', 'شوربة بالخضار', 1]] },
  { n: 'تونة', v: [['tuna', 'بالزيت مصفّاة', 1], ['tuna_water', 'في مية', 1]] },
  { n: 'شاي', v: [['tea_sugar', 'بسكر', 1], ['tea', 'من غير سكر', 1], ['tea_milk', 'بلبن', 1]] },
  { n: 'حاجة ساقعة', v: [['soda', 'عادية', 1], ['soda_zero', 'دايت', 1]] }
];
const VAR_OF = {};
VARIANTS.forEach((g, gi) => g.v.forEach(([id, l, k]) => { VAR_OF[id] = { g: gi, l, k }; }));
const variantGroup = id => VAR_OF[id] ? VARIANTS[VAR_OF[id].g] : null;

// تحويل صنف لصنف تاني مع الحفاظ على نفس الكمية الحقيقية
function convertItem(it, newId) {
  const nf = foodById(newId); if (!nf) return it;
  if (it.c || !foodById(it.id)) return nf.por.length ? { id: newId, q: 1, u: 0, ai: it.ai } : { id: newId, q: 100, u: -1, ai: it.ai };
  const f = foodById(it.id), fa = (VAR_OF[it.id] || {}).k || 1, fb = (VAR_OF[newId] || {}).k || 1;
  const sameGroup = VAR_OF[it.id] && VAR_OF[newId] && VAR_OF[it.id].g === VAR_OF[newId].g;
  const g2 = gramsOf(it) * (sameGroup ? fa / fb : 1);
  // نفس الحصة (طبق، رغيف، بيضة…) ونفس حالة الطبخ: نسيب العدد زي ما هو
  if (it.u >= 0 && fa === fb) {
    const pn = f.por[it.u] && f.por[it.u][0], k = nf.por.findIndex(p => p[0] === pn);
    if (k >= 0) return { id: newId, q: it.q, u: k, ai: it.ai };
  }
  // غير كده: بالجرام (ولو ني ↔ مطبوخ الجرامات بتتحوّل بالمعامل)
  return { id: newId, q: Math.max(5, Math.round(g2 / 5) * 5), u: -1, ai: it.ai };
}
function fbVar(i, id) {
  const it = FB.items[i], before = gramsOf(it);
  FB.items[i] = convertItem(it, id);
  const a = VAR_OF[it.id], b = VAR_OF[id];
  if (a && b && a.k !== b.k) toast(`${Math.round(before)} جم ${a.l} = ${Math.round(gramsOf(FB.items[i]))} جم ${b.l}`);
  vib(8); renderBuilder();
}
// شرايح الأنواع تحت الصنف
function variantChips(i, id) {
  const g = variantGroup(id); if (!g) return '';
  return `<div class="chips vchips" style="margin:6px 0 2px;gap:6px">${g.v.map(([vid, l]) => foodById(vid) ? `<button class="chip ${vid === id ? 'on' : ''}" style="padding:3px 10px;min-height:28px;font-size:12px" onclick="fbVar(${i},'${vid}')">${l}</button>` : '').join('')}</div>`;
}

// ===== بدّل صنف اختاره الـ AI (أو أي صنف) بصنف تاني =====
function fbReplace(i) {
  FB.replace = i; const it = FB.items[i];
  const q = $('fb-q'); q.value = ''; q.placeholder = `بدّل «${it.c ? it.c.n : foodById(it.id).n}» بـ… (ابحث)`;
  renderFbList(); q.focus(); q.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function cancelReplace() { FB.replace = null; $('fb-q').placeholder = 'ابحث: طماطم، فراخ، كشري… أو رقم الباركود'; renderFbList(); }

// قائمة البحث: الأنواع بتتجمع في صف واحد وتحته اختياراتها
function groupedRows(list) {
  const seen = new Set();
  return list.map(f => {
    const v = VAR_OF[f.id];
    if (!v) return foodRow(f);
    if (seen.has(v.g)) return '';
    seen.add(v.g);
    const g = VARIANTS[v.g];
    return foodRow(f).replace(/<\/div><b class="acc"/, `<div class="chips" style="margin-top:6px;gap:6px">${g.v.map(([vid, l]) => foodById(vid) ? `<button class="chip ${vid === f.id ? 'on' : ''}" style="padding:3px 10px;min-height:28px;font-size:12px" onclick="event.stopPropagation();fbAdd('${vid}')">${l}</button>` : '').join('')}</div></div><b class="acc"`);
  }).join('');
}
