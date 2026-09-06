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

  const ACTIONS = [
    { key:'view',   icon:'👁️', label:'عرض' },
    { key:'print',  icon:'🖨️', label:'طباعة' },
    { key:'add',    icon:'➕', label:'إضافة' },
    { key:'edit',   icon:'✏️', label:'تعديل' },
    { key:'delete', icon:'🗑️', label:'حذف' },
  ];
  window.PERM_ACTIONS = ACTIONS;

  /* كل شاشات رئيس الاتحاد مقسّمة بمجموعاتها */
  function screens(){
    try{
      return (window.ADMIN_NAV_GROUPS || []).map(g => ({
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
    manager:    g => g === 'finance' ? 'none' : 'all',
  };

  const FULL = { view:true, print:true, add:true, edit:true, delete:true };
  const VIEW = { view:true, print:true, add:false, edit:false, delete:false };
  const NONE = { view:false, print:false, add:false, edit:false, delete:false };

  function defaultsFor(role, groupKey){
    const f = ROLE_DEFAULTS[role];
    const mode = f ? f(groupKey) : 'all';
    return mode === 'all' ? { ...FULL } : mode === 'view' ? { ...VIEW } : { ...NONE };
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
    const u = (D.users || []).find(x => x.id === userId);
    if (!u) return;
    const gs = screens();
    const sp = u.screenPerms || {};

    const row = (s, grpKey) => {
      const cur = sp[s.key] || defaultsFor(u.role, grpKey);
      return `
      <tr data-screen="${esc2(s.key)}">
        <td style="padding:6px 4px;font-size:13px">${s.icon} ${esc2(s.label)}</td>
        ${ACTIONS.map(a => `<td style="text-align:center">
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

  window.spPreset = function(kind){
    const u = window.__spUser;
    document.querySelectorAll('.sp-chk').forEach(el => {
      const a = el.dataset.a;
      if (kind === 'all')       el.checked = true;
      else if (kind === 'none') el.checked = false;
      else if (kind === 'view') el.checked = (a === 'view' || a === 'print');
      else if (kind === 'reset'){
        const grp = window.pageGroupKey ? pageGroupKey(el.dataset.s, false) : null;
        el.checked = !!defaultsFor(u ? u.role : 'admin', grp)[a];
      }
    });
  };

  /* تبديل كل شاشات مجموعة مرة واحدة */
  window.spGroup = function(groupKey, btn){
    const g = screens().find(x => x.key === groupKey);
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
    return (D.users || []).filter(u => u.role === 'admin' && u.permissions &&
      u.permissions.settings === false && u.permissions.finance && u.permissions.building &&
      u.active !== false).length;
  }
  window.deputyCount = deputyCount;

  function card(){
    const staff = (D.users || []).filter(u =>
      u.active !== false && u.role !== 'owner' && u.role !== 'tenant');
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
