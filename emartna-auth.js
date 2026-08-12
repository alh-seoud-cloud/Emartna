/* ============================================================
   عمارتنا | Emartna — طبقة الدخول السحابي  (الجولة ١)
   ------------------------------------------------------------
   بتستبدل نظام الدخول المحلي في البرنامج:
     • الدخول برقم موبايل/إيميل + باسورد عبر Supabase Auth
     • الجلسة من السحابة مش من sessionStorage
     • التسجيل بينشئ عمارة حقيقية في قاعدة البيانات
     • استرجاع الباسورد بالإيميل

   شاشات البرنامج وتصميمه زي ما هي — بنغيّر المنطق بس.
   ============================================================ */

const CLOUD_AUTH = { ready:false, user:null, session:null, buildings:[] };

/* مناداة دوال البرنامج بشكل آمن (لو الاسم مش متاح في نطاق الموديول) */
const app = new Proxy({}, {
  get: (_, k) => (...args) => {
    const fn = window[k];
    if (typeof fn === 'function') return fn(...args);
    console.warn('[عمارتنا/دخول] الدالة ' + String(k) + ' مش متاحة');
    return undefined;
  }
});
const showLoginError   = m => app.showLoginError(m);
const toast            = m => app.toast(m);
const renderRoot       = () => app.renderRoot();
const resetHistoryBase = () => app.resetHistoryBase();
const resetIdleTimer   = () => app.resetIdleTimer();
const heroSkylineSVG   = a => app.heroSkylineSVG(a);
const appLogoSVG       = a => app.appLogoSVG(a);
const currentUser      = () => app.currentUser();
const doSignup         = () => app.doSignup();
window.CLOUD_AUTH = CLOUD_AUTH;

/* انتظر طبقة البيانات */
function waitCloud(){
  return new Promise(res => {
    if (window.CLOUD) return res();
    const t = setInterval(() => { if (window.CLOUD){ clearInterval(t); res(); } }, 50);
  });
}

/* ============================================================
   1) الجلسة — نفس الشكل اللي البرنامج فاهمه
   ============================================================ */

let __sess = null;

window.getSession   = () => __sess;
window.setSession   = (o) => { __sess = o; };
window.clearSession = () => { __sess = null; };

/* بعد تسجيل الدخول: نحدد المستخدم ده مين */
async function establishSession(preferBuildingId){
  const sb = window.CLOUD._sb;
  const { data:{ user } } = await sb.auth.getUser();
  if (!user){ __sess = null; return null; }
  CLOUD_AUTH.user = user;

  // مسؤول منصة؟ موظف دعم؟
  const plat = window.PLATFORM_AUTH
    ? await window.PLATFORM_AUTH.resolve()
    : null;
  CLOUD_AUTH.isPlatformAdmin = !!(plat && plat.type === 'sysowner');
  CLOUD_AUTH.supportStaff    = plat && plat.type === 'support' ? plat.staff : null;

  const mb = await sb.rpc('my_buildings');
  CLOUD_AUTH.buildings = mb.data || [];

  await window.CLOUD.bootstrap();

  // موظف الدعم مالوش عمارة — لوحته منفصلة
  if (plat && plat.type === 'support'){
    __sess = { type:'support', staff: plat.staff,
               staffUsername: plat.staff.username };
    if (window.PLATFORM) { try{ await window.PLATFORM.load(); }catch(e){} }
    return __sess;
  }

  // صاحب البرنامج: لو مالوش عمارة → لوحة المنصة
  if (plat && plat.type === 'sysowner'){
    if (window.PLATFORM) { try{ await window.PLATFORM.load(); }catch(e){} }
    if (!preferBuildingId && !CLOUD_AUTH.buildings.length){
      __sess = { type:'sysowner' };
      return __sess;
    }
  }

  const list = CLOUD_AUTH.buildings;
  if (!list.length){
    __sess = null;
    throw new Error('حسابك مش مربوط بأي عمارة. لو معاك كود دعوة، افتح رابط الدعوة. أو أنشئ عمارة جديدة.');
  }

  const pick = preferBuildingId
    ? list.find(b => b.code === preferBuildingId || b.building_id === preferBuildingId) || list[0]
    : list[0];

  __sess = { type:'building', buildingId: pick.code, username: user.id, authId: user.id };
  return __sess;
}

