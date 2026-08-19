/* ============================================================
   عمارتنا — أكواد الخصم: جدول + فلاتر + توضيح الحالة
   ------------------------------------------------------------
   المشكلة اللي اتصلحت: "تعطيل" كان بيخلي الكارت يبان زي الباقي
   تقريبًا، فالمستخدم يفتكر إن الكود اتحذف. دلوقتي:
     • جدول بأعمدة واضحة + فلاتر (فعّال · معطّل · منتهي · الكل)
     • رسالة صريحة بعد التعطيل توضّح إنه لسه موجود
     • الكوبونات المعطّلة بتظهر باهتة بعلامة واضحة
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const V = {}, F = {};
  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));

  window.setCouponView   = m => { V.mode = m; renderSysContent(); };
  window.setCouponFilter = k => { F.key = k; renderSysContent(); };

  function state(c){
    if (c.active === false) return { key:'off',  label:'معطّل',  badge:'n', icon:'⏸️' };
    if (c.expiryDate && c.expiryDate < today()) return { key:'exp', label:'منتهي', badge:'r', icon:'⌛' };
    if (c.maxUses && (c.usedCount||0) >= c.maxUses)
      return { key:'used', label:'استُهلك بالكامل', badge:'y', icon:'🔒' };
    return { key:'on', label:'فعّال', badge:'g', icon:'✅' };
  }

  const FILTERS = [
    { k:'all', label:'الكل' },
    { k:'on',  label:'فعّال',  test:c => state(c).key === 'on' },
    { k:'off', label:'معطّل',  test:c => state(c).key === 'off' },
    { k:'exp', label:'منتهي أو مستهلك', test:c => ['exp','used'].includes(state(c).key) },
  ];

  const origCoupons = window.pageSysCoupons;
  if (origCoupons) window.pageSysCoupons = function(){
    const all = [...(window.ensureCoupons ? ensureCoupons() : [])]
      .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    const counts = {};
    FILTERS.forEach(f => counts[f.k] = f.test ? all.filter(f.test).length : all.length);
    const fk = F.key || 'all';
    const sel = FILTERS.find(f => f.k === fk) || FILTERS[0];
    const shown = sel.test ? all.filter(sel.test) : all;
    const mode = V.mode || 'table';

    const bar = `
      <div class="flexrow mtop" style="flex-wrap:wrap;gap:8px;align-items:center">
        <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
          <button class="btn sm ${mode==='table'?'primary':'ghost'}" style="border-radius:0"
            onclick="setCouponView('table')">📋 قائمة</button>
          <button class="btn sm ${mode==='cards'?'primary':'ghost'}" style="border-radius:0"
            onclick="setCouponView('cards')">🔲 مربعات</button>
        </span>
        <span style="flex:1"></span>
        ${FILTERS.map(f => `<button class="btn sm ${fk===f.k?'primary':'ghost'}"
          onclick="setCouponFilter('${f.k}')">${f.label} (${counts[f.k]})</button>`).join('')}
      </div>`;

    const head = `
      <p class="small">أكواد خصم مستقلة عن نظام الإحالة — للحملات الإعلانية والعروض الموسمية.
      العميل بيكتب الكود وقت التسجيل وبيتطبّق لما يرقّي.</p>
      <div class="flexrow mtop"><button class="btn primary" onclick="openCouponModal(null)">+ كود خصم جديد</button></div>
      ${bar}`;

    if (mode === 'cards'){
      return head + `<div class="grid g2 mtop2">${shown.length ? shown.map(c => {
        const st = state(c);
        return `<div class="card" style="${st.key!=='on'?'opacity:.72;':''}">
          <div class="flexrow"><b style="flex:1;letter-spacing:2px">${esc2(c.code)}</b>
            <span class="badge ${st.badge}">${st.icon} ${st.label}</span></div>
          <p class="small mtop">خصم ${c.discountPercent}%${c.expiryDate?' · ينتهي '+esc2(c.expiryDate):''}</p>
          <p class="small">${c.restrictToPlan
            ? 'مقصور على باقة "'+esc2((findPlan(c.restrictToPlan)||{}).name||c.restrictToPlan)+'"'
            : 'شغّال على كل الباقات'}</p>
          <p class="small">الاستخدام: ${c.usedCount||0}${c.maxUses?' من '+c.maxUses:' (بدون حد)'}</p>
          <div class="flexrow mtop">
            <button class="btn sm ghost" onclick="openCouponModal('${c.id}')">تعديل</button>
            <button class="btn sm ghost" onclick="toggleCouponActive('${c.id}')">${c.active===false?'▶️ تفعيل':'⏸️ تعطيل'}</button>
            <button class="btn sm red" onclick="deleteCouponPrompt('${c.id}')">حذف</button>
          </div></div>`;
      }).join('') : '<p class="small">مفيش أكواد مطابقة للفلتر ده.</p>'}</div>`;
    }

    const cols = [
      { key:'code', label:'الكود', value:c => c.code||'',
        cell:c => `<b style="letter-spacing:2px">${esc2(c.code)}</b>` },
      { key:'state', label:'الحالة', value:c => state(c).label,
        cell:c => { const s = state(c); return `<span class="badge ${s.badge}">${s.icon} ${s.label}</span>`; } },
      { key:'pct', label:'الخصم', value:c => Number(c.discountPercent)||0,
        cell:c => `${c.discountPercent}%` },
      { key:'plan', label:'الباقة', value:c => c.restrictToPlan||'',
        cell:c => c.restrictToPlan
          ? esc2((findPlan(c.restrictToPlan)||{}).name || c.restrictToPlan)
          : '<span class="small" style="color:var(--muted)">كل الباقات</span>' },
      { key:'used', label:'الاستخدام', value:c => Number(c.usedCount)||0,
        cell:c => `${c.usedCount||0}${c.maxUses?' <span class="small">من '+c.maxUses+'</span>':''}` },
      { key:'expiry', label:'ينتهي في', value:c => c.expiryDate||'',
        cell:c => c.expiryDate ? esc2(c.expiryDate)
          : '<span class="small" style="color:var(--muted)">بلا نهاية</span>' },
      { key:'created', label:'اتعمل في', value:c => c.createdAt||'',
        cell:c => esc2((c.createdAt||'').slice(0,10)) },
      { key:'x', label:'', value:null, cell:c => `<div class="flexrow">
          <button class="btn sm" onclick="openCouponModal('${c.id}')">تعديل</button>
          <button class="btn sm ghost" onclick="toggleCouponActive('${c.id}')">${c.active===false?'▶️ تفعيل':'⏸️ تعطيل'}</button>
          <button class="btn sm red" onclick="deleteCouponPrompt('${c.id}')">حذف</button></div>` },
    ];

    return head + `<div class="mtop">${sortableTable('couponsTable', shown, cols, null,
      { defaultKey:'created', emptyText:'مفيش أكواد مطابقة للفلتر ده',
        exportName:'أكواد الخصم' })}</div>`;
  };

  /* توضيح إن التعطيل مش حذف */
  const origToggle = window.toggleCouponActive;
  if (origToggle) window.toggleCouponActive = function(id){
    const before = (window.ensureCoupons ? ensureCoupons() : []).find(c => c.id === id);
    const wasActive = !(before && before.active === false);
    const r = origToggle.apply(this, arguments);
    if (window.toast)
      toast(wasActive
        ? '⏸️ الكود اتعطّل — لسه موجود وتقدر تفعّله تاني'
        : '▶️ الكود اتفعّل');
    // لو المستخدم شايف فلتر "فعّال" والكود اتعطّل، ينقله لـ"الكل"
    if (wasActive && (F.key === 'on')) F.key = 'all';
    if (window.renderSysContent) renderSysContent();
    return r;
  };

  console.log('[عمارتنا] جدول أكواد الخصم جاهز');
})();
