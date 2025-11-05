# Email Provider Configuration

This mail service now supports two email providers: **SMTP** and **Exchange Web Services (EWS)**.

## Configuration

### Default Provider

Set the default provider using the `MAIL_PROVIDER` environment variable:

```bash
# Use SMTP as default
MAIL_PROVIDER=smtp

# Use EWS as default
MAIL_PROVIDER=ews
```

If `MAIL_PROVIDER` is not set, the service will automatically choose:
- **EWS** if Exchange configuration is present
- **SMTP** otherwise

### SMTP Configuration

Configure SMTP using one of these methods:

#### Method 1: Connection URL
```bash
SMTP_URL=smtp://user:password@smtp.example.com:587
```

#### Method 2: Individual Parameters
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

#### Gmail-specific shortcuts
```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

### Exchange Web Services (EWS) Configuration

```bash
EXCHANGE_URL=https://outlook.office365.com/EWS/Exchange.asmx
EXCHANGE_USERNAME=your-username
EXCHANGE_PASSWORD=your-password
EXCHANGE_FROM_EMAIL=your-email@company.com
```

### Common Configuration

```bash
# Required
MAIL_SERVICE_API_KEY=your-secret-api-key

# Optional
MAIL_FROM_NAME="Mail Service"
MAIL_FROM_ADDRESS=noreply@example.com  # Falls back to SMTP_USER or GMAIL_USER
```

## API Usage

### Send Email with Default Provider

```bash
curl -X POST http://localhost:3000/send-email \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email",
    "html": "<p>Hello from the mail service!</p>"
  }'
```

### Send Email via SMTP

```bash
curl -X POST http://localhost:3000/send-email \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email via SMTP",
    "html": "<p>This email is sent via SMTP</p>",
    "provider": "smtp"
  }'
```

### Send Email via EWS

```bash
curl -X POST http://localhost:3000/send-email \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email via EWS",
    "html": "<p>This email is sent via Exchange</p>",
    "provider": "ews"
  }'
```

## Programmatic Usage

```typescript
import { sendMail } from "./mail";

// Use default provider
await sendMail({
    to: "recipient@example.com",
    subject: "Test Email",
    html: "<p>Hello!</p>",
});

// Explicitly use SMTP
await sendMail({
    to: "recipient@example.com",
    subject: "Test Email via SMTP",
    html: "<p>Hello via SMTP!</p>",
    provider: "smtp",
});

// Explicitly use EWS
await sendMail({
    to: "recipient@example.com",
    subject: "Test Email via EWS",
    html: "<p>Hello via Exchange!</p>",
    provider: "ews",
});
```

## Provider-Specific Features

### SMTP
- Standard email protocol
- Works with Gmail, SendGrid, AWS SES, and most email services
- Supports both secure (TLS) and non-secure connections
- Returns message ID and delivery status

### EWS (Exchange Web Services)
- Integrates with Microsoft Exchange Server and Office 365
- Automatically prefixes subjects with `[Djazairmed]`
- Saves sent emails in the Exchange mailbox
- Sanitizes HTML for Exchange compatibility
- Uses custom sender name while preserving Exchange email address

## Troubleshooting

### SMTP Issues
- Check your SMTP credentials
- Verify the host and port are correct
- For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833)
- Check firewall/network allows outbound connections on SMTP ports

### EWS Issues
- Ensure the Exchange URL is correct (usually ends with `/EWS/Exchange.asmx`)
- Verify credentials have permission to send emails
- Check that the Exchange server is accessible from your network
- Review logs for authentication or connection errors

## Migration Notes

If you were previously using EWS-only, your existing configuration will continue to work. The service will automatically detect Exchange configuration and use EWS as the default provider.

To migrate to SMTP:
1. Add SMTP configuration to your `.env` file
2. Set `MAIL_PROVIDER=smtp` to make it the default
3. Test the configuration using the test script
4. Update any API calls that should use a specific provider
