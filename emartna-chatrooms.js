/* ============================================================
   عمارتنا — شات خاص داخل العمارة
   ------------------------------------------------------------
   غرف محادثة بعضوية محدّدة: رئيس الاتحاد يختار مين يدخل كل غرفة
   (النائب والمحاسب، أو ملّاك معيّنين، أو أي خليط).

   الرسائل متخزّنة على السيرفر مش جوه بيانات العمارة — لأن
   التطبيق بيحمّل بيانات العمارة كاملة لكل عضو، فأي رسالة
   "خاصة" تتحط هناك بتوصل للكل فعليًا حتى لو الشاشة مخبّياها.
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

const ROLE_AR = {
  admin:'رئيس الاتحاد', deputy:'نائب الرئيس', accountant:'محاسب',
  treasurer:'أمين الصندوق', board:'عضو مجلس', manager:'إداري',
  owner:'مالك وحدة', tenant:'مستأجر',
};

let ROOMS = [], PEOPLE = [], CUR = null, POLL = null;

/* ---------- قائمة الغرف ---------- */

window.openPrivateChats = async function(){
  const uuid = bUuid();
  if (!uuid) return showMessage('العمارة مش متزامنة مع السحابة.');
  try{
    const [r, p] = await Promise.all([
      sb.from('chat_rooms').select('*').eq('building_id', uuid)
        .eq('archived', false).order('created_at', { ascending:false }),
      sb.from('v_building_people').select('*').eq('building_id', uuid),
    ]);
    if (r.error) throw r.error;
    ROOMS = r.data || [];
    PEOPLE = (p.data || []).filter(x => x.active !== false);
  }catch(e){ return showMessage(e.message); }

  const canManage = !!(window.userCan && userCan(null, 'chat', 'add'));

  openModal(`
    <h3>💬 المحادثات الخاصة</h3>
    <p class="small mtop">غرف مقفولة على أعضاء محدّدين. اللي مش في الغرفة
      <b>ما بيشوفش رسايلها ولا اسمها</b> — الحماية على السيرفر مش على الشاشة.</p>

    ${canManage ? `<button class="btn primary mtop" onclick="openNewRoom()">
      + غرفة جديدة</button>` : ''}

    <div class="mtop2">
      ${ROOMS.length ? ROOMS.map(r => `
        <div class="card mtop" style="padding:10px">
          <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div style="flex:1;min-width:140px">
              <b>${esc2(r.name)}</b>
              ${r.topic ? `<div class="small" style="color:var(--muted)">${esc2(r.topic)}</div>` : ''}
            </div>
            <div class="flexrow" style="gap:6px">
              <button class="btn sm primary" onclick="openRoom('${esc2(r.id)}')">دخول</button>
              ${canManage ? `<button class="btn sm ghost" onclick="openRoomMembers('${esc2(r.id)}')">
                👥 الأعضاء</button>
              <button class="btn sm red" onclick="archiveRoom('${esc2(r.id)}')">أرشفة</button>` : ''}
            </div>
          </div>
        </div>`).join('')
      : '<p class="small">مفيش غرف — ولا غرفة انت عضو فيها.</p>'}
    </div>

    <div class="modal-actions">
      <button class="btn ghost" onclick="closeChatPoll();closeModal()">إغلاق</button>
    </div>`, true);
};

/* ---------- إنشاء غرفة ---------- */

window.openNewRoom = function(){
  openModal(`
    <h3>+ غرفة محادثة جديدة</h3>
    <div class="field2 mtop"><label>اسم الغرفة</label>
      <input id="rmName" placeholder="مجلس الإدارة"></div>
    <div class="field2"><label>الموضوع (اختياري)</label>
      <input id="rmTopic" placeholder="قرارات وميزانية"></div>

    <div class="field2 mtop"><label>الأعضاء</label>
      <div class="flexrow" style="gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <button type="button" class="btn sm ghost" onclick="pickPeople('staff')">كل الإدارة</button>
        <button type="button" class="btn sm ghost" onclick="pickPeople('owners')">كل الملاك</button>
        <button type="button" class="btn sm ghost" onclick="pickPeople('none')">تفريغ</button>
      </div>
      <input id="rmSearch" placeholder="بحث بالاسم أو الوحدة..."
        oninput="filterPeople(this.value)" style="width:100%;margin-bottom:6px">
      <div id="rmPeople" class="table-wrap" style="max-height:38vh;overflow:auto;padding:6px">
        ${peopleListHTML(PEOPLE)}
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn primary" onclick="createRoom()">💾 إنشاء</button>
      <button class="btn ghost" onclick="openPrivateChats()">إلغاء</button>
    </div>`, true);
};

