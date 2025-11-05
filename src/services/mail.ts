import {
    EWSConfigError,
    EWSConnectionError,
    EWSSendError,
    sendEmailViaEWS,
    type EWSEmailPayload,
} from "./ews-service";
import { config } from "../config/env";
import { logger } from "../logging";

export type SendMailInput = {
    to: string;
    subject: string;
    text?: string;
    html?: string;
};

export class MailSendError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "MailSendError";
    }
}

const DEFAULT_SUBJECT_PREFIX = "[Djazairmed]";

const logPrefix = "[mail]";

export const verifyMailTransporter = async (): Promise<void> => {
    try {
        // Verify that Exchange configuration exists
        if (!config.mail.exchange) {
            throw new Error("Exchange configuration is not set");
        }

        logger.info({
            exchangeUrl: config.mail.exchange.url,
            exchangeUser: config.mail.exchange.username
        }, "Exchange configuration verified");
    } catch (error) {
        logger.error({ err: error }, "Exchange configuration verification failed");
        throw new Error("Failed to verify Exchange configuration", { cause: error });
    }
};

export const sendMail = async ({ to, subject, text, html }: SendMailInput): Promise<void> => {
    if (!html && !text) {
        const message = "Missing email content (html/text)";
        logger.error({ to, subject }, message);
        throw new MailSendError(message);
    }

    // Prefix subject with [Djazairmed] if not already present
    const prefixedSubject = subject.startsWith(DEFAULT_SUBJECT_PREFIX)
        ? subject
        : `${DEFAULT_SUBJECT_PREFIX} ${subject}`;

    const fromName = config.mail.sender.name;

    const payload: EWSEmailPayload = {
        to,
        subject: prefixedSubject,
        fromName,
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
    };

    try {
        await sendEmailViaEWS(payload);
        logger.info({ to, subject: prefixedSubject }, "Mail dispatched via Exchange");
    } catch (error) {
        if (error instanceof EWSConfigError) {
            logger.error({
                to,
                subject,
                name: error.name,
                message: error.message,
            }, "Exchange configuration error");
        } else if (error instanceof EWSConnectionError) {
            logger.error({
                to,
                subject,
                name: error.name,
                message: error.message,
                cause: error.cause,
            }, "Exchange connection error");
        } else if (error instanceof EWSSendError) {
            logger.error({
                to,
                subject,
                name: error.name,
                message: error.message,
                cause: error.cause,
            }, "Exchange send error");
        } else {
            logger.error({
                to,
                subject,
                err: error,
            }, "Unexpected error while sending email");
        }
        throw new MailSendError("Failed to send email", { cause: error });
    }
};
