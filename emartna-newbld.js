/* ============================================================
   عمارتنا — إنشاء العمارة على الخادم
   ------------------------------------------------------------
   ⚠️ العطل اللي بيصلحه ده: العمارة اللي بينشئها صاحب البرنامج
   من لوحته كانت بتتحفظ في ذاكرة المتصفح بس ومبتوصلش الخادم —
   فتختفي أول ما يمسح الكاش، والعميل يدخل ويلاقي "مفيش عمارة".

   دالة create_building موجودة على الخادم من الأول، بس محدش
   كان بينديها من المسار ده.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));

  /* بننده الدالة الحقيقية على الخادم وبنرجّع الكود */
  window.createBuildingOnServer = async function(o){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) throw new Error('مفيش اتصال بالخادم');

    const { data, error } = await sb.rpc('create_building', {
      p_name:             o.name || '',
      p_apartments_count: Number(o.apartmentsCount) || 12,
      p_per_floor:        Number(o.perFloor) || 4,
      p_ground_count:     (o.groundFloorCount === 0 || o.groundFloorCount)
                            ? Number(o.groundFloorCount) : 4,
      p_ground_shops:     Number(o.groundShopsCount) || 0,
      p_address:          o.address || '',
      p_location_url:     o.locationUrl || '',
      p_city:             o.city || '',
      p_country:          o.country || 'مصر',
      p_governorate:      o.governorate || '',
      p_community_type:   o.communityType || 'single',
      p_admin_name:       o.adminName || '',
      p_phone_country:    o.phoneCountry || '+20',
      p_phone:            o.phone || '',
      p_trial_days:       Number(o.trialDays) || 60,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return { code: row.out_code || row.code, uuid: row.out_building_id || row.building_id };
  };

  /* ---------- ربط حساب موجود بعمارة ---------- */

  window.linkAdminToBuilding = async function(phone, code){
    const sb = window.CLOUD && window.CLOUD._sb;
    if (!sb) throw new Error('مفيش اتصال');
    const { error } = await sb.rpc('link_admin_to_building',
      { p_phone: phone, p_building_code: code });
    if (error) throw error;
  };

  /* ---------- الحسابات المعلّقة ---------- */

  window.__orphans = null;

  window.loadOrphans = async function(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb || !(window.isSysOwner && isSysOwner())) return;
      const { data, error } = await sb.rpc('orphan_accounts');
      if (error) throw error;
      window.__orphans = data || [];
      if (window.renderSysContent) renderSysContent();
    }catch(e){ window.__orphans = []; }
  };

  window.openOrphanFix = function(phone, name){
    const list = ((window.REG && REG.buildings) || [])
      .filter(b => !b.isDemo)
      .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    openModal(`
      <h3>🔗 ربط ${esc2(name || phone)} بعمارة</h3>
      <p class="small mtop">الحساب ده سجّل بس مالوش عمارة. اربطه بعمارة موجودة،
      أو اعمله عمارة جديدة من "إنشاء عمارة جديدة".</p>
      <div class="field2 mtop2"><label>العمارة</label>
        <select id="orphBld">
          ${list.map(b => `<option value="${esc2(b.code)}">${esc2(b.name)} — ${esc2(b.code)}</option>`).join('')}
        </select></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="doLinkOrphan('${esc2(phone)}')">🔗 اربطه</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.doLinkOrphan = async function(phone){
    const code = (document.getElementById('orphBld') || {}).value;
    if (!code) return showMessage('اختار عمارة');
    try{
      await linkAdminToBuilding(phone, code);
      closeModal();
      if (window.toast) toast('اتربط — يقدر يدخل بكلمة سره العادية');
      await loadOrphans();
    }catch(e){
      showMessage('تعذّر الربط: ' + (window.cloudErrorText ? cloudErrorText(e) : e.message));
    }
  };

  /* تنبيه في لوحة صاحب البرنامج */
  const origDash = window.pageSysDashboard;
  if (typeof origDash === 'function' && !origDash.__orph){
    const wrapped = function(){
      const html = origDash.apply(this, arguments);
      const rows = window.__orphans;
      if (rows === null){ setTimeout(loadOrphans, 60); return html; }
      if (!rows.length) return html;

      const card = `
        <div class="card" style="border:1.5px solid var(--gold);
             background:linear-gradient(135deg,rgba(216,163,59,.10),transparent)">
          <b style="color:var(--gold)">⚠️ ${rows.length} حساب سجّل ومالوش عمارة</b>
          <p class="small mtop">دول عملاء وقفوا في نص التسجيل — بيدخلوا ويلاقوا الشاشة فاضية.</p>
          <div class="mtop">
            ${rows.map(r => `
              <div class="flexrow" style="padding:6px 0;border-bottom:1px dashed var(--line);
                   justify-content:space-between;gap:8px;flex-wrap:wrap">
                <div>
                  <b>${esc2(r.full_name || '؟')}</b>
                  <span class="small" dir="ltr"> · ${esc2(r.phone || '')}</span>
                  <div class="small" style="color:var(--muted)">
                    سجّل ${esc2(String(r.created_at || '').slice(0,10))}</div>
                </div>
                <div class="flexrow" style="gap:6px">
                  <a class="btn sm gold" target="_blank"
                     href="https://wa.me/${esc2(String(r.phone||'').replace(/[^\d]/g,''))}">💬</a>
                  <button class="btn sm primary"
                    onclick="openOrphanFix('${esc2(r.phone||'')}','${esc2(r.full_name||'')}')">
                    🔗 اربطه بعمارة</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
      return card + html;
    };
    wrapped.__orph = true;
    window.pageSysDashboard = wrapped;
  }

  console.log('[عمارتنا] إنشاء العمارة على الخادم جاهز');
})();
