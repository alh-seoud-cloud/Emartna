/* ============================================================
   عمارتنا — سجل الإصدارات: تصدير واستيراد إكسل
   ------------------------------------------------------------
   السجل بقى كبير (عشرات الملاحظات في الإصدار الواحد)، وتعديل
   كل ملاحظة من الشاشة بطيء.

   الإكسل بيخلّيك تراجع كل السجل في ورقة واحدة، وتقلب عمود
   "ظاهر للعملاء" بسرعة، وترفعه — والبرنامج بيوريك إيه اللي
   هيتغيّر قبل ما يحفظ.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const COLS = ['الإصدار','التاريخ','الملاحظة','ظاهر للعملاء','معرّف داخلي'];
  const YES  = ['نعم','yes','true','1','✓','ظاهر'];
  const isYes = v => YES.includes(String(v == null ? '' : v).trim().toLowerCase());

  function history(){
    try{ return (window.REG && REG.versionHistory) || []; }catch(e){ return []; }
  }

  /* ---------- تصدير ---------- */

  window.exportVersionsXlsx = function(){
    if (typeof XLSX === 'undefined')
      return showMessage('تعذر تحميل مكتبة إكسيل — اتأكد من الإنترنت وحاول تاني.');
    const rows = [];
    history().forEach(v => (v.notes || []).forEach(n => {
      rows.push([ v.version || '', v.date || '', n.text || '',
                  n.visibleToAdmins ? 'نعم' : 'لا', n.id || '' ]);
    }));
    if (!rows.length) return showMessage('السجل فاضي.');

    const ws = XLSX.utils.aoa_to_sheet([COLS, ...rows]);
    ws['!cols'] = [12,14,90,16,22].map(w => ({ wch:w }));
    ws['!views'] = [{ RTL: true }];
    ws['!freeze'] = { xSplit:'0', ySplit:'1' };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل الإصدارات');
    XLSX.writeFile(wb, 'سجل الإصدارات - ' + (window.todayISO?todayISO():'') + '.xlsx');
  };

  /* ---------- استيراد ---------- */

  window.openVersionsImport = function(){
    openModal(`
      <h3>📥 تحديث السجل بالإكسل</h3>
      <p class="small mtop">نزّل السجل الحالي، عدّل النصوص أو قلّب عمود
        <b>"ظاهر للعملاء"</b>، وارفعه تاني.</p>
      <p class="small" style="color:var(--muted)">
        <b>المعرّف الداخلي</b> هو اللي بنطابق بيه — ما تغيّروش ولا تمسحه.
        السطر اللي معرّفه فاضي بيتضاف كملاحظة جديدة للإصدار المكتوب في سطره.
        وأي ملاحظة موجودة ومش في الملف <b>بتتمسح</b>.</p>

      <button class="btn mtop" onclick="exportVersionsXlsx()">⬇️ نزّل السجل الحالي</button>

      <div class="field2 mtop2"><label>ارفع الملف بعد التعديل</label>
        <input type="file" id="vhImportFile" accept=".xlsx,.xls,.csv"
          onchange="handleVersionsUpload(this)"></div>

      <div id="vhPreview" class="mtop"></div>
      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  let PENDING = null;

  window.handleVersionsUpload = function(input){
    const f = input.files && input.files[0];
    if (!f) return;
    if (typeof XLSX === 'undefined') return showMessage('تعذر تحميل مكتبة إكسيل.');
    const rd = new FileReader();
    rd.onload = e => {
      try{
        const wb = XLSX.read(e.target.result, { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        preview(XLSX.utils.sheet_to_json(ws, { header:1, defval:'' }));
      }catch(err){ showMessage('تعذر قراءة الملف: ' + (err.message||'')); }
    };
    rd.readAsArrayBuffer(f);
  };

  function preview(aoa){
    const box = document.getElementById('vhPreview');
    if (!aoa || aoa.length < 2)
      return box.innerHTML = '<p class="small" style="color:var(--red)">الملف فاضي.</p>';

    const head = (aoa[0]||[]).map(h => String(h||'').replace(/\s+/g,''));
    if (head[0] !== 'الإصدار' || head[2] !== 'الملاحظة')
      return box.innerHTML = `<p class="small" style="color:var(--red)">
        شكل الملف مش مطابق. نزّل السجل من هنا وعدّل عليه.</p>`;

    const cur = history();
    const byId = {};
    cur.forEach(v => (v.notes||[]).forEach(n => { byId[n.id] = { v, n }; }));

    const seen = new Set();
    const rows = [], errs = [];
    let changed = 0, added = 0;

    aoa.slice(1).forEach((r, i) => {
      const ver = String(r[0]||'').trim();
      const text = String(r[2]||'').trim();
      const vis  = isYes(r[3]);
      const id   = String(r[4]||'').trim();
      if (!text) return;                       // سطر فاضي — نتخطاه بهدوء
      if (!ver){ errs.push(`سطر ${i+2}: رقم الإصدار فاضي`); return; }

      if (id && byId[id]){
        seen.add(id);
        const old = byId[id].n;
        const diff = (old.text||'') !== text || !!old.visibleToAdmins !== vis;
        if (diff) changed++;
        rows.push({ id, ver, text, vis, kind: diff ? 'تعديل' : 'زي ما هو' });
      } else {
        added++;
        rows.push({ id:'', ver, text, vis, kind:'جديدة' });
      }
    });

    const removed = Object.keys(byId).filter(k => !seen.has(k));
    PENDING = { rows, removed };

    const show = rows.filter(r => r.kind !== 'زي ما هو');
    box.innerHTML = `
      ${errs.length?`<div class="card" style="background:var(--tint-warning)">
        <b class="small">⚠️ أسطر اتخطّت:</b>
        ${errs.map(e=>`<div class="small">${esc2(e)}</div>`).join('')}</div>`:''}
      <p class="small mtop">
        <b>${changed}</b> تعديل · <b>${added}</b> ملاحظة جديدة ·
        <b style="color:${removed.length?'var(--red)':'inherit'}">${removed.length}</b> هتتمسح</p>
      ${removed.length?`<div class="card" style="background:var(--tint-warning)">
        <b class="small">⚠️ ${removed.length} ملاحظة موجودة في السجل ومش في الملف — هتتمسح.</b>
        <div class="small">لو ده مش مقصود، نزّل السجل من جديد وعدّل عليه بدل ما تبني ملف من الصفر.</div>
      </div>`:''}
      ${!show.length?'<p class="small mtop">مفيش تغييرات.</p>':`
        <div class="table-wrap mtop" style="max-height:40vh;overflow:auto">
        <table><thead><tr><th>الإصدار</th><th>النوع</th><th>الملاحظة</th><th>ظاهر</th>
        </tr></thead><tbody>
        ${show.map(r=>`<tr>
          <td>${esc2(r.ver)}</td>
          <td>${r.kind==='جديدة'?'<span class="badge g">جديدة</span>':'تعديل'}</td>
          <td class="small">${esc2(r.text.slice(0,90))}</td>
          <td>${r.vis?'✅':'داخلي'}</td></tr>`).join('')}
        </tbody></table></div>`}
      <button class="btn primary mtop" onclick="applyVersionsImport()">
        💾 طبّق (${changed + added + removed.length})</button>`;
  }

  window.applyVersionsImport = function(){
    if (!PENDING) return;
    const apply = () => {
      /* بنعيد بناء السجل من الملف: بنجمّع بالإصدار ونحافظ على تاريخه */
      const cur = history();
      const dateOf = {};
      cur.forEach(v => { dateOf[v.version || ''] = v.date; });

      const groups = {};
      PENDING.rows.forEach(r => {
        (groups[r.ver] = groups[r.ver] || []).push({
          id: r.id || (Date.now() + '_' + Math.floor(Math.random()*99999)),
          text: r.text, visibleToAdmins: r.vis,
        });
      });

      const out = Object.keys(groups).map(ver => ({
        id: (cur.find(v => (v.version||'') === ver) || {}).id
            || (Date.now() + '_' + ver),
        version: ver,
        date: dateOf[ver] || (window.todayISO ? todayISO() : ''),
        notes: groups[ver],
      }));
      /* الأحدث فوق */
      out.sort((a,b) => String(b.date||'').localeCompare(String(a.date||'')));

      REG.versionHistory = out;
      saveRegistry();
      closeModal();
      showMessage('اتحدّث السجل.');
      if (window.renderSysContent) renderSysContent();
    };

    if (PENDING.removed.length)
      return confirmAction(
        `هيتمسح ${PENDING.removed.length} ملاحظة مش موجودة في الملف.\n\nتكمّل؟`, apply);
    apply();
  };

  /* ---------- شريط الأدوات في الشاشة ---------- */

  const orig = window.pageSysVersions;
  if (typeof orig === 'function' && !orig.__xls){
    const wrapped = function(){
      const bar = `<div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ghost" onclick="exportVersionsXlsx()">📊 تصدير إكسل</button>
        <button class="btn sm ghost" onclick="openVersionsImport()">📥 تحديث بالإكسل</button>
      </div>`;
      const html = orig.apply(this, arguments);
      return typeof html === 'string' ? bar + html : html;
    };
    wrapped.__xls = true;
    window.pageSysVersions = wrapped;
  }

  console.log('[عمارتنا] إكسل سجل الإصدارات جاهز');
})();
