/* ============================================================
   عمارتنا — مرفقات الشات (صورة أو PDF)
   ------------------------------------------------------------
   المساحة هي القيد الأساسي: صورة موبايل حديثة ٤-٨ ميجا، وعمارة
   فيها ١٠٠ ساكن ممكن تبعت ٥٠ صورة في الشهر = ٤٠٠ ميجا سنويًا
   للعمارة الواحدة.

   فبنضغط الصورة في المتصفح قبل الرفع: أقصى بُعد ١٦٠٠ بكسل وجودة
   ٧٢٪ بصيغة WebP. النتيجة عادةً ١٥٠-٤٠٠ كيلو — أقل ٩٠٪ من الأصل
   ومن غير فرق ملحوظ في الوضوح لصور الإيصالات والأعطال.

   الـPDF بيترفع زي ما هو (مش بينضغط) بحد ٣ ميجا.
   ============================================================ */

(function(){
  'use strict';

  const MAX_DIM      = 1600;
  const IMG_QUALITY  = 0.72;
  const MAX_PDF      = 3 * 1024 * 1024;
  const MAX_ANY      = 5 * 1024 * 1024;
  const OK_TYPES     = ['image/jpeg','image/png','image/webp','image/heic',
                        'image/heif','application/pdf'];

  const sb    = () => (window.CLOUD && window.CLOUD._sb) || null;
  const esc2  = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const bUuid = () => { try{ return CLOUD._cache.buildingUuid[window.activeBuildingId] || null; }
                        catch(e){ return null; } };
  const kb = n => n < 1024*1024
    ? Math.round(n/1024) + ' ك.ب'
    : (n/1024/1024).toFixed(1) + ' م.ب';

  /* ---------- ضغط الصورة ---------- */

  async function shrink(file){
    if (file.type === 'application/pdf') return { blob:file, kind:'pdf' };

    const url = URL.createObjectURL(file);
    try{
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('الصورة مش مقروءة'));
        i.src = url;
      });

      let { width:w, height:h } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      /* WebP أصغر من JPEG بنحو ٢٥٪ لنفس الجودة، ومدعوم في كل
         المتصفحات الحديثة. لو فشل بنرجع لـJPEG. */
      const blob = await new Promise(res => {
        c.toBlob(b => b ? res(b) : c.toBlob(res, 'image/jpeg', IMG_QUALITY),
                 'image/webp', IMG_QUALITY);
      });
      if (!blob) throw new Error('تعذّر ضغط الصورة');
      return { blob, kind:'image' };
    } finally { URL.revokeObjectURL(url); }
  }

  /* ---------- الرفع ---------- */

  async function upload(file){
    const s = sb(), b = bUuid();
    if (!s || !b) throw new Error('مش متصل بالسحابة.');

    if (!OK_TYPES.includes(file.type))
      throw new Error('النوع ده مش مسموح. الصور وملفات PDF بس.');
    if (file.size > MAX_ANY)
      throw new Error('الملف أكبر من ٥ ميجا. صغّره وجرّب تاني.');
    if (file.type === 'application/pdf' && file.size > MAX_PDF)
      throw new Error('ملف الـPDF أكبر من ٣ ميجا.');

    const { blob, kind } = await shrink(file);
    const ext  = kind === 'pdf' ? 'pdf' : (blob.type === 'image/webp' ? 'webp' : 'jpg');
    const path = `chat/${b}/${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;

    const { error } = await s.storage.from('attachments')
      .upload(path, blob, { contentType: blob.type, upsert:false });
    if (error) throw error;

    return { path, kind, name:file.name, size:blob.size, saved:file.size - blob.size };
  }

  /* رابط مؤقت — الدلو خاص، فمفيش رابط دائم */
  const urlCache = {};
  window.attUrl = async function(path){
    if (urlCache[path] && urlCache[path].exp > Date.now()) return urlCache[path].u;
    try{
      const { data, error } = await sb().storage.from('attachments')
        .createSignedUrl(path, 3600);
      if (error) throw error;
      urlCache[path] = { u:data.signedUrl, exp: Date.now() + 3000000 };
      return data.signedUrl;
    }catch(e){ return null; }
  };

  /* ---------- اختيار الملف ---------- */

  window.__chatAtt = null;

  window.pickChatAttachment = function(target){
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,application/pdf';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const bar = document.getElementById('attBar');
      if (bar) bar.innerHTML =
        '<span class="small">⏳ بنجهّز الملف...</span>';
      try{
        const a = await upload(f);
        window.__chatAtt = Object.assign(a, { target });
        paintBar();
        if (a.kind === 'image' && a.saved > 50000 && window.toast)
          toast('اتضغطت الصورة: ' + kb(a.size) + ' بدل ' + kb(a.size + a.saved));
      }catch(e){
        window.__chatAtt = null; paintBar();
        showMessage(e.message || 'تعذّر رفع الملف');
      }
    };
    inp.click();
  };

  window.clearChatAttachment = function(){
    const a = window.__chatAtt;
    if (a && a.path){
      try{ sb().storage.from('attachments').remove([a.path]); }catch(e){}
    }
    window.__chatAtt = null; paintBar();
  };

  function paintBar(){
    const bar = document.getElementById('attBar');
    if (!bar) return;
    const a = window.__chatAtt;
    if (!a){ bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = `
      <span style="font-size:17px">${a.kind === 'pdf' ? '📄' : '🖼️'}</span>
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:12.5px;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis">${esc2(a.name)}</span>
        <span class="small" style="color:var(--muted)">${kb(a.size)}</span>
      </span>
      <button class="btn sm ghost" onclick="clearChatAttachment()">✕</button>`;
  }
  window.paintAttBar = paintBar;

  /* ---------- العرض داخل الرسالة ---------- */

  window.attachmentHTML = function(m){
    if (!m || !m.attPath && !m.att_path) return '';
    const path = m.attPath || m.att_path;
    const kind = m.attKind || m.att_kind || 'image';
    const name = m.attName || m.att_name || 'مرفق';
    const id   = 'att_' + Math.random().toString(36).slice(2,9);

    /* الرابط موقّع ومؤقت، فبنجيبه بعد الرسم */
    setTimeout(async () => {
      const url = await attUrl(path);
      const el = document.getElementById(id);
      if (!el || !url) return;
      el.innerHTML = kind === 'pdf'
        ? `<a href="${url}" target="_blank" class="btn sm ghost"
             style="display:inline-flex;gap:6px;align-items:center">
             📄 ${esc2(name)}</a>`
        : `<a href="${url}" target="_blank">
             <img src="${url}" alt="${esc2(name)}" loading="lazy"
               style="max-width:220px;max-height:220px;border-radius:9px;
                 display:block;object-fit:cover"></a>`;
    }, 30);

    return `<div id="${id}" class="mtop" style="min-height:26px">
      <span class="small" style="color:var(--muted)">⏳ بيحمّل المرفق...</span></div>`;
  };

  /* ---------- عدّاد المساحة ---------- */

  let QUOTA = null;

  async function loadQuota(){
    try{
      const s = sb(), b = bUuid(); if (!s || !b) return null;
      const { data, error } = await s.rpc('building_storage', { p_building:b });
      if (error || !data || !data[0]) return null;
      QUOTA = data[0];
      return QUOTA;
    }catch(e){ return null; }
  }

  /* تنبيه مرة واحدة في الجلسة عند ٨٠٪ — التنبيه مش منع */
  async function warnIfNear(){
    const q = await loadQuota();
    if (!q || !window.getSession || !getSession()) return;
    const u = window.currentUser && currentUser();
    if (!u || !window.isStaffRole || !isStaffRole(u.role)) return;   // للإدارة بس
    const pct = Number(q.pct) || 0;
    if (pct < 80) return;
    const key = 'emartna_quota_warned_' + (window.activeBuildingId||'') +
                '_' + Math.floor(pct / 10);
    try{ if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key,'1'); }catch(e){}
    if (window.showMessage) showMessage(
      (pct >= 100 ? '⚠️ مساحة المرفقات خلصت' : '⚠️ مساحة المرفقات قربت تخلص') +
      `\n\nاستهلكت ${pct}% من ${q.quota_mb} ميجا (${q.files} ملف).\n\n` +
      'المرفقات هتفضل تشتغل عادي — بس يفضّل تمسح المرفقات القديمة ' +
      'اللي مش محتاجها، أو تكلّم الدعم لزيادة المساحة.');
  }
  setTimeout(warnIfNear, 6000);
  document.addEventListener('emartna:building-complete', () => setTimeout(warnIfNear, 4000));

  /* بطاقة في شاشة الإعدادات */
  window.openStorageUsage = async function(){
    openModal('<h3>⏳ بنحسب المساحة...</h3>');
    const q = await loadQuota();
    if (!q) return showMessage('تعذّر حساب المساحة.');
    const pct = Math.min(100, Number(q.pct) || 0);
    const color = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--gold)' : 'var(--accent)';
    openModal(`
      <h3>💾 مساحة المرفقات</h3>
      <p class="small mtop">الصور وملفات PDF اللي اتبعتت في المحادثات
        وإثباتات الدفع.</p>

      <div class="mtop2" style="background:var(--line);border-radius:99px;height:12px;
        overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};
        transition:width .3s"></div></div>
      <p class="mtop"><b style="font-size:19px;color:${color}">${pct}%</b>
        <span class="small" style="color:var(--muted)">
          — ${(q.used_bytes/1048576).toFixed(1)} من ${q.quota_mb} ميجا
          · ${q.files} ملف</span></p>

      ${pct >= 70 ? `<div class="card mtop" style="background:var(--tint-warning)">
        <b class="small">المساحة قربت تخلص</b>
        <div class="small">المرفقات مش هتتمنع — بس يفضّل تمسح القديم
          اللي مش محتاجه، أو تكلّم الدعم لزيادة المساحة.</div></div>` : ''}

      <p class="small mtop2" style="color:var(--muted)">
        💡 الصور بتتضغط تلقائيًا قبل الرفع، فالصورة بتاخد حوالي ربع ميجا
        بدل ٤ ميجا — يعني مساحتك تكفي حوالي
        ${Math.round(q.quota_mb * 4)} صورة.</p>

      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`);
  };

  (function addCard(){
    function go(){
      try{
        if (!window.SETTINGS_CARDS) return false;
        if (SETTINGS_CARDS.some(c => c.key === 'storage')) return true;
        SETTINGS_CARDS.push({ key:'storage', icon:'💾',
          title:'مساحة المرفقات',
          sub:'الصور والملفات في المحادثات' });
        const orig = window.openSettingsCard;
        if (typeof orig === 'function' && !orig.__stor){
          const w = function(key){
            if (key === 'storage') return openStorageUsage();
            return orig.apply(this, arguments);
          };
          w.__stor = true; window.openSettingsCard = w;
        }
        return true;
      }catch(e){ return false; }
    }
    if (!go()) setTimeout(go, 2500);
  })();

  console.log('[عمارتنا] مرفقات الشات جاهزة');
})();
