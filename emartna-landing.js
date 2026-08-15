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
    const on = window.scrollY > 420;
    bar.style.display = on ? 'block' : 'none';
  }
  window.addEventListener('scroll', watchScroll, { passive:true });
  setInterval(watchScroll, 1200);

  console.log('[عمارتنا] الصفحة الرئيسية المطوّرة جاهزة');
})();
