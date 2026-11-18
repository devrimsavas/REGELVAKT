import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SequelizeStorage, Umzug } from "umzug";
import type { QueryInterface } from "sequelize";
import { sequelize } from "./sequelize.js";

// Compiled migrations live next to this file in dist/db/migrations.
const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

type MigrationModule = {
  up: (params: { context: QueryInterface }) => Promise<void>;
  down: (params: { context: QueryInterface }) => Promise<void>;
};

export const migrator = new Umzug({
  migrations: {
    glob: ["*.js", { cwd: migrationsDir }],
    // Umzug's default resolver uses require(); we load ESM modules with import().
    resolve: ({ name, path: filePath, context }) => {
      if (filePath === undefined) {
        throw new Error(`Migration ${name} has no file path`);
      }
      const load = async (): Promise<MigrationModule> =>
        (await import(pathToFileURL(filePath).href)) as MigrationModule;
      return {
        name,
        up: async () => (await load()).up({ context }),
        down: async () => (await load()).down({ context }),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

export type Migration = (params: { context: QueryInterface }) => Promise<void>;
