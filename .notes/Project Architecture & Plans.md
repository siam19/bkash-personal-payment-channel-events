# Project Architecture & Plans

This document outlines the technical architecture, data models, APIs, and verification logic for the bKash personal payment channel system.

---

## System Overview

The system consists of:
- A **Tracking Worker** that creates payment sessions
- A **Payment Page** that displays receiver numbers and collects TrxID
- An **SMS Webhook** that ingests payment confirmations from bKash SMS
- A **Verification Service** (triggered on submit and via cron) that matches payments
- An **Admin Paste Interface** for manual SMS forwarding (backup)

All services run as Cloudflare Workers with D1 database bindings.

---

## Data Model

### 1. tracking_table

Stores each payment session created when a customer selects a ticket.

| Column                | Type     | Description                                                      |
|-----------------------|----------|------------------------------------------------------------------|
| tracking_id           | TEXT     | Primary key. ULID or nanoid for URL-safe uniqueness.            |
| item_code             | TEXT     | The ticket/item identifier selected by customer.                 |
| payment_amount_cents  | INTEGER  | Required payment in cents (to avoid floating point issues).     |
| offered_receivers     | TEXT     | JSON array of receiver phone numbers shown to this customer.     |
| user_entered_trxid    | TEXT     | TrxID pasted by customer. Nullable until submitted.              |
| customer_info_json    | TEXT     | JSON: `{name, phone, email}` collected before payment.           |
| form_data_json        | TEXT     | JSON: any additional form fields (event-specific).               |
| ticket_choice         | TEXT     | Tier or ticket type selected.                                    |
| verification_method   | TEXT     | `'auto'` or `'manual'`. Controls verification behavior.          |
| status                | TEXT     | Enum: `'pending'`, `'submitted_trx'`, `'verified'`, `'failed'`, `'expired'`, `'canceled'`. |
| matched_transaction_id| TEXT     | Foreign key to `transactions_table.id` once matched.             |
| created_at            | TEXT     | ISO 8601 timestamp of session creation.                          |
| updated_at            | TEXT     | ISO 8601 timestamp of last update.                               |
| expires_at            | TEXT     | ISO 8601 timestamp; set to `created_at + 1 hour`.                |
| notes                 | TEXT     | Admin notes or failure reasons. Nullable.                        |

**Indexes:**
- `idx_tracking_status` on `(status)`
- `idx_tracking_user_trx` on `(user_entered_trxid)`
- `idx_tracking_expires` on `(expires_at)`
- `idx_tracking_created` on `(created_at)`

**Status Lifecycle:**
```
pending
  ↓ (user submits TrxID)
submitted_trx
  ↓ (verification matches)
verified
```
Or diverge to:
- `expired` (after 1 hour with no match)
- `failed` (amount/receiver mismatch, duplicate TrxID, etc.)
- `canceled` (manual admin action)

---

### 2. transactions_table

Stores parsed payment receipts from bKash SMS.

| Column         | Type    | Description                                                      |
|----------------|---------|------------------------------------------------------------------|
| id             | TEXT    | Primary key. ULID or nanoid.                                     |
| trxid          | TEXT    | Transaction ID from bKash SMS. **Unique**.                       |
| amount_cents   | INTEGER | Amount received in cents.                                        |
| receiver_phone | TEXT    | Which of our bKash numbers received this payment.                |
| sender_phone   | TEXT    | Sender's phone (if available in SMS). Nullable.                  |
| received_at    | TEXT    | ISO 8601 timestamp when payment was received (from SMS).         |
| created_at     | TEXT    | ISO 8601 timestamp when this record was inserted.                |

**Indexes:**
- `uq_trxid` unique on `(trxid)`
- `idx_tx_receiver_time` on `(receiver_phone, received_at)`
- `idx_tx_amount_time` on `(amount_cents, received_at)`

**Idempotency:**
- `trxid` must be unique. Duplicate webhook calls with the same TrxID are ignored.

---

### 3. receivers_table

Static configuration of personal bKash numbers we accept payments to (1–3 numbers).

