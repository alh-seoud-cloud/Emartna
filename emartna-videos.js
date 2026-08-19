/* ============================================================
   عمارتنا — فيديوهات الشرح
   ------------------------------------------------------------
   • قسم فيديوهات في الصفحة الرئيسية، مقسّم بمراحل
   • وفيديو مرتبط بكل شاشة جوه البرنامج (يظهر مع زرار المساعدة)
   • صاحب البرنامج بيضيف ويعدّل من "الموقع العام"
   البيانات بتتخزن مع إعدادات الصفحة الرئيسية على الخادم.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  const STAGES = [
    { k:'intro',   label:'تعريف بالبرنامج', icon:'🎬' },
    { k:'setup',   label:'البداية والإعداد', icon:'🚀' },
    { k:'money',   label:'التحصيل والماليات', icon:'💰' },
    { k:'reports', label:'التقارير المحاسبية', icon:'📊' },
    { k:'people',  label:'السكان والتواصل', icon:'👥' },
    { k:'advanced',label:'مواضيع متقدّمة', icon:'⚙️' },
  ];

  /* ---------- تخزين ---------- */

  function list(){
    try{
      const ls = window.ensureLandingSettings ? ensureLandingSettings() : null;
      if (!ls) return [];
      ls.videos = ls.videos || [];
      return ls.videos;
    }catch(e){ return []; }
  }

  /* استخراج معرّف يوتيوب من أي شكل رابط */
  window.youtubeId = function(url){
    const u = String(url || '').trim();
    const m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(u)) return u;      // اتلصق المعرّف لوحده
    return null;
  };

  const thumb = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  /* ---------- المشغّل ---------- */

  window.playVideo = function(vid){
    const v = list().find(x => x.id === vid);
    if (!v) return;
    const yid = youtubeId(v.url);
    if (!yid) return showMessage('رابط الفيديو مش مظبوط');
    openModal(`
      <h3>${esc2(v.title || 'شرح')}</h3>
      ${v.desc ? `<p class="small mtop">${esc2(v.desc)}</p>` : ''}
      <div style="position:relative;padding-top:56.25%;margin-top:12px;border-radius:12px;overflow:hidden;background:#000">
        <iframe src="https://www.youtube-nocookie.com/embed/${yid}?rel=0&modestbranding=1"
          style="position:absolute;inset:0;width:100%;height:100%;border:0"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen loading="lazy" title="${esc2(v.title||'')}"></iframe>
      </div>
      <p class="small mtop">
        <a href="https://www.youtube.com/watch?v=${yid}" target="_blank" rel="noopener">
          افتح على يوتيوب ↗</a>
      </p>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  /* ---------- قسم الصفحة الرئيسية ---------- */

  function landingSection(){
    const vids = list().filter(v => v.showOnLanding !== false && youtubeId(v.url));
    if (!vids.length) return '';

    const byStage = STAGES
      .map(s => ({ ...s, items: vids.filter(v => (v.stage || 'intro') === s.k) }))
      .filter(s => s.items.length);

    return `
    <div class="section-title" style="text-align:center"><h3>🎥 اتعلّم البرنامج في دقايق</h3></div>
    <p class="small" style="text-align:center;color:var(--muted);margin-bottom:14px">
      فيديوهات قصيرة مرتّبة بالمراحل — ابدأ من الأول أو روح للجزء اللي يهمّك.</p>
    ${byStage.map(s => `
      <div style="max-width:900px;margin:0 auto 18px">
        <b style="display:block;margin-bottom:8px">${s.icon} ${esc2(s.label)}</b>
        <div class="grid g3">
          ${s.items.map(v => {
            const yid = youtubeId(v.url);
            return `<div class="card" style="padding:0;overflow:hidden;cursor:pointer"
                      onclick="playVideo('${v.id}')">
              <div style="position:relative;padding-top:56%;background:#000">
                <img src="${thumb(yid)}" alt="${esc2(v.title||'')}" loading="lazy"
                     style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9">
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
                  <span style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.92);
                        display:flex;align-items:center;justify-content:center;font-size:19px">▶</span>
                </div>
                ${v.duration ? `<span style="position:absolute;bottom:6px;inset-inline-start:6px;
                  background:rgba(0,0,0,.75);color:#fff;font-size:11px;padding:2px 6px;border-radius:5px">
                  ${esc2(v.duration)}</span>` : ''}
              </div>
              <div style="padding:10px 12px">
                <b class="small">${esc2(v.title || 'فيديو')}</b>
                ${v.desc ? `<div class="small" style="color:var(--muted);margin-top:3px">${esc2(v.desc)}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}`;
  }

  const origLanding = window.landingHTML;
  if (origLanding && !origLanding.__videosWrapped){
    const wrapped = function(){
      const html = origLanding.apply(this, arguments);
      const sec = landingSection();
      if (!sec) return html;
      const mark = '<div class="section-title" style="text-align:center"><h3>مميزات البرنامج</h3>';
      const i = html.indexOf(mark);
      return i > -1 ? html.slice(0,i) + sec + html.slice(i) : html + sec;
    };
    wrapped.__videosWrapped = true;
    window.landingHTML = wrapped;
  }

  /* ---------- فيديو الشاشة الحالية جوه البرنامج ---------- */

  window.screenVideo = function(page){
    return list().find(v => v.screen && v.screen === page && youtubeId(v.url)) || null;
  };

  if (typeof window.openPageHelp === 'function' && !window.openPageHelp.__vidWrapped){
    const o = window.openPageHelp;
    const wrapped = function(){
      const r = o.apply(this, arguments);
      const v = screenVideo(typeof curPage !== 'undefined' ? curPage : '');
      if (v){
        setTimeout(() => {
          const box = document.getElementById('modalBox');
          if (!box || box.querySelector('.scr-vid')) return;
          const d = document.createElement('div');
          d.className = 'card scr-vid';
          d.style.cssText = 'margin-top:10px;border:1px solid var(--accent)';
          d.innerHTML = `<b>🎥 فيديو شرح الشاشة دي</b>
            <p class="small mtop">${esc2(v.title||'')}</p>
            <button class="btn primary sm mtop" onclick="playVideo('${v.id}')">▶ شغّل الفيديو</button>`;
          const h3 = box.querySelector('h3');
          if (h3) h3.after(d); else box.prepend(d);
        }, 0);
      }
      return r;
    };
    wrapped.__vidWrapped = true;
    window.openPageHelp = wrapped;
  }

  /* ---------- إدارة الفيديوهات (صاحب البرنامج) ---------- */

  window.openVideoModal = function(id){
    const v = id ? list().find(x => x.id === id) : null;
    const pages = ['','dashboard','apartments','users','collections','expenses','treasury',
      'projects','paymentRequests','trialBalance','aging','incomeStatement','balanceSheet',
      'floors','polls','announcements','meetings','suggestions','chat','license','settings'];
    openModal(`
      <h3>${v ? 'تعديل فيديو' : '+ فيديو جديد'}</h3>
      <div class="field2 mtop"><label>رابط يوتيوب</label>
        <input id="vdUrl" value="${v?esc2(v.url):''}" placeholder="https://youtu.be/xxxxxxxxxxx" dir="ltr"></div>
      <div class="field2"><label>العنوان</label>
        <input id="vdTitle" value="${v?esc2(v.title):''}" placeholder="مثال: إزاي تضيف وحدات عمارتك"></div>
      <div class="field2"><label>وصف قصير</label>
        <input id="vdDesc" value="${v?esc2(v.desc||''):''}" placeholder="سطر واحد يوضّح الفيديو"></div>
      <div class="grid g2">
        <div class="field2"><label>المرحلة</label>
          <select id="vdStage">${STAGES.map(s =>
            `<option value="${s.k}" ${v&&v.stage===s.k?'selected':''}>${s.icon} ${s.label}</option>`).join('')}</select></div>
        <div class="field2"><label>المدة (اختياري)</label>
          <input id="vdDur" value="${v?esc2(v.duration||''):''}" placeholder="2:45" dir="ltr"></div>
      </div>
      <div class="field2"><label>مرتبط بشاشة (اختياري)</label>
        <select id="vdScreen">${pages.map(p =>
          `<option value="${p}" ${v&&v.screen===p?'selected':''}>${p||'— مش مرتبط بشاشة —'}</option>`).join('')}</select>
        <p class="small">لو اخترت شاشة، الفيديو هيظهر لرئيس الاتحاد في زرار المساعدة داخلها.</p></div>
      <div class="field2"><label><input type="checkbox" id="vdLanding" ${!v||v.showOnLanding!==false?'checked':''}>
        اعرضه في الصفحة الرئيسية</label></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveVideo('${v?v.id:''}')">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveVideo = function(id){
    const g = i => (document.getElementById(i)||{}).value || '';
    const url = g('vdUrl').trim();
    if (!youtubeId(url)) return showMessage('حط رابط يوتيوب صحيح');
    const title = g('vdTitle').trim();
    if (!title) return showMessage('اكتب عنوان للفيديو');
    const ls = ensureLandingSettings();
    ls.videos = ls.videos || [];
    const rec = {
      id: id || ('vid_' + Date.now()),
      url, title, desc: g('vdDesc').trim(),
      stage: g('vdStage') || 'intro',
      duration: g('vdDur').trim(),
      screen: g('vdScreen') || '',
      showOnLanding: !!(document.getElementById('vdLanding')||{}).checked,
    };
    const i = ls.videos.findIndex(x => x.id === rec.id);
    if (i >= 0) ls.videos[i] = rec; else ls.videos.push(rec);
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظ الفيديو');
    if (window.renderSysContent) renderSysContent();
  };

  window.deleteVideo = function(id){
    const go = () => {
      const ls = ensureLandingSettings();
      ls.videos = (ls.videos||[]).filter(x => x.id !== id);
      saveRegistry();
      if (window.renderSysContent) renderSysContent();
      if (window.toast) toast('اتحذف الفيديو');
    };
    if (typeof window.confirmDelete === 'function')
      return confirmDelete('حذف الفيديو ده من الصفحة الرئيسية؟', go);
    if (confirm('حذف الفيديو؟')) go();
  };

  /* بطاقة الإدارة في شاشة الصفحة الرئيسية */
  const origLandingPage = window.pageSysLandingSettings;
  if (origLandingPage) window.pageSysLandingSettings = function(){
    const vids = list();
    const card = `
      <div class="card content-narrow">
        <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><b>🎥 فيديوهات الشرح</b>
            <div class="small" style="color:var(--muted)">${vids.length} فيديو · بيظهروا في الصفحة الرئيسية مقسّمين بالمراحل</div></div>
          <button class="btn primary sm" onclick="openVideoModal()">+ فيديو جديد</button>
        </div>
        ${vids.length ? `<div class="mtop">${vids.map(v => {
          const yid = youtubeId(v.url);
          const st = STAGES.find(s => s.k === (v.stage||'intro'));
          return `<div class="flexrow" style="padding:8px 0;border-bottom:1px solid var(--line);gap:10px;align-items:center">
            ${yid ? `<img src="${thumb(yid)}" style="width:74px;height:44px;object-fit:cover;border-radius:6px" loading="lazy">`
                  : '<span class="badge r">رابط غلط</span>'}
            <div style="flex:1">
              <b class="small">${esc2(v.title)}</b>
              <div class="small" style="color:var(--muted)">
                ${st?st.icon+' '+st.label:''}${v.screen?' · شاشة: '+esc2(v.screen):''}${v.showOnLanding===false?' · مخفي من الرئيسية':''}
              </div>
            </div>
            <button class="btn sm ghost" onclick="playVideo('${v.id}')">▶</button>
            <button class="btn sm ghost" onclick="openVideoModal('${v.id}')">تعديل</button>
            <button class="btn sm red" onclick="deleteVideo('${v.id}')">حذف</button>
          </div>`;
        }).join('')}</div>` : '<p class="small mtop">لسه مضفتش فيديوهات.</p>'}
      </div>`;
    return card + origLandingPage.apply(this, arguments);
  };

  console.log('[عمارتنا] فيديوهات الشرح جاهزة');
})();
