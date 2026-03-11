// src/pages/PaymentSummary.jsx
import { useGame } from "../GameContext";
import { useNavigate } from "react-router-dom";

export default function PaymentSummary() {
  const navigate = useNavigate();
  const { confirmedSplit } = useGame();

  if (!confirmedSplit) {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={{ marginTop: 0 }}>Payment Summary</h1>
          <p style={{ opacity: 0.8 }}>
            No confirmed split has been saved yet.
          </p>

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
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Payment Summary</h1>
          <p style={{ margin: 0, opacity: 0.82 }}>
            Final confirmed split for this session
          </p>
        </div>

        <div style={summaryGrid}>
          <div style={summaryCard}>
            <div style={summaryLabel}>Mode</div>
            <div style={summaryValue}>{confirmedSplit.modeLabel}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Winner</div>
            <div style={summaryValue}>{confirmedSplit.winnerName || "N/A"}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Payment Required</div>
            <div style={summaryValue}>
              {confirmedSplit.paymentRequired ? "Yes" : "No"}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Session Total</div>
            <div style={summaryValue}>
              £{Number(confirmedSplit.sessionTotal || 0).toFixed(2)}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Final Total</div>
            <div style={summaryValue}>
              £{Number(confirmedSplit.finalTotal || 0).toFixed(2)}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Confirmed At</div>
            <div style={summaryValueSmall}>
              {confirmedSplit.confirmedAt
                ? new Date(confirmedSplit.confirmedAt).toLocaleString()
                : "N/A"}
            </div>
          </div>
        </div>

        <div style={receiptBox}>
          <h2 style={receiptTitle}>Final Receipt</h2>

          {confirmedSplit.finalAllocation.map((player) => (
            <div key={player.name} style={playerBlock}>
              <div style={playerHeader}>
                <span>
                  {player.name} (Rank {player.rank})
                </span>
                <strong>£{Number(player.total || 0).toFixed(2)}</strong>
              </div>

              {player.items?.length > 0 && (
                <div style={itemsWrap}>
                  {player.items.map((item) => (
                    <div
                      key={`${player.name}-${item.id}`}
                      style={itemRow}
                    >
                      <span>
                        {item.name}
                        {item.shared
                          ? ` (shared, £${Number(
                              item.shareValue || 0
                            ).toFixed(2)} share)`
                          : ""}
                      </span>
                      <span>
                        £
                        {Number(
                          item.shared ? item.shareValue : item.cost || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div style={divider} />

          <div style={receiptFooter}>
            <span>Final Total</span>
            <strong>£{Number(confirmedSplit.finalTotal || 0).toFixed(2)}</strong>
          </div>

          <p style={note}>
            {confirmedSplit.paymentRequired
              ? "This session is ready for payment processing."
              : "This is a pseudo-tab summary only. No real payment is required."}
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

const page = {
  minHeight: "100vh",
  paddingTop: 80,
  color: "white",
};

const container = {
  maxWidth: 1000,
  margin: "0 auto",
  padding: 20,
};

const card = {
  maxWidth: 700,
  margin: "0 auto",
  padding: 22,
  borderRadius: 18,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
};

const heroCard = {
  marginBottom: 20,
  padding: 20,
  borderRadius: 18,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.12)",
  textAlign: "center",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const summaryCard = {
  padding: 14,
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const summaryLabel = {
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 6,
};

const summaryValue = {
  fontSize: 16,
  fontWeight: 700,
};

const summaryValueSmall = {
  fontSize: 14,
  fontWeight: 700,
};

const receiptBox = {
  marginBottom: 22,
  padding: 22,
  borderRadius: 18,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.18)",
};

const receiptTitle = {
  marginTop: 0,
  marginBottom: 18,
  textAlign: "center",
};

const playerBlock = {
  marginBottom: 14,
};

const playerHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
};

const itemsWrap = {
  marginTop: 8,
  marginLeft: 10,
  opacity: 0.86,
};

const itemRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "3px 0",
  fontSize: 14,
};

const divider = {
  height: 1,
  background: "rgba(255,255,255,0.14)",
  margin: "14px 0",
};

const receiptFooter = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
};

const note = {
  marginTop: 16,
  opacity: 0.82,
  textAlign: "center",
};

const buttonRow = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 18,
};

const primaryBtn = {
  padding: "10px 18px",
  fontSize: 16,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "10px 18px",
  fontSize: 16,
  cursor: "pointer",
};