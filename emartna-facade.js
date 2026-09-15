/* ============================================================
   عمارتنا — واجهة العمارة
   ------------------------------------------------------------
   ثلاث تحسينات:
     ١) رقم الوحدة على الواجهة يبقى بترقيم الدور (١٠١ · ٢٠١)
        بدل الترقيم المتسلسل — زي اللي مكتوب على الباب.
     ٢) الأدوار اللي فيها وحدات كتير بتتلمّ في صفوف مرتبة
        بدل ما تتزنق في سطر واحد.
     ٣) شكلين للعرض: واجهة المبنى · أو شبكة مضغوطة.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const KEY_VIEW = 'emartna_facade_view';
  const KEY_NUM  = 'emartna_facade_num';

  const view = () => { try{ return localStorage.getItem(KEY_VIEW) || 'tower'; }catch(e){ return 'tower'; } };
  const numMode = () => { try{ return localStorage.getItem(KEY_NUM) || 'floor'; }catch(e){ return 'floor'; } };

  window.setFacadeView = v => {
    try{ localStorage.setItem(KEY_VIEW, v); }catch(e){}
    renderContent();
  };
  window.setFacadeNum = v => {
    try{ localStorage.setItem(KEY_NUM, v); }catch(e){}
    renderContent();
  };

  /* ---------- الترقيم المعروض على الوحدة ---------- */

  const AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  const toAr = n => String(n).replace(/\d/g, d => AR[+d]);

  /* رقم الدور من اسمه: الأرضي=0 · الأول=1 … */
  const ORD = ['الأرضي','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع',
               'الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر',
               'الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر',
               'التاسع عشر','العشرون'];
  /* ⚠️ الترتيب مهم: "الثاني عشر" فيه "الثاني" جواها.
     البحث بالترتيب العادي كان بيرجّع ٢ بدل ١٢، فالشقة ١٢٠١
     كانت بتظهر ٢٠١. بندوّر على الأطول الأول. */
  const ORD_BY_LEN = ORD.map((name, i) => ({ name, i }))
    .sort((a, b) => b.name.length - a.name.length);

  function floorNo(label){
    const s = String(label || '').trim();
    for (const o of ORD_BY_LEN) if (s.includes(o.name)) return o.i;
    const m = s.match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  /* الرقم اللي يظهر جوه المربع */
  /* ⚠️ الرقم كان بيتحسب هنا من اسم الدور وترتيب الوحدة — ونفس
        الحساب كان مكرر في القاعدة (القاعدة رقم ٥). وكان بيقع في
        حالتين:
        · «الدور الثاني عشر» كان بيتقرا ٢ فيتصادم مع الدور الثاني
          (٥٠ وحدة في ٥ عمارات كانت بتعرض رقم غلط)
        · النتيجة كانت بتتغيّر بزرار «متسلسل/ترقيم الدور» في متصفح
          كل مستخدم — فنفس الوحدة تطلع ٤٠٢ عند واحد و٣٤ عند التاني
          في كشوف حساب وإيصالات اتبعتت للسكان

     دلوقتي الرقم متخزّن في القاعدة وبيتقرا زي ما هو: مصدر واحد
     للحقيقة، ثابت لكل المستخدمين، ومايتغيّرش بزرار عرض.
     الحساب القديم بقى احتياطي لوحدة لسه ما وصلهاش رقم متخزّن. */
  window.facadeUnitNumber = function(a, idxInFloor){
    // ١) الرقم المتخزّن — هو الأصل
    if (a.label && String(a.label).trim()) return String(a.label).trim();

    // ٢) احتياطي بس — وحدة لسه بلا رقم متخزّن
    if (numMode() === 'floor'){
      const f = floorNo(a.floor);
      if (f !== null && f > 0) return toAr(f * 100 + idxInFloor);
      if (f === 0) return toAr(idxInFloor);          // الأرضي: ١ · ٢
    }
    return window.unitTypeIndex ? unitTypeIndex(a) : a.number;
  };

  /* ---------- الرسم ---------- */

  /* لو الوحدة سبقت تعريف الدالة، بنستنّاها بدل ما نتخطّى اللفّ */
  let tries = 0;
  const waitFn = setInterval(() => {
    if (++tries > 60) return clearInterval(waitFn);
    if (typeof window.buildingIllustration === 'function'
        && !window.buildingIllustration.__facade){
      clearInterval(waitFn);
      hookIt();
    }
  }, 200);

  function hookIt(){
  const origIll = window.buildingIllustration;
  if (typeof origIll === 'function' && !origIll.__facade){
    const wrapped = function(mode){
      try{ return render(mode); }
      catch(e){ return origIll.apply(this, arguments); }
    };
    wrapped.__facade = true;
    window.buildingIllustration = wrapped;

    /* الشاشة بترسم قبل ما الوحدات تتحمّل (الوحدات مؤجّلة)،
       فلو لوحة التحكم متفتحة بالفعل بنعيد رسمها عشان
       الأزرار والترقيم الجديد يبانوا. */
    setTimeout(() => {
      try{
        const el = document.getElementById('content');
        if (el && /bld-wrap|bld-unit/.test(el.innerHTML) && window.renderContent)
          renderContent();
      }catch(e){}
    }, 300);
  }

  function classOf(a, mode, month){
    if (mode === 'admin'){
      const p = window.apPaidForMonth ? apPaidForMonth(a.id, month) : null;
      const bal = window.apBalance ? apBalance(a.id) : 0;
      return bal > 0 ? 'unpaid' : (p === null ? 'none' : 'paid');
    }
    if (mode === 'owner') return a.type === 'shop' ? 'shop' : 'neutral';
    return 'none';
  }

  function render(mode){
    const D = window.D || {};
    const aps = [...(D.apartments || [])].sort((a,b) => (a.number||0) - (b.number||0));
    if (!aps.length) return '<p class="small">مفيش وحدات لسه.</p>';

    const month = window.curMonth ? curMonth() : '';
    const isAdmin = mode === 'admin';

    /* تجميع بالأدوار */
    const order = [], map = {};
    aps.forEach(a => {
      const k = a.floor || '';
      if (!map[k]){ map[k] = []; order.push(k); }
      map[k].push(a);
    });
    const floors = order.map(k => ({ label:k, units:map[k] })).reverse();

    const maxPerFloor = Math.max(...floors.map(f => f.units.length));
    const wide = maxPerFloor > 6;

    const unitHTML = (a, i) => {
      const cls = classOf(a, mode, month);
      const click = isAdmin ? `onclick="openApartmentDetail('${a.id}')"`
                            : `onclick="openApartmentContact('${a.id}')"`;
      const shop = a.type === 'shop' ? ' is-shop' : '';
      const num = facadeUnitNumber(a, i + 1);
      const bal = (isAdmin && window.apBalance) ? apBalance(a.id) : 0;
      const tip = `${window.unitLabel ? unitLabel(a) : ''}${a.ownerName ? ' — ' + a.ownerName : ''}${
        bal > 0 && window.money ? ' — عليه ' + money(bal) : ''}`;
      return `<div class="bld-unit ${cls}${shop}" ${click} title="${esc2(tip)}">
        ${a.type === 'shop' ? '<span class="bld-shop-badge">🏪</span>' : ''}${esc2(num)}</div>`;
    };

    const VIEWS = [
      ['tower','🏢','واجهة'], ['grid','▦','شبكة'],
      ['list','☰','قائمة'],   ['heat','🔥','خريطة حرارية'], ['compact','⬛','مصغّر'],
    ];
    const controls = `
      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap;align-items:center">
        <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
          ${VIEWS.map(([k,i,l]) => `<button class="btn sm ${view()===k?'primary':'ghost'}"
            style="border-radius:0" onclick="setFacadeView('${k}')" title="${l}">${i} ${l}</button>`).join('')}
        </span>
        <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
          <button class="btn sm ${numMode()==='floor'?'primary':'ghost'}" style="border-radius:0"
            onclick="setFacadeNum('floor')" title="١٠١ · ٢٠١">ترقيم الدور</button>
          <button class="btn sm ${numMode()==='seq'?'primary':'ghost'}" style="border-radius:0"
            onclick="setFacadeNum('seq')" title="١ · ٢ · ٣">متسلسل</button>
        </span>
      </div>`;

    /* ---- شكل الشبكة: مضغوط ومناسب للعمارات الكبيرة ---- */
    if (view() === 'grid'){
      return controls + `
      <div class="mtop" style="max-height:60vh;overflow:auto">
        ${floors.map(f => `
          <div style="margin-bottom:10px">
            <div class="small" style="color:var(--muted);margin-bottom:4px;font-weight:700">
              ${esc2(f.label)} <span style="font-weight:400">(${f.units.length})</span></div>
            <div style="display:grid;gap:5px;justify-content:start;
                 grid-template-columns:repeat(auto-fill,minmax(52px,64px))">
              ${f.units.map(unitHTML).join('')}
            </div>
          </div>`).join('')}
      </div>`;
    }

    /* ---- شكل القائمة: كل دور سطر مع ملخّصه ---- */
    if (view() === 'list'){
      return controls + `
      <div class="mtop" style="max-height:60vh;overflow:auto">
        ${floors.map(f => {
          const owe = isAdmin ? f.units.filter(a => (window.apBalance?apBalance(a.id):0) > 0).length : 0;
          const pct = f.units.length ? Math.round((f.units.length-owe)/f.units.length*100) : 0;
          return `
          <div class="card" style="margin-bottom:8px;padding:10px 12px">
            <div class="flexrow" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div>
                <b>${esc2(f.label)}</b>
                <span class="small" style="color:var(--muted)"> · ${f.units.length} وحدة</span>
              </div>
              ${isAdmin ? `<div class="flexrow" style="gap:6px;align-items:center">
                <span class="badge ${owe?'r':'g'}">${owe ? owe + ' متأخرة' : 'كله مسدّد'}</span>
                <div style="width:70px;height:7px;background:var(--line);border-radius:5px;overflow:hidden">
                  <div style="width:${pct}%;height:100%;background:var(--accent)"></div></div>
                <span class="small">${pct}%</span>
              </div>` : ''}
            </div>
            <div class="flexrow mtop" style="gap:4px;flex-wrap:wrap;justify-content:flex-start;
                 --u-w:56px">
              ${f.units.map(unitHTML).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }

    /* ---- خريطة حرارية: اللون حسب حجم المتأخر ---- */
    if (view() === 'heat'){
      const bals = aps.map(a => window.apBalance ? apBalance(a.id) : 0);
      const max = Math.max(1, ...bals);
      const heatUnit = (a, i) => {
        const bal = window.apBalance ? apBalance(a.id) : 0;
        const r = bal > 0 ? Math.min(1, bal / max) : 0;
        const bg = bal <= 0 ? 'var(--tint-success,#e8f5f2)'
          : `rgba(200,45,45,${0.18 + r * 0.72})`;
        const fg = r > 0.55 ? '#fff' : 'var(--text,#1b2b28)';
        return `<div class="bld-unit" onclick="openApartmentDetail('${a.id}')"
          style="background:${bg};color:${fg};border-color:transparent"
          title="${esc2((window.unitLabel?unitLabel(a):'') + (bal>0&&window.money?' — عليه '+money(bal):' — مسدّد'))}">
          ${esc2(facadeUnitNumber(a, i + 1))}</div>`;
      };
      return controls + `
      <p class="small mtop" style="color:var(--muted)">
        كل ما اللون أغمق، المتأخر أكبر. الأخضر = مسدّد.</p>
      <div class="mtop" style="max-height:60vh;overflow:auto">
        ${floors.map(f => `
          <div class="bld-floor">
            <div class="bld-floor-label">${esc2(f.label)}</div>
            <div class="bld-units" style="display:grid;gap:4px;flex:1;justify-content:start;
                 grid-template-columns:repeat(auto-fill,minmax(46px,58px))">
              ${f.units.map(heatUnit).join('')}
            </div>
          </div>`).join('')}
      </div>`;
    }

    /* ---- مصغّر: كل الوحدات في شبكة واحدة صغيرة ---- */
    if (view() === 'compact'){
      return controls + `
      <p class="small mtop" style="color:var(--muted)">
        كل الوحدات في نظرة واحدة — مناسب للعمارات الكبيرة.</p>
      <div class="mtop" style="display:grid;gap:3px;max-height:60vh;overflow:auto;
           justify-content:start;grid-template-columns:repeat(auto-fill,minmax(34px,42px))">
        ${''}${aps.map((a, i) => {
          const cls = classOf(a, mode, month);
          const bal = (isAdmin && window.apBalance) ? apBalance(a.id) : 0;
          return `<div class="bld-unit ${cls}" onclick="openApartmentDetail('${a.id}')"
            style="min-width:32px;font-size:10px;padding:5px 1px"
            title="${esc2((window.unitLabel?unitLabel(a):'') + ' — ' + (a.floor||'') +
              (bal>0&&window.money?' — عليه '+money(bal):''))}">
            ${esc2(facadeUnitNumber(a, 1))}</div>`;
        }).join('')}
      </div>`;
    }

    /* ---- شكل الواجهة ---- */
    return controls + `
    <div class="bld-wrap${wide ? ' bld-wide' : ''}" style="max-height:62vh;overflow:auto">
      <div class="bld-roof"></div>
      ${floors.map(f => `
        <div class="bld-floor">
          <div class="bld-floor-label">${esc2(f.label)}${
            f.units.length > 6 ? `<div style="font-size:10px;opacity:.7">${f.units.length} وحدة</div>` : ''}</div>
          <div class="bld-units" style="display:grid;gap:4px;justify-content:start;flex:1;
               grid-template-columns:repeat(auto-fill,minmax(${wide ? '46px,58px' : '52px,64px'}))">
            ${f.units.map(unitHTML).join('')}
          </div>
        </div>`).join('')}
    </div>`;
  }

  }
  hookIt();

  /* تنسيق إضافي للأدوار المزدحمة */
  function css(){
    if (document.getElementById('facadeCss')) return;
    const st = document.createElement('style');
    st.id = 'facadeCss';
    st.textContent = `
      .bld-wide .bld-unit{ min-width:44px; font-size:12px; padding:6px 2px }
      .bld-wide .bld-floor-label{ min-width:74px; font-size:12px }
      .bld-wrap .bld-unit{ transition:transform .12s }
      /* الوحدة الواحدة في الدور مكانتش بتتمدّد على عرض الشاشة كله */
      /* الوحدة الواحدة في الدور مكانتش بتتمدّد على عرض الشاشة كله */
      .bld-unit{ max-width:64px; min-width:44px; flex:0 0 auto; box-sizing:border-box }
      .bld-units{ justify-content:flex-start }
      .bld-wide .bld-unit{ max-width:58px }
      @media (max-width:720px){ .bld-unit{ max-width:56px !important } }
      .bld-wrap .bld-unit:hover{ transform:scale(1.06); z-index:2 }
      @media (max-width:720px){
        .bld-floor-label{ min-width:62px !important; font-size:11px !important }
        .bld-unit{ min-width:40px !important; font-size:11px !important }
      }`;
    document.head.appendChild(st);
  }
  setTimeout(css, 800);

  console.log('[عمارتنا] واجهة العمارة جاهزة');
})();


