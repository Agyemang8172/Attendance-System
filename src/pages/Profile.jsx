import { getCurrentUser } from '../utils/auth'
import Layout from '../components/Layout'

const roleLabel = {
  staff: 'Staff',
  hr: 'HR Manager',
  superadmin: 'Super Admin',
}

function Profile() {
  const currentUser = getCurrentUser()

  const initials = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join('')

  return (
    <Layout>
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-[Fraunces]">
          My Profile
        </h1>
        <p className="text-sm text-slate-400 mt-1 font-[GeneralSans]">
          Manage your personal information.
        </p>
        <div className="mt-4 h-px bg-yellow-500/30 w-16" />
      </header>

      {/* Profile Card */}
      <div className="relative bg-slate-900 rounded-2xl p-8 max-w-lg overflow-hidden">

        {/* Top-right corner bracket */}
        <div className="absolute top-5 right-5 w-5 h-5 border-t-2 border-r-2 border-yellow-500 opacity-30 rounded-tr-sm pointer-events-none" />

        {/* Bottom-left corner bracket */}
        <div className="absolute bottom-5 left-5 w-5 h-5 border-b-2 border-l-2 border-yellow-500 opacity-30 rounded-bl-sm pointer-events-none" />

        {/* Avatar + identity */}
        <div className="flex items-center gap-5 mb-8">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
            <span className="text-yellow-500 text-xl font-bold font-[GeneralSans]">
              {initials || '??'}
            </span>
          </div>

          {/* Name + meta */}
          <div className="flex flex-col gap-1">
            <h2 className="text-slate-100 text-lg font-semibold font-[GeneralSans]">
              {currentUser?.firstName} {currentUser?.lastName}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-500 font-[GeneralSans]">
                {roleLabel[currentUser?.role] || currentUser?.role}
              </span>
              {currentUser?.department && (
                <span className="text-xs text-slate-500 font-[GeneralSans]">
                  {currentUser.department}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-600 font-mono mt-0.5">
              {currentUser?.email}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-yellow-500/10 mb-8" />

        {/* Coming soon block */}
        <div className="bg-slate-800 rounded-xl px-6 py-5 flex items-start gap-4">
          {/* Icon dot */}
          <div classN ame="w-2 h-2 rounded-full bg-yellow-500/50 mt-1.5 shrink-0" />
          <div>
            <p className="text-slate-300 text-sm font-medium font-[GeneralSans]">
              Coming Soon
            </p>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed font-[GeneralSans]">
              Full profile editing — name, department, password, and avatar upload — will be available here in a future update.
            </p>
          </div>
        </div>

      </div>
    </Layout>
  ) 
}

export default Profile