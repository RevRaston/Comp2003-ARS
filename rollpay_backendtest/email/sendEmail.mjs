// email/sendEmail.mjs

export async function sendDemoEmail({ to, subject, html, text }) {
  const recipient = to || "demo-user@rollpay.local";

  console.log("📧 DEMO EMAIL SENT");
  console.log("To:", recipient);
  console.log("Subject:", subject);
  console.log("Text:", text || "");
  console.log("HTML:", html || "");

  return {
    ok: true,
    demo: true,
    to: recipient,
    subject,
  };
}

export function buildCreditReceiptEmail({
  displayName = "Player",
  creditsPurchased = 0,
  newBalance = 0,
  cardBrand = "DemoCard",
  cardLast4 = "0000",
}) {
  const subject = `RollPay Credit Receipt — ${creditsPurchased} credits`;

  const text = `
RollPay Credit Receipt

Hi ${displayName},

You purchased ${creditsPurchased} demo credits.

Paid with: ${cardBrand} ending ${cardLast4}
New balance: ${newBalance} credits

This is a demo/UAT receipt. No real money was charged.
`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>RollPay Credit Receipt</h2>
      <p>Hi <strong>${displayName}</strong>,</p>
      <p>You purchased <strong>${creditsPurchased}</strong> demo credits.</p>
      <hr />
      <p><strong>Paid with:</strong> ${cardBrand} ending ${cardLast4}</p>
      <p><strong>New balance:</strong> ${newBalance} credits</p>
      <p style="color:#777;">This is a demo/UAT receipt. No real money was charged.</p>
    </div>
  `;

  return { subject, text, html };
}