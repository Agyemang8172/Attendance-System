import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FaEye, FaEyeSlash } from 'react-icons/fa6'
import api from '../api/axios'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import { getCurrentUser, getToken, updateCurrentUser, updateToken } from '../utils/auth'
import { validatePassword } from '../utils/passwordPolicy'
import type { AuthUser } from '../types'

type PasswordValues = { current: string; replacement: string; confirmation: string }
type FieldErrors = Partial<Record<keyof PasswordValues, string>>
const emptyValues: PasswordValues = { current: '', replacement: '', confirmation: '' }
const fieldDefinitions = [
  { name: 'current', label: 'Current password', autoComplete: 'current-password' },
  { name: 'replacement', label: 'New password', autoComplete: 'new-password' },
  { name: 'confirmation', label: 'Confirm new password', autoComplete: 'new-password' },
] as const

const validateFields = (values: PasswordValues): FieldErrors => {
  const errors: FieldErrors = {}
  if (!values.current) errors.current = 'Enter your current password.'
  const policyError = validatePassword(values.replacement)
  if (policyError) errors.replacement = policyError
  if (values.replacement && values.replacement === values.current) {
    errors.replacement = 'Choose a password different from your current password.'
  }
  if (!values.confirmation) errors.confirmation = 'Confirm your new password.'
  else if (values.confirmation !== values.replacement) errors.confirmation = 'New passwords do not match.'
  return errors
}

const acceptedSession = (data: unknown, ownerId?: string): data is { token: string; user: AuthUser } => {
  if (!data || typeof data !== 'object') return false
  const result = data as { success?: unknown; token?: unknown; user?: Partial<AuthUser> }
  const user = result.user
  if (!user || typeof user !== 'object') return false
  return result.success === true && typeof result.token === 'string' && Boolean(result.token.trim())
    && Boolean(ownerId) && user.id === ownerId && user.mustChangePassword === false
    && ['STAFF', 'HR', 'SUPERADMIN'].includes(user.role ?? '')
    && typeof user.email === 'string' && typeof user.firstName === 'string' && typeof user.lastName === 'string'
}

const sessionPatch = (user: AuthUser): AuthUser => ({
  id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
  role: user.role, mustChangePassword: false,
  ...(typeof user.employeeCode === 'string' ? { employeeCode: user.employeeCode } : {}),
  ...(typeof user.department === 'string' ? { department: user.department } : {}),
})

const failureMessage = (error: unknown): string => {
  if (error instanceof UnconfirmedChange) return error.message
  const failure = error as { response?: { status?: number; data?: { message?: unknown } } }
  if (failure?.response?.status === 401 && failure.response.data?.message === 'Invalid current password') {
    return 'Invalid current password. Enter your current password and try again.'
  }
  if (failure?.response?.status === 409) return 'Your account changed. Sign in again before retrying.'
  if (!failure?.response) return 'The result could not be confirmed. Sign in again before retrying.'
  return 'Unable to change your password. Try again.'
}

class UnconfirmedChange extends Error {
  constructor() { super('The result could not be confirmed. Sign in again before retrying.') }
}

const changeAccountPassword = async (values: PasswordValues): Promise<void> => {
  const owner = getCurrentUser()
  const originalToken = getToken()
  const response = await api.put('/users/change-password', {
    currentPassword: values.current, newPassword: values.replacement,
  })
  if (!acceptedSession(response.data, owner?.id)
    || getCurrentUser()?.id !== owner?.id || getToken() !== originalToken) throw new UnconfirmedChange()
  updateToken(response.data.token)
  updateCurrentUser(sessionPatch(response.data.user))
}

interface PasswordFieldProps {
  name: keyof PasswordValues
  label: string
  autoComplete: string
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
  onBlur: () => void
}

const PasswordField = ({ name, label, autoComplete, value, error, disabled, onChange, onBlur }: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false)
  const inputId = `change-password-${name}`
  return (
    <div>
      <label htmlFor={inputId} className="block text-body-sm font-medium text-ink mb-xs">{label}</label>
      <div className="relative">
        <input id={inputId} name={name} type={visible ? 'text' : 'password'} value={value}
          autoComplete={autoComplete} required disabled={disabled} spellCheck={false}
          onChange={event => onChange(event.target.value)} onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : name === 'replacement' ? 'password-policy' : undefined}
          className={`input min-h-xxl pr-xxl text-body disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-error' : ''}`} />
        <button type="button" disabled={disabled} onClick={() => setVisible(current => !current)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}
          className="absolute right-0 top-0 min-h-xxl min-w-xxl inline-flex items-center justify-center text-ink-muted hover:text-ink rounded-md transition active:scale-[0.98] disabled:cursor-not-allowed">
          {visible ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={`${inputId}-error`} className="text-body-sm text-error mt-xs">{error}</p>}
    </div>
  )
}

const usePasswordChange = () => {
  const [values, setValues] = useState<PasswordValues>(emptyValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [succeeded, setSucceeded] = useState(false)
  const inFlight = useRef(false)

  const changeField = (name: keyof PasswordValues, value: string) => {
    const next = { ...values, [name]: value }
    setValues(next)
    setError('')
    if (attempted) setErrors(validateFields(next))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inFlight.current) return
    setAttempted(true)
    const nextErrors = validateFields(values)
    setErrors(nextErrors)
    setError('')
    if (Object.keys(nextErrors).length) return
    inFlight.current = true
    setSubmitting(true)
    try {
      await changeAccountPassword(values)
      setValues(emptyValues)
      setSucceeded(true)
    } catch (failure: unknown) {
      setError(failureMessage(failure))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  const blurField = () => { if (attempted) setErrors(validateFields(values)) }
  return { values, errors, submitting, error, succeeded, changeField, blurField, submit }
}

const PasswordChangeSuccess = () => (
  <div className="space-y-lg">
    <p role="status" className="text-body text-success">Password changed successfully.</p>
    <p className="text-body-sm text-ink-muted">Use your new password the next time you sign in.</p>
    <Link to="/profile" className="btn-primary inline-flex min-h-xxl items-center active:scale-[0.98]">Back to profile</Link>
  </div>
)

const PasswordChangeForm = ({ state }: { state: ReturnType<typeof usePasswordChange> }) => {
  const { values, errors, submitting, error, changeField, blurField, submit } = state
  return (
    <form onSubmit={submit} noValidate aria-busy={submitting} className="space-y-lg">
      <p id="password-policy" className="text-body-sm text-ink-muted">
        Use 10–72 characters. Avoid commonly used passwords and choose a password different from your current one.
      </p>
      {fieldDefinitions.map(field => (
        <PasswordField key={field.name} {...field} value={values[field.name]} error={errors[field.name]}
          disabled={submitting} onChange={value => changeField(field.name, value)} onBlur={blurField} />
      ))}
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <div className="border-t border-hairline pt-lg flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        {submitting ? <p role="status" className="text-body-sm text-ink-muted">Updating your password…</p>
          : <Link to="/profile" className="text-body-sm text-accent hover:text-accent-hover">Back to profile</Link>}
        <button type="submit" disabled={submitting} className="btn-primary min-h-xxl active:scale-[0.98]">
          {submitting ? 'Changing password…' : 'Change password'}
        </button>
      </div>
    </form>
  )
}

function ChangePassword() {
  const state = usePasswordChange()
  return (
    <Layout>
      <PageHeader eyebrow="Account security" title="Change password" />
      <section className="max-w-lg card" aria-label="Account password">
        {state.succeeded ? <PasswordChangeSuccess /> : <PasswordChangeForm state={state} />}
      </section>
    </Layout>
  )
}

export default ChangePassword
