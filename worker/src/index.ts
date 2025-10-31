import { Hono } from "hono";
import type { Bindings } from "./types/database";
import { createTrackingSession } from "./routes/track";
import { getPaymentPage } from "./routes/paymentPage";
import { submitTrxID } from "./routes/submitTrx";
import { handleWebhookSMS } from "./routes/webhook-sms";
import { scheduledHandler } from "./scheduled/cron";
import { triggerCronManually } from "./routes/test-cron";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.json({ 
    message: "bKash Personal Payment Channel API",
    version: "1.0.0-mvp",
    status: "operational"
  });
});

// Health check endpoint that verifies DB connection
app.get("/health", async (c) => {
  try {
    const db = c.env.DB;
    const result = await db.prepare("SELECT COUNT(*) as count FROM receivers_table WHERE status = 'active'").first();
    
    return c.json({
      status: "healthy",
      database: "connected",
      active_receivers: result?.count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// POST /track - Create payment tracking session
app.post("/track", createTrackingSession);

// GET /bkash-personal/:trackingId - Display payment page
app.get("/bkash-personal/:trackingId", getPaymentPage);

// POST /bkash-personal/:trackingId/submit-trx - Submit TrxID
app.post("/bkash-personal/:trackingId/submit-trx", submitTrxID);

// POST /webhooks/sms - SMS ingestion webhook
app.post("/webhooks/sms", handleWebhookSMS);

// GET /test/cron - Manually trigger cron job (dev only)
app.get("/test/cron", triggerCronManually);

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler
};
