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
