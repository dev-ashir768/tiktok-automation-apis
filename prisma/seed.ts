import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const users = [
    { email: "admin@tiksly.com", name: "User One" }];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`  skip  ${u.email} (already exists)`);
      continue;
    }
    const apiKey = `ttp_${nanoid(32)}`;
    const user = await prisma.user.create({ data: { ...u, apiKey } });
    console.log(`  created ${user.email}  key=${user.apiKey}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
