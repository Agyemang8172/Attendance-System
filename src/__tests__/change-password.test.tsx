import { validatePassword } from '../utils/passwordPolicy'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
// @ts-expect-error The mounted legacy App.jsx has no declaration; exercising its real guards is intentional.
import App from '../App'
import ChangePassword from '../pages/ChangePassword'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: {
  put: vi.fn(), post: vi.fn(),
  get: vi.fn(() => new Promise(() => {})),
  delete: vi.fn(() => new Promise(() => {})),
} }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

const account = {
  id: 'employee-account', email: 'staff@example.test', firstName: 'Ama', lastName: 'Mensah',
  role: 'STAFF', mustChangePassword: false,
}
const synthetic = () => Math.random().toString(36).slice(2)
const currentPassword = crypto.randomUUID()
const initialToken = synthetic()
const nextToken = synthetic()
const replacement = [String.fromCharCode(65, 97, 49, 33), synthetic()].join(String.fromCharCode(45))
const put = vi.mocked(api.put)
function seed(role = 'STAFF', forced = false) {
  localStorage.setItem('token', initialToken)
  localStorage.setItem('user', JSON.stringify({ ...account, role, mustChangePassword: forced }))
}
function renderScreen() { render(<MemoryRouter><ChangePassword /></MemoryRouter>) }
async function fill(current = currentPassword, next = replacement, confirmation = next) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^Current password$/i), current)
  await user.type(screen.getByLabelText(/^New password$/i), next)
  await user.type(screen.getByLabelText(/^Confirm new password$/i), confirmation)
  return user
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  window.history.pushState({}, '', '/profile/change-password')
  seed()
})

describe('ordinary password change', () => {
  it('requires the current password before calling the API', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: /^Change password$/i }))
    expect(put).not.toHaveBeenCalled()
  })

  it.each([
    ['short replacement', 'short', 'short'],
    ['mismatched confirmation', replacement, 'Another-river-2026'],
    ['unchanged password', currentPassword, currentPassword],
  ])('does not submit %s', async (_label, next, confirmation) => {
    renderScreen()
    const user = await fill(currentPassword, next, confirmation)
    await user.click(screen.getByRole('button', { name: /^Change password$/i }))
    if (next === currentPassword) {
      expect(validatePassword(currentPassword)).toBeNull()
      expect(screen.getByText('Choose a password different from your current password.')).toBeInTheDocument()
    }
    expect(put).not.toHaveBeenCalled()
  })

  it('submits only current and new passwords, installs the accepted session and clears secrets', async () => {
    put.mockResolvedValue({ data: { success: true, token: nextToken, user: account } })
    renderScreen()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: /^Change password$/i }))
    await screen.findByText(/Password changed successfully/i)
    expect(put).toHaveBeenCalledWith('/users/change-password', {
      currentPassword: currentPassword, newPassword: replacement,
    })
    expect(localStorage.getItem('token')).toBe(nextToken)
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject(account)
    expect(localStorage.getItem('user')).not.toContain(replacement)
    expect(screen.queryByDisplayValue(replacement)).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue(currentPassword)).not.toBeInTheDocument()
  })

  it.each([
    ['missing token', { success: true, user: account }],
    ['missing user', { success: true, token: nextToken }],
    ['rejected success flag', { success: false, token: nextToken, user: account }],
    ['foreign account', { success: true, token: nextToken, user: { ...account, id: 'other-account' } }],
    ['still forced', { success: true, token: nextToken, user: { ...account, mustChangePassword: true } }],
  ])('does not report success or replace the session for %s', async (_label, data) => {
    put.mockResolvedValue({ data })
    renderScreen()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: /^Change password$/i }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Change password$/i })).not.toBeDisabled())
    expect(screen.queryByText(/Password changed successfully/i)).not.toBeInTheDocument()
    expect(localStorage.getItem('token')).toBe(initialToken)
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject(account)
  })

  it('keeps an API refusal inline without replacing the stored session', async () => {
    put.mockRejectedValue({ response: { status: 401, data: { message: 'Invalid current password' } } })
    renderScreen()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: /^Change password$/i }))
    await screen.findByText(/Invalid current password/i)
    expect(localStorage.getItem('token')).toBe(initialToken)
    expect(screen.queryByText(/Password changed successfully/i)).not.toBeInTheDocument()
  })

  it('prevents a duplicate request while awaiting acceptance', async () => {
    let finish!: (value: unknown) => void
    put.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderScreen()
    const user = await fill()
    const submit = screen.getByRole('button', { name: /^Change password$/i })
    await user.click(submit)
    expect(submit).toBeDisabled()
    fireEvent.submit(submit.closest('form')!)
    expect(put).toHaveBeenCalledTimes(1)
    finish({ data: { success: true, token: nextToken, user: account } })
    await screen.findByText(/Password changed successfully/i)
  })

  it('supports keyboard form submission and accessible password visibility', async () => {
    put.mockResolvedValue({ data: { success: true, token: nextToken, user: account } })
    renderScreen()
    const user = await fill()
    const current = screen.getByLabelText(/^Current password$/i)
    await user.click(screen.getByRole('button', { name: /Show current password/i }))
    expect(current).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: /Hide current password/i }))
    expect(current).toHaveAttribute('type', 'password')
    await user.click(screen.getByLabelText(/^Confirm new password$/i))
    await user.keyboard('{Enter}')
    await screen.findByText(/Password changed successfully/i)
    expect(put).toHaveBeenCalledTimes(1)
  })
})

describe('mounted ordinary password route', () => {
  it.each(['STAFF', 'HR', 'SUPERADMIN'])('admits an ordinary %s account', async (role) => {
    seed(role)
    render(<App />)
    expect(await screen.findByRole('heading', { name: /^Change password$/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/profile/change-password')
  })
  it('sends a signed-out visitor to login', async () => {
    localStorage.clear()
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })
  it('holds an account owing a password change on forced setup', async () => {
    seed('STAFF', true)
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/set-password'))
    expect(put).not.toHaveBeenCalled()
  })
})
