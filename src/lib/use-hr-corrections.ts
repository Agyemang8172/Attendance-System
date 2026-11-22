import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api/axios'
import { getCurrentUser, getToken } from '../utils/auth'
import { CORRECTION_PAGE_SIZE, readCorrectionDetail, readCorrectionQueue, type CorrectionContext } from './hr-corrections'

interface ReadState<T> {
  path: string
  loading: boolean
  data?: T
  error?: string
  retryable?: boolean
}

export const correctionHttpStatus = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status

const sessionError = { error: 'Your session changed. Sign in again to view corrections.', retryable: false }

function readError(error: unknown) {
  const status = correctionHttpStatus(error)
  if (status === 401 || status === 403) return { error: 'You do not have access to corrections.', retryable: false }
  if (status === 404) return { error: 'Correction not found.', retryable: false }
  if (status === 400) return { error: 'This correction link or filter is unavailable.', retryable: false }
  return { error: 'Unable to load corrections. Try again.', retryable: true }
}

function sessionIdentity(hrOnly: boolean) {
  const user = getCurrentUser()
  const token = getToken()
  if (!user?.id || !token || user.mustChangePassword !== false) return null
  if (user.role !== 'HR' && (hrOnly || user.role !== 'SUPERADMIN')) return null
  return JSON.stringify([user.id, user.role, token])
}

function useCorrectionRead<T>(path: string, decode: (value: unknown) => T, hrOnly = false) {
  const initialSession = useRef(sessionIdentity(hrOnly))
  const isCurrent = useCallback(() => Boolean(initialSession.current && initialSession.current === sessionIdentity(hrOnly)), [hrOnly])
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

export function useCorrectionQueue({ status, reviewTier, page }: CorrectionContext) {
  const params = new URLSearchParams({ page: String(page), limit: String(CORRECTION_PAGE_SIZE) })
  if (status) params.set('status', status)
  if (reviewTier) params.set('reviewTier', reviewTier)
  const decode = useCallback((value: unknown) => readCorrectionQueue(value, page), [page])
  return useCorrectionRead('/hr/corrections?' + params, decode)
}

export function useCorrectionDetail(id: string) {
  const decode = useCallback((value: unknown) => readCorrectionDetail(value, id), [id])
  return useCorrectionRead('/hr/corrections/' + encodeURIComponent(id), decode)
}

export function useOwnCorrectionQueue({ status, page }: Pick<CorrectionContext, 'status' | 'page'>) {
  const params = new URLSearchParams({ page: String(page), limit: String(CORRECTION_PAGE_SIZE) })
  if (status) params.set('status', status)
  const decode = useCallback((value: unknown) => readCorrectionQueue(value, page), [page])
  return useCorrectionRead('/attendance/corrections?' + params, decode, true)
}

export function useOwnCorrectionDetail(id: string) {
  const decode = useCallback((value: unknown) => readCorrectionDetail(value, id), [id])
  return useCorrectionRead('/attendance/corrections/' + encodeURIComponent(id), decode, true)
}
