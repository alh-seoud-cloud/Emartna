/* ============================================================
   عمارتنا — كشوف المصروفات الشهرية
   ------------------------------------------------------------
   رئيس الاتحاد بيرفع كشف كل شهر ومعاه فواتيره، والسكان يفتحوه
   ويتطمّنوا. الملفات على السيرفر مش على الجهاز.

   ⚠️ أسماء الدوال هنا بتبدأ بـExpStmt: فيه emartna-statement.js
   (كشف حساب الوحدة) بيعرّف openStatement — والاسمين كانوا بيتصادموا
   فالضغط على "عرض الكشف" كان بينادي الدالة التانية ويطلّع
   "تعذّر فتح كشف الحساب".

   الصلاحيات بتتفحص في الخادم: إخفاء الأزرار مش حماية — أي محاولة
   إضافة أو حذف من غير صلاحية بتترفض على مستوى الصف.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const sb   = () => (window.CLOUD && window.CLOUD._sb) || null;
  const bUuid = () => { try{ return CLOUD._cache.buildingUuid[window.activeBuildingId] || null; }
                        catch(e){ return null; } };
  const can  = a => (window.guardActionSilent ? guardActionSilent('statements', a) : false);

  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const MAX = 10 * 1024 * 1024;          // ١٠ ميجا للملف الواحد
  const OK  = ['application/pdf','image/jpeg','image/png','image/webp',
               'application/vnd.ms-excel',
               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
               'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  const kb = n => !n ? '' : n < 1048576
    ? Math.round(n/1024) + ' ك.ب' : (n/1048576).toFixed(1) + ' م.ب';
  const icon = f => {
    const m = String(f.mime||'');
    if (m.includes('pdf')) return '📄';
    if (m.startsWith('image/')) return '🖼️';
    if (m.includes('sheet') || m.includes('excel')) return '📊';
    if (m.includes('word')) return '📝';
    return '📎';
  };

  let LIST = null, OPEN = null;

  /* ---------- تحميل ---------- */

  async function load(){
    const s = sb(), b = bUuid();
    if (!s || !b){ LIST = []; return; }
    const { data, error } = await s.from('expense_statements')
      .select('*, statement_files(*)')
      .eq('building_id', b)
      .order('year', { ascending:false })
      .order('month', { ascending:false });
    if (error) throw error;
    LIST = data || [];
  }

  /* ---------- الشاشة ---------- */

  window.pageStatements = function(){
    if (LIST === null){
      load().then(() => { if (window.renderContent) renderContent(); })
            .catch(e => { LIST = []; showMessage('تعذّر التحميل: ' + (e.message||'')); });
      return '<p class="small">⏳ بيحمّل الكشوف...</p>';
    }

    /* تجميع بالسنة */
    const byYear = {};
    LIST.forEach(x => (byYear[x.year] = byYear[x.year] || []).push(x));
    const years = Object.keys(byYear).sort((a,b) => b-a);

    return `
    <div class="card content-narrow">
      <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <h3>📑 كشوف المصروفات الشهرية</h3>
          <p class="small mtop">كشف كل شهر ومعاه الفواتير والإيصالات.</p>
        </div>
        ${can('add') ? `<button class="btn primary" onclick="openExpStmtModal()">
          + كشف جديد</button>` : ''}
      </div>
      ${(can('add') && window.D && D.building && D.building.residentsSeeStatements === false)
        ? `<div class="card mtop" style="background:var(--tint-warning)">
        <b class="small">🔒 الكشوف مقفولة عن السكان</b>
        <div class="small">مفيش ساكن هيشوف أي كشف — حتى المنشور.
          تقدر تفتحها من الإعدادات ← اللي السكان يشوفوه.</div></div>` : ''}
    </div>

    ${!LIST.length ? `<div class="card content-narrow mtop2" style="text-align:center;padding:30px">
      <div style="font-size:34px">📭</div>
      <p class="mtop">لسه مفيش كشوف مرفوعة.</p>
      ${can('add') ? `<button class="btn primary mtop" onclick="openExpStmtModal()">
        ارفع أول كشف</button>` : ''}
    </div>` :
    years.map(y => `
      <div class="card content-narrow mtop2">
        <h3>${esc2(y)}</h3>
        ${byYear[y].map(st => {
          const files = st.statement_files || [];
          return `<div class="flexrow mtop" style="justify-content:space-between;
            gap:8px;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid var(--line)">
            <div style="flex:1;min-width:0">
              <b>${esc2(MONTHS[st.month-1] || st.month)}</b>
              <span class="small" style="color:var(--muted)"> — ${esc2(st.title)}</span>
              <div class="small" style="color:var(--muted)">
                ${files.length} ملف${st.notes ? ' · ' + esc2(String(st.notes).slice(0,50)) : ''}</div>
            </div>
            <div class="flexrow" style="gap:6px">
              ${can('edit') ? `<button class="btn sm ${st.published?'ghost':'gold'}"
                onclick="toggleExpStmtPublish('${esc2(st.id)}')"
                title="${st.published?'منشور للسكان — اضغط للإخفاء':'مخفي — اضغط للنشر'}">
                ${st.published?'👁️ منشور':'🔒 مخفي'}</button>` : ''}
              <button class="btn sm" onclick="openExpStmt('${esc2(st.id)}')">عرض الكشف</button>
              ${can('delete') ? `<button class="btn sm red"
                onclick="deleteExpStmt('${esc2(st.id)}')">🗑</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`).join('')}`;
  };

  /* ---------- عرض كشف ---------- */

  window.openExpStmt = function(id){
    const st = (LIST||[]).find(x => x.id === id);
    if (!st) return;
    OPEN = st;
    const files = (st.statement_files || [])
      .sort((a,b) => (b.is_main?1:0) - (a.is_main?1:0));
    const main = files.filter(f => f.is_main);
    const att  = files.filter(f => !f.is_main);

    const row = f => `<div class="flexrow mtop" style="gap:9px;align-items:center;
      padding:8px;border:1px solid var(--line);border-radius:9px;cursor:pointer"
      onclick="openExpStmtFile('${esc2(f.path)}','${esc2(f.mime||'')}','${esc2(f.name)}')">
      <span style="font-size:19px">${icon(f)}</span>
      <span style="flex:1;min-width:0">
        <span style="display:block;white-space:nowrap;overflow:hidden;
          text-overflow:ellipsis">${esc2(f.name)}</span>
        <span class="small" style="color:var(--muted)">${kb(f.size)}</span></span>
      <span style="color:var(--muted)">↗</span></div>`;

    openModal(`
      <h3>📑 ${esc2(st.title)}</h3>
      <p class="small mtop">${esc2(MONTHS[st.month-1]||st.month)} ${esc2(st.year)}</p>
      ${st.notes ? `<div class="card mtop" style="background:var(--tint)">
        <p class="small">${esc2(st.notes)}</p></div>` : ''}

      ${main.length ? `<div class="mtop2"><b class="small">كشف المصروفات</b>
        ${main.map(row).join('')}</div>` : ''}

      ${att.length ? `<div class="mtop2"><b class="small">المرفقات (${att.length})</b>
        ${att.map(row).join('')}</div>` :
        (!main.length ? '<p class="small mtop2">مفيش ملفات مرفوعة.</p>' : '')}

      <div class="modal-actions">
        ${can('edit') ? `<button class="btn ghost"
          onclick="openExpStmtModal('${esc2(st.id)}')">✏️ تعديل</button>` : ''}
        <button class="btn primary" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  /* عرض الملف داخل البرنامج لو نوعه بيسمح */
  window.openExpStmtFile = async function(path, mime, name){
    const s = sb(); if (!s) return;
    let url = null;
    try{
      const { data, error } = await s.storage.from('attachments')
        .createSignedUrl(path, 3600);
      if (error) throw error;
      url = data.signedUrl;
    }catch(e){ return showMessage('تعذّر فتح الملف: ' + (e.message||'')); }

    const viewable = String(mime).includes('pdf') || String(mime).startsWith('image/');
    if (!viewable){
      /* Office مش بيتعرض في المتصفح — تنزيل مباشر أوضح من صفحة فاضية */
      window.open(url, '_blank');
      return;
    }
    openModal(`
      <div class="flexrow" style="justify-content:space-between;gap:8px">
        <b style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;
          text-overflow:ellipsis">${esc2(name)}</b>
        <a class="btn sm ghost" href="${url}" target="_blank" download>⬇️ تنزيل</a>
      </div>
      <div class="mtop" style="background:#f4f6f5;border-radius:10px;overflow:hidden">
        ${String(mime).startsWith('image/')
          ? `<img src="${url}" alt="${esc2(name)}"
               style="width:100%;display:block;max-height:72vh;object-fit:contain">`
          : `<iframe src="${url}" style="width:100%;height:72vh;border:0"></iframe>`}
      </div>
      <div class="modal-actions">
        <button class="btn primary" onclick="openExpStmt('${esc2(OPEN?OPEN.id:'')}')">رجوع</button>
      </div>`, true);
  };

  /* ---------- إضافة / تعديل ---------- */

  window.__stmtFiles = [];

  window.openExpStmtModal = function(id){
    const st = id ? (LIST||[]).find(x => x.id === id) : null;
    const now = new Date();
    window.__stmtFiles = [];
    const years = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) years.push(y);

    openModal(`
      <h3>${st ? '✏️ تعديل الكشف' : '➕ كشف مصروفات جديد'}</h3>
      <div class="grid g2 mtop">
        <div class="field2"><label>الشهر</label>
          <select id="stMonth">${MONTHS.map((m,i)=>`<option value="${i+1}"
            ${(st?st.month:now.getMonth()+1)===i+1?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="field2"><label>السنة</label>
          <select id="stYear">${years.map(y=>`<option ${
            (st?st.year:now.getFullYear())===y?'selected':''}>${y}</option>`).join('')}</select></div>
      </div>
      <div class="field2"><label>اسم الكشف</label>
        <input id="stTitle" value="${esc2(st?st.title:'')}"
          placeholder="مثال: كشف مصروفات أغسطس 2026"></div>
      <div class="field2"><label>ملاحظات (اختياري)</label>
        <textarea id="stNotes" rows="2">${esc2(st?(st.notes||''):'')}</textarea></div>

      <div class="field2 mtop"><label>كشف المصروفات (الملف الرئيسي)</label>
        <input type="file" id="stMain" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*"></div>
      <div class="field2"><label>مرفقات إضافية (فواتير وإيصالات)</label>
        <input type="file" id="stAtts" multiple accept=".pdf,.xlsx,.xls,.doc,.docx,image/*">
        <p class="hint">PDF · صور · إكسل · وورد — الملف لحد ١٠ ميجا.</p></div>

      <label class="checkline mtop2">
        <input type="checkbox" id="stPub" ${st ? (st.published?'checked':'') : 'checked'}>
        <span><b>منشور للسكان</b>
          <div class="small" style="color:var(--muted)">
            اقفله لو لسه بتراجعه، أو لو الكشف للإدارة بس.</div></span>
      </label>

      <div id="stProgress" class="small mtop" style="color:var(--muted)"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveExpStmt(${st?`'${esc2(st.id)}'`:'null'})">
          💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  async function uploadOne(file, bid, isMain){
    if (file.size > MAX) throw new Error(`«${file.name}» أكبر من ١٠ ميجا.`);
    if (OK.length && file.type && !OK.includes(file.type))
      throw new Error(`نوع «${file.name}» مش مدعوم.`);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0,8);
    const path = `stmt/${bid}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error } = await sb().storage.from('attachments')
      .upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (error) throw error;
    return { path, name:file.name, mime:file.type, size:file.size, is_main:!!isMain };
  }

  window.saveExpStmt = async function(id){
    const s = sb(), b = bUuid();
    if (!s || !b) return showMessage('مش متصل بالسحابة.');
    const title = (document.getElementById('stTitle').value || '').trim();
    if (!title) return showMessage('اكتب اسم الكشف');
    const year  = Number(document.getElementById('stYear').value);
    const month = Number(document.getElementById('stMonth').value);
    const notes = (document.getElementById('stNotes').value || '').trim();
    const prog  = document.getElementById('stProgress');

    const mainF = (document.getElementById('stMain').files||[])[0] || null;
    const atts  = [...((document.getElementById('stAtts').files)||[])];

    try{
      prog.textContent = '⏳ بنحفظ الكشف...';
      let stId = id;
      if (id){
        const { error } = await s.from('expense_statements')
          .update({ year, month, title, notes,
                    published: !!(document.getElementById('stPub')||{}).checked,
                    updated_at:new Date().toISOString() })
          .eq('id', id).select('id');
        if (error) throw error;
      } else {
        const { data, error } = await s.from('expense_statements')
          .insert({ building_id:b, year, month, title, notes,
                    published: !!(document.getElementById('stPub')||{}).checked,
                    created_by:(CLOUD_AUTH.user||{}).id })
          .select('id').single();
        if (error) throw error;
        stId = data.id;
      }

      const files = [];
      if (mainF){ prog.textContent = '⏳ بنرفع الكشف...'; files.push(await uploadOne(mainF, b, true)); }
      for (let i = 0; i < atts.length; i++){
        prog.textContent = `⏳ بنرفع المرفق ${i+1} من ${atts.length}...`;
        files.push(await uploadOne(atts[i], b, false));
      }
      if (files.length){
        const { error } = await s.from('statement_files').insert(
          files.map(f => Object.assign({ statement_id: stId,
            uploaded_by:(CLOUD_AUTH.user||{}).id }, f)));
        if (error) throw error;
      }

      LIST = null; closeModal();
      showMessage('اتحفظ الكشف' + (files.length ? ` مع ${files.length} ملف.` : '.'));
      if (window.renderContent) renderContent();
    }catch(e){
      prog.textContent = '';
      showMessage(e.message || 'تعذّر الحفظ');
    }
  };

  /* النشر: الكشف ممكن يتجهّز ويتراجع قبل ما السكان يشوفوه */
  window.toggleExpStmtPublish = async function(id){
    const st = (LIST||[]).find(x => x.id === id); if (!st) return;
    try{
      const { error } = await sb().from('expense_statements')
        .update({ published: !st.published }).eq('id', id).select('id');
      if (error) throw error;
      st.published = !st.published;
      if (window.toast) toast(st.published ? 'اتنشر للسكان' : 'اتخبّى عن السكان');
      if (window.renderContent) renderContent();
    }catch(e){ showMessage(e.message || 'تعذّر التغيير'); }
  };

  window.deleteExpStmt = function(id){
    const st = (LIST||[]).find(x => x.id === id); if (!st) return;
    confirmAction(`حذف «${st.title}»؟\n\nالملفات المرفوعة هتتشال معاه.`, async () => {
      try{
        const paths = (st.statement_files||[]).map(f => f.path);
        if (paths.length) await sb().storage.from('attachments').remove(paths);
        const { error } = await sb().from('expense_statements').delete().eq('id', id);
        if (error) throw error;
        LIST = null; toast('اتحذف');
        if (window.renderContent) renderContent();
      }catch(e){ showMessage(e.message || 'تعذّر الحذف'); }
    });
  };

  /* نعيد التحميل مع كل تبديل عمارة */
  document.addEventListener('emartna:building-complete', () => { LIST = null; });

  console.log('[عمارتنا] كشوف المصروفات جاهزة');
})();
