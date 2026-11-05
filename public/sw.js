const CACHE_NAME = 'progression-shell-v1'
const SHELL_FILES = ['/', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const shell = await fetch('/', { cache: 'reload' })
      if (!shell.ok) throw new Error('App shell unavailable')
      const html = await shell.clone().text()
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
        (match) => match[1],
      )
      await cache.put('/', shell)
      await cache.addAll([...SHELL_FILES.slice(1), ...assets])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('progression-shell-') && name !== CACHE_NAME) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/')
        if (cached) return cached
        return Response.error()
      }),
    )
    return
  }
  if (!url.pathname.startsWith('/assets/') && !SHELL_FILES.includes(url.pathname)) return
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => cached ?? fetch(request)),
  )
})
