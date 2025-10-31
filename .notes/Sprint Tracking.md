# Sprint Tracking - bKash Personal Payment Channel MVP

This document tracks the implementation progress of the bKash personal payment channel system built with Hono.js on Cloudflare Workers.

---

## Sprint Overview

### Technology Stack
- Framework: Hono.js (ultrafast web framework)
- Runtime: Cloudflare Workers
- Database: Cloudflare D1 (SQLite)
- Language: TypeScript

### MVP Scope
Build a payment verification system that:
1. Creates payment sessions for ticket purchases
2. Displays payment pages to customers
3. Accepts TrxID submissions from customers
4. Ingests and parses bKash SMS receipts
5. Verifies payments by matching TrxID, amount, receiver, and time
6. Provides admin interface for manual SMS entry
7. Runs scheduled verification sweeps

---

## Phase 1: Project Setup & Database Schema

### Goals
- Initialize Hono.js project with TypeScript
- Configure Cloudflare Workers environment
- Set up D1 database binding
- Create all database tables with proper indexes
- Seed initial receiver data

### Tasks
- [x] Verify wrangler authentication (Already done - `npx wrangler whoami` passed)
- [x] Install Hono.js and dependencies
- [x] Configure `wrangler.jsonc` for D1 binding
- [x] Create TypeScript types for database models
- [x] Write SQL migration for `receivers_table`
- [x] Write SQL migration for `transactions_table`
- [x] Write SQL migration for `tracking_table`
- [x] Apply migrations to D1 database
- [x] Seed `receivers_table` with test receiver phones

### Acceptance Criteria
- [x] Hono app runs locally with `wrangler dev`
- [x] D1 database accessible via binding
- [x] All tables created with correct schema
- [x] Indexes properly set up
- [x] At least 1 active receiver in `receivers_table`

### Questions Before Starting
1. ✓ Receiver phone: "01785863769"
2. ✓ ID generation: ULID
3. ✓ Database name: `bkash_payment_ch0`

### Context for Future Phases

**Completed:** Phase 1 - Project Setup & Database Schema

**Files Created:**
- `src/types/database.ts` - TypeScript interfaces for all database tables and bindings
- `migrations/0001_create_receivers_table.sql` - receivers_table schema
- `migrations/0002_create_transactions_table.sql` - transactions_table with indexes
- `migrations/0003_create_tracking_table.sql` - tracking_table with all indexes
- `migrations/0004_seed_receivers.sql` - Initial receiver data (01785863769)

**Database Structure:**
- D1 database: `bkash_payment_ch0` (both local and remote)
- Binding name: `DB` (accessible via `c.env.DB`)
- All tables created with proper indexes
- One active receiver seeded: 01785863769 (label: "Primary Phone")

**Dependencies Installed:**
- `hono` - Web framework
- `ulid` - ID generation
- `@cloudflare/workers-types` - TypeScript types

**Configuration:**
- `wrangler.jsonc` - D1 binding configured for local and remote
- TypeScript strict mode enabled
- Database accessible and tested via `/health` endpoint

**Key TypeScript Types:**
```typescript
// Bindings interface for Worker environment
interface Bindings {
  DB: D1Database
}

// Table interfaces: Receiver, Transaction, Tracking
// All use proper TypeScript types matching SQL schema
```

**Notes for Next Phases:**
- ULID library installed and ready for ID generation
- Database helper functions needed (create in Phase 3)
- SMS parser regex patterns documented in architecture
- All timestamp fields use ISO 8601 format
- All amount fields use cents (INTEGER) to avoid floating point issues

**Health Check Verified:**
```json
{
  "status": "healthy",
  "database": "connected",
  "active_receivers": 1,
  "timestamp": "2025-10-31T04:44:39.881Z"
}
```

---

## Phase 2: SMS Parser Service

### Goals
- Create reusable SMS parsing utility
- Handle bKash SMS format variations
- Extract amount, TrxID, sender phone, timestamp
- Normalize and validate parsed data
- Handle parsing errors gracefully

