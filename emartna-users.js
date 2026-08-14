/* ============================================================
   عمارتنا | Emartna — طبقة المستخدمين والدعوات  (الجولة ٢)
   ------------------------------------------------------------
   الشاشة زي ما هي بالظبط — بس بدل "كلمة المرور":
     • عمود "الحالة" بيقول: عنده حساب / دعوة مستنية / مفيش حساب
     • زرار "ولّد دعوة" + رسالة واتساب جاهزة
     • رئيس الاتحاد مابيشوفش ولا بيحدد باسوردات حد

   وكمان: ربط حساب الساكن بشقته، وطلبات الدفع.
   ============================================================ */

const app2 = new Proxy({}, {
  get: (_, k) => (...args) => {
    const fn = window[k];
    if (typeof fn === 'function') return fn(...args);
    console.warn('[عمارتنا/مستخدمين] ' + String(k) + ' مش متاحة');
    return undefined;
  }
});
const esc            = v => app2.esc(v);
const toast          = m => app2.toast(m);
const showMessage    = m => app2.showMessage(m);
const openModal      = h => app2.openModal(h);
const closeModal     = () => app2.closeModal();
const confirmDelete  = (m, cb) => app2.confirmDelete(m, cb);
const renderContent  = () => app2.renderContent();
const unitLabel      = a => app2.unitLabel(a);
const phoneFull      = (c, p) => app2.phoneFull(c, p);
const sortableTable  = (...a) => app2.sortableTable(...a);
const currentUser    = () => app2.currentUser();
const logActivity    = (a, d) => app2.logActivity(a, d);
const save           = () => app2.save();

function waitFor(cond){
  return new Promise(res => {
    if (cond()) return res();
    const t = setInterval(() => { if (cond()){ clearInterval(t); res(); } }, 60);
  });
}

await waitFor(() => window.CLOUD && window.D !== undefined);


/* ============================================================
   1) شاشة المستخدمين
   ============================================================ */

const STATUS_BADGE = {
  joined:  '<span class="badge g">✅ عنده حساب</span>',
  pending: '<span class="badge y">⏳ دعوة مستنية</span>',
  none:    '<span class="badge n">— مفيش حساب</span>',
};

window.pageUsers = function(){
  const D = window.D;
  if (!D) return '<p class="small">جاري التحميل…</p>';

  // كل وحدة + المستخدم بتاعها (لو موجود)
  const byAp = new Map();
  (D.users || []).forEach(u => { if (u.apartmentId) byAp.set(u.apartmentId, u); });

  const rows = [];
  (D.users || []).filter(u => !u.apartmentId).forEach(u => rows.push({ u, ap:null }));
  (D.apartments || []).filter(a => !a.closed).forEach(ap =>
    rows.push({ u: byAp.get(ap.id) || null, ap }));

  const st = r => !r.u ? 'none' : (r.u.inviteStatus || 'joined');

  const cols = [
    { key:'unit', label:'الوحدة',
      value:r => r.ap ? r.ap.number : 0,
      cell: r => r.ap ? unitLabel(r.ap) : '<span class="badge b">إدارة</span>' },

    { key:'name', label:'الاسم',
      value:r => (r.u && r.u.name) || (r.ap && r.ap.ownerName) || '',
      cell: r => esc((r.u && r.u.name) || (r.ap && r.ap.ownerName) || '-') },

    { key:'role', label:'الصلاحية',
      value:r => r.u ? r.u.role : 'zz',
      cell: r => {
        const role = r.u ? r.u.role : (r.ap ? 'owner' : '');
        return role==='admin'  ? '<span class="badge b">رئيس اتحاد - كل الصلاحيات</span>'
             : role==='tenant' ? '<span class="badge y">مستأجر</span>'
             : role==='owner'  ? '<span class="badge n">مالك شقة</span>' : '-';
      }},

    { key:'phone', label:'الهاتف',
      value:r => phoneFull(
        (r.u && r.u.phoneCountry) || (r.ap && r.ap.phoneCountry) || '+20',
        (r.u && r.u.phone) || (r.ap && r.ap.phone) || ''),
      cell: r => {
        const c = (r.u && r.u.phoneCountry) || (r.ap && r.ap.phoneCountry) || '+20';
        const p = (r.u && r.u.phone) || (r.ap && r.ap.phone) || '';
        return `<span class="small">${esc(phoneFull(c,p) || '-')}</span>`;
      }},

    { key:'status', label:'حالة الحساب',
      value:r => ({joined:0, pending:1, none:2})[st(r)],
      cell: r => STATUS_BADGE[st(r)] },

    { key:'code', label:'كود الدعوة',
      value:r => (r.u && r.u.inviteCode) || '',
      cell: r => (r.u && r.u.inviteCode)
        ? `<code style="letter-spacing:2px">${esc(r.u.inviteCode)}</code>` : '—' },

    { key:'x', label:'', value:null, cell: r => {
        const s = st(r);
        if (s === 'pending')
          return `<div class="flexrow">
            <button class="btn sm primary" onclick="sendInviteWhatsApp('${r.ap ? r.ap.id : ''}')">📱 واتساب</button>
            <button class="btn sm ghost" onclick="resendInvite('${r.ap ? r.ap.id : ''}')" title="يلغي الكود القديم ويولّد كود جديد">🔄 كود جديد</button>
            <button class="btn sm ghost" onclick="revokeInvite('${r.u.__inviteId}')">إلغاء</button></div>`;
        if (s === 'none' && r.ap)
          return `<button class="btn sm" onclick="createInvite('${r.ap.id}')">📨 ولّد دعوة</button>`;
        if (r.u)
          return `<div class="flexrow">
            <button class="btn sm" onclick="openUserModal('${r.u.id}')">تعديل</button>
            ${r.ap ? `<button class="btn sm gold" onclick="resendInvite('${r.ap.id}')" title="ابعت دعوة جديدة لصاحب الوحدة">📨 دعوة جديدة</button>` : ''}
            ${!r.u.apartmentId && r.u.role!=='admin'
              ? `<button class="btn sm red" onclick="deleteUser('${r.u.id}')">حذف</button>` : ''}
          </div>`;
        return '-';
      }}
  ];

  const pend  = rows.filter(r => st(r)==='pending').length;
  const none  = rows.filter(r => st(r)==='none' && r.ap).length;
  const joined= rows.filter(r => st(r)==='joined').length;

  return `
  <p class="small">
    كل وحدة بتاخد <b>كود دعوة</b> يوصل لصاحبها على واتساب، وهو بيعمل حسابه بنفسه
    ويختار كلمة السر اللي تريحه. إنت مش بتشوف ولا بتحدد كلمة سر حد — ده أأمن ليك وليه.
  </p>

  <div class="grid g3 mtop">
    <div class="card"><h3 style="color:var(--accent)">${joined}</h3><p class="small">عندهم حسابات</p></div>
    <div class="card"><h3 style="color:var(--gold)">${pend}</h3><p class="small">دعوات مستنية</p></div>
    <div class="card"><h3 style="color:var(--muted)">${none}</h3><p class="small">مفيش حساب</p></div>
  </div>

  <div class="flexrow mtop2">
    ${none ? `<button class="btn primary" onclick="inviteAllUnits()">
        📨 ولّد دعوات لكل الوحدات (${none})</button>` : ''}
    <button class="btn ghost" onclick="openUserModal()">+ مستخدم إداري (محاسب/لجنة)</button>
    <div class="spacer"></div>
    <button class="btn sm ghost" onclick="refreshUsers()">🔄 تحديث</button>
  </div>

  ${none ? `<p class="small mtop" style="color:var(--muted)">
    💡 الوحدات اللي مالهاش رقم موبايل مسجّل مش هيتولّدلها دعوة — ضيف الرقم من شاشة "الشقق والملاك" الأول.
  </p>` : ''}

  <div class="mtop">${sortableTable('usersTable', rows, cols, null,
      { defaultKey:'unit', exportName:'المستخدمون' })}</div>`;
};


