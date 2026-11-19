import type { QueryInterface } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";
import { sequelize } from "./database.js";
import { logger } from "./logger.js";

// Runs the compiled migration files in dist/migrations in name order.
// Applied migrations are recorded in the "migrations" table.
export const migrator = new Umzug({
  migrations: { glob: "dist/migrations/*.js" },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: "migrations" }),
  logger,
});

// Shape of the up and down functions in each migration file
export type Migration = (params: { context: QueryInterface }) => Promise<void>;
