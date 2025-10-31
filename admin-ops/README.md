# bKash Payment Admin Ops - SvelteKit App

Admin interface for manually processing bKash payment SMS and managing the payment channel system.

## What It Does

Provides a web-based admin interface for:

1. **Manual SMS Entry** - Paste bKash payment receipt SMS to process payments
2. **Transaction Monitoring** - View parsed transaction details and verification status
3. **Dashboard** (Future) - Monitor all tracking sessions and transactions

## Tech Stack

- **SvelteKit** - Full-stack web framework with Svelte 5
- **Tailwind CSS** - Utility-first CSS framework (v4)
- **Cloudflare Workers** - Deployment platform (via adapter-cloudflare)
- **TypeScript** - Type-safe development

## Setup

### Prerequisites
- Node.js 18+
- Worker API running (see `../worker/README.md`)

### Installation
```bash
npm install
```

### Environment Configuration

Create `.env` file (copy from `.env.example`):
```bash
# Development
PUBLIC_WORKER_URL=http://localhost:8787

# Production
# PUBLIC_WORKER_URL=https://your-worker.your-subdomain.workers.dev
```

**Important:** The `PUBLIC_` prefix makes the variable available to the browser. This is required for client-side API calls.

### Development
```bash
npm run dev
```

Admin interface runs at `http://localhost:5173`

### Build
```bash
npm run build
```

### Deployment (Cloudflare Workers)
```bash
npm run deploy
```

## Features

### SMS Entry Page (`/sms`)

- **Receiver Selection** - Dropdown to select which bKash account received payment
- **SMS Text Area** - Paste complete bKash SMS
- **Quick Actions:**
  - 📤 Submit SMS - Process the SMS
  - 📋 Load Sample - Fill form with sample SMS for testing
  - 🗑️ Clear - Reset the form

**Success Display:**
- Transaction details (TrxID, amount, sender, receiver)
- New vs duplicate transaction indicator
- Verification results (attempted vs verified count)
- Status messages for different scenarios

**Error Handling:**
- Clear error messages for invalid SMS format
- Field-level validation
- Network error handling

### Home Page (`/`)

- Quick navigation to SMS entry
- Placeholder for future dashboard features

## API Integration

The app communicates with the Hono worker via REST API:

**Endpoint:** `POST {PUBLIC_WORKER_URL}/webhooks/sms`

**Request:**
```json
{
  "raw_sms": "You have received Tk 500.00...",
  "receiver_phone": "01785863769"
}
```

**Response:**
```json
{
  "success": true,
  "is_new": true,
  "transaction": { ... },
  "verification": {
    "attempted": 1,
    "verified": 1
  }
}
```

## Project Structure

```
admin-ops/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte       # Global layout with nav
│   │   ├── +page.svelte         # Home/dashboard page
│   │   └── sms/
│   │       └── +page.svelte     # SMS entry page
│   ├── lib/                     # Shared components/utils
│   ├── app.css                  # Global styles (Tailwind)
│   └── app.html                 # HTML template
├── .env                         # Environment variables (gitignored)
├── .env.example                 # Environment template
├── wrangler.jsonc              # Cloudflare Workers config
└── package.json
```

## Styling

Uses **Tailwind CSS v4** with custom theme:

- **Primary Color:** Purple (`purple-600`)
- **Gradient Background:** Purple to Indigo
- **Design System:** Clean, modern UI with card-based layouts
- **Responsive:** Mobile-first design

## Development Tips

### Hot Module Replacement
SvelteKit automatically reloads when you save files. No manual refresh needed.

### Type Safety
Use TypeScript for all logic. SvelteKit provides automatic type inference for routes and forms.

### Testing SMS Processing

1. Start worker: `cd ../worker && npm run dev`
2. Start admin-ops: `npm run dev`
3. Visit `http://localhost:5173/sms`
4. Click "Load Sample" for a pre-filled SMS
5. Click "Submit SMS"

### Production Deployment

1. Update `.env` with production worker URL
2. Build: `npm run build`
3. Deploy: `npm run deploy`

**Note:** Make sure the worker is deployed first and the URL is accessible.

## Future Enhancements

- [ ] Dashboard with all tracking sessions
- [ ] Transaction search and filtering
- [ ] Manual verification override
- [ ] Customer lookup
- [ ] Analytics and reporting
- [ ] Authentication/authorization
- [ ] Receiver management (add/disable phones)
- [ ] Audit logs

## Security Considerations

### Current (MVP)
- No authentication (admin-only access assumed)
- CORS not configured (same-origin or open)

### Production Recommendations
- Add authentication (Cloudflare Access, OAuth, etc.)
- Configure CORS properly between admin-ops and worker
- Add rate limiting
- Use HTTPS only
- Environment variable validation
- Input sanitization

## Troubleshooting

### "Failed to submit SMS"
- Check if worker is running (`http://localhost:8787/health`)
- Verify `PUBLIC_WORKER_URL` in `.env`
- Check browser console for CORS errors

### CORS Issues
Worker needs to allow requests from admin-ops origin. Add CORS headers to worker if needed:
```ts
app.use('*', async (c, next) => {
  await next()
  c.header('Access-Control-Allow-Origin', '*') // Or specific origin
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
})
```

### Environment Variables Not Working
- Must use `PUBLIC_` prefix for client-side variables
- Restart dev server after changing `.env`
- Check `import { PUBLIC_WORKER_URL } from '$env/static/public'`

## License

MIT

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
