'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

/**
 * Dynamically updates the browser favicon and page title
 * based on the school name and logo from settings.
 * 
 * Chrome aggressively caches favicons, so we use cache-busting
 * and force-replace all icon link elements.
 */
export function DynamicFavicon() {
  const { namasekolah, logopath, isLoaded, forceReload } = useSettingsStore()

  useEffect(() => {
    // Always force reload settings on mount to get latest data
    forceReload()
  }, [forceReload])

  useEffect(() => {
    if (!isLoaded) return

    // 1. Update page title
    if (namasekolah) {
      document.title = `${namasekolah} - Manajemen Kelas`
    }

    // 2. Update all meta tags with school name
    const metasToUpdate = [
      'meta[name="application-name"]',
      'meta[name="apple-mobile-web-app-title"]',
    ]
    metasToUpdate.forEach((selector) => {
      const meta = document.querySelector(selector)
      if (meta) {
        meta.setAttribute('content', namasekolah || 'Kelas App')
      }
    })

    // 3. Update favicon - Chrome caches aggressively so we must be aggressive too
    if (logopath) {
      // Remove ALL existing favicon/icon links
      const allIconLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      allIconLinks.forEach((link) => link.remove())

      // Add cache-busted favicon (32x32 for tab)
      const favicon32 = document.createElement('link')
      favicon32.rel = 'icon'
      favicon32.type = 'image/png'
      favicon32.sizes = '32x32'
      favicon32.href = `/api/logo?size=32&t=${Date.now()}`
      document.head.appendChild(favicon32)

      // Add 192x192 icon
      const favicon192 = document.createElement('link')
      favicon192.rel = 'icon'
      favicon192.type = 'image/png'
      favicon192.sizes = '192x192'
      favicon192.href = `/api/logo?size=192&t=${Date.now()}`
      document.head.appendChild(favicon192)

      // Add apple-touch-icon (180x180)
      const appleTouch = document.createElement('link')
      appleTouch.rel = 'apple-touch-icon'
      appleTouch.href = `/api/logo?size=180&t=${Date.now()}`
      document.head.appendChild(appleTouch)
    }
  }, [namasekolah, logopath, isLoaded])

  return null
}
