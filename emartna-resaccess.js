/* ============================================================
   عمارتنا — تطبيق صلاحيات على كل السكان دفعة واحدة
   ------------------------------------------------------------
   الملف ده كان نظام صلاحيات تالت مستقل: بيتخزّن على مستوى
   العمارة (D.building.residentAccess)، وبيلفّ حوالين فلترة
   القوائم ومنع الدخول — فوق نظام صلاحيات المستخدم الفردي.

   النتيجة كانت إن رئيس الاتحاد يظبط صلاحيات ساكن من شاشة
   المستخدمين، وطبقة تانية تدوس عليها من غير ما يعرف. ولإن
   الاتنين ليهم قوايم شاشات مختلفة، الشاشة الواحدة كانت
   مسموحة في مكان ومقفولة في مكان — وده اللي كان مبيّن إن
   التعديل "بيرجع زي الأول".

   دلوقتي مصدر واحد: screen_perms لكل مستخدم على السيرفر.
   والملف ده بقى أداة تطبيق جماعي فوق نفس المصدر.
   ============================================================ */

(function(){
  'use strict';

  /* تحييد النظام القديم: أي سياسة متخزّنة على العمارة بقت بلا أثر،
     ومفيش أي لفّ حوالين visibleNavGroups ولا go(). */
  window.residentPolicy = function(){ return null; };
  window.residentCanSee = function(){ return true; };

  /* ---------- تطبيق جماعي ---------- */

  window.openBulkResidentPerms = function(){
    if (!window.isUnionHead || !isUnionHead())
      return showMessage('إدارة الصلاحيات متاحة لرئيس اتحاد الملاك فقط.');
    if (!window.permInviteGrid)
      return showMessage('جدول الصلاحيات مش متحمّل — حدّث الصفحة.');

    const D = window.D;
    const owners  = (D.users || []).filter(u => u.role === 'owner'  && u.active !== false);
    const tenants = (D.users || []).filter(u => u.role === 'tenant' && u.active !== false);

    openModal(`
      <h3>👥 تطبيق صلاحيات على كل السكان</h3>
      <p class="small mtop">اظبط الجدول مرة واحدة وطبّقه على كل الملاك أو كل المستأجرين.
        <b>ده بيكتب فوق أي صلاحيات مخصّصة</b> للناس اللي هتختارهم — لو ظابط حد
        بعينه من شاشة المستخدمين، صلاحياته هتتمسح.</p>

      <div class="field2 mtop"><label>هيتطبّق على</label>
        <select id="brTarget">
          <option value="owner">🏠 كل الملاك (${owners.length})</option>
          <option value="tenant">🔑 كل المستأجرين (${tenants.length})</option>
          <option value="both">الاتنين (${owners.length + tenants.length})</option>
        </select></div>

      <div class="flexrow mtop" style="gap:6px;flex-wrap:wrap">
        <button type="button" class="btn sm ghost" onclick="permBulk('reset')">افتراضي الدور</button>
        <button type="button" class="btn sm ghost" onclick="permBulk('view')">عرض وطباعة بس</button>
        <button type="button" class="btn sm ghost" onclick="permBulk('all')">افتح الكل</button>
        <button type="button" class="btn sm ghost" onclick="permBulk('none')">اقفل الكل</button>
      </div>

      <div class="mtop">${window.permInviteGrid('owner', null)}</div>

      <div class="modal-actions">
        <button class="btn primary" onclick="applyBulkResidentPerms()">💾 طبّق على الكل</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.applyBulkResidentPerms = async function(){
    const D = window.D;
    const target = (document.getElementById('brTarget') || {}).value || 'owner';
    const roles = target === 'both' ? ['owner','tenant'] : [target];
    const list = (D.users || []).filter(u =>
      roles.includes(u.role) && u.active !== false && (u.__membershipId || u.__inviteId));

    if (!list.length) return showMessage('مفيش سكان متزامنين مع السحابة للتطبيق عليهم.');

    const sp = window.readScreenPerms ? readScreenPerms() : null;
    if (!sp) return showMessage('الجدول فاضي.');

    /* صلاحية المجموعة مشتقّة من التفصيلي عشان الطبقتين ما يتعارضوش */
    const perms = { home:true };
    (window.permScreens ? permScreens('owner') : []).forEach(g => {
      perms[g.key] = g.items.some(it => sp[it.key] && sp[it.key].view);
    });

    if (!confirm('هيتطبّق على ' + list.length +
                 ' ساكن، وهيمسح أي صلاحيات مخصّصة عندهم. تكمّل؟')) return;

    const sb = window.CLOUD && window.CLOUD._sb;
    let done = 0, failed = 0;
    for (const u of list){
      try{
        const tbl = u.__membershipId ? 'memberships' : 'invitations';
        const id  = u.__membershipId || u.__inviteId;
        const { error } = await sb.from(tbl)
          .update({ permissions: perms, screen_perms: sp }).eq('id', id);
        if (error) throw error;
        u.screenPerms = sp; u.permissions = perms;
        done++;
      }catch(e){ failed++; }
    }

    closeModal();
    showMessage('اتطبّقت على ' + done + ' ساكن.' +
                (failed ? ' وفشلت مع ' + failed + '.' : ''));
    if (window.refreshUsers) refreshUsers();
  };

  /* ---------- الكارت في شاشة المستخدمين ---------- */

  function card(){
    if (!window.isUnionHead || !isUnionHead()) return '';
    return `
      <div class="card mtop" style="border-inline-start:3px solid var(--accent)">
        <div class="flexrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div>
            <b>👥 تطبيق صلاحيات على كل السكان</b>
            <div class="small" style="color:var(--muted)">
              بدل ما تظبط كل ساكن لوحده — اظبط مرة وطبّق على الكل</div>
          </div>
          <button class="btn sm" onclick="openBulkResidentPerms()">فتح</button>
        </div>
      </div>`;
  }

  function hook(){
    const orig = window.pageUsers;
    if (typeof orig !== 'function' || orig.__bulkRes) return;
    const wrapped = function(){
      const html = orig.apply(this, arguments);
      return typeof html === 'string' ? html + card() : html;
    };
    wrapped.__bulkRes = true;
    window.pageUsers = wrapped;
  }
  setTimeout(hook, 700);

  /* أي مدخل قديم للشاشة الملغاة يفتح الأداة الجديدة */
  window.openResidentAccess = function(){ openBulkResidentPerms(); };

  console.log('[عمارتنا] تطبيق الصلاحيات الجماعي جاهز');
})();
