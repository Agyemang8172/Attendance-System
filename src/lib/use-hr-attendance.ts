import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api/axios'
import { getCurrentUser, getToken } from '../utils/auth'
import { hrAttendanceParams, type HrAttendanceContext } from './hr-attendance-context'
import { readOperationalDetail, readOperationalList } from './hr-attendance-data'

interface ReadState<T> { key: string; loading: boolean; data?: T; error?: string; retryable?: boolean }
function readError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 403) return { error: 'You do not have access to this attendance record.', retryable: false }
  if (status === 404) return { error: 'Attendance record not found.', retryable: false }
  if (status === 400) return { error: 'This attendance query or link is unavailable.', retryable: false }
  return { error: 'Unable to load attendance. Try again.', retryable: true }
}
function useOperationalRead<T>(path: string, decode: (value: unknown) => T) {
  const caller = getCurrentUser()
  const currentToken = getToken()
  const sessionKey = JSON.stringify([caller?.id, caller?.role, caller?.mustChangePassword, currentToken])
  const initialSession = useRef(sessionKey)
  const key = JSON.stringify([path, sessionKey])
  const [state, setState] = useState<ReadState<T>>({ key, loading: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const account = getCurrentUser()
    const token = getToken()
    const allowed = account?.mustChangePassword === false && (account?.role === 'HR' || account?.role === 'SUPERADMIN')
    const current = () => sessionKey === initialSession.current && allowed && Boolean(token && account?.id) && getCurrentUser()?.id === account?.id && getCurrentUser()?.role === account?.role && getCurrentUser()?.mustChangePassword === false && getToken() === token
    const sessionError = { error: 'Your session changed. Sign in again to view attendance.', retryable: false }
    setState({ key, loading: true })
    if (!path) { setState({ key, loading: false, error: 'Choose a To date on or after the From date.', retryable: false }); return }
    if (!current()) { setState({ key, loading: false, ...sessionError }); return }
    api.get(path, { signal: controller.signal }).then(response => {
      if (!active) return
      if (!current()) { setState({ key, loading: false, ...sessionError }); return }
      setState({ key, loading: false, data: decode(response.data) })
    }).catch(error => {
      if (active) setState({ key, loading: false, ...(current() ? readError(error) : sessionError) })
    })
    return () => { active = false; controller.abort() }
  }, [path, key, sessionKey, decode, attempt])
  const retry = () => { setState({ key, loading: true }); setAttempt(value => value + 1) }
  return { ...(state.key === key ? state : { key, loading: true }), retry }
}
export function useOperationalList(context: HrAttendanceContext) {
  const decode = useCallback((value: unknown) => readOperationalList(value, context.page), [context.page])
  const validRange = !context.startDate || !context.endDate || context.startDate <= context.endDate
  return useOperationalRead(validRange ? `/attendance/all-attendance?${hrAttendanceParams(context)}` : '', decode)
}
export function useOperationalDetail(id: string) {
  const decode = useCallback((value: unknown) => readOperationalDetail(value, id), [id])
  return useOperationalRead(`/attendance/${encodeURIComponent(id)}`, decode)
}