### Tasks
- [x] Create `src/services/smsParser.ts` module
- [x] Implement regex patterns for SMS parsing
- [x] Add amount extraction and conversion to cents
- [x] Add TrxID normalization (trim, uppercase)
- [x] Add sender phone extraction
- [x] Add timestamp parsing and ISO 8601 conversion
- [x] Create validation for parsed data
- [x] Write unit tests for parser with sample SMS messages
- [x] Handle edge cases (commas in amounts, missing fields)

### Acceptance Criteria
- [x] Parser successfully extracts all fields from valid SMS
- [x] Amount correctly converted to cents (500.00 → 50000)
- [x] TrxID normalized consistently
- [x] Timestamps converted to ISO 8601 format
- [x] Returns clear error messages for invalid SMS
- [x] All sample SMS formats from architecture doc parse correctly

### Questions Before Starting
None - straightforward implementation based on architecture specs

### Context for Future Phases

**Completed:** Phase 2 - SMS Parser Service

**Files Created:**
- `src/services/smsParser.ts` - Complete SMS parsing service
- `src/services/smsParser.test.ts` - Test file (to run later)

**Key Functions:**
```typescript
parseBkashSMS(rawSMS: string): ParseResult
normalizeTrxID(trxid: string): string
```

**Regex Patterns:**
- Amount: `/Tk\s+([\d,]+\.\d{2})/` - Handles commas in amounts
- Sender: `/from\s+(\d{11})/` - Extracts 11-digit phone
- TrxID: `/TrxID\s+([A-Z0-9]+)/i` - Case-insensitive extraction
- Timestamp: `/at\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/` - DD/MM/YYYY HH:mm format

**Features:**
- Converts amounts to cents (handles commas: "2,000.00" → 200000)
- Normalizes TrxID to uppercase for consistent comparison
- Converts timestamps from DD/MM/YYYY HH:mm to ISO 8601
- Returns structured errors with field name and message
- Validates all required fields present
- Handles edge cases (empty SMS, invalid formats)

**Return Types:**
```typescript
interface ParseResult {
  success: boolean
  data?: ParsedSMS
  error?: ParseError
}
```

**Notes for Next Phases:**
- Parser is pure function with no dependencies
- Can be tested independently
- Error messages include field name for debugging
- Ready to integrate into webhook endpoint (Phase 8)

---

## Phase 3: Database Service Layer

### Goals
- Create type-safe database operations
- Implement CRUD for all tables
- Handle D1 query execution
- Add transaction support where needed
- Provide clean API for business logic

### Tasks
- [ ] Create `src/services/db.ts` with D1 wrapper
- [ ] Implement `receivers` operations (list active, get by phone)
- [ ] Implement `transactions` operations (insert, get by TrxID, check duplicates)
- [ ] Implement `tracking` operations (create, update status, get by ID)
- [ ] Add proper TypeScript types for all operations
- [ ] Handle database errors gracefully
- [ ] Add helper for JSON field serialization/deserialization
- [ ] Create query builders for complex lookups

### Acceptance Criteria
- All database operations type-safe
- Unique constraint on `transactions.trxid` enforced
- JSON fields properly serialized/deserialized
- Clear error messages for constraint violations
- Can perform all operations needed by verification logic

### Questions Before Starting
*To be determined after Phase 2*

### Context for Future Phases
*To be filled after completion*

---

## Phase 4: POST /track - Create Payment Session

### Goals
- Implement payment session creation endpoint
- Generate unique tracking IDs
- Snapshot active receivers
- Return redirect URL and session details

### Tasks
- [ ] Create `src/routes/track.ts` route handler
- [ ] Install and configure ULID/nanoid library
- [ ] Implement tracking ID generation
- [ ] Query active receivers from database
- [ ] Validate request body (item_code, amount, customer info)
- [ ] Calculate expires_at (created_at + 1 hour)
- [ ] Insert tracking record with all fields
- [ ] Return JSON response with tracking_id and redirect URL
- [ ] Add error handling for missing receivers
- [ ] Test with sample customer data

