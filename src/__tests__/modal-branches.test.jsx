import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddEmployeeModal from '../components/ui/AddEmployeeModal'
import EditEmployeeModal from '../components/ui/EditEmployeeModal'
import ResetPasswordModal from '../components/ui/ResetPasswordModal'
import AttendanceTable from '../components/ui/AttendanceTable'

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

describe('modal shells render their branches', () => {
  it('opens and closes the add-employee modal', async () => {
    const onClose = vi.fn()
    const onAdd = vi.fn()
    render(<AddEmployeeModal onClose={onClose} onAdd={onAdd} />)

    const user = userEvent.setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const inputs = screen.getAllByRole('textbox')
    for (const input of inputs) await user.type(input, 'Kojo')
    const selects = screen.getAllByRole('combobox')
    for (const sel of selects) {
      if (sel.options.length > 1) await user.selectOptions(sel, sel.options[1].value)
    }
    await user.click(screen.getByRole('button', { name: /create/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('opens the edit-employee modal with a user', async () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(<EditEmployeeModal user={staffUser} onClose={onClose} onSave={onSave} />)

    const user = userEvent.setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const inputs = screen.getAllByRole('textbox')
    if (inputs.length > 0) await user.clear(inputs[0])
    const selects = screen.getAllByRole('combobox')
    for (const sel of selects) {
      if (sel.options.length > 1) await user.selectOptions(sel, sel.options[1].value)
    }
    await user.click(screen.getByRole('button', { name: /save|submit|create/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

})

