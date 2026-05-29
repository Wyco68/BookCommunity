import { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

export function useMotion() {
  const motionEnabled = useSettingsStore((state) => state.motionEnabled);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return motionEnabled && !reducedMotion;
}
