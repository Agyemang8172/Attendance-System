import { Component } from 'react'

// Error boundaries MUST be class components — React only exposes the
// crash-catching lifecycle methods (getDerivedStateFromError,
// componentDidCatch) to classes. This is the one place a class is required.

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  // Runs when a child component throws during render.
  // Flips our state so we show the fallback instead of the broken tree.
  static getDerivedStateFromError() {
    return { hasError: true }
  }

  // Runs after the error is caught — the place to log it.
  // For now we log to the console; later you could send this to a
  // monitoring service.
  componentDidCatch(error, info) {
    console.error('Caught by ErrorBoundary:', error, info)
  }

  handleReload = () => {
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-auth-canvas px-6">
          <div className="relative bg-auth-surface rounded-2xl p-8 sm:p-10 max-w-md w-full text-center overflow-hidden border border-auth-hairline">

            {/* Linear corner brackets — auth accent */}
            <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-auth-accent opacity-30 rounded-tr-sm pointer-events-none" />
            <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-auth-accent opacity-30 rounded-bl-sm pointer-events-none" />

            <p className="text-xs font-mono uppercase tracking-widest text-auth-accent/70 mb-3">
              Error
            </p>

            <h1 className="text-2xl font-bold text-auth-ink font-serif mb-3">
              Something went wrong.
            </h1>

            <p className="text-auth-ink-muted text-sm font-sans mb-8">
              An unexpected error stopped this page from loading. You can
              return to the login screen and try again.
            </p>

            <button
              onClick={this.handleReload}
              className="btn-auth w-full"
            >
              Back to Login
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary