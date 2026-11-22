import { setupWorker, SetupWorkerApi } from 'msw/browser'
import { handlers } from './msw-handlers'

export const worker = setupWorker(...handlers)

/**
 * Start the MSW worker for browser-based testing (Playwright E2E).
 * This should be called once in the global test setup.
 */
export async function startMSW(): Promise<void> {
  if (typeof window === 'undefined') {
    return // Not in browser environment
  }

  try {
    await worker.start({
      onUnhandledRequest: 'bypass', // Allow non-mocked requests to pass through
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    })
    console.log('[MSW] Worker started successfully')
  } catch (error) {
    console.error('[MSW] Failed to start worker:', error)
  }
}

/**
 * Stop the MSW worker.
 * Should be called in global teardown.
 */
export async function stopMSW(): Promise<void> {
  try {
    await worker.stop()
    console.log('[MSW] Worker stopped')
  } catch (error) {
    console.error('[MSW] Failed to stop worker:', error)
  }
}

/**
 * Reset all request handlers to their initial state.
 * Useful between tests to ensure isolation.
 */
export function resetMSW(): void {
  worker.resetHandlers()
  console.log('[MSW] Handlers reset')
}

/**
 * Use custom handlers for specific tests.
 * Usage: worker.use(...customHandlers) in individual test files for overrides.
 */
export { worker as mswWorker }