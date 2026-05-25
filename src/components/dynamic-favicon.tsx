'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

/**
 * Dynamically updates the browser favicon and page title
 * based on the school name and logo from settings.
 */
export function DynamicFavicon() {
  const { namasekolah, logopath, loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    // Update page title dynamically
    if (namasekolah && namasekolah !== 'Kelas App') {
      document.title = `${namasekolah} - Manajemen Kelas`
    }

    // Update favicon dynamically
    if (logopath) {
      // Remove existing dynamic favicon links
      const existingLinks = document.querySelectorAll('link[data-dynamic-favicon]')
      existingLinks.forEach((link) => link.remove())

      // Add new favicon link using the logo API (which resizes)
      const link = document.createElement('link')
      link.rel = 'icon'
      link.type = 'image/png'
      link.href = '/api/logo?size=32'
      link.setAttribute('data-dynamic-favicon', 'true')
      document.head.appendChild(link)

      // Also add apple-touch-icon
      const appleLink = document.createElement('link')
      appleLink.rel = 'apple-touch-icon'
      appleLink.href = '/api/logo?size=180'
      appleLink.setAttribute('data-dynamic-favicon', 'true')
      document.head.appendChild(appleLink)

      // Update application-name meta
      const appMeta = document.querySelector('meta[name="application-name"]')
      if (appMeta) {
        appMeta.setAttribute('content', namasekolah)
      }

      // Update apple-mobile-web-app-title meta
      const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]')
      if (appleMeta) {
        appleMeta.setAttribute('content', namasekolah)
      }
    }
  }, [namasekolah, logopath])

  return null
}
