/* ============================================================
   عمارتنا — تحسينات العرض
   ------------------------------------------------------------
   ١) تحكّم المستخدم في حجم الخط (٥ مقاسات)
   ٢) قائمة جانبية مضغوطة على الموبايل
   ٣) شريط أدوات الجداول في صف واحد بتمرير أفقي بدل ما يتكسّر
      على ٣ سطور ويبوظ شكل الشاشة
   ============================================================ */

(function(){
  'use strict';

  const FONT_KEY = 'emartna_font_scale';
  const NAV_KEY  = 'emartna_nav_compact';

  const SCALES = [
    { key:'xs', label:'صغير جدًا', v:0.88 },
    { key:'sm', label:'صغير',      v:0.94 },
    { key:'md', label:'عادي',      v:1.00 },
    { key:'lg', label:'كبير',      v:1.09 },
    { key:'xl', label:'كبير جدًا', v:1.20 },
  ];

  const getScale = () => { try{ return localStorage.getItem(FONT_KEY) || 'md'; }
                           catch(e){ return 'md'; } };
  const navCompact = () => { try{ return localStorage.getItem(NAV_KEY) === '1'; }
                             catch(e){ return false; } };

  /* ---------- تطبيق حجم الخط ---------- */

  function applyFont(){
    const s = SCALES.find(x => x.key === getScale()) || SCALES[2];
    /* ⚠️ تغيير html.fontSize مالوش أثر هنا: البرنامج محدد
       body{font-size:14px} بالبكسل، وكل العناصر بتورّث من body.
       فبنغيّر body مباشرة بالنسبة للأساس ١٤. */
    const px = (14 * s.v).toFixed(2) + 'px';
    document.body.style.setProperty('font-size', px, 'important');
    document.documentElement.style.fontSize = (16 * s.v) + 'px';
    document.documentElement.setAttribute('data-font', s.key);
  }

  window.setFontScale = function(k){
    try{ localStorage.setItem(FONT_KEY, k); }catch(e){}
    applyFont();
    if (window.toast) toast('حجم الخط: ' + (SCALES.find(x=>x.key===k)||{}).label);
    if (window.renderContent) { try{ renderContent(); }catch(e){} }
  };

  window.toggleNavCompact = function(){
    const on = !navCompact();
    try{ localStorage.setItem(NAV_KEY, on ? '1' : '0'); }catch(e){}
    syncNav();
    if (window.toast) toast(on ? 'قائمة مضغوطة' : 'قائمة عادية');
  };

  /* الشيل بيتبني من جديد مع كل تبديل شاشة، فالكلاس لازم يتحط تاني.
     مراقب بسيط أضمن من إننا نفتكر ننادي بعد كل رسم. */
  function syncNav(){
    try{
      document.body.classList.toggle('nav-compact', navCompact());
      /* الحجم كمان: لو حاجة مسحت style من body بيرجع للافتراضي */
      const s = SCALES.find(x => x.key === getScale()) || SCALES[2];
      const px = (14 * s.v).toFixed(2) + 'px';
      if (document.body.style.fontSize !== px)
        document.body.style.setProperty('font-size', px, 'important');
      injectNavButtons();
    }catch(e){}
  }
  try{
    new MutationObserver(syncNav).observe(document.body,
      { childList:true, subtree:false });
  }catch(e){}
  setInterval(syncNav, 1500);

  /* ---------- الأنماط ---------- */

  function styles(){
    if (document.getElementById('emartnaUIPrefs')) return;
    const st = document.createElement('style');
    st.id = 'emartnaUIPrefs';
    st.textContent = `
      /* شريط أدوات الجدول: صف واحد بتمرير أفقي بدل ٣ سطور مكسّرة */
      .table-toolbar{
        display:flex; gap:6px; align-items:center; margin-bottom:10px;
        flex-wrap:nowrap; overflow-x:auto; overflow-y:visible;
        padding-bottom:4px; scrollbar-width:thin;
      }
      .table-toolbar::-webkit-scrollbar{height:5px}
      .table-toolbar::-webkit-scrollbar-thumb{
        background:var(--line); border-radius:3px}
      .table-toolbar > .search-box{
        flex:1 1 120px; min-width:110px}
      .table-toolbar > button{flex:0 0 auto; white-space:nowrap}

      @media (max-width: 640px){
        /* الأزرار أصغر شوية عشان تدخل في صف واحد */
        .table-toolbar > button{font-size:12px; padding:5px 9px}
        .table-toolbar > .search-box{font-size:12.5px; padding:6px 9px}

        /* أزرار الفلترة فوق الجدول: صف واحد بتمرير */
        .filter-chips, .tab-row, .chip-row{
          display:flex; flex-wrap:nowrap; overflow-x:auto;
          gap:6px; padding-bottom:4px}
        .filter-chips > *, .tab-row > *, .chip-row > *{flex:0 0 auto}
      }

      /* قائمة جانبية مضغوطة — الفئات الحقيقية في القائمة:
         nav-btn (البند) · nav-group-header (المجموعة) ·
         nav-sec (عنوان القسم) · brand (الشعار فوق). */
      body.nav-compact .sidebar .nav-btn{
        padding:6px 12px !important; font-size:12.5px !important; gap:7px !important}
      body.nav-compact .sidebar .nav-group-header{
        padding:6px 10px !important; font-size:12.5px !important}
      body.nav-compact .sidebar .nav-group{margin:2px 6px !important}
      body.nav-compact .sidebar .nav-sec{
        padding:7px 10px 1px !important; font-size:9.5px !important}
      body.nav-compact .sidebar .brand{padding:10px 12px !important}
      body.nav-compact .sidebar .brand h1{font-size:14px !important}
      body.nav-compact .sidebar .brand p{display:none !important}
      body.nav-compact .sidebar .brand .mark{
        width:30px !important; height:30px !important}
      body.nav-compact .sidebar-foot{padding:9px !important; font-size:10.5px !important}
    `;
    /* آخر حاجة في head عشان تكسب أنماط البرنامج */
    document.head.appendChild(st);
  }

  /* ---------- شاشة الإعدادات ---------- */

  window.openDisplayPrefs = function(){
    const cur = getScale();
    openModal(`
      <h3>🔠 حجم الخط والعرض</h3>
      <p class="small mtop">التفضيلات دي على جهازك بس — مش بتأثر على حد تاني.</p>

      <div class="field2 mtop2"><label>حجم الخط</label>
        <div class="flexrow" style="gap:6px;flex-wrap:wrap">
          ${SCALES.map(s => `<button class="btn sm ${cur===s.key?'':'ghost'}"
            onclick="setFontScale('${s.key}');openDisplayPrefs()">${s.label}</button>`).join('')}
        </div>
        <p class="small" style="color:var(--muted)">
          معاينة: <span style="font-size:1rem">النص هيبان بالحجم ده</span></p>
      </div>

      <label class="checkline mtop2">
        <input type="checkbox" ${navCompact()?'checked':''}
          onchange="toggleNavCompact();openDisplayPrefs()">
        <span><b>قائمة جانبية مضغوطة</b>
          <div class="small" style="color:var(--muted)">
            بتصغّر المسافات فتشوف بنود أكتر من غير تمرير — مفيدة على الموبايل.</div></span>
      </label>

      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`);
  };

  /* بند في شاشة الإعدادات — الشاشة مبنية من SETTINGS_CARDS،
     فبنضيف عليها بدل ما نغلّف دالة الرسم. */
  function addCard(){
    try{
      if (!window.SETTINGS_CARDS) return false;
      if (SETTINGS_CARDS.some(c => c.key === 'display')) return true;
      SETTINGS_CARDS.push({ key:'display', icon:'🔠',
        title:'حجم الخط والعرض',
        sub:'كبّر أو صغّر الخط، واضغط القائمة الجانبية' });

      const orig = window.openSettingsCard;
      if (typeof orig === 'function' && !orig.__uiPrefs){
        const wrapped = function(key){
          if (key === 'display') return openDisplayPrefs();
          return orig.apply(this, arguments);
        };
        wrapped.__uiPrefs = true;
        window.openSettingsCard = wrapped;
      }
      return true;
    }catch(e){ return false; }
  }
  if (!addCard()) setTimeout(addCard, 2000);

  /* ---------- أزرار الحجم في القائمة الجانبية ---------- */

  window.stepFont = function(dir){
    const i = SCALES.findIndex(x => x.key === getScale());
    const n = Math.max(0, Math.min(SCALES.length - 1, (i < 0 ? 2 : i) + dir));
    try{ localStorage.setItem(FONT_KEY, SCALES[n].key); }catch(e){}
    applyFont(); injectNavButtons(true);
    if (window.toast) toast('حجم الخط: ' + SCALES[n].label);
  };

  function injectNavButtons(force){
    const foot = document.querySelector('.sidebar-foot')
              || document.querySelector('.sidebar');
    if (!foot) return;
    let box = document.getElementById('fontBar');
    if (box && !force) { paintBar(box); return; }
    if (!box){
      box = document.createElement('div');
      box.id = 'fontBar';
      box.style.cssText =
        'display:flex;gap:5px;align-items:center;justify-content:center;' +
        'padding:7px 8px;margin:6px 8px;border-radius:9px;' +
        'background:rgba(255,255,255,.06)';
      /* فوق زرار الخروج مباشرة */
      foot.insertBefore(box, foot.firstChild);
    }
    paintBar(box);
  }

  function paintBar(box){
    const s = SCALES.find(x => x.key === getScale()) || SCALES[2];
    const b = (t, d, dis) => `<button onclick="stepFont(${d})" ${dis?'disabled':''}
      title="${d<0?'تصغير':'تكبير'} الخط"
      style="flex:0 0 auto;width:28px;height:28px;border:0;border-radius:7px;
        cursor:${dis?'default':'pointer'};opacity:${dis?'.35':'1'};
        background:rgba(255,255,255,.12);color:var(--sidebar-text);
        font-size:15px;font-weight:700;line-height:1">${t}</button>`;
    const i = SCALES.indexOf(s);
    box.innerHTML =
      b('−', -1, i === 0) +
      `<span style="flex:1;text-align:center;font-size:11px;
        color:var(--sidebar-muted)">${s.label}</span>` +
      b('+', 1, i === SCALES.length - 1) +
      `<button onclick="toggleNavCompact()" title="تصغير/تكبير القائمة"
        style="flex:0 0 auto;width:28px;height:28px;border:0;border-radius:7px;
        cursor:pointer;background:rgba(255,255,255,.12);
        color:var(--sidebar-text);font-size:13px">${navCompact()?'▣':'▢'}</button>`;
  }

  /* ---------- التشغيل ---------- */

  styles();
  applyFont();
  if (navCompact()) document.body.classList.add('nav-compact');
  document.addEventListener('emartna:building-complete', () => {
    styles(); applyFont();
    if (navCompact()) document.body.classList.add('nav-compact');
  });

  console.log('[عمارتنا] تفضيلات العرض جاهزة');
})();
