import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT;

const server = async () => {
  try {
    // Database connection will be awaited here before listening.
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
