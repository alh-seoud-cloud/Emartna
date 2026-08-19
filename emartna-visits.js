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

  async function send(signup){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const d = detect();
      if (d.source === 'internal' && !signup) return;
      await sb.rpc('record_visit', {
        p_source: d.source, p_campaign: d.campaign,
        p_landed_on: (location.pathname || '/').slice(0,60),
        p_signup: !!signup,
      });
    }catch(e){}
  }

  /* زيارة واحدة لكل جلسة تصفّح */
  function logVisit(){
    try{
      if (sessionStorage.getItem(SESS) === '1') return;
      sessionStorage.setItem(SESS, '1');
    }catch(e){}
    send(false);
  }

  let tries = 0;
  const t = setInterval(() => {
    if (++tries > 200) return clearInterval(t);
    if (window.CLOUD && window.CLOUD._sb){ clearInterval(t); logVisit(); }
  }, 150);

  /* التسجيل الناجح بيتسجّل كتحويل */
  ['doSignup','createBuildingFromSignup'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__visit) return;
    const wrapped = async function(){
      const r = await orig.apply(this, arguments);
      send(true);
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

  window.loadVisitReport = async function(days){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) return;
    const since = new Date(Date.now() - (days||30)*86400000).toISOString().slice(0,10);
    try{
      const { data, error } = await sb.from('visit_stats')
        .select('day,source,campaign,is_signup')
        .gte('day', since).order('day', { ascending:false }).limit(20000);
      if (error) throw error;
      window.__visitRows = data || [];
      window.__visitDays = days || 30;
    }catch(e){
      window.__visitRows = [];
      window.__visitErr = (window.cloudErrorText ? cloudErrorText(e) : e.message);
    }
    if (window.renderSysContent) renderSysContent();
  };

  window.pageSysVisits = function(){
    const rows = window.__visitRows;
    const days = window.__visitDays || 30;

    if (rows === null){
      setTimeout(() => loadVisitReport(30), 30);
      return '<div class="card"><p class="small">⏳ بيحمّل تقرير مصادر الزيارات…</p></div>';
    }

    const by = {};
    rows.forEach(r => {
      const k = r.source || 'other';
      by[k] = by[k] || { visits:0, signups:0 };
      by[k].visits++;
      if (r.is_signup) by[k].signups++;
    });
    const totalV = rows.length;
    const totalS = rows.filter(r => r.is_signup).length;
    const list = Object.entries(by)
      .map(([k,v]) => ({ key:k, ...v, rate: v.visits ? Math.round(v.signups/v.visits*100) : 0 }))
      .sort((a,b) => b.visits - a.visits);

    const cols = [
      { key:'src', label:'المصدر', value:r => LABEL[r.key] || r.key,
        cell:r => `${ICON[r.key]||'🌐'} <b>${esc2(LABEL[r.key] || r.key)}</b>` },
      { key:'visits', label:'الزيارات', value:r => r.visits, cell:r => String(r.visits) },
      { key:'share', label:'النسبة', value:r => totalV ? r.visits/totalV : 0,
        cell:r => `${totalV ? Math.round(r.visits/totalV*100) : 0}%` },
      { key:'signups', label:'تسجيلات', value:r => r.signups,
        cell:r => r.signups ? `<span class="badge g">${r.signups}</span>` : '0' },
      { key:'rate', label:'نسبة التحويل', value:r => r.rate,
        cell:r => `<span class="badge ${r.rate>=5?'g':r.rate>0?'y':'n'}">${r.rate}%</span>` },
    ];

    // آخر ٧ أيام
    const byDay = {};
    rows.forEach(r => { byDay[r.day] = (byDay[r.day]||0) + 1; });
    const last7 = Object.keys(byDay).sort().slice(-7);
    const max = Math.max(1, ...last7.map(d => byDay[d]));

    return `
      <p class="small">مصدر كل زيارة للموقع خلال آخر ${days} يوم — والتسجيلات اللي جت من كل مصدر.
      مفيش أي بيانات شخصية بتتسجّل.</p>

      <div class="flexrow mtop" style="gap:8px;flex-wrap:wrap">
        ${[7,30,90].map(d => `<button class="btn sm ${days===d?'primary':'ghost'}"
          onclick="loadVisitReport(${d})">آخر ${d} يوم</button>`).join('')}
        <button class="btn sm ghost" onclick="loadVisitReport(${days})">🔄 تحديث</button>
      </div>

      <div class="grid g3 mtop2">
        <div class="card"><h3 style="color:var(--accent)">${totalV}</h3><p class="small">إجمالي الزيارات</p></div>
        <div class="card"><h3>${totalS}</h3><p class="small">تسجيلات</p></div>
        <div class="card"><h3>${totalV?Math.round(totalS/totalV*100):0}%</h3><p class="small">نسبة التحويل</p></div>
      </div>

      ${last7.length ? `<div class="card mtop2">
        <b>الزيارات اليومية (آخر ٧ أيام)</b>
        <div class="flexrow mtop" style="align-items:flex-end;gap:10px;height:110px">
          ${last7.map(d => `<div style="flex:1;text-align:center">
            <div style="background:var(--accent);border-radius:5px 5px 0 0;
                 height:${Math.round(byDay[d]/max*80)}px;min-height:3px"></div>
            <div class="small" style="margin-top:4px">${byDay[d]}</div>
            <div class="small" style="color:var(--muted);font-size:10px">${esc2(d.slice(5))}</div>
          </div>`).join('')}
        </div></div>` : ''}

      <div class="mtop2">${sortableTable('visitsTable', list, cols, null,
        { defaultKey:'visits', emptyText:'مفيش زيارات مسجّلة لسه', exportName:'مصادر الزيارات' })}</div>

      ${window.__visitErr ? `<p class="small mtop" style="color:var(--red)">${esc2(window.__visitErr)}</p>` : ''}

      <p class="small mtop2" style="color:var(--muted)">
        💡 عشان تقيس حملة معيّنة بدقة، حط علامة في الرابط:
        <code dir="ltr">myemartna.com/?utm_source=facebook&utm_campaign=aug</code>
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
