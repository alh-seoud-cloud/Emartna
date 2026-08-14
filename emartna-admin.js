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
    { version:'3.1', date:'2026-08-13', notes:[
      'تقارير محاسبية جديدة: ميزان المراجعة وأعمار الديون، مع فلترة بالتواريخ ومقارنة بفترات سابقة',
      'كشف حساب موحّد لأي عنصر (شقة · حساب · مشروع · مورد · بند صرف) مع اختيار الفترة ورصيد أول وآخر المدة',
      'تقرير الأدوار: توزيع الوحدات على الأدوار مع نسبة تحصيل لكل دور',
      'سلة المحذوفات بقت تشتغل على الخادم — استعادة العمارات المحذوفة أو حذفها نهائيًا',
      'تحكّم في حجم النوافذ المنبثقة، وأزرار الحفظ والإغلاق بقت في أعلى النافذة',
      'إصلاح: صورة إثبات الدفع كانت بتضيع بعد التحديث — بقت تتحفظ',
      'إصلاح: استرداد المبالغ وعكس الحركات المالية مكانوش بيتحفظوا على الخادم',
      'إصلاح: إشعارات قبول ورفض الدفعات والمقترحات مكانتش بتوصل للساكن',
      'إصلاح: العمارات اللي عندها أكتر من ١٠٠٠ حركة كانت بتتحمّل ناقصة',
      'تحسينات أمان على قاعدة البيانات',
    ]},
  ];

  function seedChangelog(){
    if (!window.REG || !window.ensureVersionHistory) return;
    const list = ensureVersionHistory();
    let changed = false;

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

  async function loadMissingBuildings(){
    if (window.__loadingBuildings) return;
    if (!window.CLOUD || !window.CLOUD.loadBuilding) return;
    if (!window.REG || !window.REG.buildings) return;

    const missing = window.REG.buildings
      .filter(b => !window.loadBuildingData(b.id))
      .slice(0, MAX_AUTO_LOAD);
    if (!missing.length) return;

    window.__loadingBuildings = true;
    let done = 0;
    try{
      await Promise.all(missing.map(async b => {
        try{ await window.CLOUD.loadBuilding(b.id); done++; }
        catch(e){ console.warn('[عمارتنا] تعذّر تحميل', b.name, e.message); }
      }));
    } finally {
      window.__loadingBuildings = false;
    }
    if (done && window.isSysOwner && isSysOwner() && window.renderSysContent){
      renderSysContent();
    }
  }
  window.reloadPlatformBuildings = loadMissingBuildings;

  /* لوحة المنصة: حمّل الناقص في الخلفية أول ما تتفتح */
  const origSysContent = window.renderSysContent;
  if (origSysContent) window.renderSysContent = function(){
    const out = origSysContent.apply(this, arguments);
    setTimeout(loadMissingBuildings, 0);
    return out;
  };

  /* زرار "فتح" لعمارة: حمّلها الأول لو مش متحمّلة */
  const origImpersonate = window.impersonateBuilding;
  if (origImpersonate) window.impersonateBuilding = function(buildingId){
    if (window.loadBuildingData(buildingId)) return origImpersonate(buildingId);
    if (window.toast) toast('بيحمّل بيانات العمارة…');
    window.CLOUD.loadBuilding(buildingId)
      .then(() => origImpersonate(buildingId))
      .catch(e => {
        if (window.showMessage) showMessage('تعذّر تحميل العمارة: ' + (e.message || ''));
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
