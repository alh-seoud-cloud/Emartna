/* ============================================================
   عمارتنا — جدول كل العمارات: أعمدة ثابتة + مؤشرات استهداف
   ------------------------------------------------------------
   ١) تثبيت أول عمودين (اسم العمارة + الكود) أثناء التمرير
      الأفقي، مع إمكانية إلغاء التثبيت بضغطة.
   ٢) أعمدة جديدة تساعد صاحب البرنامج يستهدف كل عمارة:
      نسبة اكتمال البيانات · الأرقام المسجّلة · الدعوات ·
      الحسابات المفعّلة · الحركات ومتوسطها الشهري · آخر نشاط.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const PIN_KEY = 'emartna_pin_cols';

  const pinned = () => { try{ return localStorage.getItem(PIN_KEY) !== '0'; }catch(e){ return true; } };
  window.togglePinnedCols = function(){
    try{ localStorage.setItem(PIN_KEY, pinned() ? '0' : '1'); }catch(e){}
    if (window.renderSysContent) renderSysContent(); else renderContent();
  };

  /* ---------- ١) تثبيت الأعمدة ---------- */

  function tableRoomCss(){
    return `<style id="bldRoomCss">
      /* مساحة أوسع وصفوف أوضح لجدول العمارات */
      #sysBldTable_wrap .table-wrap, #supportBldTable_wrap .table-wrap{
        max-height:none; min-height:340px;
      }
      #sysBldTable_wrap .table-wrap td, #supportBldTable_wrap .table-wrap td{
        padding:11px 10px; font-size:13px;
      }
      #sysBldTable_wrap .table-wrap th, #supportBldTable_wrap .table-wrap th{
        padding:10px; font-size:12.5px;
      }
      #sysBldTable_wrap .table-wrap tbody tr:hover td,
      #supportBldTable_wrap .table-wrap tbody tr:hover td{ background:var(--hover,#F3F8F7); }
    </style>`;
  }

  function pinStyle(){
    if (!pinned()) return '';
    // الحاوية اللي بتتحرك أفقيًا اسمها .table-wrap جوه #<id>_wrap
    return `<style id="pinColsCss">
      /* أول عمودين بيفضلوا مكانهم أثناء التمرير الأفقي */
      #sysBldTable_wrap .table-wrap th:nth-child(1), #sysBldTable_wrap .table-wrap td:nth-child(1),
      #supportBldTable_wrap .table-wrap th:nth-child(1), #supportBldTable_wrap .table-wrap td:nth-child(1){
        position:sticky; inset-inline-start:0; z-index:3;
        background:var(--panel); box-shadow:3px 0 6px -3px rgba(0,0,0,.16);
      }
      #sysBldTable_wrap .table-wrap th:nth-child(2), #sysBldTable_wrap .table-wrap td:nth-child(2),
      #supportBldTable_wrap .table-wrap th:nth-child(2), #supportBldTable_wrap .table-wrap td:nth-child(2){
        position:sticky; inset-inline-start:var(--pin1,150px); z-index:2;
        background:var(--panel); box-shadow:3px 0 6px -3px rgba(0,0,0,.10);
      }
      #sysBldTable_wrap .table-wrap thead th, #supportBldTable_wrap .table-wrap thead th{
        position:sticky; top:0; z-index:4; background:var(--tablehead,#F4F1E8);
      }
      #sysBldTable_wrap .table-wrap thead th:nth-child(1),
      #supportBldTable_wrap .table-wrap thead th:nth-child(1){ z-index:6; }
      #sysBldTable_wrap .table-wrap thead th:nth-child(2),
      #supportBldTable_wrap .table-wrap thead th:nth-child(2){ z-index:5; }
    </style>`;
  }

  function pinBar(){
    const on = pinned();
    return `<div class="flexrow mtop" style="gap:8px;flex-wrap:wrap">
      <button class="btn sm ${on?'primary':'ghost'}" onclick="togglePinnedCols()">
        ${on ? '📌 العمودين مثبّتين' : '📍 تثبيت اسم العمارة والكود'}</button>
      <span class="small" style="color:var(--muted)">
        ${on ? 'اسم العمارة والكود بيفضلوا ظاهرين وإنت بتتحرك يمين وشمال'
             : 'الأعمدة كلها بتتحرك مع بعض'}</span>
    </div>`;
  }

  /* بنقيس عرض أول عمود عشان نظبط مكان التاني */
  function measurePins(){
    if (!pinned()) return;
    setTimeout(() => {
      ['sysBldTable','supportBldTable'].forEach(id => {
        const wrap = document.getElementById(id + '_wrap');
        if (!wrap) return;
        const th = wrap.querySelector('.table-wrap thead th:nth-child(1)');
        if (th) wrap.style.setProperty('--pin1', th.offsetWidth + 'px');
      });
    }, 60);
  }

  /* ---------- ٢) مؤشرات كل عمارة ---------- */

  function metrics(b){
    const d = (window.loadBuildingData && loadBuildingData(b.id)) || null;
    if (!d) return { loaded:false };
    const aps = d.apartments || [];
    const users = d.users || [];
    const open = aps.filter(a => !a.closed);
    const withPhone = aps.filter(a => a.phone).length;
    const withFee = open.filter(a => Number(a.monthlyFee) > 0).length;
    const invited = users.filter(u => u.apartmentId && u.inviteStatus === 'pending').length;
    const joined = users.filter(u => u.apartmentId && u.inviteStatus !== 'pending').length;
    const moves = (d.ledger || []).length + (d.expenses || []).length;

    const dates = (d.ledger || []).map(x => x.date).filter(Boolean).sort();
    const first = dates[0], last = dates[dates.length - 1];
    let months = 1;
    if (first && last){
      const a = new Date(first), z = new Date(last);
      months = Math.max(1, (z.getFullYear()-a.getFullYear())*12 + (z.getMonth()-a.getMonth()) + 1);
    }
    const lastAct = [last, ...(d.activityLog||[]).map(x => (x.date||'').slice(0,10))]
      .filter(Boolean).sort().pop() || '';
    const daysIdle = lastAct
      ? Math.round((Date.now() - new Date(lastAct).getTime()) / 86400000) : null;

    // نسبة اكتمال الإعداد — نفس منطق معالج البداية
    const setup = [
      !!(d.building && d.building.name && d.building.city),
      aps.length > 0,
      aps.length > 0 && withFee === open.length,
      (d.ledger || []).some(l => l.type === 'شهري'),
      (invited + joined) > 0,
    ].filter(Boolean).length;

    return { loaded:true, aps:aps.length, open:open.length, withPhone, withFee,
             invited, joined, moves, perMonth: Math.round(moves / months),
             lastAct, daysIdle, setup, users: users.length };
  }

  const EXTRA_COLS = [
    { key:'setupPct', label:'اكتمال الإعداد',
      value: m => m.loaded ? m.setup*20 : -1,
      cell: m => !m.loaded ? '<span class="small">—</span>' :
        `<span class="badge ${m.setup>=5?'g':m.setup>=3?'y':'r'}">${m.setup*20}%</span>` },

    { key:'withPhone', label:'وحدات بأرقام',
      value: m => m.loaded ? m.withPhone : -1,
      cell: m => !m.loaded ? '—' :
        `${m.withPhone} <span class="small" style="color:var(--muted)">من ${m.aps}</span>` },

    { key:'invited', label:'دعوات مستنية',
      value: m => m.loaded ? m.invited : -1,
      cell: m => !m.loaded ? '—' : (m.invited ? `<span class="badge y">${m.invited}</span>` : '0') },

    { key:'joined', label:'وحدات عندها حساب',
      value: m => m.loaded ? m.joined : -1,
      cell: m => !m.loaded ? '—' :
        `<span class="badge ${m.joined?'g':'n'}">${m.joined}</span>` },

    { key:'adoption', label:'نسبة انضمام السكان',
      value: m => m.loaded && m.aps ? Math.round(m.joined/m.aps*100) : -1,
      cell: m => (!m.loaded || !m.aps) ? '—' :
        `<span class="badge ${m.joined/m.aps>=.5?'g':m.joined?'y':'r'}">${Math.round(m.joined/m.aps*100)}%</span>` },

    { key:'moves', label:'الحركات المالية',
      value: m => m.loaded ? m.moves : -1,
      cell: m => m.loaded ? String(m.moves) : '—' },

    { key:'perMonth', label:'متوسط الحركات شهريًا',
      value: m => m.loaded ? m.perMonth : -1,
      cell: m => !m.loaded ? '—' :
        `<span class="badge ${m.perMonth>=20?'g':m.perMonth>=5?'y':'n'}">${m.perMonth}</span>` },

    { key:'lastAct', label:'آخر نشاط',
      value: m => m.lastAct || '',
      cell: m => !m.lastAct ? '<span class="small" style="color:var(--muted)">مفيش</span>' :
        `${esc2(m.lastAct)} <span class="badge ${m.daysIdle<=7?'g':m.daysIdle<=30?'y':'r'}">${m.daysIdle} يوم</span>` },

    { key:'health', label:'حالة الاستخدام',
      value: m => {
        if (!m.loaded) return 0;
        if (m.daysIdle !== null && m.daysIdle > 30) return 1;   // متوقفة
        if (m.setup < 3) return 2;                              // متعثّرة
        if (m.joined === 0) return 3;                           // بدون سكان
        if (m.perMonth >= 10) return 5;                         // نشطة
        return 4;
      },
      cell: m => {
        const v = !m.loaded ? 0 : (m.daysIdle !== null && m.daysIdle > 30) ? 1
                : m.setup < 3 ? 2 : m.joined === 0 ? 3 : m.perMonth >= 10 ? 5 : 4;
        return ['<span class="small">—</span>',
                '<span class="badge r">🔴 متوقفة</span>',
                '<span class="badge y">🟡 إعداد ناقص</span>',
                '<span class="badge y">🟠 بدون سكان</span>',
                '<span class="badge g">🟢 شغّالة</span>',
                '<span class="badge g">💚 نشطة جدًا</span>'][v];
      } },
  ];


  /* ---------- ٣) عمود الإجراءات: "فتح" + قائمة ⋮ ---------- */

  /* القائمة بتتنقل لطبقة فوق الصفحة كلها.
     لو فضلت جوه الجدول، الحاوية اللي بتتمرّر بتقصّها فمتبانش. */
  function closeRowMenus(){
    const layer = document.getElementById('rowMenuLayer');
    if (layer) layer.remove();
  }
  window.closeRowMenus = closeRowMenus;

  window.toggleRowMenu = function(id, ev){
    const src = document.getElementById(id);
    const already = document.getElementById('rowMenuLayer');
    closeRowMenus();
    if (already && already.dataset.src === id) return;      // نفس الزرار = قفل
    if (!src) return;

    const btn = (ev && ev.currentTarget) || document.activeElement ||
                src.parentElement.querySelector('button[title="خيارات أكتر"]');
    const r = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : { bottom:80, right:200, left:120 };

    const layer = document.createElement('div');
    layer.id = 'rowMenuLayer';
    layer.dataset.src = id;
    layer.style.cssText =
      'position:fixed;z-index:99000;min-width:210px;background:var(--panel);' +
      'border:1px solid var(--line);border-radius:12px;padding:6px;' +
      'box-shadow:0 14px 34px rgba(0,0,0,.20);direction:rtl;text-align:start';
    layer.innerHTML = src.innerHTML;

    document.body.appendChild(layer);
    // بنحطها تحت الزرار، ولو مفيش مكان تحت بنطلّعها فوقه
    const h = layer.offsetHeight || 180, w = layer.offsetWidth || 210;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    let left = r.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    layer.style.top = top + 'px';
    layer.style.left = left + 'px';
  };

  document.addEventListener('click', e => {
    if (e.target.closest && (e.target.closest('#rowMenuLayer') || e.target.closest('.row-menu-wrap'))) return;
    closeRowMenus();
  });
  window.addEventListener('scroll', closeRowMenus, true);
  window.addEventListener('resize', closeRowMenus);

  /* بناخد أزرار العمود الأصلي ونعيد ترتيبها */
  function compactActions(html, rowId){
    const btns = String(html).match(/<button[\s\S]*?<\/button>/g) || [];
    if (btns.length <= 1) return html;

    const label = b => b.replace(/<[^>]*>/g,'').trim();
    const openIdx = btns.findIndex(b => /فتح/.test(label(b)));
    const primary = openIdx >= 0 ? btns[openIdx] : btns[0];
    const rest = btns.filter((_,i) => i !== (openIdx >= 0 ? openIdx : 0));
    if (!rest.length) return html;

    const mid = 'rm_' + String(rowId).replace(/[^\w]/g,'') + '_' + Math.random().toString(36).slice(2,6);
    const items = rest.map(b => {
      const onclick = (b.match(/onclick="([^"]*)"/) || [])[1] || '';
      const isRed = /class="[^"]*\bred\b/.test(b);
      let txt = label(b);
      const title = (b.match(/title="([^"]*)"/) || [])[1];
      if (txt.length <= 2 && title) txt = title;      // زرار بأيقونة بس
      if (/^🔑/.test(txt) && txt.length <= 3) txt = '🔑 إعادة تعيين كلمة السر';
      return `<button class="btn ghost" style="display:block;width:100%;text-align:start;border:0;
                padding:8px 10px;margin:0;${isRed?'color:var(--red)':''}"
                onclick="closeRowMenus();${onclick.replace(/"/g,'&quot;')}">${txt}</button>`;
    }).join('');

    return `<div class="flexrow row-menu-wrap" style="gap:4px;position:relative;justify-content:flex-start">
      ${primary}
      <button class="btn sm ghost" style="padding:4px 9px;font-size:16px;line-height:1"
        title="خيارات أكتر" onclick="toggleRowMenu('${mid}', event)">⋮</button>
      <div id="${mid}" class="row-menu" style="display:none;position:absolute;z-index:70;
           top:calc(100% + 5px);inset-inline-end:0;min-width:190px;background:var(--panel);
           border:1px solid var(--line);border-radius:11px;box-shadow:0 10px 28px rgba(0,0,0,.16);
           padding:5px;text-align:start">${items}</div>
    </div>`;
  }

  /* بنحقن الأعمدة في نداء sortableTable لجدول العمارات */
  const origSortable = window.sortableTable;
  if (origSortable) window.sortableTable = function(id, rows, cols, groupBy, opts){
    if ((id === 'sysBldTable' || id === 'supportBldTable') && Array.isArray(rows) && Array.isArray(cols)){
      const cache = new Map();
      const M = b => { if (!cache.has(b.id)) cache.set(b.id, metrics(b)); return cache.get(b.id); };
      const extra = EXTRA_COLS.map(c => ({
        key: c.key, label: c.label,
        value: b => c.value(M(b)),
        cell:  b => c.cell(M(b)),
      }));
      let last = cols[cols.length-1] && !cols[cols.length-1].value ? cols.pop() : null;
      cols = cols.concat(extra);
      if (last){
        const origCell = last.cell;
        cols.push(Object.assign({}, last, {
          label: last.label || 'إجراءات',
          cell: b => compactActions(origCell ? origCell(b) : '', b.id || b.code || 'x'),
        }));
      }
      measurePins();
    }
    return origSortable.call(this, id, rows, cols, groupBy, opts);
  };

  /* شريط التثبيت في الشاشتين */
  ['pageSysDashboard','pageSupportBuildingsView'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(){
      const html = orig.apply(this, arguments);
      measurePins();
      return tableRoomCss() + pinStyle() + pinBar() + html;
    };
  });

  console.log('[عمارتنا] أعمدة العمارات الثابتة والمؤشرات جاهزة');
})();
