/* ============================================================
   عمارتنا | Emartna — طبقة السحابة
   ------------------------------------------------------------
   بتستبدل 4 دوال بس في البرنامج:
     loadRegistry · saveRegistry · loadBuildingData · saveBuildingData

   سير العمل زي ما هو بالظبط:
     • البرنامج بيقرا من الذاكرة (سريع، متزامن، من غير await)
     • save() بيحدّث الذاكرة فورًا وبيبعت للسحابة في الخلفية
     • لو النت قطع، الشغل بيكمل والتغييرات بتتبعت لما يرجع

   الاستخدام في عمارتنا.html — سطر واحد قبل </body>:
     <script type="module" src="emartna-cloud.js"></script>
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://kavltjqpilzrevahiern.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vEq5yC2-wB1_q2uQdTP5iw_JYMFhiOM';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);


/* ============================================================
   1) خرائط الترجمة
   الشمال = اسم الحقل في البرنامج | اليمين = العمود في قاعدة البيانات
   ============================================================ */

const MAPS = {

  apartments: {
    table: 'apartments',
    fields: {
      id:'legacy_id', number:'number', blockName:'block_name', floor:'floor',
      type:'type', usageType:'usage_type', openingBalance:'opening_balance',
      ownerName:'owner_name', tenantName:'tenant_name',
      phoneCountry:'phone_country', phone:'phone', email:'email',
      monthlyFee:'monthly_fee', username:'legacy_username',
      closed:'closed', notes:'notes',
    },
  },

  accounts: {
    table: 'accounts',
    fields: {
      id:'legacy_id', name:'name', type:'type', opening:'opening',
      bankName:'bank_name', accountNo:'account_no',
    },
  },

  transfers: {
    table: 'transfers',
    fields: {
      id:'legacy_id', amount:'amount', date:'date', note:'note',
    },
    refs: { from:['from_account','accounts'], to:['to_account','accounts'] },
  },

  ledger: {
    table: 'ledger',
    fields: {
      id:'legacy_id', type:'type', amount:'amount', month:'month',
      date:'date', note:'note', project:'project',
      fromPaymentRequestId:'from_payment_request_id', createdAt:'created_at',
    },
    refs: {
      apartmentId:['apartment_id','apartments'],
      accountId:['account_id','accounts'],
      projectId:['project_id','projects'],
    },
  },

  expenses: {
    table: 'expenses',
    fields: {
      id:'legacy_id', date:'date', category:'category', amount:'amount',
      description:'description', reversalOf:'reversal_of',
    },
    refs: {
      accountId:['account_id','accounts'],
      projectId:['project_id','projects'],
      vendorId:['vendor_id','vendors'],
    },
  },

  projects: {
    table: 'projects',
    fields: {
      id:'legacy_id', name:'name', description:'description', status:'status',
      attachments:'attachments', createdAt:'created_at',
    },
  },

  vendors: {
    table: 'vendors',
    fields: {
      id:'legacy_id', name:'name', category:'category',
      phoneCountry:'phone_country', phone:'phone',
      contractStart:'contract_start', contractEnd:'contract_end',
      notes:'notes', active:'active',
    },
  },

  maintenanceReports: {
    table: 'maintenance_reports',
    fields: {
      id:'legacy_id', title:'title', description:'description',
      status:'status', priority:'priority', history:'history',
      reportedByUsername:'reported_by_username',
      resolutionNote:'resolution_note', resolvedAt:'resolved_at',
      createdAt:'created_at',
    },
    refs: {
      apartmentId:['apartment_id','apartments'],
      vendorId:['vendor_id','vendors'],
      expenseId:['expense_id','expenses'],
    },
  },

  meetings: {
    table: 'meetings',
    fields: {
      id:'legacy_id', title:'title', date:'date', time:'time',
      location:'location', agenda:'agenda', status:'status',
      outcomes:'outcomes', remindedAt:'reminded_at',
      comments:'comments', createdAt:'created_at',
    },
  },

  polls: {
    table: 'polls',
    fields: {
      id:'legacy_id', title:'title', description:'description',
      options:'options', status:'status', votes:'votes', comments:'comments',
      showResultsBeforeClose:'show_results_before_close',
      fromSuggestionId:'from_suggestion_id', proposedAmount:'proposed_amount',
      createdAt:'created_at',
    },
  },

  announcements: {
    table: 'announcements',
    fields: {
      id:'legacy_id', title:'title', body:'body', date:'date',
      comments:'comments',
    },
  },

  suggestions: {
    table: 'suggestions',
    fields: {
      id:'legacy_id', title:'title', text:'text',
      authorLabel:'author_label', username:'legacy_username',
      status:'status', adminNote:'admin_note', date:'date',
    },
    refs: { apartmentId:['apartment_id','apartments'] },
  },

  paymentRequests: {
    table: 'payment_requests',
    fields: {
      id:'legacy_id', paymentFor:'payment_for', projectName:'project_name',
      amount:'amount', note:'note', status:'status',
      requestedAt:'created_at', reviewNote:'review_note',
    },
    refs: { apartmentId:['apartment_id','apartments'] },
  },

  notifications: {
    table: 'notifications',
    fields: {
      id:'legacy_id', type:'type', title:'title', message:'message',
      audience:'audience', link:'link', createdAt:'created_at',
      readBy:'read_by',
    },
  },

  buildingChat: {
    table: 'building_chat',
    fields: {
      id:'legacy_id', kind:'kind', text:'text', authorLabel:'author_label',
      authorUsername:'legacy_username', eventType:'event_type',
      icon:'icon', title:'title', message:'message', link:'link',
      createdAt:'created_at',
    },
  },

  activityLog: {
    table: 'activity_log',
    fields: {
      id:'legacy_id', username:'legacy_username', name:'name',
      action:'action', detail:'detail', date:'created_at',
    },
  },
};

