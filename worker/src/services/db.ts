/**
 * Database Service Layer
 * 
 * Type-safe wrapper for D1 database operations
 * Provides CRUD operations for all tables
 */

import type { D1Database } from '@cloudflare/workers-types'
import type { Receiver, Transaction, Tracking } from '../types/database'
import { ulid } from 'ulid'

/**
 * Receivers Table Operations
 */
export class ReceiversService {
  constructor(private db: D1Database) {}

  /**
   * Get all active receivers
   */
  async getActive(): Promise<Receiver[]> {
    const result = await this.db
      .prepare('SELECT * FROM receivers_table WHERE status = ?')
      .bind('active')
      .all<Receiver>()
    
    return result.results || []
  }

  /**
   * Get receiver by phone number
   */
  async getByPhone(phone: string): Promise<Receiver | null> {
    const result = await this.db
      .prepare('SELECT * FROM receivers_table WHERE phone = ?')
      .bind(phone)
      .first<Receiver>()
    
    return result
  }

  /**
   * Check if a phone number is a valid receiver (active or disabled)
   */
  async isValidReceiver(phone: string): Promise<boolean> {
    const receiver = await this.getByPhone(phone)
    return receiver !== null
  }
}

/**
 * Transactions Table Operations
 */
export class TransactionsService {
  constructor(private db: D1Database) {}

