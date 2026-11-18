import "reflect-metadata";
import "dotenv/config";
import app from "./app.js";
import { sequelize } from "./config/database.js";
import { migrator } from "./config/migrator.js";

const PORT = process.env.PORT;

const server = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established");

    await migrator.up();

    app.listen(PORT, (error) => {
      if (error) {
        console.error(`Server failed to start: ${error.message}`);
        process.exit(1);
      }
      console.log(`listening at ${PORT}`);
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Startup error: ${message}`);
    process.exit(1);
  }
};

server();
