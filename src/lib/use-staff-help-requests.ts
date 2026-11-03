import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios'
import { getCurrentUser, getToken } from '../utils/auth'
import { readHelpList, readOwnHelpRequest } from './staff-help-requests'

interface ReadState<T> { key: string; loading: boolean; data?: T; error?: string; retryable?: boolean }
type Decode<T> = (value: unknown, ownerId: string) => T
function requestError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 403) return { error: 'You do not have permission to view this help request.', retryable: false }
  if (status === 404) return { error: 'Help request not found.', retryable: false }
  if (status === 400) return { error: 'This help request link is unavailable.', retryable: false }
  return { error: 'Unable to load help requests. Try again.', retryable: true }
}
function useHelpRead<T>(path: string | undefined, decode: Decode<T>) {
  const key = path || ''
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ReadState<T>>({ key, loading: true })
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const ownerId = getCurrentUser()?.id || ''
    const token = getToken()
    const current = () => Boolean(ownerId && token && ownerId === getCurrentUser()?.id && token === getToken())
    const sessionError = { error: 'Your session changed. Reload this page to continue.', retryable: false }
    setState({ key, loading: true })
    if (!path) { setState({ key, loading: false, ...requestError({ response: { status: 404 } }) }); return }
    api.get(path, { signal: controller.signal }).then(response => {
      if (!active) return
      if (!current()) { setState({ key, loading: false, ...sessionError }); return }
      setState({ key, loading: false, data: decode(response.data, ownerId) })
    }).catch(error => {
      if (active) setState({ key, loading: false, ...(current() ? requestError(error) : sessionError) })
    })
    return () => { active = false; controller.abort() }
  }, [path, key, decode, attempt])
  const retry = () => { setState({ key, loading: true }); setAttempt(value => value + 1) }
  return { ...(state.key === key ? state : { key, loading: true }), retry }
}
export function useHelpList(status: string, page: number) {
  const params = new URLSearchParams({ page: String(page), limit: '12' })
  if (status) params.set('status', status)
  return useHelpRead(`/staff/help-requests?${params}`, readHelpList)
}
export function useHelpDetail(id: string | undefined) {
  const decode = useCallback((value: unknown, ownerId: string) => readOwnHelpRequest(value, id || '', ownerId), [id])
  return useHelpRead(id ? `/staff/help-requests/${encodeURIComponent(id)}` : undefined, decode)
}