function peopleListHTML(list){
  const me = myId();
  if (!list.length) return '<p class="small">مفيش نتائج.</p>';
  return list.map(p => `
    <label class="checkline" style="display:flex;gap:8px;padding:4px 0">
      <input type="checkbox" class="rm-chk" data-uid="${esc2(p.user_id)}"
        ${p.user_id === me ? 'checked disabled' : ''}>
      <span style="flex:1">${esc2(p.name || '—')}
        <span class="small" style="color:var(--muted)"> · ${esc2(ROLE_AR[p.role] || p.role)}${
          p.unit_number ? ' · وحدة ' + esc2(p.unit_number) : ''}</span>
        ${p.user_id === me ? '<span class="badge n">أنت</span>' : ''}</span>
    </label>`).join('');
}

window.filterPeople = function(q){
  const t = (q || '').trim().toLowerCase();
  const list = !t ? PEOPLE : PEOPLE.filter(p =>
    [p.name, p.phone, ROLE_AR[p.role], p.unit_number]
      .some(v => String(v || '').toLowerCase().includes(t)));
  document.getElementById('rmPeople').innerHTML = peopleListHTML(list);
};

window.pickPeople = function(kind){
  const staff = ['admin','deputy','accountant','treasurer','board','manager'];
  document.querySelectorAll('.rm-chk').forEach(el => {
    if (el.disabled) return;
    const p = PEOPLE.find(x => x.user_id === el.dataset.uid);
    if (!p) return;
    el.checked = kind === 'staff'  ? staff.includes(p.role)
               : kind === 'owners' ? ['owner','tenant'].includes(p.role)
               : false;
  });
};

window.createRoom = async function(){
  const name = (document.getElementById('rmName').value || '').trim();
  if (!name) return showMessage('اكتب اسم الغرفة');
  const picked = [...document.querySelectorAll('.rm-chk')]
    .filter(el => el.checked).map(el => el.dataset.uid);
  const me = myId();
  if (me && !picked.includes(me)) picked.push(me);
  if (picked.length < 2) return showMessage('اختار عضو واحد على الأقل غيرك');

  try{
    const { data, error } = await sb.from('chat_rooms').insert({
      building_id: bUuid(), name,
      topic: (document.getElementById('rmTopic').value || '').trim(),
      created_by: me,
    }).select().single();
    if (error) throw error;
    const rows = picked.map(uid => ({ room_id: data.id, user_id: uid, added_by: me }));
    const r2 = await sb.from('chat_room_members').insert(rows);
    if (r2.error) throw r2.error;
    if (window.toast) toast('اتعملت الغرفة');
    openPrivateChats();
  }catch(e){ showMessage(e.message); }
};

/* ---------- إدارة الأعضاء ---------- */

window.openRoomMembers = async function(roomId){
  const room = ROOMS.find(r => r.id === roomId);
  let members = [];
  try{
    const { data, error } = await sb.from('chat_room_members')
      .select('user_id').eq('room_id', roomId);
    if (error) throw error;
    members = (data || []).map(m => m.user_id);
  }catch(e){ return showMessage(e.message); }

  openModal(`
    <h3>👥 أعضاء ${esc2(room ? room.name : '')}</h3>
    <p class="small mtop">شيل العلامة عشان تخرج العضو — مش هيشوف الغرفة ولا رسايلها بعد كده.
      الرسايل القديمة بتفضل موجودة للباقي.</p>
    <input id="rmSearch" placeholder="بحث..." oninput="filterPeople(this.value)"
      style="width:100%;margin:6px 0">
    <div id="rmPeople" class="table-wrap" style="max-height:44vh;overflow:auto;padding:6px">
      ${peopleListHTML(PEOPLE)}
    </div>
    <div class="modal-actions">
      <button class="btn primary" onclick="saveRoomMembers('${esc2(roomId)}')">💾 حفظ</button>
      <button class="btn ghost" onclick="openPrivateChats()">رجوع</button>
    </div>`, true);

  document.querySelectorAll('.rm-chk').forEach(el => {
    if (members.includes(el.dataset.uid)) el.checked = true;
  });
};

