// ===== مكتبة التمارين =====
// m: العضلة الأساسية · sec: عضلات مساعدة (بتتحسب نص مجموعة) · rr: نطاق العدات · rest: راحة بالثواني · inc: أقل زيادة وزن
const MUSCLES = {
  chest: 'صدر', back: 'ظهر', shoulders: 'كتف', biceps: 'باي', triceps: 'تراي',
  quads: 'أمامية', hams: 'خلفية', calves: 'سمانة', abs: 'بطن'
};
// الحجم الأسبوعي المستهدف (مجموعات صعبة) — الكتف والدراع أعلى عشان التركيز
const VOLUME = {
  chest: [10, 16], back: [12, 20], shoulders: [16, 26], biceps: [14, 22], triceps: [14, 22],
  quads: [10, 16], hams: [8, 14], calves: [6, 12], abs: [6, 12]
};
const FOCUS = ['shoulders', 'biceps', 'triceps'];

const EX = {
  flat_db:    { n: 'Flat DB Press', ar: 'ضغط دمبل مسطح', m: 'chest', sec: ['triceps', 'shoulders'], rr: [8, 12], rest: 120, inc: 2, cue: 'لوحي الكتف لورا وتحت، نزّل ببطء لحد جنب الصدر، والكوع 45 درجة من جسمك.' },
  incline_db: { n: 'Incline DB Press', ar: 'ضغط دمبل عالي', m: 'chest', sec: ['shoulders', 'triceps'], rr: [8, 12], rest: 120, inc: 2, cue: 'الزاوية 30 درجة كفاية، وأكتر من كده الكتف هو اللي بيشيل.' },
  cable_fly:  { n: 'Cable Fly', ar: 'تفتيح كابل', m: 'chest', sec: [], rr: [12, 15], rest: 75, inc: 2.5, cue: 'الكوع مثني شوية وثابت، حس بالمطّ في الصدر.' },
  ohp:        { n: 'Overhead Press', ar: 'ضغط كتف بار', m: 'shoulders', sec: ['triceps'], rr: [6, 10], rest: 150, inc: 2.5, cue: 'اشدّ البطن والمقعدة، والبار يطلع في خط مستقيم فوق نص القدم.' },
  db_shoulder:{ n: 'Seated DB Shoulder Press', ar: 'ضغط كتف دمبل', m: 'shoulders', sec: ['triceps'], rr: [8, 12], rest: 120, inc: 2, cue: 'نزّل لحد مستوى الودن، ومتقفلش الكوع فوق.' },
  lat_raise:  { n: 'Lateral Raise', ar: 'رفرفة جانبي دمبل', m: 'shoulders', sec: [], rr: [12, 20], rest: 60, inc: 1, cue: 'ميّل لقدام سنة، ارفع بالكوع مش بالإيد لحد مستوى الكتف. وزن خفيف وأداء نضيف.' },
  cable_lat:  { n: 'Cable Lateral Raise', ar: 'رفرفة جانبي كابل', m: 'shoulders', sec: [], rr: [12, 20], rest: 60, inc: 2.5, cue: 'الكابل بيدي شدّ ثابت طول الحركة، أحسن من الدمبل تحت.' },
  rear_fly:   { n: 'Rear Delt Fly', ar: 'كتف خلفي', m: 'shoulders', sec: ['back'], rr: [12, 20], rest: 60, inc: 1, cue: 'افرد دراعك للجنب مش لورا، ومتعصرش لوح الكتف.' },
  face_pull:  { n: 'Face Pull', ar: 'فيس بول', m: 'shoulders', sec: ['back'], rr: [12, 20], rest: 60, inc: 2.5, cue: 'اسحب ناحية الجبهة ولفّ إيدك لبرا في الآخر.' },
  pushdown:   { n: 'Triceps Pushdown', ar: 'تراي حبل', m: 'triceps', sec: [], rr: [10, 15], rest: 75, inc: 2.5, cue: 'الكوع لازق في جنبك ومبيتحركش، وافتح الحبل تحت.' },
  oh_ext:     { n: 'Overhead Triceps Extension', ar: 'تراي خلف الراس', m: 'triceps', sec: [], rr: [10, 15], rest: 75, inc: 2.5, cue: 'أهم تمرين للرأس الطويلة للتراي، ولازم تاخد مطّ كامل تحت.' },
  cgbp:       { n: 'Close Grip Bench Press', ar: 'بنش ضيق', m: 'triceps', sec: ['chest'], rr: [6, 10], rest: 120, inc: 2.5, cue: 'المسكة بعرض الكتف، والكوع قريب من الجسم.' },
  skull:      { n: 'Skull Crusher', ar: 'سكل كراشر', m: 'triceps', sec: [], rr: [8, 12], rest: 90, inc: 2.5, cue: 'نزّل البار ورا الراس شوية مش على الجبهة، أريح للكوع.' },
  dips:       { n: 'Dips', ar: 'متوازي', m: 'triceps', sec: ['chest', 'shoulders'], rr: [6, 12], rest: 120, inc: 2.5, cue: 'الجسم مفرود عشان التركيز يبقى على التراي. سجّل الوزن الإضافي بس.' },
  pulldown:   { n: 'Lat Pulldown', ar: 'سحب عالي', m: 'back', sec: ['biceps'], rr: [8, 12], rest: 120, inc: 2.5, cue: 'اسحب بالكوع لتحت ناحية جيبك، وصدرك لفوق.' },
  pullup:     { n: 'Pull Up', ar: 'عقلة', m: 'back', sec: ['biceps'], rr: [5, 10], rest: 150, inc: 2.5, cue: 'انزل لآخر مدى. لو سهلة زوّد وزن، ولو صعبة استخدم أستك.' },
  bb_row:     { n: 'Barbell Row', ar: 'باربل رو', m: 'back', sec: ['biceps'], rr: [6, 10], rest: 120, inc: 2.5, cue: 'الضهر مفرود، ميل 45 درجة، واسحب ناحية السرة.' },
  cable_row:  { n: 'Seated Cable Row', ar: 'سحب أرضي', m: 'back', sec: ['biceps'], rr: [8, 12], rest: 90, inc: 2.5, cue: 'خليك ثابت ومتتمرجحش. اسحب بالكوع وسيب الكتف يطلع لقدام في المطّ.' },
  cs_row:     { n: 'Chest Supported Row', ar: 'رو بسند على الصدر', m: 'back', sec: ['biceps'], rr: [8, 12], rest: 90, inc: 2, cue: 'السند بيمنع الغش، فخلي كل الشغل على الضهر.' },
  bb_curl:    { n: 'Barbell Curl', ar: 'باي بار', m: 'biceps', sec: [], rr: [8, 12], rest: 75, inc: 2.5, cue: 'الكوع ثابت جنبك، ونزّل في تانيتين.' },
  ez_curl:    { n: 'EZ Bar Curl', ar: 'باي EZ', m: 'biceps', sec: [], rr: [8, 12], rest: 75, inc: 2.5, cue: 'أريح للرسغ من البار المستقيم.' },
  hammer:     { n: 'Hammer Curl', ar: 'باي هامر', m: 'biceps', sec: [], rr: [10, 15], rest: 75, inc: 1, cue: 'بيكبّر البراكياليس فالدراع يبان أعرض.' },
  inc_curl:   { n: 'Incline DB Curl', ar: 'باي مائل', m: 'biceps', sec: [], rr: [10, 15], rest: 75, inc: 1, cue: 'المطّ الكامل تحت بيشغّل الرأس الطويلة، وده اللي بيعمل قمة الباي.' },
  preacher:   { n: 'Preacher Curl', ar: 'باي بريتشر', m: 'biceps', sec: [], rr: [10, 15], rest: 75, inc: 2.5, cue: 'متفردش الكوع على الآخر بسرعة تحت.' },
  cable_curl: { n: 'Cable Curl', ar: 'باي كابل', m: 'biceps', sec: [], rr: [12, 15], rest: 60, inc: 2.5, cue: 'شدّ ثابت، واعصر فوق ثانية.' },
  squat:      { n: 'Squat', ar: 'سكوات', m: 'quads', sec: ['hams'], rr: [6, 10], rest: 180, inc: 5, cue: 'نفس عميق وبطن مشدودة، والركبة ماشية مع اتجاه صوابعك.' },
  leg_press:  { n: 'Leg Press', ar: 'ليج برس', m: 'quads', sec: [], rr: [10, 15], rest: 120, inc: 10, cue: 'انزل لحد ما الوسط يبدأ يترفع ووقف قبلها.' },
  leg_ext:    { n: 'Leg Extension', ar: 'ليج إكستنشن', m: 'quads', sec: [], rr: [12, 15], rest: 75, inc: 5, cue: 'اعصر فوق ثانية.' },
  bss:        { n: 'Bulgarian Split Squat', ar: 'بلغاري', m: 'quads', sec: ['hams'], rr: [8, 12], rest: 90, inc: 2, cue: 'لو عايز تركز على المقعدة ميّل لقدام، ولو على الأمامية خليك مفرود.' },
  rdl:        { n: 'Romanian Deadlift', ar: 'رومانيان ديدلفت', m: 'hams', sec: ['back'], rr: [8, 12], rest: 150, inc: 5, cue: 'الوسط هو اللي بيرجع لورا والركبة ثابتة تقريبًا، ونزّل لحد ما تحس بالمطّ.' },
  leg_curl:   { n: 'Leg Curl', ar: 'ليج كيرل', m: 'hams', sec: [], rr: [10, 15], rest: 75, inc: 5, cue: 'النسخة اللي وانت قاعد أحسن للخلفية.' },
  calf:       { n: 'Calf Raise', ar: 'سمانة', m: 'calves', sec: [], rr: [10, 20], rest: 60, inc: 5, cue: 'وقفة ثانيتين تحت في المطّ.' },
  crunch:     { n: 'Cable Crunch', ar: 'بطن كابل', m: 'abs', sec: [], rr: [10, 15], rest: 60, inc: 2.5, cue: 'لفّ ضهرك لتحت، مش إنك توطّي بوسطك.' },
  leg_raise:  { n: 'Hanging Leg Raise', ar: 'رفع رجل معلق', m: 'abs', sec: [], rr: [10, 15], rest: 60, inc: 0, cue: 'ارفع الحوض لفوق، مش الرجل بس.' }
};

