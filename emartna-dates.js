/* ============================================================
   عمارتنا — توحيد صيغة التاريخ (يوم/شهر/سنة)
   ------------------------------------------------------------
   خانة التاريخ في المتصفح بتعرض بصيغة لغة الجهاز — فلو الجهاز
   إنجليزي بتبان شهر/يوم/سنة وده بيلخبط.

   الحل هنا:
     • كل تاريخ معروض في الجداول والبطاقات بصيغة يوم/شهر/سنة
     • وتحت كل خانة تاريخ سطر بيقول التاريخ بالعربي الواضح
       (مثال: الخميس ٢٠ أغسطس ٢٠٢٦) فمفيش لبس
   ============================================================ */

(function(){
  'use strict';

  const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                     'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const AR_DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  const pad = n => String(n).padStart(2,'0');

  /* 2026-08-20 → 20/08/2026 */
  window.fmtDate = function(v){
    if (!v) return '';
    const s = String(v).slice(0,10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(v);
    return `${m[3]}/${m[2]}/${m[1]}`;
  };

  /* 2026-08-20 → الخميس ٢٠ أغسطس ٢٠٢٦ */
  window.fmtDateLong = function(v){
    if (!v) return '';
    const d = new Date(String(v).slice(0,10) + 'T12:00:00');
    if (isNaN(d)) return String(v);
    return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  /* التاريخ والوقت */
  window.fmtDateTime = function(v){
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /* ---------- سطر توضيحي تحت كل خانة تاريخ ---------- */

  function hintFor(input){
    let h = input.nextElementSibling;
    if (!h || !h.classList || !h.classList.contains('date-hint')){
      h = document.createElement('div');
      h.className = 'date-hint small';
      h.style.cssText = 'color:var(--muted);margin-top:3px;font-size:11.5px';
      input.insertAdjacentElement('afterend', h);
    }
    h.textContent = input.value ? '📅 ' + fmtDateLong(input.value) : 'يوم/شهر/سنة';
  }

  function scan(){
    try{
      document.querySelectorAll('input[type="date"]').forEach(inp => {
        if (!inp.__dateHint){
          inp.__dateHint = true;
          inp.addEventListener('input', () => hintFor(inp));
          inp.addEventListener('change', () => hintFor(inp));
          inp.setAttribute('lang','ar-EG');
        }
        hintFor(inp);
      });
    }catch(e){}
  }
  window.refreshDateHints = scan;

  /* بعد أي رسم */
  ['renderContent','renderSysContent','openModal','refreshSortable'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__dateFmt) return;
    const wrapped = function(){
      const r = orig.apply(this, arguments);
      setTimeout(scan, 40);
      return r;
    };
    wrapped.__dateFmt = true;
    window[fn] = wrapped;
  });

  setInterval(scan, 2500);
  setTimeout(scan, 1500);

  console.log('[عمارتنا] صيغة التاريخ موحّدة (يوم/شهر/سنة)');
})();
