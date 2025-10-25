import pino from "pino";
import { config } from "./config/env";

export const logger = pino({
    level: config.logLevel,
    base: { service: "mail-service" },
    transport: config.nodeEnv === "production"
        ? undefined
        : {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
            },
        },
});
