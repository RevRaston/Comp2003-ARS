// email.mjs
import nodemailer from "nodemailer";
import QRCode from "qrcode";

const EMAIL_FROM = process.env.EMAIL_FROM || "RollPay Demo <no-reply@rollpay.demo>";

function makeTransporter() {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
}

export async function buildQrDataUrl(payload) {
  return QRCode.toDataURL(JSON.stringify(payload, null, 2), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
}

export async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    console.log("[email] skipped: no recipient");
    return { skipped: true, reason: "No recipient" };
  }

  const transporter = makeTransporter();

  if (!transporter) {
    console.log("[email] SMTP not configured. Email preview:");
    console.log({ to, subject, text });
    return { skipped: true, reason: "SMTP not configured" };
  }

  const result = await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  return { ok: true, messageId: result.messageId };
}

export async function sendCreditPurchaseReceipt({
  to,
  displayName,
  creditsPurchased,
  newBalance,
  cardBrand,
  cardLast4,
  purchaseId,
}) {
  const qrPayload = {
    type: "credit_purchase_receipt",
    purchaseId,
    displayName,
    creditsPurchased,
    newBalance,
    card: cardBrand && cardLast4 ? `${cardBrand} **** ${cardLast4}` : "Demo card",
    generatedAt: new Date().toISOString(),
  };

  const qrDataUrl = await buildQrDataUrl(qrPayload);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#151515;">
      <h1>RollPay Credit Purchase Receipt</h1>
      <p>Hi ${displayName || "Player"},</p>
      <p>Your demo credit purchase has been processed.</p>

      <div style="padding:16px;border:1px solid #ddd;border-radius:12px;margin:18px 0;">
        <p><strong>Credits purchased:</strong> ${creditsPurchased}</p>
        <p><strong>New balance:</strong> ${newBalance} credits</p>
        <p><strong>Payment method:</strong> ${
          cardBrand && cardLast4 ? `${cardBrand} ending ${cardLast4}` : "Demo card"
        }</p>
        <p><strong>Receipt ID:</strong> ${purchaseId}</p>
      </div>

      <p><strong>QR receipt data:</strong></p>
      <img src="${qrDataUrl}" alt="QR receipt" style="width:180px;height:180px;" />

      <p style="font-size:12px;color:#666;margin-top:24px;">
        This is a UAT/demo receipt. No real money has been charged.
      </p>
    </div>
  `;

  const text = `
RollPay Credit Purchase Receipt

Credits purchased: ${creditsPurchased}
New balance: ${newBalance} credits
Payment method: ${cardBrand && cardLast4 ? `${cardBrand} ending ${cardLast4}` : "Demo card"}
Receipt ID: ${purchaseId}

This is a UAT/demo receipt. No real money has been charged.
  `;

  return sendEmail({
    to,
    subject: "RollPay credit purchase receipt",
    html,
    text,
  });
}

export async function sendFinalSplitReceipt({
  to,
  displayName,
  sessionCode,
  confirmedSplit,
  qrPayload,
}) {
  const allocation = Array.isArray(confirmedSplit?.finalAllocation)
    ? confirmedSplit.finalAllocation
    : [];

  const qrDataUrl = await buildQrDataUrl(qrPayload);

  const rows = allocation
    .map(
      (player) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${player.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">Rank ${player.rank ?? "-"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">£${Number(
            player.total || 0
          ).toFixed(2)}</td>
        </tr>
      `
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;color:#151515;">
      <h1>RollPay Final Split Receipt</h1>
      <p>Hi ${displayName || "Player"},</p>
      <p>The final split for session <strong>${sessionCode}</strong> has been confirmed.</p>

      <div style="padding:16px;border:1px solid #ddd;border-radius:12px;margin:18px 0;">
        <p><strong>Winner:</strong> ${confirmedSplit?.winnerName || "N/A"}</p>
        <p><strong>Mode:</strong> ${confirmedSplit?.mode || "N/A"}</p>
        <p><strong>Final total:</strong> £${Number(
          confirmedSplit?.finalTotal || 0
        ).toFixed(2)}</p>
        <p><strong>Confirmed at:</strong> ${
          confirmedSplit?.confirmedAt
            ? new Date(confirmedSplit.confirmedAt).toLocaleString()
            : "N/A"
        }</p>
      </div>

      <h2>Who owes what</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Player</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Ranking</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #ddd;">Owes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="margin-top:20px;"><strong>QR split data:</strong></p>
      <img src="${qrDataUrl}" alt="QR split data" style="width:180px;height:180px;" />

      <p style="font-size:12px;color:#666;margin-top:24px;">
        This is a UAT/demo payment summary. No real money has been moved.
      </p>
    </div>
  `;

  const text = `
RollPay Final Split Receipt

Session: ${sessionCode}
Winner: ${confirmedSplit?.winnerName || "N/A"}
Mode: ${confirmedSplit?.mode || "N/A"}
Final total: £${Number(confirmedSplit?.finalTotal || 0).toFixed(2)}

${allocation
  .map(
    (player) =>
      `${player.name} | Rank ${player.rank ?? "-"} | Owes £${Number(
        player.total || 0
      ).toFixed(2)}`
  )
  .join("\n")}

This is a UAT/demo payment summary. No real money has been moved.
  `;

  return sendEmail({
    to,
    subject: `RollPay final split receipt — ${sessionCode}`,
    html,
    text,
  });
}