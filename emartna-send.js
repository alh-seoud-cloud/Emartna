/* ============================================================
   عمارتنا — الإرسال بأكثر من قناة
   ------------------------------------------------------------
   أي زرار إرسال في البرنامج بقى يفتح نافذة اختيار:
       واتساب · رسالة SMS · بريد إلكتروني · نسخ النص
   بيشتغل على الموبايل واللابتوب، ومن غير أي خادم أو اشتراك
   خارجي — البرنامج بيفتح تطبيق المراسلة عند المستخدم.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* رقم دولي نضيف من غير + ولا مسافات — الشكل اللي واتساب بيفهمه */
  function waNumber(country, phone){
    let d = String(phone == null ? '' : phone).replace(/[^\d+]/g,'');
    if (!d) return '';
    if (d.startsWith('00')) d = '+' + d.slice(2);
    const cc = String(country || '+20');
    const e164 = d.startsWith('+') ? d : (cc + d.replace(/^0+/,''));
    return e164.replace(/\D/g,'');
  }
  window.waNumber = waNumber;

  function isMobile(){
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }

  /* ---------- القنوات ---------- */

  window.sendVia = function(channel){
    const o = window.__sendCtx || {};
    const text = (document.getElementById('sendMsgBody') || {}).value || o.text || '';
    if (!text.trim()) return showMessage('اكتب الرسالة الأول');

    const num = waNumber(o.country, o.phone);
    const subject = o.subject || 'رسالة من عمارتنا';

    if (channel === 'whatsapp'){
      if (!num && o.requirePhone !== false)
        return showMessage('مفيش رقم موبايل مسجّل للمرسل إليه.');
      const url = num
        ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }

    else if (channel === 'sms'){
      if (!num) return showMessage('مفيش رقم موبايل مسجّل للمرسل إليه.');
      // iOS بيستخدم & بدل ? في فاصل النص
      const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
      window.location.href = `sms:+${num}${sep}body=${encodeURIComponent(text)}`;
    }

    else if (channel === 'email'){
      if (!o.email)
        return showMessage('مفيش بريد إلكتروني مسجّل — تقدر تنسخ النص وتبعته بنفسك.');
      window.location.href = `mailto:${encodeURIComponent(o.email)}` +
        `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    }

    else if (channel === 'copy'){
      const done = () => (window.toast ? toast('اتنسخت — تقدر تلزقها في أي تطبيق') : null);
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(text).then(done, done);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try{ document.execCommand('copy'); }catch(e){}
        document.body.removeChild(ta); done();
      }
      return;   // مانقفلش النافذة عشان يقدر يبعت بقناة تانية كمان
    }

    if (typeof o.onSent === 'function'){ try{ o.onSent(channel); }catch(e){} }
    if (o.closeAfter !== false && window.closeModal) closeModal();
  };

  /* ---------- النافذة الموحّدة ---------- */

  /* openSendModal({ title, text, phone, country, email, subject,
                     note, onSent, closeAfter, requirePhone }) */
  window.openSendModal = function(opts){
    const o = Object.assign({}, opts || {});
    window.__sendCtx = o;

    const num = waNumber(o.country, o.phone);
    const to  = num ? '+' + num : (o.email || '');
    const btn = (ch, icon, label, on, hint) => `
      <button class="btn ${on ? '' : 'ghost'}" onclick="sendVia('${ch}')" ${on?'':'disabled'}
        style="flex:1;min-width:130px;opacity:${on?1:.45}" title="${esc2(hint||'')}">
        ${icon} ${label}</button>`;

    openModal(`
      <h3>📤 ${esc2(o.title || 'إرسال رسالة')}</h3>
      ${to ? `<p class="small mtop">إلى: <b dir="ltr">${esc2(to)}</b>${
        o.email && num ? ` · <span dir="ltr">${esc2(o.email)}</span>` : ''}</p>` : ''}
      ${o.note ? `<p class="small" style="color:var(--muted)">${esc2(o.note)}</p>` : ''}

      <div class="field2 mtop">
        <label>نص الرسالة <span class="small" style="color:var(--muted)">(تقدر تعدّله قبل الإرسال)</span></label>
        <textarea id="sendMsgBody" rows="7" style="width:100%;font-size:13px;line-height:1.9">${esc2(o.text || '')}</textarea>
      </div>

      <div class="flexrow mtop" style="flex-wrap:wrap;gap:8px">
        ${btn('whatsapp','📱','واتساب', !!num || o.requirePhone === false,
              num ? '' : 'مفيش رقم موبايل مسجّل')}
        ${btn('sms','✉️','رسالة SMS', !!num, num ? '' : 'مفيش رقم موبايل مسجّل')}
        ${btn('email','📧','بريد إلكتروني', !!o.email, o.email ? '' : 'مفيش بريد مسجّل')}
        ${btn('copy','📋','نسخ النص', true)}
      </div>
      <p class="small mtop" style="color:var(--muted)">
        البرنامج بيفتح تطبيق المراسلة على جهازك — الرسالة مش بتتبعت من الخادم،
        فالمستقبل هيشوف إنها منك شخصيًا.
        ${isMobile() ? '' : ' (رسائل SMS بتحتاج موبايل — على اللابتوب استخدم واتساب أو البريد.)'}
      </p>

      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  /* ---------- ربط أزرار الإرسال الموجودة ---------- */

  /* ١) دعوة ساكن */
  const origInvite = window.sendInviteWhatsApp;
  if (origInvite) window.sendInviteWhatsApp = function(apId){
    try{
      const ap = (D.apartments || []).find(a => a.id === apId);
      const u  = (D.users || []).find(x => x.apartmentId === apId);
      if (!ap || !u || !u.inviteCode) return origInvite.apply(this, arguments);
      const bName = (D.building && D.building.name) || 'العمارة';
      const link  = (location.origin + location.pathname).replace(/emartna-cloud\.html$/, '') + 'join.html';
      const text  =
        `أهلًا ${ap.ownerName || ''} 👋\n` +
        `دي دعوتك للانضمام لتطبيق "${bName}".\n\n` +
        `🔑 كود الدعوة: ${u.inviteCode}\n` +
        `🔗 الرابط: ${link}?code=${u.inviteCode}\n\n` +
        `افتح الرابط وسجّل برقم موبايلك، وهتشوف حساب ${window.unitLabel ? unitLabel(ap) : ''} ` +
        `ومستحقاتك ومصروفات العمارة أول بأول.`;
      openSendModal({
        title: 'دعوة ' + (window.unitLabel ? unitLabel(ap) : ''),
        text, phone: ap.phone, country: ap.phoneCountry, email: ap.email,
        subject: 'دعوتك للانضمام لتطبيق ' + bName,
      });
    }catch(e){ return origInvite.apply(this, arguments); }
  };

  /* ٢) رسائل التسويق للعملاء المحتملين */
  const origLead = window.openLeadWhatsApp;
  if (origLead) window.openLeadWhatsApp = function(id){
    try{
      const lead = (window.ensureMarketingLeads ? ensureMarketingLeads() : (REG.marketingLeads || []))
        .find(l => l.id === id);
      if (!lead) return origLead.apply(this, arguments);
      const body = (document.getElementById('leadMsgBody') || {}).value || '';
      openSendModal({
        title: 'رسالة لـ' + (lead.name || ''),
        text: body, phone: lead.phone, country: lead.phoneCountry, email: lead.email,
        subject: 'تطبيق عمارتنا لإدارة اتحاد الملاك',
        onSent: () => { try{ if (window.markLeadContacted) markLeadContacted(id); }catch(e){} },
      });
    }catch(e){ return origLead.apply(this, arguments); }
  };

  /* ٣) عرض سعر مخصص لعميل */
  const origOffer = window.sendCustomOfferWhatsApp;
  if (origOffer) window.sendCustomOfferWhatsApp = function(){
    try{
      const before = window.open;
      let captured = null;
      window.open = url => { captured = url; return null; };     // نمسك الرابط بدل ما نفتحه
      origOffer.apply(this, arguments);
      window.open = before;
      if (!captured) return;
      const text = decodeURIComponent((captured.split('text=')[1] || ''));
      const num  = (captured.match(/wa\.me\/(\d+)/) || [])[1] || '';
      openSendModal({ title:'إرسال العرض', text, phone:num, country:'',
                      subject:'عرض اشتراك تطبيق عمارتنا', requirePhone:false });
    }catch(e){ window.open = window.open; return origOffer.apply(this, arguments); }
  };

  console.log('[عمارتنا] الإرسال بأكثر من قناة جاهز');
})();
