/* ============================================================
   عمارتنا — سجل التواصل مع رؤساء اتحاد الملاك
   ------------------------------------------------------------
   كل ضغطة على واتساب/اتصال/رسالة بتفتح القناة وتسجّل العملية،
   مع ملاحظة ونتيجة وموعد متابعة اختياري. الجدول بيعرض آخر تواصل
   لكل عمارة، وفيه شاشة سجل كامل لكل عمارة.
   البيانات في جدول head_contacts — متاحة لمسؤول المنصة فقط (RLS).
   ============================================================ */

const ready = (t) => new Promise(r => {
  const i = setInterval(() => { if (t()) { clearInterval(i); r(); } }, 120);
  setTimeout(() => { clearInterval(i); r(); }, 20000);
});
await ready(() => window.CLOUD && window.CLOUD._sb);
const sb = window.CLOUD._sb;

const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

const CHANNELS = {
  whatsapp: { label: 'واتساب',  icon: '📱' },
  call:     { label: 'مكالمة',  icon: '📞' },
  sms:      { label: 'رسالة',   icon: '✉️' },
  email:    { label: 'إيميل',   icon: '📧' },
  visit:    { label: 'زيارة',   icon: '🚶' },
  other:    { label: 'أخرى',    icon: '•'  },
};
const OUTCOMES = ['تم', 'مرد', 'مردش', 'مؤجل', 'رفض'];

/* ---------- كاش آخر تواصل ---------- */

let lastMap = {};          // legacyBuildingId -> صف الملخص
let uuidByLegacy = {};

function bUuid(legacyId){
  return (window.CLOUD && CLOUD._cache && CLOUD._cache.buildingUuid
          && CLOUD._cache.buildingUuid[legacyId]) || uuidByLegacy[legacyId] || null;
}

window.lastContactOf = id => lastMap[id] || null;

window.lastContactCell = function(b){
  const r = lastMap[b.id];
  if (!r) return '<span class="small" style="color:var(--muted)">لسه مفيش</span>';
  const d = new Date(r.last_at);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const ch = CHANNELS[r.last_channel] || CHANNELS.other;
  const cls = days <= 7 ? 'g' : days <= 30 ? 'y' : 'n';
  const when = days === 0 ? 'النهاردة' : days === 1 ? 'إمبارح' : `من ${days} يوم`;
  return `<span class="badge ${cls}" title="${esc2(r.last_note || '')}">
      ${ch.icon} ${esc2(when)}</span>
    <span class="small" style="color:var(--muted)"> · ${esc2(r.last_outcome)}
    · ${r.total_contacts} مرة</span>`;
};

async function loadLastContacts(){
  try{
    const { data, error } = await sb.from('v_head_last_contact').select('*');
    if (error) return;
    const legacyOf = {};
    const cache = window.CLOUD && CLOUD._cache && CLOUD._cache.buildingUuid;
    if (cache) Object.entries(cache).forEach(([legacy, uuid]) => {
      legacyOf[uuid] = legacy; uuidByLegacy[legacy] = uuid;
    });
    lastMap = {};
    (data || []).forEach(r => {
      const legacy = legacyOf[r.building_id] || r.building_id;
      lastMap[legacy] = r;
    });
  }catch(e){ /* الشاشة تشتغل من غير السجل */ }
}
window.reloadContactLog = loadLastContacts;
loadLastContacts();

/* ---------- تسجيل تواصل ---------- */

function headOf(buildingId){
  try{
    const d = window.loadBuildingData ? loadBuildingData(buildingId) : null;
    const a = d && (d.users || []).find(u => u.role === 'admin');
    return {
      name: a ? (a.name || a.username || '') : '',
      phone: a ? String(a.phone || '') : '',
      country: a ? (a.phoneCountry || '+20') : '+20',
      bName: d && d.building ? d.building.name : '',
    };
  }catch(e){ return { name:'', phone:'', country:'+20', bName:'' }; }
}

function openChannel(channel, h){
  const digits = (h.country || '+20').replace('+','') + String(h.phone).replace(/^0+/, '');
  if (channel === 'whatsapp') window.open('https://wa.me/' + digits, '_blank');
  else if (channel === 'call') window.location.href = 'tel:' + h.country + h.phone;
  else if (channel === 'sms')  window.location.href = 'sms:' + h.country + h.phone;
}

