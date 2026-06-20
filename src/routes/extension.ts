import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireApiKey } from "../auth.js";

const router = Router();
router.use(requireApiKey);

// Normalize a handle for consistent dedup matching
const norm = (h: string) => h.trim().toLowerCase().replace(/^@/, "");

// Verify API key + return user info
router.get("/me", (req, res) => {
  const user = (req as any).user;
  res.json({ id: user.id, email: user.email, name: user.name });
});

// Check which handles have already been messaged (GLOBAL — across all users)
// Returns successfully-sent handles AND failed ones separately, so the
// extension can highlight them differently (sent = skip; failed = retry).
router.post("/creators/check", async (req, res) => {
  const body = z.object({ handles: z.array(z.string()).max(500) }).parse(req.body);
  // Filter out empty / single-char garbage that can slip through from the
  // extension when a row is mid-render.
  const normalized = body.handles.map(norm).filter((h) => h.length >= 2);
  if (normalized.length === 0) {
    return res.json({ messaged: [], failed: [] });
  }

  const rows = await prisma.sentMessage.findMany({
    where: { creatorHandle: { in: normalized } },
    select: { creatorHandle: true, status: true },
  });

  const messaged = new Set<string>();
  const failed = new Set<string>();
  for (const r of rows) {
    if (r.status === "sent") messaged.add(r.creatorHandle);
    else if (r.status === "failed") failed.add(r.creatorHandle);
  }
  // A handle that has both sent and failed records is considered sent
  for (const h of messaged) failed.delete(h);

  res.json({ messaged: Array.from(messaged), failed: Array.from(failed) });
});

// Log a message attempt (sent or failed)
router.post("/messages", async (req, res) => {
  const user = (req as any).user;
  const body = z.object({
    handle: z.string().min(1),
    name: z.string().optional(),
    body: z.string().min(1),
    status: z.enum(["sent", "failed"]),
    errorMessage: z.string().optional(),
  }).parse(req.body);

  const row = await prisma.sentMessage.create({
    data: {
      userId: user.id,
      creatorHandle: norm(body.handle),
      creatorName: body.name,
      messageBody: body.body,
      status: body.status,
      errorMessage: body.errorMessage,
    },
  });

  res.json({ id: row.id, sentAt: row.sentAt });
});

export default router;
