import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "10000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = "0.0.0.0";

const server = app.listen(port, host, () => {
  logger.info({ port, host }, "Server listening");
});

// Guard against unhandled promise rejections (e.g. external network timeouts)
process.on("unhandledRejection", (reason: unknown) => {
  logger.error({ reason }, "Unhandled Promise Rejection captured — process kept alive");
});

// Guard against uncaught runtime exceptions
process.on("uncaughtException", (error: Error) => {
  logger.fatal({ err: error.message, stack: error.stack }, "Uncaught Exception occurred");
  // Graceful shutdown after letting ongoing connections complete
  server.close(() => {
    process.exit(1);
  });
});
