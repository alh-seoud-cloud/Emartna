/* ============================================================
   عمارتنا — التذكير اليومي بتسجيل المصروفات
   ------------------------------------------------------------
   رئيس الاتحاد بيحدد ميعاد، والبرنامج بيذكّره كل يوم:
     • إشعار على الجهاز (لو أذن بالإشعارات)
     • وشريط داخل البرنامج لو مفتوح
   الميعاد والحالة بيتحفظوا على الخادم مع بيانات العمارة،
   فالإعداد بيمشي معاه على أي جهاز.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const SEEN = 'emartna_reminder_seen';       // آخر يوم اتعرض فيه (محلي)

  function cfg(){
    const D = window.D;
    if (!D || !D.building) return null;
    D.building.dailyReminder = D.building.dailyReminder || {
      enabled: false, time: '20:00', lastPrompt: '',
    };
    return D.building.dailyReminder;
  }

  const today = () => (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));

  /* هل اتسجّل مصروف النهاردة؟ */
  function loggedToday(){
    const D = window.D || {};
    const t = today();
    return (D.expenses || []).some(e => (e.date||'') === t);
  }

  /* ---------- الإعداد ---------- */

  window.openReminderModal = function(){
    const c = cfg();
    if (!c) return;
    const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
    const permTxt = perm === 'granted' ? '✅ الإشعارات مفعّلة على الجهاز ده'
                  : perm === 'denied'  ? '🔕 الإشعارات مرفوضة من إعدادات المتصفح — فعّلها من هناك'
                  : perm === 'unsupported' ? '⚠️ متصفحك مش بيدعم الإشعارات'
                  : '🔔 محتاج إذن الإشعارات — اضغط الزرار تحت';

    openModal(`
      <h3>⏰ تذكير يومي بتسجيل المصروفات</h3>
      <p class="small mtop">
        أكتر حاجة بتضيع في إدارة العمارة هي المصروفات الصغيرة اللي بتتنسى.
        التذكير بيوصلك كل يوم في الميعاد اللي تحدده.
      </p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="remOn" ${c.enabled?'checked':''}> تفعيل التذكير اليومي</label>
      </div>
      <div class="field2 mtop">
        <label>ميعاد التذكير</label>
        <input id="remTime" type="time" value="${esc2(c.time||'20:00')}">
      </div>

      <div class="card mtop">
        <p class="small">${permTxt}</p>
        ${perm === 'default' ? `<button class="btn sm gold mtop" onclick="askNotifPermission()">
          🔔 فعّل إشعارات الجهاز</button>` : ''}
      </div>

      <p class="small mtop" style="color:var(--muted)">
        ℹ️ الإشعار بيظهر على الجهاز اللي فعّلت عليه، والتطبيق لازم يكون مثبّت أو
        الصفحة مفتوحة في خلفية المتصفح. لو قفلت المتصفح تمامًا، هتلاقي التذكير
        كشريط جوه البرنامج أول ما تفتحه.
      </p>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveReminder()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.askNotifPermission = async function(){
    if (typeof Notification === 'undefined') return showMessage('متصفحك مش بيدعم الإشعارات');
    try{
      const p = await Notification.requestPermission();
      if (window.toast) toast(p === 'granted' ? 'اتفعّلت الإشعارات ✅' : 'الإذن اترفض');
      openReminderModal();
    }catch(e){}
  };

  window.saveReminder = function(){
    const c = cfg(); if (!c) return;
    c.enabled = !!(document.getElementById('remOn')||{}).checked;
    c.time    = (document.getElementById('remTime')||{}).value || '20:00';
    save();
    closeModal();
    if (window.toast) toast(c.enabled ? `هيوصلك تذكير يومي ${c.time}` : 'اتوقف التذكير');
    renderContent();
  };

  /* ---------- التنفيذ ---------- */

  function dueNow(){
    const c = cfg();
    if (!c || !c.enabled) return false;
    if (loggedToday()) return false;                  // سجّل خلاص — مش محتاج تذكير
    const [h,m] = String(c.time||'20:00').split(':').map(Number);
    const now = new Date();
    return (now.getHours()*60 + now.getMinutes()) >= (h*60 + (m||0));
  }

  function seenToday(){
    try{ return localStorage.getItem(SEEN) === today(); }catch(e){ return false; }
  }
  function markSeen(){
    try{ localStorage.setItem(SEEN, today()); }catch(e){}
  }

  function fireNotification(){
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    try{
      const b = (window.D && D.building && D.building.name) || 'عمارتك';
      const n = new Notification('عمارتنا — تذكير يومي', {
        body: `سجّل مصروفات النهاردة في ${b} قبل ما تتنسى 📝`,
        icon: (window.__appIcons && window.__appIcons[0] && window.__appIcons[0].src) || undefined,
        tag: 'emartna-daily',
      });
      n.onclick = () => { window.focus(); if (window.go) go('expenses'); n.close(); };
      return true;
    }catch(e){ return false; }
  }

  function showBar(){
    if (document.getElementById('remBar')) return;
    const bar = document.createElement('div');
    bar.id = 'remBar';
    bar.style.cssText = 'position:fixed;bottom:14px;inset-inline-end:14px;z-index:9400;' +
      'background:var(--gold,#D8A33B);color:#3b2c07;padding:10px 14px;border-radius:12px;' +
      'font:600 13px/1.7 system-ui;direction:rtl;max-width:min(92vw,380px);' +
      'box-shadow:0 6px 20px rgba(0,0,0,.18)';
    bar.innerHTML = '📝 سجّلت مصروفات النهاردة؟ ' +
      '<button onclick="go(\'expenses\');this.parentNode.remove()" ' +
      'style="margin-inline-start:8px;background:#fff;border:0;border-radius:6px;' +
      'padding:4px 12px;cursor:pointer;font-weight:700">افتح المصروفات</button>' +
      '<button onclick="this.parentNode.remove()" style="margin-inline-start:6px;' +
      'background:none;border:0;cursor:pointer;opacity:.7">لاحقًا</button>';
    document.body.appendChild(bar);
  }

  function check(){
    try{
      const u = window.currentUser && currentUser();
      if (!u || u.role !== 'admin') return;
      if (!dueNow() || seenToday()) return;
      markSeen();
      if (!fireNotification()) showBar();
      else setTimeout(showBar, 1500);          // الشريط كمان لو البرنامج مفتوح
    }catch(e){}
  }

  setInterval(check, 60 * 1000);
  setTimeout(check, 6000);

  /* بطاقة الإعداد في شاشة المصروفات */
  const origExp = window.pageExpenses;
  if (origExp) window.pageExpenses = function(){
    const html = origExp.apply(this, arguments);
    const c = cfg();
    if (!c) return html;
    const card = `
      <div class="card" style="border:1px dashed var(--line)">
        <div class="flexrow" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <b>⏰ التذكير اليومي</b>
            <div class="small" style="color:var(--muted)">
              ${c.enabled ? `مفعّل — كل يوم الساعة ${esc2(c.time)}${loggedToday()?' · سجّلت النهاردة ✅':''}`
                          : 'مقفول — فعّله عشان ما تنساش مصروفات اليوم'}
            </div>
          </div>
          <button class="btn sm ${c.enabled?'ghost':'gold'}" onclick="openReminderModal()">
            ${c.enabled ? 'تعديل' : '🔔 فعّل التذكير'}</button>
        </div>
      </div>`;
    return card + html;
  };

  console.log('[عمارتنا] التذكير اليومي جاهز');
})();
