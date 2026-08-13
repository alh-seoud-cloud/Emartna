/* ============================================================
   عمارتنا — كشف حساب موحّد لكل حاجة
   ------------------------------------------------------------
   يفتح كشف حساب بفترة قابلة للاختيار لأي عنصر في البرنامج:

     الشقة/المحل · الحساب (خزينة/بنك) · المشروع
     المقاول/المورد · بند الصرف

   الكشف بيعرض: رصيد أول المدة · الوارد · المنصرف ·
   رصيد آخر المدة · وكل الحركات برصيد متراكم.
   ============================================================ */

(function(){
  'use strict';

  const S = () => (window.__stmt = window.__stmt || { from:'', to:'', kind:null, id:null });

  const esc2  = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const cash  = n => (window.money ? money(n) : String(n));
  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));

  /* ---------- بناء الحركات حسب نوع الكشف ---------- */

  function build(kind, id){
    const D = window.D;
    const unit = a => (window.unitLabel ? unitLabel(a) : (a ? ('وحدة ' + a.number) : '-'));
    const ap   = i => (D.apartments || []).find(x => x.id === i);
    const rows = [];
    let opening = 0, title = 'كشف حساب', subtitle = '';
    let inLabel = 'وارد', outLabel = 'منصرف';

    if (kind === 'account'){
      const acc = (D.accounts || []).find(a => a.id === id);
      if (!acc) return null;
      title = 'كشف حساب: ' + acc.name;
      subtitle = acc.type === 'نقدي' ? '💵 خزينة نقدية' : '🏦 ' + (acc.bankName || 'حساب بنكي');
      opening = Number(acc.opening) || 0;
      (D.ledger || []).forEach(l => {
        if (l.accountId !== id) return;
        if (l.type === 'دفعة') rows.push({ date:l.date, type:'تحصيل من ' + unit(ap(l.apartmentId)), note:l.note, amount:+l.amount, dir:1 });
        if (l.type === 'صرف')  rows.push({ date:l.date, type:'صرف/استرداد لـ' + unit(ap(l.apartmentId)), note:l.note, amount:+l.amount, dir:-1 });
      });
      (D.expenses || []).forEach(e => {
        if (e.accountId === id) rows.push({ date:e.date, type:'مصروف: ' + (e.category||'أخرى'), note:e.description, amount:+e.amount, dir:-1 });
      });
      (D.transfers || []).forEach(t => {
        if (t.from === id) rows.push({ date:t.date, type:'تحويل صادر', note:t.note, amount:+t.amount, dir:-1 });
        if (t.to   === id) rows.push({ date:t.date, type:'تحويل وارد', note:t.note, amount:+t.amount, dir:1 });
      });
    }

    else if (kind === 'apartment'){
      const a = ap(id);
      if (!a) return null;
      title = 'كشف حساب: ' + unit(a);
      subtitle = a.ownerName || '';
      opening = Number(a.openingBalance) || 0;
      inLabel = 'مستحق'; outLabel = 'مدفوع';
      (D.ledger || []).forEach(l => {
        if (l.apartmentId !== id) return;
        const t = l.type;
        const dir = (t === 'دفعة') ? -1 : (t === 'صرف') ? 1 : (t === 'تسوية') ? 1 : 1;
        const label = t === 'شهري' ? ('اشتراك ' + (l.month || ''))
                    : t === 'مشروع' ? ('مشروع: ' + (l.project || ''))
                    : t === 'دفعة'  ? 'دفعة'
                    : t === 'صرف'   ? 'استرداد'
                    : 'تسوية';
        rows.push({ date:l.date, type:label, note:l.note, amount:Math.abs(+l.amount), dir: (+l.amount < 0 ? -dir : dir) });
      });
    }

    else if (kind === 'project'){
      const p = (D.projects || []).find(x => x.id === id);
      if (!p) return null;
      title = 'كشف حساب مشروع: ' + p.name;
      subtitle = p.description || '';
      inLabel = 'محصّل'; outLabel = 'مصروف';
      (D.ledger || []).forEach(l => {
        if (l.projectId !== id) return;
        if (l.type === 'دفعة') rows.push({ date:l.date, type:'سداد مساهمة — ' + unit(ap(l.apartmentId)), note:l.note, amount:+l.amount, dir:1 });
      });
      (D.expenses || []).forEach(e => {
        if (e.projectId === id) rows.push({ date:e.date, type:'مصروف: ' + (e.category||'أخرى'), note:e.description, amount:+e.amount, dir:-1 });
      });
    }

    else if (kind === 'vendor'){
      const v = (D.vendors || []).find(x => x.id === id);
      if (!v) return null;
      title = 'كشف حساب: ' + v.name;
      subtitle = v.category || '';
      inLabel = '—'; outLabel = 'مدفوع له';
      (D.expenses || []).forEach(e => {
        if (e.vendorId === id) rows.push({ date:e.date, type:'مصروف: ' + (e.category||'أخرى'), note:e.description, amount:+e.amount, dir:-1 });
      });
    }

    else if (kind === 'category'){
      title = 'كشف بند صرف: ' + id;
      inLabel = '—'; outLabel = 'مصروف';
      (D.expenses || []).forEach(e => {
        if ((e.category || 'أخرى') === id) rows.push({ date:e.date, type:e.description || 'مصروف', note:(e.vendorId ? vendorName(e.vendorId) : ''), amount:+e.amount, dir:-1 });
      });
    }

    else return null;

    rows.sort((a,b) => (a.date||'').localeCompare(b.date||''));
    return { title, subtitle, opening, rows, inLabel, outLabel };
  }

  function vendorName(id){
    const v = ((window.D||{}).vendors || []).find(x => x.id === id);
    return v ? v.name : '';
  }

  /* ---------- أزرار الفترة ---------- */

  window.setStmtPeriod = function(months){
    const s = S();
    if (months === 'all'){ s.from = ''; s.to = ''; }
    else if (months === 'year'){
      s.from = new Date().getFullYear() + '-01-01';
      s.to   = today();
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() - months + 1);
      s.from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
      s.to   = today();
    }
    renderStatement();
  };

  window.applyStmtDates = function(){
    const s = S();
    const f = document.getElementById('stmtFrom'), t = document.getElementById('stmtTo');
    if (f) s.from = f.value || '';
    if (t) s.to   = t.value || '';
    renderStatement();
  };

  /* ---------- العرض ---------- */

  function renderStatement(){
    const s = S();
    const data = build(s.kind, s.id);
    const host = document.getElementById('stmtHost');
    if (!data || !host) return;

    const from = s.from, to = s.to;
    const before = data.rows.filter(r => from && (r.date || '') < from);
    const shown  = data.rows.filter(r => (!from || (r.date||'') >= from) && (!to || (r.date||'') <= to));

    let openBal = data.opening;
    before.forEach(r => { openBal += r.dir * r.amount; });

    const totalIn  = shown.filter(r => r.dir > 0).reduce((a,r) => a + r.amount, 0);
    const totalOut = shown.filter(r => r.dir < 0).reduce((a,r) => a + r.amount, 0);
    const closeBal = openBal + totalIn - totalOut;

    let run = openBal;
    const withBal = shown.map(r => { run += r.dir * r.amount; return Object.assign({}, r, { balance: run }); })
                         .slice().reverse();   // الأحدث فوق

    const cols = [
      { key:'date',    label:'التاريخ', value:r => r.date || '', cell:r => esc2(r.date || '') },
      { key:'type',    label:'البيان',  value:r => r.type || '', cell:r => esc2(r.type || '') },
      { key:'note',    label:'ملاحظة',  value:r => r.note || '', cell:r => esc2(r.note || '') },
      { key:'amount',  label:'المبلغ',  value:r => r.dir * r.amount,
        cell:r => `<span style="color:${r.dir>0?'var(--accent)':'var(--red)'}">${r.dir>0?'+':'−'}${cash(r.amount)}</span>` },
      { key:'balance', label:'الرصيد بعدها', value:r => r.balance, cell:r => cash(r.balance) },
    ];

    host.innerHTML = `
      <div class="grid g4 mtop">
        <div class="kpi"><div class="ic">📅</div><div class="lbl">رصيد أول المدة</div><div class="val" style="font-size:15px">${cash(openBal)}</div></div>
        <div class="kpi ok"><div class="ic">📥</div><div class="lbl">${esc2(data.inLabel)}</div><div class="val" style="font-size:15px">${cash(totalIn)}</div></div>
        <div class="kpi owe"><div class="ic">📤</div><div class="lbl">${esc2(data.outLabel)}</div><div class="val" style="font-size:15px">${cash(totalOut)}</div></div>
        <div class="kpi ${closeBal>=0?'ok':'owe'}"><div class="ic">🧾</div><div class="lbl">رصيد آخر المدة</div><div class="val" style="font-size:15px">${cash(closeBal)}</div></div>
      </div>
      <p class="small mtop">${shown.length} حركة في الفترة${before.length ? ` · ${before.length} حركة قبلها مضمومة في رصيد أول المدة` : ''}</p>
      <div class="mtop">${window.sortableTable('stmtTable', withBal, cols, null, {
        defaultKey:'date',
        emptyText:'مفيش حركات في الفترة دي',
        exportName: data.title,
      })}</div>`;
  }
  window.renderStatement = renderStatement;

  window.openStatement = function(kind, id){
    const data = build(kind, id);
    if (!data) return (window.showMessage ? showMessage('تعذّر فتح كشف الحساب') : null);
    const s = S();
    s.kind = kind; s.id = id;
    if (s.from === undefined) s.from = '';
    const btn = (label, arg) => `<button class="btn sm ghost" onclick="setStmtPeriod(${typeof arg==='string'?`'${arg}'`:arg})">${label}</button>`;

    window.openModal(`
      <h3>${esc2(data.title)}</h3>
      ${data.subtitle ? `<p class="small" style="color:var(--muted)">${esc2(data.subtitle)}</p>` : ''}
      <div class="card mtop">
        <div class="grid g2">
          <div class="field2"><label>من تاريخ</label><input id="stmtFrom" type="date" value="${s.from}" onchange="applyStmtDates()"></div>
          <div class="field2"><label>إلى تاريخ</label><input id="stmtTo" type="date" value="${s.to}" onchange="applyStmtDates()"></div>
        </div>
        <div class="flexrow mtop">
          ${btn('آخر 3 شهور',3)} ${btn('آخر 6 شهور',6)} ${btn('آخر 12 شهر',12)}
          ${btn('السنة الحالية','year')} ${btn('كل الفترة','all')}
        </div>
      </div>
      <div id="stmtHost"></div>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);

    renderStatement();
  };

  /* ---------- ربط الكشف بالشاشات الموجودة ---------- */

  // الحسابات (خزينة/بنك) — نستبدل الكشف القديم اللي مكانش فيه فترة
  window.openAccountStatement = id => openStatement('account', id);

  // بنود الصرف — الكشف القديم كان بيقرا حقول غلط فبيطلع أعمدة فاضية
  window.openCategoryDrilldown = cat => openStatement('category', cat);

  // زرار "كشف الحساب" جوه نوافذ المقاول والمشروع
  function addStatementButton(kind, id, label){
    setTimeout(() => {
      const box = document.getElementById('modalBox');
      if (!box) return;
      let bar = box.querySelector('.modal-actions');
      if (!bar){
        bar = document.createElement('div');
        bar.className = 'modal-actions';
        box.appendChild(bar);
      }
      if (bar.querySelector('.stmt-btn')) return;
      const b = document.createElement('button');
      b.className = 'btn gold sm stmt-btn';
      b.textContent = label;
      b.onclick = () => openStatement(kind, id);
      bar.insertBefore(b, bar.firstChild);
    }, 0);
  }

  const origVendor = window.openVendorDetailModal;
  if (origVendor) window.openVendorDetailModal = function(id){
    origVendor(id);
    addStatementButton('vendor', id, '🧾 كشف الحساب');
  };

  const origProject = window.viewProject;
  if (origProject) window.viewProject = function(id){
    origProject(id);
    addStatementButton('project', id, '🧾 كشف حساب المشروع');
  };

  console.log('[عمارتنا] كشف الحساب الموحّد جاهز');
})();
