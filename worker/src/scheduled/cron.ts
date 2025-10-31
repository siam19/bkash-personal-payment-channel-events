import { createDatabaseService } from '../services/db'
import { attemptVerification } from '../services/verification'

interface CronEnv {
  DB: D1Database
}

/**
 * Scheduled handler for periodic verification sweep
 * Runs every 5 minutes to:
 * 1. Expire old sessions
 * 2. Retry verification for submitted sessions
 */
export async function scheduledHandler(event: ScheduledEvent, env: CronEnv): Promise<void> {
  const startTime = Date.now()
  console.log('[Cron] Starting verification sweep...')

  const db = createDatabaseService(env.DB)

  try {
    // Step 1: Find and expire old sessions
    const expiredSessions = await db.tracking.findExpired()
    
    if (expiredSessions.length > 0) {
      const expiredIds = expiredSessions.map(s => s.tracking_id)
      await db.tracking.expireSessions(expiredIds)
      console.log(`[Cron] Expired ${expiredSessions.length} session(s)`)
    }

    // Step 2: Find sessions with submitted TrxID that need verification retry
    const pendingSessions = await db.tracking.findPendingVerification()
    
    let verifiedCount = 0
    let failedCount = 0
    let stillPendingCount = 0

    for (const session of pendingSessions) {
      try {
        // Attempt verification for this session
        const result = await attemptVerification(session.tracking_id, db)
        
        if (result.success) {
          verifiedCount++
          console.log(`[Cron] Verified session ${session.tracking_id} with TrxID ${session.user_entered_trxid}`)
        } else if (result.status === 'failed') {
          failedCount++
          console.log(`[Cron] Failed session ${session.tracking_id}: ${result.failure_reason}`)
        } else {
          // Still pending (transaction not found yet)
          stillPendingCount++
        }
      } catch (error) {
        console.error(`[Cron] Error verifying session ${session.tracking_id}:`, error)
        failedCount++
      }
    }

    const duration = Date.now() - startTime
    console.log(`[Cron] Sweep complete in ${duration}ms:`, {
      expired: expiredSessions.length,
      verified: verifiedCount,
      failed: failedCount,
      still_pending: stillPendingCount,
      total_processed: pendingSessions.length
    })

  } catch (error) {
    console.error('[Cron] Sweep failed:', error)
    throw error
  }
}
