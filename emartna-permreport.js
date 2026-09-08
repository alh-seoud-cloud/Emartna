/* ============================================================
   عمارتنا — تقرير الصلاحيات
   ------------------------------------------------------------
   بيقرأ من v_permission_matrix / v_permission_summary مباشرة،
   مش من الحالة المحلية. يعني اللي بتشوفه هو الصلاحيات الفعلية
   المحسوبة بنفس منطق has_screen_perm اللي بيحمي القاعدة.

   عرضين زي المطلوب:
     ١) بالمستخدم — اختار مستخدم وشوف صلاحياته على كل شاشة
     ٢) بالشاشة  — اختار شاشة وشوف مين له صلاحية عليها
   ============================================================ */

const ready = (t) => new Promise(r => {
  const i = setInterval(() => { if (t()) { clearInterval(i); r(); } }, 120);
  setTimeout(() => { clearInterval(i); r(); }, 20000);
});
await ready(() => window.CLOUD && window.CLOUD._sb);
const sb = window.CLOUD._sb;
const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

const ROLE_AR = {
  admin:'رئيس الاتحاد', deputy:'نائب رئيس الاتحاد', accountant:'محاسب العمارة',
  treasurer:'أمين الصندوق', board:'عضو مجلس الإدارة', manager:'إداري العمارة',
  owner:'مالك وحدة', tenant:'مستأجر',
};
const roleAr = r => ROLE_AR[r] || r || '—';
const yes = '<span style="color:var(--ok,#128C7E);font-weight:700">✔</span>';
const no  = '<span style="color:var(--muted);opacity:.45">✕</span>';

let RPT = { rows: [], summary: [], building: null, buildings: [] };

