import type { CSSProperties } from 'react'

const STAGGER_MS = 50
const MAX_STAGGERED_INDEX = 12

export interface CardMotionProps {
  className: string
  style?: CSSProperties
}

/** Fade+rise entrance for feed cards, staggered by index. No-op when motion is disabled. */
export function getCardEntranceProps(index: number, canAnimate: boolean): CardMotionProps {
  if (!canAnimate) return { className: '' }
  const delay = Math.min(index, MAX_STAGGERED_INDEX) * STAGGER_MS
  return {
    className: 'card-motion-enter',
    style: { animationDelay: `${delay}ms`, opacity: 0 },
  }
}
