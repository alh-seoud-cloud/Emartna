/* ============================================================
   عمارتنا — حد المستخدمين الإداريين
   ------------------------------------------------------------
   رئيس الاتحاد بيقدر يضيف مساعدين (محاسب · إداري)، والخطة
   بتحدد عددهم. أصحاب الوحدات والمستأجرين مالهمش حد لأنهم
   جزء من العمارة نفسها مش من الإدارة.

   وصاحب البرنامج يقدر يدّي عمارة معيّنة حد خاص يغلب الخطة.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const LIMITED = ['accountant','manager','deputy'];

  /* عدد المساعدين النشطين دلوقتي */
  window.staffCount = function(){
    const D = window.D;
    if (!D) return 0;
    return (D.users || []).filter(u =>
      LIMITED.includes(u.role) && u.active !== false && u.inviteStatus !== 'pending').length;
  };

  /* الحد المسموح: حد العمارة الخاص يغلب الخطة */
  window.staffLimit = function(){
    try{
      const rec = window.findBuildingRec ? findBuildingRec(window.activeBuildingId) : null;
      if (rec && rec.maxStaffOverride !== undefined && rec.maxStaffOverride !== null)
        return Number(rec.maxStaffOverride);
      const lic  = rec && window.ensureLicense ? ensureLicense(rec) : null;
      const plan = lic && window.findPlan ? findPlan(lic.plan) : null;
      if (plan && plan.maxStaff !== undefined && plan.maxStaff !== null)
        return Number(plan.maxStaff);
    }catch(e){}
    return null;                       // بلا حد
  };

  /* ============================================================
     الزيادة فوق الحد — تحذير بسعر بدل منع
     ------------------------------------------------------------
     ⚠️ كان بيمنع خالص: «رقّي خطتك أو أوقف مساعد». يعني رئيس اتحاد
        عايز محاسب تالت ومستعد يدفع كان بيترفض — والبرنامج بيرفض
        فلوس بدل ما ياخدها.

     دلوقتي: بنقوله السعر وبنسيبه يقرر. اللي بيرفض بيفضل يرفض،
     واللي موافق بيدفع.

     ⚠️ الرسالة بترجع فاضية (يعني مسموح) — والتحذير بيتعرض في
        شاشة الإضافة نفسها عن طريق staffExtraCost. ده عشان
        الكود القديم اللي بيفحص الرسالة مايتكسرش.
     ============================================================ */
  window.staffLimitBlock = function(role){
    return '';                 /* مفيش منع — التحذير بالسعر بدل المنع */
  };

  /* سعر المستخدم الزيادة — من إعدادات المنصة، وإلا الافتراضي */
  const ROLE_PRICE_FALLBACK = {
    admin:20, deputy:20, accountant:20, treasurer:20,
    board:20, manager:20, guard:10, tenant:10, owner:0
  };
  let __staffPricing = null;

  window.loadStaffPricing = async function(){
    if (__staffPricing) return __staffPricing;
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (sb){
        const { data } = await sb.from('platform_settings')
          .select('value').eq('key','user_pricing').maybeSingle();
        if (data && data.value) __staffPricing = data.value;
      }
    }catch(e){}
    __staffPricing = __staffPricing || { prices: ROLE_PRICE_FALLBACK, freeAdmins: 1 };
    return __staffPricing;
  };

  function priceOf(role){
    const p = __staffPricing && __staffPricing.prices;
    const v = p ? Number(p[role]) : NaN;
    return isNaN(v) ? (ROLE_PRICE_FALLBACK[role] ?? 20) : v;
  }

  /* نص التحذير لو الإضافة دي هتكلّفه — أو '' لو مجانية */
  window.staffExtraCost = function(role){
    if (!LIMITED.includes(role)) return '';
    const lim = staffLimit();
    if (lim === null) return '';
    const now = staffCount();
    if (now < lim) return '';
    const pr = priceOf(role);
    if (!pr) return '';
    return `الإضافة دي فوق حد خطتك (${lim}).\n\n` +
      `هتزيد فاتورتك ${pr} جنيه في الشهر — بتتحسب مع أول تجديد، ` +
      `مش دلوقتي.\n\n` +
      `تحب تكمّل؟`;
  };

  /* بطاقة الاستخدام */
  window.staffUsageCard = function(){
    const lim = staffLimit(), now = staffCount();
    if (lim === null)
      return `<p class="small" style="color:var(--muted)">المساعدون: ${now} · بلا حد</p>`;
    const pct  = lim ? Math.min(100, Math.round(now / lim * 100)) : 100;
    const full = now >= lim;
    return `
      <div class="card mtop" style="padding:10px 12px;border:1px solid ${full?'var(--gold)':'var(--line)'}">
        <div class="flexrow" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div>
            <b class="small">المساعدون: ${now} من ${lim}${
              now > lim ? ` <span style="color:var(--gold)">(+${now-lim} مدفوع)</span>` : ''}</b>
            <div class="small" style="color:var(--muted)">
              محاسب وإداري — رئيس الاتحاد وأصحاب الوحدات مش محسوبين</div>
          </div>
          <div style="min-width:120px">
            <div style="height:7px;background:var(--line);border-radius:5px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${full?'var(--gold)':'var(--accent)'}"></div>
            </div>
          </div>
        </div>
        ${full ? `<p class="small mtop" style="color:var(--gold)">
          وصلت لحد خطتك. تقدر تضيف أكتر — كل مساعد زيادة بيزوّد
          <b>${priceOf('accountant')} جنيه</b> على فاتورتك الشهرية،
          بتتحسب مع أول تجديد.
          <a href="javascript:void(0)" onclick="go('license')">شوف الاشتراك</a></p>` : ''}
      </div>`;
  };

  /* ---------- الحقن في الشاشات ---------- */

  /* ⚠️ كان بيمنع خالص. دلوقتي بيسأل بالسعر ويكمّل لو وافق —
     والرفض بيوقف العملية زي الأول. */
  function guard(fnName, roleGetter){
    const orig = window[fnName];
    if (typeof orig !== 'function' || orig.__staffGuard) return;
    const wrapped = function(){
      const args = arguments, self = this;
      let role = null, msg = '';
      try{
        role = roleGetter();
        const blk = staffLimitBlock(role);          /* لسه موجودة للتوافق */
        if (blk){ showMessage(blk); return; }
        msg = window.staffExtraCost ? staffExtraCost(role) : '';
      }catch(e){}

      if (!msg) return orig.apply(self, args);

      /* فوق الحد: بنقول السعر وبنستنى موافقته */
      try{
        if (window.confirmDelete){
          confirmDelete(msg, () => { try{ orig.apply(self, args); }catch(e){} });
          return;
        }
      }catch(e){}
      /* مفيش نافذة تأكيد؟ نكمّل عادي — مانوقفش الشغل */
      return orig.apply(self, args);
    };
    wrapped.__staffGuard = true;
    window[fnName] = wrapped;
  }

  /* الأسعار بتتحمّل مرة واحدة — التحذير محتاجها */
  setTimeout(() => { try{ loadStaffPricing(); }catch(e){} }, 1200);

  function hook(){
    guard('saveUser', () => {
      const el = document.getElementById('uRole');
      const editing = !!document.getElementById('uUser')?.disabled;
      return (!editing && el) ? el.value : '';    // الحد على الإضافة بس
    });
    guard('createAdminInvite', () => {
      const el = document.getElementById('nuRole');
      return el ? el.value : '';
    });

    /* البطاقة نفسها بقت جوه بطاقة الصلاحيات الموحّدة
       في emartna-resaccess.js — عشان ما تتكررش. */
  }
  hook();
  [900, 2500, 5000].forEach(ms => setTimeout(hook, ms));

  /* ---------- تحكّم صاحب البرنامج ---------- */

  window.openStaffOverride = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const lic  = window.ensureLicense ? ensureLicense(b) : {};
    const plan = window.findPlan ? findPlan(lic.plan) : null;
    const planLim = plan && plan.maxStaff != null ? plan.maxStaff : 'بلا حد';
    openModal(`
      <h3>👥 حد المساعدين — ${esc2(b.name)}</h3>
      <p class="small mtop">خطة العمارة بتسمح بـ<b>${planLim}</b> مساعد.
      تقدر تدّيها حد خاص يغلب الخطة.</p>
      <div class="field2 mtop2"><label>حد خاص لهذه العمارة</label>
        <input id="soVal" type="number" min="0" placeholder="سيبه فاضي = حسب الخطة"
          value="${b.maxStaffOverride != null ? b.maxStaffOverride : ''}"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveStaffOverride('${esc2(bid)}')">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveStaffOverride = function(bid){
    const b = REG.buildings.find(x => x.id === bid);
    if (!b) return;
    const v = (document.getElementById('soVal') || {}).value;
    b.maxStaffOverride = String(v).trim() === '' ? null : Math.max(0, Number(v) || 0);
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظ حد المساعدين');
    if (window.renderSysContent) renderSysContent();
  };

  console.log('[عمارتنا] حد المساعدين جاهز');
})();
