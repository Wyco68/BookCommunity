import { useEffect, useState, useRef } from 'react'

export function useSlidingPill<T extends HTMLElement>(activeSelector: string, deps: any[] = []) {
  const [pillStyle, setPillStyle] = useState({ left: 0, top: 0, width: 0, height: 0, opacity: 0 })
  const containerRef = useRef<T>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updatePill = () => {
      const activeEl = container.querySelector(activeSelector) as HTMLElement
      if (activeEl) {
        setPillStyle({
          left: activeEl.offsetLeft,
          top: activeEl.offsetTop,
          width: activeEl.offsetWidth,
          height: activeEl.offsetHeight,
          opacity: 1,
        })
      } else {
        setPillStyle((prev) => ({ ...prev, opacity: 0 }))
      }
    }

    updatePill()
    const timer1 = setTimeout(updatePill, 50)
    const timer2 = setTimeout(updatePill, 200)
    
    const observer = new MutationObserver(updatePill)
    observer.observe(container, { 
      attributes: true, 
      childList: true, 
      characterData: true, 
      subtree: true 
    })
    window.addEventListener('resize', updatePill)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      observer.disconnect()
      window.removeEventListener('resize', updatePill)
    }
  }, [activeSelector, ...deps])

  return { containerRef, pillStyle }
}
