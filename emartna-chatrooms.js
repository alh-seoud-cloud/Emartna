/* ============================================================
   عمارتنا — الشات الخاص داخل العمارة
   ------------------------------------------------------------
   غرف محادثة بعضوية محدّدة: اللي معاه صلاحية "إنشاء محادثة خاصة"
   بيختار مين يدخل كل غرفة.

   الرسائل متخزّنة على السيرفر مش جوه بيانات العمارة — لأن التطبيق
   بيحمّل بيانات العمارة كاملة لكل عضو، فأي رسالة "خاصة" تتحط هناك
   بتوصل للكل فعليًا حتى لو الشاشة مخبّياها.

   كل فحص صلاحية هنا للعرض بس. المنع الحقيقي في القاعدة (سياسات
   وتريجرز)، فحتى لو حد بعت طلب مباشر من غير الواجهة بيترفض.
   ============================================================ */

const ready = (t) => new Promise(r => {
  const i = setInterval(() => { if (t()) { clearInterval(i); r(); } }, 120);
  setTimeout(() => { clearInterval(i); r(); }, 20000);
});
await ready(() => window.CLOUD && window.CLOUD._sb);
const sb = window.CLOUD._sb;
const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
const bUuid = () => {
  try{ return CLOUD._cache.buildingUuid[window.activeBuildingId] || null; }
  catch(e){ return null; }
};
const myId = () => {
  try{ return (CLOUD_AUTH.user && CLOUD_AUTH.user.id) || null; }catch(e){ return null; }
};
const can = (a) => (window.guardActionSilent ? guardActionSilent('chat', a) : false);

const ROLE_AR = {
  admin:'رئيس الاتحاد', deputy:'نائب الرئيس', accountant:'محاسب',
  treasurer:'أمين الصندوق', board:'عضو مجلس', manager:'إداري',
  owner:'مالك وحدة', tenant:'مستأجر',
};
const STATUS_AR = {
  ACTIVE:'نشطة', READ_ONLY:'إرسال متوقف', ARCHIVED:'مؤرشفة', DELETED:'محذوفة',
};

let ROOMS = [], PEOPLE = [], CUR = null, POLL = null, TAB = 'active';
let MY_ROOMS = -1;

window.myRoomCount = () => (MY_ROOMS < 0 ? 0 : MY_ROOMS);

async function countMyRooms(){
  try{
    const uuid = bUuid(); if (!uuid) return;
    const { count, error } = await sb.from('chat_rooms')
      .select('id', { count:'exact', head:true })
      .eq('building_id', uuid).eq('status', 'ACTIVE');
    if (error) return;
    const was = MY_ROOMS;
    MY_ROOMS = count || 0;
    if (was <= 0 && MY_ROOMS > 0 && window.renderContent){
      try{ renderContent(); }catch(e){}
    }
  }catch(e){}
}
setTimeout(countMyRooms, 2500);
document.addEventListener('emartna:building-complete', () => setTimeout(countMyRooms, 800));

/* التحديث الدوري لازم يقف لما النافذة تتقفل — من غير كده بيفضل
   يفتحها تاني كل كام ثانية. */
setInterval(() => {
  if (POLL && !document.getElementById('chatBox')) closeChatPoll();
}, 3000);

/* ---------- قائمة الغرف ---------- */

async function loadRooms(){
  const uuid = bUuid();
  if (!uuid){ ROOMS = []; return; }
  const { data, error } = await sb.from('chat_rooms')
    .select('*, chat_room_members(user_id,member_role,is_active)')
    .eq('building_id', uuid).order('created_at', { ascending:false });
  if (error) throw error;
  ROOMS = data || [];
  MY_ROOMS = ROOMS.filter(r => r.status === 'ACTIVE').length;
}

