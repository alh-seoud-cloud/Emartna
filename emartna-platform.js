/* ============================================================
   عمارتنا | Emartna — طبقة المنصة  (الجولة ٣)
   ------------------------------------------------------------
   بتربط لوحة صاحب البرنامج بقاعدة البيانات:
     • دخول مسؤول المنصة وموظفي الدعم
     • ٤ جداول حقيقية: التجديدات · المقترحات · التذاكر · الإشعارات
     • باقي بيانات المنصة كمستندات JSON (تطابق ١٠٠٪ مع البرنامج)
   ============================================================ */

const p3 = new Proxy({}, {
  get: (_, k) => (...a) => {
    const f = window[k];
    if (typeof f === 'function') return f(...a);
    console.warn('[عمارتنا/منصة] ' + String(k) + ' مش متاحة');
    return undefined;
  }
});
const toast3       = m => p3.toast(m);
const showMessage3 = m => p3.showMessage(m);

function ready(cond){
  return new Promise(r => {
    if (cond()) return r();
    const t = setInterval(() => { if (cond()){ clearInterval(t); r(); } }, 60);
  });
}
await ready(() => window.CLOUD && window.CLOUD._sb);

const sb3 = window.CLOUD._sb;


/* ============================================================
   1) المجموعات اللي بتتخزّن كمستندات JSON
   ============================================================ */

const DOC_COLLECTIONS = [
  'landingSettings', 'brandSettings', 'legalSettings', 'landingBanners',
  'marketingCards', 'messageTemplates', 'discountCoupons', 'marketingLeads',
  'teamTasks', 'versionHistory', 'revenueLedger', 'referralRewards',
  'sysActivityLog', 'deletedBuildings',
];

const DOC_KEY = c => 'reg:' + c;

/* بيانات صاحب البرنامج اللي بتظهر للعملاء — بتتخزن في مستند منفصل.
   مابنحفظش كلمة السر ولا سؤال الاسترداد هنا لأن platform_settings
   مقروء للجميع. */
const SYSOWNER_PUBLIC_FIELDS = [
  'contactPhoneCountry','contactPhone','contactEmail',
  'paymentLink','siteUrl','paymentMethods','bankInfo','notes',
  'facebookUrl','instagramUrl','whatsappNumber','youtubeUrl',
];
const SYSOWNER_DOC = 'reg:sysOwnerPublic';

/* بيانات الترخيص والاشتراك بتتغيّر من لوحة المنصة (تفعيل · تجديد ·
   إيقاف · كوبون · إحالة) — لازم ترجع للخادم، مش تفضل محلية. */
const nz = v => (v === '' || v === undefined) ? null : v;   // تاريخ فاضي = null
const BUILDING_LICENSE_FIELDS = b => ({
  plan_key:        nz(b.license && b.license.plan)      || null,
  license_start:   nz(b.license && b.license.startDate) || null,
  license_end:     nz(b.license && b.license.endDate)   || null,
  license_status:  (b.license && b.license.status) || null,
  // بيانات بيعدّلها صاحب البرنامج وكانت بتفضل محلية
  admin_name:      b.adminName ?? null,
  admin_email:     b.adminEmail ?? null,
  facebook_url:    b.facebookUrl ?? null,
  claimed_offer_id: b.claimedOfferId ?? null,
  referral_reward_given: !!b.referralRewardGiven,
  max_staff_override:    b.maxStaffOverride ?? null,
  city:            b.city ?? null,
  governorate:     b.governorate ?? null,
  address:         b.address ?? null,
  country:         b.country ?? null,
  notes:           b.notes ?? null,
  contact_phone:         b.contactPhone ?? null,
  contact_phone_country: b.contactPhoneCountry ?? null,
  applied_coupon:  b.appliedCoupon ?? null,
  applied_offer_id:b.appliedOfferId ?? null,
  referral_code:   b.referralCode || null,
  referred_by:     b.referredBy || null,
  name:            b.name || null,
});

