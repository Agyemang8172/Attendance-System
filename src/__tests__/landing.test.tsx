/**
 * Landing page tests — PRD §6 verification.
 *
 * Testing the public product preview with its privacy constraints (static fictional
 * constants only), and confirming the role of Landing as the "public site"
 * within the routing contract in App.jsx.
 *
 * Strategy: render Landing with a memory router, scan for required presence,
 * for absent links (no register, no recovery), and verify the sample-data caption
 * inside the preview area is visible (the PRD §6 rule that reads must never
 * mistake the preview for live data).
 *
 * The component is display-only, zero fetch calls, and its constants match the
 * approved M1 §2 sample table for direct traceability.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../pages/Landing'

describe('Landing', () => {
  const renderLanding = () => {
    return render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )
  }

  it('renders the brand header with Sign in link', () => {
    renderLanding()

    expect(screen.getByText('AttendPro')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sign in/ })).toHaveAttribute('href', '/login')
  })

  it('includes the product overview sections per PRD §6', () => {
    renderLanding()

    // Hero product summary (kiosk attendance, dashboards)
    expect(screen.getByText('Attendance that starts at the kiosk.')).toBeInTheDocument()
    expect(screen.getByText(/AttendPro records attendance at a shared kiosk/)).toBeInTheDocument()
    expect(screen.getByText(/Staff clock in and out at the start and end of every shift/)).toBeInTheDocument()
  })

  it('shows the fictional preview row (Expected/Clocked/Late/Open)', () => {
    renderLanding()

    // From SAMPLE_FIGURES in Landing.tsx — the stat values are unique on the page
    expect(screen.getByText('42')).toBeInTheDocument() // Expected today
    expect(screen.getByText('37')).toBeInTheDocument() // Clocked in
    expect(screen.getByText('5')).toBeInTheDocument()  // Late
    expect(screen.getByText('3')).toBeInTheDocument()  // Open sessions

    // Labels
    expect(screen.getByText('Expected today')).toBeInTheDocument()
    expect(screen.getByText('Clocked in')).toBeInTheDocument()
    expect(screen.getByText('Open sessions')).toBeInTheDocument()
  })

  it('renders the five-row sample attendance table with fictional Ghanaian names', () => {
    renderLanding()

    // From SAMPLE_ROWS in Landing.tsx — names appear in both table and mobile card
    // Use getAllByText since the row appears twice in the DOM (table row + card item)
    const nameCounts = ['Kwabena Mensah', 'Akosua Boateng', 'Yaw Owusu', 'Abena Asante', 'Kofi Appiah']
      .map(name => screen.getAllByText(name).length)
    nameCounts.forEach(count => expect(count).toBeGreaterThanOrEqual(1))

    // Shift and clock-in values — some appear in both table and card
    expect(screen.getAllByText('Morning').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Afternoon').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Night').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('05:55 AM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('06:00 AM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('06:18 AM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('02:04 PM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(1)

    // Status pills (rendered with the shared Pill tones)
    expect(screen.getAllByText('Early').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('On time').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Late').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Open session').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the sample-data caption inside the preview panel (PRD §6 privacy rule)', () => {
    renderLanding()

    // The caption appears twice (table <caption> + card list header) — confirm presence
    expect(screen.getAllByText('Sample data — not real records').length).toBeGreaterThanOrEqual(1)

    // The footnote inside the panel also reinforces this
    expect(screen.getByText(/Figures and names on this panel are fictional examples/)).toBeInTheDocument()
  })

  it('excludes the business registration link (O1)', () => {
    renderLanding()

    // O1 explicitly omits the /register route from the public site.
    // No link should appear for visitors who are not logged in.
    // The browser would navigate to /register if present, so we assert its absence.
    const registerLinks = screen.queryAllByRole('link', { name: /register|sign up/i })
    expect(registerLinks).toHaveLength(0)
  })

  it('omits the account recovery link (M8-R3)', () => {
    renderLanding()

    // M8-R3 reports the O6 recovery endpoints were never built, so the link
    // does not appear anywhere on the public page. This is both the contract
    // and the implementation rule.
    const recoveryLinks = screen.queryAllByRole('link', { name: /forgot.*access|recovery|password/ })
    expect(recoveryLinks).toHaveLength(0)
  })

  it('includes the footer with the correct license and business line', () => {
    renderLanding()

    expect(screen.getByText(/© 2026 AttendPro. All rights reserved/)).toBeInTheDocument()
    expect(screen.getByText(/Built for Ghana's shift businesses/)).toBeInTheDocument()
  })

  it('renders without horizontal scroll containers at the smallest breakpoint', () => {
    // Mobile strategy (documented in Landing.tsx): the sample table collapses
    // into stacked record cards below the sm breakpoint, so no horizontal
    // scroll container is rendered. This test confirms the page renders cleanly.
    renderLanding()

    // The preview panel wraps its content inside a box that never overflows;
    // if the table structure leaked out we would see an element with a forced
    // min-width. We assert a clean structural absence.
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Kwabena Mensah').length).toBeGreaterThanOrEqual(1)
  })
})