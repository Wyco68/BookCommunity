import { useRef, useEffect } from 'react'
import type { ReadingSession, SessionJoinRequest, SessionMembership } from '../../types'
import type { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { SessionCard } from '../SessionCard'

type Copy = (typeof translations)[Language]

export interface HorizontalSessionCarouselProps {
  t: Copy
  sessions: ReadingSession[]
  memberships: Record<string, SessionMembership>
  joinRequests: Record<string, SessionJoinRequest['status']>
  coverUrls: Record<string, string | null>
  myProgress: Record<string, number>
  uploadedCounts: Record<string, number>
  onSelectSession: (id: string) => void
  onJoinSession: (id: string) => void
  busySessionId: string | null
}

export function HorizontalSessionCarousel({
  t,
  sessions,
  memberships,
  joinRequests,
  coverUrls,
  myProgress,
  uploadedCounts,
  onSelectSession,
  onJoinSession,
  busySessionId,
}: HorizontalSessionCarouselProps) {
  const scrollRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let isDown = false
    let startX: number
    let scrollLeft: number

    const handleMouseDown = (e: MouseEvent) => {
      isDown = true
      el.classList.add('carousel-active')
      startX = e.pageX - el.offsetLeft
      scrollLeft = el.scrollLeft
    }
    const handleMouseLeave = () => {
      isDown = false
      el.classList.remove('carousel-active')
    }
    const handleMouseUp = () => {
      isDown = false
      el.classList.remove('carousel-active')
    }
    let animationFrameId: number
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return
      e.preventDefault()
      const x = e.pageX - el.offsetLeft
      const walk = (x - startX) * 2
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(() => {
        el.scrollLeft = scrollLeft - walk
      })
    }

    el.addEventListener('mousedown', handleMouseDown)
    el.addEventListener('mouseleave', handleMouseLeave)
    el.addEventListener('mouseup', handleMouseUp)
    el.addEventListener('mousemove', handleMouseMove)

    return () => {
      el.removeEventListener('mousedown', handleMouseDown)
      el.removeEventListener('mouseleave', handleMouseLeave)
      el.removeEventListener('mouseup', handleMouseUp)
      el.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  if (sessions.length === 0) return null

  return (
    <div className="horizontal-carousel-wrapper">
      <ul className="horizontal-carousel" ref={scrollRef}>
        {sessions.map((session) => (
          <div key={session.id} className="carousel-item">
            <SessionCard
              t={t}
              session={session}
              membership={memberships[session.id]}
              requestStatus={joinRequests[session.id]}
              coverUrl={coverUrls[session.id]}
              myProgress={myProgress[session.id] ?? 0}
              uploadedCount={uploadedCounts[session.id] ?? 0}
              busy={busySessionId === session.id}
              onClick={() => onSelectSession(session.id)}
              onJoinClick={() => onJoinSession(session.id)}
            />
          </div>
        ))}
      </ul>

      <style>{`
        .horizontal-carousel-wrapper {
          margin: 0 calc(var(--space-4) * -1);
          padding: 0 var(--space-4);
        }
        @media (min-width: 768px) {
          .horizontal-carousel-wrapper {
            margin: 0;
            padding: 0;
          }
        }
        .horizontal-carousel {
          display: flex;
          gap: var(--space-4);
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          list-style: none;
          margin: 0;
          padding: var(--space-2) 0 var(--space-4) 0;
          scrollbar-width: none; /* Firefox */
        }
        .horizontal-carousel::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }
        .horizontal-carousel.carousel-active {
          scroll-snap-type: none;
          cursor: grabbing;
        }
        .horizontal-carousel.carousel-active * {
          pointer-events: none;
        }
        .carousel-item {
          flex: 0 0 calc(100vw - var(--space-8));
          scroll-snap-align: start;
        }
        @media (min-width: 640px) {
          .carousel-item { flex: 0 0 320px; }
        }
      `}</style>
    </div>
  )
}