// حقول العمارة نفسها (D.building)
const BUILDING_FIELDS = {
  name:'name', address:'address', locationUrl:'location_url', city:'city',
  country:'country', governorate:'governorate', communityType:'community_type',
  apartmentsCount:'apartments_count', apartmentsPerFloor:'apartments_per_floor',
  groundFloorCount:'ground_floor_count', groundShopsCount:'ground_shops_count',
  floorsCount:'floors_count', buildYear:'build_year', currency:'currency',
  theme:'theme', notes:'notes', paymentInfo:'payment_info',
  paymentMethods:'payment_methods',
  contactPhoneCountry:'contact_phone_country', contactPhone:'contact_phone',
  remindersSettings:'reminders_settings',
  distributionWeights:'distribution_weights',
  lastReminderMonth:'last_reminder_month',
  lastChargeReminderMonth:'last_charge_reminder_month',
  lastBackupDate:'last_backup_date',
};


/* ============================================================
   2) الترجمة في الاتجاهين
   ============================================================ */

function toDB(item, map, ctx){
  const row = {};
  for (const [appKey, col] of Object.entries(map.fields)){
    if (item[appKey] !== undefined) row[col] = item[appKey];
  }
  if (map.refs){
    for (const [appKey, [col, coll]] of Object.entries(map.refs)){
      const legacy = item[appKey];
      row[col] = legacy ? (ctx.uuidOf[coll]?.[legacy] ?? null) : null;
    }
  }
  row.building_id = ctx.buildingId;
  return row;
}

function toApp(row, map, ctx){
  const item = {};
  for (const [appKey, col] of Object.entries(map.fields)){
    if (row[col] !== undefined && row[col] !== null) item[appKey] = row[col];
  }
  item.id = row.legacy_id || row.id;
  if (map.refs){
    for (const [appKey, [col, coll]] of Object.entries(map.refs)){
      const uuid = row[col];
      item[appKey] = uuid ? (ctx.legacyOf[coll]?.[uuid] ?? null) : null;
    }
  }
  item.__uuid = row.id;   // بنحتفظ بيه للتحديث والحذف
  if (row.__limited) item.__limited = true;   // بيانات عامة بس
  return item;
}


/* ============================================================
   3) الكاش — البرنامج بيقرا منه بشكل متزامن
   ============================================================ */

const cache = {
  registry: null,
  buildings: {},        // buildingId -> D
  uuid: {},             // buildingId -> { collection -> {legacyId:uuid} }
  legacy: {},           // buildingId -> { collection -> {uuid:legacyId} }
  buildingUuid: {},     // legacyBuildingId -> uuid
  snapshot: {},         // buildingId -> JSON نسخة آخر مزامنة
  dirty: new Set(),
  online: navigator.onLine,
  syncing: false,
  lastError: null,
};

