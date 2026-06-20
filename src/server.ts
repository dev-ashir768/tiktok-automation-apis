import express from "express";
import cors from "cors";
import { env } from "./env.js";
import extensionRouter from "./routes/extension.js";
import adminRouter from "./routes/admin.js";

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (curl, server-side), and any allowed origin / chrome-extension://
    if (!origin) return cb(null, true);
    const allowed = env.allowedOrigins.some((o) => o === "*" || origin.startsWith(o.replace("*", "")));
    cb(null, allowed);
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Admin router MUST be mounted before the extension router. Both share the
// /api prefix, and the extension router's requireApiKey middleware would
// otherwise reject every /api/admin/* request before adminRouter sees it.
app.use("/api/admin", adminRouter);
app.use("/api", extensionRouter);

// Error handler — catches zod and other thrown errors
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err?.name === "ZodError") {
    return res.status(400).json({ error: "Invalid input", issues: err.issues });
  }
  console.error(err);
  res.status(500).json({ error: err.message || "Internal error" });
});

app.listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port}`);
});
