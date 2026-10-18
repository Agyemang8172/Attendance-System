import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import { formatShortDate } from '../lib/attendance-format'
import { FaArrowLeft, FaXmark } from 'react-icons/fa6'

// ─── Types ────────────────────────────────────────────────────────────────────

type HelpRequestCategory = 'pin' | 'kiosk' | 'profile' | 'access' | 'other'

interface CategoryOption {
  value: HelpRequestCategory
  label: string
  description: string
}

const CATEGORIES: CategoryOption[] = [
  { value: 'pin', label: 'PIN Issue', description: 'Problems with your kiosk PIN (forgot, locked, not working)' },
  { value: 'kiosk', label: 'Kiosk Problem', description: 'Issues with the kiosk device (QR scan, screen, hardware)' },
  { value: 'profile', label: 'Profile Issue', description: 'Incorrect personal information (name, email, department, shift)' },
  { value: 'access', label: 'Access Problem', description: 'Cannot sign in, password issues, account locked' },
  { value: 'other', label: 'Other', description: 'Any other issue not covered above' },
]

const SUBJECT_MAX = 120
const BODY_MAX = 2000

// ─── Staff Help Request New Page ──────────────────────────────────────────────

function StaffHelpRequestNew() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [category, setCategory] = useState<HelpRequestCategory>('other')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const subjectCount = subject.length
  const bodyCount = body.length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject.trim()) {
      toast.error('Please enter a subject.')
      return
    }
    if (!body.trim()) {
      toast.error('Please describe your issue.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/api/staff/help-requests', {
        category,
        subject: subject.trim(),
        body: body.trim(),
      })
      toast.success('Help request submitted.')
      navigate(`/staff/help-requests/${res.data.data.id}`)
    } catch (err: any) {
      if (err.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.')
      } else {
        toast.error(err.response?.data?.message || 'Failed to submit request. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Help Requests"
        title="New Request"
        actions={
          <button
            type="button"
            onClick={() => navigate('/staff/help-requests')}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FaArrowLeft aria-hidden="true" /> Cancel
          </button>
        }
      />

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
        {/* Category */}
        <section className="card p-6">
          <p className="text-caption text-ink-muted mb-4">Category</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="Select issue category">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                role="radio"
                aria-checked={category === cat.value}
                className={[
                  'p-4 text-left border-2 rounded-lg transition-all duration-150',
                  category === cat.value
                    ? 'border-accent bg-accent-soft'
                    : 'border-hairline hover:border-accent hover:bg-surface-1',
                ].join(' ')}
              >
                <p className="text-body font-medium text-ink mb-1">{cat.label}</p>
                <p className="text-caption text-ink-muted">{cat.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Subject */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="subject" className="text-caption text-ink-muted">
              Subject
            </label>
            <span className={[
              'text-caption font-mono',
              subjectCount > SUBJECT_MAX ? 'text-error' : 'text-ink-muted',
            ].join(' ')}>
              {subjectCount}/{SUBJECT_MAX}
            </span>
          </div>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={SUBJECT_MAX}
            placeholder="Brief summary of the issue"
            className="input w-full"
            aria-describedby="subject-hint"
            required
          />
          <p id="subject-hint" className="text-caption text-ink-muted mt-1">
            A clear subject helps HR prioritize and route your request.
          </p>
        </section>

        {/* Body */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="body" className="text-caption text-ink-muted">
              Description
            </label>
            <span className={[
              'text-caption font-mono',
              bodyCount > BODY_MAX ? 'text-error' : 'text-ink-muted',
            ].join(' ')}>
              {bodyCount}/{BODY_MAX}
            </span>
          </div>
          <textarea
            id="body"
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={BODY_MAX}
            rows={8}
            placeholder="Describe the issue in detail. Include: what happened, when, any error messages, and steps you've already tried."
            className="input w-full min-h-[160px] resize-y"
            aria-describedby="body-hint"
            required
          />
          <p id="body-hint" className="text-caption text-ink-muted mt-1">
            Be specific — this helps HR resolve your issue faster.
          </p>
        </section>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
          <button
            type="button"
            onClick={() => navigate('/staff/help-requests')}
            className="btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || subjectCount > SUBJECT_MAX || bodyCount > BODY_MAX || !subject.trim() || !body.trim()}
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Layout>
  )
}

export default StaffHelpRequestNew