window.openPrivateChats = async function(){
  try{ await loadRooms(); }
  catch(e){ return showMessage('تعذّر تحميل المحادثات: ' + (e.message||'')); }

  const mine = ROOMS.filter(r =>
    TAB === 'archived' ? r.status === 'ARCHIVED' : r.status !== 'ARCHIVED');

  const tab = (k, label, n) => `<button class="btn sm ${TAB===k?'':'ghost'}"
    onclick="switchRoomTab('${k}')">${label} (${n})</button>`;

  openModal(`
    <h3>🔒 المحادثات الخاصة</h3>
    <p class="small mtop">غرف مقفولة على أعضاء محدّدين — مش بتظهر لباقي السكان.</p>

    <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
      ${tab('active','النشطة', ROOMS.filter(r=>r.status!=='ARCHIVED').length)}
      ${tab('archived','المؤرشفة', ROOMS.filter(r=>r.status==='ARCHIVED').length)}
      ${can('create_room') ? `<button class="btn sm primary" style="margin-inline-start:auto"
        onclick="openNewRoom()">+ محادثة جديدة</button>` : ''}
    </div>

    <div class="mtop2">
      ${!mine.length ? `<p class="small" style="color:var(--muted)">
         ${TAB==='archived' ? 'مفيش محادثات مؤرشفة.' : 'مفيش محادثات خاصة لسه.'}</p>`
      : mine.map(r => {
          const members = (r.chat_room_members||[]).filter(m => m.is_active !== false);
          const isMgr = r.created_by === myId()
            || members.some(m => m.user_id === myId() && m.member_role === 'manager')
            || (window.isUnionHead && isUnionHead());
          return `<div class="card mtop" style="border-inline-start:3px solid ${
            r.status==='ACTIVE' ? 'var(--accent)' : 'var(--gold)'}">
            <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <b>${esc2(r.name)}</b>
                ${r.status!=='ACTIVE' ? `<span class="badge y">${esc2(STATUS_AR[r.status])}</span>` : ''}
                <div class="small" style="color:var(--muted)">
                  ${members.length} عضو${r.topic ? ' · ' + esc2(r.topic) : ''}</div>
              </div>
              <div class="flexrow" style="gap:6px;flex-wrap:wrap">
                <button class="btn sm" onclick="openRoom('${esc2(r.id)}')">فتح</button>
                ${isMgr ? `<button class="btn sm ghost"
                  onclick="openRoomAdmin('${esc2(r.id)}')">⚙️ إدارة</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
    </div>

    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`, true);
};

window.switchRoomTab = function(k){ TAB = k; openPrivateChats(); };

/* ---------- إنشاء محادثة ---------- */

async function loadPeople(){
  const uuid = bUuid();
  const { data, error } = await sb.rpc('building_people', { p_building: uuid });
  if (error) throw error;
  PEOPLE = (data || []).filter(p => p.user_id);
}

window.openNewRoom = async function(){
  if (!can('create_room'))
    return showMessage('مالكش صلاحية إنشاء محادثة خاصة.');
  try{ await loadPeople(); }
  catch(e){ return showMessage('تعذّر تحميل الأعضاء: ' + (e.message||'')); }

  openModal(`
    <h3>➕ محادثة خاصة جديدة</h3>
    <div class="field2 mtop"><label>اسم المحادثة</label>
      <input id="rmName" placeholder="مثال: متابعة صيانة المصعد"></div>
    <div class="field2"><label>وصف (اختياري)</label>
      <input id="rmTopic" placeholder="مناقشة العروض واختيار المقاول"></div>

    <div class="field2 mtop"><label>الأعضاء</label>
      <div class="flexrow" style="gap:6px;flex-wrap:wrap">
        <button type="button" class="btn sm ghost" onclick="pickPeople('staff')">كل الإدارة</button>
        <button type="button" class="btn sm ghost" onclick="pickPeople('owners')">كل الملاك</button>
        <button type="button" class="btn sm ghost" onclick="pickPeople('none')">تفريغ</button>
      </div>
      <input id="rmSearch" class="search-box mtop" placeholder="بحث بالاسم أو رقم الوحدة..."
        oninput="filterPeople(this.value)">
      <div id="rmPeople" class="mtop" style="max-height:38vh;overflow:auto;
        border:1px solid var(--line);border-radius:10px;padding:6px">
        ${peopleListHTML(PEOPLE)}
      </div>
    </div>

    <label class="checkline mtop">
      <input type="checkbox" id="rmHistory" checked>
      <span>الأعضاء يشوفوا الرسايل السابقة
        <div class="small" style="color:var(--muted)">
          لو قفلتها، كل عضو يشوف من لحظة إضافته بس.</div></span>
    </label>

    <div class="modal-actions">
      <button class="btn primary" onclick="createRoom()">💾 إنشاء المحادثة</button>
      <button class="btn ghost" onclick="openPrivateChats()">رجوع</button>
    </div>`, true);
};

