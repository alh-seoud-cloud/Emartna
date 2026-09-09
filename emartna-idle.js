/* ============================================================
   عمارتنا — الخروج التلقائي عند الخمول
   ------------------------------------------------------------
   بعد فترة بدون أي نشاط، بتظهر نافذة تحذير بعدّاد تنازلي،
   وبعدها بيتم تسجيل الخروج.

   قواعد اتحطت عن قصد:
   • مفيش خروج والشاشة فيها نافذة مفتوحة أو كلام مكتوب لسه
     ما اتحفظش — المستخدم ممكن يكون بيقرا مستند جنبه.
   • مفيش خروج والمزامنة لسه شغالة — البيانات تروح.
   • أي حركة (ماوس، كيبورد، لمس، تمرير) بتصفّر العدّاد.
   ============================================================ */

(function(){
  'use strict';

  const DEFAULTS = { enabled: true, minutes: 10, warnSeconds: 60 };

  function cfg(){
    try{
      const raw = localStorage.getItem('emartna_idle_cfg');
      return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
    }catch(e){ return DEFAULTS; }
  }
  function saveCfg(c){
    try{ localStorage.setItem('emartna_idle_cfg', JSON.stringify(c)); }catch(e){}
  }
  window.idleConfig = cfg;

  let lastAct = Date.now(), warnBox = null, tick = null;

  function reset(){
    lastAct = Date.now();
    if (warnBox) dismissWarning();
  }
  ['mousedown','keydown','touchstart','scroll','wheel','pointerdown']
    .forEach(ev => document.addEventListener(ev, reset, { passive:true, capture:true }));

  /* حاجات بتمنع الخروج حتى لو مفيش حركة */
  function busy(){
    try{
      if (document.querySelector('.modal, .modal-backdrop')) return 'نافذة مفتوحة';
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.value) return 'فيه كلام متكتب';
      if (window.CLOUD && CLOUD._cache && CLOUD._cache.dirty
          && CLOUD._cache.dirty.size) return 'المزامنة لسه شغالة';
    }catch(e){}
    return null;
  }

  function loggedIn(){
    try{ return !!(window.getSession && getSession()); }catch(e){ return false; }
  }

  function dismissWarning(){
    if (tick){ clearInterval(tick); tick = null; }
    if (warnBox){ warnBox.remove(); warnBox = null; }
  }

  function showWarning(c){
    if (warnBox) return;
    let left = c.warnSeconds;

    warnBox = document.createElement('div');
    warnBox.dir = 'rtl';
    warnBox.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(12,28,26,.55);backdrop-filter:blur(2px)';
    warnBox.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:22px 20px;max-width:340px;' +
             'width:88%;text-align:center;font-family:inherit;' +
             'box-shadow:0 18px 50px rgba(0,0,0,.3)">' +
        '<div style="font-size:34px;line-height:1">⏳</div>' +
        '<h3 style="margin:8px 0 4px;font-size:18px;color:#153733">لسه موجود؟</h3>' +
        '<p style="margin:0;font-size:13.5px;line-height:1.8;color:#4A5B57">' +
          'مفيش نشاط من شوية. هنقفل الجلسة بعد ' +
          '<b id="idleLeft" style="color:#C4553B;font-size:16px">' + left + '</b> ثانية' +
          ' — حفاظًا على بيانات عمارتك.</p>' +
        '<button id="idleStay" style="width:100%;margin-top:14px;border:0;border-radius:11px;' +
               'background:#0F7A6F;color:#fff;padding:12px;font:600 15px inherit;' +
               'cursor:pointer">أنا هنا — كمّل شغل</button>' +
        '<button id="idleOut" style="width:100%;margin-top:8px;border:0;background:none;' +
               'color:#8A9A96;font:inherit;font-size:12.5px;cursor:pointer">' +
          'اقفل الجلسة دلوقتي</button>' +
      '</div>';
    document.body.appendChild(warnBox);

    warnBox.querySelector('#idleStay').onclick = () => { lastAct = Date.now(); dismissWarning(); };
    warnBox.querySelector('#idleOut').onclick  = () => { dismissWarning(); doLogout(); };

    tick = setInterval(() => {
      left--;
      const el = document.getElementById('idleLeft');
      if (el) el.textContent = left;
      if (left <= 0){ dismissWarning(); doLogout(); }
    }, 1000);
  }

  function doLogout(){
    try{
      /* آخر دفعة مزامنة قبل ما نقفل — ما نسيبش تعديل مش متبعت */
      if (typeof window.flushNow === 'function') flushNow();
    }catch(e){}
    setTimeout(() => { try{ if (window.logout) logout(); }catch(e){} }, 400);
  }

  setInterval(() => {
    const c = cfg();
    if (!c.enabled || !loggedIn()) return;
    if (document.hidden) return;                 // التاب في الخلفية — مش خمول
    const idleMs = Date.now() - lastAct;
    const limit  = c.minutes * 60 * 1000;
    if (idleMs < limit - c.warnSeconds * 1000) return;
    const why = busy();
    if (why){ lastAct = Date.now(); return; }    // مشغول فعلًا — نأجّل
    showWarning(c);
  }, 5000);

  /* ---------- إعداد المدة ---------- */

  window.openIdleSettings = function(){
    const c = cfg();
    openModal(`
      <h3>⏳ إقفال الجلسة عند الخمول</h3>
      <p class="small mtop">لو المستخدم ساب البرنامج مفتوح ومشي، الجلسة بتتقفل لوحدها.
        بتحذّره الأول بعدّاد، ومش بتقفل وهو بيكتب أو فيه نافذة مفتوحة.</p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="idOn" ${c.enabled?'checked':''}> تفعيل</label>
      </div>
      <div class="field2"><label>يقفل بعد كام دقيقة بدون نشاط</label>
        <input id="idMin" type="number" min="3" max="120" value="${c.minutes}"></div>
      <div class="field2"><label>مدة التحذير قبل الإقفال (ثانية)</label>
        <input id="idWarn" type="number" min="15" max="180" value="${c.warnSeconds}"></div>

      <p class="small" style="color:var(--muted)">الإعداد ده على الجهاز ده.</p>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveIdleSettings()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.saveIdleSettings = function(){
    const g = i => (document.getElementById(i) || {}).value;
    saveCfg({
      enabled: !!(document.getElementById('idOn') || {}).checked,
      minutes: Math.min(120, Math.max(3, Number(g('idMin')) || 10)),
      warnSeconds: Math.min(180, Math.max(15, Number(g('idWarn')) || 60)),
    });
    lastAct = Date.now();
    closeModal();
    if (window.toast) toast('اتحفظ إعداد إقفال الجلسة');
  };

  console.log('[عمارتنا] إقفال الجلسة عند الخمول جاهز');
})();
