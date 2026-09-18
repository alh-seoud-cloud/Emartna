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

  /* ⚠️ الأسعار كانت مكتوبة في الكود، فأي تعديل من شاشة الخطط
     ما كانش بيبان في الحاسبة ولا الصفحة الرئيسية.
     دلوقتي بتتقرا من الباقات المسجّلة. */
  const FALLBACK = {
    monthly: [{ upTo:24, price:30 },  { upTo:null, price:40 }],
    yearly:  [{ upTo:24, price:300 }, { upTo:null, price:400 }],
  };

  function planOf(key){
    try{
      const list = (window.ensurePlans ? ensurePlans() : (window.REG && REG.plans)) || [];
      return list.find(p => p.key === key && p.active !== false) || null;
    }catch(e){ return null; }
  }

  /* شرائح الخطة: من features.tiers لو متسجّلة، وإلا سعر الخطة نفسه */
  function tiersOf(key){
    const p = planOf(key);
    if (p){
      const t = p.features && p.features.tiers;
      if (Array.isArray(t) && t.length)
        return t.map(x => ({ upTo: x.upTo ?? null, price: Number(x.price) || 0 }));
      const price = Number(p.priceBefore ?? p.price) || 0;
      if (price) return [{ upTo:null, price }];      // سعر موحّد
    }
    return FALLBACK[key] || [];
  }
  window.planTiers = tiersOf;

  const TIERS = new Proxy({}, { get: (_, k) => tiersOf(String(k)) });


  /* صفوف جدول الأسعار — من الباقات مباشرة */
  function priceRows(){
    const m = tiersOf('monthly'), y = tiersOf('yearly');
    return m.map((t, i) => {
      const label = t.upTo === null
        ? (m.length === 1 ? 'أي عدد وحدات' : `أكتر من ${m[i-1] ? m[i-1].upTo : 0} وحدة`)
        : `حتى ${t.upTo} وحدة`;
      const yr = (y[i] && y[i].price) || (y[y.length-1] && y[y.length-1].price) || '';
      return [label, t.price, yr];
    });
  }
  window.priceRows = priceRows;

  /* أقل سعر شهري — للشرائط الدعائية */
  window.lowestPrice = function(){
    const m = tiersOf('monthly').map(t => t.price).filter(Boolean);
    return m.length ? Math.min(...m) : 30;
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

  /* ============================================================
     👥 المستخدمون الإضافيون
     ------------------------------------------------------------
     الخطة بتغطّي: الوحدات + رئيس اتحاد واحد + كل أصحاب الشقق.
     أي مستخدم إداري زيادة له سعر شهري حسب صفته.

     ⚠️ الأسعار بتتقرا من إعدادات المنصة — نفس المصدر اللي
        شاشة الخطط بتعدّله. لو ماوصلتش، بنستعمل الافتراضي.
     ============================================================ */
  const ROLE_PRICE_FALLBACK = {
    admin:20, deputy:20, accountant:20, treasurer:20,
    board:20, manager:20, guard:10, tenant:10, owner:0
  };
  const ROLE_ROWS = [
    ['deputy',    'نائب رئيس الاتحاد'],
    ['accountant','محاسب'],
    ['treasurer', 'أمين الصندوق'],
    ['board',     'عضو مجلس الإدارة'],
    ['manager',   'إداري العمارة'],
    ['guard',     'حارس'],
    ['tenant',    'مستأجر'],
    ['admin',     'رئيس اتحاد إضافي'],
  ];

  let __pricingCfg = null;

  function rolePrice(k){
    const p = __pricingCfg && __pricingCfg.prices;
    const v = p ? Number(p[k]) : NaN;
    return isNaN(v) ? (ROLE_PRICE_FALLBACK[k] ?? 20) : v;
  }

  /* بنجيب الأسعار مرة واحدة — والحاسبة شغالة بالافتراضي لحد ما توصل */
  async function loadPricingCfg(){
    if (__pricingCfg) return __pricingCfg;
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (sb){
        const { data } = await sb.from('platform_settings')
          .select('value').eq('key','user_pricing').maybeSingle();
        if (data && data.value) __pricingCfg = data.value;
      }
    }catch(e){}
    __pricingCfg = __pricingCfg || { prices: ROLE_PRICE_FALLBACK, freeAdmins:1 };
    return __pricingCfg;
  }

  /* صفوف إدخال المستخدمين — في الصفحة والنافذة */
  function usersRowsHTML(sfx){
    /* ⚠️ ٨ خانات ظاهرة من الأول بتحسّس الزائر إن قدامه شغل كتير،
       والأغلبية مش محتاجين حد زيادة. دلوقتي مطوية: سطر واحد هادي.
       ⚠️ والخانات فاضية بتلميح «0» مش قيمة — عشان ما يضطرش يمسح
          الصفر قبل ما يكتب. */
    return `
    <div class="mtop2" style="border-top:1px dashed var(--line);padding-top:10px">
      <div onclick="toggleCalcUsers('${sfx}')"
           style="cursor:pointer;display:flex;align-items:center;gap:8px;
                  padding:8px 10px;border-radius:10px;background:var(--tint,#F3F8F7);
                  border:1px solid var(--line)">
        <span style="font-size:15px">👥</span>
        <span class="small" style="flex:1;line-height:1.5">
          <b>محتاج مستخدمين زيادة؟</b>
          <span style="color:var(--muted)"> — محاسب · حارس · نائب…</span></span>
        <span id="uCount_${sfx}" class="small" style="color:var(--accent);font-weight:700"></span>
        <span id="uArrow_${sfx}" style="color:var(--muted);font-size:13px">▾</span>
      </div>

      <div id="uBox_${sfx}" style="display:none;margin-top:8px">
        <p class="small" style="color:var(--muted);margin:0 0 8px;line-height:1.7">
          الاشتراك شامل <b>رئيس اتحاد</b> و<b>كل أصحاب الشقق</b> مجانًا —
          سيبها فاضية لو مش محتاج.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px">
          ${ROLE_ROWS.map(([k,label])=>`
            <label style="display:flex;align-items:center;gap:6px;
                   border:1px solid var(--line);border-radius:9px;padding:6px 9px">
              <span class="small" style="flex:1;line-height:1.3">${esc2(label)}</span>
              <input class="calc-u-${sfx}" data-role="${k}" type="number" min="0" max="50"
                placeholder="0" inputmode="numeric"
                oninput="calcPriceFull('${sfx}')" onfocus="this.select()"
                style="width:48px;text-align:center;padding:4px 2px;font-size:13px">
            </label>`).join('')}
        </div>
        <div style="text-align:left;margin-top:6px">
          <a href="javascript:void(0)" class="small"
             onclick="resetCalcUsers('${sfx}')" style="color:var(--muted)">تصفير الكل</a>
        </div>
      </div>
    </div>`;
  }

  window.toggleCalcUsers = function(sfx){
    const box = document.getElementById('uBox_'+sfx);
    const arr = document.getElementById('uArrow_'+sfx);
    if (!box) return;
    const open = box.style.display !== 'none';
    box.style.display = open ? 'none' : 'block';
    if (arr) arr.textContent = open ? '▾' : '▴';
  };

  function updateUsersBadge(sfx, total){
    const el = document.getElementById('uCount_'+sfx);
    if (el) el.textContent = total ? ('+' + total) : '';
  }

  window.resetCalcUsers = function(sfx){
    document.querySelectorAll('.calc-u-'+sfx).forEach(i=>{ i.value = ''; });
    calcPriceFull(sfx);
  };

  /* السعر الكامل: الخطة + المستخدمين */
  window.calcPriceFull = function(sfx){
    const unitsEl = document.getElementById(sfx === 'modal' ? 'calcUnitsModal' : 'calcUnits');
    const n = Math.max(0, Number(unitsEl && unitsEl.value) || 0);
    const scope = (unitsEl && unitsEl.closest('.modal')) || document;
    const out = scope.querySelector('[data-calc-out]') || document.getElementById('calcOut');
    if (!out) return;

    if (!n){
      out.innerHTML = '<p class="small" style="color:var(--muted);text-align:center">اكتب عدد الوحدات فوق</p>';
      return;
    }

    /* المستخدمين */
    let usersTotal = 0, totalUsers = 0; const parts = [];
    document.querySelectorAll('.calc-u-'+sfx).forEach(i=>{
      const c = Math.max(0, Number(i.value) || 0);
      if (!c) return;
      const k = i.dataset.role, pr = rolePrice(k);
      if (!pr) return;
      const row = ROLE_ROWS.find(r => r[0] === k);
      usersTotal += c * pr; totalUsers += c;
      parts.push(`${esc2(row ? row[1] : k)} ${c}×${pr}ج`);
    });
    const detail = parts.join(' · ');
    updateUsersBadge(sfx, totalUsers);

    const m = planPriceFor('monthly', n);
    const y = planPriceFor('yearly',  n);
    const mTot = m + usersTotal;
    const yTot = y + usersTotal * 12;
    const perUnit = (mTot / n).toFixed(2).replace(/\.00$/,'');
    const saved = mTot * 12 - yTot;

    out.innerHTML = `
      <div class="grid g2" style="gap:10px">
        <div class="card" style="text-align:center;border:1px solid var(--line)">
          <p class="small" style="color:var(--muted);margin:0">شهري</p>
          <h2 style="margin:4px 0;color:var(--accent)">${mTot} <span style="font-size:14px">جنيه</span></h2>
          <p class="small" style="margin:0">في الشهر</p>
        </div>
        <div class="card" style="text-align:center;border:2px solid var(--gold);
             background:linear-gradient(135deg,rgba(216,163,59,.10),transparent);position:relative">
          ${saved > 0 ? `<span style="position:absolute;top:-10px;inset-inline-start:50%;
                transform:translateX(50%);background:var(--gold);color:#fff;font-size:11px;
                font-weight:700;padding:2px 10px;border-radius:10px">وفّر ${saved} ج</span>` : ''}
          <p class="small" style="color:var(--muted);margin:0">سنوي</p>
          <h2 style="margin:4px 0;color:var(--gold)">${yTot} <span style="font-size:14px">جنيه</span></h2>
          <p class="small" style="margin:0">شهرين مجانًا 🎁</p>
        </div>
      </div>

      <div class="card mtop" style="background:var(--tint,#F3F8F7);padding:10px 12px">
        <div class="flexrow small" style="padding:3px 0;border-bottom:1px dashed var(--line)">
          <span style="flex:1"><b>الاشتراك — ${n} وحدة</b></span>
          <span><b>${m} ج</b></span>
        </div>
        <p class="small" style="color:var(--muted);margin:4px 0 6px">
          شامل رئيس اتحاد + كل أصحاب الشقق</p>
        ${totalUsers ? `
          <div class="flexrow small" style="padding:3px 0">
            <span style="flex:1">مستخدمين إضافيين (${totalUsers})</span>
            <span>${usersTotal} ج</span></div>
          <div class="small" style="color:var(--muted);padding:0 0 4px;line-height:1.7">${detail}</div>
          <div class="flexrow small" style="padding:5px 0;border-top:1px solid var(--line);margin-top:2px">
             <span style="flex:1"><b>الإجمالي شهريًا</b></span><span><b>${mTot} ج</b></span></div>`
          : '<p class="small" style="color:var(--muted);margin:0">مفيش مستخدمين إضافيين — ده السعر الافتراضي.</p>'}
      </div>

      <p class="small mtop" style="text-align:center">
        يعني <b>${perUnit} جنيه في الشهر</b> عن الوحدة الواحدة${
          n >= 20 && usersTotal === 0 ? ' — أقل من تمن كوباية شاي' : ''}
      </p>`;
  };

  /* ---------- حاسبة السعر ---------- */

  /* النافذة بتفتح فوق قسم الحاسبة اللي في الصفحة الرئيسية، والاتنين
     كانوا بنفس المعرّف — فـ getElementById بيرجّع بتاع الصفحة،
     والنتيجة تتكتب هناك بدل النافذة فالمستخدم ما يشوفش حاجة.
     دلوقتي بنمرّر العنصر نفسه، وبنلاقي مخرجه اللي جنبه. */
  window.calcPrice = function(srcEl){
    const el = (srcEl && srcEl.tagName) ? srcEl
             : document.getElementById('calcUnitsModal')
            || document.getElementById('calcUnits');
    if (!el) return;
    /* بنوجّه للحاسبة الكاملة (خطة + مستخدمين). النسخة القديمة
       تحت للتوافق لو حد نداها من مكان تاني. */
    const sfx = el.id === 'calcUnitsModal' ? 'modal' : 'page';
    if (document.querySelector('.calc-u-'+sfx)) return calcPriceFull(sfx);
    const n = Math.max(0, Number(el.value) || 0);
    const scope = el.closest('.modal') || document;
    const out = scope.querySelector('[data-calc-out]')
             || document.getElementById('calcOut');
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
          oninput="calcPrice(this)" style="font-size:18px;text-align:center"></div>

      ${usersRowsHTML('page')}

      <div id="calcOut" data-calc-out class="mtop">
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
        ${priceRows().map(r => `
          <div class="flexrow small" style="padding:5px 0;border-bottom:1px dashed var(--line)">
            <span style="flex:1">${r[0]}</span>
            <span style="min-width:78px;text-align:center">${r[1]} جنيه / شهر</span>
            <span style="min-width:78px;text-align:center;color:var(--gold);font-weight:700">
              ${r[2]} جنيه / سنة</span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  /* ⚠️ قسم الحاسبة اتشال من الصفحة الرئيسية بقرار: كان بياخد
     مساحة كبيرة وبيحسّس الزائر إن قدامه شغل. دلوقتي الحاسبة
     في نافذة بتتفتح من زرار الشريط العلوي، والصفحة بقت أنضف.

     calcSection() فوق لسه موجودة للتوافق لو حد نداها. */

  /* ============================================================
     زرار عائم + شريط علوي للحاسبة
     ------------------------------------------------------------
     الحاسبة كانت في نص الصفحة — الزائر لازم ينزل عشان يشوفها.
     دلوقتي فيه مدخل واضح من أول لحظة، وفي شاشة الدخول كمان.
     ============================================================ */

  window.openPriceCalc = function(){
    openModal(`
      <div style="margin:-18px -18px 0;padding:22px 20px 16px;text-align:center;
           background:linear-gradient(135deg,#159A8C,#0f7a6f);color:#fff;
           border-radius:16px 16px 0 0">
        <div style="font-size:34px">💰</div>
        <h3 style="margin:6px 0 2px;color:#fff">احسب اشتراكك في ثانية</h3>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,.9)">
          السعر للعمارة كلها — مش لكل وحدة</p>
      </div>

      <div class="field2 mtop2"><label>عدد وحدات عمارتك</label>
        <input id="calcUnitsModal" type="number" min="1" max="500" placeholder="مثال: 40"
          oninput="calcPrice(this)" style="font-size:20px;text-align:center;padding:12px"></div>

      ${usersRowsHTML('modal')}

      <div data-calc-out class="mtop">
        <p class="small" style="color:var(--muted);text-align:center">اكتب عدد الوحدات فوق</p>
      </div>

      <div class="card mtop2" style="background:var(--tint,#F3F8F7);padding:10px 12px">
        ${priceRows().map(r => `
          <div class="flexrow small" style="padding:4px 0">
            <span style="flex:1">${r[0]}</span>
            <span style="min-width:70px;text-align:center">${r[1]} / شهر</span>
            <span style="min-width:78px;text-align:center;color:var(--gold);font-weight:700">${r[2]} / سنة</span>
          </div>`).join('')}
      </div>

      <p class="small mtop" style="text-align:center">
        🎁 <b>أول شهرين مجانًا بالكامل</b> — من غير بيانات بنكية</p>

      <button class="btn primary mtop" style="width:100%;padding:13px;font-size:15px"
        onclick="closeModal();setTimeout(()=>openSignup(),150)">ابدأ مجانًا دلوقتي</button>`, true);
    setTimeout(() => { const el = document.getElementById('calcUnitsModal'); if (el) el.focus(); }, 200);
    /* الأسعار بتوصل بعد لحظة — نحدّث الأرقام المعروضة لما تجي */
    loadPricingCfg().then(()=>{ try{
      if (document.getElementById('calcUnitsModal')) calcPriceFull('modal');
    }catch(e){} });
  };

  /* الزرار العائم بقى واحد في emartna-welcome.js وبيفتح
     الحاسبة والتجربة مع بعض — عشان ما يتكدّسوش على الموبايل. */

  /* ⚠️ الشريط الأخضر اللي كان في نص الصفحة اتشال: بقى فيه زرار
     «💰 احسب اشتراكك» في الشريط العلوي نفسه — أوضح، ومتاح من
     أي مكان في الصفحة، ومابياخدش مساحة. */

  /* وفي شاشة الدخول */
  const origLogin = window.loginHTML;
  if (typeof origLogin === 'function' && !origLogin.__calc){
    const wrapped = function(){
      const html = origLogin.apply(this, arguments);
      if (window.landingUIOn && !landingUIOn('loginCalc')) return html;
      const link = `
        <p class="small" style="text-align:center;margin-top:14px">
          <a href="javascript:void(0)" onclick="openPriceCalc()"
             style="color:var(--accent);font-weight:700">💰 احسب اشتراك عمارتك</a>
          <span style="color:var(--muted)"> · من ${lowestPrice()} جنيه شهريًا</span>
        </p>`;
      return html + link;
    };
    wrapped.__calc = true;
    window.loginHTML = wrapped;
  }

  /* ---------- عرض السعر الصحيح في شاشة الاشتراك ---------- */

  const origPlanPrice = window.planPrice;
  window.planPrice = function(planKey, b){
    const p = planPriceFor(planKey, (b && b.apartmentsCount) ||
      (window.D && D.apartments ? D.apartments.length : 0));
    if (p !== null && p !== undefined) return p;
    return origPlanPrice ? origPlanPrice.apply(this, arguments) : 0;
  };

  /* الأسعار بتتحمّل مرة واحدة عند بدء البرنامج — عشان الصفحة
     الرئيسية تعرض الأرقام الصح من غير انتظار. */
  setTimeout(()=>{ loadPricingCfg().then(()=>{ try{
    if (document.getElementById('calcUnits') &&
        Number(document.getElementById('calcUnits').value)) calcPriceFull('page');
  }catch(e){} }); }, 1500);

  console.log('[عمارتنا] التسعير بالشرائح + المستخدمين جاهز');
})();
