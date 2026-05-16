import { Component } from 'react'
import type { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    return { hasError: true, message }
  }

  componentDidCatch(): void {
    // Errors are surfaced in the UI; no external logging needed
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <section className="stack" style={{ padding: 'var(--space-8) var(--space-4)' }}>
          <article className="card stack" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ margin: 0 }}>Something went wrong</h2>
            <p className="subtle">{this.state.message}</p>
            <button
              type="button"
              className="secondary"
              style={{ alignSelf: 'center' }}
              onClick={this.handleReset}
            >
              Try again
            </button>
          </article>
        </section>
      )
    }

    return this.props.children
  }
}
