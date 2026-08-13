/* ============================================================
   عمارتنا — سلة المحذوفات (طبقة السحابة)
   ------------------------------------------------------------
   في النسخة المحلية سلة المحذوفات كانت بتشتغل على الجهاز.
   في السحابة الحذف بيبقى "حذف مؤقت" على السيرفر:
     is_deleted = true  →  العمارة تختفي وحساباتها تتوقف
     استعادة            →  is_deleted = false
     حذف نهائي          →  حذف الصف فعليًا (وكل بياناته معاه)

   الملف ده بيستبدل دوال البرنامج المحلية بنسخ سحابية.
   ============================================================ */

(function(){
  'use strict';

  const sb = () => (window.CLOUD && window.CLOUD._sb) || null;

  /* REG ممكن يكون معرّف بـ let (مش على window) — الدالة دي بتوصله في الحالتين */
  const reg = () => (typeof REG !== 'undefined' && REG) ? REG : (window.REG || null);

  /* كود العمارة (اللي البرنامج شايفه) → المعرّف الحقيقي على السيرفر */
  function uuidOf(id){
    const rec = ((reg()?.buildings) || []).find(b => b.id === id)
             || ((reg()?.deletedBuildings) || []).find(b => b.id === id);
    if (rec && rec.__uuid) return rec.__uuid;
    return /^[0-9a-f-]{36}$/i.test(String(id)) ? id : null;
  }

  function fail(e){
    const m = (e && e.message) || 'حصلت مشكلة، حاول تاني';
    if (window.showMessage) showMessage(m); else alert(m);
  }

  /* ---------- تحميل المحذوفات من السيرفر ---------- */

  let loading = false;

  async function loadTrash(){
    const s = sb();
    if (!s || loading) return;
    loading = true;
    try{
      const { data, error } = await s.from('buildings')
        .select('id,code,name,city,deleted_at,plan_key,license_status,license_start,license_end,apartments_count')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending:false });
      if (error) throw error;

      reg().deletedBuildings = (data || []).map(b => ({
        id: b.code || b.id,
        __uuid: b.id,
        code: b.code,
        name: b.name,
        city: b.city || '',
        apartmentsCount: b.apartments_count || 0,
        deletedAt: b.deleted_at || new Date().toISOString(),
        license: {
          plan: b.plan_key, start: b.license_start,
          end: b.license_end, status: b.license_status,
        },
      }));
      window.__trashLoaded = true;
      if (window.renderSysContent) renderSysContent();
    }catch(e){
      window.__trashLoaded = true;
      console.warn('[عمارتنا/سلة المحذوفات]', e.message);
    }finally{
      loading = false;
    }
  }

  /* ---------- الشاشة ---------- */

  const originalPage = window.pageSysTrash;

  window.pageSysTrash = function(){
    if (!window.__trashLoaded){
      loadTrash();
      return '<p class="small">⏳ بيحمّل سلة المحذوفات…</p>';
    }
    return originalPage ? originalPage() : '<p class="small">سلة المحذوفات فاضية</p>';
  };

  /* ---------- حذف مؤقت ---------- */

  window.deleteBuildingPrompt = function(id){
    const rec = ((reg()?.buildings) || []).find(b => b.id === id);
    if (!rec) return;
    const uuid = uuidOf(id);
    if (!uuid) return fail(new Error('تعذّر تحديد العمارة'));

    confirmDelete(
      `سيتم نقل عمارة "${rec.name}" إلى سلة المحذوفات. الحسابات هتتوقف عن الدخول فورًا، `
      + `لكن تقدر تسترجعها من سلة المحذوفات في أي وقت، أو تحذفها نهائيًا من هناك.`,
      async () => {
        try{
          const { error } = await sb().from('buildings')
            .update({ is_deleted:true, deleted_at:new Date().toISOString() })
            .eq('id', uuid);
          if (error) throw error;

          reg().buildings = reg().buildings.filter(b => b.id !== id);
          reg().deletedBuildings = reg().deletedBuildings || [];
          reg().deletedBuildings.unshift(
            Object.assign({}, rec, { deletedAt:new Date().toISOString() }));

          toast('تم نقل العمارة لسلة المحذوفات');
          renderSysContent();
        }catch(e){ fail(e); }
      });
  };

  /* ---------- استعادة ---------- */

  window.restoreBuildingFromTrash = async function(id){
    const rec = ((reg()?.deletedBuildings) || []).find(b => b.id === id);
    if (!rec) return;
    const uuid = uuidOf(id);
    if (!uuid) return fail(new Error('تعذّر تحديد العمارة'));

    try{
      const { error } = await sb().from('buildings')
        .update({ is_deleted:false, deleted_at:null })
        .eq('id', uuid);
      if (error) throw error;

      const back = Object.assign({}, rec);
      delete back.deletedAt;
      reg().buildings = reg().buildings || [];
      reg().buildings.push(back);
      reg().deletedBuildings =
        reg().deletedBuildings.filter(b => b.id !== id);

      toast('تم استعادة العمارة');
      renderSysContent();
    }catch(e){ fail(e); }
  };

  /* ---------- حذف نهائي ---------- */

  window.permanentlyDeleteBuildingPrompt = function(id){
    const rec = ((reg()?.deletedBuildings) || []).find(b => b.id === id);
    if (!rec) return;
    const uuid = uuidOf(id);
    if (!uuid) return fail(new Error('تعذّر تحديد العمارة'));

    confirmDelete(
      `سيتم حذف عمارة "${rec.name}" وكل بياناتها (الشقق، الحركات المالية، المصروفات، `
      + `المستخدمين) نهائيًا من الخادم. لا يمكن التراجع عن هذا الإجراء إطلاقًا.`,
      async () => {
        try{
          const { error } = await sb().from('buildings').delete().eq('id', uuid);
          if (error) throw error;

          reg().deletedBuildings =
            reg().deletedBuildings.filter(b => b.id !== id);
          reg().renewalRequests =
            (reg().renewalRequests || []).filter(r => r.buildingId !== id);

          toast('تم الحذف النهائي');
          renderSysContent();
        }catch(e){ fail(e); }
      });
  };

  /* أول ما صاحب البرنامج يدخل، حمّل السلة في الخلفية */
  window.reloadTrash = function(){ window.__trashLoaded = false; loadTrash(); };

  console.log('[عمارتنا] سلة المحذوفات السحابية جاهزة');
})();
