// Command line tool: npm run migrate -- up | down | pending | executed
import "reflect-metadata";
import "dotenv/config";
import { migrator } from "./config/migrator.js";
import { sequelize } from "./config/database.js";

try {
  await migrator.runAsCLI();
} finally {
  await sequelize.close();
}
