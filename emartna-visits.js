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