// ===== البرنامج: Push / Pull / Legs + كتف ودراع + Upper =====
const PROGRAM = {
  push:  { name: 'Push', ar: 'صدر · كتف · تراي', ex: [['flat_db', 3], ['incline_db', 3], ['db_shoulder', 3], ['lat_raise', 4], ['pushdown', 3], ['oh_ext', 3]] },
  pull:  { name: 'Pull', ar: 'ضهر · باي · كتف خلفي', ex: [['pulldown', 3], ['bb_row', 3], ['cable_row', 3], ['rear_fly', 3], ['bb_curl', 3], ['hammer', 3]] },
  legs:  { name: 'Legs', ar: 'رجل · بطن', ex: [['squat', 3], ['rdl', 3], ['leg_press', 3], ['leg_curl', 3], ['calf', 4], ['crunch', 3]] },
  arms:  { name: 'Shoulders & Arms', ar: 'كتف · دراع', ex: [['ohp', 3], ['lat_raise', 4], ['face_pull', 3], ['ez_curl', 3], ['cgbp', 3], ['inc_curl', 3], ['skull', 3]] },
  upper: { name: 'Upper', ar: 'صدر · ضهر · دراع', ex: [['incline_db', 3], ['pullup', 3], ['cs_row', 3], ['cable_lat', 4], ['preacher', 3], ['dips', 3]] }
};
// getDay(): 0 الحد ... 6 السبت
const SCHEDULE = { 6: 'push', 0: 'pull', 1: 'legs', 3: 'arms', 4: 'upper' };
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // الأسبوع بيبدأ السبت
const DAY_AR = ['الحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

// ===== أكل مصري رخيص =====
// b: الكمية الأساسية اللي القيم محسوبة عليها · u: الوحدة · d: الكمية الافتراضية
const FOODS = [
  { id: 'egg', n: 'بيض', u: 'بيضة', b: 1, d: 3, k: 75, p: 6.5, c: 0.5, f: 5 },
  { id: 'bread', n: 'عيش بلدي', u: 'رغيف', b: 1, d: 1, k: 250, p: 9, c: 50, f: 1.5 },
  { id: 'foul', n: 'فول مدمس', u: 'جم', b: 100, d: 150, k: 110, p: 7.6, c: 19, f: 0.5 },
  { id: 'lentil', n: 'عدس أصفر مطبوخ', u: 'جم', b: 100, d: 250, k: 115, p: 9, c: 20, f: 0.4 },
  { id: 'chick', n: 'صدور فراخ (ني)', u: 'جم', b: 100, d: 250, k: 120, p: 23, c: 0, f: 2.6 },
  { id: 'thigh', n: 'وراك فراخ من غير جلد (ني)', u: 'جم', b: 100, d: 250, k: 125, p: 19, c: 0, f: 5 },
  { id: 'liver', n: 'كبدة فراخ (ني)', u: 'جم', b: 100, d: 200, k: 120, p: 17, c: 1, f: 5 },
  { id: 'tuna', n: 'تونة مصفّاة', u: 'علبة', b: 1, d: 1, k: 190, p: 28, c: 0, f: 8 },
  { id: 'sardine', n: 'سردين', u: 'علبة', b: 1, d: 1, k: 190, p: 22, c: 0, f: 11 },
  { id: 'tilapia', n: 'سمك بلطي (ني)', u: 'جم', b: 100, d: 250, k: 96, p: 20, c: 0, f: 1.7 },
  { id: 'beef', n: 'لحمة حمرا (ني)', u: 'جم', b: 100, d: 150, k: 200, p: 20, c: 0, f: 13 },
  { id: 'cottage', n: 'جبنة قريش', u: 'جم', b: 100, d: 200, k: 98, p: 12, c: 3.4, f: 4.3 },
  { id: 'yogurt', n: 'زبادي', u: 'علبة', b: 1, d: 1, k: 65, p: 3.5, c: 5, f: 3.5 },
  { id: 'milk', n: 'لبن كامل', u: 'كوباية', b: 1, d: 1, k: 160, p: 8, c: 12, f: 8.5 },
  { id: 'oats', n: 'شوفان', u: 'جم', b: 100, d: 60, k: 380, p: 13, c: 67, f: 7 },
  { id: 'rice', n: 'رز مطبوخ', u: 'جم', b: 100, d: 250, k: 130, p: 2.7, c: 28, f: 0.3 },
  { id: 'pasta', n: 'مكرونة مطبوخة', u: 'جم', b: 100, d: 250, k: 158, p: 5.8, c: 31, f: 0.9 },
  { id: 'potato', n: 'بطاطس مسلوقة', u: 'جم', b: 100, d: 250, k: 87, p: 2, c: 20, f: 0.1 },
  { id: 'sweetpot', n: 'بطاطا', u: 'جم', b: 100, d: 200, k: 90, p: 2, c: 21, f: 0.1 },
  { id: 'chickpea', n: 'حمص مطبوخ', u: 'جم', b: 100, d: 150, k: 165, p: 9, c: 27, f: 2.6 },
  { id: 'banana', n: 'موز', u: 'حبة', b: 1, d: 2, k: 105, p: 1.3, c: 27, f: 0.4 },
  { id: 'dates', n: 'بلح/تمر', u: 'حبة', b: 1, d: 3, k: 23, p: 0.2, c: 6, f: 0 },
  { id: 'salad', n: 'سلطة خضرا', u: 'طبق', b: 1, d: 1, k: 40, p: 2, c: 8, f: 0.3 },
  { id: 'oil', n: 'زيت', u: 'معلقة', b: 1, d: 1, k: 120, p: 0, c: 0, f: 14 },
  { id: 'tahini', n: 'طحينة', u: 'معلقة', b: 1, d: 1, k: 90, p: 2.6, c: 3, f: 8 },
  { id: 'peanut', n: 'فول سوداني', u: 'جم', b: 100, d: 30, k: 570, p: 25, c: 16, f: 48 },
  { id: 'whey', n: 'واي بروتين', u: 'سكوب', b: 1, d: 1, k: 120, p: 24, c: 3, f: 1.5 }
];

// نظام يومي رخيص (حوالي 2400 سعرة و185 بروتين، والباقي من هدفك يغطي زيت الطبخ)، الوجبات مركبة من الأكل اللي فوق
const MEAL_PLAN = [
  { t: 'الفطار', slot: 'b', items: [['egg', 4], ['bread', 1], ['foul', 150]] },
  { t: 'الغدا', slot: 'l', items: [['chick', 250], ['rice', 250], ['salad', 1]] },
  { t: 'سناك', slot: 's', items: [['cottage', 200], ['banana', 2]] },
  { t: 'العشا', slot: 'd', items: [['tuna', 1], ['bread', 1], ['salad', 1]] },
  { t: 'قبل النوم', slot: 's', items: [['milk', 1]] }
];
const SLOTS = { b: 'فطار', l: 'غدا', d: 'عشا', s: 'سناك' };