/* ============================================================
   2) المستخدم الحالي
   ============================================================ */

window.currentUser = function(){
  const s = __sess;
  if (s && s.type === 'support') return null;
  const D = window.D;
  if (!s || s.type !== 'building' || !D) return null;
  const uid = s.authId;
  const u = (D.users || []).find(x => x.__authId === uid);
  if (u) return u;
  // أول تحميل بعد إنشاء عمارة: العضوية موجودة بس D لسه بيتحدث
  return (D.users || []).find(x => x.role === 'admin') || null;
};

window.isSysOwner = () => !!(__sess && __sess.type === 'sysowner');

/* صاحب البرنامج ممكن يكون رئيس اتحاد كمان — الزرار بيبان له */
window.isSysOwnerAvailable = function(){
  return !!(CLOUD_AUTH.user && CLOUD_AUTH.isPlatformAdmin);
};

window.enterSysOwner = async function(){
  if (!CLOUD_AUTH.isPlatformAdmin) return;
  __sess = { type:'sysowner' };
  if (window.PLATFORM) { try{ await window.PLATFORM.load(); }catch(e){} }
  window.curPage = 'sysdash';
  renderRoot(); resetHistoryBase();
};

window.exitSysOwner = async function(){
  const list = CLOUD_AUTH.buildings || [];
  if (!list.length) return;
  __sess = { type:'building', buildingId:list[0].code,
             username:CLOUD_AUTH.user.id, authId:CLOUD_AUTH.user.id };
  window.curPage = 'dashboard';
  renderRoot(); resetHistoryBase();
};

/* ============================================================
   3) الدخول
   ============================================================ */

window.cloudLogin = async function(idOrEmail, password){
  const id = (idOrEmail || '').trim();
  if (!id) return showLoginError('اكتب رقم الموبايل أو الإيميل');
  if (!password) return showLoginError('اكتب كلمة السر');

  const btn = document.getElementById('lgBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'ثانية واحدة…'; }

  try{
    await window.CLOUD.signIn(id, password);
    await establishSession();
    const u = currentUser();
    window.curPage = (__sess.type === 'sysowner') ? 'sysdash'
            : (u && u.role === 'admin') ? 'dashboard' : 'home';
    renderRoot(); resetHistoryBase(); resetIdleTimer();
  }catch(e){
    const m = e.message || '';
    if (/Invalid login/i.test(m))
      showLoginError('رقم الموبايل أو كلمة السر غير صحيحة');
    else if (/Email not confirmed/i.test(m))
      showLoginError('الحساب محتاج تفعيل. تواصل مع الدعم.');
    else
      showLoginError(m);
  }finally{
    if (btn){ btn.disabled = false; btn.textContent = 'تسجيل الدخول'; }
  }
};

/* الخروج */
const __origLogout = window.logout;
window.logout = async function(){
  try{ clearTimeout(window.__idleTimer); clearTimeout(window.__idleWarnTimer); }catch(e){}
  try{ await window.CLOUD.signOut(); }catch(e){}
  __sess = null;
  window.D = null; window.activeBuildingId = null;
  window.curPage = 'dashboard'; window.__navExpandedGroup = null;
  renderRoot(); resetHistoryBase();
};

/* الحساب التجريبي */
window.loginAsDemo = async function(){
  showLoginError('الحسابات التجريبية اتوقفت مؤقتًا في النسخة السحابية. أنشئ حساب جديد — التجربة مجانية ٣٠ يوم.');
};

/* البصمة — مش مدعومة في النسخة السحابية دلوقتي */
window.bioSupported = () => false;
window.bioIndex = () => [];

/* ============================================================
   4) تعديل شاشة الدخول — نفس التصميم، نص مختلف
   ============================================================ */

const __origLoginHTML = window.loginHTML;
window.loginHTML = function(){
  let html = __origLoginHTML.apply(this, arguments);

  html = html
    .replace(
      '<div class="login-logo"><div class="mark">',
      '<div class="login-logo" style="cursor:pointer" onclick="goToLanding()" title="الصفحة الرئيسية"><div class="mark">'
    )
    .replace('<label>اسم المستخدم</label>', '<label>رقم الموبايل أو الإيميل</label>')
    .replace('placeholder="مثال: admin أو shaqa1"', 'placeholder="01012345678"')
    .replace(
      '⚠️ البيانات تُحفظ داخل هذا المتصفح فقط على هذا الجهاز. لتسجيل دخول أسرع، اختر "حفظ كلمة المرور" لو المتصفح اقترحها عليك.',
      '☁️ بياناتك محفوظة في السحابة — تقدر تدخل من أي جهاز، والمزامنة تلقائية.'
    );

  return html;
};

/* ربط الفورم */
const __origBindLogin = window.bindLogin;
window.bindLogin = function(){
  if (window.__viewMode === 'signup'){
    const form = document.getElementById('signupForm');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); doSignup(); });
    return;
  }
  if (window.__viewMode === 'recover'){ return bindCloudRecover(); }

  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    cloudLogin(
      document.getElementById('lgUser').value,
      document.getElementById('lgPass').value
    );
  });
};

