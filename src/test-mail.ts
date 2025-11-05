import { sendMail } from "./mail";

// Test with default provider (configured via MAIL_PROVIDER env var or auto-detected)
console.log("Sending test email with default provider...");
// await sendMail({
//     to: "nz_benhamiche@esi.dz",
//     subject: "Test mail from mail service",
//     text: "This is a test email sent from the mail service.",
//     html: "<p>This is a test email sent from the <strong>mail service</strong>.</p>",
// });

console.log("Email sent successfully with default provider!");

// Uncomment to test SMTP explicitly:
// console.log("\nSending test email via SMTP...");
await sendMail({
    to: "nz_benhamiche@esi.dz",
    subject: "Test mail via SMTP",
    text: "This is a test email sent via SMTP.",
    html: "<p>This is a test email sent via <strong>SMTP</strong>.</p>",
    provider: "smtp",
});

// Uncomment to test EWS explicitly:
// console.log("\nSending test email via EWS...");
// await sendMail({
//     to: "nz_benhamiche@esi.dz",
//     subject: "Test mail via EWS",
//     text: "This is a test email sent via EWS.",
//     html: "<p>This is a test email sent via <strong>Exchange Web Services</strong>.</p>",
//     provider: "ews",
// });
