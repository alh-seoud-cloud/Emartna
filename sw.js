/* ============================================================
   عمارتنا — Service Worker
   ------------------------------------------------------------
   ⚠️ كان متسجّل من Blob URL، فبيتسجّل من جديد كل تحميل — والمتصفح
   بيعتبره عامل جديد في كل مرة، فالكاش مابيستقرش.

   وكان بيعمل "كاش أولًا + تحديث في الخلفية" لكل ملف: يعني كل ملف
   بيتطلب مرتين — مرة من الكاش ومرة من الشبكة. على ٦٠ ملف ده
   ١٢٠ طلب، وظهر في Network كـ٢٨٥ طلب و٤٨ ثانية.

   دلوقتي: الملفات اللي عليها بصمة نسخة (?v=1.73) بتتقرا من الكاش
   وخلاص — البصمة نفسها بتتغيّر مع كل إصدار، فمفيش داعي نسأل
   الشبكة. والباقي شبكة أولًا.
   ============================================================ */

const VERSION = 'v1';
const CACHE   = 'omaretna-shell-' + VERSION;

/* ملفات الشكل والكود — البيانات دايمًا من الشبكة */
const SHELL_RE = /\.(?:html|js|css|svg|png|webp|woff2?)(?:\?|$)|\/$/i;
/* ملف عليه بصمة نسخة = محتواه ثابت لهذه النسخة */
const VERSIONED_RE = /[?&]v=[\d.]+/;

/* ⚠️ skipWaiting الفوري كان بيستبدل النسخة والمستخدم في نص شغله —
   ممكن يكون بيكتب رسالة أو بيملا نموذج، فالصفحة تتحدّث تحت إيده.
   دلوقتي: النسخة الجديدة تستنى، والبرنامج بيسأل المستخدم الأول. */
self.addEventListener('install', e => {
  /* مانعملش skipWaiting هنا — بننتظر إذن المستخدم */
});

/* البرنامج بيبعتلنا لما المستخدم يوافق على التحديث */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  let url;
  try { url = new URL(e.request.url); } catch (x) { return; }

  /* بيانات وطلبات الخادم: شبكة دايمًا، من غير كاش إطلاقًا */
  if (url.origin !== self.location.origin) return;
  if (!SHELL_RE.test(url.pathname + url.search)) return;

  /* ملف عليه بصمة: الكاش نهائي — من غير طلب شبكة موازي.
     أي تحديث بيغيّر البصمة، فالعنوان نفسه بيبقى جديد. */
  if (VERSIONED_RE.test(url.search)) {
    e.respondWith(
      caches.match(e.request).then(hit => {
        if (hit) return hit;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  /* من غير بصمة (زي index.html نفسه): شبكة أولًا، والكاش احتياطي
     لو مفيش نت. */
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