| Column | Type | Description                                              |
|--------|------|----------------------------------------------------------|
| phone  | TEXT | Primary key. Phone number in standard format.            |
| label  | TEXT | Human-readable label (e.g., "Phone 1", "Backup Phone").  |
| status | TEXT | Enum: `'active'`, `'disabled'`. Only active shown to users. |
| notes  | TEXT | Admin notes. Nullable.                                   |

**Notes:**
- All active receivers are shown to every customer.
- These are snapshotted into `tracking_table.offered_receivers` when a session is created.
- Disabling a receiver hides it from new sessions but doesn't invalidate old tracking rows.

---

## API Endpoints

### 1. POST /track

**Purpose:** Create a new payment session.

**Request Body (JSON):**
```json
{
  "item_code": "TICKET_TIER_A",
  "payment_amount_cents": 50000,
  "customer_info": {
    "name": "John Doe",
    "phone": "01712345678",
    "email": "john@example.com"
  },
  "form_data": {
    "age_confirmed": true,
    "newsletter": false
  },
  "ticket_choice": "Early Bird - Tier A"
}
```

**Response:**
```json
{
  "tracking_id": "01HQXYZ...",
  "redirect_url": "https://payments.domain.com/bkash-personal/01HQXYZ...",
  "expires_at": "2025-10-31T13:34:56Z"
}
```

**Logic:**
1. Query `receivers_table` for all `status='active'` phones.
2. Generate a unique `tracking_id` (ULID/nanoid).
3. Insert into `tracking_table`:
   - `offered_receivers` = JSON array of active receiver phones
   - `expires_at` = `created_at + 1 hour`
   - `status = 'pending'`
4. Return tracking_id and redirect URL.

---

### 2. GET /bkash-personal/:trackingId

**Purpose:** Display payment page to customer.

**Response:** HTML page showing:
- Receiver phone numbers (from `offered_receivers`)
- Exact payment amount
- Countdown timer or static notice: "This link expires in 1 hour"
- Input field for TrxID
- Submit button

**Logic:**
1. Query `tracking_table` by `tracking_id`.
2. If not found or expired → show error page.
3. Render payment instructions.

---

### 3. POST /bkash-personal/:trackingId/submit-trx

**Purpose:** Customer submits their TrxID after sending payment.

**Request Body (JSON or form-encoded):**
```json
{
  "trxid": "A1B2C3D4E5"
}
```

**Response:**
```json
{
  "status": "submitted",
  "message": "Thank you! Please check your email for your ticket."
}
```

**Logic:**
1. Normalize TrxID (trim spaces, optionally uppercase).
2. Update `tracking_table`:
   - Set `user_entered_trxid = trxid`
   - Set `status = 'submitted_trx'`
   - Set `updated_at = now()`
3. **Immediate verification attempt:**
   - Query `transactions_table` for matching `trxid`.
   - If found, run verification algorithm (see below).
   - If matched, mark `status='verified'` and trigger fulfillment.
