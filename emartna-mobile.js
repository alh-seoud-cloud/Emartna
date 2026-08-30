/* ============================================================
   عمارتنا — عرض الجداول على الموبايل
   ------------------------------------------------------------
   الجدول العريض على شاشة ضيّقة بيتقص وبيحتاج سحب يمين وشمال.
   على الموبايل بنحوّل كل صف لكارت: أول عمودين عنوان الكارت،
   والباقي بيان تحت التاني — من غير أي سحب.

   بيشتغل تلقائيًا تحت ٧٦٨ بكسل، والمستخدم يقدر يرجّع الجدول.
   ============================================================ */

(function(){
  'use strict';

  const KEY = 'emartna_mobile_cards';
  const isNarrow = () => window.innerWidth <= 768;

  function cardsOn(){
    try{
      const v = localStorage.getItem(KEY);
      if (v === '0') return false;
      if (v === '1') return true;
    }catch(e){}
    return isNarrow();                 // الافتراضي: كروت على الموبايل
  }

  window.toggleMobileCards = function(){
    try{ localStorage.setItem(KEY, cardsOn() ? '0' : '1'); }catch(e){}
    apply(true);
    if (window.toast) toast(cardsOn() ? 'عرض كروت' : 'عرض جدول');
  };

  /* زرار التبديل بين الكروت والجدول — في شريط أدوات كل جدول */
  (function addToggle(){
    const orig = window.sortableTable;
    if (typeof orig !== 'function' || orig.__mobBtn) return;
    const wrapped = function(){
      const html = orig.apply(this, arguments);
      if (!isNarrow()) return html;
      const btn = `<button class="btn sm ghost" onclick="toggleMobileCards()"
        title="تبديل بين الكروت والجدول">${cardsOn() ? '📋 جدول' : '🔲 كروت'}</button>`;
      return html.replace('طباعة</button>', 'طباعة</button>' + btn);
    };
    wrapped.__mobBtn = true;
    window.sortableTable = wrapped;
  })();
  setTimeout(() => {
    const orig = window.sortableTable;
    if (typeof orig === 'function' && !orig.__mobBtn){
      const wrapped = function(){
        const html = orig.apply(this, arguments);
        if (!isNarrow()) return html;
        const btn = `<button class="btn sm ghost" onclick="toggleMobileCards()"
          title="تبديل بين الكروت والجدول">${cardsOn() ? '📋 جدول' : '🔲 كروت'}</button>`;
        return html.replace('طباعة</button>', 'طباعة</button>' + btn);
      };
      wrapped.__mobBtn = true;
      window.sortableTable = wrapped;
    }
  }, 2500);

  /* ---------- التحويل ---------- */

  function convert(wrap){
    const table = wrap.querySelector('.table-wrap table');
    if (!table) return;

    const heads = [...table.querySelectorAll('thead th')].map(th => {
      const c = th.cloneNode(true);
      [...c.querySelectorAll('.col-resize-handle,.sort-ic')].forEach(x => x.remove());
      return c.textContent.replace(/[🔍▲▼]/g,'').trim();
    });

    const rows = [...table.querySelectorAll('tbody tr')];
    if (!rows.length || rows[0].children.length < 3) return;

    const box = document.createElement('div');
    box.className = 'm-cards';

    rows.forEach(tr => {
      const tds = [...tr.children];
      if (tds.length < 2) return;

      // آخر عمود غالبًا أزرار — بيروح لتحت
      const lastIsActions = !heads[tds.length-1] || /إجراء|أدوات/.test(heads[tds.length-1] || '') ||
                            tds[tds.length-1].querySelector('button,a');

      const card = document.createElement('div');
      card.className = 'm-card';

      const head = document.createElement('div');
      head.className = 'm-card-head';
      // العمود الأول هو المعرّف الأساسي (رقم الوحدة/الاسم)،
      // والتاني وصف مساعد — بنفصلهم بنقطة عشان مايلزقوش ببعض.
      head.innerHTML = `<b>${tds[0].innerHTML}</b>` +
        (tds[1] && tds[1].textContent.trim() && tds[1].textContent.trim() !== '—'
          ? `<span class="m-card-sub">· ${tds[1].innerHTML}</span>` : '');
      card.appendChild(head);

      const body = document.createElement('div');
      body.className = 'm-card-body';
      const end = lastIsActions ? tds.length - 1 : tds.length;
      for (let i = 2; i < end; i++){
        const txt = tds[i].textContent.trim();
        // نخفي الفاضي بكل أشكاله عشان الكارت مايطولش من غير فايدة
        if (!txt || ['—','-','–','0','undefined','null'].includes(txt)) continue;
        const row = document.createElement('div');
        row.className = 'm-row';
        row.innerHTML = `<span class="m-lbl">${heads[i] || ''}</span>` +
                        `<span class="m-val">${tds[i].innerHTML}</span>`;
        body.appendChild(row);
      }
      if (body.children.length) card.appendChild(body);

      if (lastIsActions && tds[tds.length-1]){
        const act = document.createElement('div');
        act.className = 'm-card-act';
        act.innerHTML = tds[tds.length-1].innerHTML;
        card.appendChild(act);
      }
      box.appendChild(card);
    });

    if (!box.children.length) return;
    wrap.querySelector('.table-wrap').style.display = 'none';
    const old = wrap.querySelector('.m-cards');
    if (old) old.remove();
    wrap.querySelector('.table-wrap').insertAdjacentElement('afterend', box);
  }

  function restore(wrap){
    const box = wrap.querySelector('.m-cards');
    if (box) box.remove();
    const tw = wrap.querySelector('.table-wrap');
    if (tw) tw.style.display = '';
  }

  function apply(force){
    try{
      const on = cardsOn() && isNarrow();
      document.querySelectorAll('[id$="_wrap"]').forEach(wrap => {
        if (!wrap.querySelector('.table-wrap')) return;
        if (on){
          if (force || !wrap.querySelector('.m-cards')) convert(wrap);
        } else restore(wrap);
      });
      markToggle();
    }catch(e){}
  }
  window.applyMobileCards = apply;

  /* زرار التبديل في شريط أدوات الجدول */
  function markToggle(){
    if (!isNarrow()) {
      document.querySelectorAll('.m-toggle').forEach(b => b.remove());
      return;
    }
    document.querySelectorAll('.table-toolbar').forEach(tb => {
      if (tb.querySelector('.m-toggle')) return;
      const b = document.createElement('button');
      b.className = 'btn sm ghost m-toggle';
      b.textContent = cardsOn() ? '📋 جدول' : '🔲 كروت';
      b.onclick = () => toggleMobileCards();
      tb.appendChild(b);
    });
  }

  /* ---------- التنسيق ---------- */

  function css(){
    if (document.getElementById('mCardsCss')) return;
    const st = document.createElement('style');
    st.id = 'mCardsCss';
    st.textContent = `
      .m-cards{ display:flex; flex-direction:column; gap:9px; margin-top:6px }
      .m-card{ border:1px solid var(--line); border-radius:13px; background:var(--panel);
               padding:11px 13px; box-shadow:0 1px 3px rgba(0,0,0,.05) }
      .m-card-head{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;
                    padding-bottom:8px; border-bottom:1px solid var(--line) }
      .m-card-head b{ font-size:15px }
      .m-card-sub{ font-size:12.5px; color:var(--muted) }
      .m-card-body{ padding-top:7px }
      .m-row{ display:flex; justify-content:space-between; align-items:center;
              gap:10px; padding:4px 0; font-size:13px }
      .m-lbl{ color:var(--muted); font-size:12px; white-space:nowrap }
      .m-val{ text-align:end; font-weight:600 }
      .m-card-act{ display:flex; gap:6px; flex-wrap:wrap; margin-top:9px;
                   padding-top:9px; border-top:1px solid var(--line) }
      .m-card-act .btn, .m-card-act a{ flex:1; min-width:88px; text-align:center }

      @media (max-width:768px){
        .table-toolbar{ flex-wrap:wrap; gap:6px }
        .m-cards .badge{ font-size:11.5px }
      }`;
    document.head.appendChild(st);
  }

  /* التشغيل بعد أي رسم */
  ['renderContent','renderSysContent','refreshSortable','openModal'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig.__mCards) return;
    const wrapped = function(){
      const r = orig.apply(this, arguments);
      setTimeout(() => { css(); apply(true); }, 70);
      return r;
    };
    wrapped.__mCards = true;
    window[fn] = wrapped;
  });

  window.addEventListener('resize', () => setTimeout(() => apply(true), 200));
  setTimeout(() => { css(); apply(true); }, 1500);
  setInterval(() => { if (isNarrow()) apply(false); }, 3000);

  console.log('[عمارتنا] عرض الجداول على الموبايل جاهز');
})();
