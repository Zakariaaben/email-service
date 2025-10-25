import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config/env";
import { requestLogger } from "./middleware/request-logger";
import { registerEmailRoutes } from "./routes/email";
import type { AppBindings } from "./types/app";

export const createApp = (): Hono<AppBindings> => {
    const app = new Hono<AppBindings>();

    app.use("*", requestLogger());

    app.use(
        "/*",
        cors({
            origin: config.corsOrigins,
            allowMethods: ["GET", "POST", "OPTIONS"],
            allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
            credentials: true,
            maxAge: 60 * 60 * 24,
        }),
    );

    app.get("/healthz", (c) => c.json({ status: "ok" }));

    registerEmailRoutes(app);

    return app;
};
