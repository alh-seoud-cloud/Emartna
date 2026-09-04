/* ============================================================
   عمارتنا — صلاحيات السكان لكل عمارة
   ------------------------------------------------------------
   كل عمارة سياستها مختلفة: فيه اتحادات بتعرض المصروفات لكل
   السكان، وفيه اللي بيفضّل يعرضها في الاجتماع بس. وفيه اللي
   بيسمح للمستأجر يشارك في التصويت، وفيه اللي شايف ده حق المالك.

   الشاشة دي بتخلّي رئيس اتحاد كل عمارة يحدد ده بنفسه —
   لصاحب الشقة وللمستأجر كل واحد على حدة.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* الشاشات اللي ينفع رئيس الاتحاد يتحكم فيها.
     "حسابي وشقتي" و"بياناتي" مش هنا لأنها حق أساسي للساكن. */
  const SCREENS = [
    { key:'expenses',        icon:'💳', label:'مصروفات العمارة',
      note:'الساكن يشوف فلوس العمارة راحت فين' },
    { key:'chat',            icon:'💬', label:'محادثة السكان',
      note:'المشاركة في نقاش السكان' },
    { key:'polls',           icon:'🗳️', label:'استطلاعات الرأي',
      note:'التصويت في قرارات العمارة' },
    { key:'announcements',   icon:'📢', label:'الإعلانات',
      note:'قراءة إعلانات الاتحاد والتعليق' },
    { key:'suggestions',     icon:'💡', label:'المقترحات',
      note:'اقتراح تحسينات للعمارة' },
    { key:'meetings',        icon:'🗓️', label:'الاجتماعات',
      note:'مواعيد الاجتماعات ونتائجها' },
    { key:'maintenance',     icon:'🔧', label:'بلاغات الصيانة',
      note:'التبليغ عن الأعطال ومتابعتها' },
    { key:'paymentRequests', icon:'💸', label:'تسجيل دفعة',
      note:'إرسال إثبات التحويل' },
  ];

  /* الافتراضي: كله مفتوح لصاحب الشقة، والمستأجر بلا ماليات */
  const DEFAULTS = {
    owner:  { expenses:true,  chat:true, polls:true,  announcements:true,
              suggestions:true, meetings:true, maintenance:true, paymentRequests:true },
    tenant: { expenses:false, chat:true, polls:false, announcements:true,
              suggestions:true, meetings:true, maintenance:true, paymentRequests:false },
  };

  function policy(){
    const D = window.D;
    if (!D || !D.building) return DEFAULTS;
    D.building.residentAccess = D.building.residentAccess || {};
    const p = D.building.residentAccess;
    p.owner  = Object.assign({}, DEFAULTS.owner,  p.owner  || {});
    p.tenant = Object.assign({}, DEFAULTS.tenant, p.tenant || {});
    return p;
  }
  window.residentPolicy = policy;

  /* هل الشاشة دي مسموحة للساكن ده؟ */
  window.residentCanSee = function(user, screenKey){
    if (!user) return true;
    const role = user.role;
    if (role !== 'owner' && role !== 'tenant') return true;   // الإدارة مالهاش علاقة
    const item = SCREENS.find(s => s.key === screenKey);
    if (!item) return true;                                    // شاشة مش تحت التحكم
    const p = policy();
    return (p[role] || {})[screenKey] !== false;
  };

  /* بنفلتر قوائم الساكن */
  const origVisible = window.visibleNavGroups;
  if (typeof origVisible === 'function' && !origVisible.__resAccess){
    const wrapped = function(u){
      const groups = origVisible.apply(this, arguments);
      if (!u || (u.role !== 'owner' && u.role !== 'tenant')) return groups;
      return groups.map(g => Object.assign({}, g, {
        items: (g.items || []).filter(it => residentCanSee(u, it[0])),
      })).filter(g => (g.items || []).length);
    };
    wrapped.__resAccess = true;
    window.visibleNavGroups = wrapped;

    /* ⚠️ القائمة الجانبية بترسم عند الدخول — قبل ما الوحدة دي
       تتحمّل. فالشاشات المقفولة كانت تفضل ظاهرة لحد ما الساكن
       يضغط عليها ويتقال له "مقفولة". بنعيد رسمها هنا. */
    setTimeout(() => {
      try{
        const u = window.currentUser && currentUser();
        if (u && (u.role === 'owner' || u.role === 'tenant') && window.renderRoot) renderRoot();
      }catch(e){}
    }, 250);
  }

  /* وبنمنع الدخول المباشر للشاشة حتى لو حد كتب اسمها */
  const origGo = window.go;
  if (typeof origGo === 'function' && !origGo.__resAccess){
    const wrapped = function(page){
      try{
        const u = window.currentUser && currentUser();
        if (u && (u.role === 'owner' || u.role === 'tenant') && !residentCanSee(u, page)){
          if (window.showMessage)
            showMessage('الشاشة دي مقفولة في عمارتك.\n\nلو محتاجها، كلّم رئيس الاتحاد.');
          return;
        }
      }catch(e){}
      return origGo.apply(this, arguments);
    };
    wrapped.__resAccess = true;
    window.go = wrapped;
  }

  /* ---------- شاشة الإعداد ---------- */

  window.openResidentAccess = function(){
    const p = policy();
    const row = (s) => `
      <tr>
        <td style="padding:7px 4px">
          <b class="small">${s.icon} ${esc2(s.label)}</b>
          <div class="small" style="color:var(--muted)">${esc2(s.note)}</div>
        </td>
        <td style="text-align:center">
          <input type="checkbox" class="ra-own" data-k="${s.key}"
            ${p.owner[s.key] !== false ? 'checked' : ''}></td>
        <td style="text-align:center">
          <input type="checkbox" class="ra-ten" data-k="${s.key}"
            ${p.tenant[s.key] !== false ? 'checked' : ''}></td>
      </tr>`;

    openModal(`
      <h3>🔐 صلاحيات السكان</h3>
      <p class="small mtop">حدد الشاشات اللي صاحب الشقة والمستأجر يقدروا يفتحوها في عمارتك.
      <b>حسابه ومستحقاته وبياناته الشخصية</b> مفتوحة دايمًا — دي حقه.</p>

      <div class="table-wrap mtop2">
        <table style="width:100%">
          <thead><tr>
            <th style="text-align:start">الشاشة</th>
            <th style="min-width:78px">🏠 صاحب الشقة</th>
            <th style="min-width:70px">🔑 المستأجر</th>
          </tr></thead>
          <tbody>${SCREENS.map(row).join('')}</tbody>
        </table>
      </div>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ghost" onclick="raPreset('open')">افتح الكل</button>
        <button class="btn sm ghost" onclick="raPreset('default')">الوضع الافتراضي</button>
        <button class="btn sm ghost" onclick="raPreset('strict')">الحد الأدنى</button>
      </div>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveResidentAccess()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.raPreset = function(kind){
    document.querySelectorAll('.ra-own').forEach(el => {
      const k = el.dataset.k;
      el.checked = kind === 'open' ? true
        : kind === 'strict' ? ['announcements','maintenance','paymentRequests'].includes(k)
        : DEFAULTS.owner[k] !== false;
    });
    document.querySelectorAll('.ra-ten').forEach(el => {
      const k = el.dataset.k;
      el.checked = kind === 'open' ? true
        : kind === 'strict' ? ['announcements','maintenance'].includes(k)
        : DEFAULTS.tenant[k] !== false;
    });
  };

  window.saveResidentAccess = function(){
    const own = {}, ten = {};
    document.querySelectorAll('.ra-own').forEach(el => { own[el.dataset.k] = el.checked; });
    document.querySelectorAll('.ra-ten').forEach(el => { ten[el.dataset.k] = el.checked; });
    D.building.residentAccess = { owner: own, tenant: ten };
    save();
    closeModal();
    if (window.toast) toast('اتحفظت صلاحيات السكان');
    renderContent();
  };

  /* ============================================================
     بطاقة واحدة لكل الأدوار — بدل بطاقتين منفصلتين كانوا
     بيتكرروا مع كل رسم لأن كل وحدة بتلفّ التانية.
     ============================================================ */

  function roleRow(icon, title, desc, action){
    return `
      <div class="flexrow" style="justify-content:space-between;align-items:center;
           gap:8px;flex-wrap:wrap;padding:8px 0;border-bottom:1px dashed var(--line)">
        <div style="flex:1;min-width:190px">
          <b class="small">${icon} ${esc2(title)}</b>
          <div class="small" style="color:var(--muted);margin-top:2px">${desc}</div>
        </div>
        ${action}
      </div>`;
  }

  function card(){
    const p = policy();
    const onOwn = SCREENS.filter(s => p.owner[s.key]  !== false).length;
    const onTen = SCREENS.filter(s => p.tenant[s.key] !== false).length;
    const lim = window.staffLimit ? staffLimit() : null;
    const now = window.staffCount ? staffCount() : 0;

    return `
      <div class="card" style="border:1px solid var(--line)">
        <b>🔐 الصلاحيات في عمارتك</b>
        <div class="mtop">
          ${roleRow('⭐','رئيس اتحاد العمارة','كل الشاشات — مفيش قيود',
            '<span class="badge g">كامل</span>')}

          ${roleRow('💰','المحاسب والإداري (مساعد)',
            lim === null ? `${now} مساعد · بلا حد`
              : `${now} من ${lim} · الصلاحيات بتتحدد لكل واحد على حدة`,
            `<button class="btn sm ghost" onclick="openUserModal()">+ مساعد</button>`)}

          ${roleRow('🏠','أصحاب الشقق والمحلات',
            `${onOwn} من ${SCREENS.length} شاشة`,
            `<button class="btn sm ghost" onclick="openResidentAccess()">تعديل</button>`)}

          ${roleRow('🔑','المستأجرون',
            `${onTen} من ${SCREENS.length} شاشة`,
            `<button class="btn sm ghost" onclick="openResidentAccess()">تعديل</button>`)}
        </div>
        <p class="small mtop" style="color:var(--muted)">
          حساب أي ساكن ومستحقاته وبياناته الشخصية مفتوحة دايمًا — دي حقه.
        </p>
      </div>`;
  }

  /* ⚠️ اللفّ مرة واحدة بس. الاعتماد على خاصية على الدالة كان بيفشل
     لأن وحدة تانية بتلفّها بعدنا فتختفي العلامة، فنلفّها من جديد
     كل مرة والبطاقة تتكرر. العلامة دلوقتي على مستوى الصفحة. */
  function hook(){
    if (window.__resCardHooked) return;
    const orig = window.pageUsers;
    if (typeof orig !== 'function') return;
    window.__resCardHooked = true;
    const wrapped = function(){ return card() + orig.apply(this, arguments); };
    window.pageUsers = wrapped;
  }
  hook();
  [900, 2500, 5000].forEach(ms => setTimeout(hook, ms));

  console.log('[عمارتنا] صلاحيات السكان جاهزة');
})();
