import { useEffect } from 'react'

/**
 * Lock body scroll when a modal/popup is open.
 * Preserves scroll position and prevents background scrolling on both desktop and mobile.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const scrollY = window.scrollY
    const { overflow, position, top, width } = document.body.style

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    return () => {
      document.body.style.overflow = overflow
      document.body.style.position = position
      document.body.style.top = top
      document.body.style.width = width
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}
