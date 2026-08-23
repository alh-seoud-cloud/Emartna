/* ============================================================
   عمارتنا — عدد الصفوف المعروضة في كل جدول
   ------------------------------------------------------------
   قائمة منسدلة فوق كل جدول: ١٠ · ٢٠ · ٣٠ · ٥٠ · ١٠٠ · ٢٠٠ · الكل
   مع أزرار تنقّل بين الصفحات.

   الاختيار بيتحفظ لكل جدول على حدة، فالجدول اللي بتشتغل عليه
   كتير بيفتكر عدد الصفوف اللي يريحك.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const KEY = 'emartna_page_size';
  const SIZES = [10, 20, 30, 50, 100, 200, 0];      // ٠ = الكل
  const DEFAULT = 30;
  const MIN_ROWS = 8;                                // أقل من كده مفيش داعي للترقيم

  function prefs(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '{}'); }catch(e){ return {}; }
  }
  function savePrefs(p){
    try{ localStorage.setItem(KEY, JSON.stringify(p)); }catch(e){}
  }

  window.tablePageSize = function(id){
    const p = prefs();
    return p[id] !== undefined ? p[id] : DEFAULT;
  };

  window.setTablePageSize = function(id, size){
    const p = prefs();
    p[id] = Number(size);
    savePrefs(p);
    window.__tablePage = window.__tablePage || {};
    window.__tablePage[id] = 1;                      // نرجع لأول صفحة
    if (window.refreshSortable) refreshSortable(id);
    else renderContent();
  };

  window.goTablePage = function(id, page){
    window.__tablePage = window.__tablePage || {};
    window.__tablePage[id] = Math.max(1, Number(page) || 1);
    if (window.refreshSortable) refreshSortable(id);
    else renderContent();
    // نرجّع المستخدم لأول الجدول بعد التنقّل
    setTimeout(() => {
      const el = document.getElementById(id + '_wrap');
      if (el && el.scrollIntoView) el.scrollIntoView({ block:'start', behavior:'smooth' });
    }, 60);
  };

  /* ---------- قصّ الصفوف ---------- */

  const origFiltered = window.getFilteredSortedRows;
  if (origFiltered && !origFiltered.__paged){
    const wrapped = function(tableId){
      const res = origFiltered.apply(this, arguments);
      if (!res || !Array.isArray(res.filtered)) return res;

      const size = tablePageSize(tableId);
      const total = res.filtered.length;

      // نخزّن الإجمالي عشان شريط الترقيم
      window.__tableTotals = window.__tableTotals || {};
      window.__tableTotals[tableId] = total;

      if (!size || total <= size) return res;         // الكل أو أقل من الحد

      window.__tablePage = window.__tablePage || {};
      const pages = Math.ceil(total / size);
      let page = window.__tablePage[tableId] || 1;
      if (page > pages) page = window.__tablePage[tableId] = pages;

      const start = (page - 1) * size;
      return Object.assign({}, res, {
        filtered: res.filtered.slice(start, start + size),
        __total: total, __page: page, __pages: pages,
      });
    };
    wrapped.__paged = true;
    window.getFilteredSortedRows = wrapped;
  }

  /* ---------- شريط التحكم ---------- */

  function bar(tableId){
    const total = (window.__tableTotals || {})[tableId] || 0;
    if (total < MIN_ROWS) return '';

    const size = tablePageSize(tableId);
    const pages = size ? Math.ceil(total / size) : 1;
    const page = Math.min((window.__tablePage || {})[tableId] || 1, pages);
    const from = size ? (page - 1) * size + 1 : 1;
    const to   = size ? Math.min(page * size, total) : total;

    const opt = n => `<option value="${n}" ${size === n ? 'selected' : ''}>${
      n === 0 ? 'الكل' : n + ' صف'}</option>`;

    const btn = (p, label, on) => `<button class="btn sm ${on ? 'ghost' : 'ghost'}"
      ${on ? `onclick="goTablePage('${tableId}',${p})"` : 'disabled style="opacity:.4"'}>${label}</button>`;

    return `
    <div class="flexrow" style="gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 4px">
      <span class="small" style="color:var(--muted)">عرض</span>
      <select onchange="setTablePageSize('${tableId}',this.value)"
        style="padding:4px 8px;border:1px solid var(--line);border-radius:8px;font-size:12.5px">
        ${SIZES.map(opt).join('')}
      </select>
      <span class="small" style="color:var(--muted)">
        ${size && total > size ? `${from} – ${to} من ${total}` : `الكل (${total})`}
      </span>
      ${pages > 1 ? `
        <span style="flex:1"></span>
        ${btn(1, '⏮️', page > 1)}
        ${btn(page - 1, '‹ السابق', page > 1)}
        <span class="badge n">صفحة ${page} من ${pages}</span>
        ${btn(page + 1, 'التالي ›', page < pages)}
        ${btn(pages, '⏭️', page < pages)}` : ''}
    </div>`;
  }

  /* الشريط بيتحط جوه محتوى الجدول نفسه — مش فوقه.
     لأن التحديث بيعيد رسم المحتوى الداخلي بس، فلو الشريط
     برّه كان هيفضل بأرقام قديمة بعد أي تنقّل. */
  const origInner = window.renderSortableInner;
  if (origInner && !origInner.__pagedUI){
    const wrapped = function(tableId){
      const html = origInner.apply(this, arguments);   // بينادي getFilteredSortedRows
      const b = bar(tableId);                          // فالإجمالي بقى محدّث
      return b ? (b + html) : html;
    };
    wrapped.__pagedUI = true;
    window.renderSortableInner = wrapped;
  }

  /* الفلترة أو البحث بيرجّعوا لأول صفحة */
  ['tableSearchInput','setColFilter','clearColFilter','sortTable'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__pageReset) return;
    const wrapped = function(tableId){
      window.__tablePage = window.__tablePage || {};
      if (tableId) window.__tablePage[tableId] = 1;
      return orig.apply(this, arguments);
    };
    wrapped.__pageReset = true;
    window[fn] = wrapped;
  });

  console.log('[عمارتنا] ترقيم صفحات الجداول جاهز');
})();
