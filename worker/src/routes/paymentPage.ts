/**
 * GET /bkash-personal/:trackingId - Display Payment Page
 * 
 * Shows payment instructions, receiver numbers, amount, and TrxID input form
 */

import { Context } from 'hono'
import type { Bindings } from '../types/database'
import { createDatabaseService } from '../services/db'
import { renderPaymentPage, renderErrorPage } from '../templates/paymentPage'

export async function getPaymentPage(c: Context<{ Bindings: Bindings }>) {
  try {
    const tracking_id = c.req.param('trackingId')
    
    if (!tracking_id) {
      return c.html(renderErrorPage('Invalid payment link', 400), 400)
    }
    
    // Create database service
    const db = createDatabaseService(c.env.DB)
    
    // Fetch tracking session
    const tracking = await db.tracking.getByID(tracking_id)
    
    if (!tracking) {
      return c.html(
        renderErrorPage(
          'This payment link does not exist. Please check the link or contact support.',
          404
        ),
        404
      )
    }
    
    // Check if session is expired
    const now = new Date()
    const expiresAt = new Date(tracking.expires_at)
    
    if (now > expiresAt) {
      return c.html(
        renderErrorPage(
          'This payment link has expired. Payment links are valid for 1 hour. Please request a new payment link.',
          410
        ),
        410
      )
    }
    
    // Check if already verified
    if (tracking.status === 'verified') {
      return c.html(
        renderErrorPage(
          'This payment has already been verified. Please check your email for your ticket.',
          410
        ),
        410
      )
    }
    
    // Parse offered receivers
    const receivers: string[] = JSON.parse(tracking.offered_receivers)
    
    // Convert amount from cents to taka with proper formatting
    const amount_taka = (tracking.payment_amount_cents / 100).toFixed(2)
    
    // Calculate minutes until expiry
    const expiresInMs = expiresAt.getTime() - now.getTime()
    const expiresInMinutes = Math.max(1, Math.ceil(expiresInMs / (1000 * 60)))
    
    // Render payment page
    const html = renderPaymentPage({
      tracking_id: tracking.tracking_id,
      receivers,
      amount_taka,
      expires_at: tracking.expires_at,
      expires_in_minutes: expiresInMinutes
    })
    
    return c.html(html)
    
  } catch (error: any) {
    console.error('Error displaying payment page:', error)
    return c.html(
      renderErrorPage('An error occurred while loading the payment page. Please try again.', 500),
      500
    )
  }
}