function peopleListHTML(list){
  if (!list.length) return '<p class="small">مفيش أعضاء.</p>';
  const me = myId();
  return list.map(p => `
    <label class="rm-row" style="display:flex;align-items:center;gap:10px;
           padding:8px 4px;border-bottom:1px solid var(--line);width:100%">
      <input type="checkbox" class="rm-chk" data-uid="${esc2(p.user_id)}"
        ${p.user_id === me ? 'checked disabled' : ''}
        style="flex:0 0 auto;width:18px;height:18px;margin:0">
      <span style="flex:1 1 auto;min-width:0">
        <span style="display:block;font-weight:600;white-space:nowrap;
              overflow:hidden;text-overflow:ellipsis">${esc2(p.name || '—')}
          ${p.user_id === me ? '<span class="badge n">أنت</span>' : ''}</span>
        <span class="small" style="display:block;color:var(--muted);
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${esc2(ROLE_AR[p.role] || p.role)}${
          p.unit_number ? ' · وحدة ' + esc2(p.unit_number) : ''}</span>
      </span>
    </label>`).join('');
}

window.filterPeople = function(q){
  const s = String(q||'').trim().toLowerCase();
  const list = !s ? PEOPLE : PEOPLE.filter(p =>
    String(p.name||'').toLowerCase().includes(s) ||
    String(p.unit_number||'').includes(s) ||
    String(ROLE_AR[p.role]||'').includes(s));
  const box = document.getElementById('rmPeople');
  if (box) box.innerHTML = peopleListHTML(list);
};

window.pickPeople = function(kind){
  const staff = ['admin','deputy','accountant','treasurer','board','manager'];
  document.querySelectorAll('.rm-chk').forEach(el => {
    if (el.disabled) return;
    const p = PEOPLE.find(x => x.user_id === el.dataset.uid);
    el.checked = kind === 'none' ? false
      : kind === 'staff'  ? staff.includes(p && p.role)
      : ['owner','tenant'].includes(p && p.role);
  });
};

window.createRoom = async function(){
  const name  = (document.getElementById('rmName').value || '').trim();
  const topic = (document.getElementById('rmTopic').value || '').trim();
  const histAll = !!(document.getElementById('rmHistory')||{}).checked;
  if (!name) return showMessage('اكتب اسم المحادثة');

  const ids = [...document.querySelectorAll('.rm-chk')]
    .filter(e => e.checked && !e.disabled).map(e => e.dataset.uid);
  if (!ids.length) return showMessage('اختار عضو واحد على الأقل');

  try{
    const { error } = await sb.rpc('create_private_room', {
      p_building: bUuid(), p_name: name, p_topic: topic || null,
      p_members: ids, p_history_all: histAll,
    });
    if (error) throw error;
    toast('اتعملت المحادثة');
    openPrivateChats();
  }catch(e){ showMessage(e.message || 'تعذّر الإنشاء'); }
};

/* ---------- إدارة الغرفة ---------- */

