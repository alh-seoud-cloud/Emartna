/* عمارتنا — الحزمة الموحّدة (مولّدة آليًا) — ما تعدّلش هنا */

/* ═══ emartna-contacts.js ═══ */
(function(){
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

})();

/* ═══ emartna-uiprefs.js ═══ */
(function(){
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

  /* ===== وضع مصغّر: أيقونات بس =====
     بين "عادية" و"مخفية" تمامًا — بيدي مساحة للمحتوى والتنقل
     يفضل متاح بضغطة. */
  const MINI_KEY = 'emartna_nav_mini';
  const navMini = () => { try{ return localStorage.getItem(MINI_KEY) === '1'; }
                          catch(e){ return false; } };
  window.toggleNavMini = function(){
    const on = !navMini();
    try{ localStorage.setItem(MINI_KEY, on ? '1' : '0'); }catch(e){}
    if (on) try{ localStorage.setItem(NAV_HIDE,'0'); }catch(e){}
    applyNav(); injectNavButtons(true);
    if (window.toast) toast(on ? 'قائمة مصغّرة' : 'قائمة عادية');
  };

  /* دورة: عادية ← مصغّرة ← مخفية ← عادية */
  window.cycleNav = function(){
    if (navHidden()){
      try{ localStorage.setItem(NAV_HIDE,'0'); localStorage.setItem(MINI_KEY,'0'); }catch(e){}
    } else if (navMini()){
      try{ localStorage.setItem(NAV_HIDE,'1'); localStorage.setItem(MINI_KEY,'0'); }catch(e){}
    } else {
      try{ localStorage.setItem(MINI_KEY,'1'); }catch(e){}
    }
    applyNav(); injectNavButtons(true);
  };

  function miniStyles(){
    if (document.getElementById('navMiniStyles')) return;
    const st = document.createElement('style');
    st.id = 'navMiniStyles';
    st.textContent = `
      @media (min-width:861px){
        body.nav-mini .sidebar{width:62px !important;overflow:visible}

        /* ⚠️ البنود اسمها nav-subitem مش nav-btn، والعنوان ملفوف
           في span.ghl — المحددات القديمة ماغطّتش الاتنين فالنصوص
           فضلت ظاهرة مقطوعة. */
        body.nav-mini .sidebar .nav-subitem > span:not(.ic),
        body.nav-mini .sidebar .nav-btn > span:not(.ic),
        body.nav-mini .sidebar .ghl > span:not(.ic),
        body.nav-mini .sidebar .nav-sec,
        body.nav-mini .sidebar .brand h1,
        body.nav-mini .sidebar .brand p,
        body.nav-mini .sidebar-foot b,
        body.nav-mini .sidebar-foot > button,
        body.nav-mini .sidebar-foot > div,
        body.nav-mini .nav-group-arrow,
        body.nav-mini #fontBar{display:none !important}

        /* الأيقونة في النص */
        body.nav-mini .sidebar .nav-subitem,
        body.nav-mini .sidebar .nav-btn,
        body.nav-mini .sidebar .nav-group-header,
        body.nav-mini .sidebar .ghl{
          justify-content:center !important;
          padding-inline:0 !important; gap:0 !important}
        body.nav-mini .sidebar .nav-subitem{margin:2px 6px !important;
          width:calc(100% - 12px) !important}
        body.nav-mini .sidebar .nav-group{margin:2px 4px !important}
        body.nav-mini .sidebar .brand{justify-content:center;padding:12px 0 !important}
        body.nav-mini .sidebar .brand .mark{margin:0 auto}

        /* الشارة تبقى نقطة صغيرة فوق الأيقونة */
        body.nav-mini .sidebar .nav-subitem .badge,
        body.nav-mini .sidebar .nav-subitem > s{
          position:absolute;top:3px;inset-inline-end:6px;
          min-width:8px;height:8px;padding:0;font-size:0;border-radius:99px}

        /* اسم البند يظهر عند الوقوف */
        body.nav-mini .sidebar .nav-subitem,
        body.nav-mini .sidebar .nav-group-header{position:relative}
        body.nav-mini .sidebar .nav-subitem:hover::after,
        body.nav-mini .sidebar .nav-group-header:hover::after{
          content:attr(data-label);position:absolute;
          inset-inline-end:62px;top:50%;transform:translateY(-50%);
          background:var(--panel);color:var(--text);
          border:1px solid var(--line);border-radius:8px;padding:5px 11px;
          font-size:12.5px;white-space:nowrap;z-index:900;
          box-shadow:0 4px 14px rgba(0,0,0,.16)}
      }`;
    document.head.appendChild(st);
  }

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
    const mini = navMini() && !hid;
    document.body.classList.toggle('nav-mini', mini);
    document.body.classList.toggle('nav-compact', !hid && !mini && w <= 200);
    document.body.classList.toggle('nav-hidden', hid);
    if (mini) st.textContent = `@media (min-width:861px){
      .sidebar{width:62px !important} #navGrip{inset-inline-end:62px}}`;
    miniStyles();
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

      ${window.checkBadge ? `<div class="card mtop2">
        <b class="small">🔔 شارة الإشعارات على أيقونة التطبيق</b>
        <p class="small" style="color:var(--muted)">
          الرقم بيظهر على أيقونة التطبيق المثبّت — أندرويد وويندوز وماك.
          مش بتشتغل في المتصفح العادي ولا على الآيفون.</p>
        <button class="btn sm mtop" onclick="checkBadge()">افحص الشارة</button>
      </div>` : ''}

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

  /* زرار طيّ القائمة في الشريط العلوي — أوضح من حافة السحب */
  function installNavToggleBtn(){
    if (window.innerWidth < 861) return;
    const bar = document.querySelector('.top .flexrow') || document.querySelector('.top');
    if (!bar || document.getElementById('navCycle')) return;
    const b = document.createElement('button');
    b.id = 'navCycle';
    b.className = 'btn ghost sm';
    b.title = 'طيّ القائمة (عادية · مصغّرة · مخفية)';
    b.style.cssText = 'flex:0 0 auto;padding:4px 9px;font-size:15px';
    b.onclick = () => { cycleNav(); paintCycleIcon(); };
    bar.insertBefore(b, bar.firstChild);
    paintCycleIcon();
  }
  function paintCycleIcon(){
    const b = document.getElementById('navCycle'); if (!b) return;
    b.textContent = navHidden() ? '▶' : navMini() ? '▮' : '◀';
  }
  setInterval(() => { try{ installNavToggleBtn(); paintCycleIcon(); }catch(e){} }, 1200);

  styles(); miniStyles();
  applyFont(); applyNav(); injectNavButtons(true);
  document.addEventListener('emartna:building-complete', () => {
    styles(); applyFont(); applyNav(); injectNavButtons(true);
  });

  console.log('[عمارتنا] تفضيلات العرض جاهزة');
})();

})();

/* ═══ emartna-chatatt.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — مرفقات الشات (صورة أو PDF)
   ------------------------------------------------------------
   المساحة هي القيد الأساسي: صورة موبايل حديثة ٤-٨ ميجا، وعمارة
   فيها ١٠٠ ساكن ممكن تبعت ٥٠ صورة في الشهر = ٤٠٠ ميجا سنويًا
   للعمارة الواحدة.

   فبنضغط الصورة في المتصفح قبل الرفع: أقصى بُعد ١٦٠٠ بكسل وجودة
   ٧٢٪ بصيغة WebP. النتيجة عادةً ١٥٠-٤٠٠ كيلو — أقل ٩٠٪ من الأصل
   ومن غير فرق ملحوظ في الوضوح لصور الإيصالات والأعطال.

   الـPDF بيترفع زي ما هو (مش بينضغط) بحد ٣ ميجا.
   ============================================================ */

(function(){
  'use strict';

  const MAX_DIM      = 1600;
  const IMG_QUALITY  = 0.72;
  const MAX_PDF      = 3 * 1024 * 1024;
  const MAX_ANY      = 5 * 1024 * 1024;
  const OK_TYPES     = ['image/jpeg','image/png','image/webp','image/heic',
                        'image/heif','application/pdf'];

  const sb    = () => (window.CLOUD && window.CLOUD._sb) || null;
  const esc2  = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const bUuid = () => { try{ return CLOUD._cache.buildingUuid[window.activeBuildingId] || null; }
                        catch(e){ return null; } };
  const kb = n => n < 1024*1024
    ? Math.round(n/1024) + ' ك.ب'
    : (n/1024/1024).toFixed(1) + ' م.ب';

  /* ---------- ضغط الصورة ---------- */

  async function shrink(file){
    if (file.type === 'application/pdf') return { blob:file, kind:'pdf' };

    const url = URL.createObjectURL(file);
    try{
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('الصورة مش مقروءة'));
        i.src = url;
      });

      let { width:w, height:h } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      /* WebP أصغر من JPEG بنحو ٢٥٪ لنفس الجودة، ومدعوم في كل
         المتصفحات الحديثة. لو فشل بنرجع لـJPEG. */
      const blob = await new Promise(res => {
        c.toBlob(b => b ? res(b) : c.toBlob(res, 'image/jpeg', IMG_QUALITY),
                 'image/webp', IMG_QUALITY);
      });
      if (!blob) throw new Error('تعذّر ضغط الصورة');
      return { blob, kind:'image' };
    } finally { URL.revokeObjectURL(url); }
  }

  /* ---------- الرفع ---------- */

  async function upload(file){
    const s = sb(), b = bUuid();
    if (!s || !b) throw new Error('مش متصل بالسحابة.');

    if (!OK_TYPES.includes(file.type))
      throw new Error('النوع ده مش مسموح. الصور وملفات PDF بس.');
    if (file.size > MAX_ANY)
      throw new Error('الملف أكبر من ٥ ميجا. صغّره وجرّب تاني.');
    if (file.type === 'application/pdf' && file.size > MAX_PDF)
      throw new Error('ملف الـPDF أكبر من ٣ ميجا.');

    const { blob, kind } = await shrink(file);
    const ext  = kind === 'pdf' ? 'pdf' : (blob.type === 'image/webp' ? 'webp' : 'jpg');
    const path = `chat/${b}/${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;

    const { error } = await s.storage.from('attachments')
      .upload(path, blob, { contentType: blob.type, upsert:false });
    if (error){
      /* رفض بسبب الحصة بيرجع كخطأ سياسة — بنترجمه لرسالة مفهومة */
      const msg = String(error.message||'');
      if (/policy|row-level|violates/i.test(msg)){
        const q = await loadQuota();
        throw new Error(
          'المساحة خلصت' + (q ? ` (${q.quota_mb} ميجا)` : '') + '.\n\n' +
          'فرّغ مساحة بأرشفة المرفقات القديمة:\n' +
          'الإعدادات ← مساحة المرفقات ← أرشفة المرفقات القديمة.\n\n' +
          'السجلات بتفضل مكانها — الملفات القديمة بس هي اللي بتتشال.');
      }
      throw error;
    }

    return { path, kind, name:file.name, size:blob.size, saved:file.size - blob.size };
  }

  /* رابط مؤقت — الدلو خاص، فمفيش رابط دائم */
  const urlCache = {};
  window.attUrl = async function(path){
    if (urlCache[path] && urlCache[path].exp > Date.now()) return urlCache[path].u;
    try{
      const { data, error } = await sb().storage.from('attachments')
        .createSignedUrl(path, 3600);
      if (error) throw error;
      urlCache[path] = { u:data.signedUrl, exp: Date.now() + 3000000 };
      return data.signedUrl;
    }catch(e){ return null; }
  };

  /* ---------- اختيار الملف ---------- */

  window.__chatAtt = null;

  window.pickChatAttachment = function(target){
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,application/pdf';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const bar = document.getElementById('attBar');
      if (bar) bar.innerHTML =
        '<span class="small">⏳ بنجهّز الملف...</span>';
      try{
        const a = await upload(f);
        window.__chatAtt = Object.assign(a, { target });
        paintBar();
        if (a.kind === 'image' && a.saved > 50000 && window.toast)
          toast('اتضغطت الصورة: ' + kb(a.size) + ' بدل ' + kb(a.size + a.saved));
      }catch(e){
        window.__chatAtt = null; paintBar();
        showMessage(e.message || 'تعذّر رفع الملف');
      }
    };
    inp.click();
  };

  window.clearChatAttachment = function(){
    const a = window.__chatAtt;
    if (a && a.path){
      try{ sb().storage.from('attachments').remove([a.path]); }catch(e){}
    }
    window.__chatAtt = null; paintBar();
  };

  function paintBar(){
    const bar = document.getElementById('attBar');
    if (!bar) return;
    const a = window.__chatAtt;
    if (!a){ bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = `
      <span style="font-size:17px">${a.kind === 'pdf' ? '📄' : '🖼️'}</span>
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:12.5px;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis">${esc2(a.name)}</span>
        <span class="small" style="color:var(--muted)">${kb(a.size)}</span>
      </span>
      <button class="btn sm ghost" onclick="clearChatAttachment()">✕</button>`;
  }
  window.paintAttBar = paintBar;

  /* ---------- العرض داخل الرسالة ---------- */

  window.attachmentHTML = function(m){
    if (!m || !m.attPath && !m.att_path) return '';
    const path = m.attPath || m.att_path;
    const kind = m.attKind || m.att_kind || 'image';
    const name = m.attName || m.att_name || 'مرفق';
    const id   = 'att_' + Math.random().toString(36).slice(2,9);

    /* الرابط موقّع ومؤقت، فبنجيبه بعد الرسم */
    setTimeout(async () => {
      const url = await attUrl(path);
      const el = document.getElementById(id);
      if (!el || !url) return;
      el.innerHTML = kind === 'pdf'
        ? `<a href="${url}" target="_blank" class="btn sm ghost"
             style="display:inline-flex;gap:6px;align-items:center">
             📄 ${esc2(name)}</a>`
        : `<a href="${url}" target="_blank">
             <img src="${url}" alt="${esc2(name)}" loading="lazy"
               style="max-width:220px;max-height:220px;border-radius:9px;
                 display:block;object-fit:cover"></a>`;
    }, 30);

    return `<div id="${id}" class="mtop" style="min-height:26px">
      <span class="small" style="color:var(--muted)">⏳ بيحمّل المرفق...</span></div>`;
  };

  /* ---------- عدّاد المساحة ---------- */

  let QUOTA = null;

  async function loadQuota(){
    try{
      const s = sb(), b = bUuid(); if (!s || !b) return null;
      const { data, error } = await s.rpc('building_storage', { p_building:b });
      if (error || !data || !data[0]) return null;
      QUOTA = data[0];
      return QUOTA;
    }catch(e){ return null; }
  }

  /* تنبيه مرة واحدة في الجلسة عند ٨٠٪ — التنبيه مش منع */
  async function warnIfNear(){
    const q = await loadQuota();
    if (!q || !window.getSession || !getSession()) return;
    const u = window.currentUser && currentUser();
    if (!u || !window.isStaffRole || !isStaffRole(u.role)) return;   // للإدارة بس
    const pct = Number(q.pct) || 0;
    if (pct < 80) return;
    const key = 'emartna_quota_warned_' + (window.activeBuildingId||'') +
                '_' + Math.floor(pct / 10);
    try{ if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key,'1'); }catch(e){}
    if (window.showMessage) showMessage(
      (pct >= 100 ? '⚠️ مساحة المرفقات خلصت' : '⚠️ مساحة المرفقات قربت تخلص') +
      `\n\nاستهلكت ${pct}% من ${q.quota_mb} ميجا (${q.files} ملف).\n\n` +
      'فرّغ مساحة بأرشفة المرفقات القديمة:\n' +
      'الإعدادات ← مساحة المرفقات ← أرشفة المرفقات القديمة.\n\n' +
      'السجلات بتفضل مكانها — الملفات القديمة بس هي اللي بتتشال.');
  }
  setTimeout(warnIfNear, 6000);
  document.addEventListener('emartna:building-complete', () => setTimeout(warnIfNear, 4000));

  /* بطاقة في شاشة الإعدادات */
  /* ===== أرشفة المرفقات القديمة =====
     المساحة محدودة (٢٠ ميجا)، والمرفقات القديمة نادرًا بتتفتح.
     الأرشفة بتشيل الملف وتسيب سجل الرسالة بعلامة "مؤرشف" — فالمحادثة
     تفضل مفهومة والمساحة تتفرّغ. */
  /* ===== الأرشفة التلقائية =====
     مرفقات الشات بتتأرشف بعد المدة المحددة (١٥ يوم افتراضيًا).
     المستندات المحاسبية — كشوف المصروفات وإيصالات السداد ومرفقات
     المصروفات — مستثناة تمامًا: دي إثبات مش محادثة.

     بننفّذها من المتصفح لما إداري يفتح البرنامج: الخادم بيعلّم
     المستحق، والمتصفح بيشيل الملف فعليًا. التأخير ساعات مش أيام،
     ومفيش تعقيد خدمات خلفية. */
  async function autoArchive(){
    try{
      const s = sb(), b = bUuid();
      if (!s || !b) return;
      if (!window.guardActionSilent || !guardActionSilent('chat','delete_any')) return;

      const { data, error } = await s.rpc('due_for_archive', { p_building:b });
      if (error || !data || !data.length) return;

      let done = 0;
      for (const r of data.slice(0, 40)){
        try{
          await s.storage.from('attachments').remove([r.path]);
          await s.rpc('mark_attachment_archived', { p_source:r.source, p_id:r.id });
          done++;
        }catch(e){}
      }
      if (done && window.toast)
        toast(`اتأرشف ${done} مرفق قديم — المساحة اتفرّغت`);
    }catch(e){}
  }
  setTimeout(autoArchive, 9000);
  document.addEventListener('emartna:building-complete',
    () => setTimeout(autoArchive, 9000));

  /* تحذير قبل الأرشفة بيومين — الأرشفة تبقى متوقعة مش مفاجأة */
  async function warnBeforeArchive(){
    try{
      const s = sb(), b = bUuid(); if (!s || !b) return;
      const key = 'emartna_arch_warn_' + b;
      const last = localStorage.getItem(key);
      const today = new Date().toISOString().slice(0,10);
      if (last === today) return;

      const { data } = await s.rpc('archive_warning', { p_building:b });
      if (!data || !data.length) return;
      localStorage.setItem(key, today);

      const names = data.slice(0,3).map(x => x.name || 'مرفق').join(' · ');
      showMessage('🗄️ مرفقات في المحادثة هتتأرشف قريب\n\n' +
        `${data.length} مرفق (${names}${data.length>3?'…':''}) ` +
        'هيتشالوا خلال يومين.\n\n' +
        'لو محتاج تحتفظ بحاجة منهم، نزّلها — أو ارفعها في ' +
        '«كشوف المصروفات الشهرية» وهتفضل للأبد.');
    }catch(e){}
  }
  setTimeout(warnBeforeArchive, 14000);

  window.openArchiveAttachments = async function(){
    const s = sb(), b = bUuid(); if (!s || !b) return;
    openModal('<h3>⏳ بنجهّز القائمة...</h3>');
    let rows = [];
    try{
      const { data, error } = await s.rpc('archivable_attachments',
        { p_building:b, p_before:null });
      if (error) throw error;
      rows = data || [];
    }catch(e){ return showMessage(e.message || 'تعذّر جلب المرفقات'); }

    if (!rows.length) return showMessage('مفيش مرفقات قابلة للأرشفة.');

    const totalMB = rows.reduce((n,r)=>n+(r.size||0),0)/1048576;
    const older = (d) => rows.filter(r =>
      (Date.now() - new Date(r.created_at).getTime()) > d*86400000);

    window.__archRows = rows;
    openModal(`
      <h3>🗄️ أرشفة المرفقات القديمة</h3>
      <p class="small mtop">الأرشفة بتشيل <b>الملف</b> وتسيب الرسالة مكانها
        بعلامة «مرفق مؤرشف» — المحادثة تفضل مفهومة والمساحة تتفرّغ.</p>
      <div class="card mtop" style="background:var(--tint-warning)">
        <b class="small">⚠️ الملفات المؤرشفة مش بترجع</b>
        <div class="small">نزّل اللي محتاجه قبل الأرشفة.</div>
      </div>

      <p class="mtop2"><b>${rows.length}</b> مرفق ·
        <b>${totalMB.toFixed(1)} ميجا</b> إجمالي</p>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        ${[[365,'أقدم من سنة'],[180,'أقدم من ٦ شهور'],[90,'أقدم من ٣ شهور']]
          .map(([d,lbl])=>{
            const n=older(d).length;
            const mb=older(d).reduce((x,r)=>x+(r.size||0),0)/1048576;
            return n ? `<button class="btn sm" onclick="archiveOlderThan(${d})">
              ${lbl} (${n} · ${mb.toFixed(1)}م.ب)</button>` : '';
          }).join('')}
      </div>

      <div class="table-wrap mtop2" style="max-height:44vh;overflow:auto">
        <table><thead><tr><th>الملف</th><th>الحجم</th><th>التاريخ</th><th></th></tr></thead>
        <tbody>${rows.slice(0,120).map(r=>`<tr>
          <td class="small">${esc2(r.name||'مرفق')}</td>
          <td class="small">${kb(r.size||0)}</td>
          <td class="small">${esc2(String(r.created_at).slice(0,10))}</td>
          <td><button class="btn sm ghost"
            onclick="archiveOne('${esc2(r.source)}','${esc2(r.id)}','${esc2(r.path)}')">
            🗄️</button></td></tr>`).join('')}
        </tbody></table></div>

      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  window.archiveOne = async function(source, id, path){
    try{
      await sb().storage.from('attachments').remove([path]);
      const { error } = await sb().rpc('mark_attachment_archived',
        { p_source:source, p_id:id });
      if (error) throw error;
      if (window.toast) toast('اتأرشف');
      openArchiveAttachments();
    }catch(e){ showMessage(e.message || 'تعذّرت الأرشفة'); }
  };

  window.archiveOlderThan = function(days){
    const rows = (window.__archRows||[]).filter(r =>
      (Date.now() - new Date(r.created_at).getTime()) > days*86400000);
    if (!rows.length) return;
    const mb = rows.reduce((n,r)=>n+(r.size||0),0)/1048576;
    confirmAction(
      `أرشفة ${rows.length} مرفق (${mb.toFixed(1)} ميجا)؟\n\n` +
      'الملفات هتتشال نهائيًا والرسائل هتفضل مكانها بعلامة «مؤرشف».',
      async () => {
        let done = 0;
        for (const r of rows){
          try{
            await sb().storage.from('attachments').remove([r.path]);
            await sb().rpc('mark_attachment_archived',{ p_source:r.source, p_id:r.id });
            done++;
          }catch(e){}
        }
        showMessage(`اتأرشف ${done} مرفق — المساحة اتفرّغت.`);
        openArchiveAttachments();
      });
  };

  /* مدة الاحتفاظ بتختلف بالباقة — بنحمّلها للعرض */
  (async function loadRetention(){
    try{
      const s = sb(), b = bUuid(); if (!s || !b) return;
      const { data } = await s.rpc('chat_retention', { p_building:b });
      if (data) window.__chatRetention = data;
    }catch(e){}
  })();

  window.openStorageUsage = async function(){
    openModal('<h3>⏳ بنحسب المساحة...</h3>');
    const q = await loadQuota();
    if (!q) return showMessage('تعذّر حساب المساحة.');
    const pct = Math.min(100, Number(q.pct) || 0);
    const color = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--gold)' : 'var(--accent)';
    openModal(`
      <h3>💾 مساحة المرفقات</h3>
      <p class="small mtop">الصور وملفات PDF اللي اتبعتت في المحادثات
        وإثباتات الدفع.</p>

      <div class="mtop2" style="background:var(--line);border-radius:99px;height:12px;
        overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};
        transition:width .3s"></div></div>
      <p class="mtop"><b style="font-size:19px;color:${color}">${pct}%</b>
        <span class="small" style="color:var(--muted)">
          — ${(q.used_bytes/1048576).toFixed(1)} من ${q.quota_mb} ميجا
          · ${q.files} ملف</span></p>

      ${pct >= 100 ? `<div class="card mtop" style="background:var(--tint-warning)">
        <b class="small">🚫 المساحة خلصت</b>
        <div class="small">مفيش مرفقات جديدة هتترفع لحد ما تفرّغ مساحة.
          أرشف المرفقات القديمة من الزرار تحت — السجلات بتفضل مكانها.</div></div>`
      : pct >= 70 ? `<div class="card mtop" style="background:var(--tint-warning)">
        <b class="small">المساحة قربت تخلص</b>
        <div class="small">يفضّل تأرشف المرفقات القديمة قبل ما تمتلئ.</div></div>` : ''}

      <div class="card mtop2" style="background:var(--tint)">
        <b class="small">إيه اللي بيتأرشف؟</b>
        <div class="small mtop">
          <div>💬 <b>مرفقات المحادثات</b> — بتتأرشف تلقائيًا بعد
            ${window.__chatRetention || 15} يوم</div>
          <div class="mtop">🗂️ <b>كشوف المصروفات</b> — بتفضل للأبد</div>
          <div>🧾 <b>إيصالات السداد ومستندات المصروفات</b> — بتفضل للأبد،
            وبتتضغط تلقائيًا بعد ٦ شهور عشان تاخد مساحة أقل</div>
        </div>
        <p class="small mtop" style="color:var(--muted)">
          المستندات المحاسبية إثبات — <b>عمرها ما تتشال</b>. بعد ٦ شهور
          بتتضغط بس (الإيصال يفضل مقروء والحجم ينزل ٨٠٪).
          المحادثة عابرة، فمرفقاتها بتتأرشف والرسالة بتفضل مكانها.</p>
      </div>

      <button class="btn ${pct>=70?'primary':''} mtop2" style="width:100%"
        onclick="openArchiveAttachments()">🗄️ أرشفة المرفقات القديمة دلوقتي</button>

      <p class="small mtop2" style="color:var(--muted)">
        💡 الصور بتتضغط تلقائيًا قبل الرفع، فالصورة بتاخد حوالي ربع ميجا
        بدل ٤ ميجا — يعني مساحتك تكفي حوالي
        ${Math.round(q.quota_mb * 4)} صورة.</p>

      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`);
  };

  (function addCard(){
    function go(){
      try{
        if (!window.SETTINGS_CARDS) return false;
        if (SETTINGS_CARDS.some(c => c.key === 'storage')) return true;
        SETTINGS_CARDS.push({ key:'storage', icon:'💾',
          title:'مساحة المرفقات',
          sub:'الصور والملفات في المحادثات' });
        const orig = window.openSettingsCard;
        if (typeof orig === 'function' && !orig.__stor){
          const w = function(key){
            if (key === 'storage') return openStorageUsage();
            return orig.apply(this, arguments);
          };
          w.__stor = true; window.openSettingsCard = w;
        }
        return true;
      }catch(e){ return false; }
    }
    if (!go()) setTimeout(go, 2500);
  })();

  console.log('[عمارتنا] مرفقات الشات جاهزة');
})();

})();

/* ═══ emartna-recycle.js ═══ */
(function(){
/* ============================================================
   عمارتنا — سلة المحذوفات (طبقة السحابة)
   ------------------------------------------------------------
   في النسخة المحلية سلة المحذوفات كانت بتشتغل على الجهاز.
   في السحابة الحذف بيبقى "حذف مؤقت" على السيرفر:
     is_deleted = true  →  العمارة تختفي وحساباتها تتوقف
     استعادة            →  is_deleted = false
     حذف نهائي          →  حذف الصف فعليًا (وكل بياناته معاه)

   الملف ده بيستبدل دوال البرنامج المحلية بنسخ سحابية.
   ============================================================ */

(function(){
  'use strict';

  const sb = () => (window.CLOUD && window.CLOUD._sb) || null;

  /* REG ممكن يكون معرّف بـ let (مش على window) — الدالة دي بتوصله في الحالتين */
  const reg = () => (typeof REG !== 'undefined' && REG) ? REG : (window.REG || null);

  /* كود العمارة (اللي البرنامج شايفه) → المعرّف الحقيقي على السيرفر */
  function uuidOf(id){
    const rec = ((reg()?.buildings) || []).find(b => b.id === id)
             || ((reg()?.deletedBuildings) || []).find(b => b.id === id);
    if (rec && rec.__uuid) return rec.__uuid;
    return /^[0-9a-f-]{36}$/i.test(String(id)) ? id : null;
  }

  function fail(e){
    const m = (e && e.message) || 'حصلت مشكلة، حاول تاني';
    if (window.showMessage) showMessage(m); else alert(m);
  }

  /* ---------- تحميل المحذوفات من السيرفر ---------- */

  let loading = false;

  async function loadTrash(){
    const s = sb();
    if (!s || loading) return;
    loading = true;
    try{
      const { data, error } = await s.from('buildings')
        .select('id,code,name,city,deleted_at,plan_key,license_status,license_start,license_end,apartments_count')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending:false });
      if (error) throw error;

      reg().deletedBuildings = (data || []).map(b => ({
        id: b.code || b.id,
        __uuid: b.id,
        code: b.code,
        name: b.name,
        city: b.city || '',
        apartmentsCount: b.apartments_count || 0,
        deletedAt: b.deleted_at || new Date().toISOString(),
        license: {
          plan: b.plan_key, start: b.license_start,
          end: b.license_end, status: b.license_status,
        },
      }));
      window.__trashLoaded = true;
    }catch(e){
      window.__trashLoaded = true;
      window.__trashError = (window.cloudErrorText ? cloudErrorText(e) : e.message);
      console.warn('[عمارتنا/سلة المحذوفات]', e.message);
    }finally{
      loading = false;
      // لازم نعيد الرسم في كل الحالات — من غير كده الشاشة بتفضل
      // على "بيحمّل…" للأبد لو التحميل فشل.
      if (window.renderSysContent) { try{ renderSysContent(); }catch(e2){} }
    }
  }

  /* ---------- الشاشة ---------- */

  const originalPage = window.pageSysTrash;

  window.pageSysTrash = function(){
    if (!window.__trashLoaded){
      loadTrash();
      return '<div class="card"><p class="small">⏳ بيحمّل سلة المحذوفات…</p></div>';
    }
    const err = window.__trashError
      ? `<div class="card" style="border:1px solid var(--red)">
           <p class="small" style="color:var(--red)">⚠️ تعذّر تحميل سلة المحذوفات: ${window.esc ? esc(window.__trashError) : window.__trashError}</p>
           <button class="btn sm" onclick="reloadTrash()">🔄 حاول تاني</button></div>` : '';
    return err + (originalPage ? originalPage() : '<p class="small">سلة المحذوفات فاضية</p>');
  };

  /* ---------- حذف مؤقت ---------- */

  window.deleteBuildingPrompt = function(id){
    const rec = ((reg()?.buildings) || []).find(b => b.id === id);
    if (!rec) return;
    const uuid = uuidOf(id);
    if (!uuid) return fail(new Error('تعذّر تحديد العمارة'));

    confirmDelete(
      `سيتم نقل عمارة "${rec.name}" إلى سلة المحذوفات. الحسابات هتتوقف عن الدخول فورًا، `
      + `لكن تقدر تسترجعها من سلة المحذوفات في أي وقت، أو تحذفها نهائيًا من هناك.`,
      async () => {
        try{
          const { error } = await sb().from('buildings')
            .update({ is_deleted:true, deleted_at:new Date().toISOString() })
            .eq('id', uuid);
          if (error) throw error;

          reg().buildings = reg().buildings.filter(b => b.id !== id);
          reg().deletedBuildings = reg().deletedBuildings || [];
          reg().deletedBuildings.unshift(
            Object.assign({}, rec, { deletedAt:new Date().toISOString() }));

          toast('تم نقل العمارة لسلة المحذوفات');
          renderSysContent();
        }catch(e){ fail(e); }
      });
  };

  /* ---------- استعادة ---------- */

  window.restoreBuildingFromTrash = async function(id){
    const rec = ((reg()?.deletedBuildings) || []).find(b => b.id === id);
    if (!rec) return;
    const uuid = uuidOf(id);
    if (!uuid) return fail(new Error('تعذّر تحديد العمارة'));

    try{
      const { error } = await sb().from('buildings')
        .update({ is_deleted:false, deleted_at:null })
        .eq('id', uuid);
      if (error) throw error;

      const back = Object.assign({}, rec);
      delete back.deletedAt;
      reg().buildings = reg().buildings || [];
      reg().buildings.push(back);
      reg().deletedBuildings =
        reg().deletedBuildings.filter(b => b.id !== id);

      toast('تم استعادة العمارة');
      renderSysContent();
    }catch(e){ fail(e); }
  };

  /* ---------- حذف نهائي ---------- */

  window.permanentlyDeleteBuildingPrompt = function(id){
    const rec = ((reg()?.deletedBuildings) || []).find(b => b.id === id);
    if (!rec) return;
    const uuid = uuidOf(id);
    if (!uuid) return fail(new Error('تعذّر تحديد العمارة'));

    confirmDelete(
      `سيتم حذف عمارة "${rec.name}" وكل بياناتها (الشقق، الحركات المالية، المصروفات، `
      + `المستخدمين) نهائيًا من الخادم. لا يمكن التراجع عن هذا الإجراء إطلاقًا.`,
      async () => {
        try{
          const { error } = await sb().from('buildings').delete().eq('id', uuid);
          if (error) throw error;

          reg().deletedBuildings =
            reg().deletedBuildings.filter(b => b.id !== id);
          reg().renewalRequests =
            (reg().renewalRequests || []).filter(r => r.buildingId !== id);

          toast('تم الحذف النهائي');
          renderSysContent();
        }catch(e){ fail(e); }
      });
  };

  /* أول ما صاحب البرنامج يدخل، حمّل السلة في الخلفية */
  window.reloadTrash = function(){ window.__trashLoaded = false; window.__trashError = null; loadTrash(); };

  console.log('[عمارتنا] سلة المحذوفات السحابية جاهزة');
})();

})();

/* ═══ emartna-floors.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تقرير الأدوار
   ------------------------------------------------------------
   الشاشة دي بتجمّع وحدات العمارة حسب الدور، وتطلّع لكل دور:
   عدد الوحدات · المستحق · المحصّل · المتأخر · نسبة التحصيل.
   بتعتمد على دوال البرنامج الأساسية:
   apCharges · apPayments · apBalance · money · esc · unitLabel
   ============================================================ */

(function(){
  'use strict';

  /* ترتيب الأدوار: الأرضي الأول، وبعدين بالرقم */
  function floorRank(units){
    const nums = units.map(u => Number(u.number) || 0).filter(Boolean);
    return nums.length ? Math.min(...nums) : 9999;
  }

  function groupByFloor(){
    const map = new Map();
    (D.apartments || []).forEach(a => {
      const key = a.floor || 'بدون دور محدد';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return [...map.entries()]
      .map(([floor, units]) => {
        const charges  = units.reduce((s,a) => s + apCharges(a.id), 0);
        const payments = units.reduce((s,a) => s + apPayments(a.id), 0);
        const due      = units.reduce((s,a) => s + Math.max(0, apBalance(a.id)), 0);
        const advance  = units.reduce((s,a) => s + Math.max(0, -apBalance(a.id)), 0);
        const fees     = units.reduce((s,a) => s + (Number(a.monthlyFee) || 0), 0);
        return {
          floor, units,
          count:   units.length,
          shops:   units.filter(a => a.type === 'shop').length,
          flats:   units.filter(a => a.type !== 'shop').length,
          closed:  units.filter(a => a.closed).length,
          late:    units.filter(a => apBalance(a.id) > 0).length,
          fees, charges, payments, due, advance,
          rate: charges > 0 ? Math.round((payments / charges) * 100) : null,
          rank: floorRank(units),
        };
      })
      .sort((a,b) => a.rank - b.rank);
  }

  function rateBadge(r){
    if (r === null) return '<span class="badge n">لا يوجد مستحقات</span>';
    if (r >= 90) return `<span class="badge g">${r}%</span>`;
    if (r >= 60) return `<span class="badge y">${r}%</span>`;
    return `<span class="badge r">${r}%</span>`;
  }

  /* تفاصيل دور واحد — بتتفتح وتتقفل بالضغط */
  window.toggleFloorDetails = function(key){
    window.__openFloor = (window.__openFloor === key) ? null : key;
    renderContent();
  };

  function floorDetailsHTML(g){
    const rows = [...g.units].sort((a,b) => (Number(a.number)||0) - (Number(b.number)||0));
    return `<div class="card mtop">
      <h3>${esc(g.floor)} — تفاصيل الوحدات</h3>
      <div class="mtop" style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>الوحدة</th><th>المالك</th><th>الاشتراك الشهري</th>
          <th>المستحق</th><th>المحصّل</th><th>الرصيد</th><th>الحالة</th>
        </tr></thead>
        <tbody>${rows.map(a => {
          const bal = apBalance(a.id);
          const st  = a.closed ? '<span class="badge n">مغلقة</span>'
                    : bal > 0 ? '<span class="badge r">متأخر</span>'
                    : bal < 0 ? '<span class="badge b">دفع مقدم</span>'
                    : '<span class="badge g">منتظم</span>';
          return `<tr>
            <td><b>${unitLabel(a)}</b></td>
            <td>${esc(a.ownerName || '-')}</td>
            <td>${money(a.monthlyFee || 0)}</td>
            <td>${money(apCharges(a.id))}</td>
            <td>${money(apPayments(a.id))}</td>
            <td>${bal > 0 ? '<span style="color:var(--red,#c0392b)">' + money(bal) + '</span>'
                          : money(Math.abs(bal))}</td>
            <td>${st}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
  }

  window.pageFloorsReport = function(){
    if (typeof D === 'undefined' || !D || !D.apartments || !D.apartments.length)
      return '<p class="small">مفيش وحدات مسجّلة في العمارة لحد دلوقتي.</p>';

    const groups = groupByFloor();
    const tot = {
      units:    groups.reduce((s,g) => s + g.count, 0),
      charges:  groups.reduce((s,g) => s + g.charges, 0),
      payments: groups.reduce((s,g) => s + g.payments, 0),
      due:      groups.reduce((s,g) => s + g.due, 0),
      late:     groups.reduce((s,g) => s + g.late, 0),
    };
    const totRate = tot.charges > 0 ? Math.round((tot.payments / tot.charges) * 100) : null;

    const cols = [
      { key:'floor', label:'الدور', value:g => g.rank,
        cell:g => `<b>${esc(g.floor)}</b>` },
      { key:'count', label:'الوحدات', value:g => g.count,
        cell:g => `${g.count}<span class="small"> (${g.flats} شقة${g.shops ? ' · ' + g.shops + ' محل' : ''}${g.closed ? ' · ' + g.closed + ' مغلقة' : ''})</span>` },
      { key:'fees', label:'الاشتراكات الشهرية', value:g => g.fees, cell:g => money(g.fees) },
      { key:'charges', label:'إجمالي المستحق', value:g => g.charges, cell:g => money(g.charges) },
      { key:'payments', label:'إجمالي المحصّل', value:g => g.payments, cell:g => money(g.payments) },
      { key:'due', label:'المتأخر', value:g => g.due,
        cell:g => g.due > 0 ? `<span style="color:var(--red,#c0392b)"><b>${money(g.due)}</b></span>` : money(0) },
      { key:'late', label:'وحدات متأخرة', value:g => g.late,
        cell:g => g.late ? `<span class="badge r">${g.late}</span>` : '<span class="badge g">0</span>' },
      { key:'rate', label:'نسبة التحصيل', value:g => (g.rate === null ? -1 : g.rate), cell:g => rateBadge(g.rate) },
      { key:'x', label:'', value:null,
        cell:g => `<button class="btn sm ghost" onclick="toggleFloorDetails('${esc(g.floor).replace(/'/g,"\\'")}')">${window.__openFloor === g.floor ? '▲ إخفاء' : '▼ التفاصيل'}</button>` },
    ];

    const open = groups.find(g => g.floor === window.__openFloor);

    return `
    <p class="small">توزيع وحدات العمارة على الأدوار، وحالة التحصيل في كل دور. اضغط "التفاصيل" لأي دور تشوف وحداته واحدة واحدة.</p>

    <div class="grid g4 mtop">
      <div class="kpi"><div class="ic">🏢</div><div class="lbl">عدد الأدوار</div><div class="val">${groups.length}</div></div>
      <div class="kpi"><div class="ic">🚪</div><div class="lbl">إجمالي الوحدات</div><div class="val">${tot.units}</div></div>
      <div class="kpi ${tot.due > 0 ? 'owe' : 'ok'}"><div class="ic">⏳</div><div class="lbl">إجمالي المتأخر</div><div class="val">${money(tot.due)}</div></div>
      <div class="kpi ${totRate !== null && totRate >= 80 ? 'ok' : ''}"><div class="ic">📊</div><div class="lbl">نسبة التحصيل</div><div class="val">${totRate === null ? '-' : totRate + '%'}</div></div>
    </div>

    <div class="mtop">${sortableTable('floorsReportTable', groups, cols, null, {
      defaultKey: 'floor',
      emptyText: 'مفيش أدوار مسجّلة',
      exportName: 'تقرير الأدوار',
    })}</div>

    ${open ? floorDetailsHTML(open) : ''}`;
  };

  console.log('[عمارتنا] تقرير الأدوار جاهز');
})();

})();

/* ═══ emartna-modal-size.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تحكّم في حجم الشاشات الثانوية (النوافذ المنبثقة)
   ------------------------------------------------------------
   على اللابتوب النوافذ كانت ثابتة العرض (٥٦٠ بكسل)، فبيانات
   الجداول العريضة كانت بتتقص. الملف ده بيضيف:

     ١) عرض أكبر تلقائيًا حسب حجم الشاشة
     ٢) زرار تكبير / استعادة جوه كل نافذة
     ٣) إمكانية السحب من الركن لتغيير الطول والعرض بالماوس
     ٤) الحجم اللي تختاره بيتحفظ ويرجع تاني في المرات الجاية

   على الموبايل بيفضل السلوك زي ما هو.
   ============================================================ */

(function(){
  'use strict';

  const KEY_SIZE = 'emartna_modal_size';
  const KEY_MAX  = 'emartna_modal_maximized';
  const MOBILE   = () => window.matchMedia('(max-width: 820px)').matches;

  /* ---------- ١) الأنماط ---------- */

  const css = `
  .modal{
    max-width: min(960px, 94vw);
    max-height: 92vh;
    resize: both;
    overflow: auto;
    position: relative;
    min-width: 320px;
    min-height: 200px;
  }
  .modal.wide{ max-width: min(1280px, 96vw); }
  .modal.emartna-max{
    width: 96vw !important;  max-width: 96vw !important;
    height: 94vh !important; max-height: 94vh !important;
  }
  /* أزرار الحفظ/الإلغاء فوق — تفضل ظاهرة مهما نزلت في النافذة */
  .modal .modal-actions{
    position: sticky; top: 0; z-index: 4;
    background: var(--panel, #fff);
    padding: 10px 0 12px;
    margin: 0 0 12px;
    border-bottom: 1px solid var(--line, #e3e8e6);
  }
  /* مقبض السحب في الركن */
  .modal::-webkit-resizer{ background: transparent; }
  .modal-sizer{
    position: sticky; top: 0; float: left;
    display: flex; gap: 6px; z-index: 6;
    direction: ltr;                 /* × الأول من الشمال زي نوافذ الويندوز */
    margin: -8px 0 0 -4px;
  }
  .modal-sizer button{
    border: 1px solid var(--line, #e3e8e6);
    background: var(--panel, #fff);
    color: var(--sidebar-muted, #6B7280);
    border-radius: 8px; cursor: pointer;
    width: 30px; height: 30px; font-size: 14px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
  }
  .modal-sizer button:hover{
    color: var(--accent, #159A8C);
    border-color: var(--accent, #159A8C);
  }
  .modal-sizer button.mclose{ font-size: 18px; font-weight: 700; }
  .modal-sizer button.mclose:hover{
    background: var(--red, #c23b3b); color: #fff; border-color: var(--red, #c23b3b);
  }
  /* زرار الإغلاق/الإلغاء القديم اتشال — الـ× بديله */
  .modal .modal-actions button.emartna-hidden-close{ display: none; }
  /* لو شريط الأزرار فضي بعد إخفاء الإغلاق، مانسيبش فراغ */
  .modal .modal-actions:empty,
  .modal .modal-actions.emartna-empty{ display: none; }
  /* تلميح إن الركن بيتسحب */
  .modal-grip{
    position: absolute; left: 4px; bottom: 4px;
    width: 14px; height: 14px; opacity: .35; pointer-events: none;
    background:
      linear-gradient(135deg, transparent 45%, currentColor 45%, currentColor 55%, transparent 55%),
      linear-gradient(135deg, transparent 70%, currentColor 70%, currentColor 80%, transparent 80%);
    color: var(--sidebar-muted, #6B7280);
  }
  @media (max-width: 820px){
    .modal{ resize: none; max-width: 100%; min-width: 0; }
    .modal-grip{ display: none; }
    /* على الموبايل: زرار الإغلاق × يفضل ظاهر، وأزرار الحجم بس هي اللي تختفي */
    .modal-sizer button:not(.mclose){ display: none; }
    .modal-sizer{ margin: -4px 0 6px -2px; }
    .modal-sizer button.mclose{ width: 38px; height: 38px; font-size: 22px; }
  }
  /* عند الطباعة منعرضش أزرار التحكم */
  @media print{ .modal-sizer, .modal-grip{ display: none !important; } }
  `;

  const style = document.createElement('style');
  style.id = 'emartna-modal-sizing';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- ٢) حفظ واسترجاع الحجم ---------- */

  function saveSize(box){
    if (MOBILE() || box.classList.contains('emartna-max')) return;
    try{
      const w = box.style.width, h = box.style.height;
      if (w || h) localStorage.setItem(KEY_SIZE, JSON.stringify({ w, h }));
    }catch(e){}
  }

  function restoreSize(box){
    if (MOBILE()) return;
    try{
      if (localStorage.getItem(KEY_MAX) === '1'){
        box.classList.add('emartna-max');
        return;
      }
      const s = JSON.parse(localStorage.getItem(KEY_SIZE) || 'null');
      if (s && s.w) box.style.width  = s.w;
      if (s && s.h) box.style.height = s.h;
    }catch(e){}
  }

  /* ---------- ٣) أزرار التحكم ---------- */

  window.toggleModalMaximize = function(){
    const box = document.getElementById('modalBox');
    if (!box) return;
    const on = box.classList.toggle('emartna-max');
    try{ localStorage.setItem(KEY_MAX, on ? '1' : '0'); }catch(e){}
    if (on){ box.style.width = ''; box.style.height = ''; }
    paintButtons(box);
  };

  window.resetModalSize = function(){
    const box = document.getElementById('modalBox');
    if (!box) return;
    box.classList.remove('emartna-max');
    box.style.width = ''; box.style.height = '';
    try{
      localStorage.removeItem(KEY_SIZE);
      localStorage.setItem(KEY_MAX, '0');
    }catch(e){}
    paintButtons(box);
  };

  function paintButtons(box){
    let bar = box.querySelector('.modal-sizer');
    if (!bar){
      bar = document.createElement('div');
      bar.className = 'modal-sizer';
      box.insertBefore(bar, box.firstChild);
    }
    const max = box.classList.contains('emartna-max');

    // دوّر على زرار "إغلاق" أو "إلغاء" جوه النافذة عشان الـ× ياخد نفس وظيفته
    let closeAction = 'closeModal()';
    const actionsEl = box.querySelector('.modal-actions');
    if (actionsEl){
      const btns = [...actionsEl.querySelectorAll('button')];
      const closeBtn = btns.find(b => {
        const t = (b.textContent || '').trim();
        return t === 'إغلاق' || t === 'إلغاء' || t === 'رجوع';
      });
      if (closeBtn){
        const oc = closeBtn.getAttribute('onclick');
        if (oc) closeAction = oc;
        closeBtn.classList.add('emartna-hidden-close');
      }
      // لو مفضلش أزرار ظاهرة، اخفي الشريط كله
      const visible = btns.filter(b => !b.classList.contains('emartna-hidden-close'));
      actionsEl.classList.toggle('emartna-empty', visible.length === 0);
    }

    bar.innerHTML =
      `<button type="button" class="mclose" onclick="${closeAction.replace(/"/g,'&quot;')}" title="إغلاق (Esc)">×</button>`
    + `<button type="button" onclick="toggleModalMaximize()" title="${max ? 'استعادة الحجم' : 'تكبير النافذة'}">${max ? '🗗' : '⛶'}</button>`
    + `<button type="button" onclick="resetModalSize()" title="رجوع للحجم الافتراضي">↺</button>`;

    // انقل شريط الأزرار لأعلى النافذة (كان في الآخر، وبيضيع لو المحتوى طويل)
    const actions = box.querySelector('.modal-actions');
    if (actions && actions.previousElementSibling !== bar){
      bar.insertAdjacentElement('afterend', actions);
    }

    if (!box.querySelector('.modal-grip')){
      const g = document.createElement('span');
      g.className = 'modal-grip';
      box.appendChild(g);
    }
  }

  /* ---------- ٤) الربط مع فتح وقفل النوافذ ---------- */

  const box = document.getElementById('modalBox');
  const overlay = document.getElementById('modalOverlay');
  if (!box || !overlay){
    console.warn('[عمارتنا] مالقيتش عناصر النافذة المنبثقة');
    return;
  }

  // كل ما المحتوى يتغيّر (openModal بتستبدل innerHTML) رجّع الأزرار
  new MutationObserver(() => {
    if (!overlay.classList.contains('show')) return;
    // openModal بتستبدل المحتوى بالكامل، فلازم نرجّع الأزرار ونرفع شريط
    // الحفظ/الإلغاء لأعلى في كل مرة
    paintButtons(box);
  }).observe(box, { childList: true });

  // أول ما النافذة تفتح: رجّع آخر حجم + الأزرار
  new MutationObserver(() => {
    if (overlay.classList.contains('show')){
      restoreSize(box);
      paintButtons(box);
    }else{
      saveSize(box);
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  // احفظ الحجم بعد ما المستخدم يسحب الركن
  if (window.ResizeObserver){
    let t = null;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => saveSize(box), 400);
    }).observe(box);
  }

  // Esc يقفل النافذة المفتوحة
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!overlay.classList.contains('show')) return;
    const x = box.querySelector('.modal-sizer button.mclose');
    if (x) x.click();
  });

  console.log('[عمارتنا] التحكم في حجم النوافذ جاهز');
})();

})();

/* ═══ emartna-guard.js ═══ */
(function(){
/* ============================================================
   عمارتنا — حارس الشاشات
   ------------------------------------------------------------
   المشكلة اللي بيحلّها:
   renderContent() بتغيّر عنوان الصفحة الأول، وبعدين بترسم المحتوى.
   لو حصل أي خطأ وقت الرسم، المحتوى القديم بيفضل مكانه — فالعنوان
   بيقول "لوحة التحكم" والشاشة لسه بتعرض الصفحة اللي قبلها.
   ده بيخلّي الخطأ يبان كأن شاشتين بيطلعوا نفس المحتوى.

   الحل: نمسك الخطأ ونعرض كارت واضح مكان المحتوى، فيه رسالة
   الخطأ وزرار نسخ — بدل ما الشاشة تفضل شبح.
   ============================================================ */

(function(){
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function errorCard(err, page){
    const msg   = (err && err.message) || String(err);
    const stack = (err && err.stack) ? String(err.stack).split('\n').slice(0,4).join('\n') : '';
    const full  = 'الشاشة: ' + page + '\n' + msg + '\n' + stack;
    window.__lastRenderError = full;
    return `
    <div class="card" style="border:1px solid var(--red,#c23b3b)">
      <h3 style="color:var(--red,#c23b3b)">⚠️ الشاشة دي مش قادرة تفتح</h3>
      <p class="small mtop">حصل خطأ وإحنا بنجهّز الشاشة، فوقفنا عشان مانعرضش بيانات ناقصة أو غلط.
      باقي الشاشات شغالة عادي — تقدر تكمل شغلك منها.</p>
      <div class="mtop" style="background:var(--inputbg,#fffdf8);border:1px solid var(--line,#e3e8e6);
           border-radius:9px;padding:10px;font-family:monospace;font-size:12px;
           direction:ltr;text-align:left;white-space:pre-wrap;overflow:auto;max-height:220px">${esc(full)}</div>
      <div class="flexrow mtop">
        <button class="btn sm primary" onclick="copyRenderError()">📋 نسخ تفاصيل الخطأ</button>
        <button class="btn sm ghost" onclick="location.reload()">🔄 تحديث الصفحة</button>
      </div>
      <p class="small mtop">انسخ التفاصيل دي وابعتها — بتحدد سبب المشكلة بالظبط.</p>
    </div>`;
  }

  window.copyRenderError = function(){
    const t = window.__lastRenderError || '';
    const done = () => (window.toast ? toast('اتنسخت — ابعتها في الشات') : null);
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(done, done);
    }else{
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); }catch(e){}
      document.body.removeChild(ta); done();
    }
  };

  function guard(name){
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(){
      try{
        return orig.apply(this, arguments);
      }catch(err){
        const page = (typeof curPage !== 'undefined' ? curPage : '?');
        console.error('[عمارتنا] خطأ في رسم الشاشة "' + page + '":', err);
        const c = document.getElementById('content');
        if (c) c.innerHTML = errorCard(err, page);
      }
    };
  }

  guard('renderContent');
  guard('renderSysContent');

  console.log('[عمارتنا] حارس الشاشات جاهز');
})();

})();

/* ═══ emartna-stmtkit.js ═══ */
(function(){
/* ============================================================
   عمارتنا — مكوّن كشف الحساب الموحّد
   ------------------------------------------------------------
   فيه ٤ كشوف حساب في البرنامج، كل واحد اتعمل لوحده فطلعوا
   مختلفين: واحد فيه فلترة وواحد لأ، واحد فيه طباعة وواحد لأ.

   الملف ده بيدّي القطع المشتركة:
     • شريط الفلترة (سريعة + من/إلى)
     • بطاقة الملخّص (افتتاحي · مستحق · مدفوع · ختامي)
     • حساب الرصيد التراكمي
     • الطباعة والمشاركة

   أي كشف جديد بينادي الدوال دي بدل ما يعيد كتابتها.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const M    = n => window.money ? money(Number(n)||0) : (Number(n)||0);
  const r2   = n => window.money2 ? money2(n) : Math.round(Number(n)*100)/100;

  /* ---------- حالة الفلترة لكل كشف ---------- */

  window.__stFilters = window.__stFilters || {};

  window.stRange = function(id){
    return window.__stFilters[id] || { from:'', to:'' };
  };

  window.stSetQuick = function(id, months, cb){
    const to = new Date(), from = new Date();
    if (months) from.setMonth(from.getMonth() - months);
    window.__stFilters[id] = months
      ? { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }
      : { from:'', to:'' };
    if (cb && window[cb]) window[cb]();
    else if (window.renderContent) renderContent();
  };

  window.stSetField = function(id, key, val, cb){
    const cur = stRange(id);
    window.__stFilters[id] = Object.assign({}, cur, { [key]: val });
    if (cb && window[cb]) window[cb]();
    else if (window.renderContent) renderContent();
  };

  /* ---------- شريط الفلترة ---------- */

  window.stToolbarHTML = function(id, cb){
    const r = stRange(id);
    const q = (lbl, m) => `<button class="btn sm ${
      (!m && !r.from) ? 'primary' : 'ghost'}"
      onclick="stSetQuick('${id}',${m},'${cb||''}')">${lbl}</button>`;
    return `
    <div class="card">
      <div class="flexrow" style="gap:6px;flex-wrap:wrap">
        ${q('آخر شهر',1)}${q('3 شهور',3)}${q('6 شهور',6)}${q('سنة',12)}${q('الكل',0)}
      </div>
      <div class="grid g2 mtop">
        <div class="field2"><label>من تاريخ</label>
          <input type="date" value="${esc2(r.from||'')}"
            onchange="stSetField('${id}','from',this.value,'${cb||''}')"></div>
        <div class="field2"><label>إلى تاريخ</label>
          <input type="date" value="${esc2(r.to||'')}"
            onchange="stSetField('${id}','to',this.value,'${cb||''}')"></div>
      </div>
    </div>`;
  };

  /* ---------- حساب الرصيد التراكمي ----------
     بيرجّع الصفوف داخل الفترة ومعاها رصيد بعد كل حركة، والرصيد
     الافتتاحي (اللي قبل الفترة) والختامي.

     ⚠️ الحساب تصاعدي من الأقدم — لو اتحسب من الأحدث بيطلع مقلوب. */

  window.stCompute = function(all, opts){
    opts = opts || {};
    const from = opts.from, to = opts.to;
    const dateOf = opts.dateOf || (x => x.date);
    const signOf = opts.signOf || (x =>
      (x.type === 'دفعة' || x.type === 'صرف') ? -1 : 1);
    const amtOf  = opts.amountOf || (x => Number(x.amount) || 0);

    const sorted = all.slice().sort((a,b) =>
      String(dateOf(a)||'').localeCompare(String(dateOf(b)||'')));

    let run = Number(opts.opening) || 0;
    let opening = run, seen = false;
    const rows = [];

    sorted.forEach(x => {
      const d = String(dateOf(x) || '');
      const inRange = (!from || d >= from) && (!to || d <= to);
      if (!inRange && !seen){ run = r2(run + signOf(x)*amtOf(x)); opening = run; return; }
      if (!inRange) return;
      seen = true;
      run = r2(run + signOf(x)*amtOf(x));
      rows.push(Object.assign({}, x, { __run: run, __sign: signOf(x) }));
    });

    const closing = rows.length ? rows[rows.length-1].__run : opening;
    const charges  = r2(rows.filter(x=>x.__sign>0).reduce((s,x)=>s+amtOf(x),0));
    const payments = r2(rows.filter(x=>x.__sign<0).reduce((s,x)=>s+amtOf(x),0));

    return { rows, opening, closing, charges, payments };
  };

  /* ---------- بطاقة الملخّص ---------- */

  window.stSummaryHTML = function(c, labels){
    const L = Object.assign({
      opening:'الرصيد الافتتاحي', charges:'مستحقات الفترة',
      payments:'اللي اتدفع', closing:'الرصيد الختامي',
    }, labels || {});
    return `
    <div class="card mtop2" style="background:var(--tint)">
      <div class="grid g4 small">
        <div><b>${esc2(L.opening)}</b>
          <div style="font-size:15px">${M(c.opening)}</div></div>
        <div><b>${esc2(L.charges)}</b>
          <div style="font-size:15px;color:var(--red)">+${M(c.charges)}</div></div>
        <div><b>${esc2(L.payments)}</b>
          <div style="font-size:15px;color:var(--accent)">−${M(c.payments)}</div></div>
        <div><b>${esc2(L.closing)}</b>
          <div style="font-size:17px;font-weight:700;
            color:${c.closing>0?'var(--red)':'var(--accent)'}">${M(c.closing)}</div></div>
      </div>
    </div>`;
  };

  /* ---------- أعمدة الجدول الموحّدة ---------- */

  window.stColumns = function(extra){
    return [
      { key:'date', label:'التاريخ', value:x=>x.date,
        cell:x=>esc2(x.date||'') },
      { key:'type', label:'النوع', value:x=>x.type,
        cell:x=>window.ledgerBadge?ledgerBadge(x.type):esc2(x.type) },
      { key:'note', label:'البيان', value:x=>x.note||'',
        cell:x=>esc2(x.note||x.type||'') },
      { key:'amount', label:'له / عليه', value:x=>Number(x.amount),
        cell:x=>`<b style="color:${x.__sign<0?'var(--accent)':'var(--red)'}">${
          x.__sign<0?'−':'+'}${M(x.amount)}</b>` },
      { key:'run', label:'الرصيد', value:x=>Number(x.__run),
        cell:x=>`<b>${M(x.__run)}</b>` },
    ].concat(extra || []);
  };

  /* ---------- الطباعة ---------- */

  window.stPrint = function(c, meta){
    meta = meta || {};
    const w = window.open('', '_blank');
    if (!w) return showMessage('اسمح بالنوافذ المنبثقة للطباعة');
    const b = (window.D && D.building) || {};
    const rows = (c.rows || []).slice().reverse();   /* الأحدث فوق */

    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
      <meta charset="utf-8"><title>${esc2(meta.title||'كشف حساب')}</title>
      <style>@page{margin:14mm}
        body{font-family:Tahoma,Arial,sans-serif;color:#1c2622;margin:0}
        h1{font-size:18px;margin:0 0 2px}
        h2{font-size:13px;margin:0;color:#6b7a76;font-weight:400}
        .hd{border-bottom:2px solid #159A8C;padding-bottom:10px;margin-bottom:12px}
        .sum{display:flex;gap:16px;flex-wrap:wrap;background:#f0f6f4;
          padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:12.5px}
        table{width:100%;border-collapse:collapse;font-size:12.5px}
        th,td{border:1px solid #d8e0dd;padding:6px 8px;text-align:right}
        thead th{background:#f0f6f4;font-size:12px}
        tfoot th{background:#f0f6f4}
        tbody tr:nth-child(even){background:#fafcfb}
        .ft{margin-top:14px;font-size:11px;color:#6b7a76;
          border-top:1px solid #d8e0dd;padding-top:8px}
        @media print{.no-print{display:none}}
      </style></head><body>
      ${window.printBackBar?printBackBar():''}
      <div class="hd">
        <h1>${esc2(b.name||'العمارة')} — ${esc2(meta.title||'كشف حساب')}</h1>
        <h2>${esc2(meta.subtitle||'')}${meta.from
          ? ' · من ' + esc2(meta.from) + ' إلى ' + esc2(meta.to) : ''}</h2>
      </div>
      <div class="sum">
        <span><b>الرصيد الافتتاحي:</b> ${M(c.opening)}</span>
        <span><b>مستحقات:</b> ${M(c.charges)}</span>
        <span><b>مدفوع:</b> ${M(c.payments)}</span>
        <span><b>الرصيد الختامي:</b> ${M(c.closing)}</span>
      </div>
      <table><thead><tr><th>التاريخ</th><th>البيان</th>
        <th>له / عليه</th><th>الرصيد</th></tr></thead><tbody>
      ${rows.map(x=>`<tr><td>${esc2(x.date||'')}</td>
        <td>${esc2(x.note||x.type||'')}</td>
        <td>${x.__sign<0?'−':'+'}${M(x.amount)}</td>
        <td>${M(x.__run)}</td></tr>`).join('')}
      </tbody><tfoot><tr><th colspan="3">الرصيد الختامي</th>
        <th>${M(c.closing)}</th></tr></tfoot></table>
      <div class="ft">${rows.length} حركة ·
        اتطبع في ${esc2(new Date().toLocaleString('ar-EG'))} · نظام عمارتنا</div>
      <script>setTimeout(function(){window.print()},350)<\/script>
      </body></html>`);
    w.document.close();
  };

  /* ---------- المشاركة ---------- */

  window.stShare = async function(c, meta){
    meta = meta || {};
    const b = (window.D && D.building) || {};
    const rows = (c.rows || []).slice(-12).reverse();
    const txt = `📄 ${meta.title||'كشف حساب'} — ${b.name||''}\n` +
      (meta.subtitle ? meta.subtitle + '\n' : '') +
      (meta.from ? `الفترة: ${meta.from} إلى ${meta.to}\n` : '') + '\n' +
      `الرصيد الافتتاحي: ${c.opening}\n` +
      rows.map(x => `${x.date} · ${x.note||x.type} · ${
        x.__sign<0?'−':'+'}${x.amount}`).join('\n') +
      `\n\n💰 الرصيد الختامي: ${c.closing} جنيه\n— نظام عمارتنا`;

    if (navigator.share){
      try{ await navigator.share({ title: meta.title||'كشف حساب', text: txt }); return; }
      catch(e){ if (e && e.name === 'AbortError') return; }
    }
    openModal(`
      <h3>📤 مشاركة الكشف</h3>
      <textarea rows="11" id="stShareTxt" style="width:100%;font-size:12.5px"
        onclick="this.select()">${esc2(txt)}</textarea>
      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        ${meta.phone?`<a class="btn gold" target="_blank"
          href="https://wa.me/${String(meta.phone).replace(/\D/g,'')}?text=${
          encodeURIComponent(txt)}">💬 واتساب</a>`:''}
        <button class="btn ghost" onclick="
          navigator.clipboard.writeText(document.getElementById('stShareTxt').value);
          toast('اتنسخ');">📋 نسخ</button>
      </div>
      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`, true);
  };

  /* ---------- أزرار الطباعة والمشاركة ---------- */

  window.stActionsHTML = function(fnPrint, fnShare){
    return `<div class="flexrow mtop2" style="gap:6px;flex-wrap:wrap">
      <button class="btn" onclick="${fnPrint}">🖨️ طباعة / PDF</button>
      <button class="btn ghost" onclick="${fnShare}">📤 مشاركة</button>
    </div>`;
  };

  console.log('[عمارتنا] مكوّن كشف الحساب جاهز');
})();

})();

/* ═══ emartna-statement.js ═══ */
(function(){
/* ============================================================
   عمارتنا — كشف حساب موحّد لكل حاجة
   ------------------------------------------------------------
   يفتح كشف حساب بفترة قابلة للاختيار لأي عنصر في البرنامج:

     الشقة/المحل · الحساب (خزينة/بنك) · المشروع
     المقاول/المورد · بند الصرف

   الكشف بيعرض: رصيد أول المدة · الوارد · المنصرف ·
   رصيد آخر المدة · وكل الحركات برصيد متراكم.
   ============================================================ */

(function(){
  'use strict';

  const S = () => (window.__stmt = window.__stmt || { from:'', to:'', kind:null, id:null });

  const esc2  = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const cash  = n => (window.money ? money(n) : String(n));
  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));

  /* ---------- بناء الحركات حسب نوع الكشف ---------- */

  function build(kind, id){
    const D = window.D;
    const unit = a => (window.unitLabel ? unitLabel(a) : (a ? ('وحدة ' + a.number) : '-'));
    const ap   = i => (D.apartments || []).find(x => x.id === i);
    const rows = [];
    let opening = 0, title = 'كشف حساب', subtitle = '';
    let inLabel = 'وارد', outLabel = 'منصرف';

    if (kind === 'account'){
      const acc = (D.accounts || []).find(a => a.id === id);
      if (!acc) return null;
      title = 'كشف حساب: ' + acc.name;
      subtitle = (window.accTypeIcon?accTypeIcon(acc.type):'🏦') + ' ' +
        (window.accTypeLabel?accTypeLabel(acc.type):'حساب') +
        (acc.bankName ? ' — ' + acc.bankName : '');
      opening = Number(acc.opening) || 0;
      (D.ledger || []).forEach(l => {
        if (l.accountId !== id) return;
        if (l.type === 'دفعة') rows.push({ date:l.date, type:'تحصيل من ' + unit(ap(l.apartmentId)), note:l.note, amount:+l.amount, dir:1 });
        if (l.type === 'صرف')  rows.push({ date:l.date, type:'صرف/استرداد لـ' + unit(ap(l.apartmentId)), note:l.note, amount:+l.amount, dir:-1 });
      });
      (D.expenses || []).forEach(e => {
        if (e.accountId === id) rows.push({ date:e.date, type:'مصروف: ' + (e.category||'أخرى'), note:e.description, amount:+e.amount, dir:-1 });
      });
      (D.transfers || []).forEach(t => {
        if (t.from === id) rows.push({ date:t.date, type:'تحويل صادر', note:t.note, amount:+t.amount, dir:-1 });
        if (t.to   === id) rows.push({ date:t.date, type:'تحويل وارد', note:t.note, amount:+t.amount, dir:1 });
      });
    }

    else if (kind === 'apartment'){
      const a = ap(id);
      if (!a) return null;
      title = 'كشف حساب: ' + unit(a);
      subtitle = a.ownerName || '';
      opening = Number(a.openingBalance) || 0;
      inLabel = 'مستحق'; outLabel = 'مدفوع';
      (D.ledger || []).forEach(l => {
        if (l.apartmentId !== id) return;
        const t = l.type;
        const dir = (t === 'دفعة') ? -1 : (t === 'صرف') ? 1 : (t === 'تسوية') ? 1 : 1;
        const label = t === 'شهري' ? ('اشتراك ' + (l.month || ''))
                    : t === 'مشروع' ? ('مشروع: ' + (l.project || ''))
                    : t === 'دفعة'  ? 'دفعة'
                    : t === 'صرف'   ? 'استرداد'
                    : 'تسوية';
        rows.push({ date:l.date, type:label, note:l.note, amount:Math.abs(+l.amount), dir: (+l.amount < 0 ? -dir : dir) });
      });
    }

    else if (kind === 'project'){
      const p = (D.projects || []).find(x => x.id === id);
      if (!p) return null;
      title = 'كشف حساب مشروع: ' + p.name;
      subtitle = p.description || '';
      inLabel = 'محصّل'; outLabel = 'مصروف';
      (D.ledger || []).forEach(l => {
        if (l.projectId !== id) return;
        if (l.type === 'دفعة') rows.push({ date:l.date, type:'سداد مساهمة — ' + unit(ap(l.apartmentId)), note:l.note, amount:+l.amount, dir:1 });
      });
      (D.expenses || []).forEach(e => {
        if (e.projectId === id) rows.push({ date:e.date, type:'مصروف: ' + (e.category||'أخرى'), note:e.description, amount:+e.amount, dir:-1 });
      });
    }

    else if (kind === 'vendor'){
      const v = (D.vendors || []).find(x => x.id === id);
      if (!v) return null;
      title = 'كشف حساب: ' + v.name;
      subtitle = v.category || '';
      inLabel = '—'; outLabel = 'مدفوع له';
      (D.expenses || []).forEach(e => {
        if (e.vendorId === id) rows.push({ date:e.date, type:'مصروف: ' + (e.category||'أخرى'), note:e.description, amount:+e.amount, dir:-1 });
      });
    }

    else if (kind === 'category'){
      title = 'كشف بند صرف: ' + id;
      inLabel = '—'; outLabel = 'مصروف';
      (D.expenses || []).forEach(e => {
        if ((e.category || 'أخرى') === id) rows.push({ date:e.date, type:e.description || 'مصروف', note:(e.vendorId ? vendorName(e.vendorId) : ''), amount:+e.amount, dir:-1 });
      });
    }

    else return null;

    rows.sort((a,b) => (a.date||'').localeCompare(b.date||''));
    return { title, subtitle, opening, rows, inLabel, outLabel };
  }

  function vendorName(id){
    const v = ((window.D||{}).vendors || []).find(x => x.id === id);
    return v ? v.name : '';
  }

  /* ---------- أزرار الفترة ---------- */

  window.setStmtPeriod = function(months){
    const s = S();
    if (months === 'all'){ s.from = ''; s.to = ''; }
    else if (months === 'year'){
      s.from = new Date().getFullYear() + '-01-01';
      s.to   = today();
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() - months + 1);
      s.from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
      s.to   = today();
    }
    renderStatement();
  };

  window.applyStmtDates = function(){
    const s = S();
    const f = document.getElementById('stmtFrom'), t = document.getElementById('stmtTo');
    if (f) s.from = f.value || '';
    if (t) s.to   = t.value || '';
    renderStatement();
  };

  /* ---------- العرض ---------- */

  function renderStatement(){
    const s = S();
    const data = build(s.kind, s.id);
    const host = document.getElementById('stmtHost');
    if (!data || !host) return;

    const from = s.from, to = s.to;
    const before = data.rows.filter(r => from && (r.date || '') < from);
    const shown  = data.rows.filter(r => (!from || (r.date||'') >= from) && (!to || (r.date||'') <= to));

    let openBal = data.opening;
    before.forEach(r => { openBal += r.dir * r.amount; });

    const totalIn  = shown.filter(r => r.dir > 0).reduce((a,r) => a + r.amount, 0);
    const totalOut = shown.filter(r => r.dir < 0).reduce((a,r) => a + r.amount, 0);
    const closeBal = openBal + totalIn - totalOut;

    let run = openBal;
    const withBal = shown.map(r => { run += r.dir * r.amount; return Object.assign({}, r, { balance: run }); })
                         .slice().reverse();   // الأحدث فوق

    const cols = [
      { key:'date',    label:'التاريخ', value:r => r.date || '', cell:r => esc2(r.date || '') },
      { key:'type',    label:'البيان',  value:r => r.type || '', cell:r => esc2(r.type || '') },
      { key:'note',    label:'ملاحظة',  value:r => r.note || '', cell:r => esc2(r.note || '') },
      { key:'amount',  label:'المبلغ',  value:r => r.dir * r.amount,
        cell:r => `<span style="color:${r.dir>0?'var(--accent)':'var(--red)'}">${r.dir>0?'+':'−'}${cash(r.amount)}</span>` },
      { key:'balance', label:'الرصيد بعدها', value:r => r.balance, cell:r => cash(r.balance) },
    ];

    host.innerHTML = `
      <div class="grid g4 mtop">
        <div class="kpi"><div class="ic">📅</div><div class="lbl">رصيد أول المدة</div><div class="val" style="font-size:15px">${cash(openBal)}</div></div>
        <div class="kpi ok"><div class="ic">📥</div><div class="lbl">${esc2(data.inLabel)}</div><div class="val" style="font-size:15px">${cash(totalIn)}</div></div>
        <div class="kpi owe"><div class="ic">📤</div><div class="lbl">${esc2(data.outLabel)}</div><div class="val" style="font-size:15px">${cash(totalOut)}</div></div>
        <div class="kpi ${closeBal>=0?'ok':'owe'}"><div class="ic">🧾</div><div class="lbl">رصيد آخر المدة</div><div class="val" style="font-size:15px">${cash(closeBal)}</div></div>
      </div>
      <p class="small mtop">${shown.length} حركة في الفترة${before.length ? ` · ${before.length} حركة قبلها مضمومة في رصيد أول المدة` : ''}</p>
      <div class="mtop">${window.sortableTable('stmtTable', withBal, cols, null, {
        defaultKey:'date',
        emptyText:'مفيش حركات في الفترة دي',
        exportName: data.title,
      })}
      ${window.stActionsHTML?stActionsHTML('acctStPrint()','acctStShare()'):''}
      </div>`;

    /* بنحتفظ بالحساب للطباعة والمشاركة — بنفس شكل المكوّن الموحّد */
    window.__acctStCalc = {
      rows: withBal.slice().reverse().map(r => Object.assign({}, r, {
        __run: r.balance, __sign: r.dir, note: r.note || r.type,
      })),
      opening: openBal, closing: closeBal,
      charges: totalIn, payments: totalOut,
    };
    window.__acctStMeta = { title: data.title, subtitle: data.subtitle || '',
                            from: s.from, to: s.to };
  }

  window.acctStPrint = function(){
    if (window.stPrint && window.__acctStCalc)
      stPrint(window.__acctStCalc, window.__acctStMeta || {});
  };
  window.acctStShare = function(){
    if (window.stShare && window.__acctStCalc)
      stShare(window.__acctStCalc, window.__acctStMeta || {});
  };
  window.renderStatement = renderStatement;

  window.openStatement = function(kind, id){
    const data = build(kind, id);
    if (!data) return (window.showMessage ? showMessage('تعذّر فتح كشف الحساب') : null);
    const s = S();
    s.kind = kind; s.id = id;
    if (s.from === undefined) s.from = '';
    const btn = (label, arg) => `<button class="btn sm ghost" onclick="setStmtPeriod(${typeof arg==='string'?`'${arg}'`:arg})">${label}</button>`;

    window.openModal(`
      <h3>${esc2(data.title)}</h3>
      ${data.subtitle ? `<p class="small" style="color:var(--muted)">${esc2(data.subtitle)}</p>` : ''}
      <div class="card mtop">
        <div class="grid g2">
          <div class="field2"><label>من تاريخ</label><input id="stmtFrom" type="date" value="${s.from}" onchange="applyStmtDates()"></div>
          <div class="field2"><label>إلى تاريخ</label><input id="stmtTo" type="date" value="${s.to}" onchange="applyStmtDates()"></div>
        </div>
        <div class="flexrow mtop">
          ${btn('آخر 3 شهور',3)} ${btn('آخر 6 شهور',6)} ${btn('آخر 12 شهر',12)}
          ${btn('السنة الحالية','year')} ${btn('كل الفترة','all')}
        </div>
      </div>
      <div id="stmtHost"></div>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);

    renderStatement();
  };

  /* ---------- ربط الكشف بالشاشات الموجودة ---------- */

  // الحسابات (خزينة/بنك) — نستبدل الكشف القديم اللي مكانش فيه فترة
  window.openAccountStatement = id => openStatement('account', id);

  // بنود الصرف — الكشف القديم كان بيقرا حقول غلط فبيطلع أعمدة فاضية
  window.openCategoryDrilldown = cat => openStatement('category', cat);

  // زرار "كشف الحساب" جوه نوافذ المقاول والمشروع
  function addStatementButton(kind, id, label){
    setTimeout(() => {
      const box = document.getElementById('modalBox');
      if (!box) return;
      let bar = box.querySelector('.modal-actions');
      if (!bar){
        bar = document.createElement('div');
        bar.className = 'modal-actions';
        box.appendChild(bar);
      }
      if (bar.querySelector('.stmt-btn')) return;
      const b = document.createElement('button');
      b.className = 'btn gold sm stmt-btn';
      b.textContent = label;
      b.onclick = () => openStatement(kind, id);
      bar.insertBefore(b, bar.firstChild);
    }, 0);
  }

  const origVendor = window.openVendorDetailModal;
  if (origVendor) window.openVendorDetailModal = function(id){
    origVendor(id);
    addStatementButton('vendor', id, '🧾 كشف الحساب');
  };

  const origProject = window.viewProject;
  if (origProject) window.viewProject = function(id){
    origProject(id);
    addStatementButton('project', id, '🧾 كشف حساب المشروع');
  };

  console.log('[عمارتنا] كشف الحساب الموحّد جاهز');
})();

})();

/* ═══ emartna-reports.js ═══ */
(function(){
/* ============================================================
   عمارتنا — التقارير المحاسبية
   ------------------------------------------------------------
   تبويب جديد فيه:
     ١) ميزان المراجعة — حركة الفترة + الأرصدة + فحص سلامة القيود
                          + مقارنة بفترة سابقة
     ٢) أعمار الديون   — المتأخرات موزّعة حسب عمرها (٣٠/٦٠/٩٠/أكتر)
   ============================================================ */

(function(){
  'use strict';

  const cash  = n => (window.money ? money(n) : String(n));
  const esc2  = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));
  const unit  = a => (window.unitLabel ? unitLabel(a) : ('وحدة ' + (a ? a.number : '')));

  const R = () => (window.__rep = window.__rep || { from:'', to:'', cmp:'prev' });

  const prevDay = d => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate()-1); return x.toISOString().slice(0,10); };
  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0,10); };
  const daysBetween = (a, b) => Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000);

  /* ---------- أدوات الفترة ---------- */

  window.setRepPeriod = function(months){
    const s = R();
    if (months === 'all'){ s.from = ''; s.to = ''; }
    else if (months === 'year'){ s.from = new Date().getFullYear() + '-01-01'; s.to = today(); }
    else {
      const d = new Date(); d.setMonth(d.getMonth() - months + 1);
      s.from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
      s.to = today();
    }
    renderContent();
  };
  window.applyRepDates = function(){
    const s = R();
    const f = document.getElementById('repFrom'), t = document.getElementById('repTo');
    if (f) s.from = f.value || '';
    if (t) s.to = t.value || '';
    renderContent();
  };
  window.setRepCompare = function(v){ R().cmp = v; renderContent(); };

  function periodBar(showCompare){
    const s = R();
    const b = (label, arg) => `<button class="btn sm ghost" onclick="setRepPeriod(${typeof arg==='string'?`'${arg}'`:arg})">${label}</button>`;
    return `
    <div class="card">
      <div class="grid g2">
        <div class="field2"><label>من تاريخ</label><input id="repFrom" type="date" value="${s.from}" onchange="applyRepDates()"></div>
        <div class="field2"><label>إلى تاريخ</label><input id="repTo" type="date" value="${s.to}" onchange="applyRepDates()"></div>
      </div>
      <div class="flexrow mtop">
        ${b('الشهر الحالي',1)} ${b('آخر 3 شهور',3)} ${b('آخر 6 شهور',6)} ${b('آخر 12 شهر',12)}
        ${b('السنة الحالية','year')} ${b('كل الفترة','all')}
      </div>
      ${showCompare ? `
      <div class="field2 mtop"><label>قارن بـ</label>
        <select onchange="setRepCompare(this.value)">
          <option value="none"  ${s.cmp==='none' ?'selected':''}>بدون مقارنة</option>
          <option value="prev"  ${s.cmp==='prev' ?'selected':''}>الفترة السابقة مباشرة (نفس الطول)</option>
          <option value="year"  ${s.cmp==='year' ?'selected':''}>نفس الفترة من السنة اللي فاتت</option>
        </select>
      </div>` : ''}
    </div>`;
  }

  /* حدود الفترة الفعلية (لو فاضية → من أول حركة لآخر حركة) */
  function bounds(){
    const s = R();
    const D = window.D;
    const dates = []
      .concat((D.ledger||[]).map(x => x.date))
      .concat((D.expenses||[]).map(x => x.date))
      .filter(Boolean).sort();
    return {
      from: s.from || (dates[0] || today()),
      to:   s.to   || today(),
    };
  }

  function comparePeriod(from, to){
    const s = R();
    if (s.cmp === 'none') return null;
    if (s.cmp === 'year'){
      const shift = d => { const x = new Date(d+'T00:00:00'); x.setFullYear(x.getFullYear()-1); return x.toISOString().slice(0,10); };
      return { from: shift(from), to: shift(to), label: 'نفس الفترة من السنة اللي فاتت' };
    }
    const len = daysBetween(from, to);
    return { from: addDays(from, -(len+1)), to: addDays(to, -(len+1)), label: 'الفترة السابقة' };
  }

  /* ---------- ١) ميزان المراجعة ---------- */

  function movements(from, to){
    const D = window.D;
    const inR = d => d && d >= from && d <= to;
    const L = (D.ledger || []).filter(l => inR(l.date));
    const sum = arr => arr.reduce((a,x) => a + Number(x.amount || 0), 0);
    return {
      charges:   sum(L.filter(l => l.type === 'شهري')),
      projects:  sum(L.filter(l => l.type === 'مشروع')),
      adjust:    sum(L.filter(l => l.type === 'تسوية')),
      payments:  sum(L.filter(l => l.type === 'دفعة')),
      refunds:   sum(L.filter(l => l.type === 'صرف')),
      expenses:  sum((D.expenses || []).filter(e => inR(e.date))),
      transfers: sum((D.transfers || []).filter(t => inR(t.date))),
      count:     L.length + (D.expenses||[]).filter(e => inR(e.date)).length,
    };
  }

  function balancesAsOf(to){
    const D = window.D;
    const upto = d => !d || d <= to;
    const sum = arr => arr.reduce((a,x) => a + Number(x.amount || 0), 0);
    const L = (D.ledger || []).filter(l => upto(l.date));
    const E = (D.expenses || []).filter(e => upto(e.date));

    const apOpen  = (D.apartments || []).reduce((a,x) => a + (Number(x.openingBalance) || 0), 0);
    const accOpen = (D.accounts   || []).reduce((a,x) => a + (Number(x.opening)        || 0), 0);

    const charges  = sum(L.filter(l => l.type === 'شهري'));
    const projects = sum(L.filter(l => l.type === 'مشروع'));
    const adjust   = sum(L.filter(l => l.type === 'تسوية'));
    const payments = sum(L.filter(l => l.type === 'دفعة'));
    const refunds  = sum(L.filter(l => l.type === 'صرف'));
    const expenses = sum(E);

    const receivables = apOpen + charges + projects + adjust + refunds - payments;  // ذمم الملاك
    const treasury    = accOpen + payments - refunds - expenses;                     // أرصدة الحسابات
    const fund        = apOpen + accOpen + charges + projects + adjust - expenses;   // حقوق العمارة

    return { apOpen, accOpen, charges, projects, adjust, payments, refunds, expenses,
             receivables, treasury, fund, diff: (receivables + treasury) - fund };
  }

  /* أرصدة الوحدات حتى تاريخ: مدينون (مستحق) ودائنون (دفع مقدم) */
  function unitBalances(to){
    const D = window.D;
    const upto = d => !d || d <= to;
    let debit = 0, credit = 0;
    (D.apartments || []).forEach(a => {
      let b = Number(a.openingBalance) || 0;
      (D.ledger || []).forEach(l => {
        if (l.apartmentId !== a.id || !upto(l.date)) return;
        const amt = Number(l.amount) || 0;
        if (l.type === 'دفعة') b -= amt; else b += amt;
      });
      if (b > 0) debit += b; else credit += -b;
    });
    return { debit, credit };
  }

  /* أرصدة كل حساب على حدة حتى تاريخ */
  function accountBalances(to){
    const D = window.D;
    const upto = d => !d || d <= to;
    return (D.accounts || []).map(a => {
      let b = Number(a.opening) || 0;
      (D.ledger || []).forEach(l => {
        if (l.accountId !== a.id || !upto(l.date)) return;
        const amt = Number(l.amount) || 0;
        if (l.type === 'دفعة') b += amt;
        if (l.type === 'صرف')  b -= amt;
      });
      (D.expenses || []).forEach(e => { if (e.accountId === a.id && upto(e.date)) b -= Number(e.amount)||0; });
      (D.transfers || []).forEach(t => {
        if (!upto(t.date)) return;
        if (t.to === a.id)   b += Number(t.amount)||0;
        if (t.from === a.id) b -= Number(t.amount)||0;
      });
      return { name:a.name, type:a.type, balance:b };
    });
  }

  /* فحص سلامة القيود — بيدوّر على الحركات الناقصة أو الغريبة */
  function integrityChecks(){
    const D = window.D;
    const out = [];
    const apIds  = new Set((D.apartments || []).map(a => a.id));
    const accIds = new Set((D.accounts   || []).map(a => a.id));

    const noAccount = (D.ledger || []).filter(l => (l.type === 'دفعة' || l.type === 'صرف') && !l.accountId);
    if (noAccount.length) out.push({ t:'دفعات/مستردات غير مربوطة بحساب', n:noAccount.length,
      why:'الحركة دي مش بتظهر في رصيد أي حساب، فالخزينة هتبان أقل من الحقيقة.' });

    const expNoAcc = (D.expenses || []).filter(e => !e.accountId);
    if (expNoAcc.length) out.push({ t:'مصروفات غير مربوطة بحساب', n:expNoAcc.length,
      why:'المصروف مش هيتخصم من أي حساب، فالخزينة هتبان أعلى من الحقيقة.' });

    const orphanL = (D.ledger || []).filter(l => l.apartmentId && !apIds.has(l.apartmentId));
    if (orphanL.length) out.push({ t:'حركات مربوطة بوحدة محذوفة', n:orphanL.length,
      why:'الحركة موجودة في الخزينة بس مش بتظهر في كشف أي وحدة.' });

    const badAcc = (D.ledger || []).filter(l => l.accountId && !accIds.has(l.accountId))
      .concat((D.expenses || []).filter(e => e.accountId && !accIds.has(e.accountId)));
    if (badAcc.length) out.push({ t:'حركات مربوطة بحساب محذوف', n:badAcc.length, why:'مش بتظهر في كشف أي حساب.' });

    const noDate = (D.ledger || []).filter(l => !l.date)
      .concat((D.expenses || []).filter(e => !e.date));
    if (noDate.length) out.push({ t:'حركات بدون تاريخ', n:noDate.length,
      why:'مش هتظهر في أي تقرير بفترة محددة.' });

    const zero = (D.ledger || []).filter(l => !Number(l.amount))
      .concat((D.expenses || []).filter(e => !Number(e.amount)));
    if (zero.length) out.push({ t:'حركات بمبلغ صفر', n:zero.length, why:'غالبًا إدخال ناقص.' });

    const noFee = (D.apartments || []).filter(a => !a.closed && !Number(a.monthlyFee));
    if (noFee.length) out.push({ t:'وحدات بدون اشتراك شهري', n:noFee.length,
      why:'مش هتتحسب في التحصيل الشهري. لو ده مقصود تجاهل التنبيه.' });

    return out;
  }

  window.pageTrialBalance = function(){
    if (!window.D) return '<p class="small">مفيش بيانات</p>';
    const { from, to } = bounds();
    const cur = movements(from, to);
    const cmp = comparePeriod(from, to);
    const prev = cmp ? movements(cmp.from, cmp.to) : null;
    const bal  = balancesAsOf(to);
    const open = balancesAsOf(prevDay(from));   // أرصدة أول المدة
    const checks = integrityChecks();

    const pct = (a,b) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a-b)/b)*100);
    const chg = (a,b) => {
      if (!prev) return '';
      const p = pct(a,b);
      if (p === 0) return '<span class="badge n">=</span>';
      return p > 0 ? `<span class="badge g">▲ ${p}%</span>` : `<span class="badge r">▼ ${Math.abs(p)}%</span>`;
    };

    const row = (label, val, prevVal, hint) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${label}${hint?`<div class="small" style="color:var(--muted)">${hint}</div>`:''}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);font-weight:700">${cash(val)}</td>
        ${prev ? `<td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(prevVal)}</td>
                  <td style="padding:7px;border-bottom:1px solid var(--line)">${chg(val,prevVal)}</td>` : ''}
      </tr>`;

    const bRow = (label, o, c) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${label}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(o)}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${(c-o)>=0?'+':'−'}${cash(Math.abs(c-o))}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);font-weight:700">${cash(c)}</td>
      </tr>`;

    const head = `<tr>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">البيان</th>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">الفترة الحالية</th>
      ${prev ? `<th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">${esc2(cmp.label)}</th>
                <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">التغيّر</th>` : ''}
    </tr>`;

    const totalDue = cur.charges + cur.projects + cur.adjust;
    const prevDue  = prev ? prev.charges + prev.projects + prev.adjust : 0;
    const netCash  = cur.payments - cur.refunds - cur.expenses;
    const prevNet  = prev ? prev.payments - prev.refunds - prev.expenses : 0;
    const rate     = totalDue > 0 ? Math.round((cur.payments / totalDue) * 100) : null;

    return `
    <p class="small">ملخص محاسبي للفترة: المستحق مقابل المحصّل مقابل المصروف، وأرصدة آخر المدة، وفحص لسلامة القيود.</p>
    ${periodBar(true)}
    <p class="small mtop" style="color:var(--muted)">الفترة: ${esc2(from)} → ${esc2(to)} · ${cur.count} حركة</p>

    <div class="grid g4 mtop">
      <div class="kpi"><div class="ic">📄</div><div class="lbl">إجمالي المستحق</div><div class="val" style="font-size:15px">${cash(totalDue)}</div></div>
      <div class="kpi ok"><div class="ic">📥</div><div class="lbl">المحصّل</div><div class="val" style="font-size:15px">${cash(cur.payments)}</div></div>
      <div class="kpi owe"><div class="ic">📤</div><div class="lbl">المصروفات</div><div class="val" style="font-size:15px">${cash(cur.expenses)}</div></div>
      <div class="kpi ${rate!==null&&rate>=80?'ok':''}"><div class="ic">📊</div><div class="lbl">نسبة التحصيل</div><div class="val" style="font-size:15px">${rate===null?'-':rate+'%'}</div></div>
    </div>

    <div class="section-title"><h3>حركة الفترة</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${head}</thead>
      <tbody>
        ${row('اشتراكات شهرية مستحقة', cur.charges, prev&&prev.charges)}
        ${row('مساهمات مشاريع مستحقة', cur.projects, prev&&prev.projects)}
        ${row('تسويات', cur.adjust, prev&&prev.adjust, 'خصومات أو عكس مستحقات')}
        ${row('<b>إجمالي المستحق</b>', totalDue, prevDue)}
        ${row('المحصّل من الملاك', cur.payments, prev&&prev.payments)}
        ${row('مستردات للملاك', cur.refunds, prev&&prev.refunds)}
        ${row('المصروفات', cur.expenses, prev&&prev.expenses)}
        ${row('<b>صافي حركة الخزينة</b>', netCash, prevNet, 'المحصّل − المستردات − المصروفات')}
        ${row('تحويلات بين الحسابات', cur.transfers, prev&&prev.transfers, 'ما بتأثرش على الإجمالي')}
      </tbody>
    </table></div>

    <div class="section-title"><h3>ميزان المراجعة — أول المدة · الحركة · آخر المدة</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">الحساب</th>
        <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">رصيد ${esc2(from)}</th>
        <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">حركة الفترة</th>
        <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">رصيد ${esc2(to)}</th>
      </tr></thead>
      <tbody>
        ${bRow('ذمم الملاك (مستحق لم يُحصّل)', open.receivables, bal.receivables)}
        ${bRow('أرصدة الحسابات (خزينة + بنوك)', open.treasury, bal.treasury)}
        ${bRow('<b>إجمالي أصول العمارة</b>', open.receivables + open.treasury, bal.receivables + bal.treasury)}
        ${bRow('حقوق العمارة (الافتتاحي + المستحقات − المصروفات)', open.fund, bal.fund)}
      </tbody>
    </table>
    <p class="small mtop">${Math.abs(bal.diff) < 0.01
      ? '✅ <b>الميزان متوازن</b> — الأصول تساوي الحقوق بالضبط.'
      : `⚠️ <b>فرق غير متوازن: ${cash(bal.diff)}</b> — راجع فحص القيود تحت.`}</p></div>

    <div class="section-title"><h3>🔍 فحص سلامة القيود</h3></div>
    <div class="card">${checks.length ? checks.map(c => `
      <div class="flexrow" style="padding:7px 0;border-bottom:1px solid var(--line)">
        <span class="badge y" style="min-width:38px;text-align:center">${c.n}</span>
        <div style="flex:1"><b class="small">${esc2(c.t)}</b>
          <div class="small" style="color:var(--muted)">${esc2(c.why)}</div></div>
      </div>`).join('') : '<p class="small">✅ مفيش أي ملاحظات — كل الحركات مربوطة صح.</p>'}</div>`;
  };

  /* ---------- ٢) أعمار الديون ---------- */

  /* بنوزّع المدفوع على المستحقات بالأقدم أولًا، والباقي بيتحسب عمره من تاريخه */
  function agingFor(apId, asOf){
    const D = window.D;
    const rows = (D.ledger || []).filter(l => l.apartmentId === apId && (!l.date || l.date <= asOf));
    const dues = rows.filter(l => ['شهري','مشروع','تسوية','صرف'].includes(l.type))
                     .map(l => ({ date:l.date || asOf, amount:Number(l.amount) || 0, type:l.type }))
                     .filter(x => x.amount > 0)
                     .sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const a = (D.apartments || []).find(x => x.id === apId);
    const open = Number(a && a.openingBalance) || 0;
    if (open > 0) dues.unshift({ date: (dues[0] && dues[0].date) || asOf, amount: open, type:'رصيد افتتاحي' });

    // المدفوع = الدفعات + أي تسوية بالسالب (خصم) — الاتنين بيقلّلوا المستحق.
    // من غير التسويات السالبة، إجمالي أعمار الديون كان بيطلع أكبر من
    // إجمالي أرصدة الوحدات بقيمة الخصومات.
    let paid = rows.filter(l => l.type === 'دفعة')
                   .reduce((s,l) => s + (Number(l.amount)||0), 0)
             + rows.filter(l => Number(l.amount) < 0)
                   .reduce((s,l) => s + Math.abs(Number(l.amount)||0), 0);

    const buckets = { d30:0, d60:0, d90:0, more:0 };
    let oldest = null;
    for (const d of dues){
      let rem = d.amount;
      if (paid > 0){ const use = Math.min(paid, rem); paid -= use; rem -= use; }
      if (rem <= 0.001) continue;
      const age = daysBetween(d.date, asOf);
      if (oldest === null || age > oldest) oldest = age;
      if (age <= 30) buckets.d30 += rem;
      else if (age <= 60) buckets.d60 += rem;
      else if (age <= 90) buckets.d90 += rem;
      else buckets.more += rem;
    }
    const total = buckets.d30 + buckets.d60 + buckets.d90 + buckets.more;
    return { buckets, total, oldest, credit: paid };   // paid المتبقي = رصيد دائن
  }

  window.pageAging = function(){
    if (!window.D) return '<p class="small">مفيش بيانات</p>';
    const s = R();
    const asOf = s.to || today();
    const list = (window.D.apartments || []).map(a => {
      const g = agingFor(a.id, asOf);
      return { a, ...g };
    });
    const debtors = list.filter(x => x.total > 0.001)
                        .sort((x,y) => (y.oldest||0) - (x.oldest||0) || y.total - x.total);
    const credits = list.filter(x => x.credit > 0.001);

    const sum = k => debtors.reduce((t,x) => t + x.buckets[k], 0);
    const t30 = sum('d30'), t60 = sum('d60'), t90 = sum('d90'), tmore = sum('more');
    const grand = t30 + t60 + t90 + tmore;

    const cols = [
      { key:'unit',  label:'الوحدة',  value:x => x.a.number || 0, cell:x => `<b>${esc2(unit(x.a))}</b>` },
      { key:'owner', label:'المالك',  value:x => x.a.ownerName || '', cell:x => esc2(x.a.ownerName || '-') },
      { key:'phone', label:'الهاتف',  value:x => x.a.phone || '', cell:x => esc2(x.a.phone || '-') },
      { key:'d30',   label:'حتى 30 يوم', value:x => x.buckets.d30,  cell:x => x.buckets.d30  ? cash(x.buckets.d30)  : '-' },
      { key:'d60',   label:'31 — 60',    value:x => x.buckets.d60,  cell:x => x.buckets.d60  ? cash(x.buckets.d60)  : '-' },
      { key:'d90',   label:'61 — 90',    value:x => x.buckets.d90,  cell:x => x.buckets.d90  ? `<span style="color:var(--red)">${cash(x.buckets.d90)}</span>` : '-' },
      { key:'more',  label:'أكثر من 90', value:x => x.buckets.more, cell:x => x.buckets.more ? `<span style="color:var(--red)"><b>${cash(x.buckets.more)}</b></span>` : '-' },
      { key:'total', label:'الإجمالي',   value:x => x.total, cell:x => `<b>${cash(x.total)}</b>` },
      { key:'age',   label:'أقدم دين',   value:x => x.oldest || 0, cell:x => x.oldest === null ? '-' :
          `<span class="badge ${x.oldest>90?'r':x.oldest>60?'y':'n'}">${x.oldest} يوم</span>` },
      { key:'x', label:'', value:null, cell:x => `<button class="btn sm ghost" onclick="openApartmentDetail('${x.a.id}')">كشف</button>` },
    ];

    return `
    <p class="small">المتأخرات موزّعة حسب عمر الدين. الدفعات بتتخصم من الأقدم أولًا، فالمبالغ في خانة "أكثر من 90" هي فعلًا أقدم مستحقات لسه ما اتسددتش.</p>
    ${periodBar(false)}
    <p class="small mtop" style="color:var(--muted)">الأعمار محسوبة حتى: ${esc2(asOf)}</p>

    <div class="grid g4 mtop">
      <div class="kpi"><div class="ic">🕐</div><div class="lbl">حتى 30 يوم</div><div class="val" style="font-size:15px">${cash(t30)}</div></div>
      <div class="kpi"><div class="ic">🕑</div><div class="lbl">31 — 60 يوم</div><div class="val" style="font-size:15px">${cash(t60)}</div></div>
      <div class="kpi owe"><div class="ic">🕒</div><div class="lbl">61 — 90 يوم</div><div class="val" style="font-size:15px">${cash(t90)}</div></div>
      <div class="kpi owe"><div class="ic">🚨</div><div class="lbl">أكثر من 90 يوم</div><div class="val" style="font-size:15px">${cash(tmore)}</div></div>
    </div>
    <p class="small mtop"><b>إجمالي المتأخرات: ${cash(grand)}</b> على ${debtors.length} وحدة${
      credits.length ? ` · و${credits.length} وحدة عندها رصيد دائن (دفع مقدم)` : ''}</p>

    <div class="mtop">${window.sortableTable('agingTable', debtors, cols, null, {
      defaultKey:'age', emptyText:'🎉 مفيش أي متأخرات', exportName:'أعمار الديون'
    })}</div>`;
  };


  /* ---------- ٣) قائمة الدخل ---------- */

  function expensesByCategory(from, to){
    const D = window.D;
    const map = {};
    (D.expenses || []).forEach(e => {
      const d = e.date || '';
      if (d < from || d > to) return;
      const c = e.category || 'أخرى';
      map[c] = (map[c] || 0) + (Number(e.amount) || 0);
    });
    return Object.keys(map).map(c => ({ category:c, amount:map[c] }))
                 .sort((a,b) => b.amount - a.amount);
  }

  window.pageIncomeStatement = function(){
    if (!window.D) return '<p class="small">مفيش بيانات</p>';
    const { from, to } = bounds();
    const cur = movements(from, to);
    const cmp = comparePeriod(from, to);
    const prev = cmp ? movements(cmp.from, cmp.to) : null;

    // أساس الاستحقاق: الإيراد وقت ما يستحق. الأساس النقدي: وقت ما يتحصّل.
    const accIncome = cur.charges + cur.projects + cur.adjust;
    const accResult = accIncome - cur.expenses;
    const cashIn    = cur.payments - cur.refunds;
    const cashResult= cashIn - cur.expenses;

    const pAccIncome = prev ? prev.charges + prev.projects + prev.adjust : 0;
    const pAccResult = prev ? pAccIncome - prev.expenses : 0;

    const cats  = expensesByCategory(from, to);
    const pCats = prev ? expensesByCategory(cmp.from, cmp.to) : [];
    const pCat  = c => (pCats.find(x => x.category === c) || {}).amount || 0;
    const maxCat = Math.max(...cats.map(c => c.amount), 1);

    const pct = (a,b) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a-b)/b)*100);
    const chg = (a,b) => {
      if (!prev) return '';
      const p = pct(a,b);
      if (p === 0) return '<span class="badge n">=</span>';
      return p > 0 ? `<span class="badge g">▲ ${p}%</span>` : `<span class="badge r">▼ ${Math.abs(p)}%</span>`;
    };
    const line = (label, v, pv, bold, hint) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${bold?`<b>${label}</b>`:label}
          ${hint?`<div class="small" style="color:var(--muted)">${hint}</div>`:''}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);${bold?'font-weight:700':''}">${cash(v)}</td>
        ${prev ? `<td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(pv)}</td>
                  <td style="padding:7px;border-bottom:1px solid var(--line)">${chg(v,pv)}</td>` : ''}
      </tr>`;
    const th = `<tr>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">البيان</th>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">الفترة</th>
      ${prev ? `<th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">${esc2(cmp.label)}</th>
                <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">التغيّر</th>` : ''}
    </tr>`;

    return `
    <p class="small">إيرادات العمارة مقابل مصروفاتها خلال الفترة، وفائض أو عجز الفترة. معروضة بالأساسين: الاستحقاق (المستحق) والنقدي (المحصّل فعلًا).</p>
    ${periodBar(true)}
    <p class="small mtop" style="color:var(--muted)">الفترة: ${esc2(from)} → ${esc2(to)}</p>

    <div class="grid g3 mtop">
      <div class="kpi ok"><div class="ic">📥</div><div class="lbl">إجمالي الإيرادات المستحقة</div><div class="val" style="font-size:15px">${cash(accIncome)}</div></div>
      <div class="kpi owe"><div class="ic">📤</div><div class="lbl">إجمالي المصروفات</div><div class="val" style="font-size:15px">${cash(cur.expenses)}</div></div>
      <div class="kpi ${accResult>=0?'ok':'owe'}"><div class="ic">${accResult>=0?'📈':'📉'}</div><div class="lbl">${accResult>=0?'فائض الفترة':'عجز الفترة'}</div><div class="val" style="font-size:15px">${cash(Math.abs(accResult))}</div></div>
    </div>

    <div class="section-title"><h3>الإيرادات</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${th}</thead><tbody>
        ${line('اشتراكات شهرية', cur.charges, prev&&prev.charges)}
        ${line('مساهمات مشاريع', cur.projects, prev&&prev.projects)}
        ${line('تسويات', cur.adjust, prev&&prev.adjust, false, 'خصومات أو إضافات على الملاك')}
        ${line('إجمالي الإيرادات', accIncome, pAccIncome, true)}
      </tbody></table></div>

    <div class="section-title"><h3>المصروفات حسب البند</h3></div>
    <div class="card">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>${th}</thead><tbody>
          ${cats.length ? cats.map(c => `
          <tr>
            <td style="padding:7px;border-bottom:1px solid var(--line)">
              ${esc2(c.category)}
              <div style="height:6px;background:var(--line);border-radius:4px;margin-top:5px;overflow:hidden">
                <div style="width:${(c.amount/maxCat*100).toFixed(0)}%;height:100%;background:var(--gold)"></div>
              </div>
              <div class="small" style="color:var(--muted)">${cur.expenses?Math.round(c.amount/cur.expenses*100):0}% من المصروفات</div>
            </td>
            <td style="padding:7px;border-bottom:1px solid var(--line)">${cash(c.amount)}</td>
            ${prev ? `<td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(pCat(c.category))}</td>
                      <td style="padding:7px;border-bottom:1px solid var(--line)">${chg(c.amount, pCat(c.category))}</td>` : ''}
          </tr>`).join('') : `<tr><td colspan="4" class="small" style="padding:10px">مفيش مصروفات في الفترة دي</td></tr>`}
          ${line('إجمالي المصروفات', cur.expenses, prev&&prev.expenses, true)}
        </tbody></table></div>

    <div class="section-title"><h3>النتيجة</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${th}</thead><tbody>
        ${line(accResult>=0?'فائض الفترة (أساس الاستحقاق)':'عجز الفترة (أساس الاستحقاق)', accResult, pAccResult, true,
               'الإيرادات المستحقة − المصروفات')}
        ${line('التدفق النقدي الفعلي', cashResult, prev ? (prev.payments-prev.refunds-prev.expenses) : 0, true,
               'المحصّل فعلًا − المستردات − المصروفات')}
        ${line('الفرق بين الاتنين', accResult - cashResult, null, false,
               'ده مقدار المستحق اللي لسه ما اتحصّلش في الفترة')}
      </tbody></table>
      <p class="small mtop">${accResult >= 0
        ? '✅ العمارة حققت فائض في الفترة دي على أساس الاستحقاق.'
        : '⚠️ المصروفات زادت عن الإيرادات المستحقة في الفترة دي.'}
        ${cashResult < 0 && accResult >= 0 ? ' لاحظ إن التدفق النقدي سالب رغم الفائض — يعني في مستحقات ما اتحصّلتش.' : ''}</p>
    </div>`;
  };

  /* ---------- ٤) الميزانية المصغرة ---------- */

  window.pageBalanceSheet = function(){
    if (!window.D) return '<p class="small">مفيش بيانات</p>';
    const { from, to } = bounds();
    const u  = unitBalances(to);
    const uo = unitBalances(prevDay(from));
    const accs  = accountBalances(to);
    const accsO = accountBalances(prevDay(from));

    const cashNow = accs.reduce((s,a) => s + a.balance, 0);
    const cashOld = accsO.reduce((s,a) => s + a.balance, 0);

    const assetsNow = cashNow + u.debit;
    const assetsOld = cashOld + uo.debit;
    const liabNow = u.credit, liabOld = uo.credit;
    const netNow = assetsNow - liabNow, netOld = assetsOld - liabOld;

    const m = movements(from, to);
    const surplus = m.charges + m.projects + m.adjust - m.expenses;
    const check = netNow - netOld - surplus;

    const r = (label, now, old, bold) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${bold?`<b>${label}</b>`:label}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);color:var(--muted)">${cash(old)}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line);${bold?'font-weight:700':''}">${cash(now)}</td>
      </tr>`;
    const th2 = `<tr>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">البند</th>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">${esc2(from)}</th>
      <th style="text-align:right;padding:7px;border-bottom:2px solid var(--line)">${esc2(to)}</th>
    </tr>`;

    return `
    <p class="small">مركز العمارة المالي: إيه اللي عندها، وإيه اللي عليها، وصافي حقوقها — في بداية الفترة ونهايتها.</p>
    ${periodBar(false)}

    <div class="grid g3 mtop">
      <div class="kpi ok"><div class="ic">🏦</div><div class="lbl">النقدية والبنوك</div><div class="val" style="font-size:15px">${cash(cashNow)}</div></div>
      <div class="kpi ${u.debit>0?'owe':''}"><div class="ic">📄</div><div class="lbl">مستحق على الملاك</div><div class="val" style="font-size:15px">${cash(u.debit)}</div></div>
      <div class="kpi"><div class="ic">🧮</div><div class="lbl">صافي أصول العمارة</div><div class="val" style="font-size:15px">${cash(netNow)}</div></div>
    </div>

    <div class="section-title"><h3>الأصول (اللي للعمارة)</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${th2}</thead><tbody>
        ${accs.map((a,i) => r((window.accTypeIcon?accTypeIcon(a.type):'🏦')+' ' + esc2(a.name), a.balance, (accsO[i]||{}).balance || 0)).join('')}
        ${r('مستحقات على الملاك (مدينون)', u.debit, uo.debit)}
        ${r('إجمالي الأصول', assetsNow, assetsOld, true)}
      </tbody></table></div>

    <div class="section-title"><h3>الالتزامات (اللي على العمارة)</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>${th2}</thead><tbody>
        ${r('دفعات مقدمة من الملاك (دائنون)', liabNow, liabOld)}
        ${r('إجمالي الالتزامات', liabNow, liabOld, true)}
      </tbody></table>
      <p class="small mtop">دي مبالغ دفعها ملاك زيادة عن المستحق عليهم، فهي حق ليهم على العمارة.</p></div>

    <div class="section-title"><h3>صافي حقوق العمارة</h3></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <tbody>
        ${r('صافي الأصول أول المدة', netOld, netOld)}
        ${r((surplus>=0?'+ فائض الفترة':'− عجز الفترة'), Math.abs(surplus), Math.abs(surplus))}
        ${r('= صافي الأصول آخر المدة', netNow, netNow, true)}
      </tbody></table>
      <p class="small mtop">${Math.abs(check) < 0.01
        ? '✅ <b>الميزانية متوازنة</b> — صافي الأصول أول المدة + نتيجة الفترة = صافي الأصول آخر المدة.'
        : `⚠️ <b>فرق ${cash(check)}</b> — في حركة تاريخها برّه الفترة أو قيد ناقص. راجع "فحص سلامة القيود" في ميزان المراجعة.`}</p>
    </div>`;
  };

  /* ---------- ربط التبويب في القائمة ---------- */

  function installNav(){
    const G = window.ADMIN_NAV_GROUPS;
    if (!G || G.some(g => g.key === 'reports')) return;
    // التبويب ده تابع لصلاحية "الماليات" — اللي مالوش صلاحية مالية مايشوفهوش
    const origPerm = window.hasGroupPermission;
    if (origPerm && !origPerm.__repPatched){
      window.hasGroupPermission = function(u, key){
        if (key === 'reports') return origPerm(u, 'finance');
        return origPerm.apply(this, arguments);
      };
      window.hasGroupPermission.__repPatched = true;
    }

    const item = { key:'reports', icon:'📑', label:'التقارير المحاسبية',
      items:[ ['trialBalance','⚖️','ميزان المراجعة'],
              ['incomeStatement','📈','قائمة الدخل'],
              ['balanceSheet','🧮','الميزانية المصغرة'],
              ['aging','⏳','أعمار الديون'] ] };
    const at = G.findIndex(g => g.key === 'finance');
    G.splice(at >= 0 ? at + 1 : G.length, 0, item);

    // عناوين الشاشات
    if (window.PAGE_TITLES){
      window.PAGE_TITLES.trialBalance = 'ميزان المراجعة';
      window.PAGE_TITLES.aging = 'أعمار الديون';
    }
  }

  // الراوتر بينده على الدوال بالاسم، فبنلفّه عشان نضيف الشاشتين
  const origRender = window.renderContent;
  window.renderContent = function(){
    const p = (typeof curPage !== 'undefined') ? curPage : '';
    const REPORTS = {
      trialBalance:    ['ميزان المراجعة',    pageTrialBalance],
      incomeStatement: ['قائمة الدخل',        pageIncomeStatement],
      balanceSheet:    ['الميزانية المصغرة',  pageBalanceSheet],
      aging:           ['أعمار الديون',       pageAging],
    };
    if (REPORTS[p]){
      const t = document.getElementById('pageTitle');
      if (t) t.textContent = REPORTS[p][0];
      const c = document.getElementById('content');
      if (c) c.innerHTML = REPORTS[p][1]();
      return;
    }
    return origRender.apply(this, arguments);
  };

  installNav();
  console.log('[عمارتنا] التقارير المحاسبية جاهزة');
})();

})();

/* ═══ emartna-admin.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تحكّم صاحب البرنامج
   ------------------------------------------------------------
   ١) الذكاء الاصطناعي: مقفول على رؤساء الاتحادات دلوقتي،
      وصاحب البرنامج يقدر يفتحه من "إعدادات الذكاء الاصطناعي"
      لما يجهّز. صاحب البرنامج نفسه بيستخدمه عادي.

   ٢) سجل الإصدارات: أي تطوير جديد بيتسجّل تلقائيًا كـ"داخلي
      فقط" أول ما صاحب البرنامج يدخل — وما يظهرش لرؤساء
      الاتحادات إلا لما هو يراجعه ويعلّمه "ظاهر".
   ============================================================ */

(function(){
  'use strict';

  const SETTING_KEY = 'ai_for_admins';

  /* ============================================================
     ١) قفل الذكاء الاصطناعي على رؤساء الاتحادات
     ============================================================ */

  // الافتراضي: مقفول. بيتقرا من إعدادات المنصة لو صاحب البرنامج فتحه.
  window.__aiForAdmins = false;

  function stripAITab(){
    const G = window.ADMIN_NAV_GROUPS;
    if (!G) return;
    G.forEach(g => {
      if (window.__aiForAdmins){
        // رجّعه لو كان متشال
        if (g.key === 'settings' && !g.items.some(it => it[0] === 'aireports')){
          const at = g.items.findIndex(it => it[0] === 'license');
          g.items.splice(at >= 0 ? at : g.items.length, 0, ['aireports','🤖','تقارير الذكاء الاصطناعي']);
        }
      } else {
        g.items = g.items.filter(it => it[0] !== 'aireports');
      }
    });
  }

  // حتى لو حد كتب العنوان بإيده، الشاشة نفسها مقفولة
  const origAIPage = window.pageAIReports;
  window.pageAIReports = function(){
    if (window.__aiForAdmins && origAIPage) return origAIPage.apply(this, arguments);
    return `<div class="card content-narrow">
      <h3>🤖 تقارير الذكاء الاصطناعي</h3>
      <p class="small mtop">الخدمة دي لسه تحت التجهيز ومش متاحة حاليًا.
      هتظهر لك هنا أول ما تتفعّل من إدارة البرنامج.</p>
    </div>`;
  };

  /* قراءة الإعداد من المنصة (متاح للقراءة للجميع) */
  async function loadAISetting(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { data, error } = await sb.from('platform_settings')
        .select('value').eq('key', SETTING_KEY).maybeSingle();
      if (error) return;
      const on = !!(data && (data.value === true || (data.value && data.value.enabled === true)));
      if (on !== window.__aiForAdmins){
        window.__aiForAdmins = on;
        stripAITab();
        if (window.renderRoot && window.currentUser && currentUser()) renderRoot();
      }
    }catch(e){ /* الافتراضي يفضل مقفول */ }
  }

  /* زرار التحكم لصاحب البرنامج */
  window.toggleAIForAdmins = async function(){
    const next = !window.__aiForAdmins;
    try{
      const sb = window.CLOUD._sb;
      const { error } = await sb.rpc('save_platform_doc',
        { p_key: SETTING_KEY, p_value: { enabled: next } });
      if (error) throw error;
      window.__aiForAdmins = next;
      stripAITab();
      if (window.toast) toast(next ? 'الخدمة اتفتحت لرؤساء الاتحادات' : 'الخدمة اتقفلت على رؤساء الاتحادات');
      if (window.renderSysContent) renderSysContent();
    }catch(e){
      if (window.showMessage) showMessage(e.message || 'تعذّر حفظ الإعداد');
    }
  };

  // نضيف كارت التحكم في شاشة إعدادات الذكاء الاصطناعي عند صاحب البرنامج
  const origSysAI = window.pageSysAISettings;
  if (origSysAI) window.pageSysAISettings = function(){
    const on = window.__aiForAdmins;
    return `
    <div class="card content-narrow" style="border:1px solid var(--line)">
      <h3>👁️ إتاحة الخدمة لرؤساء اتحادات الملاك</h3>
      <p class="small mtop">
        دلوقتي الخدمة <b>${on ? 'مفتوحة' : 'مقفولة'}</b> بالنسبة لرؤساء الاتحادات.
        ${on ? 'بيشوفوا تبويب "تقارير الذكاء الاصطناعي" ويقدروا يولّدوا تقارير عن عمارتهم.'
             : 'التبويب مخفي عندهم تمامًا. إنت بتستخدم الخدمة عادي من هنا.'}
      </p>
      <div class="flexrow mtop">
        <button class="btn ${on ? 'red' : 'primary'}" onclick="toggleAIForAdmins()">
          ${on ? '🔒 اقفل الخدمة عليهم' : '🔓 افتح الخدمة لهم'}
        </button>
      </div>
    </div>
    ${origSysAI.apply(this, arguments)}`;
  };

  /* ============================================================
     ٢) سجل الإصدارات التلقائي
     ============================================================ */

  /* أي تطوير جديد بيتضاف هنا. البرنامج بيسجّله تلقائيًا كـ"داخلي فقط". */
  const CHANGELOG = [
    { version:'1.06', date:'2026-09-02', notes:[
      'إصلاح حرج: البرنامج كان بيجيب مكتبة أساسية من موقع خارجي وقت كل فتح — '
        + 'ولو الموقع بطيء أو محجوب، تسجيل الدخول كان بيتقفل تمامًا. '
        + 'المكتبة بقت جوه البرنامج، فمفيش اعتماد على أي طرف تالت.',
      'صلاحيات السكان: رئيس اتحاد كل عمارة يحدد الشاشات اللي صاحب الشقة والمستأجر يفتحوها',
      'رقم الوحدة بقى موحّد في كل الشاشات — مفيش تكرار بين المحل والشقة',
    ]},
    { version:'1.05', date:'2026-09-02', notes:[
      'توزيع الأدوار: تحدد لكل دور كام شقة وكام محل — للعمارات اللي أدوارها مش متشابهة',
      'الدور اللي مفيهوش وحدات (جراج أو مدخل) بقى مقبول — سيبه صفر',
      'ترقيم الوحدات زي ما هو مكتوب على الباب: A-12 · محل ٣ · ١٢٠١',
      'اختيار نمط الترقيم وقت التسجيل: دور+رقم · متسلسل · بالنوع · مخصّص لكل دور',
      'قوالب ترقيم جاهزة تملا كل الوحدات بضغطة، مع منع تكرار الأرقام',
      'تعديل رقم الوحدة من الإكسل — عمود جديد في ملف التحديث',
      'خمس أشكال لواجهة العمارة: واجهة · شبكة · قائمة · خريطة حرارية · مصغّر',
      'الخريطة الحرارية بتوري حجم المتأخر باللون — مش وجوده بس',
      'الجداول بقى فيها اختيار عدد الصفوف (١٠ · ٢٠ · ٥٠ · ١٠٠ · الكل) مع تنقّل بين الصفحات',
      'عرض الجداول على الموبايل بقى كروت واضحة بدل السحب يمين وشمال',
      'حد المساعدين حسب الخطة — رئيس الاتحاد وأصحاب الوحدات مش محسوبين',
      'ربط عضو الإدارة بوحدته: حساب واحد يشوف صلاحياته وحسابه مع بعض',
      'التاريخ موحّد يوم/شهر/سنة في كل البرنامج مع توضيح بالعربي',
      'إصلاح: العمارة الجديدة كانت بتتحفظ على الجهاز بس وما توصلش الخادم',
      'إصلاح: عدد الوحدات كان بيتقص عند التسجيل لو أكبر من حد الخطة',
      'إصلاح: دعوة المحاسب أو الإداري كانت بتفشل',
      'إصلاح: رقم الشقة في الأدوار من العاشر فوق كان بيظهر ناقص (١٢٠١ تبان ٢٠١)',
      'إصلاح: الدور اللي فيه وحدة واحدة كان بياخد عرض الشاشة كله',
      'إصلاح: روابط واتساب كانت بتفتح على رقم فاضي',
      'إصلاح: آخر تعديل قبل قفل التبويب كان ممكن يضيع',
      'تسريع الدخول: الشاشة بتفتح بأول البيانات والباقي بيكمّل في الخلفية',
    ]},
    { version:'1.04', date:'2026-08-27', notes:[
      'الموقع اتنقل للعنوان الرئيسي myemartna.com',
      'نافذة ترحيب للزائر: يجرّب كرئيس اتحاد أو صاحب شقة، أو ياخد العرض المجاني',
      'حاسبة الاشتراك في الصفحة الرئيسية — اكتب عدد وحداتك وشوف سعرك فورًا',
      'الأسعار اتبسّطت لخطتين: شهري وسنوي، والسعر حسب عدد الوحدات',
      'العرض المجاني بقى شهرين لحد ١٠٠ وحدة بلا حد معاملات',
      'تقرير مصادر الزيارات: من فين جه الزائر وجرّب ولا سجّل',
      'قمع المبيعات: مين جرّب البرنامج وقعد قد إيه وساب رقمه',
      'مؤشر مباشر بيقولك مين بيجرّب البرنامج دلوقتي',
      'عمود آخر دخول لرئيس اتحاد كل عمارة',
      'كود الخصم بقى يوريك مين استفاد منه وتاريخ الاستفادة',
      'بطاقة الدعاية للطباعة بقى فيها كود QR وبيانات التواصل كاملة',
      'تنبيه بالحسابات اللي سجّلت ومالهاش عمارة، مع ربطها بضغطة',
      'العمارات التجريبية بتتمسح تلقائيًا خلال نص ساعة من آخر نشاط',
      'إصلاح: بيانات التواصل والروابط كانت بتتحفظ على جهاز واحد بس',
      'إصلاح: سجل الإصدارات ونصوص الصفحة الرئيسية ما كانتش بتوصل للعملاء',
      'إصلاح أمني: إعدادات المنصة كانت مقروءة لأي زائر',
    ]},
    { version:'1.03', date:'2026-08-18', notes:[
      'أيقونة التطبيق المثبّت بقت مطابقة للشعار الرسمي',
      'وضع الصيانة: صاحب البرنامج يقدر يوقف الموقع مؤقتًا بفترة محددة ورسالة للمستخدمين',
      'نسخة من بيانات العمارة بضغطة — تنزيل أو مشاركة على جيميل ودرايف وواتساب',
      'ملفات البرنامج بقت تتحمّل من الجهاز بدل الشبكة، مع تنبيه لما ينزل تحديث',
      'فلتر فترة على شاشات المصروفات والخزينة وسجل النشاط وطلبات الدفع',
      'عرض جدول أو مربعات وفلترة بالحالة في ٩ شاشات',
      'ترقيم إصدارات موحّد (v1.00 · v1.01 …) مرتّب بالإصدار',
      'إصلاح: حالة الاشتراك التجريبي كانت تظهر "منتهية" رغم وجود مدة متبقية',
      'إصلاح: دخول صاحب البرنامج لعمارة كان أحيانًا يفتح بحساب صاحب وحدة',
      'إصلاح: بعض العمليات كانت تفشل بسبب محاولة كتابة بيانات مش من صلاحية المستخدم',
      'تنظيف تلقائي يومي للحسابات المؤقتة الفاضية',
    ]},
    { version:'1.02', date:'2026-08-14', notes:[
      'تحديث بيانات الشقق والملاك بالإكسل — تنزيل قالب معبّى بكل الأعمدة، وتعديله خارجيًا، ورفعه بمراجعة تفصيلية قبل الاعتماد',
      'تحديث بيانات المستخدمين بالإكسل بنفس الطريقة، مع حماية آخر رئيس اتحاد من الإيقاف بالغلط',
      'تقرير بكل سطر ناجح وكل سطر فيه خطأ مع سببه ورقمه في الملف',
      'صور إثبات الدفع بقت تتخزن في مساحة تخزين مستقلة بدل قاعدة البيانات — مجلد لكل عمارة وجواه مجلد لكل شقة',
      'ضغط تلقائي للصور قبل الرفع (الصورة بقت أصغر ١١ مرة من غير ما تقل وضوحها)',
      'حذف تلقائي لصور الإيصالات بعد ٩٠ يوم من مراجعتها — الحركة المالية بتفضل بأثرها الكامل',
      'نسخة احتياطية كاملة بضغطة زرار لصاحب البرنامج',
      'رسائل أخطاء واضحة بالعربي بدل الرسائل التقنية، مع زرار إعادة محاولة عند فشل الحفظ',
      'تنبيه قبل قفل الصفحة لو في تغييرات لسه ما اتحفظتش',
      'إصلاح: العمارات كانت أحيانًا تظهر فاضية عند الدخول بسبب سبق تحميل الشاشة على البيانات',
      'إصلاح: توليد الدعوات كان بيفتح نافذة تأكيد حذف بالغلط',
      'إصلاح: أكواد الدعوات كانت بتفشل بعد تشديد إعدادات الأمان على الخادم',
      'إصلاح: بيانات التواصل وطرق السداد وتراخيص الاشتراكات مكانتش بتتحفظ على الخادم',
    ]},
    { version:'1.01', date:'2026-08-13', notes:[
      'تقارير محاسبية جديدة: ميزان المراجعة وأعمار الديون، مع فلترة بالتواريخ ومقارنة بفترات سابقة',
      'قائمة الدخل والميزانية المصغرة بأرصدة أول وآخر المدة',
      'كشف حساب موحّد لأي عنصر (شقة · حساب · مشروع · مورد · بند صرف) مع اختيار الفترة',
      'تقرير الأدوار: توزيع الوحدات على الأدوار مع نسبة تحصيل لكل دور',
      'سلة المحذوفات بقت تشتغل على الخادم — استعادة العمارات المحذوفة أو حذفها نهائيًا',
      'تحكّم في حجم النوافذ المنبثقة، وأزرار الحفظ والإغلاق بقت في أعلى النافذة',
      'توحيد سياسة كلمة المرور وشكل رقم الهاتف في كل شاشات البرنامج',
      'إصلاح: صورة إثبات الدفع كانت بتضيع بعد التحديث',
      'إصلاح: استرداد المبالغ وعكس الحركات المالية مكانوش بيتحفظوا على الخادم',
      'إصلاح: إشعارات قبول ورفض الدفعات والمقترحات مكانتش بتوصل للساكن',
      'إصلاح: العمارات اللي عندها أكتر من ١٠٠٠ حركة كانت بتتحمّل ناقصة',
    ]},
  ];

  /* ترقيم موحّد: النسخة الأساسية v1.00 واللي بعدها v1.01 · v1.02 …
     الأرقام القديمة (3.0 · 3.1 · 3.2) بتترحّل مرة واحدة. */
  const VERSION_MAP = { '3.0':'1.00', '3.1':'1.01', '3.2':'1.02',
                        '2.0':'1.00', '1.0':'1.00' };

  function migrateVersionNumbers(list){
    let changed = false;
    list.forEach(v => {
      const key = String(v.version || '').replace(/^v/i, '');
      if (VERSION_MAP[key] && key !== VERSION_MAP[key]){
        v.version = VERSION_MAP[key];
        changed = true;
      }
    });
    // دمج أي إصدارين بقوا بنفس الرقم بعد الترحيل
    const byVer = {};
    for (let i = list.length - 1; i >= 0; i--){
      const k = String(list[i].version);
      if (byVer[k]){
        byVer[k].notes = (byVer[k].notes || []).concat(list[i].notes || []);
        list.splice(i, 1);
        changed = true;
      } else byVer[k] = list[i];
    }
    return changed;
  }

  function seedChangelog(){
    if (!window.REG || !window.ensureVersionHistory) return;
    const list = ensureVersionHistory();
    let changed = migrateVersionNumbers(list);

    for (const entry of CHANGELOG){
      let v = list.find(x => String(x.version) === String(entry.version));
      if (!v){
        v = { id:'v_auto_' + entry.version.replace(/\./g,'_'),
              version: entry.version, date: entry.date, notes: [] };
        list.push(v);
        changed = true;
      }
      v.notes = v.notes || [];
      for (const text of entry.notes){
        if (!v.notes.some(n => n.text === text)){
          // داخلي فقط لحد ما صاحب البرنامج يراجعه ويعلّمه ظاهر
          v.notes.push({ text, visibleToAdmins: false, auto: true });
          changed = true;
        }
      }
    }

    if (changed){
      REG.versionHistory = list;
      try{
        if (window.PLATFORM && window.PLATFORM.save) window.PLATFORM.save();
        else if (window.saveRegistry) saveRegistry();
      }catch(e){ console.warn('[عمارتنا] تعذّر حفظ سجل الإصدارات', e.message); }
      console.log('[عمارتنا] اتسجّلت تحديثات جديدة في سجل الإصدارات (داخلي فقط)');
    }
  }


  /* ============================================================
     ٣) عمارات صاحب البرنامج — تحميل عند الطلب
     ------------------------------------------------------------
     عند الدخول بنحمّل بيانات العمارات اللي هو عضو فيها بس (عشان
     مانحملش عشرات العمارات كل مرة). النتيجة إن العمارات التانية
     كانت بتظهر في لوحة المنصة بصفر وحدات وصفر حركات، وزرار "فتح"
     كان بيقول "تعذر تحميل العمارة". دلوقتي بنحمّلها عند الحاجة.
     ============================================================ */

  const MAX_AUTO_LOAD = 30;      // فوق كده بنحمّل عند الفتح بس

  window.__loadingBuildings = false;

  /* ⚠️ كان بيحمّل ٣٠ عمارة كاملة (كل قيودها ومصروفاتها) عشان
     يعرض ٥ أرقام في جدول — ميجابايتات بتتنقل عشان مجاميع.
     دلوقتي الأرقام بتتحسب على السيرفر في طلب واحد (~٦٥٠ مللي
     لـ٢٨ عمارة)، والعمارة الكاملة بتتحمّل عند الفتح بس. */
  async function loadMissingBuildings(){
    if (window.__loadingBuildings) return;
    if (!window.CLOUD || !window.CLOUD._sb) return;
    if (!window.REG || !window.REG.buildings) return;

    window.__loadingBuildings = true;
    try{
      const { data, error } = await window.CLOUD._sb.rpc('buildings_overview');
      if (error || !data) return;

      const byUuid = {};
      data.forEach(r => { byUuid[r.building_id] = r; });

      let hit = 0;
      REG.buildings.forEach(b => {
        const r = byUuid[b.__uuid];
        if (!r) return;
        hit++;
        /* ملخّص خفيف للعرض — مش بديل عن بيانات العمارة الكاملة */
        b.__stats = {
          units: r.units, openUnits: r.open_units,
          withPhone: r.with_phone, withFee: r.with_fee,
          invited: r.invited, joined: r.joined, users: r.users_count,
          collected: Number(r.collected)||0, due: Number(r.due)||0,
          expenses: Number(r.expenses_total)||0, balance: Number(r.balance)||0,
          moves: r.moves, monthsSpan: r.months_span,
          accounts: r.accounts_count,
          lastActivity: r.last_activity, setupPct: r.setup_pct,
        };
      });
      /* إعادة رسم واحدة بعد ما البيانات توصل — مع علامة تمنع
         الجلب من يشتغل تاني من الرسم ده. */
      if (hit && window.renderSysContent){
        statsFetchedAt = Date.now();
        setTimeout(() => { try{ renderSysContent(); }catch(e){} }, 0);
      }
    }catch(e){
      console.warn('[عمارتنا] تعذّر جلب ملخّص العمارات', e.message);
    } finally {
      window.__loadingBuildings = false;
    }
  }

  window.reloadPlatformBuildings = loadMissingBuildings;

  /* لو السجل وصل متأخر (سباق البدء)، أعد التحميل أول ما يجهز */
  document.addEventListener('cloud:ready', () => {
    setTimeout(() => {
      if (window.isSysOwner && isSysOwner()){
        if (window.CLOUD && CLOUD._cache && CLOUD._cache.registry
            && window.REG !== CLOUD._cache.registry){
          window.REG = CLOUD._cache.registry;
          if (window.renderRoot) renderRoot();
        }
        loadMissingBuildings();
      }
    }, 300);
  });

  /* ⚠️ كان: كل رسم بينادي الجلب، والجلب بيعيد الرسم = حلقة.
     ظهرت في Network كـ٩ نداءات متطابقة لـbuildings_overview في
     أقل من ثانية، كل واحد ~٢٩٠ مللي.
     دلوقتي: الملخّص بيتجاب مرة واحدة لكل جلسة، وبيتحدّث بعد
     ٩٠ ثانية بس لو الشاشة لسه مفتوحة. */
  let statsFetchedAt = 0;
  const STATS_TTL = 90000;

  const origSysContent = window.renderSysContent;
  if (origSysContent) window.renderSysContent = function(){
    const out = origSysContent.apply(this, arguments);
    if (Date.now() - statsFetchedAt > STATS_TTL){
      statsFetchedAt = Date.now();
      setTimeout(loadMissingBuildings, 0);
    }
    return out;
  };

  /* زرار "فتح" لعمارة: حمّلها الأول لو مش متحمّلة */
  const origImpersonate = window.impersonateBuilding;
  if (origImpersonate) window.impersonateBuilding = function(buildingId){
    /* ⚠️ loadBuildingData بترجّع الملخّص لما العمارة مش محمّلة —
       فالشرط كان بينجح والعمارة بتتفتح بأرقام الجدول بدل بياناتها.
       لازم نتأكد إنها بيانات حقيقية مش ملخّص. */
    const cached = window.loadBuildingData(buildingId);
    if (cached && !cached.__summary) return origImpersonate(buildingId);
    if (window.toast) toast('بيحمّل بيانات العمارة…');
    /* لو التحميل وقف من غير خطأ (شبكة بطيئة أو رد ناقص)، الرسالة
       كانت بتفضل معلّقة والمستخدم مش عارف حصل إيه. */
    let done = false;
    const late = setTimeout(() => {
      if (!done && window.showMessage)
        showMessage('التحميل واخد وقت أطول من المتوقع.\n\n' +
          'لو الرسالة فضلت، حدّث الصفحة وجرّب تاني — ولو استمرت ابعتلي كود العمارة.');
    }, 12000);

    window.CLOUD.loadBuilding(buildingId)
      .then(() => { done = true; clearTimeout(late); origImpersonate(buildingId); })
      .catch(e => {
        done = true; clearTimeout(late);
        console.error('[عمارتنا] فشل تحميل العمارة', buildingId, e);
        if (window.showMessage)
          showMessage('تعذّر تحميل العمارة: ' + (e.message || e.code || 'سبب غير معروف'));
      });
  };


  /* ============================================================
     ٤) إعدادات حساب صاحب البرنامج — النسخة السحابية
     ------------------------------------------------------------
     الشاشة القديمة بتعدّل حساب محلي مالوش وجود في السحابة، فأي
     تغيير فيها مكانش بيتحفظ على الخادم — وبعدين الدخول بيفشل
     لأنه لسه بيتم برقم الموبايل وكلمة السر الحقيقيين.
     ============================================================ */

  function loginIdentity(){
    const u = (window.CLOUD_AUTH && CLOUD_AUTH.user) || null;
    if (!u) return { phone:'', email:'' };
    const em = u.email || '';
    if (em.endsWith('@emartna.local')){
      const d = em.split('@')[0];
      return { phone: '+' + d, email: '' };
    }
    return { phone:'', email: em };
  }

  window.changeMyCloudPassword = async function(){
    const p1 = (document.getElementById('cpNew')  || {}).value || '';
    const p2 = (document.getElementById('cpNew2') || {}).value || '';
    const perr = window.passwordPolicyError ? passwordPolicyError(p1)
               : (p1.length < 8 ? 'كلمة السر لازم ٨ خانات على الأقل' : null);
    if (perr) return showMessage(perr);
    if (p1 !== p2)     return showMessage('كلمتا السر مش متطابقتين');
    try{
      const { error } = await window.CLOUD._sb.auth.updateUser({ password: p1 });
      if (error) throw error;
      const f1 = document.getElementById('cpNew'), f2 = document.getElementById('cpNew2');
      if (f1) f1.value = ''; if (f2) f2.value = '';
      if (window.toast) toast('اتغيرت كلمة السر — استخدمها في الدخول الجاي');
    }catch(e){ showMessage(e.message || 'تعذّر تغيير كلمة السر'); }
  };

  window.changeMyDisplayName = async function(){
    const name = ((document.getElementById('cpName') || {}).value || '').trim();
    if (!name) return showMessage('اكتب الاسم');
    try{
      const sb = window.CLOUD._sb;
      const { error } = await sb.from('profiles')
        .update({ full_name: name }).eq('id', CLOUD_AUTH.user.id);
      if (error) throw error;
      if (window.toast) toast('اتحفظ الاسم');
    }catch(e){ showMessage(e.message || 'تعذّر حفظ الاسم'); }
  };

  const origSysSettings = window.pageSysSettings;
  if (origSysSettings) window.pageSysSettings = function(){
    const id = loginIdentity();
    const orig = origSysSettings.apply(this, arguments);
    // نشيل كارت "تغيير بيانات مسؤول النظام" القديم ونحط السحابي مكانه
    const cleaned = orig.replace(
      /<div class="card content-narrow"><h3>تغيير بيانات مسؤول النظام<\/h3>[\s\S]*?<\/div>\s*(?=<div class="card content-narrow mtop2">)/,
      '');

    return `
    <div class="card content-narrow">
      <h3>🔑 بيانات دخولك</h3>
      <p class="small mtop">الدخول بيتم برقم الموبايل أو الإيميل — مفيش اسم مستخدم.</p>
      <div class="field2 mtop"><label>بتدخل بـ</label>
        <input value="${esc(id.phone || id.email || '—')}" disabled
               style="background:var(--line);cursor:not-allowed"></div>
      <p class="small">لتغيير الرقم أو الإيميل نفسه، كلّم الدعم الفني — التغيير بيحتاج تأكيد الرقم الجديد.</p>

      <div class="field2 mtop2"><label>الاسم اللي بيظهر</label>
        <input id="cpName" value="${esc((window.CLOUD_AUTH && CLOUD_AUTH.user && CLOUD_AUTH.user.user_metadata && CLOUD_AUTH.user.user_metadata.full_name) || '')}" placeholder="مثال: حسن محمد"></div>
      <button class="btn sm" onclick="changeMyDisplayName()">💾 حفظ الاسم</button>

      <h3 class="mtop2">تغيير كلمة السر</h3>
      <div class="field2 mtop"><label>كلمة سر جديدة</label>${window.pwField ? pwField('cpNew','','','new-password') : '<input id="cpNew" type="password">'}</div>
      <div class="field2"><label>تأكيد كلمة السر</label>${window.pwField ? pwField('cpNew2','','','new-password') : '<input id="cpNew2" type="password">'}</div>
      <button class="btn primary mtop" onclick="changeMyCloudPassword()">🔒 غيّر كلمة السر</button>
      <p class="small mtop">٨ خانات على الأقل. التغيير بيسري فورًا على كل أجهزتك.</p>

      <h3 class="mtop2">💾 نسخة احتياطية</h3>
      <p class="small">بتنزّل ملف واحد فيه كل بيانات المنصة (العمارات · الوحدات · الحركات ·
      المستخدمين · الإعدادات). احتفظ بيه في مكان آمن — ده خط دفاعك الأخير.</p>
      <button class="btn gold mtop" onclick="downloadFullBackup()">⬇️ نزّل نسخة احتياطية كاملة</button>
    </div>
    ${cleaned}`;
  };


  /* ============================================================
     ٥) نسخة احتياطية كاملة — تنزيل كل بيانات المنصة كملف JSON
     ============================================================ */

  window.downloadFullBackup = async function(){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) return showMessage('طبقة السحابة لسه بتحمّل — جرّب بعد ثانية');
    if (window.toast) toast('بيجهّز النسخة… ممكن تاخد شوية');

    const TABLES = [
      'buildings','apartments','accounts','ledger','expenses','expense_categories',
      'transfers','projects','vendors','maintenance_reports','meetings','polls',
      'announcements','suggestions','payment_requests','notifications',
      'building_chat','activity_log','memberships','profiles','invitations',
      'plans','landing_offers','platform_settings','platform_admins','platform_invites',
      'renewal_requests','customer_proposals_v2','support_tickets','support_staff',
      'sys_notifications','team_tasks','revenue_ledger','referral_rewards',
    ];
    const PAGE = 1000;
    const out = { meta:{ takenAt:new Date().toISOString(), app:'عمارتنا', version:'backup-1' }, tables:{} };
    const failed = [];

    for (const t of TABLES){
      try{
        const rows = [];
        for (let from = 0; ; from += PAGE){
          const r = await sb.from(t).select('*').range(from, from + PAGE - 1);
          if (r.error) throw r.error;
          const batch = r.data || [];
          rows.push(...batch);
          if (batch.length < PAGE) break;
        }
        out.tables[t] = rows;
      }catch(e){
        failed.push(t + ' (' + (window.cloudErrorText ? cloudErrorText(e) : e.message) + ')');
      }
    }

    // الصور بتكبّر الملف جدًا — بنشيلها ونعدّها
    let images = 0;
    (out.tables.payment_requests || []).forEach(r => {
      if (r.proof_url && r.proof_url.length > 500){ r.proof_url = '[صورة محذوفة من النسخة]'; images++; }
    });
    out.meta.imagesStripped = images;
    out.meta.rowCounts = Object.fromEntries(
      Object.keys(out.tables).map(t => [t, out.tables[t].length]));

    const blob = new Blob([JSON.stringify(out, null, 1)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'emartna-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);

    const total = Object.values(out.meta.rowCounts).reduce((a,b) => a+b, 0);
    showMessage('✅ اتنزّلت نسخة فيها ' + total + ' سجل من ' +
      Object.keys(out.tables).length + ' جدول' +
      (images ? '\n(اتشال ' + images + ' صورة إثبات عشان الحجم)' : '') +
      (failed.length ? '\n\n⚠️ جداول ما اتقرتش:\n' + failed.join('\n') : ''));
  };

  /* ============================================================
     التشغيل
     ============================================================ */

  stripAITab();

  // (أ) اقرا إعداد الإتاحة أول ما طبقة السحابة تجهز
  let tries = 0;
  const t = setInterval(() => {
    if (++tries > 300) return clearInterval(t);
    if (window.CLOUD && window.CLOUD._sb){ clearInterval(t); loadAISetting(); }
  }, 100);

  // (ب) سجّل التحديثات الجديدة أول ما صاحب البرنامج يدخل — مستقل عن السحابة
  let seeded = false;
  const t2 = setInterval(() => {
    if (seeded) return clearInterval(t2);
    if (window.REG && window.isSysOwner && isSysOwner()){
      seeded = true;
      clearInterval(t2);
      seedChangelog();
      loadMissingBuildings();
    }
  }, 1000);
  setTimeout(() => clearInterval(t2), 15 * 60 * 1000);

  console.log('[عمارتنا] تحكّم صاحب البرنامج جاهز');
})();

})();

/* ═══ emartna-ui.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تحسينات الجداول
   ------------------------------------------------------------
   البحث في الجداول كان بيدوّر على "قيمة الفرز" مش على النص
   اللي إنت شايفه. يعني عمود "الوحدة" قيمته رقم (2) بس المعروض
   "محل 2" — فالبحث بكلمة "محل" مكانش بيلاقي حاجة.

   دلوقتي البحث بيدوّر على الاتنين: القيمة والنص المعروض.
   ============================================================ */

(function(){
  'use strict';

  const strip = html => String(html == null ? '' : html)
    .replace(/<[^>]*>/g, ' ')      // شيل الوسوم
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // كاش بسيط عشان مانحسبش نص الخلية كل ضغطة زرار
  const cellText = (col, row) => {
    if (!col.cell) return '';
    try { return strip(col.cell(row)); } catch (e) { return ''; }
  };

  const orig = window.getFilteredSortedRows;
  if (typeof orig !== 'function'){
    console.warn('[عمارتنا] مالقيتش دالة البحث في الجداول');
    return;
  }

  window.getFilteredSortedRows = function(tableId){
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    const st  = window.__sortState && window.__sortState[tableId];

    // من غير بحث نصّي، سيب السلوك الأصلي زي ما هو
    if (!cfg || !st || !st.q) return orig.apply(this, arguments);

    const q = String(st.q).toLowerCase().trim();
    const { rows, columns } = cfg;

    const matched = rows.filter(r => columns.some(c => {
      if (c.value){
        const v = c.value(r);
        if (v != null && String(v).toLowerCase().includes(q)) return true;
      }
      return cellText(c, r).includes(q);
    }));

    // نشغّل الأصلية على الصفوف المطابقة بس (عشان الفلاتر والترتيب يفضلوا زي ما هما)
    const savedRows = cfg.rows, savedQ = st.q;
    cfg.rows = matched; st.q = '';
    try{
      return orig.apply(this, arguments);
    } finally {
      cfg.rows = savedRows; st.q = savedQ;
    }
  };

  console.log('[عمارتنا] بحث الجداول بقى يشمل النص المعروض');
})();

})();

/* ═══ emartna-excel.js ═══ */
(function(){
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

  const AP_COLS = ['رمز الوحدة (لا تغيّره)','رقم الوحدة','الرقم المعروض (اختياري)',
    'المبنى/الفيلا','النوع (شقة/محل)',
    'الاستخدام','الدور','اسم المالك','اسم المستأجر','مفتاح الدولة','رقم الجوال',
    'البريد الإلكتروني','الاشتراك الشهري','رصيد افتتاحي','مغلقة (نعم/لا)','ملاحظات',
    'الرصيد الحالي (للعرض فقط)'];

  window.downloadApUpdateTemplate = function(){
    if (noXLSX()) return;
    const rows = (D.apartments || []).slice()
      .sort((a,b) => (Number(a.number)||0) - (Number(b.number)||0))
      .map(a => [ a.id, a.number, a.label || '', a.blockName || '',
                  a.type === 'shop' ? 'محل' : 'شقة',
                  a.usageType || '', a.floor || '',
                  a.ownerName || '', a.tenantName || '',
                  a.phoneCountry || '+20', String(a.phone || ''), a.email || '',
                  Number(a.monthlyFee) || 0, Number(a.openingBalance) || 0,
                  a.closed ? 'نعم' : 'لا', a.notes || '',
                  (window.apBalance ? apBalance(a.id) : '') ]);
    download(rows, AP_COLS, 'الشقق والملاك', 'الشقق والملاك',
      [14,10,16,14,12,12,14,20,18,10,15,24,14,12,12,22,16]);
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
    const uLabel = String(r[2] || '').trim();     // الرقم المعروض
    const type  = String(r[4] || '').trim();
    const cc    = String(r[9] || '+20').trim() || '+20';
    const phone = normPhone(r[10], cc);
    const email = String(r[11] || '').trim();
    const feeRaw= String(r[12] ?? '').trim();
    const openRaw=String(r[13] ?? '').trim();

    if (!num || !/^\d+$/.test(num))
      return { line, status:'error', label, why:'رقم الوحدة لازم يكون رقم' };
    if (seen.has(num))
      return { line, status:'error', label, why:'رقم الوحدة ده متكرر في السطر ' + seen.get(num) };
    seen.set(num, line);

    if (!String(r[7] || '').trim())
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
      label: uLabel,
      blockName: String(r[3] || '').trim(),
      type: type === 'محل' ? 'shop' : 'apartment',
      usageType: String(r[5] || '').trim(),
      floor: String(r[6] || '').trim(),
      ownerName: String(r[7] || '').trim(),
      tenantName: String(r[8] || '').trim(),
      phoneCountry: cc, phone, email,
      monthlyFee: feeRaw === '' ? Number(ap.monthlyFee) || 0 : Number(feeRaw),
      openingBalance: openRaw === '' ? Number(ap.openingBalance) || 0 : Number(openRaw),
      closed: isYes(r[14]),
      notes: String(r[15] || '').trim(),
    };

    const LBL = { number:'رقم الوحدة', label:'الرقم المعروض', blockName:'المبنى', type:'النوع', usageType:'الاستخدام',
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
  /* ⚠️ كانت position:absolute جوه الشريط: لو الشريط قريب من حافة
     الشاشة أو جوه عنصر بـoverflow، القائمة بتتقص ونصها يختفي.
     دلوقتي بتتثبّت على مستوى الصفحة بموضع محسوب، مع ضمان إنها
     جوه الشاشة من كل الجهات. */
  window.toggleExcelMenu = function(id){
    const m = document.getElementById(id);
    if (!m) return;
    const open = m.style.display === 'block';
    document.querySelectorAll('.excel-menu').forEach(x => x.style.display = 'none');
    if (open) return;

    const btn = m.previousElementSibling;
    m.style.display = 'block';
    if (btn && btn.getBoundingClientRect){
      const r = btn.getBoundingClientRect();
      const W = Math.min(300, window.innerWidth - 16);
      let left = Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8);
      let top  = r.bottom + 6;
      m.style.position = 'fixed';
      m.style.width    = W + 'px';
      m.style.minWidth = '0';
      m.style.left     = left + 'px';
      m.style.insetInlineEnd = 'auto';
      m.style.maxHeight = '70vh';
      m.style.overflowY = 'auto';
      m.style.top = top + 'px';
      /* لو مفيش مكان تحت، نفتحها فوق الزرار */
      const h = m.offsetHeight;
      if (top + h > window.innerHeight - 8)
        m.style.top = Math.max(8, r.top - h - 6) + 'px';
    }
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
    /* ⚠️ كنا بنستخدم getter/setter هنا، وده كان بيعمل حلقة لا نهائية:
       أي ملف يقرا الدالة بياخد لفّتنا، وبيحطها كأصل جوه لفّته،
       فلفّتنا تنادي لفّته اللي تنادي لفّتنا… لحد ما الشاشة تقع.
       الاستبدال المباشر + المراقبة أأمن. */
    {
      wrapper.__excelWrapped = true;
      window[name] = wrapper;
      let tries = 0;
      const t = setInterval(() => {
        if (++tries > 20) return clearInterval(t);
        const cur = window[name];
        if (cur === wrapper) return;
        // مهم: لو الملف اللي بعدنا لفّ لفّتنا (مش استبدلها)، منرجعش
        // لفّتنا فوقه — ده كان بيعمل حلقة لا نهائية وبيوقّع الشاشة.
        if (typeof cur === 'function' && !cur.__excelWrapped){
          const probe = cur.toString();
          if (probe.includes('__excelWrapped') || probe.includes('apply(this, arguments)')){
            // لفّة تانية فوقنا — نسيبها ونوقف المراقبة
            return clearInterval(t);
          }
        }
        raw = cur; window[name] = wrapper;
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


  /* ============================================================
     المكتبات الخارجية بتتحمّل عند الطلب — بنلفّ كل دالة بتستخدمها
     عشان تستنى التحميل الأول بدل ما تفشل.
     ============================================================ */
  (function lazyLibs(){
    const XLSX_FNS = ['downloadApartmentsTemplate','downloadBuildingsTemplate',
      'downloadLeadsTemplate','downloadStaffTemplate','exportSortableTableToExcel',
      'handleApartmentsFileUpload','handleBuildingsFileUpload','handleLeadsFileUpload',
      'handleStaffFileUpload','downloadApUpdateTemplate','downloadUsersUpdateTemplate',
      'handleApUpdateUpload','handleUsersUpdateUpload','printSortableTable'];

    XLSX_FNS.forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = function(){
        if (typeof XLSX !== 'undefined') return orig.apply(this, arguments);
        const self = this, args = arguments;
        if (window.toast) toast('بيحمّل مكتبة إكسيل…');
        return window.ensureXLSX()
          .then(() => orig.apply(self, args))
          .catch(err => showMessage(err.message || 'تعذّر تحميل مكتبة إكسيل'));
      };
    });

    // QR في بطاقة الدعاية
    ['renderPromoQR','openPromoCard','downloadPromoCard'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = function(){
        if (typeof QRCode !== 'undefined') return orig.apply(this, arguments);
        const self = this, args = arguments;
        return window.ensureQRCode()
          .then(() => orig.apply(self, args))
          .catch(() => orig.apply(self, args));
      };
    });
  })();

  console.log('[عمارتنا] تحديث الشقق والمستخدمين بالإكسل جاهز');
})();

})();

/* ═══ emartna-send.js ═══ */
(function(){
/* ============================================================
   عمارتنا — الإرسال بأكثر من قناة
   ------------------------------------------------------------
   أي زرار إرسال في البرنامج بقى يفتح نافذة اختيار:
       واتساب · رسالة SMS · بريد إلكتروني · نسخ النص
   بيشتغل على الموبايل واللابتوب، ومن غير أي خادم أو اشتراك
   خارجي — البرنامج بيفتح تطبيق المراسلة عند المستخدم.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* رقم دولي نضيف من غير + ولا مسافات — الشكل اللي واتساب بيفهمه */
  function waNumber(country, phone){
    let d = String(phone == null ? '' : phone).replace(/[^\d+]/g,'');
    if (!d) return '';
    if (d.startsWith('00')) d = '+' + d.slice(2);
    const cc = String(country || '+20');
    const e164 = d.startsWith('+') ? d : (cc + d.replace(/^0+/,''));
    return e164.replace(/\D/g,'');
  }
  /* ⚠️ ما بنحطّهاش على window: emartna-wa.js بيعرّف waNumber بتوقيع
     مختلف تمامًا — (كائن) بدل (دولة، رقم) — وبيتحمّل بعدنا فبيدوس.
     الدالة دي محلية وبتتنادى محليًا، فالتصادم مالوش أثر علينا.
     بس نشرها على window بيخلي أي كود جديد يقع في الفخ. */
  window.waNumberFromParts = waNumber;

  function isMobile(){
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }

  /* ---------- القنوات ---------- */

  window.sendVia = function(channel){
    const o = window.__sendCtx || {};
    const text = (document.getElementById('sendMsgBody') || {}).value || o.text || '';
    if (!text.trim()) return showMessage('اكتب الرسالة الأول');

    const num = waNumber(o.country, o.phone);
    const subject = o.subject || 'رسالة من عمارتنا';

    if (channel === 'whatsapp'){
      if (!num && o.requirePhone !== false)
        return showMessage('مفيش رقم موبايل مسجّل للمرسل إليه.');
      const url = num
        ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }

    else if (channel === 'sms'){
      if (!num) return showMessage('مفيش رقم موبايل مسجّل للمرسل إليه.');
      // iOS بيستخدم & بدل ? في فاصل النص
      const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
      window.location.href = `sms:+${num}${sep}body=${encodeURIComponent(text)}`;
    }

    else if (channel === 'email'){
      if (!o.email)
        return showMessage('مفيش بريد إلكتروني مسجّل — تقدر تنسخ النص وتبعته بنفسك.');
      window.location.href = `mailto:${encodeURIComponent(o.email)}` +
        `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    }

    else if (channel === 'copy'){
      const done = () => (window.toast ? toast('اتنسخت — تقدر تلزقها في أي تطبيق') : null);
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(text).then(done, done);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try{ document.execCommand('copy'); }catch(e){}
        document.body.removeChild(ta); done();
      }
      return;   // مانقفلش النافذة عشان يقدر يبعت بقناة تانية كمان
    }

    if (typeof o.onSent === 'function'){ try{ o.onSent(channel); }catch(e){} }
    if (o.closeAfter !== false && window.closeModal) closeModal();
  };

  /* ---------- النافذة الموحّدة ---------- */

  /* openSendModal({ title, text, phone, country, email, subject,
                     note, onSent, closeAfter, requirePhone }) */
  window.openSendModal = function(opts){
    const o = Object.assign({}, opts || {});
    window.__sendCtx = o;

    const num = waNumber(o.country, o.phone);
    const to  = num ? '+' + num : (o.email || '');
    const btn = (ch, icon, label, on, hint) => `
      <button class="btn ${on ? '' : 'ghost'}" onclick="sendVia('${ch}')" ${on?'':'disabled'}
        style="flex:1;min-width:130px;opacity:${on?1:.45}" title="${esc2(hint||'')}">
        ${icon} ${label}</button>`;

    openModal(`
      <h3>📤 ${esc2(o.title || 'إرسال رسالة')}</h3>
      ${to ? `<p class="small mtop">إلى: <b dir="ltr">${esc2(to)}</b>${
        o.email && num ? ` · <span dir="ltr">${esc2(o.email)}</span>` : ''}</p>` : ''}
      ${o.note ? `<p class="small" style="color:var(--muted)">${esc2(o.note)}</p>` : ''}

      <div class="field2 mtop">
        <label>نص الرسالة <span class="small" style="color:var(--muted)">(تقدر تعدّله قبل الإرسال)</span></label>
        <textarea id="sendMsgBody" rows="7" style="width:100%;font-size:13px;line-height:1.9">${esc2(o.text || '')}</textarea>
      </div>

      <div class="flexrow mtop" style="flex-wrap:wrap;gap:8px">
        ${btn('whatsapp','📱','واتساب', !!num || o.requirePhone === false,
              num ? '' : 'مفيش رقم موبايل مسجّل')}
        ${btn('sms','✉️','رسالة SMS', !!num, num ? '' : 'مفيش رقم موبايل مسجّل')}
        ${btn('email','📧','بريد إلكتروني', !!o.email, o.email ? '' : 'مفيش بريد مسجّل')}
        ${btn('copy','📋','نسخ النص', true)}
      </div>
      <p class="small mtop" style="color:var(--muted)">
        البرنامج بيفتح تطبيق المراسلة على جهازك — الرسالة مش بتتبعت من الخادم،
        فالمستقبل هيشوف إنها منك شخصيًا.
        ${isMobile() ? '' : ' (رسائل SMS بتحتاج موبايل — على اللابتوب استخدم واتساب أو البريد.)'}
      </p>

      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  /* ---------- ربط أزرار الإرسال الموجودة ---------- */

  /* ١) دعوة ساكن */
  const origInvite = window.sendInviteWhatsApp;
  if (origInvite) window.sendInviteWhatsApp = function(apId){
    try{
      const ap = (D.apartments || []).find(a => a.id === apId);
      const u  = (D.users || []).find(x => x.apartmentId === apId);
      if (!ap || !u || !u.inviteCode) return origInvite.apply(this, arguments);
      const bName = (D.building && D.building.name) || 'العمارة';
      const link  = (location.origin + location.pathname).replace(/emartna-cloud\.html$/, '') + 'join.html';
      const text  =
        `أهلًا ${ap.ownerName || ''} 👋\n` +
        `دي دعوتك للانضمام لتطبيق "${bName}".\n\n` +
        `🔑 كود الدعوة: ${u.inviteCode}\n` +
        `🔗 الرابط: ${link}?code=${u.inviteCode}\n\n` +
        `افتح الرابط وسجّل برقم موبايلك، وهتشوف حساب ${window.unitLabel ? unitLabel(ap) : ''} ` +
        `ومستحقاتك ومصروفات العمارة أول بأول.`;
      openSendModal({
        title: 'دعوة ' + (window.unitLabel ? unitLabel(ap) : ''),
        text, phone: ap.phone, country: ap.phoneCountry, email: ap.email,
        subject: 'دعوتك للانضمام لتطبيق ' + bName,
      });
    }catch(e){ return origInvite.apply(this, arguments); }
  };

  /* ٢) رسائل التسويق للعملاء المحتملين */
  const origLead = window.openLeadWhatsApp;
  if (origLead) window.openLeadWhatsApp = function(id){
    try{
      const lead = (window.ensureMarketingLeads ? ensureMarketingLeads() : (REG.marketingLeads || []))
        .find(l => l.id === id);
      if (!lead) return origLead.apply(this, arguments);
      const body = (document.getElementById('leadMsgBody') || {}).value || '';
      openSendModal({
        title: 'رسالة لـ' + (lead.name || ''),
        text: body, phone: lead.phone, country: lead.phoneCountry, email: lead.email,
        subject: 'تطبيق عمارتنا لإدارة اتحاد الملاك',
        onSent: () => { try{ if (window.markLeadContacted) markLeadContacted(id); }catch(e){} },
      });
    }catch(e){ return origLead.apply(this, arguments); }
  };

  /* ٣) عرض سعر مخصص لعميل */
  const origOffer = window.sendCustomOfferWhatsApp;
  if (origOffer) window.sendCustomOfferWhatsApp = function(){
    try{
      const before = window.open;
      let captured = null;
      window.open = url => { captured = url; return null; };     // نمسك الرابط بدل ما نفتحه
      origOffer.apply(this, arguments);
      window.open = before;
      if (!captured) return;
      const text = decodeURIComponent((captured.split('text=')[1] || ''));
      const num  = (captured.match(/wa\.me\/(\d+)/) || [])[1] || '';
      openSendModal({ title:'إرسال العرض', text, phone:num, country:'',
                      subject:'عرض اشتراك تطبيق عمارتنا', requirePhone:false });
    }catch(e){ window.open = window.open; return origOffer.apply(this, arguments); }
  };

  console.log('[عمارتنا] الإرسال بأكثر من قناة جاهز');
})();

})();

/* ═══ emartna-landing.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تطوير الصفحة الرئيسية
   ------------------------------------------------------------
   الهدف: الزائر يجرّب فورًا من غير تسجيل، ويفهم المميزات بعمق.
   ثلاث إضافات:
     ١) زرار تجربة فورية في الواجهة + شريط ثابت أثناء التصفح
     ٢) مميزات إضافية (التقارير المحاسبية · الإكسل · الإثباتات …)
     ٣) قسم لشركات إدارة العقارات + أرقام تثبت جدّية المنتج
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* ---------- ١) مميزات إضافية (بتتضاف من غير ما تلغي أي تعديل عملته) ---------- */

  const EXTRA_FEATURES = [
    { id:'accreports', icon:'⚖️', title:'تقارير محاسبية حقيقية',
      desc:'ميزان مراجعة · قائمة دخل · ميزانية · أعمار الديون — بأي فترة تختارها.',
      detail:'مش مجرد جداول: ميزان مراجعة بأرصدة أول وآخر المدة عشان تقفل أي شهر وتتأكد إن الترحيل مظبوط. قائمة دخل بالأساسين (المستحق والمحصّل فعليًا) عشان تعرف الفرق بينهم. ميزانية مصغرة توريك أصول العمارة والتزاماتها. وأعمار ديون بتوزّع المتأخرات على 30 و60 و90 يوم وأكتر، والدفعات بتتخصم من الأقدم أولًا زي المعايير المحاسبية.',
      benefit:'محاسب العمارة بيلاقي شغله جاهز، ورئيس الاتحاد بيعرف مين متأخر من إمتى بالظبط مش مجرد "عليه فلوس".' },
    { id:'audit', icon:'🔍', title:'فحص سلامة القيود',
      desc:'البرنامج بيراجع دفاترك بنفسه ويقولك لو في حاجة ناقصة.',
      detail:'بيدوّر تلقائيًا على: دفعات مش مربوطة بحساب · مصروفات بلا مصدر · حركات على وحدة اتحذفت · حركات بلا تاريخ أو بمبلغ صفر · وحدات بلا اشتراك شهري. ولكل ملاحظة بيقولك إيه أثرها على أرقامك بالظبط.',
      benefit:'بتكتشف الغلط قبل الجمعية العمومية مش بعدها.' },
    { id:'excel', icon:'📊', title:'تحديث بالإكسل',
      desc:'نزّل بياناتك معبّاة، عدّلها في إكسل، وارفعها بمراجعة قبل الاعتماد.',
      detail:'عندك 96 وحدة ومحتاج تدخّل أرقام موبايلاتهم؟ نزّل القالب وهو معبّى ببياناتك الحالية، عدّل في إكسل، وارفعه. البرنامج بيوريك كل تغيير (قبل وبعد) وكل سطر فيه خطأ مع سببه ورقمه في الملف — وبعدين إنت تعتمد.',
      benefit:'شغل ساعات بيتعمل في دقايق، ومن غير خوف إن حاجة تتكتب غلط.' },
    { id:'proofs', icon:'🧾', title:'إثباتات دفع محفوظة ومؤمّنة',
      desc:'الساكن يصوّر التحويل، والصورة تتحفظ في مكان آمن مربوط بشقته.',
      detail:'صورة الإيصال بتتضغط تلقائيًا وبتتخزن في مساحة مستقلة — مجلد لكل عمارة وجواه مجلد لكل شقة. محدش من عمارة تانية يقدر يشوفها، والعرض بروابط مؤقتة. وبعد المراجعة بمدة تحددها، الصورة بتتشال والحركة المالية بتفضل بأثرها الكامل.',
      benefit:'مستند إثبات لكل جنيه، من غير ما تتحمّل تخزين صور بالسنين.' },
    { id:'multi', icon:'🏢', title:'أكتر من عمارة في مكان واحد',
      desc:'لشركات الإدارة: كل عماراتك في لوحة واحدة، وكل عمارة معزولة عن التانية.',
      detail:'تدير عدد غير محدود من العمارات من حساب واحد، وتنتقل بينهم بضغطة. كل عمارة ليها كودها ورئيس اتحادها وسكانها وحساباتها المستقلة تمامًا — رئيس اتحاد عمارة مبيشوفش أي بيانات عمارة تانية، والعزل ده مطبّق في قاعدة البيانات نفسها مش بإخفاء أزرار.',
      benefit:'شركة الإدارة بتشوف الصورة الكاملة، والعميل مطمّن إن بياناته مقفولة عليه.' },
    { id:'anywhere', icon:'☁️', title:'شغّال من أي جهاز',
      desc:'بياناتك على الخادم — افتح من الموبايل أو اللابتوب وتلاقي كل حاجة.',
      detail:'كل حركة بتتحفظ على الخادم في أقل من ثانية. تسجّل دفعة من الموبايل وإنت في العمارة، وتفتح اللابتوب في البيت تلاقيها. ولو النت قطع، شغلك بيفضل محفوظ وبيتزامن أول ما يرجع، وفي مؤشر بيقولك حالة الحفظ.',
      benefit:'مفيش "الملف على الجهاز التاني" ولا خوف من ضياع البيانات.' },
  ];

  function mergeFeatures(){
    try{
      const ls = window.ensureLandingSettings ? ensureLandingSettings() : null;
      if (!ls) return;
      ls.features = ls.features || [];
      let added = 0;
      EXTRA_FEATURES.forEach(f => {
        if (!ls.features.some(x => x.id === f.id)){ ls.features.push(f); added++; }
      });
      return added;
    }catch(e){ return 0; }
  }

  /* ---------- ٢) التجربة الفورية ---------- */

  window.tryDemoNow = function(role){
    if (typeof window.loginAsDemo === 'function') return loginAsDemo(role || 'admin');
    if (window.goToLogin) goToLogin();
  };

  const DEMO_BLOCK = `
    <div style="background:linear-gradient(135deg,var(--accent),#0f7a6f);color:#fff;
                border-radius:16px;padding:22px;margin:18px auto;max-width:760px;text-align:center">
      <div style="font-size:26px">🎬</div>
      <h3 style="color:#fff;margin:6px 0">شوفه بنفسك قبل ما تسجّل</h3>
      <p class="small" style="color:#eafaf7;margin-bottom:14px">
        عمارة جاهزة بـ٢٨ وحدة وسنتين حركات مالية حقيقية — ادخل جرّب أي حاجة،
        وكل اللي هتعمله بيتمسح لما تخرج. من غير حساب ولا رقم موبايل.
      </p>
      <div class="flexrow" style="justify-content:center;flex-wrap:wrap;gap:10px">
        <button class="btn" style="background:#fff;color:var(--accent);font-weight:700"
          onclick="tryDemoNow('admin')">🏢 جرّب كرئيس اتحاد</button>
        <button class="btn ghost" style="border-color:#fff;color:#fff"
          onclick="tryDemoNow('owner')">🏠 جرّب كصاحب شقة</button>
      </div>
    </div>`;

  const STICKY = `
    <div id="landStickyCta" style="position:fixed;bottom:0;left:0;right:0;z-index:900;
         background:var(--panel);border-top:1px solid var(--line);padding:9px 12px;
         box-shadow:0 -4px 16px rgba(0,0,0,.08);display:none">
      <div class="flexrow" style="justify-content:center;gap:8px;flex-wrap:wrap">
        <button class="btn primary sm" onclick="tryDemoNow('admin')">🎬 جرّب دلوقتي مجانًا</button>
        <button class="btn ghost sm" onclick="openSignup()">أنشئ حساب</button>
      </div>
    </div>`;

  /* ---------- ٣) قسم الشركات والأرقام ---------- */

  const COMPANIES = `
    <div class="section-title" style="text-align:center"><h3>يناسب الاتنين</h3></div>
    <div class="grid g2" style="max-width:900px;margin:0 auto">
      <div class="card">
        <div style="font-size:30px">👤</div>
        <h3 class="mtop">رئيس اتحاد عمارة واحدة</h3>
        <p class="small mtop">بتدير عمارتك بنفسك ومحتاج تسيب ورا الكشكول والواتساب:
        تحصيل واضح · مصروفات موثّقة · وكل ساكن يشوف حسابه بنفسه فمحدش يسأل "أنا دفعت ولا لأ".</p>
        <p class="small" style="color:var(--accent)"><b>الأهم ليك:</b> شفافية توقف النقاش قبل ما يبدأ.</p>
      </div>
      <div class="card">
        <div style="font-size:30px">🏢</div>
        <h3 class="mtop">شركة إدارة عقارات</h3>
        <p class="small mtop">بتدير عمارات كتير لملّاك مختلفين: لوحة واحدة لكل العمارات ·
        عزل كامل بين كل عمارة والتانية · تقارير محاسبية جاهزة لكل عمارة على حدة ·
        وفريق شغل بصلاحيات محددة.</p>
        <p class="small" style="color:var(--accent)"><b>الأهم ليك:</b> تقارير جاهزة تسلّمها للمالك من غير شغل يدوي.</p>
      </div>
    </div>

    <div class="grid g4 mtop2" style="max-width:900px;margin:18px auto">
      ${[['٧٠+','شاشة وتقرير'],['٤','تقارير محاسبية'],['١٦','نوع بيانات محفوظ'],['٢٤/٧','من أي جهاز']]
        .map(([n,t]) => `<div class="card" style="text-align:center">
          <div style="font-size:24px;font-weight:800;color:var(--accent)">${n}</div>
          <div class="small">${t}</div></div>`).join('')}
    </div>`;

  /* ---------- التركيب ---------- */

  const origLanding = window.landingHTML;
  if (origLanding) window.landingHTML = function(){
    mergeFeatures();
    let html = origLanding.apply(this, arguments);

    // زرار التجربة تحت الواجهة مباشرة — قبل قسم المميزات
    const featuresMark = '<div class="section-title" style="text-align:center"><h3>مميزات البرنامج</h3>';
    const i = html.indexOf(featuresMark);
    if (i > -1){
      html = html.slice(0, i) + DEMO_BLOCK + html.slice(i);
    }else{
      // احتياط: بعد أول زرار "عندي حساب"
      const m = html.match(/<button class="btn ghost" onclick="goToLogin\(\)">[^<]*<\/button>/);
      html = m ? html.replace(m[0], m[0] + '</div>' + DEMO_BLOCK + '<div class="flexrow">')
               : DEMO_BLOCK + html;
    }

    // قسم الشركات قبل آخر قسم
    html += COMPANIES + STICKY;
    return html;
  };

  /* الشريط الثابت بيظهر بعد ما الزائر ينزل شوية */
  function watchScroll(){
    const bar = document.getElementById('landStickyCta');
    if (!bar) return;
    // الشريط ده للصفحة الرئيسية بس. لو المستخدم داخل البرنامج،
    // بيفضل مخفي — وإلا بيغطي أزرار الشريط الجانبي (زي "تسجيل الخروج").
    const onLanding = (typeof __viewMode !== 'undefined' && __viewMode === 'landing')
                   && !(window.getSession && getSession());
    if (!onLanding){ bar.style.display = 'none'; return; }
    bar.style.display = (window.scrollY > 420) ? 'block' : 'none';
  }
  window.addEventListener('scroll', watchScroll, { passive:true });
  setInterval(watchScroll, 1200);

  console.log('[عمارتنا] الصفحة الرئيسية المطوّرة جاهزة');
})();

})();

/* ═══ emartna-comm.js ═══ */
(function(){
/* ============================================================
   عمارتنا — عرض موحّد لشاشات التواصل مع الملاك
   ------------------------------------------------------------
   الإعلانات · الاستطلاعات · المقترحات · الاجتماعات
   لكل شاشة:
     • تبديل بين "📋 قائمة" و"🔲 مربعات"
     • فلاتر حسب الحالة (مفتوح · مقفول · تم الحل · منتهي …)
   العرض بالمربعات هو الشكل القديم زي ما هو — الجديد هو
   الجدول والفلاتر.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const V = {};                       // وضع العرض لكل شاشة
  const F = {};                       // الفلتر المختار لكل شاشة

  window.setCommView = function(key, mode){ V[key] = mode; renderContent(); };
  window.setCommFilter = function(key, val){ F[key] = val; renderContent(); };

  function toolbar(key, filters, counts){
    const mode = V[key] || 'cards';
    return `
    <div class="flexrow mtop" style="flex-wrap:wrap;gap:8px;align-items:center">
      <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
        <button class="btn sm ${mode==='table'?'primary':'ghost'}" style="border-radius:0"
          onclick="setCommView('${key}','table')">📋 قائمة</button>
        <button class="btn sm ${mode==='cards'?'primary':'ghost'}" style="border-radius:0"
          onclick="setCommView('${key}','cards')">🔲 مربعات</button>
      </span>
      <span style="flex:1"></span>
      ${filters.map(f => `
        <button class="btn sm ${(F[key]||filters[0].k)===f.k?'primary':'ghost'}"
          onclick="setCommFilter('${key}','${f.k}')">${f.label} (${counts[f.k] ?? 0})</button>`).join('')}
    </div>`;
  }

  const apply = (key, filters, items) => {
    const k = F[key] || filters[0].k;
    const f = filters.find(x => x.k === k) || filters[0];
    return f.test ? items.filter(f.test) : items;
  };
  const countAll = (filters, items) => {
    const c = {};
    filters.forEach(f => c[f.k] = f.test ? items.filter(f.test).length : items.length);
    return c;
  };

  /* ---------- ١) الإعلانات ---------- */

  const origAnn = window.pageAnnouncements;
  if (origAnn) window.pageAnnouncements = function(u){
    const isAdmin = u.role === 'admin';
    const items = [...(D.announcements || [])]
      .sort((x,y) => (y.date||'').localeCompare(x.date||''));
    const today = window.todayISO ? todayISO() : new Date().toISOString().slice(0,10);
    const monthAgo = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);

    const filters = [
      { k:'all',    label:'الكل' },
      { k:'recent', label:'آخر شهر', test:a => (a.date||'') >= monthAgo },
      { k:'old',    label:'أقدم',    test:a => (a.date||'') <  monthAgo },
      { k:'commented', label:'عليها تعليقات', test:a => (a.comments||[]).length > 0 },
    ];
    const counts = countAll(filters, items);
    const shown  = apply('ann', filters, items);

    const head = `${isAdmin?`<div class="flexrow"><button class="btn primary" onclick="openAnnModal()">+ إعلان جديد</button></div>`:''}
      ${toolbar('ann', filters, counts)}`;

    if ((V.ann || 'cards') === 'cards')
      return head + `<div class="grid g2 mtop">${shown.length
        ? shown.map(a => announcementCardHTML(a, u, isAdmin)).join('')
        : '<p class="small">لا توجد إعلانات مطابقة</p>'}</div>`;

    const cols = [
      { key:'date',  label:'التاريخ', value:a => a.date||'', cell:a => esc2(a.date||'-') },
      { key:'title', label:'العنوان', value:a => a.title||'', cell:a => `<b>${esc2(a.title||'')}</b>` },
      { key:'body',  label:'النص',    value:a => a.body||'',
        cell:a => `<span class="small">${esc2((a.body||'').slice(0,90))}${(a.body||'').length>90?'…':''}</span>` },
      { key:'comments', label:'تعليقات', value:a => (a.comments||[]).length,
        cell:a => (a.comments||[]).length ? `<span class="badge b">${(a.comments||[]).length}</span>` : '-' },
      { key:'x', label:'', value:null, cell:a => isAdmin
        ? `<div class="flexrow"><button class="btn sm" onclick="openAnnModal('${a.id}')">تعديل</button>
           <button class="btn sm red" onclick="deleteAnn('${a.id}')">حذف</button></div>` : '' },
    ];
    return head + `<div class="mtop">${sortableTable('annTable', shown, cols, null,
      { defaultKey:'date', emptyText:'لا توجد إعلانات مطابقة', exportName:'الإعلانات' })}</div>`;
  };

  /* ---------- ٢) الاجتماعات ---------- */

  const origMeet = window.pageMeetings;
  if (origMeet) window.pageMeetings = function(u){
    const items = [...(D.meetings || [])]
      .sort((a,b) => ((b.date||'')+(b.time||'')).localeCompare((a.date||'')+(a.time||'')));
    const filters = [
      { k:'upcoming', label:'قادمة',  test:m => m.status === 'scheduled' },
      { k:'done',     label:'منتهية', test:m => m.status === 'done' },
      { k:'cancelled',label:'ملغاة',  test:m => m.status === 'cancelled' },
      { k:'all',      label:'الكل' },
    ];
    const counts = countAll(filters, items);
    const shown  = apply('meet', filters, items);

    if ((V.meet || 'cards') === 'cards'){
      const html = origMeet.apply(this, arguments);
      return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/, '$1' + toolbar('meet', filters, counts));
    }

    const isAdmin = u.role === 'admin';
    const stLabel = m => m.status === 'scheduled' ? '<span class="badge b">📅 قادم</span>'
                     : m.status === 'cancelled' ? '<span class="badge r">ملغي</span>'
                     : '<span class="badge g">✅ منتهي</span>';
    const cols = [
      { key:'date',  label:'التاريخ', value:m => (m.date||'')+(m.time||''), cell:m => esc2((m.date||'-')+' '+(m.time||'')) },
      { key:'title', label:'الموضوع', value:m => m.title||'', cell:m => `<b>${esc2(m.title||'')}</b>` },
      { key:'place', label:'المكان',  value:m => m.location||'', cell:m => esc2(m.location||'-') },
      { key:'status',label:'الحالة',  value:m => m.status||'', cell:stLabel },
      { key:'out',   label:'النتائج', value:m => m.outcomes||'',
        cell:m => m.outcomes ? `<span class="small">${esc2(m.outcomes.slice(0,70))}</span>` : '-' },
      { key:'x', label:'', value:null, cell:m => isAdmin
        ? `<button class="btn sm" onclick="openMeetingModal('${m.id}')">تعديل</button>` : '' },
    ];
    return `${isAdmin?`<div class="flexrow"><button class="btn primary" onclick="openMeetingModal()">+ تحديد اجتماع جديد</button></div>`:''}
      ${toolbar('meet', filters, counts)}
      <div class="mtop">${sortableTable('meetTable', shown, cols, null,
        { defaultKey:'date', emptyText:'لا توجد اجتماعات مطابقة', exportName:'الاجتماعات' })}</div>`;
  };

  /* ---------- ٣) الاستطلاعات ---------- */

  const origPolls = window.pagePolls;
  if (origPolls) window.pagePolls = function(u){
    const items = [...(D.polls || [])]
      .sort((x,y) => (y.createdAt||'').localeCompare(x.createdAt||''));
    const filters = [
      { k:'open',   label:'مفتوحة', test:p => p.status === 'open' },
      { k:'closed', label:'مقفولة', test:p => p.status === 'closed' },
      { k:'all',    label:'الكل' },
    ];
    const counts = countAll(filters, items);
    const shown  = apply('poll', filters, items);

    if ((V.poll || 'cards') === 'cards'){
      window.__pollFilter = (F.poll === 'all' || !F.poll) ? (F.poll || 'open') : F.poll;
      const html = origPolls.apply(this, arguments);
      return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/, '$1' + toolbar('poll', filters, counts));
    }

    const isAdmin = u.role === 'admin';
    const votesOf = p => Object.keys(p.votes || {}).length;
    const cols = [
      { key:'title', label:'الاستطلاع', value:p => p.title||'', cell:p => `<b>${esc2(p.title||'')}</b>` },
      { key:'status',label:'الحالة', value:p => p.status||'',
        cell:p => p.status==='open' ? '<span class="badge g">🟢 مفتوح</span>' : '<span class="badge n">🔒 مقفول</span>' },
      { key:'votes', label:'الأصوات', value:votesOf, cell:p => String(votesOf(p)) },
      { key:'top',   label:'الأكثر تصويتًا', value:p => '',
        cell:p => { const c={}; Object.values(p.votes||{}).forEach(v => c[v]=(c[v]||0)+1);
          const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
          return top ? `${esc2(top[0])} <span class="small">(${top[1]})</span>` : '-'; } },
      { key:'x', label:'', value:null, cell:p => isAdmin
        ? `<button class="btn sm" onclick="openPollModal(null,null,null,'${p.id}')">تعديل</button>` : '' },
    ];
    return `${isAdmin?`<div class="flexrow"><button class="btn primary" onclick="openPollModal()">+ استطلاع جديد</button></div>`:''}
      ${toolbar('poll', filters, counts)}
      <div class="mtop">${sortableTable('pollTable', shown, cols, null,
        { defaultKey:'title', emptyText:'لا توجد استطلاعات مطابقة', exportName:'الاستطلاعات' })}</div>`;
  };

  /* ---------- ٤) المقترحات (فيها جدول بالفعل — بنضيف المربعات) ---------- */

  const origSug = window.pageSuggestions;
  if (origSug) window.pageSuggestions = function(u){
    const items = [...(D.suggestions || [])]
      .sort((x,y) => (y.date||'').localeCompare(x.date||''));
    const filters = [
      { k:'pending',  label:'تحت المراجعة', test:s => (s.status||'pending') === 'pending' },
      { k:'accepted', label:'تم الحل',      test:s => s.status === 'accepted' },
      { k:'rejected', label:'مرفوضة',       test:s => s.status === 'rejected' },
      { k:'all',      label:'الكل' },
    ];
    const counts = countAll(filters, items);

    if ((V.sug || 'table') === 'table'){
      const html = origSug.apply(this, arguments);
      return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/, '$1' + toolbar('sug', filters, counts));
    }

    const shown = apply('sug', filters, items);
    const badge = s => s.status === 'accepted' ? '<span class="badge g">✅ تم الحل</span>'
                    : s.status === 'rejected' ? '<span class="badge r">❌ مرفوض</span>'
                    : '<span class="badge y">⏳ تحت المراجعة</span>';
    return `${toolbar('sug', filters, counts)}
      <div class="grid g2 mtop">${shown.length ? shown.map(s => `
        <div class="card">
          <div class="flexrow" style="justify-content:space-between">
            <b>${esc2(s.title||'')}</b>${badge(s)}
          </div>
          <p class="small mtop">${esc2(s.text||'')}</p>
          <p class="small" style="color:var(--muted)">${esc2(s.authorLabel||'')} · ${esc2(s.date||'')}</p>
          ${s.adminNote ? `<p class="small" style="color:var(--accent)">رد الإدارة: ${esc2(s.adminNote)}</p>` : ''}
          ${u.role==='admin' && (s.status||'pending')==='pending' ? `<div class="flexrow mtop">
            <button class="btn sm primary" onclick="approveSuggestion('${s.id}')">قبول</button>
            <button class="btn sm ghost" onclick="rejectSuggestion('${s.id}')">رفض</button></div>` : ''}
        </div>`).join('') : '<p class="small">لا توجد مقترحات مطابقة</p>'}</div>`;
  };


  /* ---------- ٥) مقترحاتي مع صاحب البرنامج ---------- */

  const origMyProp = window.pageMyProposals;
  if (origMyProp) window.pageMyProposals = function(){
    const items = (window.myProposals ? myProposals() : []);
    const filters = [
      { k:'all',      label:'الكل' },
      { k:'pending',  label:'بانتظار المراجعة', test:p => (p.status||'pending') === 'pending' },
      { k:'reviewed', label:'تحت الدراسة',      test:p => p.status === 'reviewed' },
      { k:'done',     label:'تم الرد',          test:p => ['answered','done','accepted','rejected'].includes(p.status) },
    ];
    const counts = countAll(filters, items);

    if ((V.myprop || 'cards') === 'cards'){
      const html = origMyProp.apply(this, arguments);
      return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/, '$1' + toolbar('myprop', filters, counts));
    }

    const shown = apply('myprop', filters, items);
    const badge = s => s === 'pending' ? '<span class="badge y">بانتظار المراجعة</span>'
                   : s === 'reviewed' ? '<span class="badge b">تحت الدراسة</span>'
                   : '<span class="badge g">تم الرد</span>';
    const cols = [
      { key:'date',  label:'التاريخ', value:p => p.createdAt||'', cell:p => esc2((p.createdAt||'').slice(0,10) || '-') },
      { key:'title', label:'المقترح', value:p => p.title||'', cell:p => `<b>${esc2(p.title||'')}</b>` },
      { key:'desc',  label:'التفاصيل', value:p => p.description||'',
        cell:p => `<span class="small">${esc2((p.description||'').slice(0,80))}</span>` },
      { key:'status',label:'الحالة', value:p => p.status||'', cell:p => badge(p.status) },
      { key:'reply', label:'رد الإدارة', value:p => p.adminResponse||'',
        cell:p => p.adminResponse ? `<span class="small">${esc2(p.adminResponse.slice(0,70))}</span>` : '-' },
    ];
    return `<div class="flexrow"><button class="btn primary" onclick="openSubmitProposalModal()">+ تقديم مقترح جديد</button></div>
      ${toolbar('myprop', filters, counts)}
      <div class="mtop">${sortableTable('myPropTable', shown, cols, null,
        { defaultKey:'date', emptyText:'مفيش مقترحات مطابقة', exportName:'مقترحاتي' })}</div>`;
  };

  /* ---------- ٦) الدعم الفني ---------- */

  const origTickets = window.pageMySupportTickets;
  if (origTickets) window.pageMySupportTickets = function(){
    const items = (window.ensureSupportTickets ? ensureSupportTickets() : [])
      .filter(t => t.buildingId === window.activeBuildingId)
      .sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
    const filters = [
      { k:'open',   label:'مفتوحة',  test:t => ['open','new','pending'].includes(t.status||'open') },
      { k:'working',label:'جاري العمل', test:t => ['in_progress','working'].includes(t.status) },
      { k:'closed', label:'تم الحل',  test:t => ['closed','resolved','done'].includes(t.status) },
      { k:'all',    label:'الكل' },
    ];
    const counts = countAll(filters, items);

    if ((V.tick || 'cards') === 'cards'){
      const html = origTickets.apply(this, arguments);
      return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/, '$1' + toolbar('tick', filters, counts));
    }

    const shown = apply('tick', filters, items);
    const badge = t => ['closed','resolved','done'].includes(t.status) ? '<span class="badge g">✅ تم الحل</span>'
                   : ['in_progress','working'].includes(t.status) ? '<span class="badge b">🔧 جاري العمل</span>'
                   : '<span class="badge y">⏳ مفتوحة</span>';
    const cols = [
      { key:'date',   label:'التاريخ', value:t => t.createdAt||'', cell:t => esc2((t.createdAt||'').slice(0,10) || '-') },
      { key:'subject',label:'الموضوع', value:t => t.subject||'', cell:t => `<b>${esc2(t.subject||'')}</b>` },
      { key:'prio',   label:'الأولوية', value:t => t.priority||'', cell:t => esc2(t.priority||'-') },
      { key:'status', label:'الحالة', value:t => t.status||'', cell:badge },
      { key:'replies',label:'الردود', value:t => (t.replies||[]).length,
        cell:t => (t.replies||[]).length ? `<span class="badge b">${(t.replies||[]).length}</span>` : '-' },
      { key:'upd',    label:'آخر تحديث', value:t => t.updatedAt||'', cell:t => esc2((t.updatedAt||'').slice(0,10) || '-') },
    ];
    return `<div class="flexrow"><button class="btn primary" onclick="openTicketModal()">🎫 طلب دعم فني جديد</button></div>
      ${toolbar('tick', filters, counts)}
      <div class="mtop">${sortableTable('ticketTable', shown, cols, null,
        { defaultKey:'date', emptyText:'مفيش طلبات مطابقة', exportName:'طلبات الدعم' })}</div>`;
  };

  /* ---------- ٧) سجل النشاط: كروت كبديل للجدول ---------- */

  const origAct = window.pageActivity;
  if (origAct) window.pageActivity = function(){
    const items = [...(D.activityLog || [])].reverse();
    const filters = [{ k:'all', label:'الكل' }];
    const counts = { all: items.length };

    if ((V.act || 'table') === 'table'){
      const html = origAct.apply(this, arguments);
      return toolbar('act', filters, counts) + html;
    }
    return toolbar('act', filters, counts) + `
      <div class="grid g2 mtop">${items.slice(0,200).map(a => `
        <div class="card">
          <div class="flexrow" style="justify-content:space-between">
            <b>${esc2(a.action||'')}</b>
            <span class="small" style="color:var(--muted)">${esc2((a.date||'').slice(0,16))}</span>
          </div>
          <p class="small mtop">${esc2(a.detail||'')}</p>
          <p class="small" style="color:var(--muted)">${esc2(a.name||a.username||'')}</p>
        </div>`).join('') || '<p class="small">مفيش نشاط</p>'}</div>`;
  };

  /* ---------- ٨) الرخصة: الخطط جدول أو كروت ---------- */

  const origLic = window.pageLicense;
  if (origLic) window.pageLicense = function(){
    const plans = (window.ensurePlans ? ensurePlans() : (REG.plans || []))
      .filter(p => p.active !== false);
    const filters = [{ k:'all', label:'كل الخطط' }];
    const counts = { all: plans.length };
    const html = origLic.apply(this, arguments);

    if ((V.lic || 'cards') === 'cards')
      return html.replace(/(<div class="card[\s\S]*?<\/div>)/, '$1' + toolbar('lic', filters, counts));

    const cols = [
      { key:'name',  label:'الخطة', value:p => p.name||'', cell:p => `<b>${esc2((p.icon||'')+' '+(p.name||''))}</b>` },
      { key:'price', label:'السعر', value:p => Number(p.price)||0,
        cell:p => Number(p.price) ? money(p.price) : '<span class="badge g">مجاني</span>' },
      { key:'dur',   label:'المدة', value:p => p.durationMonths||0,
        cell:p => p.durationMonths ? p.durationMonths + ' شهر' : 'بلا نهاية' },
      { key:'units', label:'حد الوحدات', value:p => p.maxApartments||0,
        cell:p => p.maxApartments ? String(p.maxApartments) : 'غير محدود' },
      { key:'trx',   label:'حد المعاملات', value:p => p.maxTransactions||0,
        cell:p => p.maxTransactions ? String(p.maxTransactions) : 'غير محدود' },
      { key:'x', label:'', value:null,
        cell:p => `<button class="btn sm primary" onclick="openRenewalRequestModal('${p.key}')">اطلب التجديد</button>` },
    ];
    // نسيب كارت الحالة زي ما هو ونحط جدول الخطط مكان الكروت
    const head = html.split('تفعيل خطة جديدة')[0];
    return head + toolbar('lic', filters, counts) +
      `<div class="mtop">${sortableTable('plansTable', plans, cols, null,
        { defaultKey:'price', emptyText:'مفيش خطط', exportName:'خطط الاشتراك' })}</div>`;
  };


  /* ---------- ٩) الإحالة: مين استخدم كودك ---------- */

  const origRef = window.pageReferralProgram;
  if (origRef) window.pageReferralProgram = function(){
    const rec = window.findBuildingRec ? findBuildingRec(window.activeBuildingId) : null;
    const items = rec ? (REG.buildings || []).filter(b => b.referredBy === rec.id) : [];
    const filters = [
      { k:'all',      label:'الكل' },
      { k:'rewarded', label:'اترقّى',      test:b => !!b.referralRewardGiven },
      { k:'trial',    label:'لسه تجريبي',  test:b => !b.referralRewardGiven },
    ];
    const counts = countAll(filters, items);
    const html = origRef.apply(this, arguments);

    if ((V.ref || 'cards') === 'cards')
      return html.replace(/(<div class="section-title"><h3>مين استخدم كودك<\/h3><\/div>)/,
                          '$1' + toolbar('ref', filters, counts));

    const shown = apply('ref', filters, items);
    const rewards = window.ensureReferralRewards ? ensureReferralRewards() : [];
    const daysOf = b => rewards.filter(r => r.referredBuildingId === b.id)
                               .reduce((s,r) => s + (r.rewardDays||0), 0);
    const cols = [
      { key:'name', label:'العمارة', value:b => b.name||'', cell:b => `<b>${esc2(b.name||'')}</b>` },
      { key:'code', label:'الكود',   value:b => b.code||'', cell:b => `<span dir="ltr">${esc2(b.code||'-')}</span>` },
      { key:'state',label:'الحالة',  value:b => b.referralRewardGiven ? 1 : 0,
        cell:b => b.referralRewardGiven ? '<span class="badge g">✅ اترقّى</span>'
                                        : '<span class="badge y">لسه تجريبي</span>' },
      { key:'days', label:'أيام المكافأة', value:daysOf,
        cell:b => daysOf(b) ? `<b>${daysOf(b)} يوم</b>` : '-' },
    ];
    const head = html.split('<div class="section-title"><h3>مين استخدم كودك</h3></div>')[0];
    return head + '<div class="section-title"><h3>مين استخدم كودك</h3></div>' +
      toolbar('ref', filters, counts) +
      `<div class="mtop">${sortableTable('refTable', shown, cols, null,
        { defaultKey:'name', emptyText:'محدش استخدم كودك لسه', exportName:'الإحالات' })}</div>`;
  };

  console.log('[عمارتنا] عرض شاشات التواصل جاهز');
})();

})();

/* ═══ emartna-period.js ═══ */
(function(){
/* ============================================================
   عمارتنا — فلتر الفترة على شاشات الحركات
   ------------------------------------------------------------
   شريط موحّد (من / إلى + أزرار سريعة) على الشاشات اللي بتعرض
   حركات كتيرة، عشان الشاشة تفضل مقروءة مهما كبر تاريخ العمارة.

   ⚠️ مبدأ محاسبي: الفلتر بيقلّل **المعروض** بس.
      الأرصدة والمستحقات بتتحسب دايمًا من كل التاريخ —
      وإلا رصيد الوحدة هيبان غلط.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));

  /* الافتراضي = الشهر الحالي لشاشات الحركات.
     السبب مش تنظيم بس — ده مكسب أداء حقيقي: عمارة بسنتين بيانات
     فيها ٧١٧٥ قيد، الشهر الحالي منهم ١٨٧ (أقل ٩٧٪). الرسم والفرز
     والبحث كلهم بيشتغلوا على الأقل.
     ⚠️ الفلتر بيقلّل المعروض بس — الأرصدة بتتحسب من كل التاريخ. */
  const DEFAULTS = {
    exp:1, act:1, payreq:1, treasury:1, collections:1, ledger:1,
    /* التقارير والتحليلات: سنة — المقارنة محتاجة تاريخ أطول */
    reports:12, analytics:12, aging:12,
  };
  const STORE = 'emartna_period_prefs';

  function load(){
    try{ return JSON.parse(localStorage.getItem(STORE) || '{}'); }catch(e){ return {}; }
  }
  function save(p){ try{ localStorage.setItem(STORE, JSON.stringify(p)); }catch(e){} }

  const P = load();

  function range(key){
    const pref = P[key];
    if (pref && pref.from !== undefined) return pref;
    const months = DEFAULTS[key] ?? 1;
    /* شهر واحد = الشهر الجاري من أول يوم فيه — مهما كان الشهر.
       فلو احنا في ٩، بيفتح على ٩ لوحده بلا أي ضبط يدوي. */
    const d = new Date(); d.setMonth(d.getMonth() - months + 1);
    return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10), to: '' };
  }
  window.periodRange = range;

  window.setPeriodMonths = function(key, months){
    if (months === 'all') P[key] = { from:'', to:'' };
    else if (months === 'year'){ P[key] = { from: new Date().getFullYear()+'-01-01', to: today() }; }
    else {
      const d = new Date(); d.setMonth(d.getMonth() - months + 1);
      P[key] = { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10), to: today() };
    }
    save(P); renderContent();
  };

  window.applyPeriodDates = function(key){
    const f = document.getElementById('pf_' + key), t = document.getElementById('pt_' + key);
    P[key] = { from: (f && f.value) || '', to: (t && t.value) || '' };
    save(P); renderContent();
  };

  /* شريط الفترة */
  function bar(key, shown, total, note){
    const r = range(key);
    const b = (label, arg) => `<button class="btn sm ghost"
      onclick="setPeriodMonths('${key}',${typeof arg==='string'?`'${arg}'`:arg})">${label}</button>`;
    const hidden = total - shown;
    return `
    <div class="card mtop" style="padding:10px">
      <div class="grid g2">
        <div class="field2"><label>من تاريخ</label>
          <input id="pf_${key}" type="date" value="${r.from}" onchange="applyPeriodDates('${key}')"></div>
        <div class="field2"><label>إلى تاريخ</label>
          <input id="pt_${key}" type="date" value="${r.to}" onchange="applyPeriodDates('${key}')"></div>
      </div>
      <div class="flexrow mtop" style="flex-wrap:wrap;gap:6px">
        ${b('الشهر الحالي',1)} ${b('آخر 3 شهور',3)} ${b('آخر 6 شهور',6)}
        ${b('آخر 12 شهر',12)} ${b('السنة الحالية','year')} ${b('كل الفترة','all')}
      </div>
      <p class="small mtop" style="color:var(--muted)">
        معروض ${shown} من ${total}${hidden>0?` · ${hidden} مخفية برّه الفترة`:''}${note?` · ${note}`:''}
      </p>
    </div>`;
  }

  const inRange = (d, r) => (!r.from || (d||'') >= r.from) && (!r.to || (d||'') <= r.to);
  window.inPeriodRange = inRange;   /* الجدول في index بيستخدمها */

  /* ---------- ١) المصروفات ---------- */
  const origExp = window.pageExpenses;
  if (origExp) window.pageExpenses = function(){
    const r = range('exp');
    const all = D.expenses || [];
    const keep = all.filter(e => inRange(e.date, r));
    const backup = D.expenses;
    D.expenses = keep;
    let html;
    try{ html = origExp.apply(this, arguments); } finally { D.expenses = backup; }
    return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/,
      '$1' + bar('exp', keep.length, all.length));
  };

  /* ---------- شاشة التحصيل: أكبر شاشة في البرنامج ----------
     ⚠️ حساسة: الجدول العلوي "كشف حساب الشقق" لازم يفضل على
     **كل التاريخ** وإلا الأرصدة تبان غلط. الفلتر على سجل
     الحركات السفلي بس.
     بنفلتر بعد ما الشاشة تترسم — فالأرصدة بتتحسب من الأصل. */
  const origColl = window.pageCollections;
  if (origColl) window.pageCollections = function(){
    const r = range('coll');
    const all = D.ledger || [];
    const keep = all.filter(l => inRange(l.date, r));
    /* ⚠️ كشف حساب الشقق بيستخدم apCharges/apPayments اللي بتقرا
       من D.ledger مباشرة — فلو قلّلناها الأرصدة تبان غلط.
       الحل: نسيب D.ledger كاملة، ونفلتر صفوف الجدول السفلي بس
       عن طريق علامة بيقراها الجدول. */
    const backup = D.ledger;
    window.__collPeriod = r;          // الجدول السفلي بيقراها
    let html;
    try{
      html = origColl.apply(this, arguments);
    } finally { D.ledger = backup; window.__collPeriod = null; }
    /* الشريط فوق سجل الحركات مش فوق كشف الحساب */
    return html.replace(
      /(<div class="section-title"><h3>سجل كل الحركات)/,
      bar('coll', keep.length, all.length,
          'كشف حساب الشقق فوق بيحسب كل التاريخ') + '$1');
  };

  /* ---------- ٢) سجل النشاط ---------- */
  const origAct = window.pageActivity;
  if (origAct) window.pageActivity = function(){
    const r = range('act');
    const all = D.activityLog || [];
    const keep = all.filter(a => inRange((a.date||'').slice(0,10), r));
    const backup = D.activityLog;
    D.activityLog = keep;
    let html;
    try{ html = origAct.apply(this, arguments); } finally { D.activityLog = backup; }
    return bar('act', keep.length, all.length) + html;
  };

  /* ---------- ٣) طلبات الدفع ---------- */
  const origPR = window.pagePaymentRequests;
  if (origPR) window.pagePaymentRequests = function(){
    const r = range('payreq');
    const all = D.paymentRequests || [];
    const keep = all.filter(x => inRange((x.requestedAt||'').slice(0,10), r));
    const backup = D.paymentRequests;
    D.paymentRequests = keep;
    let html;
    try{ html = origPR.apply(this, arguments); } finally { D.paymentRequests = backup; }
    return bar('payreq', keep.length, all.length,
      'الطلبات المنتظرة بتظهر دايمًا') + html;
  };

  /* ---------- ٤) الخزينة: حركات الحسابات ---------- */
  const origTr = window.pageTreasury;
  if (origTr) window.pageTreasury = function(){
    const r = range('treasury');
    const allLed = D.ledger || [], allExp = D.expenses || [], allTrf = D.transfers || [];
    const total = allLed.length + allExp.length + allTrf.length;
    const kLed = allLed.filter(x => inRange(x.date, r));
    const kExp = allExp.filter(x => inRange(x.date, r));
    const kTrf = allTrf.filter(x => inRange(x.date, r));
    const bL = D.ledger, bE = D.expenses, bT = D.transfers;
    D.ledger = kLed; D.expenses = kExp; D.transfers = kTrf;
    let html;
    try{ html = origTr.apply(this, arguments); }
    finally { D.ledger = bL; D.expenses = bE; D.transfers = bT; }
    return html.replace(/(<div class="grid g\d[\s\S]*?<\/div>\s*<\/div>)/,
      '$1' + bar('treasury', kLed.length + kExp.length + kTrf.length, total,
                 '⚠️ أرصدة الحسابات فوق محسوبة من كل التاريخ'));
  };

  console.log('[عمارتنا] فلتر الفترة جاهز');
})();

})();

/* ═══ emartna-fast.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تسريع البدء
   ------------------------------------------------------------
   حاجتين بيتعملوا هنا:

   ١) إعدادات المنصة (الصفحة الرئيسية · الهوية · الخطط) بتتخزن
      على الجهاز، فالشاشة بتظهر فورًا من غير انتظار الخادم،
      والتحديث بيوصل في الخلفية.

   ٢) لو نزل إصدار جديد من ملفات البرنامج، بيظهر شريط
      "في تحديث جديد" بدل ما المستخدم يفضل على القديم.

   ⚠️ بيانات العمارة (الحركات · الوحدات · الحسابات) **مش**
      بتتخزن على الجهاز أبدًا — دي بتتجاب من الخادم كل مرة.
   ============================================================ */

(function(){
  'use strict';

  const KEY = 'emartna_shell_cache_v1';
  const MAX_AGE = 24 * 60 * 60 * 1000;      // يوم

  /* المفاتيح اللي ينفع تتخزن — عرض وإعدادات بس، مفيش بيانات عملاء */
  const CACHEABLE = [
    'landingSettings','brandSettings','legalSettings','landingBanners',
    'marketingCards','plans','landingOffers','versionHistory',
  ];

  function readCache(){
    try{
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || !o.at || (Date.now() - o.at) > MAX_AGE) return null;
      if (o.build && window.APP_BUILD && o.build !== window.APP_BUILD) return null;
      return o.data || null;
    }catch(e){ return null; }
  }

  function writeCache(){
    try{
      const REG = window.REG; if (!REG) return;
      const data = {};
      CACHEABLE.forEach(k => { if (REG[k] !== undefined) data[k] = REG[k]; });
      localStorage.setItem(KEY, JSON.stringify({
        at: Date.now(), build: window.APP_BUILD || '', data,
      }));
    }catch(e){ /* المساحة ممتلئة — مش مشكلة، هيتجاب من الخادم */ }
  }

  /* ١) استخدام النسخة المحفوظة لحد ما الخادم يرد */
  const origLoadRegistry = window.loadRegistry;
  if (origLoadRegistry) window.loadRegistry = async function(){
    const cached = readCache();

    // بنعمل ده لما طبقة السحابة تكون موجودة بس — لأنها بتستبدل REG
    // بالكامل بعد الرد. من غير الشرط ده، السجل الناقص كان يكسر
    // التهيئة المحلية (REG.buildings مش معرّفة).
    if (cached && window.CLOUD){
      window.REG = window.REG || { buildings: [], plans: [] };
      if (!Array.isArray(window.REG.buildings)) window.REG.buildings = [];
      Object.keys(cached).forEach(k => {
        if (window.REG[k] === undefined || window.REG[k] === null ||
            (Array.isArray(window.REG[k]) && !window.REG[k].length))
          window.REG[k] = cached[k];
      });
    }

    const out = await origLoadRegistry.apply(this, arguments);
    writeCache();                       // تحديث النسخة بعد ما الخادم يرد
    return out;
  };

  /* بعد أي حفظ للمنصة، نحدّث النسخة المحفوظة */
  const origSaveRegistry = window.saveRegistry;
  if (origSaveRegistry) window.saveRegistry = function(){
    const r = origSaveRegistry.apply(this, arguments);
    setTimeout(writeCache, 800);
    return r;
  };

  window.clearShellCache = function(){
    try{ localStorage.removeItem(KEY); }catch(e){}
    if (window.toast) toast('اتمسحت النسخة المحفوظة — حدّث الصفحة');
  };

  /* ٢) تنبيه لما ينزل إصدار جديد من ملفات البرنامج */
  function watchForUpdate(){
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => {
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller)
              showUpdateBar();
          });
        });
      });
    }).catch(()=>{});
  }

  function showUpdateBar(){
    if (document.getElementById('updateBar')) return;
    const bar = document.createElement('div');
    bar.id = 'updateBar';
    // بيتحط على اليمين مش على عرض الشاشة كله — عشان مايغطيش
    // زرار "تسجيل الخروج" في الشريط الجانبي.
    bar.style.cssText = 'position:fixed;bottom:14px;inset-inline-end:14px;z-index:9500;' +
      'background:var(--accent,#159A8C);color:#fff;padding:9px 14px;border-radius:12px;' +
      'font:600 13px/1.7 system-ui;text-align:center;direction:rtl;max-width:min(92vw,420px);' +
      'box-shadow:0 6px 20px rgba(0,0,0,.18)';
    bar.innerHTML = '🎉 نزل تحديث جديد للبرنامج ' +
      '<button onclick="applyAppUpdate()" style="margin-inline-start:10px;background:#fff;' +
      'color:var(--accent,#159A8C);border:0;border-radius:6px;padding:5px 14px;' +
      'cursor:pointer;font-weight:700">حدّث دلوقتي</button>' +
      '<button onclick="this.parentNode.remove()" style="margin-inline-start:6px;background:none;' +
      'color:#fff;border:0;cursor:pointer;opacity:.85">بعدين</button>';
    document.body.appendChild(bar);
  }

  window.applyAppUpdate = function(){
    try{ localStorage.removeItem(KEY); }catch(e){}
    if ('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations()
        .then(rs => Promise.all(rs.map(r => r.update())))
        .finally(() => location.reload(true));
    } else location.reload(true);
  };

  setTimeout(watchForUpdate, 3000);

  console.log('[عمارتنا] تسريع البدء جاهز');
})();

})();

/* ═══ emartna-ops.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — وضع الصيانة + نسخ بيانات العمارة
   ------------------------------------------------------------
   ١) صاحب البرنامج يقدر يوقف الموقع مؤقتًا بفترة محددة (من/إلى)
      ورسالة للمستخدمين. هو نفسه بيفضل داخل عشان يشتغل.
   ٢) رئيس الاتحاد يقدر ياخد نسخة من بيانات عمارته:
      تنزيل ملف · أو مشاركة مباشرة (جيميل · درايف · واتساب)
      من خلال قائمة المشاركة في الجهاز.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const KEY = 'maintenance';

  /* ============================================================
     ١) وضع الصيانة
     ============================================================ */

  window.__maintenance = null;

  function isActive(m){
    if (!m || !m.enabled) return false;
    const now = new Date();
    if (m.from && new Date(m.from) > now) return false;   // لسه ما بدأتش
    if (m.to   && new Date(m.to)   < now) return false;   // خلصت
    return true;
  }
  window.maintenanceActive = () => isActive(window.__maintenance);

  async function loadMaintenance(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { data, error } = await sb.from('platform_settings')
        .select('value').eq('key', KEY).maybeSingle();
      if (error) return;
      window.__maintenance = (data && data.value) || null;
      applyMaintenance();
    }catch(e){}
  }
  window.reloadMaintenance = loadMaintenance;
  window.applyMaintenance  = applyMaintenance;

  function applyMaintenance(){
    const m = window.__maintenance;
    const bar = document.getElementById('maintBar');
    if (bar) bar.remove();
    const screen = document.getElementById('maintScreen');
    if (screen) screen.remove();
    if (!isActive(m)) return;

    const isOwner = !!(window.isSysOwner && isSysOwner());
    const period = [
      m.from ? 'من ' + new Date(m.from).toLocaleString('ar-EG') : '',
      m.to   ? 'إلى ' + new Date(m.to).toLocaleString('ar-EG') : '',
    ].filter(Boolean).join(' · ');

    if (isOwner){
      // صاحب البرنامج بيشتغل عادي، بس بيشوف شريط تذكير
      const b = document.createElement('div');
      b.id = 'maintBar';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;background:#B58121;' +
        'color:#fff;padding:8px 14px;font:600 13px/1.6 system-ui;text-align:center;direction:rtl';
      b.innerHTML = '🛠️ الموقع تحت الصيانة للمستخدمين' + (period ? ' — ' + esc2(period) : '') +
        ' <button onclick="openSiteMaintenanceModal()" style="margin-inline-start:10px;background:#fff;' +
        'color:#B58121;border:0;border-radius:6px;padding:3px 12px;cursor:pointer;font-weight:700">إدارة</button>';
      document.body.appendChild(b);
      return;
    }

    // مفتاح تجاوز مؤقت للجلسة — عشان صاحب البرنامج يقدر يوصل
    // لشاشة الدخول وهو مش مسجّل، من غير ما يتقفل برّه.
    try{
      if (sessionStorage.getItem('emartna_maint_bypass') === '1') return;
    }catch(e){}

    const d = document.createElement('div');
    d.id = 'maintScreen';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg,#F8FAF9);' +
      'display:flex;align-items:center;justify-content:center;padding:24px;direction:rtl';
    d.innerHTML = `
      <div style="max-width:520px;text-align:center;background:var(--panel,#fff);
                  border:1px solid var(--line,#e3e8e6);border-radius:18px;padding:32px">
        <div style="font-size:52px">🛠️</div>
        <h2 style="margin:10px 0">البرنامج تحت الصيانة</h2>
        <p class="small" style="line-height:2">${esc2(m.message ||
          'بنعمل تحديث سريع عشان الخدمة تبقى أحسن. البيانات كلها محفوظة وما فيش حاجة هتضيع.')}</p>
        ${period ? `<p style="margin-top:14px;font-weight:700">⏰ ${esc2(period)}</p>` : ''}
        <button class="btn primary" style="margin-top:18px" onclick="location.reload()">🔄 حاول تاني</button>
        <div style="margin-top:22px;padding-top:14px;border-top:1px solid var(--line,#e3e8e6)">
          <button onclick="maintenanceOwnerLogin()"
            style="background:none;border:0;color:var(--muted,#6b7c78);font-size:12px;
                   cursor:pointer;text-decoration:underline">دخول صاحب البرنامج</button>
        </div>
      </div>`;
    document.body.appendChild(d);
  }

  /* تجاوز مؤقت: بيخفي شاشة الصيانة عشان يقدر يسجّل دخول.
     لو طلع مش صاحب برنامج، الشاشة بترجع تاني بعد الدخول. */
  window.maintenanceOwnerLogin = function(){
    try{ sessionStorage.setItem('emartna_maint_bypass','1'); }catch(e){}
    const scr = document.getElementById('maintScreen');
    if (scr) scr.remove();
    if (window.toast) toast('اتفتحت شاشة الدخول — سجّل دخولك');
    if (window.goToLogin) goToLogin();
    else if (window.renderRoot) renderRoot();
  };

  /* بعد أي تغيير في الجلسة: لو مش صاحب برنامج، الشاشة ترجع */
  window.recheckMaintenance = function(){
    const owner = !!(window.isSysOwner && isSysOwner());
    if (owner){
      try{ sessionStorage.removeItem('emartna_maint_bypass'); }catch(e){}
    }
    applyMaintenance();
  };

  /* نافذة إدارة الصيانة لصاحب البرنامج */
  /* الاسم كان openMaintenanceModal، وهو نفس اسم دالة "بلاغ صيانة
     في العمارة" في index.html. الوحدة بتتحمّل بعدها فبتدوس عليها —
     فالساكن كان بيدوس "بلاغ صيانة جديد" وتفتحله شاشة إيقاف الموقع.
     غيّرناه لـ openSiteMaintenanceModal: ده صيانة الموقع مش العمارة. */
  window.openSiteMaintenanceModal = function(){
    const m = window.__maintenance || {};
    const val = v => v ? String(v).slice(0,16) : '';
    openModal(`
      <h3>🛠️ وضع الصيانة</h3>
      <p class="small mtop">لما تفعّله، أي مستخدم هيشوف شاشة صيانة بدل البرنامج.
      إنت هتفضل تشتغل عادي عشان تقدر تصلّح.</p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="mtEnabled" ${m.enabled?'checked':''}> تفعيل وضع الصيانة</label>
      </div>
      <div class="grid g2 mtop">
        <div class="field2"><label>من</label>
          <input id="mtFrom" type="datetime-local" value="${val(m.from)}"></div>
        <div class="field2"><label>إلى</label>
          <input id="mtTo" type="datetime-local" value="${val(m.to)}"></div>
      </div>
      <p class="small">سيب الخانتين فاضيين لو الإيقاف مفتوح المدة.</p>
      <p class="small" style="color:var(--accent)">
        ℹ️ إنت مش هتتأثر — هتفضل داخل عادي. ولو خرجت، في رابط
        <b>"دخول صاحب البرنامج"</b> تحت شاشة الصيانة يرجّعك لشاشة الدخول.
      </p>

      <div class="field2 mtop"><label>رسالة للمستخدمين</label>
        <textarea id="mtMsg" rows="3" style="width:100%">${esc2(m.message||'')}</textarea></div>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveMaintenance()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveMaintenance = async function(){
    const g = id => (document.getElementById(id) || {}).value || '';
    const payload = {
      enabled: !!(document.getElementById('mtEnabled') || {}).checked,
      from: g('mtFrom') || null,
      to:   g('mtTo')   || null,
      message: g('mtMsg'),
      updatedAt: new Date().toISOString(),
    };
    if (payload.from && payload.to && new Date(payload.to) <= new Date(payload.from))
      return showMessage('تاريخ النهاية لازم يكون بعد البداية');
    try{
      const { error } = await window.CLOUD._sb.rpc('save_platform_doc',
        { p_key: KEY, p_value: payload });
      if (error) throw error;
      window.__maintenance = payload;
      applyMaintenance();
      closeModal();
      if (window.toast) toast(payload.enabled ? 'الموقع بقى تحت الصيانة' : 'الصيانة اتوقفت — الموقع شغّال');
    }catch(e){
      showMessage('تعذّر الحفظ: ' + (window.cloudErrorText ? cloudErrorText(e) : e.message));
    }
  };

  /* ============================================================
     ٢) نسخة بيانات العمارة
     ============================================================ */

  function buildBuildingBackup(){
    const D = window.D;
    if (!D) return null;
    const b = D.building || {};
    const out = {
      meta: {
        app: 'عمارتنا', kind: 'building-backup', version: window.APP_BUILD || '1',
        takenAt: new Date().toISOString(),
        buildingName: b.name || '', buildingCode: b.code || '',
      },
      building: b,
      counts: {},
      data: {},
    };
    ['apartments','users','accounts','ledger','expenses','expenseCategories','transfers',
     'projects','vendors','maintenanceReports','meetings','polls','announcements',
     'suggestions','paymentRequests','notifications','buildingChat','activityLog']
      .forEach(k => {
        const v = D[k];
        if (Array.isArray(v)){ out.data[k] = v; out.counts[k] = v.length; }
      });

    // الصور بتكبّر الملف — بنشيلها ونعدّها
    let imgs = 0;
    (out.data.paymentRequests || []).forEach(r => {
      if (r.imageDataUrl && r.imageDataUrl.length > 500){
        r.imageDataUrl = '[صورة محذوفة من النسخة]'; imgs++;
      }
    });
    out.meta.imagesStripped = imgs;
    return out;
  }

  function backupFile(){
    const data = buildBuildingBackup();
    if (!data) return null;
    const name = 'نسخة ' + (data.meta.buildingName || 'العمارة') + ' - ' +
                 new Date().toISOString().slice(0,10) + '.json';
    const blob = new Blob([JSON.stringify(data, null, 1)], { type:'application/json' });
    return { blob, name, data };
  }

  window.downloadBuildingBackup = function(){
    const f = backupFile();
    if (!f) return showMessage('مفيش بيانات للنسخ');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f.blob);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    const total = Object.values(f.data.counts).reduce((x,y) => x+y, 0);
    if (window.toast) toast('اتنزّلت نسخة فيها ' + total + ' سجل');
  };

  /* المشاركة: بتفتح قائمة الجهاز — جيميل · درايف · واتساب */
  window.shareBuildingBackup = async function(){
    const f = backupFile();
    if (!f) return showMessage('مفيش بيانات للنسخ');
    const file = new File([f.blob], f.name, { type:'application/json' });

    if (navigator.canShare && navigator.canShare({ files:[file] })){
      try{
        await navigator.share({
          files: [file],
          title: f.name,
          text: 'نسخة احتياطية من بيانات ' + (f.data.meta.buildingName || 'العمارة'),
        });
        return;
      }catch(e){ if (e && e.name === 'AbortError') return; }
    }
    // الجهاز مش بيدعم المشاركة (أغلب أجهزة الكمبيوتر) — بننزّل الملف
    showMessage('جهازك مش بيدعم المشاركة المباشرة.\n\nهننزّل الملف، وتقدر ترفعه على درايف أو تبعته بالإيميل.');
    window.downloadBuildingBackup();
  };

  window.openBuildingBackupModal = function(){
    const d = buildBuildingBackup();
    if (!d) return showMessage('مفيش بيانات');
    const total = Object.values(d.counts).reduce((a,b) => a+b, 0);
    const canShare = !!(navigator.canShare && navigator.share);
    const rows = Object.keys(d.counts).filter(k => d.counts[k])
      .map(k => `<span class="badge n">${esc2(LABELS[k]||k)}: ${d.counts[k]}</span>`).join(' ');

    openModal(`
      <h3>💾 نسخة من بيانات العمارة</h3>
      <p class="small mtop">ملف واحد فيه كل بيانات <b>${esc2(d.meta.buildingName)}</b> —
      ${total} سجل. احتفظ بيه في مكان آمن.</p>
      <div class="card mtop" style="line-height:2.2">${rows}</div>
      ${d.meta.imagesStripped ? `<p class="small">(اتشال ${d.meta.imagesStripped} صورة إثبات عشان الحجم — الحركات المالية كاملة)</p>` : ''}

      <div class="flexrow mtop2" style="flex-wrap:wrap;gap:8px">
        <button class="btn primary" onclick="downloadBuildingBackup()">⬇️ تنزيل الملف</button>
        ${canShare ? `<button class="btn gold" onclick="shareBuildingBackup()">📤 مشاركة (جيميل · درايف · واتساب)</button>` : ''}
      </div>
      <p class="small mtop" style="color:var(--muted)">
        ${canShare ? 'المشاركة بتفتح قائمة جهازك — اختار جيميل عشان تبعتها لنفسك، أو درايف عشان تحفظها.'
                   : 'على الكمبيوتر: نزّل الملف وارفعه على درايف أو أرفقه في إيميل.'}
      </p>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  const LABELS = {
    apartments:'الوحدات', users:'المستخدمين', accounts:'الحسابات', ledger:'الحركات',
    expenses:'المصروفات', expenseCategories:'بنود الصرف', transfers:'التحويلات',
    projects:'المشاريع', vendors:'الموردين', maintenanceReports:'البلاغات',
    meetings:'الاجتماعات', polls:'الاستطلاعات', announcements:'الإعلانات',
    suggestions:'المقترحات', paymentRequests:'طلبات الدفع', notifications:'التنبيهات',
    buildingChat:'المحادثة', activityLog:'سجل النشاط',
  };

  /* زرار النسخة في شاشة الإعدادات */
  const origSettings = window.pageSettings;
  if (origSettings) window.pageSettings = function(){
    return `<div class="card content-narrow">
      <h3>💾 نسخة من بيانات عمارتك</h3>
      <p class="small mtop">نزّل ملف فيه كل بيانات العمارة، أو ابعته لنفسك على الجيميل
      أو احفظه على جوجل درايف. ينصح بنسخة كل شهر.</p>
      <button class="btn gold mtop" onclick="openBuildingBackupModal()">💾 خد نسخة دلوقتي</button>
    </div>` + origSettings.apply(this, arguments);
  };

  /* زرار الصيانة في إعدادات صاحب البرنامج */
  const origSysSettings = window.pageSysSettings;
  if (origSysSettings) window.pageSysSettings = function(){
    const m = window.__maintenance || {};
    const on = isActive(m);
    return `
    <div class="card content-narrow" style="border:1px solid ${on?'#B58121':'var(--line)'}">
      <h3>🛠️ وضع الصيانة</h3>
      <p class="small mtop">
        الحالة: <b>${on ? 'الموقع تحت الصيانة' : 'الموقع شغّال عادي'}</b>.
        ${on ? 'المستخدمين بيشوفوا شاشة صيانة — وإنت شغّال عادي.'
             : 'لما تفعّله، تقدر تحدد فترة ورسالة للمستخدمين.'}
      </p>
      <button class="btn ${on?'red':'gold'} mtop" onclick="openSiteMaintenanceModal()">
        ${on ? '⚙️ إدارة الصيانة' : '🛠️ تفعيل وضع الصيانة'}
      </button>
    </div>
    ${origSysSettings.apply(this, arguments)}`;
  };

  /* التشغيل */
  let tries = 0;
  const t = setInterval(() => {
    if (++tries > 300) return clearInterval(t);
    if (window.CLOUD && window.CLOUD._sb){ clearInterval(t); loadMaintenance(); }
  }, 100);
  setInterval(loadMaintenance, 5 * 60 * 1000);      // إعادة فحص كل ٥ دقايق

  // لما المستخدم يسجّل دخول أو خروج، نعيد تقييم الشاشة
  let lastKind = null;
  setInterval(() => {
    const s = window.getSession && getSession();
    const kind = s ? s.type : 'none';
    if (kind !== lastKind){ lastKind = kind; recheckMaintenance(); }
  }, 1500);

  console.log('[عمارتنا] الصيانة والنسخ الاحتياطي جاهز');
})();

})();

/* ═══ emartna-onboarding.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — معالج البداية + تسليم إدارة العمارة
   ------------------------------------------------------------
   ١) معالج ٥ خطوات بيمشّي رئيس الاتحاد الجديد من "عمارة فاضية"
      لـ"عمارة شغّالة". الخطوات بتتحدد من البيانات نفسها —
      مفيش حفظ لحالة منفصلة تتعارض مع الواقع.

   ٢) تسليم الإدارة: صاحب شقة سجّل العمارة وعايز يسلّمها
      لرئيس الاتحاد الحقيقي — يكمل على نفس البيانات أو يبدأ نضيف.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const DISMISS = 'emartna_wizard_dismissed';

  /* ---------- حالة الخطوات — محسوبة من البيانات ---------- */

  function steps(){
    const D = window.D || {};
    const b = D.building || {};
    const aps = D.apartments || [];
    const withFee = aps.filter(a => Number(a.monthlyFee) > 0).length;
    const withPhone = aps.filter(a => a.phone).length;
    const hasLedger = (D.ledger || []).some(l => l.type === 'شهري');
    const invited = (D.users || []).filter(u => u.apartmentId).length;

    return [
      { key:'building', icon:'🏢', title:'بيانات العمارة',
        desc:'اسم العمارة والعنوان وعدد الأدوار — بتظهر في كل التقارير.',
        done: !!(b.name && b.city),
        action:'go(\'building\')', label:'افتح بيانات العمارة' },

      { key:'units', icon:'🚪', title:'ضيف وحداتك',
        desc:'الشقق والمحلات وأسماء الملاك. عندك عدد كبير؟ استورد من إكسل في دقيقة.',
        done: aps.length > 0,
        detail: aps.length ? `${aps.length} وحدة` : '',
        action:'go(\'apartments\')', label:'افتح الشقق والملاك' },

      { key:'fees', icon:'💰', title:'حدّد الاشتراك الشهري',
        desc:'قيمة الاشتراك لكل وحدة. من غيرها مش هيتولّد تحصيل.',
        done: aps.length > 0 && withFee === aps.filter(a => !a.closed).length,
        detail: aps.length ? `${withFee} من ${aps.length} محدّد` : '',
        action:'openApUpdateImport()', label:'حدّد بالإكسل (أسرع)' },

      { key:'collect', icon:'🧾', title:'ولّد التحصيل الشهري',
        desc:'البرنامج بيسجّل المستحق على كل وحدة تلقائيًا كل شهر.',
        done: hasLedger,
        action:'go(\'collections\')', label:'افتح التحصيل' },

      { key:'invite', icon:'📨', title:'ادعُ السكان',
        desc:'كل ساكن يشوف حسابه بنفسه — ده اللي بيوقف السؤال المتكرر "أنا دفعت ولا لأ؟".',
        done: invited > 0,
        detail: withPhone ? `${withPhone} وحدة عندها رقم موبايل` : 'محتاج أرقام موبايل الأول',
        action:'go(\'users\')', label:'افتح المستخدمين' },
    ];
  }

  window.wizardProgress = function(){
    const s = steps();
    return { done: s.filter(x => x.done).length, total: s.length, steps: s };
  };

  /* ---------- المعالج ---------- */

  window.openSetupWizard = function(){
    const { done, total, steps: list } = wizardProgress();
    const pct = Math.round(done / total * 100);
    const next = list.find(s => !s.done);

    openModal(`
      <h3>🚀 خطوات تشغيل عمارتك</h3>
      <p class="small mtop">${done === total
        ? 'مبروك — عمارتك شغّالة بالكامل. تقدر تقفل النافذة دي.'
        : 'خمس خطوات بس وعمارتك تبقى شغّالة. كل خطوة بتتعلّم لوحدها أول ما تخلّصها.'}</p>

      <div class="card mtop" style="padding:12px">
        <div class="flexrow" style="justify-content:space-between">
          <b>${done} من ${total} خطوات</b><b style="color:var(--accent)">${pct}%</b>
        </div>
        <div style="height:9px;background:var(--line);border-radius:6px;margin-top:7px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--accent);transition:width .4s"></div>
        </div>
      </div>

      <div class="mtop">
        ${list.map((s,i) => {
          const isNext = next && s.key === next.key;
          return `
          <div class="card" style="margin-bottom:9px;padding:12px;
               border:1px solid ${isNext ? 'var(--accent)' : 'var(--line)'};
               ${s.done ? 'opacity:.62' : ''}">
            <div class="flexrow" style="align-items:flex-start;gap:10px">
              <div style="font-size:22px;min-width:30px">${s.done ? '✅' : s.icon}</div>
              <div style="flex:1">
                <b>${i+1}. ${esc2(s.title)}</b>
                ${s.detail ? `<span class="badge n" style="margin-inline-start:6px">${esc2(s.detail)}</span>` : ''}
                <div class="small" style="color:var(--muted);margin-top:3px">${esc2(s.desc)}</div>
                ${!s.done ? `<button class="btn sm ${isNext?'primary':'ghost'}" style="margin-top:8px"
                    onclick="closeModal();${s.action}">${esc2(s.label)}</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
        ${done < total ? `<button class="btn ghost" onclick="dismissWizard()">مش دلوقتي — بلاش تفكّرني</button>` : ''}
      </div>`, true);
  };

  window.dismissWizard = function(){
    try{ localStorage.setItem(DISMISS + '_' + (window.activeBuildingId||''), '1'); }catch(e){}
    closeModal();
    if (window.toast) toast('تقدر ترجعله في أي وقت من زرار 🚀 في الأعلى');
    renderContent();
  };

  /* ⚠️ العميل بيقفل الشريط ويكمّل — وبعدين ينسى الخطوة الناقصة.
     ١١ من ١٨ عمارة واقفة عند "الاشتراك الشهري" بالظبط: أدخلوا
     الوحدات والبرنامج بيبان فاضي لأنه مايقدرش يولّد تحصيل.
     الخطوة دي تحديدًا مالهاش زرار إخفاء — بتفضل لحد ما تتعمل. */
  function isCritical(){
    try{
      const aps = (window.D && D.apartments) || [];
      if (!aps.length) return false;
      const open = aps.filter(a => !a.closed);
      if (!open.length) return false;
      /* وحدات موجودة ومفيش ولا واحدة عليها اشتراك = البرنامج معطّل فعليًا */
      return !open.some(a => Number(a.monthlyFee) > 0);
    }catch(e){ return false; }
  }

  function criticalCard(){
    return `<div class="card mtop" style="border:2px solid var(--gold);
      background:var(--tint-warning)">
      <div class="flexrow" style="gap:10px;align-items:flex-start">
        <span style="font-size:22px">⚠️</span>
        <div style="flex:1">
          <b>خطوة واحدة فاضلة عشان البرنامج يشتغل</b>
          <p class="small mtop">وحداتك متسجّلة 👍 — بس لسه مفيش اشتراك شهري
            محدّد. من غيره البرنامج <b>مش هيقدر يولّد تحصيل</b> ولا يحسب
            متأخرات، وهيفضل باين فاضي.</p>
          <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
            <button class="btn primary" onclick="go('apartments')">
              💳 حدّد الاشتراك دلوقتي</button>
            <button class="btn ghost" onclick="openSetupWizard()">كل الخطوات</button>
          </div>
        </div>
      </div></div>`;
  }

  function dismissed(){
    /* إخفاء مؤقت بأسبوع من زرار ✕ في الشريط */
    try{
      const t = parseInt(localStorage.getItem('emartna_setup_bar_hide'),10);
      if (t && Date.now() < t) return true;
    }catch(e){}
    try{ return localStorage.getItem(DISMISS + '_' + (window.activeBuildingId||'')) === '1'; }
    catch(e){ return false; }
  }

  /* بطاقة التقدّم في لوحة التحكم */
  const origDash = window.pageAdminDashboard;
  if (origDash) window.pageAdminDashboard = function(){
    const html = origDash.apply(this, arguments);
    const { done, total, steps: list } = wizardProgress();
    if (done === total) return html;
    if (dismissed()) return isCritical() ? criticalCard() + html : html;

    const next = list.find(s => !s.done);
    const pct = Math.round(done / total * 100);
    /* ⚠️ كان كارت كامل فوق لوحة التحكم — مع كارت النسخة الاحتياطية
       كانوا بياخدوا نص الشاشة على الموبايل قبل ما المستخدم يشوف أي
       رقم. بقى شريط رفيع بمؤشر تقدّم، والتفاصيل في نافذة. */
    const bar = `
      <div class="flexrow" style="gap:8px;align-items:center;flex-wrap:nowrap;
        padding:7px 11px;margin-bottom:10px;border-radius:10px;
        border:1px solid var(--accent);background:var(--tint);cursor:pointer"
        onclick="openSetupWizard()">
        <span style="font-size:15px;flex:0 0 auto">🚀</span>
        <span style="flex:1;min-width:0">
          <span style="display:block;font-size:12.5px;font-weight:700;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            إعداد العمارة ${done}/${total} — ${esc2(next.title)}</span>
          <span style="display:block;height:4px;background:var(--line);
            border-radius:3px;margin-top:4px;overflow:hidden">
            <span style="display:block;width:${pct}%;height:100%;
              background:var(--accent)"></span></span>
        </span>
        <button class="btn sm primary" style="flex:0 0 auto;padding:4px 10px;font-size:12px"
          onclick="event.stopPropagation();${next.action}">كمّل</button>
        <span onclick="event.stopPropagation();dismissSetupBar()"
          title="إخفاء لأسبوع" style="flex:0 0 auto;cursor:pointer;opacity:.5;
          font-size:14px;padding:0 3px">✕</span>
      </div>`;
    /* الخطوة الحرجة بتتعرض ككارت واضح — مش شريط بيتقفل */
    if (isCritical()) return criticalCard() + bar + html;
    return bar + html;
  };

  /* الإخفاء لأسبوع مش للأبد — الإعداد الناقص بيأثر على استخدامه */
  window.dismissSetupBar = function(){
    try{ localStorage.setItem('emartna_setup_bar_hide',
      String(Date.now() + 7*86400000)); }catch(e){}
    if (window.renderContent) renderContent();
    if (window.toast) toast('هنفكّرك بعد أسبوع');
  };

  /* ============================================================
     ٢) تسليم إدارة العمارة
     ============================================================ */

  window.openHandoverModal = function(){
    const D = window.D || {};
    const aps = (D.apartments || []).length;
    const moves = (D.ledger || []).length + (D.expenses || []).length;

    openModal(`
      <h3>👑 تسليم إدارة العمارة</h3>
      <p class="small mtop">
        سجّلت العمارة وبتجرّب، ورئيس الاتحاد الحقيقي عايز يستلم؟
        تقدر تسلّمه الإدارة وهو يكمّل على نفس البيانات — أو يبدأ نضيف.
      </p>

      <div class="card mtop">
        <b>الوضع الحالي</b>
        <p class="small mtop">${aps} وحدة · ${moves} حركة مسجّلة</p>
      </div>

      <div class="card mtop">
        <b>الخطوة ١: ولّد دعوة رئيس اتحاد</b>
        <p class="small mtop">هيوصله كود، يسجّل برقمه، ويبقى ليه كل الصلاحيات زيّك بالظبط.</p>
        <button class="btn primary mtop" onclick="closeModal();openUserModal()">
          📨 ولّد دعوة رئيس اتحاد</button>
      </div>

      <div class="card mtop">
        <b>الخطوة ٢ (اختيارية): البداية من جديد</b>
        <p class="small mtop">
          لو حابب يبدأ ببيانات نضيفة، تقدر تفرّغ العمارة قبل ما يستلم.
          <b>العملية دي مش قابلة للتراجع</b> — خد نسخة احتياطية الأول.
        </p>
        <div class="flexrow mtop" style="flex-wrap:wrap;gap:8px">
          <button class="btn gold sm" onclick="openBuildingBackupModal&&openBuildingBackupModal()">
            💾 خد نسخة الأول</button>
          <button class="btn ghost sm" onclick="confirmReset(true)">
            🧹 امسح الحركات واحتفظ بالوحدات</button>
          <button class="btn red sm" onclick="confirmReset(false)">
            🗑️ امسح كل حاجة والوحدات كمان</button>
        </div>
      </div>

      <p class="small mtop" style="color:var(--muted)">
        ℹ️ بعد ما يستلم، تقدر تفضل معاه كصاحب شقة أو كإداري — أو تشيل نفسك من
        شاشة المستخدمين. العمارة مش هتتأثر.
      </p>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  window.confirmReset = function(keepUnits){
    const msg = keepUnits
      ? 'هيتم مسح كل الحركات المالية والمصروفات والبلاغات والإعلانات — والوحدات وأصحابها هيفضلوا زي ما هما.'
      : 'هيتم مسح كل حاجة: الحركات والمصروفات والوحدات وأصحابها. العمارة هترجع فاضية تمامًا.';
    if (typeof window.confirmDelete === 'function')
      return confirmDelete(msg + '\n\nمتأكد؟ العملية دي مش قابلة للتراجع.',
                           () => doReset(keepUnits));
    if (confirm(msg)) doReset(keepUnits);
  };

  async function doReset(keepUnits){
    try{
      const uuid = window.CLOUD && CLOUD.storage
        ? CLOUD.storage.uuidOfBuilding(window.activeBuildingId) : null;
      if (!uuid) return showMessage('تعذّر تحديد العمارة');
      if (window.toast) toast('بيفرّغ البيانات…');
      const { data, error } = await CLOUD._sb.rpc('reset_building_data',
        { p_building: uuid, p_keep_units: !!keepUnits });
      if (error) throw error;
      await CLOUD.loadBuilding(window.activeBuildingId);
      window.D = window.loadBuildingData(window.activeBuildingId);
      closeModal();
      renderContent();
      showMessage('✅ اتفرّغت العمارة.\n\n' +
        Object.entries(data || {}).map(([k,v]) => `${k.replace(/_/g,' ')}: ${v}`).join(' · '));
    }catch(e){
      showMessage('تعذّر التفريغ: ' + (window.cloudErrorText ? cloudErrorText(e) : e.message));
    }
  }

  /* زرار التسليم في شاشة المستخدمين */
  const origUsers = window.pageUsers;
  if (origUsers && !origUsers.__handoverWrapped){
    const wrapped = function(){
    const html = origUsers.apply(this, arguments);
    const btn = `<button class="btn ghost" onclick="openHandoverModal()">👑 تسليم إدارة العمارة</button>`;
    const m = html.match(/<button class="btn ghost" onclick="openUserModal\(\)">[^<]*<\/button>/);
    return m ? html.replace(m[0], m[0] + btn)
             : `<div class="flexrow" style="margin-bottom:10px">${btn}</div>` + html;
    };
    wrapped.__handoverWrapped = true;
    window.pageUsers = wrapped;
  }

  /* زرار المعالج في الشريط العلوي */
  setTimeout(() => {
    const actions = document.querySelector('.top .actions');
    if (!actions || document.getElementById('wizBtn')) return;
    const b = document.createElement('button');
    b.id = 'wizBtn'; b.className = 'btn sm ghost';
    b.title = 'خطوات تشغيل عمارتك';
    b.textContent = '🚀';
    b.onclick = () => openSetupWizard();
    actions.insertBefore(b, actions.firstChild);
  }, 2500);

  console.log('[عمارتنا] معالج البداية والتسليم جاهز');
})();

})();

/* ═══ emartna-bldcols.js ═══ */
(function(){
/* ============================================================
   عمارتنا — جدول كل العمارات: أعمدة ثابتة + مؤشرات استهداف
   ------------------------------------------------------------
   ١) تثبيت أول عمودين (اسم العمارة + الكود) أثناء التمرير
      الأفقي، مع إمكانية إلغاء التثبيت بضغطة.
   ٢) أعمدة جديدة تساعد صاحب البرنامج يستهدف كل عمارة:
      نسبة اكتمال البيانات · الأرقام المسجّلة · الدعوات ·
      الحسابات المفعّلة · الحركات ومتوسطها الشهري · آخر نشاط.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const PIN_KEY = 'emartna_pin_cols';

  const pinned = () => { try{ return localStorage.getItem(PIN_KEY) !== '0'; }catch(e){ return true; } };
  window.togglePinnedCols = function(){
    try{ localStorage.setItem(PIN_KEY, pinned() ? '0' : '1'); }catch(e){}
    if (window.renderSysContent) renderSysContent(); else renderContent();
  };

  /* ---------- ١) تثبيت الأعمدة ---------- */

  function tableRoomCss(){
    return `<style id="bldRoomCss">
      /* مساحة أوسع وصفوف أوضح لجدول العمارات */
      #sysBldTable_wrap .table-wrap, #supportBldTable_wrap .table-wrap{
        max-height:none; min-height:340px;
      }
      #sysBldTable_wrap .table-wrap td, #supportBldTable_wrap .table-wrap td{
        padding:11px 10px; font-size:13px;
      }
      #sysBldTable_wrap .table-wrap th, #supportBldTable_wrap .table-wrap th{
        padding:10px; font-size:12.5px;
      }
      #sysBldTable_wrap .table-wrap tbody tr:hover td,
      #supportBldTable_wrap .table-wrap tbody tr:hover td{ background:var(--hover,#F3F8F7); }
    </style>`;
  }

  function pinStyle(){
    if (!pinned()) return '';
    // الحاوية اللي بتتحرك أفقيًا اسمها .table-wrap جوه #<id>_wrap
    return `<style id="pinColsCss">
      /* أول عمودين بيفضلوا مكانهم أثناء التمرير الأفقي */
      #sysBldTable_wrap .table-wrap th:nth-child(1), #sysBldTable_wrap .table-wrap td:nth-child(1),
      #supportBldTable_wrap .table-wrap th:nth-child(1), #supportBldTable_wrap .table-wrap td:nth-child(1){
        position:sticky; inset-inline-start:0; z-index:3;
        background:var(--panel); box-shadow:3px 0 6px -3px rgba(0,0,0,.16);
      }
      #sysBldTable_wrap .table-wrap th:nth-child(2), #sysBldTable_wrap .table-wrap td:nth-child(2),
      #supportBldTable_wrap .table-wrap th:nth-child(2), #supportBldTable_wrap .table-wrap td:nth-child(2){
        position:sticky; inset-inline-start:var(--pin1,150px); z-index:2;
        background:var(--panel); box-shadow:3px 0 6px -3px rgba(0,0,0,.10);
      }
      #sysBldTable_wrap .table-wrap thead th, #supportBldTable_wrap .table-wrap thead th{
        position:sticky; top:0; z-index:4; background:var(--tablehead,#F4F1E8);
      }
      #sysBldTable_wrap .table-wrap thead th:nth-child(1),
      #supportBldTable_wrap .table-wrap thead th:nth-child(1){ z-index:6; }
      #sysBldTable_wrap .table-wrap thead th:nth-child(2),
      #supportBldTable_wrap .table-wrap thead th:nth-child(2){ z-index:5; }
    </style>`;
  }

  function pinBar(){
    const on = pinned();
    let full = false;
    try{ full = localStorage.getItem('sysBldTable_colsTouched') === '1'; }catch(e){}
    return `<div class="flexrow mtop" style="gap:8px;flex-wrap:wrap">
      <button class="btn sm ${demosShown()?'primary':'ghost'}"
        onclick="showDemoBuildings(${demosShown()?'false':'true'})"
        title="جلسات الزوّار المؤقتة">
        ${demosShown()?'🧪 التجريبية ظاهرة':'🧪 إظهار التجريبية'}</button>
      <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
        <button class="btn sm ${full?'ghost':'primary'}" style="border-radius:0"
          onclick="showEssentialBldCols('sysBldTable')">📋 عرض مبسّط</button>
        <button class="btn sm ${full?'primary':'ghost'}" style="border-radius:0"
          onclick="showAllBldCols('sysBldTable')">📊 كل الأعمدة</button>
      </span>
      <button class="btn sm ${on?'primary':'ghost'}" onclick="togglePinnedCols()">
        ${on ? '📌 العمودين مثبّتين' : '📍 تثبيت اسم العمارة والكود'}</button>
      <span class="small" style="color:var(--muted)">
        ${on ? 'اسم العمارة والكود بيفضلوا ظاهرين وإنت بتتحرك يمين وشمال'
             : 'الأعمدة كلها بتتحرك مع بعض'}</span>
    </div>`;
  }

  /* بنقيس عرض أول عمود عشان نظبط مكان التاني */
  function measurePins(){
    if (!pinned()) return;
    setTimeout(() => {
      ['sysBldTable','supportBldTable'].forEach(id => {
        const wrap = document.getElementById(id + '_wrap');
        if (!wrap) return;
        const th = wrap.querySelector('.table-wrap thead th:nth-child(1)');
        if (th) wrap.style.setProperty('--pin1', th.offsetWidth + 'px');
      });
    }, 60);
  }

  /* ---------- ٢) مؤشرات كل عمارة ---------- */

  function metrics(b){
    const d = (window.loadBuildingData && loadBuildingData(b.id)) || null;

    /* العمارة مش محمّلة بالكامل: بنستخدم الملخّص اللي الخادم
       حسبه (__stats) بدل ما نسيب الأعمدة فاضية. تحميل كل عمارة
       عشان تعرض ٥ أرقام كان بياخد ثواني. */
    if ((!d || d.__summary) && b.__stats){
      const st = b.__stats;
      const idle = st.lastActivity
        ? Math.round((Date.now() - new Date(st.lastActivity).getTime())/86400000) : null;
      /* نفس أسماء حقول النسخة الكاملة عشان الأعمدة تقراها زي ما هي */
      return {
        loaded:true, fromSummary:true,
        aps: st.units, open: st.openUnits,
        withPhone: st.withPhone, withFee: st.withFee,
        invited: st.invited, joined: st.joined, users: st.users,
        moves: st.moves,
        perMonth: Math.round((st.moves||0) / Math.max(1, st.monthsSpan||1)),
        setup: Math.round((st.setupPct||0)/20),
        lastAct: st.lastActivity || '', daysIdle: idle,
      };
    }
    if (!d) return { loaded:false };
    const aps = d.apartments || [];
    const users = d.users || [];
    const open = aps.filter(a => !a.closed);
    const withPhone = aps.filter(a => a.phone).length;
    const withFee = open.filter(a => Number(a.monthlyFee) > 0).length;
    const invited = users.filter(u => u.apartmentId && u.inviteStatus === 'pending').length;
    const joined = users.filter(u => u.apartmentId && u.inviteStatus !== 'pending').length;
    const moves = (d.ledger || []).length + (d.expenses || []).length;

    const dates = (d.ledger || []).map(x => x.date).filter(Boolean).sort();
    const first = dates[0], last = dates[dates.length - 1];
    let months = 1;
    if (first && last){
      const a = new Date(first), z = new Date(last);
      months = Math.max(1, (z.getFullYear()-a.getFullYear())*12 + (z.getMonth()-a.getMonth()) + 1);
    }
    const lastAct = [last, ...(d.activityLog||[]).map(x => (x.date||'').slice(0,10))]
      .filter(Boolean).sort().pop() || '';
    const daysIdle = lastAct
      ? Math.round((Date.now() - new Date(lastAct).getTime()) / 86400000) : null;

    // نسبة اكتمال الإعداد — نفس منطق معالج البداية
    const setup = [
      !!(d.building && d.building.name && d.building.city),
      aps.length > 0,
      aps.length > 0 && withFee === open.length,
      (d.ledger || []).some(l => l.type === 'شهري'),
      (invited + joined) > 0,
    ].filter(Boolean).length;

    return { loaded:true, aps:aps.length, open:open.length, withPhone, withFee,
             invited, joined, moves, perMonth: Math.round(moves / months),
             lastAct, daysIdle, setup, users: users.length };
  }

  const EXTRA_COLS = [
    { key:'setupPct', label:'اكتمال الإعداد',
      value: m => m.loaded ? m.setup*20 : -1,
      cell: m => !m.loaded ? '<span class="small">—</span>' :
        `<span class="badge ${m.setup>=5?'g':m.setup>=3?'y':'r'}">${m.setup*20}%</span>` },

    { key:'withPhone', label:'وحدات بأرقام',
      value: m => m.loaded ? m.withPhone : -1,
      cell: m => !m.loaded ? '—' :
        `${m.withPhone} <span class="small" style="color:var(--muted)">من ${m.aps}</span>` },

    { key:'invited', label:'دعوات مستنية',
      value: m => m.loaded ? m.invited : -1,
      cell: m => !m.loaded ? '—' : (m.invited ? `<span class="badge y">${m.invited}</span>` : '0') },

    { key:'joined', label:'وحدات عندها حساب',
      value: m => m.loaded ? m.joined : -1,
      cell: m => !m.loaded ? '—' :
        `<span class="badge ${m.joined?'g':'n'}">${m.joined}</span>` },

    { key:'adoption', label:'نسبة انضمام السكان',
      value: m => m.loaded && m.aps ? Math.round(m.joined/m.aps*100) : -1,
      cell: m => (!m.loaded || !m.aps) ? '—' :
        `<span class="badge ${m.joined/m.aps>=.5?'g':m.joined?'y':'r'}">${Math.round(m.joined/m.aps*100)}%</span>` },

    { key:'moves', label:'الحركات المالية',
      value: m => m.loaded ? m.moves : -1,
      cell: m => m.loaded ? String(m.moves) : '—' },

    { key:'perMonth', label:'متوسط الحركات شهريًا',
      value: m => m.loaded ? m.perMonth : -1,
      cell: m => !m.loaded ? '—' :
        `<span class="badge ${m.perMonth>=20?'g':m.perMonth>=5?'y':'n'}">${m.perMonth}</span>` },

    { key:'lastAct', label:'آخر نشاط',
      value: m => m.lastAct || '',
      cell: m => !m.lastAct ? '<span class="small" style="color:var(--muted)">مفيش</span>' :
        `${esc2(m.lastAct)} <span class="badge ${m.daysIdle<=7?'g':m.daysIdle<=30?'y':'r'}">${m.daysIdle} يوم</span>` },

    { key:'health', label:'حالة الاستخدام',
      value: m => {
        if (!m.loaded) return 0;
        if (m.daysIdle !== null && m.daysIdle > 30) return 1;   // متوقفة
        if (m.setup < 3) return 2;                              // متعثّرة
        if (m.joined === 0) return 3;                           // بدون سكان
        if (m.perMonth >= 10) return 5;                         // نشطة
        return 4;
      },
      cell: m => {
        const v = !m.loaded ? 0 : (m.daysIdle !== null && m.daysIdle > 30) ? 1
                : m.setup < 3 ? 2 : m.joined === 0 ? 3 : m.perMonth >= 10 ? 5 : 4;
        return ['<span class="small">—</span>',
                '<span class="badge r">🔴 متوقفة</span>',
                '<span class="badge y">🟡 إعداد ناقص</span>',
                '<span class="badge y">🟠 بدون سكان</span>',
                '<span class="badge g">🟢 شغّالة</span>',
                '<span class="badge g">💚 نشطة جدًا</span>'][v];
      } },
  ];


  /* ---------- ٣) عمود الإجراءات: "فتح" + قائمة ⋮ ---------- */

  /* القائمة بتتنقل لطبقة فوق الصفحة كلها.
     لو فضلت جوه الجدول، الحاوية اللي بتتمرّر بتقصّها فمتبانش. */
  function closeRowMenus(){
    const layer = document.getElementById('rowMenuLayer');
    if (layer) layer.remove();
  }
  window.closeRowMenus = closeRowMenus;

  window.toggleRowMenu = function(id, ev){
    const src = document.getElementById(id);
    const already = document.getElementById('rowMenuLayer');
    closeRowMenus();
    if (already && already.dataset.src === id) return;      // نفس الزرار = قفل
    if (!src) return;

    const btn = (ev && ev.currentTarget) || document.activeElement ||
                src.parentElement.querySelector('button[title="خيارات أكتر"]');
    const r = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : { bottom:80, right:200, left:120 };

    const layer = document.createElement('div');
    layer.id = 'rowMenuLayer';
    layer.dataset.src = id;
    layer.style.cssText =
      'position:fixed;z-index:99000;min-width:210px;background:var(--panel);' +
      'border:1px solid var(--line);border-radius:12px;padding:6px;' +
      'box-shadow:0 14px 34px rgba(0,0,0,.20);direction:rtl;text-align:start';
    layer.innerHTML = src.innerHTML;

    document.body.appendChild(layer);
    // بنحطها تحت الزرار، ولو مفيش مكان تحت بنطلّعها فوقه
    const h = layer.offsetHeight || 180, w = layer.offsetWidth || 210;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    let left = r.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    layer.style.top = top + 'px';
    layer.style.left = left + 'px';
  };

  document.addEventListener('click', e => {
    if (e.target.closest && (e.target.closest('#rowMenuLayer') || e.target.closest('.row-menu-wrap'))) return;
    closeRowMenus();
  });
  window.addEventListener('scroll', closeRowMenus, true);
  window.addEventListener('resize', closeRowMenus);

  /* بناخد أزرار العمود الأصلي ونعيد ترتيبها */
  function compactActions(html, rowId){
    const btns = String(html).match(/<button[\s\S]*?<\/button>/g) || [];
    if (btns.length <= 1) return html;

    const label = b => b.replace(/<[^>]*>/g,'').trim();
    const openIdx = btns.findIndex(b => /فتح/.test(label(b)));
    const primary = openIdx >= 0 ? btns[openIdx] : btns[0];
    const rest = btns.filter((_,i) => i !== (openIdx >= 0 ? openIdx : 0));
    if (!rest.length) return html;

    const mid = 'rm_' + String(rowId).replace(/[^\w]/g,'') + '_' + Math.random().toString(36).slice(2,6);
    const items = rest.map(b => {
      const onclick = (b.match(/onclick="([^"]*)"/) || [])[1] || '';
      const isRed = /class="[^"]*\bred\b/.test(b);
      let txt = label(b);
      const title = (b.match(/title="([^"]*)"/) || [])[1];
      if (txt.length <= 2 && title) txt = title;      // زرار بأيقونة بس
      if (/^🔑/.test(txt) && txt.length <= 3) txt = '🔑 إعادة تعيين كلمة السر';
      return `<button class="btn ghost" style="display:block;width:100%;text-align:start;border:0;
                padding:8px 10px;margin:0;${isRed?'color:var(--red)':''}"
                onclick="closeRowMenus();${onclick.replace(/"/g,'&quot;')}">${txt}</button>`;
    }).join('');

    return `<div class="flexrow row-menu-wrap" style="gap:4px;position:relative;justify-content:flex-start">
      ${primary}
      <button class="btn sm ghost" style="padding:4px 9px;font-size:16px;line-height:1"
        title="خيارات أكتر" onclick="toggleRowMenu('${mid}', event)">⋮</button>
      <div id="${mid}" class="row-menu" style="display:none;position:absolute;z-index:70;
           top:calc(100% + 5px);inset-inline-end:0;min-width:190px;background:var(--panel);
           border:1px solid var(--line);border-radius:11px;box-shadow:0 10px 28px rgba(0,0,0,.16);
           padding:5px;text-align:start">${items}</div>
    </div>`;
  }


  /* ============================================================
     ٤) عرض مبسّط: أعمدة أساسية + بطاقة تفاصيل كاملة
     ============================================================ */

  /* الأعمدة اللي تظهر افتراضيًا — الباقي في البطاقة */
  const ESSENTIALS = ['name','code','apCount','status','health','setupPct','joined','adminLogin','lastAct','x'];

  function applyDefaultVisibility(tableId, cols){
    const visKey = tableId + '_vis';
    try{
      if (localStorage.getItem(tableId + '_colsTouched') === '1') return;   // المستخدم عدّل بنفسه
    }catch(e){}
    if (window.__bldVisDone) return;
    window.__bldVisDone = true;
    window[visKey] = cols.map(c => c.key).filter(k => ESSENTIALS.includes(k));
  }

  /* لو المستخدم فتح مخصّص الأعمدة، نحترم اختياره بعد كده */
  const origCust = window.openColumnCustomizer;
  if (origCust && !origCust.__bld){
    const w2 = function(){
      try{ localStorage.setItem('sysBldTable_colsTouched','1'); }catch(e){}
      return origCust.apply(this, arguments);
    };
    w2.__bld = true;
    window.openColumnCustomizer = w2;
  }

  window.showAllBldCols = function(tableId){
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    if (!cfg) return;
    window[tableId + '_vis'] = cfg.columns.map(c => c.key);
    try{ localStorage.setItem(tableId + '_colsTouched','1'); }catch(e){}
    if (window.renderSysContent) renderSysContent(); else renderContent();
  };
  window.showEssentialBldCols = function(tableId){
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    if (!cfg) return;
    window[tableId + '_vis'] = cfg.columns.map(c => c.key).filter(k => ESSENTIALS.includes(k));
    try{ localStorage.removeItem(tableId + '_colsTouched'); }catch(e){}
    if (window.renderSysContent) renderSysContent(); else renderContent();
  };

  /* ---------- بطاقة العمارة ---------- */

  const F = (label, val) => val === '' || val === null || val === undefined
    ? '' : `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed var(--line)">
        <span class="small" style="color:var(--muted);min-width:130px">${esc2(label)}</span>
        <span class="small" style="flex:1"><b>${val}</b></span></div>`;


  /* فتح نافذة تانية بعد ما البطاقة تتقفل — من غير التأخير ده
     النافذة الجديدة بتتقفل مع القديمة فمتبانش. */
  window.bldCardGo = function(fnName, arg){
    closeModal();
    setTimeout(() => {
      const f = window[fnName];
      if (typeof f === 'function') f(arg);
      else showMessage('الإجراء ده مش متاح دلوقتي');
    }, 120);
  };

  /* بيانات تواصل رئيس الاتحاد — تعديل سريع */
  window.openBuildingContact = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    openModal(`
      <h3>📞 بيانات التواصل — ${esc2(b.name||'')}</h3>
      <p class="small mtop">بتستخدمها في تذكير التجديد والتواصل مع رئيس الاتحاد.</p>
      <div class="field2 mtop"><label>اسم رئيس الاتحاد</label>
        <input id="bcName" value="${esc2(b.adminName||'')}"></div>
      <div class="grid g2">
        <div class="field2"><label>مفتاح الدولة</label>
          <input id="bcCC" value="${esc2(b.contactPhoneCountry||'+20')}" dir="ltr"></div>
        <div class="field2"><label>الموبايل / واتساب</label>
          <input id="bcPhone" value="${esc2(b.contactPhone||'')}" dir="ltr"></div>
      </div>
      <div class="field2"><label>البريد الإلكتروني</label>
        <input id="bcEmail" value="${esc2(b.adminEmail||'')}" dir="ltr"></div>
      <div class="field2"><label>صفحة فيسبوك (اختياري)</label>
        <input id="bcFb" value="${esc2(b.facebookUrl||'')}" dir="ltr" placeholder="https://facebook.com/..."></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveBuildingContact('${bid}')">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveBuildingContact = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const g = i => (document.getElementById(i)||{}).value || '';
    b.adminName = g('bcName').trim();
    b.contactPhoneCountry = g('bcCC').trim() || '+20';
    b.contactPhone = g('bcPhone').replace(/[^\d]/g,'');
    b.adminEmail = g('bcEmail').trim();
    b.facebookUrl = g('bcFb').trim();
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظت بيانات التواصل');
    if (window.renderSysContent) renderSysContent();
  };


  /* ---------- تعطيل / تفعيل العمارة بسبب وتاريخ ---------- */

  window.openSuspendModal = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const lic = window.ensureLicense ? ensureLicense(b) : (b.license || {});
    const isOff = lic.status === 'suspended';
    const sus = lic.suspension || {};

    if (isOff){
      openModal(`
        <h3>▶️ إعادة تفعيل ${esc2(b.name||'')}</h3>
        <div class="card mtop" style="border:1px solid var(--red)">
          <b>العمارة موقوفة حاليًا</b>
          <p class="small mtop">السبب: ${esc2(sus.reason || 'مش مسجّل')}</p>
          <p class="small">تاريخ الإيقاف: ${esc2((sus.at||'').slice(0,10) || '—')}</p>
          ${sus.until ? `<p class="small">مفترض ينتهي: ${esc2(sus.until)}</p>` : ''}
          ${sus.by ? `<p class="small" style="color:var(--muted)">أوقفها: ${esc2(sus.by)}</p>` : ''}
        </div>
        <p class="small mtop">رئيس الاتحاد والسكان مش بيقدروا يستخدموا العمارة وهي موقوفة.</p>
        <div class="modal-actions">
          <button class="btn primary" onclick="applySuspend('${bid}',false)">▶️ فعّلها تاني</button>
          <button class="btn ghost" onclick="closeModal()">إلغاء</button>
        </div>`, true);
      return;
    }

    const reasons = ['عدم سداد الاشتراك','مخالفة شروط الاستخدام','بطلب من رئيس الاتحاد',
                     'بيانات غير صحيحة','إيقاف مؤقت للمراجعة','سبب آخر'];
    openModal(`
      <h3>⏸️ تعطيل ${esc2(b.name||'')}</h3>
      <p class="small mtop">لما تعطّلها، رئيس الاتحاد والسكان هيشوفوا رسالة إن الاشتراك موقوف
      ومش هيقدروا يستخدموا البرنامج. <b>البيانات كلها بتفضل محفوظة.</b></p>

      <div class="field2 mtop2"><label>سبب التعطيل</label>
        <select id="spReason" onchange="document.getElementById('spOtherWrap').style.display=this.value==='سبب آخر'?'block':'none'">
          ${reasons.map(r => `<option>${r}</option>`).join('')}
        </select></div>
      <div class="field2" id="spOtherWrap" style="display:none"><label>اكتب السبب</label>
        <input id="spOther" placeholder="السبب بالتفصيل"></div>

      <div class="grid g2">
        <div class="field2"><label>تاريخ التعطيل</label>
          <input id="spAt" type="date" value="${window.todayISO?todayISO():''}"></div>
        <div class="field2"><label>مفترض ينتهي (اختياري)</label>
          <input id="spUntil" type="date"></div>
      </div>

      <div class="field2"><label>ملاحظة داخلية (اختياري)</label>
        <input id="spNote" placeholder="مش بتظهر للعميل"></div>

      <div class="modal-actions">
        <button class="btn red" onclick="applySuspend('${bid}',true)">⏸️ عطّل العمارة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.applySuspend = function(bid, off){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const lic = window.ensureLicense ? ensureLicense(b) : (b.license = b.license || {});
    const g = i => (document.getElementById(i) || {}).value || '';

    if (off){
      let reason = g('spReason');
      if (reason === 'سبب آخر') reason = g('spOther').trim() || 'سبب آخر';
      lic.status = 'suspended';
      lic.suspension = {
        reason,
        at: g('spAt') || (window.todayISO ? todayISO() : ''),
        until: g('spUntil') || '',
        note: g('spNote').trim(),
        by: (window.REG && REG.sysOwner && REG.sysOwner.name) || 'صاحب البرنامج',
      };
    }else{
      lic.status = (lic.endDate && lic.endDate < (window.todayISO?todayISO():'')) ? 'expired'
                 : (lic.plan && /trial|promo/.test(String(lic.plan)) ? 'trial' : 'active');
      lic.suspension = Object.assign({}, lic.suspension || {}, {
        liftedAt: window.todayISO ? todayISO() : '',
      });
    }

    try{
      if (window.logLicenseEvent)
        logLicenseEvent(bid, off ? ('إيقاف الاشتراك — ' + lic.suspension.reason) : 'إعادة تفعيل الاشتراك');
    }catch(e){}
    saveRegistry();
    closeModal();
    if (window.toast) toast(off ? '⏸️ اتعطّلت العمارة' : '▶️ اترجّعت العمارة للخدمة');
    if (window.renderSysContent) renderSysContent();
  };

  window.openBuildingCard = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const m = metrics(b);
    const lic = window.ensureLicense ? ensureLicense(b) : (b.license || {});
    const st  = window.licenseState ? licenseState(lic) : { label: lic.status || '' };

    const health = !m.loaded ? '—'
      : (m.daysIdle !== null && m.daysIdle > 30) ? '<span class="badge r">🔴 متوقفة</span>'
      : m.setup < 3 ? '<span class="badge y">🟡 إعداد ناقص</span>'
      : m.joined === 0 ? '<span class="badge y">🟠 بدون سكان</span>'
      : m.perMonth >= 10 ? '<span class="badge g">💚 نشطة جدًا</span>'
      : '<span class="badge g">🟢 شغّالة</span>';

    openModal(`
      <h3>🏢 ${esc2(b.name || '')} <span class="small" style="color:var(--muted)">${esc2(b.code || '')}</span></h3>

      <div class="flexrow mtop" style="flex-wrap:wrap;gap:7px">
        ${health}
        <span class="badge ${st.badge || 'n'}">${esc2(st.label || '')}</span>
        ${m.loaded ? `<span class="badge n">اكتمال الإعداد ${m.setup*20}%</span>` : ''}
      </div>

      ${lic.status==='suspended' ? `
        <div class="card mtop" style="border:1px solid var(--red);background:#FFF6F5">
          <b style="color:var(--red)">⏸️ العمارة موقوفة</b>
          <p class="small mtop">السبب: <b>${esc2((lic.suspension||{}).reason || 'مش مسجّل')}</b>
            ${(lic.suspension||{}).at ? ` · من ${esc2(lic.suspension.at)}` : ''}
            ${(lic.suspension||{}).until ? ` · لحد ${esc2(lic.suspension.until)}` : ''}</p>
          ${(lic.suspension||{}).note ? `<p class="small" style="color:var(--muted)">${esc2(lic.suspension.note)}</p>` : ''}
        </div>` : ''}

      <div class="grid g2 mtop2">
        <div class="card">
          <b>📊 مؤشرات الاستخدام</b>
          <div class="mtop">
            ${F('إجمالي الوحدات', m.loaded ? m.aps : (b.apartmentsCount || '—'))}
            ${F('وحدات مفتوحة', m.loaded ? m.open : '')}
            ${F('وحدات بأرقام موبايل', m.loaded ? `${m.withPhone} من ${m.aps}` : '')}
            ${F('اشتراكات محدّدة', m.loaded ? `${m.withFee} من ${m.open}` : '')}
            ${F('دعوات مستنية', m.loaded ? m.invited : '')}
            ${F('وحدات عندها حساب', m.loaded ? m.joined : '')}
            ${F('نسبة انضمام السكان', m.loaded && m.aps ? Math.round(m.joined/m.aps*100)+'%' : '')}
            ${F('الحركات المالية', m.loaded ? m.moves : '')}
            ${F('متوسط الحركات شهريًا', m.loaded ? m.perMonth : '')}
            ${F('آخر نشاط', m.lastAct ? `${m.lastAct} <span class="small">(${m.daysIdle} يوم)</span>` : 'مفيش')}
            ${F('آخر دخول للأدمن', b.lastAdminLoginAt
              ? (window.fmtDateTime ? fmtDateTime(b.lastAdminLoginAt) : String(b.lastAdminLoginAt).slice(0,16)) +
                (b.lastAdminLoginName ? ` <span class="small">(${esc2(b.lastAdminLoginName)})</span>` : '')
              : 'مدخلش لسه')}
          </div>
        </div>

        <div class="card">
          <b>🪪 الاشتراك</b>
          <div class="mtop">
            ${F('الخطة', window.planName ? planName(lic.plan) : (lic.plan || '—'))}
            ${F('تاريخ البدء', lic.startDate || '—')}
            ${F('تاريخ الانتهاء', lic.endDate || 'بلا نهاية')}
            ${F('المتبقّي', st.daysLeft !== null && st.daysLeft !== undefined ? st.daysLeft + ' يوم' : '')}
            ${F('حد الوحدات', lic.maxApartments || 'غير محدود')}
          </div>
          <b class="mtop2" style="display:block">👤 رئيس الاتحاد</b>
          <div class="mtop">
            ${F('الاسم', esc2(b.adminName || '—'))}
            ${F('الموبايل', `<span dir="ltr">${esc2((b.contactPhoneCountry||'')+' '+(b.contactPhone||''))}</span>`)}
            ${F('البريد', `<span dir="ltr">${esc2(b.adminEmail || '—')}</span>`)}
            ${b.facebookUrl ? F('فيسبوك', `<a href="${esc2(b.facebookUrl)}" target="_blank" rel="noopener">📘 الصفحة ↗</a>`) : ''}
          </div>
          <b class="mtop2" style="display:block">📍 الموقع</b>
          <div class="mtop">
            ${F('المدينة', esc2(b.city || '—'))}
            ${F('المحافظة', esc2(b.governorate || '—'))}
            ${F('العنوان', esc2(b.address || '—'))}
            ${F('تاريخ الإنشاء', (b.createdAt || '').slice(0,10))}
          </div>
        </div>
      </div>

      <div class="flexrow mtop2" style="flex-wrap:wrap;gap:8px">
        <button class="btn primary" onclick="bldCardGo('impersonateBuilding','${b.id}')">🏢 افتح العمارة</button>
        <button class="btn gold" onclick="bldCardGo('openLicenseManage','${b.id}')">🪪 الاشتراك</button>
        ${b.contactPhone || b.adminPhoneRaw
          ? `<a class="btn ghost" target="_blank" onclick="closeModal()"
               href="${window.renewalWhatsAppLink ? renewalWhatsAppLink(b) : '#'}">💬 تذكير تجديد</a>` : ''}
        <button class="btn ghost" onclick="bldCardGo('renameBuildingPrompt','${b.id}')">✏️ تعديل الاسم</button>
        <button class="btn ghost" onclick="bldCardGo('openBuildingContact','${b.id}')">📞 بيانات التواصل</button>
        <button class="btn ${lic.status==='suspended'?'primary':'red'}"
          onclick="bldCardGo('openSuspendModal','${b.id}')">
          ${lic.status==='suspended' ? '▶️ إعادة تفعيل' : '⏸️ تعطيل العمارة'}</button>
      </div>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  /* العمارات التجريبية بتتخفي افتراضيًا — دي جلسات زوّار مش عملاء،
     ووجودها بيلخبط العدّادات والقوايم. */
  window.showDemoBuildings = function(on){
    try{ localStorage.setItem('emartna_show_demos', on ? '1' : '0'); }catch(e){}
    if (window.renderSysContent) renderSysContent();
  };
  function demosShown(){
    try{ return localStorage.getItem('emartna_show_demos') === '1'; }catch(e){ return false; }
  }
  const isDemoRec = b => !!(b && (b.isDemo || b.is_demo ||
    /\(تجريبية\)/.test(String(b.name || ''))));
  window.__isDemoRec = isDemoRec;

  /* بنحقن الأعمدة في نداء sortableTable لجدول العمارات */
  const origSortable = window.sortableTable;
  if (origSortable) window.sortableTable = function(id, rows, cols, groupBy, opts){
    if ((id === 'sysBldTable' || id === 'supportBldTable') && Array.isArray(rows) && Array.isArray(cols)){
      if (!demosShown()) rows = rows.filter(b => !isDemoRec(b));
      const cache = new Map();
      const M = b => { if (!cache.has(b.id)) cache.set(b.id, metrics(b)); return cache.get(b.id); };
      const extra = EXTRA_COLS.map(c => ({
        key: c.key, label: c.label,
        value: b => c.value(M(b)),
        cell:  b => c.cell(M(b)),
      }));

      /* آخر دخول لرئيس الاتحاد — بيتقرا من سجل العمارة مباشرة
         مش من المؤشرات، عشان القيمة جاية من الخادم. */
      const daysSince = v => v ? Math.floor((Date.now() - new Date(v).getTime())/86400000) : null;
      extra.push({
        key:'adminLogin', label:'آخر دخول للأدمن',
        value: b => b.lastAdminLoginAt || '',
        cell: b => {
          const v = b.lastAdminLoginAt;
          if (!v) return '<span class="small" style="color:var(--muted)">مدخلش لسه</span>';
          const d = daysSince(v);
          const txt = window.fmtDate ? fmtDate(String(v).slice(0,10)) : String(v).slice(0,10);
          const rel = d === 0 ? 'النهاردة' : d === 1 ? 'إمبارح' : 'من ' + d + ' يوم';
          const cls = d <= 3 ? 'g' : d <= 14 ? 'y' : 'r';
          return `${esc2(txt)}<br><span class="badge ${cls}">${rel}</span>` +
                 (b.lastAdminLoginName
                   ? `<div class="small" style="color:var(--muted)">${esc2(b.lastAdminLoginName)}</div>` : '');
        },
      });

      let last = cols[cols.length-1] && !cols[cols.length-1].value ? cols.pop() : null;
      cols = cols.concat(extra);
      if (last){
        const origCell = last.cell;
        cols.push(Object.assign({}, last, {
          key: last.key || 'x',
          label: last.label || 'إجراءات',
          cell: b => `<div class="flexrow" style="gap:5px;justify-content:flex-start">
              <button class="btn sm primary" onclick="openBuildingCard('${b.id}')">تفاصيل</button>
              ${compactActions(origCell ? origCell(b) : '', b.id || b.code || 'x')}
            </div>`,
        }));
      }
      if (id === 'sysBldTable') applyDefaultVisibility(id, cols);
      measurePins();
    }
    return origSortable.call(this, id, rows, cols, groupBy, opts);
  };

  /* شريط التثبيت في الشاشتين */
  ['pageSysDashboard','pageSupportBuildingsView'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(){
      const html = orig.apply(this, arguments);
      measurePins();
      return tableRoomCss() + pinStyle() + pinBar() + html;
    };
  });

  console.log('[عمارتنا] أعمدة العمارات الثابتة والمؤشرات جاهزة');
})();

})();

/* ═══ emartna-reminder.js ═══ */
(function(){
/* ============================================================
   عمارتنا — التذكير اليومي بتسجيل المصروفات
   ------------------------------------------------------------
   رئيس الاتحاد بيحدد ميعاد، والبرنامج بيذكّره كل يوم:
     • إشعار على الجهاز (لو أذن بالإشعارات)
     • وشريط داخل البرنامج لو مفتوح
   الميعاد والحالة بيتحفظوا على الخادم مع بيانات العمارة،
   فالإعداد بيمشي معاه على أي جهاز.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const SEEN = 'emartna_reminder_seen';       // آخر يوم اتعرض فيه (محلي)

  function cfg(){
    const D = window.D;
    if (!D || !D.building) return null;
    D.building.dailyReminder = D.building.dailyReminder || {
      enabled: false, time: '20:00', lastPrompt: '',
    };
    return D.building.dailyReminder;
  }

  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));

  /* هل اتسجّل مصروف النهاردة؟ */
  function loggedToday(){
    const D = window.D || {};
    const t = today();
    return (D.expenses || []).some(e => (e.date||'') === t);
  }

  /* ---------- الإعداد ---------- */

  window.openReminderModal = function(){
    const c = cfg();
    if (!c) return;
    const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
    const permTxt = perm === 'granted' ? '✅ الإشعارات مفعّلة على الجهاز ده'
                  : perm === 'denied'  ? '🔕 الإشعارات مرفوضة من إعدادات المتصفح — فعّلها من هناك'
                  : perm === 'unsupported' ? '⚠️ متصفحك مش بيدعم الإشعارات'
                  : '🔔 محتاج إذن الإشعارات — اضغط الزرار تحت';

    openModal(`
      <h3>⏰ تذكير يومي بتسجيل المصروفات</h3>
      <p class="small mtop">
        أكتر حاجة بتضيع في إدارة العمارة هي المصروفات الصغيرة اللي بتتنسى.
        التذكير بيوصلك كل يوم في الميعاد اللي تحدده.
      </p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="remOn" ${c.enabled?'checked':''}> تفعيل التذكير اليومي</label>
      </div>
      <div class="field2 mtop">
        <label>ميعاد التذكير</label>
        <input id="remTime" type="time" value="${esc2(c.time||'20:00')}">
      </div>

      <div class="card mtop">
        <p class="small">${permTxt}</p>
        ${perm === 'default' ? `<button class="btn sm gold mtop" onclick="askNotifPermission()">
          🔔 فعّل إشعارات الجهاز</button>` : ''}
      </div>

      <p class="small mtop" style="color:var(--muted)">
        ℹ️ الإشعار بيظهر على الجهاز اللي فعّلت عليه، والتطبيق لازم يكون مثبّت أو
        الصفحة مفتوحة في خلفية المتصفح. لو قفلت المتصفح تمامًا، هتلاقي التذكير
        كشريط جوه البرنامج أول ما تفتحه.
      </p>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveReminder()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.askNotifPermission = async function(){
    if (typeof Notification === 'undefined') return showMessage('متصفحك مش بيدعم الإشعارات');
    try{
      const p = await Notification.requestPermission();
      if (window.toast) toast(p === 'granted' ? 'اتفعّلت الإشعارات ✅' : 'الإذن اترفض');
      openReminderModal();
    }catch(e){}
  };

  window.saveReminder = function(){
    const c = cfg(); if (!c) return;
    c.enabled = !!(document.getElementById('remOn')||{}).checked;
    c.time    = (document.getElementById('remTime')||{}).value || '20:00';
    save();
    closeModal();
    if (window.toast) toast(c.enabled ? `هيوصلك تذكير يومي ${c.time}` : 'اتوقف التذكير');
    renderContent();
  };

  /* ---------- التنفيذ ---------- */

  function dueNow(){
    const c = cfg();
    if (!c || !c.enabled) return false;
    if (loggedToday()) return false;                  // سجّل خلاص — مش محتاج تذكير
    const [h,m] = String(c.time||'20:00').split(':').map(Number);
    const now = new Date();
    return (now.getHours()*60 + now.getMinutes()) >= (h*60 + (m||0));
  }

  function seenToday(){
    try{ return localStorage.getItem(SEEN) === today(); }catch(e){ return false; }
  }
  function markSeen(){
    try{ localStorage.setItem(SEEN, today()); }catch(e){}
  }

  function fireNotification(){
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    try{
      const b = (window.D && D.building && D.building.name) || 'عمارتك';
      const n = new Notification('عمارتنا — تذكير يومي', {
        body: `سجّل مصروفات النهاردة في ${b} قبل ما تتنسى 📝`,
        icon: (window.__appIcons && window.__appIcons[0] && window.__appIcons[0].src) || undefined,
        tag: 'emartna-daily',
      });
      n.onclick = () => { window.focus(); if (window.go) go('expenses'); n.close(); };
      return true;
    }catch(e){ return false; }
  }

  function showBar(){
    if (document.getElementById('remBar')) return;
    const bar = document.createElement('div');
    bar.id = 'remBar';
    bar.style.cssText = 'position:fixed;bottom:14px;inset-inline-end:14px;z-index:9400;' +
      'background:var(--gold,#D8A33B);color:#3b2c07;padding:10px 14px;border-radius:12px;' +
      'font:600 13px/1.7 system-ui;direction:rtl;max-width:min(92vw,380px);' +
      'box-shadow:0 6px 20px rgba(0,0,0,.18)';
    bar.innerHTML = '📝 سجّلت مصروفات النهاردة؟ ' +
      '<button onclick="go(\'expenses\');this.parentNode.remove()" ' +
      'style="margin-inline-start:8px;background:#fff;border:0;border-radius:6px;' +
      'padding:4px 12px;cursor:pointer;font-weight:700">افتح المصروفات</button>' +
      '<button onclick="this.parentNode.remove()" style="margin-inline-start:6px;' +
      'background:none;border:0;cursor:pointer;opacity:.7">لاحقًا</button>';
    document.body.appendChild(bar);
  }

  function check(){
    try{
      const u = window.currentUser && currentUser();
      if (!u || u.role !== 'admin') return;
      if (!dueNow() || seenToday()) return;
      markSeen();
      if (!fireNotification()) showBar();
      else setTimeout(showBar, 1500);          // الشريط كمان لو البرنامج مفتوح
    }catch(e){}
  }

  setInterval(check, 60 * 1000);
  setTimeout(check, 6000);

  /* بطاقة الإعداد في شاشة المصروفات */
  const origExp = window.pageExpenses;
  if (origExp) window.pageExpenses = function(){
    const html = origExp.apply(this, arguments);
    const c = cfg();
    if (!c) return html;
    const card = `
      <div class="card" style="border:1px dashed var(--line)">
        <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <b>⏰ التذكير اليومي</b>
            <div class="small" style="color:var(--muted)">
              ${c.enabled ? `مفعّل — كل يوم الساعة ${esc2(c.time)}${loggedToday()?' · سجّلت النهاردة ✅':''}`
                          : 'مقفول — فعّله عشان ما تنساش مصروفات اليوم'}
            </div>
          </div>
          <button class="btn sm ${c.enabled?'ghost':'gold'}" onclick="openReminderModal()">
            ${c.enabled ? 'تعديل' : '🔔 فعّل التذكير'}</button>
        </div>
      </div>`;
    return card + html;
  };

  console.log('[عمارتنا] التذكير اليومي جاهز');
})();

})();

/* ═══ emartna-coupons.js ═══ */
(function(){
/* ============================================================
   عمارتنا — أكواد الخصم: جدول + فلاتر + توضيح الحالة
   ------------------------------------------------------------
   المشكلة اللي اتصلحت: "تعطيل" كان بيخلي الكارت يبان زي الباقي
   تقريبًا، فالمستخدم يفتكر إن الكود اتحذف. دلوقتي:
     • جدول بأعمدة واضحة + فلاتر (فعّال · معطّل · منتهي · الكل)
     • رسالة صريحة بعد التعطيل توضّح إنه لسه موجود
     • الكوبونات المعطّلة بتظهر باهتة بعلامة واضحة
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const V = {}, F = {};
  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));

  window.setCouponView   = m => { V.mode = m; renderSysContent(); };
  window.setCouponFilter = k => { F.key = k; renderSysContent(); };

  function state(c){
    if (c.active === false) return { key:'off',  label:'معطّل',  badge:'n', icon:'⏸️' };
    if (c.expiryDate && c.expiryDate < today()) return { key:'exp', label:'منتهي', badge:'r', icon:'⌛' };
    if (c.maxUses && (c.usedCount||0) >= c.maxUses)
      return { key:'used', label:'استُهلك بالكامل', badge:'y', icon:'🔒' };
    return { key:'on', label:'فعّال', badge:'g', icon:'✅' };
  }

  const FILTERS = [
    { k:'all', label:'الكل' },
    { k:'on',  label:'فعّال',  test:c => state(c).key === 'on' },
    { k:'off', label:'معطّل',  test:c => state(c).key === 'off' },
    { k:'exp', label:'منتهي أو مستهلك', test:c => ['exp','used'].includes(state(c).key) },
  ];


  /* ============================================================
     مين استفاد من الكود — بالتفصيل
     ============================================================ */

  function usersOf(code){
    const list = (window.REG && REG.buildings) || [];
    return list
      .filter(b => b.appliedCoupon && String(b.appliedCoupon.code).toUpperCase() === String(code).toUpperCase())
      .map(b => {
        const lic = window.ensureLicense ? ensureLicense(b) : (b.license || {});
        const st  = window.licenseState ? licenseState(lic) : { label: lic.status || '' , badge:'n'};
        return {
          id: b.id, name: b.name || '', code: b.code || '',
          at: (b.appliedCoupon.appliedAt || b.createdAt || '').slice(0,10),
          pct: b.appliedCoupon.discountPercent || 0,
          plan: window.planName ? planName(lic.plan) : (lic.plan || '—'),
          status: st.label, badge: st.badge,
          paid: !!(lic.plan && !/trial|promo|free/i.test(String(lic.plan))),
          units: b.apartmentsCount || 0,
          phone: (b.contactPhoneCountry || '') + (b.contactPhone || ''),
        };
      })
      .sort((a,b) => (b.at || '').localeCompare(a.at || ''));
  }

  window.openCouponUsers = function(id){
    const c = (window.ensureCoupons ? ensureCoupons() : []).find(x => x.id === id);
    if (!c) return;
    const rows = usersOf(c.code);
    const st = state(c);
    const converted = rows.filter(r => r.paid).length;

    const cols = [
      { key:'name', label:'العمارة', value:r => r.name,
        cell:r => `<b>${esc2(r.name)}</b><br><span class="small" style="color:var(--muted)">${esc2(r.code)}</span>` },
      { key:'at', label:'تاريخ الاستفادة', value:r => r.at,
        cell:r => { if (!r.at) return '—';
          const d = window.fmtDate ? fmtDate(r.at) : r.at;
          const days = Math.round((Date.now() - new Date(r.at).getTime())/86400000);
          return `${esc2(d)}<br><span class="small" style="color:var(--muted)">${
            days === 0 ? 'النهاردة' : days === 1 ? 'إمبارح' : 'من ' + days + ' يوم'}</span>`; } },
      { key:'units', label:'الوحدات', value:r => r.units, cell:r => String(r.units || '—') },
      { key:'plan', label:'الخطة', value:r => r.plan, cell:r => esc2(r.plan) },
      { key:'status', label:'حالة الاشتراك', value:r => r.status,
        cell:r => `<span class="badge ${r.badge}">${esc2(r.status)}</span>` },
      { key:'paid', label:'حوّل لمدفوع', value:r => r.paid ? 1 : 0,
        cell:r => r.paid ? '<span class="badge g">✅ آه</span>' : '<span class="badge n">لسه</span>' },
      { key:'phone', label:'التواصل', value:r => r.phone,
        cell:r => r.phone ? `<span dir="ltr">${esc2(r.phone)}</span>` : '—' },
      { key:'x', label:'', value:null,
        cell:r => `<button class="btn sm" onclick="closeModal();setTimeout(()=>openBuildingCard('${r.id}'),120)">تفاصيل</button>` },
    ];

    openModal(`
      <h3>🎟️ ${esc2(c.code)} — مين استفاد</h3>
      <div class="flexrow mtop" style="gap:7px;flex-wrap:wrap">
        <span class="badge ${st.badge}">${st.icon} ${st.label}</span>
        <span class="badge n">خصم ${c.discountPercent}%</span>
        ${c.expiryDate ? `<span class="badge n">ينتهي ${window.fmtDate?fmtDate(c.expiryDate):esc2(c.expiryDate)}</span>` : ''}
      </div>

      <div class="grid g3 mtop2">
        <div class="card" style="text-align:center">
          <h3 style="color:var(--accent);margin:2px 0">${rows.length}</h3>
          <p class="small">عميل استخدم الكود</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${converted}</h3>
          <p class="small">حوّلوا لاشتراك مدفوع</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${c.maxUses ? (c.maxUses - rows.length) : '∞'}</h3>
          <p class="small">${c.maxUses ? 'متبقّي من الحد' : 'بدون حد أقصى'}</p></div>
      </div>

      ${rows.length
        ? `<div class="mtop2">${sortableTable('couponUsersTable', rows, cols, null,
            { defaultKey:'at', emptyText:'محدش استخدم الكود ده',
              exportName:'مستخدمو كود ' + c.code })}</div>`
        : `<div class="card mtop2" style="text-align:center">
             <p class="small">محدش استخدم الكود ده لسه.</p>
             <p class="small" style="color:var(--muted)">
               شارك الكود في إعلاناتك أو مع العملاء المحتملين.</p>
           </div>`}

      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  const origCoupons = window.pageSysCoupons;
  if (origCoupons) window.pageSysCoupons = function(){
    const all = [...(window.ensureCoupons ? ensureCoupons() : [])]
      .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    const counts = {};
    FILTERS.forEach(f => counts[f.k] = f.test ? all.filter(f.test).length : all.length);
    const fk = F.key || 'all';
    const sel = FILTERS.find(f => f.k === fk) || FILTERS[0];
    const shown = sel.test ? all.filter(sel.test) : all;
    const mode = V.mode || 'table';

    const bar = `
      <div class="flexrow mtop" style="flex-wrap:wrap;gap:8px;align-items:center">
        <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
          <button class="btn sm ${mode==='table'?'primary':'ghost'}" style="border-radius:0"
            onclick="setCouponView('table')">📋 قائمة</button>
          <button class="btn sm ${mode==='cards'?'primary':'ghost'}" style="border-radius:0"
            onclick="setCouponView('cards')">🔲 مربعات</button>
        </span>
        <span style="flex:1"></span>
        ${FILTERS.map(f => `<button class="btn sm ${fk===f.k?'primary':'ghost'}"
          onclick="setCouponFilter('${f.k}')">${f.label} (${counts[f.k]})</button>`).join('')}
      </div>`;

    const head = `
      <p class="small">أكواد خصم مستقلة عن نظام الإحالة — للحملات الإعلانية والعروض الموسمية.
      العميل بيكتب الكود وقت التسجيل وبيتطبّق لما يرقّي.</p>
      <div class="flexrow mtop"><button class="btn primary" onclick="openCouponModal(null)">+ كود خصم جديد</button></div>
      ${bar}`;

    if (mode === 'cards'){
      return head + `<div class="grid g2 mtop2">${shown.length ? shown.map(c => {
        const st = state(c);
        return `<div class="card" style="${st.key!=='on'?'opacity:.72;':''}">
          <div class="flexrow"><b style="flex:1;letter-spacing:2px">${esc2(c.code)}</b>
            <span class="badge ${st.badge}">${st.icon} ${st.label}</span></div>
          <p class="small mtop">خصم ${c.discountPercent}%${c.expiryDate?' · ينتهي '+esc2(c.expiryDate):''}</p>
          <p class="small">${c.restrictToPlan
            ? 'مقصور على باقة "'+esc2((findPlan(c.restrictToPlan)||{}).name||c.restrictToPlan)+'"'
            : 'شغّال على كل الباقات'}</p>
          <p class="small">الاستخدام: ${c.usedCount||0}${c.maxUses?' من '+c.maxUses:' (بدون حد)'}</p>
          <div class="flexrow mtop">
            <button class="btn sm primary" onclick="openCouponUsers('${c.id}')">👥 مين استفاد</button>
            <button class="btn sm ghost" onclick="openCouponModal('${c.id}')">تعديل</button>
            <button class="btn sm ghost" onclick="toggleCouponActive('${c.id}')">${c.active===false?'▶️ تفعيل':'⏸️ تعطيل'}</button>
            <button class="btn sm red" onclick="deleteCouponPrompt('${c.id}')">حذف</button>
          </div></div>`;
      }).join('') : '<p class="small">مفيش أكواد مطابقة للفلتر ده.</p>'}</div>`;
    }

    const cols = [
      { key:'code', label:'الكود', value:c => c.code||'',
        cell:c => `<button class="btn sm ghost" style="letter-spacing:2px;font-weight:800"
          onclick="openCouponUsers('${c.id}')" title="شوف مين استفاد">${esc2(c.code)}</button>` },
      { key:'state', label:'الحالة', value:c => state(c).label,
        cell:c => { const s = state(c); return `<span class="badge ${s.badge}">${s.icon} ${s.label}</span>`; } },
      { key:'pct', label:'الخصم', value:c => Number(c.discountPercent)||0,
        cell:c => `${c.discountPercent}%` },
      { key:'plan', label:'الباقة', value:c => c.restrictToPlan||'',
        cell:c => c.restrictToPlan
          ? esc2((findPlan(c.restrictToPlan)||{}).name || c.restrictToPlan)
          : '<span class="small" style="color:var(--muted)">كل الباقات</span>' },
      { key:'used', label:'الاستخدام', value:c => Number(c.usedCount)||0,
        cell:c => { const n = usersOf(c.code).length;
          return `<button class="btn sm ${n?'primary':'ghost'}" onclick="openCouponUsers('${c.id}')">
            ${n}${c.maxUses?' من '+c.maxUses:''} 👥</button>`; } },
      { key:'expiry', label:'ينتهي في', value:c => c.expiryDate||'',
        cell:c => c.expiryDate ? esc2(c.expiryDate)
          : '<span class="small" style="color:var(--muted)">بلا نهاية</span>' },
      { key:'created', label:'اتعمل في', value:c => c.createdAt||'',
        cell:c => esc2((c.createdAt||'').slice(0,10)) },
      { key:'x', label:'', value:null, cell:c => `<div class="flexrow">
          <button class="btn sm" onclick="openCouponModal('${c.id}')">تعديل</button>
          <button class="btn sm ghost" onclick="toggleCouponActive('${c.id}')">${c.active===false?'▶️ تفعيل':'⏸️ تعطيل'}</button>
          <button class="btn sm red" onclick="deleteCouponPrompt('${c.id}')">حذف</button></div>` },
    ];

    return head + `<div class="mtop">${sortableTable('couponsTable', shown, cols, null,
      { defaultKey:'created', emptyText:'مفيش أكواد مطابقة للفلتر ده',
        exportName:'أكواد الخصم' })}</div>`;
  };

  /* توضيح إن التعطيل مش حذف */
  const origToggle = window.toggleCouponActive;
  if (origToggle) window.toggleCouponActive = function(id){
    const before = (window.ensureCoupons ? ensureCoupons() : []).find(c => c.id === id);
    const wasActive = !(before && before.active === false);
    const r = origToggle.apply(this, arguments);
    if (window.toast)
      toast(wasActive
        ? '⏸️ الكود اتعطّل — لسه موجود وتقدر تفعّله تاني'
        : '▶️ الكود اتفعّل');
    // لو المستخدم شايف فلتر "فعّال" والكود اتعطّل، ينقله لـ"الكل"
    if (wasActive && (F.key === 'on')) F.key = 'all';
    if (window.renderSysContent) renderSysContent();
    return r;
  };

  console.log('[عمارتنا] جدول أكواد الخصم جاهز');
})();

})();

/* ═══ emartna-videos.js ═══ */
(function(){
/* ============================================================
   عمارتنا — فيديوهات الشرح
   ------------------------------------------------------------
   • قسم فيديوهات في الصفحة الرئيسية، مقسّم بمراحل
   • وفيديو مرتبط بكل شاشة جوه البرنامج (يظهر مع زرار المساعدة)
   • صاحب البرنامج بيضيف ويعدّل من "الموقع العام"
   البيانات بتتخزن مع إعدادات الصفحة الرئيسية على الخادم.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  const STAGES = [
    { k:'intro',   label:'تعريف بالبرنامج', icon:'🎬' },
    { k:'setup',   label:'البداية والإعداد', icon:'🚀' },
    { k:'money',   label:'التحصيل والماليات', icon:'💰' },
    { k:'reports', label:'التقارير المحاسبية', icon:'📊' },
    { k:'people',  label:'السكان والتواصل', icon:'👥' },
    { k:'advanced',label:'مواضيع متقدّمة', icon:'⚙️' },
  ];

  /* ---------- تخزين ---------- */

  function list(){
    try{
      const ls = window.ensureLandingSettings ? ensureLandingSettings() : null;
      if (!ls) return [];
      ls.videos = ls.videos || [];
      return ls.videos;
    }catch(e){ return []; }
  }

  /* استخراج معرّف يوتيوب من أي شكل رابط */
  window.youtubeId = function(url){
    const u = String(url || '').trim();
    const m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(u)) return u;      // اتلصق المعرّف لوحده
    return null;
  };

  const thumb = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  /* ---------- المشغّل ---------- */

  window.playVideo = function(vid){
    const v = list().find(x => x.id === vid);
    if (!v) return;
    const yid = youtubeId(v.url);
    if (!yid) return showMessage('رابط الفيديو مش مظبوط');
    openModal(`
      <h3>${esc2(v.title || 'شرح')}</h3>
      ${v.desc ? `<p class="small mtop">${esc2(v.desc)}</p>` : ''}
      <div style="position:relative;padding-top:56.25%;margin-top:12px;border-radius:12px;overflow:hidden;background:#000">
        <iframe src="https://www.youtube-nocookie.com/embed/${yid}?rel=0&modestbranding=1"
          style="position:absolute;inset:0;width:100%;height:100%;border:0"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen loading="lazy" title="${esc2(v.title||'')}"></iframe>
      </div>
      <p class="small mtop">
        <a href="https://www.youtube.com/watch?v=${yid}" target="_blank" rel="noopener">
          افتح على يوتيوب ↗</a>
      </p>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  /* ---------- قسم الصفحة الرئيسية ---------- */

  function landingSection(){
    const vids = list().filter(v => v.showOnLanding !== false && youtubeId(v.url));
    if (!vids.length) return '';

    const byStage = STAGES
      .map(s => ({ ...s, items: vids.filter(v => (v.stage || 'intro') === s.k) }))
      .filter(s => s.items.length);

    return `
    <div class="section-title" style="text-align:center"><h3>🎥 اتعلّم البرنامج في دقايق</h3></div>
    <p class="small" style="text-align:center;color:var(--muted);margin-bottom:14px">
      فيديوهات قصيرة مرتّبة بالمراحل — ابدأ من الأول أو روح للجزء اللي يهمّك.</p>
    ${byStage.map(s => `
      <div style="max-width:900px;margin:0 auto 18px">
        <b style="display:block;margin-bottom:8px">${s.icon} ${esc2(s.label)}</b>
        <div class="grid g3">
          ${s.items.map(v => {
            const yid = youtubeId(v.url);
            return `<div class="card" style="padding:0;overflow:hidden;cursor:pointer"
                      onclick="playVideo('${v.id}')">
              <div style="position:relative;padding-top:56%;background:#000">
                <img src="${thumb(yid)}" alt="${esc2(v.title||'')}" loading="lazy"
                     style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9">
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
                  <span style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.92);
                        display:flex;align-items:center;justify-content:center;font-size:19px">▶</span>
                </div>
                ${v.duration ? `<span style="position:absolute;bottom:6px;inset-inline-start:6px;
                  background:rgba(0,0,0,.75);color:#fff;font-size:11px;padding:2px 6px;border-radius:5px">
                  ${esc2(v.duration)}</span>` : ''}
              </div>
              <div style="padding:10px 12px">
                <b class="small">${esc2(v.title || 'فيديو')}</b>
                ${v.desc ? `<div class="small" style="color:var(--muted);margin-top:3px">${esc2(v.desc)}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}`;
  }

  const origLanding = window.landingHTML;
  if (origLanding && !origLanding.__videosWrapped){
    const wrapped = function(){
      const html = origLanding.apply(this, arguments);
      const sec = landingSection();
      if (!sec) return html;
      const mark = '<div class="section-title" style="text-align:center"><h3>مميزات البرنامج</h3>';
      const i = html.indexOf(mark);
      return i > -1 ? html.slice(0,i) + sec + html.slice(i) : html + sec;
    };
    wrapped.__videosWrapped = true;
    window.landingHTML = wrapped;
  }

  /* ---------- فيديو الشاشة الحالية جوه البرنامج ---------- */

  window.screenVideo = function(page){
    return list().find(v => v.screen && v.screen === page && youtubeId(v.url)) || null;
  };

  if (typeof window.openPageHelp === 'function' && !window.openPageHelp.__vidWrapped){
    const o = window.openPageHelp;
    const wrapped = function(){
      const r = o.apply(this, arguments);
      const v = screenVideo(typeof curPage !== 'undefined' ? curPage : '');
      if (v){
        setTimeout(() => {
          const box = document.getElementById('modalBox');
          if (!box || box.querySelector('.scr-vid')) return;
          const d = document.createElement('div');
          d.className = 'card scr-vid';
          d.style.cssText = 'margin-top:10px;border:1px solid var(--accent)';
          d.innerHTML = `<b>🎥 فيديو شرح الشاشة دي</b>
            <p class="small mtop">${esc2(v.title||'')}</p>
            <button class="btn primary sm mtop" onclick="playVideo('${v.id}')">▶ شغّل الفيديو</button>`;
          const h3 = box.querySelector('h3');
          if (h3) h3.after(d); else box.prepend(d);
        }, 0);
      }
      return r;
    };
    wrapped.__vidWrapped = true;
    window.openPageHelp = wrapped;
  }

  /* ---------- إدارة الفيديوهات (صاحب البرنامج) ---------- */

  window.openVideoModal = function(id){
    const v = id ? list().find(x => x.id === id) : null;
    const pages = ['','dashboard','apartments','users','collections','expenses','treasury',
      'projects','paymentRequests','trialBalance','aging','incomeStatement','balanceSheet',
      'floors','polls','announcements','meetings','suggestions','chat','license','settings'];
    openModal(`
      <h3>${v ? 'تعديل فيديو' : '+ فيديو جديد'}</h3>
      <div class="field2 mtop"><label>رابط يوتيوب</label>
        <input id="vdUrl" value="${v?esc2(v.url):''}" placeholder="https://youtu.be/xxxxxxxxxxx" dir="ltr"></div>
      <div class="field2"><label>العنوان</label>
        <input id="vdTitle" value="${v?esc2(v.title):''}" placeholder="مثال: إزاي تضيف وحدات عمارتك"></div>
      <div class="field2"><label>وصف قصير</label>
        <input id="vdDesc" value="${v?esc2(v.desc||''):''}" placeholder="سطر واحد يوضّح الفيديو"></div>
      <div class="grid g2">
        <div class="field2"><label>المرحلة</label>
          <select id="vdStage">${STAGES.map(s =>
            `<option value="${s.k}" ${v&&v.stage===s.k?'selected':''}>${s.icon} ${s.label}</option>`).join('')}</select></div>
        <div class="field2"><label>المدة (اختياري)</label>
          <input id="vdDur" value="${v?esc2(v.duration||''):''}" placeholder="2:45" dir="ltr"></div>
      </div>
      <div class="field2"><label>مرتبط بشاشة (اختياري)</label>
        <select id="vdScreen">${pages.map(p =>
          `<option value="${p}" ${v&&v.screen===p?'selected':''}>${p||'— مش مرتبط بشاشة —'}</option>`).join('')}</select>
        <p class="small">لو اخترت شاشة، الفيديو هيظهر لرئيس الاتحاد في زرار المساعدة داخلها.</p></div>
      <div class="field2"><label><input type="checkbox" id="vdLanding" ${!v||v.showOnLanding!==false?'checked':''}>
        اعرضه في الصفحة الرئيسية</label></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveVideo('${v?v.id:''}')">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveVideo = function(id){
    const g = i => (document.getElementById(i)||{}).value || '';
    const url = g('vdUrl').trim();
    if (!youtubeId(url)) return showMessage('حط رابط يوتيوب صحيح');
    const title = g('vdTitle').trim();
    if (!title) return showMessage('اكتب عنوان للفيديو');
    const ls = ensureLandingSettings();
    ls.videos = ls.videos || [];
    const rec = {
      id: id || ('vid_' + Date.now()),
      url, title, desc: g('vdDesc').trim(),
      stage: g('vdStage') || 'intro',
      duration: g('vdDur').trim(),
      screen: g('vdScreen') || '',
      showOnLanding: !!(document.getElementById('vdLanding')||{}).checked,
    };
    const i = ls.videos.findIndex(x => x.id === rec.id);
    if (i >= 0) ls.videos[i] = rec; else ls.videos.push(rec);
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظ الفيديو');
    if (window.renderSysContent) renderSysContent();
  };

  window.deleteVideo = function(id){
    const go = () => {
      const ls = ensureLandingSettings();
      ls.videos = (ls.videos||[]).filter(x => x.id !== id);
      saveRegistry();
      if (window.renderSysContent) renderSysContent();
      if (window.toast) toast('اتحذف الفيديو');
    };
    if (typeof window.confirmDelete === 'function')
      return confirmDelete('حذف الفيديو ده من الصفحة الرئيسية؟', go);
    if (confirm('حذف الفيديو؟')) go();
  };

  /* بطاقة الإدارة في شاشة الصفحة الرئيسية */
  const origLandingPage = window.pageSysLandingSettings;
  if (origLandingPage) window.pageSysLandingSettings = function(){
    const vids = list();
    const card = `
      <div class="card content-narrow">
        <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><b>🎥 فيديوهات الشرح</b>
            <div class="small" style="color:var(--muted)">${vids.length} فيديو · بيظهروا في الصفحة الرئيسية مقسّمين بالمراحل</div></div>
          <button class="btn primary sm" onclick="openVideoModal()">+ فيديو جديد</button>
        </div>
        ${vids.length ? `<div class="mtop">${vids.map(v => {
          const yid = youtubeId(v.url);
          const st = STAGES.find(s => s.k === (v.stage||'intro'));
          return `<div class="flexrow" style="padding:8px 0;border-bottom:1px solid var(--line);gap:10px;align-items:center">
            ${yid ? `<img src="${thumb(yid)}" style="width:74px;height:44px;object-fit:cover;border-radius:6px" loading="lazy">`
                  : '<span class="badge r">رابط غلط</span>'}
            <div style="flex:1">
              <b class="small">${esc2(v.title)}</b>
              <div class="small" style="color:var(--muted)">
                ${st?st.icon+' '+st.label:''}${v.screen?' · شاشة: '+esc2(v.screen):''}${v.showOnLanding===false?' · مخفي من الرئيسية':''}
              </div>
            </div>
            <button class="btn sm ghost" onclick="playVideo('${v.id}')">▶</button>
            <button class="btn sm ghost" onclick="openVideoModal('${v.id}')">تعديل</button>
            <button class="btn sm red" onclick="deleteVideo('${v.id}')">حذف</button>
          </div>`;
        }).join('')}</div>` : '<p class="small mtop">لسه مضفتش فيديوهات.</p>'}
      </div>`;
    return card + origLandingPage.apply(this, arguments);
  };

  console.log('[عمارتنا] فيديوهات الشرح جاهزة');
})();

})();

/* ═══ emartna-colfit.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تنسيق أعمدة كل الجداول (٤٥ جدول)
   ------------------------------------------------------------
     • الجدول العريض (أكتر من ٨ أعمدة ظاهرة) → كل عمود ياخد
       قياسه الطبيعي والجدول يتمرّر أفقيًا بدل ما يتزنق.
     • الجدول الضيّق → يفضل زي ما هو، بيملا العرض.
     • تعديل عرض أي عمود → بنثبّت الباقي على قياسه الحالي الأول.
   ============================================================ */

(function(){
  'use strict';

  const WIDE_AT = 8;

  function injectCss(){
    if (document.getElementById('colFitCss')) return;
    const st = document.createElement('style');
    st.id = 'colFitCss';
    st.textContent = `
      [data-colfit="wide"] .table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
      [data-colfit="wide"] .table-wrap > table{ width:max-content; min-width:100%; }
      [data-colfit="wide"] .table-wrap th,
      [data-colfit="wide"] .table-wrap td{ white-space:nowrap; vertical-align:middle; }
      [data-colfit="wide"] .table-wrap td.wrap-cell,
      [data-colfit="wide"] .table-wrap th.wrap-cell{
        white-space:normal; word-break:break-word; max-width:280px;
      }
      [data-colfit="wide"] .table-wrap table[style*="fixed"] td{
        white-space:normal; word-break:break-word;
      }`;
    document.head.appendChild(st);
  }

  const WRAPPY = /ملاحظ|تفاصيل|وصف|العنوان|النص|البيان|الرسالة|المقترح|النتائج|الخطأ|السبب/;

  function markTables(){
    try{
      const cfgs = window.__tableConfigs || {};
      Object.keys(cfgs).forEach(id => {
        const wrap = document.getElementById(id + '_wrap');
        if (!wrap) return;
        const cols = window.orderedVisibleCols
          ? orderedVisibleCols(id+'_order', id+'_vis', cfgs[id].columns)
          : cfgs[id].columns;
        const wide = (cols || []).length > WIDE_AT;
        wrap.setAttribute('data-colfit', wide ? 'wide' : 'fit');
        if (!wide) return;
        const ths = wrap.querySelectorAll('.table-wrap thead th');
        const idx = [];
        cols.forEach((c,i) => { if (WRAPPY.test(String(c.label||''))) idx.push(i); });
        if (!idx.length) return;
        idx.forEach(i => { if (ths[i]) ths[i].classList.add('wrap-cell'); });
        wrap.querySelectorAll('.table-wrap tbody tr').forEach(tr => {
          idx.forEach(i => { if (tr.children[i]) tr.children[i].classList.add('wrap-cell'); });
        });
      });
    }catch(e){}
  }
  window.markWideTables = markTables;

  function freezeAllWidths(tableId){
    const wrap = document.getElementById(tableId + '_wrap');
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    if (!wrap || !cfg) return;
    const ths = wrap.querySelectorAll('.table-wrap thead th');
    if (!ths.length) return;
    window[tableId+'_widths'] = window[tableId+'_widths'] || {};
    const W = window[tableId+'_widths'];
    // بنقرا مفتاح كل عمود من الرأس نفسه (data-colkey) — أضمن من
    // الاعتماد على ترتيب القائمة، لأن في أعمدة بتتحقن وقت التشغيل.
    ths.forEach(th => {
      const key = th.getAttribute('data-colkey');
      if (!key) return;
      if (typeof W[key] !== 'number')
        W[key] = Math.max(60, Math.round(th.getBoundingClientRect().width));
    });
  }

  ['setColWidthDirect','nudgeColWidth','setColWidthPreset','setColWidth'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__colFit) return;
    const wrapped = function(tableId){
      try{
        const id = (window.__tableConfigs && window.__tableConfigs[tableId])
          ? tableId : window.__widthEditTable;
        if (id) freezeAllWidths(id);
      }catch(e){}
      return orig.apply(this, arguments);
    };
    wrapped.__colFit = true;
    window[fn] = wrapped;
  });

  const origMenu = window.openColumnQuickMenu;
  if (origMenu && !origMenu.__colFit){
    const wrapped = function(evt, tableId){
      window.__widthEditTable = tableId;
      return origMenu.apply(this, arguments);
    };
    wrapped.__colFit = true;
    window.openColumnQuickMenu = wrapped;
  }

  window.resetColWidths = function(tableId){
    window[tableId+'_widths'] = {};
    if (window.refreshSortable) refreshSortable(tableId); else renderContent();
    setTimeout(markTables, 50);
    if (window.toast) toast('رجعت الأعمدة لقياسها الطبيعي');
  };

  const origSortable = window.sortableTable;
  if (origSortable && !origSortable.__colFitWrapped){
    const wrapped = function(tableId, rows, cols){
      const html = origSortable.apply(this, arguments);
      injectCss();
      setTimeout(markTables, 30);
      if (!Array.isArray(cols) || cols.length <= WIDE_AT) return html;
      const btn = `<button class="btn sm ghost" onclick="resetColWidths('${tableId}')" title="رجّع كل الأعمدة لقياسها الطبيعي">↔️ ضبط الأعمدة</button>`;
      return html.replace('طباعة</button></div>', 'طباعة</button>' + btn + '</div>');
    };
    wrapped.__colFitWrapped = true;
    window.sortableTable = wrapped;
  }

  ['renderContent','renderSysContent','refreshSortable'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__colFitR) return;
    const wrapped = function(){
      const r = orig.apply(this, arguments);
      setTimeout(markTables, 30);
      return r;
    };
    wrapped.__colFitR = true;
    window[fn] = wrapped;
  });

  setTimeout(() => { injectCss(); markTables(); }, 1200);
  console.log('[عمارتنا] تنسيق أعمدة كل الجداول جاهز');
})();

})();

/* ═══ emartna-visits.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — من فين جه الزائر
   ------------------------------------------------------------
   بيسجّل مصدر كل زيارة (فيسبوك · جوجل · واتساب · مباشر …)
   ومعاه التسجيلات اللي اتمّت من كل مصدر، وبيطلّع تقرير
   لصاحب البرنامج.

   ⚠️ مفيش أي بيانات شخصية بتتسجّل — المصدر والتاريخ بس.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const SESS = 'emartna_visit_logged';

  /* ---------- تحديد المصدر ---------- */

  const MAP = [
    [/facebook|fb\.com|fb\.me|m\.facebook/i, 'facebook'],
    [/instagram/i,  'instagram'],
    [/wa\.me|whatsapp/i, 'whatsapp'],
    [/google\./i,   'google'],
    [/t\.co|twitter|x\.com/i, 'twitter'],
    [/linkedin/i,   'linkedin'],
    [/youtube|youtu\.be/i, 'youtube'],
    [/tiktok/i,     'tiktok'],
    [/bing|yahoo|duckduckgo/i, 'search'],
  ];

  function detect(){
    const p = new URLSearchParams(location.search);
    const utm = (p.get('utm_source') || p.get('src') || p.get('ref') || '').trim();
    if (utm) return { source: utm.toLowerCase(), campaign: p.get('utm_campaign') || '' };

    // فيسبوك بيحط fbclid على أي ضغطة من إعلان أو منشور، وجوجل بيحط gclid.
    // المتصفح الداخلي بتاع فيسبوك مبيبعتش referrer، فدي أدق طريقة للتعرّف.
    if (p.get('fbclid')) return { source: 'facebook', campaign: p.get('utm_campaign') || 'fb-click' };
    if (p.get('gclid'))  return { source: 'google',   campaign: 'google-ads' };
    if (p.get('igshid')) return { source: 'instagram', campaign: '' };

    const r = document.referrer || '';
    if (!r) return { source: 'direct', campaign: '' };
    try{
      if (new URL(r).host === location.host) return { source: 'internal', campaign: '' };
    }catch(e){}
    for (const [re, name] of MAP) if (re.test(r)) return { source: name, campaign: '' };
    try{ return { source: new URL(r).hostname.replace(/^www\./,''), campaign: '' }; }
    catch(e){ return { source: 'other', campaign: '' }; }
  }

  /* مفتاح جلسة عشان الحدث ما يتسجّلش مرتين */
  function sessionKey(){
    try{
      let k = sessionStorage.getItem('emartna_sess_key');
      if (!k){ k = Math.random().toString(36).slice(2) + Date.now().toString(36); 
               sessionStorage.setItem('emartna_sess_key', k); }
      return k;
    }catch(e){ return null; }
  }

  async function send(event){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const d = detect();
      const ev = event || 'visit';
      if (d.source === 'internal' && ev === 'visit') return;
      await sb.rpc('record_visit', {
        p_source: d.source, p_campaign: d.campaign,
        p_landed_on: (location.pathname || '/').slice(0,60),
        p_signup: ev === 'signup',
        p_event: ev,
        p_session: sessionKey(),
      });
    }catch(e){}
  }

  /* زيارة واحدة لكل جلسة تصفّح */
  function logVisit(){
    try{
      if (sessionStorage.getItem(SESS) === '1') return;
      sessionStorage.setItem(SESS, '1');
    }catch(e){}
    send('visit');
  }

  let tries = 0;
  const t = setInterval(() => {
    if (++tries > 200) return clearInterval(t);
    if (window.CLOUD && window.CLOUD._sb){ clearInterval(t); logVisit(); }
  }, 150);

  /* التسجيل الناجح بيتسجّل كتحويل */
  /* كل خطوة في رحلة الزائر بتتسجّل */
  const EVENTS = {
    doSignup: 'signup', createBuildingFromSignup: 'signup',
    loginAsDemo: 'demo', tryDemoNow: 'demo',
    cloudLogin: 'login', loginWithBiometric: 'login',
  };
  Object.keys(EVENTS).forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__visit) return;
    const wrapped = async function(){
      const r = await orig.apply(this, arguments);
      try{ send(EVENTS[fn]); }catch(e){}
      return r;
    };
    wrapped.__visit = true;
    window[fn] = wrapped;
  });

  /* ---------- التقرير ---------- */

  const LABEL = {
    facebook:'فيسبوك', instagram:'إنستجرام', whatsapp:'واتساب', google:'بحث جوجل',
    twitter:'إكس/تويتر', linkedin:'لينكدإن', youtube:'يوتيوب', tiktok:'تيك توك',
    search:'محركات بحث', direct:'دخول مباشر', internal:'داخلي', other:'مصادر أخرى',
  };
  const ICON = {
    facebook:'📘', instagram:'📸', whatsapp:'💬', google:'🔍', twitter:'✖️',
    linkedin:'💼', youtube:'▶️', tiktok:'🎵', search:'🔎', direct:'🔗', other:'🌐',
  };

  window.__visitRows = null;

  const iso = d => d.toISOString().slice(0,10);
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n + 1); return iso(d); };

  /* الفترة الحالية — إما آخر كذا يوم أو تواريخ محددة */
  window.__visitFrom = window.__visitFrom || daysAgo(30);
  window.__visitTo   = window.__visitTo   || iso(new Date());

  window.loadVisitReport = async function(days){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) return;
    if (days){                                  // زرار سريع
      window.__visitDays = days;
      window.__visitFrom = daysAgo(days);
      window.__visitTo   = iso(new Date());
    }else{
      window.__visitDays = null;                // فترة مخصصة
    }
    try{
      const { data, error } = await sb.rpc('visit_range_report', {
        p_from: window.__visitFrom, p_to: window.__visitTo,
      });
      if (error) throw error;
      window.__visitRows = data || [];
      window.__visitErr = null;
    }catch(e){
      window.__visitRows = [];
      window.__visitErr = (window.cloudErrorText ? cloudErrorText(e) : e.message);
    }
    if (window.renderSysContent) renderSysContent();
  };

  /* تطبيق التواريخ اللي المستخدم اختارها */
  window.applyVisitRange = function(){
    const f = (document.getElementById('vsFrom')||{}).value;
    const t = (document.getElementById('vsTo')||{}).value;
    if (!f || !t) return showMessage('حدد التاريخين');
    if (f > t) return showMessage('تاريخ البداية لازم يكون قبل النهاية');
    window.__visitFrom = f; window.__visitTo = t;
    loadVisitReport(null);
  };

  /* اختصارات جاهزة */
  /* أي اختصار مطابق للفترة المعروضة دلوقتي؟ */
  window.activeVisitPreset = function(){
    const f = window.__visitFrom, t = window.__visitTo, now = new Date();
    const today = iso(now);
    if (!f || !t) return '';
    if (t !== today && !(f === '2020-01-01')) {
      // فترة قديمة مخصصة — مفيش اختصار نشط إلا لو الشهر اللي فات
      const lmF = iso(new Date(now.getFullYear(), now.getMonth()-1, 1));
      const lmT = iso(new Date(now.getFullYear(), now.getMonth(), 0));
      if (f === lmF && t === lmT) return 'lastMonth';
      return '';
    }
    if (f === today) return 'today';
    if (f === daysAgo(7))  return 'w7';
    if (f === daysAgo(30)) return 'd30';
    if (f === daysAgo(90)) return 'd90';
    if (f === iso(new Date(now.getFullYear(), now.getMonth(), 1))) return 'month';
    if (f === now.getFullYear() + '-01-01') return 'year';
    if (f === '2020-01-01') return 'all';
    return '';
  };

  window.visitPreset = function(kind){
    const now = new Date();
    let f, t = iso(now);
    if (kind === 'today')      f = t;
    else if (kind === 'w7' || kind === 'week') f = daysAgo(7);
    else if (kind === 'd30')   f = daysAgo(30);
    else if (kind === 'd90')   f = daysAgo(90);
    else if (kind === 'month'){ f = iso(new Date(now.getFullYear(), now.getMonth(), 1)); }
    else if (kind === 'lastMonth'){
      f = iso(new Date(now.getFullYear(), now.getMonth()-1, 1));
      t = iso(new Date(now.getFullYear(), now.getMonth(), 0));
    }
    else if (kind === 'year')  f = now.getFullYear() + '-01-01';
    else if (kind === 'all')   f = '2020-01-01';
    window.__visitFrom = f; window.__visitTo = t;
    loadVisitReport(null);
  };

  const LBL = {
    facebook:'فيسبوك', instagram:'إنستجرام', whatsapp:'واتساب', google:'بحث جوجل',
    twitter:'إكس', linkedin:'لينكدإن', youtube:'يوتيوب', tiktok:'تيك توك',
    search:'محركات بحث', direct:'دخول مباشر', print:'بطاقة مطبوعة', other:'أخرى',
  };
  const IC = {
    facebook:'📘', instagram:'📸', whatsapp:'💬', google:'🔍', twitter:'✖️',
    linkedin:'💼', youtube:'▶️', tiktok:'🎵', search:'🔎', direct:'🔗', print:'🖨️',
  };
  const nm = k => LBL[k] || k;
  const ic = k => IC[k] || '🌐';

  window.pageSysVisits = function(){
    const rows = window.__visitRows;
    const days = window.__visitDays || 30;
    if (rows === null || rows === undefined){
      setTimeout(() => loadVisitReport(30), 30);
      return '<div class="card"><p class="small">⏳ بيحمّل التقرير…</p></div>';
    }

    const S = k => rows.reduce((a,r) => a + Number(r[k]||0), 0);
    const T = { visits:S('visits'), demos:S('demos'), signups:S('signups'), logins:S('logins') };
    const pct = (a,b) => b ? Math.round(a/b*100) : 0;

    /* تجميع يومي */
    const byDay = {};
    rows.forEach(r => {
      const d = byDay[r.day] = byDay[r.day] || { day:r.day, visits:0, demos:0, signups:0, logins:0, src:{} };
      ['visits','demos','signups','logins'].forEach(k => d[k] += Number(r[k]||0));
      d.src[r.source] = (d.src[r.source]||0) + Number(r.visits||0);
    });
    const daily = Object.values(byDay).sort((a,b) => (b.day||'').localeCompare(a.day||''));

    /* تجميع بالمصدر */
    const bySrc = {};
    rows.forEach(r => {
      const s = bySrc[r.source] = bySrc[r.source] || { source:r.source, visits:0, demos:0, signups:0, logins:0 };
      ['visits','demos','signups','logins'].forEach(k => s[k] += Number(r[k]||0));
    });
    const srcList = Object.values(bySrc).sort((a,b) => b.visits - a.visits);

    const act = activeVisitPreset();
    const max = Math.max(1, ...daily.slice(0,14).map(d => d.visits));
    const chart = daily.slice(0,14).reverse();

    const dailyCols = [
      { key:'day', label:'اليوم', value:d => d.day||'',
        cell:d => `<b>${esc2(d.day)}</b><br><span class="small" style="color:var(--muted)">${
          new Date(d.day).toLocaleDateString('ar-EG',{weekday:'long'})}</span>` },
      { key:'visits', label:'👁️ زيارات', value:d => d.visits, cell:d => `<b>${d.visits}</b>` },
      { key:'demos', label:'🎬 تجارب', value:d => d.demos,
        cell:d => d.demos ? `<span class="badge b">${d.demos}</span>` : '0' },
      { key:'signups', label:'✅ تسجيلات', value:d => d.signups,
        cell:d => d.signups ? `<span class="badge g">${d.signups}</span>` : '0' },
      { key:'logins', label:'🔑 دخول', value:d => d.logins, cell:d => String(d.logins) },
      { key:'rate', label:'التحويل', value:d => pct(d.signups, d.visits),
        cell:d => `<span class="badge ${pct(d.signups,d.visits)>=5?'g':d.signups?'y':'n'}">${pct(d.signups,d.visits)}%</span>` },
      { key:'top', label:'أكتر مصدر', value:d => '',
        cell:d => { const t = Object.entries(d.src).sort((a,b) => b[1]-a[1])[0];
          return t ? `${ic(t[0])} ${esc2(nm(t[0]))} <span class="small">(${t[1]})</span>` : '—'; } },
    ];

    const srcCols = [
      { key:'src', label:'المصدر', value:r => nm(r.source),
        cell:r => `${ic(r.source)} <b>${esc2(nm(r.source))}</b>` },
      { key:'visits', label:'زيارات', value:r => r.visits, cell:r => String(r.visits) },
      { key:'share', label:'النسبة', value:r => r.visits,
        cell:r => `${pct(r.visits, T.visits)}%` },
      { key:'demos', label:'تجارب', value:r => r.demos, cell:r => String(r.demos) },
      { key:'signups', label:'تسجيلات', value:r => r.signups,
        cell:r => r.signups ? `<span class="badge g">${r.signups}</span>` : '0' },
      { key:'d2v', label:'زيارة ← تجربة', value:r => pct(r.demos, r.visits),
        cell:r => `<span class="badge ${pct(r.demos,r.visits)>=15?'g':r.demos?'y':'n'}">${pct(r.demos,r.visits)}%</span>` },
      { key:'s2d', label:'تجربة ← تسجيل', value:r => pct(r.signups, r.demos),
        cell:r => r.demos ? `<span class="badge ${pct(r.signups,r.demos)>=20?'g':'y'}">${pct(r.signups,r.demos)}%</span>` : '—' },
    ];

    const step = (icon, label, n, of, note) => `
      <div class="card" style="text-align:center">
        <div style="font-size:22px">${icon}</div>
        <h3 style="margin:4px 0;color:var(--accent)">${n}</h3>
        <p class="small">${label}</p>
        ${of !== null ? `<p class="small" style="color:var(--muted)">${pct(n,of)}% من ${of}</p>` : ''}
        ${note ? `<p class="small" style="color:var(--gold)">${note}</p>` : ''}
      </div>`;

    return `
      <p class="small">رحلة الزائر خطوة بخطوة — من فين جه، جرّب ولا لأ، وسجّل ولا مشي.</p>

      <div class="card mtop" style="padding:12px">
        <div class="grid g2">
          <div class="field2"><label>من تاريخ</label>
            <input id="vsFrom" type="date" value="${esc2(window.__visitFrom||'')}"
              onchange="applyVisitRange()"></div>
          <div class="field2"><label>إلى تاريخ</label>
            <input id="vsTo" type="date" value="${esc2(window.__visitTo||'')}"
              onchange="applyVisitRange()"></div>
        </div>
        <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
          ${[['today','النهاردة'],['w7','آخر ٧ أيام'],['d30','آخر ٣٠ يوم'],['d90','آخر ٩٠ يوم'],
             ['month','الشهر ده'],['lastMonth','الشهر اللي فات'],['year','السنة دي'],['all','كل الفترة']]
            .map(([k,l]) => `<button class="btn sm ${act===k?'primary':'ghost'}"
              onclick="visitPreset('${k}')">${l}</button>`).join('')}
          <span style="flex:1"></span>
          <button class="btn sm ghost" onclick="loadVisitReport(null)">🔄 تحديث</button>
        </div>
        <p class="small mtop" style="color:var(--muted)">
          الفترة المعروضة: <b>${esc2(window.__visitFrom)}</b> إلى <b>${esc2(window.__visitTo)}</b>
          · ${daily.length} يوم فيه نشاط
        </p>
      </div>

      <div class="section-title mtop2"><h3>قمع الزوّار</h3></div>
      <div class="grid g4">
        ${step('👁️','زيارة الموقع', T.visits, null, '')}
        ${step('🎬','جرّبوا البرنامج', T.demos, T.visits, T.visits && !T.demos ? 'محدش جرّب!' : '')}
        ${step('✅','سجّلوا حساب', T.signups, T.demos || T.visits, '')}
        ${step('🔑','دخول متكرر', T.logins, null, '')}
      </div>

      ${chart.length ? `<div class="card mtop2">
        <b>الزيارات اليومية (آخر ١٤ يوم)</b>
        <div class="flexrow mtop" style="align-items:flex-end;gap:6px;height:130px;overflow-x:auto">
          ${chart.map(d => `<div style="flex:1;min-width:34px;text-align:center">
            <div class="small" style="font-size:10px">${d.visits}</div>
            <div style="background:var(--accent);border-radius:4px 4px 0 0;
                 height:${Math.round(d.visits/max*72)}px;min-height:3px"></div>
            ${d.signups ? `<div style="background:var(--gold);height:${Math.round(d.signups/max*72)}px;min-height:3px"></div>` : ''}
            <div class="small" style="color:var(--muted);font-size:9px">${esc2(String(d.day).slice(5))}</div>
          </div>`).join('')}
        </div>
        <p class="small" style="color:var(--muted)">🟢 زيارات · 🟡 تسجيلات</p>
      </div>` : ''}

      <div class="section-title mtop2"><h3>يوم بيوم</h3></div>
      ${sortableTable('visitDailyTable', daily, dailyCols, null,
        { defaultKey:'day', emptyText:'مفيش زيارات مسجّلة', exportName:'الزيارات اليومية' })}

      <div class="section-title mtop2"><h3>حسب المصدر</h3></div>
      ${sortableTable('visitSrcTable', srcList, srcCols, null,
        { defaultKey:'visits', emptyText:'مفيش بيانات', exportName:'مصادر الزيارات' })}

      ${window.__visitErr ? `<p class="small mtop" style="color:var(--red)">${esc2(window.__visitErr)}</p>` : ''}

      <p class="small mtop2" style="color:var(--muted)">
        💡 لقياس كل حملة على حدة: <code dir="ltr">myemartna.com/?utm_source=facebook&utm_campaign=fb-ads</code>
      </p>`;
  };

  /* ============================================================
     روابط التواصل الاجتماعي في الصفحة الرئيسية
     ============================================================ */

  function socials(){
    const so = (window.REG && REG.sysOwner) || {};
    const wa = (so.whatsappNumber || ((so.contactPhoneCountry||'') + (so.contactPhone||'')))
      .replace(/[^\d]/g,'');
    return [
      so.facebookUrl  && { icon:'📘', label:'فيسبوك',   url:so.facebookUrl },
      so.instagramUrl && { icon:'📸', label:'إنستجرام', url:so.instagramUrl },
      so.youtubeUrl   && { icon:'▶️', label:'يوتيوب',   url:so.youtubeUrl },
      wa && { icon:'💬', label:'واتساب', url:'https://wa.me/' + wa },
      so.contactEmail && { icon:'📧', label:'البريد', url:'mailto:' + so.contactEmail },
    ].filter(Boolean);
  }

  const origLanding = window.landingHTML;
  if (origLanding && !origLanding.__socialWrapped){
    const wrapped = function(){
      const html = origLanding.apply(this, arguments);
      const items = socials();
      if (!items.length) return html;
      const bar = `
        <div style="text-align:center;margin:26px auto 8px">
          <p class="small" style="color:var(--muted);margin-bottom:8px">تابعنا وتواصل معانا</p>
          <div class="flexrow" style="justify-content:center;flex-wrap:wrap;gap:9px">
            ${items.map(s => `<a class="btn ghost sm" href="${esc2(s.url)}"
               target="_blank" rel="noopener">${s.icon} ${esc2(s.label)}</a>`).join('')}
          </div>
        </div>`;
      return html + bar;
    };
    wrapped.__socialWrapped = true;
    window.landingHTML = wrapped;
  }

  /* إعداد الروابط من شاشة صاحب البرنامج */
  window.openSocialLinksModal = function(){
    const so = (window.REG && REG.sysOwner) || {};
    openModal(`
      <h3>🔗 روابط التواصل الاجتماعي</h3>
      <p class="small mtop">بتظهر في آخر الصفحة الرئيسية، وبتساعد الزائر يتواصل معاك.</p>
      <div class="field2 mtop"><label>📘 صفحة فيسبوك</label>
        <input id="soFb" dir="ltr" value="${esc2(so.facebookUrl||'')}"
          placeholder="https://www.facebook.com/..."></div>
      <div class="field2"><label>📸 إنستجرام</label>
        <input id="soIg" dir="ltr" value="${esc2(so.instagramUrl||'')}"></div>
      <div class="field2"><label>▶️ يوتيوب</label>
        <input id="soYt" dir="ltr" value="${esc2(so.youtubeUrl||'')}"></div>
      <div class="field2"><label>💬 رقم واتساب (لو مختلف عن رقم التواصل)</label>
        <input id="soWa" dir="ltr" value="${esc2(so.whatsappNumber||'')}" placeholder="201234567890"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveSocialLinks()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveSocialLinks = function(){
    const so = REG.sysOwner = REG.sysOwner || {};
    const g = i => (document.getElementById(i)||{}).value.trim();
    so.facebookUrl = g('soFb');
    so.instagramUrl = g('soIg');
    so.youtubeUrl = g('soYt');
    so.whatsappNumber = g('soWa').replace(/[^\d]/g,'');
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظت روابط التواصل');
    if (window.renderSysContent) renderSysContent();
  };

  /* بطاقة الإعداد + مولّد روابط الحملات في شاشة مصادر الزيارات */
  const origVisits = window.pageSysVisits;
  window.pageSysVisits = function(){
    const html = origVisits.apply(this, arguments);
    const so = (window.REG && REG.sysOwner) || {};
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    const link = (src, camp) => `${base}?utm_source=${src}&utm_campaign=${camp}`;
    const card = `
      <div class="card mtop2">
        <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><b>🔗 روابط التواصل</b>
            <div class="small" style="color:var(--muted)">
              ${so.facebookUrl ? '📘 فيسبوك متصل' : '📘 لسه محطّتش صفحة فيسبوك'}</div></div>
          <button class="btn sm gold" onclick="openSocialLinksModal()">إعداد الروابط</button>
        </div>
      </div>
      <div class="card mtop">
        <b>🎯 روابط جاهزة لحملاتك</b>
        <p class="small mtop">استخدم الرابط المناسب في كل إعلان عشان التقرير يفرّق بينهم:</p>
        ${[['فيسبوك — إعلان مدفوع','facebook','fb-ads'],
           ['فيسبوك — منشور عادي','facebook','fb-post'],
           ['جروبات الكمبوندات','facebook','fb-groups'],
           ['واتساب','whatsapp','wa'],
           ['إنستجرام','instagram','ig']].map(([l,s,c]) => `
          <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap;align-items:center">
            <span class="small" style="min-width:170px">${l}</span>
            <input class="small" readonly dir="ltr" style="flex:1;min-width:220px"
              value="${link(s,c)}" onclick="this.select()">
            <button class="btn sm ghost" onclick="navigator.clipboard&&navigator.clipboard.writeText('${link(s,c)}');toast&&toast('اتنسخ')">📋</button>
          </div>`).join('')}
      </div>`;
    return html + card;
  };


  /* نفس البطاقة في "إعدادات حسابي" — جنب بيانات التواصل
     عشان تكون في المكان اللي المستخدم بيدوّر فيه طبيعيًا */
  ['pageSysAccountSettings','pageSysSettings','pageSysLandingSettings'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__socialCard) return;
    const wrapped = function(){
      const so = (window.REG && REG.sysOwner) || {};
      const rows = [
        ['📘 فيسبوك',   so.facebookUrl],
        ['📸 إنستجرام', so.instagramUrl],
        ['▶️ يوتيوب',   so.youtubeUrl],
        ['💬 واتساب',   so.whatsappNumber],
      ].filter(r => r[1]);
      const card = `
        <div class="card content-narrow">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <b>🔗 روابط التواصل الاجتماعي</b>
              <div class="small" style="color:var(--muted)">
                بتظهر في آخر الصفحة الرئيسية للزوّار</div>
            </div>
            <button class="btn gold sm" onclick="openSocialLinksModal()">
              ${rows.length ? 'تعديل الروابط' : '+ ضيف روابطك'}</button>
          </div>
          ${rows.length ? `<div class="mtop">${rows.map(([l,v]) =>
            `<div class="small" style="padding:4px 0;border-bottom:1px dashed var(--line)">
               ${l}: <span dir="ltr">${esc2(v)}</span></div>`).join('')}</div>`
            : '<p class="small mtop" style="color:var(--muted)">لسه محطّتش صفحة فيسبوك ولا أي روابط.</p>'}
        </div>`;
      return card + orig.apply(this, arguments);
    };
    wrapped.__socialCard = true;
    window[name] = wrapped;
  });

  console.log('[عمارتنا] تتبّع مصادر الزيارات جاهز');
})();

})();

/* ═══ emartna-promo.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — بطاقة الدعاية: كود QR وبيانات التواصل
   ------------------------------------------------------------
   المشكلة: مكتبة الـQR بقت تتحمّل عند أول استخدام (لتسريع فتح
   الصفحة)، والبطاقة كانت بتحاول ترسم الكود قبل ما المكتبة تنزل
   فتفشل وتكتب "تعذّر توليد الكود".

   الحل: نستنى المكتبة، ولو فشلت نستخدم مولّد احتياطي.
   وكمان: بيانات التواصل كاملة على البطاقة (فيسبوك · واتساب ·
   البريد · الموقع).
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* ---------- ١) توليد الكود مع انتظار المكتبة ---------- */

  async function ensureQR(){
    if (typeof QRCode !== 'undefined') return true;
    if (typeof window.ensureQRCode === 'function'){
      try{ await window.ensureQRCode(); }catch(e){}
    }
    // انتظار قصير لحد ما المكتبة تجهز
    for (let i = 0; i < 40 && typeof QRCode === 'undefined'; i++)
      await new Promise(r => setTimeout(r, 100));
    return typeof QRCode !== 'undefined';
  }

  /* مولّد احتياطي على الإنترنت لو المكتبة ما نزلتش */
  const fallbackQR = url =>
    'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=1&data=' +
    encodeURIComponent(url);

  const origRender = window.renderMarketingQr;
  window.renderMarketingQr = async function(){
    const so = (window.REG && REG.sysOwner) || {};
    const host = document.getElementById('marketingQrHost');
    if (!host || !so.siteUrl) return;
    host.innerHTML = '<p class="small" style="color:var(--muted)">⏳ بيولّد الكود…</p>';

    const ok = await ensureQR();
    host.innerHTML = '';
    if (ok){
      try{
        new QRCode(host, { text: so.siteUrl.trim(), width:150, height:150,
                           colorDark:'#000000', colorLight:'#ffffff' });
        return;
      }catch(e){}
    }
    // احتياطي: صورة من خدمة توليد
    const img = document.createElement('img');
    img.src = fallbackQR(so.siteUrl.trim());
    img.width = 150; img.height = 150;
    img.alt = 'QR';
    img.crossOrigin = 'anonymous';
    host.appendChild(img);
  };

  /* ---------- ٢) الطباعة تستنى الكود ---------- */

  window.printMarketingCard = async function(){
    const so = (window.REG && REG.sysOwner) || {};
    if (!so.siteUrl) return showMessage('حدد رابط الموقع أولًا من إعدادات حسابي');

    const cards = window.ensureMarketingCards ? ensureMarketingCards() : [];
    const card = cards.find(c => c.id === window.__activeCardId) || cards[0] || {};

    await renderMarketingQr();
    await new Promise(r => setTimeout(r, 350));

    let qr = window.getQrDataUrl ? getQrDataUrl() : null;
    if (!qr){
      const img = document.querySelector('#marketingQrHost img');
      qr = (img && img.src) || fallbackQR(so.siteUrl.trim());
    }

    /* بيانات التواصل — كلها اللي متسجّلة */
    const wa = (so.whatsappNumber || ((so.contactPhoneCountry||'') + (so.contactPhone||'')))
      .replace(/[^\d]/g,'');
    const lines = [
      so.contactPhone && `📞 ${esc2((so.contactPhoneCountry||'') + ' ' + so.contactPhone)}`,
      wa && `💬 واتساب: ${esc2('+' + wa)}`,
      so.contactEmail && `📧 ${esc2(so.contactEmail)}`,
      so.siteUrl && `🌐 ${esc2(so.siteUrl.replace(/^https?:\/\//,''))}`,
      so.facebookUrl && `📘 ${esc2(so.facebookUrl.replace(/^https?:\/\/(www\.)?/,''))}`,
      so.instagramUrl && `📸 ${esc2(so.instagramUrl.replace(/^https?:\/\/(www\.)?/,''))}`,
    ].filter(Boolean);

    const w = window.open('', '_blank', 'width=460,height=680');
    if (!w) return showMessage('يرجى السماح بالنوافذ المنبثقة للطباعة');

    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
      <title>بطاقة عمارتنا الدعائية</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:34px;text-align:center;color:#1c2622;margin:0}
        h1{color:#159A8C;font-size:28px;margin:12px 0 4px}
        .tag{color:#666;margin-top:4px;font-size:14px}
        .feat{text-align:right;display:inline-block;margin-top:20px;font-size:14px;line-height:2}
        .qrbox{margin-top:20px}
        .qrbox img{border:6px solid #fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.12)}
        .cta{margin-top:12px;font-size:14px;font-weight:bold;color:#159A8C}
        .contact{margin-top:18px;padding-top:14px;border-top:2px solid #D8A33B;
                 font-size:13px;line-height:2.1;text-align:center;direction:rtl}
        .contact div{white-space:nowrap}
        .logo{max-width:110px;margin:0 auto}
        @media print{ body{padding:18px} }
      </style></head><body>
      <div class="logo">${window.appLogoSVG ? appLogoSVG(110) : ''}</div>
      <h1>${esc2(card.title || 'عمارتنا')}</h1>
      <p class="tag">${esc2(card.tagline || '')}</p>
      <div class="feat">${(card.features||[]).map(f => `<p>✅ ${esc2(f)}</p>`).join('')}</div>
      <div class="qrbox"><img src="${qr}" width="180" height="180" alt="QR"></div>
      <p class="cta">${esc2(card.cta || 'امسح الكود وابدأ تجربتك المجانية الآن')}</p>
      ${lines.length ? `<div class="contact">${lines.map(l => `<div>${l}</div>`).join('')}</div>` : ''}
      </body></html>`);
    w.document.close();
    setTimeout(() => { try{ w.print(); }catch(e){} }, 900);
  };

  /* ---------- ٣) المعاينة على الشاشة كمان فيها بيانات التواصل ---------- */

  const origPage = window.pageMarketingCard;
  if (origPage && !origPage.__contact){
    const wrapped = function(){
      const html = origPage.apply(this, arguments);
      const so = (window.REG && REG.sysOwner) || {};
      const missing = [];
      if (!so.siteUrl) missing.push('رابط الموقع');
      if (!so.contactPhone) missing.push('رقم الهاتف');
      if (!so.facebookUrl) missing.push('صفحة فيسبوك');
      if (!so.contactEmail) missing.push('البريد الإلكتروني');

      const note = `
        <div class="card content-narrow" style="border:1px dashed ${missing.length?'var(--gold)':'var(--line)'}">
          <b>📇 بيانات التواصل على البطاقة</b>
          <p class="small mtop">البطاقة المطبوعة بتعرض: الهاتف · واتساب · البريد · الموقع · فيسبوك · إنستجرام —
          كل اللي متسجّل في إعدادات حسابك.</p>
          ${missing.length
            ? `<p class="small" style="color:var(--gold)">⚠️ ناقص: ${missing.join(' · ')}</p>
               <button class="btn sm gold mtop" onclick="go('syssettings')">أكمل بياناتك</button>`
            : '<p class="small" style="color:var(--accent)">✅ كل بيانات التواصل مكتملة</p>'}
        </div>`;
      return note + html;
    };
    wrapped.__contact = true;
    window.pageMarketingCard = wrapped;
  }

  console.log('[عمارتنا] بطاقة الدعاية جاهزة');
})();

})();

/* ═══ emartna-welcome.js ═══ */
(function(){
/* ============================================================
   عمارتنا — نافذة الترحيب للزائر الجديد
   ------------------------------------------------------------
   بتظهر مرة واحدة لكل زائر على الصفحة الرئيسية، وبتديله
   ثلاث اختيارات واضحة بدل ما يقرا ويمشي:
     ١) جرّب كرئيس اتحاد (بدون تسجيل)
     ٢) جرّب كصاحب شقة (بدون تسجيل)
     ٣) سجّل واستفيد بالعرض المجاني
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const KEY = 'emartna_welcome_seen';
  const DELAY = 3000;              // الزائر الجاي من إعلان نيّته يجرّب — ما نأخّرهوش

  /* ---------- إعدادات قابلة للتعديل من لوحة صاحب البرنامج ---------- */

  function cfg(){
    try{
      const ls = window.ensureLandingSettings ? ensureLandingSettings() : null;
      if (!ls) return null;
      ls.welcomePopup = Object.assign({
        enabled: true,
        title: 'جرّب البرنامج قبل ما تسجّل',
        subtitle: 'عمارة تجريبية بـ٢٤ وحدة وسنتين حركات مالية — ادخل شوف بنفسك.',
        offerLine: 'وسجّل دلوقتي واستفيد بشهرين مجانًا لأول عمارة.',
        delaySeconds: 3,
        floors: 6, perFloor: 4, lateCount: 3, dueCount: 2,   // ٢٤ وحدة = نفس العمارة التجريبية
      }, ls.welcomePopup || {});
      return ls.welcomePopup;
    }catch(e){ return null; }
  }

  /* بعد تسجيل الخروج بنصفّر العلامة — الزائر رجع للصفحة الرئيسية
     ومن حقه يشوف العرض تاني. */
  (function hookLogout(){
    const wrap = () => {
      const orig = window.logout;
      if (typeof orig !== 'function' || orig.__welcomeReset) return;
      const w = function(){
        try{
          sessionStorage.removeItem(KEY);
          localStorage.removeItem(KEY);
        }catch(e){}
        const r = orig.apply(this, arguments);
        setTimeout(() => { try{ openWelcomePopup(false); }catch(e){} }, 1200);
        return r;
      };
      w.__welcomeReset = true;
      window.logout = w;
    };
    wrap();
    [1000, 3000].forEach(ms => setTimeout(wrap, ms));
  })();

  function seen(){
    try{
      /* "بلاش تفكّرني" كانت بتكتم النافذة للأبد على الجهاز — وده كتير
         لنافذة تسويقية. بقت ٣٠ يوم وبعدين تظهر تاني. */
      const forever = Number(localStorage.getItem(KEY) || 0);
      if (forever && (Date.now() - forever) < 30*24*60*60*1000) return true;
      if (forever) localStorage.removeItem(KEY);
      const t = Number(sessionStorage.getItem(KEY) || 0);
      // بتظهر تاني بعد ساعتين حتى في نفس الجلسة
      return t && (Date.now() - t) < 2 * 60 * 60 * 1000;
    }catch(e){ return false; }
  }
  function markSeen(forever){
    try{
      sessionStorage.setItem(KEY, String(Date.now()));
      if (forever) localStorage.setItem(KEY, String(Date.now()));
    }catch(e){}
  }

  /* العرض المجاني الحالي — بياخد المدة من العروض المفعّلة */
  function offerText(){
    try{
      const offers = window.ensureLandingOffers ? ensureLandingOffers() : [];
      const live = offers.find(o => o.active !== false);
      if (live && live.trialDays){
        const m = Math.round(live.trialDays / 30);
        return m >= 2 ? `${m} شهور مجانًا` : `${live.trialDays} يوم مجانًا`;
      }
    }catch(e){}
    return 'شهرين مجانًا';
  }

  /* ---------- النافذة ---------- */

  /* العرض المفعّل حاليًا — عشان ندمجه في نفس النافذة */
  function liveOffer(){
    try{
      const o = window.activeLandingOffer ? activeLandingOffer() : null;
      return (o && o.active !== false) ? o : null;
    }catch(e){ return null; }
  }

  /* بنمنع نافذة العرض القديمة تظهر لوحدها — بقت جزء من نافذة الترحيب */
  (function suppressOldOffer(){
    try{ sessionStorage.setItem('omaretna_offer_seen','1'); }catch(e){}
    const orig = window.maybeShowOfferPopup;
    if (typeof orig === 'function' && !orig.__merged){
      const w = function(){ /* اتدمجت في نافذة الترحيب */ };
      w.__merged = true;
      window.maybeShowOfferPopup = w;
    }
  })();

  window.openWelcomePopup = function(manual){
    const c = cfg();
    if (!c) return;
    if (!manual && (!c.enabled || seen())) return;
    /* الحارس هنا مش في maybeShow بس — عشان أي نداء تلقائي
       من أي مكان يحترم إعداد صاحب البرنامج. */
    if (!manual && window.landingUIOn && !landingUIOn('welcomePopup')) return;
    if (!manual && window.getSession && getSession()) return;   // مسجّل دخول بالفعل
    markSeen(false);

    const off = liveOffer();
    const offer = offerText();
    /* واجهة عمارة: أدوار وشبابيك وباب — الشباك المنوّر = وحدة سدّدت.
       الحالة بتتظبط من لوحة صاحب البرنامج (عدد الأدوار والمتأخرين). */
    const floors = Math.max(2, Math.min(8, Number(c.floors) || 6));
    const perFloor = Math.max(2, Math.min(6, Number(c.perFloor) || 4));
    const total = floors * perFloor;
    const late  = Math.max(0, Math.min(total, Number(c.lateCount) === 0 ? 0
                                      : (Number(c.lateCount) || 3)));
    const due   = Math.max(0, Math.min(total - late, Number(c.dueCount) === 0 ? 0
                                      : (Number(c.dueCount) || 2)));
    const paid  = total - late - due;

    /* بنوزّع المتأخرين والمستحق بشكل ثابت (مش عشوائي) عشان الشكل ما يترعشش */
    const state = Array(total).fill('paid');
    for (let k = 0; k < late; k++) state[(k * 7 + 1) % total] = 'late';
    let placed = 0;
    for (let k = 0; k < total && placed < due; k++){
      const idx = (k * 5 + 3) % total;
      if (state[idx] === 'paid'){ state[idx] = 'due'; placed++; }
    }

    let win = '', n = 0, delay = 0;
    for (let f = 0; f < floors; f++){
      let row = '';
      for (let u = 0; u < perFloor; u++, n++){
        row += `<i class="wp-w wp-${state[n]}" style="--d:${(delay += 28)}ms"></i>`;
      }
      win += `<div class="wp-floor">${row}</div>`;
    }

    const html = `
      <style>
        .wp{--wp-ink:#153733;--wp-green:#0F7A6F;--wp-gold:#C8912F;--wp-clay:#C4553B;
            --wp-line:#DFE6E3;--wp-wall:#E9E2D6;text-align:start;
            max-width:380px;margin:0 auto}
        @media (max-width:420px){.wp{max-width:100%}}
        .wp-bld{width:100%;max-width:150px;margin:0 auto}
        .wp-tag{display:block;text-align:center;margin:7px 0 0;font-size:11.5px;
          color:#8A9A96}
        .wp-roof{height:9px;border-radius:4px 4px 0 0;background:#2E4B46;
          margin:0 -7px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
        .wp-body{background:var(--wp-wall);padding:9px 8px 0;
          border-inline:1px solid #D6CDBD}
        .wp-floor{display:flex;gap:5px;justify-content:center;
          padding-bottom:6px;border-bottom:1px solid rgba(0,0,0,.07)}
        .wp-floor:last-of-type{border-bottom:0}
        .wp-w{flex:1;height:14px;border-radius:2px;background:#CFC6B6;
          box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.16);
          animation:wpLight .3s ease-out both;animation-delay:var(--d)}
        .wp-paid{background:var(--wp-green)}
        .wp-late{background:var(--wp-clay)}
        .wp-due{background:var(--wp-gold)}
        .wp-base{background:var(--wp-wall);border-inline:1px solid #D6CDBD;
          border-radius:0 0 3px 3px;padding:7px 8px 9px;display:flex;
          gap:7px;justify-content:center;align-items:flex-end}
        .wp-door{width:17px;height:20px;border-radius:9px 9px 2px 2px;
          background:#2E4B46}
        .wp-shop{flex:1;height:13px;border-radius:2px;background:#CFC6B6;
          box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.14)}
        .wp-ground{height:5px;background:#D9D2C6;border-radius:2px;margin:0 -9px}
        @keyframes wpLight{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.wp-w{animation:none}}
        .wp-key{display:flex;gap:13px;flex-wrap:wrap;justify-content:center;
          margin-top:11px;font-size:12px;color:#6E7F7B}
        .wp-key b{font-weight:600;color:var(--wp-ink)}
        .wp-key i{display:inline-block;width:9px;height:9px;border-radius:2px;
          margin-inline-end:5px}
        .wp h3{font-size:18px;line-height:1.45;margin:12px 0 5px;color:var(--wp-ink)}
        .wp-lede{font-size:13px;line-height:1.7;color:#4A5B57;margin:0}
        .wp-cta{display:block;width:100%;text-align:start;border-radius:12px;
          padding:11px 14px;margin-top:8px;cursor:pointer;font:inherit;
          border:1.5px solid var(--wp-line);background:#fff;color:var(--wp-ink);
          transition:transform .15s,box-shadow .15s,border-color .15s}
        .wp-cta b{display:block;font-size:14.5px;margin-bottom:2px}
        .wp-cta span{font-size:12.5px;color:#6E7F7B}
        .wp-cta:hover{transform:translateY(-1px);border-color:var(--wp-green)}

        /* ===== التجربة هي الهدف الأول =====
           كان العرض التجاري (الذهبي) بيشد العين أكتر من التجربة،
           رغم إن الزائر اللي بيجرّب بيتحوّل لعميل أكتر بمرّات من
           اللي بيقرا عرض. فبنخلّي التجربة هي اللي بتنبض. */
        /* نفس تصميم صندوق التجربة في شاشة الدخول — تجربة موحّدة */
        .wp-try{position:relative;margin-top:16px;padding:14px 12px 12px;
          border-radius:16px;
          background:linear-gradient(140deg,#F2FBF9,#E6F5F2);
          border:1.5px solid var(--wp-green)}
        .wp-try::before{content:'جرّب من غير تسجيل';
          position:absolute;top:-11px;inset-inline-start:16px;
          background:var(--wp-green);color:#fff;font-size:11px;font-weight:700;
          padding:3px 11px;border-radius:99px;
          box-shadow:0 2px 8px rgba(15,122,111,.35)}
        .wp-try .wp-cta{margin-top:0}
        .wp-try .wp-cta + .wp-cta{margin-top:7px}

        .wp-cta.is-main{background:var(--wp-green);border-color:var(--wp-green);
          color:#fff;box-shadow:0 3px 12px rgba(15,122,111,.28);
          animation:wpPulse 2.6s ease-in-out infinite}
        .wp-cta.is-main span{color:rgba(255,255,255,.86)}
        .wp-cta.is-main:hover{animation:none;
          box-shadow:0 5px 18px rgba(15,122,111,.36)}
        @keyframes wpPulse{
          0%,100%{box-shadow:0 3px 12px rgba(15,122,111,.28)}
          50%    {box-shadow:0 3px 20px rgba(15,122,111,.48)}}
        /* احترام تفضيل تقليل الحركة */
        @media (prefers-reduced-motion:reduce){
          .wp-cta.is-main{animation:none}}
        .wp-cta:focus-visible{outline:2px solid var(--wp-gold);outline-offset:2px}
        /* العرض التجاري بيهدى شوية: التجربة هي اللي المفروض تشد
           العين الأول، والعرض يبان لمن بيدوّر عليه. */
        .wp-offer{display:flex;gap:10px;align-items:center;margin-top:12px;
          padding:9px 12px;border:1px solid #EADFC4;border-radius:12px;
          background:#FFFCF6}
        .wp-offer div{flex:1;min-width:0}
        .wp-offer b{display:block;font-size:13.5px;color:#8A6414}
        .wp-offer span{font-size:12.5px;color:#6E7F7B}
        .wp-offer button{border:1.5px solid var(--wp-gold);background:transparent;
          color:#8A6414;border-radius:9px;padding:8px 13px;
          font:600 13px inherit;cursor:pointer;white-space:nowrap}
        .wp-offer button:hover{background:var(--wp-gold);color:#fff}
        .wp-calc{display:block;width:100%;margin-top:10px;padding:10px;
          border:1px dashed var(--wp-green);border-radius:11px;background:#F4FAF9;
          color:var(--wp-green);font:600 13.5px inherit;cursor:pointer}
        .wp-calc:hover{background:#EAF5F3}
        .wp-skip{display:block;width:100%;margin-top:11px;background:none;border:0;
          color:#8A9A96;font:inherit;font-size:12.5px;cursor:pointer}
      </style>

      <div class="wp">
        <div class="wp-bld" aria-hidden="true">
          <div class="wp-roof"></div>
          <div class="wp-body">${win}</div>
          <div class="wp-base">
            <span class="wp-shop"></span>
            <span class="wp-door"></span>
            <span class="wp-shop"></span>
          </div>
          <div class="wp-ground"></div>
        </div>

        <div class="wp-key">
          <span><i style="background:#0F7A6F"></i><b>${paid}</b> سدّدوا</span>
          ${due  ? `<span><i style="background:#C8912F"></i><b>${due}</b> تحت التحصيل</span>` : ''}
          ${late ? `<span><i style="background:#C4553B"></i><b>${late}</b> متأخرين</span>` : ''}
        </div>

        <span class="wp-tag">عمارة تجريبية للعرض — مش بيانات عميل حقيقي</span>

        <h3>${esc2(c.title)}</h3>
        <p class="wp-lede">${esc2(c.subtitle)}</p>

        <div class="wp-try">
          <button class="wp-cta is-main" onclick="welcomeGo('admin')">
            <b>🏢 ادخل كرئيس اتحاد</b>
            <span>عمارة جاهزة بسنتين حركات — شوف التحصيل والتقارير</span>
          </button>
          <button class="wp-cta" onclick="welcomeGo('owner')">
            <b>🏠 ادخل كصاحب شقة</b>
            <span>اللي الساكن بيشوفه: حسابه ومستحقاته</span>
          </button>
        </div>

        <div class="wp-offer">
          <div>
            <b>${esc2(off && off.title ? off.title : offer)}</b>
            <span>${esc2((off && off.subtitle) || c.offerLine)}</span>
          </div>
          <button onclick="welcomeSignup()">${esc2((off && off.ctaText) || 'سجّل')}</button>
        </div>

        ${window.openPriceCalc ? `<button class="wp-calc"
          onclick="welcomeClose(false);setTimeout(()=>openPriceCalc(),200)">
          💰 عمارتك كام وحدة؟ احسب اشتراكك في ثانية
        </button>` : ''}

        <button class="wp-skip" onclick="welcomeClose(true)">مش دلوقتي</button>
      </div>`;

    if (typeof window.openModal === 'function') openModal(html, false);
  };

  window.welcomeGo = function(role){
    closeModal();
    setTimeout(() => {
      if (typeof window.tryDemoNow === 'function') tryDemoNow(role);
      else if (typeof window.loginAsDemo === 'function') loginAsDemo(role);
    }, 120);
  };

  window.welcomeSignup = function(){
    closeModal();
    setTimeout(() => { if (window.openSignup) openSignup(); }, 120);
  };

  window.welcomeClose = function(forever){
    markSeen(!!forever);
    closeModal();
  };

  /* زرار عائم يرجّع النافذة في أي وقت */
  function floatBtn(){
    /* ⚠️ كان فيه زرارين عائمين (التجربة والحاسبة) بيغطّوا أزرار
       الصفحة نفسها على الموبايل. بقوا زرار واحد بيفتح الاتنين. */
    try{
      const allowed = !window.landingUIOn || landingUIOn('startFab');
      const on = allowed
                 && (typeof __viewMode !== 'undefined' && __viewMode === 'landing')
                 && !(window.getSession && getSession());
      let b = document.getElementById('welcomeFab');
      if (!on){
        if (b) b.remove();
        const sp = document.getElementById('fabSpacer');
        if (sp) sp.remove();
        return;
      }
      if (b) return;
      b = document.createElement('button');
      b.id = 'welcomeFab';
      b.title = 'ابدأ مجانًا';
      b.textContent = '🎁 ابدأ مجانًا';
      b.style.cssText = 'position:fixed;bottom:14px;inset-inline-start:50%;' +
        'transform:translateX(50%);z-index:9200;' +
        'background:var(--gold,#D8A33B);color:#fff;border:0;border-radius:26px;' +
        'padding:12px 22px;font:700 14.5px system-ui;cursor:pointer;direction:rtl;' +
        'box-shadow:0 6px 20px rgba(0,0,0,.24);white-space:nowrap;max-width:92vw';
      b.onclick = () => openStartMenu();
      document.body.appendChild(b);

      /* مساحة تحت المحتوى عشان الزرار ما يغطّيش آخر عنصر */
      if (!document.getElementById('fabSpacer')){
        const sp = document.createElement('div');
        sp.id = 'fabSpacer';
        sp.style.cssText = 'height:76px;pointer-events:none';
        const host = document.getElementById('content') || document.body;
        host.appendChild(sp);
      }
    }catch(e){}
  }

  /* قائمة مختصرة بدل زرارين */
  window.openStartMenu = function(){
    openModal(`
      <div style="text-align:center">
        <div style="font-size:34px">🏢</div>
        <h3 style="margin:6px 0 2px">ابدأ مع عمارتنا</h3>
        <p class="small" style="color:var(--muted);margin:0">اختار اللي يناسبك</p>
      </div>

      <button class="btn primary mtop2" style="width:100%;padding:13px;font-size:15px"
        onclick="closeModal();setTimeout(()=>openWelcomePopup(true),150)">
        🎁 جرّب البرنامج مجانًا
        <div class="small" style="font-weight:400;opacity:.9;margin-top:2px">
          من غير تسجيل — عمارة جاهزة بالبيانات</div>
      </button>

      <button class="btn ghost mtop" style="width:100%;padding:13px;font-size:15px"
        onclick="closeModal();setTimeout(()=>openPriceCalc(),150)">
        💰 احسب اشتراك عمارتك
        <div class="small" style="font-weight:400;opacity:.85;margin-top:2px">
          اكتب عدد وحداتك وشوف سعرك فورًا</div>
      </button>

      <button class="btn gold mtop" style="width:100%;padding:12px"
        onclick="closeModal();setTimeout(()=>openSignup(),150)">
        ✅ سجّل واحصل على شهرين مجانًا</button>`, true);
  };

  setInterval(floatBtn, 1500);
  setTimeout(floatBtn, 2000);

  /* التشغيل التلقائي على الصفحة الرئيسية */
  function maybeShow(){
    try{
      if (window.getSession && getSession()) return;
      if (typeof __viewMode !== 'undefined' && __viewMode !== 'landing') return;
      const c = cfg();
      if (!c || !c.enabled || seen()) return;
      if (window.landingUIOn && !landingUIOn('welcomePopup')) return;
      openWelcomePopup(false);
    }catch(e){}
  }

  /* تشخيص: ليه النافذة مش ظاهرة؟ نداء واحد من الـ Console يقول السبب. */
  window.whyNoWelcome = function(){
    const c = cfg();
    const reasons = [];
    if (!c) reasons.push('إعدادات الصفحة الرئيسية لسه ما اتحمّلتش');
    else if (!c.enabled) reasons.push('النافذة مقفولة من لوحة صاحب البرنامج');
    if (window.landingUIOn && !landingUIOn('welcomePopup'))
      reasons.push('مقفولة من "عناصر الصفحة الرئيسية"');
    try{
      if (localStorage.getItem(KEY) === '1')
        reasons.push('الزائر اختار "بلاش تفكّرني" على الجهاز ده');
      const t = Number(sessionStorage.getItem(KEY) || 0);
      if (t && (Date.now() - t) < 2*60*60*1000)
        reasons.push('ظهرت خلال آخر ساعتين في نفس الجلسة');
    }catch(e){}
    if (window.getSession && getSession())
      reasons.push('انت مسجّل دخول — النافذة للزوّار غير المسجّلين بس');

    const msg = reasons.length
      ? 'النافذة مش ظاهرة للأسباب دي:\n\n• ' + reasons.join('\n• ')
      : 'مفيش مانع — المفروض تظهر بعد ' + ((c && c.delaySeconds) || 6) + ' ثواني.';
    if (window.showMessage) showMessage(msg); else console.log(msg);
    return reasons;
  };

  /* تصفير الكتم — عشان تقدر تجرّبها من غير ما تفتح متصفح جديد */
  window.resetWelcomePopup = function(){
    try{ localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); }catch(e){}
    if (window.toast) toast('اتصفّر الكتم — النافذة هتظهر تاني للزوّار');
  };

  let started = false;
  const t = setInterval(() => {
    if (started) return clearInterval(t);
    if (!window.REG || !window.ensureLandingSettings) return;
    started = true; clearInterval(t);
    const c = cfg();
    setTimeout(maybeShow, Math.max(1500, (c && c.delaySeconds ? c.delaySeconds : 3) * 1000));
  }, 400);

  /* ---------- إعداد النافذة من لوحة صاحب البرنامج ---------- */

  window.openWelcomeSettings = function(){
    const c = cfg();
    if (!c) return;
    openModal(`
      <h3>👋 نافذة الترحيب للزائر</h3>
      <p class="small mtop">بتظهر مرة واحدة لكل زائر على الصفحة الرئيسية،
      وبتقدّم له التجربة المجانية والعرض.</p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="wpOn" ${c.enabled?'checked':''}> تفعيل النافذة</label>
      </div>
      <div class="field2"><label>العنوان</label>
        <input id="wpTitle" value="${esc2(c.title)}"></div>
      <div class="field2"><label>النص التوضيحي</label>
        <textarea id="wpSub" rows="2" style="width:100%">${esc2(c.subtitle)}</textarea></div>
      <div class="field2"><label>سطر العرض المجاني</label>
        <input id="wpOffer" value="${esc2(c.offerLine)}"></div>
      <div class="field2"><label>تظهر بعد كام ثانية من فتح الصفحة</label>
        <input id="wpDelay" type="number" min="0" max="60" value="${c.delaySeconds}"></div>

      <div class="card mtop2" style="background:var(--tint)">
        <b class="small">🏢 شكل العمارة في النافذة</b>
        <p class="small" style="color:var(--muted)">الشبابيك المنوّرة = وحدات سدّدت.
          خلّي الأرقام قريبة من الواقع — الزائر بيصدّق الصورة اللي تشبه عمارته.</p>
        <div class="flexrow mtop" style="gap:8px;flex-wrap:wrap">
          <div class="field2" style="flex:1;min-width:104px"><label>عدد الأدوار</label>
            <input id="wpFloors" type="number" min="2" max="8" value="${c.floors}"></div>
          <div class="field2" style="flex:1;min-width:104px"><label>وحدات في الدور</label>
            <input id="wpPer" type="number" min="2" max="6" value="${c.perFloor}"></div>
        </div>
        <div class="flexrow" style="gap:8px;flex-wrap:wrap">
          <div class="field2" style="flex:1;min-width:104px"><label>متأخرين (أحمر)</label>
            <input id="wpLate" type="number" min="0" max="20" value="${c.lateCount}"></div>
          <div class="field2" style="flex:1;min-width:104px"><label>تحت التحصيل (ذهبي)</label>
            <input id="wpDue" type="number" min="0" max="20" value="${c.dueCount}"></div>
        </div>
        <p class="small" style="color:var(--muted)">الباقي بيتحسب تلقائيًا كوحدات سدّدت.</p>
      </div>

      <div class="flexrow mtop2" style="gap:8px;flex-wrap:wrap">
        <button class="btn primary" onclick="saveWelcomeSettings()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal();setTimeout(()=>openWelcomePopup(true),150)">
          👁️ معاينة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveWelcomeSettings = function(){
    const ls = ensureLandingSettings();
    const g = i => (document.getElementById(i)||{}).value;
    ls.welcomePopup = {
      enabled: !!(document.getElementById('wpOn')||{}).checked,
      title: g('wpTitle').trim(),
      subtitle: g('wpSub').trim(),
      offerLine: g('wpOffer').trim(),
      delaySeconds: Math.max(0, Number(g('wpDelay')) || 3),
      floors:    Math.min(8, Math.max(2, Number(g('wpFloors')) || 5)),
      perFloor:  Math.min(6, Math.max(2, Number(g('wpPer'))    || 4)),
      lateCount: Math.max(0, Number(g('wpLate')) || 0),
      dueCount:  Math.max(0, Number(g('wpDue'))  || 0),
    };
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظت إعدادات نافذة الترحيب');
    if (window.renderSysContent) renderSysContent();
  };

  /* بطاقة في شاشة الصفحة الرئيسية */
  const origLandingPage = window.pageSysLandingSettings;
  if (origLandingPage && !origLandingPage.__welcome){
    const wrapped = function(){
      const c = cfg() || {};
      const card = `
        <div class="card content-narrow">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <b>👋 نافذة الترحيب للزائر</b>
              <div class="small" style="color:var(--muted)">
                ${c.enabled ? `مفعّلة — بتظهر بعد ${c.delaySeconds} ثواني` : 'مقفولة'}</div>
            </div>
            <div class="flexrow" style="gap:6px;flex-wrap:wrap">
              <button class="btn sm ghost" onclick="whyNoWelcome()">ليه مش ظاهرة؟</button>
              <button class="btn sm ghost" onclick="resetWelcomePopup()">تصفير الكتم</button>
              <button class="btn ${c.enabled?'ghost':'gold'} sm" onclick="openWelcomeSettings()">
                ${c.enabled ? 'تعديل' : 'تفعيل'}</button>
            </div>
          </div>
        </div>`;
      return card + origLandingPage.apply(this, arguments);
    };
    wrapped.__welcome = true;
    window.pageSysLandingSettings = wrapped;
  }

  console.log('[عمارتنا] نافذة الترحيب جاهزة');
})();

})();

/* ═══ emartna-idle.js ═══ */
(function(){
/* ============================================================
   عمارتنا — الخروج التلقائي عند الخمول
   ------------------------------------------------------------
   بعد فترة بدون أي نشاط، بتظهر نافذة تحذير بعدّاد تنازلي،
   وبعدها بيتم تسجيل الخروج.

   قواعد اتحطت عن قصد:
   • مفيش خروج والشاشة فيها نافذة مفتوحة أو كلام مكتوب لسه
     ما اتحفظش — المستخدم ممكن يكون بيقرا مستند جنبه.
   • مفيش خروج والمزامنة لسه شغالة — البيانات تروح.
   • أي حركة (ماوس، كيبورد، لمس، تمرير) بتصفّر العدّاد.
   ============================================================ */

(function(){
  'use strict';

  /* السياسة بتيجي من القاعدة — مش من الجهاز.
     في localStorage كان أي مستخدم يقدر يمسحها ويلغي الحماية عن نفسه.
     السقف من المنصة، والعمارة تقدر تشدّد بس مش ترخّي. */
  const FALLBACK = { enabled: true, minutes: 15, warnSeconds: 60, role: 'owner' };
  let POLICY = null;

  function cfg(){ return POLICY || FALLBACK; }
  window.idleConfig = cfg;

  async function loadPolicy(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      const uuid = CLOUD._cache.buildingUuid[window.activeBuildingId];
      if (!sb || !uuid) return;
      const { data, error } = await sb.rpc('my_idle_policy', { p_building: uuid });
      if (!error && data) POLICY = data;
    }catch(e){}
  }
  setTimeout(loadPolicy, 3000);
  setInterval(loadPolicy, 10 * 60 * 1000);   // نلتقط أي تغيير في السياسة
  document.addEventListener('emartna:building-complete', () => setTimeout(loadPolicy, 900));

  let lastAct = Date.now(), warnBox = null, tick = null;

  function reset(){
    lastAct = Date.now();
    if (warnBox) dismissWarning();
  }
  ['mousedown','keydown','touchstart','scroll','wheel','pointerdown']
    .forEach(ev => document.addEventListener(ev, reset, { passive:true, capture:true }));

  /* حاجات بتمنع الخروج حتى لو مفيش حركة */
  function busy(){
    try{
      if (document.querySelector('.modal, .modal-backdrop')) return 'نافذة مفتوحة';
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.value) return 'فيه كلام متكتب';
      if (window.CLOUD && CLOUD._cache && CLOUD._cache.dirty
          && CLOUD._cache.dirty.size) return 'المزامنة لسه شغالة';
    }catch(e){}
    return null;
  }

  function loggedIn(){
    try{ return !!(window.getSession && getSession()); }catch(e){ return false; }
  }

  function dismissWarning(){
    if (tick){ clearInterval(tick); tick = null; }
    if (warnBox){ warnBox.remove(); warnBox = null; }
  }

  function showWarning(c){
    if (warnBox) return;
    let left = c.warnSeconds;

    warnBox = document.createElement('div');
    warnBox.dir = 'rtl';
    warnBox.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(12,28,26,.55);backdrop-filter:blur(2px)';
    warnBox.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:22px 20px;max-width:340px;' +
             'width:88%;text-align:center;font-family:inherit;' +
             'box-shadow:0 18px 50px rgba(0,0,0,.3)">' +
        '<div style="font-size:34px;line-height:1">⏳</div>' +
        '<h3 style="margin:8px 0 4px;font-size:18px;color:#153733">لسه موجود؟</h3>' +
        '<p style="margin:0;font-size:13.5px;line-height:1.8;color:#4A5B57">' +
          'مفيش نشاط من شوية. هنقفل الجلسة بعد ' +
          '<b id="idleLeft" style="color:#C4553B;font-size:16px">' + left + '</b> ثانية' +
          ' — حفاظًا على بيانات عمارتك.</p>' +
        '<button id="idleStay" style="width:100%;margin-top:14px;border:0;border-radius:11px;' +
               'background:#0F7A6F;color:#fff;padding:12px;font:600 15px inherit;' +
               'cursor:pointer">أنا هنا — كمّل شغل</button>' +
        '<button id="idleOut" style="width:100%;margin-top:8px;border:0;background:none;' +
               'color:#8A9A96;font:inherit;font-size:12.5px;cursor:pointer">' +
          'اقفل الجلسة دلوقتي</button>' +
      '</div>';
    document.body.appendChild(warnBox);

    warnBox.querySelector('#idleStay').onclick = () => { lastAct = Date.now(); dismissWarning(); };
    warnBox.querySelector('#idleOut').onclick  = () => { dismissWarning(); doLogout(); };

    tick = setInterval(() => {
      left--;
      const el = document.getElementById('idleLeft');
      if (el) el.textContent = left;
      if (left <= 0){ dismissWarning(); doLogout(); }
    }, 1000);
  }

  function doLogout(){
    try{
      /* آخر دفعة مزامنة قبل ما نقفل — ما نسيبش تعديل مش متبعت */
      if (typeof window.flushNow === 'function') flushNow();
    }catch(e){}
    setTimeout(() => { try{ if (window.logout) logout(); }catch(e){} }, 400);
  }

  setInterval(() => {
    const c = cfg();
    if (!c.enabled || !loggedIn()) return;
    if (document.hidden) return;                 // التاب في الخلفية — مش خمول
    const idleMs = Date.now() - lastAct;
    const limit  = c.minutes * 60 * 1000;
    if (idleMs < limit - c.warnSeconds * 1000) return;
    const why = busy();
    if (why){ lastAct = Date.now(); return; }    // مشغول فعلًا — نأجّل
    showWarning(c);
  }, 5000);

  /* ---------- إعداد المدة ---------- */

  /* ---------- سياسة المنصة (مسؤول النظام) ---------- */

  window.openIdlePolicy = async function(){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) return showMessage('مش متصل بالسحابة.');
    let p = {};
    try{
      const { data } = await sb.from('platform_settings')
        .select('value').eq('key','idle_policy').single();
      p = (data && data.value) || {};
    }catch(e){}

    openModal(`
      <h3>⏳ سياسة إقفال الجلسة</h3>
      <p class="small mtop">سياسة أمان على كل العملاء. رئيس الاتحاد يقدر
        <b>يشدّدها</b> على عمارته، ومايقدرش يرخّيها ولا يقفلها.</p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="ipOn" ${p.enabled!==false?'checked':''}>
          تفعيل على كل العمارات</label>
      </div>
      <div class="field2"><label>الإدارة — يقفل بعد كام دقيقة خمول</label>
        <input id="ipStaff" type="number" min="5" max="120" value="${p.staffMinutes||15}"></div>
      <div class="field2"><label>الملاك والمستأجرين — كام دقيقة</label>
        <input id="ipRes" type="number" min="5" max="240" value="${p.residentMinutes||60}"></div>
      <div class="field2"><label>مدة التحذير قبل الإقفال (ثانية)</label>
        <input id="ipWarn" type="number" min="15" max="180" value="${p.warnSeconds||60}"></div>
      <div class="field2">
        <label><input type="checkbox" id="ipOvr" ${p.allowBuildingOverride!==false?'checked':''}>
          اسمح لرئيس الاتحاد يشدّدها على عمارته</label>
      </div>

      <p class="small" style="color:var(--muted)">الإدارة بتشوف أرصدة وكشوف حساب،
        فمدتها أقصر. الساكن بيشوف وحدته بس — إقفال متكرر عليه إزعاج بلا مقابل.</p>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveIdlePolicy()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.saveIdlePolicy = async function(){
    const g = i => (document.getElementById(i) || {}).value;
    const chk = i => !!(document.getElementById(i) || {}).checked;
    const value = {
      enabled: chk('ipOn'),
      staffMinutes:    Math.min(120, Math.max(5, Number(g('ipStaff')) || 15)),
      residentMinutes: Math.min(240, Math.max(5, Number(g('ipRes'))   || 60)),
      warnSeconds:     Math.min(180, Math.max(15, Number(g('ipWarn')) || 60)),
      allowBuildingOverride: chk('ipOvr'),
    };
    try{
      const { error } = await window.CLOUD._sb.from('platform_settings')
        .upsert({ key:'idle_policy', value }, { onConflict:'key' });
      if (error) throw error;
      closeModal();
      if (window.toast) toast('اتحفظت السياسة');
      loadPolicy();
    }catch(e){ showMessage(e.message); }
  };

  /* ---------- تشديد على مستوى العمارة ---------- */

  window.openIdleBuilding = async function(){
    const p = cfg();
    openModal(`
      <h3>⏳ إقفال الجلسة في عمارتك</h3>
      <p class="small mtop">السياسة الحالية لدورك: <b>${p.minutes} دقيقة</b>.
        تقدر تقصّرها لو الأجهزة في مكان مشترك — مش تطوّلها.</p>
      <div class="field2 mtop2"><label>يقفل بعد كام دقيقة (فاضي = سياسة المنصة)</label>
        <input id="ibMin" type="number" min="3" max="${p.minutes}" placeholder="${p.minutes}"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveIdleBuilding()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.saveIdleBuilding = async function(){
    const v = (document.getElementById('ibMin') || {}).value;
    try{
      const uuid = CLOUD._cache.buildingUuid[window.activeBuildingId];
      const { error } = await window.CLOUD._sb.from('buildings')
        .update({ idle_minutes: v ? Math.max(3, Number(v)) : null }).eq('id', uuid);
      if (error) throw error;
      closeModal();
      if (window.toast) toast('اتحفظ');
      loadPolicy();
    }catch(e){ showMessage(e.message); }
  };

  console.log('[عمارتنا] إقفال الجلسة عند الخمول جاهز');
})();

})();

/* ═══ emartna-offers.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تحسين عروض العملاء الجدد + التقرير يوم بيوم
   ------------------------------------------------------------
   ١) العرض بقى يقبل صورة وألوان وتنسيق، والمعاينة بتوري
      الشكل النهائي بالظبط.
   ٢) تقرير الزيارات بيعرض كل يوم في الفترة — حتى الأيام
      اللي مفيهاش نشاط — عشان تشوف الفجوات مش تفتكرها مفيش.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* ============================================================
     ١) صورة وتنسيق العرض
     ============================================================ */

  const THEMES = {
    teal:   { name:'أخضر البرنامج', bg:'linear-gradient(135deg,#159A8C,#0f7a6f)', fg:'#fff', btn:'#fff', btnFg:'#159A8C' },
    gold:   { name:'ذهبي',          bg:'linear-gradient(135deg,#D8A33B,#b8862a)', fg:'#fff', btn:'#fff', btnFg:'#8a6413' },
    dark:   { name:'داكن أنيق',     bg:'linear-gradient(135deg,#1f2a37,#111827)', fg:'#fff', btn:'#D8A33B', btnFg:'#1f2a37' },
    light:  { name:'فاتح بسيط',     bg:'#ffffff',                                  fg:'#1b2b28', btn:'#159A8C', btnFg:'#fff' },
    sunset: { name:'برتقالي دافي',  bg:'linear-gradient(135deg,#F97316,#c2410c)', fg:'#fff', btn:'#fff', btnFg:'#c2410c' },
  };

  const themeOf = o => THEMES[(o && o.theme && o.theme.key) || 'teal'] || THEMES.teal;

  /* شكل العرض النهائي — نفس اللي الزائر هيشوفه */
  window.offerCardHTML = function(o, isPreview){
    const t = themeOf(o);
    const feats = (o.features || []).filter(Boolean);
    return `
    <div class="offer-overlay" id="offerOverlay" style="position:fixed;inset:0;z-index:99500;
         background:rgba(15,25,22,.55);display:flex;align-items:center;justify-content:center;padding:18px">
      <div style="max-width:430px;width:100%;max-height:92vh;overflow:auto;border-radius:20px;
           background:${t.bg};color:${t.fg};box-shadow:0 20px 60px rgba(0,0,0,.3);position:relative;
           text-align:center;direction:rtl">
        <button onclick="closeOfferPopup(${isPreview?'true':'false'})"
          style="position:absolute;top:12px;inset-inline-start:12px;width:30px;height:30px;border:0;
                 border-radius:50%;background:rgba(255,255,255,.25);color:${t.fg};
                 font-size:16px;cursor:pointer;line-height:1">✕</button>

        ${o.imageUrl ? `<img src="${esc2(o.imageUrl)}" alt=""
           style="width:100%;max-height:190px;object-fit:cover;border-radius:20px 20px 0 0;display:block">` : ''}

        <div style="padding:${o.imageUrl?'18px 24px 24px':'34px 24px 24px'}">
          ${!o.imageUrl && o.emoji !== '' ? `<div style="font-size:44px;line-height:1">${esc2(o.emoji || '🎉')}</div>` : ''}
          <h2 style="margin:10px 0 4px;font-size:22px;color:${t.fg}">${esc2(o.title || '')}</h2>
          ${o.subtitle ? `<p style="margin:0 0 4px;font-size:15px;opacity:.92">${esc2(o.subtitle)}</p>` : ''}

          ${feats.length ? `<div style="text-align:start;margin:16px auto 0;max-width:330px;
               background:rgba(255,255,255,.14);border-radius:12px;padding:12px 14px">
            ${feats.map(f => `<div style="padding:4px 0;font-size:13.5px;line-height:1.9">
                ✔️ ${esc2(f)}</div>`).join('')}
          </div>` : ''}

          <button onclick="closeOfferPopup(${isPreview?'true':'false'});openSignup()"
            style="margin-top:18px;width:100%;padding:14px;border:0;border-radius:12px;
                   background:${t.btn};color:${t.btnFg};font-size:16px;font-weight:800;cursor:pointer">
            ${esc2(o.ctaText || 'ابدأ دلوقتي')}</button>

          ${o.footnote ? `<p style="margin-top:10px;font-size:11.5px;opacity:.8">${esc2(o.footnote)}</p>` : ''}
        </div>
      </div>
    </div>`;
  };

  /* بنستبدل العرض والمعاينة القديمين */
  window.offerPopupHTML = (o, isPreview) => offerCardHTML(o, isPreview);
  window.previewOffer = function(id){
    const o = (window.ensureLandingOffers ? ensureLandingOffers() : []).find(x => x.id === id);
    if (!o) return;
    const old = document.getElementById('offerOverlay');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', offerCardHTML(o, true));
  };

  /* ---------- محرر العرض: صورة + ألوان + مميزات ---------- */

  window.openOfferDesign = function(id){
    const o = (window.ensureLandingOffers ? ensureLandingOffers() : []).find(x => x.id === id);
    if (!o) return;
    const cur = (o.theme && o.theme.key) || 'teal';
    openModal(`
      <h3>🎨 تصميم العرض</h3>
      <p class="small mtop">شكل النافذة اللي بتظهر للزائر. اضغط معاينة في أي وقت تشوف النتيجة.</p>

      <div class="field2 mtop2"><label>اللون</label>
        <select id="ofTheme">${Object.entries(THEMES).map(([k,v]) =>
          `<option value="${k}" ${cur===k?'selected':''}>${v.name}</option>`).join('')}</select></div>

      <div class="field2"><label>أيقونة فوق العنوان (لو مفيش صورة)</label>
        <input id="ofEmoji" value="${esc2(o.emoji || '🎉')}" placeholder="🎉" style="font-size:20px;text-align:center"></div>

      <div class="field2"><label>صورة العرض (اختياري)</label>
        <input id="ofImgFile" type="file" accept="image/*" onchange="pickOfferImage(this)">
        <p class="small">الصورة بتتضغط تلقائيًا. الأفضل عرضية (مثال 800×400).</p>
        <div id="ofImgPrev" class="mtop">${o.imageUrl
          ? `<img src="${esc2(o.imageUrl)}" style="max-width:100%;border-radius:10px">
             <button class="btn sm red mtop" onclick="clearOfferImage()">🗑️ شيل الصورة</button>`
          : '<span class="small" style="color:var(--muted)">مفيش صورة</span>'}</div></div>

      <div class="field2 mtop"><label>العنوان الفرعي</label>
        <input id="ofSub" value="${esc2(o.subtitle || '')}"></div>

      <div class="field2"><label>المميزات (سطر لكل ميزة)</label>
        <textarea id="ofFeats" rows="5" style="width:100%">${esc2((o.features || []).join('\n'))}</textarea></div>

      <div class="grid g2">
        <div class="field2"><label>نص الزرار</label>
          <input id="ofCta" value="${esc2(o.ctaText || 'جرب الآن مجانًا')}"></div>
        <div class="field2"><label>سطر صغير تحت</label>
          <input id="ofFoot" value="${esc2(o.footnote || '')}"></div>
      </div>

      <div class="flexrow mtop2" style="gap:8px;flex-wrap:wrap">
        <button class="btn primary" onclick="saveOfferDesign('${id}')">💾 حفظ</button>
        <button class="btn gold" onclick="saveOfferDesign('${id}',true)">👁️ حفظ ومعاينة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.pickOfferImage = async function(input){
    const f = input.files && input.files[0];
    if (!f) return;
    try{
      const url = window.compressImage
        ? await compressImage(f, { maxW: 900, quality: .78, maxKB: 160 })
        : await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
      window.__offerImg = url;
      const box = document.getElementById('ofImgPrev');
      if (box) box.innerHTML = `<img src="${url}" style="max-width:100%;border-radius:10px">
        <button class="btn sm red mtop" onclick="clearOfferImage()">🗑️ شيل الصورة</button>`;
    }catch(e){ showMessage('تعذّر تحميل الصورة: ' + e.message); }
  };

  window.clearOfferImage = function(){
    window.__offerImg = '';
    const box = document.getElementById('ofImgPrev');
    if (box) box.innerHTML = '<span class="small" style="color:var(--muted)">مفيش صورة</span>';
  };

  window.saveOfferDesign = function(id, preview){
    const o = ensureLandingOffers().find(x => x.id === id);
    if (!o) return;
    const g = i => (document.getElementById(i) || {}).value || '';
    o.theme    = { key: g('ofTheme') || 'teal' };
    o.emoji    = g('ofEmoji').trim();
    o.subtitle = g('ofSub').trim();
    o.features = g('ofFeats').split('\n').map(x => x.trim()).filter(Boolean);
    o.ctaText  = g('ofCta').trim() || 'ابدأ دلوقتي';
    o.footnote = g('ofFoot').trim();
    if (window.__offerImg !== undefined) o.imageUrl = window.__offerImg;
    delete window.__offerImg;
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظ تصميم العرض');
    if (preview) setTimeout(() => previewOffer(id), 200);
    else if (window.renderSysContent) renderSysContent();
  };

  /* زرار التصميم جنب أزرار العرض */
  const origOffers = window.pageSysOffers;
  if (origOffers && !origOffers.__design){
    const wrapped = function(){
      let html = origOffers.apply(this, arguments);
      const offers = window.ensureLandingOffers ? ensureLandingOffers() : [];
      offers.forEach(o => {
        const mark = `onclick="previewOffer('${o.id}')"`;
        if (html.includes(mark))
          html = html.replace(mark + '>👁️ معاينة</button>',
            mark + '>👁️ معاينة</button>' +
            `<button class="btn sm gold" onclick="openOfferDesign('${o.id}')">🎨 تصميم</button>`);
      });
      return html;
    };
    wrapped.__design = true;
    window.pageSysOffers = wrapped;
  }

  /* ============================================================
     ٢) التقرير: كل يوم في الفترة حتى لو صفر
     ============================================================ */

  const origVisits = window.pageSysVisits;
  if (origVisits && !origVisits.__allDays){
    const wrapped = function(){
      const rows = window.__visitRows;
      if (Array.isArray(rows) && window.__visitFrom && window.__visitTo){
        const have = new Set(rows.map(r => String(r.day)));
        const from = new Date(window.__visitFrom), to = new Date(window.__visitTo);
        const days = Math.round((to - from) / 86400000);
        if (days >= 0 && days <= 400){
          const filled = rows.slice();
          for (let i = 0; i <= days; i++){
            const d = new Date(from.getTime() + i * 86400000).toISOString().slice(0,10);
            if (!have.has(d))
              filled.push({ day:d, source:'—', visits:0, demos:0, signups:0, logins:0 });
          }
          window.__visitRows = filled;
          const out = origVisits.apply(this, arguments);
          window.__visitRows = rows;      // نرجّع الأصل عشان الحسابات
          return out;
        }
      }
      return origVisits.apply(this, arguments);
    };
    wrapped.__allDays = true;
    window.pageSysVisits = wrapped;
  }

  console.log('[عمارتنا] تصميم العروض والتقرير اليومي جاهز');
})();

})();

/* ═══ emartna-dates.js ═══ */
(function(){
/* ============================================================
   عمارتنا — توحيد صيغة التاريخ (يوم/شهر/سنة)
   ------------------------------------------------------------
   خانة التاريخ في المتصفح بتعرض بصيغة لغة الجهاز — فلو الجهاز
   إنجليزي بتبان شهر/يوم/سنة وده بيلخبط.

   الحل هنا:
     • كل تاريخ معروض في الجداول والبطاقات بصيغة يوم/شهر/سنة
     • وتحت كل خانة تاريخ سطر بيقول التاريخ بالعربي الواضح
       (مثال: الخميس ٢٠ أغسطس ٢٠٢٦) فمفيش لبس
   ============================================================ */

(function(){
  'use strict';

  const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                     'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const AR_DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  const pad = n => String(n).padStart(2,'0');

  /* 2026-08-20 → 20/08/2026 */
  window.fmtDate = function(v){
    if (!v) return '';
    const s = String(v).slice(0,10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(v);
    return `${m[3]}/${m[2]}/${m[1]}`;
  };

  /* 2026-08-20 → الخميس ٢٠ أغسطس ٢٠٢٦ */
  window.fmtDateLong = function(v){
    if (!v) return '';
    const d = new Date(String(v).slice(0,10) + 'T12:00:00');
    if (isNaN(d)) return String(v);
    return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  /* التاريخ والوقت */
  window.fmtDateTime = function(v){
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /* ---------- سطر توضيحي تحت كل خانة تاريخ ---------- */

  function hintFor(input){
    let h = input.nextElementSibling;
    if (!h || !h.classList || !h.classList.contains('date-hint')){
      h = document.createElement('div');
      h.className = 'date-hint small';
      h.style.cssText = 'color:var(--muted);margin-top:3px;font-size:11.5px';
      input.insertAdjacentElement('afterend', h);
    }
    h.textContent = input.value ? '📅 ' + fmtDateLong(input.value) : 'يوم/شهر/سنة';
  }

  function scan(){
    try{
      document.querySelectorAll('input[type="date"]').forEach(inp => {
        if (!inp.__dateHint){
          inp.__dateHint = true;
          inp.addEventListener('input', () => hintFor(inp));
          inp.addEventListener('change', () => hintFor(inp));
          inp.setAttribute('lang','ar-EG');
        }
        hintFor(inp);
      });
    }catch(e){}
  }
  window.refreshDateHints = scan;

  /* بعد أي رسم */
  ['renderContent','renderSysContent','openModal','refreshSortable'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__dateFmt) return;
    const wrapped = function(){
      const r = orig.apply(this, arguments);
      setTimeout(scan, 40);
      return r;
    };
    wrapped.__dateFmt = true;
    window[fn] = wrapped;
  });

  setInterval(scan, 2500);
  setTimeout(scan, 1500);

  console.log('[عمارتنا] صيغة التاريخ موحّدة (يوم/شهر/سنة)');
})();

})();

/* ═══ emartna-paging.js ═══ */
(function(){
/* ============================================================
   عمارتنا — عدد الصفوف المعروضة في كل جدول
   ------------------------------------------------------------
   قائمة منسدلة فوق كل جدول: ١٠ · ٢٠ · ٣٠ · ٥٠ · ١٠٠ · ٢٠٠ · الكل
   مع أزرار تنقّل بين الصفحات.

   الاختيار بيتحفظ لكل جدول على حدة، فالجدول اللي بتشتغل عليه
   كتير بيفتكر عدد الصفوف اللي يريحك.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const KEY = 'emartna_page_size';
  const SIZES = [10, 20, 30, 50, 100, 200, 0];      // ٠ = الكل
  const DEFAULT = 30;
  const MIN_ROWS = 1;                                // القائمة بتظهر دايمًا

  function prefs(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '{}'); }catch(e){ return {}; }
  }
  function savePrefs(p){
    try{ localStorage.setItem(KEY, JSON.stringify(p)); }catch(e){}
  }

  window.tablePageSize = function(id){
    const p = prefs();
    return p[id] !== undefined ? p[id] : DEFAULT;
  };

  window.setTablePageSize = function(id, size){
    const p = prefs();
    p[id] = Number(size);
    savePrefs(p);
    window.__tablePage = window.__tablePage || {};
    window.__tablePage[id] = 1;                      // نرجع لأول صفحة
    if (window.refreshSortable) refreshSortable(id);
    else renderContent();
  };

  window.goTablePage = function(id, page){
    window.__tablePage = window.__tablePage || {};
    window.__tablePage[id] = Math.max(1, Number(page) || 1);
    if (window.refreshSortable) refreshSortable(id);
    else renderContent();
    // نرجّع المستخدم لأول الجدول بعد التنقّل
    setTimeout(() => {
      const el = document.getElementById(id + '_wrap');
      if (el && el.scrollIntoView) el.scrollIntoView({ block:'start', behavior:'smooth' });
    }, 60);
  };

  /* ---------- قصّ الصفوف ---------- */

  const origFiltered = window.getFilteredSortedRows;
  if (origFiltered && !origFiltered.__paged){
    const wrapped = function(tableId){
      const res = origFiltered.apply(this, arguments);
      if (!res || !Array.isArray(res.filtered)) return res;

      const size = tablePageSize(tableId);
      const total = res.filtered.length;

      // نخزّن الإجمالي عشان شريط الترقيم
      window.__tableTotals = window.__tableTotals || {};
      window.__tableTotals[tableId] = total;

      if (!size || total <= size) return res;         // الكل أو أقل من الحد

      window.__tablePage = window.__tablePage || {};
      const pages = Math.ceil(total / size);
      let page = window.__tablePage[tableId] || 1;
      if (page > pages) page = window.__tablePage[tableId] = pages;

      const start = (page - 1) * size;
      return Object.assign({}, res, {
        filtered: res.filtered.slice(start, start + size),
        __total: total, __page: page, __pages: pages,
      });
    };
    wrapped.__paged = true;
    window.getFilteredSortedRows = wrapped;
  }

  /* ---------- شريط التحكم ---------- */

  function bar(tableId){
    const total = (window.__tableTotals || {})[tableId] || 0;
    if (total < MIN_ROWS) return '';
    const tiny = total <= 10;      // جدول صغير: القائمة بس من غير تنقّل

    const size = tablePageSize(tableId);
    const pages = size ? Math.ceil(total / size) : 1;
    const page = Math.min((window.__tablePage || {})[tableId] || 1, pages);
    const from = size ? (page - 1) * size + 1 : 1;
    const to   = size ? Math.min(page * size, total) : total;

    const opt = n => `<option value="${n}" ${size === n ? 'selected' : ''}>${
      n === 0 ? 'الكل' : n + ' صف'}</option>`;

    const btn = (p, label, on) => `<button class="btn sm ${on ? 'ghost' : 'ghost'}"
      ${on ? `onclick="goTablePage('${tableId}',${p})"` : 'disabled style="opacity:.4"'}>${label}</button>`;

    return `
    <div class="flexrow" style="gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 4px">
      <span class="small" style="color:var(--muted)">عرض</span>
      <select onchange="setTablePageSize('${tableId}',this.value)"
        style="padding:4px 8px;border:1px solid var(--line);border-radius:8px;font-size:12.5px">
        ${SIZES.map(opt).join('')}
      </select>
      <span class="small" style="color:var(--muted)">
        ${size && total > size ? `${from} – ${to} من ${total}` : `الكل (${total})`}
      </span>
      ${(pages > 1 && !tiny) ? `
        <span style="flex:1"></span>
        ${btn(1, '⏮️', page > 1)}
        ${btn(page - 1, '‹ السابق', page > 1)}
        <span class="badge n">صفحة ${page} من ${pages}</span>
        ${btn(page + 1, 'التالي ›', page < pages)}
        ${btn(pages, '⏭️', page < pages)}` : ''}
    </div>`;
  }

  /* الشريط بيتحط جوه محتوى الجدول نفسه — مش فوقه.
     لأن التحديث بيعيد رسم المحتوى الداخلي بس، فلو الشريط
     برّه كان هيفضل بأرقام قديمة بعد أي تنقّل. */
  const origInner = window.renderSortableInner;
  if (origInner && !origInner.__pagedUI){
    const wrapped = function(tableId){
      const html = origInner.apply(this, arguments);   // بينادي getFilteredSortedRows
      const b = bar(tableId);                          // فالإجمالي بقى محدّث
      return b ? (b + html) : html;
    };
    wrapped.__pagedUI = true;
    window.renderSortableInner = wrapped;
  }

  /* الفلترة أو البحث بيرجّعوا لأول صفحة */
  ['tableSearchInput','setColFilter','clearColFilter','sortTable'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__pageReset) return;
    const wrapped = function(tableId){
      window.__tablePage = window.__tablePage || {};
      if (tableId) window.__tablePage[tableId] = 1;
      return orig.apply(this, arguments);
    };
    wrapped.__pageReset = true;
    window[fn] = wrapped;
  });

  console.log('[عمارتنا] ترقيم صفحات الجداول جاهز');
})();

})();

/* ═══ emartna-leads.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — تسجيل بيانات اللي بيجرّب + قمع المبيعات
   ------------------------------------------------------------
   قبل ما الزائر يدخل التجربة، بنطلب رقم موبايله (اختياري).
   الرقم بيتسجّل كعميل محتمل مع: كام مرة جرّب · بأي دور ·
   من فين جه · واشترك بعد كده ولا لأ.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const PHONE_KEY = 'emartna_demo_phone';

  const savedPhone = () => { try{ return localStorage.getItem(PHONE_KEY) || ''; }catch(e){ return ''; } };
  const savePhone  = p => { try{ localStorage.setItem(PHONE_KEY, p); }catch(e){} };

  function srcOf(){
    try{
      const p = new URLSearchParams(location.search);
      if (p.get('utm_source')) return { s:p.get('utm_source').toLowerCase(), c:p.get('utm_campaign')||'' };
      if (p.get('fbclid')) return { s:'facebook', c:'fb-click' };
      const r = document.referrer || '';
      if (/facebook|fb\.com|fb\.me/i.test(r)) return { s:'facebook', c:'' };
      if (/google\./i.test(r)) return { s:'google', c:'' };
      if (/wa\.me|whatsapp/i.test(r)) return { s:'whatsapp', c:'' };
      return { s:'direct', c:'' };
    }catch(e){ return { s:'direct', c:'' }; }
  }

  /* تسجيل حدث في تقرير الزيارات (بدون بيانات شخصية) */
  async function ev(event){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const o = srcOf();
      await sb.rpc('record_visit', {
        p_source: o.s, p_campaign: o.c,
        p_landed_on: (location.pathname || '/').slice(0,60),
        p_signup: false, p_event: event,
        p_session: (function(){ try{
          let k = sessionStorage.getItem('emartna_sess_key');
          if (!k){ k = Math.random().toString(36).slice(2) + Date.now().toString(36);
                   sessionStorage.setItem('emartna_sess_key', k); }
          return k; }catch(e){ return null; } })(),
      });
    }catch(e){}
  }

  async function saveLead(phone, name, role, vt){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb || !phone) return;
      const o = srcOf();
      const t = vt || { type: savedType() || null, other: null };
      await sb.rpc('record_demo_lead', {
        p_phone: phone, p_name: name || null, p_role: role || null,
        p_source: o.s, p_campaign: o.c,
        p_visitor_type: t.type || null, p_visitor_other: t.other || null,
      });
    }catch(e){}
  }
  window.saveDemoLead = saveLead;


  /* ---------- نبض الجلسة التجريبية ---------- */

  function sessKey(){
    try{
      let k = sessionStorage.getItem('emartna_sess_key');
      if (!k){ k = Math.random().toString(36).slice(2) + Date.now().toString(36);
               sessionStorage.setItem('emartna_sess_key', k); }
      return k;
    }catch(e){ return null; }
  }

  /* بيسجّل إن الجلسة لسه شغّالة — كل دقيقة أثناء التجربة.
     كده نعرف الزائر قعد قد إيه فعلًا، مش إنه دخل بس. */
  let demoRole = '';
  window.markDemoRole = r => { demoRole = r || ''; };

  setInterval(async () => {
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      if (!(window.isDemoSession && isDemoSession())) return;
      const o = srcOf();
      await sb.rpc('touch_demo_session', {
        p_session: sessKey(), p_phone: savedPhone() || null,
        p_role: demoRole || null, p_source: o.s,
      });
    }catch(e){}
  }, 60 * 1000);

  /* ---------- نافذة طلب الرقم ---------- */

  const NAME_KEY = 'emartna_demo_name';
  const TYPE_KEY = 'emartna_demo_vtype';
  const savedType = () => { try{ return localStorage.getItem(TYPE_KEY) || ''; }catch(e){ return ''; } };
  const saveType  = t => { try{ if(t) localStorage.setItem(TYPE_KEY, t); }catch(e){} };
  const savedName = () => { try{ return localStorage.getItem(NAME_KEY) || ''; }catch(e){ return ''; } };
  const saveName  = n => { try{ if(n) localStorage.setItem(NAME_KEY, n); }catch(e){} };

  window.askPhoneThenDemo = function(role){
    const prev = savedPhone();
    /* عنده رقم واسم = جرّب قبل كده بالكامل، ما نضايقهوش تاني.
       عنده رقم من غير اسم = اتخطّى الاسم أول مرة، فنسأله عنه بس. */
    if (prev && savedName()){
      saveLead(prev, savedName(), role, { type: savedType() || null, other:null });
      return startDemo(role);
    }

    ev('phone_shown');
    openModal(`
      <h3>${role === 'owner' ? '🏠' : '🏢'} تجربة ${role === 'owner' ? 'كصاحب شقة' : 'كرئيس اتحاد'}</h3>
      <p class="small mtop">التجربة مجانية بالكامل ومن غير تسجيل. سيبلنا رقمك عشان
      نقدر نساعدك لو احتجت — <b>مش هنبعتلك أي إعلانات</b>.</p>

      <div class="field2 mtop2"><label>الاسم</label>
        <input id="dlName" placeholder="اسمك" value="${esc2(savedName())}"></div>
      ${window.visitorTypeField ? visitorTypeField('dlType','dlTypeOther', savedType()) : ''}
      <div class="grid g2">
        <div class="field2"><label>مفتاح الدولة</label>
          <input id="dlCC" value="+20" dir="ltr"></div>
        <div class="field2"><label>رقم الموبايل</label>
          <input id="dlPhone" dir="ltr" placeholder="01xxxxxxxxx" inputmode="numeric"
            value="${esc2(prev ? String(prev).replace(/^20/, '0') : '')}"></div>
      </div>

      <button class="btn primary mtop2" style="width:100%;padding:13px;font-size:15px"
        onclick="submitDemoPhone('${role}')">▶️ ابدأ التجربة</button>

      <p class="small mtop" style="text-align:center">
        <button onclick="skipDemoPhone('${role}')"
          style="background:none;border:0;color:var(--muted);cursor:pointer;
                 text-decoration:underline;font-size:12px">
          تخطّي — ادخل من غير رقم</button>
      </p>`, true);
  };

  window.submitDemoPhone = function(role){
    const g = i => (document.getElementById(i) || {}).value || '';
    const cc = g('dlCC').replace(/[^\d+]/g,'') || '+20';
    const ph = g('dlPhone').replace(/[^\d]/g,'');
    if (!ph || ph.length < 8) return showMessage('اكتب رقم موبايل صحيح، أو اضغط "تخطّي"');
    const full = (cc + ph.replace(/^0+/,'')).replace(/[^\d]/g,'');
    savePhone(full);
    const nm = g('dlName').trim();
    saveName(nm);                // عشان ما نسألوش عن الاسم تاني
    const vt = window.readVisitorType ? readVisitorType('dlType','dlTypeOther') : {};
    saveType(vt.type || '');
    saveLead(full, nm, role, vt);
    ev('phone_given');           // حدث مستقل — 'demo' معناه جرّب البرنامج
    ev('demo');
    closeModal();
    setTimeout(() => startDemo(role), 120);
  };

  window.skipDemoPhone = function(role){
    ev('demo_skip');
    closeModal();
    setTimeout(() => startDemo(role), 120);
  };

  function startDemo(role){
    markDemoRole(role);
    // نبضة أولى فورية عشان الجلسة تتسجّل من أول ثانية
    setTimeout(async () => {
      try{
        const sb = window.CLOUD && window.CLOUD._sb;
        if (!sb) return;
        const o = srcOf();
        await sb.rpc('touch_demo_session', {
          p_session: sessKey(), p_phone: savedPhone() || null,
          p_role: role || null, p_source: o.s,
        });
      }catch(e){}
    }, 2500);
    if (typeof window.__origLoginDemo === 'function') return window.__origLoginDemo(role);
    if (typeof window.__origTryDemo === 'function')   return window.__origTryDemo(role);
  }

  /* بنعترض كل مداخل التجربة.
     مهم: أزرار شاشة الدخول بتنادي loginAsDemo مباشرة —
     الاكتفاء بلفّ tryDemoNow كان بيخلّي المدخل ده يعدّي من غير طلب الرقم. */
  function hook(){
    ['loginAsDemo','tryDemoNow'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__leadHook) return;
      if (name === 'loginAsDemo') window.__origLoginDemo = orig;
      else                        window.__origTryDemo   = orig;
      const wrapped = function(role){ return askPhoneThenDemo(role || 'admin'); };
      wrapped.__leadHook = true;
      window[name] = wrapped;
    });
  }
  hook();
  [800, 2000, 4000].forEach(ms => setTimeout(hook, ms));

  /* لما يسجّل حساب فعلًا، بنربطه بالعميل المحتمل */
  ['doSignup','createBuildingFromSignup'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__leadSign) return;
    const wrapped = async function(){
      const r = await orig.apply(this, arguments);
      try{
        const ph = savedPhone();
        const sb = window.CLOUD && window.CLOUD._sb;
        if (ph && sb) await sb.rpc('mark_demo_lead_signed', { p_phone: ph, p_code: null });
      }catch(e){}
      return r;
    };
    wrapped.__leadSign = true;
    window[fn] = wrapped;
  });


  /* ---------- فترة التقرير ---------- */

  const iso = d => d.toISOString().slice(0,10);
  const ago = n => { const d = new Date(); d.setDate(d.getDate()-n+1); return iso(d); };

  window.__leadFrom = window.__leadFrom || ago(30);
  window.__leadTo   = window.__leadTo   || iso(new Date());

  window.leadPreset = function(kind){
    const now = new Date();
    let f, t = iso(now);
    if (kind === 'today')  f = t;
    else if (kind === 'w7')  f = ago(7);
    else if (kind === 'd30') f = ago(30);
    else if (kind === 'd90') f = ago(90);
    else if (kind === 'month') f = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    else if (kind === 'all') f = '2020-01-01';
    window.__leadFrom = f; window.__leadTo = t;
    reloadLeadReports();
  };

  window.applyLeadRange = function(){
    const f = (document.getElementById('lrFrom')||{}).value;
    const t = (document.getElementById('lrTo')||{}).value;
    if (!f || !t) return showMessage('حدد التاريخين');
    if (f > t) return showMessage('تاريخ البداية لازم يكون قبل النهاية');
    window.__leadFrom = f; window.__leadTo = t;
    reloadLeadReports();
  };

  window.activeLeadPreset = function(){
    const f = window.__leadFrom, t = window.__leadTo, today = iso(new Date());
    const now = new Date();
    if (t !== today) return '';
    if (f === today) return 'today';
    if (f === ago(7))  return 'w7';
    if (f === ago(30)) return 'd30';
    if (f === ago(90)) return 'd90';
    if (f === iso(new Date(now.getFullYear(), now.getMonth(), 1))) return 'month';
    if (f === '2020-01-01') return 'all';
    return '';
  };

  window.reloadLeadReports = async function(){
    await loadDemoLeads();
    await loadDemoSessions();
    await loadGateReport();
  };

  function rangeBar(){
    const act = activeLeadPreset();
    const b = (k,l) => `<button class="btn sm ${act===k?'primary':'ghost'}"
      onclick="leadPreset('${k}')">${l}</button>`;
    return `
    <div class="card mtop" style="padding:12px">
      <div class="grid g2">
        <div class="field2"><label>من تاريخ</label>
          <input id="lrFrom" type="date" value="${esc2(window.__leadFrom)}" onchange="applyLeadRange()"></div>
        <div class="field2"><label>إلى تاريخ</label>
          <input id="lrTo" type="date" value="${esc2(window.__leadTo)}" onchange="applyLeadRange()"></div>
      </div>
      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        ${b('today','النهاردة')} ${b('w7','آخر ٧ أيام')} ${b('month','الشهر ده')}
        ${b('d30','آخر ٣٠ يوم')} ${b('d90','آخر ٣ شهور')} ${b('all','كل الفترة')}
        <span style="flex:1"></span>
        <button class="btn sm ghost" onclick="reloadLeadReports()">🔄 تحديث</button>
      </div>
      <p class="small mtop" style="color:var(--muted)">
        الفترة: <b>${esc2(window.__leadFrom)}</b> إلى <b>${esc2(window.__leadTo)}</b></p>
    </div>`;
  }

  /* ============================================================
     شاشة قمع المبيعات — اللي جرّبوا
     ============================================================ */

  window.__demoLeads = null;

  window.loadDemoLeads = async function(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { data, error } = await sb.rpc('demo_leads_range', {
        p_from: window.__leadFrom, p_to: window.__leadTo });
      if (error) throw error;
      window.__demoLeads = data || [];
      window.__demoLeadsErr = null;
    }catch(e){
      window.__demoLeads = [];
      window.__demoLeadsErr = (window.cloudErrorText ? cloudErrorText(e) : e.message);
    }
    if (window.renderSysContent) renderSysContent();
  };

  const LB = { facebook:'📘 فيسبوك', google:'🔍 جوجل', whatsapp:'💬 واتساب',
               instagram:'📸 إنستجرام', direct:'🔗 مباشر' };

  function leadsSection(){
    const rows = window.__demoLeads;
    if (rows === null){
      setTimeout(loadDemoLeads, 30);
      return '<div class="card mtop2"><p class="small">⏳ بيحمّل اللي جرّبوا…</p></div>';
    }

    const total = rows.length;
    const signed = rows.filter(r => r.signed_up).length;
    const repeat = rows.filter(r => (r.tries || 1) > 1).length;

    const cols = [
      { key:'phone', label:'الموبايل', value:r => r.phone||'',
        cell:r => `<a href="https://wa.me/${esc2(r.phone)}" target="_blank" dir="ltr"
          style="font-weight:700">${esc2(r.phone)}</a>` },
      { key:'name', label:'الاسم', value:r => r.name||'',
        cell:r => r.name ? esc2(r.name) : '<span class="small" style="color:var(--muted)">—</span>' },
      { key:'tries', label:'جرّب كام مرة', value:r => r.tries||1,
        cell:r => (r.tries||1) > 1 ? `<span class="badge b">${r.tries} مرات</span>` : '1' },
      { key:'role', label:'جرّب كـ', value:r => r.role_tried||'',
        cell:r => r.role_tried === 'owner' ? '🏠 صاحب شقة'
                : r.role_tried === 'admin' ? '🏢 رئيس اتحاد' : '—' },
      /* نوع الجهة اللي قال عن نفسه إنه هي — بيفرق في المتابعة والتسعير */
      { key:'vtype', label:'نوع الجهة',
        value:r => r.visitor_type || '',
        cell:r => r.visitor_type
          ? esc2(r.visitor_type === 'other' && r.visitor_type_other
              ? r.visitor_type_other
              : (window.visitorTypeLabel ? visitorTypeLabel(r.visitor_type) : r.visitor_type))
          : '<span style="color:var(--muted)">—</span>' },
      { key:'source', label:'المصدر', value:r => r.source||'',
        cell:r => esc2(LB[r.source] || r.source || '—') },
      { key:'first', label:'أول تجربة', value:r => r.first_try_at||'',
        cell:r => window.fmtDate ? fmtDate(String(r.first_try_at).slice(0,10))
                                 : String(r.first_try_at||'').slice(0,10) },
      { key:'last', label:'آخر تجربة', value:r => r.last_try_at||'',
        cell:r => { const d = String(r.last_try_at||'').slice(0,10);
          const days = d ? Math.floor((Date.now()-new Date(d).getTime())/86400000) : null;
          return (window.fmtDate ? fmtDate(d) : d) +
            (days !== null ? `<br><span class="small" style="color:var(--muted)">${
              days===0?'النهاردة':days===1?'إمبارح':'من '+days+' يوم'}</span>` : ''); } },
      { key:'signed', label:'اشترك؟', value:r => r.signed_up ? 1 : 0,
        cell:r => r.signed_up ? '<span class="badge g">✅ اشترك</span>'
                              : '<span class="badge y">لسه</span>' },
      { key:'x', label:'', value:null,
        cell:r => `<div class="flexrow" style="gap:5px">
          <a class="btn sm gold" target="_blank"
            href="https://wa.me/${esc2(r.phone)}?text=${encodeURIComponent(
              'أهلًا' + (r.name ? ' ' + r.name : '') + ' 👋\nشكرًا إنك جرّبت عمارتنا. محتاج مساعدة في أي حاجة؟')}">💬 كلّمه</a>
          <button class="btn sm ghost" title="استبعده من التقارير"
            onclick="toggleLeadInternal('${esc2(r.phone)}',true)">🧪</button>
        </div>` },
    ];

    return `
      <div class="section-title mtop2"><h3>🎬 اللي جرّبوا البرنامج</h3></div>
      <p class="small">كل زائر ساب رقمه قبل التجربة — دول أقرب ناس للاشتراك.
        <a href="javascript:void(0)" onclick="openHiddenLeads()">🧪 المستبعدين</a></p>
      ${rangeBar()}

      <div class="grid g3 mtop">
        <div class="card" style="text-align:center">
          <h3 style="color:var(--accent);margin:2px 0">${total}</h3>
          <p class="small">جرّبوا وسابوا رقم</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${signed}</h3>
          <p class="small">اشتركوا بعدها</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${repeat}</h3>
          <p class="small">رجعوا جرّبوا تاني</p></div>
      </div>

      ${total ? `<div class="mtop">${sortableTable('demoLeadsTable', rows, cols, null,
          { defaultKey:'last', emptyText:'محدش جرّب لسه', exportName:'اللي جرّبوا' })}</div>`
        : `<div class="card mtop"><p class="small">محدش ساب رقمه لسه.</p></div>`}

      ${window.__demoLeadsErr ? `<p class="small mtop" style="color:var(--red)">${esc2(window.__demoLeadsErr)}</p>` : ''}`;
  }


  /* ============================================================
     تقرير: مين ساب رقمه ومين تخطّى
     ============================================================ */

  window.__gateRows = null;

  window.loadGateReport = async function(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { data, error } = await sb.rpc('phone_gate_report', {
        p_from: window.__leadFrom, p_to: window.__leadTo });
      if (error) throw error;
      window.__gateRows = data || [];
    }catch(e){ window.__gateRows = []; }
    if (window.renderSysContent) renderSysContent();
  };

  function gateSection(){
    const rows = window.__gateRows;
    if (rows === null){
      setTimeout(loadGateReport, 30);
      return '';
    }
    const S = k => rows.reduce((a,r) => a + Number(r[k]||0), 0);
    const shown = S('shown'), gave = S('gave_phone'), skip = S('skipped');
    if (!shown && !gave && !skip) return '';

    const pct = (a,b) => b ? Math.round(a/b*100) : 0;

    /* حسب المصدر */
    const by = {};
    rows.forEach(r => {
      const k = r.source || 'direct';
      by[k] = by[k] || { source:k, shown:0, gave:0, skip:0 };
      by[k].shown += Number(r.shown||0);
      by[k].gave  += Number(r.gave_phone||0);
      by[k].skip  += Number(r.skipped||0);
    });
    const list = Object.values(by).sort((a,b) => b.shown - a.shown);

    const cols = [
      { key:'src', label:'المصدر', value:r => LB[r.source] || r.source,
        cell:r => esc2(LB[r.source] || r.source || '—') },
      { key:'shown', label:'اتعرض عليهم', value:r => r.shown, cell:r => String(r.shown) },
      { key:'gave', label:'✅ سابوا رقم', value:r => r.gave,
        cell:r => r.gave ? `<span class="badge g">${r.gave}</span>` : '0' },
      { key:'skip', label:'⏭️ تخطّوا', value:r => r.skip,
        cell:r => r.skip ? `<span class="badge y">${r.skip}</span>` : '0' },
      { key:'rate', label:'نسبة الاستجابة', value:r => pct(r.gave, r.shown),
        cell:r => `<span class="badge ${pct(r.gave,r.shown)>=50?'g':pct(r.gave,r.shown)>=25?'y':'r'}">${
          pct(r.gave, r.shown)}%</span>` },
    ];

    const rate = pct(gave, shown);
    const advice = !shown ? ''
      : rate >= 60 ? '👍 نسبة ممتازة — الطلب مش بيزعّل حد.'
      : rate >= 35 ? '🙂 نسبة معقولة. جرّب تختصر النص أو تشيل خانة الاسم.'
      : '⚠️ أغلب الزوّار بيتخطّوا. فكّر تطلب الرقم <b>بعد</b> التجربة مش قبلها.';

    return `
      <div class="section-title mtop2"><h3>📱 طلب رقم الموبايل</h3></div>
      <p class="small">كام واحد اتعرض عليه الطلب، ومين ساب رقمه ومين تخطّى.</p>

      <div class="grid g3 mtop">
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${shown}</h3>
          <p class="small">اتعرض عليهم الطلب</p></div>
        <div class="card" style="text-align:center">
          <h3 style="color:var(--accent);margin:2px 0">${gave}</h3>
          <p class="small">سابوا رقمهم (${pct(gave, shown)}%)</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${skip}</h3>
          <p class="small">تخطّوا وكمّلوا (${pct(skip, shown)}%)</p></div>
      </div>

      ${advice ? `<div class="card mtop" style="border-inline-start:4px solid var(--gold)">
        <p class="small">${advice}</p></div>` : ''}

      <div class="mtop">${sortableTable('gateTable', list, cols, null,
        { defaultKey:'shown', emptyText:'مفيش بيانات', exportName:'طلب رقم الموبايل' })}</div>

      <p class="small mtop" style="color:var(--muted)">
        ℹ️ اللي تخطّى بيدخل التجربة عادي — إحنا بس بنعرف إنه رفض يسيب رقمه.
        مفيش أي بيانات شخصية بتتسجّل عنه.
      </p>`;
  }



  /* تعليم سجل كداخلي (اختبار) أو رجوعه لعميل حقيقي */
  window.toggleLeadInternal = async function(phone, on){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { error } = await sb.from('demo_leads')
        .update({ is_internal: !!on }).eq('phone', phone);
      if (error) throw error;
      if (window.toast) toast(on ? 'اتعلّم كاختبار — مش هيظهر في التقارير'
                                 : 'رجع كعميل حقيقي');
      await reloadLeadReports();
    }catch(e){
      showMessage('تعذّر التعديل: ' + (window.cloudErrorText ? cloudErrorText(e) : e.message));
    }
  };

  window.openHiddenLeads = async function(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      const { data } = await sb.from('demo_leads')
        .select('*').eq('is_internal', true).order('last_try_at', { ascending:false });
      const rows = data || [];
      openModal(`
        <h3>🧪 سجلات مستبعدة من التقارير</h3>
        <p class="small mtop">دي تجاربك واختباراتك — مستبعدة عشان ماتلخبطش الأرقام.
        تقدر ترجّع أي واحد لو كان عميل حقيقي بالغلط.</p>
        ${rows.length ? rows.map(r => `
          <div class="flexrow" style="padding:8px 0;border-bottom:1px dashed var(--line);
               justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div>
              <b dir="ltr">${esc2(r.phone)}</b>
              ${r.name ? `<span class="small"> · ${esc2(r.name)}</span>` : ''}
              <div class="small" style="color:var(--muted)">
                ${r.tries} محاولة · ${esc2(LB[r.source] || r.source || '')}</div>
            </div>
            <button class="btn sm ghost" onclick="toggleLeadInternal('${esc2(r.phone)}',false)">
              ↩️ رجّعه للتقارير</button>
          </div>`).join('')
          : '<p class="small mtop">مفيش سجلات مستبعدة.</p>'}
        <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
    }catch(e){ showMessage('تعذّر التحميل'); }
  };

  /* ============================================================
     كل الجلسات التجريبية — بالرقم ومن غيره
     ============================================================ */

  window.__demoSess = null;

  window.loadDemoSessions = async function(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { data, error } = await sb.rpc('demo_sessions_report',
        { p_from: window.__leadFrom, p_to: window.__leadTo });
      if (error) throw error;
      window.__demoSess = data || [];
    }catch(e){ window.__demoSess = []; }
    if (window.renderSysContent) renderSysContent();
  };

  function sessionsSection(){
    const rows = window.__demoSess;
    if (rows === null){ setTimeout(loadDemoSessions, 30); return ''; }
    if (!rows.length) return '';

    const total = rows.length;
    const withPhone = rows.filter(r => r.gave_phone).length;
    const mins = rows.reduce((a,r) => a + (Number(r.minutes)||0), 0);
    const avg = total ? Math.round(mins/total) : 0;
    const serious = rows.filter(r => (Number(r.minutes)||0) >= 3).length;

    const cols = [
      { key:'when', label:'بدأ', value:r => r.started_at||'',
        cell:r => { const d = new Date(r.started_at);
          return (window.fmtDate ? fmtDate(r.started_at.slice(0,10)) : r.started_at.slice(0,10)) +
            `<br><span class="small" style="color:var(--muted)">${
              String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</span>`; } },
      { key:'mins', label:'قعد قد إيه', value:r => Number(r.minutes)||0,
        cell:r => { const m = Number(r.minutes)||0;
          const cls = m >= 5 ? 'g' : m >= 2 ? 'y' : 'n';
          return `<span class="badge ${cls}">${m < 1 ? 'أقل من دقيقة' : m + ' دقيقة'}</span>`; } },
      { key:'role', label:'جرّب كـ', value:r => r.role_tried||'',
        cell:r => r.role_tried === 'owner' ? '🏠 صاحب شقة'
                : r.role_tried === 'admin' ? '🏢 رئيس اتحاد' : '—' },
      /* نوع الجهة اللي قال عن نفسه إنه هي — بيفرق في المتابعة والتسعير */
      { key:'vtype', label:'نوع الجهة',
        value:r => r.visitor_type || '',
        cell:r => r.visitor_type
          ? esc2(r.visitor_type === 'other' && r.visitor_type_other
              ? r.visitor_type_other
              : (window.visitorTypeLabel ? visitorTypeLabel(r.visitor_type) : r.visitor_type))
          : '<span style="color:var(--muted)">—</span>' },
      { key:'source', label:'المصدر', value:r => r.source||'',
        cell:r => esc2(LB[r.source] || r.source || '—') },
      { key:'phone', label:'الموبايل', value:r => r.phone||'',
        cell:r => r.phone
          ? `<a href="https://wa.me/${esc2(r.phone)}" target="_blank" dir="ltr"
               style="font-weight:700">${esc2(r.phone)}</a>`
          : '<span class="badge n">مساب رقمش</span>' },
      { key:'x', label:'', value:null,
        cell:r => r.phone
          ? `<a class="btn sm gold" target="_blank" href="https://wa.me/${esc2(r.phone)}?text=${
              encodeURIComponent('أهلًا 👋\nشكرًا إنك جرّبت عمارتنا. محتاج مساعدة؟')}">💬 كلّمه</a>`
          : '' },
    ];

    return `
      <div class="section-title mtop2"><h3>⏱️ جلسات التجربة</h3></div>
      <p class="small">كل زائر فتح التجربة — بالرقم أو من غيره — وقعد قد إيه فعلًا.</p>

      <div class="grid g4 mtop">
        <div class="card" style="text-align:center">
          <h3 style="color:var(--accent);margin:2px 0">${total}</h3>
          <p class="small">جلسة تجربة</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${withPhone}</h3>
          <p class="small">سابوا رقم</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${serious}</h3>
          <p class="small">قعدوا ٣ دقايق+</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${avg}</h3>
          <p class="small">متوسط الدقايق</p></div>
      </div>

      <div class="mtop">${sortableTable('demoSessTable', rows, cols, null,
        { defaultKey:'when', emptyText:'مفيش جلسات', exportName:'جلسات التجربة' })}</div>

      <p class="small mtop" style="color:var(--muted)">
        ℹ️ اللي قعد أقل من دقيقة غالبًا فتح وقفل. واللي قعد ٥ دقايق+ شاف البرنامج فعلًا —
        ودول أولى بالمتابعة حتى لو مسابوش رقم.
      </p>`;
  }

  const origPipe = window.pageSysPipeline;
  if (typeof origPipe === 'function' && !origPipe.__leads){
    const wrapped = function(){
      return origPipe.apply(this, arguments) + leadsSection() + sessionsSection() + gateSection();
    };
    wrapped.__leads = true;
    window.pageSysPipeline = wrapped;
  }

  console.log('[عمارتنا] تسجيل اللي بيجرّبوا جاهز');
})();

})();

/* ═══ emartna-live.js ═══ */
(function(){
/* ============================================================
   عمارتنا — مين بيجرّب البرنامج دلوقتي
   ------------------------------------------------------------
   مؤشر مباشر لصاحب البرنامج: كام زائر فاتح تجربة في اللحظة دي،
   بدأ من إمتى، وباقي قد إيه على انتهاء جلسته.

   بيتحدّث كل ٣٠ ثانية، وبيظهر في:
     • شريط أعلى الشاشة (لو في حد بيجرّب دلوقتي)
     • بطاقة تفصيلية في "كل العمارات"
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  window.__liveDemos = null;
  let timer = null;

  async function load(silent){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      if (!(window.isSysOwner && isSysOwner())){
        window.__liveDemos = [];      // مش صاحب برنامج → نفضّي ونشيل الشريط
        renderPill();
        return;
      }
      const { data, error } = await sb.rpc('live_demo_sessions');
      if (error) throw error;
      const before = (window.__liveDemos || []).length;
      window.__liveDemos = data || [];
      renderPill();
      if (!silent && before !== window.__liveDemos.length && window.renderSysContent)
        renderSysContent();
    }catch(e){ window.__liveDemos = window.__liveDemos || []; }
  }
  window.loadLiveDemos = load;

  /* ---------- الشريط العلوي ---------- */

  function renderPill(){
    try{
      const n = (window.__liveDemos || []).length;
      let el = document.getElementById('liveDemoPill');
      if (!n || !(window.isSysOwner && isSysOwner())){ if (el) el.remove(); return; }

      if (!el){
        el = document.createElement('button');
        el.id = 'liveDemoPill';
        el.onclick = () => openLiveDemos();
        el.style.cssText = 'position:fixed;top:12px;inset-inline-start:14px;z-index:9300;' +
          'background:#16a34a;color:#fff;border:0;border-radius:22px;padding:8px 15px;' +
          'font:700 13px system-ui;cursor:pointer;direction:rtl;' +
          'box-shadow:0 4px 16px rgba(22,163,74,.35)';
        document.body.appendChild(el);
      }
      el.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;
        background:#fff;margin-inline-end:6px;animation:pulse 1.6s infinite"></span>
        ${n} ${n === 1 ? 'زائر بيجرّب دلوقتي' : 'زوّار بيجرّبوا دلوقتي'}`;

      if (!document.getElementById('liveDemoCss')){
        const st = document.createElement('style');
        st.id = 'liveDemoCss';
        st.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}';
        document.head.appendChild(st);
      }
    }catch(e){}
  }

  /* ---------- نافذة التفاصيل ---------- */

  const roleLabel = r => r === 'owner' ? '🏠 صاحب شقة'
                     : r === 'admin' ? '🏢 رئيس اتحاد' : '—';

  window.openLiveDemos = function(){
    const rows = window.__liveDemos || [];
    openModal(`
      <h3>🟢 بيجرّبوا دلوقتي</h3>
      <p class="small mtop">جلسات التجربة المفتوحة في اللحظة دي. الجلسة بتفضل شغّالة
      طول ما الزائر مستخدم، وبتتقفل تلقائيًا بعد نص ساعة من آخر نشاط.</p>

      ${rows.length ? `<div class="mtop2">${rows.map(r => {
        const mins = Math.max(0, Number(r.minutes_left) || 0);
        const since = Math.round((Date.now() - new Date(r.started_at).getTime())/60000);
        return `
        <div class="card" style="border-inline-start:4px solid #16a34a">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
            <b>${roleLabel(r.role_tried)}</b>
            <span class="badge g">🟢 نشط</span>
          </div>
          <p class="small mtop">
            بدأ من ${since < 1 ? 'أقل من دقيقة' : since + ' دقيقة'} ·
            ${r.units} وحدة · ${r.moves} حركة في الجلسة
          </p>
          <p class="small" style="color:var(--muted)">
            الكود: ${esc2(r.code)} · باقي ${mins} دقيقة على انتهاء الجلسة
          </p>
        </div>`;
      }).join('')}</div>`
      : `<div class="card mtop2" style="text-align:center">
           <p class="small">مفيش حد بيجرّب دلوقتي.</p>
         </div>`}

      <div class="modal-actions">
        <button class="btn ghost" onclick="loadLiveDemos();setTimeout(()=>{closeModal();openLiveDemos();},400)">🔄 تحديث</button>
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  /* ---------- بطاقة في شاشة كل العمارات ---------- */

  const origDash = window.pageSysDashboard;
  if (typeof origDash === 'function' && !origDash.__live){
    const wrapped = function(){
      const rows = window.__liveDemos;
      const html = origDash.apply(this, arguments);
      if (rows === null){ setTimeout(() => load(true), 30); return html; }
      if (!rows.length) return html;

      const card = `
        <div class="card" style="border:1.5px solid #16a34a;
             background:linear-gradient(135deg,rgba(22,163,74,.08),transparent)">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <b style="color:#16a34a">🟢 ${rows.length} ${rows.length === 1
                ? 'زائر بيجرّب البرنامج دلوقتي' : 'زوّار بيجرّبوا البرنامج دلوقتي'}</b>
              <div class="small" style="color:var(--muted);margin-top:3px">
                ${rows.map(r => roleLabel(r.role_tried)).join(' · ')}
              </div>
            </div>
            <button class="btn sm primary" onclick="openLiveDemos()">شوف التفاصيل</button>
          </div>
        </div>`;
      return card + html;
    };
    wrapped.__live = true;
    window.pageSysDashboard = wrapped;
  }

  /* التشغيل: كل ٣٠ ثانية لصاحب البرنامج بس */
  function start(){
    if (timer) return;
    timer = setInterval(() => {
      if (window.isSysOwner && isSysOwner()) load(false);
      else { window.__liveDemos = null; renderPill(); }
    }, 30000);
  }

  let tries = 0;
  const t = setInterval(() => {
    if (++tries > 200) return clearInterval(t);
    if (window.CLOUD && window.CLOUD._sb){
      clearInterval(t);
      start();
      setTimeout(() => load(true), 1500);
    }
  }, 200);

  console.log('[عمارتنا] مؤشر التجارب المباشرة جاهز');
})();

})();

/* ═══ emartna-wa.js ═══ */
(function(){
/* ============================================================
   عمارتنا — إصلاح روابط واتساب
   ------------------------------------------------------------
   المشكلة: بعض الروابط كانت بتتبني من حقول مش موجودة في الكائن
   اللي اتبعت (اختلاف أسماء بين سجل العمارة وصف الجدول)، فالنتيجة
   رابط فيه "undefined" وواتساب يقول "المستخدم غير موجود".

   الحل هنا:
     • دالة موحّدة بتدوّر على الرقم في كل الأسماء المحتملة
     • إعادة بناء رسالة التجديد بالبيانات الصح
     • حارس بيفحص أي رابط واتساب قبل ما يتفتح، ولو الرقم ناقص
       بيقول للمستخدم بدل ما يوديه لصفحة خطأ
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* ---------- تطبيع الرقم ---------- */

  const CC_FIELDS = ['contactPhoneCountry','phoneCountry','adminPhoneCountryRaw',
                     'adminPhoneCountry','countryCode','cc'];
  const PH_FIELDS = ['contactPhone','phone','adminPhoneRaw','adminPhone',
                     'mobile','whatsapp','whatsappNumber'];

  /* بيرجّع رقم صالح لواتساب أو '' */
  window.waNumber = function(obj, extra){
    if (!obj) return '';
    if (typeof obj === 'string') return clean(obj);

    let cc = '', ph = '';
    for (const k of CC_FIELDS) if (obj[k]){ cc = String(obj[k]); break; }
    for (const k of PH_FIELDS) if (obj[k]){ ph = String(obj[k]); break; }

    // البحث في الكائنات الجوّة (زي license أو admin)
    if (!ph && extra) for (const o of [].concat(extra)){
      if (!o) continue;
      for (const k of PH_FIELDS) if (o[k]){ ph = String(o[k]); break; }
      if (ph){ for (const k of CC_FIELDS) if (o[k]){ cc = String(o[k]); break; } break; }
    }
    if (!ph) return '';
    return join(cc, ph);
  };

  /* دمج مفتاح الدولة مع الرقم المحلي.
     مهم: الصفر اللي في أول الرقم المحلي لازم يتشال قبل الدمج،
     وإلا الرقم بيطلع بخانة زيادة وواتساب يرفضه. */
  function join(cc, ph){
    let c = String(cc || '').replace(/[^\d]/g,'');
    let p = String(ph || '').replace(/[^\d]/g,'');
    if (c.startsWith('00')) c = c.slice(2);
    if (!p) return '';

    if (c){
      if (p.startsWith(c) && p.length > c.length + 6) return p;   // الرقم كامل أصلًا
      p = p.replace(/^0+/, '');
      return (c + p).length >= 8 ? c + p : '';
    }
    return clean(p);
  }

  function clean(v){
    let n = String(v || '').replace(/[^\d]/g,'');
    if (!n) return '';
    if (n.startsWith('00')) n = n.slice(2);
    // رقم مصري محلي (01xxxxxxxxx) → 20 + الرقم بدون الصفر
    if (/^01\d{9}$/.test(n)) n = '20' + n.slice(1);
    return n.length >= 8 ? n : '';
  }

  window.waLink = function(number, text){
    const n = clean(number);
    if (!n) return '';
    return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  /* ---------- رسالة التجديد ---------- */

  const origRenewal = window.renewalWhatsAppLink;
  window.renewalWhatsAppLink = function(b){
    if (!b) return '';
    const lic = (window.ensureLicense && b.id && window.REG) ? ensureLicense(b) : (b.license || {});
    const num = waNumber(b, [lic, b.admin]);
    if (!num) return '';

    const plan = b.planLabel || b.plan ||
      (window.planName ? planName(lic.plan || b.planKey) : (lic.plan || ''));
    const end  = b.endDateRaw || lic.endDate || b.endDate || '';
    const endTxt = end
      ? 'هينتهي بتاريخ ' + (window.fmtDate ? fmtDate(String(end).slice(0,10)) : String(end).slice(0,10))
      : 'يحتاج مراجعة';

    const name = b.name || 'عمارتك';
    const msg = `عزيزي رئيس اتحاد "${name}"،\n` +
      `اشتراكك في نظام عمارتنا${plan ? ' (' + plan + ')' : ''} ${endTxt}.\n` +
      `برجاء التواصل لتجديد الاشتراك أو الترقية.`;
    return waLink(num, msg);
  };

  /* ---------- الحارس: مفيش رابط مكسور ---------- */

  function badLink(href){
    if (!href || href.indexOf('wa.me') < 0) return false;
    if (/wa\.me\/(undefined|null|NaN)/i.test(href)) return true;
    const m = href.match(/wa\.me\/([^?#]*)/);
    if (!m) return false;
    const num = m[1].replace(/[^\d]/g,'');
    // wa.me/?text= (من غير رقم) مسموح — بيفتح قائمة جهات الاتصال
    if (m[1] === '' ) return false;
    return num.length < 8;
  }

  document.addEventListener('click', e => {
    try{
      const a = e.target.closest && e.target.closest('a[href*="wa.me"]');
      if (!a) return;
      if (!badLink(a.getAttribute('href'))) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.showMessage)
        showMessage('مفيش رقم موبايل مسجّل للجهة دي.\n\nضيف الرقم الأول من بيانات التواصل، وبعدين جرّب تاني.');
    }catch(ex){}
  }, true);

  /* بنعلّم الروابط المكسورة عشان تبان مقفولة */
  function markBroken(){
    try{
      document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
        const bad = badLink(a.getAttribute('href'));
        a.style.opacity = bad ? '.45' : '';
        a.style.cursor  = bad ? 'not-allowed' : '';
        if (bad && !a.title) a.title = 'مفيش رقم موبايل مسجّل';
      });
    }catch(e){}
  }
  ['renderContent','renderSysContent','openModal','refreshSortable'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__waGuard) return;
    const wrapped = function(){
      const r = orig.apply(this, arguments);
      setTimeout(markBroken, 60);
      return r;
    };
    wrapped.__waGuard = true;
    window[fn] = wrapped;
  });
  setInterval(markBroken, 4000);

  console.log('[عمارتنا] روابط واتساب اتظبطت');
})();

})();

/* ═══ emartna-mobile.js ═══ */
(function(){
/* ============================================================
   عمارتنا — عرض الجداول على الموبايل
   ------------------------------------------------------------
   الجدول العريض على شاشة ضيّقة بيتقص وبيحتاج سحب يمين وشمال.
   على الموبايل بنحوّل كل صف لكارت: أول عمودين عنوان الكارت،
   والباقي بيان تحت التاني — من غير أي سحب.

   بيشتغل تلقائيًا تحت ٧٦٨ بكسل، والمستخدم يقدر يرجّع الجدول.
   ============================================================ */

(function(){
  'use strict';

  const KEY = 'emartna_mobile_cards';
  const isNarrow = () => window.innerWidth <= 768;

  function cardsOn(){
    try{
      const v = localStorage.getItem(KEY);
      if (v === '0') return false;
      if (v === '1') return true;
    }catch(e){}
    return isNarrow();                 // الافتراضي: كروت على الموبايل
  }

  window.toggleMobileCards = function(){
    try{ localStorage.setItem(KEY, cardsOn() ? '0' : '1'); }catch(e){}
    apply(true);
    if (window.toast) toast(cardsOn() ? 'عرض كروت' : 'عرض جدول');
  };

  /* زرار التبديل بين الكروت والجدول — في شريط أدوات كل جدول.
     ⚠️ كان بيتغلّف مرتين (فورًا + بعد ٢.٥ ثانية)، وكل نسخة بتحط
     العلامة على نفسها مش على الأصلية — فالحارس مابيمنعش التكرار
     والزرار كان بيتضاعف ٣ مرات في الشريط. */
  function installToggle(){
    const orig = window.sortableTable;
    if (typeof orig !== 'function') return false;
    if (orig.__mobBtn) return true;                 // اتغلّفت خلاص

    const wrapped = function(){
      const html = orig.apply(this, arguments);
      if (!isNarrow() || typeof html !== 'string') return html;
      /* فحص مزدوج: الأصلية ممكن تكون اتغلّفت من وحدة تانية بعدنا
         فالناتج يمرّ علينا مرتين. */
      if (html.indexOf('data-mob-toggle') >= 0) return html;
      if (html.indexOf('m-toggle') >= 0) return html;
      if (html.indexOf('toggleMobileCards()') >= 0) return html;
      const btn = `<button class="btn sm ghost" data-mob-toggle
        onclick="toggleMobileCards()" title="تبديل بين الكروت والجدول">${
        cardsOn() ? '📋 جدول' : '🔲 كروت'}</button>`;
      /* الشريط اتغيّر: الأزرار اتجمّعت في زرار ⋯ — بنحط زرارنا قبله */
      const anchor = '<button class="btn sm ghost tbl-menu-btn"';
      if (html.indexOf(anchor) >= 0) return html.replace(anchor, btn + anchor);
      return html.replace('طباعة</button>', 'طباعة</button>' + btn);
    };
    wrapped.__mobBtn = true;
    window.sortableTable = wrapped;
    return true;
  }
  if (!installToggle()) setTimeout(installToggle, 2500);

  /* ---------- التحويل ---------- */

  function convert(wrap){
    const table = wrap.querySelector('.table-wrap table');
    if (!table) return;

    const heads = [...table.querySelectorAll('thead th')].map(th => {
      const c = th.cloneNode(true);
      [...c.querySelectorAll('.col-resize-handle,.sort-ic')].forEach(x => x.remove());
      return c.textContent.replace(/[🔍▲▼]/g,'').trim();
    });

    const rows = [...table.querySelectorAll('tbody tr')];
    if (!rows.length || rows[0].children.length < 3) return;

    const box = document.createElement('div');
    box.className = 'm-cards';

    rows.forEach(tr => {
      const tds = [...tr.children];
      if (tds.length < 2) return;

      // آخر عمود غالبًا أزرار — بيروح لتحت
      const lastIsActions = !heads[tds.length-1] || /إجراء|أدوات/.test(heads[tds.length-1] || '') ||
                            tds[tds.length-1].querySelector('button,a');

      const card = document.createElement('div');
      card.className = 'm-card';

      const head = document.createElement('div');
      head.className = 'm-card-head';
      // العمود الأول هو المعرّف الأساسي (رقم الوحدة/الاسم)،
      // والتاني وصف مساعد — بنفصلهم بنقطة عشان مايلزقوش ببعض.
      head.innerHTML = `<b>${tds[0].innerHTML}</b>` +
        (tds[1] && tds[1].textContent.trim() && tds[1].textContent.trim() !== '—'
          ? `<span class="m-card-sub">· ${tds[1].innerHTML}</span>` : '');
      card.appendChild(head);

      const body = document.createElement('div');
      body.className = 'm-card-body';
      const end = lastIsActions ? tds.length - 1 : tds.length;
      for (let i = 2; i < end; i++){
        const txt = tds[i].textContent.trim();
        // نخفي الفاضي بكل أشكاله عشان الكارت مايطولش من غير فايدة
        if (!txt || ['—','-','–','0','undefined','null'].includes(txt)) continue;
        const row = document.createElement('div');
        row.className = 'm-row';
        row.innerHTML = `<span class="m-lbl">${heads[i] || ''}</span>` +
                        `<span class="m-val">${tds[i].innerHTML}</span>`;
        body.appendChild(row);
      }
      if (body.children.length) card.appendChild(body);

      if (lastIsActions && tds[tds.length-1]){
        const act = document.createElement('div');
        act.className = 'm-card-act';
        act.innerHTML = tds[tds.length-1].innerHTML;
        card.appendChild(act);
      }
      box.appendChild(card);
    });

    if (!box.children.length) return;
    wrap.querySelector('.table-wrap').style.display = 'none';
    const old = wrap.querySelector('.m-cards');
    if (old) old.remove();
    wrap.querySelector('.table-wrap').insertAdjacentElement('afterend', box);
  }

  function restore(wrap){
    const box = wrap.querySelector('.m-cards');
    if (box) box.remove();
    const tw = wrap.querySelector('.table-wrap');
    if (tw) tw.style.display = '';
  }

  function apply(force){
    try{
      const on = cardsOn() && isNarrow();
      document.querySelectorAll('[id$="_wrap"]').forEach(wrap => {
        if (!wrap.querySelector('.table-wrap')) return;
        if (on){
          if (force || !wrap.querySelector('.m-cards')) convert(wrap);
        } else restore(wrap);
      });
      markToggle();
    }catch(e){}
  }
  window.applyMobileCards = apply;

  /* زرار التبديل في شريط أدوات الجدول */
  function markToggle(){
    if (!isNarrow()) {
      document.querySelectorAll('.m-toggle').forEach(b => b.remove());
      return;
    }
    document.querySelectorAll('.table-toolbar').forEach(tb => {
      /* ⚠️ فيه آليتان بتضيفوا نفس الزرار: تغليف دالة الرسم
         (data-mob-toggle) والحقن المباشر (m-toggle). كل واحدة كانت
         بتفحص علامتها هي بس، فالزرار كان بيتكرر.
         دلوقتي بنفحص الاتنين. */
      if (tb.querySelector('.m-toggle')) return;
      if (tb.querySelector('[data-mob-toggle]')) return;
      const b = document.createElement('button');
      b.className = 'btn sm ghost m-toggle';
      b.textContent = cardsOn() ? '📋 جدول' : '🔲 كروت';
      b.onclick = () => toggleMobileCards();
      tb.appendChild(b);
    });
  }

  /* ---------- التنسيق ---------- */

  function css(){
    if (document.getElementById('mCardsCss')) return;
    const st = document.createElement('style');
    st.id = 'mCardsCss';
    st.textContent = `
      .m-cards{ display:flex; flex-direction:column; gap:9px; margin-top:6px }
      .m-card{ border:1px solid var(--line); border-radius:13px; background:var(--panel);
               padding:11px 13px; box-shadow:0 1px 3px rgba(0,0,0,.05) }
      .m-card-head{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;
                    padding-bottom:8px; border-bottom:1px solid var(--line) }
      .m-card-head b{ font-size:15px }
      .m-card-sub{ font-size:12.5px; color:var(--muted) }
      .m-card-body{ padding-top:7px }
      .m-row{ display:flex; justify-content:space-between; align-items:center;
              gap:10px; padding:4px 0; font-size:13px }
      .m-lbl{ color:var(--muted); font-size:12px; white-space:nowrap }
      .m-val{ text-align:end; font-weight:600 }
      .m-card-act{ display:flex; gap:6px; flex-wrap:wrap; margin-top:9px;
                   padding-top:9px; border-top:1px solid var(--line) }
      .m-card-act .btn, .m-card-act a{ flex:1; min-width:88px; text-align:center }

      @media (max-width:768px){
        .table-toolbar{ flex-wrap:wrap; gap:6px }
        .m-cards .badge{ font-size:11.5px }
      }`;
    document.head.appendChild(st);
  }

  /* التشغيل بعد أي رسم */
  ['renderContent','renderSysContent','refreshSortable','openModal'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__mCards) return;
    const wrapped = function(){
      const r = orig.apply(this, arguments);
      setTimeout(() => { css(); apply(true); }, 70);
      return r;
    };
    wrapped.__mCards = true;
    window[fn] = wrapped;
  });

  window.addEventListener('resize', () => setTimeout(() => apply(true), 200));
  setTimeout(() => { css(); apply(true); }, 1500);
  setInterval(() => { if (isNarrow()) apply(false); }, 3000);

  console.log('[عمارتنا] عرض الجداول على الموبايل جاهز');
})();

})();

/* ═══ emartna-numbering.js ═══ */
(function(){
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

})();

/* ═══ emartna-facade.js ═══ */
(function(){
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
  /* رقم الباب الفعلي — من غير ما تحتاج ترتيب الوحدة في الدور.
     بيتحسب من قائمة وحدات نفس الدور، فينفع يتنادى من أي شاشة. */
  window.doorNumber = function(a){
    try{
      if (!a) return '-';
      if (a.label && String(a.label).trim()) return String(a.label).trim();
      const same = (window.D && D.apartments || [])
        .filter(x => String(x.floor||'') === String(a.floor||'')
                  && (a.blockName ? x.blockName === a.blockName : !x.blockName))
        .sort((x,y) => (x.number||0) - (y.number||0));
      const idx = same.findIndex(x => x.id === a.id) + 1;
      return facadeUnitNumber(a, idx > 0 ? idx : 1);
    }catch(e){ return a && a.number != null ? String(a.number) : '-'; }
  };

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

})();

/* ═══ emartna-pricing.js ═══ */
(function(){
/* ============================================================
   عمارتنا — التسعير بالشرائح + حاسبة السعر
   ------------------------------------------------------------
   السعر بيتحدد من عدد وحدات العمارة:
     حتى ٢٤ وحدة  →  ٣٠ ج شهريًا  ·  ٣٠٠ ج سنويًا
     أكتر من ٢٤   →  ٤٠ ج شهريًا  ·  ٤٠٠ ج سنويًا
   والسنوي فيه شهرين مجانًا.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* ⚠️ الأسعار كانت مكتوبة في الكود، فأي تعديل من شاشة الخطط
     ما كانش بيبان في الحاسبة ولا الصفحة الرئيسية.
     دلوقتي بتتقرا من الباقات المسجّلة. */
  const FALLBACK = {
    monthly: [{ upTo:24, price:30 },  { upTo:null, price:40 }],
    yearly:  [{ upTo:24, price:300 }, { upTo:null, price:400 }],
  };

  function planOf(key){
    try{
      const list = (window.ensurePlans ? ensurePlans() : (window.REG && REG.plans)) || [];
      return list.find(p => p.key === key && p.active !== false) || null;
    }catch(e){ return null; }
  }

  /* شرائح الخطة: من features.tiers لو متسجّلة، وإلا سعر الخطة نفسه */
  function tiersOf(key){
    const p = planOf(key);
    if (p){
      const t = p.features && p.features.tiers;
      if (Array.isArray(t) && t.length)
        return t.map(x => ({ upTo: x.upTo ?? null, price: Number(x.price) || 0 }));
      const price = Number(p.priceBefore ?? p.price) || 0;
      if (price) return [{ upTo:null, price }];      // سعر موحّد
    }
    return FALLBACK[key] || [];
  }
  window.planTiers = tiersOf;

  const TIERS = new Proxy({}, { get: (_, k) => tiersOf(String(k)) });


  /* صفوف جدول الأسعار — من الباقات مباشرة */
  function priceRows(){
    const m = tiersOf('monthly'), y = tiersOf('yearly');
    return m.map((t, i) => {
      const label = t.upTo === null
        ? (m.length === 1 ? 'أي عدد وحدات' : `أكتر من ${m[i-1] ? m[i-1].upTo : 0} وحدة`)
        : `حتى ${t.upTo} وحدة`;
      const yr = (y[i] && y[i].price) || (y[y.length-1] && y[y.length-1].price) || '';
      return [label, t.price, yr];
    });
  }
  window.priceRows = priceRows;

  /* أقل سعر شهري — للشرائط الدعائية */
  window.lowestPrice = function(){
    const m = tiersOf('monthly').map(t => t.price).filter(Boolean);
    return m.length ? Math.min(...m) : 30;
  };

  /* سعر الخطة حسب عدد الوحدات */
  window.planPriceFor = function(planKey, units){
    const n = Number(units) || 0;
    const t = TIERS[planKey];
    if (!t) return null;
    for (const s of t) if (s.upTo === null || n <= s.upTo) return s.price;
    return t[t.length - 1].price;
  };

  /* السعر الفعلي لعمارة معيّنة */
  window.buildingPlanPrice = function(b, planKey){
    const units = (b && (b.apartmentsCount ||
      ((window.loadBuildingData && loadBuildingData(b.id)) || {}).apartments?.length)) || 0;
    return planPriceFor(planKey, units);
  };

  /* ---------- حاسبة السعر ---------- */

  /* النافذة بتفتح فوق قسم الحاسبة اللي في الصفحة الرئيسية، والاتنين
     كانوا بنفس المعرّف — فـ getElementById بيرجّع بتاع الصفحة،
     والنتيجة تتكتب هناك بدل النافذة فالمستخدم ما يشوفش حاجة.
     دلوقتي بنمرّر العنصر نفسه، وبنلاقي مخرجه اللي جنبه. */
  window.calcPrice = function(srcEl){
    const el = (srcEl && srcEl.tagName) ? srcEl
             : document.getElementById('calcUnitsModal')
            || document.getElementById('calcUnits');
    if (!el) return;
    const n = Math.max(0, Number(el.value) || 0);
    const scope = el.closest('.modal') || document;
    const out = scope.querySelector('[data-calc-out]')
             || document.getElementById('calcOut');
    if (!out) return;

    if (!n){
      out.innerHTML = '<p class="small" style="color:var(--muted)">اكتب عدد الوحدات فوق</p>';
      return;
    }

    const m = planPriceFor('monthly', n);
    const y = planPriceFor('yearly', n);
    const perUnit = (m / n).toFixed(2).replace(/\.00$/,'');
    const saved = m * 12 - y;

    out.innerHTML = `
      <div class="grid g2" style="gap:10px">
        <div class="card" style="text-align:center;border:1px solid var(--line)">
          <p class="small" style="color:var(--muted);margin:0">شهري</p>
          <h2 style="margin:4px 0;color:var(--accent)">${m} <span style="font-size:14px">جنيه</span></h2>
          <p class="small" style="margin:0">في الشهر</p>
        </div>
        <div class="card" style="text-align:center;border:2px solid var(--gold);
             background:linear-gradient(135deg,rgba(216,163,59,.10),transparent);position:relative">
          <span style="position:absolute;top:-10px;inset-inline-start:50%;transform:translateX(50%);
                background:var(--gold);color:#fff;font-size:11px;font-weight:700;
                padding:2px 10px;border-radius:10px">وفّر ${saved} ج</span>
          <p class="small" style="color:var(--muted);margin:0">سنوي</p>
          <h2 style="margin:4px 0;color:var(--gold)">${y} <span style="font-size:14px">جنيه</span></h2>
          <p class="small" style="margin:0">شهرين مجانًا 🎁</p>
        </div>
      </div>
      <p class="small mtop" style="text-align:center">
        يعني <b>${perUnit} جنيه في الشهر</b> عن الوحدة الواحدة${
          n >= 20 ? ' — أقل من تمن كوباية شاي' : ''}
      </p>`;
  };

  /* قسم الحاسبة في الصفحة الرئيسية */
  function calcSection(){
    return `
    <div class="section-title" style="text-align:center"><h3>💰 احسب اشتراكك في ثانية</h3></div>
    <p class="small" style="text-align:center;color:var(--muted);margin-bottom:12px">
      السعر للعمارة كلها — مش لكل وحدة.</p>

    <div class="card" style="max-width:460px;margin:0 auto">
      <div class="field2"><label>عدد وحدات عمارتك</label>
        <input id="calcUnits" type="number" min="1" max="500" placeholder="مثال: 40"
          oninput="calcPrice(this)" style="font-size:18px;text-align:center"></div>

      <div id="calcOut" data-calc-out class="mtop">
        <p class="small" style="color:var(--muted);text-align:center">اكتب عدد الوحدات فوق</p>
      </div>

      <div class="mtop2" style="border-top:1px dashed var(--line);padding-top:10px">
        <p class="small" style="text-align:center;margin:0">
          🎁 <b>أول شهرين مجانًا بالكامل</b> — من غير بيانات بنكية</p>
      </div>

      <button class="btn primary mtop" style="width:100%;padding:12px"
        onclick="openSignup()">ابدأ مجانًا دلوقتي</button>
    </div>

    <div class="card mtop2" style="max-width:460px;margin:14px auto 0;background:var(--tint,#F3F8F7)">
      <b class="small">الأسعار بالتفصيل</b>
      <div class="mtop">
        ${priceRows().map(r => `
          <div class="flexrow small" style="padding:5px 0;border-bottom:1px dashed var(--line)">
            <span style="flex:1">${r[0]}</span>
            <span style="min-width:78px;text-align:center">${r[1]} جنيه / شهر</span>
            <span style="min-width:78px;text-align:center;color:var(--gold);font-weight:700">
              ${r[2]} جنيه / سنة</span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  /* بنحطها قبل قسم المميزات في الصفحة الرئيسية */
  const origLanding = window.landingHTML;
  if (typeof origLanding === 'function' && !origLanding.__calc){
    const wrapped = function(){
      const html = origLanding.apply(this, arguments);
      if (window.landingUIOn && !landingUIOn('calcSection')) return html;
      const mark = '<div class="section-title" style="text-align:center"><h3>مميزات البرنامج</h3>';
      const i = html.indexOf(mark);
      const sec = calcSection();
      return i > -1 ? html.slice(0,i) + sec + html.slice(i) : html + sec;
    };
    wrapped.__calc = true;
    window.landingHTML = wrapped;
  }


  /* ============================================================
     زرار عائم + شريط علوي للحاسبة
     ------------------------------------------------------------
     الحاسبة كانت في نص الصفحة — الزائر لازم ينزل عشان يشوفها.
     دلوقتي فيه مدخل واضح من أول لحظة، وفي شاشة الدخول كمان.
     ============================================================ */

  window.openPriceCalc = function(){
    openModal(`
      <div style="margin:-18px -18px 0;padding:22px 20px 16px;text-align:center;
           background:linear-gradient(135deg,#159A8C,#0f7a6f);color:#fff;
           border-radius:16px 16px 0 0">
        <div style="font-size:34px">💰</div>
        <h3 style="margin:6px 0 2px;color:#fff">احسب اشتراكك في ثانية</h3>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,.9)">
          السعر للعمارة كلها — مش لكل وحدة</p>
      </div>

      <div class="field2 mtop2"><label>عدد وحدات عمارتك</label>
        <input id="calcUnitsModal" type="number" min="1" max="500" placeholder="مثال: 40"
          oninput="calcPrice(this)" style="font-size:20px;text-align:center;padding:12px"></div>

      <div data-calc-out class="mtop">
        <p class="small" style="color:var(--muted);text-align:center">اكتب عدد الوحدات فوق</p>
      </div>

      <div class="card mtop2" style="background:var(--tint,#F3F8F7);padding:10px 12px">
        ${priceRows().map(r => `
          <div class="flexrow small" style="padding:4px 0">
            <span style="flex:1">${r[0]}</span>
            <span style="min-width:70px;text-align:center">${r[1]} / شهر</span>
            <span style="min-width:78px;text-align:center;color:var(--gold);font-weight:700">${r[2]} / سنة</span>
          </div>`).join('')}
      </div>

      <p class="small mtop" style="text-align:center">
        🎁 <b>أول شهرين مجانًا بالكامل</b> — من غير بيانات بنكية</p>

      <button class="btn primary mtop" style="width:100%;padding:13px;font-size:15px"
        onclick="closeModal();setTimeout(()=>openSignup(),150)">ابدأ مجانًا دلوقتي</button>`, true);
    setTimeout(() => { const el = document.getElementById('calcUnitsModal'); if (el) el.focus(); }, 200);
  };

  /* الزرار العائم بقى واحد في emartna-welcome.js وبيفتح
     الحاسبة والتجربة مع بعض — عشان ما يتكدّسوش على الموبايل. */

  /* شريط في أعلى الصفحة الرئيسية */
  const origLanding2 = window.landingHTML;
  if (typeof origLanding2 === 'function' && !origLanding2.__calcBar){
    const wrapped = function(){
      const html = origLanding2.apply(this, arguments);
      if (window.landingUIOn && !landingUIOn('calcBar')) return html;
      const bar = `
        <div onclick="openPriceCalc()" style="cursor:pointer;margin:0 0 14px;
             background:linear-gradient(135deg,#159A8C,#0f7a6f);color:#fff;
             border-radius:14px;padding:13px 18px;display:flex;align-items:center;
             justify-content:center;gap:10px;flex-wrap:wrap;text-align:center;
             box-shadow:0 4px 16px rgba(21,154,140,.25)">
          <b style="font-size:15px">💰 عمارتك كام وحدة؟ احسب اشتراكك في ثانية</b>
          <span style="background:rgba(255,255,255,.22);border-radius:20px;
                padding:4px 12px;font-size:12.5px;font-weight:700">
            من ${lowestPrice()} جنيه للعمارة كلها</span>
        </div>`;
      // بعد أول عنوان مباشرة
      const i = html.indexOf('</h1>');
      if (i > -1){
        const j = html.indexOf('</div>', i);
        if (j > -1) return html.slice(0, j + 6) + bar + html.slice(j + 6);
      }
      return bar + html;
    };
    wrapped.__calcBar = true;
    window.landingHTML = wrapped;
  }

  /* وفي شاشة الدخول */
  const origLogin = window.loginHTML;
  if (typeof origLogin === 'function' && !origLogin.__calc){
    const wrapped = function(){
      const html = origLogin.apply(this, arguments);
      if (window.landingUIOn && !landingUIOn('loginCalc')) return html;
      const link = `
        <p class="small" style="text-align:center;margin-top:14px">
          <a href="javascript:void(0)" onclick="openPriceCalc()"
             style="color:var(--accent);font-weight:700">💰 احسب اشتراك عمارتك</a>
          <span style="color:var(--muted)"> · من ${lowestPrice()} جنيه شهريًا</span>
        </p>`;
      return html + link;
    };
    wrapped.__calc = true;
    window.loginHTML = wrapped;
  }

  /* ---------- عرض السعر الصحيح في شاشة الاشتراك ---------- */

  const origPlanPrice = window.planPrice;
  window.planPrice = function(planKey, b){
    const p = planPriceFor(planKey, (b && b.apartmentsCount) ||
      (window.D && D.apartments ? D.apartments.length : 0));
    if (p !== null && p !== undefined) return p;
    return origPlanPrice ? origPlanPrice.apply(this, arguments) : 0;
  };

  console.log('[عمارتنا] التسعير بالشرائح جاهز');
})();

})();

/* ═══ emartna-newbld.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — إنشاء العمارة على الخادم
   ------------------------------------------------------------
   ⚠️ العطل اللي بيصلحه ده: العمارة اللي بينشئها صاحب البرنامج
   من لوحته كانت بتتحفظ في ذاكرة المتصفح بس ومبتوصلش الخادم —
   فتختفي أول ما يمسح الكاش، والعميل يدخل ويلاقي "مفيش عمارة".

   دالة create_building موجودة على الخادم من الأول، بس محدش
   كان بينديها من المسار ده.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* بننده الدالة الحقيقية على الخادم وبنرجّع الكود */
  window.createBuildingOnServer = async function(o){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) throw new Error('مفيش اتصال بالخادم');

    const { data, error } = await sb.rpc('create_building', {
      p_name:             o.name || '',
      p_apartments_count: Number(o.apartmentsCount) || 12,
      p_per_floor:        Number(o.perFloor) || 4,
      p_ground_count:     (o.groundFloorCount === 0 || o.groundFloorCount)
                            ? Number(o.groundFloorCount) : 4,
      p_ground_shops:     Number(o.groundShopsCount) || 0,
      p_address:          o.address || '',
      p_location_url:     o.locationUrl || '',
      p_city:             o.city || '',
      p_country:          o.country || 'مصر',
      p_governorate:      o.governorate || '',
      p_community_type:   o.communityType || 'single',
      p_admin_name:       o.adminName || '',
      p_phone_country:    o.phoneCountry || '+20',
      p_phone:            o.phone || '',
      p_trial_days:       Number(o.trialDays) || 60,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return { code: row.out_code || row.code, uuid: row.out_building_id || row.building_id };
  };

  /* ---------- ربط حساب موجود بعمارة ---------- */

  window.linkAdminToBuilding = async function(phone, code){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) throw new Error('مفيش اتصال');
    const { error } = await sb.rpc('link_admin_to_building',
      { p_phone: phone, p_building_code: code });
    if (error) throw error;
  };

  /* ---------- الحسابات المعلّقة ---------- */

  window.__orphans = null;

  window.loadOrphans = async function(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb || !(window.isSysOwner && isSysOwner())) return;
      const { data, error } = await sb.rpc('orphan_accounts');
      if (error) throw error;
      window.__orphans = data || [];
      if (window.renderSysContent) renderSysContent();
    }catch(e){ window.__orphans = []; }
  };

  window.openOrphanFix = function(phone, name){
    const list = ((window.REG && REG.buildings) || [])
      .filter(b => !b.isDemo)
      .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    openModal(`
      <h3>🔗 ربط ${esc2(name || phone)} بعمارة</h3>
      <p class="small mtop">الحساب ده سجّل بس مالوش عمارة. اربطه بعمارة موجودة،
      أو اعمله عمارة جديدة من "إنشاء عمارة جديدة".</p>
      <div class="field2 mtop2"><label>العمارة</label>
        <select id="orphBld">
          ${list.map(b => `<option value="${esc2(b.code)}">${esc2(b.name)} — ${esc2(b.code)}</option>`).join('')}
        </select></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="doLinkOrphan('${esc2(phone)}')">🔗 اربطه</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.doLinkOrphan = async function(phone){
    const code = (document.getElementById('orphBld') || {}).value;
    if (!code) return showMessage('اختار عمارة');
    try{
      await linkAdminToBuilding(phone, code);
      closeModal();
      if (window.toast) toast('اتربط — يقدر يدخل بكلمة سره العادية');
      await loadOrphans();
    }catch(e){
      showMessage('تعذّر الربط: ' + (window.cloudErrorText ? cloudErrorText(e) : e.message));
    }
  };

  /* تنبيه في لوحة صاحب البرنامج */
  const origDash = window.pageSysDashboard;
  if (typeof origDash === 'function' && !origDash.__orph){
    const wrapped = function(){
      const html = origDash.apply(this, arguments);
      const rows = window.__orphans;
      if (rows === null){ setTimeout(loadOrphans, 60); return html; }
      if (!rows.length) return html;

      const card = `
        <div class="card" style="border:1.5px solid var(--gold);
             background:linear-gradient(135deg,rgba(216,163,59,.10),transparent)">
          <b style="color:var(--gold)">⚠️ ${rows.length} حساب سجّل ومالوش عمارة</b>
          <p class="small mtop">دول عملاء وقفوا في نص التسجيل — بيدخلوا ويلاقوا الشاشة فاضية.</p>
          <div class="mtop">
            ${rows.map(r => `
              <div class="flexrow" style="padding:6px 0;border-bottom:1px dashed var(--line);
                   justify-content:space-between;gap:8px;flex-wrap:wrap">
                <div>
                  <b>${esc2(r.full_name || '؟')}</b>
                  <span class="small" dir="ltr"> · ${esc2(r.phone || '')}</span>
                  <div class="small" style="color:var(--muted)">
                    سجّل ${esc2(String(r.created_at || '').slice(0,10))}</div>
                </div>
                <div class="flexrow" style="gap:6px">
                  <a class="btn sm gold" target="_blank"
                     href="https://wa.me/${esc2(String(r.phone||'').replace(/[^\d]/g,''))}">💬</a>
                  <button class="btn sm primary"
                    onclick="openOrphanFix('${esc2(r.phone||'')}','${esc2(r.full_name||'')}')">
                    🔗 اربطه بعمارة</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
      return card + html;
    };
    wrapped.__orph = true;
    window.pageSysDashboard = wrapped;
  }

  console.log('[عمارتنا] إنشاء العمارة على الخادم جاهز');
})();

})();

/* ═══ emartna-floorplan.js ═══ */
(function(){
/* ============================================================
   عمارتنا — توزيع الأدوار
   ------------------------------------------------------------
   المشكلة القديمة: البرنامج بيفترض إن كل الأدوار متشابهة
   (نفس عدد الشقق)، والدور الأرضي دايمًا فيه وحدات. والواقع
   مختلف: دور فيه ٥ ودور فيه ٧، وأرضي كله جراج، ومحلات في
   الدور الأول مش الأرضي.

   الأداة دي بتخلّي رئيس الاتحاد يحدد لكل دور: كام شقة وكام محل.
   ولو التعديل هيمسح وحدات، بيشوف بالظبط أنهي وحدات وعليها إيه
   قبل ما يوافق.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const ORD = ['الأرضي','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع',
               'الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر',
               'الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر',
               'التاسع عشر','العشرون'];
  const floorName = i => i === 0 ? 'الدور الأرضي' : 'الدور ' + (ORD[i] || ('رقم ' + i));

  /* التوزيع الحالي من الوحدات الفعلية */
  function currentPlan(){
    const D = window.D || {};
    const aps = D.apartments || [];
    const byFloor = {};
    aps.forEach(a => {
      const k = a.floor || floorName(0);
      byFloor[k] = byFloor[k] || { apts:0, shops:0, units:[] };
      if (a.type === 'shop') byFloor[k].shops++; else byFloor[k].apts++;
      byFloor[k].units.push(a);
    });

    const total = Math.max(Number(D.building?.floorsCount) || 0, Object.keys(byFloor).length);
    const plan = [];
    for (let i = 0; i <= total; i++){
      const name = floorName(i);
      const f = byFloor[name];
      if (!f && i > 0 && plan.length >= Object.keys(byFloor).length) break;
      plan.push({ i, name, apts: f ? f.apts : 0, shops: f ? f.shops : 0 });
    }
    return plan.length ? plan : [{ i:0, name:floorName(0), apts:0, shops:0 }];
  }

  /* ---------- الشاشة ---------- */

  window.openFloorPlan = function(){
    const plan = currentPlan();
    openModal(`
      <h3>🏗️ توزيع الأدوار</h3>
      <p class="small mtop">حدد لكل دور كام شقة وكام محل — زي العمارة على الطبيعة.
      الدور اللي مفيهوش وحدات (جراج أو مدخل) سيبه صفر.</p>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ghost" onclick="addPlanFloor()">+ دور جديد</button>
        <button class="btn sm ghost" onclick="fillPlanEqual()">توزيع متساوي</button>
        <span style="flex:1"></span>
        <span class="small" id="planTotal" style="color:var(--muted)"></span>
      </div>

      <div id="planRows" class="mtop" style="max-height:46vh;overflow:auto">
        ${plan.map(f => rowHTML(f)).join('')}
      </div>

      <div class="modal-actions">
        <button class="btn primary" onclick="previewFloorPlan()">💾 حفظ التوزيع</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
    updateTotal();
  };

  function rowHTML(f){
    return `
    <div class="plan-row flexrow" data-i="${f.i}"
         style="gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--line)">
      <span class="small" style="min-width:96px;font-weight:700">${esc2(f.name)}</span>
      <label class="small" style="color:var(--muted)">شقق</label>
      <input type="number" min="0" max="60" class="pl-apt" value="${f.apts}"
        oninput="updateTotal()" style="width:64px;text-align:center">
      <label class="small" style="color:var(--muted)">محلات</label>
      <input type="number" min="0" max="60" class="pl-shop" value="${f.shops}"
        oninput="updateTotal()" style="width:64px;text-align:center">
      <span style="flex:1"></span>
      <button class="btn sm ghost" onclick="this.closest('.plan-row').remove();updateTotal()"
        title="شيل الدور">✕</button>
    </div>`;
  }

  window.addPlanFloor = function(){
    const box = document.getElementById('planRows');
    if (!box) return;
    const i = box.querySelectorAll('.plan-row').length;
    box.insertAdjacentHTML('beforeend', rowHTML({ i, name:floorName(i), apts:0, shops:0 }));
    updateTotal();
  };

  window.fillPlanEqual = function(){
    const rows = [...document.querySelectorAll('.plan-row')];
    if (!rows.length) return;
    const n = Number(prompt('كام وحدة في كل دور؟', '4'));
    if (!n || n < 0) return;
    rows.forEach((r, idx) => {
      if (idx === 0) return;                 // الأرضي بيفضل زي ما هو
      r.querySelector('.pl-apt').value = n;
      r.querySelector('.pl-shop').value = 0;
    });
    updateTotal();
  };

  window.updateTotal = function(){
    const rows = [...document.querySelectorAll('.plan-row')];
    let a = 0, s = 0;
    rows.forEach(r => {
      a += Number(r.querySelector('.pl-apt').value) || 0;
      s += Number(r.querySelector('.pl-shop').value) || 0;
    });
    const el = document.getElementById('planTotal');
    const now = (window.D && D.apartments) ? D.apartments.length : 0;
    if (el) el.innerHTML = `الإجمالي: <b>${a + s}</b> وحدة (${a} شقة · ${s} محل)` +
      (a + s !== now ? ` <span style="color:var(--gold)">· حاليًا ${now}</span>` : '');
  };

  /* ---------- المعاينة قبل التنفيذ ---------- */

  window.previewFloorPlan = function(){
    const rows = [...document.querySelectorAll('.plan-row')];
    const plan = rows.map((r, i) => ({
      i, name: floorName(i),
      apts: Number(r.querySelector('.pl-apt').value) || 0,
      shops: Number(r.querySelector('.pl-shop').value) || 0,
    }));
    const need = plan.reduce((t,f) => t + f.apts + f.shops, 0);
    if (!need) return showMessage('لازم يكون في وحدة واحدة على الأقل');

    const aps = [...(D.apartments || [])].sort((a,b) => (a.number||0) - (b.number||0));
    const extra = aps.length - need;

    /* الوحدات اللي هتتشال — بنوري اللي عليها حركة */
    let doomed = [];
    if (extra > 0){
      doomed = aps.slice(need).map(a => {
        const moves = (D.ledger || []).filter(l => l.apartmentId === a.id).length;
        const bal = window.apBalance ? apBalance(a.id) : 0;
        return { a, moves, bal };
      });
    }
    const risky = doomed.filter(d => d.moves > 0 || d.bal !== 0);

    window.__pendingPlan = plan;

    openModal(`
      <h3>مراجعة التوزيع</h3>
      <div class="card mtop">
        <p class="small">الوحدات دلوقتي: <b>${aps.length}</b> · بعد التعديل: <b>${need}</b></p>
        ${extra > 0 ? `<p class="small" style="color:var(--red)">
            هيتشال <b>${extra}</b> وحدة</p>` : ''}
        ${extra < 0 ? `<p class="small" style="color:var(--accent)">
            هيتضاف <b>${-extra}</b> وحدة جديدة</p>` : ''}
        ${extra === 0 ? '<p class="small">العدد نفسه — التغيير في التوزيع بس</p>' : ''}
      </div>

      ${risky.length ? `
        <div class="card mtop" style="border:1.5px solid var(--red);background:#FFF6F5">
          <b style="color:var(--red)">⚠️ ${risky.length} وحدة عليها حركات مالية</b>
          <p class="small mtop">حذفها هيمسح حركاتها كمان. راجعها كويس:</p>
          <div class="mtop" style="max-height:24vh;overflow:auto">
            ${risky.map(d => `<div class="small" style="padding:3px 0;border-bottom:1px dashed var(--line)">
              <b>${esc2(window.unitLabel ? unitLabel(d.a) : ('وحدة ' + d.a.number))}</b>
              ${d.a.ownerName ? ' — ' + esc2(d.a.ownerName) : ''}
              · ${d.moves} حركة${d.bal ? ' · رصيد ' + (window.money ? money(d.bal) : d.bal) : ''}
            </div>`).join('')}
          </div>
        </div>` : ''}

      <div class="card mtop">
        <b class="small">التوزيع الجديد</b>
        <div class="mtop">
          ${plan.filter(f => f.apts + f.shops > 0).map(f =>
            `<div class="small" style="padding:2px 0">
              ${esc2(f.name)}: ${f.apts} شقة${f.shops ? ' · ' + f.shops + ' محل' : ''}</div>`).join('')}
          ${plan.some(f => f.apts + f.shops === 0)
            ? `<div class="small" style="color:var(--muted);margin-top:4px">
                 (${plan.filter(f => f.apts+f.shops===0).map(f => esc2(f.name)).join(' · ')}: من غير وحدات)</div>`
            : ''}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn ${risky.length ? 'red' : 'primary'}" onclick="applyFloorPlan()">
          ${risky.length ? '⚠️ نفّذ رغم التحذير' : '✅ نفّذ التوزيع'}</button>
        <button class="btn ghost" onclick="closeModal();openFloorPlan()">رجوع للتعديل</button>
      </div>`, true);
  };

  /* ---------- التنفيذ ---------- */

  window.applyFloorPlan = function(){
    const plan = window.__pendingPlan;
    if (!plan) return;

    const aps = [...(D.apartments || [])].sort((a,b) => (a.number||0) - (b.number||0));
    const need = plan.reduce((t,f) => t + f.apts + f.shops, 0);

    let idx = 0, n = 0;
    const kept = [];

    plan.forEach(f => {
      for (let k = 0; k < f.apts + f.shops; k++){
        const isShop = k < f.shops;         // المحلات الأول في كل دور
        n++;
        let a = aps[idx++];
        if (!a){
          a = { id: uid(), number: n, ownerName:'', tenantName:'', phone:'',
                phoneCountry:'+20', email:'', monthlyFee:0, openingBalance:0,
                closed:false, notes:'' };
        }
        a.number = n;
        a.floor  = f.name;
        a.type   = isShop ? 'shop' : 'apartment';
        kept.push(a);
      }
    });

    D.apartments = kept;

    /* نمسح حركات الوحدات اللي اتشالت */
    const ids = new Set(kept.map(a => a.id));
    ['ledger','maintenanceReports','paymentRequests'].forEach(c => {
      if (Array.isArray(D[c]))
        D[c] = D[c].filter(x => !x.apartmentId || ids.has(x.apartmentId));
    });
    (D.users || []).forEach(u => { if (u.apartmentId && !ids.has(u.apartmentId)) u.apartmentId = null; });

    /* نحدّث شكل العمارة */
    const floorsWithUnits = plan.filter(f => f.apts + f.shops > 0);
    D.building.floorsCount = Math.max(0, plan.length - 1);
    D.building.groundFloorCount = (plan[0] ? plan[0].apts + plan[0].shops : 0);
    D.building.groundShopsCount = plan[0] ? plan[0].shops : 0;
    D.building.apartmentsPerFloor = floorsWithUnits.length
      ? Math.round(need / floorsWithUnits.length) : 0;

    save();
    closeModal();
    if (window.toast) toast(`اتحفظ التوزيع — ${need} وحدة`);
    renderContent();
    if (window.syncBuildingShape) syncBuildingShape(true);
  };


  /* ============================================================
     توزيع الأدوار أثناء التسجيل
     ============================================================ */

  window.suToggleDetail = function(){
    const box = document.getElementById('suFloorDetail');
    if (!box) return;
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) suBuildFloorRows();
    suCalcUnits();
    if ((document.getElementById('suNumStyle')||{}).value === 'custom') suBuildNumRows();
  };

  window.suBuildFloorRows = function(){
    const box = document.getElementById('suFloorRows');
    const n = Math.max(0, Number((document.getElementById('suFloors')||{}).value) || 0);
    const per = Math.max(0, Number((document.getElementById('suPerFloor')||{}).value) || 0);
    if (box){
      const old = {};
      box.querySelectorAll('.su-frow').forEach(r => {
        old[r.dataset.i] = {
          a: r.querySelector('.su-fa').value,
          s: r.querySelector('.su-fs').value,
        };
      });
      let html = '';
      for (let i = 1; i <= n; i++){
        const o = old[i] || {};
        html += `
        <div class="su-frow flexrow" data-i="${i}"
             style="gap:6px;align-items:center;padding:4px 0;border-bottom:1px dashed var(--line)">
          <span class="small" style="min-width:92px">${esc2(floorName(i))}</span>
          <span class="small" style="color:var(--muted)">شقق</span>
          <input type="number" min="0" class="su-fa" value="${o.a !== undefined ? o.a : per}"
            style="width:60px;text-align:center" oninput="suCalcUnits()">
          <span class="small" style="color:var(--muted)">محلات</span>
          <input type="number" min="0" class="su-fs" value="${o.s !== undefined ? o.s : 0}"
            style="width:60px;text-align:center" oninput="suCalcUnits()">
        </div>`;
      }
      box.innerHTML = html || '<p class="small">مفيش أدوار فوق الأرضي</p>';
    }
    suCalcUnits();
  };

  /* بيحسب الإجمالي وبيخزّن التوزيع للاستخدام وقت الإنشاء */
  window.suCalcUnits = function(){
    const g = id => Number((document.getElementById(id)||{}).value) || 0;
    const detail = document.getElementById('suFloorDetail');
    const detailed = detail && !detail.classList.contains('hidden');

    const plan = [{ i:0, name: floorName(0), apts: g('suGroundApts'), shops: g('suGroundShops') }];

    if (detailed){
      document.querySelectorAll('.su-frow').forEach(r => {
        plan.push({ i:Number(r.dataset.i), name: floorName(Number(r.dataset.i)),
          apts: Number(r.querySelector('.su-fa').value) || 0,
          shops: Number(r.querySelector('.su-fs').value) || 0 });
      });
    }else{
      const n = g('suFloors'), per = g('suPerFloor');
      for (let i = 1; i <= n; i++)
        plan.push({ i, name: floorName(i), apts: per, shops: 0 });
    }

    const total = plan.reduce((t,f) => t + f.apts + f.shops, 0);
    window.__suPlan = plan;

    // نمط الترقيم والمقدّمات
    window.__suNumStyle = (document.getElementById('suNumStyle')||{}).value || 'floor';
    const pre = {};
    document.querySelectorAll('.su-nrow').forEach(r => {
      pre[Number(r.dataset.i)] = r.querySelector('.su-np').value;
    });
    window.__suNumPrefix = pre;
    setTimeout(() => { try{ suUpdateNumPreview(); }catch(e){} }, 0);

    const out = document.getElementById('suUnitsOut');
    if (out){
      const shops = plan.reduce((t,f) => t + f.shops, 0);
      out.innerHTML = `الإجمالي: <span style="color:var(--accent)">${total}</span> وحدة` +
        (shops ? ` <span class="small">(${total-shops} شقة · ${shops} محل)</span>` : '');
    }
    const cnt = document.getElementById('suCount');
    if (cnt) cnt.value = total;
    const gc = document.getElementById('suGroundCount');
    if (gc) gc.value = plan[0].apts + plan[0].shops;
    return total;
  };


  /* ---------- نمط الترقيم أثناء التسجيل ---------- */

  const AR_D = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  const toAr2 = n => String(n).replace(/\d/g, d => AR_D[+d]);

  /* بيبني رقم الوحدة حسب النمط المختار */
  function unitNumFor(style, floorIdx, idxInFloor, isShop, prefix){
    if (style === 'custom'){
      const p = String(prefix || '').trim();
      if (!p) return '';
      // لو المقدّمة رقم (١٠١) بنعدّ منها، ولو حرف بنلزقه بالرقم
      const n = parseInt(p.replace(/[^\d]/g,''), 10);
      if (!isNaN(n) && /^\d+$/.test(p.replace(/[^\d]/g,'')) && /\d/.test(p))
        return String(n + idxInFloor - 1);
      return p + idxInFloor;
    }
    if (style === 'plain')  return toAr2(idxInFloor);
    if (style === 'en')     return String(idxInFloor);
    if (style === 'typed')  return (isShop ? 'محل ' : 'شقة ') + toAr2(idxInFloor);
    // الافتراضي: دور + رقم
    return floorIdx === 0 ? toAr2(idxInFloor) : toAr2(floorIdx * 100 + idxInFloor);
  }

  window.suNumStyleChanged = function(){
    const st = (document.getElementById('suNumStyle')||{}).value;
    const box = document.getElementById('suNumCustom');
    const hint = document.getElementById('suNumHint');
    if (box) box.classList.toggle('hidden', st !== 'custom');
    if (hint) hint.textContent = st === 'custom'
      ? 'اكتب بداية الترقيم لكل دور.'
      : 'زي اللي مكتوب على أبواب الشقق.';
    if (st === 'custom') suBuildNumRows();
    suCalcUnits();
  };

  window.suBuildNumRows = function(){
    const box = document.getElementById('suNumRows');
    if (!box) return;
    const plan = window.__suPlan || [];
    const old = {};
    box.querySelectorAll('.su-nrow').forEach(r => { old[r.dataset.i] = r.querySelector('input').value; });
    box.innerHTML = plan.filter(f => f.apts + f.shops > 0).map(f => `
      <div class="su-nrow flexrow" data-i="${f.i}"
           style="gap:6px;align-items:center;padding:4px 0;border-bottom:1px dashed var(--line)">
        <span class="small" style="min-width:92px">${esc2(f.name)}</span>
        <input class="su-np" value="${old[f.i] !== undefined ? esc2(old[f.i])
          : (f.i === 0 ? '' : String(f.i * 100 + 1))}"
          placeholder="مثال: ${f.i === 0 ? '1' : (f.i * 100 + 1)}"
          style="flex:1;min-width:80px" oninput="suCalcUnits()">
        <span class="small" style="color:var(--muted);min-width:74px" data-preview></span>
      </div>`).join('') || '<p class="small">حدد الأدوار الأول</p>';
    suUpdateNumPreview();
  };

  window.suUpdateNumPreview = function(){
    const st = (document.getElementById('suNumStyle')||{}).value || 'floor';
    const plan = window.__suPlan || [];
    document.querySelectorAll('.su-nrow').forEach(r => {
      const i = Number(r.dataset.i);
      const f = plan.find(x => x.i === i) || { apts:0, shops:0 };
      const p = r.querySelector('.su-np').value;
      const el = r.querySelector('[data-preview]');
      if (!el) return;
      const a = unitNumFor(st, i, 1, false, p);
      const b = unitNumFor(st, i, 2, false, p);
      el.textContent = (f.apts + f.shops) > 1 ? `${a} · ${b}…` : a;
    });
  };

  /* بيطبّق الترقيم على الوحدات بعد إنشاء العمارة */
  window.applySignupNumbering = function(){
    const st = window.__suNumStyle || 'floor';
    if (st === 'floor' && !window.__suNumPrefix) { /* الافتراضي برضه بيتطبّق */ }
    const D = window.D;
    if (!D || !D.apartments) return;
    const perFloor = {};
    [...D.apartments].sort((a,b) => (a.number||0) - (b.number||0)).forEach(a => {
      const fk = String(a.floor || '');
      perFloor[fk] = (perFloor[fk] || 0) + 1;
      const fi = floorIdxOf(a.floor);
      const pre = (window.__suNumPrefix || {})[fi];
      const v = unitNumFor(st, fi === null ? 0 : fi, perFloor[fk], a.type === 'shop', pre);
      if (v) a.label = v;
    });
  };

  function floorIdxOf(label){
    const t = String(label || '').trim();
    const byLen = ORD.map((n,i) => ({n,i})).sort((a,b) => b.n.length - a.n.length);
    for (const o of byLen) if (t.includes(o.n)) return o.i;
    const m = t.match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  /* بعد إنشاء العمارة، بنطبّق التوزيع لو كان مخصّص */
  window.applySignupPlan = function(){
    const plan = window.__suPlan;
    if (!plan || !window.D) return;
    const same = plan.every((f,i) => i === 0 || f.shops === 0) &&
                 new Set(plan.slice(1).map(f => f.apts)).size <= 1;
    if (same) return;                 // التوزيع العادي — البرنامج عمله صح
    window.__pendingPlan = plan;
    try{ applyFloorPlan(); }catch(e){}
  };

  /* زرار في شاشة بيانات العمارة */
  const origPage = window.pageBuilding;
  if (typeof origPage === 'function' && !origPage.__plan){
    const wrapped = function(){
      const html = origPage.apply(this, arguments);
      const card = `
        <div class="card content-narrow" style="border:1px solid var(--accent)">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <b>🏗️ توزيع الأدوار</b>
              <div class="small" style="color:var(--muted);margin-top:3px">
                حدد لكل دور كام شقة وكام محل — للعمارات اللي أدوارها مش متشابهة</div>
            </div>
            <button class="btn primary sm" onclick="openFloorPlan()">افتح التوزيع</button>
          </div>
        </div>`;
      return card + html;
    };
    wrapped.__plan = true;
    window.pageBuilding = wrapped;
  }

  console.log('[عمارتنا] توزيع الأدوار جاهز');
})();

})();

/* ═══ emartna-staff.js ═══ */
(function(){
/* ============================================================
   عمارتنا — حد المستخدمين الإداريين
   ------------------------------------------------------------
   رئيس الاتحاد بيقدر يضيف مساعدين (محاسب · إداري)، والخطة
   بتحدد عددهم. أصحاب الوحدات والمستأجرين مالهمش حد لأنهم
   جزء من العمارة نفسها مش من الإدارة.

   وصاحب البرنامج يقدر يدّي عمارة معيّنة حد خاص يغلب الخطة.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const LIMITED = ['accountant','manager','deputy'];

  /* عدد المساعدين النشطين دلوقتي */
  window.staffCount = function(){
    const D = window.D;
    if (!D) return 0;
    return (D.users || []).filter(u =>
      LIMITED.includes(u.role) && u.active !== false && u.inviteStatus !== 'pending').length;
  };

  /* الحد المسموح: حد العمارة الخاص يغلب الخطة */
  window.staffLimit = function(){
    try{
      const rec = window.findBuildingRec ? findBuildingRec(window.activeBuildingId) : null;
      if (rec && rec.maxStaffOverride !== undefined && rec.maxStaffOverride !== null)
        return Number(rec.maxStaffOverride);
      const lic  = rec && window.ensureLicense ? ensureLicense(rec) : null;
      const plan = lic && window.findPlan ? findPlan(lic.plan) : null;
      if (plan && plan.maxStaff !== undefined && plan.maxStaff !== null)
        return Number(plan.maxStaff);
    }catch(e){}
    return null;                       // بلا حد
  };

  /* رسالة المنع، أو '' لو مسموح */
  window.staffLimitBlock = function(role){
    if (!LIMITED.includes(role)) return '';
    const lim = staffLimit();
    if (lim === null) return '';
    const now = staffCount();
    if (now < lim) return '';
    return `خطتك بتسمح بـ${lim} ${lim === 1 ? 'مساعد واحد' : 'مساعدين'} ` +
      `(محاسب أو إداري)، وإنت مستخدم ${now}.\n\n` +
      `رقّي خطتك أو أوقف مساعد موجود عشان تضيف واحد جديد.\n\n` +
      `ملاحظة: أصحاب الوحدات والمستأجرين مالهمش حد.`;
  };

  /* بطاقة الاستخدام */
  window.staffUsageCard = function(){
    const lim = staffLimit(), now = staffCount();
    if (lim === null)
      return `<p class="small" style="color:var(--muted)">المساعدون: ${now} · بلا حد</p>`;
    const pct  = lim ? Math.min(100, Math.round(now / lim * 100)) : 100;
    const full = now >= lim;
    return `
      <div class="card mtop" style="padding:10px 12px;border:1px solid ${full?'var(--gold)':'var(--line)'}">
        <div class="flexrow" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div>
            <b class="small">المساعدون: ${now} من ${lim}</b>
            <div class="small" style="color:var(--muted)">
              محاسب وإداري — رئيس الاتحاد وأصحاب الوحدات مش محسوبين</div>
          </div>
          <div style="min-width:120px">
            <div style="height:7px;background:var(--line);border-radius:5px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${full?'var(--gold)':'var(--accent)'}"></div>
            </div>
          </div>
        </div>
        ${full ? `<p class="small mtop" style="color:var(--gold)">
          وصلت للحد — <a href="javascript:void(0)" onclick="go('license')">رقّي خطتك</a>
          عشان تضيف مساعدين أكتر.</p>` : ''}
      </div>`;
  };

  /* ---------- الحقن في الشاشات ---------- */

  function guard(fnName, roleGetter){
    const orig = window[fnName];
    if (typeof orig !== 'function' || orig.__staffGuard) return;
    const wrapped = function(){
      try{
        const role = roleGetter();
        const blk = staffLimitBlock(role);
        if (blk){ showMessage(blk); return; }
      }catch(e){}
      return orig.apply(this, arguments);
    };
    wrapped.__staffGuard = true;
    window[fnName] = wrapped;
  }

  function hook(){
    guard('saveUser', () => {
      const el = document.getElementById('uRole');
      const editing = !!document.getElementById('uUser')?.disabled;
      return (!editing && el) ? el.value : '';    // الحد على الإضافة بس
    });
    guard('createAdminInvite', () => {
      const el = document.getElementById('nuRole');
      return el ? el.value : '';
    });

    /* البطاقة نفسها بقت جوه بطاقة الصلاحيات الموحّدة
       في emartna-resaccess.js — عشان ما تتكررش. */
  }
  hook();
  [900, 2500, 5000].forEach(ms => setTimeout(hook, ms));

  /* ---------- تحكّم صاحب البرنامج ---------- */

  window.openStaffOverride = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const lic  = window.ensureLicense ? ensureLicense(b) : {};
    const plan = window.findPlan ? findPlan(lic.plan) : null;
    const planLim = plan && plan.maxStaff != null ? plan.maxStaff : 'بلا حد';
    openModal(`
      <h3>👥 حد المساعدين — ${esc2(b.name)}</h3>
      <p class="small mtop">خطة العمارة بتسمح بـ<b>${planLim}</b> مساعد.
      تقدر تدّيها حد خاص يغلب الخطة.</p>
      <div class="field2 mtop2"><label>حد خاص لهذه العمارة</label>
        <input id="soVal" type="number" min="0" placeholder="سيبه فاضي = حسب الخطة"
          value="${b.maxStaffOverride != null ? b.maxStaffOverride : ''}"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveStaffOverride('${esc2(bid)}')">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveStaffOverride = function(bid){
    const b = REG.buildings.find(x => x.id === bid);
    if (!b) return;
    const v = (document.getElementById('soVal') || {}).value;
    b.maxStaffOverride = String(v).trim() === '' ? null : Math.max(0, Number(v) || 0);
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظ حد المساعدين');
    if (window.renderSysContent) renderSysContent();
  };

  console.log('[عمارتنا] حد المساعدين جاهز');
})();

})();

/* ═══ emartna-resaccess.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تطبيق صلاحيات على كل السكان دفعة واحدة
   ------------------------------------------------------------
   الملف ده كان نظام صلاحيات تالت مستقل: بيتخزّن على مستوى
   العمارة (D.building.residentAccess)، وبيلفّ حوالين فلترة
   القوائم ومنع الدخول — فوق نظام صلاحيات المستخدم الفردي.

   النتيجة كانت إن رئيس الاتحاد يظبط صلاحيات ساكن من شاشة
   المستخدمين، وطبقة تانية تدوس عليها من غير ما يعرف. ولإن
   الاتنين ليهم قوايم شاشات مختلفة، الشاشة الواحدة كانت
   مسموحة في مكان ومقفولة في مكان — وده اللي كان مبيّن إن
   التعديل "بيرجع زي الأول".

   دلوقتي مصدر واحد: screen_perms لكل مستخدم على السيرفر.
   والملف ده بقى أداة تطبيق جماعي فوق نفس المصدر.
   ============================================================ */

(function(){
  'use strict';

  /* تحييد النظام القديم: أي سياسة متخزّنة على العمارة بقت بلا أثر،
     ومفيش أي لفّ حوالين visibleNavGroups ولا go(). */
  window.residentPolicy = function(){ return null; };
  window.residentCanSee = function(){ return true; };

  /* ---------- تطبيق جماعي ---------- */

  window.openBulkResidentPerms = function(){
    if (!window.isUnionHead || !isUnionHead())
      return showMessage('إدارة الصلاحيات متاحة لرئيس اتحاد الملاك فقط.');
    if (!window.permInviteGrid)
      return showMessage('جدول الصلاحيات مش متحمّل — حدّث الصفحة.');

    const D = window.D;
    const owners  = (D.users || []).filter(u => u.role === 'owner'  && u.active !== false);
    const tenants = (D.users || []).filter(u => u.role === 'tenant' && u.active !== false);

    openModal(`
      <h3>👥 تطبيق صلاحيات على كل السكان</h3>
      <p class="small mtop">اظبط الجدول مرة واحدة وطبّقه على كل الملاك أو كل المستأجرين.
        <b>ده بيكتب فوق أي صلاحيات مخصّصة</b> للناس اللي هتختارهم — لو ظابط حد
        بعينه من شاشة المستخدمين، صلاحياته هتتمسح.</p>

      <div class="field2 mtop"><label>هيتطبّق على</label>
        <select id="brTarget">
          <option value="owner">🏠 كل الملاك (${owners.length})</option>
          <option value="tenant">🔑 كل المستأجرين (${tenants.length})</option>
          <option value="both">الاتنين (${owners.length + tenants.length})</option>
        </select></div>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button type="button" class="btn sm ghost" onclick="permBulk('reset')">افتراضي الدور</button>
        <button type="button" class="btn sm ghost" onclick="permBulk('view')">عرض وطباعة بس</button>
        <button type="button" class="btn sm ghost" onclick="permBulk('all')">افتح الكل</button>
        <button type="button" class="btn sm ghost" onclick="permBulk('none')">اقفل الكل</button>
      </div>

      <div class="mtop">${window.permInviteGrid('owner', null)}</div>

      <div class="modal-actions">
        <button class="btn primary" onclick="applyBulkResidentPerms()">💾 طبّق على الكل</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.applyBulkResidentPerms = async function(){
    const D = window.D;
    const target = (document.getElementById('brTarget') || {}).value || 'owner';
    const roles = target === 'both' ? ['owner','tenant'] : [target];
    const list = (D.users || []).filter(u =>
      roles.includes(u.role) && u.active !== false && (u.__membershipId || u.__inviteId));

    if (!list.length) return showMessage('مفيش سكان متزامنين مع السحابة للتطبيق عليهم.');

    const sp = window.readScreenPerms ? readScreenPerms() : null;
    if (!sp) return showMessage('الجدول فاضي.');

    /* صلاحية المجموعة مشتقّة من التفصيلي عشان الطبقتين ما يتعارضوش */
    const perms = { home:true };
    (window.permScreens ? permScreens('owner') : []).forEach(g => {
      perms[g.key] = g.items.some(it => sp[it.key] && sp[it.key].view);
    });

    if (!confirm('هيتطبّق على ' + list.length +
                 ' ساكن، وهيمسح أي صلاحيات مخصّصة عندهم. تكمّل؟')) return;

    const sb = window.CLOUD && window.CLOUD._sb;
    let done = 0, failed = 0;
    for (const u of list){
      try{
        const tbl = u.__membershipId ? 'memberships' : 'invitations';
        const id  = u.__membershipId || u.__inviteId;
        const { error } = await sb.from(tbl)
          .update({ permissions: perms, screen_perms: sp }).eq('id', id);
        if (error) throw error;
        u.screenPerms = sp; u.permissions = perms;
        done++;
      }catch(e){ failed++; }
    }

    closeModal();
    showMessage('اتطبّقت على ' + done + ' ساكن.' +
                (failed ? ' وفشلت مع ' + failed + '.' : ''));
    if (window.refreshUsers) refreshUsers();
  };

  /* ---------- الكارت في شاشة المستخدمين ---------- */

  function card(){
    if (!window.isUnionHead || !isUnionHead()) return '';
    return `
      <div class="card mtop" style="border-inline-start:3px solid var(--accent)">
        <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div>
            <b>👥 تطبيق صلاحيات على كل السكان</b>
            <div class="small" style="color:var(--muted)">
              بدل ما تظبط كل ساكن لوحده — اظبط مرة وطبّق على الكل</div>
          </div>
          <button class="btn sm" onclick="openBulkResidentPerms()">فتح</button>
        </div>
      </div>`;
  }

  function hook(){
    const orig = window.pageUsers;
    if (typeof orig !== 'function' || orig.__bulkRes) return;
    const wrapped = function(){
      const html = orig.apply(this, arguments);
      return typeof html === 'string' ? html + card() : html;
    };
    wrapped.__bulkRes = true;
    window.pageUsers = wrapped;
  }
  setTimeout(hook, 700);

  /* أي مدخل قديم للشاشة الملغاة يفتح الأداة الجديدة */
  window.openResidentAccess = function(){ openBulkResidentPerms(); };

  console.log('[عمارتنا] تطبيق الصلاحيات الجماعي جاهز');
})();

})();

/* ═══ emartna-uitoggles.js ═══ */
(function(){
/* ============================================================
   عمارتنا — التحكم في عناصر الصفحة الرئيسية
   ------------------------------------------------------------
   صاحب البرنامج يقدر يشغّل ويقفل كل عنصر دعائي من غير كود:
   الزرار العائم · شريط الحاسبة · نافذة الترحيب · رابط الدخول.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  const ITEMS = [
    { key:'startFab',   icon:'🎁', label:'الزرار العائم "ابدأ مجانًا"',
      note:'بيفضل ظاهر مع التمرير — أقوى مدخل للزائر' },
    { key:'calcBar',    icon:'💰', label:'شريط الحاسبة في أعلى الصفحة',
      note:'"عمارتك كام وحدة؟ احسب اشتراكك"' },
    { key:'calcSection',icon:'🧮', label:'قسم الحاسبة الكامل',
      note:'الحاسبة بجدول الأسعار في نص الصفحة' },
    { key:'welcomePopup',icon:'👋', label:'نافذة الترحيب التلقائية',
      note:'بتفتح لوحدها بعد ثواني من دخول الزائر' },
    { key:'loginCalc',  icon:'🔑', label:'رابط الحاسبة في شاشة الدخول',
      note:'"احسب اشتراك عمارتك" تحت زرار الدخول' },
  ];

  const DEFAULTS = { startFab:true, calcBar:true, calcSection:true,
                     welcomePopup:true, loginCalc:true };

  function conf(){
    try{
      const ls = window.ensureLandingSettings ? ensureLandingSettings() : null;
      if (!ls) return DEFAULTS;
      ls.uiToggles = Object.assign({}, DEFAULTS, ls.uiToggles || {});
      return ls.uiToggles;
    }catch(e){ return DEFAULTS; }
  }

  /* الدالة اللي كل الوحدات بتسأل بيها */
  window.landingUIOn = function(key){
    const c = conf();
    return c[key] !== false;
  };

  /* ---------- شاشة الإعداد ---------- */

  window.openLandingToggles = function(){
    const c = conf();
    openModal(`
      <h3>🎛️ عناصر الصفحة الرئيسية</h3>
      <p class="small mtop">شغّل أو اقفل أي عنصر دعائي — التغيير بيبان للزوّار فورًا.</p>

      <div class="mtop2">
        ${ITEMS.map(it => `
          <label class="flexrow" style="gap:10px;align-items:flex-start;padding:9px 0;
                 border-bottom:1px dashed var(--line);cursor:pointer">
            <input type="checkbox" class="ui-tg" data-k="${it.key}"
              ${c[it.key] !== false ? 'checked' : ''} style="margin-top:3px">
            <span style="flex:1">
              <b class="small">${it.icon} ${esc2(it.label)}</b>
              <div class="small" style="color:var(--muted)">${esc2(it.note)}</div>
            </span>
          </label>`).join('')}
      </div>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ghost" onclick="uiTogglePreset(true)">شغّل الكل</button>
        <button class="btn sm ghost" onclick="uiTogglePreset(false)">اقفل الكل</button>
      </div>

      <p class="small mtop" style="color:var(--muted)">
        💡 لو قفلت الكل، الصفحة هتبقى نظيفة بس الزائر مش هيلاقي مدخل واضح للتجربة.
      </p>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveLandingToggles()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.uiTogglePreset = function(on){
    document.querySelectorAll('.ui-tg').forEach(el => { el.checked = !!on; });
  };

  window.saveLandingToggles = function(){
    const ls = ensureLandingSettings();
    const out = {};
    document.querySelectorAll('.ui-tg').forEach(el => { out[el.dataset.k] = el.checked; });
    ls.uiToggles = out;
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظت إعدادات الصفحة');
    if (window.renderSysContent) renderSysContent();
  };

  /* بطاقة في شاشة الصفحة الرئيسية */
  function card(){
    const c = conf();
    const off = ITEMS.filter(i => c[i.key] === false);
    return `
      <div class="card content-narrow" style="border:1px solid ${off.length?'var(--gold)':'var(--line)'}">
        <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <b>🎛️ عناصر الصفحة الرئيسية</b>
            <div class="small" style="color:var(--muted);margin-top:3px">
              ${off.length
                ? `${ITEMS.length - off.length} من ${ITEMS.length} شغّالين · مقفول: ${
                    off.map(i => esc2(i.label.replace(/"/g,''))).join(' · ')}`
                : `كل العناصر شغّالة (${ITEMS.length})`}
            </div>
          </div>
          <button class="btn sm ghost" onclick="openLandingToggles()">تعديل</button>
        </div>
      </div>`;
  }

  function hook(){
    if (window.__uiTogglesHooked) return;
    const orig = window.pageSysLandingSettings;
    if (typeof orig !== 'function') return;
    window.__uiTogglesHooked = true;
    const wrapped = function(){ return card() + orig.apply(this, arguments); };
    window.pageSysLandingSettings = wrapped;
  }
  hook();
  [900, 2500, 5000].forEach(ms => setTimeout(hook, ms));

  console.log('[عمارتنا] التحكم في عناصر الصفحة جاهز');
})();

})();

/* ═══ emartna-cities.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — مدن مصر حسب المحافظة
   ------------------------------------------------------------
   خانة المدينة كانت كتابة حرة، فنفس المدينة بتتكتب بأشكال
   مختلفة (مدينة نصر · مدينه نصر · نصر) — والتقارير بتتفرّق.
   دلوقتي قائمة منسدلة بتتغيّر مع المحافظة، مع خيار "أخرى"
   لأي منطقة مش في القائمة.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  const CITIES = {
    'القاهرة': ['مدينة نصر','مصر الجديدة','المعادي','حلوان','المقطم','التجمع الخامس','الرحاب',
      'مدينتي','العبور','الشروق','بدر','15 مايو','عين شمس','المطرية','الزيتون','حدائق القبة',
      'شبرا','روض الفرج','الساحل','الوايلي','باب الشعرية','الأزبكية','عابدين','وسط البلد',
      'الزمالك','جاردن سيتي','السيدة زينب','مصر القديمة','الخليفة','المرج','السلام','النزهة',
      'شيراتون','منشية ناصر','البساتين','دار السلام','طرة','المعصرة','التبين',
      'العاصمة الإدارية','الزاوية الحمراء','الشرابية','بولاق أبو العلا','الموسكي','الجمالية','الدرب الأحمر','مسطرد','عزبة النخل','عين الصيرة','أرض اللواء','الأميرية','المرج الجديدة','كوبري القبة','الحلمية','الظاهر','غمرة','السبتية','البستان','التجمع الأول','التجمع الثالث','القطامية','زهراء المعادي','المعراج','النرجس','اللوتس','الياسمين','بيت الوطن','الأندلس','جنوب الأكاديمية','النزهة الجديدة','هليوبوليس الجديدة','الشويفات','الدبلوماسيين'],
    'الجيزة': ['الدقي','المهندسين','العجوزة','الهرم','فيصل','6 أكتوبر','الشيخ زايد','حدائق الأهرام',
      'إمبابة','بولاق الدكرور','الوراق','أوسيم','كرداسة','البدرشين','الصف','أطفيح','العياط',
      'الحوامدية','منشأة القناطر','أبو النمرس','كفر الجبل','المنيب','الطالبية','العمرانية',
      'أكتوبر الجديدة','حدائق أكتوبر','زايد الجديدة','المريوطية','ناهيا','صفط اللبن','بشتيل','ميت عقبة','الكيت كات','السواح','الطوابق','الملك فيصل','عمرانية غرب','منشية البكاري','الوحدة العربية','اللبيني','مدكور','ترسا','نزلة السمان','كفر طهرمس','أبو رواش','الواحات البحرية','البويطي','منديشة','الحرانية','سقارة','دهشور'],
    'القليوبية': ['بنها','شبرا الخيمة','القناطر الخيرية','قليوب','الخانكة','كفر شكر','طوخ',
      'قها','العبور','الخصوص','شبين القناطر',
      'مسطرد','بهتيم','أبو زعبل','سندبيس','كفر حمزة','الشوبك','منشية عبد المنعم رياض','باسوس','طنان','أبو الغيط','ميت حلفا','كفر طحلة'],
    'الإسكندرية': ['سموحة','سيدي جابر','ميامي','العصافرة','المنتزه','المندرة','أبو قير','العجمي',
      'برج العرب','محرم بك','كامب شيزار','الإبراهيمية','سبورتنج','كليوباترا','لوران','جليم',
      'ستانلي','رشدي','بولكلي','فلمنج','باكوس','السيوف','المعمورة','الدخيلة','العامرية',
      'برج العرب الجديدة','النهضة','الطرح','خورشيد','أبيس','الحضرة','غيط العنب','كرموز','مينا البصل','العطارين','المنشية','الأنفوشي','رأس التين','بحري','الجمرك','المكس','الورديان','القباري','النزهة','زيزينيا','سان ستيفانو','جناكليس','سيدي بشر','المعمورة البلد','الطابية','الساحل الشمالي','مارينا'],
    'البحيرة': ['دمنهور','كفر الدوار','رشيد','إدكو','أبو حمص','الدلنجات','المحمودية','حوش عيسى',
      'شبراخيت','كوم حمادة','بدر','وادي النطرون','النوبارية',
      'النوبارية الجديدة','إدكو الجديدة','أبو المطامير','الرحمانية','إيتاي البارود','دمنهور الجديدة'],
    'مطروح': ['مرسى مطروح','الحمام','العلمين','الضبعة','سيدي براني','السلوم','سيوة',
      'مرسى مطروح الجديدة','النجيلة','براني','الأميد','رأس الحكمة','الحمام الجديدة','العلمين الجديدة'],
    'الغربية': ['طنطا','المحلة الكبرى','كفر الزيات','زفتى','السنطة','قطور','بسيون','سمنود',
      'المحلة الجديدة','طنطا الجديدة','شبراملس','محلة روح','كفر الزيات الجديدة','نوسا البحر'],
    'المنوفية': ['شبين الكوم','منوف','أشمون','الباجور','قويسنا','بركة السبع','تلا','السادات','الشهداء',
      'سرس الليان','منوف الجديدة','كفر داود','مليج','شبين الجديدة','السادات الجديدة'],
    'كفر الشيخ': ['كفر الشيخ','دسوق','فوه','مطوبس','بلطيم','الحامول','بيلا','الرياض','سيدي سالم','قلين',
      'كفر الشيخ الجديدة','برج البرلس','مصيف بلطيم','سيدي غازي'],
    'الدقهلية': ['المنصورة','طلخا','ميت غمر','دكرنس','أجا','منية النصر','السنبلاوين','الجمالية',
      'شربين','المطرية','بلقاس','ميت سلسيل','جمصة','محلة دمنة','نبروه',
      'المنصورة الجديدة','ميت غمر الجديدة','بني عبيد','تمي الأمديد','منية سمنود','الكردي','سندوب','ميت الكرماء','دميرة','أجا الجديدة'],
    'دمياط': ['دمياط','رأس البر','فارسكور','كفر سعد','الزرقا','السرو','دمياط الجديدة',
      'عزبة البرج','ميت أبو غالب','الروضة','كفر البطيخ'],
    'بورسعيد': ['بورسعيد','بورفؤاد','العرب','المناخ','الضواحي','الزهور','الجنوب',
      'سلام','الشرق','حي الزهور','بورفؤاد الجديدة'],
    'الإسماعيلية': ['الإسماعيلية','فايد','القنطرة شرق','القنطرة غرب','التل الكبير','أبو صوير','القصاصين',
      'الإسماعيلية الجديدة','سرابيوم','نفيشة','الشيخ زايد','أبو خليفة','القصاصين الجديدة'],
    'السويس': ['السويس','الأربعين','عتاقة','الجناين','فيصل',
      'السويس الجديدة','عتاقة الجديدة','الأدبية','عيون موسى'],
    'شمال سيناء': ['العريش','الشيخ زويد','رفح','بئر العبد','الحسنة','نخل',
      'العريش الجديدة','المساعيد','السادات','الروضة','قاطية'],
    'جنوب سيناء': ['شرم الشيخ','دهب','نويبع','طابا','سانت كاترين','أبو رديس','رأس سدر','الطور',
      'نبق','رأس محمد','الطور الجديدة','أبو زنيمة','وادي فيران','شرم الشيخ القديمة','هضبة أم السيد'],
    'الشرقية': ['الزقازيق','بلبيس','العاشر من رمضان','منيا القمح','أبو حماد','ههيا','أبو كبير',
      'فاقوس','الحسينية','صان الحجر','كفر صقر','أولاد صقر','مشتول السوق','القرين','ديرب نجم',
      'منشأة أبو عمر','الإبراهيمية','كفر أبو حماد','صفط الحنا','الصالحية الجديدة','الزقازيق الجديدة','بلبيس الجديدة','هرية رزنة'],
    'الفيوم': ['الفيوم','سنورس','إطسا','طامية','يوسف الصديق','إبشواي',
      'الفيوم الجديدة','النزلة','سيلا','قارون','تونس','كوم أوشيم','دمو'],
    'بني سويف': ['بني سويف','الواسطى','ناصر','إهناسيا','ببا','سمسطا','الفشن','بني سويف الجديدة',
      'بياض العرب','الشنطور','ببا الجديدة','مقبل','تزمنت'],
    'المنيا': ['المنيا','ملوي','بني مزار','مطاي','سمالوط','دير مواس','أبو قرقاص','مغاغة','العدوة',
      'المنيا الجديدة','ملوي الجديدة','أبو قرقاص الجديدة','تونا الجبل','الشيخ عبادة'],
    'أسيوط': ['أسيوط','ديروط','منفلوط','القوصية','أبنوب','أبو تيج','الغنايم','ساحل سليم','البداري','صدفا',
      'أسيوط الجديدة','ناصر','الفتح','منقباد','بني غالب','ريفا','الوليدية'],
    'سوهاج': ['سوهاج','أخميم','جرجا','طهطا','طما','المراغة','جهينة','دار السلام','ساقلتة','البلينا',
      'سوهاج الجديدة','أخميم الجديدة','العسيرات','المنشاة','مركز سوهاج','طهطا الجديدة'],
    'قنا': ['قنا','نجع حمادي','دشنا','قفط','قوص','نقادة','أبو تشت','فرشوط','الوقف',
      'قنا الجديدة','نجع حمادي الجديدة','الطود','الكلاحين','دندرة'],
    'الأقصر': ['الأقصر','إسنا','أرمنت','الطود','البياضية','الزينية','القرنة',
      'طيبة الجديدة','الكرنك','البر الغربي','العديسات','الحبيل','المدامود'],
    'أسوان': ['أسوان','كوم أمبو','إدفو','دراو','نصر النوبة','كلابشة','أبو سمبل',
      'أسوان الجديدة','توشكى','غرب سهيل','السيل','الشلال','خور عواضة','وادي كركر'],
    'البحر الأحمر': ['الغردقة','سفاجا','القصير','مرسى علم','رأس غارب','الشلاتين','حلايب',
      'الجونة','سهل حشيش','مكادي','رأس غارب الجديدة','بورتو غالب','وادي الجمال','برنيس'],
    'الوادي الجديد': ['الخارجة','الداخلة','الفرافرة','باريس','بلاط',
      'موط','القصر','باريس الجديدة','بولاق','تنيدة','الراشدة'],
  };
  window.EGYPT_CITIES = CITIES;


  /* ============================================================
     المدن على الخادم — بتتشارك بين كل العملاء
     ------------------------------------------------------------
     القائمة المدمجة في الملف هي نقطة البداية. أول ما صاحب
     البرنامج يفتح شاشة المناطق، بتتزرع على الخادم، وبعدها
     الكل بيقرا من هناك — فأي إضافة توصل لكل العملاء.
     ============================================================ */

  window.__srvCities = null;

  window.loadServerCities = async function(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { data, error } = await sb.from('locations')
        .select('governorate,city').eq('active', true).limit(5000);
      if (error) throw error;
      const map = {};
      (data || []).forEach(r => {
        map[r.governorate] = map[r.governorate] || [];
        map[r.governorate].push(r.city);
      });
      window.__srvCities = Object.keys(map).length ? map : {};
    }catch(e){ window.__srvCities = {}; }
  };

  /* زرع القائمة المدمجة أول مرة */
  window.seedCities = async function(){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) return showMessage('مفيش اتصال بالخادم');
    const rows = [];
    Object.entries(CITIES).forEach(([g, cs]) =>
      cs.forEach(c => rows.push({ country:'مصر', governorate:g, city:c })));
    try{
      for (let i = 0; i < rows.length; i += 200){
        const { error } = await sb.from('locations')
          .upsert(rows.slice(i, i + 200), { onConflict:'country,governorate,city' });
        if (error) throw error;
      }
      await loadServerCities();
      if (window.toast) toast(`اتزرعت ${rows.length} مدينة على الخادم`);
      if (window.renderSysContent) renderSysContent();
    }catch(e){
      showMessage('تعذّر الزرع: ' + (window.cloudErrorText ? cloudErrorText(e) : e.message));
    }
  };

  window.addServerCity = async function(gov, city){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb || !gov || !city) return;
    try{
      await sb.from('locations').upsert(
        [{ country:'مصر', governorate:gov, city:city }],
        { onConflict:'country,governorate,city' });
      await loadServerCities();
    }catch(e){}
  };

  /* ⚠️ المدن اللي المستخدمين بيضيفوها بتتحفظ محليًا وبتتضاف
     للقائمة تلقائيًا — من غير ما نعدّل الكود كل مرة. */
  const CUSTOM_KEY = 'emartna_custom_cities';

  function customCities(){
    try{ return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}'); }catch(e){ return {}; }
  }
  function addCustomCity(gov, city){
    if (!gov || !city) return;
    const all = customCities();
    all[gov] = all[gov] || [];
    if (!all[gov].includes(city) && !(CITIES[gov] || []).includes(city)){
      all[gov].push(city);
      try{ localStorage.setItem(CUSTOM_KEY, JSON.stringify(all)); }catch(e){}
    }
  }
  window.addCustomCity = addCustomCity;

  /* كل مدن المحافظة: الأصلية + اللي اتضافت + المدن المستخدمة فعلًا
     في عمارات صاحب البرنامج */
  window.citiesOf = function(gov){
    const srv = (window.__srvCities && window.__srvCities[gov]) || [];
    const base = srv.length ? srv : (CITIES[gov] || []);
    const extra = (customCities()[gov] || []);
    const used = [];
    try{
      ((window.REG && REG.buildings) || []).forEach(b => {
        if (b && b.governorate === gov && b.city && !base.includes(b.city)) used.push(b.city);
      });
    }catch(e){}
    return [...new Set([...base, ...extra, ...used])].sort((a,b) => a.localeCompare(b,'ar'));
  };


  /* ============================================================
     شاشة المناطق — الدولة · المحافظة · المدينة + إكسل
     ============================================================ */

  window.pageSysLocations = function(){
    const srv = window.__srvCities;
    if (srv === null){ setTimeout(loadServerCities, 30); return '<div class="card"><p class="small">⏳ بيحمّل…</p></div>'; }

    const govs = Object.keys(srv).length ? srv : CITIES;
    const rows = [];
    Object.entries(govs).forEach(([g, cs]) =>
      cs.forEach(c => rows.push({ country:'مصر', governorate:g, city:c })));

    const total = rows.length;
    const onServer = Object.keys(srv).length > 0;

    const cols = [
      { key:'country', label:'الدولة', value:r => r.country, cell:r => esc2(r.country) },
      { key:'gov', label:'المحافظة', value:r => r.governorate,
        cell:r => `<b>${esc2(r.governorate)}</b>` },
      { key:'city', label:'المدينة / المنطقة', value:r => r.city, cell:r => esc2(r.city) },
      { key:'used', label:'عمارات فيها', value:r => usedCount(r.governorate, r.city),
        cell:r => { const n = usedCount(r.governorate, r.city);
          return n ? `<span class="badge g">${n}</span>` : '<span class="small">—</span>'; } },
    ];

    return `
      <p class="small">قائمة المناطق اللي بتظهر لعملاءك وقت التسجيل.
      ${onServer ? 'محفوظة على الخادم وبتوصل لكل العملاء.'
                 : '⚠️ لسه محلية — اضغط "ازرع على الخادم" عشان توصل للجميع.'}</p>

      <div class="grid g3 mtop">
        <div class="card" style="text-align:center">
          <h3 style="color:var(--accent);margin:2px 0">${Object.keys(govs).length}</h3>
          <p class="small">محافظة</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${total}</h3>
          <p class="small">مدينة ومنطقة</p></div>
        <div class="card" style="text-align:center">
          <h3 style="margin:2px 0">${onServer ? '☁️' : '💾'}</h3>
          <p class="small">${onServer ? 'على الخادم' : 'محلية'}</p></div>
      </div>

      <div class="flexrow mtop" style="gap:8px;flex-wrap:wrap">
        <button class="btn primary" onclick="openAddLocation()">+ إضافة منطقة</button>
        <button class="btn ghost" onclick="downloadLocationsTemplate()">📊 تنزيل بالإكسل</button>
        <label class="btn gold" style="cursor:pointer;margin:0">
          📥 تحديث بالإكسل
          <input type="file" accept=".xlsx,.xls,.csv" style="display:none"
            onchange="handleLocationsUpload(this)"></label>
        ${!onServer ? `<button class="btn ghost" onclick="seedCities()">☁️ ازرع على الخادم</button>` : ''}
      </div>

      <div class="mtop2">${sortableTable('locTable', rows, cols, null,
        { defaultKey:'gov', emptyText:'مفيش مناطق', exportName:'المناطق' })}</div>`;
  };

  function usedCount(gov, city){
    try{
      return ((window.REG && REG.buildings) || [])
        .filter(b => b && !b.isDemo && b.governorate === gov && b.city === city).length;
    }catch(e){ return 0; }
  }

  window.openAddLocation = function(){
    const govs = Object.keys(window.__srvCities && Object.keys(window.__srvCities).length
      ? window.__srvCities : CITIES);
    openModal(`
      <h3>+ إضافة منطقة</h3>
      <div class="field2 mtop"><label>المحافظة</label>
        <select id="alGov">${govs.map(g => `<option>${esc2(g)}</option>`).join('')}</select></div>
      <div class="field2"><label>المدينة / المنطقة</label>
        <input id="alCity" placeholder="مثال: الحي المتميز"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveNewLocation()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveNewLocation = async function(){
    const g = (document.getElementById('alGov')||{}).value;
    const c = ((document.getElementById('alCity')||{}).value || '').trim();
    if (!c) return showMessage('اكتب اسم المنطقة');
    await addServerCity(g, c);
    closeModal();
    if (window.toast) toast('اتضافت المنطقة');
    if (window.renderSysContent) renderSysContent();
  };

  /* ---------- الإكسل ---------- */

  window.downloadLocationsTemplate = async function(){
    if (window.ensureXLSX) await ensureXLSX();
    if (typeof XLSX === 'undefined') return showMessage('تعذّر تحميل مكتبة الإكسل');
    const srv = window.__srvCities;
    const src = (srv && Object.keys(srv).length) ? srv : CITIES;
    const aoa = [['الدولة','المحافظة','المدينة / المنطقة']];
    Object.entries(src).forEach(([g, cs]) => cs.forEach(c => aoa.push(['مصر', g, c])));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch:12 }, { wch:18 }, { wch:26 }];
    XLSX.utils.book_append_sheet(wb, ws, 'المناطق');
    XLSX.writeFile(wb, 'مناطق-عمارتنا.xlsx');
  };

  window.handleLocationsUpload = async function(input){
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (window.ensureXLSX) await ensureXLSX();
    if (typeof XLSX === 'undefined') return showMessage('تعذّر تحميل مكتبة الإكسل');
    try{
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type:'array' });
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1 });
      const rows = [];
      aoa.slice(1).forEach(r => {
        const g = String((r && r[1]) || '').trim();
        const c = String((r && r[2]) || '').trim();
        if (g && c) rows.push({ country: String((r && r[0]) || 'مصر').trim() || 'مصر',
                                governorate:g, city:c });
      });
      if (!rows.length) return showMessage('الملف فاضي أو أعمدته مش مظبوطة');

      const before = Object.values(window.__srvCities || {}).reduce((a,v) => a + v.length, 0);
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return showMessage('مفيش اتصال بالخادم');
      for (let i = 0; i < rows.length; i += 200){
        const { error } = await sb.from('locations')
          .upsert(rows.slice(i, i + 200), { onConflict:'country,governorate,city' });
        if (error) throw error;
      }
      await loadServerCities();
      const after = Object.values(window.__srvCities || {}).reduce((a,v) => a + v.length, 0);
      showMessage(`اتقرا ${rows.length} صف — الإجمالي دلوقتي ${after} منطقة` +
        (after > before ? ` (جديد: ${after - before})` : ''));
      if (window.renderSysContent) renderSysContent();
    }catch(e){
      showMessage('تعذّر قراءة الملف: ' + e.message);
    }
  };

  /* بيبني قائمة المدن لمحافظة معيّنة */
  window.cityOptions = function(gov, selected){
    const list = citiesOf(gov);
    const cur = String(selected || '').trim();
    const known = list.includes(cur);
    return list.map(c => `<option value="${esc2(c)}" ${c === cur ? 'selected' : ''}>${esc2(c)}</option>`).join('')
      + (cur && !known ? `<option value="${esc2(cur)}" selected>${esc2(cur)}</option>` : '')
      + `<option value="__other">➕ مدينة تانية — اكتبها</option>`;
  };

  /* بيحوّل خانة المدينة لقائمة، وبيحدّثها مع تغيير المحافظة */
  /* خانة بحث + قائمة — أسرع من التمرير في ٣٩ منطقة.
     المستخدم بيكتب حرفين ويلاقي مدينته، أو يختار من القائمة. */
  window.bindCityField = function(cityId, govId){
    const cityEl = document.getElementById(cityId);
    const govEl  = document.getElementById(govId);
    if (!cityEl || !govEl || cityEl.dataset.cityBound) return;

    const cur = cityEl.value || '';
    const listId = cityId + 'List';

    const box = document.createElement('div');
    box.style.cssText = 'position:relative';
    box.innerHTML = `
      <input id="${cityId}" list="${listId}" value="${esc2(cur)}"
        placeholder="اكتب أول حروف المدينة أو اختار" autocomplete="off"
        data-city-bound="1" data-gov="${esc2(govId)}">
      <datalist id="${listId}"></datalist>`;
    cityEl.replaceWith(box);

    function fill(){
      const dl = document.getElementById(listId);
      if (!dl) return;
      dl.innerHTML = citiesOf(govEl.value)
        .map(c => `<option value="${esc2(c)}"></option>`).join('');
    }
    fill();

    /* أي مدينة جديدة بيكتبها المستخدم بتتحفظ للمرات الجاية */
    const inp = document.getElementById(cityId);
    if (inp) inp.addEventListener('change', () => {
      const v = (inp.value || '').trim();
      if (v) addCustomCity(govEl.value, v);
      fill();
    });

    if (!govEl.dataset.cityLinked){
      govEl.dataset.cityLinked = '1';
      govEl.addEventListener('change', () => {
        const i = document.getElementById(cityId);
        if (i) i.value = '';
        fill();
      });
    }
  };

  /* بنشغّلها على شاشة التسجيل وبيانات العمارة */
  function scan(){
    try{
      bindCityField('suCity', 'suGovernorate');   // تسجيل عميل جديد
      bindCityField('bCity',  'bGovernorate');   // بيانات العمارة
      bindCityField('nbCity', 'nbGovernorate');  // إنشاء عمارة من لوحة المنصة
    }catch(e){}
  }
  ['renderContent','renderSysContent','openModal','openSignup'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__cityBind) return;
    const wrapped = function(){
      const r = orig.apply(this, arguments);
      setTimeout(scan, 60);
      return r;
    };
    wrapped.__cityBind = true;
    window[fn] = wrapped;
  });
  setInterval(scan, 2000);
  setTimeout(scan, 1200);
  setTimeout(() => { try{ loadServerCities(); }catch(e){} }, 2500);

  console.log('[عمارتنا] مدن المحافظات جاهزة');
})();

})();

/* ═══ emartna-funnel.js ═══ */
(function(){
/* ============================================================
   عمارتنا — تقرير التوقف (أين يقف العملاء)
   ------------------------------------------------------------
   ١٨ عمارة سجّلت، ١١ منها واقفة عند نفس النقطة: أدخلوا الوحدات
   وما حدّدوش الاشتراك الشهري — فالبرنامج مايقدرش يولّد تحصيل،
   والعميل بيحس إنه فاضي فيسيبه.

   الشاشة دي بتوري صاحب البرنامج فين كل عميل واقف، ومعاها رقمه
   عشان يكلّمه. الرقم أهم من التقرير: البيانات بتقول "فين"،
   والمكالمة بتقول "ليه".
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const sb   = () => (window.CLOUD && window.CLOUD._sb) || null;
  const wa   = p => String(p||'').replace(/\D/g,'');

  const STAGE_COLOR = {
    '٠':'var(--red)', '١':'var(--red)', '٢':'var(--gold)',
    '٣':'var(--gold)', '٤':'var(--accent)', '٥':'var(--accent)',
  };

  window.pageSysFunnel = function(){
    if (!window.__funnelRows){
      loadFunnel();
      return '<p class="small">⏳ بيحمّل التقرير...</p>';
    }
    const rows = window.__funnelRows;
    if (!rows.length) return '<p class="small">مفيش عمارات.</p>';

    /* تجميع بالمرحلة */
    const byStage = {};
    rows.forEach(r => (byStage[r.stage] = byStage[r.stage] || []).push(r));
    const stages = Object.keys(byStage).sort();

    /* أكبر نقطة توقف */
    const stuck = {};
    rows.forEach(r => { if (r.stuck_at !== '—')
      stuck[r.stuck_at] = (stuck[r.stuck_at]||0)+1; });
    const worst = Object.entries(stuck).sort((a,b)=>b[1]-a[1])[0];

    return `
    <div class="card content-narrow">
      <h3>🎯 أين يقف العملاء</h3>
      <p class="small mtop">كل عمارة فين وصلت، وفين وقفت — ومعاها رقم رئيس
        الاتحاد عشان تكلّمه.</p>
      ${worst ? `<div class="card mtop" style="background:var(--tint-warning)">
        <b>أكبر نقطة توقف: ${esc2(worst[0])}</b>
        <div class="small">${worst[1]} عمارة من ${rows.length} واقفة هنا.
          لو اتصلت بتلاتة منهم وعرفت السبب، هتحل مشكلة ${worst[1]} عميل مرة واحدة.</div>
      </div>` : ''}
    </div>

    <div class="grid g4 mtop2">
      ${stages.map(s => `<div class="kpi" style="border-inline-start:3px solid ${
        STAGE_COLOR[s[0]] || 'var(--line)'}">
        <div class="lbl" style="font-size:11.5px">${esc2(s)}</div>
        <div class="val">${byStage[s].length}</div></div>`).join('')}
    </div>

    ${stages.slice().reverse().map(s => `
      <div class="card content-narrow mtop2">
        <h3 style="font-size:14px">${esc2(s)} — ${byStage[s].length} عمارة</h3>
        <div class="table-wrap mtop">
          <table><thead><tr>
            <th>العمارة</th><th>الوحدات</th><th>واقف عند</th>
            <th>من</th><th>رئيس الاتحاد</th><th></th>
          </tr></thead><tbody>
          ${byStage[s].map(r => `<tr>
            <td><b>${esc2(r.building_name)}</b>
              <div class="small" style="color:var(--muted)">${esc2(r.code||'')}</div></td>
            <td>${r.units}${r.units_with_fee ? '' :
              '<div class="small" style="color:var(--red)">بلا اشتراك</div>'}</td>
            <td class="small">${r.stuck_at === '—'
              ? '<span class="badge g">ماشي</span>'
              : `<span style="color:var(--red)">${esc2(r.stuck_at)}</span>`}</td>
            <td class="small">${r.days_since} يوم</td>
            <td class="small">${esc2(r.admin_name||'—')}
              <div dir="ltr" style="color:var(--muted)">${esc2(r.admin_phone||'')}</div></td>
            <td>${r.admin_phone ? `<div class="flexrow" style="gap:4px">
              <a class="btn sm ghost" href="tel:${esc2(r.admin_phone)}">📞</a>
              <a class="btn sm gold" target="_blank"
                href="https://wa.me/${wa(r.admin_phone)}?text=${
                encodeURIComponent(msgFor(r))}">💬</a></div>` : ''}</td>
          </tr>`).join('')}
          </tbody></table></div>
      </div>`).join('')}`;
  };

  /* رسالة جاهزة حسب نقطة التوقف — مش نص عام */
  function msgFor(r){
    const n = r.admin_name ? ' أ/' + r.admin_name : '';
    const base = `السلام عليكم${n} 👋\nأنا من فريق عمارتنا.\n\n`;
    if (r.units === 0)
      return base + 'شفت إنك سجّلت العمارة بس لسه ما أدخلتش الوحدات. ' +
        'تحب أساعدك أدخلها معاك؟ ممكن كمان نرفعها من ملف إكسل في دقيقة.';
    if (!r.units_with_fee)
      return base + `شفت إنك أدخلت ${r.units} وحدة — تمام كده 👍\n\n` +
        'فاضل خطوة واحدة عشان البرنامج يبدأ يشتغل معاك: تحديد ' +
        'الاشتراك الشهري للوحدات. من غيرها البرنامج مش هيقدر يولّد التحصيل.\n\n' +
        'تحب أعملها معاك دلوقتي؟';
    if (r.ledger_rows === 0)
      return base + 'العمارة جاهزة والوحدات متظبطة 👍\n\n' +
        'فاضل تسجّل أول تحصيل — بعدها هتشوف المتأخرات والتقارير شغّالة. ' +
        'تحب أوريك إزاي؟';
    if (r.residents_joined === 0)
      return base + 'البرنامج شغّال معاك 👍 فاضل تدعو السكان عشان يشوفوا ' +
        'حساباتهم ويسددوا من غير ما تكلّمهم واحد واحد. تحب أساعدك؟';
    return base + 'حبيت أطمن إن كل حاجة ماشية معاك. لو محتاج أي مساعدة أنا موجود.';
  }

  async function loadFunnel(){
    try{
      const { data, error } = await sb().rpc('onboarding_funnel');
      if (error) throw error;
      window.__funnelRows = data || [];
    }catch(e){
      window.__funnelRows = [];
      if (window.showMessage) showMessage('تعذّر التحميل: ' + (e.message||''));
    }
    if (window.renderSysContent) renderSysContent();
  }
  window.reloadFunnel = function(){ window.__funnelRows = null; loadFunnel(); };

  console.log('[عمارتنا] تقرير التوقف جاهز');
})();

})();

/* ═══ emartna-health.js ═══ */
(function(){
/* ============================================================
   عمارتنا — صحة المنصة
   ------------------------------------------------------------
   صاحب البرنامج محتاج يعرف هو فين من حدود الباقة قبل ما تفاجئه:
   القاعدة والمرفقات وأكبر الجداول.

   وسجل التدقيق بيكبر أسرع من كل حاجة — عمارة واحدة نشطة ولّدت
   ١٣ ألف صف. فالشاشة بتديه أدوات: يشوف الحجم بالشهر، ينزّل نسخة
   قبل المسح، ويمسح فترة محددة.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const sb   = () => (window.CLOUD && window.CLOUD._sb) || null;
  const MB   = n => (Number(n||0)/1048576);

  let H = null, T = null, A = null;

  async function load(){
    try{
      const s = sb(); if (!s) return;
      const [h,t,a] = await Promise.all([
        s.rpc('platform_health'),
        s.rpc('platform_tables', { p_limit:12 }),
        s.rpc('audit_by_month'),
      ]);
      H = h.data || []; T = t.data || []; A = a.data || [];
    }catch(e){ H = []; T = []; A = []; }
    if (window.renderSysContent) renderSysContent();
  }
  window.reloadPlatformHealth = function(){ H = null; load(); };

  const get = k => (H||[]).find(x => x.metric === k) || {};

  function bar(used, limit, warnAt){
    const pct = limit ? Math.min(100, used/limit*100) : 0;
    const col = pct >= 90 ? 'var(--red)' : pct >= (warnAt||70) ? 'var(--gold)' : 'var(--accent)';
    return `<div style="height:9px;background:var(--line);border-radius:5px;
      overflow:hidden;margin-top:6px">
      <div style="width:${pct}%;height:100%;background:${col}"></div></div>
      <div class="small mtop" style="color:var(--muted)">${pct.toFixed(1)}% مستخدم</div>`;
  }

  /* ===== مستخدمون بلا عمارة =====
     بيحصل لما عمارة تتحذف (العضوية CASCADE) أو المستخدم يقف قبل
     ما يكمّل التسجيل. قبل كده كانوا بيضيعوا بلا أثر. */
  window.pageSysOrphans = function(){
    if (!window.__orphans){ loadOrphans(); return '<p class="small">⏳ بيحمّل...</p>'; }
    const rows = window.__orphans;
    return `
    <div class="card content-narrow">
      <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
        <h3>👤 مستخدمون بلا عمارة</h3>
        <button class="btn sm ghost" onclick="reloadOrphans()">🔄 تحديث</button>
      </div>
      <p class="small mtop">حسابات شغّالة مش مربوطة بأي عمارة — غالبًا عمارتهم
        اتحذفت أو وقفوا قبل ما يكمّلوا. تقدر تربطهم بعمارة أو تكلّمهم.</p>
    </div>

    ${!rows.length ? `<div class="card content-narrow mtop2"
      style="text-align:center;padding:28px">
      <div style="font-size:32px">✅</div>
      <p class="mtop">كل المستخدمين مربوطين بعمارات.</p></div>` :
    `<div class="card content-narrow mtop2">
      <div class="table-wrap">
        <table><thead><tr><th>الاسم</th><th>الرقم</th><th>اتسجل</th>
          <th>عضويات سابقة</th><th></th></tr></thead><tbody>
        ${rows.map(r=>`<tr>
          <td><b>${esc2(r.name)}</b>
            ${r.email?`<div class="small" dir="ltr"
              style="color:var(--muted)">${esc2(r.email)}</div>`:''}</td>
          <td class="small" dir="ltr">${esc2(r.phone||'—')}</td>
          <td class="small">${esc2(r.created_at)}</td>
          <td>${r.had_memberships
            ? `<span class="badge y">${r.had_memberships} اتحذفت</span>`
            : '<span class="small" style="color:var(--muted)">مفيش</span>'}</td>
          <td><div class="flexrow" style="gap:5px">
            <button class="btn sm" onclick="attachUserPick('${esc2(r.user_id)}','${esc2(r.name)}')">
              🔗 اربطه بعمارة</button>
            ${r.phone?`<a class="btn sm gold" target="_blank"
              href="https://wa.me/${String(r.phone).replace(/\D/g,'')}">💬</a>`:''}
          </div></td>
        </tr>`).join('')}
        </tbody></table></div>
    </div>`}`;
  };

  async function loadOrphans(){
    try{
      const { data, error } = await sb().rpc('orphan_users');
      if (error) throw error;
      window.__orphans = data || [];
    }catch(e){ window.__orphans = []; }
    if (window.renderSysContent) renderSysContent();
  }
  window.reloadOrphans = function(){ window.__orphans = null; loadOrphans(); };

  window.attachUserPick = function(uid, name){
    const list = (window.REG && REG.buildings) || [];
    if (!list.length) return showMessage('مفيش عمارات.');
    openModal(`
      <h3>🔗 ربط ${esc2(name)} بعمارة</h3>
      <div class="field2 mtop"><label>العمارة</label>
        <select id="atBld">${list.map(b=>`<option value="${esc2(b.__uuid||b.id)}">
          ${esc2(b.name)}${b.code?' — '+esc2(b.code):''}</option>`).join('')}</select></div>
      <div class="field2"><label>الدور</label>
        <select id="atRole">
          <option value="admin">رئيس الاتحاد</option>
          <option value="deputy">نائب رئيس الاتحاد</option>
          <option value="accountant">محاسب</option>
          <option value="owner">صاحب شقة</option>
        </select></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="attachUserGo('${esc2(uid)}')">اربط</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.attachUserGo = async function(uid){
    const b = (document.getElementById('atBld')||{}).value;
    const r = (document.getElementById('atRole')||{}).value || 'admin';
    try{
      const { error } = await sb().rpc('admin_attach_user',
        { p_user:uid, p_building:b, p_role:r });
      if (error) throw error;
      closeModal(); showMessage('اتربط بالعمارة ✅');
      reloadOrphans();
    }catch(e){ showMessage(e.message||'تعذّر الربط'); }
  };

  window.pageSysHealth = function(){
    if (H === null){ load(); return '<p class="small">⏳ بيقيس المساحة...</p>'; }

    const db = get('db_size'), st = get('storage_size');
    const auditMB = MB(get('audit_size').value_num);
    const dbMB    = MB(db.value_num);
    const auditShare = dbMB ? (auditMB/dbMB*100) : 0;

    return `
    <div class="card content-narrow">
      <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
        <h3>🩺 صحة المنصة</h3>
        <button class="btn sm ghost" onclick="reloadPlatformHealth()">🔄 تحديث</button>
      </div>
      <p class="small mtop">الأرقام دي بتتقاس من السيرفر مباشرة.</p>
    </div>

    <div class="grid g2 mtop2">
      <div class="card">
        <b>🗄️ قاعدة البيانات</b>
        <div class="val" style="font-size:22px;margin-top:4px">${esc2(db.value_txt||'—')}</div>
        <div class="small" style="color:var(--muted)">من 500 م.ب (الباقة المجانية)</div>
        ${bar(db.value_num, 500*1048576)}
      </div>
      <div class="card">
        <b>📎 المرفقات</b>
        <div class="val" style="font-size:22px;margin-top:4px">${esc2(st.value_txt||'—')}</div>
        <div class="small" style="color:var(--muted)">
          من 1 ج.ب · ${esc2(get('files').value_txt||0)} ملف</div>
        ${bar(st.value_num, 1024*1048576)}
      </div>
    </div>

    ${auditShare > 40 ? `<div class="card content-narrow mtop2"
      style="background:var(--tint-warning)">
      <b>⚠️ سجل التدقيق واكل ${auditShare.toFixed(0)}% من قاعدة البيانات</b>
      <div class="small">${esc2(get('audit_rows').value_txt)} صف ·
        ${esc2(get('audit_size').value_txt)}. تقدر تنزّل نسخة وتمسح الفترات القديمة
        من تحت.</div></div>` : ''}

    <div class="card content-narrow mtop2">
      <h3 style="font-size:14px">أكبر الجداول</h3>
      <div class="table-wrap mtop">
        <table><thead><tr><th>الجدول</th><th>الصفوف</th><th>الحجم</th><th>النسبة</th>
        </tr></thead><tbody>
        ${(T||[]).map(r=>{
          const pct = db.value_num ? (r.size_bytes/db.value_num*100) : 0;
          return `<tr>
            <td class="small">${esc2(r.table_name)}</td>
            <td>${Number(r.rows_count).toLocaleString('ar-EG')}</td>
            <td>${esc2(r.size_txt)}</td>
            <td><span class="badge ${pct>30?'r':pct>10?'y':'n'}">${pct.toFixed(0)}%</span></td>
          </tr>`;
        }).join('')}
        </tbody></table></div>
    </div>

    <div class="card content-narrow mtop2">
      <h3 style="font-size:14px">🔒 سجل التدقيق المالي</h3>
      <p class="small mtop">بيسجّل مين عدّل أو حذف أي حركة مالية وإمتى —
        بيحمي رئيس الاتحاد لو حصل خلاف. بيكبر بسرعة، فينفع تمسح القديم
        <b>بعد ما تنزّل نسخة</b>.</p>

      <div class="grid g2 mtop2">
        <div class="field2"><label>من تاريخ</label>
          <input type="date" id="auFrom" value="${defFrom()}"></div>
        <div class="field2"><label>إلى تاريخ</label>
          <input type="date" id="auTo" value="${defTo()}"></div>
      </div>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn primary" onclick="auditDownload()">⬇️ نزّل نسخة (Excel)</button>
        <button class="btn red" onclick="auditPurge()">🗑 امسح الفترة</button>
      </div>
      <p class="hint">⚠️ المسح نهائي. آخر ٩٠ يوم محمية ومش هتتمسح.</p>

      <div class="table-wrap mtop2" style="max-height:34vh;overflow:auto">
        <table><thead><tr><th>الشهر</th><th>صفوف</th><th>الحجم</th><th></th>
        </tr></thead><tbody>
        ${(A||[]).map(r=>`<tr>
          <td>${esc2(r.period)}</td>
          <td>${Number(r.rows_count).toLocaleString('ar-EG')}</td>
          <td>${esc2(r.size_txt)}</td>
          <td><button class="btn sm ghost"
            onclick="auditPickMonth('${esc2(r.period)}')">اختار</button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="small">مفيش سجلات.</td></tr>'}
        </tbody></table></div>
    </div>`;
  };

  function defFrom(){
    const d = new Date(); d.setFullYear(d.getFullYear()-1);
    return d.toISOString().slice(0,10);
  }
  function defTo(){
    /* الافتراضي: لحد ٩٠ يوم فاتوا — نفس حارس الخادم */
    const d = new Date(); d.setDate(d.getDate()-91);
    return d.toISOString().slice(0,10);
  }

  window.auditPickMonth = function(period){
    const [y,m] = period.split('-').map(Number);
    const from = new Date(y, m-1, 1), to = new Date(y, m, 0);
    const f = document.getElementById('auFrom'), t = document.getElementById('auTo');
    if (f) f.value = from.toISOString().slice(0,10);
    if (t) t.value = to.toISOString().slice(0,10);
    if (window.toast) toast('اتحددت الفترة: ' + period);
  };

  window.auditDownload = async function(){
    const from = (document.getElementById('auFrom')||{}).value;
    const to   = (document.getElementById('auTo')||{}).value;
    if (!from || !to) return showMessage('اختار الفترة الأول');
    if (typeof XLSX === 'undefined') return showMessage('تعذر تحميل مكتبة إكسيل.');

    if (window.toast) toast('بنجهّز النسخة...');
    let rows = [];
    try{
      const { data, error } = await sb().rpc('audit_export', { p_from:from, p_to:to });
      if (error) throw error;
      rows = data || [];
    }catch(e){ return showMessage(e.message || 'تعذّر التصدير'); }

    if (!rows.length) return showMessage('مفيش سجلات في الفترة دي.');

    const cols = ['العمارة','الجدول','العملية','مين عملها','التاريخ والوقت','التفاصيل'];
    const body = rows.map(r => [
      r.building_name, r.table_name,
      ({INSERT:'إضافة',UPDATE:'تعديل',DELETE:'حذف'})[r.op] || r.op,
      r.changed_by_name,
      new Date(r.changed_at).toLocaleString('ar-EG'),
      JSON.stringify(r.changes || {}),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([cols, ...body]);
    ws['!cols'] = [24,16,10,22,22,80].map(w=>({wch:w}));
    ws['!views'] = [{ RTL:true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل التدقيق');
    XLSX.writeFile(wb, `سجل التدقيق ${from} إلى ${to}.xlsx`);
    showMessage(`اتنزّلت النسخة — ${rows.length} سجل.\n\n` +
      'احفظها في مكان آمن قبل ما تمسح.');
  };

  window.auditPurge = function(){
    const from = (document.getElementById('auFrom')||{}).value;
    const to   = (document.getElementById('auTo')||{}).value;
    if (!from || !to) return showMessage('اختار الفترة الأول');

    confirmAction(
      `مسح سجل التدقيق من ${from} إلى ${to}؟\n\n` +
      '⚠️ المسح نهائي ومش بيرجع.\n' +
      'لو حصل خلاف على حركة في الفترة دي، مش هتقدر تثبت مين عدّلها.\n\n' +
      'نزّلت نسخة الأول؟',
      async () => {
        try{
          const { data, error } = await sb().rpc('audit_purge',
            { p_from:from, p_to:to });
          if (error) throw error;
          showMessage(`اتمسح ${data} سجل.\n\n` +
            'المساحة هترجع خلال ساعات مع التنظيف الدوري للقاعدة.');
          reloadPlatformHealth();
        }catch(e){ showMessage(e.message || 'تعذّر المسح'); }
      });
  };

  console.log('[عمارتنا] صحة المنصة جاهزة');
})();

})();

/* ═══ emartna-phone.js ═══ */
(function(){
/* ============================================================
   عمارتنا — قائمة إجراءات الرقم
   ------------------------------------------------------------
   الأرقام منتشرة في ٣٢ موضع عبر ١٢ شاشة، وكل واحد بسلوك مختلف:
   بعضها زرار اتصال، بعضها واتساب، وبعضها نص ساكن مالوش أي إجراء.

   بدل ما نعدّل ٣٢ مكان، بنمسح الصفحة بعد كل رسم ونحوّل أي رقم
   موبايل لعنصر قابل للضغط بقائمة موحّدة:
     نسخ · اتصال · واتساب · واتساب برسالة جاهزة

   المسح بالنمط (regex) مش بتعديل الشاشات — فأي شاشة جديدة
   بتتغطى تلقائيًا من غير شغل إضافي.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* أرقام مصرية ودولية: 01xxxxxxxxx · +20xxxxxxxxxx · 00201xxxxxxxxx */
  /* بنشيل المسافات والشرط قبل الفحص — الأرقام بتتكتب بصيغ كتير
     (0100 123 4567 · 0100-123-4567) والنمط لازم يقبلهم كلهم. */
  const RE = /^(?:\+?\d{1,4})?0?1[0125]\d{8}$|^\+\d{10,15}$/;
  const looksPhone = t => RE.test(String(t||'').replace(/[\s\-()]/g,''));
  const digits = s => String(s||'').replace(/\D/g,'');

  /* توحيد الرقم لصيغة واتساب — الرقم المصري بيبدأ بـ20 */
  function waNum(raw){
    let d = digits(raw);
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('01') && d.length === 11) d = '20' + d.slice(1);
    if (d.startsWith('1') && d.length === 10) d = '20' + d;
    return d;
  }

  /* ---------- القائمة ---------- */

  window.openPhoneMenu = function(evt, raw, name){
    evt.preventDefault();
    evt.stopPropagation();
    closePhoneMenu();

    const num = waNum(raw);
    const pretty = String(raw||'').trim();
    const who = name ? ' — ' + name : '';
    const r = evt.currentTarget.getBoundingClientRect();

    const el = document.createElement('div');
    el.id = 'phoneMenu';
    const W = Math.min(260, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8);
    el.style.cssText = `position:fixed;top:${r.bottom+6}px;left:${left}px;
      width:${W}px;background:var(--card);border:1px solid var(--line);
      border-radius:12px;padding:5px;z-index:1200;display:flex;
      flex-direction:column;gap:2px;box-shadow:0 8px 26px rgba(0,0,0,.2)`;

    const item = (ic,label,onclick,sub) => `<button class="btn ghost"
      style="width:100%;justify-content:flex-start;gap:10px;padding:9px 11px;
        text-align:start" onclick="${onclick}">
      <span style="font-size:15px;flex:0 0 auto">${ic}</span>
      <span style="flex:1"><b style="font-size:13px">${label}</b>
      ${sub?`<div class="small" style="color:var(--muted)">${sub}</div>`:''}</span>
    </button>`;

    /* ⚠️ قوالب الرسائل دي تسويقية — بتاعة صاحب البرنامج وحده.
       رئيس الاتحاد مالهوش دعوة بيها، ولو ظهرتله هيبعت نص موجّه
       لعميل محتمل لساكن في عمارته. */
    const isOwner = !!(window.isSysOwner && isSysOwner());

    el.innerHTML =
      `<div class="small" style="padding:7px 11px 5px;color:var(--muted);
        border-bottom:1px solid var(--line);margin-bottom:3px">
        <span dir="ltr">${esc2(pretty)}</span>${esc2(who)}</div>` +
      item('📋','نسخ الرقم',`copyPhone('${esc2(pretty)}')`) +
      item('📞','اتصال',`location.href='tel:${esc2(digits(raw))}';closePhoneMenu()`) +
      item('💬','واتساب',`openWa('${num}','')`) +
      (isOwner ? item('📨','واتساب برسالة جاهزة',
           `closePhoneMenu();pickPhoneTemplate('${num}','${esc2(name||'')}')`,
           'تختار من قوالبك') : '');

    document.body.appendChild(el);
    const h = el.offsetHeight;
    if (r.bottom + 6 + h > window.innerHeight - 8)
      el.style.top = Math.max(8, r.top - h - 6) + 'px';

    setTimeout(()=>document.addEventListener('click', closePhoneMenu, {once:true}), 0);
  };

  window.closePhoneMenu = function(){
    const m = document.getElementById('phoneMenu'); if (m) m.remove();
  };

  window.copyPhone = function(p){
    try{ navigator.clipboard.writeText(p); if (window.toast) toast('اتنسخ الرقم'); }
    catch(e){ if (window.showMessage) showMessage('الرقم: ' + p); }
    closePhoneMenu();
  };

  window.openWa = function(num, text){
    const url = 'https://wa.me/' + num + (text ? '?text=' + encodeURIComponent(text) : '');
    window.open(url, '_blank');
    closePhoneMenu();
  };

  /* ---------- اختيار قالب ---------- */

  window.pickPhoneTemplate = function(num, name){
    /* حارس تاني: حتى لو حد نادى الدالة مباشرة */
    if (!(window.isSysOwner && isSysOwner())) return;
    let list = [];
    try{ list = (window.ensureMessageTemplates ? ensureMessageTemplates() : []) || []; }
    catch(e){}

    if (!list.length){
      return showMessage('مفيش قوالب رسائل لسه.\n\n' +
        'تقدر تضيفها من: التواصل مع العملاء ← قوالب الرسائل.');
    }

    const cats = (window.MESSAGE_CATEGORIES || []);
    const catLabel = k => (cats.find(c=>c.key===k)||{}).label || k;
    const byCat = {};
    list.forEach(t => (byCat[t.category] = byCat[t.category] || []).push(t));

    openModal(`
      <h3>📨 اختار رسالة</h3>
      <p class="small mtop">هتتبعت على واتساب${name?' لـ'+esc2(name):''}
        <span dir="ltr">(${esc2(num)})</span> — وتقدر تعدّلها قبل الإرسال.</p>

      ${Object.keys(byCat).map(c=>`
        <div class="mtop2"><b class="small">${esc2(catLabel(c))}</b>
          ${byCat[c].map(t=>`<div class="card mtop" style="cursor:pointer"
            onclick="sendTemplateWa('${esc2(num)}','${esc2(t.id)}','${esc2(name||'')}')">
            <b class="small">${esc2(t.title)}</b>
            <div class="small" style="color:var(--muted);white-space:pre-wrap;
              max-height:44px;overflow:hidden">${esc2(String(t.body||'').slice(0,110))}…</div>
          </div>`).join('')}
        </div>`).join('')}

      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.sendTemplateWa = function(num, tplId, name){
    let body = '';
    try{
      const t = (ensureMessageTemplates()||[]).find(x=>String(x.id)===String(tplId));
      body = t ? String(t.body||'') : '';
    }catch(e){}
    /* استبدال المتغيّرات المتاحة */
    try{
      const b = (window.D && D.building) || {};
      body = body
        .replace(/\{اسم_العمارة\}/g, b.name || '')
        .replace(/\{اسم_المستخدم\}/g, name || '')
        .replace(/\{اسم_العميل\}/g, name || '');
    }catch(e){}
    closeModal();
    openWa(num, body);
  };

  /* ---------- تحويل الأرقام في الصفحة ---------- */

  function enhance(){
    try{
      /* ١) الروابط الموجودة أصلًا: نخليها تفتح القائمة بدل الإجراء المباشر */
      document.querySelectorAll('a[href^="tel:"]:not([data-ph])').forEach(a=>{
        a.setAttribute('data-ph','1');
        const num = a.getAttribute('href').replace('tel:','');
        a.addEventListener('click', e => openPhoneMenu(e, num, ''));
      });

      /* ٢) الأرقام المكتوبة كنص — بنحوّلها لعنصر قابل للضغط.
         بنمشي على عناصر النص الصغيرة بس عشان ما نلمسش محتوى كبير. */
      const sel = 'td,span,div.small,b,.hint';
      document.querySelectorAll(sel).forEach(el=>{
        if (el.dataset.phScan) return;
        if (el.children.length) return;              // فيه عناصر جوّه — نسيبه
        const txt = (el.textContent||'').trim();
        if (txt.length < 9 || txt.length > 24) return;
        if (!looksPhone(txt)) return;
        if (digits(txt).length < 10) return;
        el.dataset.phScan = '1';
        el.style.cursor = 'pointer';
        el.style.textDecoration = 'underline dotted';
        el.title = 'اضغط للاتصال أو واتساب';
        el.addEventListener('click', e => openPhoneMenu(e, txt, ''));
      });
    }catch(e){}
  }

  setInterval(enhance, 1100);
  document.addEventListener('emartna:building-complete',
    () => setTimeout(enhance, 700));

  console.log('[عمارتنا] قائمة إجراءات الرقم جاهزة');
})();

})();

/* ═══ emartna-receipt.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — إيصال السداد
   ------------------------------------------------------------
   الساكن بيقول «أنا دفعت»، ورئيس الاتحاد بيدوّر في واتساب على
   صورة التحويل. الإيصال هنا بيتحفظ جنب القيد نفسه.

   ⚠️ إيصال السداد مستند إثبات — مستثنى من الأرشفة التلقائية،
   عكس مرفقات المحادثة. مساره doc/ مش chat/.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const sb   = () => (window.CLOUD && window.CLOUD._sb) || null;
  const bUuid= () => { try{ return CLOUD._cache.buildingUuid[window.activeBuildingId] || null; }
                       catch(e){ return null; } };

  const MAX = 5 * 1024 * 1024;
  const OK  = ['image/jpeg','image/png','image/webp','application/pdf'];
  const kb  = n => !n ? '' : n < 1048576 ? Math.round(n/1024)+' ك.ب'
                                          : (n/1048576).toFixed(1)+' م.ب';

  /* ضغط الصور قبل الرفع — الإيصال مش محتاج دقة كاميرا كاملة */
  async function shrink(file){
    if (!file.type.startsWith('image/')) return file;
    try{
      const img = await new Promise((res,rej)=>{
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej;
        i.src = URL.createObjectURL(file);
      });
      const max = 1400;
      const sc = Math.min(1, max/Math.max(img.width, img.height));
      if (sc === 1 && file.size < 700*1024) return file;
      const c = document.createElement('canvas');
      c.width = Math.round(img.width*sc); c.height = Math.round(img.height*sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.75));
      URL.revokeObjectURL(img.src);
      return (blob && blob.size < file.size) ? blob : file;
    }catch(e){ return file; }
  }

  /* الرفع: بيربط الملف بالقيد بعد ما يتزامن */
  window.uploadPaymentReceipt = async function(file, entry){
    const s = sb(), b = bUuid();
    if (!s || !b) throw new Error('مش متصل بالسحابة');
    if (file.size > MAX) throw new Error('الملف أكبر من ٥ ميجا');
    if (file.type && !OK.includes(file.type))
      throw new Error('نوع الملف مش مدعوم — صورة أو PDF');

    const prog = document.getElementById('pRecProg');
    if (prog) prog.textContent = '⏳ بنرفع الإيصال...';

    const blob = await shrink(file);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0,6);
    const path = `doc/${b}/rcpt_${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;

    const { error } = await s.storage.from('attachments')
      .upload(path, blob, { contentType: blob.type || file.type });
    if (error){
      const m = String(error.message||'');
      if (/policy|row-level|violates/i.test(m))
        throw new Error('المساحة خلصت — فرّغ مساحة من: الإعدادات ← مساحة المرفقات');
      throw error;
    }

    /* بنحفظ المسار على العنصر المحلي — المزامنة بترفعه للقاعدة */
    entry.attPath = path;
    entry.attName = file.name;
    entry.attKind = blob.type || file.type;
    entry.attSize = blob.size;
    if (window.save) save();
    if (prog) prog.textContent = '';
    return path;
  };

  /* رفع إيصال لدفعة موجودة */
  window.attachReceiptTo = function(localId){
    const e = (D.ledger||[]).find(x => x.id === localId);
    if (!e) return;
    openModal(`
      <h3>🧾 إيصال السداد</h3>
      <p class="small mtop">${esc2(e.note||'دفعة')} — ${window.money?money(e.amount):e.amount}</p>
      <div class="field2 mtop"><label>اختار الإيصال</label>
        <input type="file" id="rcFile" accept="image/*,.pdf">
        <p class="hint">صورة أو PDF · لحد ٥ ميجا · الصور بتتضغط تلقائيًا.</p></div>
      <div id="rcProg" class="small" style="color:var(--muted)"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveReceiptFor('${esc2(localId)}')">
          💾 ارفع</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.saveReceiptFor = async function(localId){
    const e = (D.ledger||[]).find(x => x.id === localId);
    const f = (document.getElementById('rcFile')||{}).files;
    if (!e || !f || !f[0]) return showMessage('اختار ملف الأول');
    const prog = document.getElementById('rcProg');
    try{
      if (prog) prog.textContent = '⏳ بنرفع...';
      await uploadPaymentReceipt(f[0], e);
      closeModal(); toast('اترفع الإيصال');
      if (window.renderContent) renderContent();
    }catch(err){
      if (prog) prog.textContent = '';
      showMessage(err.message || 'تعذّر الرفع');
    }
  };

  /* عرض الإيصال */
  window.viewReceipt = async function(localId){
    const e = (D.ledger||[]).find(x => x.id === localId);
    if (!e || !e.attPath) return showMessage('مفيش إيصال مرفق.');
    let url = null;
    try{
      const { data, error } = await sb().storage.from('attachments')
        .createSignedUrl(e.attPath, 3600);
      if (error) throw error;
      url = data.signedUrl;
    }catch(err){ return showMessage('تعذّر فتح الإيصال: ' + (err.message||'')); }

    const isImg = String(e.attKind||'').startsWith('image/');
    openModal(`
      <div class="flexrow" style="justify-content:space-between;gap:8px">
        <b style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;
          text-overflow:ellipsis">🧾 ${esc2(e.attName||'إيصال')}</b>
        <a class="btn sm ghost" href="${url}" target="_blank" download>⬇️ تنزيل</a>
      </div>
      <p class="small mtop" style="color:var(--muted)">
        ${esc2(e.date||'')} · ${window.money?money(e.amount):e.amount}
        ${e.attSize?' · '+kb(e.attSize):''}</p>
      <div class="mtop" style="background:#f4f6f5;border-radius:10px;overflow:hidden">
        ${isImg
          ? `<img src="${url}" style="width:100%;display:block;max-height:70vh;
               object-fit:contain">`
          : `<iframe src="${url}" style="width:100%;height:70vh;border:0"></iframe>`}
      </div>
      <div class="modal-actions">
        ${guardActionSilent('collections','delete')
          ? `<button class="btn red" onclick="removeReceipt('${esc2(localId)}')">
              🗑 شيل الإيصال</button>` : ''}
        <button class="btn primary" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  window.removeReceipt = function(localId){
    const e = (D.ledger||[]).find(x => x.id === localId);
    if (!e || !e.attPath) return;
    confirmAction('شيل الإيصال؟ الدفعة هتفضل زي ما هي.', async () => {
      try{
        await sb().storage.from('attachments').remove([e.attPath]);
        e.attPath = null; e.attName = null; e.attKind = null; e.attSize = null;
        save(); closeModal(); toast('اتشال الإيصال');
        if (window.renderContent) renderContent();
      }catch(err){ showMessage(err.message || 'تعذّر الحذف'); }
    });
  };

  /* شارة الإيصال في الجداول وتفاصيل القيد */
  window.receiptBadge = function(e){
    if (!e) return '';
    if (e.attPath)
      return `<button class="btn sm ghost" title="عرض الإيصال"
        onclick="event.stopPropagation();viewReceipt('${esc2(e.id)}')"
        style="padding:2px 7px">🧾</button>`;
    if (e.type === 'دفعة' && window.guardActionSilent
        && guardActionSilent('collections','edit'))
      return `<button class="btn sm ghost" title="ارفع إيصال"
        onclick="event.stopPropagation();attachReceiptTo('${esc2(e.id)}')"
        style="padding:2px 7px;opacity:.45">＋</button>`;
    return '';
  };

  /* ============================================================
     الضغط الأرشيفي
     ------------------------------------------------------------
     الإيصال مستند إثبات — ما بيتحذفش أبدًا. لكن بعد ٦ شهور بيتضغط
     أقوى: ٨٠٠ بكسل بجودة ٦٠٪. الإيصال يفضل مقروء تمامًا والحجم
     ينزل ~٨٠٪ (٣٠٠ ك.ب → ٦٠ ك.ب).

     ده بيخلي ٢٠ ميجا تستوعب ٣٣٠ إيصال بدل ٦٦ — من غير ما تخسر
     أي دليل.
     ============================================================ */
  async function shrinkHard(blob){
    const img = await new Promise((res,rej)=>{
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej;
      i.src = URL.createObjectURL(blob);
    });
    const max = 800;
    const sc = Math.min(1, max/Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width*sc); c.height = Math.round(img.height*sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise(r => c.toBlob(r, 'image/webp', 0.60));
    URL.revokeObjectURL(img.src);
    return out;
  }

  async function compressOld(){
    try{
      const s = sb(), b = bUuid();
      if (!s || !b) return;
      if (!window.guardActionSilent
          || !guardActionSilent('collections','edit')) return;

      const { data, error } = await s.rpc('docs_to_compress', { p_building:b });
      if (error || !data || !data.length) return;

      let saved = 0, n = 0;
      for (const r of data.slice(0, 10)){
        try{
          /* بننزّل الأصل، نضغطه، ونرفعه في نفس المسار */
          const { data:sig } = await s.storage.from('attachments')
            .createSignedUrl(r.path, 300);
          if (!sig) continue;
          const orig = await (await fetch(sig.signedUrl)).blob();
          const small = await shrinkHard(orig);
          if (!small || small.size >= orig.size){
            /* مفيش فايدة — بنعلّمه خلاص عشان ما نعيدش المحاولة */
            await s.rpc('mark_doc_compressed',
              { p_source:r.source, p_id:r.id, p_new_size:orig.size });
            continue;
          }
          const { error:upErr } = await s.storage.from('attachments')
            .upload(r.path, small, { contentType:'image/webp', upsert:true });
          if (upErr) continue;
          await s.rpc('mark_doc_compressed',
            { p_source:r.source, p_id:r.id, p_new_size:small.size });
          saved += (orig.size - small.size); n++;
        }catch(e){}
      }
      if (n && window.toast)
        toast(`اتضغط ${n} مستند قديم — وفّرنا ${Math.round(saved/1024)} ك.ب`);
    }catch(e){}
  }

  /* بتشتغل بهدوء بعد ما البرنامج يستقر — مش أولوية */
  setTimeout(compressOld, 25000);
  document.addEventListener('emartna:building-complete',
    () => setTimeout(compressOld, 25000));

  console.log('[عمارتنا] إيصال السداد جاهز');
})();

})();

/* ═══ emartna-retention.js ═══ */
(function(){
/* ============================================================
   عمارتنا — سياسة حفظ المرفقات
   ------------------------------------------------------------
   السياسة كانت مكتوبة في الكود — أي تغيير يحتاج رفع ملف.
   دلوقتي صاحب البرنامج بيغيّرها من لوحته:
     • المساحة لكل باقة
     • مدة أرشفة مرفقات المحادثة
     • مدة ضغط المستندات المحاسبية
   مع استثناء لعمارة بعينها لو عميل طلب.

   ⚠️ الحذف مش خيار هنا بالتصميم: المستندات المحاسبية إثبات،
   والضغط بيحل مشكلة المساحة من غير ما يضيّع الدليل.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const sb   = () => (window.CLOUD && window.CLOUD._sb) || null;

  let P = null, O = null;

  async function load(){
    try{
      const s = sb(); if (!s) return;
      const [p,o] = await Promise.all([
        s.rpc('retention_policies'),
        s.rpc('retention_overrides'),
      ]);
      P = p.data || []; O = o.data || [];
    }catch(e){ P = []; O = []; }
    if (window.renderSysContent) renderSysContent();
  }
  window.reloadRetention = function(){ P = null; load(); };

  window.pageSysRetention = function(){
    if (P === null){ load(); return '<p class="small">⏳ بيحمّل السياسة...</p>'; }

    return `
    <div class="card content-narrow">
      <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
        <h3>🗄️ سياسة حفظ المرفقات</h3>
        <button class="btn sm ghost" onclick="reloadRetention()">🔄 تحديث</button>
      </div>
      <p class="small mtop">التغيير بيسري على كل عملاء الباقة فورًا —
        من غير رفع أي ملف.</p>
    </div>

    <div class="card content-narrow mtop2" style="background:var(--tint)">
      <b class="small">السياسة الحالية</b>
      <div class="small mtop" style="line-height:2">
        <div>💬 <b>مرفقات المحادثة</b> — بتتأرشف بعد المدة المحددة
          (الرسالة بتفضل مكانها)</div>
        <div>🧾 <b>إيصالات السداد ومستندات المصروفات</b> —
          <b style="color:var(--accent)">للأبد</b>، بتتضغط بس بعد المدة المحددة</div>
        <div>🗂️ <b>كشوف المصروفات الشهرية</b> —
          <b style="color:var(--accent)">للأبد</b>، بلا ضغط ولا أرشفة</div>
      </div>
      <p class="small mtop" style="color:var(--muted)">
        المستندات المحاسبية إثبات قانوني — الحذف مش متاح بالتصميم.
        الضغط بينزّل الحجم ٨٠٪ والإيصال يفضل مقروء.</p>
    </div>

    <div class="card content-narrow mtop2">
      <h3 style="font-size:14px">السياسة لكل باقة</h3>
      <div class="table-wrap mtop">
        <table><thead><tr>
          <th>الباقة</th><th>عملاء</th><th>المساحة (م.ب)</th>
          <th>أرشفة المحادثة (يوم)</th><th>ضغط المستندات (شهر)</th><th></th>
        </tr></thead><tbody>
        ${(P||[]).map(r=>`<tr>
          <td><b>${esc2(r.plan_name)}</b></td>
          <td>${r.clients ? `<span class="badge g">${r.clients}</span>`
                : '<span class="small" style="color:var(--muted)">—</span>'}</td>
          <td><input type="number" min="5" max="5000" style="width:82px"
            id="st_${esc2(r.plan_key)}" value="${r.storage_mb}"></td>
          <td><input type="number" min="1" max="3650" style="width:82px"
            id="cd_${esc2(r.plan_key)}" value="${r.chat_days}"></td>
          <td><input type="number" min="1" max="120" style="width:82px"
            id="cm_${esc2(r.plan_key)}" value="${r.compress_months}"></td>
          <td><button class="btn sm primary"
            onclick="saveRetentionFor('${esc2(r.plan_key)}')">💾</button></td>
        </tr>`).join('')}
        </tbody></table></div>
      <p class="hint">المساحة ٥ م.ب على الأقل · الأرشفة يوم على الأقل ·
        الضغط شهر على الأقل.</p>
    </div>

    <div class="card content-narrow mtop2">
      <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
        <h3 style="font-size:14px">استثناءات لعمارات بعينها</h3>
        <button class="btn sm" onclick="pickBuildingOverride()">+ استثناء</button>
      </div>
      ${!O || !O.length
        ? '<p class="small mtop" style="color:var(--muted)">مفيش استثناءات — كل العمارات على سياسة باقتها.</p>'
        : `<div class="table-wrap mtop">
        <table><thead><tr><th>العمارة</th><th>الاستهلاك</th>
          <th>مساحة إضافية</th><th>أرشفة</th><th>ضغط</th><th></th>
        </tr></thead><tbody>
        ${O.map(r=>`<tr>
          <td><b>${esc2(r.building_name)}</b>
            <div class="small" style="color:var(--muted)">${esc2(r.code||'')}</div></td>
          <td class="small">${r.used_mb} / ${r.quota_mb} م.ب</td>
          <td class="small">${r.storage_extra != null
            ? '+'+r.storage_extra+' م.ب' : '—'}</td>
          <td class="small">${r.chat_days != null ? r.chat_days+' يوم' : '—'}</td>
          <td class="small">${r.compress_months != null ? r.compress_months+' شهر' : '—'}</td>
          <td><button class="btn sm ghost"
            onclick="editBuildingOverride('${esc2(r.building_id)}','${esc2(r.building_name)}')">
            ✏️</button></td>
        </tr>`).join('')}
        </tbody></table></div>`}
    </div>`;
  };

  window.saveRetentionFor = async function(key){
    const num = id => {
      const el = document.getElementById(id);
      const v = el ? Number(el.value) : null;
      return (v && v > 0) ? v : null;
    };
    try{
      const { error } = await sb().rpc('save_retention', {
        p_plan: key,
        p_storage:   num('st_'+key),
        p_chat_days: num('cd_'+key),
        p_months:    num('cm_'+key),
      });
      if (error) throw error;
      if (window.toast) toast('اتحفظت — سارية على كل عملاء الباقة');
      reloadRetention();
    }catch(e){ showMessage(e.message || 'تعذّر الحفظ'); }
  };

  window.pickBuildingOverride = function(){
    const list = (window.REG && REG.buildings) || [];
    if (!list.length) return showMessage('مفيش عمارات.');
    openModal(`
      <h3>استثناء لعمارة</h3>
      <div class="field2 mtop"><label>العمارة</label>
        <select id="ovBld">${list.map(b=>`<option value="${esc2(b.__uuid||b.id)}">
          ${esc2(b.name)}${b.code?' — '+esc2(b.code):''}</option>`).join('')}</select></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="
          (function(){var s=document.getElementById('ovBld');
           var t=s.options[s.selectedIndex].text;
           closeModal();editBuildingOverride(s.value,t);})()">التالي</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.editBuildingOverride = function(id, name){
    const cur = (O||[]).find(x => x.building_id === id) || {};
    openModal(`
      <h3>⚙️ ${esc2(name)}</h3>
      <p class="small mtop">سيب الخانة فاضية عشان العمارة تمشي على سياسة باقتها.</p>
      <div class="field2 mtop"><label>مساحة إضافية (م.ب)</label>
        <input type="number" id="ovSt" min="0" max="5000"
          value="${cur.storage_extra != null ? cur.storage_extra : ''}"
          placeholder="فاضي = بلا إضافة"></div>
      <div class="field2"><label>أرشفة المحادثة (يوم)</label>
        <input type="number" id="ovCd" min="1" max="3650"
          value="${cur.chat_days != null ? cur.chat_days : ''}"
          placeholder="فاضي = حسب الباقة"></div>
      <div class="field2"><label>ضغط المستندات (شهر)</label>
        <input type="number" id="ovCm" min="1" max="120"
          value="${cur.compress_months != null ? cur.compress_months : ''}"
          placeholder="فاضي = حسب الباقة"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveBuildingOverride('${esc2(id)}')">
          💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  window.saveBuildingOverride = async function(id){
    const val = i => {
      const el = document.getElementById(i);
      const v = el && el.value !== '' ? Number(el.value) : null;
      return (v != null && v >= 0) ? v : null;
    };
    try{
      const { error } = await sb().rpc('save_building_retention', {
        p_building: id,
        p_storage_extra: val('ovSt'),
        p_chat_days:     val('ovCd'),
        p_months:        val('ovCm'),
      });
      if (error) throw error;
      closeModal();
      if (window.toast) toast('اتحفظ الاستثناء');
      reloadRetention();
    }catch(e){ showMessage(e.message || 'تعذّر الحفظ'); }
  };

  console.log('[عمارتنا] سياسة حفظ المرفقات جاهزة');
})();

})();

/* ═══ emartna-monthclose.js ═══ */
(function(){
/* ============================================================
   عمارتنا — إقفال الشهر
   ------------------------------------------------------------
   رئيس الاتحاد مش محاسب. كان بيقفل الشهر من غير ما يعرف إيه اللي
   المفروض يراجعه، فالإقفال بقى إجراء شكلي.

   دلوقتي البرنامج بيفحص بنفسه: خزائن سالبة، وحدات ما اتفوترتش،
   دفعات مش داخلة خزينة، مصروفات غير مصنّفة، مبالغ شاذة.

   ⚠️ ملاحظة مهمة في التصميم: «مراجعة السكان» بتفرّق بين تلات
   حالات — راجع وموافق، راجع ومعترض، وما دخلش أصلًا. السكوت
   مش موافقة، والشاشة بتوضّح ده صراحةً عشان ما يتبنيش عليه
   استنتاج غلط.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const sb   = () => (window.CLOUD && window.CLOUD._sb) || null;
  const bUuid= () => { try{ return CLOUD._cache.buildingUuid[window.activeBuildingId] || null; }
                       catch(e){ return null; } };

  const AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
              'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const mLabel = p => { const [y,m]=String(p).split('-').map(Number);
                        return (AR[m-1]||p)+' '+y; };

  const SEV = {
    error:{ic:'🛑', color:'var(--red)',   label:'لازم يتصلح'},
    warn: {ic:'⚠️', color:'var(--gold)',  label:'يستاهل مراجعة'},
    info: {ic:'💡', color:'var(--muted)', label:'للعلم'},
  };

  let ST = null;

  function lastClosableMonth(){
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1);
    return d.toISOString().slice(0,7);
  }

  async function load(period){
    const s = sb(), b = bUuid();
    if (!s || !b){ ST = { period, checks:[], ack:null }; return; }
    try{
      const [c,a] = await Promise.all([
        s.rpc('month_close_checks', { p_building:b, p_month:period }),
        s.rpc('month_ack_summary',  { p_building:b, p_month:period }),
      ]);
      ST = { period, checks:c.data||[], ack:(a.data&&a.data[0])||null };
    }catch(e){ ST = { period, checks:[], ack:null }; }
    if (window.renderContent) renderContent();
  }

  window.pageMonthClose = function(){
    const period = (ST && ST.period) || lastClosableMonth();
    if (!ST || ST.period !== period){ load(period); return '<p class="small">⏳ بيفحص...</p>'; }

    const checks = ST.checks || [];
    const errors = checks.filter(c => c.severity === 'error');
    const warns  = checks.filter(c => c.severity === 'warn');
    const ack    = ST.ack || {};
    const locked = isLocked(period);

    /* شهور متاحة للإقفال */
    const months = [];
    const d = new Date(); d.setDate(1);
    for (let i=1; i<=12; i++){
      const x = new Date(d); x.setMonth(x.getMonth()-i);
      months.push(x.toISOString().slice(0,7));
    }

    return `
    <div class="card content-narrow">
      <h3>🔒 إقفال الشهر</h3>
      <p class="small mtop">البرنامج بيفحص حسابات الشهر قبل ما تقفله —
        فالإقفال يبقى مراجعة فعلية مش إجراء شكلي.</p>

      <div class="field2 mtop2"><label>الشهر</label>
        <select onchange="mcPick(this.value)">
          ${months.map(m=>`<option value="${m}" ${m===period?'selected':''}>
            ${esc2(mLabel(m))}${isLocked(m)?' — مقفول ✅':''}</option>`).join('')}
        </select></div>
    </div>

    ${locked ? `<div class="card content-narrow mtop2"
      style="background:var(--tint);border:1px solid var(--accent)">
      <b>✅ ${esc2(mLabel(period))} مقفول</b>
      <div class="small mtop">مفيش تعديل ممكن على حركات الشهر ده.
        فك الإقفال بيطلب سبب مكتوب وبيتسجّل.</div>
      <button class="btn ghost mtop" onclick="go('periods')">
        إدارة الفترات المقفولة</button>
    </div>` : `

    <div class="card content-narrow mtop2">
      <h3 style="font-size:14px">نتيجة الفحص</h3>
      ${!checks.length
        ? `<div class="card mtop" style="background:var(--tint);text-align:center;
            padding:22px">
            <div style="font-size:32px">✅</div>
            <b class="mtop" style="display:block">كل الفحوصات سليمة</b>
            <div class="small">مفيش ملاحظات على حسابات الشهر ده.</div>
          </div>`
        : checks.map(c=>{
            const v = SEV[c.severity] || SEV.info;
            /* ⚠️ الرقم المبهم مالوش فايدة — الضغط بيفتح الوحدات
               أو الحركات المعنية بالظبط مع إرشاد للإصلاح. */
            return `<div class="card mtop" style="border-inline-start:3px solid ${v.color};
              cursor:pointer" onclick="mcDetail('${esc2(period)}','${esc2(c.code)}','${
              esc2(c.label)}')">
              <div class="flexrow" style="gap:9px;align-items:flex-start">
                <span style="font-size:18px">${v.ic}</span>
                <div style="flex:1">
                  <b>${esc2(c.label)}</b>
                  <span class="badge ${c.severity==='error'?'r':c.severity==='warn'?'y':'n'}"
                    style="margin-inline-start:6px">${c.count_n}</span>
                  <div class="small mtop" style="color:var(--muted)">
                    ${esc2(c.detail||'')}</div>
                </div>
                <span style="color:var(--muted);font-size:13px">شوف التفاصيل ←</span>
              </div></div>`;
          }).join('')}
    </div>

    <div class="card content-narrow mtop2">
      <h3 style="font-size:14px">مراجعة السكان</h3>
      <p class="small mtop">كل ساكن بيقدر يراجع حسابه ويأكّد أو يعترض.</p>
      <div class="grid g3 mtop2">
        <div class="kpi"><div class="ic">✅</div><div class="lbl">راجعوا وأكّدوا</div>
          <div class="val">${ack.reviewed||0}</div></div>
        <div class="kpi ${ack.disputed?'owe':''}"><div class="ic">⚠️</div>
          <div class="lbl">عندهم اعتراض</div>
          <div class="val">${ack.disputed||0}</div></div>
        <div class="kpi"><div class="ic">⏳</div><div class="lbl">ما دخلوش</div>
          <div class="val">${ack.silent||0}</div></div>
      </div>
      <p class="small mtop2" style="color:var(--muted)">
        ⚠️ <b>«ما دخلوش» مش معناها موافقة</b> — معناها إنهم ما فتحوش
        حساباتهم. التأكيد بيتحسب للي ضغط «راجعت وموافق» بس.</p>
      ${(ack.silent||0) > 0 ? `<button class="btn ghost mtop"
        onclick="mcRemind('${esc2(period)}')">💬 ذكّر اللي ما دخلوش</button>` : ''}
    </div>

    <div class="card content-narrow mtop2">
      ${errors.length ? `<div class="card" style="background:var(--tint-warning)">
        <b>🛑 فيه ${errors.length} ملاحظة لازم تتصلح قبل الإقفال</b>
        <div class="small">الإقفال بيمنع التعديل — فالأفضل تصلحها الأول.</div>
      </div>` : ''}
      <div class="field2 mtop"><label>ملاحظات الإقفال (اختياري)</label>
        <textarea id="mcNote" rows="2"
          placeholder="مثال: اتراجع مع المحاسب يوم ٣/١٠"></textarea></div>
      <button class="btn ${errors.length?'':'primary'} mtop" style="width:100%"
        onclick="mcClose('${esc2(period)}')">
        🔒 اقفل ${esc2(mLabel(period))}${errors.length?' رغم الملاحظات':''}</button>
      <p class="hint">الإقفال بيمنع أي تعديل على حركات الشهر.
        فكّه ممكن بسبب مكتوب بيتسجّل.</p>
    </div>`}`;
  };

  function isLocked(p){
    try{
      return (D.periodLocks||[]).some(x =>
        String(x.period||'').slice(0,7) === p);
    }catch(e){ return false; }
  }

  window.mcPick = function(p){ ST = null; load(p); };

  window.mcClose = async function(period){
    const note = ((document.getElementById('mcNote')||{}).value||'').trim();
    const checks = (ST && ST.checks) || [];
    const errors = checks.filter(c => c.severity === 'error');
    const msg = errors.length
      ? `اقفل ${mLabel(period)} رغم ${errors.length} ملاحظة حرجة؟\n\n` +
        errors.map(c=>'• '+c.label+' ('+c.count_n+')').join('\n') +
        '\n\nبعد الإقفال مش هتقدر تعدّل حركات الشهر ده.'
      : `اقفل ${mLabel(period)}؟\n\nكل الفحوصات سليمة.\n` +
        'بعد الإقفال مش هتقدر تعدّل حركات الشهر ده.';

    confirmAction(msg, async () => {
      try{
        /* بنسجّل نتيجة الفحص وقت الإقفال — دليل إن الشهر اتراجع */
        const summary = checks.length
          ? checks.map(c=>c.label+':'+c.count_n).join(' · ')
          : 'كل الفحوصات سليمة';
        const full = (note ? note + ' — ' : '') + summary;

        D.periodLocks = D.periodLocks || [];
        D.periodLocks.push({
          id: uid(), period: period + '-01', note: full,
          lockedAt: new Date().toISOString(),
        });
        save();
        toast('اتقفل ' + mLabel(period));
        ST = null; load(period);
      }catch(e){ showMessage(e.message || 'تعذّر الإقفال'); }
    });
  };

  /* تفاصيل الملاحظة: الوحدات أو الحركات المعنية + إزاي تصلحها */
  window.mcDetail = async function(period, code, label){
    const s = sb(), b = bUuid();
    if (!s || !b) return;
    openModal('<h3>⏳ بنجيب التفاصيل...</h3>');
    let rows = [];
    try{
      const { data, error } = await s.rpc('month_check_detail',
        { p_building:b, p_month:period, p_code:code });
      if (error) throw error;
      rows = data || [];
    }catch(e){ return showMessage(e.message || 'تعذّر جلب التفاصيل'); }

    if (!rows.length) return showMessage('مفيش تفاصيل — يمكن اتصلحت خلاص.');

    const hint = rows[0].hint || '';
    const M = n => window.money ? money(Number(n)||0) : (Number(n)||0);
    /* الوجهة حسب نوع الملاحظة */
    const goTo = {
      neg_account:'treasury', missing_charge:'collections',
      payment_no_account:'collections', expense_no_cat:'expenses',
      payment_no_receipt:'collections', odd_expense:'expenses',
    }[code] || 'collections';

    openModal(`
      <h3>${esc2(label)}</h3>
      <div class="card mtop" style="background:var(--tint-warning)">
        <b class="small">🛠️ إزاي تصلحها</b>
        <div class="small">${esc2(hint)}</div>
      </div>

      <p class="small mtop2"><b>${rows.length}</b> عنصر</p>
      <div class="table-wrap mtop" style="max-height:42vh;overflow:auto">
        <table style="font-size:12.5px"><thead><tr>
          <th>البند</th><th>التفاصيل</th><th>المبلغ</th>
        </tr></thead><tbody>
        ${rows.map(r=>`<tr>
          <td><b>${esc2(r.title||'')}</b></td>
          <td class="small">${esc2(r.subtitle||'')}</td>
          <td>${r.amount!=null?M(r.amount):'—'}</td>
        </tr>`).join('')}
        </tbody></table></div>

      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal();go('${goTo}')">
          ← روح أصلحها</button>
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  window.mcRemind = function(period){
    showMessage('💬 تذكير السكان\n\n' +
      'افتح: التواصل مع الملاك ← الإعلانات، واكتب إعلان يطلب منهم ' +
      'مراجعة حساباتهم عن ' + mLabel(period) + '.\n\n' +
      'الساكن هيلاقي زرار «راجعت حسابي» في شاشة حسابه.');
  };

  /* ===== مراجعة الساكن =====
     ⚠️ الرصيد بيتجمّد على آخر يوم في الشهر المراجَع — مش الرصيد
     الحالي. الساكن اللي بيراجع يوم ١٠ أكتوبر لازم يشوف رصيده يوم
     ٣٠ سبتمبر، وإلا بيوافق على رقم مختلف.

     وبتغطي آخر ٣ شهور مش الشهر اللي فات بس — اللي فاته شهر
     يقدر يلحقه. */
  let PEND = null;

  async function loadPending(ap){
    try{
      const s = sb(); if (!s || !ap) return;
      const uuid = ap.__uuid; if (!uuid) return;
      const { data } = await s.rpc('my_pending_acks', { p_apartment: uuid });
      PEND = { apId: ap.id, rows: data || [] };
      if (window.renderContent) renderContent();
      if (window.paintAckNav) paintAckNav();
    }catch(e){ PEND = { apId: ap && ap.id, rows: [] }; }
  }

  window.pendingAckCount = function(){
    return (PEND && PEND.rows) ? PEND.rows.length : 0;
  };

  window.monthAckCardHTML = function(ap){
    if (!ap) return '';
    if (!PEND || PEND.apId !== ap.id){ loadPending(ap); return ''; }
    if (!PEND.rows.length) return '';

    const r = PEND.rows[0];          /* الأقدم أولًا */
    const more = PEND.rows.length - 1;
    const M = n => window.money ? money(Number(n)||0) : (Number(n)||0);
    const open = Number(r.opening)||0, close = Number(r.closing)||0;

    /* المعادلة قدام الساكن: أول الشهر + المستحق − المدفوع = آخر الشهر.
       الرقم لوحده مالوش معنى — الصورة الكاملة هي اللي بتخليه يطابق. */
    const row = (lbl, val, sign, color) => `
      <div class="flexrow" style="justify-content:space-between;padding:6px 0;
        border-bottom:1px solid var(--line)">
        <span class="small">${lbl}</span>
        <b style="${color?'color:'+color:''}">${sign||''}${M(val)}</b>
      </div>`;

    return `<div class="card" style="border:1px solid var(--gold);
      background:var(--tint-warning)">
      <div class="flexrow" style="gap:10px;align-items:flex-start">
        <span style="font-size:20px">📋</span>
        <div style="flex:1;min-width:0">
          <b>طابق حسابك عن ${esc2(mLabel(r.period))}</b>
          <p class="small" style="color:var(--muted)">
            دي أرقام الشهر ده وحده — مش رصيدك دلوقتي.</p>

          <div class="card mtop" style="background:var(--card)">
            ${row('رصيد أول الشهر', open)}
            ${row('مستحقات الشهر', r.charges, '+', 'var(--red)')}
            ${row('اللي دفعته', r.payments, '−', 'var(--accent)')}
            <div class="flexrow" style="justify-content:space-between;
              padding-top:8px">
              <b>رصيد آخر الشهر</b>
              <b style="font-size:16px;color:${close>0?'var(--red)':'var(--accent)'}">
                ${M(close)}${close>0?' عليك':close<0?' لك':''}</b>
            </div>
          </div>

          <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
            <button class="btn primary sm"
              onclick="ackMonth('${esc2(ap.id)}','${esc2(r.period)}','ok')">
              ✅ طابقت وموافق</button>
            <button class="btn sm"
              onclick="ackDispute('${esc2(ap.id)}','${esc2(r.period)}')">
              ⚠️ عندي ملاحظة</button>
            ${r.moves?`<button class="btn ghost sm"
              onclick="showMonthDetail('${esc2(ap.id)}','${esc2(r.period)}')">
              📄 ${r.moves} حركة</button>`:''}
          </div>
          ${more>0?`<p class="small mtop" style="color:var(--muted)">
            وكمان ${more} شهر مستني المطابقة.</p>`:''}
        </div>
      </div></div>`;
  };

  window.showMonthDetail = async function(apId, period){
    const ap = (D.apartments||[]).find(x => x.id === apId);
    if (!ap || !ap.__uuid) return;
    let st = null;
    try{
      const { data } = await sb().rpc('my_month_statement',
        { p_apartment: ap.__uuid, p_month: period });
      st = (data && data[0]) || null;
    }catch(e){}
    if (!st) return showMessage('تعذّر جلب الكشف.');

    const rows = (D.ledger||[])
      .filter(l => l.apartmentId === apId
                && String(l.date||'').slice(0,7) === period)
      .sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const M = n => window.money ? money(n) : n;

    openModal(`
      <h3>📄 حركات ${esc2(mLabel(period))}</h3>
      <div class="card mtop" style="background:var(--tint)">
        <div class="grid g2 small">
          <div><b>رصيد أول الشهر:</b> ${M(st.opening)}</div>
          <div><b>مستحقات الشهر:</b> ${M(st.charges)}</div>
          <div><b>اللي دفعته:</b> ${M(st.payments)}</div>
          <div><b>رصيد آخر الشهر:</b>
            <b style="color:${Number(st.closing)>0?'var(--red)':'var(--accent)'}">
            ${M(st.closing)}</b></div>
        </div>
      </div>
      <div class="table-wrap mtop2" style="max-height:44vh;overflow:auto">
        <table><thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead>
        <tbody>${rows.length?rows.map(l=>`<tr>
          <td class="small">${esc2(l.date)}</td>
          <td class="small">${esc2(l.note||l.type)}</td>
          <td><b style="color:${l.type==='دفعة'?'var(--accent)':'var(--red)'}">
            ${l.type==='دفعة'?'−':'+'}${M(l.amount)}</b></td>
        </tr>`).join(''):'<tr><td colspan="3" class="small">مفيش حركات.</td></tr>'}
        </tbody></table></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`, true);
  };

  window.ackMonth = async function(apId, period, status, note){
    const ap = (D.apartments||[]).find(x => x.id === apId);
    if (!ap || !ap.__uuid)
      return showMessage('الوحدة لسه بتتزامن — جرّب بعد لحظات.');

    /* ⚠️ الرصيد تراكمي: اللي بيوافق على رصيد آخر أكتوبر بيوافق
       ضمنًا على كل اللي قبله. بس المطابقة إقرار — فبنسأله صراحةً
       بدل ما نسجّل نيابةً عنه. */
    const older = (PEND && PEND.rows || []).filter(r => r.period < period);
    if (status === 'ok' && older.length){
      window.__ackCtx = { ap, period, status, note };
      return openModal(`
        <h3>✅ طابقت ${esc2(mLabel(period))}</h3>
        <p class="small mtop">فيه <b>${older.length} شهر</b> قبله لسه
          ما طابقتهمش:</p>
        <div class="card mtop" style="background:var(--tint)">
          ${older.map(r => `<div class="flexrow" style="justify-content:space-between;
            padding:5px 0;border-bottom:1px solid var(--line)">
            <span class="small">${esc2(mLabel(r.period))}</span>
            <b class="small">${window.money?money(r.closing):r.closing}</b>
          </div>`).join('')}
        </div>
        <p class="small mtop" style="color:var(--muted)">
          الرصيد اللي وافقت عليه دلوقتي <b>ناتج من الشهور دي كلها</b> —
          يعني موافقتك عليه معناها إنها مظبوطة.</p>
        <div class="modal-actions">
          <button class="btn primary" onclick="ackGo(true)">
            ✅ اعتبرها كلها متطابقة</button>
          <button class="btn ghost" onclick="ackGo(false)">
            الشهر ده بس</button>
        </div>`, true);
    }
    doAck(ap, period, status, note, false);
  };

  window.ackGo = function(cascade){
    const c = window.__ackCtx; if (!c) return;
    closeModal();
    doAck(c.ap, c.period, c.status, c.note, cascade);
  };

  async function doAck(ap, period, status, note, cascade){
    try{
      const fn = cascade ? 'ack_month_cascade' : 'ack_month';
      const { data, error } = await sb().rpc(fn, {
        p_apartment: ap.__uuid, p_month: period,
        p_status: status, p_note: note || null });
      if (error) throw error;
      PEND = null;
      const extra = (cascade && data) ? ` ومعاها ${data} شهر سابق` : '';
      showMessage(status === 'ok'
        ? '✅ اتسجّلت مطابقتك عن ' + mLabel(period) + extra + ' — شكرًا.'
        : '⚠️ اتسجّلت ملاحظتك ووصلت لرئيس الاتحاد.');
      loadPending(ap);
    }catch(e){ showMessage(e.message || 'تعذّر التسجيل'); }
  }

  window.ackDispute = function(apId, period){
    openModal(`
      <h3>⚠️ ملاحظة على حساب ${esc2(mLabel(period))}</h3>
      <div class="field2 mtop"><label>إيه الملاحظة؟</label>
        <textarea id="ackNote" rows="3"
          placeholder="مثال: دفعت ٥٠٠ يوم ١٢ ومش ظاهرة في كشفي"></textarea></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="
          (function(){var n=document.getElementById('ackNote').value.trim();
           if(!n)return showMessage('اكتب ملاحظتك');
           closeModal();ackMonth('${esc2(apId)}','${esc2(period)}','dispute',n);})()">
          إرسال</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  };

  /* ===== شارة في القائمة الجانبية =====
     الكارت في الصفحة الرئيسية بس مش كفاية — الساكن ممكن يكون في
     شاشة تانية. الشارة بتفضل باينة لحد ما يطابق. */
  window.paintAckNav = function(){
    try{
      const n = pendingAckCount();
      document.querySelectorAll('.nav-subitem[data-page="home"]').forEach(el => {
        let b = el.querySelector('.ack-dot');
        if (!n){ if (b) b.remove(); return; }
        if (!b){
          b = document.createElement('span');
          b.className = 'ack-dot badge r';
          b.style.cssText = 'margin-inline-start:auto;font-size:10px;padding:1px 6px';
          el.appendChild(b);
        }
        b.textContent = n;
        b.title = 'مطابقة الحساب مستنية';
      });
    }catch(e){}
  };
  setInterval(() => { try{ paintAckNav(); }catch(e){} }, 1500);

  document.addEventListener('emartna:building-complete',
    () => { ST = null; PEND = null; });

  console.log('[عمارتنا] إقفال الشهر جاهز');
})();

})();

/* ═══ emartna-matchgrid.js ═══ */
(async function(){
/* ============================================================
   عمارتنا — مطابقة الوحدات شهر بشهر
   ------------------------------------------------------------
   شاشة إقفال الشهر كانت بتدّي أرقام مجمّعة: كام طابق وكام لأ.
   رئيس الاتحاد محتاج يعرف مين بالظبط عشان يكلّمه.

   الشبكة دي: كل وحدة في صف، وكل شهر في عمود، والخانة فيها
   الرصيد وحالة المطابقة. والضغط على الخانة بيفتح خيارات:
   مطابقة تليفونية أو كشف حساب كامل.

   ⚠️ المطابقة التليفونية بتتسجّل بعلامة واضحة إن الإدارة هي اللي
   سجّلتها — عشان ما تختلطش بمطابقة الساكن بنفسه.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const sb   = () => (window.CLOUD && window.CLOUD._sb) || null;
  const bUuid= () => { try{ return CLOUD._cache.buildingUuid[window.activeBuildingId] || null; }
                       catch(e){ return null; } };
  const M    = n => window.money ? money(Number(n)||0) : (Number(n)||0);

  const AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
              'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const mShort = p => { const [y,m]=String(p).split('-').map(Number);
                        return (AR[m-1]||p); };

  let G = null, MONTHS = 6, FILTER = 'all';

  async function load(){
    const s = sb(), b = bUuid();
    if (!s || !b){ G = []; return; }
    try{
      const { data, error } = await s.rpc('month_match_grid',
        { p_building: b, p_months: MONTHS });
      if (error) throw error;
      G = data || [];
    }catch(e){ G = []; }
    if (window.renderContent) renderContent();
  }
  window.reloadMatchGrid = function(){ G = null; load(); };

  window.mgMonths = function(n){
    MONTHS = n; G = null;
    /* ⚠️ الأعمدة بتتبني من الشهور — لو اتغيّر عددها، حالة الأعمدة
       المحفوظة بتبقى قديمة وبتخفي أعمدة جديدة. بنمسحها. */
    try{
      ['matchGrid_order','matchGrid_vis','matchGrid_widths','matchGrid_filters']
        .forEach(k => { localStorage.removeItem(k); delete window[k]; });
    }catch(e){}
    load();
  };
  window.mgFilter = function(f){ FILTER = f; renderContent(); };

  window.pageMatchGrid = function(){
    if (G === null){ load(); return '<p class="small">⏳ بيحمّل المطابقات...</p>'; }

    /* تجميع: وحدة → شهر */
    const units = {}, periods = [];
    G.forEach(r => {
      if (!periods.includes(r.period)) periods.push(r.period);
      const u = units[r.apartment_id] = units[r.apartment_id] || {
        id:r.apartment_id, no:r.unit_no, label:r.unit_label, floor:r.floor,
        owner:r.owner_name, phone:r.owner_phone,
        tenant:r.tenant_name, tphone:r.tenant_phone, cells:{},
      };
      u.cells[r.period] = { bal:r.closing, st:r.status,
                            note:r.note, at:r.acked_at, by:r.acked_by };
    });
    periods.sort();
    let list = Object.values(units).sort((a,b)=>a.no-b.no);

    /* فلترة */
    const pending = u => periods.some(p => (u.cells[p]||{}).st === 'none');
    const disputed = u => periods.some(p => (u.cells[p]||{}).st === 'dispute');
    if (FILTER === 'pending')  list = list.filter(pending);
    if (FILTER === 'disputed') list = list.filter(disputed);
    if (FILTER === 'owing')    list = list.filter(u =>
      Number((u.cells[periods[periods.length-1]]||{}).bal||0) > 0);

    const total = Object.keys(units).length;
    const nDone = G.filter(r=>r.status==='ok').length;
    const nDisp = G.filter(r=>r.status==='dispute').length;
    const nNone = G.filter(r=>r.status==='none').length;

    /* الأعمدة بتتبني من الشهور — فالبحث والترتيب والتصدير بيشتغلوا
       عليها زي أي جدول في البرنامج. */
    const cols = [
      { key:'unit', label:'الوحدة', value:u=>u.no,
        cell:u=>`<b>${esc2(u.label)}</b>${u.floor
          ?`<div class="small" style="color:var(--muted)">${esc2(u.floor)}</div>`:''}` },
      { key:'owner', label:'المالك', value:u=>u.owner||'',
        cell:u=>`${esc2(u.owner||'—')}${u.tenant
          ?`<div class="small" style="color:var(--muted)">🔑 ${esc2(u.tenant)}</div>`:''}` },
      { key:'phone', label:'الهاتف', value:u=>u.phone||'',
        cell:u=>u.phone?`<span class="small" dir="ltr">${esc2(u.phone)}</span>`:'—' },
    ];

    periods.forEach(p => {
      cols.push({
        key:'m_'+p, label:mShort(p),
        /* الترتيب بالرصيد — الأهم للمستخدم */
        value:u=>Number((u.cells[p]||{}).bal)||0,
        cell:u=>{
          const c = u.cells[p] || {};
          const bal = Number(c.bal)||0;
          const ic = c.st==='ok' ? '✅' : c.st==='dispute' ? '⚠️' : '⏳';
          const col = c.st==='ok' ? 'var(--accent)'
                    : c.st==='dispute' ? 'var(--red)' : 'var(--muted)';
          return `<span style="cursor:pointer;display:inline-block;text-align:center"
            onclick="event.stopPropagation();mgCell('${esc2(u.id)}','${esc2(p)}')"
            title="${c.st==='ok'?'مطابق':c.st==='dispute'?'عليه اعتراض':'لسه ما طابقش'}">
            <span style="color:${bal>0?'var(--red)':'var(--text)'}">${M(bal)}</span>
            <span style="margin-inline-start:4px">${ic}</span></span>`;
        },
      });
    });

    /* عمود الحالة العامة — بيخلي البحث بكلمة «لسه» أو «اعتراض» شغّال */
    cols.push({ key:'state', label:'الحالة',
      value:u=>{
        const st = periods.map(p=>(u.cells[p]||{}).st);
        return st.includes('dispute') ? 'اعتراض'
             : st.includes('none') ? 'لسه ما طابق' : 'مطابق';
      },
      cell:u=>{
        const st = periods.map(p=>(u.cells[p]||{}).st);
        return st.includes('dispute') ? '<span class="badge r">اعتراض</span>'
             : st.includes('none') ? '<span class="badge y">لسه</span>'
             : '<span class="badge g">مطابق</span>';
      } });

    return `
    <div class="card content-narrow">
      <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
        <h3>📊 مطابقة الوحدات شهر بشهر</h3>
        <button class="btn sm ghost" onclick="reloadMatchGrid()">🔄</button>
      </div>
      <p class="small mtop">رصيد كل وحدة في كل شهر، ومين طابق ومين لأ.
        اضغط على أي خانة للتفاصيل أو المطابقة تليفونيًا.</p>

      <div class="flexrow mtop2" style="gap:6px;flex-wrap:wrap">
        ${[[1,'آخر شهر'],[3,'3 شهور'],[6,'6 شهور'],[12,'سنة']]
          .map(([n,l])=>`<button class="btn sm ${MONTHS===n?'primary':'ghost'}"
            onclick="mgMonths(${n})">${l}</button>`).join('')}
      </div>
      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        ${[['all','الكل'],['pending','لسه ما طابقوش'],
           ['disputed','عندهم اعتراض'],['owing','عليهم متأخرات']]
          .map(([k,l])=>`<button class="btn sm ${FILTER===k?'':'ghost'}"
            onclick="mgFilter('${k}')">${l}</button>`).join('')}
      </div>

      ${periods.length?`<div class="flexrow mtop2" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm gold" onclick="mgBulkSettled('${
          esc2(periods[periods.length-1])}')">
          ⚡ اقفل المسدّدين في ${esc2(mShort(periods[periods.length-1]))}</button>
      </div>
      <p class="hint">الوحدات اللي رصيدها صفر مفيش خلاف عليها — تقدر تقفلها مرة واحدة.</p>`:''}
    </div>

    <div class="grid g4 mtop2">
      <div class="kpi"><div class="ic">🏢</div><div class="lbl">وحدات</div>
        <div class="val">${total}</div></div>
      <div class="kpi"><div class="ic">✅</div><div class="lbl">مطابقات</div>
        <div class="val">${nDone}</div></div>
      <div class="kpi ${nDisp?'owe':''}"><div class="ic">⚠️</div>
        <div class="lbl">اعتراضات</div><div class="val">${nDisp}</div></div>
      <div class="kpi"><div class="ic">⏳</div><div class="lbl">لسه</div>
        <div class="val">${nNone}</div></div>
    </div>

    <div class="mtop2">
      ${sortableTable('matchGrid', list, cols, null, {
        defaultKey:'unit',
        emptyText:'مفيش وحدات مطابقة للفلتر ده',
        exportName:'مطابقة الوحدات',
      })}
      <p class="hint">✅ طابق · ⚠️ عليه اعتراض · ⏳ لسه ما طابقش —
        اضغط على أي رصيد للتفاصيل</p>
    </div>`;
  };

  /* ===== مطابقة جماعية للمسدّدين =====
     الوحدة اللي رصيدها صفر مفيش خلاف عليها — مفيش مبلغ محل نزاع.
     فتقفيلها جماعيًا آمن، ويوفّر على رئيس الاتحاد ٩٠ مكالمة.
     ⚠️ اللي عليهم متأخرات مستثناة — دول اللي محتاجين مراجعة فعلية. */
  window.mgBulkSettled = function(period){
    const rows = (G||[]).filter(r => r.period === period
      && r.status === 'none' && Math.abs(Number(r.closing)||0) < 0.5);
    if (!rows.length)
      return showMessage('مفيش وحدات مسدّدة ومستنية مطابقة في الشهر ده.');

    confirmAction(
      `اقفل مطابقة ${rows.length} وحدة رصيدها صفر في ${mLabel(period)}؟\n\n` +
      'الوحدات اللي عليها متأخرات مش هتتقفل — دي محتاجة مراجعة معاهم.\n\n' +
      'هتتسجّل باسمك كمطابقة إدارية.',
      async () => {
        let done = 0;
        for (const r of rows){
          try{
            await sb().rpc('ack_on_behalf', {
              p_apartment: r.apartment_id, p_month: period,
              p_status: 'ok', p_note: 'رصيد صفر — مفيش خلاف' });
            done++;
          }catch(e){}
        }
        showMessage(`✅ اتقفلت ${done} وحدة.`);
        reloadMatchGrid();
      });
  };

  /* ---------- خيارات الخانة ---------- */

  window.mgCell = function(apId, period){
    const r = (G||[]).find(x => x.apartment_id === apId && x.period === period);
    if (!r) return;
    const bal = Number(r.closing)||0;
    const st = r.status;

    openModal(`
      <h3>🚪 ${esc2(r.unit_label)} — ${esc2(mShort(period))} ${esc2(period.slice(0,4))}</h3>
      <p class="small" style="color:var(--muted)">${esc2(r.owner_name||'')}
        ${r.tenant_name?' · 🔑 '+esc2(r.tenant_name):''}</p>

      <div class="card mtop2" style="background:var(--tint)">
        <div class="flexrow" style="justify-content:space-between">
          <span class="small"><b>رصيد آخر الشهر</b></span>
          <b style="font-size:17px;color:${bal>0?'var(--red)':'var(--accent)'}">
            ${M(bal)}${bal>0?' عليه':bal<0?' له':''}</b>
        </div>
        <div class="flexrow mtop" style="justify-content:space-between">
          <span class="small"><b>حالة المطابقة</b></span>
          <span>${st==='ok'?'<span class="badge g">✅ طابق</span>'
            : st==='dispute'?'<span class="badge r">⚠️ عليه اعتراض</span>'
            : '<span class="badge">⏳ لسه ما طابقش</span>'}</span>
        </div>
        ${r.note?`<p class="small mtop" style="color:var(--muted)">
          ${esc2(r.note)}</p>`:''}
        ${r.acked_at?`<p class="small" style="color:var(--muted)">
          ${esc2(new Date(r.acked_at).toLocaleString('ar-EG'))}
          ${r.acked_by?' · '+esc2(r.acked_by):''}</p>`:''}
      </div>

      <div class="flexrow mtop2" style="gap:6px;flex-wrap:wrap">
        <button class="btn primary sm"
          onclick="mgStatement('${esc2(apId)}','${esc2(period)}')">
          📄 كشف الحساب</button>
        ${st!=='ok' ? `<button class="btn sm"
          onclick="mgPhoneAck('${esc2(apId)}','${esc2(period)}')">
          📞 مطابقة تليفونية</button>` : ''}
        ${r.owner_phone?`<a class="btn sm gold" target="_blank"
          href="https://wa.me/${String(r.owner_phone).replace(/\\D/g,'')}?text=${
          encodeURIComponent(waText(r))}">💬 واتساب</a>`:''}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  function waText(r){
    const bal = Number(r.closing)||0;
    return `السلام عليكم${r.owner_name?' أ/'+r.owner_name:''} 👋\n\n` +
      `بخصوص حساب ${r.unit_label} عن ${mShort(r.period)} ${r.period.slice(0,4)}:\n` +
      `الرصيد: ${bal} جنيه${bal>0?' مستحق':''}\n\n` +
      'برجاء مراجعة الحساب وتأكيده من التطبيق، أو الرد علينا لو فيه أي ملاحظة.';
  }

  window.mgPhoneAck = async function(apId, period){
    /* بنجيب الشهور اللي هتتقفل تبعًا عشان نوري الرقم قبل التأكيد —
       المستخدم لازم يعرف إنه بيقفل ٢٠ شهر مش شهر واحد. */
    let older = [];
    try{
      const { data } = await sb().rpc('ack_cascade_preview',
        { p_apartment: apId, p_month: period });
      older = data || [];
    }catch(e){}

    const M2 = n => window.money ? money(Number(n)||0) : (Number(n)||0);
    openModal(`
      <h3>📞 مطابقة مع صاحب الوحدة</h3>
      <p class="small mtop">بتسجّل إنك راجعت الحساب معاه — تليفونيًا أو وجاهة.
        هتتسجّل باسمك.</p>

      <div class="field2 mtop2"><label>النتيجة</label>
        <select id="mgSt">
          <option value="ok">✅ راجع وموافق</option>
          <option value="dispute">⚠️ عنده ملاحظة</option>
        </select></div>
      <div class="field2"><label>ملاحظة (اختياري)</label>
        <input id="mgNote" placeholder="مثال: اتكلمنا يوم 3/10"></div>

      ${older.length ? `
      <label class="checkline mtop2" style="align-items:flex-start">
        <input type="checkbox" id="mgCascade" checked>
        <span><b>اقفل الشهور السابقة كمان (${older.length} شهر)</b>
          <div class="small" style="color:var(--muted)">
            الرصيد تراكمي — الموافقة على رصيد ${esc2(mShort(period))}
            معناها إن اللي قبله مظبوط.</div>
          <div class="card mtop" style="max-height:110px;overflow:auto;
            background:var(--tint);padding:8px">
            ${older.map(r=>`<div class="flexrow small"
              style="justify-content:space-between;padding:3px 0">
              <span>${esc2(mShort(r.period))} ${esc2(r.period.slice(0,4))}</span>
              <b>${M2(r.closing)}</b></div>`).join('')}
          </div>
        </span>
      </label>` : ''}

      <div class="modal-actions">
        <button class="btn primary" onclick="mgSaveAck('${esc2(apId)}','${esc2(period)}')">
          💾 سجّل المطابقة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.mgSaveAck = async function(apId, period){
    const st = (document.getElementById('mgSt')||{}).value || 'ok';
    const note = ((document.getElementById('mgNote')||{}).value||'').trim();
    const cascade = !!(document.getElementById('mgCascade')||{}).checked;
    try{
      const fn = cascade ? 'ack_on_behalf_cascade' : 'ack_on_behalf';
      const { data, error } = await sb().rpc(fn, {
        p_apartment: apId, p_month: period,
        p_status: st, p_note: note || null });
      if (error) throw error;
      closeModal();
      showMessage(cascade && data > 1
        ? `✅ اتسجّلت المطابقة — واتقفل معاها ${data-1} شهر سابق.`
        : '✅ اتسجّلت المطابقة');
      reloadMatchGrid();
    }catch(e){ showMessage(e.message || 'تعذّر التسجيل'); }
  };

  /* ---------- كشف حساب الوحدة ---------- */

  window.mgStatement = function(apId, period){
    const d1 = period + '-01';
    const d2 = new Date(Number(period.slice(0,4)), Number(period.slice(5,7)), 0)
      .toISOString().slice(0,10);
    window.__mgFrom = d1; window.__mgTo = d2; window.__mgAp = apId;
    renderStatement();
  };

  window.mgSetRange = function(k, v){
    if (k === 'from') window.__mgFrom = v; else window.__mgTo = v;
    renderStatement();
  };
  window.mgQuick = function(months){
    const to = new Date(), from = new Date();
    from.setMonth(from.getMonth() - months);
    window.__mgFrom = from.toISOString().slice(0,10);
    window.__mgTo   = to.toISOString().slice(0,10);
    renderStatement();
  };

  async function renderStatement(){
    const apId = window.__mgAp, from = window.__mgFrom, to = window.__mgTo;
    const u = (G||[]).find(x => x.apartment_id === apId) || {};
    openModal('<h3>⏳ بنجهّز الكشف...</h3>');
    let rows = [];
    try{
      const { data, error } = await sb().rpc('unit_statement',
        { p_apartment: apId, p_from: from, p_to: to });
      if (error) throw error;
      rows = data || [];
    }catch(e){ return showMessage(e.message || 'تعذّر جلب الكشف'); }

    const open = rows.length
      ? Number(rows[0].running) - (rows[0].entry_type==='دفعة'||rows[0].entry_type==='صرف'
          ? -Number(rows[0].amount) : Number(rows[0].amount))
      : 0;
    const close = rows.length ? Number(rows[rows.length-1].running) : open;
    const ch = rows.filter(r=>!['دفعة','صرف'].includes(r.entry_type))
      .reduce((s,r)=>s+Number(r.amount),0);
    const pd = rows.filter(r=>['دفعة','صرف'].includes(r.entry_type))
      .reduce((s,r)=>s+Number(r.amount),0);

    window.__mgRows = rows;

    openModal(`
      <h3>📄 كشف حساب ${esc2(u.unit_label||'')}</h3>
      <p class="small" style="color:var(--muted)">${esc2(u.owner_name||'')}</p>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        ${[[1,'آخر شهر'],[3,'3 شهور'],[6,'6 شهور'],[12,'سنة']]
          .map(([n,l])=>`<button class="btn sm ghost" onclick="mgQuick(${n})">${l}</button>`).join('')}
      </div>
      <div class="grid g2 mtop">
        <div class="field2"><label>من</label><input type="date" value="${esc2(from)}"
          onchange="mgSetRange('from',this.value)"></div>
        <div class="field2"><label>إلى</label><input type="date" value="${esc2(to)}"
          onchange="mgSetRange('to',this.value)"></div>
      </div>

      <div class="card mtop2" style="background:var(--tint)">
        <div class="grid g4 small">
          <div><b>افتتاحي</b><div>${M(open)}</div></div>
          <div><b>مستحقات</b><div style="color:var(--red)">+${M(ch)}</div></div>
          <div><b>مدفوع</b><div style="color:var(--accent)">−${M(pd)}</div></div>
          <div><b>ختامي</b><div style="font-weight:700;
            color:${close>0?'var(--red)':'var(--accent)'}">${M(close)}</div></div>
        </div>
      </div>

      <div class="table-wrap mtop2" style="max-height:38vh;overflow:auto">
        <table style="font-size:12.5px"><thead><tr>
          <th>التاريخ</th><th>البيان</th><th>له/عليه</th><th>الرصيد</th>
        </tr></thead><tbody>
        ${rows.length?rows.map(r=>{
          const neg = ['دفعة','صرف'].includes(r.entry_type);
          return `<tr><td class="small">${esc2(r.entry_date)}</td>
            <td class="small">${esc2(r.note)}</td>
            <td><b style="color:${neg?'var(--accent)':'var(--red)'}">
              ${neg?'−':'+'}${M(r.amount)}</b></td>
            <td><b>${M(r.running)}</b></td></tr>`;
        }).join(''):'<tr><td colspan="4" class="small">مفيش حركات.</td></tr>'}
        </tbody></table></div>

      <div class="flexrow mtop2" style="gap:6px;flex-wrap:wrap">
        <button class="btn" onclick="mgPrint()">🖨️ طباعة / PDF</button>
        <button class="btn ghost" onclick="mgShare()">📤 مشاركة</button>
      </div>
      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  }

  window.mgPrint = function(){
    const rows = window.__mgRows || [];
    const u = (G||[]).find(x => x.apartment_id === window.__mgAp) || {};
    const b = (window.D && D.building) || {};
    const w = window.open('', '_blank');
    if (!w) return showMessage('اسمح بالنوافذ المنبثقة للطباعة');
    const close = rows.length ? rows[rows.length-1].running : 0;

    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
      <meta charset="utf-8"><title>كشف حساب ${esc2(u.unit_label||'')}</title>
      <style>@page{margin:14mm}
        body{font-family:Tahoma,Arial,sans-serif;color:#1c2622;margin:0}
        h1{font-size:18px;margin:0 0 2px} h2{font-size:13px;margin:0;
          color:#6b7a76;font-weight:400}
        .hd{border-bottom:2px solid #159A8C;padding-bottom:10px;margin-bottom:14px}
        table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12.5px}
        th,td{border:1px solid #d8e0dd;padding:6px 8px;text-align:right}
        thead th{background:#f0f6f4;font-size:12px}
        tfoot th{background:#f0f6f4}
        .ft{margin-top:16px;font-size:11px;color:#6b7a76;
          border-top:1px solid #d8e0dd;padding-top:8px}
        @media print{.no-print{display:none}}
      </style></head><body>
      ${window.printBackBar?printBackBar():''}
      <div class="hd">
        <h1>${esc2(b.name||'العمارة')} — كشف حساب ${esc2(u.unit_label||'')}</h1>
        <h2>${esc2(u.owner_name||'')} · من ${esc2(window.__mgFrom)}
          إلى ${esc2(window.__mgTo)}</h2>
      </div>
      <table><thead><tr><th>التاريخ</th><th>البيان</th>
        <th>له/عليه</th><th>الرصيد</th></tr></thead><tbody>
      ${rows.map(r=>{
        const neg = ['دفعة','صرف'].includes(r.entry_type);
        return `<tr><td>${esc2(r.entry_date)}</td><td>${esc2(r.note)}</td>
          <td>${neg?'−':'+'}${M(r.amount)}</td><td>${M(r.running)}</td></tr>`;
      }).join('')}
      </tbody><tfoot><tr><th colspan="3">الرصيد الختامي</th>
        <th>${M(close)}</th></tr></tfoot></table>
      <div class="ft">اتطبع في ${esc2(new Date().toLocaleString('ar-EG'))}
        · نظام عمارتنا</div>
      <script>setTimeout(function(){window.print()},350)<\/script>
      </body></html>`);
    w.document.close();
  };

  window.mgShare = async function(){
    const rows = window.__mgRows || [];
    const u = (G||[]).find(x => x.apartment_id === window.__mgAp) || {};
    const b = (window.D && D.building) || {};
    const close = rows.length ? rows[rows.length-1].running : 0;
    const txt = `📄 كشف حساب ${u.unit_label||''} — ${b.name||''}\n` +
      `الفترة: ${window.__mgFrom} إلى ${window.__mgTo}\n\n` +
      rows.slice(-12).map(r=>{
        const neg = ['دفعة','صرف'].includes(r.entry_type);
        return `${r.entry_date} · ${r.note} · ${neg?'−':'+'}${r.amount}`;
      }).join('\n') +
      `\n\n💰 الرصيد الختامي: ${close} جنيه\n— نظام عمارتنا`;

    if (navigator.share){
      try{ await navigator.share({ title:'كشف حساب', text:txt }); return; }
      catch(e){ if (e && e.name === 'AbortError') return; }
    }
    const wa = String(u.owner_phone||'').replace(/\D/g,'');
    openModal(`
      <h3>📤 مشاركة الكشف</h3>
      <textarea rows="10" id="mgShareTxt" style="width:100%;font-size:12.5px"
        onclick="this.select()">${esc2(txt)}</textarea>
      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        ${wa?`<a class="btn gold" target="_blank"
          href="https://wa.me/${wa}?text=${encodeURIComponent(txt)}">
          💬 واتساب للمالك</a>`:''}
        <button class="btn ghost" onclick="
          navigator.clipboard.writeText(document.getElementById('mgShareTxt').value);
          toast('اتنسخ');">📋 نسخ</button>
      </div>
      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`, true);
  };

  document.addEventListener('emartna:building-complete', () => { G = null; });

  console.log('[عمارتنا] مطابقة الوحدات جاهزة');
})();

})();
