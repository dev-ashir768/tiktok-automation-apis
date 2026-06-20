import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireAdmin, signAdminToken } from "../auth.js";

const router = Router();

// Login — public
router.post("/login", (req, res) => {
  const { email, password } = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }).parse(req.body);

  if (email !== env.adminEmail || password !== env.adminPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ token: signAdminToken(), email });
});

// Everything below requires admin JWT
router.use(requireAdmin);

router.get("/me", (_req, res) => {
  res.json({ email: env.adminEmail });
});

// ---- Users ----

router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  res.json(users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    apiKey: u.apiKey,
    isActive: u.isActive,
    createdAt: u.createdAt,
    messageCount: u._count.messages,
  })));
});

router.post("/users", async (req, res) => {
  const body = z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }).parse(req.body);

  const apiKey = `ttp_${nanoid(32)}`;

  const user = await prisma.user.create({
    data: { email: body.email, name: body.name, apiKey },
  });
  res.json(user);
});

router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = z.object({
    isActive: z.boolean().optional(),
    name: z.string().optional(),
  }).parse(req.body);

  const user = await prisma.user.update({ where: { id }, data: body });
  res.json(user);
});

router.post("/users/:id/regenerate-key", async (req, res) => {
  const id = Number(req.params.id);
  const apiKey = `ttp_${nanoid(32)}`;
  const user = await prisma.user.update({ where: { id }, data: { apiKey } });
  res.json(user);
});

router.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
});

// ---- Messages ----

router.get("/messages", async (req, res) => {
  const q = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
    userId: z.coerce.number().int().optional(),
    status: z.enum(["sent", "failed"]).optional(),
    handle: z.string().optional(),
  }).parse(req.query);

  const where = {
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.handle ? { creatorHandle: { contains: q.handle.toLowerCase() } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.sentMessage.count({ where }),
    prisma.sentMessage.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { user: { select: { email: true, name: true } } },
    }),
  ]);

  res.json({ total, page: q.page, pageSize: q.pageSize, rows });
});

// ---- Stats ----

router.get("/stats", async (_req, res) => {
  const [users, sent, failed, uniqueCreators, recent] = await Promise.all([
    prisma.user.count(),
    prisma.sentMessage.count({ where: { status: "sent" } }),
    prisma.sentMessage.count({ where: { status: "failed" } }),
    prisma.sentMessage.findMany({
      where: { status: "sent" },
      select: { creatorHandle: true },
      distinct: ["creatorHandle"],
    }),
    prisma.sentMessage.findMany({
      orderBy: { sentAt: "desc" },
      take: 10,
      include: { user: { select: { email: true } } },
    }),
  ]);
  res.json({
    users,
    messagesSent: sent,
    messagesFailed: failed,
    uniqueCreatorsMessaged: uniqueCreators.length,
    recent,
  });
});

export default router;
