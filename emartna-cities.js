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
