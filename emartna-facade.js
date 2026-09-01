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
               'الرابع عشر','الخامس عشر'];
  function floorNo(label){
    const s = String(label || '');
    for (let i = 0; i < ORD.length; i++) if (s.includes(ORD[i])) return i;
    const m = s.match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  /* الرقم اللي يظهر جوه المربع */
  window.facadeUnitNumber = function(a, idxInFloor){
    // ١) الرقم المخصّص اللي كتبه رئيس الاتحاد بيغلب كل حاجة
    if (a.label && String(a.label).trim()) return String(a.label).trim();

    // ٢) ترقيم الدور: ١٠١ · ٢٠١ …
    if (numMode() === 'floor'){
      const f = floorNo(a.floor);
      if (f !== null && f > 0) return toAr(f * 100 + idxInFloor);
      if (f === 0) return toAr(idxInFloor);          // الأرضي: ١ · ٢
    }

    // ٣) الترقيم المتسلسل الأصلي
    return window.unitTypeIndex ? unitTypeIndex(a) : a.number;
  };

  /* ---------- الرسم ---------- */

  const origIll = window.buildingIllustration;
  if (typeof origIll === 'function' && !origIll.__facade){
    const wrapped = function(mode){
      try{ return render(mode); }
      catch(e){ return origIll.apply(this, arguments); }
    };
    wrapped.__facade = true;
    window.buildingIllustration = wrapped;
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

    const controls = `
      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap;align-items:center">
        <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
          <button class="btn sm ${view()==='tower'?'primary':'ghost'}" style="border-radius:0"
            onclick="setFacadeView('tower')">🏢 واجهة</button>
          <button class="btn sm ${view()==='grid'?'primary':'ghost'}" style="border-radius:0"
            onclick="setFacadeView('grid')">▦ شبكة</button>
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
            <div style="display:grid;gap:5px;
                 grid-template-columns:repeat(auto-fill,minmax(52px,1fr))">
              ${f.units.map(unitHTML).join('')}
            </div>
          </div>`).join('')}
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
          <div class="bld-units"${wide
            ? ' style="display:grid;gap:4px;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));flex:1"'
            : ''}>
            ${f.units.map(unitHTML).join('')}
          </div>
        </div>`).join('')}
    </div>`;
  }

  /* تنسيق إضافي للأدوار المزدحمة */
  function css(){
    if (document.getElementById('facadeCss')) return;
    const st = document.createElement('style');
    st.id = 'facadeCss';
    st.textContent = `
      .bld-wide .bld-unit{ min-width:44px; font-size:12px; padding:6px 2px }
      .bld-wide .bld-floor-label{ min-width:74px; font-size:12px }
      .bld-wrap .bld-unit{ transition:transform .12s }
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
