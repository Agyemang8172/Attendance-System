/**
 * M5 — Sidebar navigation with the R7 accessible account menu.
 *
 * Covers the two behaviours the route suite cannot: that navigation items are
 * filtered by the signed-in role, and that the account menu is a real
 * accessible popover — aria-expanded state, Escape, click-outside, arrow-key
 * cycling, and a sign-out that clears the session and leaves the app.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const PathProbe = () => {
  const { pathname } = useLocation()
  return <span data-testid="path">{pathname}</span>
}

/** Writes the same two keys `utils/auth.login` writes, without needing an API. */
function seedSession(role, overrides = {}) {
  localStorage.setItem('token', 'test-session-token')
  localStorage.setItem(
    'user',
    JSON.stringify({ role, mustChangePassword: false, ...overrides })
  )
}

function renderSidebar(role = 'STAFF', overrides = {}) {
  seedSession(role, overrides)
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Sidebar isOpen={false} onClose={() => {}} />
      <PathProbe />
    </MemoryRouter>
  )
}

function openAccountMenu() {
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: /ada lovelace/i })
  return { user, trigger }
}

beforeEach(() => {
  localStorage.clear()
})

describe('navigation is filtered by role', () => {
  it('shows STAFF its own links only', () => {
    renderSidebar('STAFF')

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('My Profile')).toBeInTheDocument()
    expect(screen.getByText('My Schedule')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.queryByText('HR Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Manage Staff')).not.toBeInTheDocument()
  })

  it('shows HR its links and hides staff only ones', () => {
    renderSidebar('HR')

    expect(screen.getByText('HR Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Manage Staff')).toBeInTheDocument()
    expect(screen.getByText('My Profile')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('My Schedule')).not.toBeInTheDocument()
  })

  it('shows SUPERADMIN staff management on top of its links', () => {
    renderSidebar('SUPERADMIN')

    expect(screen.getByText('Manage Staff')).toBeInTheDocument()
    expect(screen.getByText('HR Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('My Schedule')).not.toBeInTheDocument()
  })
})

describe('the account menu (R7)', () => {
  it('is closed with aria-expanded=false and opens on click', async () => {
    renderSidebar('SUPERADMIN', { firstName: 'Ada', lastName: 'Lovelace' })

    const trigger = screen.getByRole('button', { name: /ada lovelace/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()

    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: /account menu/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /my profile/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    renderSidebar('STAFF', { firstName: 'Ada', lastName: 'Lovelace' })
    const { user, trigger } = openAccountMenu()
    await user.click(trigger)

    await user.keyboard('{Escape}')

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('closes when the user clicks outside the menu', async () => {
    renderSidebar('STAFF', { firstName: 'Ada', lastName: 'Lovelace' })
    const { user, trigger } = openAccountMenu()
    await user.click(trigger)

    fireEvent.mouseDown(document.body)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('cycles focus with the arrow keys', async () => {
    renderSidebar('STAFF', { firstName: 'Ada', lastName: 'Lovelace' })
    const { user, trigger } = openAccountMenu()
    await user.click(trigger)

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()

    // Opening focuses the first item (My Profile); ArrowDown steps forward.
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: /settings/i })).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toHaveFocus()

    // ArrowUp wraps back.
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: /settings/i })).toHaveFocus()
  })

  it('signs out: clears the session and leaves the app', async () => {
    renderSidebar('STAFF', { firstName: 'Ada', lastName: 'Lovelace' })
    const { user, trigger } = openAccountMenu()
    await user.click(trigger)

    await user.click(screen.getByRole('menuitem', { name: /sign out/i }))

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(screen.getByTestId('path').textContent).toBe('/login')
  })

  it('uses a menu item to reach Settings', async () => {
    renderSidebar('HR', { firstName: 'Ada', lastName: 'Lovelace' })
    const { user, trigger } = openAccountMenu()
    await user.click(trigger)

    await user.click(screen.getByRole('menuitem', { name: /settings/i }))

    expect(screen.getByTestId('path').textContent).toBe('/settings')
    expect(screen.getByRole('button', { name: /ada lovelace/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })
})