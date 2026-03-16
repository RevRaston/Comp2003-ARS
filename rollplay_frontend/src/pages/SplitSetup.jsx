// src/pages/SplitSetup.jsx
import { useEffect, useMemo, useState } from "react";
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
    profile,
  } = useGame();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const [localMode, setLocalMode] = useState(splitMode || "items");
  const [potInput, setPotInput] = useState(sessionPot ?? "");
  const [itemName, setItemName] = useState("");
  const [itemCost, setItemCost] = useState("");
  const [localItems, setLocalItems] = useState(sessionItems || []);

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhone = screenWidth <= 640;
  const isLaptop = screenWidth <= 1100;

  const displayName =
    profile?.displayName ||
    profile?.display_name ||
    profile?.username ||
    profile?.email ||
    "Host";

  const itemTotal = useMemo(() => {
    return localItems.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  }, [localItems]);

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
      {/* TOP BAR */}
      <header
        style={{
          ...topBar,
          padding: isPhone ? "14px 16px" : "16px 24px",
          flexDirection: isPhone ? "column" : "row",
          alignItems: isPhone ? "stretch" : "center",
        }}
      >
        <div
          style={{
            ...logoWrap,
            justifyContent: isPhone ? "center" : "flex-start",
          }}
        >
          <div style={logoBox}>LOGO</div>
          <div style={brandText}>RollPlay</div>
        </div>

        <nav
          style={{
            ...navLinks,
            justifyContent: isPhone ? "center" : "flex-end",
          }}
        >
          <button style={navButton} onClick={() => navigate("/join-session")}>
            Join
          </button>
          <button style={navButton} onClick={() => navigate("/host-session")}>
            Host
          </button>
          <button style={navButton} onClick={() => navigate("/profile")}>
            Profile
          </button>
        </nav>
      </header>

      {/* PAGE BODY */}
      <section
        style={{
          ...heroSection,
          padding: isPhone ? "28px 14px 40px" : "42px 20px 52px",
        }}
      >
        <div style={heroGlowOne} />
        <div style={heroGlowTwo} />
        {!isPhone && <div style={heroBubbleOne} />}
        {!isPhone && <div style={heroBubbleTwo} />}

        <div
          style={{
            ...splitLayout,
            gridTemplateColumns:
              isPhone || isLaptop
                ? "1fr"
                : "minmax(320px, 0.85fr) minmax(0, 1.15fr)",
            gap: isPhone ? 18 : 24,
          }}
        >
          {/* LEFT INFO PANEL */}
          <div style={sideCard}>
            <p style={sectionEyebrow}>Split setup</p>
            <h1
              style={{
                ...pageTitle,
                fontSize: isPhone ? 40 : isLaptop ? 52 : 64,
              }}
            >
              Session payment setup
            </h1>

            <p style={introText}>
              Choose how this session should handle the bill before the games
              begin.
            </p>

            <div style={profileCard}>
              <div style={avatarCircle}>
                {String(displayName).slice(0, 2).toUpperCase()}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={profileLabel}>Session host</div>
                <div style={profileName}>{displayName}</div>
                <div style={profileSubtext}>
                  Session code: {sessionCode || "Not available"}
                </div>
              </div>
            </div>

            <div style={tipsCard}>
              <h3 style={smallCardTitle}>What this step does</h3>
              <ul style={tipsList}>
                <li>Sets how payment is handled for the session</li>
                <li>Decides whether players split items or one total bill</li>
                <li>Controls whether payment is real or just for demo use</li>
              </ul>
            </div>

            <div style={summaryPanel}>
              <div style={summaryRow}>
                <span style={summaryLabel}>Selected mode</span>
                <strong style={summaryValue}>
                  {localMode === "items"
                    ? "Specific Items"
                    : localMode === "pot"
                    ? "Total Pot"
                    : "Pseudo Tab"}
                </strong>
              </div>

              <div style={summaryRow}>
                <span style={summaryLabel}>Payment required</span>
                <strong style={summaryValue}>
                  {localMode === "pseudo" ? "No" : "Yes"}
                </strong>
              </div>

              <div style={summaryRow}>
                <span style={summaryLabel}>Current total</span>
                <strong style={summaryValue}>
                  £
                  {localMode === "items"
                    ? itemTotal.toFixed(2)
                    : Number(potInput || 0).toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          {/* RIGHT MAIN PANEL */}
          <div style={mainColumn}>
            <div style={contentCard}>
              <p style={sectionEyebrow}>Mode selection</p>
              <h2 style={cardHeading}>Choose a split mode</h2>
              <p style={helperIntro}>
                Pick the format that best matches how you want this session to
                handle the bill.
              </p>

              <div
                style={{
                  ...modeGrid,
                  gridTemplateColumns: isPhone ? "1fr" : "1fr",
                }}
              >
                <button
                  style={{
                    ...modeCard,
                    ...(localMode === "items" ? modeCardActive : null),
                  }}
                  onClick={() => setLocalMode("items")}
                >
                  <h3 style={modeTitle}>Specific Items / Receipt</h3>
                  <p style={modeText}>
                    Add each food and drink item now. After the games, RollPlay
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
                    Enter one overall bill total. After the games, players will
                    be assigned contributions toward that total.
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
                    processing. Good for demos and low-stakes sessions.
                  </p>
                </button>
              </div>
            </div>

            {localMode === "items" && (
              <div style={contentCard}>
                <p style={sectionEyebrow}>Receipt items</p>
                <h2 style={cardHeading}>Add session items</h2>
                <p style={helperIntro}>
                  Add the items that make up the session bill.
                </p>

                <div
                  style={{
                    ...itemInputRow,
                    flexDirection: isPhone ? "column" : "row",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Item name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    style={{
                      ...inputStyle,
                      width: isPhone ? "100%" : "100%",
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Cost"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    style={{
                      ...inputStyle,
                      width: isPhone ? "100%" : 180,
                    }}
                  />
                  <button
                    onClick={addItem}
                    style={{
                      ...primaryButton,
                      width: isPhone ? "100%" : "auto",
                    }}
                  >
                    Add Item
                  </button>
                </div>

                {localItems.length === 0 ? (
                  <p style={emptyText}>No items added yet.</p>
                ) : (
                  <>
                    {!isPhone ? (
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
                                <button
                                  onClick={() => removeItem(item.id)}
                                  style={smallGhostButton}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={mobileItemList}>
                        {localItems.map((item) => (
                          <div key={item.id} style={mobileItemCard}>
                            <div>
                              <div style={mobileItemName}>{item.name}</div>
                              <div style={mobileItemCost}>
                                £{Number(item.cost).toFixed(2)}
                              </div>
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              style={smallGhostButton}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div style={summaryPanel}>
                  <div style={summaryRow}>
                    <span style={summaryLabel}>Items added</span>
                    <strong style={summaryValue}>{localItems.length}</strong>
                  </div>
                  <div style={summaryRow}>
                    <span style={summaryLabel}>Item total</span>
                    <strong style={summaryValue}>£{itemTotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            )}

            {localMode === "pot" && (
              <div style={contentCard}>
                <p style={sectionEyebrow}>Pot setup</p>
                <h2 style={cardHeading}>Set the overall bill</h2>
                <p style={helperIntro}>
                  Enter the full session total to be covered by the players.
                </p>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Total pot"
                  value={potInput}
                  onChange={(e) => setPotInput(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            {localMode === "pseudo" && (
              <div style={contentCard}>
                <p style={sectionEyebrow}>Pseudo setup</p>
                <h2 style={cardHeading}>Optional pretend total</h2>
                <p style={helperIntro}>
                  This mode keeps the competitive flow, but no real payment is
                  required. You can still enter a notional total if you want.
                </p>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional pretend total"
                  value={potInput}
                  onChange={(e) => setPotInput(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            <div style={contentCard}>
              <p style={sectionEyebrow}>Next step</p>
              <h2 style={cardHeading}>Continue to game order</h2>

              <div
                style={{
                  ...actionRow,
                  flexDirection: isPhone ? "column" : "row",
                }}
              >
                <button
                  onClick={() => navigate("/host-session")}
                  style={{
                    ...secondaryButton,
                    width: isPhone ? "100%" : "auto",
                  }}
                >
                  Back
                </button>

                <button
                  onClick={handleContinue}
                  style={{
                    ...primaryButton,
                    width: isPhone ? "100%" : "auto",
                  }}
                >
                  Continue to Game Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* styles */

const page = {
  minHeight: "100vh",
  color: "#fff",
  background:
    "radial-gradient(circle at top, rgba(255,210,90,0.10), transparent 18%), linear-gradient(180deg, #0d1118 0%, #151b26 35%, #1b2130 100%)",
};

const topBar = {
  position: "sticky",
  top: 0,
  zIndex: 100,
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  background: "rgba(8, 10, 16, 0.82)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const logoWrap = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const logoBox = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 11,
  fontWeight: 700,
};

const brandText = {
  fontSize: 24,
  fontWeight: 800,
};

const navLinks = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const navButton = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
};

const heroSection = {
  position: "relative",
  display: "flex",
  justifyContent: "center",
  overflow: "hidden",
};

const heroGlowOne = {
  position: "absolute",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "rgba(255, 196, 54, 0.18)",
  filter: "blur(90px)",
  top: 60,
  left: -100,
};

const heroGlowTwo = {
  position: "absolute",
  width: 440,
  height: 440,
  borderRadius: "50%",
  background: "rgba(255, 115, 64, 0.12)",
  filter: "blur(90px)",
  bottom: 40,
  right: -80,
};

const heroBubbleOne = {
  position: "absolute",
  width: 120,
  height: 120,
  borderRadius: "50%",
  border: "7px solid rgba(255,220,140,0.12)",
  top: 120,
  right: "12%",
};

const heroBubbleTwo = {
  position: "absolute",
  width: 78,
  height: 78,
  borderRadius: "50%",
  border: "6px solid rgba(255,220,140,0.10)",
  bottom: 120,
  left: "10%",
};

const splitLayout = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 1180,
  display: "grid",
  alignItems: "start",
};

const sideCard = {
  background: "rgba(0, 0, 0, 0.38)",
  borderRadius: 30,
  padding: "28px 24px",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
};

const mainColumn = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const contentCard = {
  background: "rgba(0, 0, 0, 0.42)",
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
  padding: "28px 24px",
};

const sectionEyebrow = {
  margin: 0,
  marginBottom: 10,
  color: "#f6cf64",
  textTransform: "uppercase",
  letterSpacing: 1.5,
  fontSize: 13,
  fontWeight: 700,
};

const pageTitle = {
  margin: 0,
  lineHeight: 0.98,
  fontWeight: 900,
};

const cardHeading = {
  margin: "0 0 16px",
  fontSize: 30,
  lineHeight: 1.05,
};

const introText = {
  marginTop: 14,
  fontSize: 17,
  lineHeight: 1.65,
  opacity: 0.9,
};

const helperIntro = {
  margin: "0 0 18px",
  fontSize: 15,
  lineHeight: 1.7,
  opacity: 0.86,
};

const profileCard = {
  marginTop: 24,
  padding: 18,
  borderRadius: 22,
  display: "flex",
  alignItems: "center",
  gap: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const avatarCircle = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #f4c431, #ff9d2f)",
  color: "#1b1b1b",
  fontWeight: 900,
  fontSize: 22,
  flexShrink: 0,
};

const profileLabel = {
  fontSize: 13,
  opacity: 0.72,
  marginBottom: 4,
};

const profileName = {
  fontSize: 22,
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const profileSubtext = {
  fontSize: 14,
  opacity: 0.76,
  marginTop: 4,
};

const tipsCard = {
  marginTop: 20,
  padding: 20,
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(244,196,49,0.12), rgba(255,255,255,0.03))",
  border: "1px solid rgba(255,255,255,0.1)",
};

const smallCardTitle = {
  margin: "0 0 12px",
  fontSize: 18,
};

const tipsList = {
  margin: 0,
  paddingLeft: 20,
  lineHeight: 1.9,
  fontSize: 15,
  opacity: 0.9,
};

const summaryPanel = {
  marginTop: 18,
  padding: 18,
  borderRadius: 20,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const summaryRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "6px 0",
};

const summaryLabel = {
  opacity: 0.78,
  fontSize: 15,
};

const summaryValue = {
  fontSize: 16,
  textAlign: "right",
};

const modeGrid = {
  display: "grid",
  gap: 14,
};

const modeCard = {
  textAlign: "left",
  borderRadius: 20,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  cursor: "pointer",
};

const modeCardActive = {
  background: "rgba(244,196,49,0.12)",
  border: "1px solid rgba(244,196,49,0.28)",
};

const modeTitle = {
  marginTop: 0,
  marginBottom: 8,
  fontSize: 20,
};

const modeText = {
  margin: 0,
  opacity: 0.82,
  lineHeight: 1.55,
  fontSize: 15,
};

const itemInputRow = {
  display: "flex",
  gap: 12,
  alignItems: "stretch",
  marginBottom: 14,
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 17,
  boxSizing: "border-box",
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
  fontSize: 14,
  opacity: 0.82,
};

const td = {
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  padding: 10,
  fontSize: 15,
};

const mobileItemList = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 10,
};

const mobileItemCard = {
  padding: 14,
  borderRadius: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const mobileItemName = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 4,
};

const mobileItemCost = {
  opacity: 0.8,
  fontSize: 14,
};

const emptyText = {
  opacity: 0.72,
  marginTop: 10,
};

const actionRow = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const primaryButton = {
  padding: "14px 22px",
  borderRadius: 999,
  border: "none",
  background: "#f4c431",
  color: "#161616",
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
  minWidth: 200,
  boxShadow: "0 10px 24px rgba(244,196,49,0.24)",
};

const secondaryButton = {
  padding: "14px 22px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  minWidth: 170,
};

const smallGhostButton = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "transparent",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
};