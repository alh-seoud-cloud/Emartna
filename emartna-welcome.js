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
  const DELAY = 3000;              // الزائر الجاي من إعلان نيّته يجرّب — ما نأخّرهوش

  /* ---------- إعدادات قابلة للتعديل من لوحة صاحب البرنامج ---------- */

  function cfg(){
    try{
      const ls = window.ensureLandingSettings ? ensureLandingSettings() : null;
      if (!ls) return null;
      ls.welcomePopup = Object.assign({
        enabled: true,
        title: 'جرّب البرنامج قبل ما تسجّل',
        subtitle: 'عمارة تجريبية بـ٢٤ وحدة وسنتين حركات مالية — ادخل شوف بنفسك.',
        offerLine: 'وسجّل دلوقتي واستفيد بشهرين مجانًا لأول عمارة.',
        delaySeconds: 3,
        floors: 6, perFloor: 4, lateCount: 3, dueCount: 2,   // ٢٤ وحدة = نفس العمارة التجريبية
      }, ls.welcomePopup || {});
      return ls.welcomePopup;
    }catch(e){ return null; }
  }

  /* بعد تسجيل الخروج بنصفّر العلامة — الزائر رجع للصفحة الرئيسية
     ومن حقه يشوف العرض تاني. */
  (function hookLogout(){
    const wrap = () => {
      const orig = window.logout;
      if (typeof orig !== 'function' || orig.__welcomeReset) return;
      const w = function(){
        try{
          sessionStorage.removeItem(KEY);
          localStorage.removeItem(KEY);
        }catch(e){}
        const r = orig.apply(this, arguments);
        setTimeout(() => { try{ openWelcomePopup(false); }catch(e){} }, 1200);
        return r;
      };
      w.__welcomeReset = true;
      window.logout = w;
    };
    wrap();
    [1000, 3000].forEach(ms => setTimeout(wrap, ms));
  })();

  function seen(){
    try{
      /* "بلاش تفكّرني" كانت بتكتم النافذة للأبد على الجهاز — وده كتير
         لنافذة تسويقية. بقت ٣٠ يوم وبعدين تظهر تاني. */
      const forever = Number(localStorage.getItem(KEY) || 0);
      if (forever && (Date.now() - forever) < 30*24*60*60*1000) return true;
      if (forever) localStorage.removeItem(KEY);
      const t = Number(sessionStorage.getItem(KEY) || 0);
      // بتظهر تاني بعد ساعتين حتى في نفس الجلسة
      return t && (Date.now() - t) < 2 * 60 * 60 * 1000;
    }catch(e){ return false; }
  }
  function markSeen(forever){
    try{
      sessionStorage.setItem(KEY, String(Date.now()));
      if (forever) localStorage.setItem(KEY, String(Date.now()));
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
    /* الحارس هنا مش في maybeShow بس — عشان أي نداء تلقائي
       من أي مكان يحترم إعداد صاحب البرنامج. */
    if (!manual && window.landingUIOn && !landingUIOn('welcomePopup')) return;
    if (!manual && window.getSession && getSession()) return;   // مسجّل دخول بالفعل
    markSeen(false);

    const off = liveOffer();
    const offer = offerText();
    /* واجهة عمارة: أدوار وشبابيك وباب — الشباك المنوّر = وحدة سدّدت.
       الحالة بتتظبط من لوحة صاحب البرنامج (عدد الأدوار والمتأخرين). */
    const floors = Math.max(2, Math.min(8, Number(c.floors) || 6));
    const perFloor = Math.max(2, Math.min(6, Number(c.perFloor) || 4));
    const total = floors * perFloor;
    const late  = Math.max(0, Math.min(total, Number(c.lateCount) === 0 ? 0
                                      : (Number(c.lateCount) || 3)));
    const due   = Math.max(0, Math.min(total - late, Number(c.dueCount) === 0 ? 0
                                      : (Number(c.dueCount) || 2)));
    const paid  = total - late - due;

    /* بنوزّع المتأخرين والمستحق بشكل ثابت (مش عشوائي) عشان الشكل ما يترعشش */
    const state = Array(total).fill('paid');
    for (let k = 0; k < late; k++) state[(k * 7 + 1) % total] = 'late';
    let placed = 0;
    for (let k = 0; k < total && placed < due; k++){
      const idx = (k * 5 + 3) % total;
      if (state[idx] === 'paid'){ state[idx] = 'due'; placed++; }
    }

    let win = '', n = 0, delay = 0;
    for (let f = 0; f < floors; f++){
      let row = '';
      for (let u = 0; u < perFloor; u++, n++){
        row += `<i class="wp-w wp-${state[n]}" style="--d:${(delay += 28)}ms"></i>`;
      }
      win += `<div class="wp-floor">${row}</div>`;
    }

    const html = `
      <style>
        .wp{--wp-ink:#153733;--wp-green:#0F7A6F;--wp-gold:#C8912F;--wp-clay:#C4553B;
            --wp-line:#DFE6E3;--wp-wall:#E9E2D6;text-align:start;
            max-width:380px;margin:0 auto}
        @media (max-width:420px){.wp{max-width:100%}}
        .wp-bld{width:100%;max-width:150px;margin:0 auto}
        .wp-tag{display:block;text-align:center;margin:7px 0 0;font-size:11.5px;
          color:#8A9A96}
        .wp-roof{height:9px;border-radius:4px 4px 0 0;background:#2E4B46;
          margin:0 -7px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
        .wp-body{background:var(--wp-wall);padding:9px 8px 0;
          border-inline:1px solid #D6CDBD}
        .wp-floor{display:flex;gap:5px;justify-content:center;
          padding-bottom:6px;border-bottom:1px solid rgba(0,0,0,.07)}
        .wp-floor:last-of-type{border-bottom:0}
        .wp-w{flex:1;height:14px;border-radius:2px;background:#CFC6B6;
          box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.16);
          animation:wpLight .3s ease-out both;animation-delay:var(--d)}
        .wp-paid{background:var(--wp-green)}
        .wp-late{background:var(--wp-clay)}
        .wp-due{background:var(--wp-gold)}
        .wp-base{background:var(--wp-wall);border-inline:1px solid #D6CDBD;
          border-radius:0 0 3px 3px;padding:7px 8px 9px;display:flex;
          gap:7px;justify-content:center;align-items:flex-end}
        .wp-door{width:17px;height:20px;border-radius:9px 9px 2px 2px;
          background:#2E4B46}
        .wp-shop{flex:1;height:13px;border-radius:2px;background:#CFC6B6;
          box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.14)}
        .wp-ground{height:5px;background:#D9D2C6;border-radius:2px;margin:0 -9px}
        @keyframes wpLight{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.wp-w{animation:none}}
        .wp-key{display:flex;gap:13px;flex-wrap:wrap;justify-content:center;
          margin-top:11px;font-size:12px;color:#6E7F7B}
        .wp-key b{font-weight:600;color:var(--wp-ink)}
        .wp-key i{display:inline-block;width:9px;height:9px;border-radius:2px;
          margin-inline-end:5px}
        .wp h3{font-size:18px;line-height:1.45;margin:12px 0 5px;color:var(--wp-ink)}
        .wp-lede{font-size:13px;line-height:1.7;color:#4A5B57;margin:0}
        .wp-cta{display:block;width:100%;text-align:start;border-radius:11px;
          padding:10px 13px;margin-top:8px;cursor:pointer;font:inherit;
          border:1px solid var(--wp-line);background:#fff;color:var(--wp-ink)}
        .wp-cta b{display:block;font-size:14.5px;margin-bottom:2px}
        .wp-cta span{font-size:12.5px;color:#6E7F7B}
        .wp-cta.is-main{background:var(--wp-green);border-color:var(--wp-green);color:#fff}
        .wp-cta.is-main span{color:rgba(255,255,255,.86)}
        .wp-cta:focus-visible{outline:2px solid var(--wp-gold);outline-offset:2px}
        .wp-offer{display:flex;gap:10px;align-items:center;margin-top:14px;
          padding:10px 12px;border:1px solid var(--wp-gold);border-radius:12px;
          background:#FFFBF2}
        .wp-offer div{flex:1;min-width:0}
        .wp-offer b{display:block;font-size:13.5px;color:#8A6414}
        .wp-offer span{font-size:12.5px;color:#6E7F7B}
        .wp-offer button{border:0;background:var(--wp-gold);color:#fff;border-radius:9px;
          padding:9px 14px;font:600 13.5px inherit;cursor:pointer;white-space:nowrap}
        .wp-calc{display:block;width:100%;margin-top:10px;padding:10px;
          border:1px dashed var(--wp-green);border-radius:11px;background:#F4FAF9;
          color:var(--wp-green);font:600 13.5px inherit;cursor:pointer}
        .wp-calc:hover{background:#EAF5F3}
        .wp-skip{display:block;width:100%;margin-top:11px;background:none;border:0;
          color:#8A9A96;font:inherit;font-size:12.5px;cursor:pointer}
      </style>

      <div class="wp">
        <div class="wp-bld" aria-hidden="true">
          <div class="wp-roof"></div>
          <div class="wp-body">${win}</div>
          <div class="wp-base">
            <span class="wp-shop"></span>
            <span class="wp-door"></span>
            <span class="wp-shop"></span>
          </div>
          <div class="wp-ground"></div>
        </div>

        <div class="wp-key">
          <span><i style="background:#0F7A6F"></i><b>${paid}</b> سدّدوا</span>
          ${due  ? `<span><i style="background:#C8912F"></i><b>${due}</b> تحت التحصيل</span>` : ''}
          ${late ? `<span><i style="background:#C4553B"></i><b>${late}</b> متأخرين</span>` : ''}
        </div>

        <span class="wp-tag">عمارة تجريبية للعرض — مش بيانات عميل حقيقي</span>

        <h3>${esc2(c.title)}</h3>
        <p class="wp-lede">${esc2(c.subtitle)}</p>

        <button class="wp-cta is-main" onclick="welcomeGo('admin')">
          <b>ادخل كرئيس اتحاد</b>
          <span>التحصيل والمصروفات والتقارير على سنتين بيانات</span>
        </button>
        <button class="wp-cta" onclick="welcomeGo('owner')">
          <b>ادخل كصاحب شقة</b>
          <span>اللي الساكن بيشوفه: حسابه ومستحقاته</span>
        </button>

        <div class="wp-offer">
          <div>
            <b>${esc2(off && off.title ? off.title : offer)}</b>
            <span>${esc2((off && off.subtitle) || c.offerLine)}</span>
          </div>
          <button onclick="welcomeSignup()">${esc2((off && off.ctaText) || 'سجّل')}</button>
        </div>

        ${window.openPriceCalc ? `<button class="wp-calc"
          onclick="welcomeClose(false);setTimeout(()=>openPriceCalc(),200)">
          💰 عمارتك كام وحدة؟ احسب اشتراكك في ثانية
        </button>` : ''}

        <button class="wp-skip" onclick="welcomeClose(true)">مش دلوقتي</button>
      </div>`;

    if (typeof window.openModal === 'function') openModal(html, false);
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
    /* ⚠️ كان فيه زرارين عائمين (التجربة والحاسبة) بيغطّوا أزرار
       الصفحة نفسها على الموبايل. بقوا زرار واحد بيفتح الاتنين. */
    try{
      const allowed = !window.landingUIOn || landingUIOn('startFab');
      const on = allowed
                 && (typeof __viewMode !== 'undefined' && __viewMode === 'landing')
                 && !(window.getSession && getSession());
      let b = document.getElementById('welcomeFab');
      if (!on){
        if (b) b.remove();
        const sp = document.getElementById('fabSpacer');
        if (sp) sp.remove();
        return;
      }
      if (b) return;
      b = document.createElement('button');
      b.id = 'welcomeFab';
      b.title = 'ابدأ مجانًا';
      b.textContent = '🎁 ابدأ مجانًا';
      b.style.cssText = 'position:fixed;bottom:14px;inset-inline-start:50%;' +
        'transform:translateX(50%);z-index:9200;' +
        'background:var(--gold,#D8A33B);color:#fff;border:0;border-radius:26px;' +
        'padding:12px 22px;font:700 14.5px system-ui;cursor:pointer;direction:rtl;' +
        'box-shadow:0 6px 20px rgba(0,0,0,.24);white-space:nowrap;max-width:92vw';
      b.onclick = () => openStartMenu();
      document.body.appendChild(b);

      /* مساحة تحت المحتوى عشان الزرار ما يغطّيش آخر عنصر */
      if (!document.getElementById('fabSpacer')){
        const sp = document.createElement('div');
        sp.id = 'fabSpacer';
        sp.style.cssText = 'height:76px;pointer-events:none';
        const host = document.getElementById('content') || document.body;
        host.appendChild(sp);
      }
    }catch(e){}
  }

  /* قائمة مختصرة بدل زرارين */
  window.openStartMenu = function(){
    openModal(`
      <div style="text-align:center">
        <div style="font-size:34px">🏢</div>
        <h3 style="margin:6px 0 2px">ابدأ مع عمارتنا</h3>
        <p class="small" style="color:var(--muted);margin:0">اختار اللي يناسبك</p>
      </div>

      <button class="btn primary mtop2" style="width:100%;padding:13px;font-size:15px"
        onclick="closeModal();setTimeout(()=>openWelcomePopup(true),150)">
        🎁 جرّب البرنامج مجانًا
        <div class="small" style="font-weight:400;opacity:.9;margin-top:2px">
          من غير تسجيل — عمارة جاهزة بالبيانات</div>
      </button>

      <button class="btn ghost mtop" style="width:100%;padding:13px;font-size:15px"
        onclick="closeModal();setTimeout(()=>openPriceCalc(),150)">
        💰 احسب اشتراك عمارتك
        <div class="small" style="font-weight:400;opacity:.85;margin-top:2px">
          اكتب عدد وحداتك وشوف سعرك فورًا</div>
      </button>

      <button class="btn gold mtop" style="width:100%;padding:12px"
        onclick="closeModal();setTimeout(()=>openSignup(),150)">
        ✅ سجّل واحصل على شهرين مجانًا</button>`, true);
  };

  setInterval(floatBtn, 1500);
  setTimeout(floatBtn, 2000);

  /* التشغيل التلقائي على الصفحة الرئيسية */
  function maybeShow(){
    try{
      if (window.getSession && getSession()) return;
      if (typeof __viewMode !== 'undefined' && __viewMode !== 'landing') return;
      const c = cfg();
      if (!c || !c.enabled || seen()) return;
      if (window.landingUIOn && !landingUIOn('welcomePopup')) return;
      openWelcomePopup(false);
    }catch(e){}
  }

  /* تشخيص: ليه النافذة مش ظاهرة؟ نداء واحد من الـ Console يقول السبب. */
  window.whyNoWelcome = function(){
    const c = cfg();
    const reasons = [];
    if (!c) reasons.push('إعدادات الصفحة الرئيسية لسه ما اتحمّلتش');
    else if (!c.enabled) reasons.push('النافذة مقفولة من لوحة صاحب البرنامج');
    if (window.landingUIOn && !landingUIOn('welcomePopup'))
      reasons.push('مقفولة من "عناصر الصفحة الرئيسية"');
    try{
      if (localStorage.getItem(KEY) === '1')
        reasons.push('الزائر اختار "بلاش تفكّرني" على الجهاز ده');
      const t = Number(sessionStorage.getItem(KEY) || 0);
      if (t && (Date.now() - t) < 2*60*60*1000)
        reasons.push('ظهرت خلال آخر ساعتين في نفس الجلسة');
    }catch(e){}
    if (window.getSession && getSession())
      reasons.push('انت مسجّل دخول — النافذة للزوّار غير المسجّلين بس');

    const msg = reasons.length
      ? 'النافذة مش ظاهرة للأسباب دي:\n\n• ' + reasons.join('\n• ')
      : 'مفيش مانع — المفروض تظهر بعد ' + ((c && c.delaySeconds) || 6) + ' ثواني.';
    if (window.showMessage) showMessage(msg); else console.log(msg);
    return reasons;
  };

  /* تصفير الكتم — عشان تقدر تجرّبها من غير ما تفتح متصفح جديد */
  window.resetWelcomePopup = function(){
    try{ localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); }catch(e){}
    if (window.toast) toast('اتصفّر الكتم — النافذة هتظهر تاني للزوّار');
  };

  let started = false;
  const t = setInterval(() => {
    if (started) return clearInterval(t);
    if (!window.REG || !window.ensureLandingSettings) return;
    started = true; clearInterval(t);
    const c = cfg();
    setTimeout(maybeShow, Math.max(1500, (c && c.delaySeconds ? c.delaySeconds : 3) * 1000));
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

      <div class="card mtop2" style="background:var(--tint)">
        <b class="small">🏢 شكل العمارة في النافذة</b>
        <p class="small" style="color:var(--muted)">الشبابيك المنوّرة = وحدات سدّدت.
          خلّي الأرقام قريبة من الواقع — الزائر بيصدّق الصورة اللي تشبه عمارته.</p>
        <div class="flexrow mtop" style="gap:8px;flex-wrap:wrap">
          <div class="field2" style="flex:1;min-width:104px"><label>عدد الأدوار</label>
            <input id="wpFloors" type="number" min="2" max="8" value="${c.floors}"></div>
          <div class="field2" style="flex:1;min-width:104px"><label>وحدات في الدور</label>
            <input id="wpPer" type="number" min="2" max="6" value="${c.perFloor}"></div>
        </div>
        <div class="flexrow" style="gap:8px;flex-wrap:wrap">
          <div class="field2" style="flex:1;min-width:104px"><label>متأخرين (أحمر)</label>
            <input id="wpLate" type="number" min="0" max="20" value="${c.lateCount}"></div>
          <div class="field2" style="flex:1;min-width:104px"><label>تحت التحصيل (ذهبي)</label>
            <input id="wpDue" type="number" min="0" max="20" value="${c.dueCount}"></div>
        </div>
        <p class="small" style="color:var(--muted)">الباقي بيتحسب تلقائيًا كوحدات سدّدت.</p>
      </div>

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
      delaySeconds: Math.max(0, Number(g('wpDelay')) || 3),
      floors:    Math.min(8, Math.max(2, Number(g('wpFloors')) || 5)),
      perFloor:  Math.min(6, Math.max(2, Number(g('wpPer'))    || 4)),
      lateCount: Math.max(0, Number(g('wpLate')) || 0),
      dueCount:  Math.max(0, Number(g('wpDue'))  || 0),
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
            <div class="flexrow" style="gap:6px;flex-wrap:wrap">
              <button class="btn sm ghost" onclick="whyNoWelcome()">ليه مش ظاهرة؟</button>
              <button class="btn sm ghost" onclick="resetWelcomePopup()">تصفير الكتم</button>
              <button class="btn ${c.enabled?'ghost':'gold'} sm" onclick="openWelcomeSettings()">
                ${c.enabled ? 'تعديل' : 'تفعيل'}</button>
            </div>
          </div>
        </div>`;
      return card + origLandingPage.apply(this, arguments);
    };
    wrapped.__welcome = true;
    window.pageSysLandingSettings = wrapped;
  }

  console.log('[عمارتنا] نافذة الترحيب جاهزة');
})();
