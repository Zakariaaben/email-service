import {
    EWSConfigError,
    EWSConnectionError,
    EWSSendError,
    sendEmailViaEWS,
    type EWSEmailPayload,
} from "./ews-service";
import {
    SMTPConfigError,
    SMTPSendError,
    sendEmailViaSmtp,
    verifySmtpTransporter,
    type SMTPEmailPayload,
} from "./smtp-service";
import { config } from "../config/env";
import type { MailProvider } from "../config/env";
import { logger } from "../logging";

export type SendMailInput = {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    provider?: MailProvider;
};

export class MailSendError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "MailSendError";
    }
}

const logPrefix = "[mail]";

export const verifyMailTransporter = async (): Promise<void> => {
    const errors: Error[] = [];

    // Verify SMTP if configured
    try {
        await verifySmtpTransporter();
    } catch (error) {
        if (error instanceof Error) {
            errors.push(error);
        }
    }

    // Verify Exchange if configured
    try {
        if (!config.mail.exchange) {
            logger.info("Exchange configuration not set, skipping EWS verification");
        } else {
            logger.info({
                exchangeUrl: config.mail.exchange.url,
                exchangeUser: config.mail.exchange.username
            }, "Exchange configuration verified");
        }
    } catch (error) {
        if (error instanceof Error) {
            errors.push(error);
        }
    }

    // If default provider fails verification, throw error
    if (config.mail.defaultProvider === "smtp" && errors.some(e => e instanceof SMTPConfigError)) {
        logger.error("Default provider (SMTP) failed verification");
        throw errors.find(e => e instanceof SMTPConfigError);
    }

    if (config.mail.defaultProvider === "ews" && !config.mail.exchange) {
        const error = new Error("Default provider is EWS but Exchange configuration is missing");
        logger.error({ err: error }, "Exchange configuration verification failed");
        throw error;
    }

    logger.info({ defaultProvider: config.mail.defaultProvider }, "Mail service configured");
};

export const sendMail = async ({ to, subject, text, html, provider }: SendMailInput): Promise<void> => {
    if (!html && !text) {
        const message = "Missing email content (html/text)";
        logger.error({ to, subject }, message);
        throw new MailSendError(message);
    }

    // Use provided provider or fall back to default
    const selectedProvider = provider ?? config.mail.defaultProvider;

    logger.info({ to, subject, provider: selectedProvider }, "Sending email");

    if (selectedProvider === "smtp") {
        try {
            const payload: SMTPEmailPayload = { to, subject, text, html };
            await sendEmailViaSmtp(payload);
            logger.info({ to, subject }, "Mail dispatched via SMTP");
        } catch (error) {
            if (error instanceof SMTPSendError || error instanceof SMTPConfigError) {
                logger.error({
                    to,
                    subject,
                    name: error.name,
                    message: error.message,
                    cause: error.cause,
                }, "SMTP error");
            } else {
                logger.error({
                    to,
                    subject,
                    err: error,
                }, "Unexpected error while sending email via SMTP");
            }
            throw new MailSendError("Failed to send email via SMTP", { cause: error });
        }
    } else if (selectedProvider === "ews") {
        // Verify Exchange configuration exists
        if (!config.mail.exchange) {
            const message = "Exchange configuration is not set";
            logger.error({ to, subject }, message);
            throw new MailSendError(message);
        }

        // Prefix subject with [Djazairmed] if not already present
        const DEFAULT_SUBJECT_PREFIX = "[Djazairmed]";
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
                }, "Unexpected error while sending email via Exchange");
            }
            throw new MailSendError("Failed to send email via Exchange", { cause: error });
        }
    } else {
        throw new MailSendError(`Unsupported provider: ${selectedProvider}`);
    }
};