window.addEventListener('online',  () => { cache.online = true;  flush(); });
window.addEventListener('offline', () => { cache.online = false; });


/* ============================================================
   4) التحميل من السحابة
   ============================================================ */

async function fetchBuilding(buildingUuid, legacyId){
  const ctx = { buildingId: buildingUuid, uuidOf:{}, legacyOf:{} };

  const b = await sb.from('buildings').select('*').eq('id', buildingUuid).single();
  if (b.error) throw b.error;

  const D = { building:{} };
  for (const [appKey, col] of Object.entries(BUILDING_FIELDS)){
    if (b.data[col] !== null && b.data[col] !== undefined) D.building[appKey] = b.data[col];
  }

  // الترتيب مهم: الجداول المرجعية الأول
  const order = ['accounts','apartments','projects','vendors','expenses',
                 'transfers','ledger','maintenanceReports','meetings','polls',
                 'announcements','suggestions','paymentRequests','notifications',
                 'buildingChat','activityLog'];

  for (const coll of order){
    const map = MAPS[coll];
    let res = await sb.from(map.table).select('*').eq('building_id', buildingUuid);

    // الساكن العادي مايقراش جدول الشقق كله — بياخد البيانات العامة
    // من دالة units_public، وشقته هو بتيجي كاملة من الجدول.
    if (coll === 'apartments'){
      const pub = await sb.rpc('units_public', { b_id: buildingUuid });
      if (!pub.error && pub.data){
        const mine = new Map((res.data || []).map(r => [r.id, r]));
        res = { data: pub.data.map(u => mine.get(u.id) || {
          id: u.id, legacy_id: u.legacy_id, number: u.number,
          block_name: u.block_name, floor: u.floor, type: u.type,
          usage_type: u.usage_type, closed: u.closed,
          owner_name: '', tenant_name: '', phone: '', email: '',
          monthly_fee: 0, opening_balance: 0, __limited: true,
        }), error: null };
      }
    }
    if (res.error) throw res.error;

    ctx.uuidOf[coll] = {}; ctx.legacyOf[coll] = {};
    res.data.forEach(r => {
      const lid = r.legacy_id || r.id;
      ctx.uuidOf[coll][lid] = r.id;
      ctx.legacyOf[coll][r.id] = lid;
    });
    D[coll] = res.data.map(r => toApp(r, map, ctx));
  }

  // فئات المصروفات محفوظة كنصوص في البرنامج
  const cats = await sb.from('expense_categories')
    .select('name').eq('building_id', buildingUuid).order('sort_order');
  D.expenseCategories = (cats.data || []).map(c => c.name);

  // ---- المستخدمين ----
  // البرنامج محتاج D.users. بنبنيها من مصدرين:
  //   1) العضويات = ناس عملوا حساب فعلًا
  //   2) الدعوات   = ناس رئيس الاتحاد سجّل أرقامهم وبيستنوا
  // كل صف فيه inviteStatus عشان الشاشة تعرف تعرض الحالة.

  const mem = await sb.from('memberships')
    .select('id,user_id,apartment_id,role,active').eq('building_id', buildingUuid);

  const authIds = [...new Set((mem.data||[]).map(m => m.user_id))];
  const profiles = {};
  if (authIds.length){
    const pr = await sb.from('profiles')
      .select('id,full_name,phone,phone_country,phone_e164,email')
      .in('id', authIds);
    (pr.data || []).forEach(p => { profiles[p.id] = p; });
  }

  const apOf = uuid => ctx.legacyOf.apartments?.[uuid] || null;

  D.users = (mem.data || []).map(m => {
    const p = profiles[m.user_id] || {};
    const apLegacy = apOf(m.apartment_id);
    const ap = apLegacy ? D.apartments.find(a => a.id === apLegacy) : null;
    return {
      id: m.id,
      username: apLegacy || (p.phone_e164 || '').replace('+','') || m.user_id.slice(0,8),
      name: p.full_name || (ap ? ap.ownerName : ''),
      role: m.role === 'admin' ? 'admin' : (m.role === 'tenant' ? 'tenant' : 'owner'),
      apartmentId: apLegacy,
      phoneCountry: p.phone_country || '+20',
      phone: p.phone || '',
      email: p.email || '',
      active: m.active !== false,
      inviteStatus: 'joined',
      __authId: m.user_id,
      __membershipId: m.id,
    };
  });

  // الدعوات اللي لسه مستنية
  const inv = await sb.from('invitations')
    .select('*').eq('building_id', buildingUuid).eq('status','pending');

  (inv.data || []).forEach(v => {
    const apLegacy = apOf(v.apartment_id);
    const ap = apLegacy ? D.apartments.find(a => a.id === apLegacy) : null;
    if (apLegacy && D.users.some(u => u.apartmentId === apLegacy)) return;
    D.users.push({
      id: 'inv_' + v.id,
      username: apLegacy || v.phone_e164 || v.email || '',
      name: ap ? ap.ownerName : '',
      role: v.role === 'admin' ? 'admin' : (v.role === 'tenant' ? 'tenant' : 'owner'),
      apartmentId: apLegacy,
      phoneCountry: v.phone_country || '+20',
      phone: v.phone || '',
      email: v.email || '',
      active: false,
      inviteStatus: 'pending',
      inviteCode: v.invite_code,
      __inviteId: v.id,
    });
  });

  D.__invitations = inv.data || [];

  cache.uuid[legacyId]   = ctx.uuidOf;
  cache.legacy[legacyId] = ctx.legacyOf;
  cache.buildingUuid[legacyId] = buildingUuid;
  cache.snapshot[legacyId] = JSON.stringify(D);

  return D;
}


