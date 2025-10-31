import { Context } from 'hono'
import { Bindings } from '../types/database'
import { scheduledHandler } from '../scheduled/cron'

/**
 * Test endpoint to manually trigger the cron job
 * Only for development/testing - remove in production or add authentication
 */
export async function triggerCronManually(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  try {
    // Create a mock ScheduledEvent
    const mockEvent = {
      scheduledTime: Date.now(),
      cron: '*/5 * * * *'
    } as ScheduledEvent

    // Run the scheduled handler
    await scheduledHandler(mockEvent, { DB: c.env.DB })

    return c.json({
      success: true,
      message: 'Cron job triggered successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Test Cron] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}
