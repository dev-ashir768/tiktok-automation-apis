import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 5003),
  databaseUrl: req("DATABASE_URL"),
  adminEmail: req("ADMIN_EMAIL"),
  adminPassword: req("ADMIN_PASSWORD"),
  jwtSecret: req("JWT_SECRET"),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim()),
};
