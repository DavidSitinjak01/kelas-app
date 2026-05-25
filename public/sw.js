const CACHE_NAME = 'kelas-app-v1'

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/logo.svg',
]

// Install event - precache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  
  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API calls (except logo and manifest)
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/') && 
      !url.pathname.startsWith('/api/logo') && 
      !url.pathname.startsWith('/api/manifest')) {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone the response and cache it
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || new Response('Offline', { status: 503 })
        })
      })
  )
})
