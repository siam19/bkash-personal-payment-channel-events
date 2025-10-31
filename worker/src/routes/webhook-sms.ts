import { Context } from 'hono'
import { Bindings } from '../types/database'
import { createDatabaseService } from '../services/db'
import { parseBkashSMS } from '../services/smsParser'
import { verifyIncomingTransaction } from '../services/verification'

interface WebhookRequest {
  raw_sms: string
  receiver_phone: string
}

export async function handleWebhookSMS(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  try {
    // Parse request body
    const body = await c.req.json<WebhookRequest>()
    
    // Validate required fields
    if (!body.raw_sms || !body.receiver_phone) {
      return c.json({
        success: false,
        error: 'Missing required fields: raw_sms and receiver_phone'
      }, 400)
    }

    const db = createDatabaseService(c.env.DB)

    // Validate receiver exists and is active
    const isValidReceiver = await db.receivers.isValidReceiver(body.receiver_phone)
    if (!isValidReceiver) {
      return c.json({
        success: false,
        error: `Invalid or inactive receiver phone: ${body.receiver_phone}`
      }, 400)
    }

    // Parse SMS
    const parseResult = parseBkashSMS(body.raw_sms)
    if (!parseResult.success || !parseResult.data) {
      return c.json({
        success: false,
        error: 'Failed to parse SMS',
        details: parseResult.error
      }, 400)
    }

    const parsed = parseResult.data

    // Validate amount
    if (parsed.amount_cents <= 0) {
      return c.json({
        success: false,
        error: 'Invalid amount: must be greater than 0'
      }, 400)
    }

    // Insert transaction (idempotent via unique TrxID)
    const { transaction, isNew } = await db.transactions.create({
      trxid: parsed.trxid,
      sender_phone: parsed.sender_phone,
      receiver_phone: body.receiver_phone,
      amount_cents: parsed.amount_cents,
      received_at: parsed.received_at
    })

    console.log(`[Webhook] Transaction ${isNew ? 'created' : 'already exists'}: ${transaction.trxid}`)

    // Attempt verification for matching pending sessions
    const verificationResults = await verifyIncomingTransaction(transaction.id, db)
    
    const verifiedCount = verificationResults.filter(r => r.success).length
    if (verifiedCount > 0) {
      console.log(`[Webhook] Verified ${verifiedCount} pending session(s) for TrxID ${transaction.trxid}`)
    }

    // Return success response
    return c.json({
      success: true,
      is_new: isNew,
      transaction: {
        id: transaction.id,
        trxid: transaction.trxid,
        sender_phone: transaction.sender_phone,
        receiver_phone: transaction.receiver_phone,
        amount_cents: transaction.amount_cents,
        received_at: transaction.received_at
      },
      parsed_data: parsed,
      verification: {
        attempted: verificationResults.length,
        verified: verifiedCount
      }
    }, isNew ? 201 : 200)

  } catch (error) {
    console.error('[Webhook] Error processing SMS:', error)
    return c.json({
      success: false,
      error: 'Internal server error processing SMS'
    }, 500)
  }
}
