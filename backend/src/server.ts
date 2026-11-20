import "reflect-metadata";
import "dotenv/config";
import type { Server } from "node:http";
import app from "./app.js";
import { sequelize } from "./config/database.js";
import { logger } from "./config/logger.js";
import { migrator } from "./config/migrator.js";
import { startKnowledgeJob, stopKnowledgeJob } from "./jobs/knowledgeJob.js";
import { startReminderJob, stopReminderJob } from "./jobs/reminderJob.js";
import { subscriptionSecret } from "./utils/tokens.js";

const PORT = process.env.PORT;

// How long a shutdown may take before the process is stopped anyway
const SHUTDOWN_TIMEOUT_MS = 30_000;

let httpServer: Server | null = null;
let shuttingDown = false;

// On Ctrl+C (SIGINT) or a stop from Docker or the operating system
// (SIGTERM): stop taking requests, let the ones in progress, a reminder
// run and a knowledge base update that are going on finish, then close the database connections
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);

  const timeout = setTimeout(() => {
    logger.error("Shutdown took too long; stopping now");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timeout.unref();

  try {
    const closed = new Promise<void>((resolve, reject) => {
      if (!httpServer) return resolve();
      httpServer.close((error) => (error ? reject(error) : resolve()));
      // Idle keep-alive connections would otherwise hold close() open
      httpServer.closeIdleConnections();
    });
    await Promise.all([closed, stopReminderJob(), stopKnowledgeJob()]);
    await sequelize.close();
    logger.info("Shut down");
    process.exit(0);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error while shutting down");
    process.exit(1);
  }
}

const server = async () => {
  try {
    // Settings that are only read later, checked now so a mistake stops
    // the server at once instead of the first time a reminder is asked for
    subscriptionSecret();

    await sequelize.authenticate();
    logger.info("Database connection established");

    await migrator.up();

    httpServer = app.listen(PORT, (error) => {
      if (error) {
        logger.fatal({ err: error }, "Server failed to start");
        process.exit(1);
      }
      logger.info(`Listening on port ${PORT}`);

      // Background work
      startReminderJob();
      // KNOWLEDGE_UPDATES=off: the official pages are not read on their own
      // (CI starts the app often and should not fetch them every time)
      if (process.env.KNOWLEDGE_UPDATES === "off") {
        logger.info("Knowledge base updates are off (KNOWLEDGE_UPDATES=off)");
      } else {
        startKnowledgeJob();
      }
    });

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error: unknown) {
    logger.fatal({ err: error }, "Startup error");
    process.exit(1);
  }
};

server();