function pickSysOwnerPublic(so){
  const out = {};
  so = so || {};
  // بنكتب كل الحقول حتى لو فاضية — عشان لو مسحت قيمة، المسح يوصل
  // للخادم بدل ما القيمة القديمة تفضل هناك.
  SYSOWNER_PUBLIC_FIELDS.forEach(k => {
    out[k] = so[k] ?? (k === 'paymentMethods' ? [] : '');
  });
  return out;
}


/* ============================================================
   2) الجداول الحقيقية
   ============================================================ */

const TABLE_COLLECTIONS = {

  renewalRequests: {
    table: 'renewal_requests',
    toApp: r => ({
      id: r.legacy_id || r.id, __uuid: r.id,
      buildingId: r.__buildingCode || r.building_id,
      buildingName: r.building_name, planKey: r.plan_key,
      imageDataUrl: r.image_data_url, note: r.note, status: r.status,
      adminNote: r.admin_note, requestedAt: r.requested_at,
      reviewedAt: r.reviewed_at,
    }),
    toDB: (x, ctx) => ({
      legacy_id: x.id, building_id: ctx.uuidOfBuilding(x.buildingId),
      building_name: x.buildingName || '', plan_key: x.planKey || null,
      image_data_url: x.imageDataUrl || null, note: x.note || '',
      status: x.status || 'pending', admin_note: x.adminNote || '',
      requested_at: x.requestedAt || new Date().toISOString(),
    }),
  },

  customerProposals: {
    table: 'customer_proposals_v2',
    toApp: r => ({
      id: r.legacy_id || r.id, __uuid: r.id,
      buildingId: r.__buildingCode || r.building_id,
      buildingName: r.building_name,
      submittedByUsername: r.submitted_by_username,
      submittedByName: r.submitted_by_name,
      submittedByRole: r.submitted_by_role,
      title: r.title, description: r.description,
      imageDataUrl: r.image_data_url, status: r.status,
      adminResponse: r.admin_response, createdAt: r.created_at,
    }),
    toDB: (x, ctx) => ({
      legacy_id: x.id, building_id: ctx.uuidOfBuilding(x.buildingId),
      building_name: x.buildingName || '',
      // الخادم بيشترط إن مقدّم الطلب هو المستخدم الحالي
      submitted_by: (window.CLOUD_AUTH && CLOUD_AUTH.user && CLOUD_AUTH.user.id) || null,
      submitted_by_username: x.submittedByUsername || '',
      submitted_by_name: x.submittedByName || '',
      submitted_by_role: x.submittedByRole || '',
      title: x.title || '', description: x.description || '',
      image_data_url: x.imageDataUrl || null,
      status: x.status || 'pending', admin_response: x.adminResponse || '',
    }),
  },

  supportTickets: {
    table: 'support_tickets',
    toApp: r => ({
      id: r.legacy_id || r.id, __uuid: r.id,
      buildingId: r.__buildingCode || r.building_id,
      buildingName: r.building_name,
      submittedByUsername: r.submitted_by_username,
      submittedByName: r.submitted_by_name,
      subject: r.subject, priority: r.priority, status: r.status,
      assignedToLabel: r.assigned_to_label,
      replies: r.replies || [], createdAt: r.created_at,
    }),
    toDB: (x, ctx) => ({
      legacy_id: x.id, building_id: ctx.uuidOfBuilding(x.buildingId),
      building_name: x.buildingName || '',
      // الخادم بيشترط إن مقدّم الطلب هو المستخدم الحالي
      submitted_by: (window.CLOUD_AUTH && CLOUD_AUTH.user && CLOUD_AUTH.user.id) || null,
      submitted_by_username: x.submittedByUsername || '',
      submitted_by_name: x.submittedByName || '',
      subject: x.subject || '', priority: x.priority || 'normal',
      status: x.status || 'open',
      assigned_to_label: x.assignedToLabel || null,
      replies: x.replies || [],
    }),
  },

  sysNotifications: {
    table: 'sys_notifications',
    toApp: r => ({
      id: r.legacy_id || r.id, __uuid: r.id,
      title: r.title, message: r.message, link: r.link,
      read: r.read, createdAt: r.created_at,
    }),
    toDB: x => ({
      legacy_id: x.id, title: x.title || '', message: x.message || '',
      link: x.link || 'sysdash', read: !!x.read,
    }),
  },
};


