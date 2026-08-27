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
    closeModal();
    setTimeout(() => startDemo(role), 120);
  };

  window.skipDemoPhone = function(role){
    closeModal();
    setTimeout(() => startDemo(role), 120);
  };

  function startDemo(role){
    if (typeof window.__origTryDemo === 'function') return window.__origTryDemo(role);
    if (typeof window.loginAsDemo === 'function') return loginAsDemo(role);
  }

  /* بنعترض زرار التجربة */
  function hook(){
    const orig = window.tryDemoNow;
    if (typeof orig === 'function' && !orig.__leadHook){
      window.__origTryDemo = orig;
      const w = function(role){ return askPhoneThenDemo(role || 'admin'); };
      w.__leadHook = true;
      window.tryDemoNow = w;
    }
  }
  hook();
  setTimeout(hook, 2500);

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

  /* ============================================================
     شاشة قمع المبيعات — اللي جرّبوا
     ============================================================ */

  window.__demoLeads = null;

  window.loadDemoLeads = async function(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { data, error } = await sb.from('demo_leads')
        .select('*').order('last_try_at', { ascending:false }).limit(2000);
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

  const origPipe = window.pageSysPipeline;
  if (typeof origPipe === 'function' && !origPipe.__leads){
    const wrapped = function(){ return origPipe.apply(this, arguments) + leadsSection(); };
    wrapped.__leads = true;
    window.pageSysPipeline = wrapped;
  }

  console.log('[عمارتنا] تسجيل اللي بيجرّبوا جاهز');
})();
