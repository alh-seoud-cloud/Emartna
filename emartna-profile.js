/* ============================================================
   عمارتنا — إكمال بيانات الحساب
   ------------------------------------------------------------
   بعد الدخول، لو فيه بيانات ناقصة في حساب المستخدم بتظهر شاشة
   بتوضّحها بالأحمر ويكمّلها في مكانها.

   الفحص عام: أي حقل جديد بيتضاف لـ FIELDS بيظهر تلقائيًا —
   مش محتاج نعدّل الشاشة كل مرة.

   أهم حقل دلوقتي الإيميل: المسجّل برقم موبايل بياخد إيميل داخلي
   وهمي (@emartna.local) مش بيستقبل رسايل، يعني مستحيل يسترجع
   كلمة المرور بنفسه.
   ============================================================ */

const ready = (t) => new Promise(r => {
  const i = setInterval(() => { if (t()) { clearInterval(i); r(); } }, 150);
  setTimeout(() => { clearInterval(i); r(); }, 25000);
});
await ready(() => window.CLOUD && window.CLOUD._sb);
const sb = window.CLOUD._sb;
const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

const FAKE = /@emartna\.local$/i;

/* كل حقل: مفتاحه، اسمه، هل حرج، إزاي نعرف إنه ناقص، وشكل خانته */
const FIELDS = [
  {
    key: 'email', label: 'البريد الإلكتروني', critical: true,
    why: 'الطريق الوحيد لاسترجاع كلمة المرور لو نسيتها',
    missing: p => !p.email || FAKE.test(p.email),
    input: p => `<input id="pcEmail" type="email" dir="ltr" placeholder="name@mail.com"
                   value="${esc2(FAKE.test(p.email || '') ? '' : (p.email || ''))}">`,
    read: () => ((document.getElementById('pcEmail') || {}).value || '').trim().toLowerCase(),
    validate: v => !v ? 'اكتب البريد الإلكتروني'
                 : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? 'البريد مش مكتوب صح'
                 : FAKE.test(v) ? 'ده مش بريد حقيقي' : null,
  },
  {
    key: 'full_name', label: 'الاسم', critical: false,
    why: 'بيظهر لرئيس الاتحاد وفي المحادثات',
    missing: p => !String(p.full_name || '').trim(),
    input: p => `<input id="pcName" placeholder="اسمك الكامل"
                   value="${esc2(p.full_name || '')}">`,
    read: () => ((document.getElementById('pcName') || {}).value || '').trim(),
    validate: v => !v ? 'اكتب اسمك' : null,
  },
  {
    key: 'phone', label: 'رقم الموبايل', critical: true,
    why: 'رئيس الاتحاد بيربط وحدتك بالرقم ده',
    missing: p => !p.phone_e164 || /^anon-/.test(p.phone_e164),
    input: p => `<div class="flexrow" style="gap:6px">
        <input id="pcCC" value="${esc2(p.phone_country || '+20')}" dir="ltr" style="max-width:80px">
        <input id="pcPhone" dir="ltr" inputmode="numeric" placeholder="01xxxxxxxxx"
          value="${esc2(p.phone || '')}" style="flex:1">
      </div>`,
    read: () => ((document.getElementById('pcPhone') || {}).value || '').trim(),
    validate: v => String(v).replace(/\D/g, '').length < 8 ? 'رقم غير صحيح' : null,
  },
];

let PROFILE = null;