window.openRoomAdmin = async function(roomId){
  try{ await Promise.all([loadRooms(), loadPeople()]); }
  catch(e){ return showMessage(e.message||''); }
  const r = ROOMS.find(x => x.id === roomId);
  if (!r) return showMessage('المحادثة مش موجودة');
  const members = (r.chat_room_members||[]);

  const nameOf = uid => {
    const p = PEOPLE.find(x => x.user_id === uid);
    return p ? (p.name || '—') + ' · ' + (ROLE_AR[p.role]||p.role) : uid.slice(0,8);
  };

  openModal(`
    <h3>⚙️ إدارة: ${esc2(r.name)}</h3>
    <p class="small mtop">الحالة: <b>${esc2(STATUS_AR[r.status])}</b>
      ${r.lock_reason ? ' — ' + esc2(r.lock_reason) : ''}</p>

    <div class="field2 mtop"><label>اسم المحادثة</label>
      <input id="raName" value="${esc2(r.name)}"></div>
    <div class="field2"><label>الوصف</label>
      <input id="raTopic" value="${esc2(r.topic||'')}"></div>
    <button class="btn sm" onclick="saveRoomInfo('${esc2(r.id)}')">💾 حفظ البيانات</button>

    <div class="card mtop2" style="background:var(--tint)">
      <b class="small">👥 الأعضاء (${members.filter(m=>m.is_active!==false).length})</b>
      ${members.map(m => `
        <div class="flexrow mtop" style="justify-content:space-between;gap:6px;flex-wrap:wrap;
             ${m.is_active===false?'opacity:.5':''}">
          <span class="small" style="flex:1">${esc2(nameOf(m.user_id))}
            ${m.member_role==='manager'?'<span class="badge n">مدير</span>':''}
            ${m.is_active===false?'<span class="badge r">متشال</span>':''}</span>
          ${m.is_active===false
            ? `<button class="btn sm ghost" onclick="roomMember('${esc2(r.id)}','${esc2(m.user_id)}','add')">رجّعه</button>`
            : `<button class="btn sm ghost" onclick="roomMember('${esc2(r.id)}','${esc2(m.user_id)}','${m.member_role==='manager'?'unmgr':'mgr'}')">
                 ${m.member_role==='manager'?'اسحب الإدارة':'اعمله مدير'}</button>
               <button class="btn sm red" onclick="roomMember('${esc2(r.id)}','${esc2(m.user_id)}','remove')">شيله</button>`}
        </div>`).join('')}

      <div class="field2 mtop2"><label>ضيف عضو</label>
        <select id="raAdd">
          <option value="">— اختار —</option>
          ${PEOPLE.filter(p => !members.some(m => m.user_id===p.user_id && m.is_active!==false))
            .map(p => `<option value="${esc2(p.user_id)}">${esc2(p.name||'—')} · ${
              esc2(ROLE_AR[p.role]||p.role)}${p.unit_number?' · وحدة '+esc2(p.unit_number):''}</option>`).join('')}
        </select>
        <label class="checkline mtop">
          <input type="checkbox" id="raHist" checked>
          <span class="small">يشوف الرسايل السابقة</span>
        </label>
        <button class="btn sm mtop" onclick="addRoomMember('${esc2(r.id)}')">➕ ضيف</button>
      </div>
    </div>

    <div class="card mtop2">
      <b class="small">حالة المحادثة</b>
      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        ${r.status==='READ_ONLY'
          ? `<button class="btn sm" onclick="roomStatus('${esc2(r.id)}','ACTIVE')">🔓 إعادة فتح الإرسال</button>`
          : `<button class="btn sm gold" onclick="roomStatus('${esc2(r.id)}','READ_ONLY')">🔒 إيقاف الإرسال مؤقتًا</button>`}
        ${r.status==='ARCHIVED'
          ? `<button class="btn sm" onclick="roomStatus('${esc2(r.id)}','ACTIVE')">↩️ رجّعها للنشطة</button>`
          : `<button class="btn sm ghost" onclick="roomStatus('${esc2(r.id)}','ARCHIVED')">📦 أرشفة</button>`}
        <button class="btn sm red" onclick="roomStatus('${esc2(r.id)}','DELETED')">🗑 حذف المحادثة</button>
      </div>
      <p class="small mtop" style="color:var(--muted)">
        <b>الأرشفة</b> بتشيلها من النشطة والرسايل محفوظة وتقدر ترجّعها.
        <b>الحذف</b> بيوقف وصول كل الأعضاء — والاسترجاع بيحتاج إدارة النظام.</p>
    </div>

    <div class="modal-actions">
      <button class="btn ghost" onclick="openPrivateChats()">رجوع</button>
    </div>`, true);
};

