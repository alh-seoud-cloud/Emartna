/* ============================================================
   عمارتنا — تقرير المصروفات الشهري
   ------------------------------------------------------------
   رئيس الاتحاد محتاج يجاوب على سؤالين كل شهر:
     «صرفنا كام؟»  و  «راحت فين؟»

   فالتقرير بشكلين:
     • إجمالي  — سطر لكل شهر + توزيع على البنود. للعرض على السكان.
     • تفصيلي  — كل مصروف بتاريخه ووصفه وخزينته. للمراجعة.

   والطباعة بتفتح نافذة نظيفة بدون قوائم — ومنها PDF عن طريق
   «حفظ كـPDF» في نافذة الطباعة (مفيش مكتبة إضافية، وده أخف
   وبيدي ملف أوضح من تحويل الصفحة صورة).
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const M = n => (window.money ? money(n) : Number(n||0).toLocaleString('ar-EG'));
  const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                     'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const ymLabel = ym => {
    const [y,m] = String(ym).split('-').map(Number);
    return (AR_MONTHS[m-1] || ym) + ' ' + y;
  };
  const ymOf = d => String(d || '').slice(0,7);

  /* ---------- تجميع البيانات ---------- */

  function rows(){
    const D = window.D || {};
    /* القيود العكسية بتتجمع بقيمتها السالبة فالصافي بيطلع صح */
    return (D.expenses || []).filter(e => e && e.date);
  }

  function monthsList(){
    const set = {};
    rows().forEach(e => { const k = ymOf(e.date); if (k) set[k] = 1; });
    return Object.keys(set).sort().reverse();
  }

  function catName(e){
    const D = window.D || {};
    if (e.category) return e.category;
    const c = (D.expenseCategories || []).find(x => x.id === e.categoryId);
    return c ? c.name : 'غير مصنّف';
  }
  function accName(id){
    const D = window.D || {};
    const a = (D.accounts || []).find(x => x.id === id);
    return a ? a.name : '—';
  }
  function projName(id){
    const D = window.D || {};
    const p = (D.projects || []).find(x => x.id === id);
    return p ? p.name : '';
  }

  /* ---------- الحالة ---------- */

  const S = () => (window.__expRepState = window.__expRepState || {
    from: '', to: '', mode: 'summary', cat: '', acc: '',
  });

  function filtered(){
    const st = S();
    return rows().filter(e => {
      const ym = ymOf(e.date);
      if (st.from && ym < st.from) return false;
      if (st.to   && ym > st.to)   return false;
      if (st.cat  && catName(e) !== st.cat) return false;
      if (st.acc  && e.accountId !== st.acc) return false;
      return true;
    }).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  }

  /* ---------- الشاشة ---------- */

  window.pageExpenseReport = function(){
    const st = S();
    const all = monthsList();
    if (!st.from && all.length) st.from = all[Math.min(5, all.length-1)];
    if (!st.to && all.length)   st.to   = all[0];

    const list = filtered();
    const total = list.reduce((n,e) => n + (Number(e.amount)||0), 0);

    /* تجميع بالشهر وبالبند */
    const byMonth = {}, byCat = {};
    list.forEach(e => {
      const ym = ymOf(e.date), c = catName(e), v = Number(e.amount)||0;
      byMonth[ym] = (byMonth[ym]||0) + v;
      byCat[c]    = (byCat[c]||0) + v;
    });
    const months = Object.keys(byMonth).sort().reverse();
    const cats   = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
    const maxCat = cats.length ? cats[0][1] : 1;

    const D = window.D || {};
    const catOpts = [...new Set(rows().map(catName))].sort();

    const monthOpt = sel => all.map(m =>
      `<option value="${esc2(m)}" ${m===sel?'selected':''}>${esc2(ymLabel(m))}</option>`).join('');

    return `
    <div class="card content-narrow">
      <h3>📑 تقرير المصروفات</h3>
      <p class="small mtop">اختار الفترة، واطبع إجمالي للعرض على السكان
        أو تفصيلي للمراجعة.</p>

      <div class="grid g4 mtop2">
        <div class="field2"><label>من شهر</label>
          <select onchange="expRepSet('from',this.value)">${monthOpt(st.from)}</select></div>
        <div class="field2"><label>إلى شهر</label>
          <select onchange="expRepSet('to',this.value)">${monthOpt(st.to)}</select></div>
        <div class="field2"><label>البند</label>
          <select onchange="expRepSet('cat',this.value)">
            <option value="">كل البنود</option>
            ${catOpts.map(c=>`<option ${st.cat===c?'selected':''}>${esc2(c)}</option>`).join('')}
          </select></div>
        <div class="field2"><label>الخزينة</label>
          <select onchange="expRepSet('acc',this.value)">
            <option value="">كل الخزائن</option>
            ${(D.accounts||[]).map(a=>`<option value="${esc2(a.id)}"
              ${st.acc===a.id?'selected':''}>${esc2(a.name)}</option>`).join('')}
          </select></div>
      </div>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ${st.mode==='summary'?'':'ghost'}"
          onclick="expRepSet('mode','summary')">📊 إجمالي</button>
        <button class="btn sm ${st.mode==='detail'?'':'ghost'}"
          onclick="expRepSet('mode','detail')">📋 تفصيلي</button>
        <div class="spacer"></div>
        <button class="btn sm ghost" onclick="printExpenseReport()">🖨️ طباعة / PDF</button>
        <button class="btn sm ghost" onclick="shareExpenseReport()">📤 مشاركة</button>
      </div>
    </div>

    <div class="grid g4 mtop2">
      <div class="kpi owe"><div class="ic">💸</div>
        <div class="lbl">إجمالي المصروفات</div>
        <div class="val">${M(total)}</div>
        <div class="small">${list.length} حركة</div></div>
      <div class="kpi"><div class="ic">📅</div>
        <div class="lbl">متوسط الشهر</div>
        <div class="val">${M(months.length ? total/months.length : 0)}</div>
        <div class="small">على ${months.length} شهر</div></div>
      <div class="kpi"><div class="ic">🏷️</div>
        <div class="lbl">أكبر بند</div>
        <div class="val" style="font-size:17px">${cats.length?esc2(cats[0][0]):'—'}</div>
        <div class="small">${cats.length?M(cats[0][1]):''}</div></div>
      <div class="kpi"><div class="ic">📆</div>
        <div class="lbl">أعلى شهر</div>
        <div class="val" style="font-size:17px">${months.length
          ? esc2(ymLabel(months.reduce((a,b)=>byMonth[a]>byMonth[b]?a:b))) : '—'}</div></div>
    </div>

    ${st.mode==='summary' ? summaryHTML(byMonth, months, cats, maxCat, total)
                          : detailHTML(list, total)}`;
  };

  function summaryHTML(byMonth, months, cats, maxCat, total){
    return `
    <div class="card content-narrow mtop2">
      <h3>المصروفات شهر بشهر</h3>
      <div class="table-wrap mtop">
        <table><thead><tr><th>الشهر</th><th>الإجمالي</th><th>النسبة</th></tr></thead>
        <tbody>${months.map(m=>{
          const pct = total ? Math.round(byMonth[m]/total*100) : 0;
          return `<tr><td><b>${esc2(ymLabel(m))}</b></td>
            <td>${M(byMonth[m])}</td>
            <td><div style="display:flex;align-items:center;gap:7px">
              <span style="flex:1;height:7px;background:var(--line);border-radius:4px;
                overflow:hidden;max-width:150px"><span style="display:block;
                width:${pct}%;height:100%;background:var(--accent)"></span></span>
              <span class="small">${pct}%</span></div></td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr><th>الإجمالي</th><th>${M(total)}</th><th></th></tr></tfoot>
        </table></div>
    </div>

    <div class="card content-narrow mtop2">
      <h3>التوزيع على البنود</h3>
      ${!cats.length?'<p class="small mtop">مفيش مصروفات في الفترة دي.</p>':
      cats.map(([c,v])=>{
        const pct = total ? Math.round(v/total*100) : 0;
        return `<div class="mtop">
          <div class="flexrow" style="justify-content:space-between">
            <span>${esc2(c)}</span>
            <span><b>${M(v)}</b> <span class="small">(${pct}%)</span></span></div>
          <div style="height:8px;background:var(--line);border-radius:4px;
            margin-top:4px;overflow:hidden"><div style="width:${
            Math.round(v/maxCat*100)}%;height:100%;background:var(--accent)"></div></div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function detailHTML(list, total){
    return `
    <div class="card content-narrow mtop2">
      <h3>كل الحركات (${list.length})</h3>
      <div class="table-wrap mtop">
        <table><thead><tr>
          <th>التاريخ</th><th>البند</th><th>الوصف</th>
          <th>الخزينة</th><th>المشروع</th><th>المبلغ</th>
        </tr></thead><tbody>
        ${!list.length?'<tr><td colspan="6" class="small">مفيش مصروفات في الفترة دي.</td></tr>':
        list.map(e=>`<tr${Number(e.amount)<0?' style="color:var(--red)"':''}>
          <td class="small">${esc2(e.date)}</td>
          <td>${esc2(catName(e))}</td>
          <td class="small">${esc2(e.description||'—')}</td>
          <td class="small">${esc2(accName(e.accountId))}</td>
          <td class="small">${esc2(projName(e.projectId)||'—')}</td>
          <td><b>${M(e.amount)}</b></td></tr>`).join('')}
        </tbody>
        <tfoot><tr><th colspan="5">الإجمالي</th><th>${M(total)}</th></tr></tfoot>
        </table></div>
    </div>`;
  }

  window.expRepSet = function(k, v){
    S()[k] = v;
    if (window.renderContent) renderContent();
  };

  /* ---------- الطباعة ---------- */

  function reportTitle(){
    const st = S();
    const b = (window.D && D.building) || {};
    const period = st.from === st.to ? ymLabel(st.from)
                 : ymLabel(st.from) + ' — ' + ymLabel(st.to);
    return { b, period,
      head: 'تقرير المصروفات ' + (st.mode==='detail' ? '(تفصيلي)' : '(إجمالي)') };
  }

  window.printExpenseReport = function(){
    if (window.guardAction && !guardAction('expenses','print')) return;
    const { b, period, head } = reportTitle();
    const st = S();
    const list = filtered();
    const total = list.reduce((n,e) => n + (Number(e.amount)||0), 0);

    const byMonth = {}, byCat = {};
    list.forEach(e => {
      const ym = ymOf(e.date), c = catName(e), v = Number(e.amount)||0;
      byMonth[ym] = (byMonth[ym]||0) + v; byCat[c] = (byCat[c]||0) + v;
    });
    const months = Object.keys(byMonth).sort().reverse();
    const cats   = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

    const body = st.mode === 'detail'
      ? `<table><thead><tr><th>التاريخ</th><th>البند</th><th>الوصف</th>
           <th>الخزينة</th><th>المبلغ</th></tr></thead><tbody>
         ${list.map(e=>`<tr><td>${esc2(e.date)}</td><td>${esc2(catName(e))}</td>
           <td>${esc2(e.description||'')}</td><td>${esc2(accName(e.accountId))}</td>
           <td>${M(e.amount)}</td></tr>`).join('')}</tbody>
         <tfoot><tr><th colspan="4">الإجمالي</th><th>${M(total)}</th></tr></tfoot></table>`
      : `<table><thead><tr><th>الشهر</th><th>الإجمالي</th></tr></thead><tbody>
         ${months.map(m=>`<tr><td>${esc2(ymLabel(m))}</td><td>${M(byMonth[m])}</td></tr>`).join('')}
         </tbody><tfoot><tr><th>الإجمالي</th><th>${M(total)}</th></tr></tfoot></table>
         <h3 style="margin-top:22px">التوزيع على البنود</h3>
         <table><thead><tr><th>البند</th><th>المبلغ</th><th>النسبة</th></tr></thead><tbody>
         ${cats.map(([c,v])=>`<tr><td>${esc2(c)}</td><td>${M(v)}</td>
           <td>${total?Math.round(v/total*100):0}%</td></tr>`).join('')}
         </tbody></table>`;

    const w = window.open('', '_blank');
    if (!w) return showMessage('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
      <meta charset="utf-8"><title>${esc2(head)} — ${esc2(b.name||'')}</title>
      <style>
        @page{margin:14mm}
        body{font-family:Tahoma,Arial,sans-serif;color:#1c2622;padding:0;margin:0}
        h1{font-size:19px;margin:0 0 2px} h2{font-size:14px;margin:0;color:#6b7a76;font-weight:400}
        h3{font-size:15px;margin:18px 0 6px}
        .hd{border-bottom:2px solid #159A8C;padding-bottom:10px;margin-bottom:14px}
        table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12.5px}
        th,td{border:1px solid #d8e0dd;padding:6px 8px;text-align:right}
        thead th{background:#f0f6f4;font-size:12px}
        tfoot th{background:#f0f6f4;font-weight:700}
        tbody tr:nth-child(even){background:#fafcfb}
        .ft{margin-top:16px;font-size:11px;color:#6b7a76;
            border-top:1px solid #d8e0dd;padding-top:8px}
        @media print{ .noprint{display:none} }
      </style></head><body>
      <div class="hd">
        <h1>${esc2(b.name||'العمارة')} — ${esc2(head)}</h1>
        <h2>الفترة: ${esc2(period)}${st.cat?' · البند: '+esc2(st.cat):''}</h2>
      </div>
      ${body}
      <div class="ft">
        اتطبع في ${esc2(new Date().toLocaleString('ar-EG'))} ·
        عدد الحركات: ${list.length} · نظام عمارتنا
      </div>
      <script>setTimeout(function(){window.print()},350)<\/script>
      </body></html>`);
    w.document.close();
  };

  /* ---------- المشاركة ---------- */

  window.shareExpenseReport = async function(){
    const { b, period } = reportTitle();
    const list = filtered();
    const total = list.reduce((n,e) => n + (Number(e.amount)||0), 0);
    const byCat = {};
    list.forEach(e => { const c = catName(e);
      byCat[c] = (byCat[c]||0) + (Number(e.amount)||0); });
    const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);

    const txt =
      `📑 تقرير مصروفات ${b.name||'العمارة'}\n` +
      `الفترة: ${period}\n\n` +
      `💸 الإجمالي: ${M(total)}\n` +
      `📊 عدد الحركات: ${list.length}\n\n` +
      `أهم البنود:\n` +
      top.map(([c,v],i) => `${i+1}. ${c}: ${M(v)}`).join('\n') +
      `\n\n— نظام عمارتنا`;

    /* مشاركة الجهاز لو متاحة (موبايل)، وإلا واتساب/نسخ */
    if (navigator.share){
      try{ await navigator.share({ title:'تقرير المصروفات', text:txt }); return; }
      catch(e){ if (e && e.name === 'AbortError') return; }
    }
    openModal(`
      <h3>📤 مشاركة التقرير</h3>
      <textarea rows="12" id="expShareTxt" style="width:100%;font-size:12.5px"
        onclick="this.select()">${esc2(txt)}</textarea>
      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <a class="btn gold" target="_blank"
          href="https://wa.me/?text=${encodeURIComponent(txt)}">💬 واتساب</a>
        <button class="btn ghost" onclick="
          navigator.clipboard.writeText(document.getElementById('expShareTxt').value);
          toast('اتنسخ');">📋 نسخ</button>
        <button class="btn ghost" onclick="closeModal();printExpenseReport()">🖨️ طباعة</button>
      </div>
      <p class="small mtop" style="color:var(--muted)">
        للمشاركة كملف PDF: اطبع واختار «حفظ كـPDF» من نافذة الطباعة.</p>
      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`);
  };

  console.log('[عمارتنا] تقرير المصروفات جاهز');
})();
