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
    /* بنغيّر أساس الصفحة — كل المقاسات النسبية بتتبعه، والمقاسات
       الثابتة بالبكسل بتفضل زي ما هي فالتصميم مابيتكسرش. */
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
    document.body.classList.toggle('nav-compact', on);
    if (window.toast) toast(on ? 'قائمة مضغوطة' : 'قائمة عادية');
  };

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

      /* قائمة جانبية مضغوطة */
      body.nav-compact .sidebar .nav-group > button,
      body.nav-compact .sidebar .nav-item{
        padding-top:7px; padding-bottom:7px; font-size:13.5px}
      body.nav-compact .sidebar .nav-group{margin-bottom:4px}
      body.nav-compact .sidebar .brand{padding:10px 12px}
      body.nav-compact .sidebar .brand .sub{display:none}
    `;
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
        <input type="checkbox" ${navCompact()?'checked':''} onchange="toggleNavCompact()">
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
