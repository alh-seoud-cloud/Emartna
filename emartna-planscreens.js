/* ============================================================
   عمارتنا — شاشات الاشتراك
   ------------------------------------------------------------
   مسؤول المنصة بيحدد الشاشات المتاحة في كل باقة، وممكن يعمل
   استثناء لعمارة بعينها (يفتح شاشة زيادة أو يقفل واحدة).

   البوابة دي بتيجي **قبل** صلاحيات المستخدم في القاعدة:
   شاشة برّه الاشتراك مقفولة للكل — حتى رئيس الاتحاد.
   ============================================================ */

const ready = (t) => new Promise(r => {
  const i = setInterval(() => { if (t()) { clearInterval(i); r(); } }, 120);
  setTimeout(() => { clearInterval(i); r(); }, 20000);
});
await ready(() => window.CLOUD && window.CLOUD._sb);
const sb = window.CLOUD._sb;
const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

const GROUP_AR = {
  home:'🏠 الرئيسية', building:'🏢 العمارة والملاك', finance:'💰 الماليات',
  engage:'💬 التواصل', settings:'⚙️ الإعدادات', reports:'📊 التقارير',
  profile:'👤 الملف الشخصي',
};

let REG = [], PLANS = [];

async function loadRef(){
  const [r, p] = await Promise.all([
    sb.from('screen_registry').select('*').order('sort_order'),
    sb.from('plans').select('key,name,screens,active').order('sort_order'),
  ]);
  if (r.error) throw r.error;
  if (p.error) throw p.error;
  REG = r.data || [];
  PLANS = p.data || [];
}

