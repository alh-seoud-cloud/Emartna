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
  const NAV_W_KEY  = 'emartna_nav_width';
  const NAV_HIDE   = 'emartna_nav_hidden';
  const NAV_MIN = 150, NAV_MAX = 380, NAV_DEF = 250;

  const NAV_SIZES = [
    { key:'narrow', label:'ضيقة',  w:180 },
    { key:'normal', label:'عادية', w:250 },
    { key:'wide',   label:'واسعة', w:300 },
  ];
  const navWidth = () => {
    try{ const v = parseInt(localStorage.getItem(NAV_W_KEY),10);
         return (v >= NAV_MIN && v <= NAV_MAX) ? v : NAV_DEF; }
    catch(e){ return NAV_DEF; }
  };
  const navHidden = () => { try{ return localStorage.getItem(NAV_HIDE) === '1'; }
                            catch(e){ return false; } };
  const navSize = () => { const w = navWidth();
    return w <= 200 ? 'narrow' : w >= 285 ? 'wide' : 'normal'; };
  const navCompact = () => navWidth() <= 200;

  /* ---------- تطبيق حجم الخط ---------- */

  function applyFont(){
    const s = SCALES.find(x => x.key === getScale()) || SCALES[2];
    /* ⚠️ تغيير font-size لوحده مالوش أثر: البرنامج فيه ١٢٢ قاعدة
       بمقاسات ثابتة بالبكسل بتدوس على الوراثة.
       الحل: قاعدة واحدة بتضرب كل المقاسات النسبية — بنحقن
       ورقة أنماط بتعيد تعريف الأحجام الشائعة بالنسبة للمعامل. */
    const v = s.v;
    let st = document.getElementById('emartnaFontScale');
    if (!st){
      st = document.createElement('style');
      st.id = 'emartnaFontScale';
      document.head.appendChild(st);           // آخر حاجة = بتكسب
    }
    if (v === 1){ st.textContent = ''; document.documentElement
      .setAttribute('data-font', s.key); return; }

    const px = n => (n * v).toFixed(2) + 'px';
    st.textContent = `
      body{font-size:${px(14)} !important}
      .small,.hint{font-size:${px(11.5)} !important}
      .btn{font-size:${px(13)} !important}
      .btn.sm{font-size:${px(12)} !important}
      h1{font-size:${px(20)} !important}
      h2{font-size:${px(18)} !important}
      h3{font-size:${px(16)} !important}
      table th,table td{font-size:${px(13)} !important}
      input,select,textarea,.search-box{font-size:${px(13.5)} !important}
      .kpi .val{font-size:${px(22)} !important}
      .kpi .lbl{font-size:${px(12)} !important}
      .badge{font-size:${px(11)} !important}
      .card{font-size:${px(14)} !important}
      .nav-btn{font-size:${px(13.5)} !important}
      .nav-group-header{font-size:${px(13)} !important}
      .nav-sec{font-size:${px(10.5)} !important}
      .sidebar .brand h1{font-size:${px(16)} !important}
      .sidebar-foot{font-size:${px(11.5)} !important}
      label{font-size:${px(13)} !important}
    `;
    document.documentElement.setAttribute('data-font', s.key);
  }

  window.setFontScale = function(k){
    try{ localStorage.setItem(FONT_KEY, k); }catch(e){}
    applyFont();
    if (window.toast) toast('حجم الخط: ' + (SCALES.find(x=>x.key===k)||{}).label);
    if (window.renderContent) { try{ renderContent(); }catch(e){} }
  };

  window.setNavWidth = function(px, quiet){
    const w = Math.max(NAV_MIN, Math.min(NAV_MAX, Math.round(px)));
    try{ localStorage.setItem(NAV_W_KEY, String(w)); }catch(e){}
    applyNav();
    if (!quiet) injectNavButtons(true);
    return w;
  };
  window.setNavSize = function(k){
    const n = NAV_SIZES.find(x => x.key === k) || NAV_SIZES[1];
    setNavWidth(n.w);
    if (window.toast) toast('القائمة: ' + n.label);
  };
  /* إخفاء وإظهار زي محرّرات الكود — بيدي المحتوى الشاشة كلها */
  window.toggleNavHidden = function(){
    const on = !navHidden();
    try{ localStorage.setItem(NAV_HIDE, on ? '1' : '0'); }catch(e){}
    applyNav(); injectNavButtons(true);
  };
  window.toggleNavCompact = function(){
    const i = NAV_SIZES.findIndex(x => x.key === navSize());
    setNavSize(NAV_SIZES[(i + 1) % NAV_SIZES.length].key);
  };

  /* عرض القائمة بيتحط كنمط مباشر — بيكسب أنماط البرنامج */
  function applyNav(){
    const w = navWidth(), hid = navHidden();
    let st = document.getElementById('emartnaNavWidth');
    if (!st){
      st = document.createElement('style');
      st.id = 'emartnaNavWidth';
      document.head.appendChild(st);
    }
    /* على الموبايل القائمة بتفتح فوق الشاشة بعرض ثابت — مانلمسهاش */
    st.textContent = `@media (min-width: 861px){
      .sidebar{width:${hid ? 0 : w}px !important;
        ${hid ? 'min-width:0 !important;overflow:hidden !important;' +
                'border:0 !important;' : ''}}
      #navGrip{inset-inline-end:${hid ? 0 : w}px}
    }`;
    document.body.classList.toggle('nav-compact', !hid && w <= 200);
    document.body.classList.toggle('nav-hidden', hid);
    installGrip();
  }

  /* ---------- الحافة القابلة للسحب ---------- */

  function installGrip(){
    if (window.innerWidth < 861){
      const g = document.getElementById('navGrip');
      if (g) g.style.display = 'none';
      return;
    }
    let g = document.getElementById('navGrip');
    if (!g){
      g = document.createElement('div');
      g.id = 'navGrip';
      g.title = 'اسحب لتغيير العرض · دوس مرتين للإخفاء';
      g.style.cssText =
        'position:fixed;top:0;bottom:0;width:10px;z-index:520;' +
        'cursor:col-resize;display:flex;align-items:center;' +
        'justify-content:center;user-select:none';
      g.innerHTML = '<span style="width:3px;height:42px;border-radius:2px;' +
        'background:var(--line);transition:background .15s"></span>';
      g.addEventListener('mouseenter', () => {
        g.firstChild.style.background = 'var(--accent)'; });
      g.addEventListener('mouseleave', () => {
        if (!g.__dragging) g.firstChild.style.background = 'var(--line)'; });
      g.addEventListener('dblclick', () => toggleNavHidden());
      g.addEventListener('mousedown', startDrag);
      g.addEventListener('touchstart', startDrag, { passive:false });
      document.body.appendChild(g);
    }
    g.style.display = 'flex';

    /* القائمة مخفية = لازم طريقة ترجّعها، وإلا المستخدم يتوه */
    let back = document.getElementById('navShow');
    if (navHidden()){
      if (!back){
        back = document.createElement('button');
        back.id = 'navShow';
        back.title = 'إظهار القائمة (Ctrl+B)';
        back.onclick = () => toggleNavHidden();
        back.style.cssText =
          'position:fixed;top:12px;inset-inline-end:12px;z-index:530;' +
          'width:38px;height:38px;border:1px solid var(--line);border-radius:10px;' +
          'background:var(--card);color:var(--text);font-size:17px;cursor:pointer;' +
          'box-shadow:0 3px 10px rgba(0,0,0,.12)';
        back.textContent = '☰';
        document.body.appendChild(back);
      }
      back.style.display = 'block';
    } else if (back) back.style.display = 'none';
  }

  function startDrag(e){
    e.preventDefault();
    const g = document.getElementById('navGrip');
    g.__dragging = true;
    g.firstChild.style.background = 'var(--accent)';
    document.body.style.cursor = 'col-resize';

    const move = ev => {
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX);
      /* القائمة على اليمين (RTL): العرض = المسافة من حافة الشاشة */
      const w = window.innerWidth - x;
      if (navHidden() && w > NAV_MIN){
        try{ localStorage.setItem(NAV_HIDE,'0'); }catch(e){}
      }
      setNavWidth(w, true);
    };
    const up = () => {
      g.__dragging = false;
      g.firstChild.style.background = 'var(--line)';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
      injectNavButtons(true);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive:false });
    document.addEventListener('touchend', up);
  }

  /* اختصار زي محرّرات الكود */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')){
      e.preventDefault(); toggleNavHidden();
    }
  });
  window.addEventListener('resize', () => { installGrip(); applyNav(); });

  /* الشيل بيتبني من جديد مع كل تبديل شاشة، فالكلاس لازم يتحط تاني.
     مراقب بسيط أضمن من إننا نفتكر ننادي بعد كل رسم. */
  function syncNav(){
    try{
      if (!document.getElementById('emartnaNavWidth')) applyNav();
      else document.body.classList.toggle('nav-compact', navCompact());
      if (!document.getElementById('emartnaFontScale')) applyFont();
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
      /* تصغير حقيقي لعرض القائمة — مش ضغط المسافات بس */
      body.nav-compact .sidebar{width:186px !important}
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

      <div class="field2 mtop2"><label>عرض القائمة الجانبية</label>
        <div class="flexrow" style="gap:6px;flex-wrap:wrap">
          ${NAV_SIZES.map(n => `<button class="btn sm ${navSize()===n.key?'':'ghost'}"
            onclick="setNavSize('${n.key}');openDisplayPrefs()">${n.label}</button>`).join('')}
        </div>
        <input type="range" min="${NAV_MIN}" max="${NAV_MAX}" value="${navWidth()}"
          class="mtop" style="width:100%"
          oninput="setNavWidth(this.value,true);
                   document.getElementById('navWv').textContent=this.value+'px'">
        <p class="small" style="color:var(--muted)">
          العرض: <b id="navWv">${navWidth()}px</b> —
          أو <b>اسحب حافة القائمة</b> بالماوس، ودوس عليها مرتين للإخفاء
          (أو <b>Ctrl+B</b>).</p>
      </div>

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
  applyFont(); applyNav(); injectNavButtons(true);
  document.addEventListener('emartna:building-complete', () => {
    styles(); applyFont(); applyNav(); injectNavButtons(true);
  });

  console.log('[عمارتنا] تفضيلات العرض جاهزة');
})();
