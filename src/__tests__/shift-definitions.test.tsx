import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShiftManagement from '../pages/ShiftManagement'
import api from '../api/axios'
import toast from 'react-hot-toast'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const patch = vi.mocked(api.patch)
const id = '11111111-1111-4111-8111-111111111111'
const shift = {
  id, name: 'Night coverage', startMinute: 1320, endMinute: 360,
  crossesMidnight: true, isActive: true,
  createdAt: '2026-11-05T10:00:00.000Z', updatedAt: '2026-11-05T10:00:00.000Z',
}
const response = (rows: unknown[] = [shift], total = 1, page = 1, totalPages = 1) => ({
  data: { success: true, data: rows, pagination: { currentPage: page, totalPages, totalRecords: total } },
})
const signIn = (role = 'SUPERADMIN') => {
  localStorage.setItem('token', 'isolated-session')
  localStorage.setItem('user', JSON.stringify({ id: 'admin-1', role, mustChangePassword: false }))
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  signIn()
  get.mockResolvedValue(response())
  post.mockImplementation(async (path, payload) => ({ data: { success: true, data: {
    ...shift, ...(String(path).endsWith('/deactivate') ? { isActive: false } : payload as object),
  } } }))
  patch.mockImplementation(async (_path, payload) => ({ data: { success: true, data: { ...shift, ...payload as object } } }))
})

describe('P10 shift definitions', () => {
  it('sends real search, status and page filters and uses server totals', async () => {
    get.mockImplementation(async (_path, config) => {
      const params = (config as { params: { page: number } }).params
      return response([shift], 21, params.page, 3)
    })
    render(<ShiftManagement />)
    expect(await screen.findByText('Night coverage')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/business/shifts', expect.objectContaining({
      params: { page: 1, limit: 10 }, signal: expect.any(AbortSignal),
    }))
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Search shifts' }), 'night')
    await user.selectOptions(screen.getByLabelText('Status'), 'false')
    await waitFor(() => expect(get).toHaveBeenCalledWith('/business/shifts', expect.objectContaining({
      params: { page: 1, limit: 10, search: 'night', isActive: 'false' },
    })))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(get).toHaveBeenCalledWith('/business/shifts', expect.objectContaining({
      params: { page: 2, limit: 10, search: 'night', isActive: 'false' },
    })))
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
  })

  it('refuses contradictory geometry and creates a real overnight minute payload', async () => {
    render(<ShiftManagement />)
    await screen.findByText('Night coverage')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Create Shift' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), ' Evening watch ')
    fireEvent.change(within(dialog).getByLabelText('Start Time'), { target: { value: '22:00' } })
    fireEvent.change(within(dialog).getByLabelText('End Time'), { target: { value: '06:00' } })
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('select Overnight')
    expect(post).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', { name: /Crosses midnight/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/business/shifts', {
      name: 'Evening watch', startMinute: 1320, endMinute: 360, crossesMidnight: true,
    }))
  })

  it('refuses a false overnight flag and shows a server name conflict without closing the form', async () => {
    render(<ShiftManagement />)
    await screen.findByText('Night coverage')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit Night coverage' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('checkbox', { name: /Crosses midnight/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Update' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('select Overnight')
    expect(patch).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', { name: /Crosses midnight/ }))
    patch.mockRejectedValueOnce({ response: { data: { message: 'A shift with that name already exists in this business.' } } })
    await user.click(within(dialog).getByRole('button', { name: 'Update' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already exists')
    expect(dialog).toBeInTheDocument()
  })

  it('deactivates rather than deletes and preserves a failed action in the dialog', async () => {
    render(<ShiftManagement />)
    await screen.findByText('Night coverage')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Deactivate Night coverage' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Historical attendance records will be preserved/)).toBeInTheDocument()
    post.mockRejectedValueOnce({ response: { data: { message: 'Could not deactivate this shift.' } } })
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not deactivate this shift.')
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/business/shifts/${id}/deactivate`))
  })

  it('reactivates an inactive row through the existing PATCH contract', async () => {
    get.mockResolvedValue(response([{ ...shift, isActive: false }]))
    render(<ShiftManagement />)
    await screen.findByText('Night coverage')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Activate Night coverage' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith(`/business/shifts/${id}`, { isActive: true }))
    expect(post).not.toHaveBeenCalled()
  })

  it('separates load failure with retry from an empty filtered result', async () => {
    get.mockResolvedValue(response([], 0, 1, 0))
    get.mockRejectedValueOnce(new Error('offline'))
    render(<ShiftManagement />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load shifts')
    expect(screen.queryByText('No shifts defined.')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No shifts defined.')).toBeInTheDocument()
    await userEvent.setup().selectOptions(screen.getByLabelText('Status'), 'true')
    expect(await screen.findByText('No shifts match these filters.')).toBeInTheDocument()
  })

  it('keeps every write control hidden for a read-only role', async () => {
    // The route itself is SUPERADMIN-only (DESIGN-PLAN A-03). This covers the
    // component contract underneath that guard: if the page is ever mounted for
    // a reader, no write control may appear.
    signIn('HR')
    render(<ShiftManagement />)
    expect(await screen.findByText('Night coverage')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create Shift' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Night coverage' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate Night coverage' })).not.toBeInTheDocument()
  })

  it.each([
    { ...response(), data: { ...response().data, success: false } },
    response([shift], 1, 1, 2),
  ])('rejects unconfirmed or inconsistent list metadata', async malformed => {
    get.mockResolvedValue(malformed)
    render(<ShiftManagement />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/load shifts|response|unavailable/i)
    expect(screen.queryByText('Night coverage')).not.toBeInTheDocument()
  })

  it('discards a pending list after the account is replaced', async () => {
    let settle!: (value: unknown) => void
    get.mockImplementation(() => new Promise(resolve => { settle = resolve }))
    render(<ShiftManagement />)
    localStorage.setItem('user', JSON.stringify({ id: 'another-admin', role: 'SUPERADMIN', mustChangePassword: false }))
    await act(async () => { settle(response()) })
    expect(screen.queryByText('Night coverage')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(/session|sign in|reload/i)
  })

  it('suppresses a settled mutation after its token is replaced', async () => {
    let settle!: (value: unknown) => void
    post.mockImplementation(() => new Promise(resolve => { settle = resolve }))
    render(<ShiftManagement />)
    await screen.findByText('Night coverage')
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate Night coverage' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }))
    localStorage.setItem('token', 'replacement-isolated-session')
    await act(async () => { settle({ data: { success: true, data: { ...shift, isActive: false } } }) })
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled()
    expect(screen.queryByText('Night coverage')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(/session|sign in|reload/i)
  })

  it('does not acknowledge a malformed successful mutation as saved', async () => {
    post.mockResolvedValue({ data: { success: false } })
    render(<ShiftManagement />)
    await screen.findByText('Night coverage')
    await userEvent.click(screen.getByRole('button', { name: 'Create Shift' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Evening cover' } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled()
    expect(dialog).toBeInTheDocument()
  })

  it('locks duplicate mutation confirmation in the same event batch', async () => {
    let settle!: (value: unknown) => void
    post.mockImplementation(() => new Promise(resolve => { settle = resolve }))
    render(<ShiftManagement />)
    await screen.findByText('Night coverage')
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate Night coverage' }))
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' })
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm) })
    expect(post).toHaveBeenCalledTimes(1)
    await act(async () => { settle({ data: { success: true, data: { ...shift, isActive: false } } }) })
  })
})
