// Forbidden — the shared 403 panel (nav §7.6).
//
// "A valid session lacks permission for the target." The session stands; what
// failed is the access check. The panel says so plainly and links the role's
// own home per the §7.6 contract, plus sign-in for a different session.
//
// Static, zero backend calls, Paper and Brass tokens only.

import { Link, useNavigate } from 'react-router-dom'
import { roleHome, getCurrentUser } from '../utils/auth'

const Forbidden = () => {
  const navigate = useNavigate()
  const homePath = roleHome(getCurrentUser()?.role)

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 font-sans">
      <div className="relative card-elevated max-w-lg w-full overflow-hidden text-center py-14 px-8">
        {/* Corner brackets — the ledger signature */}
        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-accent opacity-30 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-accent opacity-30 pointer-events-none" />

        <p className="text-eyebrow text-ink-subtle mb-3">Error 403</p>

        <h1 className="text-display-lg text-ink font-serif leading-tight mb-3">
          This page isn't yours to open.
        </h1>

        <p className="text-ink-muted text-body-sm mb-2">
          You're signed in, but your role doesn't carry access to this screen.
        </p>
        <p className="text-ink-subtle text-caption mb-8">
          Ask your administrator if you need it — or head back to your workspace.
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
          <Link to={homePath} className="btn-primary">
            Back to my workspace
          </Link>
          <Link to="/login" className="btn-tertiary">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Forbidden
