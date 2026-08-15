/* ============================================================
   عمارتنا — أيقونة التطبيق المثبّت
   ------------------------------------------------------------
   المشكلة: الـmanifest كان بيدّي أندرويد أيقونة SVG واحدة بمقاس
   "any". أندرويد بيحتاج PNG بمقاسات محددة (192 و512)، وأيقونة
   maskable لازم يكون حواليها فراغ أمان وإلا بتتقص. النتيجة كانت
   أيقونة مقصوصة أو حرف بدل الشعار.

   الحل: نرسم الشعار على canvas ونطلّع PNG بالمقاسات الصح،
   نسخة عادية ونسخة maskable بفراغ أمان ٢٠٪.
   ============================================================ */

(function(){
  'use strict';

  const THEME = '#159A8C';
  const BG    = '#FFFFFF';

  function drawIcon(img, size, maskable){
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    // خلفية صلبة — الشفافية بتطلع سودا على بعض الأجهزة
    ctx.fillStyle = maskable ? THEME : BG;
    if (maskable){
      ctx.fillRect(0, 0, size, size);
    }else{
      // زوايا مستديرة خفيفة للأيقونة العادية
      const r = size * 0.18;
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(size - r, 0);
      ctx.quadraticCurveTo(size, 0, size, r); ctx.lineTo(size, size - r);
      ctx.quadraticCurveTo(size, size, size - r, size); ctx.lineTo(r, size);
      ctx.quadraticCurveTo(0, size, 0, size - r); ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
      ctx.fill();
    }

    // فراغ الأمان: ٢٠٪ للـmaskable (أندرويد بيقص لدائرة) و١٠٪ للعادية
    const pad = maskable ? size * 0.20 : size * 0.10;
    const box = size - pad * 2;
    const ratio = (img.width && img.height) ? Math.min(box / img.width, box / img.height) : 1;
    const w = (img.width || box) * ratio, h = (img.height || box) * ratio;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    try{ return c.toDataURL('image/png'); }catch(e){ return null; }
  }

  window.rebuildAppIcons = function(){
    return new Promise(resolve => {
      const src = (window.REG && REG.brandSettings && REG.brandSettings.logoDataUrl)
                || (typeof DEFAULT_LOGO_DATAURI !== 'undefined' ? DEFAULT_LOGO_DATAURI : null);
      if (!src) return resolve(null);

      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const icons = [];
        [192, 512].forEach(sz => {
          const normal = drawIcon(img, sz, false);
          if (normal) icons.push({ src:normal, sizes:sz + 'x' + sz, type:'image/png', purpose:'any' });
          const mask = drawIcon(img, sz, true);
          if (mask) icons.push({ src:mask, sizes:sz + 'x' + sz, type:'image/png', purpose:'maskable' });
        });
        if (!icons.length) return resolve(null);

        // أيقونة الآيفون: مربّعة بخلفية بيضا (آبل مبيحبش الشفافية)
        const apple = icons.find(i => i.sizes === '192x192' && i.purpose === 'any');
        if (apple){
          let el = document.querySelector('link[rel="apple-touch-icon"]');
          if (!el){ el = document.createElement('link'); el.rel = 'apple-touch-icon'; document.head.appendChild(el); }
          el.href = apple.src;
          el.setAttribute('sizes', '192x192');
        }

        const manifest = {
          name: 'عمارتنا - إدارة اتحاد الملاك',
          short_name: 'عمارتنا',
          description: 'نظام إدارة اتحاد الملاك بسهولة واحترافية',
          start_url: location.pathname + location.search,
          scope: location.pathname.replace(/[^/]*$/, ''),
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#F8FAF9',
          theme_color: THEME,
          dir: 'rtl',
          lang: 'ar',
          categories: ['business','productivity','finance'],
          icons,
        };
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(manifest)], { type:'application/manifest+json' }));
        let link = document.querySelector('link[rel="manifest"]');
        if (!link){ link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
        link.href = url;

        window.__appIcons = icons;
        resolve(icons);
      };
      img.src = src;
    });
  };

  /* تنزيل الأيقونات — بتلزم لو رفعت التطبيق على Google Play */
  window.downloadAppIcons = async function(){
    const icons = window.__appIcons || await rebuildAppIcons();
    if (!icons) return showMessage('تعذّر توليد الأيقونات');
    icons.forEach(ic => {
      const a = document.createElement('a');
      a.href = ic.src;
      a.download = `emartna-icon-${ic.sizes}-${ic.purpose}.png`;
      a.click();
    });
    if (window.toast) toast('اتنزّلت ' + icons.length + ' أيقونة');
  };

  // بعد ما البرنامج يجهز، وكل ما الشعار يتغيّر
  setTimeout(() => { try{ rebuildAppIcons(); }catch(e){} }, 1500);

  const origLogo = window.uploadBrandLogo;
  if (origLogo) window.uploadBrandLogo = function(){
    const r = origLogo.apply(this, arguments);
    setTimeout(() => { try{ rebuildAppIcons(); }catch(e){} }, 1200);
    return r;
  };

  console.log('[عمارتنا] أيقونات التطبيق جاهزة');
})();
