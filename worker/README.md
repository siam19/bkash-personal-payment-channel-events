# bKash Personal Payment Channel - Hono Worker

A Cloudflare Worker built with Hono.js that automates payment verification for bKash personal account payments. This system enables accepting payments via personal bKash accounts, verifying them automatically through SMS webhooks, and triggering fulfillment actions.

## What It Does

This worker provides a complete payment tracking and verification system:

1. **Payment Session Creation** - Generates unique tracking URLs for customers to pay
2. **Payment Instructions** - Shows customers which bKash numbers to pay and collects Transaction IDs
3. **SMS Webhook Integration** - Receives bKash payment receipts via SMS webhook
4. **Automated Verification** - Matches payments against tracking sessions with 5-rule verification
5. **Fulfillment** - Triggers email notifications and ticket generation on successful verification
6. **Scheduled Sweeps** - Runs periodic checks to retry verifications and expire old sessions

## How It Works

### Architecture

```
Customer → POST /track → Tracking Session Created
                ↓
Customer → Payment Page → Pays via bKash → Submits TrxID
                ↓
SMS Gateway → POST /webhooks/sms → Transaction Stored
                ↓
Verification Service (5 Rules) → Status: verified
                ↓
Fulfillment Service → Email Logged → Ticket Generated
```

### Verification Rules (All Must Pass)

1. **TrxID Match** - Normalized comparison (case-insensitive)
2. **Amount Match** - Exact match in cents (no tolerance)
3. **Receiver Match** - Paid to authorized receiver phone
4. **Time Window** - Within session validity (created - 1hr to expired + 15min)
5. **No Duplicates** - TrxID not already used by another verified session

### Database (Cloudflare D1)

- `receivers_table` - Authorized bKash receiver phones
- `transactions_table` - All incoming SMS payment receipts (unique TrxID)
- `tracking_table` - Payment tracking sessions with customer info

## API Endpoints

### 1. Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-31T10:00:00.000Z"
}
```

---

### 2. Create Tracking Session
```http
POST /track
Content-Type: application/json
```
**Request:**
```json
{
  "item_code": "TICKET_TIER_A",
  "payment_amount_cents": 50000,
  "customer_info": {
    "name": "John Doe",
    "phone": "01712345678",
    "email": "john@example.com"
  },
  "ticket_choice": "Early Bird - Tier A",
  "form_data": {}
}
```
**Response:** (201 Created)
```json
{
  "tracking_id": "01JBY9K3M2P4R5S6T7V8W9X0Y1",
  "redirect_url": "http://localhost:8787/bkash-personal/01JBY...",
  "expires_at": "2025-10-31T11:00:00.000Z"
}
```

---

### 3. Payment Page (Customer View)
```http
GET /bkash-personal/:trackingId
```
Returns HTML page with:
- Receiver bKash numbers
- Exact amount to pay
- TrxID submission form
- Session expiry countdown

---

### 4. Submit Transaction ID
```http
POST /bkash-personal/:trackingId/submit-trx
Content-Type: application/json
```
**Request:**
```json
{
  "trxid": "CJU0PZQ3U6"
}
```
**Response:** (200 OK)
```json
{
  "status": "submitted",
  "message": "Thank you! Your Transaction ID has been submitted..."
}
```

---

### 5. SMS Webhook (External Integration)
```http
POST /webhooks/sms
Content-Type: application/json
```
**Request:**
```json
{
  "raw_sms": "You have received Tk 500.00 from 01533817247. Fee Tk 0.00. Balance Tk 1,117.78. TrxID CJU0PZQ3U6 at 30/10/2025 21:02",
  "receiver_phone": "01785863769"
}
```
**Response:** (201 Created or 200 OK for duplicates)
```json
{
  "success": true,
  "is_new": true,
  "transaction": {
    "id": "01K8WC96AS95G1G70WCHR24RQF",
    "trxid": "CJU0PZQ3U6",
    "sender_phone": "01533817247",
    "receiver_phone": "01785863769",
    "amount_cents": 50000,
    "received_at": "2025-10-30T15:02:00.000Z"
  },
  "parsed_data": { ... },
  "verification": {
    "attempted": 1,
    "verified": 1
  }
}
```

---

### 6. Manual Cron Trigger (Development Only)
```http
GET /test/cron
```
Manually triggers the scheduled verification sweep. **Remove before production deployment.**

---

## Setup & Development

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI

### Installation
```bash
npm install
```

### Database Setup
```bash
# Create local D1 database
npx wrangler d1 create bkash_payment_ch0

# Apply migrations locally
npx wrangler d1 migrations apply bkash_payment_ch0 --local