4. Return success message (don't keep user waiting on page).

**Note:** Even if immediate match fails, the cron verification will retry later.

---

### 4. POST /webhooks/sms

**Purpose:** Ingest payment SMS from Android automation or manual paste.

**Request Body (JSON):**
```json
{
  "trxid": "A1B2C3D4E5",
  "amount_cents": 50000,
  "receiver_phone": "01812345678",
  "sender_phone": "01712345678",
  "received_at": "2025-10-31T12:34:56Z"
}
```

**Response:**
```json
{
  "status": "ok",
  "transaction_id": "01HQABC..."
}
```

**Logic:**
1. **Validation:**
   - Normalize TrxID (trim spaces).
   - Check `receiver_phone` is in `receivers_table` with `status='active'` or exists historically.
   - Validate `amount_cents > 0`.
   - Validate `received_at` is a valid ISO timestamp.

2. **Idempotency:**
   - Attempt to insert into `transactions_table` with unique constraint on `trxid`.
   - If duplicate → return existing `transaction_id` (idempotent success).

3. **Trigger verification:**
   - After successful insert, search for any `tracking_table` rows with:
     - `status IN ('pending', 'submitted_trx')`
     - `user_entered_trxid = trxid` (exact match)
   - If found, run verification algorithm.

4. Return success.

**Security (MVP):**
- No authentication in this version.
- Mitigations:
  - Rate limit per IP (e.g., 10 req/min).
  - Validate `receiver_phone` is in our allowlist.
  - Log all requests for audit.

**Future:** Add HMAC signature header or shared Bearer token.

---

### 5. POST /admin/paste-sms

**Purpose:** Manual backup interface for forwarding SMS.

**Request:** HTML form or JSON with `raw_sms` text.

**Logic:**
1. Parse SMS text using regex patterns to extract:
   - TrxID
   - Amount
   - Receiver phone
   - Sender phone
   - Timestamp
2. Forward parsed fields to `/webhooks/sms` internally.

**UI:** Simple HTML page with textarea and submit button. Optionally add basic auth (username/password) later.

---

### 6. Cron: Verification Sweep

**Purpose:** Periodically verify pending payments and expire old sessions.

**Trigger:** Every 5 minutes (configurable).

**Logic:**
1. **Expire old sessions:**
   - Find `tracking_table` rows where `status IN ('pending', 'submitted_trx')` AND `expires_at < now()`.
   - Update to `status='expired'`.

2. **Retry verification:**
   - Find `tracking_table` rows with `status='submitted_trx'` AND `user_entered_trxid IS NOT NULL`.
   - For each, attempt to match against `transactions_table`.
   - If matched, update to `status='verified'` and trigger fulfillment.

---

## Verification Algorithm

**Goal:** Match a `tracking_table` row with a `transactions_table` row.

**Inputs:**
- Tracking row: `user_entered_trxid`, `payment_amount_cents`, `offered_receivers`, `created_at`, `expires_at`
- Transaction row: `trxid`, `amount_cents`, `receiver_phone`, `received_at`

**Exact Match Rules:**
1. **TrxID match (required):**
   - Normalize both TrxIDs (trim spaces, case-insensitive comparison).
   - `tracking.user_entered_trxid == transaction.trxid`

2. **Amount match (strict):**
   - `tracking.payment_amount_cents == transaction.amount_cents`

3. **Receiver match:**
   - `transaction.receiver_phone` must be in `tracking.offered_receivers` array.

4. **Time window:**
   - `transaction.received_at` should be between `tracking.created_at - 1 hour` and `tracking.expires_at + 15 minutes` (small grace period for clock skew).

**Outcomes:**
- **Success:** All rules pass → update `tracking.status = 'verified'`, set `tracking.matched_transaction_id`, trigger fulfillment.
- **Failure scenarios:**
  - Amount mismatch → `status='failed'`, `notes='Amount mismatch: expected X, got Y'`
  - Receiver not in offered list → `status='failed'`, `notes='Payment sent to wrong number'`
  - Outside time window → keep `status='submitted_trx'` or `'failed'` depending on policy
  - TrxID already matched to another tracking row → `status='failed'`, `notes='Duplicate TrxID'`

**No Auto-Match Without TrxID:**
- If `user_entered_trxid IS NULL`, do not attempt to verify.
- User **must** submit TrxID to proceed.

---

## Fulfillment Flow

**Trigger:** When `tracking.status` transitions to `'verified'`.

**Actions:**
1. Extract `customer_info_json.email`.
2. Generate a unique fulfillment token or link (e.g., `https://tickets.domain.com/generate-qr/{fulfillment_token}`).
3. Send email (stubbed for now):
   - Subject: "Your Ticket is Ready!"
   - Body: "Click here to generate and save your QR code: [link]"
   - Log to console/terminal instead of actually sending.

**QR Generation (separate service):**
- Not part of this system.
- The link from the email leads to another service that generates the QR code and allows the customer to save it.

**Optional:** Store fulfillment state in a `fulfillment_table` (not required for MVP).

---

## Configuration & Environment

**Environment Variables / Secrets:**
- `RECEIVER_PHONES` (optional): Comma-separated list of active receiver phones, used to seed `receivers_table` on first deploy.
- `D1_BINDING`: Name of the D1 database binding.
- `VERIFICATION_METHOD_DEFAULT`: `'auto'` or `'manual'` (can be overridden per tracking row).

**Database Initialization:**
Run migration SQL to create tables and seed `receivers_table` with initial active phones.

---

## Security Considerations (MVP)

**Current State:**
- No authentication on `/webhooks/sms`.
- Basic rate limiting (IP-based).
- Receiver phone allowlist validation.

**Mitigations:**
- Unique TrxID constraint prevents most duplicate/spam issues.
- Log all webhook calls for audit and debugging.
- Admin paste interface can be password-protected with basic auth.

**Future Enhancements:**
- HMAC signature verification for Android devices.
- Shared secret or Bearer token for webhook.
- Role-based access for admin endpoints.

---

## Edge Cases & Error Handling

1. **Customer pays wrong amount:**
   - Verification fails with amount mismatch.
   - Mark `status='failed'` with clear reason in `notes`.
   - Send manual follow-up email (future enhancement).

2. **Customer pays to wrong number:**
   - Receiver not in `offered_receivers` → `status='failed'`.

3. **Customer submits wrong TrxID:**
   - No match found → stays `status='submitted_trx'`.
   - After expiry window → `status='expired'`.
   - Customer can contact support with correct TrxID (manual resolution).

4. **Same TrxID used by two customers:**
   - First match succeeds.
   - Second match sees TrxID already linked → `status='failed'`, `notes='Duplicate TrxID'`.

5. **SMS arrives before customer submits TrxID:**
   - Transaction stored in `transactions_table`.
   - When customer submits TrxID later, immediate verification matches it.

6. **Phone offline / SMS delayed:**
   - Customer submits TrxID → status becomes `'submitted_trx'`.
   - When SMS arrives later, cron sweep or webhook trigger will match and verify.
   - If SMS never arrives and 1 hour passes → `status='expired'`.

7. **Expiry during payment:**
   - If customer is slow to submit TrxID, session may expire.
   - They see an error message on submit.
   - Manual resolution: admin can extend `expires_at` or manually verify.

8. **Multiple active receivers, payment to one:**
   - All active receivers shown to customer.
   - Verification checks if `transaction.receiver_phone` is in the `offered_receivers` list.
   - Match succeeds regardless of which number customer chose.

---

## Deployment & Testing

**Deployment:**
- Deploy Worker to Cloudflare with D1 binding.
- Run SQL migrations to create tables.
- Seed `receivers_table` with 1–3 active phone numbers.
- Configure cron trigger for verification sweep.

**Manual Test Path:**
1. Call `POST /track` with sample customer data → get `tracking_id`.
2. Open `GET /bkash-personal/{tracking_id}` in browser → see payment page.
3. (Simulate) Send payment via bKash app to one of the receiver numbers.
4. Call `POST /webhooks/sms` with the payment details (TrxID, amount, receiver).
5. Call `POST /bkash-personal/{tracking_id}/submit-trx` with the same TrxID.
6. Verify in D1:
   - `tracking_table.status = 'verified'`
   - `tracking_table.matched_transaction_id` points to the transaction.
7. Check logs for stubbed email output.

**Future Phases:**
- Phase 2: Add HMAC auth, better SMS parsing, real email provider.
- Phase 3: Multi-device orchestration, health checks, rotation logic.
- Phase 4: Analytics dashboard, customer support tools, refund handling.

---

## Summary

This architecture provides a reliable, verifiable payment flow using personal bKash accounts and SMS-based confirmation. The design prioritizes:
- **Simplicity:** Static receivers, exact TrxID matching, 1-hour expiry.
- **Reliability:** Idempotent webhooks, cron fallback, clear status lifecycle.
- **User experience:** Minimal friction, clear instructions, email confirmation.
- **Scalability:** Framework-agnostic design, ready for auth and rotation in later phases.
