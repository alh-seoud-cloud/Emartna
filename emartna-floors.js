/* ============================================================
   عمارتنا — تقرير الأدوار
   ------------------------------------------------------------
   الشاشة دي بتجمّع وحدات العمارة حسب الدور، وتطلّع لكل دور:
   عدد الوحدات · المستحق · المحصّل · المتأخر · نسبة التحصيل.
   بتعتمد على دوال البرنامج الأساسية:
   apCharges · apPayments · apBalance · money · esc · unitLabel
   ============================================================ */

(function(){
  'use strict';

  /* ترتيب الأدوار: الأرضي الأول، وبعدين بالرقم */
  function floorRank(units){
    const nums = units.map(u => Number(u.number) || 0).filter(Boolean);
    return nums.length ? Math.min(...nums) : 9999;
  }

  function groupByFloor(){
    const map = new Map();
    (D.apartments || []).forEach(a => {
      const key = a.floor || 'بدون دور محدد';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return [...map.entries()]
      .map(([floor, units]) => {
        const charges  = units.reduce((s,a) => s + apCharges(a.id), 0);
        const payments = units.reduce((s,a) => s + apPayments(a.id), 0);
        const due      = units.reduce((s,a) => s + Math.max(0, apBalance(a.id)), 0);
        const advance  = units.reduce((s,a) => s + Math.max(0, -apBalance(a.id)), 0);
        const fees     = units.reduce((s,a) => s + (Number(a.monthlyFee) || 0), 0);
        return {
          floor, units,
          count:   units.length,
          shops:   units.filter(a => a.type === 'shop').length,
          flats:   units.filter(a => a.type !== 'shop').length,
          closed:  units.filter(a => a.closed).length,
          late:    units.filter(a => apBalance(a.id) > 0).length,
          fees, charges, payments, due, advance,
          rate: charges > 0 ? Math.round((payments / charges) * 100) : null,
          rank: floorRank(units),
        };
      })
      .sort((a,b) => a.rank - b.rank);
  }

  function rateBadge(r){
    if (r === null) return '<span class="badge n">لا يوجد مستحقات</span>';
    if (r >= 90) return `<span class="badge g">${r}%</span>`;
    if (r >= 60) return `<span class="badge y">${r}%</span>`;
    return `<span class="badge r">${r}%</span>`;
  }

  /* تفاصيل دور واحد — بتتفتح وتتقفل بالضغط */
  window.toggleFloorDetails = function(key){
    window.__openFloor = (window.__openFloor === key) ? null : key;
    renderContent();
  };

  function floorDetailsHTML(g){
    const rows = [...g.units].sort((a,b) => (Number(a.number)||0) - (Number(b.number)||0));
    return `<div class="card mtop">
      <h3>${esc(g.floor)} — تفاصيل الوحدات</h3>
      <div class="mtop" style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>الوحدة</th><th>المالك</th><th>الاشتراك الشهري</th>
          <th>المستحق</th><th>المحصّل</th><th>الرصيد</th><th>الحالة</th>
        </tr></thead>
        <tbody>${rows.map(a => {
          const bal = apBalance(a.id);
          const st  = a.closed ? '<span class="badge n">مغلقة</span>'
                    : bal > 0 ? '<span class="badge r">متأخر</span>'
                    : bal < 0 ? '<span class="badge b">دفع مقدم</span>'
                    : '<span class="badge g">منتظم</span>';
          return `<tr>
            <td><b>${unitLabel(a)}</b></td>
            <td>${esc(a.ownerName || '-')}</td>
            <td>${money(a.monthlyFee || 0)}</td>
            <td>${money(apCharges(a.id))}</td>
            <td>${money(apPayments(a.id))}</td>
            <td>${bal > 0 ? '<span style="color:var(--red,#c0392b)">' + money(bal) + '</span>'
                          : money(Math.abs(bal))}</td>
            <td>${st}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
  }

  window.pageFloorsReport = function(){
    if (typeof D === 'undefined' || !D || !D.apartments || !D.apartments.length)
      return '<p class="small">مفيش وحدات مسجّلة في العمارة لحد دلوقتي.</p>';

    const groups = groupByFloor();
    const tot = {
      units:    groups.reduce((s,g) => s + g.count, 0),
      charges:  groups.reduce((s,g) => s + g.charges, 0),
      payments: groups.reduce((s,g) => s + g.payments, 0),
      due:      groups.reduce((s,g) => s + g.due, 0),
      late:     groups.reduce((s,g) => s + g.late, 0),
    };
    const totRate = tot.charges > 0 ? Math.round((tot.payments / tot.charges) * 100) : null;

    const cols = [
      { key:'floor', label:'الدور', value:g => g.rank,
        cell:g => `<b>${esc(g.floor)}</b>` },
      { key:'count', label:'الوحدات', value:g => g.count,
        cell:g => `${g.count}<span class="small"> (${g.flats} شقة${g.shops ? ' · ' + g.shops + ' محل' : ''}${g.closed ? ' · ' + g.closed + ' مغلقة' : ''})</span>` },
      { key:'fees', label:'الاشتراكات الشهرية', value:g => g.fees, cell:g => money(g.fees) },
      { key:'charges', label:'إجمالي المستحق', value:g => g.charges, cell:g => money(g.charges) },
      { key:'payments', label:'إجمالي المحصّل', value:g => g.payments, cell:g => money(g.payments) },
      { key:'due', label:'المتأخر', value:g => g.due,
        cell:g => g.due > 0 ? `<span style="color:var(--red,#c0392b)"><b>${money(g.due)}</b></span>` : money(0) },
      { key:'late', label:'وحدات متأخرة', value:g => g.late,
        cell:g => g.late ? `<span class="badge r">${g.late}</span>` : '<span class="badge g">0</span>' },
      { key:'rate', label:'نسبة التحصيل', value:g => (g.rate === null ? -1 : g.rate), cell:g => rateBadge(g.rate) },
      { key:'x', label:'', value:null,
        cell:g => `<button class="btn sm ghost" onclick="toggleFloorDetails('${esc(g.floor).replace(/'/g,"\\'")}')">${window.__openFloor === g.floor ? '▲ إخفاء' : '▼ التفاصيل'}</button>` },
    ];

    const open = groups.find(g => g.floor === window.__openFloor);

    return `
    <p class="small">توزيع وحدات العمارة على الأدوار، وحالة التحصيل في كل دور. اضغط "التفاصيل" لأي دور تشوف وحداته واحدة واحدة.</p>

    <div class="grid g4 mtop">
      <div class="kpi"><div class="ic">🏢</div><div class="lbl">عدد الأدوار</div><div class="val">${groups.length}</div></div>
      <div class="kpi"><div class="ic">🚪</div><div class="lbl">إجمالي الوحدات</div><div class="val">${tot.units}</div></div>
      <div class="kpi ${tot.due > 0 ? 'owe' : 'ok'}"><div class="ic">⏳</div><div class="lbl">إجمالي المتأخر</div><div class="val">${money(tot.due)}</div></div>
      <div class="kpi ${totRate !== null && totRate >= 80 ? 'ok' : ''}"><div class="ic">📊</div><div class="lbl">نسبة التحصيل</div><div class="val">${totRate === null ? '-' : totRate + '%'}</div></div>
    </div>

    <div class="mtop">${sortableTable('floorsReportTable', groups, cols, null, {
      defaultKey: 'floor',
      emptyText: 'مفيش أدوار مسجّلة',
      exportName: 'تقرير الأدوار',
    })}</div>

    ${open ? floorDetailsHTML(open) : ''}`;
  };

  console.log('[عمارتنا] تقرير الأدوار جاهز');
})();
