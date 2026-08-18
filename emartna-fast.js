/* ============================================================
   عمارتنا — تسريع البدء
   ------------------------------------------------------------
   حاجتين بيتعملوا هنا:

   ١) إعدادات المنصة (الصفحة الرئيسية · الهوية · الخطط) بتتخزن
      على الجهاز، فالشاشة بتظهر فورًا من غير انتظار الخادم،
      والتحديث بيوصل في الخلفية.

   ٢) لو نزل إصدار جديد من ملفات البرنامج، بيظهر شريط
      "في تحديث جديد" بدل ما المستخدم يفضل على القديم.

   ⚠️ بيانات العمارة (الحركات · الوحدات · الحسابات) **مش**
      بتتخزن على الجهاز أبدًا — دي بتتجاب من الخادم كل مرة.
   ============================================================ */

(function(){
  'use strict';

  const KEY = 'emartna_shell_cache_v1';
  const MAX_AGE = 24 * 60 * 60 * 1000;      // يوم

  /* المفاتيح اللي ينفع تتخزن — عرض وإعدادات بس، مفيش بيانات عملاء */
  const CACHEABLE = [
    'landingSettings','brandSettings','legalSettings','landingBanners',
    'marketingCards','plans','landingOffers','versionHistory',
  ];

  function readCache(){
    try{
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || !o.at || (Date.now() - o.at) > MAX_AGE) return null;
      if (o.build && window.APP_BUILD && o.build !== window.APP_BUILD) return null;
      return o.data || null;
    }catch(e){ return null; }
  }

  function writeCache(){
    try{
      const REG = window.REG; if (!REG) return;
      const data = {};
      CACHEABLE.forEach(k => { if (REG[k] !== undefined) data[k] = REG[k]; });
      localStorage.setItem(KEY, JSON.stringify({
        at: Date.now(), build: window.APP_BUILD || '', data,
      }));
    }catch(e){ /* المساحة ممتلئة — مش مشكلة، هيتجاب من الخادم */ }
  }

  /* ١) استخدام النسخة المحفوظة لحد ما الخادم يرد */
  const origLoadRegistry = window.loadRegistry;
  if (origLoadRegistry) window.loadRegistry = async function(){
    const cached = readCache();

    // بنعمل ده لما طبقة السحابة تكون موجودة بس — لأنها بتستبدل REG
    // بالكامل بعد الرد. من غير الشرط ده، السجل الناقص كان يكسر
    // التهيئة المحلية (REG.buildings مش معرّفة).
    if (cached && window.CLOUD){
      window.REG = window.REG || { buildings: [], plans: [] };
      if (!Array.isArray(window.REG.buildings)) window.REG.buildings = [];
      Object.keys(cached).forEach(k => {
        if (window.REG[k] === undefined || window.REG[k] === null ||
            (Array.isArray(window.REG[k]) && !window.REG[k].length))
          window.REG[k] = cached[k];
      });
    }

    const out = await origLoadRegistry.apply(this, arguments);
    writeCache();                       // تحديث النسخة بعد ما الخادم يرد
    return out;
  };

  /* بعد أي حفظ للمنصة، نحدّث النسخة المحفوظة */
  const origSaveRegistry = window.saveRegistry;
  if (origSaveRegistry) window.saveRegistry = function(){
    const r = origSaveRegistry.apply(this, arguments);
    setTimeout(writeCache, 800);
    return r;
  };

  window.clearShellCache = function(){
    try{ localStorage.removeItem(KEY); }catch(e){}
    if (window.toast) toast('اتمسحت النسخة المحفوظة — حدّث الصفحة');
  };

  /* ٢) تنبيه لما ينزل إصدار جديد من ملفات البرنامج */
  function watchForUpdate(){
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => {
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller)
              showUpdateBar();
          });
        });
      });
    }).catch(()=>{});
  }

  function showUpdateBar(){
    if (document.getElementById('updateBar')) return;
    const bar = document.createElement('div');
    bar.id = 'updateBar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9500;' +
      'background:var(--accent,#159A8C);color:#fff;padding:10px 14px;' +
      'font:600 13px/1.7 system-ui;text-align:center;direction:rtl';
    bar.innerHTML = '🎉 نزل تحديث جديد للبرنامج ' +
      '<button onclick="applyAppUpdate()" style="margin-inline-start:10px;background:#fff;' +
      'color:var(--accent,#159A8C);border:0;border-radius:6px;padding:5px 14px;' +
      'cursor:pointer;font-weight:700">حدّث دلوقتي</button>' +
      '<button onclick="this.parentNode.remove()" style="margin-inline-start:6px;background:none;' +
      'color:#fff;border:0;cursor:pointer;opacity:.85">بعدين</button>';
    document.body.appendChild(bar);
  }

  window.applyAppUpdate = function(){
    try{ localStorage.removeItem(KEY); }catch(e){}
    if ('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations()
        .then(rs => Promise.all(rs.map(r => r.update())))
        .finally(() => location.reload(true));
    } else location.reload(true);
  };

  setTimeout(watchForUpdate, 3000);

  console.log('[عمارتنا] تسريع البدء جاهز');
})();
