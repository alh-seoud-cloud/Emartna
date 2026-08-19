/* ============================================================
   عمارتنا — بطاقة الدعاية: كود QR وبيانات التواصل
   ------------------------------------------------------------
   المشكلة: مكتبة الـQR بقت تتحمّل عند أول استخدام (لتسريع فتح
   الصفحة)، والبطاقة كانت بتحاول ترسم الكود قبل ما المكتبة تنزل
   فتفشل وتكتب "تعذّر توليد الكود".

   الحل: نستنى المكتبة، ولو فشلت نستخدم مولّد احتياطي.
   وكمان: بيانات التواصل كاملة على البطاقة (فيسبوك · واتساب ·
   البريد · الموقع).
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* ---------- ١) توليد الكود مع انتظار المكتبة ---------- */

  async function ensureQR(){
    if (typeof QRCode !== 'undefined') return true;
    if (typeof window.ensureQRCode === 'function'){
      try{ await window.ensureQRCode(); }catch(e){}
    }
    // انتظار قصير لحد ما المكتبة تجهز
    for (let i = 0; i < 40 && typeof QRCode === 'undefined'; i++)
      await new Promise(r => setTimeout(r, 100));
    return typeof QRCode !== 'undefined';
  }

  /* مولّد احتياطي على الإنترنت لو المكتبة ما نزلتش */
  const fallbackQR = url =>
    'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=1&data=' +
    encodeURIComponent(url);

  const origRender = window.renderMarketingQr;
  window.renderMarketingQr = async function(){
    const so = (window.REG && REG.sysOwner) || {};
    const host = document.getElementById('marketingQrHost');
    if (!host || !so.siteUrl) return;
    host.innerHTML = '<p class="small" style="color:var(--muted)">⏳ بيولّد الكود…</p>';

    const ok = await ensureQR();
    host.innerHTML = '';
    if (ok){
      try{
        new QRCode(host, { text: so.siteUrl.trim(), width:150, height:150,
                           colorDark:'#000000', colorLight:'#ffffff' });
        return;
      }catch(e){}
    }
    // احتياطي: صورة من خدمة توليد
    const img = document.createElement('img');
    img.src = fallbackQR(so.siteUrl.trim());
    img.width = 150; img.height = 150;
    img.alt = 'QR';
    img.crossOrigin = 'anonymous';
    host.appendChild(img);
  };

  /* ---------- ٢) الطباعة تستنى الكود ---------- */

  window.printMarketingCard = async function(){
    const so = (window.REG && REG.sysOwner) || {};
    if (!so.siteUrl) return showMessage('حدد رابط الموقع أولًا من إعدادات حسابي');

    const cards = window.ensureMarketingCards ? ensureMarketingCards() : [];
    const card = cards.find(c => c.id === window.__activeCardId) || cards[0] || {};

    await renderMarketingQr();
    await new Promise(r => setTimeout(r, 350));

    let qr = window.getQrDataUrl ? getQrDataUrl() : null;
    if (!qr){
      const img = document.querySelector('#marketingQrHost img');
      qr = (img && img.src) || fallbackQR(so.siteUrl.trim());
    }

    /* بيانات التواصل — كلها اللي متسجّلة */
    const wa = (so.whatsappNumber || ((so.contactPhoneCountry||'') + (so.contactPhone||'')))
      .replace(/[^\d]/g,'');
    const lines = [
      so.contactPhone && `📞 ${esc2((so.contactPhoneCountry||'') + ' ' + so.contactPhone)}`,
      wa && `💬 واتساب: ${esc2('+' + wa)}`,
      so.contactEmail && `📧 ${esc2(so.contactEmail)}`,
      so.siteUrl && `🌐 ${esc2(so.siteUrl.replace(/^https?:\/\//,''))}`,
      so.facebookUrl && `📘 ${esc2(so.facebookUrl.replace(/^https?:\/\/(www\.)?/,''))}`,
      so.instagramUrl && `📸 ${esc2(so.instagramUrl.replace(/^https?:\/\/(www\.)?/,''))}`,
    ].filter(Boolean);

    const w = window.open('', '_blank', 'width=460,height=680');
    if (!w) return showMessage('يرجى السماح بالنوافذ المنبثقة للطباعة');

    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
      <title>بطاقة عمارتنا الدعائية</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:34px;text-align:center;color:#1c2622;margin:0}
        h1{color:#159A8C;font-size:28px;margin:12px 0 4px}
        .tag{color:#666;margin-top:4px;font-size:14px}
        .feat{text-align:right;display:inline-block;margin-top:20px;font-size:14px;line-height:2}
        .qrbox{margin-top:20px}
        .qrbox img{border:6px solid #fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.12)}
        .cta{margin-top:12px;font-size:14px;font-weight:bold;color:#159A8C}
        .contact{margin-top:18px;padding-top:14px;border-top:2px solid #D8A33B;
                 font-size:13px;line-height:2.1;text-align:center;direction:rtl}
        .contact div{white-space:nowrap}
        .logo{max-width:110px;margin:0 auto}
        @media print{ body{padding:18px} }
      </style></head><body>
      <div class="logo">${window.appLogoSVG ? appLogoSVG(110) : ''}</div>
      <h1>${esc2(card.title || 'عمارتنا')}</h1>
      <p class="tag">${esc2(card.tagline || '')}</p>
      <div class="feat">${(card.features||[]).map(f => `<p>✅ ${esc2(f)}</p>`).join('')}</div>
      <div class="qrbox"><img src="${qr}" width="180" height="180" alt="QR"></div>
      <p class="cta">${esc2(card.cta || 'امسح الكود وابدأ تجربتك المجانية الآن')}</p>
      ${lines.length ? `<div class="contact">${lines.map(l => `<div>${l}</div>`).join('')}</div>` : ''}
      </body></html>`);
    w.document.close();
    setTimeout(() => { try{ w.print(); }catch(e){} }, 900);
  };

  /* ---------- ٣) المعاينة على الشاشة كمان فيها بيانات التواصل ---------- */

  const origPage = window.pageMarketingCard;
  if (origPage && !origPage.__contact){
    const wrapped = function(){
      const html = origPage.apply(this, arguments);
      const so = (window.REG && REG.sysOwner) || {};
      const missing = [];
      if (!so.siteUrl) missing.push('رابط الموقع');
      if (!so.contactPhone) missing.push('رقم الهاتف');
      if (!so.facebookUrl) missing.push('صفحة فيسبوك');
      if (!so.contactEmail) missing.push('البريد الإلكتروني');

      const note = `
        <div class="card content-narrow" style="border:1px dashed ${missing.length?'var(--gold)':'var(--line)'}">
          <b>📇 بيانات التواصل على البطاقة</b>
          <p class="small mtop">البطاقة المطبوعة بتعرض: الهاتف · واتساب · البريد · الموقع · فيسبوك · إنستجرام —
          كل اللي متسجّل في إعدادات حسابك.</p>
          ${missing.length
            ? `<p class="small" style="color:var(--gold)">⚠️ ناقص: ${missing.join(' · ')}</p>
               <button class="btn sm gold mtop" onclick="go('syssettings')">أكمل بياناتك</button>`
            : '<p class="small" style="color:var(--accent)">✅ كل بيانات التواصل مكتملة</p>'}
        </div>`;
      return note + html;
    };
    wrapped.__contact = true;
    window.pageMarketingCard = wrapped;
  }

  console.log('[عمارتنا] بطاقة الدعاية جاهزة');
})();
