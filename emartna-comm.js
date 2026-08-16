/* ============================================================
   عمارتنا — عرض موحّد لشاشات التواصل مع الملاك
   ------------------------------------------------------------
   الإعلانات · الاستطلاعات · المقترحات · الاجتماعات
   لكل شاشة:
     • تبديل بين "📋 قائمة" و"🔲 مربعات"
     • فلاتر حسب الحالة (مفتوح · مقفول · تم الحل · منتهي …)
   العرض بالمربعات هو الشكل القديم زي ما هو — الجديد هو
   الجدول والفلاتر.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const V = {};                       // وضع العرض لكل شاشة
  const F = {};                       // الفلتر المختار لكل شاشة

  window.setCommView = function(key, mode){ V[key] = mode; renderContent(); };
  window.setCommFilter = function(key, val){ F[key] = val; renderContent(); };

  function toolbar(key, filters, counts){
    const mode = V[key] || 'cards';
    return `
    <div class="flexrow mtop" style="flex-wrap:wrap;gap:8px;align-items:center">
      <span style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden">
        <button class="btn sm ${mode==='table'?'primary':'ghost'}" style="border-radius:0"
          onclick="setCommView('${key}','table')">📋 قائمة</button>
        <button class="btn sm ${mode==='cards'?'primary':'ghost'}" style="border-radius:0"
          onclick="setCommView('${key}','cards')">🔲 مربعات</button>
      </span>
      <span style="flex:1"></span>
      ${filters.map(f => `
        <button class="btn sm ${(F[key]||filters[0].k)===f.k?'primary':'ghost'}"
          onclick="setCommFilter('${key}','${f.k}')">${f.label} (${counts[f.k] ?? 0})</button>`).join('')}
    </div>`;
  }

  const apply = (key, filters, items) => {
    const k = F[key] || filters[0].k;
    const f = filters.find(x => x.k === k) || filters[0];
    return f.test ? items.filter(f.test) : items;
  };
  const countAll = (filters, items) => {
    const c = {};
    filters.forEach(f => c[f.k] = f.test ? items.filter(f.test).length : items.length);
    return c;
  };

  /* ---------- ١) الإعلانات ---------- */

  const origAnn = window.pageAnnouncements;
  if (origAnn) window.pageAnnouncements = function(u){
    const isAdmin = u.role === 'admin';
    const items = [...(D.announcements || [])]
      .sort((x,y) => (y.date||'').localeCompare(x.date||''));
    const today = window.todayISO ? todayISO() : new Date().toISOString().slice(0,10);
    const monthAgo = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);

    const filters = [
      { k:'all',    label:'الكل' },
      { k:'recent', label:'آخر شهر', test:a => (a.date||'') >= monthAgo },
      { k:'old',    label:'أقدم',    test:a => (a.date||'') <  monthAgo },
      { k:'commented', label:'عليها تعليقات', test:a => (a.comments||[]).length > 0 },
    ];
    const counts = countAll(filters, items);
    const shown  = apply('ann', filters, items);

    const head = `${isAdmin?`<div class="flexrow"><button class="btn primary" onclick="openAnnModal()">+ إعلان جديد</button></div>`:''}
      ${toolbar('ann', filters, counts)}`;

    if ((V.ann || 'cards') === 'cards')
      return head + `<div class="grid g2 mtop">${shown.length
        ? shown.map(a => announcementCardHTML(a, u, isAdmin)).join('')
        : '<p class="small">لا توجد إعلانات مطابقة</p>'}</div>`;

    const cols = [
      { key:'date',  label:'التاريخ', value:a => a.date||'', cell:a => esc2(a.date||'-') },
      { key:'title', label:'العنوان', value:a => a.title||'', cell:a => `<b>${esc2(a.title||'')}</b>` },
      { key:'body',  label:'النص',    value:a => a.body||'',
        cell:a => `<span class="small">${esc2((a.body||'').slice(0,90))}${(a.body||'').length>90?'…':''}</span>` },
      { key:'comments', label:'تعليقات', value:a => (a.comments||[]).length,
        cell:a => (a.comments||[]).length ? `<span class="badge b">${(a.comments||[]).length}</span>` : '-' },
      { key:'x', label:'', value:null, cell:a => isAdmin
        ? `<div class="flexrow"><button class="btn sm" onclick="openAnnModal('${a.id}')">تعديل</button>
           <button class="btn sm red" onclick="deleteAnn('${a.id}')">حذف</button></div>` : '' },
    ];
    return head + `<div class="mtop">${sortableTable('annTable', shown, cols, null,
      { defaultKey:'date', emptyText:'لا توجد إعلانات مطابقة', exportName:'الإعلانات' })}</div>`;
  };

  /* ---------- ٢) الاجتماعات ---------- */

  const origMeet = window.pageMeetings;
  if (origMeet) window.pageMeetings = function(u){
    const items = [...(D.meetings || [])]
      .sort((a,b) => ((b.date||'')+(b.time||'')).localeCompare((a.date||'')+(a.time||'')));
    const filters = [
      { k:'upcoming', label:'قادمة',  test:m => m.status === 'scheduled' },
      { k:'done',     label:'منتهية', test:m => m.status === 'done' },
      { k:'cancelled',label:'ملغاة',  test:m => m.status === 'cancelled' },
      { k:'all',      label:'الكل' },
    ];
    const counts = countAll(filters, items);
    const shown  = apply('meet', filters, items);

    if ((V.meet || 'cards') === 'cards'){
      const html = origMeet.apply(this, arguments);
      return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/, '$1' + toolbar('meet', filters, counts));
    }

    const isAdmin = u.role === 'admin';
    const stLabel = m => m.status === 'scheduled' ? '<span class="badge b">📅 قادم</span>'
                     : m.status === 'cancelled' ? '<span class="badge r">ملغي</span>'
                     : '<span class="badge g">✅ منتهي</span>';
    const cols = [
      { key:'date',  label:'التاريخ', value:m => (m.date||'')+(m.time||''), cell:m => esc2((m.date||'-')+' '+(m.time||'')) },
      { key:'title', label:'الموضوع', value:m => m.title||'', cell:m => `<b>${esc2(m.title||'')}</b>` },
      { key:'place', label:'المكان',  value:m => m.location||'', cell:m => esc2(m.location||'-') },
      { key:'status',label:'الحالة',  value:m => m.status||'', cell:stLabel },
      { key:'out',   label:'النتائج', value:m => m.outcomes||'',
        cell:m => m.outcomes ? `<span class="small">${esc2(m.outcomes.slice(0,70))}</span>` : '-' },
      { key:'x', label:'', value:null, cell:m => isAdmin
        ? `<button class="btn sm" onclick="openMeetingModal('${m.id}')">تعديل</button>` : '' },
    ];
    return `${isAdmin?`<div class="flexrow"><button class="btn primary" onclick="openMeetingModal()">+ تحديد اجتماع جديد</button></div>`:''}
      ${toolbar('meet', filters, counts)}
      <div class="mtop">${sortableTable('meetTable', shown, cols, null,
        { defaultKey:'date', emptyText:'لا توجد اجتماعات مطابقة', exportName:'الاجتماعات' })}</div>`;
  };

  /* ---------- ٣) الاستطلاعات ---------- */

  const origPolls = window.pagePolls;
  if (origPolls) window.pagePolls = function(u){
    const items = [...(D.polls || [])]
      .sort((x,y) => (y.createdAt||'').localeCompare(x.createdAt||''));
    const filters = [
      { k:'open',   label:'مفتوحة', test:p => p.status === 'open' },
      { k:'closed', label:'مقفولة', test:p => p.status === 'closed' },
      { k:'all',    label:'الكل' },
    ];
    const counts = countAll(filters, items);
    const shown  = apply('poll', filters, items);

    if ((V.poll || 'cards') === 'cards'){
      window.__pollFilter = (F.poll === 'all' || !F.poll) ? (F.poll || 'open') : F.poll;
      const html = origPolls.apply(this, arguments);
      return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/, '$1' + toolbar('poll', filters, counts));
    }

    const isAdmin = u.role === 'admin';
    const votesOf = p => Object.keys(p.votes || {}).length;
    const cols = [
      { key:'title', label:'الاستطلاع', value:p => p.title||'', cell:p => `<b>${esc2(p.title||'')}</b>` },
      { key:'status',label:'الحالة', value:p => p.status||'',
        cell:p => p.status==='open' ? '<span class="badge g">🟢 مفتوح</span>' : '<span class="badge n">🔒 مقفول</span>' },
      { key:'votes', label:'الأصوات', value:votesOf, cell:p => String(votesOf(p)) },
      { key:'top',   label:'الأكثر تصويتًا', value:p => '',
        cell:p => { const c={}; Object.values(p.votes||{}).forEach(v => c[v]=(c[v]||0)+1);
          const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
          return top ? `${esc2(top[0])} <span class="small">(${top[1]})</span>` : '-'; } },
      { key:'x', label:'', value:null, cell:p => isAdmin
        ? `<button class="btn sm" onclick="openPollModal(null,null,null,'${p.id}')">تعديل</button>` : '' },
    ];
    return `${isAdmin?`<div class="flexrow"><button class="btn primary" onclick="openPollModal()">+ استطلاع جديد</button></div>`:''}
      ${toolbar('poll', filters, counts)}
      <div class="mtop">${sortableTable('pollTable', shown, cols, null,
        { defaultKey:'title', emptyText:'لا توجد استطلاعات مطابقة', exportName:'الاستطلاعات' })}</div>`;
  };

  /* ---------- ٤) المقترحات (فيها جدول بالفعل — بنضيف المربعات) ---------- */

  const origSug = window.pageSuggestions;
  if (origSug) window.pageSuggestions = function(u){
    const items = [...(D.suggestions || [])]
      .sort((x,y) => (y.date||'').localeCompare(x.date||''));
    const filters = [
      { k:'pending',  label:'تحت المراجعة', test:s => (s.status||'pending') === 'pending' },
      { k:'accepted', label:'تم الحل',      test:s => s.status === 'accepted' },
      { k:'rejected', label:'مرفوضة',       test:s => s.status === 'rejected' },
      { k:'all',      label:'الكل' },
    ];
    const counts = countAll(filters, items);

    if ((V.sug || 'table') === 'table'){
      const html = origSug.apply(this, arguments);
      return html.replace(/(<div class="flexrow">[\s\S]*?<\/div>)/, '$1' + toolbar('sug', filters, counts));
    }

    const shown = apply('sug', filters, items);
    const badge = s => s.status === 'accepted' ? '<span class="badge g">✅ تم الحل</span>'
                    : s.status === 'rejected' ? '<span class="badge r">❌ مرفوض</span>'
                    : '<span class="badge y">⏳ تحت المراجعة</span>';
    return `${toolbar('sug', filters, counts)}
      <div class="grid g2 mtop">${shown.length ? shown.map(s => `
        <div class="card">
          <div class="flexrow" style="justify-content:space-between">
            <b>${esc2(s.title||'')}</b>${badge(s)}
          </div>
          <p class="small mtop">${esc2(s.text||'')}</p>
          <p class="small" style="color:var(--muted)">${esc2(s.authorLabel||'')} · ${esc2(s.date||'')}</p>
          ${s.adminNote ? `<p class="small" style="color:var(--accent)">رد الإدارة: ${esc2(s.adminNote)}</p>` : ''}
          ${u.role==='admin' && (s.status||'pending')==='pending' ? `<div class="flexrow mtop">
            <button class="btn sm primary" onclick="approveSuggestion('${s.id}')">قبول</button>
            <button class="btn sm ghost" onclick="rejectSuggestion('${s.id}')">رفض</button></div>` : ''}
        </div>`).join('') : '<p class="small">لا توجد مقترحات مطابقة</p>'}</div>`;
  };

  console.log('[عمارتنا] عرض شاشات التواصل جاهز');
})();
