import { serve } from "@hono/node-server";
import { config } from "./config/env";
import { createApp } from "./app";
import { logger } from "./logging";
import { verifyMailTransporter } from "./services/mail";

type ServerInfo = {
    address: string;
    port: number;
};

export const startServer = async (): Promise<void> => {
    await verifyMailTransporter();

    const app = createApp();

    serve({ fetch: app.fetch, port: config.port }, (info: ServerInfo) => {
        logger.info({ url: `http://localhost:${info.port}` }, "Mail service is running");
    });
};
