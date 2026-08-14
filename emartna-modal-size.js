/* ============================================================
   عمارتنا — تحكّم في حجم الشاشات الثانوية (النوافذ المنبثقة)
   ------------------------------------------------------------
   على اللابتوب النوافذ كانت ثابتة العرض (٥٦٠ بكسل)، فبيانات
   الجداول العريضة كانت بتتقص. الملف ده بيضيف:

     ١) عرض أكبر تلقائيًا حسب حجم الشاشة
     ٢) زرار تكبير / استعادة جوه كل نافذة
     ٣) إمكانية السحب من الركن لتغيير الطول والعرض بالماوس
     ٤) الحجم اللي تختاره بيتحفظ ويرجع تاني في المرات الجاية

   على الموبايل بيفضل السلوك زي ما هو.
   ============================================================ */

(function(){
  'use strict';

  const KEY_SIZE = 'emartna_modal_size';
  const KEY_MAX  = 'emartna_modal_maximized';
  const MOBILE   = () => window.matchMedia('(max-width: 820px)').matches;

  /* ---------- ١) الأنماط ---------- */

  const css = `
  .modal{
    max-width: min(960px, 94vw);
    max-height: 92vh;
    resize: both;
    overflow: auto;
    position: relative;
    min-width: 320px;
    min-height: 200px;
  }
  .modal.wide{ max-width: min(1280px, 96vw); }
  .modal.emartna-max{
    width: 96vw !important;  max-width: 96vw !important;
    height: 94vh !important; max-height: 94vh !important;
  }
  /* أزرار الحفظ/الإلغاء فوق — تفضل ظاهرة مهما نزلت في النافذة */
  .modal .modal-actions{
    position: sticky; top: 0; z-index: 4;
    background: var(--panel, #fff);
    padding: 10px 0 12px;
    margin: 0 0 12px;
    border-bottom: 1px solid var(--line, #e3e8e6);
  }
  /* مقبض السحب في الركن */
  .modal::-webkit-resizer{ background: transparent; }
  .modal-sizer{
    position: sticky; top: 0; float: left;
    display: flex; gap: 6px; z-index: 6;
    direction: ltr;                 /* × الأول من الشمال زي نوافذ الويندوز */
    margin: -8px 0 0 -4px;
  }
  .modal-sizer button{
    border: 1px solid var(--line, #e3e8e6);
    background: var(--panel, #fff);
    color: var(--sidebar-muted, #6B7280);
    border-radius: 8px; cursor: pointer;
    width: 30px; height: 30px; font-size: 14px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
  }
  .modal-sizer button:hover{
    color: var(--accent, #159A8C);
    border-color: var(--accent, #159A8C);
  }
  .modal-sizer button.mclose{ font-size: 18px; font-weight: 700; }
  .modal-sizer button.mclose:hover{
    background: var(--red, #c23b3b); color: #fff; border-color: var(--red, #c23b3b);
  }
  /* زرار الإغلاق/الإلغاء القديم اتشال — الـ× بديله */
  .modal .modal-actions button.emartna-hidden-close{ display: none; }
  /* لو شريط الأزرار فضي بعد إخفاء الإغلاق، مانسيبش فراغ */
  .modal .modal-actions:empty,
  .modal .modal-actions.emartna-empty{ display: none; }
  /* تلميح إن الركن بيتسحب */
  .modal-grip{
    position: absolute; left: 4px; bottom: 4px;
    width: 14px; height: 14px; opacity: .35; pointer-events: none;
    background:
      linear-gradient(135deg, transparent 45%, currentColor 45%, currentColor 55%, transparent 55%),
      linear-gradient(135deg, transparent 70%, currentColor 70%, currentColor 80%, transparent 80%);
    color: var(--sidebar-muted, #6B7280);
  }
  @media (max-width: 820px){
    .modal{ resize: none; max-width: 100%; min-width: 0; }
    .modal-grip{ display: none; }
    /* على الموبايل: زرار الإغلاق × يفضل ظاهر، وأزرار الحجم بس هي اللي تختفي */
    .modal-sizer button:not(.mclose){ display: none; }
    .modal-sizer{ margin: -4px 0 6px -2px; }
    .modal-sizer button.mclose{ width: 38px; height: 38px; font-size: 22px; }
  }
  /* عند الطباعة منعرضش أزرار التحكم */
  @media print{ .modal-sizer, .modal-grip{ display: none !important; } }
  `;

  const style = document.createElement('style');
  style.id = 'emartna-modal-sizing';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- ٢) حفظ واسترجاع الحجم ---------- */

  function saveSize(box){
    if (MOBILE() || box.classList.contains('emartna-max')) return;
    try{
      const w = box.style.width, h = box.style.height;
      if (w || h) localStorage.setItem(KEY_SIZE, JSON.stringify({ w, h }));
    }catch(e){}
  }

  function restoreSize(box){
    if (MOBILE()) return;
    try{
      if (localStorage.getItem(KEY_MAX) === '1'){
        box.classList.add('emartna-max');
        return;
      }
      const s = JSON.parse(localStorage.getItem(KEY_SIZE) || 'null');
      if (s && s.w) box.style.width  = s.w;
      if (s && s.h) box.style.height = s.h;
    }catch(e){}
  }

  /* ---------- ٣) أزرار التحكم ---------- */

  window.toggleModalMaximize = function(){
    const box = document.getElementById('modalBox');
    if (!box) return;
    const on = box.classList.toggle('emartna-max');
    try{ localStorage.setItem(KEY_MAX, on ? '1' : '0'); }catch(e){}
    if (on){ box.style.width = ''; box.style.height = ''; }
    paintButtons(box);
  };

  window.resetModalSize = function(){
    const box = document.getElementById('modalBox');
    if (!box) return;
    box.classList.remove('emartna-max');
    box.style.width = ''; box.style.height = '';
    try{
      localStorage.removeItem(KEY_SIZE);
      localStorage.setItem(KEY_MAX, '0');
    }catch(e){}
    paintButtons(box);
  };

  function paintButtons(box){
    let bar = box.querySelector('.modal-sizer');
    if (!bar){
      bar = document.createElement('div');
      bar.className = 'modal-sizer';
      box.insertBefore(bar, box.firstChild);
    }
    const max = box.classList.contains('emartna-max');

    // دوّر على زرار "إغلاق" أو "إلغاء" جوه النافذة عشان الـ× ياخد نفس وظيفته
    let closeAction = 'closeModal()';
    const actionsEl = box.querySelector('.modal-actions');
    if (actionsEl){
      const btns = [...actionsEl.querySelectorAll('button')];
      const closeBtn = btns.find(b => {
        const t = (b.textContent || '').trim();
        return t === 'إغلاق' || t === 'إلغاء' || t === 'رجوع';
      });
      if (closeBtn){
        const oc = closeBtn.getAttribute('onclick');
        if (oc) closeAction = oc;
        closeBtn.classList.add('emartna-hidden-close');
      }
      // لو مفضلش أزرار ظاهرة، اخفي الشريط كله
      const visible = btns.filter(b => !b.classList.contains('emartna-hidden-close'));
      actionsEl.classList.toggle('emartna-empty', visible.length === 0);
    }

    bar.innerHTML =
      `<button type="button" class="mclose" onclick="${closeAction.replace(/"/g,'&quot;')}" title="إغلاق (Esc)">×</button>`
    + `<button type="button" onclick="toggleModalMaximize()" title="${max ? 'استعادة الحجم' : 'تكبير النافذة'}">${max ? '🗗' : '⛶'}</button>`
    + `<button type="button" onclick="resetModalSize()" title="رجوع للحجم الافتراضي">↺</button>`;

    // انقل شريط الأزرار لأعلى النافذة (كان في الآخر، وبيضيع لو المحتوى طويل)
    const actions = box.querySelector('.modal-actions');
    if (actions && actions.previousElementSibling !== bar){
      bar.insertAdjacentElement('afterend', actions);
    }

    if (!box.querySelector('.modal-grip')){
      const g = document.createElement('span');
      g.className = 'modal-grip';
      box.appendChild(g);
    }
  }

  /* ---------- ٤) الربط مع فتح وقفل النوافذ ---------- */

  const box = document.getElementById('modalBox');
  const overlay = document.getElementById('modalOverlay');
  if (!box || !overlay){
    console.warn('[عمارتنا] مالقيتش عناصر النافذة المنبثقة');
    return;
  }

  // كل ما المحتوى يتغيّر (openModal بتستبدل innerHTML) رجّع الأزرار
  new MutationObserver(() => {
    if (!overlay.classList.contains('show')) return;
    // openModal بتستبدل المحتوى بالكامل، فلازم نرجّع الأزرار ونرفع شريط
    // الحفظ/الإلغاء لأعلى في كل مرة
    paintButtons(box);
  }).observe(box, { childList: true });

  // أول ما النافذة تفتح: رجّع آخر حجم + الأزرار
  new MutationObserver(() => {
    if (overlay.classList.contains('show')){
      restoreSize(box);
      paintButtons(box);
    }else{
      saveSize(box);
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  // احفظ الحجم بعد ما المستخدم يسحب الركن
  if (window.ResizeObserver){
    let t = null;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => saveSize(box), 400);
    }).observe(box);
  }

  // Esc يقفل النافذة المفتوحة
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!overlay.classList.contains('show')) return;
    const x = box.querySelector('.modal-sizer button.mclose');
    if (x) x.click();
  });

  console.log('[عمارتنا] التحكم في حجم النوافذ جاهز');
})();
