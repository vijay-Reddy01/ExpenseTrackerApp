// backend/utils/mailer.js
import nodemailer from "nodemailer";

export function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function generateSummaryText(summary) {
  return `
Your Expense Summary:

Total: ${summary.total}
Low: ${summary.lowTotal}
Moderate: ${summary.moderateTotal}
High: ${summary.highTotal}

Top Category: ${summary.topCategory?.category} — ${summary.topCategory?.amount}
`;
}

export async function sendSummaryEmail(userEmail, summary) {
  const transporter = createTransport();
  const message = generateSummaryText(summary);
  await transporter.sendMail({
    from: `"AI Expense Tracker" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: "Your Expense Summary",
    text: message,
  });
}

export async function sendMail({ to, subject, html }) {
  const transporter = createTransport();
  const info = await transporter.sendMail({
    from: `"AI Expense Tracker" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
  return info;
}
