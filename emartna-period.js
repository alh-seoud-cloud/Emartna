/* ============================================================
   عمارتنا — فلتر الفترة على شاشات الحركات
   ------------------------------------------------------------
   شريط موحّد (من / إلى + أزرار سريعة) على الشاشات اللي بتعرض
   حركات كتيرة، عشان الشاشة تفضل مقروءة مهما كبر تاريخ العمارة.

   ⚠️ مبدأ محاسبي: الفلتر بيقلّل **المعروض** بس.
      الأرصدة والمستحقات بتتحسب دايمًا من كل التاريخ —
      وإلا رصيد الوحدة هيبان غلط.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));

  const DEFAULTS = { exp:3, act:3, payreq:12, treasury:3 };   // بالشهور
  const STORE = 'emartna_period_prefs';

  function load(){
    try{ return JSON.parse(localStorage.getItem(STORE) || '{}'); }catch(e){ return {}; }
  }
  function save(p){ try{ localStorage.setItem(STORE, JSON.stringify(p)); }catch(e){} }

  const P = load();

  function range(key){
    const pref = P[key];
    if (pref && pref.from !== undefined) return pref;
    const months = DEFAULTS[key] ?? 3;
    const d = new Date(); d.setMonth(d.getMonth() - months + 1);
    return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10), to: '' };
  }
  window.periodRange = range;

  window.setPeriodMonths = function(key, months){
    if (months === 'all') P[key] = { from:'', to:'' };
    else if (months === 'year'){ P[key] = { from: new Date().getFullYear()+'-01-01', to: today() }; }
    else {
      const d = new Date(); d.setMonth(d.getMonth() - months + 1);
      P[key] = { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10), to: today() };
    }
    save(P); renderContent();
  };

  window.applyPeriodDates = function(key){
    const f = document.getElementById('pf_' + key), t = document.getElementById('pt_' + key);
    P[key] = { from: (f && f.value) || '', to: (t && t.value) || '' };
    save(P); renderContent();
  };

  /* شريط الفترة */
  function bar(key, shown, total, note){
    const r = range(key);
    const b = (label, arg) => `<button class="btn sm ghost"
      onclick="setPeriodMonths('${key}',${typeof arg==='string'?`'${arg}'`:arg})">${label}</button>`;
    const hidden = total - shown;
    return `
    <div class="card mtop" style="padding:10px">
      <div class="grid g2">
        <div class="field2"><label>من تاريخ</label>
          <input id="pf_${key}" type="date" value="${r.from}" onchange="applyPeriodDates('${key}')"></div>
        <div class="field2"><label>إلى تاريخ</label>
          <input id="pt_${key}" type="date" value="${r.to}" onchange="applyPeriodDates('${key}')"></div>
      </div>
      <div class="flexrow mtop" style="flex-wrap:wrap;gap:6px">
        ${b('آخر 3 شهور',3)} ${b('آخر 6 شهور',6)} ${b('آخر 12 شهر',12)}
        ${b('السنة الحالية','year')} ${b('كل الفترة','all')}
      </div>
      <p class="small mtop" style="color:var(--muted)">
        معروض ${shown} من ${total}${hidden>0?` · ${hidden} مخفية برّه الفترة`:''}${note?` · ${note}`:''}
      </p>
    </div>`;
  }

  const inRange = (d, r) => (!r.from || (d||'') >= r.from) && (!r.to || (d||'') <= r.to);

  /* ---------- ١) المصروفات ---------- */
  const origExp = window.pageExpenses;
  if (origExp) window.pageExpenses = function(){
    const r = range('exp');
    const all = D.expenses || [];
    const keep = all.filter(e => inRange(e.date, r));
    const backup = D.expenses;
    D.expenses = keep;
    let html;
    try{ html = origExp.apply(this, arguments); } finally { D.expenses = backup; }
    return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/,
      '$1' + bar('exp', keep.length, all.length));
  };

  /* ---------- ٢) سجل النشاط ---------- */
  const origAct = window.pageActivity;
  if (origAct) window.pageActivity = function(){
    const r = range('act');
    const all = D.activityLog || [];
    const keep = all.filter(a => inRange((a.date||'').slice(0,10), r));
    const backup = D.activityLog;
    D.activityLog = keep;
    let html;
    try{ html = origAct.apply(this, arguments); } finally { D.activityLog = backup; }
    return bar('act', keep.length, all.length) + html;
  };

  /* ---------- ٣) طلبات الدفع ---------- */
  const origPR = window.pagePaymentRequests;
  if (origPR) window.pagePaymentRequests = function(){
    const r = range('payreq');
    const all = D.paymentRequests || [];
    const keep = all.filter(x => inRange((x.requestedAt||'').slice(0,10), r));
    const backup = D.paymentRequests;
    D.paymentRequests = keep;
    let html;
    try{ html = origPR.apply(this, arguments); } finally { D.paymentRequests = backup; }
    return bar('payreq', keep.length, all.length,
      'الطلبات المنتظرة بتظهر دايمًا') + html;
  };

  /* ---------- ٤) الخزينة: حركات الحسابات ---------- */
  const origTr = window.pageTreasury;
  if (origTr) window.pageTreasury = function(){
    const r = range('treasury');
    const allLed = D.ledger || [], allExp = D.expenses || [], allTrf = D.transfers || [];
    const total = allLed.length + allExp.length + allTrf.length;
    const kLed = allLed.filter(x => inRange(x.date, r));
    const kExp = allExp.filter(x => inRange(x.date, r));
    const kTrf = allTrf.filter(x => inRange(x.date, r));
    const bL = D.ledger, bE = D.expenses, bT = D.transfers;
    D.ledger = kLed; D.expenses = kExp; D.transfers = kTrf;
    let html;
    try{ html = origTr.apply(this, arguments); }
    finally { D.ledger = bL; D.expenses = bE; D.transfers = bT; }
    return html.replace(/(<div class="grid g\d[\s\S]*?<\/div>\s*<\/div>)/,
      '$1' + bar('treasury', kLed.length + kExp.length + kTrf.length, total,
                 '⚠️ أرصدة الحسابات فوق محسوبة من كل التاريخ'));
  };

  console.log('[عمارتنا] فلتر الفترة جاهز');
})();