/* ============================================================
   5) الدفع للسحابة — بالفرق بس
   ============================================================ */

function diff(oldArr, newArr){
  const oldById = new Map((oldArr||[]).map(x => [x.id, x]));
  const newById = new Map((newArr||[]).map(x => [x.id, x]));
  const added = [], changed = [], removed = [];

  newById.forEach((item, id) => {
    const prev = oldById.get(id);
    if (!prev) added.push(item);
    else if (JSON.stringify(prev) !== JSON.stringify(item)) changed.push(item);
  });
  oldById.forEach((item, id) => { if (!newById.has(id)) removed.push(item); });

  return { added, changed, removed };
}

async function pushBuilding(legacyId){
  const D = cache.buildings[legacyId];
  const buildingUuid = cache.buildingUuid[legacyId];
  if (!D || !buildingUuid) return;

  const prev = JSON.parse(cache.snapshot[legacyId] || '{}');
  const ctx = {
    buildingId: buildingUuid,
    uuidOf: cache.uuid[legacyId] || {},
    legacyOf: cache.legacy[legacyId] || {},
  };

  // بيانات العمارة
  if (JSON.stringify(prev.building) !== JSON.stringify(D.building)){
    const row = {};
    for (const [appKey, col] of Object.entries(BUILDING_FIELDS)){
      if (D.building[appKey] !== undefined) row[col] = D.building[appKey];
    }
    const r = await sb.from('buildings').update(row).eq('id', buildingUuid);
    if (r.error) throw r.error;
  }

  const order = ['accounts','apartments','projects','vendors','expenses',
                 'transfers','ledger','maintenanceReports','meetings','polls',
                 'announcements','suggestions','paymentRequests','notifications',
                 'buildingChat','activityLog'];

  for (const coll of order){
    const map = MAPS[coll];
    const { added, changed, removed } = diff(prev[coll], D[coll]);
    if (!added.length && !changed.length && !removed.length) continue;

    if (added.length){
      const rows = added.map(x => toDB(x, map, ctx));
      const r = await sb.from(map.table).insert(rows).select('id,legacy_id');
      if (r.error) throw r.error;
      // سجّل الـ uuid الجديد
      ctx.uuidOf[coll] = ctx.uuidOf[coll] || {};
      ctx.legacyOf[coll] = ctx.legacyOf[coll] || {};
      r.data.forEach(row => {
        ctx.uuidOf[coll][row.legacy_id] = row.id;
        ctx.legacyOf[coll][row.id] = row.legacy_id;
      });
    }

    for (const item of changed){
      const uuid = item.__uuid || ctx.uuidOf[coll]?.[item.id];
      if (!uuid) continue;
      const r = await sb.from(map.table).update(toDB(item, map, ctx)).eq('id', uuid);
      if (r.error) throw r.error;
    }

    for (const item of removed){
      const uuid = item.__uuid || ctx.uuidOf[coll]?.[item.id];
      if (!uuid) continue;
      const r = await sb.from(map.table).delete().eq('id', uuid);
      if (r.error) throw r.error;
    }
  }

  // فئات المصروفات
  const prevCats = (prev.expenseCategories || []).join('|');
  const nowCats  = (D.expenseCategories  || []).join('|');
  if (prevCats !== nowCats){
    await sb.from('expense_categories').delete().eq('building_id', buildingUuid);
    if (D.expenseCategories?.length){
      await sb.from('expense_categories').insert(
        D.expenseCategories.map((name,i) => ({ building_id:buildingUuid, name, sort_order:i }))
      );
    }
  }

  cache.snapshot[legacyId] = JSON.stringify(D);
}