function groupedRows(scope, checked, cls){
  const byGroup = {};
  REG.filter(s => s.scope === scope).forEach(s => {
    (byGroup[s.group_key] = byGroup[s.group_key] || []).push(s);
  });
  return Object.entries(byGroup).map(([g, items]) => `
    <div class="mtop">
      <b class="small">${esc2(GROUP_AR[g] || g)}</b>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:2px">
        ${items.map(s => `
          <label style="display:flex;gap:7px;align-items:center;padding:3px 0">
            <input type="checkbox" class="${cls}" data-k="${esc2(s.screen_key)}"
              ${checked(s.screen_key) ? 'checked' : ''}>
            <span class="small">${esc2(s.label || s.screen_key)}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');
}

/* ---------- شاشات الباقة ---------- */

window.openPlanScreens = async function(planKey){
  try{ await loadRef(); }catch(e){ return showMessage(e.message); }

  const plan = PLANS.find(p => p.key === planKey) || PLANS[0];
  if (!plan) return showMessage('مفيش باقات.');
  const list = plan.screens || null;
  const on = k => !list || list.includes(k);

  openModal(`
    <h3>🎚️ شاشات الاشتراك</h3>

    <div class="field2 mtop"><label>الباقة</label>
      <select onchange="openPlanScreens(this.value)">
        ${PLANS.map(p => `<option value="${esc2(p.key)}" ${p.key === plan.key ? 'selected' : ''}>
          ${esc2(p.name)}${p.active === false ? ' (موقوفة)' : ''}</option>`).join('')}
      </select></div>

    <p class="small" style="color:var(--muted)">
      ${list ? 'الباقة دي مقيّدة بـ' + list.length + ' شاشة.'
             : 'الباقة دي مفتوحة على كل الشاشات (الوضع الافتراضي).'}
      الشاشة اللي برّه الباقة بتختفي من العمارة — <b>حتى عن رئيس الاتحاد</b>.</p>

    <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
      <button class="btn sm ghost" onclick="planScreensAll(true)">افتح الكل</button>
      <button class="btn sm ghost" onclick="planScreensAll(false)">اقفل الكل</button>
      <button class="btn sm ghost" onclick="savePlanScreens('${esc2(plan.key)}',true)">
        إلغاء التقييد (الكل متاح)</button>
    </div>

    <div class="table-wrap mtop" style="max-height:46vh;overflow:auto;padding:8px">
      <b>🖥️ شاشات الإدارة</b>
      ${groupedRows('admin', on, 'ps-chk')}
      <hr class="mtop">
      <b>🏠 شاشات السكان</b>
      ${groupedRows('owner', on, 'ps-chk')}
    </div>

    <div class="modal-actions">
      <button class="btn primary" onclick="savePlanScreens('${esc2(plan.key)}')">💾 حفظ</button>
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`, true);
};

window.planScreensAll = function(v){
  document.querySelectorAll('.ps-chk').forEach(el => { el.checked = v; });
};

window.savePlanScreens = async function(planKey, clear){
  const screens = clear ? null
    : [...document.querySelectorAll('.ps-chk')].filter(e => e.checked).map(e => e.dataset.k);
  if (!clear && !screens.length)
    return showMessage('لازم شاشة واحدة على الأقل — أو استخدم "إلغاء التقييد".');
  try{
    const { error } = await sb.from('plans').update({ screens }).eq('key', planKey);
    if (error) throw error;
    if (window.toast) toast('اتحفظت شاشات الباقة');
    openPlanScreens(planKey);
  }catch(e){ showMessage(e.message); }
};

/* ---------- استثناءات عمارة ---------- */

window.openBuildingScreens = async function(buildingUuid, buildingName){
  try{ await loadRef(); }catch(e){ return showMessage(e.message); }

  let b;
  try{
    const { data, error } = await sb.from('buildings')
      .select('id,name,plan_key,screens_add,screens_remove').eq('id', buildingUuid).single();
    if (error) throw error;
    b = data;
  }catch(e){ return showMessage(e.message); }

  const plan = PLANS.find(p => p.key === b.plan_key);
  const planList = plan ? plan.screens : null;
  const add = b.screens_add || [], rem = b.screens_remove || [];
  const enabled = k => rem.includes(k) ? false
                     : add.includes(k) ? true
                     : (!planList || planList.includes(k));

  openModal(`
    <h3>🏢 شاشات ${esc2(b.name || buildingName || '')}</h3>
    <p class="small mtop">الباقة: <b>${esc2(plan ? plan.name : '— بدون باقة —')}</b>
      ${planList ? `(${planList.length} شاشة)` : '(كل الشاشات)'}.
      أي تعديل هنا <b>استثناء خاص بالعمارة دي</b> فوق باقتها.</p>

    <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
      <button class="btn sm ghost" onclick="bsReset()">رجّع لباقتها</button>
    </div>

    <div class="table-wrap mtop" style="max-height:48vh;overflow:auto;padding:8px">
      <b>🖥️ شاشات الإدارة</b>
      ${groupedRows('admin', enabled, 'bs-chk')}
      <hr class="mtop">
      <b>🏠 شاشات السكان</b>
      ${groupedRows('owner', enabled, 'bs-chk')}
    </div>

    <div class="modal-actions">
      <button class="btn primary" onclick="saveBuildingScreens('${esc2(b.id)}')">💾 حفظ</button>
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`, true);

  window.__bsPlanList = planList;
};

window.bsReset = function(){
  const list = window.__bsPlanList;
  document.querySelectorAll('.bs-chk').forEach(el => {
    el.checked = !list || list.includes(el.dataset.k);
  });
};

window.saveBuildingScreens = async function(buildingUuid){
  const list = window.__bsPlanList;
  const add = [], rem = [];
  document.querySelectorAll('.bs-chk').forEach(el => {
    const k = el.dataset.k;
    const inPlan = !list || list.includes(k);
    if (el.checked && !inPlan) add.push(k);
    if (!el.checked && inPlan) rem.push(k);
  });
  try{
    const { error } = await sb.from('buildings').update({
      screens_add:    add.length ? add : null,
      screens_remove: rem.length ? rem : null,
    }).eq('id', buildingUuid);
    if (error) throw error;
    closeModal();
    showMessage(add.length || rem.length
      ? `اتحفظ: ${add.length} شاشة زيادة و${rem.length} شاشة متشالة.`
      : 'العمارة رجعت لباقتها بالظبط — من غير استثناءات.');
  }catch(e){ showMessage(e.message); }
};
