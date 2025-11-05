import { sendMail } from "./mail";

await sendMail({
    to: "nz_benhamiche@esi.dz",
    subject: "Test mail from mail service",
    text: "This is a test email sent from the mail service.",
    html: "<p>This is a test email sent from the <strong>mail service</strong>.</p>",
});