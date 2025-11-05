import nodemailer from "nodemailer";
import type { SentMessageInfo, Transporter } from "nodemailer";
import { config } from "../config/env";
import { logger } from "../logging";

export type SMTPEmailPayload = {
    to: string;
    subject: string;
    text?: string;
    html?: string;
};

export class SMTPConfigError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "SMTPConfigError";
    }
}

export class SMTPSendError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "SMTPSendError";
    }
}

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
    if (!transporter) {
        const transport = config.mail.transport;
        const sharedOptions = {
            connectionTimeout: config.mail.timeouts.connection,
            greetingTimeout: config.mail.timeouts.greeting,
            ...(transport.requireTLS === undefined ? {} : { requireTLS: transport.requireTLS }),
            ...(transport.auth ? { auth: transport.auth } : {}),
        };

        if (transport.type === "url") {
            transporter = nodemailer.createTransport(transport.connectionUrl, sharedOptions);
        } else {
            transporter = nodemailer.createTransport({
                host: transport.host,
                port: transport.port,
                secure: transport.secure,
                ...sharedOptions,
            });
        }
    }

    return transporter;
};

export const verifySmtpTransporter = async (): Promise<void> => {
    try {
        await getTransporter().verify();
        const transport = config.mail.transport;
        const label = transport.type === "url"
            ? "connection-url"
            : `${transport.host}:${transport.port}`;
        logger.info({ transport: label }, "SMTP transporter verified");
    } catch (error) {
        logger.error({ err: error }, "SMTP transporter verification failed");
        throw new SMTPConfigError("Failed to verify SMTP transporter", { cause: error });
    }
};

export const sendEmailViaSmtp = async ({ to, subject, text, html }: SMTPEmailPayload): Promise<SentMessageInfo> => {
    const fromHeader = config.mail.sender.name
        ? `${config.mail.sender.name} <${config.mail.sender.address}>`
        : config.mail.sender.address;

    const mailOptions = {
        from: fromHeader,
        to,
        subject,
        text,
        html,
    } as const;

    try {
        const info = await getTransporter().sendMail(mailOptions);
        logger.info({
            messageId: info.messageId,
            envelope: info.envelope,
            accepted: info.accepted,
            rejected: info.rejected,
        }, "Email dispatched via SMTP");
        return info;
    } catch (error) {
        logger.error({
            err: error,
            to,
        }, "Failed to send email through SMTP transporter");
        throw new SMTPSendError("Failed to send email via SMTP", { cause: error });
    }
};
