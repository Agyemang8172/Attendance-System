import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HrHelpRequests from '../pages/HrHelpRequests'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

const id = '11111111-1111-4111-8111-111111111111'
const row = {
  id, category: 'kiosk', subject: 'Scanner assistance', body: 'The camera could not read the badge.',
  status: 'OPEN', resolutionNote: null as string | null, resolvedAt: null,
  createdAt: '2026-11-04T10:00:00.000Z', updatedAt: '2026-11-04T10:00:00.000Z',
  requester: { id: 'test-requester', firstName: 'Ama', lastName: 'Mensah', email: 'ama@example.test' },
}
const get = vi.mocked(api.get)
const patch = vi.mocked(api.patch)
const detail = (data = row) => ({ data: { success: true, data } })
const listing = (data = [row], total = 1, currentPage = 1) => ({
  data: { success: true, data, pagination: { total, totalPages: Math.ceil(total / 12), currentPage } },
})
const detailPath = `/hr-help-requests/${id}`
const queuedPath = '/hr-help-requests?status=IN_REVIEW&page=2'
const renderView = (path = detailPath) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/hr-help-requests" element={<HrHelpRequests />} />
      <Route path="/hr-help-requests/:id" element={<HrHelpRequests />} />
    </Routes>
  </MemoryRouter>,
)
const action = (name: string) => screen.findByRole('button', { name })
const openAction = async (name: string) => {
  await userEvent.click(await action(name))
  return within(await screen.findByRole('dialog'))
}
const requestUrl = ([path, config]: Parameters<typeof api.get>) => {
  const url = new URL(path, 'http://local.test')
  for (const [key, value] of Object.entries(config?.params ?? {})) url.searchParams.set(key, String(value))
  return url
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  localStorage.setItem('token', 'isolated-session')
  localStorage.setItem('user', JSON.stringify({
    id: 'test-reviewer', firstName: 'Esi', lastName: 'Owusu', role: 'HR', mustChangePassword: false,
  }))
  get.mockImplementation(async url => String(url).includes(`/help-requests/${id}`) ? detail() : listing())
})

describe('HR Help queue and direct detail', () => {
  it('uses actual pagination, status and direct links, and preserves the queue on Back', async () => {
    get.mockImplementation(async url => String(url).includes(`/help-requests/${id}`)
      ? detail({ ...row, status: 'IN_REVIEW' })
      : listing([{ ...row, status: 'IN_REVIEW' }], 13, 2))
    renderView(`${queuedPath}&search=ignored&category=kiosk`)
    expect(await screen.findByText(row.subject)).toBeInTheDocument()
    expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Search/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Filter by category/i)).not.toBeInTheDocument()
    const url = requestUrl(get.mock.calls[0])
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'IN_REVIEW', page: '2', limit: '12' })
    const link = screen.getAllByRole('link').find(el => el.getAttribute('href')?.includes(id))
    expect(link).toBeDefined()
    await userEvent.click(link!)
    expect(await screen.findByText(row.body)).toBeInTheDocument()
    const back = screen.getByRole('link', { name: /Back to queue/i })
    expect(back).toHaveAttribute('href', queuedPath)
    await userEvent.click(back)
    expect(await screen.findByText(/Page 2 of 2/i)).toBeInTheDocument()
  })

  it('reads a direct record without fetching the queue', async () => {
    renderView(`${detailPath}?status=OPEN&page=2&returnTo=https://outside.example`)
    expect(await screen.findByText(row.body)).toBeInTheDocument()
    expect(screen.getByText(/Ama Mensah/)).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(1)
    expect(requestUrl(get.mock.calls[0]).pathname).toBe(`/hr/help-requests/${id}`)
    expect(screen.getByRole('link', { name: /Back to queue/i })).toHaveAttribute('href', '/hr-help-requests?status=OPEN&page=2')
  })

  it('rejects a mismatched detail identity', async () => {
    get.mockResolvedValue(detail({ ...row, id: '22222222-2222-4222-8222-222222222222' }))
    renderView()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(row.body)).not.toBeInTheDocument()
  })

  it('shows a failed detail read and allows retry without leaking response text', async () => {
    get.mockRejectedValueOnce({ response: { status: 500, data: { message: 'private error text' } } })
    renderView()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('private error text')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }))
    expect(await screen.findByText(row.body)).toBeInTheDocument()
  })

  it.each(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'])('renders only the legal actions for %s', async status => {
    get.mockResolvedValue(detail({ ...row, status }))
    renderView()
    await screen.findByText(row.body)
    const expected = status === 'OPEN' ? ['Start review', 'Resolve', 'Close']
      : status === 'IN_REVIEW' ? ['Resolve', 'Close'] : []
    for (const name of ['Start review', 'Resolve', 'Close']) {
      const button = screen.queryByRole('button', { name })
      if (expected.includes(name)) expect(button).toBeEnabled()
      else expect(button).not.toBeInTheDocument()
    }
  })
})

