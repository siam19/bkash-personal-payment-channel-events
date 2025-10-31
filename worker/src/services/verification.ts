/**
 * Verification Service
 * 
 * Core payment verification logic that matches tracking sessions with transactions
 * Enforces all verification rules: TrxID, amount, receiver, and time window
 */

import type { Tracking, Transaction } from '../types/database'
import { DatabaseService } from './db'
import { normalizeTrxID } from './smsParser'

export interface VerificationResult {
  success: boolean
  status: 'verified' | 'failed' | 'pending'
  message: string
  matched_transaction_id?: string
  failure_reason?: string
}

/**
 * Verify a tracking session against a transaction
 * 
 * Verification Rules:
 * 1. TrxID must match (normalized, case-insensitive)
 * 2. Amount must match exactly (in cents)
 * 3. Receiver must be in offered_receivers list
 * 4. Transaction must be within time window (tracking.created_at - 1hr to tracking.expires_at + 15min)
 * 5. TrxID must not be already matched to another session
 */
export async function verifyPayment(
  tracking: Tracking,
  transaction: Transaction,
  db: DatabaseService
): Promise<VerificationResult> {
  
  // Rule 1: TrxID Match (normalized comparison)
  const trackingTrxID = normalizeTrxID(tracking.user_entered_trxid || '')
  const transactionTrxID = normalizeTrxID(transaction.trxid)
  
  if (trackingTrxID !== transactionTrxID) {
    return {
      success: false,
      status: 'failed',
      message: 'Transaction ID does not match',
      failure_reason: `TrxID mismatch: expected ${trackingTrxID}, got ${transactionTrxID}`
    }
  }
  
  // Rule 2: Amount Match (strict equality in cents)
  if (tracking.payment_amount_cents !== transaction.amount_cents) {
    const expectedTaka = (tracking.payment_amount_cents / 100).toFixed(2)
    const actualTaka = (transaction.amount_cents / 100).toFixed(2)
    
    return {
      success: false,
      status: 'failed',
      message: 'Payment amount does not match',
      failure_reason: `Amount mismatch: expected ৳${expectedTaka}, got ৳${actualTaka}`
    }
  }
  
  // Rule 3: Receiver Match (must be in offered_receivers list)
  const offeredReceivers: string[] = JSON.parse(tracking.offered_receivers)
  
  if (!offeredReceivers.includes(transaction.receiver_phone)) {
    return {
      success: false,
      status: 'failed',
      message: 'Payment sent to wrong number',
      failure_reason: `Receiver not in offered list: ${transaction.receiver_phone}. Expected one of: ${offeredReceivers.join(', ')}`
    }
  }
  
  // Rule 4: Time Window Validation
  const trackingCreatedAt = new Date(tracking.created_at)
  const trackingExpiresAt = new Date(tracking.expires_at)
  const transactionReceivedAt = new Date(transaction.received_at)
  
  // Allow transactions from 1 hour before session creation to 15 minutes after expiry (grace period)
  const earliestAllowed = new Date(trackingCreatedAt.getTime() - 60 * 60 * 1000) // -1 hour
  const latestAllowed = new Date(trackingExpiresAt.getTime() + 15 * 60 * 1000)   // +15 minutes
  
  if (transactionReceivedAt < earliestAllowed || transactionReceivedAt > latestAllowed) {
    return {
      success: false,
      status: 'failed',
      message: 'Payment outside valid time window',
      failure_reason: `Transaction time ${transaction.received_at} is outside window ${earliestAllowed.toISOString()} to ${latestAllowed.toISOString()}`
    }
  }
  
  // Rule 5: Check for Duplicate TrxID Usage
  // Query all tracking sessions to see if this TrxID is already matched
  const existingMatch = await db.tracking.findByTrxID(transactionTrxID)
  const alreadyMatched = existingMatch.find(
    t => t.status === 'verified' && t.tracking_id !== tracking.tracking_id
  )
  
  if (alreadyMatched) {
    return {
      success: false,
      status: 'failed',
      message: 'This Transaction ID has already been used',
      failure_reason: `Duplicate TrxID: already matched to session ${alreadyMatched.tracking_id}`
    }
  }
  
  // All rules passed - verification successful!
  return {
    success: true,
    status: 'verified',
    message: 'Payment verified successfully',
    matched_transaction_id: transaction.id
  }
}

