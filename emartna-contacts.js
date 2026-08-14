/* ============================================================
   عمارتنا — تحديث جوالات وإيميلات الملاك بالإكسل
   ------------------------------------------------------------
   رئيس الاتحاد بينزّل قالب إكسيل **معبّى ببيانات وحداته الحالية**،
   يعدّل أرقام الجوالات والإيميلات، ويرفعه تاني.
   البرنامج بيفحص كل سطر ويقوله:
     ✅ هيتحدّث   ⚪ من غير تغيير   ❌ خطأ + سببه + رقم السطر
   ============================================================ */

(function(){
  'use strict';

  const COLS = ['رمز الوحدة (لا تغيّره)','الوحدة','اسم المالك',
                'مفتاح الدولة','رقم الجوال','البريد الإلكتروني'];

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const unit = a => (window.unitLabel ? unitLabel(a) : ('وحدة ' + (a ? a.number : '')));

  const noXLSX = () => {
    if (typeof XLSX === 'undefined'){
      showMessage('تعذر تحميل مكتبة إكسيل — اتأكد من الإنترنت وحاول تاني.');
      return true;
    }
    return false;
  };

  /* ---------- ١) تنزيل القالب معبّى ---------- */

  window.downloadContactsTemplate = function(){
    if (noXLSX()) return;
    const rows = (D.apartments || [])
      .slice()
      .sort((a,b) => (Number(a.number)||0) - (Number(b.number)||0))
      .map(a => [ a.id, unit(a), a.ownerName || '',
                  a.phoneCountry || '+20', String(a.phone || ''), a.email || '' ]);

    const ws = XLSX.utils.aoa_to_sheet([COLS, ...rows]);
    ws['!cols'] = [{wch:14},{wch:14},{wch:22},{wch:12},{wch:16},{wch:26}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'بيانات التواصل');
    XLSX.writeFile(wb, 'بيانات تواصل الملاك - ' + (window.todayISO ? todayISO() : '') + '.xlsx');
  };

  /* ---------- ٢) النافذة ---------- */

  window.openContactsImport = function(){
    const n = (D.apartments || []).length;
    openModal(`
      <h3>📊 تحديث جوالات وإيميلات الملاك</h3>
      <p class="small mtop">
        ١) نزّل القالب — هيتحمّل <b>معبّى ببيانات الـ${n} وحدة</b> الموجودة عندك.<br>
        ٢) عدّل عمودَي <b>رقم الجوال</b> و<b>البريد الإلكتروني</b> بس.<br>
        ٣) ارفع الملف، وشوف المراجعة قبل ما تعتمد.
      </p>
      <p class="small" style="color:var(--red)">
        ⚠️ متغيّرش عمود "رمز الوحدة" ولا تمسح أي صف — هو اللي بيربط كل سطر بوحدته.
      </p>

      <button class="btn gold mtop" onclick="downloadContactsTemplate()">⬇️ تحميل القالب معبّى</button>

      <div class="field2 mtop2"><label>ارفع الملف بعد التعديل (.xlsx)</label>
        <input type="file" id="ctImportFile" accept=".xlsx,.xls,.csv" onchange="handleContactsUpload(this)"></div>

      <div id="ctPreview"></div>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  /* ---------- ٣) الفحص ---------- */

  function normPhone(raw, cc){
    let d = String(raw == null ? '' : raw).trim().replace(/[\s\-()]/g,'');
    if (!d) return '';
    // إكسيل بيحوّل الأرقام لأرقام فبيضيع الصفر الأول — بنرجّعه
    if (/^\d+$/.test(d) && d.length === 10 && (cc === '+20')) d = '0' + d;
    return d;
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function checkRow(r, i, seenPhones){
    const line = i + 2;                       // رقم السطر في إكسيل (بعد العناوين)
    const code = String(r[0] || '').trim();
    const cc   = String(r[3] || '+20').trim() || '+20';
    const phone= normPhone(r[4], cc);
    const email= String(r[5] || '').trim();

    // لو الرمز موجود لازم يطابق. لو الصف اتكتب بإيد من غير رمز، بنحاول
    // نلاقي الوحدة برقمها.
    const ap = code
      ? (D.apartments || []).find(a => a.id === code)
      : (D.apartments || []).find(a => String(a.number) === String(r[1] || '').replace(/\D/g,''));

    if (!ap) return { line, status:'error', label:String(r[1] || code || '—'),
      why: code ? 'مفيش وحدة بالرمز "' + code + '" — الرمز اتغيّر أو الوحدة اتحذفت'
                : 'مفيش رمز وحدة ولا رقم وحدة معروف في السطر ده' };

    const label = unit(ap);

    if (phone && !/^\d{7,15}$/.test(phone.replace(/^\+/,'')))
      return { line, ap, label, status:'error', why:'رقم الجوال فيه حروف أو رموز، أو طوله غير معقول' };

    if (phone){
      const key = cc + '|' + phone;
      if (seenPhones.has(key))
        return { line, ap, label, status:'error',
                 why:'الرقم ده متكرر في السطر ' + seenPhones.get(key) };
      seenPhones.set(key, line);
    }

    if (email && !EMAIL_RE.test(email))
      return { line, ap, label, status:'error', why:'صيغة البريد الإلكتروني غلط' };

    // خانتين فاضيتين = الصف ما اتلمسش، بنعدّيه من غير ما نمسح بيانات موجودة
    if (!phone && !email)
      return { line, ap, label, status:'same' };

    const same = String(ap.phone||'') === phone
              && String(ap.phoneCountry||'+20') === cc
              && String(ap.email||'') === email;

    return { line, ap, label, status: same ? 'same' : 'update',
             cc, phone, email,
             oldPhone: (ap.phoneCountry||'+20') + ' ' + (ap.phone||'—'),
             oldEmail: ap.email || '—' };
  }

  window.handleContactsUpload = function(input){
    const file = input.files[0];
    if (!file || noXLSX()) return;
    const reader = new FileReader();
    reader.onload = e => {
      const host = document.getElementById('ctPreview');
      try{
        const wb = XLSX.read(e.target.result, { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false });
        const body = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
        if (!body.length){
          host.innerHTML = '<p class="small mtop" style="color:var(--red)">الملف فاضي — مفيش صفوف بيانات.</p>';
          return;
        }
        const seen = new Map();
        const results = body.map((r,i) => checkRow(r, i, seen));
        window.__ctResults = results;
        renderPreview(results);
      }catch(err){
        host.innerHTML = `<p class="small mtop" style="color:var(--red)">تعذّرت قراءة الملف: ${esc2(err.message)}</p>`;
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /* ---------- ٤) المراجعة ---------- */

  function renderPreview(results){
    const upd  = results.filter(x => x.status === 'update');
    const same = results.filter(x => x.status === 'same');
    const bad  = results.filter(x => x.status === 'error');

    const badRows = bad.map(x => `
      <tr>
        <td class="small"><b>${x.line}</b></td>
        <td class="small">${esc2(x.label)}</td>
        <td class="small" style="color:var(--red)">${esc2(x.why)}</td>
      </tr>`).join('');

    const updRows = upd.slice(0,200).map(x => `
      <tr>
        <td class="small">${x.line}</td>
        <td class="small"><b>${esc2(x.label)}</b></td>
        <td class="small" style="color:var(--muted)">${esc2(x.oldPhone)}</td>
        <td class="small"><b>${esc2(x.cc + ' ' + (x.phone||'—'))}</b></td>
        <td class="small" style="color:var(--muted)">${esc2(x.oldEmail)}</td>
        <td class="small"><b>${esc2(x.email || '—')}</b></td>
      </tr>`).join('');

    document.getElementById('ctPreview').innerHTML = `
      <div class="grid g3 mtop2">
        <div class="card"><h3 style="color:var(--accent)">${upd.length}</h3><p class="small">هيتحدّثوا</p></div>
        <div class="card"><h3 style="color:var(--muted)">${same.length}</h3><p class="small">من غير تغيير</p></div>
        <div class="card"><h3 style="color:${bad.length?'var(--red)':'var(--muted)'}">${bad.length}</h3><p class="small">فيهم خطأ</p></div>
      </div>

      ${bad.length ? `
      <div class="card mtop2" style="border:1px solid var(--red)">
        <h3 style="color:var(--red)">❌ سطور فيها أخطاء — مش هتتحدّث</h3>
        <div class="table-wrap mtop" style="max-height:220px;overflow-y:auto">
          <table><thead><tr><th>السطر</th><th>الوحدة</th><th>الخطأ</th></tr></thead>
          <tbody>${badRows}</tbody></table></div>
        <p class="small mtop">صلّح السطور دي في الملف وارفعه تاني — الباقي تقدر تعتمده دلوقتي عادي.</p>
      </div>` : ''}

      ${upd.length ? `
      <div class="card mtop2">
        <h3>✅ التغييرات اللي هتتم</h3>
        <div class="table-wrap mtop" style="max-height:300px;overflow-y:auto">
          <table><thead><tr>
            <th>السطر</th><th>الوحدة</th><th>الجوال قبل</th><th>الجوال بعد</th>
            <th>الإيميل قبل</th><th>الإيميل بعد</th></tr></thead>
          <tbody>${updRows}</tbody></table></div>
        ${upd.length > 200 ? `<p class="small mtop">(معروض أول ٢٠٠ صف من ${upd.length})</p>` : ''}
      </div>` : '<p class="small mtop2">مفيش أي تغييرات في الملف ده.</p>'}

      <div class="flexrow mtop2">
        <button class="btn primary" ${upd.length?'':'disabled'} onclick="applyContactsImport()">
          💾 اعتمد تحديث ${upd.length} وحدة</button>
      </div>`;
  }

  /* ---------- ٥) التنفيذ ---------- */

  window.applyContactsImport = function(){
    const upd = (window.__ctResults || []).filter(x => x.status === 'update');
    if (!upd.length) return;

    let units = 0, users = 0;
    for (const x of upd){
      const a = x.ap;
      a.phoneCountry = x.cc;
      a.phone = x.phone;
      a.email = x.email;
      units++;
      const u = (D.users || []).find(y => y.apartmentId === a.id);
      if (u){ u.phoneCountry = x.cc; u.phone = x.phone; u.email = x.email; users++; }
    }

    try{ if (window.logActivity) logActivity('تحديث بيانات تواصل', `${units} وحدة من ملف إكسيل`); }catch(e){}
    save();

    const bad = (window.__ctResults || []).filter(x => x.status === 'error').length;
    closeModal();
    if (window.renderContent) renderContent();
    showMessage(
      `✅ تم تحديث ${units} وحدة` +
      (users ? ` (و${users} حساب مستخدم مربوط بيها)` : '') +
      (bad ? `\n\n⚠️ فيه ${bad} سطر ما اتحدّثش بسبب أخطاء — صلّحهم في الملف وارفعه تاني.` : ''));
  };

  console.log('[عمارتنا] تحديث بيانات التواصل بالإكسل جاهز');
})();