window.contactHead = function(buildingId, channel){
  const h = headOf(buildingId);
  if (!h.phone) return showMessage('رئيس الاتحاد مالوش رقم مسجّل.');
  openChannel(channel, h);          // نفتح القناة الأول عشان ما نأخّرش المستخدم
  setTimeout(() => logContactModal(buildingId, channel, h), 400);
};

function logContactModal(buildingId, channel, h){
  const ch = CHANNELS[channel] || CHANNELS.other;
  openModal(`
    <h3>${ch.icon} تسجيل تواصل — ${esc2(h.bName)}</h3>
    <p class="small mtop">${esc2(h.name)} · ${esc2(h.country + h.phone)}</p>

    <div class="field2 mtop"><label>نتيجة التواصل</label>
      <select id="ctOutcome">
        ${OUTCOMES.map(o => `<option value="${o}">${o}</option>`).join('')}
      </select></div>

    <div class="field2"><label>ملاحظة</label>
      <textarea id="ctNote" rows="4"
        placeholder="اتكلمنا عن التجديد — طلب مهلة أسبوع"></textarea></div>

    <div class="field2"><label>متابعة يوم (اختياري)</label>
      <input type="date" id="ctFollow"></div>

    <div class="modal-actions">
      <button class="btn primary" onclick="saveContactLog('${esc2(buildingId)}','${channel}')">
        💾 سجّل</button>
      <button class="btn ghost" onclick="closeModal()">من غير تسجيل</button>
    </div>`);
}

window.saveContactLog = async function(buildingId, channel){
  const uuid = bUuid(buildingId);
  if (!uuid) return showMessage('العمارة مش متزامنة مع السحابة.');
  const h = headOf(buildingId);
  const me = window.currentUser ? currentUser() : null;
  const row = {
    building_id: uuid,
    head_name:  h.name,
    head_phone: (h.country || '') + (h.phone || ''),
    channel,
    outcome: document.getElementById('ctOutcome').value,
    note:    document.getElementById('ctNote').value.trim(),
    followup_at: document.getElementById('ctFollow').value || null,
    contacted_by_name: me ? (me.name || me.username || '') : '',
  };
  try{
    const { error } = await sb.from('head_contacts').insert(row);
    if (error) throw error;
    closeModal();
    await loadLastContacts();
    if (window.toast) toast('اتسجّل التواصل');
    if (window.renderContent) renderContent();
  }catch(e){ showMessage(e.message); }
};

/* ---------- سجل عمارة ---------- */

window.openContactHistory = async function(buildingId){
  const uuid = bUuid(buildingId);
  if (!uuid) return showMessage('العمارة مش متزامنة مع السحابة.');
  const h = headOf(buildingId);

  let rows = [];
  try{
    const { data, error } = await sb.from('head_contacts')
      .select('*').eq('building_id', uuid).order('contacted_at', { ascending:false });
    if (error) throw error;
    rows = data || [];
  }catch(e){ return showMessage(e.message); }

  openModal(`
    <h3>📇 سجل التواصل — ${esc2(h.bName)}</h3>
    <p class="small mtop">${esc2(h.name)} · ${esc2(h.country + h.phone)}
      · ${rows.length} عملية تواصل</p>

    <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
      ${h.phone ? Object.entries(CHANNELS).slice(0,3).map(([k,c]) =>
        `<button class="btn sm" onclick="closeModal();contactHead('${esc2(buildingId)}','${k}')">
          ${c.icon} ${c.label}</button>`).join('') : ''}
      <button class="btn sm ghost" onclick="closeModal();logManualContact('${esc2(buildingId)}')">
        ➕ تسجيل يدوي</button>
    </div>

    <div class="table-wrap mtop2" style="max-height:52vh;overflow:auto">
      ${rows.length ? rows.map(r => {
        const c = CHANNELS[r.channel] || CHANNELS.other;
        const d = new Date(r.contacted_at);
        return `
        <div class="card mtop" style="padding:8px">
          <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
            <b class="small">${c.icon} ${c.label}
              <span class="badge ${r.outcome === 'تم' ? 'g' : r.outcome === 'مردش' ? 'n' : 'y'}"
                style="margin-inline-start:6px">${esc2(r.outcome)}</span></b>
            <span class="small" style="color:var(--muted)">
              ${d.toLocaleDateString('ar-EG')} ${d.toLocaleTimeString('ar-EG',
                { hour:'2-digit', minute:'2-digit' })}</span>
          </div>
          ${r.note ? `<p class="small mtop" style="white-space:pre-wrap">${esc2(r.note)}</p>` : ''}
          <div class="small" style="color:var(--muted);margin-top:4px">
            ${r.contacted_by_name ? 'بواسطة ' + esc2(r.contacted_by_name) : ''}
            ${r.followup_at ? ` · 📅 متابعة ${esc2(r.followup_at)}` : ''}
            <button class="btn sm ghost" style="float:inline-end;padding:1px 7px"
              onclick="deleteContactLog('${esc2(r.id)}','${esc2(buildingId)}')">حذف</button>
          </div>
        </div>`;
      }).join('') : '<p class="small">لسه مفيش تواصل مسجّل.</p>'}
    </div>

    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`, true);
};