/* ============================================================
   6) طابور المزامنة
   ============================================================ */

let flushTimer = null;

function queue(legacyId){
  cache.dirty.add(legacyId);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 600);   // بنجمّع التعديلات المتتالية
}

async function flush(){
  if (cache.syncing || !cache.online || !cache.dirty.size) return;
  cache.syncing = true;
  setStatus('saving');

  const ids = [...cache.dirty];
  cache.dirty.clear();

  try{
    for (const id of ids) await pushBuilding(id);
    cache.lastError = null;
    setStatus('saved');
  }catch(e){
    cache.lastError = e;
    ids.forEach(id => cache.dirty.add(id));   // نرجّعها للطابور
    setStatus('error', e.message);
    console.error('[عمارتنا/سحابة] فشل الحفظ:', e);
  }finally{
    cache.syncing = false;
    if (cache.dirty.size) setTimeout(flush, 4000);
  }
}


/* ============================================================
   7) مؤشر الحالة — شريط صغير تحت
   ============================================================ */

function setStatus(state, msg){
  let el = document.getElementById('cloudStatus');
  if (!el){
    el = document.createElement('div');
    el.id = 'cloudStatus';
    el.style.cssText =
      'position:fixed;bottom:14px;inset-inline-start:14px;z-index:99999;' +
      'font:600 12px/1.6 system-ui,sans-serif;padding:6px 12px;border-radius:20px;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.14);transition:opacity .3s;pointer-events:none';
    document.body.appendChild(el);
  }
  const looks = {
    saving:{ t:'⟳ بيحفظ…',            bg:'#FDF3E3', c:'#8A5B12' },
    saved: { t:'✓ محفوظ في السحابة',   bg:'#E4F1E8', c:'#15803D' },
    error: { t:'⚠ الحفظ متأخر',        bg:'#FBE6E4', c:'#B4241C' },
    offline:{t:'⚠ مفيش نت — الشغل محفوظ محليًا', bg:'#FBE6E4', c:'#B4241C' },
  };
  const s = looks[state] || looks.saved;
  el.textContent = msg ? `${s.t} · ${msg}` : s.t;
  el.style.background = s.bg;
  el.style.color = s.c;
  el.style.opacity = '1';
  if (state === 'saved') setTimeout(() => { el.style.opacity = '0'; }, 2200);
}


/* ============================================================
   8) استبدال دوال البرنامج
   ============================================================ */

window.__cloudReady = false;

