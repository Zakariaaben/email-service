import https from "https";
import {
    ExchangeService,
    ExchangeVersion,
    WebCredentials,
    EmailMessage,
    MessageBody,
    BodyType,
    Uri,
    EmailAddress,
    ConfigurationApi,
} from "ews-javascript-api";
import { XhrApi } from "@ewsjs/xhr";
import * as cheerio from "cheerio";
import { config } from "../config/env";

const logPrefix = "[ews-service]";

// Configure l'agent HTTPS pour EWS
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    minVersion: "TLSv1.2",
    keepAlive: true,
});

const xhrApi = new XhrApi({ httpsAgent });
ConfigurationApi.ConfigureXHR(xhrApi);

export type EWSEmailPayload = {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    fromName?: string;
};

export class EWSConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EWSConfigError";
    }
}

export class EWSConnectionError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "EWSConnectionError";
    }
}

export class EWSSendError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "EWSSendError";
    }
}

/**
 * Résout et valide la configuration EWS depuis les variables d'environnement
 */
const resolveConfig = () => {
    const exchangeUrl = config.mail.exchange?.url;
    const exchangeUsername = config.mail.exchange?.username;
    const exchangePassword = config.mail.exchange?.password;
    const exchangeFromEmail = config.mail.exchange?.fromEmail;

    if (!exchangeUrl) {
        throw new EWSConfigError("EXCHANGE_URL is not set");
    }

    if (!exchangeUsername) {
        throw new EWSConfigError("EXCHANGE_USERNAME is not set");
    }

    if (!exchangePassword) {
        throw new EWSConfigError("EXCHANGE_PASSWORD is not set");
    }

    if (!exchangeFromEmail) {
        throw new EWSConfigError("EXCHANGE_FROM_EMAIL is not set");
    }

    return { exchangeUrl, exchangeUsername, exchangePassword, exchangeFromEmail } as const;
};

/**
 * Nettoie le HTML pour le rendre compatible avec EWS
 * EWS n'accepte pas les balises DOCTYPE et préfère le HTML sans balises racines
 */
const sanitizeHtmlForEWS = (html: string): string => {
    const $ = cheerio.load(html);

    // Extrait les styles du head
    const styles = $("head style").html() || "";

    // Extrait le contenu du body (ou tout si pas de body)
    const bodyContent = $("body").html() || $.html();

    // Reconstruit le HTML sans DOCTYPE ni balises racines
    // Ajoute les styles en inline au début si présents
    if (styles) {
        return `<style>${styles}</style>\n${bodyContent}`;
    }

    return bodyContent;
};

/**
 * Crée et configure une instance du service Exchange
 */
const createExchangeService = (config: ReturnType<typeof resolveConfig>): ExchangeService => {
    try {
        const service = new ExchangeService(ExchangeVersion.Exchange2016);

        // Configure les credentials
        service.Credentials = new WebCredentials(config.exchangeUsername, config.exchangePassword);

        // Configure l'URL du serveur Exchange
        service.Url = new Uri(config.exchangeUrl);

        return service;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new EWSConfigError(`Failed to create Exchange service: ${message}`);
    }
};

/**
 * Envoie un email via Exchange Web Services
 */
export async function sendEmailViaEWS(payload: EWSEmailPayload): Promise<void> {
    const { to, subject, text, html, fromName } = payload;

    // Valide la configuration
    const config = resolveConfig();

    // Crée le service Exchange
    let service: ExchangeService;
    try {
        service = createExchangeService(config);
    } catch (error) {
        console.error(`${logPrefix} Failed to initialize Exchange service`, {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }

    // Crée et configure le message
    let message: EmailMessage;
    try {
        message = new EmailMessage(service);

        // Configure l'expéditeur avec l'adresse email Exchange
        // Important: créer une nouvelle instance EmailAddress au lieu de modifier message.From directement
        message.From = new EmailAddress(fromName || "DjazairMed", config.exchangeFromEmail);

        // Destinataire
        message.ToRecipients.Add(to);

        // Sujet
        message.Subject = subject;

        // Corps du message (HTML prioritaire sur texte)
        if (html) {
            // Nettoie le HTML pour le rendre compatible avec EWS
            const sanitizedHtml = sanitizeHtmlForEWS(html);
            message.Body = new MessageBody(BodyType.HTML, sanitizedHtml);
        } else if (text) {
            message.Body = new MessageBody(BodyType.Text, text);
        } else {
            throw new EWSSendError("Email must have either text or html content");
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${logPrefix} Failed to create email message`, {
            to,
            subject,
            error: message,
        });
        throw new EWSSendError(`Failed to create email message: ${message}`, error);
    }

    // Envoie le message
    try {
        await message.SendAndSaveCopy();
        console.info(`${logPrefix} Email sent successfully`, {
            to,
            subject,
            hasHtml: !!html,
            hasText: !!text,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`${logPrefix} Failed to send email`, {
            to,
            subject,
            error: errorMessage,
        });

        // Analyse le type d'erreur
        if (errorMessage.includes("authentication") || errorMessage.includes("credentials")) {
            throw new EWSConnectionError(
                "Authentication failed. Please check Exchange credentials.",
                error
            );
        } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
            throw new EWSConnectionError(
                "Connection timeout. Please check Exchange server URL.",
                error
            );
        } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("ECONNREFUSED")) {
            throw new EWSConnectionError(
                "Cannot reach Exchange server. Please check the URL and network connectivity.",
                error
            );
        } else {
            throw new EWSSendError(`Failed to send email: ${errorMessage}`, error);
        }
    }
}