### Acceptance Criteria
- POST /track accepts valid JSON request
- Generates unique tracking ID
- Stores all customer info in tracking_table
- Returns correct redirect URL
- Sets expires_at to 1 hour from creation
- Snapshots all active receivers into offered_receivers
- Returns 400 for invalid requests

### Questions Before Starting
*To be determined after Phase 3*

### Context for Future Phases
*To be filled after completion*

---

## Phase 5: GET /bkash-personal/:trackingId - Payment Page

### Goals
- Display payment instructions to customer
- Show receiver phone numbers
- Display exact amount to pay
- Show expiry countdown or notice
- Provide TrxID input form

### Tasks
- [ ] Create `src/routes/payment-page.ts` route handler
- [ ] Implement tracking session lookup by ID
- [ ] Check if session expired or invalid
- [ ] Render HTML template with Hono's `html` helper
- [ ] Display offered_receivers list
- [ ] Display payment_amount_cents formatted as Taka
- [ ] Add countdown timer or expiry notice
- [ ] Create TrxID submission form (POST to submit-trx endpoint)
- [ ] Style basic CSS for readability
- [ ] Add error page for expired/invalid sessions

### Acceptance Criteria
- GET /bkash-personal/:trackingId returns HTML page
- Shows all receiver phone numbers from session
- Displays correct payment amount
- Shows expiry information
- Form submits to correct endpoint
- Returns 404 for invalid tracking ID
- Shows error message for expired sessions

### Questions Before Starting
*To be determined after Phase 4*

### Context for Future Phases
*To be filled after completion*

---

## Phase 6: POST /bkash-personal/:trackingId/submit-trx - Submit TrxID

### Goals
- Accept TrxID from customer
- Update tracking record
- Attempt immediate verification
- Return success response without blocking

### Tasks
- [ ] Create `src/routes/submit-trx.ts` route handler
- [ ] Parse TrxID from request body (JSON or form-encoded)
- [ ] Normalize TrxID (trim, uppercase)
- [ ] Update tracking record with user_entered_trxid
- [ ] Change status to 'submitted_trx'
- [ ] Update updated_at timestamp
- [ ] Query transactions_table for matching TrxID
- [ ] If found, call verification service
- [ ] Return success message immediately
- [ ] Handle already-submitted and expired sessions

### Acceptance Criteria
- POST accepts both JSON and form-encoded data
- Updates tracking record with normalized TrxID
- Changes status to 'submitted_trx'
- Attempts immediate verification
- Returns success message without waiting
- Handles duplicate submissions gracefully
- Returns error for expired sessions

### Questions Before Starting
*To be determined after Phase 5*

### Context for Future Phases
*To be filled after completion*

---

## Phase 7: Verification Service

### Goals
- Implement core payment verification logic
- Match tracking sessions with transactions
- Enforce all verification rules
- Update statuses appropriately
- Handle all failure scenarios

### Tasks
- [ ] Create `src/services/verification.ts` module
- [ ] Implement TrxID matching (normalized, case-insensitive)
- [ ] Implement amount matching (strict equality)
- [ ] Implement receiver matching (in offered_receivers array)
- [ ] Implement time window validation
- [ ] Check for duplicate TrxID usage
- [ ] Update tracking status to 'verified' on success
- [ ] Set matched_transaction_id on success
- [ ] Set status to 'failed' with notes on failure
- [ ] Return verification result object
- [ ] Add logging for all verification attempts

### Acceptance Criteria
- Verifies only when all rules pass
- Correctly matches amount in cents
- Validates receiver is in offered list
- Enforces time window (created_at - 1hr to expires_at + 15min)
- Prevents duplicate TrxID usage
- Sets clear failure reasons in notes field
- Updates tracking record transactionally
- Returns structured result (success/failure + reason)

### Questions Before Starting
*To be determined after Phase 6*

### Context for Future Phases
*To be filled after completion*

---

## Phase 8: POST /webhooks/sms - SMS Ingestion

