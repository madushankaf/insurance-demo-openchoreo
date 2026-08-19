import Fastify from "fastify";
import cron from "node-cron";
import { runRenewalScan } from "./renewal.js";

const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? "0 6 * * *";
const TIMEZONE = process.env.TIMEZONE ?? "America/Detroit";
const RUN_ONCE = (process.env.RUN_ONCE ?? "true").toLowerCase() === "true";
const PORT = Number(process.env.PORT ?? 8083);

async function scanAndLog(): Promise<void> {
  try {
    const summary = await runRenewalScan();
    console.log("renewal scan complete", JSON.stringify(summary));
  } catch (err) {
    console.error("renewal scan failed", err);
    throw err;
  }
}

async function main(): Promise<void> {
  if (RUN_ONCE) {
    // Scheduled-task / one-shot mode: scan once then exit.
    try {
      await scanAndLog();
      process.exit(0);
    } catch {
      process.exit(1);
    }
    return;
  }

  // Long-running mode: expose health and run on a cron schedule.
  const app = Fastify({ logger: false });
  app.get("/healthz", async () => ({ status: "ok" }));
  app.post("/run", async () => runRenewalScan());

  await app.listen({ host: "0.0.0.0", port: PORT });
  console.log(`renewal-job listening on :${PORT}`);

  if (!cron.validate(CRON_SCHEDULE)) {
    throw new Error(`invalid CRON_SCHEDULE: ${CRON_SCHEDULE}`);
  }
  cron.schedule(CRON_SCHEDULE, scanAndLog, { timezone: TIMEZONE });
  console.log(`scheduled renewal scan '${CRON_SCHEDULE}' (${TIMEZONE})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