window.logManualContact = function(buildingId){
  const h = headOf(buildingId);
  openModal(`
    <h3>➕ تسجيل تواصل يدوي</h3>
    <div class="field2 mtop"><label>القناة</label>
      <select id="ctChannel">
        ${Object.entries(CHANNELS).map(([k,c]) =>
          `<option value="${k}">${c.icon} ${c.label}</option>`).join('')}
      </select></div>
    <div class="field2"><label>نتيجة التواصل</label>
      <select id="ctOutcome">${OUTCOMES.map(o => `<option>${o}</option>`).join('')}</select></div>
    <div class="field2"><label>ملاحظة</label>
      <textarea id="ctNote" rows="4"></textarea></div>
    <div class="field2"><label>متابعة يوم (اختياري)</label>
      <input type="date" id="ctFollow"></div>
    <div class="modal-actions">
      <button class="btn primary"
        onclick="saveContactLog('${esc2(buildingId)}',document.getElementById('ctChannel').value)">
        💾 سجّل</button>
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
};

window.deleteContactLog = async function(id, buildingId){
  try{
    const { error } = await sb.from('head_contacts').delete().eq('id', id);
    if (error) throw error;
    await loadLastContacts();
    closeModal();
    openContactHistory(buildingId);
  }catch(e){ showMessage(e.message); }
};

/* ---------- سجل كل التواصلات (كل العمارات) ---------- */

let ALL = [];      // كاش السجل الكامل

window.openAllContacts = async function(){
  try{
    const { data, error } = await sb.from('head_contacts')
      .select('*').order('contacted_at', { ascending:false }).limit(1000);
    if (error) throw error;
    ALL = data || [];
  }catch(e){ return showMessage(e.message); }

  // نربط كل صف باسم عمارته
  const nameOf = {};
  try{
    const cache = CLOUD._cache.buildingUuid || {};
    Object.entries(cache).forEach(([legacy, uuid]) => {
      const d = window.loadBuildingData ? loadBuildingData(legacy) : null;
      nameOf[uuid] = (d && d.building && d.building.name) || legacy;
    });
  }catch(e){}
  ALL.forEach(r => { r.__b = nameOf[r.building_id] || '—'; });

  renderAllContacts('');
};

window.searchContacts = function(q){ renderAllContacts(q); };

function renderAllContacts(q){
  const term = (q || '').trim().toLowerCase();
  const rows = !term ? ALL : ALL.filter(r =>
    [r.__b, r.head_name, r.head_phone, r.note, r.outcome,
     (CHANNELS[r.channel] || {}).label, r.contacted_by_name]
      .some(v => String(v || '').toLowerCase().includes(term)));

  const byOutcome = {};
  rows.forEach(r => { byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1; });

  const html = `
    <h3>📇 سجل التواصل مع كل العمارات</h3>
    <p class="small mtop">${rows.length} من ${ALL.length} عملية تواصل
      ${Object.entries(byOutcome).map(([k,v]) => `· ${esc2(k)}: ${v}`).join(' ')}</p>

    <div class="field2 mtop"><label>بحث</label>
      <input id="ctSearch" value="${esc2(q || '')}" oninput="searchContacts(this.value)"
        placeholder="اسم عمارة، رئيس اتحاد، رقم، كلمة في ملاحظة، نتيجة..."></div>

    <div class="flexrow" style="gap:6px;flex-wrap:wrap">
      <button class="btn sm ghost" onclick="searchContacts('')">الكل</button>
      ${['مردش','مؤجل','رفض','تم'].map(o =>
        `<button class="btn sm ghost" onclick="searchContacts('${o}')">${o}</button>`).join('')}
      <button class="btn sm ghost" onclick="exportContactsCsv()">📤 تصدير</button>
    </div>

    <div class="table-wrap mtop2" style="max-height:52vh;overflow:auto">
      <table style="width:100%;font-size:12.5px">
        <thead><tr>
          <th style="text-align:start">العمارة</th><th style="text-align:start">رئيس الاتحاد</th>
          <th>القناة</th><th>النتيجة</th><th>التاريخ</th>
          <th style="text-align:start">الملاحظة</th><th>متابعة</th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(r => {
            const c = CHANNELS[r.channel] || CHANNELS.other;
            const d = new Date(r.contacted_at);
            return `<tr>
              <td style="padding:5px 4px"><b>${esc2(r.__b)}</b></td>
              <td>${esc2(r.head_name || '')}
                <div class="small" style="color:var(--muted)">${esc2(r.head_phone || '')}</div></td>
              <td style="text-align:center">${c.icon} ${esc2(c.label)}</td>
              <td style="text-align:center"><span class="badge ${
                r.outcome === 'تم' ? 'g' : r.outcome === 'مردش' ? 'n' : 'y'
              }">${esc2(r.outcome)}</span></td>
              <td style="text-align:center" class="small">${d.toLocaleDateString('ar-EG')}</td>
              <td class="small" style="max-width:260px;white-space:normal">${esc2(r.note || '—')}</td>
              <td style="text-align:center" class="small">${r.followup_at
                ? '📅 ' + esc2(r.followup_at) : '—'}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="7" class="small">مفيش نتائج.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`;

  /* النافذة اسمها #modalBox — .modal-body مش موجود في التطبيق،
     فالبحث كان بيعيد فتح النافذة ويضيّع مكان المؤشر مع كل حرف. */
  const box = document.getElementById('modalBox');
  const cur = document.getElementById('ctSearch');
  if (box && cur){
    const pos = cur.selectionStart;
    box.innerHTML = html;
    const nx = document.getElementById('ctSearch');
    if (nx){ nx.focus(); try{ nx.setSelectionRange(pos, pos); }catch(e){} }
  } else {
    openModal(html, true);
  }
}

window.exportContactsCsv = function(){
  const head = ['العمارة','رئيس الاتحاد','الهاتف','القناة','النتيجة','التاريخ','الملاحظة','متابعة','بواسطة'];
  const lines = [head.join(',')].concat(ALL.map(r => [
    r.__b, r.head_name || '', r.head_phone || '',
    (CHANNELS[r.channel] || {}).label || r.channel, r.outcome,
    new Date(r.contacted_at).toLocaleString('ar-EG'),
    (r.note || '').replace(/\n/g, ' '), r.followup_at || '', r.contacted_by_name || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'سجل-التواصل.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};

/* ---------- المتابعات المستحقة ---------- */

window.openFollowups = async function(){
  let rows = [];
  try{
    const { data, error } = await sb.from('head_contacts')
      .select('*').not('followup_at', 'is', null)
      .lte('followup_at', new Date().toISOString().slice(0,10))
      .order('followup_at');
    if (error) throw error;
    rows = data || [];
  }catch(e){ return showMessage(e.message); }

  openModal(`
    <h3>📅 متابعات مستحقة (${rows.length})</h3>
    ${rows.length ? rows.map(r => `
      <div class="card mtop" style="padding:8px">
        <b class="small">${esc2(r.head_name || r.head_phone)}</b>
        <span class="badge y" style="margin-inline-start:6px">${esc2(r.followup_at)}</span>
        ${r.note ? `<p class="small mtop">${esc2(r.note)}</p>` : ''}
      </div>`).join('') : '<p class="small mtop">مفيش متابعات مستحقة.</p>'}
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`, true);
};
