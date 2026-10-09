/**
 * Slice A — Authentication and role enforcement (frontend half).
 *
 * Covers what the backend suite cannot: that the router actually enforces the
 * role declared on each route, and that sign-in lands each role on its own
 * dashboard. Assertions follow docs/PROJECT_REQUIREMENTS.md, not whatever the
 * code happens to do.
 *
 * The API client is replaced wholesale. `post` is scripted per test; `get`,
 * `put` and `delete` return a promise that never settles, so a dashboard that
 * renders stays in its loading state instead of crashing on a response body
 * this suite would otherwise have to invent.
 *
 * The `PASSWORD_CHANGE_REQUIRED` interceptor itself lives in
 * src/api/axios.ts, which this suite mocks away wholesale — that handler is
 * covered by src/__tests__/interceptors.test.js against the real module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import api from '../api/axios'

vi.mock('../api/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(() => new Promise(() => {})),
    put: vi.fn(() => new Promise(() => {})),
    delete: vi.fn(() => new Promise(() => {})),
  },
}))

const post = api.post

/** Writes the same two keys `utils/auth.login` writes, without needing an API. */
function seedSession(role, overrides = {}) {
  localStorage.setItem('token', 'test-session-token')
  localStorage.setItem(
    'user',
    JSON.stringify({ role, mustChangePassword: false, ...overrides })
  )
}

function visit(path) {
  window.history.pushState({}, '', path)
  render(<App />)
}

/** Drives the sign-in form against the mocked API client. */
async function submitSignIn({ role, mustChangePassword = false }) {
  post.mockResolvedValue({
    data: { token: 'test-session-token', user: { role, mustChangePassword } },
  })

  const user = userEvent.setup()
  render(<App />)

  await user.type(screen.getByLabelText(/email/i), 'someone@company.com')
  await user.type(screen.getByLabelText(/password/i), 'not-a-real-credential')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/login')
  vi.clearAllMocks()
})

describe('route guards reject callers outside the declared role', () => {
  it('sends an unauthenticated visitor to the sign-in page', async () => {
    visit('/dashboard')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('bounces STAFF off the HR dashboard to its own home', async () => {
    seedSession('STAFF')
    visit('/hr-dashboard')

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
  })

  it('bounces HR off the superadmin dashboard to its own home', async () => {
    seedSession('HR')
    visit('/superadmin-dashboard')

    await waitFor(() => expect(window.location.pathname).toBe('/hr-dashboard'))
  })

  it('bounces STAFF off staff management to its own home', async () => {
    seedSession('STAFF')
    visit('/manage-staff')

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
  })

  it('bounces STAFF off the superadmin dashboard to its own home', async () => {
    seedSession('STAFF')
    visit('/superadmin-dashboard')

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
  })

  it('admits HR to the HR dashboard without redirecting', async () => {
    seedSession('HR')
    visit('/hr-dashboard')

    await screen.findByText(/full attendance overview/i)
    expect(window.location.pathname).toBe('/hr-dashboard')
  })
})

describe('the root path lands each role on its own home', () => {
  it('sends an unauthenticated visitor to the sign-in page', async () => {
    visit('/')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('lands STAFF on the staff dashboard', async () => {
    seedSession('STAFF')
    visit('/')

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
  })

  it('lands HR on the HR dashboard', async () => {
    seedSession('HR')
    visit('/')

    await waitFor(() => expect(window.location.pathname).toBe('/hr-dashboard'))
  })

  it('lands SUPERADMIN on the superadmin dashboard', async () => {
    seedSession('SUPERADMIN')
    visit('/')

    await waitFor(() => expect(window.location.pathname).toBe('/superadmin-dashboard'))
  })
})

describe('sign-in routes each role to its own dashboard', () => {
  it('routes STAFF to the staff dashboard', async () => {
    await submitSignIn({ role: 'STAFF' })

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
  })

  it('routes HR to the HR dashboard', async () => {
    await submitSignIn({ role: 'HR' })

    await waitFor(() => expect(window.location.pathname).toBe('/hr-dashboard'))
  })

  it('routes SUPERADMIN to the superadmin dashboard', async () => {
    await submitSignIn({ role: 'SUPERADMIN' })

    await waitFor(() => expect(window.location.pathname).toBe('/superadmin-dashboard'))
  })

  // PRD: mustChangePassword gates the first session — no dashboard until set.
  it('holds a must-change account on the password screen', async () => {
    await submitSignIn({ role: 'SUPERADMIN', mustChangePassword: true })

    await waitFor(() => expect(window.location.pathname).toBe('/set-password'))
  })

  it('stores the session so the guard authorises the next request', async () => {
    await submitSignIn({ role: 'STAFF' })

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
    expect(localStorage.getItem('token')).toBe('test-session-token')
    expect(JSON.parse(localStorage.getItem('user')).role).toBe('STAFF')
  })
})

// S15 — an account whose password is already set must never reach the
// password screen, no matter how it got there.
describe('the password screen refuses accounts that already set one', () => {
  it('bounces STAFF whose flag is clear to the staff dashboard', async () => {
    seedSession('STAFF')
    visit('/set-password')

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
  })

  it('bounces HR whose flag is clear to the HR dashboard', async () => {
    seedSession('HR')
    visit('/set-password')

    await waitFor(() => expect(window.location.pathname).toBe('/hr-dashboard'))
  })

  it('bounces SUPERADMIN whose flag is clear to the superadmin dashboard', async () => {
    seedSession('SUPERADMIN')
    visit('/set-password')

    await waitFor(() => expect(window.location.pathname).toBe('/superadmin-dashboard'))
  })

  it('keeps an account that still owes a password on the screen', async () => {
    seedSession('SUPERADMIN', { mustChangePassword: true })
    visit('/set-password')

    expect(await screen.findByRole('button', { name: /set password & continue/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/set-password')
  })
})

describe('setting the first password', () => {
  it('rejects a password the shared policy forbids (S7)', async () => {
    seedSession('STAFF', { mustChangePassword: true })
    visit('/set-password')

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Temporary Password'), 'TempPass9!')
    await user.type(screen.getByLabelText('New Password'), 'sixsix')
    await user.type(screen.getByLabelText('Confirm New Password'), 'sixsix')
    await user.click(screen.getByRole('button', { name: /set password & continue/i }))

    expect(await screen.findByText(/must be at least 10 characters/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/set-password')
  })

  it('clears the flag locally and lands on the role home after a valid change', async () => {
    seedSession('STAFF', { mustChangePassword: true })
    api.put.mockResolvedValue({ data: { success: true } })
    visit('/set-password')

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Temporary Password'), 'TempPass9!')
    await user.type(screen.getByLabelText('New Password'), 'Adifferent0ne!')
    await user.type(screen.getByLabelText('Confirm New Password'), 'Adifferent0ne!')
    await user.click(screen.getByRole('button', { name: /set password & continue/i }))

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
    expect(JSON.parse(localStorage.getItem('user')).mustChangePassword).toBe(false)
    expect(api.put).toHaveBeenCalledWith('/users/change-password', {
      currentPassword: 'TempPass9!',
      newPassword: 'Adifferent0ne!',
    })
  })
})

describe('sign-in failures leave no session behind', () => {
  it('stays on the sign-in page when credentials are rejected', async () => {
    post.mockRejectedValue({
      response: { data: { message: 'Invalid email or password' } },
    })

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(/email/i), 'someone@company.com')
    await user.type(screen.getByLabelText(/password/i), 'not-a-real-credential')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(localStorage.getItem('token')).toBeNull()
  })
})
