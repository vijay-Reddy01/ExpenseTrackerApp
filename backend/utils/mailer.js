// backend/utils/mailer.js
import sgMail from "@sendgrid/mail";

export async function sendMail({ to, subject, html, text }) {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!key) throw new Error("SENDGRID_API_KEY missing in environment variables");
  if (!from) throw new Error("MAIL_FROM missing in environment variables");

  sgMail.setApiKey(key);

  const msg = {
    to,
    from,                 // must be verified in SendGrid
    subject,
    text: text || undefined,
    html: html || undefined,
  };

  const resp = await sgMail.send(msg);
  console.log("✅ SendGrid API email sent:", resp?.[0]?.statusCode);
  return resp;
}
