import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddEmployeeModal from '../components/ui/AddEmployeeModal'
import EditEmployeeModal from '../components/ui/EditEmployeeModal'
import api from '../api/axios'

vi.mock('../api/axios', () => ({
  default: { post: vi.fn(), put: vi.fn() },
}))

const staffUser = {
  id: 'u-1',
  employeeCode: 'EMP-0002',
  firstName: 'Ama',
  lastName: 'Boateng',
  email: 'ama@attendpro.com',
  department: 'Operations',
  role: 'STAFF',
  isActive: true,
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

async function fillNewEmployee(user) {
  await user.type(screen.getByPlaceholderText('Ama'), 'Kojo')
  await user.type(screen.getByPlaceholderText('Boateng'), 'Mensah')
  await user.type(screen.getByPlaceholderText('ama@company.com'), 'kojo@example.com')
  await user.type(screen.getByPlaceholderText('Operations'), 'Operations')
}

beforeEach(() => {
  vi.resetAllMocks()
  api.post.mockRejectedValue(new Error('Unexpected API request'))
  api.put.mockRejectedValue(new Error('Unexpected API request'))
})

describe('employee modal requests', () => {
  it('cancels the add modal while idle without a request', async () => {
    const onClose = vi.fn()
    const onCreated = vi.fn()
    render(<AddEmployeeModal onClose={onClose} onCreated={onCreated} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onCreated).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('disables cancel while creating and calls onCreated only after Done', async () => {
    const request = deferred()
    api.post.mockReturnValueOnce(request.promise)
    const onClose = vi.fn()
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<AddEmployeeModal onClose={onClose} onCreated={onCreated} />)
    await fillNewEmployee(user)
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(api.post).toHaveBeenCalledWith('/users', {
      firstName: 'Kojo', lastName: 'Mensah', email: 'kojo@example.com', department: 'Operations', role: 'STAFF',
    })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => request.resolve({ data: { data: { employeeCode: 'EMP-0003' }, tempPassword: 'temporary' } }))
    expect(screen.getByText('EMP-0003')).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onCreated).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows a create failure and allows cancellation', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'duplicate email' } } })
    const onClose = vi.fn()
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<AddEmployeeModal onClose={onClose} onCreated={onCreated} />)
    await fillNewEmployee(user)
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('That email is already taken.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('cancels the edit modal while idle without a request', async () => {
    const onClose = vi.fn()
    const onUpdated = vi.fn()
    render(<EditEmployeeModal user={staffUser} onClose={onClose} onUpdated={onUpdated} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onUpdated).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('disables cancel while saving and calls onUpdated after success', async () => {
    const request = deferred()
    api.put.mockReturnValueOnce(request.promise)
    const onClose = vi.fn()
    const onUpdated = vi.fn()
    const user = userEvent.setup()
    render(<EditEmployeeModal user={staffUser} onClose={onClose} onUpdated={onUpdated} />)
    await user.clear(screen.getByPlaceholderText('Ama'))
    await user.type(screen.getByPlaceholderText('Ama'), 'Kojo')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(api.put).toHaveBeenCalledWith('/users/u-1', expect.objectContaining({ firstName: 'Kojo' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(onUpdated).not.toHaveBeenCalled()
    await act(async () => request.resolve({ data: {} }))
    expect(onUpdated).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows an edit failure and allows cancellation', async () => {
    api.put.mockRejectedValueOnce({ response: { data: { error: 'Update failed' } } })
    const onClose = vi.fn()
    const onUpdated = vi.fn()
    const user = userEvent.setup()
    render(<EditEmployeeModal user={staffUser} onClose={onClose} onUpdated={onUpdated} />)
    await user.type(screen.getByPlaceholderText('Ama'), ' K')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Update failed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onUpdated).not.toHaveBeenCalled()
  })
})
