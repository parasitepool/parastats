#!/usr/bin/env node
import {
  startPoolStatsCollector,
  purgeOldData,
} from "../lib/pool-stats-collector";
import { startStratumCollector, stopStratumCollector } from "../lib/stratum-collector";
import { closeDb } from "../lib/db";
import cron from "node-cron";

// Global references to jobs
let statsCollectorJob = startPoolStatsCollector();
console.log("📊 Pool stats collector started");

// Start stratum collector
let stratumCollector = startStratumCollector();
console.log("⚡ Stratum collector started");

// Set up a job to purge old data daily at midnight
let purgeJob = cron.schedule("0 0 * * *", () => {
  purgeOldData(30); // Keep 30 days of data
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
  }

  if (purgeJob) {
    purgeJob.stop();
  }

  // Stop stratum collector
  if (stratumCollector) {
    stopStratumCollector();
    console.log("⚡ Stratum collector stopped");
  }

  // Close database connection
  closeDb();

  console.log("✅ Shutdown complete");
  process.exit(0);
}

console.log("🚀 All jobs initialized and running");