describe('HR Help transitions', () => {
  it('starts review without a note, then reads the full record again', async () => {
    patch.mockImplementation(async () => {
      get.mockResolvedValue(detail({ ...row, status: 'IN_REVIEW' }))
      return { data: { success: true, data: { id, status: 'IN_REVIEW' } } }
    })
    renderView()
    const dialog = await openAction('Start review')
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm' }))
    expect(await action('Resolve')).toBeEnabled()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Start review' })).not.toBeInTheDocument())
    expect(patch.mock.calls[0].slice(0, 2)).toEqual([`/hr/help-requests/${id}`, { status: 'IN_REVIEW' }])
    expect(get).toHaveBeenCalledTimes(2)
    expect(screen.getByText(row.body)).toBeInTheDocument()
  })

  it.each([['Resolve', 'RESOLVED'], ['Close', 'CLOSED']])('requires a trimmed note to %s', async (name, status) => {
    get.mockResolvedValue(detail({ ...row, status: 'IN_REVIEW' }))
    patch.mockImplementation(async () => {
      get.mockResolvedValue(detail({ ...row, status, resolutionNote: 'Scanner fixed.' }))
      return { data: { success: true, data: { id, status, resolutionNote: 'Scanner fixed.' } } }
    })
    renderView()
    const dialog = await openAction(name)
    const input = dialog.getByRole('textbox', { name: /Resolution note/i })
    const confirm = dialog.getByRole('button', { name: 'Confirm' })
    fireEvent.change(input, { target: { value: '    ' } })
    await userEvent.click(confirm)
    expect(patch).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '  Scanner fixed.  ' } })
    await userEvent.click(confirm)
    expect(await screen.findByText('Scanner fixed.')).toBeInTheDocument()
    expect(patch.mock.calls[0].slice(0, 2)).toEqual([
      `/hr/help-requests/${id}`, { status, resolutionNote: 'Scanner fixed.' },
    ])
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  })

  it('caps the final note at the API limit', async () => {
    renderView()
    const dialog = await openAction('Resolve')
    const input = dialog.getByRole('textbox', { name: /Resolution note/i })
    expect(input).toHaveAttribute('maxlength', '500')
  })

  it('reconciles a 409 against the current request without retrying the write', async () => {
    patch.mockImplementation(async () => {
      get.mockResolvedValue(detail({ ...row, status: 'CLOSED', resolutionNote: 'Already handled.' }))
      throw { response: { status: 409, data: { message: 'internal conflict text' } } }
    })
    renderView()
    const dialog = await openAction('Resolve')
    fireEvent.change(dialog.getByRole('textbox', { name: /Resolution note/i }), { target: { value: 'Ready.' } })
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Already handled.')).toBeInTheDocument()
    expect(patch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('internal conflict text')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument()
  })

  it('suppresses duplicate confirmation while a write is pending', async () => {
    let settle!: (value: unknown) => void
    patch.mockImplementation(() => new Promise(resolve => { settle = resolve }))
    renderView()
    const dialog = await openAction('Start review')
    const confirm = dialog.getByRole('button', { name: 'Confirm' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(patch).toHaveBeenCalledTimes(1)
    get.mockResolvedValue(detail({ ...row, status: 'IN_REVIEW' }))
    await act(async () => { settle({ data: { success: true, data: { id, status: 'IN_REVIEW' } } }) })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('HR Help session boundaries', () => {
  it('discards a pending PATCH result after the same-tab session changes', async () => {
    let settle!: (value: unknown) => void
    patch.mockImplementation(() => new Promise(resolve => { settle = resolve }))
    renderView()
    const dialog = await openAction('Start review')
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm' }))
    expect(patch).toHaveBeenCalledTimes(1)
    localStorage.setItem('token', 'other-isolated-session')
    await act(async () => { settle({ data: { success: true, data: { id, status: 'IN_REVIEW' } } }) })
    expect(await screen.findByText(/Your session changed/i)).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(row.body)).not.toBeInTheDocument()
    expect(screen.queryByText(/The requester will see/i)).not.toBeInTheDocument()
  })
})