/* ============================================================
   3) التحميل
   ============================================================ */

const codeOfUuid = {};    // uuid → code
const uuidOfCode = {};    // code → uuid

function ctx(){
  return { uuidOfBuilding: c => uuidOfCode[c] || (
    /^[0-9a-f-]{36}$/i.test(String(c)) ? c : null) };
}

const PLATFORM = {

  async load(){
    const REG = window.REG;
    if (!REG) return;

    (REG.buildings || []).forEach(b => {
      if (b.__uuid){ codeOfUuid[b.__uuid] = b.id; uuidOfCode[b.id] = b.__uuid; }
    });

    // المستندات + الجداول بالتوازي
    const [docsRes, ...tableRes] = await Promise.all([
      sb3.from('platform_settings').select('key,value'),
      ...Object.values(TABLE_COLLECTIONS).map(m =>
        sb3.from(m.table).select('*').order('created_at', { ascending:false })),
    ]);

    // المستندات
    const docs = {};
    (docsRes.data || []).forEach(d => { docs[d.key] = d.value; });
    DOC_COLLECTIONS.forEach(c => {
      const v = docs[DOC_KEY(c)];
      if (v !== undefined && v !== null) REG[c] = v;
    });
    if (docs['brand'])   REG.__brand   = docs['brand'];
    if (docs['contact']) REG.__contact = docs['contact'];

    // بيانات التواصل والدفع بتاعت صاحب البرنامج
    if (docs[SYSOWNER_DOC] && typeof docs[SYSOWNER_DOC] === 'object'){
      REG.sysOwner = Object.assign({}, REG.sysOwner || {}, docs[SYSOWNER_DOC]);
    }

    // الجداول
    Object.keys(TABLE_COLLECTIONS).forEach((coll, i) => {
      const m = TABLE_COLLECTIONS[coll];
      const res = tableRes[i];
      if (res.error){
        console.warn('[عمارتنا/منصة]', m.table, res.error.message);
        REG[coll] = REG[coll] || [];
        return;
      }
      REG[coll] = (res.data || []).map(r =>
        m.toApp({ ...r, __buildingCode: codeOfUuid[r.building_id] || r.building_id }));
    });

    PLATFORM.__snapshot = snapshot(REG);
  },

  /* حفظ التغييرات */
  async save(){
    const REG = window.REG;
    if (!REG) return;
    const prev = PLATFORM.__snapshot || {};
    const c = ctx();

    // إعدادات المنصة والخطط والتراخيص لصاحب البرنامج بس.
    // أي مستخدم تاني (رئيس اتحاد · ساكن · زائر تجريبي) بيحفظ
    // الجداول المسموح له بيها فقط — مقترحاته وتذاكره وطلبات تجديده.
    const isPlatform = !!(window.CLOUD_AUTH && CLOUD_AUTH.isPlatformAdmin);

    try{
      // المستندات: نحفظ اللي اتغيّر بس
      for (const coll of (isPlatform ? DOC_COLLECTIONS : [])){
        const now = JSON.stringify(REG[coll] ?? null);
        if (now === prev['doc:' + coll]) continue;
        const { error } = await sb3.rpc('save_platform_doc',
          { p_key: DOC_KEY(coll), p_value: REG[coll] ?? null });
        if (error) throw error;
      }

      // بيانات التواصل والدفع
      if (isPlatform) {
        const nowSO = JSON.stringify(pickSysOwnerPublic(REG.sysOwner));
        if (nowSO !== prev['doc:sysOwnerPublic']){
          const { error } = await sb3.rpc('save_platform_doc',
            { p_key: SYSOWNER_DOC, p_value: pickSysOwnerPublic(REG.sysOwner) });
          if (error) throw error;
        }
      }

      // تراخيص واشتراكات العمارات
      for (const b of (isPlatform ? (REG.buildings || []) : [])){
        const row = BUILDING_LICENSE_FIELDS(b);
        const now = JSON.stringify(row);
        if (now === prev['bld:' + b.id]) continue;
        const uuid = b.__uuid;
        if (!uuid) continue;
        const { error } = await sb3.from('buildings').update(row).eq('id', uuid);
        if (error) throw error;
      }

      // الجداول: إضافة/تعديل/حذف
      for (const [coll, m] of Object.entries(TABLE_COLLECTIONS)){
        const cur = REG[coll] || [];
        const old = prev['tbl:' + coll] || [];
        const oldById = new Map(old.map(x => [x.id, x]));
        const curIds  = new Set(cur.map(x => x.id));

        for (const item of cur){
          const before = oldById.get(item.id);
          if (!before){
            // إضافة — ونسجّل الـuuid عشان أي تعديل بعدها يوصل
            const { data, error } = await sb3.from(m.table)
              .insert(m.toDB(item, c)).select('id').single();
            if (error) throw error;
            if (data && data.id) item.__uuid = data.id;
          } else if (JSON.stringify(before) !== JSON.stringify(item)){
            const uuid = item.__uuid || before.__uuid;
            if (!uuid){
              console.warn('[عمارتنا/منصة] سجل من غير معرّف:', m.table, item.id);
              continue;
            }
            const { error } = await sb3.from(m.table)
              .update(m.toDB(item, c)).eq('id', uuid);
            if (error) throw error;
          }
        }
        for (const item of old){
          if (curIds.has(item.id)) continue;
          if (!item.__uuid) continue;
          await sb3.from(m.table).delete().eq('id', item.__uuid);
        }
      }

      PLATFORM.__snapshot = snapshot(REG);
      PLATFORM.lastError = null;
    }catch(e){
      PLATFORM.lastError = e;
      console.error('[عمارتنا/منصة] فشل الحفظ:', e);
      throw e;
    }
  },

  async dashboard(){
    const { data, error } = await sb3.from('v_platform_dashboard').select('*').single();
    if (error) throw error;
    return data;
  },
};

