/* ============================================================
   عمارتنا — جدول كل العمارات: أعمدة ثابتة + مؤشرات استهداف
   ------------------------------------------------------------
   ١) تثبيت أول عمودين (اسم العمارة + الكود) أثناء التمرير
      الأفقي، مع إمكانية إلغاء التثبيت بضغطة.
   ٢) أعمدة جديدة تساعد صاحب البرنامج يستهدف كل عمارة:
      نسبة اكتمال البيانات · الأرقام المسجّلة · الدعوات ·
      الحسابات المفعّلة · الحركات ومتوسطها الشهري · آخر نشاط.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const PIN_KEY = 'emartna_pin_cols';

  const pinned = () => { try{ return localStorage.getItem(PIN_KEY) !== '0'; }catch(e){ return true; } };
  window.togglePinnedCols = function(){
    try{ localStorage.setItem(PIN_KEY, pinned() ? '0' : '1'); }catch(e){}
    if (window.renderSysContent) renderSysContent(); else renderContent();
  };

  /* ---------- ١) تثبيت الأعمدة ---------- */

  function tableRoomCss(){
    return `<style id="bldRoomCss">
      /* مساحة أوسع وصفوف أوضح لجدول العمارات */
      #sysBldTable_wrap .table-wrap, #supportBldTable_wrap .table-wrap{
        max-height:none; min-height:340px;
      }
      #sysBldTable_wrap .table-wrap td, #supportBldTable_wrap .table-wrap td{
        padding:11px 10px; font-size:13px;
      }
      #sysBldTable_wrap .table-wrap th, #supportBldTable_wrap .table-wrap th{
        padding:10px; font-size:12.5px;
      }
      #sysBldTable_wrap .table-wrap tbody tr:hover td,
      #supportBldTable_wrap .table-wrap tbody tr:hover td{ background:var(--hover,#F3F8F7); }
    </style>`;
  }

  function pinStyle(){
    if (!pinned()) return '';
    // الحاوية اللي بتتحرك أفقيًا اسمها .table-wrap جوه #<id>_wrap
    return `<style id="pinColsCss">
      /* أول عمودين بيفضلوا مكانهم أثناء التمرير الأفقي */
      #sysBldTable_wrap .table-wrap th:nth-child(1), #sysBldTable_wrap .table-wrap td:nth-child(1),
      #supportBldTable_wrap .table-wrap th:nth-child(1), #supportBldTable_wrap .table-wrap td:nth-child(1){
        position:sticky; inset-inline-start:0; z-index:3;
        background:var(--panel); box-shadow:3px 0 6px -3px rgba(0,0,0,.16);
      }
      #sysBldTable_wrap .table-wrap th:nth-child(2), #sysBldTable_wrap .table-wrap td:nth-child(2),
      #supportBldTable_wrap .table-wrap th:nth-child(2), #supportBldTable_wrap .table-wrap td:nth-child(2){
        position:sticky; inset-inline-start:var(--pin1,150px); z-index:2;
        background:var(--panel); box-shadow:3px 0 6px -3px rgba(0,0,0,.10);
      }
      #sysBldTable_wrap .table-wrap thead th, #supportBldTable_wrap .table-wrap thead th{
        position:sticky; top:0; z-index:4; background:var(--tablehead,#F4F1E8);
      }
      #sysBldTable_wrap .table-wrap thead th:nth-child(1),
      #supportBldTable_wrap .table-wrap thead th:nth-child(1){ z-index:6; }
      #sysBldTable_wrap .table-wrap thead th:nth-child(2),
      #supportBldTable_wrap .table-wrap thead th:nth-child(2){ z-index:5; }
    </style>`;
  }

  function pinBar(){
    const on = pinned();
    let full = false;
    try{ full = localStorage.getItem('sysBldTable_colsTouched') === '1'; }catch(e){}
    return `<div class="flexrow mtop" style="gap:8px;flex-wrap:wrap">
      <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
        <button class="btn sm ${full?'ghost':'primary'}" style="border-radius:0"
          onclick="showEssentialBldCols('sysBldTable')">📋 عرض مبسّط</button>
        <button class="btn sm ${full?'primary':'ghost'}" style="border-radius:0"
          onclick="showAllBldCols('sysBldTable')">📊 كل الأعمدة</button>
      </span>
      <button class="btn sm ${on?'primary':'ghost'}" onclick="togglePinnedCols()">
        ${on ? '📌 العمودين مثبّتين' : '📍 تثبيت اسم العمارة والكود'}</button>
      <span class="small" style="color:var(--muted)">
        ${on ? 'اسم العمارة والكود بيفضلوا ظاهرين وإنت بتتحرك يمين وشمال'
             : 'الأعمدة كلها بتتحرك مع بعض'}</span>
    </div>`;
  }

  /* بنقيس عرض أول عمود عشان نظبط مكان التاني */
  function measurePins(){
    if (!pinned()) return;
    setTimeout(() => {
      ['sysBldTable','supportBldTable'].forEach(id => {
        const wrap = document.getElementById(id + '_wrap');
        if (!wrap) return;
        const th = wrap.querySelector('.table-wrap thead th:nth-child(1)');
        if (th) wrap.style.setProperty('--pin1', th.offsetWidth + 'px');
      });
    }, 60);
  }

  /* ---------- ٢) مؤشرات كل عمارة ---------- */

  function metrics(b){
    const d = (window.loadBuildingData && loadBuildingData(b.id)) || null;
    if (!d) return { loaded:false };
    const aps = d.apartments || [];
    const users = d.users || [];
    const open = aps.filter(a => !a.closed);
    const withPhone = aps.filter(a => a.phone).length;
    const withFee = open.filter(a => Number(a.monthlyFee) > 0).length;
    const invited = users.filter(u => u.apartmentId && u.inviteStatus === 'pending').length;
    const joined = users.filter(u => u.apartmentId && u.inviteStatus !== 'pending').length;
    const moves = (d.ledger || []).length + (d.expenses || []).length;

    const dates = (d.ledger || []).map(x => x.date).filter(Boolean).sort();
    const first = dates[0], last = dates[dates.length - 1];
    let months = 1;
    if (first && last){
      const a = new Date(first), z = new Date(last);
      months = Math.max(1, (z.getFullYear()-a.getFullYear())*12 + (z.getMonth()-a.getMonth()) + 1);
    }
    const lastAct = [last, ...(d.activityLog||[]).map(x => (x.date||'').slice(0,10))]
      .filter(Boolean).sort().pop() || '';
    const daysIdle = lastAct
      ? Math.round((Date.now() - new Date(lastAct).getTime()) / 86400000) : null;

    // نسبة اكتمال الإعداد — نفس منطق معالج البداية
    const setup = [
      !!(d.building && d.building.name && d.building.city),
      aps.length > 0,
      aps.length > 0 && withFee === open.length,
      (d.ledger || []).some(l => l.type === 'شهري'),
      (invited + joined) > 0,
    ].filter(Boolean).length;

    return { loaded:true, aps:aps.length, open:open.length, withPhone, withFee,
             invited, joined, moves, perMonth: Math.round(moves / months),
             lastAct, daysIdle, setup, users: users.length };
  }

  const EXTRA_COLS = [
    { key:'setupPct', label:'اكتمال الإعداد',
      value: m => m.loaded ? m.setup*20 : -1,
      cell: m => !m.loaded ? '<span class="small">—</span>' :
        `<span class="badge ${m.setup>=5?'g':m.setup>=3?'y':'r'}">${m.setup*20}%</span>` },

    { key:'withPhone', label:'وحدات بأرقام',
      value: m => m.loaded ? m.withPhone : -1,
      cell: m => !m.loaded ? '—' :
        `${m.withPhone} <span class="small" style="color:var(--muted)">من ${m.aps}</span>` },

    { key:'invited', label:'دعوات مستنية',
      value: m => m.loaded ? m.invited : -1,
      cell: m => !m.loaded ? '—' : (m.invited ? `<span class="badge y">${m.invited}</span>` : '0') },

    { key:'joined', label:'وحدات عندها حساب',
      value: m => m.loaded ? m.joined : -1,
      cell: m => !m.loaded ? '—' :
        `<span class="badge ${m.joined?'g':'n'}">${m.joined}</span>` },

    { key:'adoption', label:'نسبة انضمام السكان',
      value: m => m.loaded && m.aps ? Math.round(m.joined/m.aps*100) : -1,
      cell: m => (!m.loaded || !m.aps) ? '—' :
        `<span class="badge ${m.joined/m.aps>=.5?'g':m.joined?'y':'r'}">${Math.round(m.joined/m.aps*100)}%</span>` },

    { key:'moves', label:'الحركات المالية',
      value: m => m.loaded ? m.moves : -1,
      cell: m => m.loaded ? String(m.moves) : '—' },

    { key:'perMonth', label:'متوسط الحركات شهريًا',
      value: m => m.loaded ? m.perMonth : -1,
      cell: m => !m.loaded ? '—' :
        `<span class="badge ${m.perMonth>=20?'g':m.perMonth>=5?'y':'n'}">${m.perMonth}</span>` },

    { key:'lastAct', label:'آخر نشاط',
      value: m => m.lastAct || '',
      cell: m => !m.lastAct ? '<span class="small" style="color:var(--muted)">مفيش</span>' :
        `${esc2(m.lastAct)} <span class="badge ${m.daysIdle<=7?'g':m.daysIdle<=30?'y':'r'}">${m.daysIdle} يوم</span>` },

    { key:'health', label:'حالة الاستخدام',
      value: m => {
        if (!m.loaded) return 0;
        if (m.daysIdle !== null && m.daysIdle > 30) return 1;   // متوقفة
        if (m.setup < 3) return 2;                              // متعثّرة
        if (m.joined === 0) return 3;                           // بدون سكان
        if (m.perMonth >= 10) return 5;                         // نشطة
        return 4;
      },
      cell: m => {
        const v = !m.loaded ? 0 : (m.daysIdle !== null && m.daysIdle > 30) ? 1
                : m.setup < 3 ? 2 : m.joined === 0 ? 3 : m.perMonth >= 10 ? 5 : 4;
        return ['<span class="small">—</span>',
                '<span class="badge r">🔴 متوقفة</span>',
                '<span class="badge y">🟡 إعداد ناقص</span>',
                '<span class="badge y">🟠 بدون سكان</span>',
                '<span class="badge g">🟢 شغّالة</span>',
                '<span class="badge g">💚 نشطة جدًا</span>'][v];
      } },
  ];


  /* ---------- ٣) عمود الإجراءات: "فتح" + قائمة ⋮ ---------- */

  /* القائمة بتتنقل لطبقة فوق الصفحة كلها.
     لو فضلت جوه الجدول، الحاوية اللي بتتمرّر بتقصّها فمتبانش. */
  function closeRowMenus(){
    const layer = document.getElementById('rowMenuLayer');
    if (layer) layer.remove();
  }
  window.closeRowMenus = closeRowMenus;

  window.toggleRowMenu = function(id, ev){
    const src = document.getElementById(id);
    const already = document.getElementById('rowMenuLayer');
    closeRowMenus();
    if (already && already.dataset.src === id) return;      // نفس الزرار = قفل
    if (!src) return;

    const btn = (ev && ev.currentTarget) || document.activeElement ||
                src.parentElement.querySelector('button[title="خيارات أكتر"]');
    const r = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : { bottom:80, right:200, left:120 };

    const layer = document.createElement('div');
    layer.id = 'rowMenuLayer';
    layer.dataset.src = id;
    layer.style.cssText =
      'position:fixed;z-index:99000;min-width:210px;background:var(--panel);' +
      'border:1px solid var(--line);border-radius:12px;padding:6px;' +
      'box-shadow:0 14px 34px rgba(0,0,0,.20);direction:rtl;text-align:start';
    layer.innerHTML = src.innerHTML;

    document.body.appendChild(layer);
    // بنحطها تحت الزرار، ولو مفيش مكان تحت بنطلّعها فوقه
    const h = layer.offsetHeight || 180, w = layer.offsetWidth || 210;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    let left = r.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    layer.style.top = top + 'px';
    layer.style.left = left + 'px';
  };

  document.addEventListener('click', e => {
    if (e.target.closest && (e.target.closest('#rowMenuLayer') || e.target.closest('.row-menu-wrap'))) return;
    closeRowMenus();
  });
  window.addEventListener('scroll', closeRowMenus, true);
  window.addEventListener('resize', closeRowMenus);

  /* بناخد أزرار العمود الأصلي ونعيد ترتيبها */
  function compactActions(html, rowId){
    const btns = String(html).match(/<button[\s\S]*?<\/button>/g) || [];
    if (btns.length <= 1) return html;

    const label = b => b.replace(/<[^>]*>/g,'').trim();
    const openIdx = btns.findIndex(b => /فتح/.test(label(b)));
    const primary = openIdx >= 0 ? btns[openIdx] : btns[0];
    const rest = btns.filter((_,i) => i !== (openIdx >= 0 ? openIdx : 0));
    if (!rest.length) return html;

    const mid = 'rm_' + String(rowId).replace(/[^\w]/g,'') + '_' + Math.random().toString(36).slice(2,6);
    const items = rest.map(b => {
      const onclick = (b.match(/onclick="([^"]*)"/) || [])[1] || '';
      const isRed = /class="[^"]*\bred\b/.test(b);
      let txt = label(b);
      const title = (b.match(/title="([^"]*)"/) || [])[1];
      if (txt.length <= 2 && title) txt = title;      // زرار بأيقونة بس
      if (/^🔑/.test(txt) && txt.length <= 3) txt = '🔑 إعادة تعيين كلمة السر';
      return `<button class="btn ghost" style="display:block;width:100%;text-align:start;border:0;
                padding:8px 10px;margin:0;${isRed?'color:var(--red)':''}"
                onclick="closeRowMenus();${onclick.replace(/"/g,'&quot;')}">${txt}</button>`;
    }).join('');

    return `<div class="flexrow row-menu-wrap" style="gap:4px;position:relative;justify-content:flex-start">
      ${primary}
      <button class="btn sm ghost" style="padding:4px 9px;font-size:16px;line-height:1"
        title="خيارات أكتر" onclick="toggleRowMenu('${mid}', event)">⋮</button>
      <div id="${mid}" class="row-menu" style="display:none;position:absolute;z-index:70;
           top:calc(100% + 5px);inset-inline-end:0;min-width:190px;background:var(--panel);
           border:1px solid var(--line);border-radius:11px;box-shadow:0 10px 28px rgba(0,0,0,.16);
           padding:5px;text-align:start">${items}</div>
    </div>`;
  }


  /* ============================================================
     ٤) عرض مبسّط: أعمدة أساسية + بطاقة تفاصيل كاملة
     ============================================================ */

  /* الأعمدة اللي تظهر افتراضيًا — الباقي في البطاقة */
  const ESSENTIALS = ['name','code','apCount','status','health','setupPct','joined','lastAct','x'];

  function applyDefaultVisibility(tableId, cols){
    const visKey = tableId + '_vis';
    try{
      if (localStorage.getItem(tableId + '_colsTouched') === '1') return;   // المستخدم عدّل بنفسه
    }catch(e){}
    if (window.__bldVisDone) return;
    window.__bldVisDone = true;
    window[visKey] = cols.map(c => c.key).filter(k => ESSENTIALS.includes(k));
  }

  /* لو المستخدم فتح مخصّص الأعمدة، نحترم اختياره بعد كده */
  const origCust = window.openColumnCustomizer;
  if (origCust && !origCust.__bld){
    const w2 = function(){
      try{ localStorage.setItem('sysBldTable_colsTouched','1'); }catch(e){}
      return origCust.apply(this, arguments);
    };
    w2.__bld = true;
    window.openColumnCustomizer = w2;
  }

  window.showAllBldCols = function(tableId){
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    if (!cfg) return;
    window[tableId + '_vis'] = cfg.columns.map(c => c.key);
    try{ localStorage.setItem(tableId + '_colsTouched','1'); }catch(e){}
    if (window.renderSysContent) renderSysContent(); else renderContent();
  };
  window.showEssentialBldCols = function(tableId){
    const cfg = window.__tableConfigs && window.__tableConfigs[tableId];
    if (!cfg) return;
    window[tableId + '_vis'] = cfg.columns.map(c => c.key).filter(k => ESSENTIALS.includes(k));
    try{ localStorage.removeItem(tableId + '_colsTouched'); }catch(e){}
    if (window.renderSysContent) renderSysContent(); else renderContent();
  };

  /* ---------- بطاقة العمارة ---------- */

  const F = (label, val) => val === '' || val === null || val === undefined
    ? '' : `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed var(--line)">
        <span class="small" style="color:var(--muted);min-width:130px">${esc2(label)}</span>
        <span class="small" style="flex:1"><b>${val}</b></span></div>`;


  /* فتح نافذة تانية بعد ما البطاقة تتقفل — من غير التأخير ده
     النافذة الجديدة بتتقفل مع القديمة فمتبانش. */
  window.bldCardGo = function(fnName, arg){
    closeModal();
    setTimeout(() => {
      const f = window[fnName];
      if (typeof f === 'function') f(arg);
      else showMessage('الإجراء ده مش متاح دلوقتي');
    }, 120);
  };

  /* بيانات تواصل رئيس الاتحاد — تعديل سريع */
  window.openBuildingContact = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    openModal(`
      <h3>📞 بيانات التواصل — ${esc2(b.name||'')}</h3>
      <p class="small mtop">بتستخدمها في تذكير التجديد والتواصل مع رئيس الاتحاد.</p>
      <div class="field2 mtop"><label>اسم رئيس الاتحاد</label>
        <input id="bcName" value="${esc2(b.adminName||'')}"></div>
      <div class="grid g2">
        <div class="field2"><label>مفتاح الدولة</label>
          <input id="bcCC" value="${esc2(b.contactPhoneCountry||'+20')}" dir="ltr"></div>
        <div class="field2"><label>الموبايل / واتساب</label>
          <input id="bcPhone" value="${esc2(b.contactPhone||'')}" dir="ltr"></div>
      </div>
      <div class="field2"><label>البريد الإلكتروني</label>
        <input id="bcEmail" value="${esc2(b.adminEmail||'')}" dir="ltr"></div>
      <div class="field2"><label>صفحة فيسبوك (اختياري)</label>
        <input id="bcFb" value="${esc2(b.facebookUrl||'')}" dir="ltr" placeholder="https://facebook.com/..."></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveBuildingContact('${bid}')">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveBuildingContact = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const g = i => (document.getElementById(i)||{}).value || '';
    b.adminName = g('bcName').trim();
    b.contactPhoneCountry = g('bcCC').trim() || '+20';
    b.contactPhone = g('bcPhone').replace(/[^\d]/g,'');
    b.adminEmail = g('bcEmail').trim();
    b.facebookUrl = g('bcFb').trim();
    saveRegistry();
    closeModal();
    if (window.toast) toast('اتحفظت بيانات التواصل');
    if (window.renderSysContent) renderSysContent();
  };


  /* ---------- تعطيل / تفعيل العمارة بسبب وتاريخ ---------- */

  window.openSuspendModal = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const lic = window.ensureLicense ? ensureLicense(b) : (b.license || {});
    const isOff = lic.status === 'suspended';
    const sus = lic.suspension || {};

    if (isOff){
      openModal(`
        <h3>▶️ إعادة تفعيل ${esc2(b.name||'')}</h3>
        <div class="card mtop" style="border:1px solid var(--red)">
          <b>العمارة موقوفة حاليًا</b>
          <p class="small mtop">السبب: ${esc2(sus.reason || 'مش مسجّل')}</p>
          <p class="small">تاريخ الإيقاف: ${esc2((sus.at||'').slice(0,10) || '—')}</p>
          ${sus.until ? `<p class="small">مفترض ينتهي: ${esc2(sus.until)}</p>` : ''}
          ${sus.by ? `<p class="small" style="color:var(--muted)">أوقفها: ${esc2(sus.by)}</p>` : ''}
        </div>
        <p class="small mtop">رئيس الاتحاد والسكان مش بيقدروا يستخدموا العمارة وهي موقوفة.</p>
        <div class="modal-actions">
          <button class="btn primary" onclick="applySuspend('${bid}',false)">▶️ فعّلها تاني</button>
          <button class="btn ghost" onclick="closeModal()">إلغاء</button>
        </div>`, true);
      return;
    }

    const reasons = ['عدم سداد الاشتراك','مخالفة شروط الاستخدام','بطلب من رئيس الاتحاد',
                     'بيانات غير صحيحة','إيقاف مؤقت للمراجعة','سبب آخر'];
    openModal(`
      <h3>⏸️ تعطيل ${esc2(b.name||'')}</h3>
      <p class="small mtop">لما تعطّلها، رئيس الاتحاد والسكان هيشوفوا رسالة إن الاشتراك موقوف
      ومش هيقدروا يستخدموا البرنامج. <b>البيانات كلها بتفضل محفوظة.</b></p>

      <div class="field2 mtop2"><label>سبب التعطيل</label>
        <select id="spReason" onchange="document.getElementById('spOtherWrap').style.display=this.value==='سبب آخر'?'block':'none'">
          ${reasons.map(r => `<option>${r}</option>`).join('')}
        </select></div>
      <div class="field2" id="spOtherWrap" style="display:none"><label>اكتب السبب</label>
        <input id="spOther" placeholder="السبب بالتفصيل"></div>

      <div class="grid g2">
        <div class="field2"><label>تاريخ التعطيل</label>
          <input id="spAt" type="date" value="${window.todayISO?todayISO():''}"></div>
        <div class="field2"><label>مفترض ينتهي (اختياري)</label>
          <input id="spUntil" type="date"></div>
      </div>

      <div class="field2"><label>ملاحظة داخلية (اختياري)</label>
        <input id="spNote" placeholder="مش بتظهر للعميل"></div>

      <div class="modal-actions">
        <button class="btn red" onclick="applySuspend('${bid}',true)">⏸️ عطّل العمارة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.applySuspend = function(bid, off){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const lic = window.ensureLicense ? ensureLicense(b) : (b.license = b.license || {});
    const g = i => (document.getElementById(i) || {}).value || '';

    if (off){
      let reason = g('spReason');
      if (reason === 'سبب آخر') reason = g('spOther').trim() || 'سبب آخر';
      lic.status = 'suspended';
      lic.suspension = {
        reason,
        at: g('spAt') || (window.todayISO ? todayISO() : ''),
        until: g('spUntil') || '',
        note: g('spNote').trim(),
        by: (window.REG && REG.sysOwner && REG.sysOwner.name) || 'صاحب البرنامج',
      };
    }else{
      lic.status = (lic.endDate && lic.endDate < (window.todayISO?todayISO():'')) ? 'expired'
                 : (lic.plan && /trial|promo/.test(String(lic.plan)) ? 'trial' : 'active');
      lic.suspension = Object.assign({}, lic.suspension || {}, {
        liftedAt: window.todayISO ? todayISO() : '',
      });
    }

    try{
      if (window.logLicenseEvent)
        logLicenseEvent(bid, off ? ('إيقاف الاشتراك — ' + lic.suspension.reason) : 'إعادة تفعيل الاشتراك');
    }catch(e){}
    saveRegistry();
    closeModal();
    if (window.toast) toast(off ? '⏸️ اتعطّلت العمارة' : '▶️ اترجّعت العمارة للخدمة');
    if (window.renderSysContent) renderSysContent();
  };

  window.openBuildingCard = function(bid){
    const b = ((window.REG && REG.buildings) || []).find(x => x.id === bid);
    if (!b) return;
    const m = metrics(b);
    const lic = window.ensureLicense ? ensureLicense(b) : (b.license || {});
    const st  = window.licenseState ? licenseState(lic) : { label: lic.status || '' };

    const health = !m.loaded ? '—'
      : (m.daysIdle !== null && m.daysIdle > 30) ? '<span class="badge r">🔴 متوقفة</span>'
      : m.setup < 3 ? '<span class="badge y">🟡 إعداد ناقص</span>'
      : m.joined === 0 ? '<span class="badge y">🟠 بدون سكان</span>'
      : m.perMonth >= 10 ? '<span class="badge g">💚 نشطة جدًا</span>'
      : '<span class="badge g">🟢 شغّالة</span>';

    openModal(`
      <h3>🏢 ${esc2(b.name || '')} <span class="small" style="color:var(--muted)">${esc2(b.code || '')}</span></h3>

      <div class="flexrow mtop" style="flex-wrap:wrap;gap:7px">
        ${health}
        <span class="badge ${st.badge || 'n'}">${esc2(st.label || '')}</span>
        ${m.loaded ? `<span class="badge n">اكتمال الإعداد ${m.setup*20}%</span>` : ''}
      </div>

      ${lic.status==='suspended' ? `
        <div class="card mtop" style="border:1px solid var(--red);background:#FFF6F5">
          <b style="color:var(--red)">⏸️ العمارة موقوفة</b>
          <p class="small mtop">السبب: <b>${esc2((lic.suspension||{}).reason || 'مش مسجّل')}</b>
            ${(lic.suspension||{}).at ? ` · من ${esc2(lic.suspension.at)}` : ''}
            ${(lic.suspension||{}).until ? ` · لحد ${esc2(lic.suspension.until)}` : ''}</p>
          ${(lic.suspension||{}).note ? `<p class="small" style="color:var(--muted)">${esc2(lic.suspension.note)}</p>` : ''}
        </div>` : ''}

      <div class="grid g2 mtop2">
        <div class="card">
          <b>📊 مؤشرات الاستخدام</b>
          <div class="mtop">
            ${F('إجمالي الوحدات', m.loaded ? m.aps : (b.apartmentsCount || '—'))}
            ${F('وحدات مفتوحة', m.loaded ? m.open : '')}
            ${F('وحدات بأرقام موبايل', m.loaded ? `${m.withPhone} من ${m.aps}` : '')}
            ${F('اشتراكات محدّدة', m.loaded ? `${m.withFee} من ${m.open}` : '')}
            ${F('دعوات مستنية', m.loaded ? m.invited : '')}
            ${F('وحدات عندها حساب', m.loaded ? m.joined : '')}
            ${F('نسبة انضمام السكان', m.loaded && m.aps ? Math.round(m.joined/m.aps*100)+'%' : '')}
            ${F('الحركات المالية', m.loaded ? m.moves : '')}
            ${F('متوسط الحركات شهريًا', m.loaded ? m.perMonth : '')}
            ${F('آخر نشاط', m.lastAct ? `${m.lastAct} <span class="small">(${m.daysIdle} يوم)</span>` : 'مفيش')}
          </div>
        </div>

        <div class="card">
          <b>🪪 الاشتراك</b>
          <div class="mtop">
            ${F('الخطة', window.planName ? planName(lic.plan) : (lic.plan || '—'))}
            ${F('تاريخ البدء', lic.startDate || '—')}
            ${F('تاريخ الانتهاء', lic.endDate || 'بلا نهاية')}
            ${F('المتبقّي', st.daysLeft !== null && st.daysLeft !== undefined ? st.daysLeft + ' يوم' : '')}
            ${F('حد الوحدات', lic.maxApartments || 'غير محدود')}
          </div>
          <b class="mtop2" style="display:block">👤 رئيس الاتحاد</b>
          <div class="mtop">
            ${F('الاسم', esc2(b.adminName || '—'))}
            ${F('الموبايل', `<span dir="ltr">${esc2((b.contactPhoneCountry||'')+' '+(b.contactPhone||''))}</span>`)}
            ${F('البريد', `<span dir="ltr">${esc2(b.adminEmail || '—')}</span>`)}
            ${b.facebookUrl ? F('فيسبوك', `<a href="${esc2(b.facebookUrl)}" target="_blank" rel="noopener">📘 الصفحة ↗</a>`) : ''}
          </div>
          <b class="mtop2" style="display:block">📍 الموقع</b>
          <div class="mtop">
            ${F('المدينة', esc2(b.city || '—'))}
            ${F('المحافظة', esc2(b.governorate || '—'))}
            ${F('العنوان', esc2(b.address || '—'))}
            ${F('تاريخ الإنشاء', (b.createdAt || '').slice(0,10))}
          </div>
        </div>
      </div>

      <div class="flexrow mtop2" style="flex-wrap:wrap;gap:8px">
        <button class="btn primary" onclick="bldCardGo('impersonateBuilding','${b.id}')">🏢 افتح العمارة</button>
        <button class="btn gold" onclick="bldCardGo('openLicenseManage','${b.id}')">🪪 الاشتراك</button>
        ${b.contactPhone || b.adminPhoneRaw
          ? `<a class="btn ghost" target="_blank" onclick="closeModal()"
               href="${window.renewalWhatsAppLink ? renewalWhatsAppLink(b) : '#'}">💬 تذكير تجديد</a>` : ''}
        <button class="btn ghost" onclick="bldCardGo('renameBuildingPrompt','${b.id}')">✏️ تعديل الاسم</button>
        <button class="btn ghost" onclick="bldCardGo('openBuildingContact','${b.id}')">📞 بيانات التواصل</button>
        <button class="btn ${lic.status==='suspended'?'primary':'red'}"
          onclick="bldCardGo('openSuspendModal','${b.id}')">
          ${lic.status==='suspended' ? '▶️ إعادة تفعيل' : '⏸️ تعطيل العمارة'}</button>
      </div>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  /* بنحقن الأعمدة في نداء sortableTable لجدول العمارات */
  const origSortable = window.sortableTable;
  if (origSortable) window.sortableTable = function(id, rows, cols, groupBy, opts){
    if ((id === 'sysBldTable' || id === 'supportBldTable') && Array.isArray(rows) && Array.isArray(cols)){
      const cache = new Map();
      const M = b => { if (!cache.has(b.id)) cache.set(b.id, metrics(b)); return cache.get(b.id); };
      const extra = EXTRA_COLS.map(c => ({
        key: c.key, label: c.label,
        value: b => c.value(M(b)),
        cell:  b => c.cell(M(b)),
      }));
      let last = cols[cols.length-1] && !cols[cols.length-1].value ? cols.pop() : null;
      cols = cols.concat(extra);
      if (last){
        const origCell = last.cell;
        cols.push(Object.assign({}, last, {
          key: last.key || 'x',
          label: last.label || 'إجراءات',
          cell: b => `<div class="flexrow" style="gap:5px;justify-content:flex-start">
              <button class="btn sm primary" onclick="openBuildingCard('${b.id}')">تفاصيل</button>
              ${compactActions(origCell ? origCell(b) : '', b.id || b.code || 'x')}
            </div>`,
        }));
      }
      if (id === 'sysBldTable') applyDefaultVisibility(id, cols);
      measurePins();
    }
    return origSortable.call(this, id, rows, cols, groupBy, opts);
  };

  /* شريط التثبيت في الشاشتين */
  ['pageSysDashboard','pageSupportBuildingsView'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(){
      const html = orig.apply(this, arguments);
      measurePins();
      return tableRoomCss() + pinStyle() + pinBar() + html;
    };
  });

  console.log('[عمارتنا] أعمدة العمارات الثابتة والمؤشرات جاهزة');
})();
