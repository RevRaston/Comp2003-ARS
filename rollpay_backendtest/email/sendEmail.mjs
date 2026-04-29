// email/sendEmail.mjs
import nodemailer from "nodemailer";

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    console.warn("SMTP_HOST missing. Email will not send.");
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendDemoEmail({ to, subject, text = "", html = "" }) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log("📧 EMAIL SKIPPED - SMTP not configured", { to, subject });
    return { skipped: true };
  }

  if (!to) {
    console.log("📧 EMAIL SKIPPED - missing recipient", { subject });
    return { skipped: true };
  }

  const result = await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  console.log("✅ REAL EMAIL SENT", {
    to,
    subject,
    messageId: result.messageId,
  });

  return { sent: true, messageId: result.messageId };
}

export function buildCreditReceiptEmail({
  displayName,
  creditsPurchased,
  newBalance,
  cardBrand,
  cardLast4,
}) {
  return {
    subject: "RollPay credits purchase receipt",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>RollPay Credits Receipt</h2>
        <p>Hi ${displayName || "Player"},</p>
        <p>You purchased <strong>${creditsPurchased} credits</strong>.</p>
        <p>Demo card: <strong>${cardBrand || "DemoCard"} •••• ${cardLast4 || "0000"}</strong></p>
        <p>New balance: <strong>${newBalance} credits</strong></p>
      </div>
    `,
  };
}