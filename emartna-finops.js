/* ============================================================
   عمارتنا — عمليات محاسبية
   ------------------------------------------------------------
   تلات مميزات كانت مبنية في قاعدة البيانات من غير شاشات:
     ١) إقفال الفترات   — تقفل شهر فما حدش يعدّل فيه
     ٢) سجل التدقيق     — مين غيّر إيه وإمتى
     ٣) تخصيص الدفعات   — تربط الدفعة بالمستحقات اللي بتسددها
   التالت هو اللي بيخلّي أعمار الديون وكشف حساب الوحدة صح.
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
const money2 = n => (window.money ? money(n) : Number(n || 0).toFixed(2));

/* ============================================================
   ١) إقفال الفترات
   ============================================================ */

window.openPeriodLocks = async function(){
  if (!guardAction('collections', 'edit')) return;
  const uuid = bUuid();
  if (!uuid) return showMessage('العمارة مش متزامنة مع السحابة.');

  let locks = [];
  try{
    const { data, error } = await sb.from('period_locks')
      .select('*').eq('building_id', uuid).order('period', { ascending:false });
    if (error) throw error;
    locks = data || [];
  }catch(e){ return showMessage(e.message); }

  const lockedSet = new Set(locks.map(l => String(l.period).slice(0, 7)));
  const months = recentMonths(14);

  openModal(`
    <h3>🔒 إقفال الفترات المحاسبية</h3>
    <p class="small mtop">الشهر المقفول ما ينفعش يتسجّل فيه ولا يتعدّل ولا يتحذف —
      لا قيود ولا مصروفات ولا تحويلات. للتصحيح بعد الإقفال استخدم
      <b>قيد تسوية</b> أو <b>قيد عكسي</b> في شهر مفتوح.</p>

    <div class="table-wrap mtop2" style="max-height:50vh;overflow:auto">
      <table style="width:100%;font-size:13px">
        <thead><tr><th style="text-align:start">الشهر</th><th>الحالة</th>
          <th>اتقفل بواسطة</th><th></th></tr></thead>
        <tbody>
          ${months.map(m => {
            const l = locks.find(x => String(x.period).slice(0,7) === m.key);
            return `<tr>
              <td style="padding:6px 4px">${esc2(m.label)}</td>
              <td style="text-align:center">${l
                ? '<span class="badge n">🔒 مقفول</span>'
                : '<span class="badge g">مفتوح</span>'}</td>
              <td style="text-align:center" class="small">${l
                ? esc2(new Date(l.locked_at).toLocaleDateString('ar-EG')) +
                  (l.note ? ' · ' + esc2(l.note) : '')
                : '—'}</td>
              <td style="text-align:center">${l
                ? `<button class="btn sm red" onclick="unlockPeriod('${esc2(l.id)}','${m.key}')">
                     فك الإقفال</button>`
                : `<button class="btn sm" onclick="lockPeriod('${m.key}')">إقفال</button>`}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`, true);
};

function recentMonths(n){
  const out = [], d = new Date();
  for (let i = 0; i < n; i++){
    const key = d.toISOString().slice(0, 7);
    out.push({ key, label: d.toLocaleDateString('ar-EG',
      { year:'numeric', month:'long' }) });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

window.lockPeriod = function(monthKey){
  openModal(`
    <h3>🔒 إقفال ${esc2(monthKey)}</h3>
    <p class="small mtop">بعد الإقفال، أي محاولة تسجيل أو تعديل أو حذف في الشهر ده
      هتترفض من قاعدة البيانات نفسها — مش من الشاشة بس.</p>
    <div class="field2 mtop"><label>ملاحظة (اختياري)</label>
      <input id="plNote" placeholder="اتراجع واتعمله ميزان"></div>
    <div class="modal-actions">
      <button class="btn primary" onclick="doLockPeriod('${esc2(monthKey)}')">🔒 اقفل الشهر</button>
      <button class="btn ghost" onclick="openPeriodLocks()">رجوع</button>
    </div>`);
};

window.doLockPeriod = async function(monthKey){
  try{
    const { error } = await sb.from('period_locks').insert({
      building_id: bUuid(), period: monthKey + '-01',
      note: (document.getElementById('plNote').value || '').trim(),
    });
    if (error) throw error;
    if (window.toast) toast('اتقفل الشهر');
    openPeriodLocks();
  }catch(e){ showMessage(e.message); }
};

window.unlockPeriod = function(id, monthKey){
  openModal(`
    <h3>⚠️ فك إقفال ${esc2(monthKey)}</h3>
    <p class="small mtop">فك الإقفال بيفتح شهر متقفل للتعديل — وده أخطر إجراء محاسبي
      في النظام. <b>العملية بتتسجّل في سجل التدقيق باسمك وبالسبب اللي هتكتبه</b>،
      وما ينفعش تتمسح بعد كده.</p>
    <div class="field2 mtop"><label>سبب فك الإقفال (إجباري)</label>
      <textarea id="plReason" rows="3"
        placeholder="مثال: اتنسى تسجيل مصروف كهربا بفاتورة متأخرة"></textarea></div>
    <div class="modal-actions">
      <button class="btn red" onclick="doUnlockPeriod('${esc2(id)}')">فك الإقفال</button>
      <button class="btn ghost" onclick="openPeriodLocks()">إلغاء</button>
    </div>`);
};

window.doUnlockPeriod = async function(id){
  const reason = (document.getElementById('plReason').value || '').trim();
  if (reason.length < 10) return showMessage('اكتب سبب واضح لفك الإقفال (10 حروف على الأقل).');
  try{
    // بنكتب السبب الأول عشان التريجر يقراه وقت الحذف
    let r = await sb.from('period_locks').update({ unlock_reason: reason }).eq('id', id);
    if (r.error) throw r.error;
    r = await sb.from('period_locks').delete().eq('id', id);
    if (r.error) throw r.error;
    if (window.toast) toast('اتفك الإقفال — واتسجّل في سجل التدقيق');
    openPeriodLocks();
  }catch(e){ showMessage(e.message); }
};

/* ============================================================
   ٢) سجل التدقيق المالي
   ============================================================ */

const TBL_AR = { ledger:'الدفتر', expenses:'المصروفات',
                 transfers:'التحويلات', period_locks:'إقفال الفترات' };
const OP_AR  = { INSERT:'إضافة', UPDATE:'تعديل', DELETE:'حذف' };

window.openFinanceAudit = async function(){
  if (!guardAction('activity', 'view')) return;
  const uuid = bUuid();
  if (!uuid) return showMessage('العمارة مش متزامنة مع السحابة.');

  let rows = [];
  try{
    const { data, error } = await sb.from('finance_audit')
      .select('*').eq('building_id', uuid)
      .order('changed_at', { ascending:false }).limit(300);
    if (error) throw error;
    rows = data || [];
  }catch(e){ return showMessage(e.message); }

  openModal(`
    <h3>🧾 سجل التدقيق المالي</h3>
    <p class="small mtop">كل إضافة وتعديل وحذف في الدفتر والمصروفات والتحويلات.
      السجل <b>مايتعدّلش ومايتمسحش</b> — ولا حتى من رئيس الاتحاد.</p>

    <div class="table-wrap mtop2" style="max-height:54vh;overflow:auto">
      ${rows.length ? rows.map(r => {
        const d = new Date(r.changed_at);
        const isUnlock = r.table_name === 'period_locks' && r.op === 'DELETE';
        return `<div class="card mtop" style="padding:8px${
          isUnlock ? ';border:1px solid var(--red)' : ''}">
          <div class="flexrow" style="justify-content:space-between;gap:6px;flex-wrap:wrap">
            <b class="small">${isUnlock ? '⚠️ ' : ''}${esc2(OP_AR[r.op] || r.op)}
              — ${esc2(TBL_AR[r.table_name] || r.table_name)}</b>
            <span class="small" style="color:var(--muted)">
              ${d.toLocaleDateString('ar-EG')} ${d.toLocaleTimeString('ar-EG',
                { hour:'2-digit', minute:'2-digit' })}</span>
          </div>
          ${changesHTML(r)}
        </div>`;
      }).join('') : '<p class="small">السجل فاضي — مفيش حركات مالية اتسجّلت لسه.</p>'}
    </div>
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`, true);
};

function changesHTML(r){
  const ch = r.changes || {};
  const keys = Object.keys(ch);
  if (!keys.length){
    const sn = r.snapshot || {};
    const bits = ['amount','type','date','note','category']
      .filter(k => sn[k] != null)
      .map(k => `${k}: ${esc2(sn[k])}`);
    return bits.length
      ? `<p class="small mtop" style="color:var(--muted)">${bits.join(' · ')}</p>` : '';
  }
  return `<div class="small mtop">${keys.map(k => {
    const v = ch[k];
    if (v && typeof v === 'object' && ('قبل' in v))
      return `<div><b>${esc2(k)}</b>: <span style="color:var(--muted)">${
        esc2(v['قبل'])}</span> ← <b>${esc2(v['بعد'])}</b></div>`;
    return `<div><b>${esc2(k)}</b>: ${esc2(v)}</div>`;
  }).join('')}</div>`;
}

/* ============================================================
   ٣) تخصيص الدفعات على المستحقات
   ============================================================ */

window.openAllocate = function(paymentId){
  if (!guardAction('collections', 'edit')) return;
  const pay = (D.ledger || []).find(l => l.id === paymentId);
  if (!pay || pay.type !== 'دفعة') return showMessage('ده مش قيد دفعة.');

  const allocs = (D.ledgerAllocations || []);
  const usedOfPay = allocs.filter(a => a.paymentId === pay.id)
    .reduce((s, a) => s + Number(a.amount || 0), 0);
  const left = Number(pay.amount) - usedOfPay;

  // المستحقات المفتوحة لنفس الوحدة: الأقدم الأول
  const charges = (D.ledger || [])
    .filter(l => l.apartmentId === pay.apartmentId
              && ['شهري','مشروع'].includes(l.type) && !l.reversalOf)
    .map(c => {
      const paid = allocs.filter(a => a.chargeId === c.id)
        .reduce((s, a) => s + Number(a.amount || 0), 0);
      return { ...c, paid, remain: Number(c.amount) - paid };
    })
    .filter(c => c.remain > 0.004)
    .sort((a, b) => String(a.month || a.date).localeCompare(String(b.month || b.date)));

  const ap = (D.apartments || []).find(a => a.id === pay.apartmentId);

  openModal(`
    <h3>🔗 تخصيص الدفعة على المستحقات</h3>
    <p class="small mtop">${ap ? esc2(unitLabel(ap)) : ''} —
      دفعة ${money2(pay.amount)} بتاريخ ${esc2(pay.date)}</p>
    <p class="small">المتبقي من الدفعة للتخصيص: <b id="allocLeft">${money2(left)}</b></p>
    <p class="small" style="color:var(--muted)">من غير التخصيص، النظام بيعرف إن الساكن
      دفع لكن مش عارف <b>أنهي شهر</b> اتسدّد — فأعمار الديون وكشف الحساب بيطلعوا تقريبيين.</p>

    ${charges.length ? `
      <div class="flexrow mtop" style="gap:6px">
        <button class="btn sm ghost" onclick="allocAuto(${left})">⚡ وزّع على الأقدم تلقائيًا</button>
        <button class="btn sm ghost" onclick="allocClearInputs()">تفريغ</button>
      </div>
      <div class="table-wrap mtop" style="max-height:40vh;overflow:auto">
        <table style="width:100%;font-size:12.5px">
          <thead><tr><th style="text-align:start">المستحق</th><th>القيمة</th>
            <th>المسدّد</th><th>المتبقي</th><th>خصّص</th></tr></thead>
          <tbody>
            ${charges.map(c => `<tr>
              <td style="padding:4px">${esc2(c.type)} ${esc2(c.month || c.date)}</td>
              <td style="text-align:center">${money2(c.amount)}</td>
              <td style="text-align:center">${money2(c.paid)}</td>
              <td style="text-align:center"><b>${money2(c.remain)}</b></td>
              <td style="text-align:center">
                <input type="number" step="0.01" min="0" max="${c.remain}"
                  class="alloc-in" data-charge="${esc2(c.id)}" data-remain="${c.remain}"
                  style="width:90px" oninput="allocRecalc(${left})"></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="modal-actions">
        <button class="btn primary" onclick="saveAllocations('${esc2(pay.id)}',${left})">
          💾 احفظ التخصيص</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`
    : `<p class="small mtop"><b>مفيش مستحقات مفتوحة للوحدة دي.</b>
         يعني الدفعة زيادة على المطلوب — سيبها من غير تخصيص.</p>
       <div class="modal-actions">
         <button class="btn ghost" onclick="closeModal()">إغلاق</button>
       </div>`}`, true);
};

window.allocRecalc = function(left){
  let sum = 0;
  document.querySelectorAll('.alloc-in').forEach(el => {
    const max = Number(el.dataset.remain);
    if (Number(el.value) > max) el.value = max;
    sum += Number(el.value || 0);
  });
  const el = document.getElementById('allocLeft');
  const rest = left - sum;
  el.textContent = money2(rest);
  el.style.color = rest < -0.004 ? 'var(--red)' : '';
};

window.allocAuto = function(left){
  let rest = left;
  document.querySelectorAll('.alloc-in').forEach(el => {
    const take = Math.min(rest, Number(el.dataset.remain));
    el.value = take > 0.004 ? take.toFixed(2) : '';
    rest -= Math.max(0, take);
  });
  allocRecalc(left);
};

window.allocClearInputs = function(){
  document.querySelectorAll('.alloc-in').forEach(el => { el.value = ''; });
};

window.saveAllocations = function(paymentId, left){
  const rows = [...document.querySelectorAll('.alloc-in')]
    .map(el => ({ chargeId: el.dataset.charge, amount: Number(el.value || 0) }))
    .filter(r => r.amount > 0.004);
  if (!rows.length) return showMessage('اكتب مبلغ على مستحق واحد على الأقل.');

  const sum = rows.reduce((s, r) => s + r.amount, 0);
  if (sum > left + 0.004)
    return showMessage(`إجمالي التخصيص ${money2(sum)} أكبر من المتاح ${money2(left)}.`);

  D.ledgerAllocations = D.ledgerAllocations || [];
  rows.forEach(r => D.ledgerAllocations.push({
    id: uid(), paymentId, chargeId: r.chargeId, amount: r.amount,
  }));
  save();
  closeModal();
  if (window.toast) toast('اتخصّصت الدفعة');
  if (window.renderContent) renderContent();
};

/* عرض حالة التخصيص لقيد دفعة */
window.allocStatus = function(l){
  if (!l || l.type !== 'دفعة') return '';
  const used = (D.ledgerAllocations || [])
    .filter(a => a.paymentId === l.id)
    .reduce((s, a) => s + Number(a.amount || 0), 0);
  const left = Number(l.amount) - used;
  if (used <= 0.004) return '<span class="badge y">غير مخصّصة</span>';
  if (left > 0.004)  return `<span class="badge y">مخصّص جزئيًا (باقي ${money2(left)})</span>`;
  return '<span class="badge g">مخصّصة بالكامل</span>';
};