  /**
   * Create a new transaction
   * Returns the created transaction or existing one if TrxID already exists (idempotent)
   */
  async create(data: {
    trxid: string
    amount_cents: number
    receiver_phone: string
    sender_phone: string
    received_at: string
  }): Promise<{ transaction: Transaction; isNew: boolean }> {
    const id = ulid()
    const created_at = new Date().toISOString()

    try {
      // Try to insert the transaction
      await this.db
        .prepare(`
          INSERT INTO transactions_table (
            id, trxid, amount_cents, receiver_phone, sender_phone, received_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          id,
          data.trxid,
          data.amount_cents,
          data.receiver_phone,
          data.sender_phone,
          data.received_at,
          created_at
        )
        .run()

      // Return the newly created transaction
      const transaction: Transaction = {
        id,
        trxid: data.trxid,
        amount_cents: data.amount_cents,
        receiver_phone: data.receiver_phone,
        sender_phone: data.sender_phone,
        received_at: data.received_at,
        created_at
      }

      return { transaction, isNew: true }
    } catch (error: any) {
      // Check if it's a unique constraint violation on trxid
      if (error.message?.includes('UNIQUE constraint failed')) {
        // Transaction with this TrxID already exists, fetch and return it
        const existing = await this.getByTrxID(data.trxid)
        if (existing) {
          return { transaction: existing, isNew: false }
        }
      }
      // Re-throw if it's a different error
      throw error
    }
  }

  /**
   * Get transaction by TrxID
   */
  async getByTrxID(trxid: string): Promise<Transaction | null> {
    const result = await this.db
      .prepare('SELECT * FROM transactions_table WHERE trxid = ?')
      .bind(trxid)
      .first<Transaction>()
    
    return result
  }

  /**
   * Get transaction by ID
   */
  async getByID(id: string): Promise<Transaction | null> {
    const result = await this.db
      .prepare('SELECT * FROM transactions_table WHERE id = ?')
      .bind(id)
      .first<Transaction>()
    
    return result
  }
}

/**
 * Tracking Table Operations
 */
export class TrackingService {
  constructor(private db: D1Database) {}

  /**
   * Create a new tracking session
   */
  async create(data: {
    item_code: string
    payment_amount_cents: number
    offered_receivers: string[] // Will be JSON stringified
    customer_info: {
      name: string
      phone: string
      email: string
    }
    form_data?: Record<string, any>
    ticket_choice: string
    verification_method?: 'auto' | 'manual'
  }): Promise<Tracking> {
    const tracking_id = ulid()
    const now = new Date()
    const created_at = now.toISOString()
    const updated_at = created_at
    
    // Set expiry to 1 hour from now
    const expires_at = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

    await this.db
      .prepare(`
        INSERT INTO tracking_table (
          tracking_id, item_code, payment_amount_cents, offered_receivers,
          customer_info_json, form_data_json, ticket_choice, verification_method,
          status, created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        tracking_id,
        data.item_code,
        data.payment_amount_cents,
        JSON.stringify(data.offered_receivers),
        JSON.stringify(data.customer_info),
        JSON.stringify(data.form_data || {}),
        data.ticket_choice,
        data.verification_method || 'auto',
        'pending',
        created_at,
        updated_at,
        expires_at
      )
      .run()

    const tracking: Tracking = {
      tracking_id,
      item_code: data.item_code,
      payment_amount_cents: data.payment_amount_cents,
      offered_receivers: JSON.stringify(data.offered_receivers),
      user_entered_trxid: null,
      customer_info_json: JSON.stringify(data.customer_info),
      form_data_json: JSON.stringify(data.form_data || {}),
      ticket_choice: data.ticket_choice,
      verification_method: data.verification_method || 'auto',
      status: 'pending',
      matched_transaction_id: null,
      created_at,
      updated_at,
      expires_at,
      notes: null
    }

    return tracking
  }

  /**
   * Get tracking session by ID
   */
  async getByID(tracking_id: string): Promise<Tracking | null> {
    const result = await this.db
      .prepare('SELECT * FROM tracking_table WHERE tracking_id = ?')
      .bind(tracking_id)
      .first<Tracking>()
    
    return result
  }

  /**
   * Update tracking session with submitted TrxID
   */
  async submitTrxID(tracking_id: string, trxid: string): Promise<void> {
    const updated_at = new Date().toISOString()

    await this.db
      .prepare(`
        UPDATE tracking_table
        SET user_entered_trxid = ?, status = ?, updated_at = ?
        WHERE tracking_id = ?
      `)
      .bind(trxid, 'submitted_trx', updated_at, tracking_id)
      .run()
  }

  /**
   * Update tracking status
   */
  async updateStatus(
    tracking_id: string,
    status: Tracking['status'],
    options?: {
      matched_transaction_id?: string
      notes?: string
    }
  ): Promise<void> {
    const updated_at = new Date().toISOString()

    await this.db
      .prepare(`
        UPDATE tracking_table
        SET status = ?, updated_at = ?, matched_transaction_id = ?, notes = ?
        WHERE tracking_id = ?
      `)
      .bind(
        status,
        updated_at,
        options?.matched_transaction_id || null,
        options?.notes || null,
        tracking_id
      )
      .run()
  }

  /**
   * Find tracking sessions by TrxID
   * Used for matching incoming SMS with pending sessions
   */
  async findByTrxID(trxid: string): Promise<Tracking[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM tracking_table
        WHERE user_entered_trxid = ?
        AND status IN ('pending', 'submitted_trx')
      `)
      .bind(trxid)
      .all<Tracking>()
    
    return result.results || []
  }

  /**
   * Find expired sessions
   */
  async findExpired(): Promise<Tracking[]> {
    const now = new Date().toISOString()
    
    const result = await this.db
      .prepare(`
        SELECT * FROM tracking_table
        WHERE status IN ('pending', 'submitted_trx')
        AND expires_at < ?
      `)
      .bind(now)
      .all<Tracking>()
    
    return result.results || []
  }

  /**
   * Find submitted sessions that need verification retry
   */
  async findPendingVerification(): Promise<Tracking[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM tracking_table
        WHERE status = 'submitted_trx'
        AND user_entered_trxid IS NOT NULL
      `)
      .all<Tracking>()
    
    return result.results || []
  }

  /**
   * Bulk update status (for cron expiry sweep)
   */
  async expireSessions(tracking_ids: string[]): Promise<void> {
    if (tracking_ids.length === 0) return

    const updated_at = new Date().toISOString()
    
    // Create placeholders for SQL IN clause
    const placeholders = tracking_ids.map(() => '?').join(',')
    
    await this.db
      .prepare(`
        UPDATE tracking_table
        SET status = 'expired', updated_at = ?
        WHERE tracking_id IN (${placeholders})
      `)
      .bind(updated_at, ...tracking_ids)
      .run()
  }
}

/**
 * Main Database Service
 * Provides access to all table services
 */
export class DatabaseService {
  public receivers: ReceiversService
  public transactions: TransactionsService
  public tracking: TrackingService

  constructor(db: D1Database) {
    this.receivers = new ReceiversService(db)
    this.transactions = new TransactionsService(db)
    this.tracking = new TrackingService(db)
  }
}

/**
 * Helper function to create database service instance
 */
export function createDatabaseService(db: D1Database): DatabaseService {
  return new DatabaseService(db)
}
