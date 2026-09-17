/* ============================================================
   عمارتنا — Service Worker
   ------------------------------------------------------------
   الملفات اللي عليها بصمة نسخة (?v=2.46) بتتقرا من الكاش وخلاص —
   البصمة بتتغيّر مع كل إصدار، فمفيش داعي نسأل الشبكة. والباقي
   شبكة أولًا. ده اللي خلّى الطلبات من ٢٨٥ لـ١٣.

   ============================================================
   🔴 فخ الرفع — والإصلاح (٢٠٢٦-٠٩-١٦)
   ------------------------------------------------------------
   القاعدة القديمة: "أي ملف عليه بصمة = محتواه ثابت، خزّنه للأبد
   ومتسألش عنه تاني". وهي بتفترض إن الملف اللي وصل هو النسخة
   الصح — والافتراض ده بيقع لما GitHub Pages لسه مخلّصش نشر.

   حصل فعلًا: اترفع emartna-cloud.js ٨:٥٠:٢٢، والمتصفح طلبه
   ٨:٥٢:١١ — بعد دقيقة و٤٩ ثانية. Pages قدّم النسخة القديمة،
   والعامل ده خزّنها تحت اسم النسخة الجديدة وقفل عليها. النتيجة:
   ميزة كاملة بانت كأنها مش شغالة، والكود كان سليم.

   التلات تعديلات:
     ١) مخزن منفصل لكل نسخة — ملف اتخزّن غلط تحت 2.46 مايلوّثش
        2.47، والقديم بيتمسح لوحده.
     ٢) أول جلب بـ cache:'reload' — بيتخطّى كاش المتصفح نفسه،
        وهو طبقة قِدَم تانية كانت مخفية.
     ٣) حارس شامل — أي خطأ هنا معناه إن الطلب يعدّي للشبكة عادي.
        أسوأ حالة: البرنامج بطيء. مش: البرنامج ما يفتحش.
   ============================================================ */

const VERSION = 'v2';
const PREFIX  = 'omaretna-shell-';
const CACHE   = PREFIX + VERSION;          /* للملفات اللي بلا بصمة */

/* ملفات الشكل والكود — البيانات دايمًا من الشبكة */
const SHELL_RE = /\.(?:html|js|css|svg|png|webp|woff2?)(?:\?|$)|\/$/i;
/* ملف عليه بصمة نسخة = محتواه ثابت لهذه النسخة */
const VERSIONED_RE = /[?&]v=([\d.]+)/;

/* مخزن لكل نسخة: shell-b2.46 · shell-b2.47 … */
function bucketFor(search){
  const m = VERSIONED_RE.exec(search || '');
  return m ? (PREFIX + 'b' + m[1]) : CACHE;
}

/* ⚠️ skipWaiting الفوري كان بيستبدل النسخة والمستخدم في نص شغله.
   دلوقتي: النسخة الجديدة تستنى، والبرنامج بيسأل المستخدم الأول. */
self.addEventListener('install', e => {
  /* مانعملش skipWaiting هنا — بننتظر إذن المستخدم */
});

self.addEventListener('message', e => {
  try{
    const t = e.data && e.data.type;
    /* البرنامج بيبعتلنا لما المستخدم يوافق على التحديث */
    if (t === 'SKIP_WAITING') self.skipWaiting();

    /* زرار الإنقاذ: يمسح كل المخازن ويرد على البرنامج */
    if (t === 'PURGE_ALL'){
      e.waitUntil(
        caches.keys()
          .then(ks => Promise.all(ks.map(k => caches.delete(k))))
          .then(() => { try{ e.source && e.source.postMessage({ type:'PURGED' }); }catch(_){ } })
          .catch(() => {})
      );
    }
  }catch(_){ /* رسالة غريبة مايوقفش العامل */ }
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        /* مخازن النُسخ (shell-b*) بتتنضّف وقت الجلب.
           هنا بنمسح مخازن الإصدارات القديمة بس. */
        ks.filter(k => k.startsWith(PREFIX) && !k.startsWith(PREFIX + 'b') && k !== CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  /* 🛡️ الحارس الشامل: أي خطأ هنا = الطلب يعدّي للشبكة زي ما هو.
     العامل ده ما ينفعش يبقى هو نفسه سبب إن البرنامج ما يفتحش. */
  try{
    if (e.request.method !== 'GET') return;

    let url;
    try { url = new URL(e.request.url); } catch (x) { return; }

    /* بيانات وطلبات الخادم: شبكة دايمًا، من غير كاش إطلاقًا */
    if (url.origin !== self.location.origin) return;
    if (!SHELL_RE.test(url.pathname + url.search)) return;

    /* ملف عليه بصمة: كل نسخة في مخزنها، وأول جلب بيتخطّى
       كاش المتصفح. */
    if (VERSIONED_RE.test(url.search)) {
      const bucket = bucketFor(url.search);
      e.respondWith(
        caches.open(bucket)
          .then(c => c.match(e.request).then(hit => {
            if (hit) return hit;
            /* cache:'reload' = هات من الشبكة وتجاهل كاش المتصفح */
            return fetch(e.request, { cache: 'reload' })
              .then(res => {
                if (res && res.status === 200) {
                  try { c.put(e.request, res.clone()); } catch(_){ }
                  /* مخازن النسخ القديمة تتمسح بهدوء */
                  caches.keys().then(ks => ks
                    .filter(k => k.startsWith(PREFIX + 'b') && k !== bucket)
                    .forEach(k => caches.delete(k))).catch(()=>{});
                }
                return res;
              })
              /* الشبكة وقعت؟ آخر أمل: أي نسخة مخزّنة قديمة */
              .catch(() => caches.match(e.request).then(old => old || Response.error()));
          }))
          .catch(() => fetch(e.request))     /* المخزن نفسه فشل → شبكة */
      );
      return;
    }

    /* من غير بصمة (زي index.html): شبكة أولًا، والكاش احتياطي
       لو مفيش نت. */
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  }catch(_){
    /* مانعملش respondWith خالص — المتصفح بيكمّل الطلب بنفسه */
  }
});
