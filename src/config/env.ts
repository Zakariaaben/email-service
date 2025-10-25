import { z } from "zod";

type NodeEnv = "development" | "test" | "production";
type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
type LogFormat = "json" | "pretty";

type MailAuth = {
    user: string;
    pass: string;
};

type BaseTransport = {
    requireTLS?: boolean;
    auth?: MailAuth;
};

type UrlTransport = BaseTransport & {
    type: "url";
    connectionUrl: string;
};

type SmtpTransport = BaseTransport & {
    type: "smtp";
    host: string;
    port: number;
    secure: boolean;
};

type MailTransport = UrlTransport | SmtpTransport;

type MailConfig = {
    apiKey: string;
    sender: {
        name: string;
        address: string;
    };
    transport: MailTransport;
    timeouts: {
        connection: number;
        greeting: number;
    };
};

const truthy = new Set(["1", "true", "yes", "y", "on"]);
const falsy = new Set(["0", "false", "no", "n", "off"]);

const optional = (key: string): string | undefined => {
    const value = process.env[key];
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const required = (key: string): string => {
    const value = optional(key);
    if (!value) {
        throw new Error(`Missing required environment variable ${key}`);
    }

    return value;
};

const optionalInteger = (key: string): number | undefined => {
    const raw = optional(key);
    if (!raw) {
        return undefined;
    }

    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
        throw new Error(`Expected ${key} to be an integer, received "${raw}"`);
    }

    return parsed;
};

const optionalBoolean = (key: string): boolean | undefined => {
    const raw = optional(key);
    if (!raw) {
        return undefined;
    }

    const normalized = raw.toLowerCase();
    if (truthy.has(normalized)) {
        return true;
    }

    if (falsy.has(normalized)) {
        return false;
    }

    throw new Error(`Expected ${key} to be a boolean-like value, received "${raw}"`);
};

const parseNodeEnv = (): NodeEnv => {
    const raw = optional("NODE_ENV")?.toLowerCase();
    if (!raw) {
        return "development";
    }

    if (raw === "development" || raw === "test" || raw === "production") {
        return raw;
    }

    throw new Error(`Unsupported NODE_ENV "${raw}"`);
};

const parseLogLevel = (): LogLevel => {
    const raw = optional("LOG_LEVEL")?.toLowerCase() as LogLevel | undefined;
    if (!raw) {
        return "info";
    }

    const allowed: LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace"];
    if (allowed.includes(raw)) {
        return raw;
    }

    throw new Error(`Unsupported LOG_LEVEL "${raw}"`);
};

const parseLogFormat = (nodeEnv: NodeEnv): LogFormat => {
    const raw = optional("LOG_FORMAT")?.toLowerCase() as LogFormat | undefined;
    if (!raw) {
        return nodeEnv === "production" ? "json" : "pretty";
    }

    if (raw === "json" || raw === "pretty") {
        return raw;
    }

    throw new Error(`Unsupported LOG_FORMAT "${raw}"`);
};

const parsePort = (): number => {
    const value = optionalInteger("PORT") ?? 3000;
    if (value < 1 || value > 65535) {
        throw new Error(`PORT must be between 1 and 65535, received ${value}`);
    }

    return value;
};

const parseCorsOrigins = (): string[] => {
    const raw = optional("CORS_ORIGINS");
    if (!raw) {
        return ["http://localhost:3001"];
    }

    return raw
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
};

const validateUrl = (value: string, key: string): string => {
    try {
        void new URL(value);
        return value;
    } catch (error) {
        throw new Error(`Invalid ${key} "${value}"`, { cause: error });
    }
};

const parseMailTransport = (): { transport: MailTransport; auth?: MailAuth } => {
    const smtpUrl = optional("SMTP_URL");
    const smtpHost = optional("SMTP_HOST") ?? "smtp.gmail.com";
    const smtpPort = optionalInteger("SMTP_PORT");
    const smtpSecure = optionalBoolean("SMTP_SECURE");
    const smtpRequireTLS = optionalBoolean("SMTP_REQUIRE_TLS");

    const explicitUser = optional("SMTP_USER");
    const gmailUser = optional("GMAIL_USER");
    const user = explicitUser ?? gmailUser;

    const explicitPassword = optional("SMTP_PASSWORD");
    const gmailPassword = optional("GMAIL_APP_PASSWORD");
    const password = explicitPassword ?? gmailPassword;

    if (user && !password) {
        throw new Error("SMTP_PASSWORD (or GMAIL_APP_PASSWORD) is required when SMTP_USER (or GMAIL_USER) is provided");
    }

    const auth = user && password ? { user, pass: password } : undefined;

    if (smtpUrl) {
        return {
            transport: {
                type: "url",
                connectionUrl: validateUrl(smtpUrl, "SMTP_URL"),
                requireTLS: smtpRequireTLS,
                auth,
            },
            auth,
        };
    }

    const port = smtpPort ?? (smtpSecure === true ? 465 : 587);
    const secure = smtpSecure ?? port === 465;
    const requireTLS = smtpRequireTLS ?? !secure;

    return {
        transport: {
            type: "smtp",
            host: smtpHost,
            port,
            secure,
            requireTLS,
            auth,
        },
        auth,
    };
};

const parseSender = (auth?: MailAuth): MailConfig["sender"] => {
    const address = optional("MAIL_FROM_ADDRESS") ?? auth?.user;
    if (!address) {
        throw new Error("Provide MAIL_FROM_ADDRESS or SMTP_USER/GMAIL_USER to define the sender address");
    }

    z.string().email().parse(address);

    return {
        name: optional("MAIL_FROM_NAME") ?? "Mail Service",
        address,
    };
};

const { transport: mailTransport, auth: mailAuth } = parseMailTransport();

const mailConfig: MailConfig = {
    apiKey: required("MAIL_SERVICE_API_KEY"),
    sender: parseSender(mailAuth),
    transport: mailTransport,
    timeouts: {
        connection: 10_000,
        greeting: 10_000,
    },
};

const nodeEnv = parseNodeEnv();

export const config = {
    nodeEnv,
    port: parsePort(),
    logLevel: parseLogLevel(),
    logFormat: parseLogFormat(nodeEnv),
    corsOrigins: parseCorsOrigins(),
    mail: mailConfig,
} as const;

export type AppConfig = typeof config;
export type { MailTransport, MailAuth, LogFormat };
