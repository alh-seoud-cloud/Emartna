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

  /* السياسة بتيجي من القاعدة — مش من الجهاز.
     في localStorage كان أي مستخدم يقدر يمسحها ويلغي الحماية عن نفسه.
     السقف من المنصة، والعمارة تقدر تشدّد بس مش ترخّي. */
  const FALLBACK = { enabled: true, minutes: 15, warnSeconds: 60, role: 'owner' };
  let POLICY = null;

  function cfg(){ return POLICY || FALLBACK; }
  window.idleConfig = cfg;

  async function loadPolicy(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      const uuid = CLOUD._cache.buildingUuid[window.activeBuildingId];
      if (!sb || !uuid) return;
      const { data, error } = await sb.rpc('my_idle_policy', { p_building: uuid });
      if (!error && data) POLICY = data;
    }catch(e){}
  }
  setTimeout(loadPolicy, 3000);
  setInterval(loadPolicy, 10 * 60 * 1000);   // نلتقط أي تغيير في السياسة
  document.addEventListener('emartna:building-complete', () => setTimeout(loadPolicy, 900));

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

  /* ---------- سياسة المنصة (مسؤول النظام) ---------- */

  window.openIdlePolicy = async function(){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) return showMessage('مش متصل بالسحابة.');
    let p = {};
    try{
      const { data } = await sb.from('platform_settings')
        .select('value').eq('key','idle_policy').single();
      p = (data && data.value) || {};
    }catch(e){}

    openModal(`
      <h3>⏳ سياسة إقفال الجلسة</h3>
      <p class="small mtop">سياسة أمان على كل العملاء. رئيس الاتحاد يقدر
        <b>يشدّدها</b> على عمارته، ومايقدرش يرخّيها ولا يقفلها.</p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="ipOn" ${p.enabled!==false?'checked':''}>
          تفعيل على كل العمارات</label>
      </div>
      <div class="field2"><label>الإدارة — يقفل بعد كام دقيقة خمول</label>
        <input id="ipStaff" type="number" min="5" max="120" value="${p.staffMinutes||15}"></div>
      <div class="field2"><label>الملاك والمستأجرين — كام دقيقة</label>
        <input id="ipRes" type="number" min="5" max="240" value="${p.residentMinutes||60}"></div>
      <div class="field2"><label>مدة التحذير قبل الإقفال (ثانية)</label>
        <input id="ipWarn" type="number" min="15" max="180" value="${p.warnSeconds||60}"></div>
      <div class="field2">
        <label><input type="checkbox" id="ipOvr" ${p.allowBuildingOverride!==false?'checked':''}>
          اسمح لرئيس الاتحاد يشدّدها على عمارته</label>
      </div>

      <p class="small" style="color:var(--muted)">الإدارة بتشوف أرصدة وكشوف حساب،
        فمدتها أقصر. الساكن بيشوف وحدته بس — إقفال متكرر عليه إزعاج بلا مقابل.</p>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveIdlePolicy()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.saveIdlePolicy = async function(){
    const g = i => (document.getElementById(i) || {}).value;
    const chk = i => !!(document.getElementById(i) || {}).checked;
    const value = {
      enabled: chk('ipOn'),
      staffMinutes:    Math.min(120, Math.max(5, Number(g('ipStaff')) || 15)),
      residentMinutes: Math.min(240, Math.max(5, Number(g('ipRes'))   || 60)),
      warnSeconds:     Math.min(180, Math.max(15, Number(g('ipWarn')) || 60)),
      allowBuildingOverride: chk('ipOvr'),
    };
    try{
      const { error } = await window.CLOUD._sb.from('platform_settings')
        .upsert({ key:'idle_policy', value }, { onConflict:'key' });
      if (error) throw error;
      closeModal();
      if (window.toast) toast('اتحفظت السياسة');
      loadPolicy();
    }catch(e){ showMessage(e.message); }
  };

  /* ---------- تشديد على مستوى العمارة ---------- */

  window.openIdleBuilding = async function(){
    const p = cfg();
    openModal(`
      <h3>⏳ إقفال الجلسة في عمارتك</h3>
      <p class="small mtop">السياسة الحالية لدورك: <b>${p.minutes} دقيقة</b>.
        تقدر تقصّرها لو الأجهزة في مكان مشترك — مش تطوّلها.</p>
      <div class="field2 mtop2"><label>يقفل بعد كام دقيقة (فاضي = سياسة المنصة)</label>
        <input id="ibMin" type="number" min="3" max="${p.minutes}" placeholder="${p.minutes}"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveIdleBuilding()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.saveIdleBuilding = async function(){
    const v = (document.getElementById('ibMin') || {}).value;
    try{
      const uuid = CLOUD._cache.buildingUuid[window.activeBuildingId];
      const { error } = await window.CLOUD._sb.from('buildings')
        .update({ idle_minutes: v ? Math.max(3, Number(v)) : null }).eq('id', uuid);
      if (error) throw error;
      closeModal();
      if (window.toast) toast('اتحفظ');
      loadPolicy();
    }catch(e){ showMessage(e.message); }
  };

  console.log('[عمارتنا] إقفال الجلسة عند الخمول جاهز');
})();
