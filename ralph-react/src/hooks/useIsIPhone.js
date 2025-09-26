import { useEffect, useMemo, useState } from 'react'

// Detect iPhone-like environment with a robust set of signals.
// Also supports a force flag via ?mobile=1 in the URL for desktop testing.
export default function useIsIPhone() {
  const [isMobile, setIsMobile] = useState(false)

  const forced = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get('mobile') === '1'
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (forced) {
      setIsMobile(true)
      return
    }
    const ua = (navigator?.userAgent || '').toLowerCase()
    const isiPhoneUA = /iphone|ipod/.test(ua)
    const isiOS = /iphone|ipad|ipod/.test(ua)
    const mqNarrow = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 430px)').matches
      : false
    const isWebkitHiDPI = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(-webkit-device-pixel-ratio: 2), (resolution: 192dpi)').matches
      : false
    setIsMobile(!!(isiPhoneUA || (mqNarrow && isWebkitHiDPI && isiOS)))
  }, [forced])

  return isMobile
}
