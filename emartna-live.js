/* ============================================================
   عمارتنا — مين بيجرّب البرنامج دلوقتي
   ------------------------------------------------------------
   مؤشر مباشر لصاحب البرنامج: كام زائر فاتح تجربة في اللحظة دي،
   بدأ من إمتى، وباقي قد إيه على انتهاء جلسته.

   بيتحدّث كل ٣٠ ثانية، وبيظهر في:
     • شريط أعلى الشاشة (لو في حد بيجرّب دلوقتي)
     • بطاقة تفصيلية في "كل العمارات"
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  window.__liveDemos = null;
  let timer = null;

  async function load(silent){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      if (!(window.isSysOwner && isSysOwner())){
        window.__liveDemos = [];      // مش صاحب برنامج → نفضّي ونشيل الشريط
        renderPill();
        return;
      }
      const { data, error } = await sb.rpc('live_demo_sessions');
      if (error) throw error;
      const before = (window.__liveDemos || []).length;
      window.__liveDemos = data || [];
      renderPill();
      if (!silent && before !== window.__liveDemos.length && window.renderSysContent)
        renderSysContent();
    }catch(e){ window.__liveDemos = window.__liveDemos || []; }
  }
  window.loadLiveDemos = load;

  /* ---------- الشريط العلوي ---------- */

  function renderPill(){
    try{
      const n = (window.__liveDemos || []).length;
      let el = document.getElementById('liveDemoPill');
      if (!n || !(window.isSysOwner && isSysOwner())){ if (el) el.remove(); return; }

      if (!el){
        el = document.createElement('button');
        el.id = 'liveDemoPill';
        el.onclick = () => openLiveDemos();
        el.style.cssText = 'position:fixed;top:12px;inset-inline-start:14px;z-index:9300;' +
          'background:#16a34a;color:#fff;border:0;border-radius:22px;padding:8px 15px;' +
          'font:700 13px system-ui;cursor:pointer;direction:rtl;' +
          'box-shadow:0 4px 16px rgba(22,163,74,.35)';
        document.body.appendChild(el);
      }
      el.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;
        background:#fff;margin-inline-end:6px;animation:pulse 1.6s infinite"></span>
        ${n} ${n === 1 ? 'زائر بيجرّب دلوقتي' : 'زوّار بيجرّبوا دلوقتي'}`;

      if (!document.getElementById('liveDemoCss')){
        const st = document.createElement('style');
        st.id = 'liveDemoCss';
        st.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}';
        document.head.appendChild(st);
      }
    }catch(e){}
  }

  /* ---------- نافذة التفاصيل ---------- */

  const roleLabel = r => r === 'owner' ? '🏠 صاحب شقة'
                     : r === 'admin' ? '🏢 رئيس اتحاد' : '—';

  window.openLiveDemos = function(){
    const rows = window.__liveDemos || [];
    openModal(`
      <h3>🟢 بيجرّبوا دلوقتي</h3>
      <p class="small mtop">جلسات التجربة المفتوحة في اللحظة دي. الجلسة بتفضل شغّالة
      طول ما الزائر مستخدم، وبتتقفل تلقائيًا بعد نص ساعة من آخر نشاط.</p>

      ${rows.length ? `<div class="mtop2">${rows.map(r => {
        const mins = Math.max(0, Number(r.minutes_left) || 0);
        const since = Math.round((Date.now() - new Date(r.started_at).getTime())/60000);
        return `
        <div class="card" style="border-inline-start:4px solid #16a34a">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
            <b>${roleLabel(r.role_tried)}</b>
            <span class="badge g">🟢 نشط</span>
          </div>
          <p class="small mtop">
            بدأ من ${since < 1 ? 'أقل من دقيقة' : since + ' دقيقة'} ·
            ${r.units} وحدة · ${r.moves} حركة في الجلسة
          </p>
          <p class="small" style="color:var(--muted)">
            الكود: ${esc2(r.code)} · باقي ${mins} دقيقة على انتهاء الجلسة
          </p>
        </div>`;
      }).join('')}</div>`
      : `<div class="card mtop2" style="text-align:center">
           <p class="small">مفيش حد بيجرّب دلوقتي.</p>
         </div>`}

      <div class="modal-actions">
        <button class="btn ghost" onclick="loadLiveDemos();setTimeout(()=>{closeModal();openLiveDemos();},400)">🔄 تحديث</button>
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      </div>`, true);
  };

  /* ---------- بطاقة في شاشة كل العمارات ---------- */

  const origDash = window.pageSysDashboard;
  if (typeof origDash === 'function' && !origDash.__live){
    const wrapped = function(){
      const rows = window.__liveDemos;
      const html = origDash.apply(this, arguments);
      if (rows === null){ setTimeout(() => load(true), 30); return html; }
      if (!rows.length) return html;

      const card = `
        <div class="card" style="border:1.5px solid #16a34a;
             background:linear-gradient(135deg,rgba(22,163,74,.08),transparent)">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <b style="color:#16a34a">🟢 ${rows.length} ${rows.length === 1
                ? 'زائر بيجرّب البرنامج دلوقتي' : 'زوّار بيجرّبوا البرنامج دلوقتي'}</b>
              <div class="small" style="color:var(--muted);margin-top:3px">
                ${rows.map(r => roleLabel(r.role_tried)).join(' · ')}
              </div>
            </div>
            <button class="btn sm primary" onclick="openLiveDemos()">شوف التفاصيل</button>
          </div>
        </div>`;
      return card + html;
    };
    wrapped.__live = true;
    window.pageSysDashboard = wrapped;
  }

  /* التشغيل: كل ٣٠ ثانية لصاحب البرنامج بس */
  function start(){
    if (timer) return;
    timer = setInterval(() => {
      if (window.isSysOwner && isSysOwner()) load(false);
      else { window.__liveDemos = null; renderPill(); }
    }, 30000);
  }

  let tries = 0;
  const t = setInterval(() => {
    if (++tries > 200) return clearInterval(t);
    if (window.CLOUD && window.CLOUD._sb){
      clearInterval(t);
      start();
      setTimeout(() => load(true), 1500);
    }
  }, 200);

  console.log('[عمارتنا] مؤشر التجارب المباشرة جاهز');
})();
