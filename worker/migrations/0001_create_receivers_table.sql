-- Migration: Create receivers_table
-- Description: Static configuration of personal bKash numbers we accept payments to

CREATE TABLE IF NOT EXISTS receivers_table (
  phone TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- No additional indexes needed since phone is the primary key