async function loadBuildings(){
  const { data } = await sb.from('v_permission_summary')
    .select('building_id,building_name');
  const seen = {};
  (data || []).forEach(r => { seen[r.building_id] = r.building_name; });
  RPT.buildings = Object.entries(seen).map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

async function loadReport(buildingId){
  const [m, s] = await Promise.all([
    sb.from('v_permission_matrix').select('*').eq('building_id', buildingId),
    sb.from('v_permission_summary').select('*').eq('building_id', buildingId),
  ]);
  if (m.error) throw m.error;
  if (s.error) throw s.error;
  RPT.rows = m.data || [];
  RPT.summary = (s.data || []).sort((a, b) => a.role.localeCompare(b.role));
  RPT.building = buildingId;
}

/* ---------- الشاشة ---------- */

window.openPermReport = async function(){
  try{
    if (!RPT.buildings.length) await loadBuildings();
    if (!RPT.buildings.length) return showMessage('مفيش بيانات صلاحيات متاحة لحسابك.');
    const bid = RPT.building || RPT.buildings[0].id;
    await loadReport(bid);
    render('summary');
  }catch(e){ showMessage(e.message); }
};

window.permReportSwitch = async function(bid){
  try{ await loadReport(bid); render('summary'); }
  catch(e){ showMessage(e.message); }
};

window.permReportView = function(view, key){ render(view, key); };

function shell(view, body){
  const bName = (RPT.buildings.find(b => b.id === RPT.building) || {}).name || '';
  return `
    <h3>📋 تقرير الصلاحيات — ${esc2(bName)}</h3>

    ${RPT.buildings.length > 1 ? `
      <div class="field2 mtop"><label>العمارة</label>
        <select onchange="permReportSwitch(this.value)">
          ${RPT.buildings.map(b => `<option value="${esc2(b.id)}"
            ${b.id === RPT.building ? 'selected' : ''}>${esc2(b.name)}</option>`).join('')}
        </select></div>` : ''}

    <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
      <button class="btn sm ${view==='summary'?'primary':'ghost'}"
        onclick="permReportView('summary')">📊 ملخص</button>
      <button class="btn sm ${view==='byUser'?'primary':'ghost'}"
        onclick="permReportView('byUser')">👤 بالمستخدم</button>
      <button class="btn sm ${view==='byScreen'?'primary':'ghost'}"
        onclick="permReportView('byScreen')">🖥️ بالشاشة</button>
      <button class="btn sm ghost" onclick="permReportPrint()">🖨️ طباعة</button>
      <button class="btn sm ghost" onclick="permReportCsv()">📤 تصدير</button>
    </div>

    <div id="permReportBody" class="mtop2">${body}</div>

    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`;
}

function render(view, key){
  const body = view === 'byUser'   ? viewByUser(key)
             : view === 'byScreen' ? viewByScreen(key)
             : viewSummary();
  const html = shell(view, body);
  const box = document.getElementById('permReportBody');
  if (box && box.closest('.modal')) box.parentElement.innerHTML = html;
  else openModal(html, true);
}

/* ١) ملخص كل المستخدمين */
function viewSummary(){
  if (!RPT.summary.length) return '<p class="small">مفيش مستخدمين في العمارة دي.</p>';
  return `
    <div class="table-wrap" style="max-height:56vh;overflow:auto">
      <table style="width:100%;font-size:12.5px">
        <thead><tr>
          <th style="text-align:start">المستخدم</th>
          <th>الدور</th><th>الحالة</th><th>الشاشات</th><th>الصلاحيات</th>
          <th>حذف</th><th>اعتماد</th><th>تصدير</th><th></th>
        </tr></thead>
        <tbody>
          ${RPT.summary.map(u => `
            <tr>
              <td style="padding:5px 4px">
                <b>${esc2(u.user_name || '—')}</b>
                ${u.customized ? '<span class="badge b" style="margin-inline-start:5px">مخصّصة</span>' : ''}
                <div class="small" style="color:var(--muted)">${esc2(u.user_phone || '')}</div>
              </td>
              <td style="text-align:center">${esc2(roleAr(u.role))}</td>
              <td style="text-align:center">${u.user_active
                ? '<span class="badge g">نشط</span>' : '<span class="badge n">موقوف</span>'}</td>
              <td style="text-align:center">${u.screens_visible}/${u.screens_total}</td>
              <td style="text-align:center">${u.actions_allowed}/${u.actions_total}</td>
              <td style="text-align:center">${u.can_delete_any ? yes : no}</td>
              <td style="text-align:center">${u.can_approve_any ? yes : no}</td>
              <td style="text-align:center">${u.can_export_any ? yes : no}</td>
              <td style="text-align:center">
                <button class="btn sm ghost" onclick="permReportView('byUser','${esc2(u.user_id)}')">
                  تفاصيل</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ٢) صلاحيات مستخدم على كل شاشة */
function viewByUser(userId){
  const uid = userId || (RPT.summary[0] && RPT.summary[0].user_id);
  const rows = RPT.rows.filter(r => r.user_id === uid);
  if (!rows.length) return '<p class="small">اختار مستخدم.</p>';

  const acts = uniq(rows, 'action_key', 'action_order')
    .map(k => rows.find(r => r.action_key === k));
  const screens = uniq(rows, 'screen_key', 'screen_order');
  const u = RPT.summary.find(x => x.user_id === uid) || {};

  return `
    <div class="field2"><label>المستخدم</label>
      <select onchange="permReportView('byUser',this.value)">
        ${RPT.summary.map(x => `<option value="${esc2(x.user_id)}"
          ${x.user_id === uid ? 'selected' : ''}>${esc2(x.user_name || '—')} — ${esc2(roleAr(x.role))}
          </option>`).join('')}
      </select></div>
    <p class="small mtop">${esc2(roleAr(u.role))}
      ${u.customized ? '· صلاحيات مخصّصة' : '· على الافتراضي'}</p>

    <div class="table-wrap mtop" style="max-height:50vh;overflow:auto">
      <table style="width:100%;font-size:12px">
        <thead><tr><th style="text-align:start;min-width:140px">الشاشة</th>
          ${acts.map(a => `<th style="min-width:44px">${esc2(a.action_label)}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${screens.map(sk => {
            const r0 = rows.find(r => r.screen_key === sk);
            return `<tr>
              <td style="padding:4px">${esc2(r0.screen_label || sk)}</td>
              ${acts.map(a => {
                const c = rows.find(r => r.screen_key === sk && r.action_key === a.action_key);
                return `<td style="text-align:center">${c && c.allowed ? yes : no}</td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ٣) مين له صلاحية على شاشة */
function viewByScreen(screenKey){
  const screens = uniq(RPT.rows, 'screen_key', 'screen_order');
  const sk = screenKey || screens[0];
  const rows = RPT.rows.filter(r => r.screen_key === sk);
  if (!rows.length) return '<p class="small">مفيش بيانات.</p>';

  const acts = uniq(rows, 'action_key', 'action_order')
    .map(k => rows.find(r => r.action_key === k));
  const users = uniq(rows, 'user_id');

  return `
    <div class="field2"><label>الشاشة</label>
      <select onchange="permReportView('byScreen',this.value)">
        ${screens.map(k => {
          const r = RPT.rows.find(x => x.screen_key === k);
          return `<option value="${esc2(k)}" ${k === sk ? 'selected' : ''}>${
            esc2(r.screen_label || k)}</option>`;
        }).join('')}
      </select></div>

    <div class="table-wrap mtop" style="max-height:50vh;overflow:auto">
      <table style="width:100%;font-size:12px">
        <thead><tr><th style="text-align:start;min-width:150px">المستخدم</th>
          ${acts.map(a => `<th style="min-width:44px">${esc2(a.action_label)}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${users.map(uid => {
            const r0 = rows.find(r => r.user_id === uid);
            return `<tr>
              <td style="padding:4px"><b>${esc2(r0.user_name || '—')}</b>
                <span class="small" style="color:var(--muted)"> · ${esc2(roleAr(r0.role))}</span></td>
              ${acts.map(a => {
                const c = rows.find(r => r.user_id === uid && r.action_key === a.action_key);
                return `<td style="text-align:center">${c && c.allowed ? yes : no}</td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function uniq(rows, field, orderField){
  const seen = new Map();
  rows.forEach(r => { if (!seen.has(r[field]))
    seen.set(r[field], orderField ? (r[orderField] ?? 0) : 0); });
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
}

/* ---------- تصدير وطباعة ---------- */

window.permReportCsv = function(){
  const head = ['العمارة','المستخدم','الهاتف','الدور','نشط','الشاشة','الصلاحية','مسموح'];
  const lines = [head.join(',')].concat(RPT.rows.map(r => [
    r.building_name, r.user_name || '', r.user_phone || '', roleAr(r.role),
    r.user_active ? 'نعم' : 'لأ', r.screen_label || r.screen_key,
    r.action_label, r.allowed ? 'نعم' : 'لأ',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')));

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'صلاحيات-' +
    ((RPT.buildings.find(b => b.id === RPT.building) || {}).name || 'عمارة') + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};

window.permReportPrint = function(){
  const box = document.getElementById('permReportBody');
  if (!box) return;
  const bName = (RPT.buildings.find(b => b.id === RPT.building) || {}).name || '';
  const w = window.open('', '_blank');
  w.document.write(`<html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>تقرير الصلاحيات — ${esc2(bName)}</title>
    <style>body{font-family:system-ui,sans-serif;padding:18px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:5px;text-align:center}
      th:first-child,td:first-child{text-align:right}
      .small{font-size:11px;color:#666}</style></head><body>
    <h2>تقرير الصلاحيات — ${esc2(bName)}</h2>
    <p class="small">${new Date().toLocaleString('ar-EG')}</p>
    ${box.innerHTML}</body></html>`);
  w.document.close();
  w.print();
};
