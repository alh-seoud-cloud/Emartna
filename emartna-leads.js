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

  async function saveLead(phone, name, role){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb || !phone) return;
      const o = srcOf();
      await sb.rpc('record_demo_lead', {
        p_phone: phone, p_name: name || null, p_role: role || null,
        p_source: o.s, p_campaign: o.c,
      });
    }catch(e){}
  }
  window.saveDemoLead = saveLead;

  /* ---------- نافذة طلب الرقم ---------- */

  window.askPhoneThenDemo = function(role){
    const prev = savedPhone();
    if (prev){                                  // جرّب قبل كده — مش هنسأله تاني
      saveLead(prev, '', role);
      return startDemo(role);
    }

    ev('phone_shown');
    openModal(`
      <h3>${role === 'owner' ? '🏠' : '🏢'} تجربة ${role === 'owner' ? 'كصاحب شقة' : 'كرئيس اتحاد'}</h3>
      <p class="small mtop">التجربة مجانية بالكامل ومن غير تسجيل. سيبلنا رقمك عشان
      نقدر نساعدك لو احتجت — <b>مش هنبعتلك أي إعلانات</b>.</p>

      <div class="field2 mtop2"><label>الاسم (اختياري)</label>
        <input id="dlName" placeholder="اسمك"></div>
      <div class="grid g2">
        <div class="field2"><label>مفتاح الدولة</label>
          <input id="dlCC" value="+20" dir="ltr"></div>
        <div class="field2"><label>رقم الموبايل</label>
          <input id="dlPhone" dir="ltr" placeholder="01xxxxxxxxx" inputmode="numeric"></div>
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
    saveLead(full, g('dlName').trim(), role);
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
        cell:r => `<a class="btn sm gold" target="_blank"
          href="https://wa.me/${esc2(r.phone)}?text=${encodeURIComponent(
            'أهلًا' + (r.name ? ' ' + r.name : '') + ' 👋\nشكرًا إنك جرّبت عمارتنا. محتاج مساعدة في أي حاجة؟')}">💬 كلّمه</a>` },
    ];

    return `
      <div class="section-title mtop2"><h3>🎬 اللي جرّبوا البرنامج</h3></div>
      <p class="small">كل زائر ساب رقمه قبل التجربة — دول أقرب ناس للاشتراك.</p>
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

  const origPipe = window.pageSysPipeline;
  if (typeof origPipe === 'function' && !origPipe.__leads){
    const wrapped = function(){
      return origPipe.apply(this, arguments) + leadsSection() + gateSection();
    };
    wrapped.__leads = true;
    window.pageSysPipeline = wrapped;
  }

  console.log('[عمارتنا] تسجيل اللي بيجرّبوا جاهز');
})();
