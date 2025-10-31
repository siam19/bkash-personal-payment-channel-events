-- Migration: Create tracking_table
-- Description: Stores each payment session created when a customer selects a ticket

CREATE TABLE IF NOT EXISTS tracking_table (
  tracking_id TEXT PRIMARY KEY NOT NULL,
  item_code TEXT NOT NULL,
  payment_amount_cents INTEGER NOT NULL,
  offered_receivers TEXT NOT NULL,
  user_entered_trxid TEXT,
  customer_info_json TEXT NOT NULL,
  form_data_json TEXT,
  ticket_choice TEXT NOT NULL,
  verification_method TEXT NOT NULL DEFAULT 'auto' CHECK(verification_method IN ('auto', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'submitted_trx', 'verified', 'failed', 'expired', 'canceled')),
  matched_transaction_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (matched_transaction_id) REFERENCES transactions_table(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracking_status ON tracking_table(status);
CREATE INDEX IF NOT EXISTS idx_tracking_user_trx ON tracking_table(user_entered_trxid);
CREATE INDEX IF NOT EXISTS idx_tracking_expires ON tracking_table(expires_at);
CREATE INDEX IF NOT EXISTS idx_tracking_created ON tracking_table(created_at);
