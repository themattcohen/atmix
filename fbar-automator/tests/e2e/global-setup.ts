import { execSync } from "child_process"

export default function globalSetup() {
  console.log("[global-setup] Seeding database...")
  execSync("npx tsx prisma/seed.ts", {
    cwd: process.env.INIT_CWD || process.cwd(),
    stdio: "inherit",
    timeout: 30_000,
  })
  console.log("[global-setup] Seed complete.")
}
