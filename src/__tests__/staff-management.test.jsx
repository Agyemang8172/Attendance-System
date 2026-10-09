/**
 * M6 — the role lock on the employee modals.
 *
 * D4 gave the two modals a boundary: HR accounts may only mint and edit STAFF
 * accounts, and only a SUPERADMIN can grant or change a role. The Role select
 * therefore stays VISIBLE but DISABLED for an HR caller — never hidden, so the
 * boundary is legible — and the payloads leaving the modal match the contract
 * (HR never sends `role`). This suite proves the frontend half of that policy:
 * what an HR caller sees, and what an HR caller's save actually carries.
 *
 * The SUPERADMIN half of the same two modals is asserted as the control: the
 * select is live, a new role is selectable, and it rides in the update body.
 *
 * The API client is stubbed wholesale; every request method is scripted to
 * resolve with the minimal body each modal reads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddEmployeeModal from '../components/ui/AddEmployeeModal'
import EditEmployeeModal from '../components/ui/EditEmployeeModal'
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
const put = api.put

/** Writes the same two keys `utils/auth.login` writes, without needing an API. */
function seedSession(role, overrides = {}) {
  localStorage.setItem('token', 'test-session-token')
  localStorage.setItem(
    'user',
    JSON.stringify({ role, mustChangePassword: false, ...overrides })
  )
}

const staffUser = {
  id: 'u-1',
  employeeCode: 'EMP-0002',
  firstName: 'Ama',
  lastName: 'Boateng',
  email: 'ama@attendpro.com',
  department: 'Operations',
  role: 'STAFF',
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AddEmployeeModal — the Role select reflects the caller', () => {
  it('disables Role for an HR caller and pins the payload to STAFF', async () => {
    seedSession('HR', { email: 'hr@attendpro.com' })
    post.mockResolvedValue({
      data: { data: { employeeCode: 'EMP-0009' }, tempPassword: 'amber-tiger-42' },
    })

    render(<AddEmployeeModal onClose={() => {}} onCreated={() => {}} />)

    const role = screen.getByRole('combobox')
    expect(role).toBeDisabled()
    expect(screen.getByText(/staff accounts/i)).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Ama'), 'Yaa')
    await userEvent.type(screen.getByPlaceholderText('Boateng'), 'Asante')
    await userEvent.type(screen.getByPlaceholderText('ama@company.com'), 'yaa@attendpro.com')
    await userEvent.type(screen.getByPlaceholderText('Operations'), 'Finance')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitForSent()
    expect(post).toHaveBeenCalledWith(
      '/users',
      expect.objectContaining({ role: 'STAFF' })
    )
  })

  it('keeps Role enabled for a SUPERADMIN caller', () => {
    seedSession('SUPERADMIN', { email: 'super@attendpro.com' })

    render(<AddEmployeeModal onClose={() => {}} onCreated={() => {}} />)

    const role = screen.getByRole('combobox')
    expect(role).toBeEnabled()
    expect(screen.queryByText(/staff accounts/i)).not.toBeInTheDocument()
  })
})

describe('EditEmployeeModal — the Role select reflects the caller', () => {
  it('disables Role for an HR caller and omits role from the update body', async () => {
    seedSession('HR', { email: 'hr@attendpro.com' })
    put.mockResolvedValue({ data: { success: true } })

    render(
      <EditEmployeeModal user={staffUser} onClose={() => {}} onUpdated={() => {}} />
    )

    const role = screen.getByRole('combobox')
    expect(role).toBeDisabled()
    expect(screen.getByText(/system administrator can change/i)).toBeInTheDocument()

    // Make a real change so the "nothing changed" guard lets the save through.
    const first = screen.getByPlaceholderText('Ama')
    await userEvent.clear(first)
    await userEvent.type(first, 'Yaa')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitForSent()
    const [url, body] = put.mock.calls[0]
    expect(url).toBe('/users/u-1')
    expect(body).not.toHaveProperty('role')
    expect(body).toHaveProperty('firstName', 'Yaa')
  })

  it('keeps Role enabled and sends it for a SUPERADMIN caller', async () => {
    seedSession('SUPERADMIN', { email: 'super@attendpro.com' })
    put.mockResolvedValue({ data: { success: true } })

    render(
      <EditEmployeeModal user={staffUser} onClose={() => {}} onUpdated={() => {}} />
    )

    const role = screen.getByRole('combobox')
    expect(role).toBeEnabled()

    await userEvent.selectOptions(role, 'HR')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitForSent()
    const [url, body] = put.mock.calls[0]
    expect(url).toBe('/users/u-1')
    expect(body).toHaveProperty('role', 'HR')
  })

  it('disables Role when a SUPERADMIN edits their own account', () => {
    const self = { ...staffUser, email: 'super@attendpro.com' }
    seedSession('SUPERADMIN', { email: 'super@attendpro.com' })

    render(
      <EditEmployeeModal user={self} onClose={() => {}} onUpdated={() => {}} />
    )

    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByText(/cannot change your own role/i)).toBeInTheDocument()
  })
})

/** Flushes the microtask the modal's await settles on. */
async function waitForSent() {
  await vi.waitFor(() => {
    expect(post.mock.calls.length + put.mock.calls.length).toBeGreaterThan(0)
  })
}