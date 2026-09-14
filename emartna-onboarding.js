/* ============================================================
   عمارتنا — معالج البداية + تسليم إدارة العمارة
   ------------------------------------------------------------
   ١) معالج ٥ خطوات بيمشّي رئيس الاتحاد الجديد من "عمارة فاضية"
      لـ"عمارة شغّالة". الخطوات بتتحدد من البيانات نفسها —
      مفيش حفظ لحالة منفصلة تتعارض مع الواقع.

   ٢) تسليم الإدارة: صاحب شقة سجّل العمارة وعايز يسلّمها
      لرئيس الاتحاد الحقيقي — يكمل على نفس البيانات أو يبدأ نضيف.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const DISMISS = 'emartna_wizard_dismissed';

  /* ---------- حالة الخطوات — محسوبة من البيانات ---------- */

  function steps(){
    const D = window.D || {};
    const b = D.building || {};
    const aps = D.apartments || [];
    const withFee = aps.filter(a => Number(a.monthlyFee) > 0).length;
    const withPhone = aps.filter(a => a.phone).length;
    const hasLedger = (D.ledger || []).some(l => l.type === 'شهري');
    const invited = (D.users || []).filter(u => u.apartmentId).length;

    return [
      { key:'building', icon:'🏢', title:'بيانات العمارة',
        desc:'اسم العمارة والعنوان وعدد الأدوار — بتظهر في كل التقارير.',
        done: !!(b.name && b.city),
        action:'go(\'building\')', label:'افتح بيانات العمارة' },

      { key:'units', icon:'🚪', title:'ضيف وحداتك',
        desc:'الشقق والمحلات وأسماء الملاك. عندك عدد كبير؟ استورد من إكسل في دقيقة.',
        done: aps.length > 0,
        detail: aps.length ? `${aps.length} وحدة` : '',
        action:'go(\'apartments\')', label:'افتح الشقق والملاك' },

      { key:'fees', icon:'💰', title:'حدّد الاشتراك الشهري',
        desc:'قيمة الاشتراك لكل وحدة. من غيرها مش هيتولّد تحصيل.',
        done: aps.length > 0 && withFee === aps.filter(a => !a.closed).length,
        detail: aps.length ? `${withFee} من ${aps.length} محدّد` : '',
        action:'openApUpdateImport()', label:'حدّد بالإكسل (أسرع)' },

      { key:'collect', icon:'🧾', title:'ولّد التحصيل الشهري',
        desc:'البرنامج بيسجّل المستحق على كل وحدة تلقائيًا كل شهر.',
        done: hasLedger,
        action:'go(\'collections\')', label:'افتح التحصيل' },

      { key:'invite', icon:'📨', title:'ادعُ السكان',
        desc:'كل ساكن يشوف حسابه بنفسه — ده اللي بيوقف السؤال المتكرر "أنا دفعت ولا لأ؟".',
        done: invited > 0,
        detail: withPhone ? `${withPhone} وحدة عندها رقم موبايل` : 'محتاج أرقام موبايل الأول',
        action:'go(\'users\')', label:'افتح المستخدمين' },
    ];
  }

  window.wizardProgress = function(){
    const s = steps();
    return { done: s.filter(x => x.done).length, total: s.length, steps: s };
  };

  /* ---------- المعالج ---------- */

  window.openSetupWizard = function(){
    const { done, total, steps: list } = wizardProgress();
    const pct = Math.round(done / total * 100);
    const next = list.find(s => !s.done);

    openModal(`
      <h3>🚀 خطوات تشغيل عمارتك</h3>
      <p class="small mtop">${done === total
        ? 'مبروك — عمارتك شغّالة بالكامل. تقدر تقفل النافذة دي.'
        : 'خمس خطوات بس وعمارتك تبقى شغّالة. كل خطوة بتتعلّم لوحدها أول ما تخلّصها.'}</p>

      <div class="card mtop" style="padding:12px">
        <div class="flexrow" style="justify-content:space-between">
          <b>${done} من ${total} خطوات</b><b style="color:var(--accent)">${pct}%</b>
        </div>
        <div style="height:9px;background:var(--line);border-radius:6px;margin-top:7px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--accent);transition:width .4s"></div>
        </div>
      </div>

      <div class="mtop">
        ${list.map((s,i) => {
          const isNext = next && s.key === next.key;
          return `
          <div class="card" style="margin-bottom:9px;padding:12px;
               border:1px solid ${isNext ? 'var(--accent)' : 'var(--line)'};
               ${s.done ? 'opacity:.62' : ''}">
            <div class="flexrow" style="align-items:flex-start;gap:10px">
              <div style="font-size:22px;min-width:30px">${s.done ? '✅' : s.icon}</div>
              <div style="flex:1">
                <b>${i+1}. ${esc2(s.title)}</b>
                ${s.detail ? `<span class="badge n" style="margin-inline-start:6px">${esc2(s.detail)}</span>` : ''}
                <div class="small" style="color:var(--muted);margin-top:3px">${esc2(s.desc)}</div>
                ${!s.done ? `<button class="btn sm ${isNext?'primary':'ghost'}" style="margin-top:8px"
                    onclick="closeModal();${s.action}">${esc2(s.label)}</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">إغلاق</button>
        ${done < total ? `<button class="btn ghost" onclick="dismissWizard()">مش دلوقتي — بلاش تفكّرني</button>` : ''}
      </div>`, true);
  };

  window.dismissWizard = function(){
    try{ localStorage.setItem(DISMISS + '_' + (window.activeBuildingId||''), '1'); }catch(e){}
    closeModal();
    if (window.toast) toast('تقدر ترجعله في أي وقت من زرار 🚀 في الأعلى');
    renderContent();
  };

  function dismissed(){
    /* إخفاء مؤقت بأسبوع من زرار ✕ في الشريط */
    try{
      const t = parseInt(localStorage.getItem('emartna_setup_bar_hide'),10);
      if (t && Date.now() < t) return true;
    }catch(e){}
    try{ return localStorage.getItem(DISMISS + '_' + (window.activeBuildingId||'')) === '1'; }
    catch(e){ return false; }
  }

  /* بطاقة التقدّم في لوحة التحكم */
  const origDash = window.pageAdminDashboard;
  if (origDash) window.pageAdminDashboard = function(){
    const html = origDash.apply(this, arguments);
    const { done, total, steps: list } = wizardProgress();
    if (done === total || dismissed()) return html;

    const next = list.find(s => !s.done);
    const pct = Math.round(done / total * 100);
    /* ⚠️ كان كارت كامل فوق لوحة التحكم — مع كارت النسخة الاحتياطية
       كانوا بياخدوا نص الشاشة على الموبايل قبل ما المستخدم يشوف أي
       رقم. بقى شريط رفيع بمؤشر تقدّم، والتفاصيل في نافذة. */
    const bar = `
      <div class="flexrow" style="gap:8px;align-items:center;flex-wrap:nowrap;
        padding:7px 11px;margin-bottom:10px;border-radius:10px;
        border:1px solid var(--accent);background:var(--tint);cursor:pointer"
        onclick="openSetupWizard()">
        <span style="font-size:15px;flex:0 0 auto">🚀</span>
        <span style="flex:1;min-width:0">
          <span style="display:block;font-size:12.5px;font-weight:700;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            إعداد العمارة ${done}/${total} — ${esc2(next.title)}</span>
          <span style="display:block;height:4px;background:var(--line);
            border-radius:3px;margin-top:4px;overflow:hidden">
            <span style="display:block;width:${pct}%;height:100%;
              background:var(--accent)"></span></span>
        </span>
        <button class="btn sm primary" style="flex:0 0 auto;padding:4px 10px;font-size:12px"
          onclick="event.stopPropagation();${next.action}">كمّل</button>
        <span onclick="event.stopPropagation();dismissSetupBar()"
          title="إخفاء لأسبوع" style="flex:0 0 auto;cursor:pointer;opacity:.5;
          font-size:14px;padding:0 3px">✕</span>
      </div>`;
    return bar + html;
  };

  /* الإخفاء لأسبوع مش للأبد — الإعداد الناقص بيأثر على استخدامه */
  window.dismissSetupBar = function(){
    try{ localStorage.setItem('emartna_setup_bar_hide',
      String(Date.now() + 7*86400000)); }catch(e){}
    if (window.renderContent) renderContent();
    if (window.toast) toast('هنفكّرك بعد أسبوع');
  };

  /* ============================================================
     ٢) تسليم إدارة العمارة
     ============================================================ */

  window.openHandoverModal = function(){
    const D = window.D || {};
    const aps = (D.apartments || []).length;
    const moves = (D.ledger || []).length + (D.expenses || []).length;

    openModal(`
      <h3>👑 تسليم إدارة العمارة</h3>
      <p class="small mtop">
        سجّلت العمارة وبتجرّب، ورئيس الاتحاد الحقيقي عايز يستلم؟
        تقدر تسلّمه الإدارة وهو يكمّل على نفس البيانات — أو يبدأ نضيف.
      </p>

      <div class="card mtop">
        <b>الوضع الحالي</b>
        <p class="small mtop">${aps} وحدة · ${moves} حركة مسجّلة</p>
      </div>

      <div class="card mtop">
        <b>الخطوة ١: ولّد دعوة رئيس اتحاد</b>
        <p class="small mtop">هيوصله كود، يسجّل برقمه، ويبقى ليه كل الصلاحيات زيّك بالظبط.</p>
        <button class="btn primary mtop" onclick="closeModal();openUserModal()">
          📨 ولّد دعوة رئيس اتحاد</button>
      </div>

      <div class="card mtop">
        <b>الخطوة ٢ (اختيارية): البداية من جديد</b>
        <p class="small mtop">
          لو حابب يبدأ ببيانات نضيفة، تقدر تفرّغ العمارة قبل ما يستلم.
          <b>العملية دي مش قابلة للتراجع</b> — خد نسخة احتياطية الأول.
        </p>
        <div class="flexrow mtop" style="flex-wrap:wrap;gap:8px">
          <button class="btn gold sm" onclick="openBuildingBackupModal&&openBuildingBackupModal()">
            💾 خد نسخة الأول</button>
          <button class="btn ghost sm" onclick="confirmReset(true)">
            🧹 امسح الحركات واحتفظ بالوحدات</button>
          <button class="btn red sm" onclick="confirmReset(false)">
            🗑️ امسح كل حاجة والوحدات كمان</button>
        </div>
      </div>

      <p class="small mtop" style="color:var(--muted)">
        ℹ️ بعد ما يستلم، تقدر تفضل معاه كصاحب شقة أو كإداري — أو تشيل نفسك من
        شاشة المستخدمين. العمارة مش هتتأثر.
      </p>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  window.confirmReset = function(keepUnits){
    const msg = keepUnits
      ? 'هيتم مسح كل الحركات المالية والمصروفات والبلاغات والإعلانات — والوحدات وأصحابها هيفضلوا زي ما هما.'
      : 'هيتم مسح كل حاجة: الحركات والمصروفات والوحدات وأصحابها. العمارة هترجع فاضية تمامًا.';
    if (typeof window.confirmDelete === 'function')
      return confirmDelete(msg + '\n\nمتأكد؟ العملية دي مش قابلة للتراجع.',
                           () => doReset(keepUnits));
    if (confirm(msg)) doReset(keepUnits);
  };

  async function doReset(keepUnits){
    try{
      const uuid = window.CLOUD && CLOUD.storage
        ? CLOUD.storage.uuidOfBuilding(window.activeBuildingId) : null;
      if (!uuid) return showMessage('تعذّر تحديد العمارة');
      if (window.toast) toast('بيفرّغ البيانات…');
      const { data, error } = await CLOUD._sb.rpc('reset_building_data',
        { p_building: uuid, p_keep_units: !!keepUnits });
      if (error) throw error;
      await CLOUD.loadBuilding(window.activeBuildingId);
      window.D = window.loadBuildingData(window.activeBuildingId);
      closeModal();
      renderContent();
      showMessage('✅ اتفرّغت العمارة.\n\n' +
        Object.entries(data || {}).map(([k,v]) => `${k.replace(/_/g,' ')}: ${v}`).join(' · '));
    }catch(e){
      showMessage('تعذّر التفريغ: ' + (window.cloudErrorText ? cloudErrorText(e) : e.message));
    }
  }

  /* زرار التسليم في شاشة المستخدمين */
  const origUsers = window.pageUsers;
  if (origUsers && !origUsers.__handoverWrapped){
    const wrapped = function(){
    const html = origUsers.apply(this, arguments);
    const btn = `<button class="btn ghost" onclick="openHandoverModal()">👑 تسليم إدارة العمارة</button>`;
    const m = html.match(/<button class="btn ghost" onclick="openUserModal\(\)">[^<]*<\/button>/);
    return m ? html.replace(m[0], m[0] + btn)
             : `<div class="flexrow" style="margin-bottom:10px">${btn}</div>` + html;
    };
    wrapped.__handoverWrapped = true;
    window.pageUsers = wrapped;
  }

  /* زرار المعالج في الشريط العلوي */
  setTimeout(() => {
    const actions = document.querySelector('.top .actions');
    if (!actions || document.getElementById('wizBtn')) return;
    const b = document.createElement('button');
    b.id = 'wizBtn'; b.className = 'btn sm ghost';
    b.title = 'خطوات تشغيل عمارتك';
    b.textContent = '🚀';
    b.onclick = () => openSetupWizard();
    actions.insertBefore(b, actions.firstChild);
  }, 2500);

  console.log('[عمارتنا] معالج البداية والتسليم جاهز');
})();
