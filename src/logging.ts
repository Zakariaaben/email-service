import pino from "pino";
import { config } from "./config/env";

const usePrettyLogs = config.logFormat === "pretty";

export const logger = pino({
    level: config.logLevel,
    base: { service: "mail-service" },
    transport: usePrettyLogs
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
            },
        }
        : undefined,
});
