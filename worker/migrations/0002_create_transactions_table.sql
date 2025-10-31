-- Migration: Create transactions_table
-- Description: Stores parsed payment receipts from bKash SMS

CREATE TABLE IF NOT EXISTS transactions_table (
  id TEXT PRIMARY KEY NOT NULL,
  trxid TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  receiver_phone TEXT NOT NULL,
  sender_phone TEXT,
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (receiver_phone) REFERENCES receivers_table(phone)
);

-- Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS uq_trxid ON transactions_table(trxid);
CREATE INDEX IF NOT EXISTS idx_tx_receiver_time ON transactions_table(receiver_phone, received_at);
CREATE INDEX IF NOT EXISTS idx_tx_amount_time ON transactions_table(amount_cents, received_at);
