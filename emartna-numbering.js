/* ============================================================
   عمارتنا — ترقيم الوحدات المخصّص
   ------------------------------------------------------------
   كل عمارة ليها نظام ترقيم مختلف: A-12 · شقة ٥ب · محل ٣ ·
   ١٠١ (دور + رقم) … البرنامج بيرقّم تلقائيًا، ودي أداة تخلّي
   رئيس الاتحاد يحط الأرقام الحقيقية بسرعة بدل واحدة واحدة.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  const toAr = n => String(n).replace(/\d/g, d => AR[+d]);


  /* رقم الدور من اسمه العربي.
     ⚠️ الترتيب مهم: "الثاني عشر" فيه "الثاني" جواها، والبحث
     بالترتيب العادي كان بيرجّع ٢ بدل ١٢. بندوّر على الأطول الأول.
     والاعتماد على الأرقام وحده مش كافي لأن أسماء الأدوار عربية. */
  const FLOORS = ['الأرضي','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع',
                  'الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر',
                  'الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر',
                  'التاسع عشر','العشرون'];
  const FLOORS_BY_LEN = FLOORS.map((name, i) => ({ name, i }))
    .sort((a, b) => b.name.length - a.name.length);

  function floorNumOf(label){
    const t = String(label || '').trim();
    if (!t) return null;
    for (const o of FLOORS_BY_LEN) if (t.includes(o.name)) return o.i;
    const m = t.match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  function units(){
    const D = window.D || {};
    return (D.apartments || []).slice().sort((a,b) => (a.number||0) - (b.number||0));
  }


  /* ============================================================
     الرقم المعروض لأي وحدة — مصدر واحد لكل الشاشات
     ------------------------------------------------------------
     الترتيب: الرقم المخصّص → دور+رقم → التسلسل.
     قبل كده كل شاشة كانت بتحسبه لوحدها، والتسلسل كان بيتكرر
     (محل ١ وشقة ١ الاتنين بيبانوا "١").
     ============================================================ */

  window.unitDisplayNo = function(a){
    if (!a) return '';
    if (a.label && String(a.label).trim()) return String(a.label).trim();

    const f = floorNumOf(a.floor);
    if (f !== null){
      // ترتيب الوحدة جوه دورها
      const same = ((window.D && D.apartments) || [])
        .filter(x => String(x.floor || '') === String(a.floor || ''))
        .sort((x, y) => (x.number || 0) - (y.number || 0));
      const idx = same.findIndex(x => x.id === a.id) + 1;
      if (idx > 0) return f === 0 ? toAr(idx) : toAr(f * 100 + idx);
    }
    return window.unitTypeIndex ? String(unitTypeIndex(a)) : String(a.number || '');
  };

  /* بنستبدل عمود رقم الوحدة في كل الجداول */
  function patchCols(){
    const orig = window.sortableTable;
    if (typeof orig !== 'function' || orig.__unitNo) return;
    const wrapped = function(id, rows, cols, groupBy, opts){
      if (Array.isArray(cols)){
        cols = cols.map(c => {
          if (!c || (c.key !== 'number' && c.key !== 'unit')) return c;
          if (c.__unitNo) return c;
          const isUnitCol = c.label === 'رقم الوحدة' || c.label === 'الشقة' || c.label === 'الوحدة';
          if (!isUnitCol) return c;
          return Object.assign({}, c, {
            __unitNo: true,
            /* ⚠️ الترتيب كان بالنص، فـ"١٠١" بييجي قبل "٢٠١" وبعد "١".
               دلوقتي بنرتّب بالدور الأول وبعدين برقم الوحدة —
               فالأدوار بتفضل تحت بعضها بالترتيب الطبيعي. */
            value: r => { const a = (r && r.ap !== undefined) ? r.ap : r;
              if (!a) return -1;
              const f = floorNumOf(a.floor);
              const disp = String(unitDisplayNo(a) || '');
              // الأرقام العربية بتترجع لإنجليزي عشان المقارنة
              const en = disp.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
              const n = parseInt(en.replace(/[^\d]/g, ''), 10);
              const within = isNaN(n) ? (a.number || 0) : n;
              return (f === null ? 99 : f) * 100000 + (within % 100000); },
            sortValue: r => { const a = (r && r.ap !== undefined) ? r.ap : r;
              if (!a) return -1;
              const f = floorNumOf(a.floor);
              const disp = String(unitDisplayNo(a) || '');
              const en = disp.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
              const n = parseInt(en.replace(/[^\d]/g, ''), 10);
              const within = isNaN(n) ? (a.number || 0) : n;
              return (f === null ? 99 : f) * 100000 + (within % 100000); },
            cell:  r => { const a = r && r.ap !== undefined ? r.ap : r;
              if (!a) return '—';
              const n = unitDisplayNo(a);
              const nm = window.unitTypeName ? unitTypeName(a) : '';
              return `<b>${esc2(n)}</b>${nm ? ` <span class="small" style="color:var(--muted)">${esc2(nm)}</span>` : ''}`; },
          });
        });
      }
      return orig.call(this, id, rows, cols, groupBy, opts);
    };
    wrapped.__unitNo = true;
    window.sortableTable = wrapped;
  }
  patchCols();
  [900, 2500, 5000].forEach(ms => setTimeout(patchCols, ms));

  /* ---------- الشاشة ---------- */

  window.openUnitNumbering = function(){
    const list = units();
    if (!list.length) return showMessage('ضيف وحدات الأول');

    const done = list.filter(a => a.label && String(a.label).trim()).length;

    openModal(`
      <h3>🔢 ترقيم الوحدات</h3>
      <p class="small mtop">اكتب رقم كل وحدة زي ما هو مكتوب على الباب.
      سيب الخانة فاضية لو الترقيم التلقائي مناسب.</p>

      <div class="card mtop" style="padding:10px">
        <b class="small">قوالب جاهزة — بتملا كل الوحدات مرة واحدة</b>
        <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
          <button class="btn sm ghost" onclick="applyNumTemplate('plain')">١ · ٢ · ٣</button>
          <button class="btn sm ghost" onclick="applyNumTemplate('en')">1 · 2 · 3</button>
          <button class="btn sm ghost" onclick="applyNumTemplate('floor')">دور+رقم (١٠١ · ١٠٢)</button>
          <button class="btn sm ghost" onclick="applyNumTemplate('letter')">A-1 · A-2</button>
          <button class="btn sm ghost" onclick="applyNumTemplate('typed')">شقة ١ · محل ١</button>
          <button class="btn sm red" onclick="applyNumTemplate('clear')">🗑️ تفريغ الكل</button>
        </div>
        <p class="small mtop" style="color:var(--muted)">
          القوالب بتملا الخانات تحت — تقدر تعدّل أي واحدة بعدها، والحفظ في الآخر.
        </p>
      </div>

      <div class="small mtop2" style="color:var(--muted)">
        ${done} من ${list.length} وحدة ليها رقم مخصّص
      </div>

      <div class="mtop" style="max-height:46vh;overflow:auto;padding-inline-end:4px">
        ${list.map(a => `
          <div class="flexrow" style="gap:8px;align-items:center;padding:5px 0;
               border-bottom:1px dashed var(--line)">
            <span class="small" style="min-width:112px;color:var(--muted)">
              ${a.type === 'shop' ? '🏪 محل' : '🏠 شقة'} ${a.number}
              ${a.floor ? `<span style="font-size:11px"> · ${esc2(a.floor)}</span>` : ''}
            </span>
            <input class="unum" data-id="${esc2(a.id)}" value="${esc2(a.label || '')}"
              placeholder="${a.type === 'shop' ? 'محل ' : 'شقة '}${a.number}"
              style="flex:1;min-width:90px">
            <span class="small" style="min-width:96px;color:var(--muted);overflow:hidden;
                  text-overflow:ellipsis;white-space:nowrap">${esc2(a.ownerName || '')}</span>
          </div>`).join('')}
      </div>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveUnitNumbering()">💾 حفظ الترقيم</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  /* ---------- القوالب ---------- */

  window.applyNumTemplate = function(kind){
    const inputs = [...document.querySelectorAll('.unum')];
    const list = units();
    let apN = 0, shN = 0;
    /* الترقيم جوه الدور بيبدأ من ١ في كل دور — عشان ١٠١ · ١٠٢
       وبعدين ٢٠١ · ٢٠٢، مش تسلسل متصل على العمارة كلها. */
    const perFloor = {};

    inputs.forEach((inp, i) => {
      const a = list[i]; if (!a) return;
      const isShop = a.type === 'shop';
      if (isShop) shN++; else apN++;
      const idx = isShop ? shN : apN;
      const fk = String(a.floor || '');
      perFloor[fk] = (perFloor[fk] || 0) + 1;
      const idxInFloor = perFloor[fk];
      let v = '';

      if (kind === 'clear')       v = '';
      else if (kind === 'plain')  v = toAr(a.number);
      else if (kind === 'en')     v = String(a.number);
      else if (kind === 'typed')  v = (isShop ? 'محل ' : 'شقة ') + toAr(idx);
      // ترقيم متسلسل على كل الوحدات — مش لكل نوع لوحده،
      // وإلا المحل والشقة ياخدوا نفس الرقم.
      else if (kind === 'letter') v = 'A-' + (i + 1);
      else if (kind === 'floor'){
        const f = floorNumOf(a.floor);
        v = (f === null) ? toAr(a.number)
          : (f === 0 ? toAr(idxInFloor) : toAr(f * 100 + idxInFloor));
      }
      inp.value = v;
    });
    if (window.toast) toast(kind === 'clear' ? 'اتفضّت الخانات' : 'اتملت — راجعها واحفظ');
  };

  /* ---------- الحفظ ---------- */

  window.saveUnitNumbering = function(){
    const inputs = [...document.querySelectorAll('.unum')];
    const seen = {}, dups = [];
    const changes = [];

    inputs.forEach(inp => {
      const id = inp.getAttribute('data-id');
      const v = (inp.value || '').trim();
      if (v){
        const k = v.replace(/\s+/g,'');
        if (seen[k]) dups.push(v); else seen[k] = 1;
      }
      changes.push({ id, v });
    });

    if (dups.length)
      return showMessage('في أرقام مكرّرة: ' + [...new Set(dups)].slice(0,5).join(' · ') +
        '\n\nكل وحدة لازم يبقى ليها رقم مختلف.');

    let n = 0;
    changes.forEach(c => {
      const a = (D.apartments || []).find(x => x.id === c.id);
      if (!a) return;
      if ((a.label || '') !== c.v){ a.label = c.v; n++; }
    });

    if (!n){ closeModal(); return; }
    save();
    closeModal();
    if (window.toast) toast(`اتحفظ ترقيم ${n} وحدة`);
    renderContent();
  };

  /* زرار في شاشة الشقق */
  const origAp = window.pageApartments;
  if (typeof origAp === 'function' && !origAp.__numbering){
    const wrapped = function(){
      const html = origAp.apply(this, arguments);
      const btn = `<button class="btn ghost" onclick="openUnitNumbering()">🔢 ترقيم الوحدات</button>`;
      // بنحطه جنب زرار إضافة وحدة
      const m = html.match(/<button class="btn primary"[^>]*onclick="openApartmentModal\(\)"[^>]*>[^<]*<\/button>/);
      return m ? html.replace(m[0], m[0] + btn)
               : `<div class="flexrow" style="margin-bottom:10px">${btn}</div>` + html;
    };
    wrapped.__numbering = true;
    window.pageApartments = wrapped;
  }

  console.log('[عمارتنا] ترقيم الوحدات جاهز');
})();
