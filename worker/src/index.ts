import { Hono } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>();

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
    const db = c.env.bkash_payment_ch0;
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

export default app;
