// src/pages/PaymentSummary.jsx
import { useMemo } from "react";
import { useGame } from "../GameContext";
import { useNavigate } from "react-router-dom";

export default function PaymentSummary() {
  const navigate = useNavigate();
  const { confirmedSplit, creditsBalance } = useGame();

  const finalAllocation = Array.isArray(confirmedSplit?.finalAllocation)
    ? confirmedSplit.finalAllocation
    : [];

  const paymentRequired =
    confirmedSplit?.paymentRequired ?? confirmedSplit?.mode !== "pseudo";

  const totalDue = useMemo(() => {
    return finalAllocation.reduce(
      (sum, player) => sum + Number(player.total || 0),
      0
    );
  }, [finalAllocation]);

  if (!confirmedSplit) {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={title}>Payment Summary</h1>
          <p style={muted}>No confirmed split has been saved yet.</p>

          <div style={buttonRow}>
            <button onClick={() => navigate("/results")} style={primaryBtn}>
              Back to Results
            </button>
            <button onClick={() => navigate("/lobby")} style={secondaryBtn}>
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={container}>
        <div style={heroCard}>
          <p style={eyebrow}>RollPay receipt</p>
          <h1 style={title}>Payment Summary</h1>
          <p style={muted}>Final confirmed split for this session.</p>
        </div>

        <div style={summaryGrid}>
          <SummaryCard label="Mode" value={modeLabel(confirmedSplit.mode)} />
          <SummaryCard label="Winner" value={confirmedSplit.winnerName || "N/A"} />
          <SummaryCard
            label="Payment Required"
            value={paymentRequired ? "Yes" : "No"}
          />
          <SummaryCard
            label="Final Total"
            value={`${Number(totalDue || confirmedSplit.finalTotal || 0).toFixed(
              2
            )} credits`}
          />
          <SummaryCard
            label="Your Credits"
            value={`${Number(creditsBalance || 0).toFixed(2)} credits`}
          />
          <SummaryCard
            label="Confirmed"
            value={
              confirmedSplit.confirmedAt || confirmedSplit.saved_at
                ? new Date(
                    confirmedSplit.confirmedAt || confirmedSplit.saved_at
                  ).toLocaleString()
                : "N/A"
            }
            small
          />
        </div>

        <div style={receiptBox}>
          <h2 style={receiptTitle}>Final Receipt</h2>

          {finalAllocation.length === 0 ? (
            <p style={muted}>No player allocation found.</p>
          ) : (
            finalAllocation.map((player) => (
              <div key={player.name} style={playerBlock}>
                <div style={playerHeader}>
                  <span>
                    {player.name} {player.rank ? `(Rank ${player.rank})` : ""}
                  </span>
                  <strong>{Number(player.total || 0).toFixed(2)} credits</strong>
                </div>

                {player.items?.length > 0 && (
                  <div style={itemsWrap}>
                    {player.items.map((item) => (
                      <div key={`${player.name}-${item.id}`} style={itemRow}>
                        <span>
                          {item.name}
                          {item.shared
                            ? ` (${item.shareCount || "shared"} way split)`
                            : ""}
                        </span>
                        <span>
                          {Number(
                            item.shared ? item.shareValue : item.cost || 0
                          ).toFixed(2)}{" "}
                          credits
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          <div style={divider} />

          <div style={receiptFooter}>
            <span>Final Total</span>
            <strong>
              {Number(totalDue || confirmedSplit.finalTotal || 0).toFixed(2)}{" "}
              credits
            </strong>
          </div>

          <div style={qrBox}>
            {confirmedSplit.qrDataUrl ? (
              <img
                src={confirmedSplit.qrDataUrl}
                alt="RollPay receipt QR"
                style={qrImage}
              />
            ) : (
              <div style={qrPlaceholder}>QR</div>
            )}

            <p style={qrText}>
              Scan this QR to view the restaurant split receipt. It contains the
              same session, ranking, and “who owes what” data as the email.
            </p>
          </div>

          <p style={note}>
            {paymentRequired
              ? "This receipt is ready for restaurant check splitting and player payment tracking."
              : "This is a pseudo-tab summary only. No credits are required."}
          </p>
        </div>

        <div style={buttonRow}>
          <button onClick={() => navigate("/results")} style={secondaryBtn}>
            Back to Results
          </button>
          <button onClick={() => navigate("/lobby")} style={primaryBtn}>
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, small = false }) {
  return (
    <div style={summaryCard}>
      <div style={summaryLabel}>{label}</div>
      <div style={small ? summaryValueSmall : summaryValue}>{value}</div>
    </div>
  );
}

function modeLabel(mode) {
  if (mode === "items") return "Specific Items";
  if (mode === "pot") return "Total Pot";
  if (mode === "pseudo") return "Pseudo Tab";
  return "Unknown";
}

const page = {
  minHeight: "100vh",
  color: "white",
  background:
    "radial-gradient(circle at top, rgba(255,210,90,0.10), transparent 18%), linear-gradient(180deg, #0d1118 0%, #151b26 35%, #1b2130 100%)",
};

const container = {
  maxWidth: 1000,
  margin: "0 auto",
  padding: "42px 16px",
};

const card = {
  maxWidth: 700,
  margin: "80px auto 0",
  padding: 24,
  borderRadius: 24,
  background: "rgba(0,0,0,0.42)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const heroCard = {
  marginBottom: 20,
  padding: 24,
  borderRadius: 28,
  background: "rgba(0,0,0,0.42)",
  border: "1px solid rgba(255,255,255,0.12)",
  textAlign: "center",
};

const eyebrow = {
  margin: "0 0 10px",
  color: "#f6cf64",
  textTransform: "uppercase",
  letterSpacing: 1.5,
  fontSize: 13,
  fontWeight: 800,
};

const title = {
  margin: 0,
  fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
  lineHeight: 0.98,
  fontWeight: 900,
};

const muted = {
  marginTop: 12,
  opacity: 0.82,
  lineHeight: 1.6,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const summaryCard = {
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const summaryLabel = {
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const summaryValue = {
  fontSize: 17,
  fontWeight: 800,
};

const summaryValueSmall = {
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.4,
};

const receiptBox = {
  marginBottom: 22,
  padding: 24,
  borderRadius: 28,
  background: "rgba(0,0,0,0.42)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const receiptTitle = {
  marginTop: 0,
  marginBottom: 18,
  textAlign: "center",
};

const playerBlock = {
  marginBottom: 14,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const playerHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
};

const itemsWrap = {
  marginTop: 8,
  opacity: 0.86,
};

const itemRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "4px 0",
  fontSize: 14,
};

const divider = {
  height: 1,
  background: "rgba(255,255,255,0.14)",
  margin: "18px 0",
};

const receiptFooter = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
  fontSize: 18,
};

const qrBox = {
  marginTop: 20,
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px dashed rgba(255,255,255,0.18)",
  display: "flex",
  gap: 14,
  alignItems: "center",
};

const qrImage = {
  width: 120,
  height: 120,
  borderRadius: 16,
  background: "white",
  padding: 10,
  flexShrink: 0,
};

const qrPlaceholder = {
  width: 74,
  height: 74,
  borderRadius: 12,
  background: "white",
  color: "#111",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const qrText = {
  margin: 0,
  opacity: 0.82,
  lineHeight: 1.5,
  fontSize: 14,
};

const note = {
  marginTop: 18,
  opacity: 0.82,
  textAlign: "center",
  lineHeight: 1.6,
};

const buttonRow = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 18,
};

const primaryBtn = {
  padding: "12px 20px",
  borderRadius: 999,
  border: "none",
  background: "#f4c431",
  color: "#161616",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "12px 20px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};