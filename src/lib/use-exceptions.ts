import { useEffect, useRef, useState } from 'react'
import api from '../api/axios'
import { getCurrentUser, getToken } from '../utils/auth'
import { exceptionsRangeError, exceptionsRequest, type ExceptionsContext } from './exceptions-context'
import { readExceptions } from './exceptions-data'

type ExceptionPage = ReturnType<typeof readExceptions>
interface ReadState { key: string; loading: boolean; data?: ExceptionPage; error?: string; retryable?: boolean }
function readError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 403) return { error: 'You do not have access to exceptions.', retryable: false }
  if (status === 400) return { error: 'This date range is unavailable. Choose valid dates and apply them again.', retryable: false }
  return { error: 'Unable to load exceptions. Try again.', retryable: true }
}
export function useExceptions(context: ExceptionsContext) {
  const caller = getCurrentUser()
  const sessionKey = JSON.stringify([caller?.id, caller?.role, caller?.mustChangePassword, getToken()])
  const initialSession = useRef(sessionKey)
  const path = exceptionsRangeError(context.startDate, context.endDate) ? '' : exceptionsRequest(context)
  const key = JSON.stringify([path, sessionKey])
  const [state, setState] = useState<ReadState>({ key, loading: Boolean(path) })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const account = getCurrentUser()
    const token = getToken()
    const allowed = account?.mustChangePassword === false && (account?.role === 'HR' || account?.role === 'SUPERADMIN')
    const current = () => initialSession.current === sessionKey && allowed && Boolean(token && account?.id)
      && getCurrentUser()?.id === account?.id && getCurrentUser()?.role === account?.role
      && getCurrentUser()?.mustChangePassword === false && getToken() === token
    const sessionError = { error: 'Your session changed. Sign in again to view exceptions.', retryable: false }
    setState({ key, loading: Boolean(path) })
    if (!current()) { setState({ key, loading: false, ...sessionError }); return }
    if (!path) return
    api.get(path, { signal: controller.signal }).then(response => {
      if (!active) return
      if (!current()) { setState({ key, loading: false, ...sessionError }); return }
      setState({ key, loading: false, data: readExceptions(response.data, context.page) })
    }).catch(error => {
      if (active) setState({ key, loading: false, ...(current() ? readError(error) : sessionError) })
    })
    return () => { active = false; controller.abort() }
  }, [path, key, sessionKey, context.page, attempt])
  const retry = () => { setState({ key, loading: Boolean(path) }); setAttempt(value => value + 1) }
  return { ...(state.key === key ? state : { key, loading: Boolean(path) }), retry }
}