/* ============================================================
   5) التسجيل — إنشاء عمارة حقيقية
   ============================================================ */

window.doSignup = async function(){
  const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const gt = id => (g(id) || '').trim();

  const name = gt('suName');
  const communityType = g('suCommunityType') || 'single';
  const count = communityType === 'compound' ? 0
              : Math.max(0, Math.min(200, Number(g('suCount') || 12)));
  const groundCount = Math.max(1, Number(g('suGroundCount') || 4));
  const groundShops = Math.min(groundCount, Number(g('suGroundShops') || 0));
  const perFloor = Math.max(1, Number(g('suGroundCount') || 4));
  const countrySel = g('suNationCountry');
  const country = countrySel === 'أخرى' ? gt('suOtherCountry') : (countrySel || 'مصر');

  const phoneCountry = g('suCountry') || '+20';
  const phone = gt('suPhone');
  const email = gt('suEmail');
  const loginId = phone || email;
  const password = g('suPass');
  const confirm  = g('suPassConfirm');
  const adminName = gt('suUser') || '';
  const agreeEl = document.getElementById('suAgree');

  if (!name)    return showLoginError('اكتب اسم العمارة');
  if (!loginId) return showLoginError('اكتب رقم موبايلك — هو ده اللي هتدخل بيه');
  if (!password || password.length < 6)
                return showLoginError('كلمة السر لازم ٦ حروف على الأقل');
  if (confirm && password !== confirm)
                return showLoginError('كلمتا السر مش متطابقتين');
  if (agreeEl && agreeEl.type === 'checkbox' && !agreeEl.checked)
                return showLoginError('لازم توافق على الشروط أولًا');

  // مدة التجربة: أولوية لكود الدعوة، بعدين العرض النشط
  let trialDays = 30, offer = null, inviteCode = null;
  try{
    offer = window.activeLandingOffer ? window.activeLandingOffer() : null;
    if (offer && offer.trialDays) trialDays = Number(offer.trialDays) || 30;
  }catch(e){}
  try{
    inviteCode = window.pendingPlatformInvite ? window.pendingPlatformInvite() : null;
  }catch(e){}

  const btn = document.getElementById('suBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'بيتم الإنشاء…'; }

  try{
    // ١) الحساب
    try{
      await window.CLOUD.signUp(loginId, password, adminName, phoneCountry);
    }catch(e){
      if (!/already|registered|exists/i.test(e.message || '')) throw e;
    }
    await window.CLOUD.signIn(loginId, password, phoneCountry);

    // ١-ب) كود دعوة من فريق المبيعات؟ ياخد أولوية في مدة التجربة
    if (inviteCode){
      try{
        const cl = await window.CLOUD._sb.rpc('claim_platform_invite',
          { p_code: inviteCode });
        const row = Array.isArray(cl.data) ? cl.data[0] : cl.data;
        if (!cl.error && row && row.out_trial) trialDays = Number(row.out_trial);
      }catch(e){ console.warn('[عمارتنا/دعوة]', e.message); }
    }

    // ٢) العمارة
    const sb = window.CLOUD._sb;
    const { data, error } = await sb.rpc('create_building', {
      p_name: name,
      p_apartments_count: count,
      p_per_floor: perFloor,
      p_ground_count: groundCount,
      p_ground_shops: groundShops,
      p_address: gt('suAddress'),
      p_location_url: gt('suLocation'),
      p_city: gt('suCity'),
      p_country: country,
      p_governorate: gt('suGovernorate'),
      p_community_type: communityType,
      p_admin_name: adminName,
      p_phone_country: phoneCountry,
      p_phone: phone,
      p_trial_days: trialDays,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    // ٢-ب) سجّل إن الدعوة اتحوّلت لعمارة فعلًا
    if (inviteCode && row){
      try{
        await window.CLOUD._sb.rpc('convert_platform_invite',
          { p_code: inviteCode, p_building: row.out_building_id });
        sessionStorage.removeItem('emartna_platform_invite');
      }catch(e){}
    }

    // ٣) ادخل
    window.__viewMode = 'login';
    await establishSession(row.out_code);
    window.curPage = 'dashboard';
    renderRoot(); resetHistoryBase(); resetIdleTimer();
    toast('تم إنشاء العمارة ✅ كود العمارة: ' + row.out_code +
          ' · تجربة مجانية ' + trialDays + ' يوم');

  }catch(e){
    showLoginError(e.message || 'حصلت مشكلة في إنشاء العمارة');
  }finally{
    if (btn){ btn.disabled = false; btn.textContent = 'إنشاء الحساب'; }
  }
};

/* ============================================================
   6) استرجاع كلمة السر
   ============================================================ */

window.recoverHTML = function(){
  return `
  <div class="login-wrap">
    <div class="skyline-bg">${heroSkylineSVG(true)}</div>
    <div class="login-card">
      <div class="login-logo"><div class="mark">${appLogoSVG(92)}</div>
        <h1>استرداد الدخول</h1><p>نبعتلك رابط على إيميلك</p></div>
      <div class="login-error" id="loginErr"></div>

      <div class="field">
        <label>الإيميل المسجّل</label>
        <input id="rcEmail" type="email" placeholder="name@example.com" autocomplete="email">
      </div>
      <button class="login-btn" id="rcSendBtn">ابعت رابط الاسترداد</button>

      <div class="mtop2" style="border-top:1px dashed var(--line);padding-top:14px">
        <p class="small" style="color:var(--muted)">
          مسجّل برقم موبايل من غير إيميل؟ رئيس اتحاد عمارتك يقدر يعملك
          كلمة سر جديدة من شاشة المستخدمين. لو إنت رئيس الاتحاد، تواصل مع الدعم.
        </p>
      </div>

      <div class="login-hint"><a href="javascript:void(0)" onclick="closeRecover()">← رجوع لتسجيل الدخول</a></div>
    </div>
  </div>`;
};

function bindCloudRecover(){
  const btn = document.getElementById('rcSendBtn');
  if (!btn) return;
  btn.onclick = async () => {
    const email = (document.getElementById('rcEmail').value || '').trim();
    if (!email || !email.includes('@')) return showLoginError('اكتب إيميل صحيح');
    btn.disabled = true;
    try{
      const sb = window.CLOUD._sb;
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname,
      });
      if (error) throw error;
      showLoginError('');
      toast('لو الإيميل ده مسجّل عندنا، هيوصلك رابط خلال دقايق. اتفقد صندوق السبام كمان.');
    }catch(e){ showLoginError(e.message); }
    finally{ btn.disabled = false; }
  };
}

/* ============================================================
   7) البداية — استعادة الجلسة لو المستخدم داخل قبل كده
   ============================================================ */

window.cloudAuthBoot = async function(){
  await waitCloud();
  try{
    const sb = window.CLOUD._sb;
    const { data:{ session } } = await sb.auth.getSession();
    if (session) await establishSession();
  }catch(e){
    console.warn('[عمارتنا/دخول]', e.message);
    __sess = null;
  }
  CLOUD_AUTH.ready = true;
};
