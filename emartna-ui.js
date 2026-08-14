/* ============================================================
   عمارتنا — تحسينات الجداول
   ------------------------------------------------------------
   البحث في الجداول كان بيدوّر على "قيمة الفرز" مش على النص
   اللي إنت شايفه. يعني عمود "الوحدة" قيمته رقم (2) بس المعروض
   "محل 2" — فالبحث بكلمة "محل" مكانش بيلاقي حاجة.

   دلوقتي البحث بيدوّر على الاتنين: القيمة والنص المعروض.
   ============================================================ */

(function(){
  'use strict';

  const strip = html => String(html == null ? '' : html)
    .replace(/<[^>]*>/g, ' ')      // شيل الوسوم
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // كاش بسيط عشان مانحسبش نص الخلية كل ضغطة زرار
  const cellText = (col, row) => {
    if (!col.cell) return '';
    try { return strip(col.cell(row)); } catch (e) { return ''; }
  };

  const orig = window.getFilteredSortedRows;
  if (typeof orig !== 'function'){
    console.warn('[عمارتنا] مالقيتش دالة البحث في الجداول');
    return;
  }

  window.getFilteredSortedRows = function(tableId){
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    const st  = window.__sortState && window.__sortState[tableId];

    // من غير بحث نصّي، سيب السلوك الأصلي زي ما هو
    if (!cfg || !st || !st.q) return orig.apply(this, arguments);

    const q = String(st.q).toLowerCase().trim();
    const { rows, columns } = cfg;

    const matched = rows.filter(r => columns.some(c => {
      if (c.value){
        const v = c.value(r);
        if (v != null && String(v).toLowerCase().includes(q)) return true;
      }
      return cellText(c, r).includes(q);
    }));

    // نشغّل الأصلية على الصفوف المطابقة بس (عشان الفلاتر والترتيب يفضلوا زي ما هما)
    const savedRows = cfg.rows, savedQ = st.q;
    cfg.rows = matched; st.q = '';
    try{
      return orig.apply(this, arguments);
    } finally {
      cfg.rows = savedRows; st.q = savedQ;
    }
  };

  console.log('[عمارتنا] بحث الجداول بقى يشمل النص المعروض');
})();
