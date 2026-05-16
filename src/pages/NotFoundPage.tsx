import { useNavigate } from 'react-router-dom'
import { APP_PATHS } from '../router/paths'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <section className="centered" style={{ padding: 'var(--space-10) var(--space-4)' }}>
      <article className="card stack" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', gap: 'var(--space-5)' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>404</p>
          <h2 style={{ margin: 0 }}>Page not found</h2>
        </div>
        <p className="subtle">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <button
          type="button"
          className="primary"
          style={{ alignSelf: 'center' }}
          onClick={() => navigate(APP_PATHS.home)}
        >
          Go home
        </button>
      </article>
    </section>
  )
}
