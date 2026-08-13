/* ============================================================
   عمارتنا — حارس الشاشات
   ------------------------------------------------------------
   المشكلة اللي بيحلّها:
   renderContent() بتغيّر عنوان الصفحة الأول، وبعدين بترسم المحتوى.
   لو حصل أي خطأ وقت الرسم، المحتوى القديم بيفضل مكانه — فالعنوان
   بيقول "لوحة التحكم" والشاشة لسه بتعرض الصفحة اللي قبلها.
   ده بيخلّي الخطأ يبان كأن شاشتين بيطلعوا نفس المحتوى.

   الحل: نمسك الخطأ ونعرض كارت واضح مكان المحتوى، فيه رسالة
   الخطأ وزرار نسخ — بدل ما الشاشة تفضل شبح.
   ============================================================ */

(function(){
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function errorCard(err, page){
    const msg   = (err && err.message) || String(err);
    const stack = (err && err.stack) ? String(err.stack).split('\n').slice(0,4).join('\n') : '';
    const full  = 'الشاشة: ' + page + '\n' + msg + '\n' + stack;
    window.__lastRenderError = full;
    return `
    <div class="card" style="border:1px solid var(--red,#c23b3b)">
      <h3 style="color:var(--red,#c23b3b)">⚠️ الشاشة دي مش قادرة تفتح</h3>
      <p class="small mtop">حصل خطأ وإحنا بنجهّز الشاشة، فوقفنا عشان مانعرضش بيانات ناقصة أو غلط.
      باقي الشاشات شغالة عادي — تقدر تكمل شغلك منها.</p>
      <div class="mtop" style="background:var(--inputbg,#fffdf8);border:1px solid var(--line,#e3e8e6);
           border-radius:9px;padding:10px;font-family:monospace;font-size:12px;
           direction:ltr;text-align:left;white-space:pre-wrap;overflow:auto;max-height:220px">${esc(full)}</div>
      <div class="flexrow mtop">
        <button class="btn sm primary" onclick="copyRenderError()">📋 نسخ تفاصيل الخطأ</button>
        <button class="btn sm ghost" onclick="location.reload()">🔄 تحديث الصفحة</button>
      </div>
      <p class="small mtop">انسخ التفاصيل دي وابعتها — بتحدد سبب المشكلة بالظبط.</p>
    </div>`;
  }

  window.copyRenderError = function(){
    const t = window.__lastRenderError || '';
    const done = () => (window.toast ? toast('اتنسخت — ابعتها في الشات') : null);
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(done, done);
    }else{
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); }catch(e){}
      document.body.removeChild(ta); done();
    }
  };

  function guard(name){
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(){
      try{
        return orig.apply(this, arguments);
      }catch(err){
        const page = (typeof curPage !== 'undefined' ? curPage : '?');
        console.error('[عمارتنا] خطأ في رسم الشاشة "' + page + '":', err);
        const c = document.getElementById('content');
        if (c) c.innerHTML = errorCard(err, page);
      }
    };
  }

  guard('renderContent');
  guard('renderSysContent');

  console.log('[عمارتنا] حارس الشاشات جاهز');
})();