window.saveRoomInfo = async function(roomId){
  const name  = (document.getElementById('raName').value||'').trim();
  const topic = (document.getElementById('raTopic').value||'').trim();
  if (!name) return showMessage('اكتب اسم المحادثة');
  try{
    const { error } = await sb.from('chat_rooms')
      .update({ name, topic: topic || null, updated_at: new Date().toISOString() })
      .eq('id', roomId).select('id');
    if (error) throw error;
    toast('اتحفظ'); openRoomAdmin(roomId);
  }catch(e){ showMessage(e.message||'تعذّر الحفظ'); }
};

window.roomMember = async function(roomId, userId, action){
  try{
    let r;
    if (action === 'remove') r = await sb.rpc('room_remove_member',
      { p_room: roomId, p_user: userId });
    else if (action === 'add') r = await sb.rpc('room_add_member',
      { p_room: roomId, p_user: userId, p_history_all: true });
    else r = await sb.rpc('room_set_manager',
      { p_room: roomId, p_user: userId, p_on: action === 'mgr' });
    if (r.error) throw r.error;
    openRoomAdmin(roomId);
  }catch(e){ showMessage(e.message||'تعذّر التنفيذ'); }
};

window.addRoomMember = async function(roomId){
  const uid = (document.getElementById('raAdd')||{}).value;
  if (!uid) return showMessage('اختار عضو');
  const hist = !!(document.getElementById('raHist')||{}).checked;
  try{
    const { error } = await sb.rpc('room_add_member',
      { p_room: roomId, p_user: uid, p_history_all: hist });
    if (error) throw error;
    toast('اتضاف'); openRoomAdmin(roomId);
  }catch(e){ showMessage(e.message||'تعذّرت الإضافة'); }
};

window.roomStatus = async function(roomId, status){
  const ask = (status === 'READ_ONLY')
    ? prompt('سبب الإيقاف (اختياري):','') : null;
  if (status === 'READ_ONLY' && ask === null) return;

  const go = async () => {
    try{
      const { error } = await sb.rpc('set_room_status',
        { p_room: roomId, p_status: status, p_reason: ask || null });
      if (error) throw error;
      toast('اتحدّثت الحالة');
      if (status === 'DELETED') openPrivateChats(); else openRoomAdmin(roomId);
    }catch(e){ showMessage(e.message||'تعذّر التنفيذ'); }
  };

  if (status === 'DELETED'){
    return confirmAction(
      'هل أنت متأكد من حذف هذه المحادثة؟\n\n' +
      'سيتم إيقاف الوصول إلى المحادثة لجميع الأعضاء.\n' +
      'الرسائل بتفضل محفوظة، بس الاسترجاع بيحتاج إدارة النظام.\n\n' +
      'لو عايز تشيلها من القائمة بس، استخدم "أرشفة" بدل الحذف.', go);
  }
  go();
};

/* ---------- المحادثة نفسها ---------- */

window.openRoom = async function(roomId){
  CUR = ROOMS.find(r => r.id === roomId) || { id: roomId };
  await paintRoom();
  if (POLL) clearInterval(POLL);
  POLL = setInterval(paintRoom, 6000);
};

let REPLY = null;

