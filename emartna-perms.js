/* ============================================================
   عمارتنا — صلاحيات تفصيلية لكل شاشة
   ------------------------------------------------------------
   الصلاحيات القديمة كانت على مستوى المجموعة (الماليات كلها ✅
   أو ❌). والواقع مختلف: محاسب ينفع يشوف المصروفات ويطبعها،
   بس ما يمسحش. ونائب ينفع يعدّل التحصيل بس ما يقربش للخزينة.

   دلوقتي كل شاشة ليها ٥ صلاحيات مستقلة:
     👁️ عرض · 🖨️ طباعة · ➕ إضافة · ✏️ تعديل · 🗑️ حذف
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* الصلاحيات الأساسية بتظهر لكل الشاشات. والمتقدمة (اعتماد/مرفقات)
     بتظهر للشاشات اللي محتاجاها بس — عشان الجدول يفضل قابل للقراءة
     بدل ١١ خانة × ٢٩ شاشة لكل مستخدم. */
  const ACTIONS = [
    { key:'view',    icon:'👁️', label:'عرض' },
    { key:'print',   icon:'🖨️', label:'طباعة' },
    { key:'export',  icon:'📤', label:'تصدير' },
    { key:'add',     icon:'➕', label:'إضافة' },
    { key:'edit',    icon:'✏️', label:'تعديل' },
    { key:'delete',  icon:'🗑️', label:'حذف' },
    { key:'approve',    icon:'✅', label:'اعتماد',       adv:true },
    { key:'unapprove',  icon:'↩️', label:'إلغاء اعتماد', adv:true },
    { key:'att_view',   icon:'📎', label:'عرض مرفقات',   adv:true },
    { key:'att_add',    icon:'📥', label:'إضافة مرفقات', adv:true },
    { key:'att_delete', icon:'🗑', label:'حذف مرفقات',   adv:true },
  ];
  window.PERM_ACTIONS = ACTIONS;

  /* الشاشات اللي فيها دورة اعتماد */
  const APPROVE_SCREENS = ['paymentRequests','expenses','collections','maintenance',
                           'vendors','meetings','polls','suggestions','projects'];
  /* الشاشات اللي بتتعامل مع مرفقات */
  const ATTACH_SCREENS  = ['expenses','collections','maintenance','vendors','projects',
                           'meetings','announcements','documents','building','apartments'];

  function actionsFor(screenKey){
    return ACTIONS.filter(a =>
      !a.adv ? true
      : (a.key === 'approve' || a.key === 'unapprove') ? APPROVE_SCREENS.includes(screenKey)
      : ATTACH_SCREENS.includes(screenKey));
  }
  window.permActionsFor = actionsFor;

  /* كل شاشات رئيس الاتحاد مقسّمة بمجموعاتها */
  /* صاحب الشقة والمستأجر ليهم شاشاتهم الخاصة — فالجدول التفصيلي
     لازم يتبنى من مجموعة الشاشات الصح حسب الدور. */
  function isResidentRole(r){ return r === 'owner' || r === 'tenant'; }
  window.permIsResidentRole = isResidentRole;

  function screens(role){
    try{
      const src = isResidentRole(role)
        ? (window.OWNER_NAV_GROUPS || [])
        : (window.ADMIN_NAV_GROUPS || []);
      return src.map(g => ({
        key: g.key, icon: g.icon, label: g.label,
        items: (g.items || []).map(it => ({ key: it[0], icon: it[1], label: it[2] })),
      }));
    }catch(e){ return []; }
  }
  window.permScreens = screens;

  /* الافتراضي لكل دور — الأساس اللي المستخدم بيعدّل عليه */
  const ROLE_DEFAULTS = {
    admin:      () => 'all',
    deputy:     g => g === 'settings' ? 'view' : 'all',
    accountant: g => g === 'finance' || g === 'reports' ? 'all' : 'none',
    treasurer:  g => g === 'finance' || g === 'reports' ? 'all' : 'none',
    board:      () => 'view',            // اطّلاع وطباعة على كل حاجة
    manager:    g => g === 'finance' ? 'none' : 'all',
  };

  /* بتتبني من ACTIONS مباشرة، فأي صلاحية جديدة تتضاف تتغطّى تلقائيًا */
  const modeMap = {
    all:  () => true,
    none: () => false,
    view: a => a === 'view' || a === 'print' || a === 'export' || a === 'att_view',
  };
  function buildSet(mode){
    const out = {};
    ACTIONS.forEach(a => { out[a.key] = modeMap[mode](a.key); });
    return out;
  }

  function defaultsFor(role, groupKey){
    const f = ROLE_DEFAULTS[role];
    const mode = f ? f(groupKey) : 'all';
    return buildSet(modeMap[mode] ? mode : 'all');
  }
  window.permDefaultsFor = defaultsFor;

  /* صلاحيات مستخدم على شاشة معيّنة */
  window.userCan = function(user, screenKey, action){
    const u = user || (window.currentUser && currentUser());
    if (!u) return false;

    // رئيس الاتحاد الأساسي: كل حاجة
    if (u.role === 'admin' && !u.permissions && !u.screenPerms) return true;

    const sp = u.screenPerms || {};
    if (sp[screenKey] && sp[screenKey][action] !== undefined) return !!sp[screenKey][action];

    // مفيش تحديد تفصيلي → نرجع لصلاحية المجموعة القديمة
    const grp = window.pageGroupKey ? pageGroupKey(screenKey, u.role !== 'admin') : null;
    if (u.permissions && grp && u.permissions[grp] === false) return false;
    if (u.permissions && grp && u.permissions[grp] === true)
      return action === 'view' || action === 'print' ? true : true;

    const d = defaultsFor(u.role, grp);
    return !!d[action];
  };

  /* رسالة موحّدة لما الصلاحية ناقصة */
  window.noPermMessage = function(action){
    const a = ACTIONS.find(x => x.key === action);
    return `مالكش صلاحية ${a ? a.label : 'العملية دي'} في الشاشة دي.\n\n` +
      `لو محتاجها، كلّم رئيس اتحاد عمارتك عشان يفتحهالك.`;
  };

  window.requirePerm = function(screenKey, action){
    if (userCan(null, screenKey, action)) return true;
    if (window.showMessage) showMessage(noPermMessage(action));
    return false;
  };

  /* ---------- شاشة تحديد الصلاحيات ---------- */

  window.openScreenPerms = function(userId){
    if (!isUnionHead()){
      if (window.showMessage) showMessage(
        'ليس لديك صلاحية للوصول إلى هذه الصفحة.\n\n' +
        'إدارة الصلاحيات متاحة لرئيس اتحاد الملاك فقط.');
      return;
    }
    const u = (D.users || []).find(x => x.id === userId);
    if (!u) return;
    window.__spUser = u;
    const gs = screens(u.role);
    const sp = u.screenPerms || {};

    const row = (s, grpKey) => {
      const cur = sp[s.key] || defaultsFor(u.role, grpKey);
      const ok  = actionsFor(s.key).map(a => a.key);
      return `
      <tr data-screen="${esc2(s.key)}">
        <td style="padding:6px 4px;font-size:13px">${s.icon} ${esc2(s.label)}</td>
        ${ACTIONS.map(a => !ok.includes(a.key)
          ? `<td style="text-align:center;color:var(--muted);opacity:.35"
                 title="مش متاحة في الشاشة دي">—</td>`
          : `<td style="text-align:center">
          <input type="checkbox" class="sp-chk" data-s="${esc2(s.key)}" data-a="${a.key}"
            ${cur[a.key] ? 'checked' : ''}></td>`).join('')}
      </tr>`;
    };

    openModal(`
      <h3>🔐 صلاحيات ${esc2(u.name || u.username)}</h3>
      <p class="small mtop">حدد بالظبط إيه اللي يقدر يعمله في كل شاشة.
      سيبها زي ما هي لو الافتراضي مناسب.</p>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ghost" onclick="spPreset('all')">افتح الكل</button>
        <button class="btn sm ghost" onclick="spPreset('view')">عرض وطباعة بس</button>
        <button class="btn sm ghost" onclick="spPreset('none')">اقفل الكل</button>
        <button class="btn sm ghost" onclick="spPreset('reset')">رجّع الافتراضي</button>
      </div>

      <div class="table-wrap mtop2" style="max-height:52vh;overflow:auto">
        <table style="width:100%;font-size:12.5px">
          <thead><tr>
            <th style="text-align:start;min-width:150px">الشاشة</th>
            ${ACTIONS.map(a => `<th style="min-width:52px" title="${a.label}">${a.icon}<br>
              <span style="font-weight:400;font-size:11px">${a.label}</span></th>`).join('')}
          </tr></thead>
          <tbody>
            ${gs.map(g => `
              <tr style="background:var(--tint,#F3F8F7)">
                <td colspan="${ACTIONS.length + 1}" style="padding:6px 4px">
                  <b>${g.icon} ${esc2(g.label)}</b>
                  <button class="btn sm ghost" style="float:inline-end;padding:2px 8px"
                    onclick="spGroup('${esc2(g.key)}',this)">تبديل المجموعة</button></td>
              </tr>
              ${g.items.map(s => row(s, g.key)).join('')}`).join('')}
          </tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveScreenPerms('${esc2(userId)}')">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  /* جدول تفصيلي لمستخدم لسه ماتعملش — بيتعبّى من افتراضي الدور،
     ورئيس الاتحاد يعدّل عليه قبل ما يبعت الدعوة. */
  window.permInviteGrid = function(role){
    const gs = screens(role);
    const row = (s, grpKey) => {
      const cur = defaultsFor(role, grpKey);
      const ok  = actionsFor(s.key).map(a => a.key);
      return `<tr>
        <td style="padding:5px 4px;font-size:12.5px">${s.icon} ${esc2(s.label)}</td>
        ${ACTIONS.map(a => !ok.includes(a.key)
          ? `<td style="text-align:center;opacity:.3">—</td>`
          : `<td style="text-align:center"><input type="checkbox" class="inv-chk"
               data-s="${esc2(s.key)}" data-a="${a.key}" ${cur[a.key] ? 'checked' : ''}></td>`
        ).join('')}
      </tr>`;
    };
    return `
      <div class="table-wrap" style="max-height:44vh;overflow:auto">
        <table style="width:100%;font-size:12px">
          <thead><tr>
            <th style="text-align:start;min-width:140px">الشاشة</th>
            ${ACTIONS.map(a => `<th style="min-width:46px" title="${a.label}">${a.icon}<br>
              <span style="font-weight:400;font-size:10.5px">${a.label}</span></th>`).join('')}
          </tr></thead>
          <tbody>
            ${gs.map(g => `
              <tr style="background:var(--tint,#F3F8F7)">
                <td colspan="${ACTIONS.length + 1}" style="padding:5px 4px">
                  <b>${g.icon} ${esc2(g.label)}</b></td>
              </tr>
              ${g.items.map(x => row(x, g.key)).join('')}`).join('')}
          </tbody>
        </table>
      </div>`;
  };

  window.spPreset = function(kind){
    const u = window.__spUser;
    document.querySelectorAll('.sp-chk').forEach(el => {
      const a = el.dataset.a;
      if (kind === 'all')       el.checked = true;
      else if (kind === 'none') el.checked = false;
      else if (kind === 'view') el.checked = modeMap.view(a);
      else if (kind === 'reset'){
        const grp = window.pageGroupKey ? pageGroupKey(el.dataset.s, false) : null;
        el.checked = !!defaultsFor(u ? u.role : 'admin', grp)[a];
      }
    });
  };

  /* تبديل كل شاشات مجموعة مرة واحدة */
  window.spGroup = function(groupKey, btn){
    const u0 = window.__spUser;
    const g = screens(u0 ? u0.role : 'admin').find(x => x.key === groupKey);
    if (!g) return;
    const keys = g.items.map(i => i.key);
    const boxes = [...document.querySelectorAll('.sp-chk')]
      .filter(el => keys.includes(el.dataset.s));
    const allOn = boxes.every(b => b.checked);
    boxes.forEach(b => { b.checked = !allOn; });
    if (btn) btn.textContent = allOn ? 'افتح المجموعة' : 'اقفل المجموعة';
  };

  window.saveScreenPerms = function(userId){
    const u = (D.users || []).find(x => x.id === userId);
    if (!u) return;
    const out = {};
    document.querySelectorAll('.sp-chk').forEach(el => {
      const s = el.dataset.s, a = el.dataset.a;
      out[s] = out[s] || {};
      out[s][a] = el.checked;
    });
    u.screenPerms = out;
    save();
    closeModal();
    if (window.toast) toast('اتحفظت الصلاحيات');
    renderContent();
  };

  /* ---------- مين عنده صلاحية إيه ---------- */

  window.openWhoCan = function(screenKey){
    const gs = screens();
    let sName = screenKey;
    gs.forEach(g => g.items.forEach(s => { if (s.key === screenKey) sName = s.icon + ' ' + s.label; }));

    const staff = (D.users || []).filter(u =>
      u.active !== false && u.role !== 'owner' && u.role !== 'tenant');

    openModal(`
      <h3>👥 مين عنده صلاحية — ${esc2(sName)}</h3>
      <div class="table-wrap mtop2">
        <table style="width:100%;font-size:13px">
          <thead><tr>
            <th style="text-align:start">المستخدم</th>
            ${ACTIONS.map(a => `<th style="min-width:44px">${a.icon}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${staff.map(u => `
              <tr>
                <td style="padding:6px 4px">
                  <b>${esc2(u.name || u.username)}</b>
                  <div class="small" style="color:var(--muted)">${roleName(u)}</div>
                </td>
                ${ACTIONS.map(a => `<td style="text-align:center">${
                  userCan(u, screenKey, a.key) ? '✅' : '—'}</td>`).join('')}
              </tr>`).join('') || `<tr><td colspan="6" class="small">مفيش مستخدمين إداريين</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  function roleName(u){
    if (u.role !== 'admin') return (window.CLOUD_ROLES || {})[u.role]?.label || u.role;
    const p = u.permissions || {};
    if (!u.permissions) return '⭐ رئيس اتحاد';
    if (p.settings === false && p.finance && p.building) return '🤝 نائب رئيس الاتحاد';
    if (p.finance && !p.building) return '💰 محاسب';
    if (!p.finance && p.building) return '📋 إداري';
    return '⭐ إدارة';
  }
  window.userRoleName = roleName;


  /* ---------- الحقن في شاشة المستخدمين ---------- */

  function deputyCount(){
    return (D.users || []).filter(u => u.role === 'deputy' && u.active !== false).length;
  }
  window.deputyCount = deputyCount;

  /* رئيس الاتحاد الأساسي فقط — مش أي دور إداري.
     نائب أو محاسب ما يشوفش صلاحيات حد، ولا صلاحياته هو. */
  function isUnionHead(){
    const me = (window.currentUser ? currentUser() : null);
    return !!(me && me.role === 'admin' && !me.permissions && !me.screenPerms);
  }
  window.isUnionHead = isUnionHead;

  function card(){
    if (!isUnionHead()) return '';
    const staff = (D.users || []).filter(u =>
      u.active !== false && !isResidentRole(u.role));
    const residents = (D.users || []).filter(u =>
      u.active !== false && isResidentRole(u.role));
    const deps = deputyCount();
    return `
      <div class="card">
        <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <b>🔐 الصلاحيات التفصيلية</b>
            <div class="small" style="color:var(--muted);margin-top:3px">
              عرض · طباعة · إضافة · تعديل · حذف — لكل شاشة على حدة</div>
          </div>
          <div class="flexrow" style="gap:6px;flex-wrap:wrap">
            <span class="badge ${deps?'g':'n'}">🤝 ${deps} نائب</span>
            <span class="badge n">👥 ${staff.length} إداري</span>
          </div>
        </div>
        <div class="mtop">
          ${staff.map(u => `
            <div class="flexrow" style="padding:6px 0;border-bottom:1px dashed var(--line);
                 justify-content:space-between;gap:8px;flex-wrap:wrap">
              <div>
                <b class="small">${esc2(u.name || u.username)}</b>
                <span class="small" style="color:var(--muted)"> · ${userRoleName(u)}</span>
                ${u.screenPerms ? '<span class="badge b" style="margin-inline-start:6px">مخصّصة</span>' : ''}
              </div>
              <button class="btn sm ghost" onclick="openScreenPerms('${esc2(u.id)}')">
                🔐 صلاحياته</button>
            </div>`).join('') || '<p class="small">مفيش مستخدمين إداريين</p>'}
        </div>
        ${residents.length ? `
        <details class="mtop">
          <summary style="cursor:pointer"><b>🏠 الملاك والمستأجرين (${residents.length})</b>
            <span class="small" style="color:var(--muted)"> — صلاحيات تفصيلية على شاشاتهم</span></summary>
          <div class="mtop">
            ${residents.map(u => `
              <div class="flexrow" style="padding:6px 0;border-bottom:1px dashed var(--line);
                   justify-content:space-between;gap:8px;flex-wrap:wrap">
                <div><b class="small">${esc2(u.name || u.username)}</b>
                  <span class="small" style="color:var(--muted)"> · ${userRoleName(u)}</span>
                  ${u.screenPerms ? '<span class="badge b" style="margin-inline-start:6px">مخصّصة</span>' : ''}
                </div>
                <button class="btn sm ghost" onclick="openScreenPerms('${esc2(u.id)}')">
                  🔐 صلاحياته</button>
              </div>`).join('')}
          </div>
        </details>` : ''}
      </div>`;
  }

  function hook(){
    if (window.__permCardHooked) return;
    const orig = window.pageUsers;
    if (typeof orig !== 'function') return;
    window.__permCardHooked = true;
    const wrapped = function(){ return card() + orig.apply(this, arguments); };
    window.pageUsers = wrapped;
  }
  hook();
  [900, 2500, 5000].forEach(ms => setTimeout(hook, ms));

  console.log('[عمارتنا] الصلاحيات التفصيلية جاهزة');
})();
