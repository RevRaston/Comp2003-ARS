import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

const defaultBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://comp2003-ars.onrender.com";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  defaultBase
).replace(/\/$/, "");

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

  const [showReceiptScan, setShowReceiptScan] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanInfo, setScanInfo] = useState("");

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

  function updateItemName(id, value) {
    setLocalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: value } : item))
    );
  }

  function updateItemCost(id, value) {
    setLocalItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, cost: Number(value) || 0 } : item
      )
    );
  }

  async function handleScanReceipt() {
    if (!receiptFile) {
      setScanError("Please choose a receipt image first.");
      return;
    }

    try {
      setScanLoading(true);
      setScanError("");
      setScanInfo("");

      const formData = new FormData();
      formData.append("receipt", receiptFile);

      const res = await fetch(`${API_BASE}/scan-receipt`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to scan receipt");
      }

      const parsedItems = Array.isArray(data?.items) ? data.items : [];

      if (!parsedItems.length) {
        setScanInfo(data?.warning || "No receipt items were detected.");
        return;
      }

      setLocalItems((prev) => {
        const existing = [...prev];
        const incoming = parsedItems.map((item) => ({
          id: item.id || crypto.randomUUID(),
          name: item.name || "Receipt item",
          cost: Number(item.cost || 0),
        }));
        return [...existing, ...incoming];
      });

      setScanInfo(
        `Added ${parsedItems.length} item${
          parsedItems.length === 1 ? "" : "s"
        } from receipt.`
      );
      setReceiptFile(null);
    } catch (err) {
      console.error(err);
      setScanError(err.message || "Receipt scan failed");
    } finally {
      setScanLoading(false);
    }
  }

  function saveDraftLocally() {
    setSplitMode(localMode);

    if (localMode === "items") {
      const cleanedItems = localItems
        .map((item) => ({
          ...item,
          name: String(item.name || "").trim(),
          cost: Number(item.cost || 0),
        }))
        .filter((item) => item.name && item.cost > 0);

      const total = cleanedItems.reduce(
        (sum, item) => sum + Number(item.cost || 0),
        0
      );

      setSessionItems(cleanedItems);
      setSessionPot(total);
      setPaymentRequired(true);
      return;
    }

    if (localMode === "pot") {
      setSessionItems([]);
      setSessionPot(Number(potInput) || 0);
      setPaymentRequired(true);
      return;
    }

    if (localMode === "pseudo") {
      setSessionItems([]);
      setSessionPot(Number(potInput) || 0);
      setPaymentRequired(false);
    }
  }

  function handleContinue() {
    saveDraftLocally();
    navigate("/choose-game");
  }

  function handleSkip() {
    navigate("/choose-game");
  }

  return (
    <div style={page}>
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
          <div style={sideCard}>
            <p style={sectionEyebrow}>Optional setup</p>
            <h1
              style={{
                ...pageTitle,
                fontSize: isPhone ? 40 : isLaptop ? 52 : 64,
              }}
            >
              Payment draft
            </h1>

            <p style={introText}>
              This page is optional. You can prepare a bill draft now or skip it
              and sort payment after the game.
            </p>

            <div style={profileCard}>
              <div style={avatarCircle}>
                {String(displayName).slice(0, 2).toUpperCase()}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={profileLabel}>Session host</div>
                <div style={profileName}>{displayName}</div>

                <div style={sessionCodeWrap}>
                  <span style={sessionCodeLabel}>Session code</span>
                  <div style={sessionCodeBox}>{sessionCode || "------"}</div>
                </div>
              </div>
            </div>

            <div style={tipsCard}>
              <h3 style={smallCardTitle}>How this works</h3>
              <ul style={tipsList}>
                <li>Games can start without payment setup</li>
                <li>Final splitting happens on the Results page</li>
                <li>Receipt scanning is optional</li>
              </ul>
            </div>

            <div style={summaryPanel}>
              <div style={summaryRow}>
                <span style={summaryLabel}>Selected draft mode</span>
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
                <span style={summaryLabel}>Current draft total</span>
                <strong style={summaryValue}>
                  £
                  {localMode === "items"
                    ? itemTotal.toFixed(2)
                    : Number(potInput || 0).toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          <div style={mainColumn}>
            <div style={contentCard}>
              <p style={sectionEyebrow}>Draft mode</p>
              <h2 style={cardHeading}>Choose a draft type</h2>
              <p style={helperIntro}>
                This only saves a starting point. You can still edit the final
                split later.
              </p>

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
                    Add food and drink items now if you already have the bill.
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
                    Enter one rough total and finalise the details later.
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
                    Keep the session lightweight and non-payment based.
                  </p>
                </button>
              </div>
            </div>

            {localMode === "items" && (
              <>
                <div style={contentCard}>
                  <button
                    onClick={() => setShowReceiptScan((prev) => !prev)}
                    style={collapseHeader}
                    type="button"
                  >
                    <span>Add receipt scan optional</span>
                    <span style={collapseIcon}>
                      {showReceiptScan ? "−" : "+"}
                    </span>
                  </button>

                  {showReceiptScan && (
                    <>
                      <p style={helperIntro}>
                        Upload a photo and RollPlay will try to pull out item
                        names and prices for you.
                      </p>

                      <div
                        style={{
                          ...uploadRow,
                          flexDirection: isPhone ? "column" : "row",
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            setReceiptFile(e.target.files?.[0] || null);
                            setScanError("");
                            setScanInfo("");
                          }}
                          style={fileInputStyle}
                        />

                        <button
                          type="button"
                          onClick={handleScanReceipt}
                          disabled={scanLoading}
                          style={{
                            ...primaryButton,
                            width: isPhone ? "100%" : "auto",
                            opacity: scanLoading ? 0.75 : 1,
                          }}
                        >
                          {scanLoading ? "Scanning..." : "Scan Receipt"}
                        </button>
                      </div>

                      {receiptFile && (
                        <p style={mutedInfoText}>
                          Selected file: {receiptFile.name}
                        </p>
                      )}

                      {scanInfo ? <p style={successText}>{scanInfo}</p> : null}
                      {scanError ? <p style={errorText}>{scanError}</p> : null}
                    </>
                  )}
                </div>

                <div style={contentCard}>
                  <p style={sectionEyebrow}>Draft items</p>
                  <h2 style={cardHeading}>Add or edit items</h2>
                  <p style={helperIntro}>
                    Manually add items now, or leave this empty and sort the
                    final split later.
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
                      style={inputStyle}
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
                    <p style={emptyText}>No draft items added yet.</p>
                  ) : (
                    <div style={editableItemList}>
                      {localItems.map((item) => (
                        <div key={item.id} style={editableItemCard}>
                          <div style={editableItemFields}>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                updateItemName(item.id, e.target.value)
                              }
                              style={miniInput}
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.cost}
                              onChange={(e) =>
                                updateItemCost(item.id, e.target.value)
                              }
                              style={miniCostInput}
                            />
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

                  <div style={summaryPanel}>
                    <div style={summaryRow}>
                      <span style={summaryLabel}>Items added</span>
                      <strong style={summaryValue}>{localItems.length}</strong>
                    </div>
                    <div style={summaryRow}>
                      <span style={summaryLabel}>Draft total</span>
                      <strong style={summaryValue}>£{itemTotal.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              </>
            )}

            {(localMode === "pot" || localMode === "pseudo") && (
              <div style={contentCard}>
                <p style={sectionEyebrow}>Draft total</p>
                <h2 style={cardHeading}>
                  {localMode === "pot"
                    ? "Set the rough overall total"
                    : "Optional pretend total"}
                </h2>
                <p style={helperIntro}>
                  This value can always be edited later on the Results page.
                </p>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter total"
                  value={potInput}
                  onChange={(e) => setPotInput(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            <div style={contentCard}>
              <p style={sectionEyebrow}>Next step</p>
              <h2 style={cardHeading}>Continue to game order</h2>
              <p style={helperIntro}>
                Save this draft or skip it and configure the final split after
                the session.
              </p>

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
                  onClick={handleSkip}
                  style={{
                    ...ghostButton,
                    width: isPhone ? "100%" : "auto",
                  }}
                >
                  Skip for Now
                </button>

                <button
                  onClick={handleContinue}
                  style={{
                    ...primaryButton,
                    width: isPhone ? "100%" : "auto",
                  }}
                >
                  Save Draft & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

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

const sessionCodeWrap = {
  marginTop: 10,
};

const sessionCodeLabel = {
  fontSize: 12,
  opacity: 0.65,
  display: "block",
  marginBottom: 6,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const sessionCodeBox = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 12,
  background: "rgba(244,196,49,0.12)",
  border: "1px solid rgba(244,196,49,0.35)",
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: 2,
  color: "#f4c431",
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

const collapseHeader = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  background: "transparent",
  border: "none",
  color: "white",
  fontSize: 22,
  fontWeight: 800,
  cursor: "pointer",
  padding: 0,
  textAlign: "left",
};

const collapseIcon = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#f4c431",
  fontSize: 24,
  lineHeight: 1,
  flexShrink: 0,
};

const uploadRow = {
  display: "flex",
  gap: 12,
  alignItems: "stretch",
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

const fileInputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 15,
  boxSizing: "border-box",
};

const editableItemList = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 10,
};

const editableItemCard = {
  padding: 14,
  borderRadius: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const editableItemFields = {
  display: "flex",
  gap: 10,
  flex: 1,
  minWidth: 0,
  flexWrap: "wrap",
};

const miniInput = {
  flex: 1,
  minWidth: 180,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 15,
  boxSizing: "border-box",
};

const miniCostInput = {
  width: 120,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 15,
  boxSizing: "border-box",
};

const emptyText = {
  opacity: 0.72,
  marginTop: 10,
};

const mutedInfoText = {
  marginTop: 12,
  marginBottom: 0,
  fontSize: 14,
  opacity: 0.78,
};

const successText = {
  marginTop: 12,
  marginBottom: 0,
  fontSize: 14,
  color: "#9BE39B",
  fontWeight: 700,
};

const errorText = {
  marginTop: 12,
  marginBottom: 0,
  fontSize: 14,
  color: "#FF9A9A",
  fontWeight: 700,
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

const ghostButton = {
  padding: "14px 22px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "transparent",
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