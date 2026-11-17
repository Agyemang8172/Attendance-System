import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../pages/Landing'

describe('Landing', () => {
  const renderLanding = () => render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  )

  it('renders the brand header with Sign in links', () => {
    renderLanding()

    expect(screen.getByText('AttendPro')).toBeInTheDocument()
    const signInLinks = screen.getAllByRole('link', { name: /Sign in/ })
    expect(signInLinks).toHaveLength(2)
    signInLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'))
  })

  it('uses the approved headline and general-purpose description', () => {
    renderLanding()

    expect(screen.getByText('Attendance that starts at the kiosk.')).toBeInTheDocument()
    expect(screen.getByText(/AttendPro helps businesses record staff attendance/)).toBeInTheDocument()
  })

  it('shows the approved summary figures in the preview and walkthrough', () => {
    renderLanding()

    expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('37').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)

    expect(screen.getAllByText('Expected').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Clocked in').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Late').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Open sessions').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the brand mark and compliant font weight in header', () => {
    const { container } = renderLanding()

    const brandWordmark = screen.getByText('AttendPro')
    expect(brandWordmark).toHaveClass('font-semibold')
    expect(brandWordmark).not.toHaveClass('font-bold')

    const brandMarkSvg = container.querySelector('header svg.text-accent')
    expect(brandMarkSvg).toBeInTheDocument()
    expect(brandMarkSvg).toHaveAttribute('aria-hidden', 'true')
  })

  it('orders KPI description list so that dt precedes dd', () => {
    const { container } = renderLanding()

    const dl = container.querySelector('#preview dl')
    expect(dl).toBeInTheDocument()

    const divs = dl?.querySelectorAll(':scope > div')
    expect(divs && divs.length > 0).toBe(true)

    divs?.forEach((div) => {
      const children = Array.from(div.children)
      expect(children).toHaveLength(2)
      expect(children[0].tagName.toLowerCase()).toBe('dt')
      expect(children[1].tagName.toLowerCase()).toBe('dd')
    })
  })

  it('applies horizontal padding to Today at a glance section header', () => {
    const { container } = renderLanding()

    const sectionHeaderWrapper = container.querySelector('#preview .px-5.sm\\:px-6.pt-4')
    expect(sectionHeaderWrapper).toBeInTheDocument()
    expect(sectionHeaderWrapper?.textContent).toContain('Today at a glance')
  })

  it('renders the five-row sample attendance table with approved names and clock-out values', () => {
    renderLanding()

    ;['Kwabena Mensah', 'Akosua Boateng', 'Yaw Owusu', 'Abena Asante', 'Kofi Appiah']
      .forEach((name) => expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1))

    expect(screen.getAllByText('05:55 AM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('02:00 PM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('06:18 AM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('02:15 PM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('02:04 PM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('10:00 PM').length).toBeGreaterThanOrEqual(1)

    expect(screen.getAllByText('Early').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('On time').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Late').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Open session').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the sample-data caption inside the preview panel', () => {
    renderLanding()

    expect(screen.getAllByText('Sample data — not real records').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Figures and names on this panel are fictional examples/)).toBeInTheDocument()
  })

  it('excludes registration and recovery links', () => {
    renderLanding()

    expect(screen.queryAllByRole('link', { name: /register|sign up/i })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: /forgot.*access|recovery|password/ })).toHaveLength(0)
  })

  it('uses the general-purpose footer', () => {
    renderLanding()

    expect(screen.getByText(/© 2026 AttendPro. All rights reserved/)).toBeInTheDocument()
    expect(screen.getByText('Attendance management for modern teams.')).toBeInTheDocument()
    expect(screen.queryByText(/Built for Ghana's shift businesses/)).not.toBeInTheDocument()
  })

  it('has the preview anchor and a table', () => {
    renderLanding()

    expect(document.getElementById('preview')).not.toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('renders the product walkthrough controls and transcript with compliant touch targets', () => {
    const { container } = renderLanding()

    const playPauseBtn = screen.getByRole('button', { name: /Pause walkthrough|Play walkthrough/ })
    const replayBtn = screen.getByRole('button', { name: /Replay walkthrough/ })

    expect(playPauseBtn).toBeInTheDocument()
    expect(replayBtn).toBeInTheDocument()
    expect(screen.getByText('Transcript')).toBeInTheDocument()

    // 44px touch targets
    expect(playPauseBtn).toHaveClass('min-h-[44px]')
    expect(playPauseBtn).toHaveClass('min-w-[44px]')
    expect(replayBtn).toHaveClass('min-h-[44px]')
    expect(replayBtn).toHaveClass('min-w-[44px]')

    // Initial scene visual exists in DOM/SVG
    expect(container.querySelector('[data-testid="scene-summary"]')).toBeInTheDocument()
  })
})