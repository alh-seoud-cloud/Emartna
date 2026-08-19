/* ============================================================
   عمارتنا — تنسيق أعمدة الجداول
   ------------------------------------------------------------
   مشكلتين اتصلحوا:

   ١) الجدول كان بيوزّع عرضه على عدد الأعمدة، فمع ٣٠ عمود
      كلهم بيتزنقوا والنص بيتلخبط فوق بعضه.
      الحل: كل عمود ياخد عرضه الطبيعي والجدول يتمرّر أفقيًا.

   ٢) تغيير عرض عمود واحد كان بيسحب من عرض باقي الأعمدة.
      الحل: أول ما تعدّل عمود، بنثبّت عرض كل الأعمدة على
      قياسها الحالي — فالتعديل يبقى على العمود ده وحده.
   ============================================================ */

(function(){
  'use strict';

  const WIDE = ['sysBldTable','supportBldTable','apTable','usersTable','ledgerTable',
                'expTable','payReqTable','licTable','couponsTable','leadsTable'];

  /* ---------- ١) الأعمدة تاخد عرضها الطبيعي ---------- */

  function injectCss(){
    if (document.getElementById('colFitCss')) return;
    const st = document.createElement('style');
    st.id = 'colFitCss';
    st.textContent = `
      /* الجداول العريضة: العمود ياخد قياسه ومفيش زنقة */
      ${WIDE.map(id => `#${id}_wrap .table-wrap`).join(',')}{
        overflow-x:auto; overflow-y:visible; -webkit-overflow-scrolling:touch;
      }
      ${WIDE.map(id => `#${id}_wrap .table-wrap > table`).join(',')}{
        width:max-content; min-width:100%;
      }
      ${WIDE.map(id => `#${id}_wrap .table-wrap th, #${id}_wrap .table-wrap td`).join(',')}{
        white-space:nowrap; vertical-align:middle;
      }
      /* الخلايا اللي جواها أزرار أو شارات تفضل مرنة */
      ${WIDE.map(id => `#${id}_wrap .table-wrap td:has(.flexrow)`).join(',')}{
        white-space:normal;
      }
      /* لو المستخدم ثبّت عرض معيّن، النص يتلف جواه */
      ${WIDE.map(id => `#${id}_wrap .table-wrap td[data-fixed="1"]`).join(',')}{
        white-space:normal; word-break:break-word;
      }`;
    document.head.appendChild(st);
  }

  /* ---------- ٢) تعديل عمود واحد ما يأثرش على الباقي ---------- */

  function freezeAllWidths(tableId){
    const wrap = document.getElementById(tableId + '_wrap');
    if (!wrap) return;
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    if (!cfg) return;
    const ths = wrap.querySelectorAll('.table-wrap thead th');
    if (!ths.length) return;

    const cols = (window.orderedVisibleCols
      ? orderedVisibleCols(tableId+'_order', tableId+'_vis', cfg.columns)
      : cfg.columns);

    window[tableId+'_widths'] = window[tableId+'_widths'] || {};
    const W = window[tableId+'_widths'];
    ths.forEach((th, i) => {
      const c = cols[i];
      if (!c) return;
      if (typeof W[c.key] !== 'number'){
        // بنثبّت القياس اللي هو عليه دلوقتي — مش قيمة افتراضية
        W[c.key] = Math.max(60, Math.round(th.getBoundingClientRect().width));
      }
    });
  }

  ['setColWidthDirect','nudgeColWidth','setColWidthPreset'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__colFit) return;
    const wrapped = function(tableId, colKey){
      // نثبّت الباقي الأول، وبعدين نطبّق التعديل
      try{ freezeAllWidths(tableId); }catch(e){}
      return orig.apply(this, arguments);
    };
    wrapped.__colFit = true;
    window[fn] = wrapped;
  });

  /* إعادة كل الأعمدة لقياسها الطبيعي */
  window.resetColWidths = function(tableId){
    window[tableId+'_widths'] = {};
    if (window.refreshSortable) refreshSortable(tableId);
    else renderContent();
    if (window.toast) toast('رجعت الأعمدة لقياسها الطبيعي');
  };

  /* زرار الإرجاع في شريط أدوات الجدول */
  const origSortable = window.sortableTable;
  if (origSortable && !origSortable.__colFitWrapped){
    const wrapped = function(tableId, rows, cols, rowRenderer, opts){
      const html = origSortable.apply(this, arguments);
      if (!WIDE.includes(tableId)) return html;
      injectCss();
      const btn = `<button class="btn sm ghost" onclick="resetColWidths('${tableId}')"
        title="رجّع كل الأعمدة لقياسها الطبيعي">↔️ ضبط الأعمدة</button>`;
      return html.replace('طباعة</button></div>', 'طباعة</button>' + btn + '</div>');
    };
    wrapped.__colFitWrapped = true;
    window.sortableTable = wrapped;
  }

  setTimeout(injectCss, 1200);
  console.log('[عمارتنا] تنسيق أعمدة الجداول جاهز');
})();
