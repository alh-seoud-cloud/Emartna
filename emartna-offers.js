/* ============================================================
   عمارتنا — تحسين عروض العملاء الجدد + التقرير يوم بيوم
   ------------------------------------------------------------
   ١) العرض بقى يقبل صورة وألوان وتنسيق، والمعاينة بتوري
      الشكل النهائي بالظبط.
   ٢) تقرير الزيارات بيعرض كل يوم في الفترة — حتى الأيام
      اللي مفيهاش نشاط — عشان تشوف الفجوات مش تفتكرها مفيش.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* ============================================================
     ١) صورة وتنسيق العرض
     ============================================================ */

  const THEMES = {
    teal:   { name:'أخضر البرنامج', bg:'linear-gradient(135deg,#159A8C,#0f7a6f)', fg:'#fff', btn:'#fff', btnFg:'#159A8C' },
    gold:   { name:'ذهبي',          bg:'linear-gradient(135deg,#D8A33B,#b8862a)', fg:'#fff', btn:'#fff', btnFg:'#8a6413' },
    dark:   { name:'داكن أنيق',     bg:'linear-gradient(135deg,#1f2a37,#111827)', fg:'#fff', btn:'#D8A33B', btnFg:'#1f2a37' },
    light:  { name:'فاتح بسيط',     bg:'#ffffff',                                  fg:'#1b2b28', btn:'#159A8C', btnFg:'#fff' },
    sunset: { name:'برتقالي دافي',  bg:'linear-gradient(135deg,#F97316,#c2410c)', fg:'#fff', btn:'#fff', btnFg:'#c2410c' },
  };

  const themeOf = o => THEMES[(o && o.theme && o.theme.key) || 'teal'] || THEMES.teal;

  /* شكل العرض النهائي — نفس اللي الزائر هيشوفه */
  window.offerCardHTML = function(o, isPreview){
    const t = themeOf(o);
    const feats = (o.features || []).filter(Boolean);
    return `
    <div class="offer-overlay" id="offerOverlay" style="position:fixed;inset:0;z-index:99500;
         background:rgba(15,25,22,.55);display:flex;align-items:center;justify-content:center;padding:18px">
      <div style="max-width:430px;width:100%;max-height:92vh;overflow:auto;border-radius:20px;
           background:${t.bg};color:${t.fg};box-shadow:0 20px 60px rgba(0,0,0,.3);position:relative;
           text-align:center;direction:rtl">
        <button onclick="closeOfferPopup(${isPreview?'true':'false'})"
          style="position:absolute;top:12px;inset-inline-start:12px;width:30px;height:30px;border:0;
                 border-radius:50%;background:rgba(255,255,255,.25);color:${t.fg};
                 font-size:16px;cursor:pointer;line-height:1">✕</button>

        ${o.imageUrl ? `<img src="${esc2(o.imageUrl)}" alt=""
           style="width:100%;max-height:190px;object-fit:cover;border-radius:20px 20px 0 0;display:block">` : ''}

        <div style="padding:${o.imageUrl?'18px 24px 24px':'34px 24px 24px'}">
          ${!o.imageUrl && o.emoji !== '' ? `<div style="font-size:44px;line-height:1">${esc2(o.emoji || '🎉')}</div>` : ''}
          <h2 style="margin:10px 0 4px;font-size:22px;color:${t.fg}">${esc2(o.title || '')}</h2>
          ${o.subtitle ? `<p style="margin:0 0 4px;font-size:15px;opacity:.92">${esc2(o.subtitle)}</p>` : ''}

          ${feats.length ? `<div style="text-align:start;margin:16px auto 0;max-width:330px;
               background:rgba(255,255,255,.14);border-radius:12px;padding:12px 14px">
            ${feats.map(f => `<div style="padding:4px 0;font-size:13.5px;line-height:1.9">
                ✔️ ${esc2(f)}</div>`).join('')}
          </div>` : ''}

          <button onclick="closeOfferPopup(${isPreview?'true':'false'});openSignup()"
            style="margin-top:18px;width:100%;padding:14px;border:0;border-radius:12px;
                   background:${t.btn};color:${t.btnFg};font-size:16px;font-weight:800;cursor:pointer">
            ${esc2(o.ctaText || 'ابدأ دلوقتي')}</button>

          ${o.footnote ? `<p style="margin-top:10px;font-size:11.5px;opacity:.8">${esc2(o.footnote)}</p>` : ''}
        </div>
      </div>
    </div>`;
  };

  /* بنستبدل العرض والمعاينة القديمين */
  window.offerPopupHTML = (o, isPreview) => offerCardHTML(o, isPreview);
  window.previewOffer = function(id){
    const o = (window.ensureLandingOffers ? ensureLandingOffers() : []).find(x => x.id === id);
    if (!o) return;
    const old = document.getElementById('offerOverlay');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', offerCardHTML(o, true));
  };

  /* ---------- محرر العرض: صورة + ألوان + مميزات ---------- */

  window.openOfferDesign = function(id){
    const o = (window.ensureLandingOffers ? ensureLandingOffers() : []).find(x => x.id === id);
    if (!o) return;
    const cur = (o.theme && o.theme.key) || 'teal';
    openModal(`
      <h3>🎨 تصميم العرض</h3>
      <p class="small mtop">شكل النافذة اللي بتظهر للزائر. اضغط معاينة في أي وقت تشوف النتيجة.</p>

      <div class="field2 mtop2"><label>اللون</label>
        <select id="ofTheme">${Object.entries(THEMES).map(([k,v]) =>
          `<option value="${k}" ${cur===k?'selected':''}>${v.name}</option>`).join('')}</select></div>

      <div class="field2"><label>أيقونة فوق العنوان (لو مفيش صورة)</label>
        <input id="ofEmoji" value="${esc2(o.emoji || '🎉')}" placeholder="🎉" style="font-size:20px;text-align:center"></div>

      <div class="field2"><label>صورة العرض (اختياري)</label>
        <input id="ofImgFile" type="file" accept="image/*" onchange="pickOfferImage(this)">
        <p class="small">الصورة بتتضغط تلقائيًا. الأفضل عرضية (مثال 800×400).</p>
        <div id="ofImgPrev" class="mtop">${o.imageUrl
          ? `<img src="${esc2(o.imageUrl)}" style="max-width:100%;border-radius:10px">
             <button class="btn sm red mtop" onclick="clearOfferImage()">🗑️ شيل الصورة</button>`
          : '<span class="small" style="color:var(--muted)">مفيش صورة</span>'}</div></div>

      <div class="field2 mtop"><label>العنوان الفرعي</label>
        <input id="ofSub" value="${esc2(o.subtitle || '')}"></div>

      <div class="field2"><label>المميزات (سطر لكل ميزة)</label>
        <textarea id="ofFeats" rows="5" style="width:100%">${esc2((o.features || []).join('\n'))}</textarea></div>

      <div class="grid g2">
        <div class="field2"><label>نص الزرار</label>
          <input id="ofCta" value="${esc2(o.ctaText || 'جرب الآن مجانًا')}"></div>
        <div class="field2"><label>سطر صغير تحت</label>
          <input id="ofFoot" value="${esc2(o.footnote || '')}"></div>
      </div>

      <div class="flexrow mtop2" style="gap:8px;flex-wrap:wrap">
        <button class="btn primary" onclick="saveOfferDesign('${id}')">💾 حفظ</button>
        <button class="btn gold" onclick="saveOfferDesign('${id}',true)">👁️ حفظ ومعاينة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.pickOfferImage = async function(input){
    const f = input.files && input.files[0];
    if (!f) return;
    try{
      const url = window.compressImage
        ? await compressImage(f, { maxW: 900, quality: .78, maxKB: 160 })
        : await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
      window.__offerImg = url;
      const box = document.getElementById('ofImgPrev');
      if (box) box.innerHTML = `<img src="${url}" style="max-width:100%;border-radius:10px">
        <button class="btn sm red mtop" onclick="clearOfferImage()">🗑️ شيل الصورة</button>`;
    }catch(e){ showMessage('تعذّر تحميل الصورة: ' + e.message); }
  };

  window.clearOfferImage = function(){
    window.__offerImg = '';
    const box = document.getElementById('ofImgPrev');
    if (box) box.innerHTML = '<span class="small" style="color:var(--muted)">مفيش صورة</span>';
  };

  window.saveOfferDesign = function(id, preview){
    const o = ensureLandingOffers().find(x => x.id === id);
    if (!o) return;
    const g = i => (document.getElementById(i) || {}).value || '';
    o.theme    = { key: g('ofTheme') || 'teal' };
    o.emoji    = g('ofEmoji').trim();
    o.subtitle = g('ofSub').trim();
    o.features = g('ofFeats').split('\n').map(x => x.trim()).filter(Boolean);
    o.ctaText  = g('ofCta').trim() || 'ابدأ دلوقتي';
    o.footnote = g('ofFoot').trim();
    if (window.__offerImg !== undefined) o.imageUrl = window.__offerImg;
    delete window.__offerImg;
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظ تصميم العرض');
    if (preview) setTimeout(() => previewOffer(id), 200);
    else if (window.renderSysContent) renderSysContent();
  };

  /* زرار التصميم جنب أزرار العرض */
  const origOffers = window.pageSysOffers;
  if (origOffers && !origOffers.__design){
    const wrapped = function(){
      let html = origOffers.apply(this, arguments);
      const offers = window.ensureLandingOffers ? ensureLandingOffers() : [];
      offers.forEach(o => {
        const mark = `onclick="previewOffer('${o.id}')"`;
        if (html.includes(mark))
          html = html.replace(mark + '>👁️ معاينة</button>',
            mark + '>👁️ معاينة</button>' +
            `<button class="btn sm gold" onclick="openOfferDesign('${o.id}')">🎨 تصميم</button>`);
      });
      return html;
    };
    wrapped.__design = true;
    window.pageSysOffers = wrapped;
  }

  /* ============================================================
     ٢) التقرير: كل يوم في الفترة حتى لو صفر
     ============================================================ */

  const origVisits = window.pageSysVisits;
  if (origVisits && !origVisits.__allDays){
    const wrapped = function(){
      const rows = window.__visitRows;
      if (Array.isArray(rows) && window.__visitFrom && window.__visitTo){
        const have = new Set(rows.map(r => String(r.day)));
        const from = new Date(window.__visitFrom), to = new Date(window.__visitTo);
        const days = Math.round((to - from) / 86400000);
        if (days >= 0 && days <= 400){
          const filled = rows.slice();
          for (let i = 0; i <= days; i++){
            const d = new Date(from.getTime() + i * 86400000).toISOString().slice(0,10);
            if (!have.has(d))
              filled.push({ day:d, source:'—', visits:0, demos:0, signups:0, logins:0 });
          }
          window.__visitRows = filled;
          const out = origVisits.apply(this, arguments);
          window.__visitRows = rows;      // نرجّع الأصل عشان الحسابات
          return out;
        }
      }
      return origVisits.apply(this, arguments);
    };
    wrapped.__allDays = true;
    window.pageSysVisits = wrapped;
  }

  console.log('[عمارتنا] تصميم العروض والتقرير اليومي جاهز');
})();
