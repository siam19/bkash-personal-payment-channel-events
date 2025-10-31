/**
 * POST /bkash-personal/:trackingId/submit-trx - Submit TrxID
 * 
 * Accepts TrxID from customer, updates tracking record, and attempts immediate verification
 */

import { Context } from 'hono'
import type { Bindings } from '../types/database'
import { createDatabaseService } from '../services/db'
import { normalizeTrxID } from '../services/smsParser'
import { attemptVerification } from '../services/verification'

export async function submitTrxID(c: Context<{ Bindings: Bindings }>) {
  try {
    const tracking_id = c.req.param('trackingId')
    
    if (!tracking_id) {
      return c.json({ error: 'Invalid tracking ID' }, 400)
    }
    
    // Parse request body (supports both JSON and form-encoded)
    let trxid: string
    const contentType = c.req.header('Content-Type') || ''
    
    if (contentType.includes('application/json')) {
      const body = await c.req.json<{ trxid: string }>()
      trxid = body.trxid
    } else {
      // Form-encoded (from HTML form)
      const body = await c.req.parseBody()
      trxid = body.trxid as string
    }
    
    if (!trxid || typeof trxid !== 'string') {
      return c.json({ error: 'TrxID is required' }, 400)
    }
    
    // Normalize TrxID
    const normalizedTrxID = normalizeTrxID(trxid)
    
    if (!normalizedTrxID) {
      return c.json({ error: 'Invalid TrxID format' }, 400)
    }
    
    // Create database service
    const db = createDatabaseService(c.env.DB)
    
    // Fetch tracking session
    const tracking = await db.tracking.getByID(tracking_id)
    
    if (!tracking) {
      return c.json({ error: 'Payment session not found' }, 404)
    }
    
    // Check if session is expired
    const now = new Date()
    const expiresAt = new Date(tracking.expires_at)
    
    if (now > expiresAt) {
      return c.json(
        { 
          error: 'This payment session has expired',
          status: 'expired'
        },
        410
      )
    }
    
    // Check if already verified
    if (tracking.status === 'verified') {
      return c.json({
        status: 'verified',
        message: 'This payment has already been verified. Please check your email for your ticket.'
      })
    }
    
    // Check if TrxID already submitted (prevent duplicate submissions)
    if (tracking.user_entered_trxid && tracking.status === 'submitted_trx') {
      return c.json({
        status: 'submitted',
        message: 'Your Transaction ID has already been submitted. We are verifying your payment. Please check your email shortly.'
      })
    }
    
    // Update tracking with submitted TrxID
    await db.tracking.submitTrxID(tracking_id, normalizedTrxID)
    
    // Attempt immediate verification
    const verificationResult = await attemptVerification(tracking_id, db)
    
    if (verificationResult.success) {
      // Verification successful!
      return c.json({
        status: 'verified',
        message: 'Payment verified! Please check your email for your ticket confirmation.'
      })
    }
    
    // Verification pending or failed - but don't expose failure details to user
    // Let them know we've received their TrxID and will process it
    console.log(`Verification result for ${tracking_id}:`, verificationResult)
    
    // Return success response
    // Don't wait for verification to complete - respond immediately
    return c.json({
      status: 'submitted',
      message: 'Thank you! Your Transaction ID has been submitted. We are verifying your payment. Please check your email for your ticket confirmation.'
    })
    
  } catch (error: any) {
    console.error('Error submitting TrxID:', error)
    return c.json(
      { 
        error: 'An error occurred while submitting your Transaction ID',
        message: error.message 
      },
      500
    )
  }
}
