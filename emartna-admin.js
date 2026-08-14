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
