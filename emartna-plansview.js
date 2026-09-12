/* ============================================================
   عمارتنا — خطط الاشتراك: عرض جدول + تحديث بالإكسل
   ------------------------------------------------------------
   شاشة الخطط كانت كروت بس. الكروت كويسة للقراءة السريعة، لكن
   لما تبقى ٩ خطط وعايز تقارن الأسعار والحدود، الجدول أسرع بكتير.

   والتحديث بالإكسل: بدل ما تفتح كل خطة وتعدّل فيها، تنزّل ملف
   معبّى بخططك الحالية، تعدّل الأسعار، وترفعه — والبرنامج بيوريك
   إيه اللي هيتغيّر قبل ما يحفظ.
   ============================================================ */

(function(){
  'use strict';

  const VIEW_KEY = 'emartna_plans_view';
  const view = () => { try{ return localStorage.getItem(VIEW_KEY) || 'cards'; }
                       catch(e){ return 'cards'; } };
  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const num  = v => { const n = Number(String(v==null?'':v).replace(/[^\d.-]/g,'')); 
                      return isFinite(n) ? n : 0; };

  const COLS = ['مفتاح الخطة','اسم الخطة','السعر قبل الخصم','نسبة الخصم %',
                'مدة الاشتراك بالشهور','حد الشقق','حد المساعدين','مفعّلة'];

  window.setPlansView = function(v){
    try{ localStorage.setItem(VIEW_KEY, v); }catch(e){}
    if (window.renderSysContent) renderSysContent();
  };

  /* ---------- الجدول ---------- */

  function plansTable(){
    const plans = ensurePlans();
    const used  = k => REG.buildings.filter(b => ensureLicense(b).plan === k).length;
    return `<div class="table-wrap mtop">
      <table><thead><tr>
        <th>الخطة</th><th>قبل الخصم</th><th>الخصم</th><th>بعد الخصم</th>
        <th>المدة</th><th>حد الشقق</th><th>المساعدين</th>
        <th>العملاء</th><th>الحالة</th><th></th>
      </tr></thead><tbody>
      ${plans.map(p => {
        const after = planPriceAfter(p);
        const n = used(p.key);
        return `<tr style="${p.active===false?'opacity:.6':''}">
          <td><b>${esc2(p.icon||'')} ${esc2(p.name)}</b>
            ${p.isTrial?'<span class="badge g">تجريبية</span>':''}</td>
          <td>${p.priceBefore ? money(p.priceBefore) : '—'}</td>
          <td>${p.discountPercent ? p.discountPercent + '%' : '—'}</td>
          <td><b>${after ? money(after) : 'مجانية'}</b></td>
          <td>${p.durationMonths ? p.durationMonths + ' شهر' : 'بلا انتهاء'}</td>
          <td>${p.maxApartments || 'غير محدود'}</td>
          <td>${p.maxStaff == null ? 'بلا حد' : p.maxStaff}</td>
          <td>${n ? `<b>${n}</b>` : '<span style="color:var(--muted)">0</span>'}</td>
          <td>${p.active===false?'<span class="badge r">معطلة</span>'
                                :'<span class="badge g">مفعّلة</span>'}</td>
          <td><div class="flexrow" style="gap:4px">
            <button class="btn sm ghost" onclick="openPlanModal('${esc2(p.key)}')">تعديل</button>
            <button class="btn sm ${p.active===false?'':'gold'}"
              onclick="togglePlanActive('${esc2(p.key)}')">
              ${p.active===false?'تفعيل':'تعطيل'}</button>
          </div></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;
  }

  /* ---------- شريط الأدوات ---------- */

  function toolbar(){
    const v = view();
    const btn = (k,label,icon) => `<button class="btn sm ${v===k?'':'ghost'}"
      onclick="setPlansView('${k}')">${icon} ${label}</button>`;
    return `<div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
      ${btn('cards','كروت','🗂️')}
      ${btn('table','جدول','📋')}
      <div class="spacer"></div>
      <button class="btn sm ghost" onclick="exportPlansXlsx()">📊 تصدير إكسل</button>
      <button class="btn sm ghost" onclick="openPlansImport()">📥 تحديث بالإكسل</button>
      <button class="btn primary" onclick="openPlanModal()">+ خطة جديدة</button>
    </div>`;
  }

  /* ---------- تصدير ---------- */

  window.exportPlansXlsx = function(){
    if (typeof XLSX === 'undefined')
      return showMessage('تعذر تحميل مكتبة إكسيل — اتأكد من الإنترنت وحاول تاني.');
    const rows = ensurePlans().map(p => [
      p.key, p.name, p.priceBefore || 0, p.discountPercent || 0,
      p.durationMonths || 0, p.maxApartments || 0,
      p.maxStaff == null ? '' : p.maxStaff,
      p.active === false ? 'لا' : 'نعم',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([COLS, ...rows]);
    ws['!cols'] = [18,26,16,14,20,14,14,10].map(w => ({ wch:w }));
    ws['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الخطط');
    XLSX.writeFile(wb, 'خطط الاشتراك - ' + (window.todayISO?todayISO():'') + '.xlsx');
  };

  /* ---------- استيراد ---------- */

  window.openPlansImport = function(){
    openModal(`
      <h3>📥 تحديث الخطط بالإكسل</h3>
      <p class="small mtop">نزّل الملف المعبّى بخططك الحالية، عدّل الأسعار
        والحدود، وارفعه تاني. <b>مفتاح الخطة هو اللي بنطابق بيه</b> —
        ما تغيّروش، وأي مفتاح جديد هيتعمل كخطة جديدة.</p>

      <button class="btn mtop" onclick="exportPlansXlsx()">⬇️ نزّل الملف الحالي</button>

      <div class="field2 mtop2"><label>ارفع الملف بعد التعديل</label>
        <input type="file" id="plImportFile" accept=".xlsx,.xls,.csv"
          onchange="handlePlansUpload(this)"></div>

      <div id="plPreview" class="mtop"></div>
      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  let PENDING = null;

  window.handlePlansUpload = function(input){
    const f = input.files && input.files[0];
    if (!f) return;
    if (typeof XLSX === 'undefined')
      return showMessage('تعذر تحميل مكتبة إكسيل.');
    const rd = new FileReader();
    rd.onload = e => {
      try{
        const wb = XLSX.read(e.target.result, { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        previewPlans(aoa);
      }catch(err){ showMessage('تعذر قراءة الملف: ' + (err.message||'')); }
    };
    rd.readAsArrayBuffer(f);
  };

  function previewPlans(aoa){
    const box = document.getElementById('plPreview');
    if (!aoa || aoa.length < 2)
      return box.innerHTML = '<p class="small" style="color:var(--red)">الملف فاضي.</p>';

    const head = (aoa[0]||[]).map(h => String(h||'').replace(/\s+/g,''));
    if (head[0] !== 'مفتاحالخطة')
      return box.innerHTML = `<p class="small" style="color:var(--red)">
        العمود الأول لازم يكون "مفتاح الخطة". نزّل الملف من هنا وعدّل عليه.</p>`;

    const plans = ensurePlans();
    const rows = [], errs = [];
    aoa.slice(1).forEach((r, i) => {
      const key = String(r[0]||'').trim();
      if (!key) return;
      const name = String(r[1]||'').trim();
      if (!name){ errs.push(`سطر ${i+2}: الاسم فاضي`); return; }
      const before = num(r[2]), disc = num(r[3]);
      if (disc < 0 || disc > 100){ errs.push(`سطر ${i+2}: نسبة الخصم لازم بين 0 و100`); return; }
      const cur = plans.find(p => p.key === key);
      rows.push({
        key, name, priceBefore: before, discountPercent: disc,
        durationMonths: num(r[4]), maxApartments: num(r[5]),
        maxStaff: String(r[6]||'').trim()==='' ? null : num(r[6]),
        active: !['لا','no','false','0'].includes(String(r[7]||'').trim().toLowerCase()),
        __new: !cur,
        __changed: cur ? (cur.name!==name || (cur.priceBefore||0)!==before
          || (cur.discountPercent||0)!==disc) : false,
      });
    });

    PENDING = rows;
    const chg = rows.filter(r => r.__new || r.__changed);
    box.innerHTML = `
      ${errs.length?`<div class="card" style="background:var(--tint-warning)">
        <b class="small">⚠️ أسطر اتخطّت:</b>
        ${errs.map(e=>`<div class="small">${esc2(e)}</div>`).join('')}</div>`:''}
      <p class="small mtop"><b>${rows.length}</b> خطة في الملف —
        <b>${chg.length}</b> هتتغيّر، ${rows.length-chg.length} زي ما هي.</p>
      ${!chg.length?'':`<div class="table-wrap mtop" style="max-height:40vh;overflow:auto">
        <table><thead><tr><th>الخطة</th><th>قبل الخصم</th><th>الخصم</th>
          <th>بعد الخصم</th><th>الحالة</th></tr></thead><tbody>
        ${chg.map(r=>`<tr>
          <td>${esc2(r.name)} ${r.__new?'<span class="badge g">جديدة</span>':''}</td>
          <td>${money(r.priceBefore)}</td><td>${r.discountPercent}%</td>
          <td><b>${money(Math.round(r.priceBefore*(1-r.discountPercent/100)))}</b></td>
          <td>${r.active?'مفعّلة':'معطلة'}</td></tr>`).join('')}
        </tbody></table></div>
        <button class="btn primary mtop" onclick="applyPlansImport()">
          💾 طبّق التغييرات (${chg.length})</button>`}`;
  }

  window.applyPlansImport = function(){
    if (!PENDING) return;
    const plans = ensurePlans();
    let upd = 0, added = 0;
    PENDING.forEach(r => {
      const p = plans.find(x => x.key === r.key);
      const data = {
        name:r.name, priceBefore:r.priceBefore, discountPercent:r.discountPercent,
        durationMonths:r.durationMonths, maxApartments:r.maxApartments,
        maxStaff:r.maxStaff, active:r.active,
      };
      if (p){ Object.assign(p, data); upd++; }
      else { plans.push(Object.assign({ key:r.key, icon:'💳', isTrial:false }, data)); added++; }
    });
    saveRegistry();
    closeModal();
    showMessage(`اتحدّثت ${upd} خطة${added?` واتضافت ${added} جديدة`:''}.`);
    if (window.renderSysContent) renderSysContent();
  };

  window.togglePlanActive = function(key){
    const p = ensurePlans().find(x => x.key === key);
    if (!p) return;
    p.active = p.active === false;
    saveRegistry();
    if (window.renderSysContent) renderSysContent();
  };

  /* ---------- نغلّف الشاشة ---------- */

  const orig = window.pageSysPlans;
  if (typeof orig === 'function' && !orig.__plansView){
    const wrapped = function(){
      const head = `<p class="small">إدارة خطط الاشتراك المعروضة على كل العملاء.</p>
        ${toolbar()}`;
      if (view() === 'table') return head + plansTable();
      /* الكروت: بنشيل سطر الوصف وزرار الإضافة القديمين عشان
         ما يتكرروش مع شريط الأدوات الجديد */
      const html = orig.apply(this, arguments);
      return head + html
        .replace(/<p class="small">إدارة خطط الاشتراك[\s\S]*?<\/p>/, '')
        .replace(/<div class="flexrow mtop"><div class="spacer"><\/div>[\s\S]*?<\/div>/, '');
    };
    wrapped.__plansView = true;
    window.pageSysPlans = wrapped;
  }

  console.log('[عمارتنا] عرض الخطط والإكسل جاهز');
})();
