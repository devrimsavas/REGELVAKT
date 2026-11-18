// Runs once before all tests: brings the test database schema up to date.
// Migrations are read from dist/, so the project is compiled first (npm run pretest).
import { config } from "dotenv";

export default async function setup() {
  // Locally the settings come from .env.test; in CI from the workflow
  config({ path: ".env.test", quiet: true });

  // Never run tests against a database that is not meant for tests
  if (!process.env.DB_NAME?.endsWith("_test")) {
    throw new Error(
      `Tests must use a database whose name ends with _test (got: ${process.env.DB_NAME})`,
    );
  }

  const { sequelize } = await import("../../src/config/database.js");
  const { migrator } = await import("../../src/config/migrator.js");
  await migrator.up();
  await sequelize.close();
}