/* ============================================================
   2) الدعوات
   ============================================================ */

window.refreshUsers = async function(){
  try{
    await window.CLOUD.bootstrap();
    window.D = window.loadBuildingData(window.activeBuildingId);
    renderContent();
    toast('تم التحديث');
  }catch(e){ showMessage(e.message); }
};

window.createInvite = async function(apId){
  const D = window.D;
  const ap = D.apartments.find(a => a.id === apId);
  if (!ap) return;
  if (!ap.phone && !ap.email)
    return showMessage(`الوحدة ${ap.number} مالهاش رقم موبايل. ضيف الرقم من شاشة "الشقق والملاك" الأول.`);

  try{
    await window.CLOUD.invites.create(window.activeBuildingId, {
      apartmentId: apId,
      phone: ap.phone || null,
      phoneCountry: ap.phoneCountry || '+20',
      email: ap.email || null,
      role: 'owner',
    });
    logActivity('دعوة', `ولّد دعوة للوحدة ${ap.number}`);
    await window.refreshUsers();
    window.sendInviteWhatsApp(apId);
  }catch(e){ showMessage(e.message); }
};

/* ولّد دعوة جديدة لأي وحدة — سواء عندها حساب، أو دعوة مستنية، أو لسه مفيش.
   بيلغي أي دعوة قديمة الأول عشان مايفضلش أكتر من كود شغّال لنفس الوحدة. */
window.resendInvite = async function(apId){
  const D = window.D;
  const ap = (D.apartments || []).find(a => a.id === apId);
  if (!ap) return;
  if (!ap.phone && !ap.email)
    return showMessage(`الوحدة ${ap.number} مالهاش رقم موبايل. ضيف الرقم من شاشة "الشقق والملاك" الأول.`);

  const u = (D.users || []).find(x => x.apartmentId === apId);
  const hasAccount = u && (u.inviteStatus || 'joined') === 'joined';
  const pendingId  = u && u.inviteStatus === 'pending' ? u.__inviteId : null;

  const go = async () => {
    try{
      if (pendingId) await window.CLOUD.invites.revoke(pendingId);
      await window.CLOUD.invites.create(window.activeBuildingId, {
        apartmentId: apId,
        phone: ap.phone || null,
        phoneCountry: ap.phoneCountry || '+20',
        email: ap.email || null,
        role: 'owner',
      });
      logActivity('دعوة', `ولّد دعوة جديدة للوحدة ${ap.number}`);
      await window.refreshUsers();
      window.sendInviteWhatsApp(apId);
    }catch(e){ showMessage(e.message); }
  };

  if (hasAccount){
    return confirmAction(
      `الوحدة ${ap.number} عندها حساب بالفعل (${esc(u.username || u.name || '')}).\n\n` +
      `الدعوة الجديدة هتخلّي صاحبها يعمل حساب جديد بنفسه بدل ما يستنى منك اسم دخول وكلمة سر. ` +
      `الحساب القديم هيفضل شغّال — تقدر تشيله بعدين لو مش محتاجه. متابعة؟`,
      go);
  }
  if (pendingId){
    return confirmAction(
      `في كود دعوة شغّال للوحدة ${ap.number}. الكود القديم هيتلغي وهيتولّد كود جديد. متابعة؟`,
      go);
  }
  return go();
};