async function loadProfile(){
  try{
    const { data:{ user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from('profiles')
      .select('id,full_name,email,phone,phone_country,phone_e164').eq('id', user.id).single();
    PROFILE = data || null;
    return PROFILE;
  }catch(e){ return null; }
}

function missingFields(p){ return FIELDS.filter(f => f.missing(p)); }

/* ---------- الشاشة ---------- */

window.openProfileComplete = async function(force){
  const p = PROFILE || await loadProfile();
  if (!p) return;
  const miss = missingFields(p);
  if (!miss.length){
    if (force) showMessage('بياناتك كاملة ✅');
    return;
  }
  const hasCritical = miss.some(f => f.critical);

  openModal(`
    <h3>👤 كمّل بيانات حسابك</h3>
    <p class="small mtop">فيه ${miss.length} بيان ناقص. البيانات دي بتخليك
      تسترجع حسابك لوحدك وتوصل لوحدتك من غير مساعدة حد.</p>

    ${miss.map(f => `
      <div class="field2 mtop2" style="border-inline-start:3px solid var(--red);
           padding-inline-start:10px">
        <label style="color:var(--red)">
          ${esc2(f.label)} ${f.critical ? '<span class="badge r">مطلوب</span>' : ''}
        </label>
        ${f.input(p)}
        <p class="small" style="color:var(--muted)">${esc2(f.why)}</p>
      </div>`).join('')}

    <div id="pcErr" class="small mtop" style="color:var(--red)"></div>

    <div class="modal-actions">
      <button class="btn primary" onclick="saveProfileComplete()">💾 حفظ</button>
      ${hasCritical
        ? `<button class="btn ghost" onclick="snoozeProfileComplete()">مش دلوقتي</button>`
        : `<button class="btn ghost" onclick="closeModal()">إغلاق</button>`}
    </div>

    ${hasCritical ? `<p class="small mtop" style="color:var(--muted)">
      لو أجّلتها، هنفكّرك تاني المرة الجاية — من غير البيانات دي مش هتقدر
      ترجّع حسابك لوحدك.</p>` : ''}`);
};

window.snoozeProfileComplete = function(){
  try{ sessionStorage.setItem('emartna_pc_snooze', '1'); }catch(e){}
  closeModal();
};

window.saveProfileComplete = async function(){
  const p = PROFILE;
  const miss = missingFields(p);
  const err = document.getElementById('pcErr');
  const vals = {};

  for (const f of miss){
    const v = f.read();
    if (!v && !f.critical) continue;           // الاختياري ينفع يتساب
    const msg = f.validate(v);
    if (msg){ err.textContent = f.label + ': ' + msg; return; }
    vals[f.key] = v;
  }
  if (!Object.keys(vals).length) return closeModal();

  try{
    /* الرقم له دالة خاصة (بتتأكد إنه مش مستخدم في حساب تاني) */
    if (vals.phone){
      const cc = ((document.getElementById('pcCC') || {}).value || '+20').trim();
      await CLOUD.setMyPhone(vals.phone, cc);
    }

    if (vals.full_name){
      const r = await sb.from('profiles').update({ full_name: vals.full_name }).eq('id', p.id);
      if (r.error) throw r.error;
    }

    if (vals.email){
      /* مهم: الإيميل لازم يتغيّر في auth مش في profiles بس — إيميل
         الدخول هو اللي رسالة الاسترجاع بتروح عليه. تحديث profiles
         لوحده بيوثّق الإيميل من غير ما يفعّل الاسترجاع. */
      const { error: aErr } = await sb.auth.updateUser({ email: vals.email });
      if (aErr) throw aErr;
      await sb.from('profiles').update({ email: vals.email }).eq('id', p.id);
    }

    PROFILE = null;
    closeModal();
    if (vals.email){
      showMessage('بعتنالك رسالة تأكيد على ' + vals.email + '.\n\n' +
        'افتحها واضغط اللينك عشان الإيميل يتفعّل — وبعدها تقدر تسترجع ' +
        'كلمة المرور بنفسك في أي وقت.');
    } else if (window.toast) toast('اتحفظت بياناتك');
  }catch(e){
    const m = String(e.message || '');
    err.textContent = /already|registered|exists/i.test(m)
      ? 'البريد ده مستخدم في حساب تاني.'
      : 'الحفظ فشل: ' + m;
  }
};

/* ---------- التذكير بعد الدخول ---------- */

async function maybePrompt(){
  try{
    if (!window.getSession || !getSession()) return;
    if (sessionStorage.getItem('emartna_pc_snooze')) return;
    const p = await loadProfile();
    if (!p) return;
    const miss = missingFields(p);
    if (!miss.length) return;
    /* الحرج بس هو اللي بيوقف المستخدم — الباقي يكمّله من شاشة حسابه */
    if (!miss.some(f => f.critical)) return;
    openProfileComplete(false);
  }catch(e){}
}
setTimeout(maybePrompt, 4000);
document.addEventListener('emartna:building-complete', () => setTimeout(maybePrompt, 1500));

/* شارة في شاشة "حسابي" تفضل ظاهرة لحد ما البيانات تكتمل */
window.profileGapBadge = function(){
  if (!PROFILE) return '';
  const miss = missingFields(PROFILE);
  if (!miss.length) return '';
  return `<div class="card mtop" style="border:1px solid var(--red);background:#FFF5F4">
    <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div><b style="color:var(--red)">⚠️ بياناتك ناقصة</b>
        <div class="small">${miss.map(f => esc2(f.label)).join(' · ')}</div></div>
      <button class="btn sm" onclick="openProfileComplete(true)">كمّلها</button>
    </div></div>`;
};
