/**
 * Email Service Client
 * 
 * Copy this file to your project to interact with the email service.
 * 
 * Usage:
 * ```typescript
 * const emailClient = new EmailServiceClient({
 *   baseUrl: 'http://localhost:3000',
 *   apiKey: 'your-api-key-here'
 * });
 * 
 * // Send email via SMTP (text)
 * await emailClient.sendEmail({
 *   to: 'recipient@example.com',
 *   subject: 'Hello',
 *   text: 'This is a test email',
 *   provider: 'smtp' // optional, uses default provider if not specified
 * });
 * 
 * // Send email via EWS (HTML)
 * await emailClient.sendEmail({
 *   to: 'recipient@company.com',
 *   subject: 'Hello from Exchange',
 *   html: '<h1>This is a test email</h1>',
 *   provider: 'ews'
 * });
 * 
 * // Send with both text and HTML
 * await emailClient.sendEmail({
 *   to: 'recipient@example.com',
 *   subject: 'Multi-format email',
 *   text: 'Plain text version',
 *   html: '<p>HTML version</p>'
 * });
 * ```
 */

export type EmailProvider = 'smtp' | 'ews';

export interface EmailServiceConfig {
    baseUrl: string;
    apiKey: string;
}

export interface SendEmailRequest {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    provider?: EmailProvider;
}export interface SendEmailResponse {
    message: string;
    requestId: string;
}

export interface ErrorResponse {
    error?: string;
    message?: string;
}

export class EmailServiceClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(config: EmailServiceConfig) {
        // Remove trailing slash if present
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.apiKey = config.apiKey;
    }

    /**
     * Send an email using the email service
     * @param request Email request parameters
     * @returns Response with message and request ID
     * @throws Error if the request fails or validation errors occur
     */
    async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
        // Validate that either text or html is provided
        if (!request.text && !request.html) {
            throw new Error('Either text or html must be provided');
        }

        try {
            const response = await fetch(`${this.baseUrl}/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as ErrorResponse;

                if (response.status === 401) {
                    throw new Error('Unauthorized: Invalid API key');
                }

                throw new Error(
                    errorData.error || errorData.message || `HTTP error! status: ${response.status}`
                );
            }

            const data = await response.json() as SendEmailResponse;
            return data;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to send email: Unknown error');
        }
    }

    /**
     * Send a plain text email via SMTP (convenience method)
     */
    async sendTextViaSMTP(params: { to: string; subject: string; text: string }): Promise<SendEmailResponse> {
        return this.sendEmail({ ...params, provider: 'smtp' });
    }

    /**
     * Send an HTML email via SMTP (convenience method)
     */
    async sendHtmlViaSMTP(params: { to: string; subject: string; html: string }): Promise<SendEmailResponse> {
        return this.sendEmail({ ...params, provider: 'smtp' });
    }

    /**
     * Send a plain text email via EWS/Exchange (convenience method)
     */
    async sendTextViaEWS(params: { to: string; subject: string; text: string }): Promise<SendEmailResponse> {
        return this.sendEmail({ ...params, provider: 'ews' });
    }

    /**
     * Send an HTML email via EWS/Exchange (convenience method)
     */
    async sendHtmlViaEWS(params: { to: string; subject: string; html: string }): Promise<SendEmailResponse> {
        return this.sendEmail({ ...params, provider: 'ews' });
    }

    /**
     * Check if the email service is reachable
     * Note: This does not validate the API key
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
}

// For CommonJS environments
// module.exports = { EmailServiceClient };