window.PLATFORM = PLATFORM;

function snapshot(REG){
  const s = {};
  DOC_COLLECTIONS.forEach(c => { s['doc:' + c] = JSON.stringify(REG[c] ?? null); });
  s['doc:sysOwnerPublic'] = JSON.stringify(pickSysOwnerPublic(REG.sysOwner));
  (REG.buildings || []).forEach(b => {
    s['bld:' + b.id] = JSON.stringify(BUILDING_LICENSE_FIELDS(b));
  });
  Object.keys(TABLE_COLLECTIONS).forEach(c => {
    s['tbl:' + c] = JSON.parse(JSON.stringify(REG[c] || []));
  });
  return s;
}


/* ============================================================
   4) ربط saveRegistry — بيحفظ الخطط والعروض والمنصة
   ============================================================ */

const __origSaveRegistry = window.saveRegistry;
let __platTimer = null;

window.saveRegistry = function(){
  if (typeof __origSaveRegistry === 'function') __origSaveRegistry();  // الخطط والعروض
  clearTimeout(__platTimer);
  __platTimer = setTimeout(() => {
    PLATFORM.save().catch(e => showMessage3('فشل حفظ بيانات المنصة: ' + e.message));
  }, 700);
};


/* ============================================================
   5) دخول مسؤول المنصة وموظفي الدعم
   ============================================================ */

