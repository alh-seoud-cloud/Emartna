/* ============================================================
   عمارتنا — التسعير بالشرائح + حاسبة السعر
   ------------------------------------------------------------
   السعر بيتحدد من عدد وحدات العمارة:
     حتى ٢٤ وحدة  →  ٣٠ ج شهريًا  ·  ٣٠٠ ج سنويًا
     أكتر من ٢٤   →  ٤٠ ج شهريًا  ·  ٤٠٠ ج سنويًا
   والسنوي فيه شهرين مجانًا.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  const TIERS = {
    monthly: [{ upTo:24, price:30 }, { upTo:null, price:40 }],
    yearly:  [{ upTo:24, price:300 }, { upTo:null, price:400 }],
  };

  /* سعر الخطة حسب عدد الوحدات */
  window.planPriceFor = function(planKey, units){
    const n = Number(units) || 0;
    const t = TIERS[planKey];
    if (!t) return null;
    for (const s of t) if (s.upTo === null || n <= s.upTo) return s.price;
    return t[t.length - 1].price;
  };

  /* السعر الفعلي لعمارة معيّنة */
  window.buildingPlanPrice = function(b, planKey){
    const units = (b && (b.apartmentsCount ||
      ((window.loadBuildingData && loadBuildingData(b.id)) || {}).apartments?.length)) || 0;
    return planPriceFor(planKey, units);
  };

  /* ---------- حاسبة السعر ---------- */

  window.calcPrice = function(){
    const el = document.getElementById('calcUnits');
    const n = Math.max(0, Number(el && el.value) || 0);
    const out = document.getElementById('calcOut');
    if (!out) return;

    if (!n){
      out.innerHTML = '<p class="small" style="color:var(--muted)">اكتب عدد الوحدات فوق</p>';
      return;
    }

    const m = planPriceFor('monthly', n);
    const y = planPriceFor('yearly', n);
    const perUnit = (m / n).toFixed(2).replace(/\.00$/,'');
    const saved = m * 12 - y;

    out.innerHTML = `
      <div class="grid g2" style="gap:10px">
        <div class="card" style="text-align:center;border:1px solid var(--line)">
          <p class="small" style="color:var(--muted);margin:0">شهري</p>
          <h2 style="margin:4px 0;color:var(--accent)">${m} <span style="font-size:14px">جنيه</span></h2>
          <p class="small" style="margin:0">في الشهر</p>
        </div>
        <div class="card" style="text-align:center;border:2px solid var(--gold);
             background:linear-gradient(135deg,rgba(216,163,59,.10),transparent);position:relative">
          <span style="position:absolute;top:-10px;inset-inline-start:50%;transform:translateX(50%);
                background:var(--gold);color:#fff;font-size:11px;font-weight:700;
                padding:2px 10px;border-radius:10px">وفّر ${saved} ج</span>
          <p class="small" style="color:var(--muted);margin:0">سنوي</p>
          <h2 style="margin:4px 0;color:var(--gold)">${y} <span style="font-size:14px">جنيه</span></h2>
          <p class="small" style="margin:0">شهرين مجانًا 🎁</p>
        </div>
      </div>
      <p class="small mtop" style="text-align:center">
        يعني <b>${perUnit} جنيه في الشهر</b> عن الوحدة الواحدة${
          n >= 20 ? ' — أقل من تمن كوباية شاي' : ''}
      </p>`;
  };

  /* قسم الحاسبة في الصفحة الرئيسية */
  function calcSection(){
    return `
    <div class="section-title" style="text-align:center"><h3>💰 احسب اشتراكك في ثانية</h3></div>
    <p class="small" style="text-align:center;color:var(--muted);margin-bottom:12px">
      السعر للعمارة كلها — مش لكل وحدة.</p>

    <div class="card" style="max-width:460px;margin:0 auto">
      <div class="field2"><label>عدد وحدات عمارتك</label>
        <input id="calcUnits" type="number" min="1" max="500" placeholder="مثال: 40"
          oninput="calcPrice()" style="font-size:18px;text-align:center"></div>

      <div id="calcOut" class="mtop">
        <p class="small" style="color:var(--muted);text-align:center">اكتب عدد الوحدات فوق</p>
      </div>

      <div class="mtop2" style="border-top:1px dashed var(--line);padding-top:10px">
        <p class="small" style="text-align:center;margin:0">
          🎁 <b>أول شهرين مجانًا بالكامل</b> — من غير بيانات بنكية</p>
      </div>

      <button class="btn primary mtop" style="width:100%;padding:12px"
        onclick="openSignup()">ابدأ مجانًا دلوقتي</button>
    </div>

    <div class="card mtop2" style="max-width:460px;margin:14px auto 0;background:var(--tint,#F3F8F7)">
      <b class="small">الأسعار بالتفصيل</b>
      <div class="mtop">
        ${[['حتى ٢٤ وحدة','٣٠ جنيه','٣٠٠ جنيه'],
           ['أكتر من ٢٤ وحدة','٤٠ جنيه','٤٠٠ جنيه']].map(r => `
          <div class="flexrow small" style="padding:5px 0;border-bottom:1px dashed var(--line)">
            <span style="flex:1">${r[0]}</span>
            <span style="min-width:78px;text-align:center">${r[1]} / شهر</span>
            <span style="min-width:78px;text-align:center;color:var(--gold);font-weight:700">
              ${r[2]} / سنة</span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  /* بنحطها قبل قسم المميزات في الصفحة الرئيسية */
  const origLanding = window.landingHTML;
  if (typeof origLanding === 'function' && !origLanding.__calc){
    const wrapped = function(){
      const html = origLanding.apply(this, arguments);
      const mark = '<div class="section-title" style="text-align:center"><h3>مميزات البرنامج</h3>';
      const i = html.indexOf(mark);
      const sec = calcSection();
      return i > -1 ? html.slice(0,i) + sec + html.slice(i) : html + sec;
    };
    wrapped.__calc = true;
    window.landingHTML = wrapped;
  }

  /* ---------- عرض السعر الصحيح في شاشة الاشتراك ---------- */

  const origPlanPrice = window.planPrice;
  window.planPrice = function(planKey, b){
    const p = planPriceFor(planKey, (b && b.apartmentsCount) ||
      (window.D && D.apartments ? D.apartments.length : 0));
    if (p !== null && p !== undefined) return p;
    return origPlanPrice ? origPlanPrice.apply(this, arguments) : 0;
  };

  console.log('[عمارتنا] التسعير بالشرائح جاهز');
})();
