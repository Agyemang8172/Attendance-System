/**
 * M7 — HR / SUPERADMIN account workflows on the staff management page.
 *
 * Covers the admin password-reset UI and the reactivate flow, plus the
 * empty-state actions that turn the staff list into something you can act on.
 *
 * The API client is stubbed wholesale. `get` feeds the ManageStaff list,
 * `put` answers the reset and reactivate calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ManageStaff from '../pages/ManageStaff'
import StaffTable from '../components/ui/StaffTable'
import ResetPasswordModal from '../components/ui/ResetPasswordModal'
import api from '../api/axios'

vi.mock('../api/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(() => new Promise(() => {})),
    put: vi.fn(() => new Promise(() => {})),
    delete: vi.fn(() => new Promise(() => {})),
  },
}))

const get = api.get
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

function paginated(users) {
  return {
    data: {
      data: users,
      pagination: { currentPage: 1, totalPages: 1, totalUsers: users.length },
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('StaffTable — actions depend on the view', () => {
  it('shows Reset and Deactivate on active rows', () => {
    render(
      <StaffTable
        users={[staffUser]}
        onEdit={() => {}}
        onResetPassword={() => {}}
        onDeactivate={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reactivate/i })).not.toBeInTheDocument()
    // No status column on the active list
    expect(screen.queryByText('Inactive', { exact: true })).not.toBeInTheDocument()
  })

  it('renders an actionable empty state on the active view', async () => {
    const onAdd = vi.fn()
    render(
      <StaffTable users={[]} onEdit={() => {}} onDeactivate={() => {}} onAdd={onAdd} />
    )

    const addBtn = screen.getByRole('button', { name: /add employee/i })
    expect(addBtn).toBeInTheDocument()
    await userEvent.click(addBtn)
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('hides Reset and offers Reactivate on inactive rows', () => {
    render(
      <StaffTable
        users={[staffUser]}
        inactive
        canReactivate
        onEdit={() => {}}
        onReactivate={() => {}}
        onShowActive={() => {}}
      />
    )

    expect(screen.getByText('Inactive', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reactivate/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()
  })

  it('renders an actionable empty state on the inactive view', async () => {
    const onShowActive = vi.fn()
    render(
      <StaffTable
        users={[]}
        inactive
        onEdit={() => {}}
        onReactivate={() => {}}
        onShowActive={onShowActive}
      />
    )

    const btn = screen.getByRole('button', { name: /view active employees/i })
    await userEvent.click(btn)
    expect(onShowActive).toHaveBeenCalledTimes(1)
  })

  it('disables Reactivate for an HR caller', () => {
    render(
      <StaffTable
        users={[staffUser]}
        inactive
        canReactivate={false}
        onEdit={() => {}}
        onReactivate={() => {}}
        onShowActive={() => {}}
      />
    )

    const btn = screen.getByRole('button', { name: /reactivate/i })
    expect(btn).toBeDisabled()
  })
})

describe('ResetPasswordModal', () => {
  it('confirm → PUT → reveal the temporary password once', async () => {
    put.mockResolvedValue({
      data: {
        success: true,
        message: 'Password reset.',
        tempPassword: 'placeholder-token',
      },
    })
    const onReset = vi.fn()
    const onClose = vi.fn()

    render(
      <ResetPasswordModal user={staffUser} onReset={onReset} onClose={onClose} />
    )

    // Confirm step shows who is being reset
    expect(screen.getByText(/reset password\?/i)).toBeInTheDocument()
    expect(screen.getByText(/ama boateng/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await vi.waitFor(() => {
      expect(put).toHaveBeenCalledWith('/users/u-1/reset-password')
    })

    // Reveal shows the single-use credential with a copy row
    expect(screen.getByText('placeholder-token')).toBeInTheDocument()
    expect(screen.getByText('Temporary Password', { exact: true })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('surfaces the inline error when the reset fails', async () => {
    put.mockRejectedValue({
      response: { data: { message: 'Locked out — contact support' } },
    })

    render(<ResetPasswordModal user={staffUser} onReset={() => {}} onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/locked out — contact support/i)).toBeInTheDocument()
    })
    // Still on the confirm step — no reveal without a tempPassword
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument()
  })
})

describe('ManageStaff — view toggle and account actions', () => {
  function renderManageStaff(role, users = [staffUser]) {
    seedSession(role, { email: `${role.toLowerCase()}@attendpro.com` })
    get.mockResolvedValue(paginated(users))
    return render(
      <MemoryRouter>
        <ManageStaff />
      </MemoryRouter>
    )
  }

  it('fetches the active list by default and the inactive list on toggle', async () => {
    renderManageStaff('SUPERADMIN')

    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledWith('/users', {
        params: { page: 1, limit: 10 },
      })
    })

    await userEvent.click(screen.getByRole('tab', { name: /inactive/i }))

    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledWith('/users', {
        params: { page: 1, limit: 10, isActive: false },
      })
    })
  })

  it('lets a SUPERADMIN reset a password from a row action', async () => {
    put.mockResolvedValue({
      data: { success: true, message: 'Password reset.', tempPassword: 'placeholder-token' },
    })
    renderManageStaff('SUPERADMIN')

    await userEvent.click(await screen.findByRole('button', { name: /reset/i }))

    // Modal (chrome) opens on the confirm step
    expect(screen.getByText(/reset password\?/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await vi.waitFor(() => {
      expect(put).toHaveBeenCalledWith('/users/u-1/reset-password')
    })
    expect(screen.getByText('placeholder-token')).toBeInTheDocument()
  })

  it('reactivates a deactivated employee for a SUPERADMIN', async () => {
    put.mockResolvedValue({ data: { success: true, message: 'Reactivated' } })
    renderManageStaff('SUPERADMIN', [{ ...staffUser, isActive: false }])

    await userEvent.click(screen.getByRole('tab', { name: /inactive/i }))
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledWith('/users', {
        params: { page: 1, limit: 10, isActive: false },
      })
    })

    await userEvent.click(screen.getByRole('button', { name: /reactivate/i }))
    expect(screen.getByText(/reactivate employee\?/i)).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^reactivate$/i })
    )

    await vi.waitFor(() => {
      expect(put).toHaveBeenCalledWith('/users/u-1', { isActive: true })
    })
  })

  it('blocks reactivation for an HR caller (disabled row action)', async () => {
    renderManageStaff('HR', [{ ...staffUser, isActive: false }])

    await userEvent.click(screen.getByRole('tab', { name: /inactive/i }))
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledWith('/users', {
        params: { page: 1, limit: 10, isActive: false },
      })
    })

    const btn = screen.getByRole('button', { name: /reactivate/i })
    expect(btn).toBeDisabled()
  })
})