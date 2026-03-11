// src/pages/SplitSetup.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

export default function SplitSetup() {
  const navigate = useNavigate();
  const {
    sessionCode,
    splitMode,
    setSplitMode,
    sessionPot,
    setSessionPot,
    sessionItems,
    setSessionItems,
    paymentRequired,
    setPaymentRequired,
  } = useGame();

  const [localMode, setLocalMode] = useState(splitMode || "items");
  const [potInput, setPotInput] = useState(sessionPot ?? "");
  const [itemName, setItemName] = useState("");
  const [itemCost, setItemCost] = useState("");
  const [localItems, setLocalItems] = useState(sessionItems || []);

  function addItem() {
    if (!itemName.trim()) return;
    if (!itemCost || Number(itemCost) <= 0) return;

    setLocalItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: itemName.trim(),
        cost: Number(itemCost),
      },
    ]);

    setItemName("");
    setItemCost("");
  }

  function removeItem(id) {
    setLocalItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleContinue() {
    setSplitMode(localMode);

    if (localMode === "items") {
      const total = localItems.reduce(
        (sum, item) => sum + Number(item.cost || 0),
        0
      );
      setSessionItems(localItems);
      setSessionPot(total);
      setPaymentRequired(true);
    }

    if (localMode === "pot") {
      setSessionItems([]);
      setSessionPot(Number(potInput) || 0);
      setPaymentRequired(true);
    }

    if (localMode === "pseudo") {
      setSessionItems([]);
      setSessionPot(Number(potInput) || 0);
      setPaymentRequired(false);
    }

    navigate("/choose-game");
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={{ marginTop: 0 }}>Session Split Setup</h1>
        <p style={{ opacity: 0.8 }}>
          Choose how this session should handle payment and bill splitting
          before the games begin.
        </p>

        <div style={sessionPill}>
          Session: <strong>{sessionCode || "No active session"}</strong>
        </div>

        <div style={modeGrid}>
          <button
            style={{
              ...modeCard,
              ...(localMode === "items" ? modeCardActive : null),
            }}
            onClick={() => setLocalMode("items")}
          >
            <h3 style={modeTitle}>Specific Items / Receipt</h3>
            <p style={modeText}>
              Add individual food and drink items now. After the games, RollPay
              will suggest who should pay for which items.
            </p>
          </button>

          <button
            style={{
              ...modeCard,
              ...(localMode === "pot" ? modeCardActive : null),
            }}
            onClick={() => setLocalMode("pot")}
          >
            <h3 style={modeTitle}>Total Pot</h3>
            <p style={modeText}>
              Enter one overall bill total. After the games, players will be
              assigned contributions toward that total.
            </p>
          </button>

          <button
            style={{
              ...modeCard,
              ...(localMode === "pseudo" ? modeCardActive : null),
            }}
            onClick={() => setLocalMode("pseudo")}
          >
            <h3 style={modeTitle}>Pseudo Tab / No Payment</h3>
            <p style={modeText}>
              Use the games and rankings without needing real payment
              processing. Great for low-stakes sessions and demos.
            </p>
          </button>
        </div>

        {localMode === "items" && (
          <div style={sectionBox}>
            <h2 style={sectionTitle}>Add Items</h2>

            <div style={row}>
              <input
                type="text"
                placeholder="Item name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                style={input}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Cost"
                value={itemCost}
                onChange={(e) => setItemCost(e.target.value)}
                style={input}
              />
              <button onClick={addItem} style={primaryBtn}>
                Add Item
              </button>
            </div>

            {localItems.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No items added yet.</p>
            ) : (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Item</th>
                    <th style={th}>Cost</th>
                    <th style={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {localItems.map((item) => (
                    <tr key={item.id}>
                      <td style={td}>{item.name}</td>
                      <td style={td}>£{Number(item.cost).toFixed(2)}</td>
                      <td style={td}>
                        <button onClick={() => removeItem(item.id)} style={smallBtn}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h3 style={{ marginTop: 16 }}>
              Item Total: £
              {localItems
                .reduce((sum, item) => sum + Number(item.cost || 0), 0)
                .toFixed(2)}
            </h3>
          </div>
        )}

        {localMode === "pot" && (
          <div style={sectionBox}>
            <h2 style={sectionTitle}>Set Overall Pot</h2>
            <p style={{ opacity: 0.8 }}>
              Enter the total cost to be covered by the players.
            </p>

            <div style={row}>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Total pot"
                value={potInput}
                onChange={(e) => setPotInput(e.target.value)}
                style={input}
              />
            </div>
          </div>
        )}

        {localMode === "pseudo" && (
          <div style={sectionBox}>
            <h2 style={sectionTitle}>Pseudo Tab Settings</h2>
            <p style={{ opacity: 0.8 }}>
              This mode keeps the competitive flow, but no real payment
              processing is required. You can optionally enter a notional total.
            </p>

            <div style={row}>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional pretend total"
                value={potInput}
                onChange={(e) => setPotInput(e.target.value)}
                style={input}
              />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => navigate("/host-session")} style={secondaryBtn}>
            Back
          </button>
          <button onClick={handleContinue} style={primaryBtn}>
            Continue to Game Order
          </button>
        </div>
      </div>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  paddingTop: 90,
  color: "white",
};

const card = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 20,
  borderRadius: 22,
  background: "rgba(0,0,0,0.28)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const sessionPill = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  marginBottom: 18,
};

const modeGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const modeCard = {
  textAlign: "left",
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.22)",
  color: "white",
  cursor: "pointer",
};

const modeCardActive = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.28)",
};

const modeTitle = {
  marginTop: 0,
  marginBottom: 8,
};

const modeText = {
  margin: 0,
  opacity: 0.78,
  lineHeight: 1.45,
};

const sectionBox = {
  marginTop: 8,
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const sectionTitle = {
  marginTop: 0,
};

const row = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const input = {
  padding: "10px 12px",
  fontSize: 16,
  minWidth: 180,
};

const primaryBtn = {
  padding: "10px 16px",
  fontSize: 16,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "10px 16px",
  fontSize: 16,
  cursor: "pointer",
};

const table = {
  width: "100%",
  marginTop: 12,
  borderCollapse: "collapse",
};

const th = {
  textAlign: "left",
  borderBottom: "1px solid rgba(255,255,255,0.2)",
  padding: 10,
};

const td = {
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  padding: 10,
};

const smallBtn = {
  padding: "6px 10px",
  cursor: "pointer",
};