async function paintRoom(){
  if (!CUR) return;
  let msgs = [];
  try{
    const { data, error } = await sb.from('chat_messages')
      .select('*').eq('room_id', CUR.id).order('created_at').limit(300);
    if (error) throw error;
    msgs = data || [];
  }catch(e){ return; }

  /* نحدّث حالة القراءة للغرفة دي */
  try{ if (window.markChatRead) markChatRead(CUR.id); }catch(e){}

  const me = myId();
  const locked = CUR.status && CUR.status !== 'ACTIVE';
  const isMgr = CUR.created_by === me
    || (window.isUnionHead && isUnionHead())
    || (CUR.chat_room_members||[]).some(m =>
         m.user_id === me && m.member_role === 'manager' && m.is_active !== false);
  const canWrite = (!locked || isMgr);

  const body = `
    <div class="flexrow" style="justify-content:space-between;gap:8px">
      <button class="btn sm ghost" onclick="closeChatPoll();openPrivateChats()">← الغرف</button>
      ${isMgr ? `<button class="btn sm ghost" onclick="closeChatPoll();openRoomAdmin('${esc2(CUR.id)}')">⚙️</button>` : ''}
    </div>
    <h3 class="mtop">💬 ${esc2(CUR.name || 'محادثة')}</h3>
    ${locked ? `<div class="card mtop" style="background:var(--tint-warning)">
      <b class="small">🔒 ${esc2(STATUS_AR[CUR.status])}</b>
      ${CUR.lock_reason?`<div class="small">${esc2(CUR.lock_reason)}</div>`:''}
      ${isMgr?'<div class="small" style="color:var(--muted)">إنت مدير — تقدر تكتب.</div>':''}
    </div>` : ''}

    <div id="chatBox" class="mtop" style="max-height:52vh;overflow-y:auto;
      display:flex;flex-direction:column;gap:8px;padding:4px">
      ${!msgs.length ? '<p class="small" style="text-align:center">لسه مفيش رسايل. ابدأ إنت.</p>'
      : msgs.map(m => {
          const mine = m.sender_id === me;
          const del = !!m.deleted_at;
          if (del) return `<div class="card" style="background:#F6F6F6;
            border:1px dashed var(--line);align-self:center;max-width:90%">
            <span class="small" style="color:var(--muted)">${esc2(m.body)}</span></div>`;
          const showDel = (mine && can('delete_own')) || (!mine && (isMgr || can('delete_any')));
          return `<div style="align-self:${mine?'flex-start':'flex-end'};max-width:82%">
            <div class="card" style="background:${mine?'var(--accent)':'var(--card)'};
                 color:${mine?'#fff':'inherit'}">
              <div class="flexrow" style="gap:6px;align-items:flex-start">
                <span class="small" style="font-weight:700;flex:1;
                  color:${mine?'rgba(255,255,255,.85)':'var(--muted)'}">${esc2(m.sender_name||'')}</span>
                ${(canWrite||showDel)?`<span style="position:relative">
                  <span style="cursor:pointer;opacity:.6;padding:0 4px"
                    onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='flex'?'none':'flex'">⋮</span>
                  <span style="display:none;position:absolute;inset-inline-end:0;top:20px;z-index:5;
                    background:var(--card);border:1px solid var(--line);border-radius:10px;
                    padding:5px;flex-direction:column;gap:4px;min-width:130px;
                    box-shadow:0 6px 18px rgba(0,0,0,.14)">
                    ${canWrite?`<button class="btn sm ghost" onclick="replyRoom('${esc2(m.id)}')">↩️ رد</button>`:''}
                    ${showDel?`<button class="btn sm red" onclick="delRoomMsg('${esc2(m.id)}',${mine})">🗑 حذف</button>`:''}
                  </span></span>`:''}
              </div>
              ${m.reply_text?`<div style="border-inline-start:3px solid ${
                mine?'rgba(255,255,255,.5)':'var(--accent)'};padding-inline-start:8px;
                margin:4px 0;opacity:.85">
                <div class="small" style="font-weight:700">${esc2(m.reply_label||'')}</div>
                <div class="small">${esc2(m.reply_text)}</div></div>`:''}
              <div style="white-space:pre-wrap">${esc2(m.body)}</div>
              <div class="small" style="opacity:.7">${
                esc2(new Date(m.created_at).toLocaleString('ar-EG'))}</div>
            </div></div>`;
        }).join('')}
    </div>

    ${REPLY?`<div class="flexrow mtop" style="gap:8px;background:var(--tint);
      padding:8px;border-radius:10px">
      <div style="flex:1;min-width:0">
        <div class="small" style="font-weight:700">↩️ رد على ${esc2(REPLY.label)}</div>
        <div class="small" style="color:var(--muted);white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis">${esc2(REPLY.text)}</div>
      </div>
      <button class="btn sm ghost" onclick="cancelRoomReply()">✕</button>
    </div>`:''}

    ${canWrite ? `<div class="flexrow mtop">
      <textarea id="roomInput" rows="2" style="flex:1" placeholder="اكتب رسالتك..."></textarea>
      <button class="btn primary" onclick="sendMsg()">إرسال</button>
    </div>` : `<p class="small mtop" style="text-align:center;color:var(--muted)">
      مش هتقدر ترسل — ${esc2(STATUS_AR[CUR.status]||'')}.</p>`}`;

  /* النافذة اسمها #modalBox — التحديث في المكان عشان اللي بتكتبه
     ما يضيعش، ومكان المؤشر يفضل زي ما هو.
     وخانة الكتابة اسمها roomInput مش chatInput: الغرفة بتفتح فوق
     شاشة الشات العام، والاتنين كانوا بنفس المعرّف — فـ
     getElementById كان بيرجّع خانة الشات العام (الأولى في الصفحة)،
     فالإرسال ياخد نص فاضي ويخرج بصمت. */
  const box = document.getElementById('modalBox');
  const shown = document.getElementById('chatBox');
  const keep = document.getElementById('roomInput');
  const draft = keep ? keep.value : '';
  const focused = keep && document.activeElement === keep;
  const atBottom = !shown ||
    (shown.scrollHeight - shown.scrollTop - shown.clientHeight < 40);

  if (box && shown) box.innerHTML = body;
  else openModal(body, true);

  const inp = document.getElementById('roomInput');
  if (inp){ inp.value = draft; if (focused) inp.focus(); }
  const cb = document.getElementById('chatBox');
  if (cb && atBottom) cb.scrollTop = cb.scrollHeight;
}

