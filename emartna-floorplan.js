/* ============================================================
   عمارتنا — توزيع الأدوار
   ------------------------------------------------------------
   المشكلة القديمة: البرنامج بيفترض إن كل الأدوار متشابهة
   (نفس عدد الشقق)، والدور الأرضي دايمًا فيه وحدات. والواقع
   مختلف: دور فيه ٥ ودور فيه ٧، وأرضي كله جراج، ومحلات في
   الدور الأول مش الأرضي.

   الأداة دي بتخلّي رئيس الاتحاد يحدد لكل دور: كام شقة وكام محل.
   ولو التعديل هيمسح وحدات، بيشوف بالظبط أنهي وحدات وعليها إيه
   قبل ما يوافق.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const ORD = ['الأرضي','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع',
               'الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر',
               'الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر',
               'التاسع عشر','العشرون'];
  const floorName = i => i === 0 ? 'الدور الأرضي' : 'الدور ' + (ORD[i] || ('رقم ' + i));

  /* التوزيع الحالي من الوحدات الفعلية */
  function currentPlan(){
    const D = window.D || {};
    const aps = D.apartments || [];
    const byFloor = {};
    aps.forEach(a => {
      const k = a.floor || floorName(0);
      byFloor[k] = byFloor[k] || { apts:0, shops:0, units:[] };
      if (a.type === 'shop') byFloor[k].shops++; else byFloor[k].apts++;
      byFloor[k].units.push(a);
    });

    const total = Math.max(Number(D.building?.floorsCount) || 0, Object.keys(byFloor).length);
    const plan = [];
    for (let i = 0; i <= total; i++){
      const name = floorName(i);
      const f = byFloor[name];
      if (!f && i > 0 && plan.length >= Object.keys(byFloor).length) break;
      plan.push({ i, name, apts: f ? f.apts : 0, shops: f ? f.shops : 0 });
    }
    return plan.length ? plan : [{ i:0, name:floorName(0), apts:0, shops:0 }];
  }

  /* ---------- الشاشة ---------- */

  window.openFloorPlan = function(){
    const plan = currentPlan();
    openModal(`
      <h3>🏗️ توزيع الأدوار</h3>
      <p class="small mtop">حدد لكل دور كام شقة وكام محل — زي العمارة على الطبيعة.
      الدور اللي مفيهوش وحدات (جراج أو مدخل) سيبه صفر.</p>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ghost" onclick="addPlanFloor()">+ دور جديد</button>
        <button class="btn sm ghost" onclick="fillPlanEqual()">توزيع متساوي</button>
        <span style="flex:1"></span>
        <span class="small" id="planTotal" style="color:var(--muted)"></span>
      </div>

      <div id="planRows" class="mtop" style="max-height:46vh;overflow:auto">
        ${plan.map(f => rowHTML(f)).join('')}
      </div>

      <div class="modal-actions">
        <button class="btn primary" onclick="previewFloorPlan()">💾 حفظ التوزيع</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
    updateTotal();
  };

  function rowHTML(f){
    return `
    <div class="plan-row flexrow" data-i="${f.i}"
         style="gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--line)">
      <span class="small" style="min-width:96px;font-weight:700">${esc2(f.name)}</span>
      <label class="small" style="color:var(--muted)">شقق</label>
      <input type="number" min="0" max="60" class="pl-apt" value="${f.apts}"
        oninput="updateTotal()" style="width:64px;text-align:center">
      <label class="small" style="color:var(--muted)">محلات</label>
      <input type="number" min="0" max="60" class="pl-shop" value="${f.shops}"
        oninput="updateTotal()" style="width:64px;text-align:center">
      <span style="flex:1"></span>
      <button class="btn sm ghost" onclick="this.closest('.plan-row').remove();updateTotal()"
        title="شيل الدور">✕</button>
    </div>`;
  }

  window.addPlanFloor = function(){
    const box = document.getElementById('planRows');
    if (!box) return;
    const i = box.querySelectorAll('.plan-row').length;
    box.insertAdjacentHTML('beforeend', rowHTML({ i, name:floorName(i), apts:0, shops:0 }));
    updateTotal();
  };

  window.fillPlanEqual = function(){
    const rows = [...document.querySelectorAll('.plan-row')];
    if (!rows.length) return;
    const n = Number(prompt('كام وحدة في كل دور؟', '4'));
    if (!n || n < 0) return;
    rows.forEach((r, idx) => {
      if (idx === 0) return;                 // الأرضي بيفضل زي ما هو
      r.querySelector('.pl-apt').value = n;
      r.querySelector('.pl-shop').value = 0;
    });
    updateTotal();
  };

  window.updateTotal = function(){
    const rows = [...document.querySelectorAll('.plan-row')];
    let a = 0, s = 0;
    rows.forEach(r => {
      a += Number(r.querySelector('.pl-apt').value) || 0;
      s += Number(r.querySelector('.pl-shop').value) || 0;
    });
    const el = document.getElementById('planTotal');
    const now = (window.D && D.apartments) ? D.apartments.length : 0;
    if (el) el.innerHTML = `الإجمالي: <b>${a + s}</b> وحدة (${a} شقة · ${s} محل)` +
      (a + s !== now ? ` <span style="color:var(--gold)">· حاليًا ${now}</span>` : '');
  };

  /* ---------- المعاينة قبل التنفيذ ---------- */

  window.previewFloorPlan = function(){
    const rows = [...document.querySelectorAll('.plan-row')];
    const plan = rows.map((r, i) => ({
      i, name: floorName(i),
      apts: Number(r.querySelector('.pl-apt').value) || 0,
      shops: Number(r.querySelector('.pl-shop').value) || 0,
    }));
    const need = plan.reduce((t,f) => t + f.apts + f.shops, 0);
    if (!need) return showMessage('لازم يكون في وحدة واحدة على الأقل');

    const aps = [...(D.apartments || [])].sort((a,b) => (a.number||0) - (b.number||0));
    const extra = aps.length - need;

    /* الوحدات اللي هتتشال — بنوري اللي عليها حركة */
    let doomed = [];
    if (extra > 0){
      doomed = aps.slice(need).map(a => {
        const moves = (D.ledger || []).filter(l => l.apartmentId === a.id).length;
        const bal = window.apBalance ? apBalance(a.id) : 0;
        return { a, moves, bal };
      });
    }
    const risky = doomed.filter(d => d.moves > 0 || d.bal !== 0);

    window.__pendingPlan = plan;

    openModal(`
      <h3>مراجعة التوزيع</h3>
      <div class="card mtop">
        <p class="small">الوحدات دلوقتي: <b>${aps.length}</b> · بعد التعديل: <b>${need}</b></p>
        ${extra > 0 ? `<p class="small" style="color:var(--red)">
            هيتشال <b>${extra}</b> وحدة</p>` : ''}
        ${extra < 0 ? `<p class="small" style="color:var(--accent)">
            هيتضاف <b>${-extra}</b> وحدة جديدة</p>` : ''}
        ${extra === 0 ? '<p class="small">العدد نفسه — التغيير في التوزيع بس</p>' : ''}
      </div>

      ${risky.length ? `
        <div class="card mtop" style="border:1.5px solid var(--red);background:#FFF6F5">
          <b style="color:var(--red)">⚠️ ${risky.length} وحدة عليها حركات مالية</b>
          <p class="small mtop">حذفها هيمسح حركاتها كمان. راجعها كويس:</p>
          <div class="mtop" style="max-height:24vh;overflow:auto">
            ${risky.map(d => `<div class="small" style="padding:3px 0;border-bottom:1px dashed var(--line)">
              <b>${esc2(window.unitLabel ? unitLabel(d.a) : ('وحدة ' + d.a.number))}</b>
              ${d.a.ownerName ? ' — ' + esc2(d.a.ownerName) : ''}
              · ${d.moves} حركة${d.bal ? ' · رصيد ' + (window.money ? money(d.bal) : d.bal) : ''}
            </div>`).join('')}
          </div>
        </div>` : ''}

      <div class="card mtop">
        <b class="small">التوزيع الجديد</b>
        <div class="mtop">
          ${plan.filter(f => f.apts + f.shops > 0).map(f =>
            `<div class="small" style="padding:2px 0">
              ${esc2(f.name)}: ${f.apts} شقة${f.shops ? ' · ' + f.shops + ' محل' : ''}</div>`).join('')}
          ${plan.some(f => f.apts + f.shops === 0)
            ? `<div class="small" style="color:var(--muted);margin-top:4px">
                 (${plan.filter(f => f.apts+f.shops===0).map(f => esc2(f.name)).join(' · ')}: من غير وحدات)</div>`
            : ''}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn ${risky.length ? 'red' : 'primary'}" onclick="applyFloorPlan()">
          ${risky.length ? '⚠️ نفّذ رغم التحذير' : '✅ نفّذ التوزيع'}</button>
        <button class="btn ghost" onclick="closeModal();openFloorPlan()">رجوع للتعديل</button>
      </div>`, true);
  };

  /* ---------- التنفيذ ---------- */

  window.applyFloorPlan = function(){
    const plan = window.__pendingPlan;
    if (!plan) return;

    const aps = [...(D.apartments || [])].sort((a,b) => (a.number||0) - (b.number||0));
    const need = plan.reduce((t,f) => t + f.apts + f.shops, 0);

    let idx = 0, n = 0;
    const kept = [];

    plan.forEach(f => {
      for (let k = 0; k < f.apts + f.shops; k++){
        const isShop = k < f.shops;         // المحلات الأول في كل دور
        n++;
        let a = aps[idx++];
        if (!a){
          a = { id: uid(), number: n, ownerName:'', tenantName:'', phone:'',
                phoneCountry:'+20', email:'', monthlyFee:0, openingBalance:0,
                closed:false, notes:'' };
        }
        a.number = n;
        a.floor  = f.name;
        a.type   = isShop ? 'shop' : 'apartment';
        kept.push(a);
      }
    });

    D.apartments = kept;

    /* نمسح حركات الوحدات اللي اتشالت */
    const ids = new Set(kept.map(a => a.id));
    ['ledger','maintenanceReports','paymentRequests'].forEach(c => {
      if (Array.isArray(D[c]))
        D[c] = D[c].filter(x => !x.apartmentId || ids.has(x.apartmentId));
    });
    (D.users || []).forEach(u => { if (u.apartmentId && !ids.has(u.apartmentId)) u.apartmentId = null; });

    /* نحدّث شكل العمارة */
    const floorsWithUnits = plan.filter(f => f.apts + f.shops > 0);
    D.building.floorsCount = Math.max(0, plan.length - 1);
    D.building.groundFloorCount = (plan[0] ? plan[0].apts + plan[0].shops : 0);
    D.building.groundShopsCount = plan[0] ? plan[0].shops : 0;
    D.building.apartmentsPerFloor = floorsWithUnits.length
      ? Math.round(need / floorsWithUnits.length) : 0;

    save();
    closeModal();
    if (window.toast) toast(`اتحفظ التوزيع — ${need} وحدة`);
    renderContent();
    if (window.syncBuildingShape) syncBuildingShape(true);
  };


  /* ============================================================
     توزيع الأدوار أثناء التسجيل
     ============================================================ */

  window.suToggleDetail = function(){
    const box = document.getElementById('suFloorDetail');
    if (!box) return;
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) suBuildFloorRows();
    suCalcUnits();
  };

  window.suBuildFloorRows = function(){
    const box = document.getElementById('suFloorRows');
    const n = Math.max(0, Number((document.getElementById('suFloors')||{}).value) || 0);
    const per = Math.max(0, Number((document.getElementById('suPerFloor')||{}).value) || 0);
    if (box){
      const old = {};
      box.querySelectorAll('.su-frow').forEach(r => {
        old[r.dataset.i] = {
          a: r.querySelector('.su-fa').value,
          s: r.querySelector('.su-fs').value,
        };
      });
      let html = '';
      for (let i = 1; i <= n; i++){
        const o = old[i] || {};
        html += `
        <div class="su-frow flexrow" data-i="${i}"
             style="gap:6px;align-items:center;padding:4px 0;border-bottom:1px dashed var(--line)">
          <span class="small" style="min-width:92px">${esc2(floorName(i))}</span>
          <span class="small" style="color:var(--muted)">شقق</span>
          <input type="number" min="0" class="su-fa" value="${o.a !== undefined ? o.a : per}"
            style="width:60px;text-align:center" oninput="suCalcUnits()">
          <span class="small" style="color:var(--muted)">محلات</span>
          <input type="number" min="0" class="su-fs" value="${o.s !== undefined ? o.s : 0}"
            style="width:60px;text-align:center" oninput="suCalcUnits()">
        </div>`;
      }
      box.innerHTML = html || '<p class="small">مفيش أدوار فوق الأرضي</p>';
    }
    suCalcUnits();
  };

  /* بيحسب الإجمالي وبيخزّن التوزيع للاستخدام وقت الإنشاء */
  window.suCalcUnits = function(){
    const g = id => Number((document.getElementById(id)||{}).value) || 0;
    const detail = document.getElementById('suFloorDetail');
    const detailed = detail && !detail.classList.contains('hidden');

    const plan = [{ i:0, name: floorName(0), apts: g('suGroundApts'), shops: g('suGroundShops') }];

    if (detailed){
      document.querySelectorAll('.su-frow').forEach(r => {
        plan.push({ i:Number(r.dataset.i), name: floorName(Number(r.dataset.i)),
          apts: Number(r.querySelector('.su-fa').value) || 0,
          shops: Number(r.querySelector('.su-fs').value) || 0 });
      });
    }else{
      const n = g('suFloors'), per = g('suPerFloor');
      for (let i = 1; i <= n; i++)
        plan.push({ i, name: floorName(i), apts: per, shops: 0 });
    }

    const total = plan.reduce((t,f) => t + f.apts + f.shops, 0);
    window.__suPlan = plan;

    const out = document.getElementById('suUnitsOut');
    if (out){
      const shops = plan.reduce((t,f) => t + f.shops, 0);
      out.innerHTML = `الإجمالي: <span style="color:var(--accent)">${total}</span> وحدة` +
        (shops ? ` <span class="small">(${total-shops} شقة · ${shops} محل)</span>` : '');
    }
    const cnt = document.getElementById('suCount');
    if (cnt) cnt.value = total;
    const gc = document.getElementById('suGroundCount');
    if (gc) gc.value = plan[0].apts + plan[0].shops;
    return total;
  };

  /* بعد إنشاء العمارة، بنطبّق التوزيع لو كان مخصّص */
  window.applySignupPlan = function(){
    const plan = window.__suPlan;
    if (!plan || !window.D) return;
    const same = plan.every((f,i) => i === 0 || f.shops === 0) &&
                 new Set(plan.slice(1).map(f => f.apts)).size <= 1;
    if (same) return;                 // التوزيع العادي — البرنامج عمله صح
    window.__pendingPlan = plan;
    try{ applyFloorPlan(); }catch(e){}
  };

  /* زرار في شاشة بيانات العمارة */
  const origPage = window.pageBuilding;
  if (typeof origPage === 'function' && !origPage.__plan){
    const wrapped = function(){
      const html = origPage.apply(this, arguments);
      const card = `
        <div class="card content-narrow" style="border:1px solid var(--accent)">
          <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <b>🏗️ توزيع الأدوار</b>
              <div class="small" style="color:var(--muted);margin-top:3px">
                حدد لكل دور كام شقة وكام محل — للعمارات اللي أدوارها مش متشابهة</div>
            </div>
            <button class="btn primary sm" onclick="openFloorPlan()">افتح التوزيع</button>
          </div>
        </div>`;
      return card + html;
    };
    wrapped.__plan = true;
    window.pageBuilding = wrapped;
  }

  console.log('[عمارتنا] توزيع الأدوار جاهز');
})();