# Apply migrations to production
npx wrangler d1 migrations apply bkash_payment_ch0 --remote
```

### Development
```bash
npm run dev
```
Worker runs at `http://localhost:8787`

### Type Generation
```bash
npm run cf-typegen
```

### Deployment
```bash
npm run deploy
```

### CORS Configuration

The worker includes CORS headers to allow requests from the admin-ops frontend:

**Allowed Origins (Development):**
- `http://localhost:5173` - SvelteKit dev server (default)
- `http://localhost:5174` - Alternative port

**For Production:**
Update the CORS configuration in `src/index.ts` to include your production admin-ops URL:
```typescript
app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'https://admin-ops.your-domain.workers.dev'  // Add production URL
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));
```

---

## Running Tests

### Integration Tests (PowerShell)
```powershell
# Start the worker first
npm run dev

# In another terminal, run tests
.\tests\integration.test.ps1
```

### Test Coverage
1. ✅ Health check endpoint
2. ✅ Complete happy path (E2E: track → submit → webhook → verify → fulfill)
3. ✅ Amount mismatch failure
4. ✅ Duplicate TrxID prevention
5. ✅ Webhook idempotency
6. ✅ SMS parser validation
7. ✅ Invalid receiver rejection

### Example Test Output
```
╔════════════════════════════════════════════════════════════╗
║  TEST 2: Complete Happy Path (E2E)
╚════════════════════════════════════════════════════════════╝

  ✓ Create tracking session
    Expected: Valid ULID
    Got: 01JBY9K3M2P4R5S6T7V8W9X0Y1
  ✓ Submit TrxID
    Expected: status=submitted
    Got: status=submitted
  ✓ SMS verification & fulfillment
    Expected: verified=1
    Got: verified=1
```

---

## Scheduled Jobs

The worker includes a cron trigger that runs every 5 minutes:

**Tasks:**
- Expire old tracking sessions
- Retry verification for pending sessions
- Log sweep statistics

**Configuration:** `wrangler.jsonc`
```jsonc
"triggers": {
  "crons": ["*/5 * * * *"]
}
```

---

## Environment Configuration

### D1 Binding
```jsonc
[[d1_databases]]
binding = "DB"
database_name = "bkash_payment_ch0"
database_id = "your-database-id"
```

### TypeScript Bindings
```ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

---

## Key Features

- ✅ **Idempotent Operations** - Duplicate TrxIDs handled gracefully
- ✅ **ULID Generation** - Sortable, unique identifiers
- ✅ **Type-Safe** - Full TypeScript with strict mode
- ✅ **Automated Verification** - 5-rule payment matching
- ✅ **SMS Parsing** - Regex-based extraction with validation
- ✅ **Session Expiry** - Automatic cleanup of old sessions
- ✅ **Error Handling** - Clear error messages for debugging
- ✅ **Non-Blocking Fulfillment** - Async email/ticket generation

---

## Project Structure

```
worker/
├── src/
│   ├── index.ts                    # Main Hono app + exports
│   ├── routes/
│   │   ├── track.ts               # POST /track
│   │   ├── paymentPage.ts         # GET /bkash-personal/:id
│   │   ├── submitTrx.ts           # POST /submit-trx
│   │   └── webhook-sms.ts         # POST /webhooks/sms
│   ├── services/
│   │   ├── db.ts                  # Database service layer
│   │   ├── smsParser.ts           # SMS parsing with regex
│   │   ├── verification.ts        # 5-rule verification logic
│   │   └── fulfillment.ts         # Email logging + tickets
│   ├── scheduled/
│   │   └── cron.ts                # Periodic verification sweep
│   ├── templates/
│   │   └── paymentPage.ts         # HTML templates
│   └── types/
│       └── database.ts            # TypeScript interfaces
├── migrations/
│   ├── 0001_create_receivers_table.sql
│   ├── 0002_create_transactions_table.sql
│   ├── 0003_create_tracking_table.sql
│   └── 0004_seed_receivers.sql
├── tests/
│   └── integration.test.ps1       # PowerShell integration tests
├── wrangler.jsonc                 # Cloudflare Worker config
└── package.json
```

---

## Next Steps

- [ ] Deploy to Cloudflare Workers production
- [ ] Remove/secure `GET /test/cron` endpoint
- [ ] Configure SMS webhook provider
- [ ] Build admin UI for manual SMS paste (SvelteKit app)
- [ ] Add email provider integration (replace console.log)
- [ ] Set up monitoring and alerts
- [ ] Add rate limiting for webhook endpoint

---

## License

MIT
