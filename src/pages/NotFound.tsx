// NotFound — the shared 404 panel (nav §7.6).
//
// Unknown routes used to bounce to /login, which lied: sign-in is not the
// answer to a bad address. This panel states the truth and offers the two
// real exits — go back to wherever the user came from, or sign in.
//
// Static, zero backend calls, Paper and Brass tokens only.

import { Link, useNavigate } from 'react-router-dom'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 font-sans">
      <div className="relative card-elevated max-w-lg w-full overflow-hidden text-center py-14 px-8">
        {/* Corner brackets — the ledger signature */}
        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-accent opacity-30 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-accent opacity-30 pointer-events-none" />

        <p className="text-eyebrow text-ink-subtle mb-3">Error 404</p>

        <h1 className="text-display-lg text-ink font-serif leading-tight mb-3">
          That page isn't in the book.
        </h1>

        <p className="text-ink-muted text-body-sm mb-2">
          The address you followed doesn't match any screen in AttendPro.
        </p>
        <p className="text-ink-subtle text-caption mb-8">
          Check the link, or use one of the paths below.
        </p>

        <div className="h-px bg-accent opacity-30 mb-8" />

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            Go back
          </button>
          <Link to="/login" className="btn-primary">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFound
