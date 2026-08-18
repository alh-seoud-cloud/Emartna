/* ============================================================
   عمارتنا — وضع الصيانة + نسخ بيانات العمارة
   ------------------------------------------------------------
   ١) صاحب البرنامج يقدر يوقف الموقع مؤقتًا بفترة محددة (من/إلى)
      ورسالة للمستخدمين. هو نفسه بيفضل داخل عشان يشتغل.
   ٢) رئيس الاتحاد يقدر ياخد نسخة من بيانات عمارته:
      تنزيل ملف · أو مشاركة مباشرة (جيميل · درايف · واتساب)
      من خلال قائمة المشاركة في الجهاز.
   ============================================================ */

(function(){
  'use strict';

  const esc2 = s => (window.esc ? esc(s) : String(s == null ? '' : s));
  const KEY = 'maintenance';

  /* ============================================================
     ١) وضع الصيانة
     ============================================================ */

  window.__maintenance = null;

  function isActive(m){
    if (!m || !m.enabled) return false;
    const now = new Date();
    if (m.from && new Date(m.from) > now) return false;   // لسه ما بدأتش
    if (m.to   && new Date(m.to)   < now) return false;   // خلصت
    return true;
  }
  window.maintenanceActive = () => isActive(window.__maintenance);

  async function loadMaintenance(){
    try{
      const sb = window.CLOUD && window.CLOUD._sb;
      if (!sb) return;
      const { data, error } = await sb.from('platform_settings')
        .select('value').eq('key', KEY).maybeSingle();
      if (error) return;
      window.__maintenance = (data && data.value) || null;
      applyMaintenance();
    }catch(e){}
  }
  window.reloadMaintenance = loadMaintenance;
  window.applyMaintenance  = applyMaintenance;

  function applyMaintenance(){
    const m = window.__maintenance;
    const bar = document.getElementById('maintBar');
    if (bar) bar.remove();
    const screen = document.getElementById('maintScreen');
    if (screen) screen.remove();
    if (!isActive(m)) return;

    const isOwner = !!(window.isSysOwner && isSysOwner());
    const period = [
      m.from ? 'من ' + new Date(m.from).toLocaleString('ar-EG') : '',
      m.to   ? 'إلى ' + new Date(m.to).toLocaleString('ar-EG') : '',
    ].filter(Boolean).join(' · ');

    if (isOwner){
      // صاحب البرنامج بيشتغل عادي، بس بيشوف شريط تذكير
      const b = document.createElement('div');
      b.id = 'maintBar';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;background:#B58121;' +
        'color:#fff;padding:8px 14px;font:600 13px/1.6 system-ui;text-align:center;direction:rtl';
      b.innerHTML = '🛠️ الموقع تحت الصيانة للمستخدمين' + (period ? ' — ' + esc2(period) : '') +
        ' <button onclick="openMaintenanceModal()" style="margin-inline-start:10px;background:#fff;' +
        'color:#B58121;border:0;border-radius:6px;padding:3px 12px;cursor:pointer;font-weight:700">إدارة</button>';
      document.body.appendChild(b);
      return;
    }

    const d = document.createElement('div');
    d.id = 'maintScreen';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg,#F8FAF9);' +
      'display:flex;align-items:center;justify-content:center;padding:24px;direction:rtl';
    d.innerHTML = `
      <div style="max-width:520px;text-align:center;background:var(--panel,#fff);
                  border:1px solid var(--line,#e3e8e6);border-radius:18px;padding:32px">
        <div style="font-size:52px">🛠️</div>
        <h2 style="margin:10px 0">البرنامج تحت الصيانة</h2>
        <p class="small" style="line-height:2">${esc2(m.message ||
          'بنعمل تحديث سريع عشان الخدمة تبقى أحسن. البيانات كلها محفوظة وما فيش حاجة هتضيع.')}</p>
        ${period ? `<p style="margin-top:14px;font-weight:700">⏰ ${esc2(period)}</p>` : ''}
        <button class="btn primary" style="margin-top:18px" onclick="location.reload()">🔄 حاول تاني</button>
      </div>`;
    document.body.appendChild(d);
  }

  /* نافذة إدارة الصيانة لصاحب البرنامج */
  window.openMaintenanceModal = function(){
    const m = window.__maintenance || {};
    const val = v => v ? String(v).slice(0,16) : '';
    openModal(`
      <h3>🛠️ وضع الصيانة</h3>
      <p class="small mtop">لما تفعّله، أي مستخدم هيشوف شاشة صيانة بدل البرنامج.
      إنت هتفضل تشتغل عادي عشان تقدر تصلّح.</p>

      <div class="field2 mtop2">
        <label><input type="checkbox" id="mtEnabled" ${m.enabled?'checked':''}> تفعيل وضع الصيانة</label>
      </div>
      <div class="grid g2 mtop">
        <div class="field2"><label>من</label>
          <input id="mtFrom" type="datetime-local" value="${val(m.from)}"></div>
        <div class="field2"><label>إلى</label>
          <input id="mtTo" type="datetime-local" value="${val(m.to)}"></div>
      </div>
      <p class="small">سيب الخانتين فاضيين لو الإيقاف مفتوح المدة.</p>

      <div class="field2 mtop"><label>رسالة للمستخدمين</label>
        <textarea id="mtMsg" rows="3" style="width:100%">${esc2(m.message||'')}</textarea></div>

      <div class="modal-actions">
        <button class="btn primary" onclick="saveMaintenance()">💾 حفظ</button>
        <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      </div>`, true);
  };

  window.saveMaintenance = async function(){
    const g = id => (document.getElementById(id) || {}).value || '';
    const payload = {
      enabled: !!(document.getElementById('mtEnabled') || {}).checked,
      from: g('mtFrom') || null,
      to:   g('mtTo')   || null,
      message: g('mtMsg'),
      updatedAt: new Date().toISOString(),
    };
    if (payload.from && payload.to && new Date(payload.to) <= new Date(payload.from))
      return showMessage('تاريخ النهاية لازم يكون بعد البداية');
    try{
      const { error } = await window.CLOUD._sb.rpc('save_platform_doc',
        { p_key: KEY, p_value: payload });
      if (error) throw error;
      window.__maintenance = payload;
      applyMaintenance();
      closeModal();
      if (window.toast) toast(payload.enabled ? 'الموقع بقى تحت الصيانة' : 'الصيانة اتوقفت — الموقع شغّال');
    }catch(e){
      showMessage('تعذّر الحفظ: ' + (window.cloudErrorText ? cloudErrorText(e) : e.message));
    }
  };

  /* ============================================================
     ٢) نسخة بيانات العمارة
     ============================================================ */

  function buildBuildingBackup(){
    const D = window.D;
    if (!D) return null;
    const b = D.building || {};
    const out = {
      meta: {
        app: 'عمارتنا', kind: 'building-backup', version: window.APP_BUILD || '1',
        takenAt: new Date().toISOString(),
        buildingName: b.name || '', buildingCode: b.code || '',
      },
      building: b,
      counts: {},
      data: {},
    };
    ['apartments','users','accounts','ledger','expenses','expenseCategories','transfers',
     'projects','vendors','maintenanceReports','meetings','polls','announcements',
     'suggestions','paymentRequests','notifications','buildingChat','activityLog']
      .forEach(k => {
        const v = D[k];
        if (Array.isArray(v)){ out.data[k] = v; out.counts[k] = v.length; }
      });

    // الصور بتكبّر الملف — بنشيلها ونعدّها
    let imgs = 0;
    (out.data.paymentRequests || []).forEach(r => {
      if (r.imageDataUrl && r.imageDataUrl.length > 500){
        r.imageDataUrl = '[صورة محذوفة من النسخة]'; imgs++;
      }
    });
    out.meta.imagesStripped = imgs;
    return out;
  }

  function backupFile(){
    const data = buildBuildingBackup();
    if (!data) return null;
    const name = 'نسخة ' + (data.meta.buildingName || 'العمارة') + ' - ' +
                 new Date().toISOString().slice(0,10) + '.json';
    const blob = new Blob([JSON.stringify(data, null, 1)], { type:'application/json' });
    return { blob, name, data };
  }

  window.downloadBuildingBackup = function(){
    const f = backupFile();
    if (!f) return showMessage('مفيش بيانات للنسخ');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f.blob);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    const total = Object.values(f.data.counts).reduce((x,y) => x+y, 0);
    if (window.toast) toast('اتنزّلت نسخة فيها ' + total + ' سجل');
  };

  /* المشاركة: بتفتح قائمة الجهاز — جيميل · درايف · واتساب */
  window.shareBuildingBackup = async function(){
    const f = backupFile();
    if (!f) return showMessage('مفيش بيانات للنسخ');
    const file = new File([f.blob], f.name, { type:'application/json' });

    if (navigator.canShare && navigator.canShare({ files:[file] })){
      try{
        await navigator.share({
          files: [file],
          title: f.name,
          text: 'نسخة احتياطية من بيانات ' + (f.data.meta.buildingName || 'العمارة'),
        });
        return;
      }catch(e){ if (e && e.name === 'AbortError') return; }
    }
    // الجهاز مش بيدعم المشاركة (أغلب أجهزة الكمبيوتر) — بننزّل الملف
    showMessage('جهازك مش بيدعم المشاركة المباشرة.\n\nهننزّل الملف، وتقدر ترفعه على درايف أو تبعته بالإيميل.');
    window.downloadBuildingBackup();
  };

  window.openBuildingBackupModal = function(){
    const d = buildBuildingBackup();
    if (!d) return showMessage('مفيش بيانات');
    const total = Object.values(d.counts).reduce((a,b) => a+b, 0);
    const canShare = !!(navigator.canShare && navigator.share);
    const rows = Object.keys(d.counts).filter(k => d.counts[k])
      .map(k => `<span class="badge n">${esc2(LABELS[k]||k)}: ${d.counts[k]}</span>`).join(' ');

    openModal(`
      <h3>💾 نسخة من بيانات العمارة</h3>
      <p class="small mtop">ملف واحد فيه كل بيانات <b>${esc2(d.meta.buildingName)}</b> —
      ${total} سجل. احتفظ بيه في مكان آمن.</p>
      <div class="card mtop" style="line-height:2.2">${rows}</div>
      ${d.meta.imagesStripped ? `<p class="small">(اتشال ${d.meta.imagesStripped} صورة إثبات عشان الحجم — الحركات المالية كاملة)</p>` : ''}

      <div class="flexrow mtop2" style="flex-wrap:wrap;gap:8px">
        <button class="btn primary" onclick="downloadBuildingBackup()">⬇️ تنزيل الملف</button>
        ${canShare ? `<button class="btn gold" onclick="shareBuildingBackup()">📤 مشاركة (جيميل · درايف · واتساب)</button>` : ''}
      </div>
      <p class="small mtop" style="color:var(--muted)">
        ${canShare ? 'المشاركة بتفتح قائمة جهازك — اختار جيميل عشان تبعتها لنفسك، أو درايف عشان تحفظها.'
                   : 'على الكمبيوتر: نزّل الملف وارفعه على درايف أو أرفقه في إيميل.'}
      </p>
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`, true);
  };

  const LABELS = {
    apartments:'الوحدات', users:'المستخدمين', accounts:'الحسابات', ledger:'الحركات',
    expenses:'المصروفات', expenseCategories:'بنود الصرف', transfers:'التحويلات',
    projects:'المشاريع', vendors:'الموردين', maintenanceReports:'البلاغات',
    meetings:'الاجتماعات', polls:'الاستطلاعات', announcements:'الإعلانات',
    suggestions:'المقترحات', paymentRequests:'طلبات الدفع', notifications:'التنبيهات',
    buildingChat:'المحادثة', activityLog:'سجل النشاط',
  };

  /* زرار النسخة في شاشة الإعدادات */
  const origSettings = window.pageSettings;
  if (origSettings) window.pageSettings = function(){
    return `<div class="card content-narrow">
      <h3>💾 نسخة من بيانات عمارتك</h3>
      <p class="small mtop">نزّل ملف فيه كل بيانات العمارة، أو ابعته لنفسك على الجيميل
      أو احفظه على جوجل درايف. ينصح بنسخة كل شهر.</p>
      <button class="btn gold mtop" onclick="openBuildingBackupModal()">💾 خد نسخة دلوقتي</button>
    </div>` + origSettings.apply(this, arguments);
  };

  /* زرار الصيانة في إعدادات صاحب البرنامج */
  const origSysSettings = window.pageSysSettings;
  if (origSysSettings) window.pageSysSettings = function(){
    const m = window.__maintenance || {};
    const on = isActive(m);
    return `
    <div class="card content-narrow" style="border:1px solid ${on?'#B58121':'var(--line)'}">
      <h3>🛠️ وضع الصيانة</h3>
      <p class="small mtop">
        الحالة: <b>${on ? 'الموقع تحت الصيانة' : 'الموقع شغّال عادي'}</b>.
        ${on ? 'المستخدمين بيشوفوا شاشة صيانة — وإنت شغّال عادي.'
             : 'لما تفعّله، تقدر تحدد فترة ورسالة للمستخدمين.'}
      </p>
      <button class="btn ${on?'red':'gold'} mtop" onclick="openMaintenanceModal()">
        ${on ? '⚙️ إدارة الصيانة' : '🛠️ تفعيل وضع الصيانة'}
      </button>
    </div>
    ${origSysSettings.apply(this, arguments)}`;
  };

  /* التشغيل */
  let tries = 0;
  const t = setInterval(() => {
    if (++tries > 300) return clearInterval(t);
    if (window.CLOUD && window.CLOUD._sb){ clearInterval(t); loadMaintenance(); }
  }, 100);
  setInterval(loadMaintenance, 5 * 60 * 1000);      // إعادة فحص كل ٥ دقايق

  console.log('[عمارتنا] الصيانة والنسخ الاحتياطي جاهز');
})();
