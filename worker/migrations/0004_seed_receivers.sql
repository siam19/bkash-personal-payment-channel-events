-- Migration: Seed initial receiver data
-- Description: Insert the initial bKash receiver phone number

INSERT OR IGNORE INTO receivers_table (phone, label, status, notes)
VALUES ('01785863769', 'Primary Payment Number', 'active', 'Initial receiver for testing and production');
