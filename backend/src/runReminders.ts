// Runs the daily reminder work once, now, whatever the time:
//   npm run reminders
// For development and for running it by hand on a server. The server runs
// it every day by itself (jobs/reminderJob.ts).
import "reflect-metadata";
import "dotenv/config";
import { sequelize } from "./config/database.js";
import { logger } from "./config/logger.js";
import { runReminders } from "./services/reminderService.js";
import { subscriptionSecret } from "./utils/tokens.js";

try {
  subscriptionSecret();
  await sequelize.authenticate();
  // runReminders logs its own summary
  await runReminders();
} catch (error: unknown) {
  logger.fatal({ err: error }, "The reminder run failed");
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
