import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";
import { prisma } from "./db.js";

// Extension API-key auth: header `X-API-Key: <key>`
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-api-key");
  if (!key) return res.status(401).json({ error: "Missing X-API-Key header" });

  const user = await prisma.user.findUnique({ where: { apiKey: key } });
  if (!user) return res.status(401).json({ error: "Invalid API key" });
  if (!user.isActive) return res.status(403).json({ error: "Account is disabled" });

  (req as any).user = user;
  next();
}

// Admin JWT auth: header `Authorization: Bearer <token>`
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing Bearer token" });

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    if (payload.sub !== env.adminEmail) return res.status(403).json({ error: "Not admin" });
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function signAdminToken(): string {
  return jwt.sign({ sub: env.adminEmail }, env.jwtSecret, { expiresIn: "30d" });
}
