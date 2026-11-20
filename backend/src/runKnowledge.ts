// Reads the official pages into the assistant's knowledge base now:
//   npm run knowledge
// The server also does this by itself once a week (jobs/knowledgeJob.ts).
import "reflect-metadata";
import "dotenv/config";
import { sequelize } from "./config/database.js";
import { logger } from "./config/logger.js";
import { crawl } from "./knowledge/crawler.js";

try {
  await sequelize.authenticate();
  // crawl() logs its own summary
  await crawl();
} catch (error: unknown) {
  logger.fatal({ err: error }, "The knowledge base update failed");
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
