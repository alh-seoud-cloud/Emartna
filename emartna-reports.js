/* ============================================================
   عمارتنا — التقارير المحاسبية
   ------------------------------------------------------------
   تبويب جديد فيه:
     ١) ميزان المراجعة — حركة الفترة + الأرصدة + فحص سلامة القيود
                          + مقارنة بفترة سابقة
     ٢) أعمار الديون   — المتأخرات موزّعة حسب عمرها (٣٠/٦٠/٩٠/أكتر)
   ============================================================ */

(function(){
  'use strict';

  const cash  = n => (window.money ? money(n) : String(n));
  const esc2  = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));
  const unit  = a => (window.unitLabel ? unitLabel(a) : ('وحدة ' + (a ? a.number : '')));

  const R = () => (window.__rep = window.__rep || { from:'', to:'', cmp:'prev' });

  const prevDay = d => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate()-1); return x.toISOString().slice(0,10); };
  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0,10); };
  const daysBetween = (a, b) => Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000);

  /* ---------- أدوات الفترة ---------- */

  window.setRepPeriod = function(months){
    const s = R();
    if (months === 'all'){ s.from = ''; s.to = ''; }
    else if (months === 'year'){ s.from = new Date().getFullYear() + '-01-01'; s.to = today(); }
    else {
      const d = new Date(); d.setMonth(d.getMonth() - months + 1);
      s.from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
      s.to = today();
    }
    renderContent();
  };
  window.applyRepDates = function(){
    const s = R();
    const f = document.getElementById('repFrom'), t = document.getElementById('repTo');
    if (f) s.from = f.value || '';
    if (t) s.to = t.value || '';
    renderContent();
  };
  window.setRepCompare = function(v){ R().cmp = v; renderContent(); };

  function periodBar(showCompare){
    const s = R();
    const b = (label, arg) => `<button class="btn sm ghost" onclick="setRepPeriod(${typeof arg==='string'?`'${arg}'`:arg})">${label}</button>`;
    return `
    <div class="card">
      <div class="grid g2">
        <div class="field2"><label>من تاريخ</label><input id="repFrom" type="date" value="${s.from}" onchange="applyRepDates()"></div>
        <div class="field2"><label>إلى تاريخ</label><input id="repTo" type="date" value="${s.to}" onchange="applyRepDates()"></div>
      </div>
      <div class="flexrow mtop">
        ${b('الشهر الحالي',1)} ${b('آخر 3 شهور',3)} ${b('آخر 6 شهور',6)} ${b('آخر 12 شهر',12)}
        ${b('السنة الحالية','year')} ${b('كل الفترة','all')}
      </div>
      ${showCompare ? `
      <div class="field2 mtop"><label>قارن بـ</label>
        <select onchange="setRepCompare(this.value)">
          <option value="none"  ${s.cmp==='none' ?'selected':''}>بدون مقارنة</option>
          <option value="prev"  ${s.cmp==='prev' ?'selected':''}>الفترة السابقة مباشرة (نفس الطول)</option>
          <option value="year"  ${s.cmp==='year' ?'selected':''}>نفس الفترة من السنة اللي فاتت</option>
        </select>
      </div>` : ''}
    </div>`;
  }

  /* حدود الفترة الفعلية (لو فاضية → من أول حركة لآخر حركة) */
  function bounds(){
    const s = R();
    const D = window.D;
    const dates = []
      .concat((D.ledger||[]).map(x => x.date))
      .concat((D.expenses||[]).map(x => x.date))
      .filter(Boolean).sort();
    return {
      from: s.from || (dates[0] || today()),
      to:   s.to   || today(),
    };
  }

  function comparePeriod(from, to){
    const s = R();
    if (s.cmp === 'none') return null;
    if (s.cmp === 'year'){
      const shift = d => { const x = new Date(d+'T00:00:00'); x.setFullYear(x.getFullYear()-1); return x.toISOString().slice(0,10); };
      return { from: shift(from), to: shift(to), label: 'نفس الفترة من السنة اللي فاتت' };
    }
    const len = daysBetween(from, to);
    return { from: addDays(from, -(len+1)), to: addDays(to, -(len+1)), label: 'الفترة السابقة' };
  }

  /* ---------- ١) ميزان المراجعة ---------- */

  function movements(from, to){
    const D = window.D;
    const inR = d => d && d >= from && d <= to;
    const L = (D.ledger || []).filter(l => inR(l.date));
    const sum = arr => arr.reduce((a,x) => a + Number(x.amount || 0), 0);
    return {
      charges:   sum(L.filter(l => l.type === 'شهري')),
      projects:  sum(L.filter(l => l.type === 'مشروع')),
      adjust:    sum(L.filter(l => l.type === 'تسوية')),
      payments:  sum(L.filter(l => l.type === 'دفعة')),
      refunds:   sum(L.filter(l => l.type === 'صرف')),
      expenses:  sum((D.expenses || []).filter(e => inR(e.date))),
      transfers: sum((D.transfers || []).filter(t => inR(t.date))),
      count:     L.length + (D.expenses||[]).filter(e => inR(e.date)).length,
    };
  }

  function balancesAsOf(to){
    const D = window.D;
    const upto = d => !d || d <= to;
    const sum = arr => arr.reduce((a,x) => a + Number(x.amount || 0), 0);
    const L = (D.ledger || []).filter(l => upto(l.date));
    const E = (D.expenses || []).filter(e => upto(e.date));

    const apOpen  = (D.apartments || []).reduce((a,x) => a + (Number(x.openingBalance) || 0), 0);
    const accOpen = (D.accounts   || []).reduce((a,x) => a + (Number(x.opening)        || 0), 0);

    const charges  = sum(L.filter(l => l.type === 'شهري'));
    const projects = sum(L.filter(l => l.type === 'مشروع'));
    const adjust   = sum(L.filter(l => l.type === 'تسوية'));
    const payments = sum(L.filter(l => l.type === 'دفعة'));
    const refunds  = sum(L.filter(l => l.type === 'صرف'));
    const expenses = sum(E);

    const receivables = apOpen + charges + projects + adjust + refunds - payments;  // ذمم الملاك
    const treasury    = accOpen + payments - refunds - expenses;                     // أرصدة الحسابات
    const fund        = apOpen + accOpen + charges + projects + adjust - expenses;   // حقوق العمارة

    return { apOpen, accOpen, charges, projects, adjust, payments, refunds, expenses,
             receivables, treasury, fund, diff: (receivables + treasury) - fund };
  }

  /* أرصدة الوحدات حتى تاريخ: مدينون (مستحق) ودائنون (دفع مقدم) */
  function unitBalances(to){
    const D = window.D;
    const upto = d => !d || d <= to;
    let debit = 0, credit = 0;
    (D.apartments || []).forEach(a => {
      let b = Number(a.openingBalance) || 0;
      (D.ledger || []).forEach(l => {
        if (l.apartmentId !== a.id || !upto(l.date)) return;
        const amt = Number(l.amount) || 0;
        if (l.type === 'دفعة') b -= amt; else b += amt;
      });
      if (b > 0) debit += b; else credit += -b;
    });
    return { debit, credit };
  }

  /* أرصدة كل حساب على حدة حتى تاريخ */
  function accountBalances(to){
    const D = window.D;
    const upto = d => !d || d <= to;
    return (D.accounts || []).map(a => {
      let b = Number(a.opening) || 0;
      (D.ledger || []).forEach(l => {
        if (l.accountId !== a.id || !upto(l.date)) return;
        const amt = Number(l.amount) || 0;
        if (l.type === 'دفعة') b += amt;
        if (l.type === 'صرف')  b -= amt;
      });
      (D.expenses || []).forEach(e => { if (e.accountId === a.id && upto(e.date)) b -= Number(e.amount)||0; });
      (D.transfers || []).forEach(t => {
        if (!upto(t.date)) return;
        if (t.to === a.id)   b += Number(t.amount)||0;
        if (t.from === a.id) b -= Number(t.amount)||0;
      });
      return { name:a.name, type:a.type, balance:b };
    });
  }

  /* فحص سلامة القيود — بيدوّر على الحركات الناقصة أو الغريبة */
  function integrityChecks(){
    const D = window.D;
    const out = [];
    const apIds  = new Set((D.apartments || []).map(a => a.id));
    const accIds = new Set((D.accounts   || []).map(a => a.id));

    const noAccount = (D.ledger || []).filter(l => (l.type === 'دفعة' || l.type === 'صرف') && !l.accountId);
    if (noAccount.length) out.push({ t:'دفعات/مستردات غير مربوطة بحساب', n:noAccount.length,
      why:'الحركة دي مش بتظهر في رصيد أي حساب، فالخزينة هتبان أقل من الحقيقة.' });

    const expNoAcc = (D.expenses || []).filter(e => !e.accountId);
    if (expNoAcc.length) out.push({ t:'مصروفات غير مربوطة بحساب', n:expNoAcc.length,
      why:'المصروف مش هيتخصم من أي حساب، فالخزينة هتبان أعلى من الحقيقة.' });

    const orphanL = (D.ledger || []).filter(l => l.apartmentId && !apIds.has(l.apartmentId));
    if (orphanL.length) out.push({ t:'حركات مربوطة بوحدة محذوفة', n:orphanL.length,
      why:'الحركة موجودة في الخزينة بس مش بتظهر في كشف أي وحدة.' });

    const badAcc = (D.ledger || []).filter(l => l.accountId && !accIds.has(l.accountId))
      .concat((D.expenses || []).filter(e => e.accountId && !accIds.has(e.accountId)));
    if (badAcc.length) out.push({ t:'حركات مربوطة بحساب محذوف', n:badAcc.length, why:'مش بتظهر في كشف أي حساب.' });

    const noDate = (D.ledger || []).filter(l => !l.date)
      .concat((D.expenses || []).filter(e => !e.date));
    if (noDate.length) out.push({ t:'حركات بدون تاريخ', n:noDate.length,
      why:'مش هتظهر في أي تقرير بفترة محددة.' });

    const zero = (D.ledger || []).filter(l => !Number(l.amount))
      .concat((D.expenses || []).filter(e => !Number(e.amount)));
    if (zero.length) out.push({ t:'حركات بمبلغ صفر', n:zero.length, why:'غالبًا إدخال ناقص.' });

    const noFee = (D.apartments || []).filter(a => !a.closed && !Number(a.monthlyFee));
    if (noFee.length) out.push({ t:'وحدات بدون اشتراك شهري', n:noFee.length,
      why:'مش هتتحسب في التحصيل الشهري. لو ده مقصود تجاهل التنبيه.' });

    return out;
  }

  window.pageTrialBalance = function(){
    if (!window.D) return '<p class="small">مفيش بيانات</p>';
    const { from, to } = bounds();
    const cur = movements(from, to);
    const cmp = comparePeriod(from, to);
    const prev = cmp ? movements(cmp.from, cmp.to) : null;
    const bal  = balancesAsOf(to);
    const open = balancesAsOf(prevDay(from));   // أرصدة أول المدة
    const checks = integrityChecks();

    const pct = (a,b) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a-b)/b)*100);
    const chg = (a,b) => {
      if (!prev) return '';
      const p = pct(a,b);
      if (p === 0) return '<span class="badge n">=</span>';
      return p > 0 ? `<span class="badge g">▲ ${p}%</span>` : `<span class="badge r">▼ ${Math.abs(p)}%</span>`;
    };

    const row = (label, val, prevVal, hint) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${label}${hint?`<div class="small" style="color:var(--muted)">${hint}</div>`:''}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);font-weight:700">${cash(val)}</td>
        ${prev ? `<td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(prevVal)}</td>
                  <td style="padding:7px;border-bottom:1px solid var(--line)">${chg(val,prevVal)}</td>` : ''}
      </tr>`;

    const bRow = (label, o, c) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${label}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(o)}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${(c-o)>=0?'+':'−'}${cash(Math.abs(c-o))}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);font-weight:700">${cash(c)}</td>
      </tr>`;

    const head = `<tr>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">البيان</th>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">الفترة الحالية</th>
      ${prev ? `<th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">${esc2(cmp.label)}</th>
                <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">التغيّر</th>` : ''}
    </tr>`;

    const totalDue = cur.charges + cur.projects + cur.adjust;
    const prevDue  = prev ? prev.charges + prev.projects + prev.adjust : 0;
    const netCash  = cur.payments - cur.refunds - cur.expenses;
    const prevNet  = prev ? prev.payments - prev.refunds - prev.expenses : 0;
    const rate     = totalDue > 0 ? Math.round((cur.payments / totalDue) * 100) : null;

    return `
    <p class="small">ملخص محاسبي للفترة: المستحق مقابل المحصّل مقابل المصروف، وأرصدة آخر المدة، وفحص لسلامة القيود.</p>
    ${periodBar(true)}
    <p class="small mtop" style="color:var(--muted)">الفترة: ${esc2(from)} → ${esc2(to)} · ${cur.count} حركة</p>

    <div class="grid g4 mtop">
      <div class="kpi"><div class="ic">📄</div><div class="lbl">إجمالي المستحق</div><div class="val" style="font-size:15px">${cash(totalDue)}</div></div>
      <div class="kpi ok"><div class="ic">📥</div><div class="lbl">المحصّل</div><div class="val" style="font-size:15px">${cash(cur.payments)}</div></div>
      <div class="kpi owe"><div class="ic">📤</div><div class="lbl">المصروفات</div><div class="val" style="font-size:15px">${cash(cur.expenses)}</div></div>
      <div class="kpi ${rate!==null&&rate>=80?'ok':''}"><div class="ic">📊</div><div class="lbl">نسبة التحصيل</div><div class="val" style="font-size:15px">${rate===null?'-':rate+'%'}</div></div>
    </div>

    <div class="section-title"><h3>حركة الفترة</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${head}</thead>
      <tbody>
        ${row('اشتراكات شهرية مستحقة', cur.charges, prev&&prev.charges)}
        ${row('مساهمات مشاريع مستحقة', cur.projects, prev&&prev.projects)}
        ${row('تسويات', cur.adjust, prev&&prev.adjust, 'خصومات أو عكس مستحقات')}
        ${row('<b>إجمالي المستحق</b>', totalDue, prevDue)}
        ${row('المحصّل من الملاك', cur.payments, prev&&prev.payments)}
        ${row('مستردات للملاك', cur.refunds, prev&&prev.refunds)}
        ${row('المصروفات', cur.expenses, prev&&prev.expenses)}
        ${row('<b>صافي حركة الخزينة</b>', netCash, prevNet, 'المحصّل − المستردات − المصروفات')}
        ${row('تحويلات بين الحسابات', cur.transfers, prev&&prev.transfers, 'ما بتأثرش على الإجمالي')}
      </tbody>
    </table></div>

    <div class="section-title"><h3>ميزان المراجعة — أول المدة · الحركة · آخر المدة</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">الحساب</th>
        <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">رصيد ${esc2(from)}</th>
        <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">حركة الفترة</th>
        <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">رصيد ${esc2(to)}</th>
      </tr></thead>
      <tbody>
        ${bRow('ذمم الملاك (مستحق لم يُحصّل)', open.receivables, bal.receivables)}
        ${bRow('أرصدة الحسابات (خزينة + بنوك)', open.treasury, bal.treasury)}
        ${bRow('<b>إجمالي أصول العمارة</b>', open.receivables + open.treasury, bal.receivables + bal.treasury)}
        ${bRow('حقوق العمارة (الافتتاحي + المستحقات − المصروفات)', open.fund, bal.fund)}
      </tbody>
    </table>
    <p class="small mtop">${Math.abs(bal.diff) < 0.01
      ? '✅ <b>الميزان متوازن</b> — الأصول تساوي الحقوق بالضبط.'
      : `⚠️ <b>فرق غير متوازن: ${cash(bal.diff)}</b> — راجع فحص القيود تحت.`}</p></div>

    <div class="section-title"><h3>🔍 فحص سلامة القيود</h3></div>
    <div class="card">${checks.length ? checks.map(c => `
      <div class="flexrow" style="padding:7px 0;border-bottom:1px solid var(--line)">
        <span class="badge y" style="min-width:38px;text-align:center">${c.n}</span>
        <div style="flex:1"><b class="small">${esc2(c.t)}</b>
          <div class="small" style="color:var(--muted)">${esc2(c.why)}</div></div>
      </div>`).join('') : '<p class="small">✅ مفيش أي ملاحظات — كل الحركات مربوطة صح.</p>'}</div>`;
  };

  /* ---------- ٢) أعمار الديون ---------- */

  /* بنوزّع المدفوع على المستحقات بالأقدم أولًا، والباقي بيتحسب عمره من تاريخه */
  function agingFor(apId, asOf){
    const D = window.D;
    const rows = (D.ledger || []).filter(l => l.apartmentId === apId && (!l.date || l.date <= asOf));
    const dues = rows.filter(l => ['شهري','مشروع','تسوية','صرف'].includes(l.type))
                     .map(l => ({ date:l.date || asOf, amount:Number(l.amount) || 0, type:l.type }))
                     .filter(x => x.amount > 0)
                     .sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const a = (D.apartments || []).find(x => x.id === apId);
    const open = Number(a && a.openingBalance) || 0;
    if (open > 0) dues.unshift({ date: (dues[0] && dues[0].date) || asOf, amount: open, type:'رصيد افتتاحي' });

    // المدفوع = الدفعات + أي تسوية بالسالب (خصم) — الاتنين بيقلّلوا المستحق.
    // من غير التسويات السالبة، إجمالي أعمار الديون كان بيطلع أكبر من
    // إجمالي أرصدة الوحدات بقيمة الخصومات.
    let paid = rows.filter(l => l.type === 'دفعة')
                   .reduce((s,l) => s + (Number(l.amount)||0), 0)
             + rows.filter(l => Number(l.amount) < 0)
                   .reduce((s,l) => s + Math.abs(Number(l.amount)||0), 0);

    const buckets = { d30:0, d60:0, d90:0, more:0 };
    let oldest = null;
    for (const d of dues){
      let rem = d.amount;
      if (paid > 0){ const use = Math.min(paid, rem); paid -= use; rem -= use; }
      if (rem <= 0.001) continue;
      const age = daysBetween(d.date, asOf);
      if (oldest === null || age > oldest) oldest = age;
      if (age <= 30) buckets.d30 += rem;
      else if (age <= 60) buckets.d60 += rem;
      else if (age <= 90) buckets.d90 += rem;
      else buckets.more += rem;
    }
    const total = buckets.d30 + buckets.d60 + buckets.d90 + buckets.more;
    return { buckets, total, oldest, credit: paid };   // paid المتبقي = رصيد دائن
  }

  window.pageAging = function(){
    if (!window.D) return '<p class="small">مفيش بيانات</p>';
    const s = R();
    const asOf = s.to || today();
    const list = (window.D.apartments || []).map(a => {
      const g = agingFor(a.id, asOf);
      return { a, ...g };
    });
    const debtors = list.filter(x => x.total > 0.001)
                        .sort((x,y) => (y.oldest||0) - (x.oldest||0) || y.total - x.total);
    const credits = list.filter(x => x.credit > 0.001);

    const sum = k => debtors.reduce((t,x) => t + x.buckets[k], 0);
    const t30 = sum('d30'), t60 = sum('d60'), t90 = sum('d90'), tmore = sum('more');
    const grand = t30 + t60 + t90 + tmore;

    const cols = [
      { key:'unit',  label:'الوحدة',  value:x => x.a.number || 0, cell:x => `<b>${esc2(unit(x.a))}</b>` },
      { key:'owner', label:'المالك',  value:x => x.a.ownerName || '', cell:x => esc2(x.a.ownerName || '-') },
      { key:'phone', label:'الهاتف',  value:x => x.a.phone || '', cell:x => esc2(x.a.phone || '-') },
      { key:'d30',   label:'حتى 30 يوم', value:x => x.buckets.d30,  cell:x => x.buckets.d30  ? cash(x.buckets.d30)  : '-' },
      { key:'d60',   label:'31 — 60',    value:x => x.buckets.d60,  cell:x => x.buckets.d60  ? cash(x.buckets.d60)  : '-' },
      { key:'d90',   label:'61 — 90',    value:x => x.buckets.d90,  cell:x => x.buckets.d90  ? `<span style="color:var(--red)">${cash(x.buckets.d90)}</span>` : '-' },
      { key:'more',  label:'أكثر من 90', value:x => x.buckets.more, cell:x => x.buckets.more ? `<span style="color:var(--red)"><b>${cash(x.buckets.more)}</b></span>` : '-' },
      { key:'total', label:'الإجمالي',   value:x => x.total, cell:x => `<b>${cash(x.total)}</b>` },
      { key:'age',   label:'أقدم دين',   value:x => x.oldest || 0, cell:x => x.oldest === null ? '-' :
          `<span class="badge ${x.oldest>90?'r':x.oldest>60?'y':'n'}">${x.oldest} يوم</span>` },
      { key:'x', label:'', value:null, cell:x => `<button class="btn sm ghost" onclick="openApartmentDetail('${x.a.id}')">كشف</button>` },
    ];

    return `
    <p class="small">المتأخرات موزّعة حسب عمر الدين. الدفعات بتتخصم من الأقدم أولًا، فالمبالغ في خانة "أكثر من 90" هي فعلًا أقدم مستحقات لسه ما اتسددتش.</p>
    ${periodBar(false)}
    <p class="small mtop" style="color:var(--muted)">الأعمار محسوبة حتى: ${esc2(asOf)}</p>

    <div class="grid g4 mtop">
      <div class="kpi"><div class="ic">🕐</div><div class="lbl">حتى 30 يوم</div><div class="val" style="font-size:15px">${cash(t30)}</div></div>
      <div class="kpi"><div class="ic">🕑</div><div class="lbl">31 — 60 يوم</div><div class="val" style="font-size:15px">${cash(t60)}</div></div>
      <div class="kpi owe"><div class="ic">🕒</div><div class="lbl">61 — 90 يوم</div><div class="val" style="font-size:15px">${cash(t90)}</div></div>
      <div class="kpi owe"><div class="ic">🚨</div><div class="lbl">أكثر من 90 يوم</div><div class="val" style="font-size:15px">${cash(tmore)}</div></div>
    </div>
    <p class="small mtop"><b>إجمالي المتأخرات: ${cash(grand)}</b> على ${debtors.length} وحدة${
      credits.length ? ` · و${credits.length} وحدة عندها رصيد دائن (دفع مقدم)` : ''}</p>

    <div class="mtop">${window.sortableTable('agingTable', debtors, cols, null, {
      defaultKey:'age', emptyText:'🎉 مفيش أي متأخرات', exportName:'أعمار الديون'
    })}</div>`;
  };


  /* ---------- ٣) قائمة الدخل ---------- */

  function expensesByCategory(from, to){
    const D = window.D;
    const map = {};
    (D.expenses || []).forEach(e => {
      const d = e.date || '';
      if (d < from || d > to) return;
      const c = e.category || 'أخرى';
      map[c] = (map[c] || 0) + (Number(e.amount) || 0);
    });
    return Object.keys(map).map(c => ({ category:c, amount:map[c] }))
                 .sort((a,b) => b.amount - a.amount);
  }

  window.pageIncomeStatement = function(){
    if (!window.D) return '<p class="small">مفيش بيانات</p>';
    const { from, to } = bounds();
    const cur = movements(from, to);
    const cmp = comparePeriod(from, to);
    const prev = cmp ? movements(cmp.from, cmp.to) : null;

    // أساس الاستحقاق: الإيراد وقت ما يستحق. الأساس النقدي: وقت ما يتحصّل.
    const accIncome = cur.charges + cur.projects + cur.adjust;
    const accResult = accIncome - cur.expenses;
    const cashIn    = cur.payments - cur.refunds;
    const cashResult= cashIn - cur.expenses;

    const pAccIncome = prev ? prev.charges + prev.projects + prev.adjust : 0;
    const pAccResult = prev ? pAccIncome - prev.expenses : 0;

    const cats  = expensesByCategory(from, to);
    const pCats = prev ? expensesByCategory(cmp.from, cmp.to) : [];
    const pCat  = c => (pCats.find(x => x.category === c) || {}).amount || 0;
    const maxCat = Math.max(...cats.map(c => c.amount), 1);

    const pct = (a,b) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a-b)/b)*100);
    const chg = (a,b) => {
      if (!prev) return '';
      const p = pct(a,b);
      if (p === 0) return '<span class="badge n">=</span>';
      return p > 0 ? `<span class="badge g">▲ ${p}%</span>` : `<span class="badge r">▼ ${Math.abs(p)}%</span>`;
    };
    const line = (label, v, pv, bold, hint) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${bold?`<b>${label}</b>`:label}
          ${hint?`<div class="small" style="color:var(--muted)">${hint}</div>`:''}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);${bold?'font-weight:700':''}">${cash(v)}</td>
        ${prev ? `<td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(pv)}</td>
                  <td style="padding:7px;border-bottom:1px solid var(--line)">${chg(v,pv)}</td>` : ''}
      </tr>`;
    const th = `<tr>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">البيان</th>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">الفترة</th>
      ${prev ? `<th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">${esc2(cmp.label)}</th>
                <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">التغيّر</th>` : ''}
    </tr>`;

    return `
    <p class="small">إيرادات العمارة مقابل مصروفاتها خلال الفترة، وفائض أو عجز الفترة. معروضة بالأساسين: الاستحقاق (المستحق) والنقدي (المحصّل فعلًا).</p>
    ${periodBar(true)}
    <p class="small mtop" style="color:var(--muted)">الفترة: ${esc2(from)} → ${esc2(to)}</p>

    <div class="grid g3 mtop">
      <div class="kpi ok"><div class="ic">📥</div><div class="lbl">إجمالي الإيرادات المستحقة</div><div class="val" style="font-size:15px">${cash(accIncome)}</div></div>
      <div class="kpi owe"><div class="ic">📤</div><div class="lbl">إجمالي المصروفات</div><div class="val" style="font-size:15px">${cash(cur.expenses)}</div></div>
      <div class="kpi ${accResult>=0?'ok':'owe'}"><div class="ic">${accResult>=0?'📈':'📉'}</div><div class="lbl">${accResult>=0?'فائض الفترة':'عجز الفترة'}</div><div class="val" style="font-size:15px">${cash(Math.abs(accResult))}</div></div>
    </div>

    <div class="section-title"><h3>الإيرادات</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${th}</thead><tbody>
        ${line('اشتراكات شهرية', cur.charges, prev&&prev.charges)}
        ${line('مساهمات مشاريع', cur.projects, prev&&prev.projects)}
        ${line('تسويات', cur.adjust, prev&&prev.adjust, false, 'خصومات أو إضافات على الملاك')}
        ${line('إجمالي الإيرادات', accIncome, pAccIncome, true)}
      </tbody></table></div>

    <div class="section-title"><h3>المصروفات حسب البند</h3></div>
    <div class="card">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>${th}</thead><tbody>
          ${cats.length ? cats.map(c => `
          <tr>
            <td style="padding:7px;border-bottom:1px solid var(--line)">
              ${esc2(c.category)}
              <div style="height:6px;background:var(--line);border-radius:4px;margin-top:5px;overflow:hidden">
                <div style="width:${(c.amount/maxCat*100).toFixed(0)}%;height:100%;background:var(--gold)"></div>
              </div>
              <div class="small" style="color:var(--muted)">${cur.expenses?Math.round(c.amount/cur.expenses*100):0}% من المصروفات</div>
            </td>
            <td style="padding:7px;border-bottom:1px solid var(--line)">${cash(c.amount)}</td>
            ${prev ? `<td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(pCat(c.category))}</td>
                      <td style="padding:7px;border-bottom:1px solid var(--line)">${chg(c.amount, pCat(c.category))}</td>` : ''}
          </tr>`).join('') : `<tr><td colspan="4" class="small" style="padding:10px">مفيش مصروفات في الفترة دي</td></tr>`}
          ${line('إجمالي المصروفات', cur.expenses, prev&&prev.expenses, true)}
        </tbody></table></div>

    <div class="section-title"><h3>النتيجة</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${th}</thead><tbody>
        ${line(accResult>=0?'فائض الفترة (أساس الاستحقاق)':'عجز الفترة (أساس الاستحقاق)', accResult, pAccResult, true,
               'الإيرادات المستحقة − المصروفات')}
        ${line('التدفق النقدي الفعلي', cashResult, prev ? (prev.payments-prev.refunds-prev.expenses) : 0, true,
               'المحصّل فعلًا − المستردات − المصروفات')}
        ${line('الفرق بين الاتنين', accResult - cashResult, null, false,
               'ده مقدار المستحق اللي لسه ما اتحصّلش في الفترة')}
      </tbody></table>
      <p class="small mtop">${accResult >= 0
        ? '✅ العمارة حققت فائض في الفترة دي على أساس الاستحقاق.'
        : '⚠️ المصروفات زادت عن الإيرادات المستحقة في الفترة دي.'}
        ${cashResult < 0 && accResult >= 0 ? ' لاحظ إن التدفق النقدي سالب رغم الفائض — يعني في مستحقات ما اتحصّلتش.' : ''}</p>
    </div>`;
  };

  /* ---------- ٤) الميزانية المصغرة ---------- */

  window.pageBalanceSheet = function(){
    if (!window.D) return '<p class="small">مفيش بيانات</p>';
    const { from, to } = bounds();
    const u  = unitBalances(to);
    const uo = unitBalances(prevDay(from));
    const accs  = accountBalances(to);
    const accsO = accountBalances(prevDay(from));

    const cashNow = accs.reduce((s,a) => s + a.balance, 0);
    const cashOld = accsO.reduce((s,a) => s + a.balance, 0);

    const assetsNow = cashNow + u.debit;
    const assetsOld = cashOld + uo.debit;
    const liabNow = u.credit, liabOld = uo.credit;
    const netNow = assetsNow - liabNow, netOld = assetsOld - liabOld;

    const m = movements(from, to);
    const surplus = m.charges + m.projects + m.adjust - m.expenses;
    const check = netNow - netOld - surplus;

    const r = (label, now, old, bold) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${bold?`<b>${label}</b>`:label}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(old)}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);${bold?'font-weight:700':''}">${cash(now)}</td>
      </tr>`;
    const th2 = `<tr>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">البند</th>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">${esc2(from)}</th>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">${esc2(to)}</th>
    </tr>`;

    return `
    <p class="small">مركز العمارة المالي: إيه اللي عندها، وإيه اللي عليها، وصافي حقوقها — في بداية الفترة ونهايتها.</p>
    ${periodBar(false)}

    <div class="grid g3 mtop">
      <div class="kpi ok"><div class="ic">🏦</div><div class="lbl">النقدية والبنوك</div><div class="val" style="font-size:15px">${cash(cashNow)}</div></div>
      <div class="kpi ${u.debit>0?'owe':''}"><div class="ic">📄</div><div class="lbl">مستحق على الملاك</div><div class="val" style="font-size:15px">${cash(u.debit)}</div></div>
      <div class="kpi"><div class="ic">🧮</div><div class="lbl">صافي أصول العمارة</div><div class="val" style="font-size:15px">${cash(netNow)}</div></div>
    </div>

    <div class="section-title"><h3>الأصول (اللي للعمارة)</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${th2}</thead><tbody>
        ${accs.map((a,i) => r((a.type==='نقدي'?'💵 ':'🏦 ') + esc2(a.name), a.balance, (accsO[i]||{}).balance || 0)).join('')}
        ${r('مستحقات على الملاك (مدينون)', u.debit, uo.debit)}
        ${r('إجمالي الأصول', assetsNow, assetsOld, true)}
      </tbody></table></div>

    <div class="section-title"><h3>الالتزامات (اللي على العمارة)</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${th2}</thead><tbody>
        ${r('دفعات مقدمة من الملاك (دائنون)', liabNow, liabOld)}
        ${r('إجمالي الالتزامات', liabNow, liabOld, true)}
      </tbody></table>
      <p class="small mtop">دي مبالغ دفعها ملاك زيادة عن المستحق عليهم، فهي حق ليهم على العمارة.</p></div>

    <div class="section-title"><h3>صافي حقوق العمارة</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <tbody>
        ${r('صافي الأصول أول المدة', netOld, netOld)}
        ${r((surplus>=0?'+ فائض الفترة':'− عجز الفترة'), Math.abs(surplus), Math.abs(surplus))}
        ${r('= صافي الأصول آخر المدة', netNow, netNow, true)}
      </tbody></table>
      <p class="small mtop">${Math.abs(check) < 0.01
        ? '✅ <b>الميزانية متوازنة</b> — صافي الأصول أول المدة + نتيجة الفترة = صافي الأصول آخر المدة.'
        : `⚠️ <b>فرق ${cash(check)}</b> — في حركة تاريخها برّه الفترة أو قيد ناقص. راجع "فحص سلامة القيود" في ميزان المراجعة.`}</p>
    </div>`;
  };

  /* ---------- ربط التبويب في القائمة ---------- */

  function installNav(){
    const G = window.ADMIN_NAV_GROUPS;
    if (!G || G.some(g => g.key === 'reports')) return;
    // التبويب ده تابع لصلاحية "الماليات" — اللي مالوش صلاحية مالية مايشوفهوش
    const origPerm = window.hasGroupPermission;
    if (origPerm && !origPerm.__repPatched){
      window.hasGroupPermission = function(u, key){
        if (key === 'reports') return origPerm(u, 'finance');
        return origPerm.apply(this, arguments);
      };
      window.hasGroupPermission.__repPatched = true;
    }

    const item = { key:'reports', icon:'📑', label:'التقارير المحاسبية',
      items:[ ['trialBalance','⚖️','ميزان المراجعة'],
              ['incomeStatement','📈','قائمة الدخل'],
              ['balanceSheet','🧮','الميزانية المصغرة'],
              ['aging','⏳','أعمار الديون'] ] };
    const at = G.findIndex(g => g.key === 'finance');
    G.splice(at >= 0 ? at + 1 : G.length, 0, item);

    // عناوين الشاشات
    if (window.PAGE_TITLES){
      window.PAGE_TITLES.trialBalance = 'ميزان المراجعة';
      window.PAGE_TITLES.aging = 'أعمار الديون';
    }
  }

  // الراوتر بينده على الدوال بالاسم، فبنلفّه عشان نضيف الشاشتين
  const origRender = window.renderContent;
  window.renderContent = function(){
    const p = (typeof curPage !== 'undefined') ? curPage : '';
    const REPORTS = {
      trialBalance:    ['ميزان المراجعة',    pageTrialBalance],
      incomeStatement: ['قائمة الدخل',        pageIncomeStatement],
      balanceSheet:    ['الميزانية المصغرة',  pageBalanceSheet],
      aging:           ['أعمار الديون',       pageAging],
    };
    if (REPORTS[p]){
      const t = document.getElementById('pageTitle');
      if (t) t.textContent = REPORTS[p][0];
      const c = document.getElementById('content');
      if (c) c.innerHTML = REPORTS[p][1]();
      return;
    }
    return origRender.apply(this, arguments);
  };

  installNav();
  console.log('[عمارتنا] التقارير المحاسبية جاهزة');
})();