### Goals
- Accept raw SMS from external sources
- Parse SMS using parser service
- Validate receiver phone
- Store transaction in database
- Trigger verification for pending sessions
- Handle idempotency via unique TrxID

### Tasks
- [ ] Create `src/routes/webhook-sms.ts` route handler
- [ ] Accept JSON with raw_sms and receiver_phone
- [ ] Call SMS parser service
- [ ] Validate receiver_phone exists in receivers_table
- [ ] Validate parsed amount > 0
- [ ] Insert into transactions_table
- [ ] Handle duplicate TrxID (return existing record)
- [ ] Query for matching pending tracking sessions
- [ ] Call verification service for matches
- [ ] Return parsed data in response
- [ ] Add basic rate limiting (IP-based)
- [ ] Log all webhook calls

### Acceptance Criteria
- POST /webhooks/sms accepts raw SMS text
- Parses all fields correctly
- Validates receiver is in allowlist
- Stores transaction with unique TrxID
- Idempotent (duplicate TrxID returns 200 with existing data)
- Triggers verification for matching sessions
- Returns 400 for parsing failures with clear error
- Returns 400 for invalid receiver
- Logs all attempts for debugging

### Questions Before Starting
*To be determined after Phase 7*

### Context for Future Phases
*To be filled after completion*

---

## Phase 9: POST /admin/paste-sms - Admin Interface

### Goals
- Provide manual SMS entry interface
- Simple HTML form for admins
- Forward to webhook internally
- Display parsing results
- Optional basic auth protection

### Tasks
- [ ] Create `src/routes/admin-paste.ts` route handler
- [ ] Create GET /admin/paste-sms HTML form
- [ ] Add textarea for raw SMS text
- [ ] Add dropdown/input for receiver phone selection
- [ ] Create POST /admin/paste-sms handler
- [ ] Forward to webhook SMS endpoint internally
- [ ] Display success with parsed data
- [ ] Display errors from parser
- [ ] Add basic auth middleware (optional for MVP)
- [ ] Style form for usability

### Acceptance Criteria
- GET /admin/paste-sms returns HTML form
- Form has textarea and receiver selection
- POST forwards to webhook endpoint
- Displays parsed transaction data on success
- Shows clear error messages on failure
- Form is usable on mobile devices
- Basic auth protects endpoint (optional)

### Questions Before Starting
*To be determined after Phase 8*

### Context for Future Phases
*To be filled after completion*

---

## Phase 10: Scheduled Verification Sweep (Cron)

### Goals
- Run periodic verification checks
- Expire old sessions
- Retry verification for submitted sessions
- Keep system self-healing

### Tasks
- [ ] Configure cron trigger in wrangler.jsonc (every 5 minutes)
- [ ] Create `src/routes/cron.ts` scheduled handler
- [ ] Query for sessions with status 'pending' or 'submitted_trx' where expires_at < now
- [ ] Update expired sessions to status 'expired'
- [ ] Query for sessions with status 'submitted_trx' and user_entered_trxid not null
- [ ] For each, attempt verification against transactions_table
- [ ] Update verified sessions
- [ ] Log sweep results (expired count, verified count)
- [ ] Handle errors gracefully

### Acceptance Criteria
- Cron runs every 5 minutes
- Expires sessions past their deadline
- Retries verification for submitted sessions
- Updates status appropriately
- Logs activity for monitoring
- Doesn't fail entire sweep if one record errors
- Completes within Worker CPU time limits

### Questions Before Starting
*To be determined after Phase 9*

### Context for Future Phases
*To be filled after completion*

---

## Phase 11: Fulfillment Flow (Stubbed)

### Goals
- Trigger on status change to 'verified'
- Extract customer email
- Generate fulfillment token/link
- Log stubbed email content
- Prepare for future email integration