/* تأكيد بسيط — بيستخدم نافذة البرنامج لو موجودة */
function confirmAction(msg, onYes){
  if (typeof window.openModal === 'function'){
    window.__confirmAct = onYes;
    return window.openModal(`
      <h3>تأكيد</h3>
      <p class="small mtop" style="white-space:pre-line">${esc(msg)}</p>
      <div class="modal-actions">
        <button class="btn primary" onclick="(function(){const f=window.__confirmAct;closeModal();f&&f()})()">متابعة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  }
  if (confirm(msg)) onYes();
}

window.inviteAllUnits = async function(){
  const D = window.D;
  const taken = new Set((D.users||[]).map(u => u.apartmentId).filter(Boolean));
  const targets = (D.apartments||[]).filter(a => !a.closed && !taken.has(a.id));
  const noPhone = targets.filter(a => !a.phone && !a.email);

  confirmDelete(
    `هيتولّد كود دعوة لـ ${targets.length - noPhone.length} وحدة.` +
    (noPhone.length ? ` (${noPhone.length} وحدة مالهاش رقم موبايل هتتخطّى)` : '') +
    ` بعدها تبعت الأكواد للسكان على واتساب.`,
    async () => {
      try{
        const { made, skipped } = await window.CLOUD.invites.createForAll(window.activeBuildingId);
        logActivity('دعوات', `ولّد ${made.length} دعوة`);
        await window.refreshUsers();
        toast(`اتولّدت ${made.length} دعوة` + (skipped.length ? ` · اتخطّت ${skipped.length}` : ''));
      }catch(e){ showMessage(e.message); }
    });
};

window.revokeInvite = function(inviteId){
  confirmDelete('إلغاء الدعوة دي؟ الكود مش هيشتغل تاني، وتقدر تولّد واحد جديد بعدين.',
    async () => {
      try{
        await window.CLOUD.invites.revoke(inviteId);
        await window.refreshUsers();
        toast('اتلغت الدعوة');
      }catch(e){ showMessage(e.message); }
    });
};

window.sendInviteWhatsApp = function(apId){
  const D = window.D;
  const ap = D.apartments.find(a => a.id === apId);
  const u  = (D.users||[]).find(x => x.apartmentId === apId);
  if (!u || !u.inviteCode) return showMessage('مفيش دعوة للوحدة دي');

  const label = ap ? unitLabel(ap) : '';
  const base  = location.origin + location.pathname.replace(/[^/]*$/, '');
  const text  = window.CLOUD.invites.message(D.building.name, label, u.inviteCode, base);
  const link  = window.CLOUD.invites.link(u.inviteCode, base);
  const wa    = (ap.phoneCountry || '+20').replace('+','') +
                String(ap.phone || '').replace(/^0+/, '');

  openModal(`
    <h3>📨 دعوة ${esc(label)}</h3>
    <div class="card mtop" style="background:var(--tint-success);text-align:center">
      <p class="small">كود الدعوة</p>
      <h2 style="letter-spacing:6px;font-family:monospace">${esc(u.inviteCode)}</h2>
    </div>
    <div class="field2 mtop"><label>الرسالة</label>
      <textarea id="invMsg" rows="9" style="font-size:13px">${esc(text)}</textarea></div>
    <p class="small" style="color:var(--muted)">
      الرابط: <span style="word-break:break-all">${esc(link)}</span>
    </p>
    <div class="modal-actions">
      ${ap.phone ? `<button class="btn primary" onclick="waSendInvite('${wa}')">📱 ابعت واتساب</button>` : ''}
      <button class="btn" onclick="copyInviteMsg()">📋 نسخ</button>
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`);
};

window.waSendInvite = function(phone){
  const msg = document.getElementById('invMsg').value;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.copyInviteMsg = async function(){
  try{
    await navigator.clipboard.writeText(document.getElementById('invMsg').value);
    toast('اتنسخت الرسالة');
  }catch(e){ showMessage('مش قادر ينسخ — حدّد النص وانسخه يدويًا'); }
};


/* ============================================================
   3) تعديل مستخدم — من غير كلمة سر
   ============================================================ */

const ROLE_LABELS = {
  admin:  '⭐ رئيس اتحاد (كل الصلاحيات)',
  owner:  '🏠 مالك شقة/محل',
  tenant: '🔑 مستأجر',
};

window.openUserModal = function(id){
  const D = window.D;
  const u = id ? (D.users||[]).find(x => x.id === id) : null;
  const me = currentUser();

  if (!u){
    return openModal(`
      <h3>مستخدم إداري إضافي</h3>
      <p class="small mtop">
        عشان تضيف محاسب أو عضو لجنة، اعمله دعوة بنفس الطريقة:
        اكتب رقم موبايله وهو يسجّل بنفسه، وبعدها تقدر ترقّيه من الجدول.
      </p>
      <div class="field2 mtop"><label>الاسم</label>
        <input id="nuName" placeholder="محمد أحمد"></div>
      <div class="field2"><label>رقم الموبايل</label>
        <input id="nuPhone" placeholder="01012345678"></div>
      <div class="field2"><label>الصلاحية</label>
        <select id="nuRole">
          <option value="admin">${ROLE_LABELS.admin}</option>
          <option value="owner">${ROLE_LABELS.owner}</option>
        </select></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="createAdminInvite()">📨 ولّد الدعوة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  }

  const isSelf = me && u.id === me.id;
  const ap = u.apartmentId ? D.apartments.find(a => a.id === u.apartmentId) : null;

  openModal(`
    <h3>تعديل مستخدم</h3>
    <div class="card mtop" style="background:var(--tint)">
      <p class="small"><b>${esc(u.name || '-')}</b>
        ${ap ? ` · ${esc(unitLabel(ap))}` : ''}
        · ${esc(phoneFull(u.phoneCountry, u.phone) || '-')}</p>
      <p class="small" style="color:var(--muted)">
        ${u.inviteStatus === 'pending' ? '⏳ لسه مسجّلش' : '✅ عنده حساب'}
      </p>
    </div>

    <div class="field2 mtop"><label>الصلاحية</label>
      <select id="uRole" ${isSelf ? 'disabled' : ''}>
        ${Object.entries(ROLE_LABELS).map(([k,v]) =>
          `<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}
      </select>
      ${isSelf ? '<p class="small" style="color:var(--muted)">مش هتقدر تغيّر صلاحيتك بنفسك</p>' : ''}
    </div>

    <div class="field2"><label class="checkline">
      <input type="checkbox" id="uActive" ${u.active!==false?'checked':''}
             ${isSelf?'disabled':''}> الحساب نشط</label>
      <p class="small" style="color:var(--muted)">لو وقّفته، مش هيقدر يدخل لحد ما تفعّله تاني</p>
    </div>

    <div class="card mtop" style="background:var(--tint-warn)">
      <p class="small">🔐 <b>كلمة السر</b> — إنت مش بتشوفها ولا بتحددها.
      لو الساكن نسيها، يقدر يستردها بنفسه من شاشة الدخول لو مسجّل إيميل،
      أو تلغي حسابه وتولّدله دعوة جديدة.</p>
    </div>

    <div class="modal-actions">
      <button class="btn primary" onclick="saveUser('${u.id}')">حفظ</button>
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
};

window.saveUser = async function(id){
  const D = window.D;
  const u = (D.users||[]).find(x => x.id === id);
  if (!u) return closeModal();

  const roleEl = document.getElementById('uRole');
  const actEl  = document.getElementById('uActive');
  const role   = roleEl && !roleEl.disabled ? roleEl.value : u.role;
  const active = actEl && !actEl.disabled ? actEl.checked : u.active;

  if (u.role === 'admin' && role !== 'admin'){
    const admins = (D.users||[]).filter(x => x.role==='admin' && x.active!==false);
    if (admins.length <= 1)
      return showMessage('مينفعش تشيل آخر رئيس اتحاد نشط');
  }

  try{
    if (u.__membershipId){
      const r = await window.CLOUD._sb.from('memberships')
        .update({ role, active }).eq('id', u.__membershipId);
      if (r.error) throw r.error;
    } else if (u.__inviteId){
      const r = await window.CLOUD._sb.from('invitations')
        .update({ role }).eq('id', u.__inviteId);
      if (r.error) throw r.error;
    }
    if (u.role !== role) logActivity('تغيير صلاحية', `${u.name}: ${u.role} → ${role}`);
    closeModal();
    await window.refreshUsers();
    toast('تم الحفظ');
  }catch(e){ showMessage(e.message); }
};

window.createAdminInvite = async function(){
  const name  = (document.getElementById('nuName').value || '').trim();
  const phone = (document.getElementById('nuPhone').value || '').trim();
  const role  = document.getElementById('nuRole').value;
  if (!name)  return showMessage('اكتب الاسم');
  if (!phone) return showMessage('اكتب رقم الموبايل');

  try{
    const inv = await window.CLOUD.invites.create(window.activeBuildingId,
      { phone, phoneCountry:'+20', role });
    closeModal();
    await window.refreshUsers();
    openModal(`
      <h3>📨 دعوة ${esc(name)}</h3>
      <div class="card mtop" style="background:var(--tint-success);text-align:center">
        <p class="small">الكود</p>
        <h2 style="letter-spacing:6px;font-family:monospace">${esc(inv.invite_code)}</h2>
      </div>
      <p class="small mtop">ابعتله الكود ورابط الانضمام، وهو يسجّل بنفسه.</p>
      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`);
  }catch(e){ showMessage(e.message); }
};

window.deleteUser = function(id){
  const D = window.D;
  const u = (D.users||[]).find(x => x.id === id);
  if (!u) return;
  if (u.role === 'admin'){
    const admins = (D.users||[]).filter(x => x.role==='admin' && x.active!==false);
    if (admins.length <= 1) return showMessage('مينفعش تحذف آخر رئيس اتحاد');
  }
  confirmDelete(`حذف حساب "${u.name || u.username}"؟ مش هيقدر يدخل تاني.`, async () => {
    try{
      if (u.__membershipId)
        await window.CLOUD._sb.from('memberships').delete().eq('id', u.__membershipId);
      else if (u.__inviteId)
        await window.CLOUD.invites.revoke(u.__inviteId);
      logActivity('حذف مستخدم', u.name || u.username);
      await window.refreshUsers();
      toast('اتحذف الحساب');
    }catch(e){ showMessage(e.message); }
  });
};


/* ============================================================
   4) شاشة الساكن — ربط الحساب بالشقة
   ============================================================ */

window.myApartment = function(){
  const D = window.D, u = currentUser();
  if (!D || !u) return null;
  if (u.apartmentId) return D.apartments.find(a => a.id === u.apartmentId) || null;
  return null;
};

/* دوال الاسترجاع القديمة مش شغالة في السحابة */
window.findUserMatches = () => [];
window.resetUserPassword = () =>
  showMessage('كلمات السر بقت في السحابة — الساكن بيستردها بنفسه من شاشة الدخول.');
window.sysResetUserPassword = window.resetUserPassword;


/* ============================================================
   5) مطابقة شكل العمارة مع الوحدات الفعلية
   ------------------------------------------------------------
   بيحسب من الواقع: عدد الوحدات · المحلات · الأدوار · أسماء الأدوار
   ============================================================ */

window.syncBuildingShape = async function(silent){
  const D = window.D;
  if (!D) return;
  const uuid = window.CLOUD._cache.buildingUuid[window.activeBuildingId];
  if (!uuid) return;

  try{
    const { data, error } = await window.CLOUD._sb
      .rpc('sync_building_shape', { p_building: uuid });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    if (!r) return;

    await window.CLOUD.bootstrap();
    window.D = window.loadBuildingData(window.activeBuildingId);
    if (!silent){
      renderContent();
      toast(`تمت المطابقة: ${r.out_units} وحدة · ${r.out_shops} محل · ` +
            `${r.out_floors} دور` +
            (r.out_relabeled ? ` · صُحّح دور ${r.out_relabeled} وحدة` : ''));
    }
    return r;
  }catch(e){
    if (!silent) showMessage(e.message);
  }
};

/* زرار المطابقة في شاشة بيانات العمارة */
const __origPageBuilding = window.pageBuilding;
if (typeof __origPageBuilding === 'function'){
  window.pageBuilding = function(){
    const html = __origPageBuilding.apply(this, arguments);
    const D = window.D;
    if (!D) return html;

    const g = Number(D.building.groundFloorCount) || 4;
    const p = Number(D.building.apartmentsPerFloor) || 4;
    const units = (D.apartments || []).filter(a => !a.closed).length;
    const shops = (D.apartments || []).filter(a => !a.closed &&
                    a.type === 'shop' && Number(a.number) <= g).length;
    const floors = units <= 0 ? 0
                 : units <= g ? 1
                 : 1 + Math.ceil((units - g) / p);

    const declFloors = Number(D.building.floorsCount) || 0;
    const declShops  = Number(D.building.groundShopsCount) || 0;
    const mismatch = (declFloors && declFloors !== floors) || declShops !== shops;

    const banner = mismatch ? `
      <div class="card content-narrow mtop2" style="background:var(--tint-warn)">
        <h3>⚠️ بيانات العمارة مش مطابقة للوحدات</h3>
        <table class="mtop" style="width:100%;font-size:13px">
          <tr><th></th><th>المكتوب</th><th>الواقع</th></tr>
          <tr><td>عدد الأدوار</td>
              <td>${declFloors || '—'}</td><td><b>${floors}</b></td></tr>
          <tr><td>عدد المحلات</td>
              <td>${declShops}</td><td><b>${shops}</b></td></tr>
        </table>
        <p class="small mtop">
          شكل العمارة بيترسم من الوحدات الفعلية، فالأرقام دي بس هي اللي محتاجة تتظبط.
        </p>
        <button class="btn primary mtop" onclick="syncBuildingShape()">
          🔄 طابق الأرقام مع الوحدات
        </button>
      </div>` : '';

    return html + banner;
  };
}


/* ============================================================
   6) نظام الصلاحيات
   ------------------------------------------------------------
   أدوار العمارة:
     admin      ⭐ رئيس اتحاد   — كل الأقسام
     accountant 💰 محاسب        — الماليات بس
     manager    📋 إداري        — كل حاجة ما عدا الماليات
     owner      🏠 صاحب شقة
     tenant     🔑 مستأجر
   + صلاحيات مخصصة لكل شخص على حدة
   ============================================================ */

const PERM_GROUPS = [
  { key:'building', icon:'🏢', label:'العمارة والملاك',
    note:'الشقق · المستخدمين · المقاولين · الصيانة' },
  { key:'finance',  icon:'💰', label:'الماليات',
    note:'التحصيل · المصروفات · الخزينة · المشاريع' },
  { key:'engage',   icon:'💬', label:'التواصل مع الملاك',
    note:'المحادثة · الاستطلاعات · الإعلانات · الاجتماعات' },
  { key:'settings', icon:'⚙️', label:'الإعدادات والأدوات',
    note:'الإعدادات · الرخصة · سجل النشاط · الدعم' },
];

const CLOUD_ROLES = {
  admin:      { label:'⭐ رئيس اتحاد العمارة', hint:'كل الصلاحيات', perms:null },
  accountant: { label:'💰 محاسب العمارة', hint:'الماليات بس',
                perms:{ building:false, finance:true,  engage:false, settings:false } },
  manager:    { label:'📋 إداري العمارة', hint:'كل حاجة ما عدا الماليات',
                perms:{ building:true,  finance:false, engage:true,  settings:true } },
  owner:      { label:'🏠 صاحب الشقة/المحل', hint:'حسابه وشقته', perms:null },
  tenant:     { label:'🔑 مستأجر', hint:'التواصل بس',
                perms:{ building:false, finance:false, engage:true, settings:false } },
};

window.CLOUD_ROLES = CLOUD_ROLES;
window.PERM_GROUPS = PERM_GROUPS;

/* مودال تعديل المستخدم — بالأدوار والصلاحيات */
window.openUserModal = function(id){
  const D = window.D;
  const u = id ? (D.users||[]).find(x => x.id === id) : null;
  const me = currentUser();

  if (!u){
    return openModal(`
      <h3>+ مستخدم إداري إضافي</h3>
      <p class="small mtop">
        اكتب رقم موبايله واختار صلاحياته — هيوصله كود دعوة ويسجّل بنفسه.
      </p>
      <div class="field2 mtop"><label>الاسم</label>
        <input id="nuName" placeholder="محمد أحمد"></div>
      <div class="field2"><label>رقم الموبايل</label>
        <input id="nuPhone" placeholder="01012345678"></div>
      <div class="field2"><label>الصلاحية</label>
        <select id="nuRole" onchange="applyRoleTemplate('nu')">
          ${['admin','accountant','manager'].map(k =>
            `<option value="${k}">${CLOUD_ROLES[k].label} — ${CLOUD_ROLES[k].hint}</option>`
           ).join('')}
        </select></div>
      <div id="nuPerms">${permCheckboxes('nu', CLOUD_ROLES.admin.perms)}</div>
      <div class="modal-actions">
        <button class="btn primary" onclick="createAdminInvite()">📨 ولّد الدعوة</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`);
  }

  const isSelf = me && u.id === me.id;
  const ap = u.apartmentId ? D.apartments.find(a => a.id === u.apartmentId) : null;
  const perms = u.permissions || (CLOUD_ROLES[u.role] || {}).perms;

  openModal(`
    <h3>تعديل صلاحيات</h3>
    <div class="card mtop" style="background:var(--tint)">
      <p class="small"><b>${esc(u.name || '-')}</b>
        ${ap ? ` · ${esc(unitLabel(ap))}` : ''}
        · ${esc(phoneFull(u.phoneCountry, u.phone) || '-')}</p>
      <p class="small" style="color:var(--muted)">
        ${u.inviteStatus === 'pending' ? '⏳ لسه مسجّلش' : '✅ عنده حساب'}</p>
    </div>

    <div class="field2 mtop"><label>الصلاحية</label>
      <select id="uRole" ${isSelf?'disabled':''} onchange="applyRoleTemplate('u')">
        ${Object.entries(CLOUD_ROLES).map(([k,v]) =>
          `<option value="${k}" ${u.role===k?'selected':''}>${v.label} — ${v.hint}</option>`
         ).join('')}
      </select>
      ${isSelf ? '<p class="small" style="color:var(--muted)">مش هتقدر تغيّر صلاحيتك بنفسك</p>' : ''}
    </div>

    <div id="uPerms">${permCheckboxes('u', perms)}</div>

    <div class="field2"><label class="checkline">
      <input type="checkbox" id="uActive" ${u.active!==false?'checked':''}
             ${isSelf?'disabled':''}> الحساب نشط</label></div>

    <div class="card mtop" style="background:var(--tint-warn)">
      <p class="small">🔐 كلمة السر سرّ صاحبها — إنت مش بتشوفها ولا بتحددها.</p>
    </div>

    <div class="modal-actions">
      <button class="btn primary" onclick="saveUser('${u.id}')">حفظ</button>
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
};

function permCheckboxes(prefix, perms){
  const roleSel = document.getElementById(prefix + 'Role');
  const role = roleSel ? roleSel.value : 'admin';
  if (role === 'owner' || role === 'tenant'){
    return `<p class="small" style="color:var(--muted)">
      ${CLOUD_ROLES[role].label} — صلاحياته ثابتة على حسابه وشقته.</p>`;
  }
  return `
    <div class="card mtop" style="background:var(--tint)">
      <p class="small"><b>الأقسام المسموحة</b> — تقدر تظبطها زي ما تحب</p>
      ${PERM_GROUPS.map(g => {
        const on = !perms || perms[g.key] !== false;
        return `<label class="checkline mtop">
          <input type="checkbox" id="${prefix}P_${g.key}" ${on?'checked':''}>
          ${g.icon} ${g.label}
          <span class="small" style="color:var(--muted)"> — ${g.note}</span>
        </label>`;
      }).join('')}
    </div>`;
}

window.applyRoleTemplate = function(prefix){
  const role = document.getElementById(prefix + 'Role').value;
  const box  = document.getElementById(prefix + 'Perms');
  if (box) box.innerHTML = permCheckboxes(prefix, (CLOUD_ROLES[role]||{}).perms);
};

function readPerms(prefix){
  const role = document.getElementById(prefix + 'Role').value;
  if (role === 'admin') return null;              // كل الصلاحيات
  if (role === 'owner' || role === 'tenant')
    return (CLOUD_ROLES[role] || {}).perms || null;
  const out = { home:true };
  PERM_GROUPS.forEach(g => {
    const el = document.getElementById(prefix + 'P_' + g.key);
    out[g.key] = el ? el.checked : false;
  });
  return out;
}

window.saveUser = async function(id){
  const D = window.D;
  const u = (D.users||[]).find(x => x.id === id);
  if (!u) return closeModal();

  const roleEl = document.getElementById('uRole');
  const actEl  = document.getElementById('uActive');
  const role   = roleEl && !roleEl.disabled ? roleEl.value : u.role;
  const active = actEl && !actEl.disabled ? actEl.checked : u.active;
  const perms  = roleEl && !roleEl.disabled ? readPerms('u') : (u.permissions || null);

  if (u.role === 'admin' && role !== 'admin'){
    const admins = (D.users||[]).filter(x => x.role==='admin' && x.active!==false);
    if (admins.length <= 1) return showMessage('مينفعش تشيل آخر رئيس اتحاد نشط');
  }

  try{
    if (u.__membershipId){
      const r = await window.CLOUD._sb.from('memberships')
        .update({ role, active, permissions: perms }).eq('id', u.__membershipId);
      if (r.error) throw r.error;
    } else if (u.__inviteId){
      const r = await window.CLOUD._sb.from('invitations')
        .update({ role, permissions: perms }).eq('id', u.__inviteId);
      if (r.error) throw r.error;
    }
    if (u.role !== role)
      logActivity('تغيير صلاحية', `${u.name}: ${u.role} → ${role}`);
    closeModal();
    await window.refreshUsers();
    toast('تم الحفظ');
  }catch(e){ showMessage(e.message); }
};

window.createAdminInvite = async function(){
  const name  = (document.getElementById('nuName').value || '').trim();
  const phone = (document.getElementById('nuPhone').value || '').trim();
  const role  = document.getElementById('nuRole').value;
  const perms = readPerms('nu');
  if (!name)  return showMessage('اكتب الاسم');
  if (!phone) return showMessage('اكتب رقم الموبايل');

  try{
    const inv = await window.CLOUD.invites.create(window.activeBuildingId,
      { phone, phoneCountry:'+20', role, permissions: perms });
    closeModal();
    await window.refreshUsers();
    openModal(`
      <h3>📨 دعوة ${esc(name)}</h3>
      <div class="card mtop" style="background:var(--tint-success);text-align:center">
        <p class="small">${CLOUD_ROLES[role].label}</p>
        <h2 style="letter-spacing:6px;font-family:monospace">${esc(inv.invite_code)}</h2>
      </div>
      <p class="small mtop">ابعتله الكود ورابط الانضمام، وهو يسجّل بنفسه.</p>
      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">تمام</button>
      </div>`);
  }catch(e){ showMessage(e.message); }
};

/* شارة الدور في الجدول */
window.roleBadge = function(role){
  const r = CLOUD_ROLES[role];
  if (!r) return '-';
  const cls = role==='admin' ? 'b' : role==='accountant' ? 'g'
            : role==='manager' ? 'y' : 'n';
  return `<span class="badge ${cls}">${r.label}</span>`;
};


/* ------------------------------------------------------------
   القائمة الجانبية تحترم الدور والصلاحيات
   البرنامج كان بيفرّق بين admin وأي حد تاني.
   دلوقتي: admin · accountant · manager → قائمة الإدارة
           owner · tenant               → قائمة الساكن
   ------------------------------------------------------------ */

const STAFF_ROLES = ['admin', 'accountant', 'manager'];

window.visibleNavGroups = function(u){
  if (!u) return [];
  const isStaff = STAFF_ROLES.includes(u.role);
  const groups = isStaff ? window.ADMIN_NAV_GROUPS : window.OWNER_NAV_GROUPS;
  if (!groups) return [];

  const isCompound = window.D && window.D.building &&
                     window.D.building.communityType === 'compound';

  return groups
    .filter(g => hasGroupPermission(u, g.key))
    .map(g => ({ ...g, items: g.items.filter(it =>
        it[0] !== 'blocks' || isCompound) }));
};

function hasGroupPermission(u, key){
  if (key === 'home') return true;
  const p = u.permissions || (CLOUD_ROLES[u.role] || {}).perms;
  if (!p) return true;                 // مفيش قيود = كل الصلاحيات
  return p[key] !== false;
}
window.hasGroupPermission = hasGroupPermission;

/* البرنامج بيستخدم isAdmin في 53 موضع — نوسّعها للموظفين */
window.isBuildingStaff = function(u){
  const usr = u || currentUser();
  return !!(usr && STAFF_ROLES.includes(usr.role));
};


/* ============================================================
   7) كود العمارة — عرض وتوليد
   ------------------------------------------------------------
   المشكلة: البرنامج بيقرا الكود من REG.buildings، و saveRegistry
   مكانش بيحفظ العمارات — فتوليد كود جديد كان بيضيع.
   ============================================================ */

window.buildingCode = function(){
  const D = window.D;
  if (D && D.building && D.building.code) return D.building.code;
  const rec = (window.REG?.buildings || [])
    .find(x => x.id === window.activeBuildingId);
  return rec ? rec.code : null;
};

window.regenerateBuildingCode = function(){
  app2.confirmAction(
    'هيتم إلغاء الكود القديم فورًا، ولازم تبلّغ كل الملاك بالكود الجديد. متابعة؟',
    async () => {
      const uuid = window.D?.building?.__uuid ||
                   window.CLOUD._cache.buildingUuid[window.activeBuildingId];
      if (!uuid) return showMessage('العمارة مش محمّلة');
      try{
        const { data, error } = await window.CLOUD._sb
          .rpc('regenerate_building_code', { p_building: uuid });
        if (error) throw error;
        window.D.building.code = data;
        const rec = (window.REG?.buildings || [])
          .find(x => x.id === window.activeBuildingId);
        if (rec) rec.code = data;
        logActivity('تغيير كود العمارة', data);
        renderContent();
        toast('الكود الجديد: ' + data);
      }catch(e){ showMessage(e.message); }
    }, 'متابعة');
};

/* الكود يظهر دايمًا حتى لو REG اتأخر */
const __pbWithCode = window.pageBuilding;
if (typeof __pbWithCode === 'function'){
  window.pageBuilding = function(){
    let html = __pbWithCode.apply(this, arguments);
    const code = window.buildingCode();
    if (code) html = html.replace(
      />-<\/div>\s*<\/div>/,
      `>${esc(code)}</div></div>`
    ).replace("writeText('')", `writeText('${code}')`);
    return html;
  };
}


/* ============================================================
   8) دعوات المنصة — تسويق ومبيعات
   ============================================================ */

window.PLATFORM_INVITES = {

  async send({ name, phone, phoneCountry='+20', email, city, note,
               planKey, trialDays=60, channel='whatsapp' }){
    const sb = window.CLOUD._sb;
    const { data:{ user } } = await sb.auth.getUser();
    const me = window.REG?.sysOwner?.name || 'فريق عمارتنا';

    const { data, error } = await sb.from('platform_invites').insert({
      lead_name: name || '', phone: phone || '', phone_country: phoneCountry,
      email: email || null, city: city || '', note: note || '',
      plan_key: planKey || null, trial_days: Number(trialDays) || 60,
      sent_by: user.id, sent_by_name: me, channel,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async list(){
    const { data, error } = await window.CLOUD._sb
      .from('v_platform_invites').select('*');
    if (error) throw error;
    return data || [];
  },

  async performance(){
    const { data, error } = await window.CLOUD._sb
      .from('v_invite_performance').select('*');
    if (error) throw error;
    return data || [];
  },

  async cancel(id){
    const { error } = await window.CLOUD._sb.from('platform_invites')
      .update({ status:'cancelled' }).eq('id', id);
    if (error) throw error;
  },

  link(code){
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    return base + 'emartna-cloud.html?invite=' + encodeURIComponent(code);
  },

  message(inv){
    return [
      `أهلًا ${inv.lead_name || ''} 👋`.trim(),
      ``,
      `"عمارتنا" برنامج إدارة اتحاد الملاك — تحصيل الاشتراكات، المصروفات،`,
      `الخزينة، والتواصل مع السكان، كله من موبايلك.`,
      ``,
      `🎁 دعوتك: تجربة مجانية ${inv.trial_days} يوم`,
      `كود الدعوة: ${inv.code}`,
      `الرابط: ${window.PLATFORM_INVITES.link(inv.code)}`,
      ``,
      `مش محتاج بطاقة ائتمان — سجّل وابدأ على طول.`,
    ].join('\n');
  },

  whatsapp(inv){
    const p = (inv.phone_country || '+20').replace('+','') +
              String(inv.phone || '').replace(/^0+/, '');
    window.open(`https://wa.me/${p}?text=` +
      encodeURIComponent(window.PLATFORM_INVITES.message(inv)), '_blank');
  },
};

/* التقاط كود الدعوة من الرابط */
(function captureInvite(){
  try{
    const c = new URLSearchParams(location.search).get('invite');
    if (c){
      sessionStorage.setItem('emartna_platform_invite', c.toUpperCase());
      window.CLOUD?._sb?.rpc('mark_invite_opened', { p_code: c.toUpperCase() })
        .catch(()=>{});
    }
  }catch(e){}
})();

window.pendingPlatformInvite = function(){
  try{ return sessionStorage.getItem('emartna_platform_invite'); }
  catch(e){ return null; }
};