/* ============================================================
   تكبير وتصغير الواجهة + مظاهر
   ------------------------------------------------------------
   عمارة ٩٦ وحدة على ١٢ دور مابتدخلش في شاشة موبايل. التكبير
   بيخلّي رئيس الاتحاد يشوف الصورة كاملة ويعرف الأحمر متجمّع فين —
   وده الهدف الأساسي من الواجهة.

   المظاهر بـCSS خالص من غير مكتبة 3D: مكتبة التلات أبعاد تزوّد
   ١٥٠ ك.ب، وبتخلّي الأرقام العربية مايلة وصعبة القراءة، وأهداف
   اللمس أصغر. الإحساس المجسّم بالظل بيدّي نفس الانطباع بتكلفة صفر.
   ============================================================ */
(function(){
  'use strict';
  const Z_KEY='emartna_facade_zoom', TH_KEY='emartna_facade_theme';
  const MIN=0.45, MAX=1.6, STEP=0.12;
  const THEMES=[
    {key:'flat',label:'بسيط',icon:'▫️'},
    {key:'depth',label:'مجسّم',icon:'🧱'},
    {key:'night',label:'ليلي',icon:'🌙'},
    {key:'blueprint',label:'مخطط',icon:'📐'},
  ];
  const zoom=()=>{const v=parseFloat(localStorage.getItem(Z_KEY));
    return (v>=MIN&&v<=MAX)?v:1;};
  const theme=()=>{try{return localStorage.getItem(TH_KEY)||'flat';}catch(e){return 'flat';}};

  function styles(){
    if(document.getElementById('facadeZoomStyles'))return;
    const st=document.createElement('style');
    st.id='facadeZoomStyles';
    st.textContent=`
      .bld-zoomer{overflow:auto;-webkit-overflow-scrolling:touch;border-radius:12px}
      .bld-zoomer .bld-wrap{transform-origin:top center;transition:transform .18s ease}
      .fz-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
      .fz-btn{width:32px;height:32px;border:1px solid var(--line);border-radius:9px;
        background:var(--card);color:var(--text);font-size:16px;font-weight:700;
        cursor:pointer;line-height:1;display:flex;align-items:center;
        justify-content:center;flex:0 0 auto}
      .fz-btn:disabled{opacity:.35;cursor:default}
      .fz-val{font-size:11.5px;color:var(--muted);min-width:42px;text-align:center}

      .bld-wrap.th-depth .bld-unit{box-shadow:inset 0 -2px 0 rgba(0,0,0,.18),
        0 1px 2px rgba(0,0,0,.12);border-radius:3px}
      .bld-wrap.th-depth .bld-floor{background:linear-gradient(180deg,rgba(0,0,0,.035),transparent)}
      .bld-wrap.th-depth .bld-roof{box-shadow:0 3px 6px rgba(0,0,0,.2)}

      .bld-wrap.th-night{background:#16202b;border-radius:12px;padding:10px}
      .bld-wrap.th-night .bld-floor{background:transparent}
      .bld-wrap.th-night .bld-floor-label{color:#8fa3b8}
      .bld-wrap.th-night .bld-unit{border:0;box-shadow:0 0 8px currentColor}
      .bld-wrap.th-night .bld-roof{background:#0e1620}

      .bld-wrap.th-blueprint{background:#0d2b45;border-radius:12px;padding:10px;
        background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);
        background-size:16px 16px}
      .bld-wrap.th-blueprint .bld-floor{background:transparent}
      .bld-wrap.th-blueprint .bld-floor-label{color:#a9cbe6}
      .bld-wrap.th-blueprint .bld-unit{background:transparent !important;
        border:1.5px solid currentColor;border-radius:2px}
      .bld-wrap.th-blueprint .bld-roof{background:#a9cbe6;opacity:.7}
      @media (max-width:640px){.fz-val{display:none}}`;
    document.head.appendChild(st);
  }

  function apply(){
    document.querySelectorAll('.bld-wrap').forEach(w=>{
      w.style.transform='scale('+zoom()+')';
      THEMES.forEach(t=>w.classList.remove('th-'+t.key));
      w.classList.add('th-'+theme());
      const box=w.closest('.bld-zoomer');
      if(box){
        /* الارتفاع يتظبط مع التصغير وإلا بيفضل فراغ تحت */
        const h=w.scrollHeight*zoom();
        box.style.height=Math.min(h+14, window.innerHeight*0.62)+'px';
      }
    });
    const v=document.getElementById('fzVal');
    if(v)v.textContent=Math.round(zoom()*100)+'%';
    document.querySelectorAll('[data-fz-out]').forEach(b=>b.disabled=zoom()<=MIN+0.001);
    document.querySelectorAll('[data-fz-in]').forEach(b=>b.disabled=zoom()>=MAX-0.001);
  }

  window.facadeZoom=function(d){
    const v=Math.max(MIN,Math.min(MAX,zoom()+d*STEP));
    try{localStorage.setItem(Z_KEY,String(v));}catch(e){} apply();
  };
  window.facadeFit=function(){
    const w=document.querySelector('.bld-wrap'); if(!w)return;
    const need=w.scrollHeight||1, have=window.innerHeight*0.58;
    const v=Math.max(MIN,Math.min(MAX,have/need));
    try{localStorage.setItem(Z_KEY,String(v));}catch(e){} apply();
    if(window.toast)toast('العمارة كلها في الشاشة');
  };
  window.setFacadeTheme=function(k){
    try{localStorage.setItem(TH_KEY,k);}catch(e){} apply();
    if(window.toast)toast('المظهر: '+(THEMES.find(t=>t.key===k)||{}).label);
  };

  function barHTML(){
    const t=theme();
    return `<div class="fz-bar">
      <button class="fz-btn" data-fz-out onclick="facadeZoom(-1)" title="تصغير">−</button>
      <span class="fz-val" id="fzVal">${Math.round(zoom()*100)}%</span>
      <button class="fz-btn" data-fz-in onclick="facadeZoom(1)" title="تكبير">+</button>
      <button class="btn sm ghost" onclick="facadeFit()" title="العمارة كلها في الشاشة">⤢ ملء</button>
      <div class="spacer"></div>
      ${THEMES.map(x=>`<button class="btn sm ${t===x.key?'':'ghost'}"
        style="padding:4px 9px" onclick="setFacadeTheme('${x.key}')"
        title="${x.label}">${x.icon}</button>`).join('')}
    </div>`;
  }

  /* القرص بإصبعين — مع منع تكبير الصفحة كلها */
  function pinch(box){
    if(box.__pinch)return; box.__pinch=true;
    let d0=0,z0=1;
    const dist=e=>Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                             e.touches[0].clientY-e.touches[1].clientY);
    box.addEventListener('touchstart',e=>{
      if(e.touches.length!==2)return; d0=dist(e); z0=zoom();},{passive:true});
    box.addEventListener('touchmove',e=>{
      if(e.touches.length!==2||!d0)return;
      e.preventDefault();
      const v=Math.max(MIN,Math.min(MAX,z0*(dist(e)/d0)));
      try{localStorage.setItem(Z_KEY,String(v));}catch(x){} apply();},{passive:false});
    box.addEventListener('touchend',()=>{d0=0;},{passive:true});
  }

  /* بنغلّف بعد وحدة الواجهة — فبنستنّاها تخلّص لفّها الأول */
  let n=0;
  const wait=setInterval(()=>{
    if(++n>80)return clearInterval(wait);
    const f=window.buildingIllustration;
    if(typeof f!=='function'||!f.__facade)return;
    if(f.__zoom)return clearInterval(wait);
    clearInterval(wait);
    const wrapped=function(){
      const html=f.apply(this,arguments);
      if(typeof html!=='string')return html;
      if(html.indexOf('bld-zoomer')>=0)return html;
      return barHTML()+'<div class="bld-zoomer">'+html+'</div>';
    };
    wrapped.__zoom=true; wrapped.__facade=true;
    window.buildingIllustration=wrapped;
  },200);

  styles();
  setInterval(()=>{
    const box=document.querySelector('.bld-zoomer'); if(!box)return;
    pinch(box);
    const w=box.querySelector('.bld-wrap');
    if(w&&!w.style.transform)apply();
  },700);
  document.addEventListener('emartna:building-complete',()=>setTimeout(apply,700));
  console.log('[عمارتنا] تكبير الواجهة جاهز');
})();
