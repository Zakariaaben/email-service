import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { logger } from "../logging";
import type { AppBindings } from "../types/app";

export const requestLogger = (): MiddlewareHandler<AppBindings> => {
    const handler: MiddlewareHandler<AppBindings> = async (c, next) => {
        const startedAt = Date.now();
        const requestId = randomUUID();

        c.res.headers.set("x-request-id", requestId);
        c.set("requestId", requestId);

        logger.info(
            {
                requestId,
                method: c.req.method,
                path: c.req.path,
                query: c.req.query(),
            },
            "Request received",
        );

        try {
            await next();
            const duration = Date.now() - startedAt;
            logger.info(
                {
                    requestId,
                    status: c.res.status,
                    duration,
                },
                "Request completed",
            );
        } catch (error) {
            const duration = Date.now() - startedAt;
            logger.error(
                {
                    requestId,
                    duration,
                    err: error,
                },
                "Request failed",
            );
            throw error;
        }
    };

    return handler;
};
