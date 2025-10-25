import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { config } from "../config/env";
import { logger } from "../logging";
import { MailSendError, sendMail } from "../services/mail";
import type { AppBindings } from "../types/app";

const mailRequestSchema = z
    .object({
        to: z.email(),
        subject: z.string().min(2).max(120),
        text: z.string().min(2).max(1000).optional(),
        html: z.string().min(2).max(5000).optional(),
    })
    .refine((payload) => payload.text || payload.html, {
        message: "Either text or html must be provided",
        path: ["text"],
    });

type MailRequest = z.infer<typeof mailRequestSchema>;

export const registerEmailRoutes = (app: Hono<AppBindings>) => {
    app.post("/send-email", zValidator("json", mailRequestSchema), async (c) => {
        const apiKey = c.req.header("x-api-key");
        const requestId = c.get("requestId");

        if (apiKey !== config.mail.apiKey) {
            logger.warn({ requestId }, "Unauthorized request");
            return c.json({ message: "Unauthorized" }, 401);
        }

        const payload = c.req.valid("json") as MailRequest;

        logger.info({ requestId, to: payload.to, subject: payload.subject }, "Email accepted for background send");

        void (async () => {
            try {
                const info = await sendMail(payload);
                logger.info({ requestId, messageId: info.messageId }, "Email sent successfully");
            } catch (error: unknown) {
                if (error instanceof MailSendError) {
                    logger.error({ requestId, err: error }, "Failed to send email");
                    return;
                }

                logger.error({ requestId, err: error }, "Unexpected error while sending email");
            }
        })();

        return c.json({ message: "Email accepted for delivery", requestId }, 202);
    });
};