window.CLOUD = {

  /* تسجيل الدخول */
  async signIn(idOrEmail, password, country='+20'){
    const email = toLoginEmail(idOrEmail, country);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await CLOUD.bootstrap();
  },

  async signUp(idOrEmail, password, fullName, country='+20'){
    const email = toLoginEmail(idOrEmail, country);
    const isPhone = !String(idOrEmail).includes('@');
    const { error } = await sb.auth.signUp({
      email, password,
      options:{ data:{
        full_name: fullName || '',
        phone: isPhone ? idOrEmail : '',
        phone_country: country,
      }}
    });
    if (error) throw error;
  },

  async signOut(){
    await sb.auth.signOut();
    cache.buildings = {}; cache.registry = null; cache.snapshot = {};
    window.__cloudReady = false;
  },

  async currentUser(){
    const { data:{ user } } = await sb.auth.getUser();
    return user;
  },

  /* تحميل كل حاجة المستخدم يقدر يشوفها */
  async bootstrap(){
    const { data:{ user } } = await sb.auth.getUser();
    if (!user) { window.__cloudReady = false; return false; }

    const bs = await sb.from('buildings').select('*').eq('is_deleted', false);
    if (bs.error) throw bs.error;

    // REG لازم يبقى فيه كل الحقول اللي البرنامج بيتوقعها،
    // وإلا دوال ensure* بتقع. الفاضي منها البرنامج بيملاه بنفسه.
    cache.registry = {
      sysOwner: {
        username: 'sys', name: 'مسؤول المنصة',
        paymentMethods: [], aiSettings: null,
        phoneCountry: '+20', phone: '', email: '',
      },
      buildings: bs.data.map(b => ({
        id: b.code || b.id,
        __uuid: b.id,
        name: b.name,
        code: b.code,
        createdAt: b.created_at,
        city: b.city || '',
        country: b.country || 'مصر',
        governorate: b.governorate || '',
        address: b.address || '',
        apartmentsCount: b.apartments_count || 0,
        contactPhoneCountry: b.contact_phone_country || '+20',
        contactPhone: b.contact_phone || '',
        referralCode: b.referral_code || '',
        referredBy: b.referred_by || null,
        appliedCoupon: b.applied_coupon || null,
        signupSource: b.signup_source || '',
        license: {
          plan:   b.plan_key,
          start:  b.license_start,
          end:    b.license_end,
          status: b.license_status,
        },
      })),
      // طبقة المنصة — الجولة ٣
      plans: [], discountCoupons: [], landingOffers: [], landingBanners: [],
      landingSettings: null, brandSettings: null, legalSettings: null,
      marketingCards: [], marketingLeads: [], messageTemplates: [],
      renewalRequests: [], revenueLedger: [], referralRewards: [],
      customerProposals: [], supportTickets: [], supportStaff: [],
      teamTasks: [], versionHistory: [], sysActivityLog: [],
      sysNotifications: [], deletedBuildings: [], demoBuildingId: null,
    };

    for (const b of bs.data){
      const legacyId = b.code || b.id;
      try{
        cache.buildings[legacyId] = await fetchBuilding(b.id, legacyId);
      }catch(e){
        console.warn('[عمارتنا/سحابة] تعذّر تحميل عمارة', b.name, e.message);
      }
    }

    window.__cloudReady = true;
    return true;
  },

  /* ---------- الدعوات ---------- */
  invites: {

    /* دعوة واحدة لشقة */
    async create(legacyBuildingId, { apartmentId, phone, phoneCountry='+20', email, role='owner' }){
      const bUuid = cache.buildingUuid[legacyBuildingId];
      if (!bUuid) throw new Error('العمارة مش محمّلة');
      if (!phone && !email) throw new Error('لازم رقم موبايل أو إيميل');

      const apUuid = apartmentId
        ? cache.uuid[legacyBuildingId]?.apartments?.[apartmentId] : null;
      if (apartmentId && !apUuid) throw new Error('الشقة ' + apartmentId + ' مش موجودة');

      const { data, error } = await sb.from('invitations').insert({
        building_id: bUuid,
        apartment_id: apUuid,
        phone_country: phoneCountry,
        phone: phone || null,
        phone_e164: phone ? normPhone(phone, phoneCountry) : null,
        email: email || null,
        role,
      }).select().single();
      if (error) throw error;
      return data;
    },

    /* دعوات لكل الشقق اللي لسه مالهاش مستخدم — بأرقامها المسجّلة */
    async createForAll(legacyBuildingId){
      const D = cache.buildings[legacyBuildingId];
      if (!D) throw new Error('العمارة مش محمّلة');

      const taken = new Set(D.users.map(u => u.apartmentId).filter(Boolean));
      const targets = D.apartments.filter(a => !a.closed && !taken.has(a.id));

      const made = [], skipped = [];
      for (const ap of targets){
        if (!ap.phone){ skipped.push({ ap: ap.number, why: 'مفيش رقم موبايل' }); continue; }
        try{
          made.push(await CLOUD.invites.create(legacyBuildingId, {
            apartmentId: ap.id,
            phone: ap.phone,
            phoneCountry: ap.phoneCountry || '+20',
            email: ap.email || null,
            role: 'owner',
          }));
        }catch(e){ skipped.push({ ap: ap.number, why: e.message }); }
      }
      return { made, skipped };
    },

    async revoke(inviteId){
      const { error } = await sb.from('invitations')
        .update({ status:'revoked' }).eq('id', inviteId);
      if (error) throw error;
    },

    async list(legacyBuildingId){
      const bUuid = cache.buildingUuid[legacyBuildingId];
      const { data, error } = await sb.from('invitations')
        .select('*').eq('building_id', bUuid).order('created_at');
      if (error) throw error;
      return data;
    },

    /* رابط الانضمام اللي بيتبعت واتساب */
    link(code, base){
      const root = base || (location.origin + location.pathname.replace(/[^/]*$/, ''));
      return root + 'join.html?code=' + encodeURIComponent(code);
    },

    /* نص رسالة الواتساب */
    message(buildingName, apartmentLabel, code, base){
      return [
        `أهلًا 👋`,
        `دي دعوتك للانضمام لنظام "${buildingName}" على تطبيق عمارتنا.`,
        apartmentLabel ? `الوحدة: ${apartmentLabel}` : '',
        ``,
        `كود الدعوة: ${code}`,
        `الرابط: ${CLOUD.invites.link(code, base)}`,
        ``,
        `هتسجّل برقم موبايلك وتختار كلمة سر، وبعدها تقدر تشوف حسابك ومدفوعاتك في أي وقت.`,
      ].filter(Boolean).join('\n');
    },

    /* الساكن بينادي دي بعد ما يعمل حساب */
    async accept(code){
      const { data, error } = await sb.rpc('accept_invitation', { p_code: code || null });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      await CLOUD.bootstrap();
      return row ? {
        buildingId:  row.out_building_id,
        apartmentId: row.out_apartment_id,
        role:        row.out_role,
        building:    row.out_building,
      } : null;
    },
  },

  status(){
    return {
      online: cache.online,
      pending: cache.dirty.size,
      lastError: cache.lastError?.message || null,
      buildings: Object.keys(cache.buildings).length,
    };
  },

  /* لو حبيت تجبر مزامنة فورًا */
  syncNow: flush,
  _cache: cache,
  _sb: sb,
};

