import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api/axios'
import { getCurrentUser, getToken } from '../utils/auth'
import { HR_HELP_PAGE_SIZE, readBusinessHelpDetail, readBusinessHelpList } from './hr-help-requests'

interface ReadState<T> {
  path: string
  loading: boolean
  data?: T
  error?: string
  retryable?: boolean
}

export const hrHelpErrorStatus = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status

function readError(error: unknown) {
  const status = hrHelpErrorStatus(error)
  if (status === 401 || status === 403) return { error: 'You do not have access to help requests.', retryable: false }
  if (status === 404) return { error: 'Help request not found.', retryable: false }
  if (status === 400) return { error: 'This help request link or filter is unavailable.', retryable: false }
  return { error: 'Unable to load help requests. Try again.', retryable: true }
}

function sessionIdentity() {
  const user = getCurrentUser()
  const token = getToken()
  if (!user?.id || !token || user.mustChangePassword !== false || (user.role !== 'HR' && user.role !== 'SUPERADMIN')) return null
  return JSON.stringify([user.id, user.role, token])
}

function useHrHelpRead<T>(path: string, decode: (value: unknown) => T) {
  const initialSession = useRef(sessionIdentity())
  const isCurrent = useCallback(() => Boolean(initialSession.current && initialSession.current === sessionIdentity()), [])
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ReadState<T>>({ path, loading: true })
  const refresh = useCallback(() => {
    setState({ path, loading: true })
    setAttempt(value => value + 1)
  }, [path])
  useEffect(() => {
    const controller = new AbortController()
    const checkSession = () => {
      if (!isCurrent()) {
        controller.abort()
        setState({ path, loading: false, ...sessionError })
      }
    }
    setState({ path, loading: true })
    checkSession()
    if (controller.signal.aborted) return
    window.addEventListener('storage', checkSession)
    api.get(path, { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return
      checkSession()
      if (!controller.signal.aborted) setState({ path, loading: false, data: decode(response.data) })
    }).catch(error => {
      if (controller.signal.aborted) return
      checkSession()
      if (!controller.signal.aborted) setState({ path, loading: false, ...readError(error) })
    })
    return () => {
      controller.abort()
      window.removeEventListener('storage', checkSession)
    }
  }, [attempt, decode, isCurrent, path])
  const visible = state.path === path ? state : { path, loading: true }
  return { ...(isCurrent() ? visible : { path, loading: false, ...sessionError }), refresh, isCurrent }
}

const sessionError = { error: 'Your session changed. Sign in again to view help requests.', retryable: false }

export function useHrHelpQueue(status: string, page: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(HR_HELP_PAGE_SIZE) })
  if (status) params.set('status', status)
  const decode = useCallback((value: unknown) => readBusinessHelpList(value, page), [page])
  return useHrHelpRead(`/hr/help-requests?${params}`, decode)
}

export function useHrHelpDetail(id: string) {
  const decode = useCallback((value: unknown) => readBusinessHelpDetail(value, id), [id])
  return useHrHelpRead(`/hr/help-requests/${encodeURIComponent(id)}`, decode)
}