window.saveRoomMembers = async function(roomId){
  const picked = [...document.querySelectorAll('.rm-chk')]
    .filter(el => el.checked).map(el => el.dataset.uid);
  if (!picked.length) return showMessage('لازم عضو واحد على الأقل');
  try{
    let r = await sb.from('chat_room_members').delete()
      .eq('room_id', roomId).not('user_id', 'in', '(' + picked.join(',') + ')');
    if (r.error) throw r.error;
    const rows = picked.map(uid => ({ room_id: roomId, user_id: uid, added_by: myId() }));
    r = await sb.from('chat_room_members').upsert(rows, { onConflict:'room_id,user_id' });
    if (r.error) throw r.error;
    if (window.toast) toast('اتحفظت العضوية');
    openPrivateChats();
  }catch(e){ showMessage(e.message); }
};

window.archiveRoom = function(roomId){
  confirmAction('أرشفة الغرفة؟ مش هتظهر لحد، والرسايل بتفضل محفوظة.', async () => {
    try{
      const { error } = await sb.from('chat_rooms')
        .update({ archived:true }).eq('id', roomId);
      if (error) throw error;
      openPrivateChats();
    }catch(e){ showMessage(e.message); }
  });
};

/* ---------- الغرفة نفسها ---------- */

window.openRoom = async function(roomId){
  CUR = ROOMS.find(r => r.id === roomId) || { id: roomId, name:'' };
  await paintRoom();
  closeChatPoll();
  POLL = setInterval(paintRoom, 6000);       // تحديث دوري بسيط
};

async function paintRoom(){
  let msgs = [];
  try{
    const { data, error } = await sb.from('chat_messages')
      .select('*').eq('room_id', CUR.id)
      .order('created_at', { ascending:true }).limit(300);
    if (error) throw error;
    msgs = data || [];
  }catch(e){ closeChatPoll(); return showMessage(e.message); }

  const me = myId();
  const body = `
    <h3>💬 ${esc2(CUR.name)}</h3>
    <div id="chatBox" class="table-wrap mtop"
      style="max-height:46vh;overflow:auto;padding:8px;background:var(--tint)">
      ${msgs.length ? msgs.map(m => {
        const mine = m.sender_id === me;
        const d = new Date(m.created_at);
        return `<div style="margin-bottom:8px;text-align:${mine?'start':'end'}">
          <div style="display:inline-block;max-width:80%;padding:7px 10px;border-radius:10px;
               background:${mine?'var(--tint-success,#DCF8C6)':'var(--panel,#fff)'};
               border:1px solid var(--line)">
            ${mine ? '' : `<div class="small" style="color:var(--muted)">${esc2(m.sender_name)}</div>`}
            <div style="white-space:pre-wrap">${esc2(m.body)}</div>
            <div class="small" style="color:var(--muted);margin-top:2px">
              ${d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}
              ${mine ? `<span style="cursor:pointer" onclick="delMsg('${esc2(m.id)}')"> · حذف</span>` : ''}
            </div>
          </div></div>`;
      }).join('') : '<p class="small">لسه مفيش رسايل. ابدأ انت.</p>'}
    </div>

    <div class="flexrow mtop" style="gap:6px">
      <textarea id="chatInput" rows="2" style="flex:1" placeholder="اكتب رسالتك..."
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg();}"></textarea>
      <button class="btn primary" onclick="sendMsg()">إرسال</button>
    </div>

    <div class="modal-actions">
      <button class="btn ghost" onclick="closeChatPoll();openPrivateChats()">← الغرف</button>
    </div>`;

  const box = document.querySelector('.modal .modal-body');
  const keep = document.getElementById('chatInput');
  const draft = keep ? keep.value : '';
  if (box && document.getElementById('chatBox')) box.innerHTML = body;
  else openModal(body, true);
  const inp = document.getElementById('chatInput');
  if (inp){ inp.value = draft; }
  const cb = document.getElementById('chatBox');
  if (cb) cb.scrollTop = cb.scrollHeight;
}

window.sendMsg = async function(){
  const el = document.getElementById('chatInput');
  const body = (el.value || '').trim();
  if (!body) return;
  const u = window.currentUser ? currentUser() : null;
  el.value = '';
  try{
    const { error } = await sb.from('chat_messages').insert({
      room_id: CUR.id, sender_id: myId(),
      sender_name: u ? (u.name || u.username || '') : '', body,
    });
    if (error) throw error;
    await paintRoom();
  }catch(e){ el.value = body; showMessage(e.message); }
};

window.delMsg = function(id){
  confirmAction('حذف الرسالة؟', async () => {
    try{
      const { error } = await sb.from('chat_messages').delete().eq('id', id);
      if (error) throw error;
      await paintRoom();
    }catch(e){ showMessage(e.message); }
  });
};

window.closeChatPoll = function(){ if (POLL){ clearInterval(POLL); POLL = null; } };
