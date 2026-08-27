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
