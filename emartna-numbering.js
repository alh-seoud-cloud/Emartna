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

  function units(){
    const D = window.D || {};
    return (D.apartments || []).slice().sort((a,b) => (a.number||0) - (b.number||0));
  }

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

    inputs.forEach((inp, i) => {
      const a = list[i]; if (!a) return;
      const isShop = a.type === 'shop';
      if (isShop) shN++; else apN++;
      const idx = isShop ? shN : apN;
      let v = '';

      if (kind === 'clear')       v = '';
      else if (kind === 'plain')  v = toAr(a.number);
      else if (kind === 'en')     v = String(a.number);
      else if (kind === 'typed')  v = (isShop ? 'محل ' : 'شقة ') + toAr(idx);
      // ترقيم متسلسل على كل الوحدات — مش لكل نوع لوحده،
      // وإلا المحل والشقة ياخدوا نفس الرقم.
      else if (kind === 'letter') v = 'A-' + (i + 1);
      else if (kind === 'floor'){
        const f = parseInt(String(a.floor).replace(/[^\d]/g,''), 10);
        v = isNaN(f) ? toAr(a.number) : toAr(f * 100 + idx);
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
