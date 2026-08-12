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
            <button class="btn sm ghost" onclick="revokeInvite('${r.u.__inviteId}')">إلغاء</button></div>`;
        if (s === 'none' && r.ap)
          return `<button class="btn sm" onclick="createInvite('${r.ap.id}')">📨 ولّد دعوة</button>`;
        if (r.u)
          return `<div class="flexrow">
            <button class="btn sm" onclick="openUserModal('${r.u.id}')">تعديل</button>
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
