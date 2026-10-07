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

  it('refuses STAFF on the HR dashboard', async () => {
    seedSession('STAFF')
    visit('/hr-dashboard')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('refuses HR on the superadmin dashboard', async () => {
    seedSession('HR')
    visit('/superadmin-dashboard')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('refuses STAFF on staff management', async () => {
    seedSession('STAFF')
    visit('/manage-staff')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('refuses STAFF on the superadmin dashboard', async () => {
    seedSession('STAFF')
    visit('/superadmin-dashboard')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('admits HR to the HR dashboard without redirecting', async () => {
    seedSession('HR')
    visit('/hr-dashboard')

    await screen.findByText(/full attendance overview/i)
    expect(window.location.pathname).toBe('/hr-dashboard')
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