/**
 * Attempt to verify a tracking session
 * Looks up the transaction and calls verifyPayment
 */
export async function attemptVerification(
  trackingId: string,
  db: DatabaseService
): Promise<VerificationResult> {
  
  // Fetch tracking session
  const tracking = await db.tracking.getByID(trackingId)
  
  if (!tracking) {
    return {
      success: false,
      status: 'failed',
      message: 'Tracking session not found',
      failure_reason: `No tracking session with ID ${trackingId}`
    }
  }
  
  // Check if TrxID has been submitted
  if (!tracking.user_entered_trxid) {
    return {
      success: false,
      status: 'pending',
      message: 'No Transaction ID submitted yet',
      failure_reason: 'user_entered_trxid is null'
    }
  }
  
  // Check if already verified
  if (tracking.status === 'verified') {
    return {
      success: true,
      status: 'verified',
      message: 'Already verified',
      matched_transaction_id: tracking.matched_transaction_id || undefined
    }
  }
  
  // Normalize and look up transaction
  const normalizedTrxID = normalizeTrxID(tracking.user_entered_trxid)
  const transaction = await db.transactions.getByTrxID(normalizedTrxID)
  
  if (!transaction) {
    return {
      success: false,
      status: 'pending',
      message: 'Transaction not found yet',
      failure_reason: `No transaction with TrxID ${normalizedTrxID} in database`
    }
  }
  
  // Perform verification
  const result = await verifyPayment(tracking, transaction, db)
  
  // Update tracking status based on result
  if (result.success) {
    await db.tracking.updateStatus(trackingId, 'verified', {
      matched_transaction_id: result.matched_transaction_id,
      notes: 'Verified successfully'
    })
  } else if (result.status === 'failed') {
    await db.tracking.updateStatus(trackingId, 'failed', {
      notes: result.failure_reason
    })
  }
  // If status is 'pending', don't update - leave as 'submitted_trx' for retry
  
  return result
}

/**
 * Verify a transaction against pending tracking sessions
 * Called when a new SMS is received
 */
export async function verifyIncomingTransaction(
  transactionId: string,
  db: DatabaseService
): Promise<VerificationResult[]> {
  
  const results: VerificationResult[] = []
  
  // Fetch the transaction
  const transaction = await db.transactions.getByID(transactionId)
  
  if (!transaction) {
    return [{
      success: false,
      status: 'failed',
      message: 'Transaction not found',
      failure_reason: `No transaction with ID ${transactionId}`
    }]
  }
  
  // Find all pending tracking sessions with matching TrxID
  const normalizedTrxID = normalizeTrxID(transaction.trxid)
  const pendingSessions = await db.tracking.findByTrxID(normalizedTrxID)
  
  if (pendingSessions.length === 0) {
    return [{
      success: false,
      status: 'pending',
      message: 'No matching tracking sessions found',
      failure_reason: `No pending sessions with TrxID ${normalizedTrxID}`
    }]
  }
  
  // Attempt verification for each pending session
  for (const tracking of pendingSessions) {
    const result = await verifyPayment(tracking, transaction, db)
    
    // Update tracking status
    if (result.success) {
      await db.tracking.updateStatus(tracking.tracking_id, 'verified', {
        matched_transaction_id: result.matched_transaction_id,
        notes: 'Verified successfully'
      })
    } else if (result.status === 'failed') {
      await db.tracking.updateStatus(tracking.tracking_id, 'failed', {
        notes: result.failure_reason
      })
    }
    
    results.push(result)
  }
  
  return results
}
