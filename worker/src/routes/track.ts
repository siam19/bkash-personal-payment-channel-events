/**
 * POST /track - Create Payment Session
 * 
 * Creates a new payment tracking session when a customer selects a ticket
 * Returns tracking_id and redirect URL for payment page
 */

import { Context } from 'hono'
import type { Bindings } from '../types/database'
import { createDatabaseService } from '../services/db'

interface TrackRequest {
  item_code: string
  payment_amount_cents: number
  customer_info: {
    name: string
    phone: string
    email: string
  }
  form_data?: Record<string, any>
  ticket_choice: string
  verification_method?: 'auto' | 'manual'
}

export async function createTrackingSession(c: Context<{ Bindings: Bindings }>) {
  try {
    // Parse request body
    const body = await c.req.json<TrackRequest>()

    // Validate required fields
    if (!body.item_code) {
      return c.json({ error: 'item_code is required' }, 400)
    }
    if (!body.payment_amount_cents || body.payment_amount_cents <= 0) {
      return c.json({ error: 'payment_amount_cents must be greater than 0' }, 400)
    }
    if (!body.customer_info || !body.customer_info.name || !body.customer_info.phone || !body.customer_info.email) {
      return c.json({ error: 'customer_info (name, phone, email) is required' }, 400)
    }
    if (!body.ticket_choice) {
      return c.json({ error: 'ticket_choice is required' }, 400)
    }

    // Create database service
    const db = createDatabaseService(c.env.DB)

    // Get all active receivers
    const activeReceivers = await db.receivers.getActive()

    if (activeReceivers.length === 0) {
      return c.json(
        { error: 'No active payment receivers available. Please contact support.' },
        503
      )
    }

    // Extract receiver phone numbers
    const offeredReceivers = activeReceivers.map(r => r.phone)

    // Create tracking session
    const tracking = await db.tracking.create({
      item_code: body.item_code,
      payment_amount_cents: body.payment_amount_cents,
      offered_receivers: offeredReceivers,
      customer_info: body.customer_info,
      form_data: body.form_data,
      ticket_choice: body.ticket_choice,
      verification_method: body.verification_method
    })

    // Construct redirect URL
    // In production, this should use an environment variable for the base URL
    const baseUrl = new URL(c.req.url).origin
    const redirectUrl = `${baseUrl}/bkash-personal/${tracking.tracking_id}`

    // Return response
    return c.json({
      tracking_id: tracking.tracking_id,
      redirect_url: redirectUrl,
      expires_at: tracking.expires_at
    }, 201)

  } catch (error: any) {
    console.error('Error creating tracking session:', error)
    return c.json(
      { error: 'Internal server error', message: error.message },
      500
    )
  }
}
