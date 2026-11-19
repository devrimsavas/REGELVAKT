import "reflect-metadata";
import "dotenv/config";
import app from "./app.js";
import { sequelize } from "./config/database.js";
import { logger } from "./config/logger.js";
import { migrator } from "./config/migrator.js";
import { startReminderJob } from "./jobs/reminderJob.js";
import { subscriptionSecret } from "./utils/tokens.js";

const PORT = process.env.PORT;

const server = async () => {
  try {
    // Settings that are only read later, checked now so a mistake stops
    // the server at once instead of the first time a reminder is asked for
    subscriptionSecret();

    await sequelize.authenticate();
    logger.info("Database connection established");

    await migrator.up();

    app.listen(PORT, (error) => {
      if (error) {
        logger.fatal({ err: error }, "Server failed to start");
        process.exit(1);
      }
      logger.info(`Listening on port ${PORT}`);

      // Background work
      startReminderJob();
    });
  } catch (error: unknown) {
    logger.fatal({ err: error }, "Startup error");
    process.exit(1);
  }
};

server();
