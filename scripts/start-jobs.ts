#!/usr/bin/env node
import 'dotenv/config';
import { validateEnv } from "../app/lib/env-validation";
import {
  startPoolStatsCollector,
  purgeOldData,
} from "../lib/pool-stats-collector";
import { startStratumCollector, stopStratumCollector } from "../lib/stratum-collector";
import { closeDb } from "../lib/db";
import { shutdownHttpClient, getActiveRequestCount } from "../lib/http-client";
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

// Set up a job to purge old data daily at midnight
let purgeJob = cron.schedule("0 0 * * *", () => {
  purgeOldData(365); // Keep 365 days of data
  console.log("🧹 Purged old pool stats data");
});

// Handle unhandled promise rejections to prevent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️  Unhandled Promise Rejection:", reason);
  
  // Log ClientDestroyedError specifically but don't crash
  if (reason instanceof Error && 'code' in reason && reason.code === 'UND_ERR_DESTROYED') {
    console.warn("ClientDestroyedError caught - HTTP client was destroyed during request");
    // Don't exit - the retry logic in http-client should handle this
  } else {
    // For other unhandled rejections, log but continue running
    console.error("Promise:", promise);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("⚠️  Uncaught Exception:", error);
  
  // For ClientDestroyedError, just log and continue
  if ('code' in error && error.code === 'UND_ERR_DESTROYED') {
    console.warn("ClientDestroyedError caught at process level");
    return;
  }
  
  // For other errors, initiate shutdown
  console.error("Fatal error - initiating shutdown");
  shutdown();
});

// Handle graceful shutdown
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    console.log("Shutdown already in progress...");
    return;
  }
  
  isShuttingDown = true;
  console.log("🛑 Shutting down jobs...");

  // Stop cron jobs first to prevent new requests
  if (statsCollectorJob) {
    statsCollectorJob.poolJob.stop();
    statsCollectorJob.userJob.stop();
    console.log("⏸️  Stopped cron jobs");
  }

  if (purgeJob) {
    purgeJob.stop();
  }

  // Stop stratum collector
  if (stratumCollector) {
    stopStratumCollector();
    console.log("⚡ Stratum collector stopped");
  }

  // Wait for active HTTP requests to complete (with 5 second timeout)
  const activeCount = getActiveRequestCount();
  if (activeCount > 0) {
    console.log(`⏳ Waiting for ${activeCount} active HTTP request(s) to complete...`);
  }
  
  try {
    await shutdownHttpClient(5000);
  } catch (error) {
    console.error("Error during HTTP client shutdown:", error);
  }

  // Close database connection
  closeDb();

  console.log("✅ Shutdown complete");
  process.exit(0);
}

console.log("🚀 All jobs initialized and running");
