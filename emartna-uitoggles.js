/* ============================================================
   عمارتنا — التحكم في عناصر الصفحة الرئيسية
   ------------------------------------------------------------
   صاحب البرنامج يقدر يشغّل ويقفل كل عنصر دعائي من غير كود:
   الزرار العائم · شريط الحاسبة · نافذة الترحيب · رابط الدخول.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  const ITEMS = [
    { key:'startFab',   icon:'🎁', label:'الزرار العائم "ابدأ مجانًا"',
      note:'بيفضل ظاهر مع التمرير — أقوى مدخل للزائر' },
    { key:'calcBar',    icon:'💰', label:'شريط الحاسبة في أعلى الصفحة',
      note:'"عمارتك كام وحدة؟ احسب اشتراكك"' },
    { key:'calcSection',icon:'🧮', label:'قسم الحاسبة الكامل',
      note:'الحاسبة بجدول الأسعار في نص الصفحة' },
    { key:'welcomePopup',icon:'👋', label:'نافذة الترحيب التلقائية',
      note:'بتفتح لوحدها بعد ثواني من دخول الزائر' },
    { key:'loginCalc',  icon:'🔑', label:'رابط الحاسبة في شاشة الدخول',
      note:'"احسب اشتراك عمارتك" تحت زرار الدخول' },
  ];

  const DEFAULTS = { startFab:true, calcBar:true, calcSection:true,
                     welcomePopup:true, loginCalc:true };

  function conf(){
    try{
      const ls = window.ensureLandingSettings ? ensureLandingSettings() : null;
      if (!ls) return DEFAULTS;
      ls.uiToggles = Object.assign({}, DEFAULTS, ls.uiToggles || {});
      return ls.uiToggles;
    }catch(e){ return DEFAULTS; }
  }

  /* الدالة اللي كل الوحدات بتسأل بيها */
  window.landingUIOn = function(key){
    const c = conf();
    return c[key] !== false;
  };

  /* ---------- شاشة الإعداد ---------- */

  window.openLandingToggles = function(){
    const c = conf();
    openModal(`
      <h3>🎛️ عناصر الصفحة الرئيسية</h3>
      <p class="small mtop">شغّل أو اقفل أي عنصر دعائي — التغيير بيبان للزوّار فورًا.</p>

      <div class="mtop2">
        ${ITEMS.map(it => `
          <label class="flexrow" style="gap:10px;align-items:flex-start;padding:9px 0;
                 border-bottom:1px dashed var(--line);cursor:pointer">
            <input type="checkbox" class="ui-tg" data-k="${it.key}"
              ${c[it.key] !== false ? 'checked' : ''} style="margin-top:3px">
            <span style="flex:1">
              <b class="small">${it.icon} ${esc2(it.label)}</b>
              <div class="small" style="color:var(--muted)">${esc2(it.note)}</div>
            </span>
          </label>`).join('')}
      </div>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ghost" onclick="uiTogglePreset(true)">شغّل الكل</button>
        <button class="btn sm ghost" onclick="uiTogglePreset(false)">اقفل الكل</button>
      </div>

      <p class="small mtop" style="color:var(--muted)">
        💡 لو قفلت الكل، الصفحة هتبقى نظيفة بس الزائر مش هيلاقي مدخل واضح للتجربة.
      </p>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveLandingToggles()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.uiTogglePreset = function(on){
    document.querySelectorAll('.ui-tg').forEach(el => { el.checked = !!on; });
  };

  window.saveLandingToggles = function(){
    const ls = ensureLandingSettings();
    const out = {};
    document.querySelectorAll('.ui-tg').forEach(el => { out[el.dataset.k] = el.checked; });
    ls.uiToggles = out;
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظت إعدادات الصفحة');
    if (window.renderSysContent) renderSysContent();
  };

  /* بطاقة في شاشة الصفحة الرئيسية */
  function card(){
    const c = conf();
    const off = ITEMS.filter(i => c[i.key] === false);
    return `
      <div class="card content-narrow" style="border:1px solid ${off.length?'var(--gold)':'var(--line)'}">
        <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <b>🎛️ عناصر الصفحة الرئيسية</b>
            <div class="small" style="color:var(--muted);margin-top:3px">
              ${off.length
                ? `${ITEMS.length - off.length} من ${ITEMS.length} شغّالين · مقفول: ${
                    off.map(i => esc2(i.label.replace(/"/g,''))).join(' · ')}`
                : `كل العناصر شغّالة (${ITEMS.length})`}
            </div>
          </div>
          <button class="btn sm ghost" onclick="openLandingToggles()">تعديل</button>
        </div>
      </div>`;
  }

  function hook(){
    if (window.__uiTogglesHooked) return;
    const orig = window.pageSysLandingSettings;
    if (typeof orig !== 'function') return;
    window.__uiTogglesHooked = true;
    const wrapped = function(){ return card() + orig.apply(this, arguments); };
    window.pageSysLandingSettings = wrapped;
  }
  hook();
  [900, 2500, 5000].forEach(ms => setTimeout(hook, ms));

  console.log('[عمارتنا] التحكم في عناصر الصفحة جاهز');
})();
