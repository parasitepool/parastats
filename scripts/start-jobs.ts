#!/usr/bin/env node
import 'dotenv/config';
import { validateEnv } from "../app/lib/env-validation";
import {
  startPoolStatsCollector,
  purgeOldData,
} from "../lib/pool-stats-collector";
import { startStratumCollector, stopStratumCollector } from "../lib/stratum-collector";
import { startHighestDiffCollector, stopHighestDiffCollector } from "../lib/highest-diff-collector";
import { closeDb } from "../lib/db";
import cron from "node-cron";

// Validate environment variables before starting
validateEnv();

// Global references to jobs
let statsCollectorJob = startPoolStatsCollector();
console.log("📊 Pool stats collector started");

// Log auto-discovery status
const autoDiscoverEnabled = process.env.AUTO_DISCOVER_USERS !== 'false';
if (autoDiscoverEnabled) {
  console.log("👥 User auto-discovery enabled (runs with stats collection; set AUTO_DISCOVER_USERS=false to disable)");
} else {
  console.log("👥 User auto-discovery disabled (set AUTO_DISCOVER_USERS=true to enable)");
}

// Start stratum collector
let stratumCollector = startStratumCollector();
console.log("⚡ Stratum collector started");

// Start highest diff collector (backfills on startup, periodic collection every 10 min)
let highestDiffCollectorJob = startHighestDiffCollector();
console.log("🏆 Highest diff collector started");

// Set up a job to purge old data daily at midnight
let purgeJob = cron.schedule("0 0 * * *", () => {
  purgeOldData(365); // Keep 365 days of data
  console.log("🧹 Purged old pool stats data");
});

// Handle graceful shutdown
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function shutdown() {
  console.log("🛑 Shutting down jobs...");

  // Stop cron jobs
  if (statsCollectorJob) {
    statsCollectorJob.poolJob.stop();
    statsCollectorJob.userJob.stop();
    statsCollectorJob.accountJob.stop();
  }

  if (purgeJob) {
    purgeJob.stop();
  }

  // Stop stratum collector
  if (stratumCollector) {
    stopStratumCollector();
    console.log("⚡ Stratum collector stopped");
  }

  // Stop highest diff collector
  if (highestDiffCollectorJob) {
    highestDiffCollectorJob.job.stop();
    stopHighestDiffCollector();
    console.log("🏆 Highest diff collector stopped");
  }

  // Close database connection
  closeDb();

  console.log("✅ Shutdown complete");
  process.exit(0);
}

console.log("🚀 All jobs initialized and running");