function normPhone(raw, country='+20'){
  let d = (raw || '').replace(/[^\d+]/g,'');
  if (!d) return null;
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('+'))  return d;
  return country + d.replace(/^0+/,'');
}

function toLoginEmail(raw, country='+20'){
  const v = (raw || '').trim();
  if (v.includes('@')) return v;
  let d = v.replace(/[^\d+]/g,'');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (!d.startsWith('+')) d = country + d.replace(/^0+/,'');
  return d.replace('+','') + '@emartna.local';
}


/* ---- الدوال الأربعة اللي البرنامج بيناديها ---- */

function emptyRegistry(){
  return {
    sysOwner:{ username:'sys', name:'', paymentMethods:[], aiSettings:null,
               phoneCountry:'+20', phone:'', email:'' },
    buildings:[], plans:[], discountCoupons:[], landingOffers:[], landingBanners:[],
    landingSettings:null, brandSettings:null, legalSettings:null,
    marketingCards:[], marketingLeads:[], messageTemplates:[],
    renewalRequests:[], revenueLedger:[], referralRewards:[],
    customerProposals:[], supportTickets:[], supportStaff:[],
    teamTasks:[], versionHistory:[], sysActivityLog:[],
    sysNotifications:[], deletedBuildings:[], demoBuildingId:null,
  };
}

window.loadRegistry = async function(){
  if (!cache.registry){
    try{ await CLOUD.bootstrap(); }catch(e){ console.warn('[عمارتنا/سحابة]', e.message); }
  }
  window.REG = cache.registry || emptyRegistry();
  return window.REG;
};

window.saveRegistry = function(){
  // بيانات المنصة بتتحدّث من لوحة المسؤول مباشرة — مفيش حاجة تتبعت هنا
};

window.loadBuildingData = function(id){
  return cache.buildings[id] || null;      // متزامن، من الكاش
};

window.saveBuildingData = function(id, data){
  cache.buildings[id] = data;              // فوري في الذاكرة
  queue(id);                               // والسحابة في الخلفية
};


/* ============================================================
   9) البداية
   ============================================================ */

(async () => {
  try{
    const { data:{ session } } = await sb.auth.getSession();
    if (session) await CLOUD.bootstrap();
  }catch(e){
    console.error('[عمارتنا/سحابة] فشل البدء:', e);
  }
  if (!cache.online) setStatus('offline');
  document.dispatchEvent(new CustomEvent('cloud:ready', { detail: CLOUD.status() }));
})();
