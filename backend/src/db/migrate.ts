// CLI entry point: npm run migrate -- up | down | pending | executed
import "reflect-metadata";
import "dotenv/config";
import { migrator } from "./migrator.js";
import { sequelize } from "./sequelize.js";

try {
  await migrator.runAsCLI();
} finally {
  await sequelize.close();
}