const PLATFORM_AUTH = {

  async resolve(){
    const { data:{ user } } = await sb3.auth.getUser();
    if (!user) return null;

    const [pa, st] = await Promise.all([
      sb3.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
      sb3.from('support_staff').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    if (pa.data) return { type:'sysowner', user };
    if (st.data && st.data.active !== false){
      return { type:'support', user, staff: {
        id: st.data.id, name: st.data.name,
        username: st.data.legacy_username || st.data.email || user.id,
        permissions: st.data.permissions || {},
        active: st.data.active !== false,
      }};
    }
    return null;
  },
};

window.PLATFORM_AUTH = PLATFORM_AUTH;

/* البرنامج بيقرا فريق الدعم من REG */
window.ensureSupportStaff = function(){
  window.REG = window.REG || {};
  const REG = window.REG;
  REG.supportStaff = REG.supportStaff || [];
  return REG.supportStaff;
};

window.currentSupportStaff = function(){
  const s = window.getSession && window.getSession();
  if (!s || s.type !== 'support') return null;
  return s.staff || null;
};

window.isSupportStaff = function(){
  const s = window.getSession && window.getSession();
  return !!(s && s.type === 'support');
};

window.staffHasPermission = function(s, key){
  if (!s) return false;
  return !!(s.permissions && s.permissions[key]);
};


/* ============================================================
   6) إدارة فريق الدعم — على السحابة
   ============================================================ */

const PLATFORM_STAFF = {

  async list(){
    const { data, error } = await sb3.from('support_staff').select('*').order('created_at');
    if (error) throw error;
    return (data || []).map(s => ({
      id: s.id, name: s.name, username: s.legacy_username || '',
      phoneCountry: s.phone_country, phone: s.phone, email: s.email,
      permissions: s.permissions || {}, active: s.active !== false,
      userId: s.user_id, role: s.role,
    }));
  },

  /* إضافة موظف = دعوة يسجّل بنفسه */
  async invite({ name, phone, phoneCountry='+20', email, permissions }){
    if (!name)  throw new Error('اكتب الاسم');
    if (!phone && !email) throw new Error('اكتب رقم الموبايل أو الإيميل');

    const { data, error } = await sb3.from('support_staff').insert({
      name, phone: phone || '', phone_country: phoneCountry,
      email: email || '', role: 'agent', active: true,
      permissions: permissions || {
        buildings:false, addBuildings:false, subscriptions:false, marketing:false },
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updatePermissions(id, permissions){
    const { error } = await sb3.from('support_staff')
      .update({ permissions }).eq('id', id);
    if (error) throw error;
  },

  async setActive(id, active){
    const { error } = await sb3.from('support_staff').update({ active }).eq('id', id);
    if (error) throw error;
  },

  async remove(id){
    const { error } = await sb3.from('support_staff').delete().eq('id', id);
    if (error) throw error;
  },

  /* ربط حساب مسجّل بالموظف */
  async linkAccount(staffId, phoneOrEmail){
    const isEmail = String(phoneOrEmail).includes('@');
    let q = sb3.from('profiles').select('id');
    q = isEmail ? q.eq('email', phoneOrEmail)
                : q.eq('phone_e164', normalizePhone3(phoneOrEmail));
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('مفيش حساب مسجّل بالبيانات دي — لازم يسجّل الأول');
    const up = await sb3.from('support_staff')
      .update({ user_id: data.id }).eq('id', staffId);
    if (up.error) throw up.error;
    return data.id;
  },
};

window.PLATFORM_STAFF = PLATFORM_STAFF;

function normalizePhone3(raw, country='+20'){
  let d = String(raw || '').replace(/[^\d+]/g,'');
  if (!d) return null;
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('+'))  return d;
  return country + d.replace(/^0+/,'');
}


/* ============================================================
   7) إشعارات المنصة — تتولّد من أفعال العمارة
   ============================================================ */

window.pushSysNotification = async function(title, message, link){
  window.REG = window.REG || {};
  const REG = window.REG;
  REG.sysNotifications = REG.sysNotifications || [];
  const row = { id: 'n_' + Date.now(), title, message: message || '',
                link: link || 'sysdash', createdAt: new Date().toISOString(),
                read: false };
  REG.sysNotifications.unshift(row);
  if (REG.sysNotifications.length > 200)
    REG.sysNotifications = REG.sysNotifications.slice(0, 200);
  try{
    await sb3.from('sys_notifications').insert({
      legacy_id: row.id, title: row.title, message: row.message,
      link: row.link, read: false });
  }catch(e){ console.warn('[عمارتنا/منصة] إشعار:', e.message); }
};

window.markAllSysNotifsRead = async function(){
  (window.REG?.sysNotifications || []).forEach(n => { n.read = true; });
  try{
    await sb3.from('sys_notifications').update({ read:true }).eq('read', false);
  }catch(e){}
  if (window.renderSysContent) window.renderSysContent();
};