window.replyRoom = function(id){
  sb.from('chat_messages').select('sender_name,body').eq('id', id).single()
    .then(({ data }) => {
      if (!data) return;
      REPLY = { id, label: data.sender_name || '', text: (data.body||'').slice(0,60) };
      paintRoom();
    });
};
window.cancelRoomReply = function(){ REPLY = null; paintRoom(); };

window.sendMsg = async function(){
  const inp = document.getElementById('roomInput');
  const text = (inp.value || '').trim();
  if (!text || !CUR) return;
  const me = myId();
  const u = window.currentUser ? currentUser() : null;
  try{
    const { error } = await sb.from('chat_messages').insert({
      room_id: CUR.id, sender_id: me,
      sender_name: (u && (u.name || u.username)) || 'مستخدم',
      body: text,
      reply_label: REPLY ? REPLY.label : null,
      reply_text:  REPLY ? REPLY.text  : null,
    });
    if (error) throw error;
    inp.value = ''; REPLY = null;
    await paintRoom();
  }catch(e){ showMessage(e.message || 'تعذّر الإرسال'); }
};

window.delRoomMsg = function(id, mine){
  confirmAction(mine ? 'هل تريد حذف هذه الرسالة؟'
    : 'حذف رسالة عضو تاني؟\n\nهيتسجّل مين حذفها وإمتى، والمحتوى مش هيرجع.',
    async () => {
      try{
        const { error } = await sb.rpc('delete_room_message', { p_msg: id, p_reason: null });
        if (error) throw error;
        await paintRoom();
      }catch(e){ showMessage(e.message || 'تعذّر الحذف'); }
    });
};

window.closeChatPoll = function(){ if (POLL){ clearInterval(POLL); POLL = null; } };
