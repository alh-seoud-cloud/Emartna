/* ============================================================
   عمارتنا — تحديث بالإكسل: الشقق والملاك · المستخدمون
   ------------------------------------------------------------
   لكل شاشة: تنزيل قالب معبّى بكل الأعمدة والبيانات الحالية،
   تعديل خارجي، ورفع بمراجعة كاملة قبل الاعتماد:
     ✅ هيتحدّث   ⚪ من غير تغيير   ❌ خطأ + سببه + رقم السطر
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const unit = a => (window.unitLabel ? unitLabel(a) : ('وحدة ' + (a ? a.number : '')));
  const YES  = ['نعم','yes','true','1','✓'];
  const isYes = v => YES.includes(String(v == null ? '' : v).trim().toLowerCase());

  const noXLSX = () => {
    if (typeof XLSX === 'undefined'){
      showMessage('تعذر تحميل مكتبة إكسيل — اتأكد من الإنترنت وحاول تاني.');
      return true;
    }
    return false;
  };

  function download(rows, cols, sheet, fileName, widths){
    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
    ws['!cols'] = (widths || cols.map(() => 16)).map(w => ({ wch:w }));
    // إكسيل بيفتح الشيت من الشمال افتراضيًا، فالأعمدة العربية بتبان مقلوبة
    // للعين. السطر ده بيخلي الورقة تفتح من اليمين زي القراءة العربية.
    ws['!views'] = [{ RTL: true }];
    ws['!freeze'] = { xSplit:'0', ySplit:'1' };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, fileName + ' - ' + (window.todayISO ? todayISO() : '') + '.xlsx');
  }

  /* بصمة مبسطة للعنوان — عشان نقارن رغم فروق المسافات */
  const norm = h => String(h == null ? '' : h).replace(/\s+/g,'').trim();

  function headerProblem(got, expected){
    const g = got.map(norm), e = expected.map(norm);
    if (g.length < e.length - 1)
      return `الملف ده فيه ${got.length} عمود، والقالب المطلوب فيه ${expected.length}.`;
    for (let i = 0; i < e.length; i++){
      if (g[i] !== e[i])
        return `ترتيب الأعمدة مختلف: العمود رقم ${i+1} المفروض يكون "${expected[i]}" ` +
               `ولقيت "${got[i] || '(فاضي)'}".`;
    }
    return null;
  }

  function readSheet(file, onRows, host, expectedCols){
    const reader = new FileReader();
    reader.onload = e => {
      try{
        const wb = XLSX.read(e.target.result, { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false });
        const body = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
        if (!body.length){
          host.innerHTML = '<p class="small mtop" style="color:var(--red)">الملف فاضي — مفيش صفوف بيانات.</p>';
          return;
        }
        if (expectedCols){
          const problem = headerProblem(rows[0] || [], expectedCols);
          if (problem){
            host.innerHTML = `
              <div class="card mtop2" style="border:1px solid var(--red)">
                <h3 style="color:var(--red)">❌ الملف ده مش القالب الصح</h3>
                <p class="small mtop">${esc2(problem)}</p>
                <p class="small">نزّل القالب من الزرار اللي فوق، عدّل عليه، وارفعه —
                من غير ما تغيّر أسماء الأعمدة ولا ترتيبها ولا تمسح أي عمود.</p>
                <p class="small" style="color:var(--muted)">الأعمدة المطلوبة بالترتيب:<br>
                ${expectedCols.map((c,i) => (i+1) + '. ' + esc2(c)).join(' · ')}</p>
              </div>`;
            return;
          }
        }
        onRows(body);
      }catch(err){
        host.innerHTML = `<p class="small mtop" style="color:var(--red)">تعذّرت قراءة الملف: ${esc2(err.message)}</p>`;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function normPhone(raw, cc){
    let d = String(raw == null ? '' : raw).trim().replace(/[\s\-()]/g,'');
    if (!d) return '';
    if (/^\d+$/.test(d) && d.length === 10 && cc === '+20') d = '0' + d;   // إكسيل بيبلع الصفر
    return d;
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ============================================================
     المراجعة المشتركة
     ============================================================ */

  function renderPreview(hostId, results, applyFn, columns){
    const upd  = results.filter(x => x.status === 'update');
    const same = results.filter(x => x.status === 'same');
    const bad  = results.filter(x => x.status === 'error');

    const changeRows = upd.slice(0,200).map(x => `
      <tr>
        <td class="small">${x.line}</td>
        <td class="small"><b>${esc2(x.label)}</b></td>
        <td class="small">${x.changes.map(c =>
          `${esc2(c.field)}: <span style="color:var(--muted)">${esc2(c.from || '—')}</span> ← <b>${esc2(c.to || '—')}</b>`
        ).join('<br>')}</td>
      </tr>`).join('');

    document.getElementById(hostId).innerHTML = `
      <div class="grid g3 mtop2">
        <div class="card"><h3 style="color:var(--accent)">${upd.length}</h3><p class="small">هيتحدّثوا</p></div>
        <div class="card"><h3 style="color:var(--muted)">${same.length}</h3><p class="small">من غير تغيير</p></div>
        <div class="card"><h3 style="color:${bad.length?'var(--red)':'var(--muted)'}">${bad.length}</h3><p class="small">فيهم خطأ</p></div>
      </div>

      ${bad.length ? `
      <div class="card mtop2" style="border:1px solid var(--red)">
        <h3 style="color:var(--red)">❌ سطور فيها أخطاء — مش هتتحدّث</h3>
        <div class="table-wrap mtop" style="max-height:220px;overflow:auto">
          <table><thead><tr><th>السطر</th><th>السجل</th><th>الخطأ</th></tr></thead>
          <tbody>${bad.map(x => `<tr><td class="small"><b>${x.line}</b></td>
            <td class="small">${esc2(x.label)}</td>
            <td class="small" style="color:var(--red)">${esc2(x.why)}</td></tr>`).join('')}</tbody>
        </table></div>
        <p class="small mtop">صلّح السطور دي في الملف وارفعه تاني — الباقي تقدر تعتمده دلوقتي.</p>
      </div>` : ''}

      ${upd.length ? `
      <div class="card mtop2">
        <h3>✅ التغييرات اللي هتتم</h3>
        <div class="table-wrap mtop" style="max-height:320px;overflow:auto">
          <table><thead><tr><th>السطر</th><th>السجل</th><th>التغييرات</th></tr></thead>
          <tbody>${changeRows}</tbody></table></div>
        ${upd.length > 200 ? `<p class="small mtop">(معروض أول ٢٠٠ من ${upd.length})</p>` : ''}
      </div>` : '<p class="small mtop2">مفيش أي تغييرات في الملف ده.</p>'}

      <div class="flexrow mtop2">
        <button class="btn primary" ${upd.length?'':'disabled'} onclick="${applyFn}()">
          💾 اعتمد تحديث ${upd.length} سجل</button>
      </div>`;
  }

  function finishMessage(kind, done, bad, extra){
    closeModal();
    if (window.renderContent) renderContent();
    showMessage(`✅ تم تحديث ${done} ${kind}` + (extra || '') +
      (bad ? `\n\n⚠️ فيه ${bad} سطر ما اتحدّثش بسبب أخطاء — صلّحهم في الملف وارفعه تاني.` : ''));
  }

  /* ============================================================
     ١) الشقق والملاك
     ============================================================ */

  const AP_COLS = ['رمز الوحدة (لا تغيّره)','رقم الوحدة','المبنى/الفيلا','النوع (شقة/محل)',
    'الاستخدام','الدور','اسم المالك','اسم المستأجر','مفتاح الدولة','رقم الجوال',
    'البريد الإلكتروني','الاشتراك الشهري','رصيد افتتاحي','مغلقة (نعم/لا)','ملاحظات',
    'الرصيد الحالي (للعرض فقط)'];

  window.downloadApUpdateTemplate = function(){
    if (noXLSX()) return;
    const rows = (D.apartments || []).slice()
      .sort((a,b) => (Number(a.number)||0) - (Number(b.number)||0))
      .map(a => [ a.id, a.number, a.blockName || '',
                  a.type === 'shop' ? 'محل' : 'شقة',
                  a.usageType || '', a.floor || '',
                  a.ownerName || '', a.tenantName || '',
                  a.phoneCountry || '+20', String(a.phone || ''), a.email || '',
                  Number(a.monthlyFee) || 0, Number(a.openingBalance) || 0,
                  a.closed ? 'نعم' : 'لا', a.notes || '',
                  (window.apBalance ? apBalance(a.id) : '') ]);
    download(rows, AP_COLS, 'الشقق والملاك', 'الشقق والملاك',
      [14,10,14,12,12,14,20,18,10,15,24,14,12,12,22,16]);
  };

  function checkApRow(r, i, seen){
    const line = i + 2;
    const code = String(r[0] || '').trim();
    const ap = code ? (D.apartments || []).find(a => a.id === code) : null;
    if (!ap) return { line, status:'error', label:String(r[1] || code || '—'),
      why: code ? 'مفيش وحدة بالرمز "' + code + '" — الرمز اتغيّر أو الوحدة اتحذفت'
                : 'عمود "رمز الوحدة" فاضي — مينفعش نعرف الوحدة' };

    const label = unit(ap);
    const num   = String(r[1] || '').trim();
    const type  = String(r[3] || '').trim();
    const cc    = String(r[8] || '+20').trim() || '+20';
    const phone = normPhone(r[9], cc);
    const email = String(r[10] || '').trim();
    const feeRaw= String(r[11] ?? '').trim();
    const openRaw=String(r[12] ?? '').trim();

    if (!num || !/^\d+$/.test(num))
      return { line, status:'error', label, why:'رقم الوحدة لازم يكون رقم' };
    if (seen.has(num))
      return { line, status:'error', label, why:'رقم الوحدة ده متكرر في السطر ' + seen.get(num) };
    seen.set(num, line);

    if (!String(r[6] || '').trim())
      return { line, status:'error', label, why:'اسم المالك مطلوب' };
    if (type && !['شقة','محل'].includes(type))
      return { line, status:'error', label, why:'النوع لازم يكون "شقة" أو "محل"' };
    if (phone && !/^\d{7,15}$/.test(phone))
      return { line, status:'error', label, why:'رقم الجوال فيه حروف أو طوله غير معقول' };
    if (email && !EMAIL_RE.test(email))
      return { line, status:'error', label, why:'صيغة البريد الإلكتروني غلط' };
    if (feeRaw !== '' && (isNaN(Number(feeRaw)) || Number(feeRaw) < 0))
      return { line, status:'error', label, why:'الاشتراك الشهري لازم يكون رقم موجب أو صفر' };
    if (openRaw !== '' && isNaN(Number(openRaw)))
      return { line, status:'error', label, why:'الرصيد الافتتاحي لازم يكون رقم' };

    const next = {
      number: Number(num),
      blockName: String(r[2] || '').trim(),
      type: type === 'محل' ? 'shop' : 'apartment',
      usageType: String(r[4] || '').trim(),
      floor: String(r[5] || '').trim(),
      ownerName: String(r[6] || '').trim(),
      tenantName: String(r[7] || '').trim(),
      phoneCountry: cc, phone, email,
      monthlyFee: feeRaw === '' ? Number(ap.monthlyFee) || 0 : Number(feeRaw),
      openingBalance: openRaw === '' ? Number(ap.openingBalance) || 0 : Number(openRaw),
      closed: isYes(r[13]),
      notes: String(r[14] || '').trim(),
    };

    const LBL = { number:'رقم الوحدة', blockName:'المبنى', type:'النوع', usageType:'الاستخدام',
      floor:'الدور', ownerName:'المالك', tenantName:'المستأجر', phoneCountry:'مفتاح الدولة',
      phone:'الجوال', email:'البريد', monthlyFee:'الاشتراك', openingBalance:'رصيد افتتاحي',
      closed:'مغلقة', notes:'ملاحظات' };

    const changes = [];
    Object.keys(next).forEach(k => {
      const before = k === 'closed' ? (ap[k] ? 'نعم' : 'لا') : String(ap[k] ?? '');
      const after  = k === 'closed' ? (next[k] ? 'نعم' : 'لا') : String(next[k] ?? '');
      if (before !== after) changes.push({ field: LBL[k], from: before, to: after });
    });

    return changes.length
      ? { line, ap, label, status:'update', next, changes }
      : { line, ap, label, status:'same' };
  }

  window.openApUpdateImport = function(){
    const n = (D.apartments || []).length;
    openModal(`
      <h3>📊 تحديث بيانات الشقق والملاك بالإكسل</h3>
      <p class="small mtop">
        ١) نزّل القالب — هيتحمّل <b>معبّى بكل بيانات الـ${n} وحدة</b>.<br>
        ٢) عدّل اللي عايزه: رقم الوحدة · النوع · الدور · المالك · المستأجر · الجوال ·
        البريد · الاشتراك · الرصيد الافتتاحي · مغلقة · ملاحظات.<br>
        ٣) ارفع الملف وراجع قبل الاعتماد.
      </p>
      <p class="small" style="color:var(--red)">
        ⚠️ متغيّرش عمود "رمز الوحدة" ولا تمسح صفوف. عمود "الرصيد الحالي" للعرض بس — بيتحسب من الحركات.
      </p>
      <button class="btn gold mtop" onclick="downloadApUpdateTemplate()">⬇️ تحميل القالب معبّى</button>
      <div class="field2 mtop2"><label>ارفع الملف بعد التعديل (.xlsx)</label>
        <input type="file" id="apImportFile" accept=".xlsx,.xls,.csv" onchange="handleApUpdateUpload(this)"></div>
      <div id="apImpPreview"></div>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  window.handleApUpdateUpload = function(input){
    const file = input.files[0];
    if (!file || noXLSX()) return;
    const host = document.getElementById('apImpPreview');
    readSheet(file, body => {
      const seen = new Map();
      const results = body.map((r,i) => checkApRow(r, i, seen));
      window.__apImp = results;
      renderPreview('apImpPreview', results, 'applyApUpdateImport');
    }, host, AP_COLS);
  };

  window.applyApUpdateImport = function(){
    const upd = (window.__apImp || []).filter(x => x.status === 'update');
    if (!upd.length) return;
    let n = 0;
    for (const x of upd){ Object.assign(x.ap, x.next); n++; }
    try{ if (window.logActivity) logActivity('تحديث الوحدات', n + ' وحدة من ملف إكسيل'); }catch(e){}
    save();
    finishMessage('وحدة', n, (window.__apImp || []).filter(x => x.status === 'error').length);
  };

  /* ============================================================
     ٢) المستخدمون
     ============================================================ */

  const ROLE_AR = { admin:'رئيس اتحاد', accountant:'محاسب', manager:'إداري',
                    owner:'صاحب شقة', tenant:'مستأجر' };
  const AR_ROLE = Object.fromEntries(Object.entries(ROLE_AR).map(([k,v]) => [v,k]));

  const US_COLS = ['معرّف المستخدم (لا تغيّره)','اسم الدخول','الاسم','الوحدة',
    'الصلاحية (رئيس اتحاد/محاسب/إداري/صاحب شقة/مستأجر)',
    'مفتاح الدولة','رقم الجوال','البريد الإلكتروني','نشط (نعم/لا)'];

  window.downloadUsersUpdateTemplate = function(){
    if (noXLSX()) return;
    const aps = D.apartments || [];
    const rows = (D.users || []).map(u => {
      const ap = aps.find(a => a.id === u.apartmentId);
      return [ u.id, u.username || '', u.name || '', ap ? unit(ap) : '(إدارة)',
               ROLE_AR[u.role] || u.role || '', u.phoneCountry || '+20',
               String(u.phone || ''), u.email || '',
               u.active === false ? 'لا' : 'نعم' ];
    });
    download(rows, US_COLS, 'المستخدمون', 'المستخدمون', [16,18,20,14,26,10,15,24,12]);
  };

  function checkUserRow(r, i, seen){
    const line = i + 2;
    const id = String(r[0] || '').trim();
    const u = id ? (D.users || []).find(x => x.id === id) : null;
    if (!u) return { line, status:'error', label:String(r[2] || id || '—'),
      why: id ? 'مفيش مستخدم بالمعرّف ده — اتحذف أو الرمز اتغيّر'
              : 'عمود "معرّف المستخدم" فاضي' };

    const label = (u.name || u.username || '—');
    const name  = String(r[2] || '').trim();
    const roleAr= String(r[4] || '').trim();
    const cc    = String(r[5] || '+20').trim() || '+20';
    const phone = normPhone(r[6], cc);
    const email = String(r[7] || '').trim();

    if (!name) return { line, status:'error', label, why:'اسم المستخدم مطلوب' };
    if (roleAr && !AR_ROLE[roleAr])
      return { line, status:'error', label,
               why:'الصلاحية لازم تكون: ' + Object.keys(AR_ROLE).join(' / ') };
    if (phone && !/^\d{7,15}$/.test(phone))
      return { line, status:'error', label, why:'رقم الجوال فيه حروف أو طوله غير معقول' };
    if (phone && seen.has(cc + phone))
      return { line, status:'error', label, why:'الرقم ده متكرر في السطر ' + seen.get(cc + phone) };
    if (phone) seen.set(cc + phone, line);
    if (email && !EMAIL_RE.test(email))
      return { line, status:'error', label, why:'صيغة البريد الإلكتروني غلط' };

    const role = roleAr ? AR_ROLE[roleAr] : u.role;
    const active = String(r[8] || '').trim() === '' ? (u.active !== false) : isYes(r[8]);

    // مانسمحش بإلغاء آخر رئيس اتحاد
    if (u.role === 'admin' && (role !== 'admin' || !active)){
      const admins = (D.users || []).filter(x => x.role === 'admin' && x.active !== false);
      if (admins.length <= 1)
        return { line, status:'error', label,
                 why:'ده آخر رئيس اتحاد — مينفعش تغيّر صلاحيته أو توقفه' };
    }

    const next = { name, role, phoneCountry:cc, phone, email, active };
    const LBL = { name:'الاسم', role:'الصلاحية', phoneCountry:'مفتاح الدولة',
                  phone:'الجوال', email:'البريد', active:'نشط' };
    const changes = [];
    Object.keys(next).forEach(k => {
      const before = k === 'active' ? (u.active === false ? 'لا' : 'نعم')
                   : k === 'role'   ? (ROLE_AR[u.role] || u.role || '')
                   : String(u[k] ?? '');
      const after  = k === 'active' ? (next[k] ? 'نعم' : 'لا')
                   : k === 'role'   ? (ROLE_AR[next.role] || next.role || '')
                   : String(next[k] ?? '');
      if (before !== after) changes.push({ field: LBL[k], from: before, to: after });
    });

    return changes.length
      ? { line, u, label, status:'update', next, changes }
      : { line, u, label, status:'same' };
  }

  window.openUsersUpdateImport = function(){
    const n = (D.users || []).length;
    openModal(`
      <h3>📊 تحديث بيانات المستخدمين بالإكسل</h3>
      <p class="small mtop">
        ١) نزّل القالب — <b>معبّى بالـ${n} مستخدم</b> الحاليين.<br>
        ٢) عدّل: الاسم · الصلاحية · الجوال · البريد · نشط.<br>
        ٣) ارفع وراجع قبل الاعتماد.
      </p>
      <p class="small" style="color:var(--red)">
        ⚠️ "معرّف المستخدم" و"اسم الدخول" و"الوحدة" للربط بس — متغيّرهمش.
      </p>
      <button class="btn gold mtop" onclick="downloadUsersUpdateTemplate()">⬇️ تحميل القالب معبّى</button>
      <div class="field2 mtop2"><label>ارفع الملف بعد التعديل (.xlsx)</label>
        <input type="file" id="usImportFile" accept=".xlsx,.xls,.csv" onchange="handleUsersUpdateUpload(this)"></div>
      <div id="usImpPreview"></div>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  window.handleUsersUpdateUpload = function(input){
    const file = input.files[0];
    if (!file || noXLSX()) return;
    const host = document.getElementById('usImpPreview');
    readSheet(file, body => {
      const seen = new Map();
      const results = body.map((r,i) => checkUserRow(r, i, seen));
      window.__usImp = results;
      renderPreview('usImpPreview', results, 'applyUsersUpdateImport');
    }, host, US_COLS);
  };

  window.applyUsersUpdateImport = function(){
    const upd = (window.__usImp || []).filter(x => x.status === 'update');
    if (!upd.length) return;
    let n = 0;
    for (const x of upd){
      Object.assign(x.u, x.next);
      // الصلاحيات بتتبع الدور الجديد
      if (window.CLOUD_ROLES && CLOUD_ROLES[x.next.role])
        x.u.permissions = CLOUD_ROLES[x.next.role].perms;
      // بيانات التواصل تتحدّث في الوحدة المرتبطة كمان
      const ap = (D.apartments || []).find(a => a.id === x.u.apartmentId);
      if (ap && x.next.phone){ ap.phoneCountry = x.next.phoneCountry; ap.phone = x.next.phone; }
      if (ap && x.next.email) ap.email = x.next.email;
      n++;
    }
    try{ if (window.logActivity) logActivity('تحديث المستخدمين', n + ' مستخدم من ملف إكسيل'); }catch(e){}
    save();
    finishMessage('مستخدم', n, (window.__usImp || []).filter(x => x.status === 'error').length);
  };

  /* ============================================================
     الأزرار في الشاشتين
     ============================================================ */

  /* قائمة إكسل واحدة تجمع كل العمليات بدل أزرار متفرقة */
  window.toggleExcelMenu = function(id){
    const m = document.getElementById(id);
    if (!m) return;
    const open = m.style.display === 'block';
    document.querySelectorAll('.excel-menu').forEach(x => x.style.display = 'none');
    m.style.display = open ? 'none' : 'block';
  };
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('.excel-wrap')) return;
    document.querySelectorAll('.excel-menu').forEach(x => x.style.display = 'none');
  });

  function excelMenu(id, items){
    return `<span class="excel-wrap" style="position:relative;display:inline-block">
      <button class="btn gold" onclick="toggleExcelMenu('${id}')">📊 إكسل ▾</button>
      <div id="${id}" class="excel-menu" style="display:none;position:absolute;z-index:60;
           top:calc(100% + 6px);inset-inline-end:0;min-width:280px;background:var(--panel);
           border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.14);
           padding:6px;text-align:start">
        ${items.map(it => `
          <button class="btn ghost" style="display:block;width:100%;text-align:start;border:0;
                  padding:9px 10px;margin:0" onclick="toggleExcelMenu('${id}');${it.fn}">
            <b>${it.icon} ${it.label}</b>
            <div class="small" style="color:var(--muted);font-weight:400">${it.hint}</div>
          </button>`).join('')}
      </div></span>`;
  }

  /* لفّ آمن: لو الشاشة اتعرّفت بعدينا (ترتيب تحميل الملفات)، اللفّة
     بتفضل شغالة — بنمسك أي إعادة تعريف بـsetter. */
  function wrapPage(name, transform){
    let raw = window[name];
    const wrapper = function(){
      const html = typeof raw === 'function' ? raw.apply(this, arguments) : '';
      return transform(html);
    };
    try{
      Object.defineProperty(window, name, {
        configurable: true,
        get(){ return wrapper; },
        set(v){ raw = v; },      // أي ملف يعيد تعريفها → بنخزنها كأصل
      });
    }catch(e){
      // بعض الدوال معرّفة في الصفحة نفسها ومينفعش نعيد تعريف خاصيتها،
      // فبنستبدلها مباشرة — ولو ملف تاني استبدلها بعدنا بنرجّع اللفّة.
      window[name] = wrapper;
      let tries = 0;
      const t = setInterval(() => {
        if (++tries > 20) return clearInterval(t);
        if (window[name] !== wrapper){ raw = window[name]; window[name] = wrapper; }
      }, 500);
    }
  }

  /* الشقق: القائمة بتتحط جنب أزرار الإضافة والاستيراد الموجودة */
  wrapPage('pageApartments', function(html){
    const importBtn = '<button class="btn ghost" onclick="openImportApartmentsModal()">📥 استيراد من إكسيل</button>';
    const menu = excelMenu('apExcelMenu', [
      { icon:'✏️', label:'تحديث بيانات موجودة', fn:'openApUpdateImport()',
        hint:'نزّل بياناتك معبّاة · عدّلها · ارفعها بمراجعة' },
      { icon:'➕', label:'إضافة وحدات جديدة',   fn:'openImportApartmentsModal()',
        hint:'نموذج فاضي لإضافة وحدات دفعة واحدة' },
      { icon:'⬇️', label:'تصدير الجدول الحالي', fn:"exportSortableTableToExcel('apTable')",
        hint:'بنفس الفلاتر والأعمدة الظاهرة قدامك' },
    ]);
    return html.includes(importBtn)
      ? html.replace(importBtn, menu)
      : `<div class="flexrow" style="margin-bottom:10px">${menu}</div>` + html;
  });

  /* المستخدمون */
  wrapPage('pageUsers', function(html){
    const menu = excelMenu('usExcelMenu', [
      { icon:'✏️', label:'تحديث بيانات المستخدمين', fn:'openUsersUpdateImport()',
        hint:'الأسماء · الصلاحيات · الجوالات · البريد' },
      { icon:'⬇️', label:'تصدير الجدول الحالي', fn:"exportSortableTableToExcel('usersTable')",
        hint:'بنفس الفلاتر والأعمدة الظاهرة قدامك' },
    ]);
    // بندوّر على زرار "مستخدم إداري" مهما كانت المسافات حواليه
    const m = html.match(/<button class="btn ghost" onclick="openUserModal\(\)">[^<]*<\/button>/);
    return m
      ? html.replace(m[0], m[0] + menu)
      : `<div class="flexrow" style="margin-bottom:10px">${menu}</div>` + html;
  });


  /* ============================================================
     تحسين شاشات الاستيراد القديمة (عمارات · فريق دعم · أرقام تسويق · وحدات)
     نفس الحماية: ورقة من اليمين + رفض أي ملف أعمدته مش مطابقة
     ============================================================ */

  const LEGACY = [
    { tpl:'downloadBuildingsTemplate',  cols:'BUILDINGS_IMPORT_COLUMNS',  sheet:'العمارات' },
    { tpl:'downloadStaffTemplate',      cols:'STAFF_IMPORT_COLUMNS',      sheet:'فريق الدعم' },
    { tpl:'downloadLeadsTemplate',      cols:'LEADS_IMPORT_COLUMNS',      sheet:'أرقام التسويق' },
    { tpl:'downloadApartmentsTemplate', cols:'APARTMENTS_IMPORT_COLUMNS', sheet:'الوحدات' },
  ];

  // الورقة تفتح من اليمين في كل قوالب البرنامج
  if (typeof XLSX !== 'undefined' && XLSX.utils && !XLSX.utils.__rtlPatched){
    const orig = XLSX.utils.aoa_to_sheet;
    XLSX.utils.aoa_to_sheet = function(){
      const ws = orig.apply(this, arguments);
      ws['!views'] = [{ RTL: true }];
      ws['!freeze'] = { xSplit:'0', ySplit:'1' };
      return ws;
    };
    XLSX.utils.__rtlPatched = true;
  }

  /* لفّ دوال التحقق القديمة: لو الرأس غلط، نوقف قبل أي قراءة */
  function guardLegacyImport(handlerName, getCols, label){
    const orig = window[handlerName];
    if (typeof orig !== 'function') return;
    window[handlerName] = function(input){
      const file = input && input.files && input.files[0];
      // الأعمدة معرّفة بـconst في الصفحة (مش على window) — بنجيبها بدالة
      let expected = null;
      try{ expected = getCols(); }catch(e){}
      if (!file || !expected || typeof XLSX === 'undefined') return orig.apply(this, arguments);
      const self = this, args = arguments;
      const r = new FileReader();
      r.onload = e => {
        try{
          const wb = XLSX.read(e.target.result, { type:'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false });
          const problem = headerProblem(rows[0] || [], expected);
          if (problem){
            input.value = '';
            return showMessage(
              `❌ الملف ده مش نموذج "${label}".\n\n${problem}\n\n` +
              'نزّل النموذج من الزرار اللي فوق واملأه من غير ما تغيّر أسماء الأعمدة ولا ترتيبها.');
          }
          orig.apply(self, args);
        }catch(err){
          showMessage('تعذّرت قراءة الملف: ' + err.message);
        }
      };
      r.readAsArrayBuffer(file);
    };
  }

  // بنلفّ الدوال اللي بتستقبل الملف في الشاشات القديمة
  [['handleBuildingsFileUpload',  () => BUILDINGS_IMPORT_COLUMNS,  'استيراد العمارات'],
   ['handleStaffFileUpload',      () => STAFF_IMPORT_COLUMNS,      'استيراد فريق الدعم'],
   ['handleLeadsFileUpload',      () => LEADS_IMPORT_COLUMNS,      'استيراد أرقام التسويق'],
   ['handleApartmentsFileUpload', () => APARTMENTS_IMPORT_COLUMNS, 'استيراد الوحدات'],
  ].forEach(([fn,gc,lb]) => guardLegacyImport(fn, gc, lb));

  console.log('[عمارتنا] تحديث الشقق والمستخدمين بالإكسل جاهز');
})();
