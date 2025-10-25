import "dotenv/config";
import { startServer } from "./server";
import { logger } from "./logging";

startServer().catch((error) => {
    logger.fatal({ err: error }, "Failed to start mail service");
    process.exit(1);
});
