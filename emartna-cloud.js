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
      id:'legacy_id', number:'number', label:'label',
      blockName:'block_name', floor:'floor',
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
      imageDataUrl:'proof_url', username:'legacy_username',
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
  aiSettings:'ai_settings',
};


/* ============================================================
   2) الترجمة في الاتجاهين
   ============================================================ */

/* أعمدة التواريخ في قاعدة البيانات — الخانة الفاضية '' مش تاريخ صالح،
   لازم تروح null. من غير كده Postgres بيرفض الحفظ كله برسالة
   invalid input syntax for type date، والتغييرات بتفضل معلّقة. */
const DATE_COLS = new Set([
  'date','created_at','updated_at','resolved_at','reviewed_at','reminded_at',
  'deleted_at','demo_expires_at','last_backup_date','license_start','license_end',
  'contract_start','contract_end','requested_at','registered_at','converted_at',
  'opened_at','expires_at','sent_at','accepted_at','starts_at','ends_at',
]);

function cleanValue(col, v){
  if (v === undefined) return undefined;
  if (DATE_COLS.has(col)){
    if (v === '' || v === null) return null;
    if (typeof v === 'string' && !v.trim()) return null;
  }
  return v;
}

function toDB(item, map, ctx){
  const row = {};
  for (const [appKey, col] of Object.entries(map.fields)){
    if (item[appKey] !== undefined){
      const v = cleanValue(col, item[appKey]);
      if (v !== undefined) row[col] = v;
    }
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

/* قراءة كل صفوف جدول لعمارة معيّنة — على صفحات، عشان حد الـ١٠٠٠ صف */
const PAGE = 1000;
async function fetchAllRows(table, buildingUuid){
  const all = [];
  for (let from = 0; ; from += PAGE){
    const res = await sb.from(table).select('*')
      .eq('building_id', buildingUuid)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (res.error) return { data: all, error: res.error };
    const batch = res.data || [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    if (all.length > 200000) break;   // صمام أمان
  }
  return { data: all, error: null };
}

async function fetchBuilding(buildingUuid, legacyId){
  const ctx = { buildingId: buildingUuid, uuidOf:{}, legacyOf:{} };

  /* صف العمارة وبيانات الوحدات العامة بيتجابوا مع بعض بدل
     ما نستنى الأول يخلص وبعدين نطلب التاني. */
  const [b, unitsPub] = await Promise.all([
    sb.from('buildings').select('*').eq('id', buildingUuid).single(),
    sb.rpc('units_public', { b_id: buildingUuid }).then(r => r, () => ({ data:null })),
  ]);
  if (b.error) throw b.error;

  const D = { building:{} };
  for (const [appKey, col] of Object.entries(BUILDING_FIELDS)){
    if (b.data[col] !== null && b.data[col] !== undefined) D.building[appKey] = b.data[col];
  }
  D.building.code  = b.data.code;      // كود دخول الملاك
  D.building.__uuid = b.data.id;

  /* الترتيب مهم: الجداول المرجعية الأول.
     والتقسيم لمرحلتين: اللي الشاشة الأولى محتاجاه فعلًا (CORE)
     بيتجاب ويترسم، والباقي بيكمّل في الخلفية — بدل ما المستخدم
     يستنى ١٦ جدول قبل ما يشوف أي حاجة. */
  const CORE = ['accounts','apartments','projects','vendors','expenses',
                'transfers','ledger'];
  const REST = ['maintenanceReports','meetings','polls','announcements',
                'suggestions','paymentRequests','notifications',
                'buildingChat','activityLog'];
  const order = CORE.concat(REST);

  // نجيب كل الجداول مرة واحدة بالتوازي — أسرع بكتير من واحد ورا التاني.
  // مهم: Supabase بيرجّع ١٠٠٠ صف كحد أقصى للطلب الواحد من غير أي رسالة خطأ،
  // فلازم نقسّم القراءة على صفحات لحد ما الجدول يخلص. من غير كده، عمارة
  // عندها أكتر من ١٠٠٠ حركة كانت هتتحمّل ناقصة، وأول حفظ بعدها كان هيمسح
  // الحركات الناقصة من الخادم نهائيًا.
  // المرحلة الأولى: الجداول الأساسية بس
  const coreRes = await Promise.all(CORE.map(c => fetchAllRows(MAPS[c].table, buildingUuid)));

  // المرحلة التانية بتتطلب دلوقتي وبنستناها بس لو المستخدم احتاجها
  const restPromise = Promise.all(REST.map(c => fetchAllRows(MAPS[c].table, buildingUuid)));

  const fetched = coreRes.concat(REST.map(() => ({ data: [], error: null })));

  for (let oi = 0; oi < order.length; oi++){
    const coll = order[oi];
    const map = MAPS[coll];
    let res = fetched[oi];

    // الساكن العادي مايقراش جدول الشقق كله — بياخد البيانات العامة
    // من دالة units_public، وشقته هو بتيجي كاملة من الجدول.
    if (coll === 'apartments'){
      const pub = unitsPub || { data:null };     // اتجابت بالتوازي فوق
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

  // اسم الدور لازم يطابق صيغة البرنامج بالظبط ("الدور الأول" مش "الأول")
  // وإلا شكل العمارة مابيعرفش يجمّع الوحدات.
  (D.apartments || []).forEach(a => {
    const f = String(a.floor || '').trim();
    if (f && !f.startsWith('الدور')) a.floor = 'الدور ' + f;
  });

  // فئات المصروفات + العضويات + الدعوات — كلهم مع بعض
  const [cats, mem, inv] = await Promise.all([
    sb.from('expense_categories').select('name')
      .eq('building_id', buildingUuid).order('sort_order'),
    sb.from('memberships').select('id,user_id,apartment_id,role,active')
      .eq('building_id', buildingUuid),
    sb.from('invitations').select('*')
      .eq('building_id', buildingUuid).eq('status','pending'),
  ]);
  D.expenseCategories = (cats.data || []).map(c => c.name);

  // ---- المستخدمين ----
  // البرنامج محتاج D.users. بنبنيها من مصدرين:
  //   1) العضويات = ناس عملوا حساب فعلًا
  //   2) الدعوات   = ناس رئيس الاتحاد سجّل أرقامهم وبيستنوا
  // كل صف فيه inviteStatus عشان الشاشة تعرف تعرض الحالة.

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
      role: m.role || 'owner',
      permissions: m.permissions || null,
      roleTemplate: m.role_template || null,
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
  (inv.data || []).forEach(v => {
    const apLegacy = apOf(v.apartment_id);
    const ap = apLegacy ? D.apartments.find(a => a.id === apLegacy) : null;
    if (apLegacy && D.users.some(u => u.apartmentId === apLegacy)) return;
    D.users.push({
      id: 'inv_' + v.id,
      username: apLegacy || v.phone_e164 || v.email || '',
      name: ap ? ap.ownerName : '',
      role: v.role || 'owner',
      permissions: v.permissions || null,
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

  /* باقي الجداول بتكمّل في الخلفية وبتتحط في نفس الكائن،
     وبعدين نعيد الرسم عشان الشاشة تتحدّث لوحدها. */
  D.__loading = true;
  restPromise.then(restRes => {
    try{
      REST.forEach((coll, i) => {
        const map = MAPS[coll];
        const res = restRes[i];
        if (!res || res.error) return;
        // لو المستخدم ضاف حاجة أثناء التحميل، منمسحهاش
        if (Array.isArray(D[coll]) && D[coll].length) return;
        ctx.uuidOf[coll] = {}; ctx.legacyOf[coll] = {};
        (res.data || []).forEach(r => {
          const lid = r.legacy_id || r.id;
          ctx.uuidOf[coll][lid] = r.id;
          ctx.legacyOf[coll][r.id] = lid;
        });
        D[coll] = (res.data || []).map(r => toApp(r, map, ctx));
      });
      cache.uuid[legacyId]   = ctx.uuidOf;
      cache.legacy[legacyId] = ctx.legacyOf;
      D.__loading = false;
      cache.snapshot[legacyId] = JSON.stringify(D);
      // نعيد الرسم بس لو المستخدم لسه في نفس العمارة
      if (window.activeBuildingId === legacyId && window.renderContent){
        try{ renderContent(); }catch(e){}
      }
      document.dispatchEvent(new CustomEvent('emartna:building-complete',
        { detail:{ id: legacyId } }));
    }catch(e){ D.__loading = false; }
  }).catch(() => { D.__loading = false; });

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

    // صمام أمان: لو الحذف طال أكتر من نص الصفوف مرة واحدة، ده على الأرجح
    // تحميل ناقص مش حذف حقيقي من المستخدم — نوقف بدل ما نمسح بيانات صح.
    const prevCount = (prev[coll] || []).length;
    if (removed.length > 20 && prevCount && removed.length > prevCount / 2){
      throw new Error(
        'تم إيقاف الحفظ للحماية: الحفظ ده كان هيمسح ' + removed.length +
        ' سجل من "' + map.table + '". حدّث الصفحة وجرّب تاني، ولو تكرر بلّغ الدعم.');
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

/* ============================================================
   مترجم الأخطاء — رسالة عربية واضحة لكل نوع خطأ
   ============================================================ */

const ERR_BY_CODE = {
  '23505': 'البيانات دي متسجّلة قبل كده (قيمة مكررة).',
  '23503': 'العنصر ده مرتبط ببيانات تانية، أو بيشير لحاجة اتحذفت.',
  '23514': 'قيمة مرفوضة — في خانة مش مستوفية شروط النظام.',
  '23502': 'في خانة إلزامية فاضية.',
  '22P02': 'صيغة قيمة غلط (رقم أو تاريخ مش مظبوط).',
  '42501': 'مالكش صلاحية للعملية دي.',
  '42703': 'في حقل مش موجود في قاعدة البيانات — محتاج تحديث النسخة.',
  '42883': 'دالة مطلوبة مش موجودة على الخادم — محتاج تحديث النسخة.',
  'PGRST301': 'الجلسة انتهت — سجّل دخول تاني.',
  'PGRST116': 'السجل مش موجود — يمكن اتحذف من جهاز تاني.',
};

const ERR_BY_STATUS = {
  400: 'الطلب غير صالح — راجع البيانات المدخلة.',
  401: 'الجلسة انتهت — سجّل دخول تاني.',
  403: 'مالكش صلاحية للعملية دي.',
  404: 'السجل مش موجود — يمكن اتحذف من جهاز تاني.',
  409: 'في تعارض — البيانات اتغيّرت من جهاز تاني. حدّث الصفحة.',
  413: 'الملف كبير جدًا.',
  422: 'البيانات مرفوضة من الخادم — راجع الخانات.',
  429: 'طلبات كتير في وقت قصير — استنى شوية وجرّب تاني.',
  500: 'عطل مؤقت في الخادم — جرّب تاني بعد شوية.',
  502: 'عطل مؤقت في الخادم — جرّب تاني بعد شوية.',
  503: 'الخدمة مش متاحة دلوقتي — جرّب تاني بعد شوية.',
};

window.cloudErrorText = function(e){
  if (!e) return 'حصل خطأ غير معروف';
  const raw = String(e.message || e || '');
  if (/Failed to fetch|NetworkError|network/i.test(raw))
    return 'مفيش اتصال بالإنترنت — شغلك محفوظ محليًا وهيتزامن أول ما النت يرجع.';
  if (/JWT|token is expired|Invalid Refresh/i.test(raw))
    return 'الجلسة انتهت — سجّل دخول تاني.';
  if (e.code && ERR_BY_CODE[e.code]) return ERR_BY_CODE[e.code];
  if (e.status && ERR_BY_STATUS[e.status]) return ERR_BY_STATUS[e.status];
  if (/row-level security|violates row-level/i.test(raw))
    return 'مالكش صلاحية للعملية دي.';
  if (/duplicate key/i.test(raw)) return ERR_BY_CODE['23505'];
  if (/check constraint/i.test(raw)) return ERR_BY_CODE['23514'];
  if (/does not exist/i.test(raw)) return 'حاجة مطلوبة مش موجودة على الخادم — محتاج تحديث النسخة.';
  return raw.slice(0, 140);
};

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
    window.__cloudLastErrorRaw = (e && (e.message || e.code)) ? ((e.code||'') + ' ' + (e.message||'')) : String(e);
    setStatus('error', window.cloudErrorText(e));
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
    // مهم: المؤشر كان فوق زرار "تسجيل الخروج" في الشريط الجانبي فبيبلع
    // الضغطة. بقى في الناحية التانية، وبيقبل الضغط وقت المشكلة بس.
    el.style.cssText =
      'position:fixed;bottom:14px;inset-inline-end:14px;z-index:9000;' +
      'font:600 12px/1.6 system-ui,sans-serif;padding:6px 12px;border-radius:20px;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.14);transition:opacity .3s;' +
      'pointer-events:none;max-width:60vw';
    el.onclick = () => window.showCloudSyncDetails && window.showCloudSyncDetails();
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
  // الضغط متاح وقت المشكلة بس — عشان مايتعارضش مع أزرار الواجهة
  el.style.pointerEvents = (state === 'error') ? 'auto' : 'none';
  el.style.cursor        = (state === 'error') ? 'pointer' : 'default';
  if (state === 'saved') setTimeout(() => {
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  }, 2200);
}


window.retryCloudSync = function(){
  cache.online = navigator.onLine !== false;
  flush();
};

window.showCloudSyncDetails = function(){
  const pending = cache.dirty.size;
  const err = cache.lastError;
  const body = `
    <h3>${err ? '⚠️ في تغييرات لسه ما اتحفظتش' : '✓ كل حاجة محفوظة'}</h3>
    ${err ? `<p class="small mtop">${window.esc ? esc(window.cloudErrorText(err)) : window.cloudErrorText(err)}</p>
      <p class="small">عدد العناصر المنتظرة: <b>${pending}</b>. شغلك موجود على الجهاز، وهيتبعت أول ما المشكلة تتحل.</p>
      <div style="background:var(--inputbg,#fffdf8);border:1px solid var(--line,#e3e8e6);border-radius:9px;
                  padding:8px;font:12px/1.6 monospace;direction:ltr;text-align:left;white-space:pre-wrap;
                  max-height:140px;overflow:auto;margin-top:10px">${window.esc ? esc(window.__cloudLastErrorRaw||'') : (window.__cloudLastErrorRaw||'')}</div>`
    : '<p class="small mtop">مفيش تغييرات منتظرة. آخر حفظ تم بنجاح.</p>'}
    <div class="modal-actions">
      ${err ? '<button class="btn primary" onclick="retryCloudSync();closeModal()">🔄 حاول تاني</button>' : ''}
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`;
  if (window.openModal) openModal(body);
  else alert(window.cloudErrorText(err));
};

/* تحذير قبل قفل الصفحة لو في تغييرات ما اتحفظتش */
window.addEventListener('beforeunload', e => {
  if (cache.dirty.size){ e.preventDefault(); e.returnValue = ''; }
});

/* أول ما المستخدم يسيب الصفحة (تبديل تبويب · قفل الشاشة · خروج من
   التطبيق على الموبايل) بنرسل فورًا من غير انتظار الـ٦٠٠ مللي.
   ده بيقفل الفجوة اللي كانت ممكن تضيّع آخر تعديل على الموبايل،
   لأن beforeunload مش مضمون هناك. */
function flushNow(){
  try{
    if (!cache.dirty.size || cache.syncing) return;
    clearTimeout(flushTimer);
    flush();
  }catch(e){}
}
window.flushNow = flushNow;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushNow();
});
window.addEventListener('pagehide', flushNow);
window.addEventListener('blur', flushNow);

/* وقبل تسجيل الخروج كمان */
(function guardLogout(){
  const wrap = () => {
    const orig = window.logout;
    if (typeof orig !== 'function' || orig.__flushed) return;
    const w = async function(){
      flushNow();
      // ننتظر شوية لحد ما الطابور يفضى (بحد أقصى ٣ ثواني)
      for (let i = 0; i < 30 && cache.dirty.size; i++)
        await new Promise(r => setTimeout(r, 100));
      return orig.apply(this, arguments);
    };
    w.__flushed = true;
    window.logout = w;
  };
  wrap();
  [1500, 4000].forEach(ms => setTimeout(wrap, ms));
})();

/* ============================================================
   8) استبدال دوال البرنامج
   ============================================================ */

window.__cloudReady = false;

const CLOUD = {

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
    /* getUser بترحّل للخادم في كل مرة. getSession بتقرا الجلسة
       المحفوظة محليًا وفيها نفس بيانات المستخدم — فوّفرنا رحلة كاملة. */
    let user = null;
    try{
      const { data:{ session } } = await sb.auth.getSession();
      user = session && session.user;
    }catch(e){}
    if (!user){
      const r = await sb.auth.getUser();
      user = r && r.data && r.data.user;
    }
    if (!user) { window.__cloudReady = false; return false; }

    /* كل استعلامات البدء بالتوازي — كانت أربع رحلات ورا بعض،
       وكل رحلة لفرانكفورت بتاخد ٢٠٠-٤٠٠ مللي ثانية. */
    const [bs, plansRes, offersRes, docsRes, mine] = await Promise.all([
      sb.from('buildings').select('*').eq('is_deleted', false),
      sb.from('plans').select('*').order('sort_order'),
      sb.from('landing_offers').select('*').order('created_at'),
      sb.from('platform_settings').select('key,value').like('key', 'reg:%'),
      // العضويات كانت رحلة منفصلة بعد كل ده — دلوقتي بتيجي معاهم
      sb.from('memberships').select('building_id').eq('user_id', user.id).eq('active', true),
    ]);
    if (bs.error) throw bs.error;

    const plans = (plansRes.data || []).map(p => ({
      key: p.key, name: p.name, icon: p.features?.icon || '💳',
      priceBefore: Number(p.price_before) || 0,
      discountPercent: Number(p.discount_percent) || 0,
      durationMonths: p.duration_months,
      maxApartments: p.max_apartments,
      maxTransactions: p.max_transactions,
      isTrial: !!p.is_trial, active: p.active !== false,
    }));

    const offers = (offersRes.data || []).map(o => ({
      id: o.id, title: o.title,
      subtitle:  o.description?.subtitle  || '',
      features:  o.description?.features  || [],
      ctaText:   o.description?.ctaText   || 'جرب الآن مجانًا',
      footnote:  o.description?.footnote  || '',
      targetAudience: o.description?.targetAudience || 'new',
      imageUrl: o.image_url || '',
      theme: o.theme || null,
      trialDays: o.trial_days, planKey: o.plan_key || 'custom',
      active: o.active !== false,
      createdAt: o.created_at,
    }));

    // REG لازم يبقى فيه كل الحقول اللي البرنامج بيتوقعها،
    // وإلا دوال ensure* بتقع. الفاضي منها البرنامج بيملاه بنفسه.
    // بيانات صاحب البرنامج العامة (تواصل · دفع · روابط) محفوظة
    // كمستند على الخادم. لازم نقراها هنا — من غير كده بتتكتب
    // من متصفح ومتظهرش في متصفح تاني.
    // كل مستندات المنصة اللي مسموح للمستخدم يقراها — مش بيانات
    // صاحب البرنامج بس. من غير كده أي مستخدم بيشوف النسخة
    // المحلية القديمة (سجل الإصدارات · الهوية · نصوص الصفحة).
    let sysPub = {};
    const docs = {};
    try{
      const r = docsRes || { data: [] };          // اتجابت مع الباقي فوق
      (r.data || []).forEach(row => {
        const k = String(row.key || '').replace(/^reg:/, '');
        if (k === 'sysOwnerPublic'){
          if (row.value && typeof row.value === 'object') sysPub = row.value;
        }else if (row.value !== null && row.value !== undefined){
          docs[k] = row.value;
        }
      });
    }catch(e){}

    cache.registry = {
      sysOwner: Object.assign({
        username: 'sys', name: 'مسؤول المنصة',
        paymentMethods: [], aiSettings: null,
        phoneCountry: '+20', phone: '', email: '',
      }, sysPub),
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
        isDemo: !!b.is_demo,
        demoExpiresAt: b.demo_expires_at || null,
        adminName: b.admin_name || '',
        adminEmail: b.admin_email || '',
        facebookUrl: b.facebook_url || '',
        claimedOfferId: b.claimed_offer_id || null,
        referralRewardGiven: !!b.referral_reward_given,
        lastAdminLoginAt: b.last_admin_login_at || null,
        lastAdminLoginName: b.last_admin_login_name || '',
        // مهم: البرنامج بيقرا الترخيص بأسماء startDate/endDate/plan/status.
        // كان بيتبني بأسماء تانية (start/end) فالشاشة كانت تقول
        // "بلا تاريخ انتهاء" و"الخطة null" وتحسبه منتهي — رغم إن
        // الخادم مسجّل التواريخ صح.
        license: {
          plan:      b.plan_key || 'custom',
          status:    b.license_status || 'trial',
          startDate: b.license_start || null,
          endDate:   b.license_end   || null,
          maxApartments:   null,
          maxTransactions: null,
          notes: '',
        },
      })),
      // طبقة المنصة — الجولة ٣
      plans: plans.length ? plans : [],
      discountCoupons: [], landingBanners: [],
      landingOffers: offers.length ? offers : null,
      landingSettings: null, brandSettings: null, legalSettings: null,
      marketingCards: [], marketingLeads: [], messageTemplates: [],
      renewalRequests: [], revenueLedger: [], referralRewards: [],
      customerProposals: [], supportTickets: [], supportStaff: [],
      teamTasks: [], versionHistory: null, sysActivityLog: [],
      sysNotifications: [], deletedBuildings: [], demoBuildingId: null,
    };

    // مسؤول المنصة ممكن يشوف عشرات العمارات — مانحمّلش بياناتهم كلها
    // عند الدخول. بنحمّل بس العمارات اللي هو عضو فيها فعلًا.
    const myIds = new Set((mine.data || []).map(m => m.building_id));

    const toLoad = bs.data.filter(b => myIds.has(b.id));

    await Promise.all(toLoad.map(async b => {
      const legacyId = b.code || b.id;
      try{
        cache.buildings[legacyId] = await fetchBuilding(b.id, legacyId);
      }catch(e){
        console.warn('[عمارتنا/سحابة] تعذّر تحميل عمارة', b.name, e.message);
      }
    }));

    // المستندات اللي جت من الخادم بتغلب النسخة الافتراضية المحلية
    Object.keys(docs).forEach(k => { cache.registry[k] = docs[k]; });

    window.__cloudReady = true;
    window.__bootError = null;

    // مهم: لو البرنامج بدأ قبل ما التحميل يخلص، بيكون REG وقتها
    // "سجل فاضي" مؤقت. لازم نبدّله بالحقيقي ونعيد الرسم، وإلا
    // العمارات بتفضل صفر لحد ما المستخدم يحدّث الصفحة بنفسه.
    if (window.REG && window.REG !== cache.registry){
      window.REG = cache.registry;
      try{
        if (window.getSession && getSession() && window.renderRoot) renderRoot();
      }catch(e){ console.warn('[عمارتنا/سحابة] إعادة الرسم', e.message); }
    }
    return true;
  },

  /* ---------- الدعوات ---------- */
  invites: {

    /* دعوة واحدة لشقة */
    async create(legacyBuildingId, { apartmentId, phone, phoneCountry='+20',
                                     email, role='owner', permissions=null }){
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
        permissions,
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

  /* تحميل عمارة عند الطلب — لمسؤول المنصة */
  async loadBuilding(codeOrUuid){
    const b = (cache.registry?.buildings || []).find(
      x => x.id === codeOrUuid || x.__uuid === codeOrUuid || x.code === codeOrUuid);
    if (!b) throw new Error('العمارة مش موجودة');
    if (cache.buildings[b.id]) return cache.buildings[b.id];
    cache.buildings[b.id] = await fetchBuilding(b.__uuid, b.id);
    return cache.buildings[b.id];
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

/* ============================================================
   التخزين — الصور في Supabase Storage مش في قاعدة البيانات
   المسار: proofs/{عمارة}/{شقة}/{ملف}
   ============================================================ */

const STORAGE_PREFIX = 'storage:';
const signedCache = new Map();          // ref → { url, exp }

function dataUrlToBlob(dataUrl){
  const [head, b64] = String(dataUrl).split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64 || '');
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

CLOUD.storage = {
  /* هل المرجع ده متخزّن في Storage؟ */
  isRef: v => typeof v === 'string' && v.startsWith(STORAGE_PREFIX),

  /* يرفع صورة (dataURL) ويرجّع مرجع نصّي يتخزّن في قاعدة البيانات */
  async uploadDataUrl(bucket, folders, dataUrl, ext){
    if (!dataUrl) return null;
    if (CLOUD.storage.isRef(dataUrl)) return dataUrl;        // مرفوعة قبل كده
    const blob = dataUrlToBlob(dataUrl);
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) +
                 '.' + (ext || (blob.type === 'application/pdf' ? 'pdf' : 'jpg'));
    const path = folders.filter(Boolean).join('/') + '/' + name;
    const { error } = await sb.storage.from(bucket)
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    return STORAGE_PREFIX + bucket + '/' + path;
  },

  /* يحوّل المرجع لرابط مؤقت للعرض */
  async url(ref){
    if (!ref) return null;
    if (!CLOUD.storage.isRef(ref)) return ref;               // dataURL قديمة — تتعرض زي ما هي
    const hit = signedCache.get(ref);
    if (hit && hit.exp > Date.now()) return hit.url;
    const rest = ref.slice(STORAGE_PREFIX.length);
    const bucket = rest.slice(0, rest.indexOf('/'));
    const path   = rest.slice(rest.indexOf('/') + 1);
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    signedCache.set(ref, { url: data.signedUrl, exp: Date.now() + 3000 * 1000 });
    return data.signedUrl;
  },

  async remove(ref){
    if (!CLOUD.storage.isRef(ref)) return;
    const rest = ref.slice(STORAGE_PREFIX.length);
    const bucket = rest.slice(0, rest.indexOf('/'));
    const path   = rest.slice(rest.indexOf('/') + 1);
    await sb.storage.from(bucket).remove([path]);
    signedCache.delete(ref);
  },

  uuidOfBuilding: legacyId => cache.buildingUuid[legacyId] || null,
  uuidOfApartment(legacyBuildingId, apLegacyId){
    const m = cache.uuid[legacyBuildingId];
    return (m && m.apartments && m.apartments[apLegacyId]) || null;
  },
};

/* أي <img data-ref="storage:..."> بيتحوّل لرابط مؤقت بعد الرسم */
window.hydrateStorageImages = async function(root){
  const els = (root || document).querySelectorAll('img[data-ref],a[data-ref]');
  for (const el of els){
    const ref = el.getAttribute('data-ref');
    el.removeAttribute('data-ref');
    try{
      const u = await CLOUD.storage.url(ref);
      if (el.tagName === 'IMG') el.src = u; else el.href = u;
    }catch(e){
      if (el.tagName === 'IMG') el.alt = 'تعذّر تحميل الصورة';
      console.warn('[عمارتنا/تخزين]', window.cloudErrorText(e));
    }
  }
};

/* وسم صورة: بيشتغل مع الصور القديمة (dataURL) والجديدة (Storage) */
window.imgTag = function(ref, style){
  if (!ref) return '';
  const st = style || 'width:100%;border-radius:8px';
  return CLOUD.storage.isRef(ref)
    ? `<img data-ref="${ref}" style="${st}" alt="جاري التحميل…">`
    : `<img src="${ref}" style="${st}">`;
};

/* عدد التغييرات اللي لسه ما اتحفظتش — بيستخدمه تأكيد الخروج.
   لازم تتعرّف بعد CLOUD نفسها، مش قبلها. */
CLOUD.pendingCount = () => cache.dirty.size;

window.CLOUD = CLOUD;

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
    buildings:[], plans:[], discountCoupons:[], landingOffers:null, landingBanners:[],
    landingSettings:null, brandSettings:null, legalSettings:null,
    marketingCards:[], marketingLeads:[], messageTemplates:[],
    renewalRequests:[], revenueLedger:[], referralRewards:[],
    customerProposals:[], supportTickets:[], supportStaff:[],
    teamTasks:[], versionHistory:null, sysActivityLog:[],
    sysNotifications:[], deletedBuildings:[], demoBuildingId:null,
  };
}

window.loadRegistry = async function(){
  if (!cache.registry){
    try{ await CLOUD.bootstrap(); }
    catch(e){
      window.__bootError = e;
      console.warn('[عمارتنا/سحابة]', e.message);
      showBootError(e);
    }
  }
  window.REG = cache.registry || emptyRegistry();
  return window.REG;
};

/* شريط أحمر أعلى الشاشة لو تحميل البيانات فشل — بدل ما تبان الشاشة فاضية */
function showBootError(e){
  if (document.getElementById('bootErrBar')) return;
  const bar = document.createElement('div');
  bar.id = 'bootErrBar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#c23b3b;' +
    'color:#fff;padding:10px 14px;font:13px/1.7 system-ui;text-align:center;direction:rtl';
  bar.innerHTML = '⚠️ تعذّر تحميل بياناتك من الخادم — ' +
    (window.cloudErrorText ? cloudErrorText(e) : (e && e.message || '')) +
    ' <button onclick="retryBoot()" style="margin-inline-start:10px;background:#fff;color:#c23b3b;' +
    'border:0;border-radius:6px;padding:4px 12px;cursor:pointer;font-weight:700">🔄 حاول تاني</button>';
  document.body.appendChild(bar);
}

window.retryBoot = async function(){
  const bar = document.getElementById('bootErrBar');
  if (bar) bar.remove();
  try{
    await CLOUD.bootstrap();
    window.REG = cache.registry || window.REG;
    if (window.renderRoot) renderRoot();
  }catch(e){ showBootError(e); }
};

/* ---- حفظ بيانات المنصة (خطط · عروض) ---- */
let __regTimer = null;

async function pushRegistry(){
  const REG = window.REG;
  if (!REG) return;
  // الخطط والعروض بيكتبها صاحب البرنامج بس. من غير الشرط ده،
  // أي ساكن بيقدّم مقترح كان بيحاول يكتب في جدول الخطط
  // فالخادم يرفض ويقول "الحفظ متأخر" لعملية مالهاش علاقة أصلًا.
  if (!(window.CLOUD_AUTH && CLOUD_AUTH.isPlatformAdmin)) return;
  try{
    // الخطط
    if (Array.isArray(REG.plans) && REG.plans.length){
      const rows = REG.plans.map((p, i) => ({
        key: p.key,
        name: p.name || '',
        price: Math.max(0, (Number(p.priceBefore)||0) *
                (1 - (Number(p.discountPercent)||0)/100)),
        price_before: Number(p.priceBefore) || 0,
        discount_percent: Number(p.discountPercent) || 0,
        duration_months: p.durationMonths || null,
        max_apartments: p.maxApartments || null,
        max_transactions: p.maxTransactions || null,
        is_trial: !!p.isTrial,
        active: p.active !== false,
        features: { icon: p.icon || '💳' },
        sort_order: i,
      }));
      const r = await sb.from('plans').upsert(rows, { onConflict:'key' });
      if (r.error) throw r.error;

      // امسح الخطط اللي المستخدم حذفها
      const keys = rows.map(r => r.key);
      const ex = await sb.from('plans').select('key');
      const gone = (ex.data || []).map(x => x.key).filter(k => !keys.includes(k));
      for (const k of gone) await sb.from('plans').delete().eq('key', k);
    }

    // العروض
    if (Array.isArray(REG.landingOffers)){
      const rows = REG.landingOffers.map(o => ({
        id: /^[0-9a-f-]{36}$/i.test(String(o.id)) ? o.id : undefined,
        title: o.title || '',
        description: {
          subtitle: o.subtitle || '', features: o.features || [],
          ctaText: o.ctaText || '', footnote: o.footnote || '',
          targetAudience: o.targetAudience || 'new',
        },
        plan_key: o.planKey || null,
        trial_days: Number(o.trialDays) || null,
        active: o.active !== false,
        image_url: o.imageUrl || null,
        theme: o.theme || null,
      }));
      for (let i = 0; i < rows.length; i++){
        const row = rows[i];
        const local = REG.landingOffers[i];
        if (row.id){
          const r = await sb.from('landing_offers').update(row).eq('id', row.id);
          if (r.error) throw r.error;
        } else {
          // العرض الافتراضي اللي البرنامج ولّده محليًا — أول حفظ بينشئه
          const { id, ...body } = row;
          const ins = await sb.from('landing_offers').insert(body).select('id');
          if (ins.error) throw ins.error;
          const newId = ins.data && ins.data[0] && ins.data[0].id;
          if (newId && local) local.id = newId;   // نربطه بالسحابة
        }
      }

      // امسح العروض اللي اتحذفت
      const keep = REG.landingOffers.map(o => o.id).filter(Boolean);
      const exo = await sb.from('landing_offers').select('id');
      for (const r of (exo.data || [])){
        if (!keep.includes(r.id)) await sb.from('landing_offers').delete().eq('id', r.id);
      }
    }

    cache.lastError = null;
    setStatus('saved');
  }catch(e){
    cache.lastError = e;
    setStatus('error', e.message);
    console.error('[عمارتنا/سحابة] فشل حفظ بيانات المنصة:', e);
  }
}

window.saveRegistry = function(){
  clearTimeout(__regTimer);
  __regTimer = setTimeout(pushRegistry, 600);
};

window.loadBuildingData = function(id){
  return cache.buildings[id] || null;      // متزامن، من الكاش
};

/* تسجيل آخر دخول لرئيس الاتحاد — بيتنادى مرة واحدة لكل جلسة عمارة.
   الخادم نفسه بيتأكد من الصلاحية وبيحدّ التكرار لكل نصف ساعة. */
/* نبض العمارة التجريبية: بيمدّد صلاحيتها كل ٥ دقايق طول ما
   الزائر شغّال. أول ما يقفل التبويب، النبض بيقف والعمارة
   بتتمسح خلال نص ساعة بحد أقصى. */
(function demoHeartbeat(){
  let last = 0;
  setInterval(async () => {
    try{
      if (!window.isDemoSession || !isDemoSession()) return;
      const id = window.activeBuildingId;
      if (!id) return;
      const uuid = cache.buildingUuid[id];
      if (!uuid) return;
      if (Date.now() - last < 4.5 * 60 * 1000) return;
      last = Date.now();
      await sb.rpc('touch_demo', { p_building: uuid });
    }catch(e){}
  }, 60 * 1000);
})();

const __touched = new Set();
window.touchAdminLogin = async function(legacyId){
  try{
    if (!legacyId || __touched.has(legacyId)) return;
    __touched.add(legacyId);
    const uuid = cache.buildingUuid[legacyId];
    if (!uuid) return;
    await sb.rpc('touch_admin_login', { p_building: uuid });
  }catch(e){ /* مش مهم لو فشل — مجرد إحصائية */ }
};

/* تحميل عمارة مش متحمّلة (لصاحب البرنامج اللي بيشوف عمارات مش عضو فيها) */
window.CLOUD.loadBuilding = async function(legacyId){
  if (cache.buildings[legacyId]) return cache.buildings[legacyId];
  const rec = ((window.REG && window.REG.buildings) || []).find(b => b.id === legacyId);
  const uuid = (rec && rec.__uuid) || cache.buildingUuid[legacyId];
  if (!uuid) throw new Error('العمارة مش معروفة: ' + legacyId);
  cache.buildings[legacyId] = await fetchBuilding(uuid, legacyId);
  return cache.buildings[legacyId];
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
    window.__bootError = e;
    console.error('[عمارتنا/سحابة] فشل البدء:', e);
    showBootError(e);
  }
  if (!cache.online) setStatus('offline');
  document.dispatchEvent(new CustomEvent('cloud:ready', { detail: CLOUD.status() }));
})();
