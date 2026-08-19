/* ============================================================
   عمارتنا — تنسيق أعمدة كل الجداول (٤٥ جدول)
   ------------------------------------------------------------
     • الجدول العريض (أكتر من ٨ أعمدة ظاهرة) → كل عمود ياخد
       قياسه الطبيعي والجدول يتمرّر أفقيًا بدل ما يتزنق.
     • الجدول الضيّق → يفضل زي ما هو، بيملا العرض.
     • تعديل عرض أي عمود → بنثبّت الباقي على قياسه الحالي الأول.
   ============================================================ */

(function(){
  'use strict';

  const WIDE_AT = 8;

  function injectCss(){
    if (document.getElementById('colFitCss')) return;
    const st = document.createElement('style');
    st.id = 'colFitCss';
    st.textContent = `
      [data-colfit="wide"] .table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
      [data-colfit="wide"] .table-wrap > table{ width:max-content; min-width:100%; }
      [data-colfit="wide"] .table-wrap th,
      [data-colfit="wide"] .table-wrap td{ white-space:nowrap; vertical-align:middle; }
      [data-colfit="wide"] .table-wrap td.wrap-cell,
      [data-colfit="wide"] .table-wrap th.wrap-cell{
        white-space:normal; word-break:break-word; max-width:280px;
      }
      [data-colfit="wide"] .table-wrap table[style*="fixed"] td{
        white-space:normal; word-break:break-word;
      }`;
    document.head.appendChild(st);
  }

  const WRAPPY = /ملاحظ|تفاصيل|وصف|العنوان|النص|البيان|الرسالة|المقترح|النتائج|الخطأ|السبب/;

  function markTables(){
    try{
      const cfgs = window.__tableConfigs || {};
      Object.keys(cfgs).forEach(id => {
        const wrap = document.getElementById(id + '_wrap');
        if (!wrap) return;
        const cols = window.orderedVisibleCols
          ? orderedVisibleCols(id+'_order', id+'_vis', cfgs[id].columns)
          : cfgs[id].columns;
        const wide = (cols || []).length > WIDE_AT;
        wrap.setAttribute('data-colfit', wide ? 'wide' : 'fit');
        if (!wide) return;
        const ths = wrap.querySelectorAll('.table-wrap thead th');
        const idx = [];
        cols.forEach((c,i) => { if (WRAPPY.test(String(c.label||''))) idx.push(i); });
        if (!idx.length) return;
        idx.forEach(i => { if (ths[i]) ths[i].classList.add('wrap-cell'); });
        wrap.querySelectorAll('.table-wrap tbody tr').forEach(tr => {
          idx.forEach(i => { if (tr.children[i]) tr.children[i].classList.add('wrap-cell'); });
        });
      });
    }catch(e){}
  }
  window.markWideTables = markTables;

  function freezeAllWidths(tableId){
    const wrap = document.getElementById(tableId + '_wrap');
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    if (!wrap || !cfg) return;
    const ths = wrap.querySelectorAll('.table-wrap thead th');
    if (!ths.length) return;
    window[tableId+'_widths'] = window[tableId+'_widths'] || {};
    const W = window[tableId+'_widths'];
    // بنقرا مفتاح كل عمود من الرأس نفسه (data-colkey) — أضمن من
    // الاعتماد على ترتيب القائمة، لأن في أعمدة بتتحقن وقت التشغيل.
    ths.forEach(th => {
      const key = th.getAttribute('data-colkey');
      if (!key) return;
      if (typeof W[key] !== 'number')
        W[key] = Math.max(60, Math.round(th.getBoundingClientRect().width));
    });
  }

  ['setColWidthDirect','nudgeColWidth','setColWidthPreset','setColWidth'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__colFit) return;
    const wrapped = function(tableId){
      try{
        const id = (window.__tableConfigs && window.__tableConfigs[tableId])
          ? tableId : window.__widthEditTable;
        if (id) freezeAllWidths(id);
      }catch(e){}
      return orig.apply(this, arguments);
    };
    wrapped.__colFit = true;
    window[fn] = wrapped;
  });

  const origMenu = window.openColumnQuickMenu;
  if (origMenu && !origMenu.__colFit){
    const wrapped = function(evt, tableId){
      window.__widthEditTable = tableId;
      return origMenu.apply(this, arguments);
    };
    wrapped.__colFit = true;
    window.openColumnQuickMenu = wrapped;
  }

  window.resetColWidths = function(tableId){
    window[tableId+'_widths'] = {};
    if (window.refreshSortable) refreshSortable(tableId); else renderContent();
    setTimeout(markTables, 50);
    if (window.toast) toast('رجعت الأعمدة لقياسها الطبيعي');
  };

  const origSortable = window.sortableTable;
  if (origSortable && !origSortable.__colFitWrapped){
    const wrapped = function(tableId, rows, cols){
      const html = origSortable.apply(this, arguments);
      injectCss();
      setTimeout(markTables, 30);
      if (!Array.isArray(cols) || cols.length <= WIDE_AT) return html;
      const btn = `<button class="btn sm ghost" onclick="resetColWidths('${tableId}')" title="رجّع كل الأعمدة لقياسها الطبيعي">↔️ ضبط الأعمدة</button>`;
      return html.replace('طباعة</button></div>', 'طباعة</button>' + btn + '</div>');
    };
    wrapped.__colFitWrapped = true;
    window.sortableTable = wrapped;
  }

  ['renderContent','renderSysContent','refreshSortable'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__colFitR) return;
    const wrapped = function(){
      const r = orig.apply(this, arguments);
      setTimeout(markTables, 30);
      return r;
    };
    wrapped.__colFitR = true;
    window[fn] = wrapped;
  });

  setTimeout(() => { injectCss(); markTables(); }, 1200);
  console.log('[عمارتنا] تنسيق أعمدة كل الجداول جاهز');
})();
