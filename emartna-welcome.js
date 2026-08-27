/* ============================================================
   عمارتنا — نافذة الترحيب للزائر الجديد
   ------------------------------------------------------------
   بتظهر مرة واحدة لكل زائر على الصفحة الرئيسية، وبتديله
   ثلاث اختيارات واضحة بدل ما يقرا ويمشي:
     ١) جرّب كرئيس اتحاد (بدون تسجيل)
     ٢) جرّب كصاحب شقة (بدون تسجيل)
     ٣) سجّل واستفيد بالعرض المجاني
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const KEY = 'emartna_welcome_seen';
  const DELAY = 6000;              // بيظهر بعد ما الزائر يقرا شوية

  /* ---------- إعدادات قابلة للتعديل من لوحة صاحب البرنامج ---------- */

  function cfg(){
    try{
      const ls = window.ensureLandingSettings ? ensureLandingSettings() : null;
      if (!ls) return null;
      ls.welcomePopup = Object.assign({
        enabled: true,
        title: 'جرّب البرنامج قبل ما تسجّل',
        subtitle: 'عمارة جاهزة بـ٢٨ وحدة وسنتين حركات مالية — ادخل شوف بنفسك.',
        offerLine: 'وسجّل دلوقتي واستفيد بشهرين مجانًا لأول عمارة.',
        delaySeconds: 6,
      }, ls.welcomePopup || {});
      return ls.welcomePopup;
    }catch(e){ return null; }
  }

  function seen(){
    try{ return sessionStorage.getItem(KEY) === '1' ||
                localStorage.getItem(KEY) === '1'; }catch(e){ return false; }
  }
  function markSeen(forever){
    try{
      sessionStorage.setItem(KEY, '1');
      if (forever) localStorage.setItem(KEY, '1');
    }catch(e){}
  }

  /* العرض المجاني الحالي — بياخد المدة من العروض المفعّلة */
  function offerText(){
    try{
      const offers = window.ensureLandingOffers ? ensureLandingOffers() : [];
      const live = offers.find(o => o.active !== false);
      if (live && live.trialDays){
        const m = Math.round(live.trialDays / 30);
        return m >= 2 ? `${m} شهور مجانًا` : `${live.trialDays} يوم مجانًا`;
      }
    }catch(e){}
    return 'شهرين مجانًا';
  }

  /* ---------- النافذة ---------- */

  /* العرض المفعّل حاليًا — عشان ندمجه في نفس النافذة */
  function liveOffer(){
    try{
      const o = window.activeLandingOffer ? activeLandingOffer() : null;
      return (o && o.active !== false) ? o : null;
    }catch(e){ return null; }
  }

  /* بنمنع نافذة العرض القديمة تظهر لوحدها — بقت جزء من نافذة الترحيب */
  (function suppressOldOffer(){
    try{ sessionStorage.setItem('omaretna_offer_seen','1'); }catch(e){}
    const orig = window.maybeShowOfferPopup;
    if (typeof orig === 'function' && !orig.__merged){
      const w = function(){ /* اتدمجت في نافذة الترحيب */ };
      w.__merged = true;
      window.maybeShowOfferPopup = w;
    }
  })();

  window.openWelcomePopup = function(manual){
    const c = cfg();
    if (!c) return;
    if (!manual && (!c.enabled || seen())) return;
    if (!manual && window.getSession && getSession()) return;   // مسجّل دخول بالفعل
    markSeen(false);

    const off = liveOffer();
    const offer = offerText();
    const html = `
      <div style="text-align:center">
        <div style="font-size:44px;line-height:1">🏢</div>
        <h3 style="margin:8px 0 4px">${esc2(c.title)}</h3>
        <p class="small" style="color:var(--muted);line-height:1.9">${esc2(c.subtitle)}</p>
      </div>

      <p class="small mtop" style="text-align:center;color:var(--muted)">
        ــــــ اختار طريقك ــــــ</p>

      <div class="mtop">
        <button class="btn primary" style="width:100%;padding:13px;font-size:15px"
          onclick="welcomeGo('admin')">
          🏢 جرّب كرئيس اتحاد
          <div class="small" style="font-weight:400;opacity:.9;margin-top:2px">
            تشوف التحصيل والمصروفات والتقارير كاملة</div>
        </button>

        <button class="btn ghost mtop" style="width:100%;padding:13px;font-size:15px"
          onclick="welcomeGo('owner')">
          🏠 جرّب كصاحب شقة
          <div class="small" style="font-weight:400;opacity:.85;margin-top:2px">
            تشوف اللي الساكن بيشوفه: حسابه ومستحقاته</div>
        </button>
      </div>

      <div class="card mtop2" style="background:linear-gradient(135deg,rgba(216,163,59,.14),transparent);
           border:1px solid var(--gold)">
        <div style="text-align:center">
          <b style="color:var(--gold);font-size:16px">🎁 ${esc2(off && off.title ? off.title : offer)}</b>
          <p class="small mtop">${esc2((off && off.subtitle) || c.offerLine)}</p>
        </div>
        ${off && (off.features||[]).length ? `
          <div style="margin-top:10px;padding:10px 12px;background:rgba(255,255,255,.5);
               border-radius:10px;text-align:start">
            ${(off.features||[]).slice(0,4).map(f =>
              `<div class="small" style="padding:2px 0">✔️ ${esc2(f)}</div>`).join('')}
          </div>` : ''}
        <button class="btn gold mtop" style="width:100%;padding:12px;font-size:15px"
          onclick="welcomeSignup()">${esc2((off && off.ctaText) || 'ابدأ اشتراكك المجاني')}</button>
        ${off && off.footnote ? `<p class="small mtop" style="text-align:center;color:var(--muted)">
          ${esc2(off.footnote)}</p>` : ''}
      </div>

      <p class="small mtop" style="text-align:center">
        <button onclick="welcomeClose(true)"
          style="background:none;border:0;color:var(--muted);cursor:pointer;
                 text-decoration:underline;font-size:12px">
          مش دلوقتي — بلاش تفكّرني تاني</button>
      </p>`;

    if (typeof window.openModal === 'function') openModal(html, true);
  };

  window.welcomeGo = function(role){
    closeModal();
    setTimeout(() => {
      if (typeof window.tryDemoNow === 'function') tryDemoNow(role);
      else if (typeof window.loginAsDemo === 'function') loginAsDemo(role);
    }, 120);
  };

  window.welcomeSignup = function(){
    closeModal();
    setTimeout(() => { if (window.openSignup) openSignup(); }, 120);
  };

  window.welcomeClose = function(forever){
    markSeen(!!forever);
    closeModal();
  };

  /* زرار عائم يرجّع النافذة في أي وقت */
  function floatBtn(){
    try{
      const on = (typeof __viewMode !== 'undefined' && __viewMode === 'landing')
                 && !(window.getSession && getSession());
      let b = document.getElementById('welcomeFab');
      if (!on){ if (b) b.remove(); return; }
      if (b) return;
      b = document.createElement('button');
      b.id = 'welcomeFab';
      b.title = 'العرض والتجربة المجانية';
      b.textContent = '🎁 جرّب مجانًا';
      b.style.cssText = 'position:fixed;bottom:16px;inset-inline-start:16px;z-index:9200;' +
        'background:var(--gold,#D8A33B);color:#fff;border:0;border-radius:26px;' +
        'padding:11px 18px;font:700 14px system-ui;cursor:pointer;direction:rtl;' +
        'box-shadow:0 6px 20px rgba(0,0,0,.22)';
      b.onclick = () => openWelcomePopup(true);
      document.body.appendChild(b);
    }catch(e){}
  }
  setInterval(floatBtn, 1500);
  setTimeout(floatBtn, 2000);

  /* التشغيل التلقائي على الصفحة الرئيسية */
  function maybeShow(){
    try{
      if (window.getSession && getSession()) return;
      if (typeof __viewMode !== 'undefined' && __viewMode !== 'landing') return;
      const c = cfg();
      if (!c || !c.enabled || seen()) return;
      openWelcomePopup(false);
    }catch(e){}
  }

  let started = false;
  const t = setInterval(() => {
    if (started) return clearInterval(t);
    if (!window.REG || !window.ensureLandingSettings) return;
    started = true; clearInterval(t);
    const c = cfg();
    setTimeout(maybeShow, Math.max(1500, (c && c.delaySeconds ? c.delaySeconds : 6) * 1000));
  }, 400);

  /* ---------- إعداد النافذة من لوحة صاحب البرنامج ---------- */

  window.openWelcomeSettings = function(){
    const c = cfg();
    if (!c) return;
    openModal(`
      <h3>👋 نافذة الترحيب للزائر</h3>
      <p class="small mtop">بتظهر مرة واحدة لكل زائر على الصفحة الرئيسية،
      وبتقدّم له التجربة المجانية والعرض.</p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="wpOn" ${c.enabled?'checked':''}> تفعيل النافذة</label>
      </div>
      <div class="field2"><label>العنوان</label>
        <input id="wpTitle" value="${esc2(c.title)}"></div>
      <div class="field2"><label>النص التوضيحي</label>
        <textarea id="wpSub" rows="2" style="width:100%">${esc2(c.subtitle)}</textarea></div>
      <div class="field2"><label>سطر العرض المجاني</label>
        <input id="wpOffer" value="${esc2(c.offerLine)}"></div>
      <div class="field2"><label>تظهر بعد كام ثانية من فتح الصفحة</label>
        <input id="wpDelay" type="number" min="0" max="60" value="${c.delaySeconds}"></div>

      <div class="flexrow mtop2" style="gap:8px;flex-wrap:wrap">
        <button class="btn primary" onclick="saveWelcomeSettings()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal();setTimeout(()=>openWelcomePopup(true),150)">
          👁️ معاينة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveWelcomeSettings = function(){
    const ls = ensureLandingSettings();
    const g = i => (document.getElementById(i)||{}).value;
    ls.welcomePopup = {
      enabled: !!(document.getElementById('wpOn')||{}).checked,
      title: g('wpTitle').trim(),
      subtitle: g('wpSub').trim(),
      offerLine: g('wpOffer').trim(),
      delaySeconds: Math.max(0, Number(g('wpDelay')) || 6),
    };
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظت إعدادات نافذة الترحيب');
    if (window.renderSysContent) renderSysContent();
  };

  /* بطاقة في شاشة الصفحة الرئيسية */
  const origLandingPage = window.pageSysLandingSettings;
  if (origLandingPage && !origLandingPage.__welcome){
    const wrapped = function(){
      const c = cfg() || {};
      const card = `
        <div class="card content-narrow">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <b>👋 نافذة الترحيب للزائر</b>
              <div class="small" style="color:var(--muted)">
                ${c.enabled ? `مفعّلة — بتظهر بعد ${c.delaySeconds} ثواني` : 'مقفولة'}</div>
            </div>
            <button class="btn ${c.enabled?'ghost':'gold'} sm" onclick="openWelcomeSettings()">
              ${c.enabled ? 'تعديل' : 'تفعيل'}</button>
          </div>
        </div>`;
      return card + origLandingPage.apply(this, arguments);
    };
    wrapped.__welcome = true;
    window.pageSysLandingSettings = wrapped;
  }

  console.log('[عمارتنا] نافذة الترحيب جاهزة');
})();
