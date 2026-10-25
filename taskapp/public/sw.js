// Service Worker（PWA 用）
// ---------------------------------------------------------------
// * アプリの画面（HTML・JS・CSS・アイコン）だけをキャッシュし、ホーム画面から素早く起動できるようにします
// * タスクのデータ（Supabase への通信）はキャッシュしません。常に最新のデータを取得します
// * アプリを更新したら CACHE の名前を変えると、古いキャッシュが削除されます
const CACHE = 'tasks-v1'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  // 同じサイトの GET だけを扱う（Supabase など他のサイトへの通信には触れない）
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // 画面の移動: まずネットから取得し、オフライン時はキャッシュした画面を表示
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // ビルド済みファイル（名前にハッシュが付き中身が変わらない）はキャッシュ優先
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