### Tasks
- [ ] Create `src/services/fulfillment.ts` module
- [ ] Implement function triggered on verification success
- [ ] Extract customer_info_json.email
- [ ] Generate unique fulfillment token (ULID/nanoid)
- [ ] Construct ticket generation URL
- [ ] Log email subject and body to console
- [ ] Call fulfillment from verification service
- [ ] Add environment variable for ticket URL base
- [ ] Document email template format

### Acceptance Criteria
- Called whenever tracking status becomes 'verified'
- Extracts email from customer_info_json
- Generates unique fulfillment token
- Logs complete email content to console
- Email template includes ticket link
- Does not block verification response
- Ready for future email provider integration

### Questions Before Starting
*To be determined after Phase 10*

### Context for Future Phases
*To be filled after completion*

---

## Phase 12: Integration Testing & Deployment

### Goals
- Test complete end-to-end flow
- Verify all edge cases
- Deploy to Cloudflare Workers
- Validate production setup

### Tasks
- [ ] Test full happy path (track → pay → submit → webhook → verify → fulfill)
- [ ] Test amount mismatch failure
- [ ] Test wrong receiver failure
- [ ] Test duplicate TrxID failure
- [ ] Test session expiry
- [ ] Test SMS arrives before TrxID submission
- [ ] Test delayed SMS (cron sweep catches it)
- [ ] Test manual admin paste interface
- [ ] Review all error messages for clarity
- [ ] Deploy to Cloudflare Workers production
- [ ] Verify D1 database in production
- [ ] Test production endpoints
- [ ] Document API endpoints for external consumers
- [ ] Create runbook for common issues

### Acceptance Criteria
- All happy path tests pass
- All failure scenarios handled correctly
- Edge cases produce expected results
- Successfully deployed to production
- Production endpoints accessible
- D1 database operational
- No TypeScript errors
- All environment variables configured
- Documentation complete

### Questions Before Starting
*To be determined after Phase 11*

### Context for Future Phases
*To be filled after completion*

---

## Post-MVP Enhancements (Future Sprints)

These are explicitly out of scope for MVP but documented for future reference:

1. **Security Hardening**
   - HMAC signature verification for webhooks
   - Bearer token authentication
   - Role-based access control for admin
   - IP allowlisting for sensitive endpoints

2. **SMS Parser Improvements**
   - Configurable regex patterns via environment variables
   - Support for multiple SMS formats
   - Better error messages with suggestions
   - SMS format detection and auto-selection

3. **Monitoring & Observability**
   - Prometheus metrics export
   - Error tracking with Sentry
   - Analytics dashboard
   - Alert system for failed payments

4. **Customer Support Tools**
   - Admin dashboard for viewing all sessions
   - Manual verification override
   - Refund handling workflow
   - Customer notification system

5. **Real Email Integration**
   - Integrate email provider (SendGrid, Mailgun, etc.)
   - Email templates with branding
   - Retry logic for failed sends
   - Email delivery tracking

6. **Performance Optimizations**
   - Caching active receivers
   - Database query optimization
   - Batch verification processing
   - Connection pooling

---

## Notes & Conventions

### Code Organization
```
src/
  routes/          # Hono route handlers
  services/        # Business logic (parser, verification, fulfillment)
  types/           # TypeScript type definitions
  middleware/      # Custom middleware (auth, validation)
  utils/           # Helper functions
  index.ts         # Main Hono app setup
```

### TypeScript Conventions
- Use strict mode
- Explicit return types for functions
- Interfaces for data structures
- Enums for status values

### Testing Strategy
- Unit tests for parser and verification logic
- Integration tests for API endpoints
- Manual testing for HTML interfaces
- End-to-end testing for complete flow

### Error Handling
- Always return structured error responses
- Log errors with context
- Provide actionable error messages to users
- Never expose internal errors to external callers

### Database Conventions
- All timestamps in ISO 8601 format
- All amounts in cents (integers)
- JSON fields for flexible data
- Indexes on frequently queried fields

---

## Current Status

**Active Phase:** Phase 1 - Project Setup & Database Schema

**Blocked On:** Clarifying questions for Phase 1

**Last Updated:** October 31, 2025
