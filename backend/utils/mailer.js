// backend/utils/mailer.js
import nodemailer from "nodemailer";

export function createTransport() {
  const { SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("Missing SMTP_USER or SMTP_PASS in environment variables");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
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

  // ✅ This will print exact SMTP issues in Render logs
  await transporter.verify();

  const message = generateSummaryText(summary);

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || `"AI Expense Tracker" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: "Your Expense Summary",
    text: message,
  });

  console.log("✅ Summary email sent:", info.messageId);
  return info;
}

export async function sendMail({ to, subject, html }) {
  const transporter = createTransport();

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });

  console.log("✅ Mail sent:", info.messageId);
  return info;
}

